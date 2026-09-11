# Firebase setup for the ADHD Study Pack

"Continue with Google" on `apps/adhd-study-pack.html`, plus optional phone sign-in
with a texted code, signs in with Firebase Authentication and syncs the pack
through Cloud Firestore. The code is already in the repo. It stays switched off
(button disabled, no third-party code loaded) until `js/firebase-config.js` holds
a real config.

For Google sign-in, the free Spark plan is enough: 50k reads, 20k writes and
1 GiB storage per day. Phone sign-in needs the paid Blaze plan (step 8).

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Create a project**.
2. Name it, for example `adhd-study-pack`. Note the **project ID** it shows.
3. **Turn Google Analytics off.** The page's CSP would block it anyway, and the
   privacy note on the page promises no tracking.

## 2. Register the web app and paste the config

1. Project overview → **Add app** → the web icon `</>`.
2. Nickname `ADHD Study Pack`. Leave **Firebase Hosting unchecked**, because the
   site stays on GitHub Pages.
3. Copy the `firebaseConfig` object it shows into `js/firebase-config.js`,
   replacing `null`.

The config is **not secret**. Every Firebase web app ships it to the browser.
The data is protected by the Firestore rules (step 5) and the API-key
restriction (step 6).

## 3. Turn on Google sign-in

Authentication → **Get started** → Sign-in method → **Google** → Enable →
choose the support email → **Save**.

## 4. Authorize the site's domains

Authentication → **Settings** → **Authorized domains** → add both:

- `www.ayanzadeh.com`
- `ayanzadeh.com`

`localhost` is already listed, which covers local testing.

## 5. Create Firestore and lock it down

1. Firestore Database → **Create database** → **Standard** edition.
2. Pick a location close to users (for example `nam5`). **You cannot change it
   later.**
3. Start in **production mode**, which denies everything by default.
4. **Rules** tab → replace the contents with [`firestore.rules`](firestore.rules)
   → **Publish**.

With those rules, a signed-in user can reach only `users/{their uid}/pack/*`.
Nobody can list or read anyone else's pack.

## 6. Restrict the API key (recommended)

In Google Cloud Console → APIs & Services → **Credentials**, open the key named
*Browser key (auto created by Firebase)*. Under **Application restrictions**,
choose **Websites** and add:

```
https://www.ayanzadeh.com/*
https://ayanzadeh.com/*
https://<project-id>.firebaseapp.com/*
http://localhost:*/*
```

The `firebaseapp.com` entry is required. The Google sign-in popup runs on that
domain and uses the same key.

## 7. Make the Google popup look right (optional)

Out of the box, the consent popup says *"Continue to &lt;project-id&gt;.firebaseapp.com"*.
To change that, go to Google Cloud Console → **Google Auth Platform → Branding**
and set the app name to "ADHD Study Pack", the support email, and the home page
`https://www.ayanzadeh.com/apps/adhd-study-pack.html`. The app only asks for the
basic `openid email profile` scopes, so Google does not need to verify it.

## 8. Phone sign-in with a texted code (optional, paid)

The page can also sign people in with a one-time code sent by SMS. It stays
hidden until you set `enablePhoneSignIn = true` in `js/firebase-config.js`.

**Cost.** Phone auth is **not available on the free Spark plan**. The project
must be on **Blaze** (pay as you go), and every text is billed per message.
Rates run from about $0.01 (US/Canada) to much more in some countries; see
[Identity Platform pricing](https://cloud.google.com/identity-platform/pricing).
Google sign-in stays free on either plan.

1. Upgrade the project: Firebase Console → ⚙ → **Usage and billing** → **Blaze**.
   Right away, set a **budget alert** (Google Cloud → Billing → Budgets &
   alerts), for example $5 a month. Bots that trigger texts to premium numbers
   ("SMS pumping") are the main way a phone login runs up a bill.
2. Authentication → Sign-in method → **Phone** → Enable.
3. Authentication → Settings → **SMS region policy** → **Allow** only the
   countries you expect, for example United States. New projects allow **no**
   regions by default, so until you do this every send fails with
   "not enabled … for this country".
4. Authentication → Sign-in method → Phone → **Phone numbers for testing**: add
   a fictional number with a fixed code, for example `+1 650-555-3434` → `123456`.
   Test numbers never send a real text and cost nothing.
5. Set `enablePhoneSignIn = true` and deploy.

Firebase requires a reCAPTCHA check before it sends a code. The page runs it
invisibly, and it only shows a challenge when Google is unsure about the
visitor. Firebase provides the reCAPTCHA keys itself, so there is nothing to
register. The page's CSP already allows `www.google.com` and
`recaptcha.google.com` for it.

**Google and phone are separate accounts.** Someone who signs in both ways gets
two Firebase users and therefore two packs. Linking them (`linkWithPhoneNumber`
/ `linkWithPopup`) could be added later if people ask for it.

**Testing phone sign-in:** Firebase does not allow `localhost` for phone auth,
so test it on the deployed site with the fictional test number from step 4.

## 9. Test locally, then deploy

ES modules do not run from `file://`, so serve the repo from its root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/apps/adhd-study-pack.html> and check these:

- [ ] The Google button is enabled and its note describes syncing.
- [ ] Sign in, add a task, and reload. You stay signed in and the task is still there.
- [ ] Open the page in a second browser or on a phone. The same task appears, and edits show up live in the other one.
- [ ] Sign out. The screen returns to profiles and the header no longer says "synced".
- [ ] DevTools console has no CSP violations.

Then commit and push. GitHub Pages deploys `main` on its own.

## How it is wired

| File | Role |
|---|---|
| `js/firebase-config.js` | The config. `null` means the feature is off. `enablePhoneSignIn` switches the phone form on. |
| `js/lib/cloud-store.js` | Loads Firebase SDK 12.19.0 from gstatic, handles Google popup and phone-code sign-in, and provides the Firestore store. |
| `js/adhd-study-pack.js` | Swaps `store` between the localStorage and Firestore backends. Offers a one-time copy of the local pack on first sign-in and applies live changes from other devices. |
| `apps/adhd-study-pack.html` | The CSP allows gstatic, apis.google.com, the Firestore and Auth APIs, the `*.firebaseapp.com` auth iframe, and reCAPTCHA (`www.google.com`, `recaptcha.google.com`). |
| `firebase/firestore.rules` | Access rules. Keep them in sync with the Console. |

Data layout: `users/{uid}/pack/{tasks|parked|sessions|activeTaskId}` → `{ value, updatedAt }`.

## Known limits

- **Last write wins, per slice.** Live sync keeps open tabs current. If two
  devices edit the task list within the same second, the later save wins.
- **1 MiB per document.** The `sessions` slice grows by about 110 bytes per
  focus block, so the limit is roughly 9,000 blocks away. When that gets close,
  trimming old sessions or giving each session its own document fixes it.
- **Offline cache.** The synced pack is cached in the browser's IndexedDB so it
  works offline. Like local profiles, it stays on that browser after sign-out.
  Treat shared computers accordingly.
- **Popup, not redirect.** Redirect sign-in breaks in browsers that partition
  third-party storage when the site and the `authDomain` differ, as they do on
  GitHub Pages. If the popup is blocked, the page asks the visitor to allow
  pop-ups.
