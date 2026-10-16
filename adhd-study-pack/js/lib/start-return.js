/* First session, today's short list, steps, resume, and undo.
   Pure: no DOM, no storage. */

export const TWO_MINUTES = 2;
export const STUCK_MOVES = [
  { id: 'open', label: 'Open the file', intent: 'Open the file and leave it in front of me.' },
  { id: 'read', label: 'Read one paragraph', intent: 'Read one paragraph.' },
  { id: 'write', label: 'Write one sentence', intent: 'Write one sentence.' },
  { id: 'ask', label: 'Ask one question', intent: 'Write the one question I am stuck on.' }
];

export const STEP_TEMPLATES = {
  reading: ['Open the reading', 'Read one section', 'Write one sentence of what it said', 'Note the next page'],
  problems: ['Read the question', 'Try one line', 'Check the result', 'Mark what is still unclear'],
  essay: ['Write the claim in one sentence', 'Add one piece of evidence', 'Write the next sentence', 'Stop at a clear pause'],
  revision: ['Open the last page', 'Change one thing', 'Read it back', 'Name the next pass']
};

export function stepsFromTemplate(kind) {
  return (STEP_TEMPLATES[kind] || []).map((title) => ({ title, done: false }));
}

/** At most three open tasks. Unknown ids and finished tasks drop off.
    The deadline on the task is not part of this list. */
export function commitmentsOf(ids, tasks) {
  const open = new Set((tasks || []).filter((task) => task && !task.done && !task.trashed).map((task) => task.id));
  const next = [];
  (ids || []).forEach((id) => {
    if (!open.has(id) || next.includes(id) || next.length >= 3) return;
    next.push(id);
  });
  return next;
}

export function dropCommitment(ids, id) {
  return (ids || []).filter((item) => item !== id);
}

export function makeBookmark(task, note, at) {
  const step = task && (task.steps || []).find((item) => item && !item.done);
  return {
    taskId: task && task.id || null,
    title: task && task.title || '',
    next: step ? step.title : '',
    note: String(note || '').trim().slice(0, 240),
    at: at || Date.now()
  };
}

export function pushUndo(stack, entry) {
  const next = (stack || []).concat(entry);
  return next.length > 20 ? next.slice(next.length - 20) : next;
}

export function undoTrash(stack, tasks, trash) {
  const list = (stack || []).slice();
  const entry = list.pop();
  if (!entry || entry.kind !== 'trash' || !entry.task) return { stack: list, tasks, trash, restored: null };
  return {
    stack: list,
    tasks: [entry.task].concat(tasks || []),
    trash: (trash || []).filter((task) => task.id !== entry.task.id),
    restored: entry.task
  };
}
