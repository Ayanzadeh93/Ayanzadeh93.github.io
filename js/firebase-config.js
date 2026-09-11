/**
 * Firebase web config for the ADHD Study Pack's Google sign-in and sync.
 *
 * Paste the object from Firebase Console → Project settings → General →
 * Your apps → Web app → "SDK setup and configuration" → Config.
 *
 * These values are NOT secrets. Every Firebase web app ships them to the
 * browser; what protects the data is `firebase/firestore.rules` (each user can
 * only reach their own documents) plus the API key's HTTP-referrer restriction.
 * See firebase/README.md for the full setup.
 *
 * While this is `null` the Google button stays disabled and the page loads no
 * third-party code at all.
 *
 * @type {null | {apiKey: string, authDomain: string, projectId: string, appId: string}}
 */
export const firebaseConfig = {
    apiKey: 'AIzaSyDT2DP02bxPfIAXmO95D2b2HRiAWr4ggTk',
    authDomain: 'adhdrelief-bdbea.firebaseapp.com',
    projectId: 'adhdrelief-bdbea',
    storageBucket: 'adhdrelief-bdbea.firebasestorage.app',
    messagingSenderId: '17412743359',
    appId: '1:17412743359:web:358e6fcd0ecf6ae8a9260a'
};

/**
 * Show "sign in with your phone" (SMS one-time code) next to Google.
 *
 * Leave false until the Firebase project is on the Blaze plan with the Phone
 * provider and an SMS region policy set up — SMS sign-in is not available on
 * the free Spark plan, and every text is billed. See firebase/README.md.
 */
export const enablePhoneSignIn = false;

// Example of the filled-in shape:
//
// export const firebaseConfig = {
//     apiKey: 'AIza...',
//     authDomain: 'adhd-study-pack.firebaseapp.com',
//     projectId: 'adhd-study-pack',
//     storageBucket: 'adhd-study-pack.firebasestorage.app',
//     messagingSenderId: '1234567890',
//     appId: '1:1234567890:web:abc123'
// };
