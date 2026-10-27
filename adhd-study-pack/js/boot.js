/* Boot — load the workspace modules in order.
 *
 * This used to fetch the page's own markup from a pinned commit on jsDelivr or
 * raw.githubusercontent, parse it, and replace <body> with it, because index.html
 * had been reduced to a loading stub. That meant the live site rendered whatever
 * HTML was frozen at that commit, every visit cost an extra round-trip before
 * anything appeared, a crawler saw only "Loading…", and two public CDNs sat in
 * the critical path with no local fallback.
 *
 * index.html now carries the real markup, so booting is just imports. Keep the
 * ?v= query strings in step with VERSION in adhd-study-pack.js: GitHub Pages
 * caches for ten minutes and these are what bust it.
 */
const V = '4.46.4';

function fail(err) {
  const el = document.getElementById('bootNote') || document.body.appendChild(document.createElement('p'));
  el.id = 'bootNote';
  el.style.cssText = 'max-width:36rem;margin:4rem auto;padding:0 1rem;font:16px/1.5 system-ui,sans-serif;color:#b91c1c';
  el.textContent = 'Could not start the workspace. Hard-refresh the page. ' + ((err && err.message) || err || '');
}

try {
  /* Passport and profile motion stays scoped to those views, away from the
     sign-in gate, planner, Coach, leaderboard, and other workspace screens. */
  const passportStyle = document.createElement('link');
  passportStyle.rel = 'stylesheet';
  passportStyle.href = `css/passport-modern.css?v=${V}`;
  document.head.appendChild(passportStyle);

  /* The engine first: everything below hooks onto window.FocusDial, which it
     defines. The coach, radio, leaderboard and feedback modules are additive —
     if one fails to load, the workspace itself still runs, so they are imported
     separately. */
  await import(`./adhd-study-pack.js?v=${V}`);
  for (const mod of ['webllm-coach', 'coach-extra', 'coach-hook', 'guide-studio', 'calm-radio', 'study-room', 'public-card', 'voice', 'leaderboard', 'feedback']) {
    try {
      await import(`./${mod}.js?v=${V}`);
    } catch (err) {
      console.warn(`[boot] optional module ${mod} did not load:`, err);
    }
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), {
      scope:new URL('../', import.meta.url).pathname
    }).catch(err => console.info('[offline] app shell is not cached yet:', err && err.message));
  }
} catch (err) {
  fail(err);
}
