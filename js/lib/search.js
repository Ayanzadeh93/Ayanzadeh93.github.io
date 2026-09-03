/**
 * Ranked, diacritic-insensitive search over publication records.
 *
 * Author names on this site carry Turkish, Albanian and Persian diacritics
 * ("Töreyin", "Çalık", "Şahin", "Nallbani"), so a plain `includes()` check
 * would miss anyone typing the ASCII spelling. Everything here folds text to a
 * comparable form while keeping an index map back to the original string, so
 * matches can still be highlighted in the text the visitor actually sees.
 */

/** Characters with no Unicode decomposition that still need folding. */
const MANUAL_FOLDS = new Map(Object.entries({
    ı: 'i', İ: 'i', ø: 'o', Ø: 'o', ł: 'l', Ł: 'l', đ: 'd', Đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe',
}));

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Relative importance of each searchable field. */
const FIELD_WEIGHTS = {
    title: 3,
    authors: 2.25,
    venue: 1.5,
    topics: 1,
    year: 1,
};

const MATCH_QUALITY = {
    wordStart: 1,
    substring: 0.65,
    subsequence: 0.3,
};

/**
 * Fold `input` to lowercase ASCII and return a map from each folded character
 * back to its index in the original string.
 */
function foldWithMap(input) {
    const folded = [];
    const map = [];

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        const replacement = MANUAL_FOLDS.get(character)
            ?? character.normalize('NFD').replace(COMBINING_MARKS, '');

        for (const char of replacement.toLowerCase()) {
            folded.push(char);
            map.push(index);
        }
    }

    return { folded: folded.join(''), map };
}

export function fold(input) {
    return foldWithMap(String(input ?? '')).folded;
}

export function tokenizeQuery(query) {
    return fold(query).split(/\s+/).filter(Boolean);
}

/** True when `position` starts a word in the folded haystack. */
function isWordStart(haystack, position) {
    return position === 0 || /[^a-z0-9]/.test(haystack[position - 1]);
}

/**
 * Whether a term is loose enough to allow the subsequence fallback.
 *
 * Numbers are identifiers, not prose: allowing "2019" to match as a scattered
 * subsequence pulls in papers from other years, so digits must match literally.
 */
function allowsFuzzyFallback(term) {
    return term.length >= 4 && /[a-z]/.test(term) && !/^\d+$/.test(term);
}

/** Score a single term against a single folded field. Returns 0 for no match. */
function scoreTerm(haystack, term) {
    if (!haystack || !term) return 0;

    let position = haystack.indexOf(term);
    while (position !== -1) {
        if (isWordStart(haystack, position)) return MATCH_QUALITY.wordStart;
        position = haystack.indexOf(term, position + 1);
    }

    if (haystack.includes(term)) return MATCH_QUALITY.substring;
    if (!allowsFuzzyFallback(term)) return 0;

    return isSubsequence(haystack, term) ? MATCH_QUALITY.subsequence : 0;
}

/** Loose fallback so "wildvlm" still finds "WildfireVLM". */
function isSubsequence(haystack, term) {
    let cursor = 0;
    for (const character of term) {
        cursor = haystack.indexOf(character, cursor);
        if (cursor === -1) return false;
        cursor += 1;
    }
    return true;
}

/**
 * Score a publication against a query.
 *
 * Every term must match at least one field (AND semantics) — partial matches
 * return `0` so the result count stays honest.
 */
export function scorePublication(pub, terms) {
    if (terms.length === 0) return 1;

    const fields = {
        title: pub.searchable.title,
        authors: pub.searchable.authors,
        venue: pub.searchable.venue,
        topics: pub.searchable.topics,
        year: String(pub.year),
    };

    let total = 0;

    for (const term of terms) {
        let best = 0;

        for (const [field, value] of Object.entries(fields)) {
            best = Math.max(best, scoreTerm(value, term) * FIELD_WEIGHTS[field]);
        }

        if (best === 0) return 0;
        total += best;
    }

    return total;
}

/**
 * Locate every term occurrence in `text`, expressed as `[start, end)` ranges in
 * the original (unfolded) string. Overlapping ranges are merged.
 */
function findSpans(text, terms) {
    const { folded, map } = foldWithMap(text);
    const spans = [];

    for (const term of terms) {
        let position = folded.indexOf(term);

        while (position !== -1) {
            const start = map[position];
            const lastIndex = position + term.length - 1;
            // `map` points at the source character, so the exclusive end is the
            // character after the last folded character's source index.
            const end = (map[lastIndex] ?? start) + 1;
            spans.push([start, end]);
            position = folded.indexOf(term, position + term.length);
        }
    }

    if (spans.length === 0) return spans;

    spans.sort((a, b) => a[0] - b[0]);

    const merged = [spans[0]];
    for (const [start, end] of spans.slice(1)) {
        const previous = merged.at(-1);
        if (start <= previous[1]) previous[1] = Math.max(previous[1], end);
        else merged.push([start, end]);
    }

    return merged;
}

/** Build a fragment where every span of `text` is wrapped in `<mark>`. */
function buildHighlightedFragment(text, spans) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const [start, end] of spans) {
        if (start > cursor) fragment.append(text.slice(cursor, start));

        const mark = document.createElement('mark');
        mark.className = 'pub-mark';
        mark.textContent = text.slice(start, end);
        fragment.append(mark);

        cursor = end;
    }

    if (cursor < text.length) fragment.append(text.slice(cursor));
    return fragment;
}

/**
 * Restore `target` from its pristine copy, then wrap every query match in a
 * `<mark>`.
 *
 * Highlighting runs over text nodes rather than `innerHTML`, so inline markup
 * inside the target — the `<strong>` around the site owner's name in an author
 * list, for instance — survives, and no string is ever parsed as HTML.
 */
export function highlightTextNodes(target, pristine, terms) {
    target.replaceChildren(...[...pristine.cloneNode(true).childNodes]);
    if (terms.length === 0) return;

    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
        const spans = findSpans(node.nodeValue, terms);
        if (spans.length > 0) node.replaceWith(buildHighlightedFragment(node.nodeValue, spans));
    }
}
