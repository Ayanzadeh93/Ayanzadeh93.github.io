/**
 * <pub-library> — progressive enhancement for the publication library.
 *
 * The element wraps markup that is already complete: every publication, grouped
 * by year, ships in the HTML (generated from data/publications.json), so the
 * page reads and indexes fine with JavaScript off. What this adds is the
 * toolbar's behaviour — ranked search across title, authors, venue and
 * keywords, plus type and research-thread facets — and a shareable URL for the
 * current view (?q=…&type=…&topic=…).
 *
 * The toolbar markup is server-rendered with `hidden`; it is only revealed
 * once this element upgrades, so there is never a control that does nothing.
 */

import { clear, debounce, el } from '../lib/dom.js';
import { buildHaystack, matchRanges, scoreRecord, tokenize } from '../lib/search.js';
import { publicationRecords } from '../lib/pub-data.js';

const WEIGHTS = { title: 10, authors: 6, venue: 4, tags: 3, year: 2 };

export class PubLibrary extends HTMLElement {
    #items = [];
    #groups = [];
    #input = null;
    #count = null;
    #empty = null;
    #chips = [];
    #state = { query: '', type: 'all', topic: 'all' };

    connectedCallback() {
        if (this.#items.length) return;

        const toolbar = this.querySelector('[data-toolbar]');
        const records = publicationRecords();
        if (!toolbar) return;

        this.#items = Array.from(this.querySelectorAll('[data-pub]')).map((node, index) => {
            const record = records[node.dataset.pub] || {};
            const titleEl = node.querySelector('.pub__title a') || node.querySelector('.pub__title');
            return {
                index,
                node,
                titleEl,
                title: titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '',
                type: node.dataset.type || '',
                topic: node.dataset.topic || '',
                haystack: buildHaystack({
                    title: record.title || '',
                    authors: record.authors || [],
                    venue: [record.venue, record.venueShort].filter(Boolean).join(' '),
                    year: record.year || '',
                    tags: record.keywords || ''
                })
            };
        });
        if (!this.#items.length) return;

        this.#groups = Array.from(this.querySelectorAll('[data-year]'));
        this.#input = toolbar.querySelector('input[type="search"]');
        this.#count = toolbar.querySelector('[data-count]');
        this.#empty = this.querySelector('[data-empty]');
        this.#chips = Array.from(toolbar.querySelectorAll('[data-facet]'));

        this.#readUrl();
        this.#bind();
        toolbar.hidden = false;
        this.#apply({ updateUrl: false });
    }

    #bind() {
        this.#input.addEventListener('input', debounce(() => {
            this.#state.query = this.#input.value;
            this.#apply();
        }, 120));

        this.#input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.#input.value) {
                event.stopPropagation();
                this.#input.value = '';
                this.#state.query = '';
                this.#apply();
            }
        });

        for (const chip of this.#chips) {
            chip.addEventListener('click', () => {
                this.#state[chip.dataset.facet] = chip.dataset.value;
                this.#apply();
            });
        }

        const reset = this.querySelector('[data-reset]');
        if (reset) reset.addEventListener('click', () => this.reset());

        // "/" focuses search, the convention readers know from GitHub and docs sites.
        document.addEventListener('keydown', (event) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
            const active = document.activeElement;
            const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
            if (typing) return;
            event.preventDefault();
            this.#input.focus();
        });
    }

    /** A filtered view is a link someone can send: read it back on load. */
    #readUrl() {
        const params = new URLSearchParams(window.location.search);
        const has = (facet, value) => this.#chips.some((chip) => chip.dataset.facet === facet && chip.dataset.value === value);

        const query = params.get('q');
        if (query) {
            this.#state.query = query;
            this.#input.value = query;
        }
        for (const facet of ['type', 'topic']) {
            const value = params.get(facet);
            if (value && has(facet, value)) this.#state[facet] = value;
        }
    }

    #writeUrl() {
        const params = new URLSearchParams();
        if (this.#state.query.trim()) params.set('q', this.#state.query.trim());
        if (this.#state.type !== 'all') params.set('type', this.#state.type);
        if (this.#state.topic !== 'all') params.set('topic', this.#state.topic);
        const search = params.toString();
        const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
        try { window.history.replaceState(null, '', url); } catch (error) { /* file:// or sandboxed */ }
    }

    #apply({ updateUrl = true } = {}) {
        const tokens = tokenize(this.#state.query);
        let shown = 0;

        for (const item of this.#items) {
            const match = (this.#state.type === 'all' || item.type === this.#state.type)
                && (this.#state.topic === 'all' || item.topic === this.#state.topic)
                && scoreRecord(item, tokens, WEIGHTS) > 0;

            item.node.hidden = !match;
            if (match) shown += 1;
            this.#highlight(item, match ? tokens : []);
        }

        // A year heading with nothing under it is noise.
        for (const group of this.#groups) {
            group.hidden = !group.querySelector('[data-pub]:not([hidden])');
        }

        for (const chip of this.#chips) {
            chip.setAttribute('aria-pressed', String(this.#state[chip.dataset.facet] === chip.dataset.value));
        }

        const total = this.#items.length;
        // The count is role="status", so writing it is the announcement.
        this.#count.textContent = shown === total
            ? `${total} publications`
            : `Showing ${shown} of ${total} publications`;
        if (this.#empty) this.#empty.hidden = shown > 0;

        if (updateUrl) this.#writeUrl();
    }

    /** Wrap query matches in the title with <mark>, rebuilt from plain text. */
    #highlight(item, tokens) {
        if (!item.titleEl) return;
        const ranges = tokens.length ? matchRanges(item.title, tokens) : [];

        if (!ranges.length) {
            if (item.titleEl.dataset.highlighted) {
                item.titleEl.textContent = item.title;
                delete item.titleEl.dataset.highlighted;
            }
            return;
        }

        clear(item.titleEl);
        let cursor = 0;
        for (const range of ranges) {
            if (range.start > cursor) item.titleEl.append(item.title.slice(cursor, range.start));
            item.titleEl.append(el('mark', {}, item.title.slice(range.start, range.end)));
            cursor = range.end;
        }
        if (cursor < item.title.length) item.titleEl.append(item.title.slice(cursor));
        item.titleEl.dataset.highlighted = 'true';
    }

    /** Clear every filter and return to the full list. */
    reset() {
        this.#state = { query: '', type: 'all', topic: 'all' };
        this.#input.value = '';
        this.#apply();
        this.#input.focus();
    }
}

if (!customElements.get('pub-library')) {
    customElements.define('pub-library', PubLibrary);
}
