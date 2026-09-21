const SHELLS = [
  new URL('../shell.html', import.meta.url).href,
  'https://cdn.jsdelivr.net/gh/Ayanzadeh93/adhd-study-pack@da8ac723fc0af873711a4998362d4e5cc33b18e8/index.html',
  'https://raw.githubusercontent.com/Ayanzadeh93/adhd-study-pack/da8ac723fc0af873711a4998362d4e5cc33b18e8/index.html'
];
const RAIL = '<button class="rail-btn" type="button" data-view="coach"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16v9H8l-4 3z"/><circle cx="9" cy="10.5" r="1"/><circle cx="12.5" cy="10.5" r="1"/><circle cx="16" cy="10.5" r="1"/></svg><span>Coach</span></button>';
const VIEW = '<section class="view" id="view-coach" aria-labelledby="coachTitle"><div class="view-head"><div class="view-title-row"><h2 id="coachTitle">Study coach</h2></div></div><div class="coach-full"><div class="card coach-shell"><div class="coach-head"><div class="coach-id"><div class="coach-avatar" aria-hidden="true">SC</div><div><h3>Study coach</h3><p class="sub">Wired to this workspace</p></div></div><div class="coach-head-actions"><button type="button" class="btn sm ghost" data-coach-clear>Clear thread</button></div></div><div class="coach-stage"><select data-coach-model aria-label="Model size"></select><button type="button" class="btn sm primary" data-coach-load>Load</button><p class="coach-status" data-coach-status>Ask to list, find, open, add, or start</p><div class="coach-progress" aria-hidden="true"><span data-coach-bar></span></div></div><div class="coach-log" data-coach-log><article class="coach-msg system"><div class="who">Note</div><div class="bubble">Try: brief me, list tasks, open plan, start focus, play rain, add task read chapter.</div></article></div><div class="coach-chips"></div><form class="coach-composer" data-coach-form><label class="sr-only" for="coachViewInput">Message the coach</label><textarea id="coachViewInput" data-coach-input rows="2" placeholder="How many tasks do I have?"></textarea><button class="btn primary" type="submit" data-coach-send>Send</button></form></div></div></section>';
function fail(err) {
  const el = document.getElementById('bootNote') || document.body.appendChild(document.createElement('p'));
  el.id = 'bootNote';
  el.style.cssText = 'max-width:36rem;margin:4rem auto;padding:0 1rem;font:16px/1.5 system-ui,sans-serif;color:#b91c1c';
  el.textContent = 'Could not boot the workspace. Hard-refresh. ' + ((err && err.message) || err || '');
}
function ensureSheet(href) {
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => (l.getAttribute('href') || '').includes(href.split('?')[0].split('/').pop()))) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
async function loadShell() {
  let lastErr;
  for (const url of SHELLS) {
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('shell ' + r.status);
      return await r.text();
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('Could not load workspace shell');
}
try {
  const html = await loadShell();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const cfg = parsed.getElementById('focus-dial-config');
  if (cfg && !document.getElementById('focus-dial-config')) document.head.appendChild(document.importNode(cfg, true));
  for (const node of [...parsed.head.children]) {
    const tag = node.tagName;
    if (tag === 'META' && String(node.httpEquiv || '').toLowerCase() === 'content-security-policy') continue;
    if (tag === 'TITLE') { document.title = node.textContent; continue; }
    if (tag === 'LINK' && /adhd-study-pack\.css/.test(node.getAttribute('href') || '')) continue;
    if (tag === 'SCRIPT' && (node.id === 'focus-dial-config' || node.getAttribute('src'))) continue;
    document.head.appendChild(document.importNode(node, true));
  }
  const incoming = parsed.body.cloneNode(true);
  incoming.querySelectorAll('script').forEach((s) => s.remove());
  document.body.replaceChildren(...incoming.childNodes);
  const calm = document.querySelector('.rail-btn[data-view="calm"]');
  if (calm && !document.querySelector('.rail-btn[data-view="coach"]')) calm.insertAdjacentHTML('afterend', RAIL);
  const help = document.getElementById('view-help');
  if (help && !document.getElementById('view-coach')) help.insertAdjacentHTML('beforebegin', VIEW);
  ensureSheet(new URL('../css/guide-studio.css?v=1', import.meta.url).href);
  await import('./adhd-study-pack.js?v=3.11.0');
  await import('./webllm-coach.js?v=7');
  await import('./coach-extra.js?v=1');
  await import('./coach-hook.js?v=1');
  await import('./guide-studio.js?v=1');
  await import('./calm-radio.js?v=1');
} catch (err) { fail(err); }
