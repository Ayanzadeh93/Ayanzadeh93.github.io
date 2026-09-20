/**
 * citations.js — turn a structured publication record into the citation
 * formats an academic reader actually asks for: BibTeX, APA 7, MLA 9 and IEEE.
 *
 * Pure functions only. Records come from the DOM (see pub-explorer.js), so the
 * page markup stays the single source of truth for every publication.
 *
 * Record shape:
 * {
 *   title, authors: string[], etAl?: boolean,
 *   venue, year, type: 'article'|'inproceedings'|'incollection'|'preprint'|'misc',
 *   volume?, number?, pages?, publisher?, doi?, arxiv?, url?, status?
 * }
 */

const ET_AL = /(?:^|[\s,])et\s+al\.?$/i;

/** Strip diacritics so generated keys stay ASCII-safe for BibTeX. */
function asciiFold(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[ıİ]/g, 'i')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[şŞ]/g, 's');
}

/**
 * Split a printed author line into individual names.
 * Handles "A, B, and C", "A, B, et al." and the Oxford comma alike.
 *
 * @param {string} line
 * @returns {{ authors: string[], etAl: boolean }}
 */
export function parseAuthors(line) {
    const raw = String(line || '').replace(/\s+/g, ' ').trim();
    if (!raw) return { authors: [], etAl: false };

    const etAl = ET_AL.test(raw);
    const withoutEtAl = raw.replace(ET_AL, '').trim().replace(/,$/, '');

    const authors = withoutEtAl
        .split(/\s*,\s*|\s+and\s+/i)
        .map((name) => name.replace(/^and\s+/i, '').trim())
        .filter(Boolean);

    return { authors, etAl };
}

/**
 * Split "First Middle Last" into its parts. Everything before the final token
 * is treated as given names, which is correct for every name on this site.
 */
export function splitName(name) {
    const parts = String(name).replace(/\s+/g, ' ').trim().split(' ');
    if (parts.length === 1) return { given: [], family: parts[0] };
    return { given: parts.slice(0, -1), family: parts[parts.length - 1] };
}

/** "Aydin Ayanzadeh" -> "Ayanzadeh, A." */
function familyThenInitials(name) {
    const { given, family } = splitName(name);
    if (!given.length) return family;
    const initials = given.map((part) => `${part.charAt(0).toUpperCase()}.`).join(' ');
    return `${family}, ${initials}`;
}

/** "Aydin Ayanzadeh" -> "A. Ayanzadeh" (IEEE order). */
function initialsThenFamily(name) {
    const { given, family } = splitName(name);
    if (!given.length) return family;
    const initials = given.map((part) => `${part.charAt(0).toUpperCase()}.`).join(' ');
    return `${initials} ${family}`;
}

/**
 * Join a list with the conjunction each style expects.
 * `alwaysComma` covers APA, which keeps the serial comma even for two authors
 * ("Ayanzadeh, A., & Oates, T."), unlike IEEE ("A. Ayanzadeh and T. Oates").
 */
function joinList(items, conjunction, alwaysComma = false) {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) {
        return `${items[0]}${alwaysComma ? ',' : ''} ${conjunction} ${items[1]}`;
    }
    return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

/** Drop a trailing period so we never emit "2023.." */
function trimPeriod(value) {
    return String(value).trim().replace(/\.+$/, '');
}

/**
 * Journals increasingly publish article numbers instead of page ranges
 * (e.g. Expert Systems with Applications 213, 119040). Each style labels the
 * two differently, so detect which one a record carries.
 */
function isPageRange(pages) {
    return /[-\u2013]/.test(String(pages || ''));
}

/** Preferred canonical link for a record, in descending order of stability. */
export function canonicalUrl(record) {
    if (record.doi) return `https://doi.org/${record.doi}`;
    if (record.arxiv) return `https://arxiv.org/abs/${record.arxiv}`;
    return record.url || '';
}

/**
 * Deterministic BibTeX key: surname + year + first meaningful title word,
 * e.g. ayanzadeh2025floorplan2guide.
 */
export function bibKey(record) {
    const first = record.authors[0] || 'unknown';
    const family = asciiFold(splitName(first).family).toLowerCase().replace(/[^a-z0-9]/g, '');
    const year = String(record.year || 'nd').replace(/[^0-9a-z]/gi, '');
    const word = asciiFold(record.title || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .find((token) => token.length > 3 && !STOP_WORDS.has(token)) || 'untitled';

    return `${family}${year}${word}`;
}

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'the', 'for', 'with', 'using', 'from', 'into', 'that',
    'this', 'based', 'towards', 'toward', 'over', 'under', 'via'
]);

/** Escape the characters BibTeX treats as syntax. */
function bibEscape(value) {
    return String(value)
        .replace(/[\\]/g, '\\textbackslash{}')
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}');
}

const BIB_ENTRY_TYPE = {
    article: 'article',
    inproceedings: 'inproceedings',
    incollection: 'incollection',
    preprint: 'misc',
    misc: 'misc'
};

/** BibTeX entry. Braces around the title preserve author capitalisation. */
export function formatBibTeX(record) {
    const entryType = BIB_ENTRY_TYPE[record.type] || 'misc';
    const fields = [];

    const authors = record.authors.map((name) => {
        const { given, family } = splitName(name);
        return given.length ? `${family}, ${given.join(' ')}` : family;
    });
    if (record.etAl) authors.push('others');

    if (authors.length) fields.push(['author', authors.join(' and ')]);
    fields.push(['title', `{${bibEscape(record.title)}}`, true]);

    if (record.venue) {
        const venueField = entryType === 'article' ? 'journal'
            : entryType === 'inproceedings' ? 'booktitle'
            : entryType === 'incollection' ? 'booktitle'
            : 'howpublished';
        fields.push([venueField, bibEscape(record.venue)]);
    }

    if (record.volume) fields.push(['volume', bibEscape(record.volume)]);
    if (record.number) fields.push(['number', bibEscape(record.number)]);
    if (record.pages) fields.push(['pages', bibEscape(record.pages).replace(/-+/g, '--')]);
    if (record.publisher) fields.push(['publisher', bibEscape(record.publisher)]);
    if (record.year) fields.push(['year', bibEscape(record.year)]);
    if (record.arxiv) {
        fields.push(['eprint', bibEscape(record.arxiv)]);
        fields.push(['archivePrefix', 'arXiv']);
    }
    if (record.doi) fields.push(['doi', bibEscape(record.doi)]);

    const link = canonicalUrl(record);
    if (link && !record.doi) fields.push(['url', bibEscape(link)]);
    if (record.status) fields.push(['note', bibEscape(record.status)]);

    const body = fields
        .map(([key, value, preformatted]) => `  ${key} = ${preformatted ? value : `{${value}}`}`)
        .join(',\n');

    return `@${entryType}{${bibKey(record)},\n${body}\n}`;
}

/** APA 7th edition. */
export function formatAPA(record) {
    const names = record.authors.map(familyThenInitials);

    let authorPart = '';
    if (names.length) {
        // Initials already end in a period; only add the separating one when
        // the list does not, or APA renders "Ayanzadeh, A.. (2026)".
        const joined = record.etAl
            ? `${names.join(', ')}, et al.`
            : joinList(names, '&', true);
        authorPart = `${trimPeriod(joined)}. `;
    }
    const yearPart = `(${record.year || 'n.d.'}). `;
    const titlePart = `${trimPeriod(record.title)}. `;

    let sourcePart = '';
    if (record.venue) {
        sourcePart = record.venue;
        if (record.volume) {
            sourcePart += `, ${record.volume}`;
            if (record.number) sourcePart += `(${record.number})`;
        }
        if (record.pages) {
            sourcePart += isPageRange(record.pages)
                ? `, ${record.pages}`
                : `, Article ${record.pages}`;
        }
        sourcePart += '. ';
    }

    const link = canonicalUrl(record);
    const statusPart = record.status ? `${record.status}. ` : '';

    return `${authorPart}${yearPart}${titlePart}${sourcePart}${statusPart}${link}`.trim();
}

/** MLA 9th edition — three or more contributors collapse to "et al." */
export function formatMLA(record) {
    let authorPart = '';

    if (record.authors.length) {
        const { given, family } = splitName(record.authors[0]);
        const lead = given.length ? `${family}, ${given.join(' ')}` : family;

        if (record.authors.length === 1 && !record.etAl) {
            authorPart = `${lead}. `;
        } else if (record.authors.length === 2 && !record.etAl) {
            authorPart = `${lead}, and ${record.authors[1]}. `;
        } else {
            authorPart = `${lead}, et al. `;
        }
    }

    const titlePart = `"${trimPeriod(record.title)}." `;
    let sourcePart = '';

    if (record.venue) {
        sourcePart = `${record.venue}`;
        if (record.volume) sourcePart += `, vol. ${record.volume}`;
        if (record.number) sourcePart += `, no. ${record.number}`;
        if (record.year) sourcePart += `, ${record.year}`;
        if (record.pages) {
            sourcePart += isPageRange(record.pages)
                ? `, pp. ${record.pages}`
                : `, article ${record.pages}`;
        }
        sourcePart += '. ';
    } else if (record.year) {
        sourcePart = `${record.year}. `;
    }

    const link = canonicalUrl(record);
    return `${authorPart}${titlePart}${sourcePart}${link}`.trim();
}

/** IEEE reference-list style. */
export function formatIEEE(record) {
    const names = record.authors.map(initialsThenFamily);
    // With a truncated list IEEE ends on "et al.", never on "and X, et al."
    const authorPart = names.length
        ? `${record.etAl ? `${names.join(', ')}, et al.` : joinList(names, 'and')}, `
        : '';

    const titlePart = `"${trimPeriod(record.title)}," `;
    let sourcePart = '';

    if (record.venue) {
        sourcePart = record.venue;
        if (record.volume) sourcePart += `, vol. ${record.volume}`;
        if (record.number) sourcePart += `, no. ${record.number}`;
        if (record.pages) {
            sourcePart += isPageRange(record.pages)
                ? `, pp. ${record.pages}`
                : `, Art. no. ${record.pages}`;
        }
        sourcePart += ', ';
    }

    const yearPart = record.year ? `${record.year}.` : '';
    const statusPart = record.status ? ` (${record.status})` : '';
    const link = record.doi ? ` doi: ${record.doi}.` : '';

    return `${authorPart}${titlePart}${sourcePart}${yearPart}${statusPart}${link}`.trim();
}

/** Every supported style, keyed by the id the citation dialog uses for tabs. */
export const CITATION_FORMATS = [
    { id: 'bibtex', label: 'BibTeX', mono: true, format: formatBibTeX },
    { id: 'apa', label: 'APA 7', mono: false, format: formatAPA },
    { id: 'mla', label: 'MLA 9', mono: false, format: formatMLA },
    { id: 'ieee', label: 'IEEE', mono: false, format: formatIEEE }
];

/** Render a record in one named style, falling back to BibTeX. */
export function formatCitation(record, styleId) {
    const style = CITATION_FORMATS.find((entry) => entry.id === styleId) || CITATION_FORMATS[0];
    return style.format(record);
}
