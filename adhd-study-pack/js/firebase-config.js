/**
 * Firebase web config for the ADHD Study Pack (project ADHDRelief / adhdrelief-bdbea).
 *
 * These values are NOT secrets. Every Firebase web app ships them to the
 * browser; what protects the data is `firebase/firestore.rules` (each user can
 * only reach their own documents) plus the API key's HTTP-referrer restriction.
 *
 * Spark-only extras (still free at personal scale):
 *   - App Check site key (reCAPTCHA Enterprise score-based, public)
 *   - Remote Config defaults (flip `feature_phone_signin` in Console to show phone UI)
 *
 * Set `firebaseConfig` to `null` to run with local profiles only — then no
 * Google button is shown and the page loads no third-party Firebase code.
 */

/** @type {null | {apiKey: string, authDomain: string, projectId: string, storageBucket?: string, messagingSenderId?: string, appId: string}} */
export const firebaseConfig = {
  apiKey: 'AIzaSyDT2DP02bxPfIAXmO95D2b2HRiAWr4ggTk',
  authDomain: 'adhdrelief-bdbea.firebaseapp.com',
  projectId: 'adhdrelief-bdbea',
  storageBucket: 'adhdrelief-bdbea.firebasestorage.app',
  messagingSenderId: '17412743359',
  appId: '1:17412743359:web:358e6fcd0ecf6ae8a9260a'
};

/**
 * Public reCAPTCHA Enterprise site key registered for App Check.
 * The matching secret stays only in Firebase / Google Cloud Console.
 * Free tier: 10,000 assessments/month — plenty for personal Study Pack use;
 * do not enable App Check *enforcement* until tokens look healthy in Console.
 */
export const appCheckSiteKey = '6LexecYtAAAAAIQy0kgcg6DTcYRL6ZgTD9ozKdhq';

/** In-app defaults until Remote Config fetch+activate succeeds. */
export const remoteConfigDefaults = Object.freeze({
  feature_phone_signin: false
});
