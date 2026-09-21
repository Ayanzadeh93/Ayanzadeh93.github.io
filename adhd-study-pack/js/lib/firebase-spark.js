/**
 * Pure helpers for Spark-plan Firebase extras (App Check, Remote Config, phone).
 * Kept DOM-free so unit tests do not need the SDK.
 */

/** True when phone sign-in should appear on the gate. */
export function shouldShowPhoneSignIn(remoteFlag, cfgOverride) {
  if (cfgOverride === true) return true;
  if (cfgOverride === false) return false;
  return !!remoteFlag;
}

/**
 * Coerce a user-typed phone string toward E.164.
 * Accepts +1… international forms, or US 10-digit numbers (prefixed with +1).
 * Returns '' when the input is not usable.
 */
export function normalisePhoneE164(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) {
    const digits = '+' + s.slice(1).replace(/\D/g, '');
    return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : '';
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '';
}

/** Hosts where App Check should use the debug provider instead of reCAPTCHA. */
export function isAppCheckDebugHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local');
}
