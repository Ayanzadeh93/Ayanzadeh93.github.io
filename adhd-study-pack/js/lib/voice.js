/* Voice and typed brain dump. Pure: no microphone, no DOM.
   A sentence becomes tasks, a command, or a parked note.
   The day packer only uses time that is still open. */

const VIEWS = {
  tasks: 'tasks', plan: 'plan', week: 'plan', calendar: 'plan',
  focus: 'focus', timer: 'focus', matrix: 'matrix', priorities: 'matrix',
  notes: 'notes', habits: 'habits', mood: 'mood', sound: 'sound', music: 'sound',
  calm: 'calm', coach: 'coach', together: 'together', profile: 'profile',
  passport: 'passport', help: 'help', settings: 'settings', setup: 'settings'
};

function clean(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function hm(value, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return fallback;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return fallback;
  return h * 60 + min;
}

/** "2h 15m", "45m", or "0m". */
export function formatSpan(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return r + 'm';
  if (!r) return h + 'h';
  return h + 'h ' + r + 'm';
}

/** Pull a duration out of a spoken line. Default is one 25-minute block. */
export function parseDuration(line) {
  let title = clean(line);
  let minutes = 25;
  const hour = title.match(/\b(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\b/i);
  const min = title.match(/\b(\d+)\s*(?:minutes|minute|mins|min)\b/i);
  const pomo = title.match(/\b(\d+)\s*(?:pomodoros|pomodoro|pomos|pomo)\b/i);
  if (hour) minutes = Math.round(parseFloat(hour[1]) * 60);
  else if (min) minutes = +min[1];
  else if (pomo) minutes = +pomo[1] * 25;
  title = title
    .replace(/\b(?:for|in)\s+\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|minutes|minute|mins|min|pomodoros|pomodoro|pomos|pomo)\b/ig, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours|hour|hrs|hr|minutes|minute|mins|min|pomodoros|pomodoro|pomos|pomo)\b/ig, '')
    .replace(/^(?:i (?:need|have|want|gotta|got) to|i should|remember to|don't forget to|do not forget to|please)\s+/i, '')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  minutes = Math.max(15, Math.min(240, Math.round(minutes / 5) * 5 || 25));
  return { title: title.slice(0, 120), minutes };
}

/** One breath can hold several tasks. Commands stay whole. */
export function splitDump(raw) {
  const text = clean(raw);
  if (!text) return [];
  const parts = text.split(/\s*(?:\n+|[;]|[.!?]\s+|,\s+and\s+|\s+and then\s+|\s+then\s+|\s+also\s+)\s*/i)
    .map(s => s.trim())
    .filter(s => s.length > 1);
  return parts.length ? parts : [text];
}

/** What one finished utterance means. */
export function interpret(raw) {
  const text = clean(raw);
  if (!text) return [];
  const lower = text.toLowerCase();
  if (/^(?:start|begin)(?:\s+(?:focus|timer|a block|the timer))?$/.test(lower)) return [{ kind: 'start' }];
  if (/^(?:pause|hold)(?:\s+(?:the\s+)?timer)?$/.test(lower) || lower === 'stop the timer') return [{ kind: 'pause' }];
  if (/^skip(?:\s+(?:the\s+)?(?:phase|break|timer))?$/.test(lower)) return [{ kind: 'skip' }];
  const go = lower.match(/^(?:go to|open|show)\s+(?:the\s+)?([a-z]+)$/);
  if (go && VIEWS[go[1]]) return [{ kind: 'go', view: VIEWS[go[1]] }];
  const work = text.match(/^(?:work on|focus on)\s+(.+)$/i);
  if (work && clean(work[1])) return [{ kind: 'focus', title: clean(work[1]).slice(0, 120) }];
  const note = text.match(/^(?:park|note|dump)\s+(.+)$/i);
  if (note && clean(note[1])) return [{ kind: 'note', text: clean(note[1]).slice(0, 280) }];
  const task = text.match(/^(?:add|create|new|make)\s+(?:a\s+)?(?:new\s+)?task\s+(.+)$/i) || text.match(/^remind me to\s+(.+)$/i);
  if (task) {
    const one = parseDuration(task[1]);
    return one.title ? [{ kind: 'task', title: one.title, minutes: one.minutes }] : [];
  }
  return splitDump(text).map(part => ({ kind: 'task', ...parseDuration(part) })).filter(row => row.title);
}

function localDay(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Free stretches between now (rounded up) and the end of the day, minus events. */
export function freeSpans(now, dayStart, dayEnd, events) {
  const openAt = hm(dayStart, 8 * 60);
  const closeAt = hm(dayEnd, 21 * 60);
  let cursor = Math.max(openAt, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
  if (cursor >= closeAt) return [];
  const day = localDay(now);
  const winA = day.getTime() + cursor * 60000;
  const winB = day.getTime() + closeAt * 60000;
  const busy = [];
  for (const e of events || []) {
    const a = new Date(e && e.start);
    const b = new Date(e && e.end);
    if (!isFinite(+a) || !isFinite(+b) || +b <= +a) continue;
    const s = Math.max(+a, winA);
    const f = Math.min(+b, winB);
    if (f <= s) continue;
    busy.push([Math.floor((s - day.getTime()) / 60000), Math.ceil((f - day.getTime()) / 60000)]);
  }
  busy.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const span of busy) {
    const last = merged[merged.length - 1];
    if (!last || span[0] > last[1]) merged.push([span[0], span[1]]);
    else last[1] = Math.max(last[1], span[1]);
  }
  const spans = [];
  for (const [a, b] of merged) {
    if (a > cursor) spans.push([cursor, Math.min(a, closeAt)]);
    cursor = Math.max(cursor, b);
    if (cursor >= closeAt) break;
  }
  if (cursor < closeAt) spans.push([cursor, closeAt]);
  return spans.filter(s => s[1] - s[0] >= 15);
}

export function openMinutes(now, dayStart, dayEnd, events) {
  return freeSpans(now, dayStart, dayEnd, events).reduce((n, s) => n + (s[1] - s[0]), 0);
}

/** Put chosen tasks into the open gaps. What does not fit is returned as left. */
export function packDay(items, opts) {
  const now = opts.now;
  const spans = freeSpans(now, opts.dayStart, opts.dayEnd, opts.events).map(s => s.slice());
  const open = spans.reduce((n, s) => n + (s[1] - s[0]), 0);
  const placed = [];
  const left = [];
  const day = localDay(now);
  for (const item of items || []) {
    const need = Math.max(15, Math.min(240, Math.round(Number(item.minutes) || 25)));
    let fit = -1;
    for (let i = 0; i < spans.length; i++) {
      if (spans[i][1] - spans[i][0] >= need) { fit = i; break; }
    }
    if (fit < 0) { left.push({ title: item.title, minutes: need }); continue; }
    const startMin = spans[fit][0];
    spans[fit][0] = startMin + need;
    if (spans[fit][1] - spans[fit][0] < 15) spans.splice(fit, 1);
    placed.push({
      title: item.title,
      minutes: need,
      start: new Date(day.getTime() + startMin * 60000).toISOString(),
      end: new Date(day.getTime() + (startMin + need) * 60000).toISOString()
    });
  }
  return { placed, left, open };
}
