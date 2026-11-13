/**
 * pub-data.js — read the publication records a page ships with.
 *
 * scripts/build_site.py writes a JSON island into every page that can cite a
 * paper:
 *
 *   <script type="application/json" id="pub-data">{ "<id>": { … } }</script>
 *
 * It is generated from data/publications.json, so the browser never keeps a
 * hand-maintained second copy of the bibliography. Record shape is the one
 * js/lib/citations.js documents, plus `bibtex` (the curated entry), `keywords`
 * and `venueShort`.
 */

let cache = null;

/** @returns {Object<string, Object>} records keyed by publication id */
export function publicationRecords() {
    if (cache) return cache;

    const island = document.getElementById('pub-data');
    if (!island) {
        cache = {};
        return cache;
    }

    try {
        cache = JSON.parse(island.textContent);
    } catch (error) {
        console.error('pub-data: the publication data island is not valid JSON', error);
        cache = {};
    }
    return cache;
}
