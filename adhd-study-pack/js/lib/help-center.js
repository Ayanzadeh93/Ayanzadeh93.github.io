/** Search and filter help articles without tying the behavior to the DOM. */
export function filterHelpDocuments(docs, query = '', category = 'all') {
  const q = String(query || '').toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  return (Array.isArray(docs) ? docs : []).map((doc, index) => {
    const docCategory = String(doc.category || '').toLowerCase();
    const title = String(doc.title || '').toLowerCase();
    const hay = [doc.id, doc.category, doc.viewLabel, doc.title, doc.body, doc.keywords]
      .filter(Boolean).join(' ').toLowerCase();
    const categoryMatches = category === 'all' || docCategory === String(category || 'all').toLowerCase();
    const textMatches = !q || hay.includes(q) || words.every(word => hay.includes(word));
    const rank = !q ? index
      : title === q ? 0
        : title.startsWith(q) ? 1
          : title.includes(q) ? 2
            : docCategory.includes(q) ? 3 : 4;
    return { doc, index, rank, match:categoryMatches && textMatches };
  }).filter(row => row.match)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(row => row.doc);
}
