/* Who may change a study table. The Firestore rules are the real gate.
   This is the same policy, in a form the tests can run without an emulator. */

const ROOM_FIELDS = ['count', 'beat', 'open', 'intent'];

export function roomWriteAllowed(input) {
  const auth = input && input.authUid;
  if (!auth) return false;
  if (input.action === 'delete') return auth === input.host;
  if (input.action !== 'update') return false;
  const touched = input.affected || [];
  if (touched.some((key) => !ROOM_FIELDS.includes(key))) return false;
  if (touched.includes('intent') && (input.authUid !== input.host || String(input.nextIntent || '').length > 160)) return false;
  const seats = Number(input.seats);
  const count = Number(input.count);
  const next = Number(input.nextCount);
  if (!Number.isInteger(next) || next < 0 || next > seats) return false;
  if (input.nextHost && input.nextHost !== input.host) return false;
  if (auth === input.host) return true;
  if (touched.includes('intent')) return false;
  if (!input.member) return false;
  if (!!input.open !== !!input.nextOpen) return false;
  return next >= count - 1 && next <= count + 1;
}

export function signalReadAllowed(authUid, message) {
  if (!authUid || !message) return false;
  return message.to === authUid || message.from === authUid;
}

export function memberDeleteAllowed(input) {
  if (!input || !input.authUid) return false;
  if (input.authUid === input.memberUid) return true;
  if (input.authUid === input.host) return true;
  const seen = Number(input.seen);
  const now = Number(input.now);
  return Number.isFinite(seen) && Number.isFinite(now) && seen < now - 90000;
}
