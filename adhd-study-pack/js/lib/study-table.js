/* Study together — pure rules for a table.
   The browser module does the camera and the network. This file only
   decides names, codes, seats, and the shared clock, so tests stay
   DOM-free and nothing here can touch the microphone. */

export const WORDS = Object.freeze([
  'oak', 'pine', 'fern', 'lake', 'moss', 'ink', 'clay', 'desk',
  'rain', 'leaf', 'brook', 'lamp', 'nest', 'pond', 'reed', 'dusk',
  'mist', 'cove', 'glen', 'birch'
]);

const TAIL = '23456789abcdefghjkmnpqrstuvwxyz';

export const TYPES = Object.freeze([
  { id: 'pair', label: 'One study partner', hint: 'Two seats.', seats: 2 },
  { id: 'group', label: 'Group table', hint: 'Up to six people.', seats: 6 }
]);

export const VIBES = Object.freeze([
  { id: 'chill', label: 'Chill focus', hint: '50 minutes together. Mics start off.', block: 50, rest: 10, check: 0, talk: false },
  { id: 'hard', label: 'Hard focus', hint: '25 minutes, then 5. Mics start off.', block: 25, rest: 5, check: 0, talk: false },
  { id: 'account', label: 'Accountability', hint: '25 minute blocks, and a check every 15. Mics start off.', block: 25, rest: 5, check: 15, talk: false },
  { id: 'talk', label: 'Talk it out', hint: '25 minute blocks. Mics start on.', block: 25, rest: 5, check: 0, talk: true }
]);

export const CAMS = Object.freeze([
  { id: 'video', label: 'Camera on', hint: 'They can see you.' },
  { id: 'audio', label: 'Voice only', hint: 'No picture. You can still hear each other.' }
]);

const ROOM_KEYS = Object.freeze(['host', 'hostName', 'type', 'vibe', 'intent', 'cam', 'seats', 'open', 'count', 'created', 'beat', 'started']);
const MEMBER_KEYS = Object.freeze(['name', 'joined', 'seen', 'muted', 'video', 'check']);

export function vibeById(id) {
  return VIBES.find((v) => v.id === id) || VIBES[0];
}

export function seatsFor(type) {
  return type === 'group' ? 6 : 2;
}

export function startsMuted(vibeId) {
  return !vibeById(vibeId).talk;
}

/** The lower id sends the offer, so the two browsers never talk over each other. */
export function shouldOffer(mine, theirs) {
  return String(mine) < String(theirs);
}

export function makeTableCode(rand = Math.random) {
  const word = WORDS[Math.floor(rand() * WORDS.length)] || WORDS[0];
  let tail = '';
  for (let i = 0; i < 3; i++) tail += TAIL[Math.floor(rand() * TAIL.length)] || '2';
  return word + '-' + tail;
}

/** A code, or a link someone pasted. '' when it is not a table code. */
export function codeFromInput(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const fromQuery = s.match(/[?&]table=([a-z]+-[2-9abcdefghjkmnpqrstuvwxyz]{3})(?![a-z0-9])/);
  if (fromQuery) return fromQuery[1];
  const token = s.match(/(?:^|[^a-z0-9])([a-z]+-[2-9abcdefghjkmnpqrstuvwxyz]{3})(?![a-z0-9])/);
  return token ? token[1] : '';
}

export function tableLink(pageUrl, code) {
  const clean = String(pageUrl || 'https://www.ayanzadeh.com/adhd-study-pack/').split('#')[0].split('?')[0];
  return clean + '?view=together&table=' + code;
}

export function publicName(passport, authUser) {
  const display = passport && String(passport.displayName || '').trim();
  const handle = passport && String(passport.username || '').trim();
  const auth = authUser && String(authUser.displayName || '').trim();
  const raw = display || (handle ? '@' + handle : '') || auth || 'Student';
  const safe = raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return safe || 'Student';
}

export function roomCreateBody({ uid, name, type, vibe, cam, open, now, intent }) {
  const kind = type === 'group' ? 'group' : 'pair';
  return {
    host: String(uid || ''),
    hostName: publicName({ displayName: name }, null),
    type: kind,
    vibe: vibeById(vibe).id,
    intent: String(intent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
    cam: cam === 'audio' ? 'audio' : 'video',
    seats: seatsFor(kind),
    open: open === true,
    count: 1,
    created: now,
    beat: now,
    started: now
  };
}

export function memberBody({ name, now, muted, video }) {
  return {
    name: publicName({ displayName: name }, null),
    joined: now,
    seen: now,
    muted: !!muted,
    video: !!video,
    check: now
  };
}

export function roomKeys() { return ROOM_KEYS.slice(); }
export function memberKeys() { return MEMBER_KEYS.slice(); }

export function selectionReady(type, vibe, cam) {
  return !!(type && vibe && cam);
}

export function tableClock(started, now, vibe) {
  const spec = vibe && vibe.block ? vibe : vibeById(vibe);
  const block = spec.block * 60000;
  const rest = spec.rest * 60000;
  const cycle = block + rest || 1;
  const elapsed = Math.max(0, (Number(now) || 0) - (Number(started) || 0));
  const into = elapsed % cycle;
  const focusing = into < block;
  return {
    phase: focusing ? 'focus' : 'break',
    leftMs: focusing ? block - into : cycle - into,
    sittingMs: elapsed
  };
}

export function formatLeft(ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

export function formatElapsed(ms) {
  const m = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
  return m + 'm';
}

/** Waiting time on the match screen: 0:04, not 00:04. */
export function formatWait(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export function sessionLabel(type) {
  return type === 'group' ? 'Group study session active' : '1:1 study session active';
}

export function sessionTypeLabel(type) {
  return type === 'group' ? 'Group study session' : '1:1 study session';
}

/**
 * Oldest open table that still has a seat, same size and same way of working.
 * Empty string when nobody is waiting. `mine` is a code to skip (our own table).
 */
export function pickOpenRoom(rows, { type, vibe, now, mine, windowMs = 90000 } = {}) {
  const kind = type === 'group' ? 'group' : 'pair';
  const mood = vibeById(vibe).id;
  const fresh = (rows || []).filter((row) => {
    const id = row && row[0];
    const data = (row && row[1]) || {};
    if (!id || id === mine) return false;
    if (data.open !== true) return false;
    if (data.type !== kind || data.vibe !== mood) return false;
    if (!isFresh(data.beat, now, windowMs)) return false;
    const seats = Number(data.seats || (kind === 'group' ? 6 : 2));
    return Number(data.count || 0) < seats;
  });
  fresh.sort((a, b) => (a[1].created || 0) - (b[1].created || 0) || String(a[0]).localeCompare(String(b[0])));
  return fresh.length ? fresh[0][0] : '';
}

export function formatSat(ms) {
  const m = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
  if (m < 1) return 'Just sat down';
  if (m === 1) return 'Sitting for 1 minute';
  return 'Sitting for ' + m + ' minutes';
}

export function checkDue(lastCheck, now, everyMin) {
  const every = Number(everyMin) || 0;
  if (every <= 0) return false;
  return (Number(now) || 0) - (Number(lastCheck) || 0) >= every * 60000;
}

export function isFresh(seen, now, windowMs = 180000) {
  return (Number(now) || 0) - (Number(seen) || 0) < windowMs;
}
