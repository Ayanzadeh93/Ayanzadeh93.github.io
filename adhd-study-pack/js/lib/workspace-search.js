function addRows(rows, kind, list, getTitle, getText = () => '') {
  (Array.isArray(list) ? list : []).forEach(item => {
    if (!item || item.trashed) return;
    const title = String(getTitle(item) || '').trim();
    if (!title) return;
    rows.push({ kind, id: String(item.id || ''), title: title.slice(0, 160), text: String(getText(item) || '') });
  });
}

/** Search named workspace records without including connector credentials or journal-only private history. */
export function searchWorkspace(state, query, limit = 30) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) return [];
  const source = state || {};
  const rows = [];
  addRows(rows, 'Task', source.tasks, item => item.title, item => [item.due, item.plan, ...(item.steps || []).map(step => step.title)].join(' '));
  addRows(rows, 'Note', source.notes, item => item.title || String(item.text || '').split('\n')[0], item => item.text);
  addRows(rows, 'Assignment', source.assignments, item => item.title, item => [item.due, item.requirements, ...(item.milestones || []).map(step => step.title)].join(' '));
  addRows(rows, 'Resource', source.resources, item => item.title, item => [item.note, item.url].join(' '));
  addRows(rows, 'Course', source.subjects, item => item.name, item => item.code);
  addRows(rows, 'Routine', source.habits, item => item.title, item => [item.micro, item.cue].join(' '));
  addRows(rows, 'Flashcard', source.flashcards, item => item.front, item => [item.back, item.deck].join(' '));
  const tokens = needle.split(/\s+/).filter(Boolean);
  return rows.map((row, index) => {
    const text = `${row.title} ${row.text}`.toLocaleLowerCase();
    const matched = tokens.every(token => text.includes(token));
    if (!matched) return null;
    const score = row.title.toLocaleLowerCase() === needle ? 4
      : row.title.toLocaleLowerCase().startsWith(needle) ? 3
        : row.title.toLocaleLowerCase().includes(needle) ? 2 : 1;
    return Object.assign(row, { score, _index:index });
  }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a._index - b._index)
    .slice(0, Math.max(0, Number(limit) || 0))
    .map(({ _index, ...row }) => row);
}
