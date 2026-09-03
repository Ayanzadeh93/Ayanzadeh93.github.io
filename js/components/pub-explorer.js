/**
 * `<pub-explorer>` — turns a static publication list into a searchable,
 * filterable research index.
 *
 * The element enhances markup that is already in the light DOM rather than
 * rendering the list itself. That keeps every publication crawlable by search
 * engines and Google Scholar, keeps browser find-in-page working, keeps the
 * site's screen-reader page reader able to see the text, and leaves a
 * complete, readable list behind if the module fails to load.
 *
 * Everything the component adds — metrics, the per-year chart, the toolbar and
 * the citation buttons — is generated here, so no dead controls ship in the
 * HTML for visitors without JavaScript.
 */

import { splitAuthors } from '../lib/citations.js';
import {
    announce, debounce, el, icon, prefersReducedMotion, withViewTransition,
} from '../lib/dom.js';
import { fold, highlightTextNodes, scorePublication, tokenizeQuery } from '../lib/search.js';
import { getCiteDialog } from './cite-dialog.js';

const OWNER_NAME = 'aydin ayanzadeh';

/** Slug -> label for the research-area filter chips. */
const RESEARCH_AREAS = new Map([
    ['medical-imaging', 'Medical Imaging'],
    ['computer-vision', 'Computer Vision'],
    ['multimodal', 'Multimodal & VLM'],
    ['llm-agents', 'LLMs & Agents'],
    ['accessibility', 'Accessibility'],
    ['graph-learning', 'Graph Learning'],
    ['efficiency', 'Model Efficiency'],
    ['remote-sensing', 'Remote Sensing'],
    ['systems', 'Systems & Benchmarking'],
    ['optimization', 'Optimization'],
]);

const TYPE_LABELS = new Map([
    ['journal', 'Journal article'],
    ['conference', 'Conference paper'],
    ['chapter', 'Book chapter'],
    ['preprint', 'Preprint'],
]);

const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'first-author', label: 'First-author first' },
    { id: 'relevance', label: 'Best match' },
];

const DEFAULT_STATE = { q: '', type: 'all', area: 'all', sort: 'newest' };

class PubExplorer extends HTMLElement {
    /** @type {object[]} */
    #records = [];

    #state = { ...DEFAULT_STATE };

    #list;
    #searchInput;
    #clearButton;
    #resetButton;
    #resultCount;
    #emptyState;
    #areaChips;
    #typeSelect;
    #sortSelect;
    #exportButton;
    #chart;

    connectedCallback() {
        if (this.#records.length) return;

        this.#list = this.querySelector('[data-pub-list]');
        if (!this.#list) return;

        this.#records = [...this.#list.querySelectorAll('[data-pub]')].map(readRecord).filter(Boolean);
        if (this.#records.length === 0) return;

        this.#state = { ...DEFAULT_STATE, ...readStateFromUrl() };

        this.#renderChrome();
        this.#enhanceCards();
        this.dataset.enhanced = 'true';

        this.#apply({ animate: false, pushUrl: false });
        this.#observeForCountUp();
        this.#growChart();
    }

    // ---------------------------------------------------------------- chrome

    #renderChrome() {
        const header = el('div', { class: 'pub-explorer__header' }, [
            this.#buildMetrics(),
            this.#buildChart(),
        ]);

        this.#list.before(header, this.#buildToolbar(), this.#buildStatusBar());
        this.#emptyState = this.#buildEmptyState();
        this.#list.after(this.#emptyState);
    }

    #buildMetrics() {
        const byType = countBy(this.#records, (record) => record.type);
        const years = this.#records.map((record) => record.year);
        const firstAuthored = this.#records.filter((record) => record.isFirstAuthor).length;
        const peerReviewed = this.#records.filter((record) => record.type !== 'preprint').length;

        const metrics = [
            { value: this.#records.length, label: 'Publications' },
            { value: peerReviewed, label: 'Peer-reviewed' },
            { value: firstAuthored, label: 'First-authored' },
            { value: byType.get('journal') || 0, label: 'Journal articles' },
            {
                value: `${Math.min(...years)}\u2013${Math.max(...years)}`,
                label: 'Active years',
                animate: false,
            },
        ];

        return el('dl', { class: 'pub-metrics' }, metrics.map((metric) => el('div', {
            class: 'pub-metric',
        }, [
            el('dt', {
                class: 'pub-metric__value',
                dataset: metric.animate === false ? {} : { countTo: String(metric.value) },
                text: String(metric.value),
            }),
            el('dd', { class: 'pub-metric__label', text: metric.label }),
        ])));
    }

    /**
     * Publications per year, as a clickable bar chart.
     * Each bar is a real button so the chart is keyboard operable and doubles
     * as a year filter.
     */
    #buildChart() {
        const perYear = countBy(this.#records, (record) => record.year);
        const years = [...perYear.keys()].sort((a, b) => a - b);
        const peak = Math.max(...perYear.values());

        this.#chart = el('div', {
            class: 'pub-chart',
            role: 'group',
            'aria-label': 'Publications per year. Select a year to filter the list.',
        }, years.map((year) => {
            const count = perYear.get(year);
            const plural = count === 1 ? '' : 's';

            return el('button', {
                type: 'button',
                class: 'pub-chart__bar',
                dataset: { year: String(year), ratio: String(count / peak) },
                'aria-pressed': 'false',
                onclick: () => this.#toggleYear(String(year)),
            }, [
                el('span', { class: 'pub-chart__count', 'aria-hidden': 'true', text: String(count) }),
                el('span', { class: 'pub-chart__column', 'aria-hidden': 'true' }),
                el('span', { class: 'pub-chart__year', 'aria-hidden': 'true', text: String(year) }),
                el('span', { class: 'sr-only', text: `${year}, ${count} publication${plural}` }),
            ]);
        }));

        return this.#chart;
    }

    /**
     * `--bar-ratio` is registered as a `<number>` in components.css, so it can
     * be transitioned. Bars render at the registered initial value of 0 and are
     * given their real ratio one frame later, which produces the grow-in.
     */
    #growChart() {
        const bars = [...this.#chart.querySelectorAll('.pub-chart__bar')];
        const setRatios = () => bars.forEach((bar) => bar.style.setProperty('--bar-ratio', bar.dataset.ratio));

        if (prefersReducedMotion()) setRatios();
        else requestAnimationFrame(() => requestAnimationFrame(setRatios));
    }

    #buildToolbar() {
        this.#searchInput = el('input', {
            type: 'search',
            id: 'pub-search',
            class: 'pub-search__input',
            placeholder: 'Search titles, co-authors, venues\u2026',
            autocomplete: 'off',
            spellcheck: 'false',
            'aria-describedby': 'pub-search-hint',
            value: this.#state.q,
        });

        this.#searchInput.addEventListener('input', debounce(() => {
            const query = this.#searchInput.value;
            // Typing implies you want the closest match, not the newest paper.
            const sort = query && this.#state.sort === 'newest' ? 'relevance' : this.#state.sort;
            this.#update({ q: query, sort });
        }, 160));

        this.#searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.#searchInput.value) {
                event.stopPropagation();
                this.#clearSearch();
            }
        });

        this.#clearButton = el('button', {
            type: 'button',
            class: 'pub-search__clear',
            'aria-label': 'Clear search',
            onclick: () => this.#clearSearch(),
        }, icon('close', { size: 14 }));

        const search = el('div', { class: 'pub-search' }, [
            icon('search', { size: 16, className: 'pub-search__icon' }),
            el('label', { class: 'sr-only', for: 'pub-search', text: 'Search publications' }),
            this.#searchInput,
            this.#clearButton,
            el('kbd', { class: 'pub-search__kbd', 'aria-hidden': 'true', text: '/' }),
        ]);

        this.#typeSelect = this.#buildSelect('pub-type', 'Type', [
            { id: 'all', label: 'All types' },
            ...[...TYPE_LABELS].map(([id, label]) => ({ id, label: `${label}s` })),
        ], this.#state.type, (value) => this.#update({ type: value }));

        this.#sortSelect = this.#buildSelect('pub-sort', 'Sort', SORT_OPTIONS, this.#state.sort,
            (value) => this.#update({ sort: value }));

        this.#exportButton = el('button', {
            type: 'button',
            class: 'pub-button pub-button--ghost',
            onclick: () => this.#exportVisible(),
        }, [icon('download'), el('span', { text: 'Export list' })]);

        return el('div', { class: 'pub-toolbar' }, [
            search,
            el('div', { class: 'pub-toolbar__controls' }, [
                this.#typeSelect,
                this.#sortSelect,
                this.#exportButton,
            ]),
            this.#buildAreaChips(),
            el('p', {
                id: 'pub-search-hint',
                class: 'sr-only',
                text: 'Press the slash key to jump to this search box. Results update as you type.',
            }),
        ]);
    }

    #buildSelect(id, label, options, selected, onChange) {
        const select = el('select', {
            id,
            class: 'pub-select__control',
            onchange: (event) => onChange(event.target.value),
        }, options.map((option) => el('option', {
            value: option.id,
            selected: option.id === selected,
            text: option.label,
        })));

        return el('div', { class: 'pub-select' }, [
            el('label', { class: 'pub-select__label', for: id, text: label }),
            select,
        ]);
    }

    #buildAreaChips() {
        const used = new Set(this.#records.flatMap((record) => record.topics));
        const areas = [...RESEARCH_AREAS].filter(([slug]) => used.has(slug));

        this.#areaChips = el('div', {
            class: 'pub-chips',
            role: 'group',
            'aria-label': 'Filter by research area',
        }, [
            this.#buildChip('all', 'All areas'),
            ...areas.map(([slug, label]) => this.#buildChip(slug, label)),
        ]);

        return this.#areaChips;
    }

    #buildChip(slug, label) {
        return el('button', {
            type: 'button',
            class: 'pub-chip',
            dataset: { area: slug },
            'aria-pressed': String(this.#state.area === slug),
            text: label,
            onclick: () => this.#update({ area: slug }),
        });
    }

    #buildStatusBar() {
        this.#resultCount = el('p', {
            class: 'pub-status__count',
            role: 'status',
            'aria-live': 'polite',
        });

        this.#resetButton = el('button', {
            type: 'button',
            class: 'pub-button pub-button--quiet',
            hidden: true,
            onclick: () => this.#reset(),
        }, [icon('reset', { size: 14 }), el('span', { text: 'Clear filters' })]);

        return el('div', { class: 'pub-status' }, [this.#resultCount, this.#resetButton]);
    }

    #buildEmptyState() {
        return el('div', { class: 'pub-empty', hidden: true }, [
            el('p', { class: 'pub-empty__title', text: 'No publications match those filters.' }),
            el('p', {
                class: 'pub-empty__hint',
                text: 'Try a broader search term, or clear the filters to see the full list.',
            }),
            el('button', {
                type: 'button',
                class: 'pub-button',
                onclick: () => this.#reset(),
            }, [icon('reset', { size: 14 }), el('span', { text: 'Show all publications' })]),
        ]);
    }

    // ----------------------------------------------------------------- cards

    /** Append the generated actions (Cite, and a topic row) to each card. */
    #enhanceCards() {
        for (const record of this.#records) {
            const links = record.element.querySelector('[data-pub-links]');
            if (links) {
                links.append(el('button', {
                    type: 'button',
                    class: 'pub-link pub-link--action',
                    onclick: () => this.#cite(record),
                }, [icon('quote', { size: 14 }), el('span', { text: 'Cite' })]));
            }

            if (record.topics.length === 0) continue;

            record.element.append(el('ul', { class: 'pub-topics' }, record.topics.map((slug) => el('li', {},
                el('button', {
                    type: 'button',
                    class: 'pub-topic',
                    text: RESEARCH_AREAS.get(slug) || slug,
                    'aria-label': `Filter by ${RESEARCH_AREAS.get(slug) || slug}`,
                    onclick: () => this.#update({ area: slug }),
                }),
            ))));
        }
    }

    #cite(record) {
        getCiteDialog().open({
            publications: [record],
            subject: record.title,
            filename: record.key,
        });
    }

    #exportVisible() {
        const visible = this.#records.filter((record) => !record.element.hidden);
        if (visible.length === 0) return;

        getCiteDialog().open({
            publications: visible,
            heading: 'Export reference list',
            subject: `${visible.length} publication${visible.length === 1 ? '' : 's'} matching the current filters`,
            filename: 'ayanzadeh-publications',
        });
    }

    // ----------------------------------------------------------------- state

    #update(patch) {
        this.#state = { ...this.#state, ...patch };
        this.#apply();
    }

    #clearSearch() {
        this.#searchInput.value = '';
        this.#update({ q: '', sort: this.#state.sort === 'relevance' ? 'newest' : this.#state.sort });
        this.#searchInput.focus();
    }

    #toggleYear(year) {
        const query = this.#state.q === year ? '' : year;
        this.#searchInput.value = query;
        this.#update({ q: query, sort: query ? 'relevance' : 'newest' });
    }

    #reset() {
        this.#state = { ...DEFAULT_STATE };
        this.#searchInput.value = '';
        this.#apply();
        this.#searchInput.focus();
    }

    #apply({ animate = true, pushUrl = true } = {}) {
        const terms = tokenizeQuery(this.#state.q);

        const scored = this.#records.map((record) => ({
            record,
            score: this.#matches(record) ? scorePublication(record, terms) : 0,
        }));

        const visible = scored.filter((entry) => entry.score > 0);
        this.#order(visible);

        const render = () => {
            for (const { record } of scored) {
                record.element.hidden = true;
            }

            visible.forEach(({ record }, index) => {
                record.element.hidden = false;
                record.element.style.order = String(index);
                this.#highlight(record, terms);
            });

            this.#syncChrome(visible.length);
        };

        if (animate) withViewTransition(render);
        else render();

        if (pushUrl) writeStateToUrl(this.#state);
    }

    #matches(record) {
        const { type, area } = this.#state;
        if (type !== 'all' && record.type !== type) return false;
        if (area !== 'all' && !record.topics.includes(area)) return false;
        return true;
    }

    #order(entries) {
        const comparators = {
            newest: (a, b) => b.record.year - a.record.year || a.record.index - b.record.index,
            oldest: (a, b) => a.record.year - b.record.year || a.record.index - b.record.index,
            'first-author': (a, b) => Number(b.record.isFirstAuthor) - Number(a.record.isFirstAuthor)
                || b.record.year - a.record.year,
            relevance: (a, b) => b.score - a.score || b.record.year - a.record.year,
        };

        entries.sort(comparators[this.#state.sort] || comparators.newest);
    }

    #highlight(record, terms) {
        for (const [node, original] of record.highlightTargets) {
            highlightTextNodes(node, original, terms);
        }
    }

    #syncChrome(visibleCount) {
        const total = this.#records.length;
        const isFiltered = this.#state.q !== '' || this.#state.type !== 'all' || this.#state.area !== 'all';

        this.#resultCount.textContent = isFiltered
            ? `Showing ${visibleCount} of ${total} publications`
            : `${total} publications`;

        this.#resetButton.hidden = !isFiltered;
        this.#clearButton.hidden = this.#state.q === '';
        this.#emptyState.hidden = visibleCount > 0;
        this.#list.hidden = visibleCount === 0;

        this.#typeSelect.querySelector('select').value = this.#state.type;
        this.#sortSelect.querySelector('select').value = this.#state.sort;
        if (this.#searchInput.value !== this.#state.q) this.#searchInput.value = this.#state.q;

        for (const chip of this.#areaChips.querySelectorAll('.pub-chip')) {
            chip.setAttribute('aria-pressed', String(chip.dataset.area === this.#state.area));
        }

        for (const bar of this.#chart.querySelectorAll('.pub-chart__bar')) {
            bar.setAttribute('aria-pressed', String(bar.dataset.year === this.#state.q));
        }

        this.#exportButton.disabled = visibleCount === 0;

        if (isFiltered) {
            announce(`${visibleCount} of ${total} publications match the current filters.`);
        }
    }

    // ------------------------------------------------------------- animation

    /** Count the metric numbers up the first time the block scrolls into view. */
    #observeForCountUp() {
        const values = [...this.querySelectorAll('[data-count-to]')];
        if (values.length === 0) return;

        if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
            values.forEach((node) => { node.textContent = node.dataset.countTo; });
            return;
        }

        values.forEach((node) => { node.textContent = '0'; });

        const observer = new IntersectionObserver((entries, self) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                countUp(entry.target, Number(entry.target.dataset.countTo));
                self.unobserve(entry.target);
            }
        }, { threshold: 0.4 });

        values.forEach((node) => observer.observe(node));
    }

    /** Focus the search box — used by the global "/" shortcut. */
    focusSearch() {
        this.#searchInput?.focus();
        this.#searchInput?.select();
    }
}

// ------------------------------------------------------------------ helpers

function readRecord(element, index) {
    const data = element.dataset;
    const title = element.querySelector('[data-pub-title]');
    const authors = element.querySelector('[data-pub-authors]');
    const venue = element.querySelector('[data-pub-venue]');

    if (!title || !authors) return null;

    const titleText = normalizeText(title.textContent);
    const authorsText = normalizeText(authors.textContent);
    const venueText = normalizeText(venue?.textContent ?? '');
    const authorList = splitAuthors(authorsText);
    const topics = (data.topics || '').split(/\s+/).filter(Boolean);

    // Keep pristine copies so highlighting can be re-applied from scratch
    // without compounding <mark> elements or losing the <strong> author name.
    const highlightTargets = [title, authors, venue]
        .filter(Boolean)
        .map((node) => [node, node.cloneNode(true)]);

    return {
        element,
        index,
        key: data.key || `pub-${index}`,
        title: titleText,
        authors: authorList,
        year: Number(data.year) || 0,
        type: data.type || 'conference',
        venue: venueText,
        journal: data.journal || '',
        booktitle: data.booktitle || '',
        volume: data.volume || '',
        number: data.number || '',
        pages: data.pages || '',
        publisher: data.publisher || '',
        doi: data.doi || '',
        arxiv: data.arxiv || '',
        primaryClass: data.primaryClass || '',
        url: data.url || element.querySelector('[data-pub-links] a[href^="http"]')?.href || '',
        topics,
        isFirstAuthor: fold(authorList[0] || '') === OWNER_NAME,
        highlightTargets,
        searchable: {
            title: fold(titleText),
            authors: fold(authorsText),
            venue: fold(`${venueText} ${data.journal || ''} ${data.booktitle || ''}`),
            topics: fold(topics.map((slug) => RESEARCH_AREAS.get(slug) || slug).join(' ')),
        },
    };
}

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function countBy(items, keyOf) {
    const counts = new Map();
    for (const item of items) {
        const key = keyOf(item);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

function countUp(node, target, duration = 900) {
    const start = performance.now();

    const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        // Ease-out cubic so the number settles rather than stopping abruptly.
        const eased = 1 - (1 - progress) ** 3;
        node.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const state = {};

    for (const key of Object.keys(DEFAULT_STATE)) {
        const value = params.get(key);
        if (value) state[key] = value;
    }

    if (state.sort && !SORT_OPTIONS.some((option) => option.id === state.sort)) delete state.sort;
    if (state.type && state.type !== 'all' && !TYPE_LABELS.has(state.type)) delete state.type;
    if (state.area && state.area !== 'all' && !RESEARCH_AREAS.has(state.area)) delete state.area;

    return state;
}

/**
 * Reflect the filters in the address bar so a filtered view can be shared or
 * bookmarked. `replaceState` keeps the back button pointing at the previous
 * page rather than the previous keystroke.
 */
function writeStateToUrl(state) {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(state)) {
        if (value && value !== DEFAULT_STATE[key]) params.set(key, value);
        else params.delete(key);
    }

    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
}

customElements.define('pub-explorer', PubExplorer);

/** "/" focuses the publication search from anywhere on the page. */
document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

    const active = document.activeElement;
    const isTyping = active instanceof HTMLElement
        && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
    if (isTyping) return;

    const explorer = document.querySelector('pub-explorer');
    if (!explorer?.focusSearch) return;

    event.preventDefault();
    explorer.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    explorer.focusSearch();
});
