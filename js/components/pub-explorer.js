/**
 * <pub-explorer> — progressive enhancement for the publications list.
 *
 * The element wraps markup that is already complete: every publication ships
 * in the HTML, so the section reads and indexes fine with JavaScript off. What
 * this adds is a toolbar — ranked search, type facets, sort order — plus the
 * wiring that opens <cite-dialog> for a card's Cite button.
 *
 * Structured metadata lives in data-* attributes on each .publication-item, so
 * the page stays the single source of truth; nothing is duplicated into JS.
 *
 *   <pub-explorer>
 *     <div class="publications-list">
 *       <div class="publication-item" data-type="article" data-year="2023" ...>
 *
 * The element reflects its state on itself (data-query / data-type / data-sort)
 * so CSS can respond with :has() and no extra classes are needed. The same
 * state is mirrored into the URL query string, so a filtered view can be
 * bookmarked or pasted into an email.
 */

import { el, clear, debounce, withViewTransition } from '../lib/dom.js';
import { parseAuthors } from '../lib/citations.js';
import { filterRecords, buildHaystack, tokenize, matchRanges } from '../lib/search.js';

/** Facet labels, in the order a reader scans them. */
const TYPE_LABELS = {
    article: 'Journal',
    inproceedings: 'Conference',
    incollection: 'Book Chapter',
    preprint: 'Preprint'
};

const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'relevance', label: 'Best match' }
];

const DEFAULT_STATE = { query: '', type: 'all', year: 'all', sort: 'newest' };

/** Query-string key per state field. Short, because these end up in links. */
const URL_KEYS = { query: 'q', type: 'type', year: 'year', sort: 'sort' };

export class PubExplorer extends HTMLElement {
    #list = null;
    #records = [];
    #toolbar = null;
    #input = null;
    #countEl = null;
    #emptyState = null;
    #chips = new Map();
    #sortSelect = null;
    #yearSelect = null;
    #exportButton = null;
    #visible = [];
    #state = { ...DEFAULT_STATE };

    connectedCallback() {
        if (this.#list) return;

        this.#list = this.querySelector('.publications-list');
        if (!this.#list) return;

        this.#records = this.#collectRecords();
        if (this.#records.length === 0) return;

        this.#state = { ...DEFAULT_STATE, ...this.#readStateFromUrl() };

        this.#buildToolbar();
        this.#bindCiteButtons();
        this.#bindShortcut();
        this.#apply({ animate: false, pushUrl: false });
    }

    /**
     * Read filters back out of the query string, ignoring anything that is not
     * a value this page can actually offer.
     */
    #readStateFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const state = {};

        const query = params.get(URL_KEYS.query);
        if (query) state.query = query;

        const type = params.get(URL_KEYS.type);
        if (type && (type === 'all' || TYPE_LABELS[type])) state.type = type;

        const year = params.get(URL_KEYS.year);
        if (year && (year === 'all' || this.#years().includes(year))) state.year = year;

        const sort = params.get(URL_KEYS.sort);
        if (sort && SORT_OPTIONS.some((option) => option.id === sort)) state.sort = sort;

        return state;
    }

    /**
     * Mirror the filters into the address bar.
     *
     * replaceState, not pushState: a reader typing six characters should not
     * have to press Back six times to leave the page.
     */
    #writeStateToUrl() {
        const params = new URLSearchParams(window.location.search);

        for (const [field, key] of Object.entries(URL_KEYS)) {
            if (this.#state[field] && this.#state[field] !== DEFAULT_STATE[field]) {
                params.set(key, this.#state[field]);
            } else {
                params.delete(key);
            }
        }

        const query = params.toString();
        window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
        );
    }

    /** Distinct publication years, newest first. */
    #years() {
        return [...new Set(this.#records.map((record) => String(record.year)).filter(Boolean))]
            .sort((a, b) => Number(b) - Number(a));
    }

    /** Read every card in the light DOM into a searchable, citable record. */
    #collectRecords() {
        const cards = Array.from(this.#list.querySelectorAll('.publication-item'));

        return cards.map((card, index) => {
            const titleEl = card.querySelector('h4');
            const authorsEl = card.querySelector('.authors');
            const venueEl = card.querySelector('.publication-venue');

            const title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
            const { authors, etAl } = parseAuthors(authorsEl ? authorsEl.textContent : '');

            // data-venue carries the clean container title for citations; the
            // rendered line stays human-readable ("…, vol. 213, 119040, 2023").
            const venue = card.dataset.venue
                || (venueEl ? venueEl.textContent.replace(/\s+/g, ' ').trim() : '');

            const paperLink = card.querySelector('.pub-link[href^="http"]');

            const record = {
                index,
                card,
                titleEl,
                // Pristine copies of the lines that get highlighted. Rebuilding
                // from a clone keeps the <strong> around the site owner's name
                // in the author list, which a textContent round-trip would drop.
                highlightable: [titleEl, authorsEl, venueEl]
                    .filter(Boolean)
                    .map((node) => ({ node, pristine: node.cloneNode(true) })),
                title,
                authors,
                etAl,
                venue,
                year: card.dataset.year || '',
                type: card.dataset.type || 'misc',
                volume: card.dataset.volume || '',
                number: card.dataset.number || '',
                pages: card.dataset.pages || '',
                publisher: card.dataset.publisher || '',
                doi: card.dataset.doi || '',
                arxiv: card.dataset.arxiv || '',
                status: card.dataset.status || '',
                url: paperLink ? paperLink.href : ''
            };

            record.haystack = buildHaystack({
                title: record.title,
                authors: record.authors,
                venue: `${record.venue} ${venueEl ? venueEl.textContent : ''}`,
                year: record.year,
                tags: TYPE_LABELS[record.type] || ''
            });

            return record;
        });
    }

    #buildToolbar() {
        const searchId = 'pub-explorer-search';

        this.#input = el('input', {
            type: 'search',
            id: searchId,
            class: 'pub-explorer__input',
            placeholder: 'Search by title, author, venue or year…',
            autocomplete: 'off',
            'aria-describedby': 'pub-explorer-count',
            onInput: debounce(() => {
                this.#state.query = this.#input.value;
                this.#syncRelevanceSort();
                this.#apply();
            }, 140),
            onKeydown: (event) => {
                if (event.key === 'Escape' && this.#input.value) {
                    event.stopPropagation();
                    this.#input.value = '';
                    this.#state.query = '';
                    this.#syncRelevanceSort();
                    this.#apply();
                }
            }
        });

        const searchField = el('div', { class: 'pub-explorer__search' },
            el('label', { class: 'sr-only', for: searchId }, 'Search publications'),
            el('i', { class: 'fas fa-search pub-explorer__search-icon', 'aria-hidden': 'true' }),
            this.#input
        );

        const chipGroup = el('div', {
            class: 'pub-explorer__chips',
            role: 'group',
            'aria-label': 'Filter publications by type'
        });

        const counts = this.#typeCounts();
        const facets = [{ id: 'all', label: 'All', count: this.#records.length }].concat(
            Object.keys(TYPE_LABELS)
                .filter((type) => counts[type])
                .map((type) => ({ id: type, label: TYPE_LABELS[type], count: counts[type] }))
        );

        for (const facet of facets) {
            const chip = el('button', {
                type: 'button',
                class: 'pub-explorer__chip',
                'aria-pressed': String(facet.id === this.#state.type),
                dataset: { type: facet.id },
                onClick: () => {
                    this.#state.type = facet.id;
                    this.#apply();
                }
            },
                facet.label,
                el('span', { class: 'pub-explorer__chip-count', 'aria-hidden': 'true' }, String(facet.count))
            );

            this.#chips.set(facet.id, chip);
            chipGroup.append(chip);
        }

        this.#sortSelect = el('select', {
            class: 'pub-explorer__sort',
            id: 'pub-explorer-sort',
            onChange: () => {
                this.#state.sort = this.#sortSelect.value;
                this.#apply();
            }
        }, SORT_OPTIONS.map((option) => el('option', { value: option.id }, option.label)));
        this.#sortSelect.value = this.#state.sort;

        this.#yearSelect = el('select', {
            class: 'pub-explorer__sort pub-explorer__year',
            id: 'pub-explorer-year',
            onChange: () => {
                this.#state.year = this.#yearSelect.value;
                this.#apply();
            }
        },
            el('option', { value: 'all' }, 'All years'),
            this.#years().map((year) => el('option', { value: year }, year))
        );
        this.#yearSelect.value = this.#state.year;

        // Reference managers take a whole list at once; offering only
        // per-paper citations makes the reader open the dialog sixteen times.
        this.#exportButton = el('button', {
            type: 'button',
            class: 'pub-explorer__export',
            onClick: () => this.#exportVisible()
        },
            el('i', { class: 'fas fa-download', 'aria-hidden': 'true' }),
            el('span', { class: 'pub-explorer__export-label' }, ' Export references')
        );

        this.#countEl = el('p', {
            class: 'pub-explorer__count',
            id: 'pub-explorer-count',
            role: 'status',
            'aria-live': 'polite'
        });

        this.#toolbar = el('div', { class: 'pub-explorer__toolbar' },
            el('div', { class: 'pub-explorer__row' },
                searchField,
                el('div', { class: 'pub-explorer__sort-field' },
                    el('label', { class: 'sr-only', for: 'pub-explorer-year' }, 'Filter publications by year'),
                    this.#yearSelect,
                    el('label', { class: 'sr-only', for: 'pub-explorer-sort' }, 'Sort publications'),
                    this.#sortSelect
                )
            ),
            el('div', { class: 'pub-explorer__row pub-explorer__row--secondary' },
                chipGroup,
                this.#exportButton
            )
        );

        this.#emptyState = el('div', { class: 'pub-explorer__empty', hidden: true },
            el('p', {}, 'No publications match those filters.'),
            el('button', {
                type: 'button',
                class: 'pub-explorer__reset',
                onClick: () => this.reset()
            }, 'Clear filters')
        );

        this.insertBefore(this.#toolbar, this.#list);
        this.insertBefore(this.#countEl, this.#list);
        this.append(this.#emptyState);
    }

    /**
     * Keep "Best match" tied to there being something to match.
     *
     * Typing opts into ranking; clearing the box opts back out, so the control
     * never sits on a mode that cannot do anything — and a shared link does
     * not carry a meaningless sort=relevance.
     */
    #syncRelevanceSort() {
        if (this.#state.query && this.#state.sort === 'newest') {
            this.#state.sort = 'relevance';
        } else if (!this.#state.query && this.#state.sort === 'relevance') {
            this.#state.sort = 'newest';
        } else {
            return;
        }

        this.#sortSelect.value = this.#state.sort;
    }

    #typeCounts() {
        return this.#records.reduce((counts, record) => {
            counts[record.type] = (counts[record.type] || 0) + 1;
            return counts;
        }, {});
    }

    /**
     * Replace each card's inline "Cite" anchor behaviour with the dialog.
     * The markup ships a <button data-cite>, so there is no link that only
     * works with JavaScript — without JS the button is simply absent from the
     * tab order's expectations because it is rendered inert here.
     */
    #bindCiteButtons() {
        for (const record of this.#records) {
            const button = record.card.querySelector('[data-cite]');
            if (!button) continue;

            button.hidden = false;
            // Sixteen buttons all labelled "Cite" are indistinguishable in a
            // screen reader's element list; name each one by its paper.
            if (record.title) button.setAttribute('aria-label', `Cite: ${record.title}`);

            button.addEventListener('click', () => {
                const dialog = document.querySelector('cite-dialog');
                if (dialog && typeof dialog.open === 'function') dialog.open(record);
            });
        }
    }

    /** "/" focuses search, the convention readers already know from GitHub. */
    #bindShortcut() {
        document.addEventListener('keydown', (event) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

            const active = document.activeElement;
            const typing = active && (
                active.tagName === 'INPUT'
                || active.tagName === 'TEXTAREA'
                || active.tagName === 'SELECT'
                || active.isContentEditable
            );
            if (typing) return;

            // Only claim the key when the section is actually on screen.
            const box = this.getBoundingClientRect();
            if (box.bottom < 0 || box.top > window.innerHeight) return;

            event.preventDefault();
            this.#input.focus();
        });
    }

    /**
     * Hand the current selection to the citation dialog as one reference list.
     * The label names the selection so the export reads as a deliberate slice
     * rather than an anonymous pile of entries.
     */
    #exportVisible() {
        if (this.#visible.length === 0) return;

        const dialog = document.querySelector('cite-dialog');
        if (!dialog || typeof dialog.openCollection !== 'function') return;

        dialog.openCollection(this.#visible, this.#selectionLabel());
    }

    /** A human description of the active filters, e.g. "Conference, 2026". */
    #selectionLabel() {
        const parts = [];

        if (this.#state.type !== 'all') parts.push(TYPE_LABELS[this.#state.type]);
        if (this.#state.year !== 'all') parts.push(this.#state.year);
        if (this.#state.query) parts.push(`“${this.#state.query}”`);

        return parts.length ? parts.join(', ') : 'all publications';
    }

    /** Recompute the visible set and reflect it in the DOM. */
    #apply({ animate = true, pushUrl = true } = {}) {
        const visible = filterRecords(this.#records, this.#state);
        const visibleSet = new Set(visible);
        const tokens = tokenize(this.#state.query);

        this.#visible = visible;

        for (const [id, chip] of this.#chips) {
            chip.setAttribute('aria-pressed', String(id === this.#state.type));
        }

        this.#exportButton.disabled = visible.length === 0;
        this.#exportButton.setAttribute(
            'aria-label',
            `Export ${visible.length} reference${visible.length === 1 ? '' : 's'} as BibTeX or RIS`
        );

        this.dataset.query = this.#state.query ? 'active' : '';
        this.dataset.type = this.#state.type;
        this.dataset.year = this.#state.year;
        this.dataset.sort = this.#state.sort;

        if (pushUrl) this.#writeStateToUrl();

        const total = this.#records.length;
        const label = visible.length === total
            ? `Showing all ${total} publications`
            : `Showing ${visible.length} of ${total} publications`;

        // A View Transition defers its callback by a frame or two. Everything
        // the reader observes therefore has to change inside it: updating the
        // count outside would announce "showing 3" while 16 are still on
        // screen. Toolbar state is the exception — it belongs to the control
        // the reader just operated, so it tracks the click immediately.
        const mutate = () => {
            for (const record of this.#records) {
                record.card.hidden = !visibleSet.has(record);
                this.#highlight(record, tokens);

                // Cards start at opacity 0 until the scroll observer reveals
                // them (see .js-enabled .publication-item in style.css). Once
                // the reader filters, a card can jump to the top of the list
                // before that observer ever fires, so reveal it outright.
                if (animate) record.card.classList.add('animate-in');
            }

            // DOM order tracks visual order, which keeps tab and screen-reader
            // order correct after a re-sort.
            for (const record of visible) {
                this.#list.append(record.card);
            }

            this.#emptyState.hidden = visible.length > 0;
            this.#list.hidden = visible.length === 0;

            // #countEl is itself role="status" aria-live="polite", so writing
            // it here is what announces the result — no second live region.
            this.#countEl.textContent = label;
        };

        if (animate) {
            this.#withNamedCards(visible, mutate);
        } else {
            mutate();
        }
    }

    /**
     * Give the visible cards unique view-transition names just for the length
     * of one transition. Naming them permanently would make every unrelated
     * transition on the page animate seventeen extra elements.
     */
    #withNamedCards(visible, mutate) {
        if (!document.startViewTransition) {
            mutate();
            return;
        }

        visible.forEach((record, position) => {
            record.card.style.viewTransitionName = `pub-card-${position}`;
        });

        withViewTransition(mutate, 'pub-explorer').finally(() => {
            for (const record of this.#records) {
                record.card.style.viewTransitionName = '';
            }
        });
    }

    /**
     * Wrap query matches with <mark> across the title, authors and venue.
     *
     * Searching for a co-author used to filter the list without showing why a
     * card survived; highlighting every searched line makes the match visible
     * where the reader is already looking.
     */
    #highlight(record, tokens) {
        for (const target of record.highlightable) {
            this.#highlightLine(target, tokens);
        }
    }

    /**
     * Restore one line from its pristine copy, then wrap matches inside it.
     *
     * Highlighting walks text nodes rather than rebuilding from a string, so
     * inline markup survives and nothing is ever parsed as HTML.
     */
    #highlightLine(target, tokens) {
        const { node, pristine } = target;

        if (tokens.length === 0) {
            if (node.dataset.highlighted !== 'true') return;
            this.#restore(node, pristine);
            delete node.dataset.highlighted;
            return;
        }

        this.#restore(node, pristine);

        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        let marked = false;

        for (const textNode of textNodes) {
            const text = textNode.nodeValue;
            const ranges = matchRanges(text, tokens);
            if (ranges.length === 0) continue;

            const fragment = document.createDocumentFragment();
            let cursor = 0;

            for (const range of ranges) {
                if (range.start > cursor) fragment.append(text.slice(cursor, range.start));
                fragment.append(
                    el('mark', { class: 'pub-explorer__mark' }, text.slice(range.start, range.end))
                );
                cursor = range.end;
            }

            if (cursor < text.length) fragment.append(text.slice(cursor));

            textNode.replaceWith(fragment);
            marked = true;
        }

        if (marked) node.dataset.highlighted = 'true';
        else delete node.dataset.highlighted;
    }

    /** Replace a node's children with a fresh copy of its pristine contents. */
    #restore(node, pristine) {
        clear(node);
        for (const child of Array.from(pristine.cloneNode(true).childNodes)) {
            node.append(child);
        }
    }

    /** Clear every filter and return to the default view. */
    reset() {
        this.#state = { ...DEFAULT_STATE };
        this.#input.value = '';
        this.#sortSelect.value = DEFAULT_STATE.sort;
        if (this.#yearSelect) this.#yearSelect.value = DEFAULT_STATE.year;
        this.#apply();
        this.#input.focus();
    }
}

if (!customElements.get('pub-explorer')) {
    customElements.define('pub-explorer', PubExplorer);
}
