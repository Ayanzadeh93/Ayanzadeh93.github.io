/* What's New — pure helpers for the post-login version card.
   The page decides when to draw the modal; this module only answers
   "should we show it, and what does it say?" so tests stay DOM-free. */

export const AWAY_MS = 7 * 86400000;

export const RELEASES = [
  {
    version: '3.11.0',
    name: 'Tags beside priority',
    date: '2026-09-21',
    highlights: [
      'Tasks and plan blocks can carry category tags (Reading, Lab, and your own). Tags are not the priority matrix.',
      'Turn a tag and a quadrant on together — the task list keeps only what matches both. The matrix still groups by Q1–Q4 and only narrows by tag.',
      'Merge folds one tag into another without moving anything between Q1–Q4.'
    ]
  },
  {
    version: '3.10.0',
    name: 'Spark Firebase extras',
    date: '2026-09-21',
    highlights: [
      'App Check (reCAPTCHA Enterprise) and Performance Monitoring sit on the free Spark plan — monitoring only until you flip enforcement in Console.',
      'Remote Config reads feature_phone_signin; keep it false until you want SMS sign-in on the gate (~10 SMS/day on Spark).',
      'Email + Google stay as they were. Storage, Functions, Analytics, and Hosting stay off on purpose.'
    ]
  },
  {
    version: '3.9.0',
    name: 'Fifty milestones & quieter search',
    date: '2026-09-20',
    highlights: [
      'Passport now carries fifty FocusQuest milestones — creative glyphs from First Spark to Focus Sovereign.',
      '⌘K search jumps to any section by name or alias, and /ask · ai: · @coach send prompts to the on-device coach.',
      'Setup panels and a few views use calm scene photos and icons; denser layout for fewer distractions.'
    ]
  },
  {
    version: '3.8.1',
    name: 'Professional colour & gradients',
    date: '2026-09-20',
    highlights: [
      'Setup → Seeing now offers five calm professional accents (Slate, Navy, Teal, Sage, Graphite) beside Ember, Moss, Iris and Amber.',
      'Optional Soft or Rich accent gradients wash primary buttons and a light backdrop — turn Off anytime.',
      'Colour swatches make picking an accent one tap, with a live preview in the same panel.'
    ]
  },
  {
    version: '3.7.3',
    name: 'Calendar views first',
    date: '2026-09-20',
    highlights: [
      'Connect Google Calendar now only asks to view your events so the planner can work around them.',
      'Sending blocks to Google is a separate switch. That is when Google asks for edit access.',
      'Sign-in is still name and email only. Google may still mark Calendar as unverified until they finish reviewing those scopes.'
    ]
  },
  {
    version: '3.7.2',
    name: 'Safer Google sign-in',
    date: '2026-09-20',
    highlights: [
      'Continue with Google now only asks for your name and email. It no longer requests Calendar access.',
      'Calendar sync is optional: connect it later from Plan if you want it. Sign-in works without that popup.',
      'A public Privacy page says exactly what is stored, what Google sees, and what is never requested at login.'
    ]
  },
  {
    version: '3.7.1',
    name: 'Catch you up',
    date: '2026-09-20',
    highlights: [
      'After you sign in with Google, email, or a local profile, a short card names this version and what changed.',
      'If you have not opened the pack for a week, the same card welcomes you back even when the version has not moved.',
      'Dismiss it once and it stays quiet until the next version — or until you have been away again. Re-open it any time from About.'
    ]
  },
  {
    version: '3.7.0',
    name: 'Passport, Help & Habits',
    date: '2026-09-18',
    highlights: [
      'Passport tab: display name, photo and bio on the account you already use.',
      'Eight focus achievements that unlock from sessions you actually finish.',
      'Help centre with search and category filters, kept off the working screens.',
      'Habits: Build, Counters and Break, with forgiving streaks and an impulse pause.'
    ]
  }
];

export function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function unseenReleases(seenVersion, releases = RELEASES) {
  return (releases || [])
    .filter(r => cmpVersion(r.version, seenVersion) > 0)
    .sort((a, b) => cmpVersion(b.version, a.version));
}

export function currentRelease(version, releases = RELEASES) {
  return (releases || []).find(r => r.version === version) || (releases && releases[0]) || null;
}

export function whatsNewPayload({
  seenVersion = null,
  lastVisit = 0,
  now = Date.now(),
  awayMs = AWAY_MS,
  version,
  releases = RELEASES
} = {}) {
  const unseen = unseenReleases(seenVersion, releases);
  if (unseen.length) {
    return { kind: 'update', version, releases: unseen, name: unseen[0].name };
  }
  const away = lastVisit && (now - lastVisit >= awayMs);
  if (away) {
    const cur = currentRelease(version, releases);
    if (!cur) return null;
    return { kind: 'welcome', version, releases: [cur], name: cur.name };
  }
  return null;
}

export function mergeWhatsNewRecord(device = {}, cloud = {}) {
  const v = [cloud.v, device.v].filter(Boolean).sort(cmpVersion).pop() || null;
  const lasts = [cloud.last, device.last].map(n => Number(n) || 0).filter(Boolean);
  const last = lasts.length ? Math.max(...lasts) : 0;
  return { v, last };
}

export function whatsNewDeviceKey(storageKey, userId) {
  const base = String(storageKey || 'focusdial.v3') + '.whatsnew';
  return userId ? base + ':' + userId : base;
}

export function readWhatsNewRecord(storage, key) {
  if (!storage || !key) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? { v: o.v || null, last: Number(o.last) || 0 } : {};
  } catch (e) {
    return {};
  }
}

export function writeWhatsNewRecord(storage, key, rec) {
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify({ v: rec && rec.v || null, last: Number(rec && rec.last) || 0 }));
    return true;
  } catch (e) {
    return false;
  }
}
