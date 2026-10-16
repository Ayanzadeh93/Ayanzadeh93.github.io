/* Shared-computer rules. Pure: no DOM, no Firebase.
   A personal computer may stay signed in. A shared one must not. */

export const DEVICE_PERSONAL = 'personal';
export const DEVICE_SHARED = 'shared';
export const COACH_KEY_PREFIX = 'adhd-study-pack.coach.key.';
export const YT_TOKEN_KEY = 'adhd-study-pack.yt-token';

export function normaliseDevice(value) {
  return value === DEVICE_SHARED ? DEVICE_SHARED : DEVICE_PERSONAL;
}

/** Where Firebase Auth may keep the session. Shared computers never use local. */
export function authPersistence(device, remember) {
  if (normaliseDevice(device) === DEVICE_SHARED) return 'session';
  return remember ? 'local' : 'session';
}

/** Firestore disk cache. Shared computers keep the workspace in memory only. */
export function firestoreCacheKind(device) {
  return normaliseDevice(device) === DEVICE_SHARED ? 'memory' : 'persistent';
}

export function privateStorageKeys(storageKey) {
  const base = storageKey || 'focusdial.v3';
  return [
    base + '.todoist',
    base + '.gcal-token',
    base + '.mcp',
    YT_TOKEN_KEY
  ];
}

export function isPrivateStorageKey(key, storageKey) {
  const name = String(key || '');
  if (!name) return false;
  if (name.startsWith(COACH_KEY_PREFIX)) return true;
  if (name === YT_TOKEN_KEY || name.startsWith(YT_TOKEN_KEY + '.')) return true;
  const base = storageKey || 'focusdial.v3';
  return ['.todoist', '.gcal-token', '.mcp'].some((suffix) => {
    const stem = base + suffix;
    return name === stem || name.startsWith(stem + '.');
  });
}

/** Plain words for the sign-in screen and the account card. */
export function deviceCopy(device) {
  if (normaliseDevice(device) === DEVICE_SHARED) {
    return {
      title: 'Shared computer',
      body: 'Sign-out removes the cloud cache, Todoist, coach keys, and calendar access. Closing the browser signs you out too. Theme stays. A local profile’s tasks stay behind its sign-in. The cloud account is not deleted.'
    };
  }
  return {
    title: 'Just me',
    body: 'Stay signed in keeps this account in this browser after you close it. Signing out still leaves your tasks in the account. Theme stays either way.'
  };
}

/** Remove private keys from one storage. Returns the names it removed. */
export function clearPrivateKeys(storage, storageKey) {
  if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') return [];
  const names = [];
  for (let i = 0; i < storage.length; i++) names.push(storage.key(i));
  const removed = [];
  names.forEach(name => {
    if (!isPrivateStorageKey(name, storageKey)) return;
    storage.removeItem(name);
    removed.push(name);
  });
  return removed;
}
