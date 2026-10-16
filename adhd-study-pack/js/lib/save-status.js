/* Honest save words. A local write is not a server ack. */

export function saveTone(phase) {
  if (phase === 'error') return 'crit';
  if (phase === 'waiting') return 'warn';
  if (phase === 'pending' || phase === 'saving' || phase === 'loading') return 'alert';
  if (phase === 'local' || phase === 'synced') return 'good';
  return 'muted';
}

const TONE_COLOR = {
  muted: 'var(--muted)',
  alert: 'var(--alert)',
  warn: 'var(--warn)',
  good: 'var(--good)',
  crit: 'var(--crit)'
};

export function saveColor(phase) {
  return TONE_COLOR[saveTone(phase)] || TONE_COLOR.muted;
}

/** What the chip should say. Cloud mode must not say Synced until the server agrees. */
export function saveLabel(mode, phase) {
  if (phase === 'loading') return 'Loading…';
  if (phase === 'pending') return 'Unsaved';
  if (phase === 'saving') return 'Saving…';
  if (phase === 'waiting') return 'Waiting to sync';
  if (phase === 'error') return 'Not saved';
  if (phase === 'synced') return (mode === 'cloud' || mode === 'rest') ? 'Synced' : 'Saved on this device';
  if (phase === 'local') return 'Saved on this device';
  return 'Nothing saved yet';
}

/** The phase that is true once the write call has returned.
    Cloud returns before the server ack. REST has already heard from the endpoint. */
export function phaseAfterWrite(mode) {
  if (mode === 'cloud') return 'waiting';
  if (mode === 'rest') return 'synced';
  return 'local';
}

export function recoveryRecord(json, at) {
  return { json: String(json || ''), at: at || Date.now() };
}

/** Keep the newer copy. An empty next record never replaces a real one. */
export function shouldKeepRecovery(existing, next) {
  if (!next || !next.json) return false;
  if (!existing || !existing.json) return true;
  return (next.at || 0) >= (existing.at || 0);
}
