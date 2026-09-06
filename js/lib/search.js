/**
 * search.js — ranked client-side matching for the publication list.
 *
 * A publication list is small (tens of records), so this is a straightforward
 * scored scan rather than an index: tokenise the query, score each record by
 * where the token matched, and sort. Field weights encode the obvious
 * expectation that a title hit beats a venue hit.
 *
 * Pure functions — no DOM, no globals — so the scoring can be reasoned about
 * and tested independently of the component that renders it.
 */

/** Field weights. Title dominates; year is a weak signal on its own. */
const FIELD_WEIGHTS = {
    title: 10,
    authors: 6,
    venue: 4,
    tags: 3,
    year: 2
};

/** A prefix match ("segment" -> "segmentation") counts, but less than exact. */
const PREFIX_FACTOR = 0.6;

/**
 * Fold case and diacritics so "Toreyin" finds "Töreyin".
 * NFD strips accents that decompose; the dotless i has no decomposition, so
 * Turkish names in the author list ("Çalık") need it handled explicitly.
 */
export function normalize(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\u0131/g, 'i');
}

/** Split a query into searchable tokens, dropping punctuation noise. */
export function tokenize(query) {
    return normalize(query)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 0);
}

/**
 * Score one record against the query tokens.
 * Every token must match somewhere (AND semantics) or the record scores 0 —
 * narrowing a search should never widen the result set.
 *
 * @param {Object} record  a searchable record with a `haystack` field map
 * @param {string[]} tokens
 * @returns {number} 0 when the record does not match
 */
export function scoreRecord(record, tokens) {
    if (tokens.length === 0) return 1;

    let total = 0;

    for (const token of tokens) {
        let best = 0;

        for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
            const value = record.haystack[field];
            if (!value) continue;

            const index = value.indexOf(token);
            if (index === -1) continue;

            // A hit at a word boundary is worth more than one mid-word.
            const atBoundary = index === 0 || !/[a-z0-9]/.test(value.charAt(index - 1));
            const wholeWord = atBoundary
                && !/[a-z0-9]/.test(value.charAt(index + token.length) || '');

            const factor = wholeWord ? 1 : atBoundary ? PREFIX_FACTOR : PREFIX_FACTOR / 2;
            best = Math.max(best, weight * factor);
        }

        if (best === 0) return 0;
        total += best;
    }

    return total;
}

/**
 * Filter and rank records.
 *
 * @param {Object[]} records
 * @param {Object} criteria
 * @param {string} [criteria.query]
 * @param {string} [criteria.type]  record type, or 'all'
 * @param {string} [criteria.sort]  'relevance' | 'newest' | 'oldest'
 * @returns {Object[]} matching records, ordered
 */
export function filterRecords(records, criteria = {}) {
    const { query = '', type = 'all', sort = 'newest' } = criteria;
    const tokens = tokenize(query);

    const matches = [];
    for (const record of records) {
        if (type !== 'all' && record.type !== type) continue;

        const score = scoreRecord(record, tokens);
        if (score === 0) continue;

        matches.push({ record, score });
    }

    const byYearDesc = (a, b) => Number(b.record.year || 0) - Number(a.record.year || 0);

    matches.sort((a, b) => {
        if (sort === 'oldest') {
            return (Number(a.record.year || 0) - Number(b.record.year || 0))
                || a.record.index - b.record.index;
        }
        if (sort === 'relevance' && tokens.length) {
            return (b.score - a.score) || byYearDesc(a, b) || a.record.index - b.record.index;
        }
        // 'newest' keeps the hand-curated order within a year.
        return byYearDesc(a, b) || (a.record.index - b.record.index);
    });

    return matches.map((match) => match.record);
}

/**
 * Locate every token occurrence in a string so the caller can wrap matches
 * without building HTML. Returns non-overlapping ranges in document order.
 *
 * @param {string} text
 * @param {string[]} tokens
 * @returns {{ start: number, end: number }[]}
 */
export function matchRanges(text, tokens) {
    if (!tokens.length) return [];

    const haystack = normalize(text);
    const ranges = [];

    for (const token of tokens) {
        let from = 0;
        let index = haystack.indexOf(token, from);
        while (index !== -1) {
            ranges.push({ start: index, end: index + token.length });
            from = index + token.length;
            index = haystack.indexOf(token, from);
        }
    }

    ranges.sort((a, b) => a.start - b.start);

    // Merge overlaps so "deep learning" and "learn" do not double-wrap.
    const merged = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range.start <= last.end) {
            last.end = Math.max(last.end, range.end);
        } else {
            merged.push({ ...range });
        }
    }

    return merged;
}

/**
 * Build the flat, normalised text map `scoreRecord` reads.
 * Normalising once per record beats normalising per keystroke.
 */
export function buildHaystack(fields) {
    const haystack = {};
    for (const [key, value] of Object.entries(fields)) {
        haystack[key] = normalize(Array.isArray(value) ? value.join(' ') : value);
    }
    return haystack;
}
