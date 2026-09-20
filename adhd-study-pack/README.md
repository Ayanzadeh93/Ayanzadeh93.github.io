# ADHD Study Pack

A no-build, browser-based Pomodoro workspace for an ADHD attention system.
It runs on GitHub Pages. Firebase Authentication and Cloud Firestore are
used only when someone chooses an account. Without an account, workspace
data stays in the browser.

**Live:** [https://www.ayanzadeh.com/adhd-study-pack/](https://www.ayanzadeh.com/adhd-study-pack/)

Version **3.9.0** expands Passport to **fifty** FocusQuest milestones, adds
scene photos and icons across Setup and key views, densifies the layout for
fewer distractions, and upgrades ⌘K search so section names, aliases, and
agent shortcuts (`/ask`, `ai:`, `@coach`) jump you around or talk to the
on-device coach.

**3.8.1** added professional accent colours (Slate, Navy, Teal, Sage,
Graphite) and optional Soft / Rich accent gradients under Setup → Seeing.

**3.7.3** is the prior ADHD product line. **Continue with Google** only
asks for name and email. **Connect Google Calendar** (optional, from Plan) only
asks to *view* events; **Send my blocks** is a later, separate write permission.
Signing in also opens a What’s New card. A public
[Privacy](https://www.ayanzadeh.com/adhd-study-pack/privacy.html) page and
[Terms](https://www.ayanzadeh.com/adhd-study-pack/terms.html) describe
what is stored. Both links sit on the sign-in card so Google can crawl them.

**3.7.2** stopped requesting Calendar at login.

**3.7.1** added the What’s New card after Google, email, or local sign-in, and
a welcome-back if you have not opened the pack for a week.

**3.7.0** folded Passport into this app: a profile card (display name, photo,
bio), achievement badges from real focus sessions (now fifty in 3.9.0), and the existing Google /
email sign-in with forgot-password. Help centre and Habits (Build, Counters,
Break) live here too.

## Development

Plain HTML, CSS, and JavaScript modules. No bundler:

```bash
python3 -m http.server 8000
```

Open the local server in a browser. ES modules do not run from `file://`.

```bash
npm test
```

## Firebase and Google Calendar

The browser configuration in `js/firebase-config.js` contains only Firebase's
public web-app identifiers. It contains no service-account key, private key,
password, or OAuth client secret. Firebase data access is enforced by
`firebase/firestore.rules` and the browser API key must be restricted to the
authorized site origins.

Before using the standalone site with Google sign-in or Calendar sync, add
`ayanzadeh93.github.io` and `www.ayanzadeh.com` to Firebase Authentication's
authorized domains, the Firebase browser-key HTTP-referrer restrictions, and
the Google OAuth client's authorized JavaScript origins.

```bash
firebase deploy --only firestore:rules
```

Never commit a Firebase service-account JSON file, an OAuth client secret, or a
user access token. See [`firebase/README.md`](firebase/README.md) for the full
configuration and verification checklist.

## Repository boundary

The [portfolio](https://github.com/Ayanzadeh93/Ayanzadeh93.github.io) keeps the
project description page and links here. This repository owns the working app,
its tests, its static assets, and the Firestore rules.

The private `profile-passport` repo was a Lovable prototype (FocusQuest +
Supabase). Those features are implemented here against the existing Firebase
workspace, not merged as a second React app.
