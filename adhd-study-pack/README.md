# ADHD Study Pack — moved

The app is **not** in this repository any more. It lives in
[Ayanzadeh93/adhd-study-pack](https://github.com/Ayanzadeh93/adhd-study-pack)
and is served from <https://ayanzadeh93.github.io/adhd-study-pack/>.

What is left here is a redirect: `index.html`, plus `privacy.html` and
`terms.html`, which keep resolving because the app's Google OAuth verification
references those URLs.

## Why

This directory used to hold a second, full copy of the app. The two copies
drifted — by September 2026 this one was several releases behind, so
`www.ayanzadeh.com/adhd-study-pack/` was serving an old build while the real
app moved on. One copy, one deployment, no drift.

## If you are looking for the app's source

Clone the other repository. Nothing in this directory is part of the app any
more, and changes made here will not reach anyone.

## Note for anyone following a bookmark

A workspace saved **without an account** is stored per web address, so a local
workspace saved on `www.ayanzadeh.com` does not follow you to the new address.
The redirect page offers to save it as a file first; the app's
**Setup → Account and data → Import a backup** takes it back. Signed-in
accounts are unaffected — that workspace lives in the account.
