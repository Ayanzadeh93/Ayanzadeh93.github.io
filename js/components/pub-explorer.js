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
 * so CSS can respond with :has() and no extra classes are needed.
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

export class PubExplorer extends HTMLElement {
    #list = null;
    #records = [];
    #toolbar = null;
    #input = null;
    #countEl = null;
    #emptyState = null;
    #chips = new Map();
    #sortSelect = null;
    #state = { query: '', type: 'all', sort: 'newest' };

    connectedCallback() {
        if (this.#list) return;

        this.#list = this.querySelector('.publications-list');
        if (!this.#list) return;

        this.#records = this.#collectRecords();
        if (this.#records.length === 0) return;

        this.#buildToolbar();
        this.#bindCiteButtons();
        this.#bindShortcut();
        this.#apply({ animate: false });
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
                // Ranking only means something once there is a query.
                if (this.#state.query && this.#sortSelect.value === 'newest') {
                    this.#sortSelect.value = 'relevance';
                    this.#state.sort = 'relevance';
                }
                this.#apply();
            }, 140),
            onKeydown: (event) => {
                if (event.key === 'Escape' && this.#input.value) {
                    event.stopPropagation();
                    this.#input.value = '';
                    this.#state.query = '';
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
                    el('label', { class: 'sr-only', for: 'pub-explorer-sort' }, 'Sort publications'),
                    this.#sortSelect
                )
            ),
            chipGroup
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

    /** Recompute the visible set and reflect it in the DOM. */
    #apply({ animate = true } = {}) {
        const visible = filterRecords(this.#records, this.#state);
        const visibleSet = new Set(visible);
        const tokens = tokenize(this.#state.query);

        for (const [id, chip] of this.#chips) {
            chip.setAttribute('aria-pressed', String(id === this.#state.type));
        }

        this.dataset.query = this.#state.query ? 'active' : '';
        this.dataset.type = this.#state.type;
        this.dataset.sort = this.#state.sort;

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
     * Wrap query matches in the card title with <mark>.
     * Rebuilt from the stored plain-text title each time, so highlights never
     * stack and no HTML string is ever parsed.
     */
    #highlight(record, tokens) {
        if (!record.titleEl) return;

        const ranges = tokens.length ? matchRanges(record.title, tokens) : [];

        if (ranges.length === 0) {
            if (record.titleEl.dataset.highlighted === 'true') {
                record.titleEl.textContent = record.title;
                delete record.titleEl.dataset.highlighted;
            }
            return;
        }

        clear(record.titleEl);
        let cursor = 0;

        for (const range of ranges) {
            if (range.start > cursor) {
                record.titleEl.append(record.title.slice(cursor, range.start));
            }
            record.titleEl.append(
                el('mark', { class: 'pub-explorer__mark' }, record.title.slice(range.start, range.end))
            );
            cursor = range.end;
        }

        if (cursor < record.title.length) {
            record.titleEl.append(record.title.slice(cursor));
        }

        record.titleEl.dataset.highlighted = 'true';
    }

    /** Clear every filter and return to the default view. */
    reset() {
        this.#state = { query: '', type: 'all', sort: 'newest' };
        this.#input.value = '';
        this.#sortSelect.value = 'newest';
        this.#apply();
        this.#input.focus();
    }
}

if (!customElements.get('pub-explorer')) {
    customElements.define('pub-explorer', PubExplorer);
}
