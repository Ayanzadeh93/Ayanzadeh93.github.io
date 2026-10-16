/* Account-scoped keys. A token belongs to one sign-in, never to the file
   you export, and never to the next person who uses this browser. */

const SECRET_KEYS = /^(token|secret|password|api[-_]?key|authorization|access[-_]?token|refresh[-_]?token)$/i;

export function accountScope(uid) {
  const id = String(uid || '').trim();
  return id || 'guest';
}

export function secretName(base, uid) {
  return String(base || '') + '.' + accountScope(uid);
}

/** Move a key that used to sit unscoped onto this account, then delete the
    shared copy. A later account finds nothing there. A guest copy is dropped. */
export function claimLegacyKey(storage, base, uid) {
  if (!storage || !base) return 'none';
  const legacy = storage.getItem(base);
  if (!legacy) return 'none';
  const scope = accountScope(uid);
  if (scope === 'guest') {
    storage.removeItem(base);
    return 'dropped';
  }
  const scoped = secretName(base, scope);
  if (!storage.getItem(scoped)) storage.setItem(scoped, legacy);
  storage.removeItem(base);
  return storage.getItem(base) ? 'left' : 'claimed';
}

export function readSecret(storage, base, uid) {
  if (!storage) return '';
  return storage.getItem(secretName(base, uid)) || '';
}

export function writeSecret(storage, base, uid, value) {
  if (!storage) return;
  const name = secretName(base, uid);
  if (value) storage.setItem(name, value);
  else storage.removeItem(name);
}

/** Copy a workspace for export or import. Secret-shaped fields are removed
    at every level. Ordinary text, including a note that mentions a password,
    is kept because it is a value, not a field name. */
export function redactExport(value) {
  if (Array.isArray(value)) return value.map(redactExport);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    if (SECRET_KEYS.test(key)) return;
    out[key] = redactExport(value[key]);
  });
  return out;
}
