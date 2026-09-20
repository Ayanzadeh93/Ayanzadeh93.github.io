/* Passport — profile, avatar metadata and achievement badges for ADHD Study Pack.
   Pure helpers: the page stores S.passport in the workspace and draws the view.
   Achievements are computed from focus-session history (S.sessions), not a
   second identity app. Fifty FocusQuest milestones climb sessions, minutes
   and streaks with creative glyphs in the same spirit as the original eight. */
const ratio = (value, target) => {
  const v = Number(value) || 0;
  const t = Number(target) || 1;
  return Math.max(0, Math.min(1, v / t));
};

export const ACHIEVEMENTS = [
  /* —— first lights —— */
  { key: 'first_spark',     title: 'First Spark',       description: 'Finish your very first focus session',           icon: '✦', sessions: 1 },
  { key: 'second_wind',     title: 'Second Wind',       description: 'Come back for a second focus block',            icon: '⚡', sessions: 2 },
  { key: 'triple_click',    title: 'Triple Click',      description: 'Log 3 focus sessions',                          icon: '◈', sessions: 3 },
  { key: 'warmed_up',       title: 'Warmed Up',         description: 'Log 5 focus sessions',                          icon: '⏱', sessions: 5 },
  { key: 'quarter_hour',    title: 'Quarter Hour',      description: 'Reach 15 focused minutes in total',             icon: '◌', minutes: 15 },
  { key: 'half_hour_heart', title: 'Half-Hour Heart',   description: 'Reach 30 focused minutes in total',             icon: '♥', minutes: 30 },
  { key: 'forty_five',      title: 'Forty-Five',        description: 'Reach 45 focused minutes in total',             icon: '◔', minutes: 45 },
  { key: 'hour_hero',       title: 'Hour Hero',         description: 'Reach 60 focused minutes in total',             icon: '◉', minutes: 60 },
  /* —— early rhythm —— */
  { key: 'pair_days',       title: 'Pair of Days',      description: 'Study 2 days in a row',                         icon: '☾', streak: 2 },
  { key: 'streak_3',        title: 'Three in a Row',    description: 'Study 3 days in a row',                         icon: '🔥', streak: 3 },
  { key: 'octet',           title: 'Octet',             description: 'Log 8 focus sessions',                          icon: '❋', sessions: 8 },
  { key: 'decade_blocks',   title: 'Decade of Blocks',  description: 'Log 10 focus sessions',                         icon: '🔟', sessions: 10 },
  { key: 'ninety_club',     title: 'Ninety Club',       description: 'Reach 90 focused minutes in total',             icon: '◎', minutes: 90 },
  { key: 'two_hour_tide',   title: 'Two-Hour Tide',     description: 'Reach 120 focused minutes in total',            icon: '≋', minutes: 120 },
  { key: 'streak_5',        title: 'High Five',         description: 'Study 5 days in a row',                         icon: '✋', streak: 5 },
  { key: 'fifteen_fires',   title: 'Fifteen Fires',     description: 'Log 15 focus sessions',                         icon: '✶', sessions: 15 },
  /* —— deepening —— */
  { key: 'triple_hour',     title: 'Triple Hour',       description: 'Reach 180 focused minutes in total',            icon: '⬡', minutes: 180 },
  { key: 'score_board',     title: 'Score Board',       description: 'Log 20 focus sessions',                         icon: '▣', sessions: 20 },
  { key: 'four_hour_forge', title: 'Four-Hour Forge',   description: 'Reach 240 focused minutes in total',            icon: '⚒', minutes: 240 },
  { key: 'night_owl',       title: 'Marathon Mind',     description: 'Log 25 focus sessions',                         icon: '☽', sessions: 25 },
  { key: 'deep_diver',      title: 'Deep Diver',        description: 'Reach 300 focused minutes in total',            icon: '🚀', minutes: 300 },
  { key: 'streak_7',        title: 'Week Warrior',      description: 'Study 7 days in a row',                         icon: '🏆', streak: 7 },
  { key: 'thirty_sparks',   title: 'Thirty Sparks',     description: 'Log 30 focus sessions',                         icon: '✧', sessions: 30 },
  { key: 'orbit_400',       title: 'Orbit 400',         description: 'Reach 400 focused minutes in total',            icon: '🪐', minutes: 400 },
  /* —— mid quest —— */
  { key: 'forty_flights',   title: 'Forty Flights',     description: 'Log 40 focus sessions',                         icon: '✈', sessions: 40 },
  { key: 'half_kilo',       title: 'Half Kilo',         description: 'Reach 500 focused minutes in total',            icon: '⚖', minutes: 500 },
  { key: 'streak_10',       title: 'Ten-Day Torch',     description: 'Study 10 days in a row',                        icon: '🕯', streak: 10 },
  { key: 'fifty_beacon',    title: 'Fifty Beacon',      description: 'Log 50 focus sessions',                         icon: '🏷', sessions: 50 },
  { key: 'ten_hour_tide',   title: 'Ten-Hour Tide',     description: 'Reach 600 focused minutes in total',            icon: '🌊', minutes: 600 },
  { key: 'diamond_75',      title: 'Diamond 75',        description: 'Log 75 focus sessions',                         icon: '◆', sessions: 75 },
  { key: 'streak_14',       title: 'Fortnight Flame',   description: 'Study 14 days in a row',                        icon: '🏔', streak: 14 },
  { key: 'century_club',    title: 'Century Club',      description: 'Log 100 focus sessions',                        icon: '💯', sessions: 100 },
  /* —— long haul —— */
  { key: 'twelve_hour_sun', title: 'Twelve-Hour Sun',   description: 'Reach 750 focused minutes in total',            icon: '☀', minutes: 750 },
  { key: 'legend',          title: 'Focus Legend',      description: 'Reach 1000 focused minutes',                    icon: '♛', minutes: 1000 },
  { key: 'streak_21',       title: 'Three-Week Crown',  description: 'Study 21 days in a row',                        icon: '👑', streak: 21 },
  { key: 'one_two_five',    title: 'One-Two-Five',      description: 'Log 125 focus sessions',                        icon: '⬢', sessions: 125 },
  { key: 'day_and_half',    title: 'Day and a Half',    description: 'Reach 1500 focused minutes in total',           icon: '⏳', minutes: 1500 },
  { key: 'streak_30',       title: 'Month of Momentum', description: 'Study 30 days in a row',                        icon: '📅', streak: 30 },
  { key: 'one_fifty',       title: 'One Fifty',         description: 'Log 150 focus sessions',                        icon: '🎖', sessions: 150 },
  { key: 'two_k_vault',     title: 'Two-K Vault',       description: 'Reach 2000 focused minutes in total',           icon: '🗝', minutes: 2000 },
  /* —— summit —— */
  { key: 'double_century',  title: 'Double Century',    description: 'Log 200 focus sessions',                        icon: '💠', sessions: 200 },
  { key: 'streak_45',       title: 'Forty-Five Days',   description: 'Study 45 days in a row',                        icon: '☄', streak: 45 },
  { key: 'two_fifty',       title: 'Two Fifty',         description: 'Log 250 focus sessions',                        icon: '🧿', sessions: 250 },
  { key: 'three_k_forge',   title: 'Three-K Forge',     description: 'Reach 3000 focused minutes in total',           icon: '🛡', minutes: 3000 },
  { key: 'triple_century',  title: 'Triple Century',    description: 'Log 300 focus sessions',                        icon: '🔮', sessions: 300 },
  { key: 'streak_60',       title: 'Sixty-Day Spire',   description: 'Study 60 days in a row',                        icon: '🗼', streak: 60 },
  { key: 'four_hundred',    title: 'Four Hundred',      description: 'Log 400 focus sessions',                        icon: '🗿', sessions: 400 },
  { key: 'five_k_aurora',   title: 'Five-K Aurora',     description: 'Reach 5000 focused minutes in total',           icon: '🌌', minutes: 5000 },
  { key: 'half_thousand',   title: 'Half Thousand',     description: 'Log 500 focus sessions',                        icon: '⭐', sessions: 500 },
  { key: 'focus_sovereign', title: 'Focus Sovereign',   description: 'Reach 7500 focused minutes — the summit',       icon: '🏵', minutes: 7500 }
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
