/* Feedback — additive module. Opens a small panel that saves a short message
 * to Firestore `feedback/{id}` so the maintainer can read it in the Firebase
 * Console. Reuses the engine's default Firebase app + auth. If anything here
 * fails, the rest of the workspace is untouched.
 */
const FB = '10.12.5';
let db = null, auth = null, ready = null;

async function ensure() {
  if (ready) return ready;
  ready = (async () => {
    const cfg = (await import('./firebase-config.js')).default;
    const { getApps, getApp } = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`);
    const apps = getApps();
    if (!apps.length) return false;
    const app = getApp();
    const { getFirestore } = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`);
    const { getAuth } = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`);
    db = getFirestore(app);
    auth = getAuth(app);
    return true;
  })();
  return ready;
}

const css = `
.fb-fab{display:flex;align-items:center;gap:.4rem;pointer-events:auto;cursor:pointer;
  border:0;border-radius:14px;padding:.5rem .8rem;font:600 13px/1 system-ui,sans-serif;
  color:#e2e8f0;background:rgba(99,102,241,.22);border:1px solid rgba(129,140,248,.45);
  backdrop-filter:blur(6px);transition:transform .15s,background .15s}
.fb-fab:hover{background:rgba(99,102,241,.34);transform:translateY(-1px)}
.fb-fab:active{transform:translateY(0)}
.fb-scrim{position:fixed;inset:0;z-index:60;background:rgba(2,6,23,.6);backdrop-filter:blur(4px);
  display:none;align-items:center;justify-content:center;padding:1rem}
.fb-scrim.open{display:flex;animation:fb-in .2s ease}
.fb-card{width:100%;max-width:26rem;background:#0f172a;border:1px solid rgba(129,140,248,.3);
  border-radius:18px;padding:1.2rem;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:fb-pop .2s ease}
.fb-card h3{margin:0 0 .25rem;font:700 17px/1.2 system-ui,sans-serif;color:#fff}
.fb-card p{margin:0 0 .8rem;font:13px/1.4 system-ui,sans-serif;color:#94a3b8}
.fb-card textarea{width:100%;min-height:7rem;resize:vertical;box-sizing:border-box;
  border-radius:12px;border:1px solid rgba(148,163,184,.3);background:#020617;color:#e2e8f0;
  padding:.7rem;font:14px/1.5 system-ui,sans-serif}
.fb-card textarea:focus{outline:none;border-color:#818cf8}
.fb-row{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.8rem;align-items:center}
.fb-count{font:12px/1 system-ui,sans-serif;color:#64748b;margin-right:auto}
.fb-btn{border:0;border-radius:11px;padding:.55rem .9rem;font:600 13px/1 system-ui,sans-serif;cursor:pointer}
.fb-cancel{background:transparent;color:#94a3b8}
.fb-send{background:#6366f1;color:#fff}
.fb-send:disabled{opacity:.5;cursor:not-allowed}
.fb-ok{text-align:center;padding:1.5rem 0;color:#34d399;font:600 15px/1.4 system-ui,sans-serif}
@keyframes fb-in{from{opacity:0}to{opacity:1}}
@keyframes fb-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fb-scrim.open,.fb-card{animation:none}}
`;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function mount() {
  const style = el('style'); style.textContent = css; document.head.appendChild(style);

  const fab = el('button', 'fb-fab', '💬 Feedback');
  fab.addEventListener('click', open);

  let tries = 0;
  const poll = setInterval(() => {
    const d = document.querySelector('.coach-dock');
    if (d) { d.insertBefore(fab, d.firstChild); clearInterval(poll); }
    else if (++tries > 24) { document.body.appendChild(fab); clearInterval(poll); }
  }, 250);

  const scrim = el('div', 'fb-scrim');
  scrim.innerHTML = `<div class="fb-card" role="dialog" aria-modal="true" aria-label="Send feedback">
    <h3>Send feedback</h3>
    <p>What worked? What didn't? Ideas welcome.</p>
    <textarea id="fbText" maxlength="2000" placeholder="Type a short message…"></textarea>
    <div class="fb-row">
      <span class="fb-count" id="fbCount">0 / 2000</span>
      <button class="fb-btn fb-cancel" id="fbCancel">Cancel</button>
      <button class="fb-btn fb-send" id="fbSend">Send</button>
    </div>
  </div>`;
  document.body.appendChild(scrim);

  const ta = scrim.querySelector('#fbText');
  const count = scrim.querySelector('#fbCount');
  ta.addEventListener('input', () => { count.textContent = `${ta.value.length} / 2000`; });
  scrim.querySelector('#fbCancel').addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  scrim.querySelector('#fbSend').addEventListener('click', submit);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  function thanks(msg) {
    scrim.querySelector('.fb-card').innerHTML =
      `<div class="fb-ok">${msg}</div><div class="fb-row"><button class="fb-btn fb-cancel" id="fbCancel">Close</button></div>`;
    const c = scrim.querySelector('#fbCancel'); if (c) c.addEventListener('click', close);
  }

  function open() {
    scrim.classList.add('open');
    ensure().then(ok => {
      if (!ok || !auth || !auth.currentUser) {
        thanks(ok === false ? 'Could not connect.' : 'Sign in to send feedback.');
        return;
      }
      ta.focus();
    });
  }
  function close() { scrim.classList.remove('open'); }

  async function submit() {
    const text = ta.value.trim();
    if (!text) return;
    const ok = await ensure();
    if (!ok || !auth || !auth.currentUser) { thanks('Sign in to send feedback.'); return; }
    const u = auth.currentUser;
    const name = (u.displayName && u.displayName.slice(0, 40)) || 'Anonymous';
    const btn = scrim.querySelector('#fbSend');
    btn.disabled = true;
    try {
      const { addDoc, collection } = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`);
      await addDoc(collection(db, 'feedback'), { uid: u.uid, name, text, created: Date.now() });
      thanks('Thanks! Your feedback was sent.');
    } catch (err) {
      console.warn('[feedback] send failed', err);
      btn.disabled = false;
      count.textContent = 'Could not send — try again';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
