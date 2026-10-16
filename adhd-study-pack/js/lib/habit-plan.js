/**
 * How often a build habit is asked for.
 * daily — every day.
 * days — only the weekdays in `days` (1 Monday … 7 Sunday).
 * times — any days, until `target` checks land this week.
 * A day that was never scheduled does not break a streak.
 */
const DAY = 86400000;

export function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** 1 Monday … 7 Sunday. */
export function isoWeekday(d) {
  const n = d.getDay();
  return n === 0 ? 7 : n;
}
export function weekStart(d) {
  const s = startOfDay(d);
  s.setDate(s.getDate() - (isoWeekday(s) - 1));
  return s;
}

export function habitPlan(h) {
  const freq = h && (h.freq === 'days' || h.freq === 'times') ? h.freq : 'daily';
  let days = Array.isArray(h && h.days) ? h.days.map(Number).filter((n) => n >= 1 && n <= 7) : [];
  if (freq === 'days' && !days.length) days = [1, 2, 3, 4, 5];
  const target = Math.max(1, Math.min(7, Number(h && h.target) || (freq === 'times' ? 3 : 7)));
  return { freq: freq, days: days, target: target };
}

export function loggedOn(h, key) {
  const v = h && h.history ? h.history[key] : undefined;
  if (typeof v === 'number') return v > 0;
  return !!v;
}

export function scheduledOn(h, date) {
  if (h && h.type && h.type !== 'good') return true;
  const plan = habitPlan(h);
  if (plan.freq !== 'days') return true;
  return plan.days.indexOf(isoWeekday(date)) >= 0;
}

export function weekLogs(h, date) {
  const start = weekStart(date);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (loggedOn(h, dayKey(new Date(+start + i * DAY)))) n++;
  }
  return n;
}

/** Show it on Today. Off-days stay in the list below, not in the way. */
export function dueToday(h, date) {
  if (!h || (h.type && h.type !== 'good')) return true;
  const plan = habitPlan(h);
  if (plan.freq === 'times') return weekLogs(h, date) < plan.target || loggedOn(h, dayKey(date));
  return scheduledOn(h, date);
}

export function planStreak(h, date) {
  if (!h || h.type !== 'good') return 0;
  const plan = habitPlan(h);
  if (plan.freq === 'times') {
    let weeks = 0;
    let cursor = weekStart(date);
    if (weekLogs(h, cursor) < plan.target) cursor = new Date(+cursor - 7 * DAY);
    while (weekLogs(h, cursor) >= plan.target && weeks < 520) {
      weeks++;
      cursor = new Date(+cursor - 7 * DAY);
    }
    return weeks;
  }
  let cursor = startOfDay(date);
  if (!loggedOn(h, dayKey(cursor))) cursor = new Date(+cursor - DAY);
  let n = 0;
  for (let i = 0; i < 420 && n < 400; i++) {
    if (!scheduledOn(h, cursor)) {
      cursor = new Date(+cursor - DAY);
      continue;
    }
    if (!loggedOn(h, dayKey(cursor))) break;
    n++;
    cursor = new Date(+cursor - DAY);
  }
  return n;
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function freqLabel(h) {
  if (!h || h.type !== 'good') return '';
  const plan = habitPlan(h);
  if (plan.freq === 'times') return plan.target + (plan.target === 1 ? ' time a week' : ' times a week');
  if (plan.freq === 'days') {
    return plan.days.slice().sort((a, b) => a - b).map((d) => DAY_LETTERS[d - 1]).join(' ');
  }
  return 'Every day';
}
