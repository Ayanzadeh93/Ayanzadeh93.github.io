/* Calendar dates, rather than elapsed 24-hour periods, keep mood history
   aligned with the person's local days when daylight saving time changes. */
export const moodDayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const moodScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 9 ? value : null;
export function moodTimestamp(entry) {
  const value = entry?.at ?? entry?.start;
  const stamp = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(stamp) && Number.isFinite(+new Date(stamp)) ? stamp : null;
}
export function moodCalendarDays(count, now = new Date()) {
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(+now)) return [];
  return Array.from({ length:count }, (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - count + 1 + index));
}
export function moodRowsInRange(rows, count, now = new Date()) {
  const days = moodCalendarDays(count, now);
  if (!days.length) return [];
  const start = +days[0], end = +new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return rows.filter(row => { const at = moodTimestamp(row); return at != null && at >= start && at < end; });
}
const mean = values => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
export function moodDaySeries(rows, count, now = new Date(), minutes = {}) {
  const grouped = new Map();
  for (const row of moodRowsInRange(rows, count, now)) {
    const key = moodDayKey(new Date(moodTimestamp(row)));
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return moodCalendarDays(count, now).map(d => {
    const k = moodDayKey(d), entries = (grouped.get(k) || []).sort((a, b) => moodTimestamp(a) - moodTimestamp(b));
    const metrics = Object.fromEntries(['mood', 'energy', 'stress'].map(axis => [axis, mean(entries.map(entry => moodScore(entry[axis])).filter(value => value != null))]));
    const focused = minutes[k];
    return { d, k, entries, ...metrics, mins:typeof focused === 'number' && Number.isFinite(focused) && focused > 0 ? focused : 0 };
  });
}
/* Both the line and its shaded area must use these same uninterrupted runs.
   A missing day is unknown, never an interpolated measurement. */
export function moodSegments(series, axis = 'mood') {
  const runs = [];
  let run = [];
  series.forEach((day, index) => {
    if (moodScore(day[axis]) == null) { if (run.length) runs.push(run); run = []; }
    else run.push({ ...day, index });
  });
  if (run.length) runs.push(run);
  return runs;
}
export function moodSeriesSummary(series) {
  return {
    loggedDays:series.filter(day => day.entries.length).length,
    entries:series.reduce((total, day) => total + day.entries.length, 0),
    /* Equal weight per day, even when someone logs repeatedly on one day. */
    ...Object.fromEntries(['mood', 'energy', 'stress'].map(axis => [axis, mean(series.map(day => moodScore(day[axis])).filter(value => value != null))]))
  };
}
export function moodCalendarWeeks(series) {
  if (!series.length) return [];
  const cells = Array((series[0].d.getDay() + 6) % 7).fill(null).concat(series);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length:cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}
