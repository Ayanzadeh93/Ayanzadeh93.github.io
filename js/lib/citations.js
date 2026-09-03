/**
 * Citation engine.
 *
 * Turns a publication record into the export formats reviewers, editors and
 * reference managers actually ask for: BibTeX, RIS, APA 7, IEEE and MLA 9.
 *
 * Pure functions only — no DOM access — so the formats can be unit tested and
 * reused by any component.
 */

/** Particles that belong to the surname rather than the given names. */
const SURNAME_PARTICLES = new Set([
    'van', 'von', 'de', 'del', 'della', 'der', 'den', 'di', 'da', 'dos',
    'du', 'la', 'le', 'bin', 'ibn', 'al', 'ter', 'ten',
]);

const GENERATIONAL_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);

/** BibTeX entry type per publication type. */
const BIBTEX_ENTRY_TYPES = {
    journal: 'article',
    conference: 'inproceedings',
    chapter: 'incollection',
    preprint: 'misc',
};

/** RIS reference type per publication type. */
const RIS_TYPES = {
    journal: 'JOUR',
    conference: 'CPAPER',
    chapter: 'CHAP',
    preprint: 'GEN',
};

/**
 * Split a rendered author string ("A, B, and C") into individual names.
 * Handles the Oxford comma, a trailing "and", and "et al.".
 */
export function splitAuthors(raw) {
    if (!raw) return [];

    const names = String(raw)
        .replace(/\s+/g, ' ')
        .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
        .map((name) => name.trim().replace(/\.$/, ''))
        .filter(Boolean);

    // "… Özden Yalçın Özyusal et al." arrives glued to the final name when the
    // source text omits the comma. Peel it off into its own marker.
    const last = names.at(-1);
    if (last && /\s+et\.?\s*al\.?$/i.test(last)) {
        names[names.length - 1] = last.replace(/\s+et\.?\s*al\.?$/i, '').trim();
        names.push('et al.');
    }

    return names.filter(Boolean);
}

/** Split a display name into `{ given, family, suffix }`. */
function parseName(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return { given: '', family: parts[0], suffix: '' };

    let suffix = '';
    if (GENERATIONAL_SUFFIXES.has(parts.at(-1).toLowerCase())) {
        suffix = parts.pop();
    }

    // Walk backwards past any lowercase particles so "van der Berg" stays whole.
    let familyStart = parts.length - 1;
    while (familyStart > 1 && SURNAME_PARTICLES.has(parts[familyStart - 1].toLowerCase())) {
        familyStart -= 1;
    }

    return {
        given: parts.slice(0, familyStart).join(' '),
        family: parts.slice(familyStart).join(' '),
        suffix,
    };
}

/** True for the "et al." placeholder that stands in for omitted co-authors. */
function isEtAl(name) {
    return /^et\.?\s*al\.?$/i.test(String(name).trim());
}

/** Split an author list into the named authors and an "and others" flag. */
function partitionAuthors(authors) {
    return {
        named: authors.filter((name) => !isEtAl(name)),
        hasEtAl: authors.some(isEtAl),
    };
}

/** "Aydin Ayanzadeh" -> "Ayanzadeh, Aydin"; "et al." -> "others" (BibTeX). */
export function toFamilyFirst(name) {
    if (isEtAl(name)) return 'others';

    const { given, family, suffix } = parseName(name);
    const base = given ? `${family}, ${given}` : family;
    return suffix ? `${base}, ${suffix}` : base;
}

/** "Aydin Ayanzadeh" -> "A." (IEEE / APA style initials) */
function toInitials(given) {
    return given
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => `${part[0].toUpperCase()}.`)
        .join(' ');
}

/** "Aydin Ayanzadeh" -> "Ayanzadeh, A." */
function toApaName(name) {
    const { given, family, suffix } = parseName(name);
    const initials = given ? ` ${toInitials(given)}` : '';
    return `${family},${initials}${suffix ? `, ${suffix}` : ''}`.trim();
}

/** "Aydin Ayanzadeh" -> "A. Ayanzadeh" */
function toIeeeName(name) {
    const { given, family, suffix } = parseName(name);
    const initials = given ? `${toInitials(given)} ` : '';
    return `${initials}${family}${suffix ? ` ${suffix}` : ''}`.trim();
}

/** Join a list the way a given style guide expects. */
function joinNames(names, { separator = ', ', lastSeparator = ' and ' } = {}) {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(separator)}${lastSeparator}${names.at(-1)}`;
}

/** Escape the characters BibTeX treats as markup. */
function escapeBibtex(value) {
    return String(value ?? '').replace(/[\\{}$&#%_~^]/g, (char) => `\\${char}`);
}

/**
 * Wrap capitalised words in braces so BibTeX styles do not lowercase acronyms
 * such as LLM, CVPR or VLM.
 */
function protectTitleCase(title) {
    return String(title).replace(/\b[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/g, (token) => `{${token}}`);
}

function bibtexFields(pub) {
    const fields = [
        ['author', joinNames(pub.authors.map(toFamilyFirst), { separator: ' and ', lastSeparator: ' and ' })],
        ['title', protectTitleCase(escapeBibtex(pub.title))],
    ];

    if (pub.type === 'journal') {
        fields.push(['journal', escapeBibtex(pub.journal || pub.venue)]);
    } else if (pub.type === 'conference') {
        fields.push(['booktitle', escapeBibtex(pub.booktitle || pub.venue)]);
    } else if (pub.type === 'chapter') {
        fields.push(['booktitle', escapeBibtex(pub.booktitle || pub.venue)]);
    } else if (pub.arxiv) {
        fields.push(
            ['eprint', pub.arxiv],
            ['archivePrefix', 'arXiv'],
            ['primaryClass', pub.primaryClass || 'cs.CV'],
        );
    } else {
        fields.push(['howpublished', escapeBibtex(pub.venue)]);
    }

    fields.push(
        ['volume', pub.volume],
        ['number', pub.number],
        ['pages', pub.pages],
        ['publisher', pub.publisher ? escapeBibtex(pub.publisher) : ''],
        ['year', pub.year],
        ['doi', pub.doi],
        ['url', pub.url],
    );

    return fields.filter(([, value]) => value !== undefined && value !== null && value !== '');
}

export function formatBibtex(pub) {
    const entryType = BIBTEX_ENTRY_TYPES[pub.type] || 'misc';
    const body = bibtexFields(pub)
        .map(([name, value]) => `  ${name.padEnd(13)}= {${value}}`)
        .join(',\n');

    return `@${entryType}{${pub.key},\n${body}\n}`;
}

export function formatRis(pub) {
    const lines = [['TY', RIS_TYPES[pub.type] || 'GEN']];

    partitionAuthors(pub.authors).named.forEach((author) => lines.push(['AU', toFamilyFirst(author)]));
    lines.push(['TI', pub.title]);

    if (pub.type === 'journal') lines.push(['JO', containerFor(pub)]);
    else if (containerFor(pub)) lines.push(['T2', containerFor(pub)]);

    const pageRange = String(pub.pages || '').split(/\s*(?:--|-|–)\s*/);
    const optional = [
        ['PY', pub.year],
        ['VL', pub.volume],
        ['IS', pub.number],
        ['SP', pageRange[0]],
        ['EP', pageRange[1]],
        ['PB', pub.publisher],
        ['DO', pub.doi],
        ['UR', pub.url],
    ];

    optional.forEach(([tag, value]) => {
        if (value) lines.push([tag, value]);
    });

    lines.push(['ER', '']);

    return lines.map(([tag, value]) => `${tag}  - ${value}`).join('\n');
}

/** APA 7th edition. */
export function formatApa(pub) {
    const { named, hasEtAl } = partitionAuthors(pub.authors);
    const names = named.map(toApaName);

    let authors;
    if (hasEtAl) authors = `${names.join(', ')}, et al.`;
    else if (names.length > 1) authors = `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`;
    else authors = names[0] || '';

    const segments = [`${authors} (${pub.year}).`, `${stripTrailingPeriod(pub.title)}.`];

    if (pub.type === 'journal') {
        const volume = pub.volume ? `, ${pub.volume}${pub.number ? `(${pub.number})` : ''}` : '';
        const pages = pub.pages ? `, ${displayPages(pub.pages)}` : '';
        segments.push(`${containerFor(pub)}${volume}${pages}.`);
    } else if (pub.type === 'chapter') {
        const pages = pub.pages ? ` (${pageLabel(pub.pages)} ${displayPages(pub.pages)})` : '';
        segments.push(`In ${containerFor(pub)}${pages}.`);
        if (pub.publisher) segments.push(`${pub.publisher}.`);
    } else {
        segments.push(`${stripTrailingPeriod(containerFor(pub))}.`);
    }

    if (pub.doi) segments.push(`https://doi.org/${pub.doi}`);
    else if (pub.url) segments.push(pub.url);

    return segments.join(' ');
}

/** IEEE reference style. */
export function formatIeee(pub) {
    const { named, hasEtAl } = partitionAuthors(pub.authors);
    const names = named.map(toIeeeName);
    const authors = hasEtAl
        ? `${names.join(', ')}, et al.`
        : joinNames(names, { separator: ', ', lastSeparator: ' and ' });

    const segments = [`${authors}, "${stripTrailingPeriod(pub.title)},"`];

    if (pub.type === 'journal') {
        segments.push(`${containerFor(pub)},`);
        if (pub.volume) segments.push(`vol. ${pub.volume},`);
        if (pub.number) segments.push(`no. ${pub.number},`);
        if (pub.pages) segments.push(`${pageLabel(pub.pages)} ${displayPages(pub.pages)},`);
    } else if (pub.type === 'preprint') {
        segments.push(`${containerFor(pub)},`);
    } else {
        segments.push(`in ${containerFor(pub)},`);
        if (pub.pages) segments.push(`${pageLabel(pub.pages)} ${displayPages(pub.pages)},`);
    }

    segments.push(`${pub.year}.`);
    if (pub.doi) segments.push(`doi: ${pub.doi}.`);

    return segments.join(' ');
}

/** MLA 9th edition. */
export function formatMla(pub) {
    const { named, hasEtAl } = partitionAuthors(pub.authors);
    const [first, ...rest] = named;
    let authors = first ? toFamilyFirst(first) : '';

    if (rest.length === 1 && !hasEtAl) authors += `, and ${rest[0]}`;
    else if (rest.length > 0 || hasEtAl) authors += ', et al';

    const segments = [`${authors}. "${stripTrailingPeriod(pub.title)}."`, `${containerFor(pub)},`];

    if (pub.volume) segments.push(`vol. ${pub.volume},`);
    if (pub.number) segments.push(`no. ${pub.number},`);
    segments.push(`${pub.year},`);
    if (pub.pages) segments.push(`${pageLabel(pub.pages)} ${displayPages(pub.pages)},`);

    const tail = segments.join(' ').replace(/,$/, '.');
    return pub.doi ? `${tail} https://doi.org/${pub.doi}` : tail;
}

function stripTrailingPeriod(value) {
    return String(value ?? '').trim().replace(/\.$/, '');
}

/** BibTeX writes ranges as `33--57`; prose styles want an en dash. */
function displayPages(pages) {
    return String(pages ?? '').replace(/\s*--\s*/g, '\u2013');
}

/** "pp." for a range, "p." for a single page or an article number. */
function pageLabel(pages) {
    return /[\u2013-]/.test(displayPages(pages)) ? 'pp.' : 'p.';
}

/**
 * The container a prose citation should name.
 *
 * The rendered venue string on the page repeats the year ("arXiv preprint
 * arXiv:2105.00695, 2021"), which would print twice once the style appends its
 * own year, so preprints are rebuilt from their identifier instead.
 */
function containerFor(pub) {
    if (pub.type === 'journal') return pub.journal || pub.venue;
    if (pub.type === 'conference' || pub.type === 'chapter') return pub.booktitle || pub.venue;
    if (pub.arxiv) return `arXiv:${pub.arxiv}${pub.primaryClass ? ` [${pub.primaryClass}]` : ''}`;
    return pub.venue;
}

/**
 * Ordered list of the formats the citation dialog offers.
 * `extension` and `mime` drive the download button.
 */
export const CITATION_FORMATS = [
    { id: 'bibtex', label: 'BibTeX', format: formatBibtex, extension: 'bib', mime: 'application/x-bibtex', mono: true },
    { id: 'ris', label: 'RIS', format: formatRis, extension: 'ris', mime: 'application/x-research-info-systems', mono: true },
    { id: 'apa', label: 'APA 7', format: formatApa, extension: 'txt', mime: 'text/plain', mono: false },
    { id: 'ieee', label: 'IEEE', format: formatIeee, extension: 'txt', mime: 'text/plain', mono: false },
    { id: 'mla', label: 'MLA 9', format: formatMla, extension: 'txt', mime: 'text/plain', mono: false },
];

export function getCitationFormat(id) {
    return CITATION_FORMATS.find((entry) => entry.id === id) || CITATION_FORMATS[0];
}

/** Render a whole reference list in one format (used by "Export all"). */
export function formatCollection(publications, formatId) {
    const { format } = getCitationFormat(formatId);
    const separator = formatId === 'bibtex' || formatId === 'ris' ? '\n\n' : '\n\n';
    return publications.map(format).join(separator);
}
