/**
 * Renderer for apps/claude-code-catalog.html.
 *
 * Reads data/claude-code/catalog.json and renders it as a filterable reference.
 * Presentation lives here; content lives in the JSON, so adding a command is a
 * data edit and never a code edit.
 *
 * Scoring, tokenising and match ranges come from js/lib/search.js, and node
 * building from js/lib/dom.js — the same modules the publications explorer on
 * the home page uses. Nothing here builds HTML from strings.
 */

import { el, debounce, copyText } from './lib/dom.js';
import { buildHaystack, scoreRecord, tokenize, matchRanges } from './lib/search.js';

const DATA_URL = '../data/claude-code/catalog.json';

/** Catalog-shaped weights: the command name matters far more than its prose. */
const WEIGHTS = { name: 12, aliases: 8, description: 5, tags: 4, examples: 3, type: 2 };

const dom = {
    results: document.querySelector('#catalog-results'),
    search: document.querySelector('#catalog-search'),
    section: document.querySelector('#catalog-section'),
    families: document.querySelector('#catalog-families'),
    status: document.querySelector('#catalog-status'),
    empty: document.querySelector('#catalog-empty'),
    reset: document.querySelector('#catalog-reset')
};

const state = { query: '', family: 'all', section: '' };

let entries = [];
let sections = new Map();
let families = [];

/* ------------------------------------------------------------------ data */

/** Flatten one record into the normalised text map the scorer reads. */
function indexEntry(entry, index) {
    const examples = (entry.examples || []).flatMap((e) => [e.command, e.label]);
    return {
        ...entry,
        index,
        family: sections.get(entry.section)?.family || 'other',
        haystack: buildHaystack({
            name: entry.name,
            aliases: entry.aliases || [],
            description: entry.description,
            tags: entry.tags || [],
            examples,
            type: entry.type || ''
        })
    };
}

function matching() {
    const tokens = tokenize(state.query);

    const scored = [];
    for (const entry of entries) {
        if (state.family !== 'all' && entry.family !== state.family) continue;
        if (state.section && entry.section !== state.section) continue;

        const score = scoreRecord(entry, tokens, WEIGHTS);
        if (score === 0) continue;
        scored.push({ entry, score });
    }

    // Ties and the no-query case fall back to authored order, so the catalog
    // reads as a document rather than an arbitrary list.
    scored.sort((a, b) => (state.query ? b.score - a.score : 0) || a.entry.index - b.entry.index);
    return scored.map((item) => item.entry);
}

/* --------------------------------------------------------------- rendering */

/** Text with query matches wrapped in <mark>, built as nodes not markup. */
function highlighted(text, tokens) {
    const ranges = tokens.length ? matchRanges(text, tokens) : [];
    if (!ranges.length) return [text];

    const parts = [];
    let cursor = 0;
    for (const range of ranges) {
        if (range.start > cursor) parts.push(text.slice(cursor, range.start));
        parts.push(el('mark', { class: 'catalog-mark' }, text.slice(range.start, range.end)));
        cursor = range.end;
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
}

function exampleBlock(example) {
    const copy = el('button', {
        type: 'button',
        class: 'catalog-copy',
        'aria-label': `Copy: ${example.command}`,
        onClick: async (event) => {
            const button = event.currentTarget;
            const ok = await copyText(example.command);
            button.textContent = ok ? 'Copied' : 'Copy failed';
            button.classList.toggle('is-copied', ok);
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('is-copied');
            }, 1600);
        }
    }, 'Copy');

    return el('figure', { class: 'catalog-example' },
        el('figcaption', { class: 'catalog-example-head' },
            el('span', { class: 'catalog-example-label' }, example.label || 'shell'),
            copy
        ),
        el('pre', { class: 'catalog-code' }, el('code', {}, example.command))
    );
}

function card(entry, tokens) {
    const section = sections.get(entry.section);

    const article = el('article', {
        class: 'data-card catalog-card',
        id: entry.id,
        tabindex: '-1',
        dataset: { family: entry.family, section: entry.section }
    });

    article.append(
        el('div', { class: 'data-card-top' },
            el('span', { class: 'data-pill' }, section?.label || entry.section),
            el('span', { class: 'data-status' }, entry.type || 'Entry')
        ),
        el('h2', { class: 'catalog-name' }, ...highlighted(entry.name, tokens)),
        el('p', { class: 'data-card-summary' }, ...highlighted(entry.description, tokens))
    );

    if ((entry.aliases || []).length) {
        article.append(el('p', { class: 'catalog-alias' },
            'Also: ',
            ...entry.aliases.flatMap((alias, i) => [i ? ', ' : '', el('code', {}, alias)])
        ));
    }

    (entry.examples || []).forEach((example) => article.append(exampleBlock(example)));

    if (entry.note) article.append(el('p', { class: 'catalog-note' }, entry.note));

    if ((entry.tags || []).length) {
        article.append(el('ul', { class: 'data-tags' },
            entry.tags.slice(0, 6).map((tag) => el('li', {}, tag))));
    }

    return article;
}

/** Group the visible set under section headings, in the catalog's own order. */
function grouped(visible) {
    const order = [...sections.keys()];
    const buckets = new Map();
    for (const entry of visible) {
        if (!buckets.has(entry.section)) buckets.set(entry.section, []);
        buckets.get(entry.section).push(entry);
    }

    return order
        .filter((id) => buckets.has(id))
        .map((id) => ({ section: sections.get(id), items: buckets.get(id) }));
}

function render() {
    const visible = matching();
    const tokens = tokenize(state.query);
    const nodes = [];

    if (state.query) {
        // Searching is a ranked question, so answer it in rank order. Grouping
        // by section here would re-sort the results and bury the best match
        // under whichever section happens to come first. Each card still names
        // its section in the pill, so the context is not lost.
        nodes.push(el('div', { class: 'data-grid catalog-grid' },
            visible.map((entry) => card(entry, tokens))));
    } else {
        // Browsing is a structural question: keep the catalog's own order.
        for (const group of grouped(visible)) {
            nodes.push(el('div', { class: 'catalog-group-head' },
                el('h2', {}, group.section.label),
                el('span', { class: 'catalog-group-count' }, String(group.items.length)),
                group.section.blurb ? el('p', {}, group.section.blurb) : null
            ));
            nodes.push(el('div', { class: 'data-grid catalog-grid' },
                group.items.map((entry) => card(entry, tokens))));
        }
    }

    dom.results.replaceChildren(...nodes);
    dom.empty.hidden = visible.length > 0;
    dom.status.textContent = visible.length === entries.length
        ? `Showing all ${entries.length} entries`
        : `Showing ${visible.length} of ${entries.length} entries`;

    syncUrl();
}

/* ------------------------------------------------------------------ chrome */

function buildFamilyTabs() {
    const counts = entries.reduce((acc, entry) => {
        acc[entry.family] = (acc[entry.family] || 0) + 1;
        return acc;
    }, {});

    const tabs = [{ id: 'all', label: 'All', count: entries.length }].concat(
        families.map((family) => ({ id: family.id, label: family.label, count: counts[family.id] || 0 }))
    );

    dom.families.replaceChildren(...tabs.map((tab) => el('button', {
        type: 'button',
        class: 'catalog-tab',
        'aria-pressed': String(tab.id === state.family),
        dataset: { family: tab.id },
        onClick: () => {
            state.family = tab.id;
            // A section from another family would leave the view empty.
            if (state.section && sections.get(state.section)?.family !== tab.id) state.section = '';
            syncTabs();
            buildSectionOptions();
            render();
        }
    }, tab.label, el('span', { class: 'catalog-tab-count' }, String(tab.count)))));
}

function syncTabs() {
    dom.families.querySelectorAll('.catalog-tab').forEach((tab) => {
        tab.setAttribute('aria-pressed', String(tab.dataset.family === state.family));
    });
}

/** Only offer sections that belong to the active family. */
function buildSectionOptions() {
    const options = [el('option', { value: '' }, 'All sections')];
    for (const [id, section] of sections) {
        if (state.family !== 'all' && section.family !== state.family) continue;
        options.push(el('option', { value: id }, section.label));
    }
    dom.section.replaceChildren(...options);
    dom.section.value = state.section;
}

/* ------------------------------------------------- deep links & shortcuts */

/** Reflect filters in the URL so a filtered view can be shared or reloaded. */
function syncUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.family !== 'all') params.set('family', state.family);
    if (state.section) params.set('section', state.section);

    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    history.replaceState(null, '', next);
}

function readUrl() {
    const params = new URLSearchParams(location.search);
    state.query = params.get('q') || '';
    state.family = params.get('family') || 'all';
    state.section = params.get('section') || '';
    dom.search.value = state.query;
}

/** Bring a #entry-id target into view once its card has been rendered. */
function focusHashTarget() {
    const id = location.hash.slice(1);
    if (!id) return;

    const target = document.getElementById(id);
    if (!target) return;

    target.scrollIntoView({ block: 'center' });
    target.classList.add('is-linked');
    target.focus({ preventScroll: true });
}

function bindShortcut() {
    document.addEventListener('keydown', (event) => {
        if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

        const active = document.activeElement;
        const tag = active && active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        event.preventDefault();
        dom.search.focus();
        dom.search.select();
    });
}

function reset() {
    state.query = '';
    state.family = 'all';
    state.section = '';
    dom.search.value = '';
    syncTabs();
    buildSectionOptions();
    render();
    dom.search.focus();
}

/* -------------------------------------------------------------------- init */

async function init() {
    try {
        const response = await fetch(DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Catalog returned ${response.status}`);

        const payload = await response.json();
        families = Array.isArray(payload.families) ? payload.families : [];
        sections = new Map((payload.sections || []).map((section) => [section.id, section]));
        entries = (payload.entries || []).map(indexEntry);

        readUrl();
        buildFamilyTabs();
        buildSectionOptions();

        dom.search.addEventListener('input', debounce(() => {
            state.query = dom.search.value.trim();
            render();
        }, 140));

        dom.section.addEventListener('change', () => {
            state.section = dom.section.value;
            render();
        });

        dom.reset.addEventListener('click', reset);
        bindShortcut();

        render();
        focusHashTarget();
    } catch (error) {
        console.error(error);
        dom.status.textContent = 'Catalog data could not be loaded.';
        dom.results.replaceChildren(
            el('p', { class: 'data-error' }, 'The catalog is temporarily unavailable.'));
    }
}

init();
