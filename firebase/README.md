# Firebase setup for the ADHD Study Pack

"Continue with Google" on `apps/adhd-study-pack.html` signs in with Firebase
Authentication and syncs the workspace through Cloud Firestore. People who do not
want an account can use a local profile instead, which never leaves the browser.
If `js/firebase-config.js` is set to `null`, the page runs with local profiles
only and loads no third-party code.

The free Spark plan is enough: 50k reads, 20k writes and 1 GiB storage per day.

**Current setup:** project `adhdrelief-bdbea` (ADHDRelief). Google sign-in is on,
`ayanzadeh.com` and `www.ayanzadeh.com` are authorized, Firestore `(default)` is
in `nam5`, and the browser key is restricted to the sites in step 6. Whenever
`firestore.rules` changes, publish it again (step 5).

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Create a project**.
2. Name it and note the **project ID** it shows.
3. **Turn Google Analytics off.** The page's CSP would block it anyway.

## 2. Register the web app and paste the config

1. Project overview → **Add app** → the web icon `</>`.
2. Nickname `ADHD Study Pack`. Leave **Firebase Hosting unchecked**, because the
   site stays on GitHub Pages.
3. Copy the `firebaseConfig` object it shows into `js/firebase-config.js`.

The config is **not secret**. Every Firebase web app ships it to the browser.
The data is protected by the Firestore rules (step 5) and the API-key
restriction (step 6).

## 3. Turn on Google sign-in

Authentication → **Get started** → Sign-in method → **Google** → Enable →
set the public-facing name ("ADHD Study Pack") and the support email → **Save**.

Email and password sign-in is supported by the app but hidden on this site
(`"emailSignIn": false` in the page's config block). To offer it, enable the
Email/Password provider first, then set that flag to `true`.

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

With those rules, a signed-in user can reach only their own
`users/{uid}/workspace/state`. The first version of the page stored
`users/{uid}/pack/*`; the rules keep that readable by its owner so the app can
offer a one-time import. Nobody can list or read anyone else's data.

## 6. Restrict the API key (recommended)

In Google Cloud Console → APIs & Services → **Credentials**, open the key named
*Browser key (auto created by Firebase)*. Under **Application restrictions**,
choose **Websites** and add:

```
https://www.ayanzadeh.com/*
https://ayanzadeh.com/*
https://<project-id>.firebaseapp.com/*
http://localhost:8000/*
```

The `firebaseapp.com` entry is required. The Google sign-in popup runs on that
domain and uses the same key. Google rejects a wildcard port such as
`localhost:*`, so list the exact port you test on (8000 matches step 9).

## 7. Make the Google popup look right (optional)

The consent popup may say *"Continue to &lt;project-id&gt;.firebaseapp.com"*.
To change that, go to Google Cloud Console → **Google Auth Platform → Branding**
and set the app name, the support email, and the home page
`https://www.ayanzadeh.com/apps/adhd-study-pack.html`. The app only asks for the
basic `openid email profile` scopes, so Google does not need to verify it.

## 8. Google Calendar sync

The planner's **Google Calendar** card syncs both ways, straight from the browser.
Google Identity Services shows a consent popup and returns an access token that
lasts about an hour. The page keeps it in memory and in the tab's
sessionStorage, never on a server.

- **In:** events from the ticked calendars show read-only in the planner, and
  the auto-scheduler treats them as busy.
- **Out:** blocks made in the planner go to the chosen Google calendar. Edits
  and deletions follow them. `S.gcal.links` maps each block to its Google event,
  and each pushed event carries `extendedProperties.private.studyPackId`, so it
  is never shown twice. Blocks imported from `.ics` are never pushed back.

Setup in Google Cloud Console (project `adhdrelief-bdbea`):

1. APIs & Services → Library → **Google Calendar API** → **Enable**.
2. APIs & Services → Credentials → the *Web client (auto created by Google
   Service)* OAuth client → **Authorized JavaScript origins** → add
   `https://ayanzadeh.com`, `https://www.ayanzadeh.com`, `http://localhost:8000`.
3. Put that client's ID in the page's config block as `"googleClientId"`.

Scopes requested: `calendar.events` (see and edit events) and
`calendar.calendarlist.readonly` (list calendars to pick from). Both are
*sensitive*, so until the app passes Google's OAuth verification, Google shows an
"unverified app" screen (**Advanced → continue**), and at most 100 people can
ever grant access. Verification needs a privacy policy page and a short review;
it is only worth doing if other people start using the sync.

The page's CSP allows `accounts.google.com` (script, style, frame, connect) for
this; the Calendar API itself is on `www.googleapis.com`.

## 9. Test locally, then deploy

ES modules do not run from `file://`, so serve the repo from its root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/apps/adhd-study-pack.html> and check these:

- [ ] The sign-in card shows **Continue with Google** and **Use a local profile instead**.
- [ ] Sign in, add a task, and reload. You stay signed in and the task is still there.
- [ ] Open the page in a second browser or on a phone. The same task appears, and edits show up live in the other one.
- [ ] Sign out. The sign-in card comes back.
- [ ] DevTools console has no CSP violations.

Then open a pull request. `main` only accepts changes through one, and GitHub
Pages deploys `main` on its own. When the app changes, bump `VERSION` in
`js/adhd-study-pack.js` and the matching `?v=` on the page's CSS and JS links,
so browsers do not mix a cached old script with the new page.

## How it is wired

| File | Role |
|---|---|
| `js/firebase-config.js` | The Firebase config. `null` runs the app with local profiles only. |
| `apps/adhd-study-pack.html` | Markup, the CSP, and the JSON config block (app name, storage key, which sign-in options appear). |
| `js/adhd-study-pack.js` | The whole app. Its storage adapter writes to localStorage for local profiles and to Firestore for Google users, and it loads Firebase SDK 12.19.0 from gstatic only when configured. |
| `css/adhd-study-pack.css` | Styles, light and dark. |
| `firebase/firestore.rules` | Access rules. Keep them in sync with the Console. |

Data layout: `users/{uid}/workspace/state` → `{ json: <whole workspace>, updated: <ms>, app: <version> }`.

## Known limits

- **Last write wins, per workspace.** Live sync keeps open tabs and devices
  current, and a local edit waiting to save is never overwritten by an incoming
  one. But if two devices edit within the same second, the later save wins.
- **1 MiB per document.** The whole workspace is one document, and the rules cap
  its JSON at a million characters. Sessions are the part that grows (about 250
  bytes each), so the limit is years of daily use away. When it gets close,
  moving sessions into their own collection fixes it.
- **Offline cache.** The synced workspace is cached in the browser's IndexedDB so
  it works offline. Like local profiles, it stays on that browser after sign-out.
  Treat shared computers accordingly.
- **Popup, not redirect.** Redirect sign-in breaks in browsers that partition
  third-party storage when the site and the `authDomain` differ, as they do on
  GitHub Pages. If the popup is blocked, the page asks the visitor to allow
  pop-ups.
- **Google Calendar access lasts about an hour.** After that, changes wait
  until you press **Sync now**, which reopens Google's popup (usually one click)
  and sends everything that changed in the meantime. Pushed blocks are owned by
  the planner: an edit made to one in Google is replaced on the next sync.
