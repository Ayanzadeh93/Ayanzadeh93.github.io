/**
 * Firebase web config for the ADHD Study Pack's Google sign-in and sync.
 *
 * From Firebase Console → Project settings → General → Your apps → Web app →
 * "SDK setup and configuration" → Config. Project: ADHDRelief (adhdrelief-bdbea).
 *
 * These values are NOT secrets. Every Firebase web app ships them to the
 * browser; what protects the data is `firebase/firestore.rules` (each user can
 * only reach their own documents) plus the API key's HTTP-referrer restriction.
 * See firebase/README.md for the full setup.
 *
 * Set this to `null` to run the app with local profiles only: then no Google
 * button is shown and the page loads no third-party code at all.
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
