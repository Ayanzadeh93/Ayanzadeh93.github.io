/* Remote Config flags — the one piece of the App Check / Remote Config /
 * Performance wiring worth a pure, testable contract: a fetch that fails
 * (offline, an ad-blocker, a first visit with no cached config) must resolve
 * to the same published default as a successful fetch of an unchanged value,
 * never silently to "on". Kept separate from adhd-study-pack.js so that
 * contract can be tested without the Firebase SDK or a network call.
 */

/** Published defaults, handed to the SDK's own `defaultConfig` too. */
export const REMOTE_DEFAULTS = Object.freeze({
  feature_phone_signin: false
});

/**
 * `fetched` is what a live Remote Config read returned (a boolean), or
 * `null`/`undefined` when the fetch itself never completed. Anything other
 * than an actual boolean falls back to the published default rather than
 * being coerced — a stray string or object from a misconfigured parameter
 * must not be read as truthy.
 */
export function resolveRemoteFlag(key, fetched) {
  if (typeof fetched === 'boolean') return fetched;
  return !!REMOTE_DEFAULTS[key];
}
