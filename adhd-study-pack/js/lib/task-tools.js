/* Task tools — pure helpers for the Today / Inbox lists, quick add, and repeat.
   No DOM and no network, so the rules can be tested without the page. */

const WEEKDAYS = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

const pad = n => String(n).padStart(2, '0');
export const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** Where an open task belongs. A plan day leads. The due date is the deadline, and it is used only when no plan is set. */
export function workDay(task) {
  if (!task) return null;
  return task.plan || task.due || null;
}

/** The day this task sits on in the week. A plan replaces the deadline on the grid, it does not erase it. */
export function placedOn(task, day) {
  if (!task) return false;
  if (task.plan) return task.plan === day;
  return task.due === day;
}

/** Schedule the work. `due` is returned unchanged. */
export function planOn(task, day) {
  return {
    due: (task && task.due) || null,
    plan: day || null,
    someday: false
  };
}

/** Not today moves the plan to the next day. An overdue deadline is not rewritten. */
export function postponePlan(task, today = new Date()) {
  const from = task && (task.plan || task.due);
  return {
    due: (task && task.due) || null,
    plan: postponedDue(from, today)
  };
}

export function bucketOf(task, todayKey) {
  if (!task || task.done) return 'done';
  if (task.someday) return 'someday';
  const day = workDay(task);
  if (day && day <= todayKey) return 'today';
  if (day && day > todayKey) return 'upcoming';
  if (!day && !task.subjectId && !task.quad) return 'inbox';
  return 'open';
}

/** The next date after `due` (or today) for a repeat rule. */
export function nextDue(due, repeat, today = new Date()) {
  const base = parseDay(due) || startOfDay(today);
  const add = n => { const x = new Date(base); x.setDate(x.getDate() + n); return fmtDate(x); };
  if (repeat === 'daily') return add(1);
  if (repeat === 'weekly') return add(7);
  if (repeat === 'weekdays') {
    const x = new Date(base);
    x.setDate(x.getDate() + 1);
    while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
    return fmtDate(x);
  }
  return null;
}

/** Move a due date to the next day, and never leave an overdue task in the past. */
export function postponedDue(due, today = new Date()) {
  const todayD = startOfDay(today);
  let base = parseDay(due) || todayD;
  if (base < todayD) base = todayD;
  base.setDate(base.getDate() + 1);
  return fmtDate(base);
}

function nextNamedDay(today, dow) {
  const d = startOfDay(today);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return fmtDate(d);
}

function matchSubject(token, subjects) {
  const q = String(token || '').toLowerCase();
  if (!q) return null;
  const list = subjects || [];
  const name = s => String(s.name || '').toLowerCase();
  const exact = list.find(s => name(s) === q || String(s.id || '').toLowerCase() === q);
  if (exact) return exact;
  if (q.length < 3) return null;
  return list.find(s => name(s).startsWith(q) || (name(s).length >= 3 && q.startsWith(name(s))))
    || list.find(s => name(s).includes(q))
    || list.find(s => {
      const n = name(s);
      let i = 0;
      while (i < q.length && i < n.length && q[i] === n[i]) i += 1;
      return i >= 4;
    })
    || null;
}

/**
 * One line into a task. Recognised bits are removed from the title:
 * `chapter 3 friday 2 pomos #stats p1 !` → title, due, estimate, course, priority, energy.
 * `p1` is Todoist's flag (stored as API priority 4). `q2` is the matrix, kept separate.
 */
export function parseQuickTask(raw, { subjects = [], today = new Date() } = {}) {
  let text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const out = {
    title: '', est: null, energy: null, subjectId: null, quad: null,
    due: null, repeat: null, priority: null, someday: false
  };

  text = text.replace(/\bevery\s+(day|weekday|weekdays|week|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/ig, (_, w) => {
    const key = w.toLowerCase();
    if (key === 'day') out.repeat = 'daily';
    else if (key === 'weekday' || key === 'weekdays') out.repeat = 'weekdays';
    else if (key === 'week') out.repeat = 'weekly';
    else {
      out.repeat = 'weekly';
      out.due = nextNamedDay(today, WEEKDAYS[key]);
    }
    return ' ';
  });
  text = text.replace(/\b(\d{1,2})\s*pomos?\b/ig, (_, n) => {
    const v = Math.min(16, Math.max(1, parseInt(n, 10) || 1));
    out.est = v;
    return ' ';
  });
  text = text.replace(/\bp([1-4])\b/ig, (_, n) => { out.priority = 5 - Number(n); return ' '; });
  text = text.replace(/\bq([1-4])\b/ig, (_, n) => { out.quad = 'q' + n; return ' '; });
  text = text.replace(/#([^\s#]+)/g, (_, name) => {
    const hit = matchSubject(name, subjects);
    if (hit) out.subjectId = hit.id;
    return ' ';
  });
  text = text.replace(/\b(today|tomorrow|someday)\b/ig, (_, w) => {
    if (/someday/i.test(w)) out.someday = true;
    else if (/tomorrow/i.test(w)) out.due = fmtDate(new Date(startOfDay(today).getTime() + 86400000));
    else out.due = fmtDate(startOfDay(today));
    return ' ';
  });
  text = text.replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/ig, (w) => {
    if (!out.due) out.due = nextNamedDay(today, WEEKDAYS[w.toLowerCase()]);
    return ' ';
  });
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/, (all, y, m, d) => {
    const dt = new Date(+y, +m - 1, +d);
    if (dt.getFullYear() === +y && dt.getMonth() === +m - 1) out.due = fmtDate(dt);
    return ' ';
  });
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\b/, (all, m, d) => {
    const dt = new Date(today.getFullYear(), +m - 1, +d);
    if (dt.getMonth() === +m - 1 && dt.getDate() === +d) out.due = fmtDate(dt);
    return ' ';
  });
  if (text.includes('!')) { out.energy = 'high'; text = text.replace(/!/g, ' '); }
  if (out.repeat && !out.due && !out.someday) {
    if (out.repeat === 'weekdays') {
      const d = startOfDay(today);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      out.due = fmtDate(d);
    } else out.due = fmtDate(startOfDay(today));
  }
  out.title = text.replace(/\s+/g, ' ').trim();
  return out.title ? out : null;
}
