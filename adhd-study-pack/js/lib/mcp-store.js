/* Shared study-pack workspace for the local assistant.
   No files, no network, no DOM. The MCP server and the page both use this
   so a task added by an assistant and a task added in the browser can meet
   without one wiping the other. */

import { parseQuickTask, postponePlan, nextDue, fmtDate } from './task-tools.js';

export const MUTABLE = ['tasks', 'events', 'notes', 'habits', 'subjects', 'links'];
export const APPEND = ['moods', 'sessions'];
const LISTS = MUTABLE.concat(APPEND);
const SETTINGS_KEYS = ['focus', 'short', 'dayStart', 'dayEnd', 'toolRepeat', 'toolDue', 'toolSomeday'];

const uid = () => Math.random().toString(36).slice(2, 10);
const clone = v => JSON.parse(JSON.stringify(v));
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));

export function emptyWorkspace() {
  return {
    schema: 4, rev: 0, updated: 0,
    tasks: [], events: [], notes: [], habits: [], subjects: [], links: [],
    moods: [], sessions: [],
    settings: { focus: 25, short: 5, dayStart: '08:00', dayEnd: '21:00', toolRepeat: true, toolDue: true, toolSomeday: true },
    tombstones: {}
  };
}

function asList(v) { return Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && x.id) : []; }

export function normaliseWorkspace(raw) {
  const base = emptyWorkspace();
  if (!raw || typeof raw !== 'object') return base;
  const out = Object.assign(base, { schema: 4, rev: Number(raw.rev) || 0, updated: Number(raw.updated) || 0 });
  LISTS.forEach(k => { out[k] = asList(raw[k]); });
  out.settings = Object.assign(base.settings, pickSettings(raw.settings));
  out.tombstones = {};
  const tombs = raw.tombstones && typeof raw.tombstones === 'object' ? raw.tombstones : {};
  MUTABLE.forEach(k => {
    const src = tombs[k] && typeof tombs[k] === 'object' ? tombs[k] : {};
    out.tombstones[k] = {};
    Object.keys(src).slice(-400).forEach(id => { out.tombstones[k][id] = Number(src[id]) || 0; });
  });
  return out;
}

function pickSettings(s) {
  const out = {};
  if (!s || typeof s !== 'object') return out;
  SETTINGS_KEYS.forEach(k => { if (s[k] != null) out[k] = s[k]; });
  return out;
}

function itemTime(x) { return Number(x && (x.updated || x.created || x.at) || 0); }

function newer(a, b) { return itemTime(b) >= itemTime(a) ? b : a; }

/** Union by id. Items the browser had seen and no longer sends are tombstoned.
    Moods and sessions only ever grow, so a short push cannot delete history. */
export function mergePush(ws, body) {
  const next = normaliseWorkspace(ws);
  const snap = body && body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {};
  const seen = new Set(Array.isArray(body && body.seen) ? body.seen.map(String) : []);
  const before = JSON.stringify(snapshotOf(next));

  MUTABLE.forEach(key => {
    if (!Array.isArray(snap[key])) return;
    const local = next[key];
    const incoming = asList(snap[key]);
    const incomingIds = new Set(incoming.map(x => String(x.id)));
    const tombs = Object.assign({}, next.tombstones[key]);
    if (seen.size) {
      local.forEach(item => {
        const id = String(item.id);
        if (seen.has(id) && !incomingIds.has(id)) tombs[id] = Date.now();
      });
    }
    const byId = new Map();
    local.forEach(item => { if (!tombs[item.id]) byId.set(String(item.id), item); });
    incoming.forEach(item => {
      const id = String(item.id);
      if (tombs[id]) return;
      byId.set(id, byId.has(id) ? newer(byId.get(id), item) : item);
    });
    next.tombstones[key] = tombs;
    next[key] = [...byId.values()];
  });

  APPEND.forEach(key => {
    if (!Array.isArray(snap[key])) return;
    const byId = new Map(next[key].map(item => [String(item.id), item]));
    asList(snap[key]).forEach(item => {
      const id = String(item.id);
      byId.set(id, byId.has(id) ? newer(byId.get(id), item) : item);
    });
    next[key] = [...byId.values()];
  });

  if (snap.settings) next.settings = Object.assign({}, next.settings, pickSettings(snap.settings));
  const changed = JSON.stringify(snapshotOf(next)) !== before;
  if (changed) {
    next.rev = (Number(ws && ws.rev) || 0) + 1;
    next.updated = Date.now();
  }
  return { ws: next, changed };
}

function snapshotOf(ws) {
  const out = {};
  LISTS.forEach(k => { out[k] = ws[k]; });
  out.settings = ws.settings;
  out.tombstones = ws.tombstones;
  return out;
}

export function idsOf(ws) {
  const ids = [];
  MUTABLE.forEach(k => (ws[k] || []).forEach(item => { if (item && item.id) ids.push(String(item.id)); }));
  return ids;
}

function todayKey(now) { return fmtDate(now || new Date()); }

function openTasks(ws) {
  return (ws.tasks || []).filter(t => t && !t.done && !(ws.settings.toolSomeday !== false && t.someday));
}

function rankTask(t, today) {
  const overdue = !!(t.due && t.due < today);
  const dueToday = !!(t.due && t.due <= today);
  if (overdue) return 0;
  if (t.quad === 'q1' && dueToday) return 1;
  if (t.quad === 'q2') return 2;
  if (dueToday) return 3;
  if (t.quad === 'q1') return 4;
  if (!t.quad) return 5;
  if (t.quad === 'q3') return 6;
  return 7;
}

export function pickNext(ws, now = new Date()) {
  const today = todayKey(now);
  const list = openTasks(ws).slice().sort((a, b) => rankTask(a, today) - rankTask(b, today) || itemTime(a) - itemTime(b));
  return list[0] || null;
}

function why(t, today) {
  if (t.due && t.due < today) return 'It is overdue, so it goes first.';
  if (t.quad === 'q2') return 'It matters, and nothing about it will feel urgent. That is why it needs a start.';
  if (t.quad === 'q1') return 'It is both urgent and important.';
  if (t.due && t.due <= today) return 'It is on today.';
  if (t.quad === 'q3') return 'It is loud more than it is important. Cap it.';
  return 'It is the smallest open thing.';
}

export function textNext(ws, now = new Date()) {
  const t = pickNext(ws, now);
  if (!t) return 'Nothing is waiting. The next step is to name one small task, or to stop. Do not invent work.';
  const step = (t.steps || []).find(s => s && !s.done);
  return [
    'One next step: ' + t.title,
    step ? 'First physical piece: ' + step.title : 'First physical piece: open it and do the first minute.',
    'Why: ' + why(t, todayKey(now)),
    'Start: two minutes, then stop or continue. Do not add anything else unless they asked.'
  ].join('\n');
}

function habitLine(h, today) {
  const hist = h.history || {};
  if (h.type === 'counter') {
    const n = typeof hist[today] === 'number' ? hist[today] : 0;
    return h.title + ' — ' + n + '/' + (h.dailyGoal || 1);
  }
  if (h.type === 'bad') return h.title + ' — break habit';
  return h.title + ' — ' + (hist[today] ? 'done' : 'not yet');
}

export function textSnapshot(ws, now = new Date()) {
  const today = todayKey(now);
  const next = textNext(ws, now);
  const due = openTasks(ws).filter(t => t.due && t.due <= today).slice(0, 6);
  const later = openTasks(ws).filter(t => t.due && t.due > today).slice(0, 4);
  const parked = (ws.notes || []).filter(n => n.tag === 'parked' && n.text).slice(-3).reverse();
  const habits = (ws.habits || []).filter(h => h && h.enabled !== false && h.title).slice(0, 6);
  const moods = (ws.moods || []).slice().sort((a, b) => itemTime(a) - itemTime(b));
  const last = moods[moods.length - 1];
  const courses = (ws.subjects || []).slice(0, 6).map(s => s.name).filter(Boolean);
  const blocks = upcoming(ws, now, 4);
  const lines = [
    'Today is ' + now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + '.',
    next,
    '',
    due.length ? 'Due today:' : 'Nothing dated for today.',
    ...due.map(t => '- ' + t.title),
    later.length ? 'Later:' : '',
    ...later.map(t => '- ' + t.title + (t.due ? ' (' + t.due + ')' : '')),
    blocks.length ? 'Coming up:' : 'Nothing on the next few days.',
    ...blocks.map(b => '- ' + b),
    habits.length ? 'Habits:' : '',
    ...habits.map(h => '- ' + habitLine(h, today)),
    parked.length ? 'Parked thoughts:' : '',
    ...parked.map(n => '- ' + String(n.text).slice(0, 140)),
    courses.length ? 'Courses: ' + courses.join(', ') : '',
    last ? 'Last mood: ' + last.mood + '/9' + (last.note ? ' — ' + String(last.note).slice(0, 80) : '') : 'No mood logged.'
  ];
  return lines.filter(l => l !== '').join('\n');
}

function upcoming(ws, now, n) {
  const out = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 7 && out.length < n; i++) {
    const day = new Date(+start + i * 86400000);
    const key = fmtDate(day);
    (ws.events || []).forEach(e => {
      if (out.length >= n || !e || !e.start) return;
      const s = new Date(e.start);
      if (fmtDate(s) !== key) return;
      if (!e.allDay && s < now) return;
      const label = i === 0 ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' });
      const when = e.allDay ? 'all day' : s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      out.push(label + ' ' + when + ' ' + (e.title || 'Block'));
    });
  }
  return out;
}

export function textWeek(ws, now = new Date()) {
  const lines = upcoming(ws, now, 12);
  return lines.length ? lines.join('\n') : 'Nothing on the next seven days.';
}

function makeTask(parsed, title) {
  const now = Date.now();
  return {
    id: uid(), title: title || parsed.title, est: parsed.est || 1, energy: parsed.energy || 'med',
    subjectId: parsed.subjectId || null, quad: parsed.quad || null, priority: parsed.priority || null,
    due: parsed.due || null, repeat: parsed.repeat || null, someday: !!parsed.someday,
    steps: [], done: false, done_pomos: 0, created: now, updated: now
  };
}

export function capture(ws, args, now = new Date()) {
  const next = normaliseWorkspace(clone(ws));
  const kind = String(args && args.kind || 'task');
  const text = String(args && args.text || '').trim();
  if (!text) return { ws: next, text: 'Nothing was written. Ask for one sentence.', error: true };
  if (kind === 'thought') {
    next.notes.push({
      id: uid(), text: text.slice(0, 500), tag: 'parked', color: '#F6E27F',
      x: 24, y: 24, pinned: false, at: now.getTime(), updated: now.getTime()
    });
    touch(next);
    return { ws: next, text: 'Parked. It will not become a task unless they ask.' };
  }
  const lines = (kind === 'dump' ? text.split(/\n+/) : [text]).map(l => l.trim()).filter(Boolean).slice(0, 30);
  const made = [];
  lines.forEach(line => {
    const parsed = parseQuickTask(line, { subjects: next.subjects, today: now }) || { title: line.slice(0, 300) };
    if (!parsed.title) return;
    const task = makeTask(parsed);
    if (next.settings.toolSomeday === false) task.someday = false;
    if (next.settings.toolDue === false) task.due = null;
    if (next.settings.toolRepeat === false) task.repeat = null;
    next.tasks.unshift(task);
    made.push(task.title);
  });
  if (!made.length) return { ws: next, text: 'Nothing in that was a task.', error: true };
  touch(next);
  const extra = made.length > 8 ? '\n…and ' + (made.length - 8) + ' more' : '';
  return { ws: next, text: 'Added ' + made.length + ':\n' + made.slice(0, 8).map(t => '- ' + t).join('\n') + extra + '\nDo not schedule them unless they asked.' };
}

export function findTask(ws, query) {
  const q = String(query || '').trim();
  if (!q) return { error: 'Say which task.' };
  const tasks = ws.tasks || [];
  const byId = tasks.find(t => String(t.id) === q);
  if (byId) return { task: byId };
  const low = q.toLowerCase();
  const hits = tasks.filter(t => String(t.title || '').toLowerCase().includes(low));
  const open = hits.filter(t => !t.done);
  const pick = open.length ? open : hits;
  if (pick.length === 1) return { task: pick[0] };
  if (!pick.length) return { error: 'No task matches “' + q.slice(0, 80) + '”.' };
  return { error: 'That matches ' + pick.length + ' tasks. Use a longer name or the id.\n' + pick.slice(0, 5).map(t => '- ' + t.title).join('\n') };
}

export function updateTask(ws, args, now = new Date()) {
  const next = normaliseWorkspace(clone(ws));
  const action = String(args && args.action || 'complete');
  const query = args && (args.id || args.task || ((action === 'rename' || action === 'due' || action === 'quad' || action === 'step') ? '' : args.title));
  const found = findTask(next, query);
  if (found.error) return { ws: next, text: found.error, error: true };
  const task = found.task;
  const today = now;
  if (action === 'complete') {
    task.done = true;
    task.updated = Date.now();
    let note = 'Done: ' + task.title;
    if (task.repeat && next.settings.toolRepeat !== false) {
      const copy = makeTask({
        title: task.title, est: task.est, energy: task.energy, subjectId: task.subjectId,
        quad: task.quad, priority: task.priority, due: nextDue(task.due, task.repeat, today),
        repeat: task.repeat, someday: false
      }, task.title);
      copy.steps = (task.steps || []).map(s => ({ id: uid(), title: s.title, done: false }));
      next.tasks.unshift(copy);
      note += '\nNext one is open' + (copy.due ? ' for ' + copy.due : '') + '.';
    }
    touch(next);
    return { ws: next, text: note };
  }
  if (action === 'reopen') { task.done = false; task.updated = Date.now(); touch(next); return { ws: next, text: 'Open again: ' + task.title }; }
  if (action === 'postpone') {
    const moved = postponePlan(task, today);
    task.plan = moved.plan;
    task.someday = false;
    task.updated = Date.now();
    touch(next);
    const kept = task.due && task.due !== task.plan ? ' Due stays ' + task.due + '.' : '';
    return { ws: next, text: 'Not today. Work moves to ' + task.plan + '.' + kept + ' ' + task.title };
  }
  if (action === 'someday') {
    if (next.settings.toolSomeday === false) return { ws: next, text: 'Someday is off in this workspace.', error: true };
    task.someday = true; task.updated = Date.now(); touch(next);
    return { ws: next, text: 'Parked for someday: ' + task.title };
  }
  if (action === 'unsomeday') { task.someday = false; task.updated = Date.now(); touch(next); return { ws: next, text: 'Back on the list: ' + task.title }; }
  if (action === 'rename') {
    const title = String(args.title || args.text || '').trim().slice(0, 300);
    if (!title) return { ws: next, text: 'A rename needs the new name in title.', error: true };
    task.title = title; task.updated = Date.now(); touch(next);
    return { ws: next, text: 'Renamed to: ' + title };
  }
  if (action === 'due') {
    const due = String(args.due || '').trim();
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ws: next, text: 'Due dates look like 2026-10-16.', error: true };
    task.due = due || null; task.updated = Date.now(); touch(next);
    return { ws: next, text: due ? 'Due ' + due + ': ' + task.title : 'Cleared the date on ' + task.title };
  }
  if (action === 'quad') {
    const q = String(args.quad || '');
    if (q && !/^q[1-4]$/.test(q)) return { ws: next, text: 'Quad is q1, q2, q3, or q4.', error: true };
    task.quad = q || null; task.updated = Date.now(); touch(next);
    return { ws: next, text: 'Matrix is now ' + (q || 'unset') + ' on ' + task.title };
  }
  if (action === 'step') {
    const title = String(args.step || args.text || '').trim().slice(0, 160);
    if (!title) return { ws: next, text: 'A step needs a few words.', error: true };
    task.steps = task.steps || [];
    task.steps.push({ id: uid(), title, done: false });
    task.updated = Date.now(); touch(next);
    return { ws: next, text: 'Step added: ' + title };
  }
  if (action === 'delete') {
    if (args.confirm !== true) return { ws: next, text: 'Not deleted. Call again with confirm true only if they were clear.', error: true };
    next.tasks = next.tasks.filter(t => t.id !== task.id);
    next.tombstones.tasks[task.id] = Date.now();
    touch(next);
    return { ws: next, text: 'Deleted: ' + task.title };
  }
  return { ws: next, text: 'Unknown action. Use complete, postpone, someday, rename, due, quad, step, reopen, or delete.', error: true };
}

const WEEKDAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

export function parseWhen(input, now = new Date()) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2} \d/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return Number.isNaN(+d) ? null : d;
  }
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let rest = s;
  if (/^tomorrow\b/i.test(s)) { day.setDate(day.getDate() + 1); rest = s.replace(/^tomorrow\b/i, '').trim(); }
  else if (/^today\b/i.test(s)) rest = s.replace(/^today\b/i, '').trim();
  else {
    const wd = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i.exec(s);
    if (!wd) return null;
    const target = WEEKDAYS[wd[1].toLowerCase()];
    day.setDate(day.getDate() + ((target - day.getDay() + 7) % 7));
    rest = s.slice(wd[0].length).trim();
  }
  const hm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(rest);
  if (!hm) return null;
  let h = Number(hm[1]), m = Number(hm[2] || 0);
  const ap = (hm[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  day.setHours(h, m, 0, 0);
  return day;
}

function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function planBlock(ws, args, now = new Date()) {
  const next = normaliseWorkspace(clone(ws));
  const title = String(args && args.title || '').trim().slice(0, 300);
  if (!title) return { ws: next, text: 'A block needs a title.', error: true };
  const start = parseWhen(args && (args.when || args.start), now);
  if (!start) return { ws: next, text: 'When should it be? For example: today 14:00, tomorrow 9:30, or friday 15:00.', error: true };
  let minutes = clamp(args && args.minutes, 15, 240);
  if (!args || args.minutes == null) minutes = clamp(next.settings.focus || 25, 15, 240);
  const open = minutesOf(next.settings.dayStart) ?? 8 * 60;
  const close = minutesOf(next.settings.dayEnd) ?? 21 * 60;
  let mins = start.getHours() * 60 + start.getMinutes();
  let note = '';
  if (mins < open) { start.setHours(Math.floor(open / 60), open % 60, 0, 0); mins = open; note = ' Moved to the start of the day window.'; }
  if (mins + minutes > close) {
    minutes = Math.max(15, close - mins);
    note += ' Shortened so it ends by ' + (next.settings.dayEnd || '21:00') + '.';
  }
  if (minutes < 15) return { ws: next, text: 'That is outside the day window (' + (next.settings.dayStart || '08:00') + '–' + (next.settings.dayEnd || '21:00') + ').', error: true };
  const end = new Date(+start + minutes * 60000);
  const kind = ['study', 'class', 'break', 'other'].includes(args && args.kind) ? args.kind : 'study';
  next.events.push({
    id: uid(), title, start: start.toISOString(), end: end.toISOString(), kind,
    subjectId: null, source: 'local', allDay: false, taskId: args && args.taskId || null, updated: Date.now()
  });
  touch(next);
  const when = start.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return { ws: next, text: 'On the week: ' + title + ' at ' + when + ' for ' + minutes + ' minutes.' + note };
}

export function habits(ws, args, now = new Date()) {
  const next = normaliseWorkspace(clone(ws));
  const today = todayKey(now);
  const name = String(args && (args.name || args.title) || '').trim();
  if (!name) {
    const list = (next.habits || []).filter(h => h.enabled !== false);
    if (!list.length) return { ws: next, text: 'No habits yet. They are added in the study pack, under Habits. Do not invent a second set.' };
    return { ws: next, text: list.slice(0, 8).map(h => habitLine(h, today)).join('\n') };
  }
  const low = name.toLowerCase();
  const hits = (next.habits || []).filter(h => String(h.title || '').toLowerCase().includes(low));
  if (hits.length !== 1) return { ws: next, text: hits.length ? 'Name one habit more clearly.' : 'No habit matches that.', error: true };
  const h = hits[0];
  h.history = h.history && typeof h.history === 'object' ? h.history : {};
  const action = String(args.action || 'check');
  if (h.type === 'counter' || action === 'add') {
    const cur = typeof h.history[today] === 'number' ? h.history[today] : 0;
    h.history[today] = action === 'undo' ? Math.max(0, cur - 1) : cur + 1;
    if (!h.history[today]) delete h.history[today];
  } else if (action === 'undo') delete h.history[today];
  else if (h.history[today]) delete h.history[today];
  else h.history[today] = true;
  h.updated = Date.now();
  touch(next);
  return { ws: next, text: habitLine(h, today) };
}

export function mood(ws, args, now = new Date()) {
  const next = normaliseWorkspace(clone(ws));
  if (!args || args.mood == null || args.mood === '') {
    const last = (next.moods || []).slice().sort((a, b) => itemTime(a) - itemTime(b)).slice(-3);
    if (!last.length) return { ws: next, text: 'No mood logged yet. One number from 1 rough to 9 great is enough.' };
    return { ws: next, text: last.map(m => m.mood + '/9' + (m.note ? ' ' + m.note : '')).join('\n') };
  }
  const score = clamp(args.mood, 1, 9);
  const row = {
    id: uid(), kind: 'mood', at: now.getTime(), saved: now.getTime(), updated: now.getTime(),
    mood: score, energy: clamp(args.energy == null ? 5 : args.energy, 1, 9),
    stress: clamp(args.stress == null ? 5 : args.stress, 1, 9),
    note: String(args.note || '').trim().slice(0, 280), tags: []
  };
  next.moods.push(row);
  touch(next);
  return { ws: next, text: 'Logged mood ' + score + '/9. Do not analyse it at length.' };
}

function touch(ws) { ws.updated = Date.now(); ws.rev = (Number(ws.rev) || 0) + 1; }

export function searchTasks(ws, args) {
  const q = String((args && (args.query || args.text || args.task)) || '').trim().toLowerCase();
  if (!q) return { ws, error: true, text: 'Say a word from the task.' };
  const hits = (ws.tasks || []).filter(t => {
    const blob = [t.title, t.notes, t.due].concat((t.steps || []).map(s => s && s.title)).filter(Boolean).join(' ').toLowerCase();
    return blob.includes(q);
  }).slice(0, 8);
  if (!hits.length) return { ws, text: 'Nothing matches “' + q + '”.' };
  return {
    ws,
    text: hits.map(t => '- ' + t.title + (t.done ? ' (done)' : '') + (t.due ? ' due ' + t.due : '')).join('\n')
  };
}
