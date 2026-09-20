/* Passport — profile, avatar metadata and achievement badges for ADHD Study Pack.
   Pure helpers: the page stores S.passport in the workspace and draws the view.
   Achievements are computed from focus-session history (S.sessions), not a
   second identity app. */
const ratio = (value, target) => {
  const v = Number(value) || 0;
  const t = Number(target) || 1;
  return Math.max(0, Math.min(1, v / t));
};

export const ACHIEVEMENTS = [
  { key: 'first_spark', title: 'First Spark',  description: 'Finish your very first focus session', icon: '✦', sessions: 1 },
  { key: 'warmed_up',   title: 'Warmed Up',    description: 'Log 5 focus sessions',                 icon: '⏱', sessions: 5 },
  { key: 'hour_hero',   title: 'Hour Hero',    description: 'Reach 60 focused minutes in total',    icon: '◉', minutes: 60 },
  { key: 'streak_3',    title: 'Three in a Row', description: 'Study 3 days in a row',              icon: '🔥', streak: 3 },
  { key: 'deep_diver',  title: 'Deep Diver',   description: 'Reach 300 focused minutes in total',   icon: '🚀', minutes: 300 },
  { key: 'streak_7',    title: 'Week Warrior', description: 'Study 7 days in a row',                icon: '🏆', streak: 7 },
  { key: 'night_owl',   title: 'Marathon Mind', description: 'Log 25 focus sessions',               icon: '☾', sessions: 25 },
  { key: 'legend',      title: 'Focus Legend', description: 'Reach 1000 focused minutes',           icon: '♛', minutes: 1000 }
];

export function emptyPassport() {
  return { displayName: '', bio: '', avatar: '', seen: [] };
}

export function normalisePassport(raw) {
  const d = emptyPassport();
  if (!raw || typeof raw !== 'object') return d;
  d.displayName = String(raw.displayName || '').slice(0, 80);
  d.bio = String(raw.bio || '').slice(0, 280);
  const av = String(raw.avatar || '');
  d.avatar = av.startsWith('data:image/') ? av : '';
  d.seen = Array.isArray(raw.seen) ? raw.seen.map(String).filter(k => ACHIEVEMENTS.some(a => a.key === k)) : [];
  return d;
}

export function initialsOf(name, fallback = '?') {
  const parts = String(name || '').replace(/@.*/, '').trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

export function sessionStamp(row) {
  if (!row) return 0;
  if (typeof row.at === 'number' && isFinite(row.at)) return row.at;
  const iso = row.start || row.created_at || row.end;
  const t = iso ? Date.parse(iso) : NaN;
  return isFinite(t) ? t : 0;
}

export function computeStats(sessions) {
  const rows = Array.isArray(sessions) ? sessions : [];
  const minutes = rows.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const days = new Set();
  rows.forEach(s => {
    const t = sessionStamp(s);
    if (!t) return;
    const d = new Date(t);
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  });

  let streak = 0;
  const cursor = new Date();
  const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!days.has(keyOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(keyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { sessions: rows.length, minutes, streak };
}

export function achievementProgress(achievement, stats) {
  if (achievement.sessions) return ratio(stats.sessions, achievement.sessions);
  if (achievement.minutes) return ratio(stats.minutes, achievement.minutes);
  if (achievement.streak) return ratio(stats.streak, achievement.streak);
  return 0;
}

export function getAchievement(key) {
  return ACHIEVEMENTS.find(a => a.key === key) || null;
}

export function earnedKeys(stats) {
  return ACHIEVEMENTS.filter(a => achievementProgress(a, stats) >= 1).map(a => a.key);
}

/** Keys the stats qualify for that are not yet in `seen`. */
export function freshKeys(stats, seen) {
  const have = new Set(seen || []);
  return earnedKeys(stats).filter(k => !have.has(k));
}

/** Merge newly earned keys into seen, preserving order. Returns the fresh keys. */
export function adoptKeys(passport, stats, { silent = false } = {}) {
  const p = normalisePassport(passport);
  const fresh = freshKeys(stats, p.seen);
  if (fresh.length) p.seen = p.seen.concat(fresh);
  return { passport: p, fresh: silent ? [] : fresh };
}
