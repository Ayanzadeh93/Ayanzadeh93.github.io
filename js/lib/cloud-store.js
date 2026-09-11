/**
 * cloud-store.js — Google and phone (SMS code) sign-in plus a
 * Firestore-backed store for the ADHD Study Pack.
 *
 * Only ever loaded with a dynamic import, and only when js/firebase-config.js
 * holds a real config, so a visitor on an unconfigured build downloads no
 * third-party code.
 *
 * The store it returns has the same async read/write shape as the local one
 * in adhd-study-pack.js, with the Firebase uid standing in for the profile
 * name. Each slice of a pack is one document:
 *
 *     users/{uid}/pack/{tasks | parked | sessions | activeTaskId}
 *         { value: <the slice>, updatedAt: <server time> }
 *
 * firebase/firestore.rules limits every document under users/{uid} to that
 * signed-in user.
 */

// Pinned so a Firebase release can never change the page underneath it.
// The CSP in apps/adhd-study-pack.html allows https://www.gstatic.com for this.
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

/**
 * JSON with sorted keys. Firestore hands maps back with their keys in its own
 * order, so a plain JSON.stringify would call identical data "changed" and
 * trigger pointless writes and re-renders.
 */
function stableJson(value) {
    return JSON.stringify(value, (key, val) =>
        val && typeof val === 'object' && !Array.isArray(val)
            ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]]))
            : val);
}

function createCloudStore(db, fs) {
    // Last value known to be in Firestore per document, as stable JSON.
    // Lets write() skip unchanged slices and subscribe() skip echoes.
    const known = new Map();
    const ref = (uid, name) => fs.doc(db, 'users', uid, 'pack', name);
    const keyOf = (uid, name) => `${uid}/${name}`;

    return {
        backend: 'cloud',

        /**
         * Unlike the local store this throws when it cannot read. Returning the
         * fallback would open an empty pack, and the first save would then
         * overwrite the real synced data with it.
         */
        async read(uid, name, fallback) {
            const snap = await fs.getDoc(ref(uid, name));
            const value = snap.exists() ? snap.data().value : fallback;
            known.set(keyOf(uid, name), stableJson(value));
            return value;
        },

        /**
         * Resolves as soon as the write is in the local Firestore cache. The
         * server round-trip is not awaited: offline it would never settle, and
         * the cache replays queued writes once the connection returns.
         */
        async write(uid, name, value) {
            const key = keyOf(uid, name);
            const json = stableJson(value);
            if (known.get(key) === json) return true;
            known.set(key, json);

            fs.setDoc(ref(uid, name), { value, updatedAt: fs.serverTimestamp() })
                .catch((error) => {
                    known.delete(key);
                    console.warn(`Study pack: could not sync ${name}`, error);
                });
            return true;
        },

        /**
         * Calls onRemote(value) when another device or tab changes a slice.
         * Snapshots of this tab's own writes are skipped.
         * @returns {() => void} unsubscribe
         */
        subscribe(uid, name, onRemote) {
            return fs.onSnapshot(ref(uid, name), (snap) => {
                if (snap.metadata.hasPendingWrites || !snap.exists()) return;
                const value = snap.data().value;
                const json = stableJson(value);
                const key = keyOf(uid, name);
                if (known.get(key) === json) return;
                known.set(key, json);
                onRemote(value);
            }, (error) => console.warn(`Study pack: live sync stopped for ${name}`, error));
        }
    };
}

/** Plain-language messages for the auth errors a visitor can actually hit. */
export function describeAuthError(error) {
    switch (error && error.code) {
        case 'auth/popup-blocked':
            return 'The Google sign-in window was blocked. Allow pop-ups for this site and try again.';
        case 'auth/network-request-failed':
            return 'Could not reach Google. Check the connection and try again.';
        case 'auth/unauthorized-domain':
            return 'This site is not yet an authorized domain in the Firebase project, so sign-in is refused.';
        case 'auth/operation-not-allowed':
            return 'This sign-in method (or texting to this country) is not enabled in the Firebase project yet.';
        case 'auth/billing-not-enabled':
            return 'Phone sign-in is not available yet: the Firebase project needs billing enabled for SMS.';
        case 'auth/invalid-phone-number':
        case 'auth/missing-phone-number':
            return 'That does not look like a full phone number. Start with + and the country code, e.g. +1 410 555 0123.';
        case 'auth/invalid-verification-code':
        case 'auth/missing-verification-code':
            return 'That code is not right. Check the text message and try again.';
        case 'auth/code-expired':
            return 'That code has expired. Go back and send a new one.';
        case 'auth/too-many-requests':
        case 'auth/quota-exceeded':
            return 'Too many attempts for now. Wait a while, then try again.';
        case 'auth/captcha-check-failed':
        case 'auth/invalid-app-credential':
            return 'The automatic robot check failed. Reload the page and try again.';
        default:
            return 'Sign-in did not complete. Try again.';
    }
}

/**
 * Tidy a typed phone number into E.164 (+14105550123), or return null.
 * Spaces, dashes, dots and brackets are dropped and a leading 00 becomes +.
 * Numbers without a country code are refused rather than guessed: assuming
 * +1 would text a stranger when an international student types their number.
 */
export function normalizePhone(input) {
    let number = String(input || '').replace(/[\s().-]/g, '');
    if (number.startsWith('00')) number = `+${number.slice(2)}`;
    return /^\+[1-9]\d{6,14}$/.test(number) ? number : null;
}

/** Auth "errors" that just mean the visitor changed their mind. */
export function isUserCancel(error) {
    return ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']
        .includes(error && error.code);
}

/**
 * Load the Firebase SDK and connect to the configured project.
 * @param {object} config  the object from js/firebase-config.js
 */
export async function connectCloud(config) {
    const [appSdk, authSdk, fs] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`)
    ]);

    const app = appSdk.initializeApp(config);
    const auth = authSdk.getAuth(app);
    const db = fs.initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        // IndexedDB cache: reads work offline and writes queue until the
        // connection returns. Where IndexedDB is unavailable (some private
        // windows) the SDK falls back to an in-memory cache on its own.
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
    });

    /** Phone sign-in's reCAPTCHA, created on first use. */
    let recaptcha = null;

    return {
        store: createCloudStore(db, fs),

        /** @returns {() => void} unsubscribe */
        onUserChange(callback) {
            return authSdk.onAuthStateChanged(auth, callback);
        },

        /**
         * Opens the Google popup. Must be called straight from a click handler,
         * before any other await, or pop-up blockers will stop it.
         * @returns {Promise<object>} the Firebase User (uid, displayName, email)
         */
        async signIn() {
            const provider = new authSdk.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const result = await authSdk.signInWithPopup(auth, provider);
            return result.user;
        },

        /**
         * Text a one-time code to `phoneNumber` (E.164). An invisible reCAPTCHA
         * in `container` runs first; Firebase requires it to stop SMS abuse, and
         * it only shows a challenge when Google is unsure about the visitor.
         * @returns {Promise<{confirm: (code: string) => Promise<object>}>}
         *          confirm() resolves with the signed-in Firebase User
         */
        async sendPhoneCode(phoneNumber, container) {
            if (!recaptcha) {
                recaptcha = new authSdk.RecaptchaVerifier(auth, container, { size: 'invisible' });
            }
            try {
                const confirmation = await authSdk.signInWithPhoneNumber(auth, phoneNumber, recaptcha);
                return { confirm: async (code) => (await confirmation.confirm(code)).user };
            } catch (error) {
                // A used or failed reCAPTCHA cannot be run again; start fresh next time.
                recaptcha.clear();
                recaptcha = null;
                throw error;
            }
        },

        signOut() {
            return authSdk.signOut(auth);
        }
    };
}
