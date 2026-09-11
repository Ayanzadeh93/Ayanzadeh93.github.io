/* =====================================================================
   FOCUS DIAL — a Pomodoro workspace built for an ADHD attention system,
   published on this site as the ADHD Study Pack.
   No dependencies, no build step. Every screen renders from one state
   object; nothing is pre-filled and no view hard-codes content. Where that
   state is read and written is the host page's choice (CFG).

   Loaded as an ES module by apps/adhd-study-pack.html (the site's CSP
   allows no inline script). The Firebase project comes from
   js/firebase-config.js; the rest of the host config is the JSON block in
   the page.
   ===================================================================== */
import { firebaseConfig } from './firebase-config.js';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY = 86400000;
const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = d => { const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; };
const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const minsToHM = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `${m}m`;
const parseHM = s => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

/* =====================================================================
   CONFIGURATION
   Everything the host page may want to control lives here, and nothing
   below it is hard-coded to this page. Resolution order: built-in
   defaults, then a <script type="application/json" id="focus-dial-config">
   block, then window.FOCUS_DIAL_CONFIG.
   ===================================================================== */
const VERSION = '3.2.0';
const DEFAULT_CONFIG = {
  storageKey: 'focusdial.v3',
  storage:    'local',            // 'local' | 'session' | 'memory' | 'rest'
  endpoint:   null,               // storage:'rest' — GET returns state, PUT receives it, DELETE clears it
  headers:    {},                 // extra request headers (token, CSRF…)
  autosaveMs: 400,
  startView:  'focus',
  migrateFrom:['focusdial.v2'],   // older keys to adopt once, on first run
  demo:       true,               // false removes the demo-data loader entirely
  appName:    'Focus Dial',       // shown in the tab, the brand mark and the sign-in card
  homeUrl:    null,               // optional "Portfolio" link in the header
  projectsUrl:null,               // optional "All projects" link in the header
  auth:       'auto',             // 'auto' → firebase when configured, else 'local'. Also 'none'.
  firebase:   null,               // the config object from the Firebase console
  emailSignIn:true,               // firebase mode: offer email + password (needs that provider enabled)
  embedDocs:  true,               // show the "embedding this on your own site" card in Setup
  googleClientId: null,           // OAuth web client id: turns on two-way Google Calendar sync
  seedAdmin:  true                // first run on a device with no accounts creates admin / admin
};
function readConfig() {
  const out = Object.assign({}, DEFAULT_CONFIG);
  try { const el = document.getElementById('focus-dial-config');
        if (el && el.textContent.trim()) Object.assign(out, JSON.parse(el.textContent)); } catch (e) {}
  try { if (window.FOCUS_DIAL_CONFIG && typeof window.FOCUS_DIAL_CONFIG === 'object') Object.assign(out, window.FOCUS_DIAL_CONFIG); } catch (e) {}
  if (!out.firebase && firebaseConfig) out.firebase = firebaseConfig;
  if (out.storage === 'rest' && !out.endpoint) out.storage = 'local';
  return out;
}
const CFG = readConfig();

/* ---------- events: the host page can listen without touching internals ---------- */
const HOOKS = {};
function emit(name, detail) {
  try { document.dispatchEvent(new CustomEvent('focusdial:' + name, { detail:detail })); } catch (e) {}
  (HOOKS[name] || []).forEach(fn => { try { fn(detail); } catch (e) {} });
}

/* ---------- editable vocabulary: seeds for the lists, not content ---------- */
const DEFAULT_LISTS = {
  distractions: ['Phone','A thought','Someone talked to me','Hunger / thirst','Tab drift','Boredom','Anxiety spike','Noise'],
  moves: ['20 shoulder rolls, then look out the window at something far away',
          'Stand up and walk to another room and back',
          '10 slow squats — get blood to the head you are about to use',
          'Shake out both hands, roll your neck, drink a full glass of water',
          'Two minutes of pacing while you say the next step out loud'],
  ground: ['things you can see — name them out loud','things you can touch — actually touch them',
           'things you can hear, including the quiet ones','things you can smell','thing you can taste']
};
const LIST = k => (S.lists && Array.isArray(S.lists[k]) && S.lists[k].length) ? S.lists[k] : DEFAULT_LISTS[k];
const clone = v => JSON.parse(JSON.stringify(v));

const DEFAULTS = () => ({
  schema: 3,
  settings: Object.assign({ focus:25, short:5, long:15, cycles:4, autoBreak:true, autoFocus:false, titleClock:true,
              chime:true, chimeVol:70, notify:false, checkinAfter:true, moveBreak:true, hideSeconds:false,
              theme:'auto', accent:'focus', dayStart:'08:00', dayEnd:'21:00' }, CFG.settings || {}),
  lists: Object.assign(clone(DEFAULT_LISTS), CFG.lists || {}),
  tasks: [], events: [], notes: [], sessions: [], checkins: [], subjects: [], links: [],
  sound: { master:60, layers:{}, beat:10, carrier:180 },
  gcal: { on:false, cals:[], hideDeclined:true, push:true, target:'primary', links:{} },
  timer: { phase:'focus', cycle:1, taskId:null, intent:'', activation:null },
  track: null,                     // the running stopwatch: { taskId, eventId, subjectId, title, startedAt }
  meta: { sample:false, created:Date.now(), notice:null }
});

/* =====================================================================
   STORAGE — a four-line adapter interface, so the page that hosts this
   decides where state lives. localStorage is the default, not a premise.
   ===================================================================== */
const MEM = { v:null };
const STORE = {
  mode: CFG.storage, status:'idle', error:null, lastAt:null,
  web() { try { return this.mode === 'session' ? sessionStorage : localStorage; } catch (e) { return null; } },
  /* One workspace per signed-in account: the key carries the account id, so
     two people on one laptop never see each other's tasks. */
  key() { return CFG.storageKey + (AUTH.user && AUTH.user.id ? ':' + AUTH.user.id : ''); },
  async read(key) {
    if (this.mode === 'cloud') return fbRead();
    if (this.mode === 'memory') return MEM.v;
    if (this.mode === 'rest') {
      const r = await fetch(CFG.endpoint, { credentials:'same-origin',
        headers: Object.assign({ Accept:'application/json' }, CFG.headers) });
      if (r.status === 404 || r.status === 204) return null;
      if (!r.ok) throw new Error('GET ' + r.status);
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    }
    const w = this.web(); if (!w) return null;
    const raw = w.getItem(key || this.key());
    return raw ? JSON.parse(raw) : null;
  },
  async write(state) {
    if (this.mode === 'cloud') return fbWrite(state);
    if (this.mode === 'memory') { MEM.v = state; return; }
    if (this.mode === 'rest') {
      const r = await fetch(CFG.endpoint, { method:'PUT', credentials:'same-origin',
        headers: Object.assign({ 'Content-Type':'application/json' }, CFG.headers),
        body: JSON.stringify(state) });
      if (!r.ok) throw new Error('PUT ' + r.status);
      return;
    }
    const w = this.web(); if (!w) throw new Error('storage blocked');
    w.setItem(this.key(), JSON.stringify(state));
  },
  writeSync(state) {                       // page is closing: best effort, never throws
    try {
      if (this.mode === 'memory') { MEM.v = state; return; }
      if (this.mode === 'rest') {
        if (navigator.sendBeacon) navigator.sendBeacon(CFG.endpoint, new Blob([JSON.stringify(state)], { type:'application/json' }));
        return;
      }
      if (this.mode === 'cloud') { fbWrite(state); return; }
      const w = this.web(); if (w) w.setItem(this.key(), JSON.stringify(state));
    } catch (e) {}
  },
  async clear() {
    if (this.mode === 'memory') { MEM.v = null; return; }
    if (this.mode === 'cloud') { try { await fbWrite(DEFAULTS()); } catch (e) {} return; }
    if (this.mode === 'rest') { try { await fetch(CFG.endpoint, { method:'DELETE', credentials:'same-origin', headers:CFG.headers }); } catch (e) {} return; }
    const w = this.web(); if (w) w.removeItem(this.key());
  },
  bytes() { try { const w = this.web(); return w ? (w.getItem(this.key()) || '').length : JSON.stringify(S).length; } catch (e) { return 0; } },
  label() { return this.mode === 'cloud' ? 'Firestore · users/' + (AUTH.user ? AUTH.user.id : '…') + '/workspace/state'
          : this.mode === 'rest' ? 'REST · ' + CFG.endpoint
          : this.mode === 'memory' ? 'in memory only'
          : (this.mode === 'session' ? 'sessionStorage' : 'localStorage') + ' · ' + this.key(); }
};
let S = DEFAULTS();
let saveT = null, saveChain = Promise.resolve();
function setStoreStatus(st, err) {
  STORE.status = st; STORE.error = err || null;
  if (st === 'saved') STORE.lastAt = Date.now();
  renderStoreChip();
}
function save() {
  clearTimeout(saveT);
  if (STORE.blocked) return;           // the workspace never loaded: saving would overwrite it
  if (STORE.status !== 'loading') setStoreStatus('pending');
  gcalQueuePush();                     // planner changes follow to Google Calendar when connected
  saveT = setTimeout(() => {
    saveT = null;
    const snap = clone(S);
    setStoreStatus('saving');
    saveChain = saveChain.then(() => STORE.write(snap)).then(
      () => { setStoreStatus('saved'); emit('change', snap); },
      err => { setStoreStatus('error', err);
        if (!save._warned) { save._warned = true; toast('Could not save — ' + (err && err.message ? err.message : 'storage unavailable')); } });
  }, CFG.autosaveMs);
}
/* Shape whatever came back from storage into the current schema rather than
   trusting it: a hand-edited file or an older key must not break a render. */
function migrate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = DEFAULTS(), out = Object.assign(d, raw);
  ['settings','lists','sound','gcal','timer','meta'].forEach(k => out[k] = Object.assign(DEFAULTS()[k], raw[k] || {}));
  ['tasks','events','notes','sessions','checkins','subjects','links'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.tasks.forEach(t => { if (!('quad' in t)) t.quad = null; if (!t.id) t.id = uid(); });
  out.schema = 3;
  return out;
}
async function load() {
  setStoreStatus('loading');
  try {
    let raw = await STORE.read();
    if (!raw && STORE.mode !== 'rest' && STORE.mode !== 'memory') {
      for (const k of (CFG.migrateFrom || [])) {
        const old = await STORE.read(k);
        if (old) { raw = old; break; }
      }
    }
    if (raw) {
      S = migrate(raw);
      /* A workspace that was only ever demo data is not real history:
         park it under a backup key and start empty, with one undo. */
      if (S.meta.sample) {
        try { const w = STORE.web(); if (w) w.setItem(CFG.storageKey + '.demo-backup', JSON.stringify(raw)); } catch (e) {}
        const keep = { settings:S.settings, lists:S.lists, sound:S.sound, gcal:S.gcal };
        S = Object.assign(DEFAULTS(), keep);
        S.meta.notice = 'demo-cleared';
      }
      setStoreStatus('saved');
      return true;
    }
  } catch (e) {
    setStoreStatus('error', e);
    /* A synced workspace that could not be read must not be replaced by an
       empty one: the caller signs out and asks for a retry instead. */
    if (STORE.mode === 'cloud') throw e;
    toast('Could not read saved data — starting empty');
  }
  setStoreStatus('idle');
  return false;
}

/* =====================================================================
   ACCOUNTS
   Two providers behind one interface.

   local     — a profile in this browser. The password is PBKDF2-hashed
               before it is stored, but understand what this is: a gate on
               the UI of a page whose source anyone can read. It keeps a
               shared laptop honest. It is not server-side security, and on
               a public site it never can be.
   firebase  — real accounts: email + password and Google sign-in, with the
               workspace in Firestore under the signed-in uid, so the rules
               on the server decide who may read it.
   ===================================================================== */
const AUTH = {
  mode: CFG.auth === 'auto' ? (CFG.firebase ? 'firebase' : 'local') : CFG.auth,
  user: null, ready:false, busy:false
};
const ACCT_KEY = CFG.storageKey + '.accounts';
const SESS_KEY = CFG.storageKey + '.session';
const initials = str => String(str || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
function acctAll() { try { return JSON.parse(localStorage.getItem(ACCT_KEY) || '{}'); } catch (e) { return {}; } }
function acctSave(a) { try { localStorage.setItem(ACCT_KEY, JSON.stringify(a)); } catch (e) { toast('This browser is blocking storage — accounts cannot be saved'); } }
function sessionGet() { try { return sessionStorage.getItem(SESS_KEY) || localStorage.getItem(SESS_KEY); } catch (e) { return null; } }
function sessionSet(id, remember) {
  try {
    (remember ? localStorage : sessionStorage).setItem(SESS_KEY, id);
    (remember ? sessionStorage : localStorage).removeItem(SESS_KEY);
  } catch (e) {}
}
function sessionClear() { try { sessionStorage.removeItem(SESS_KEY); localStorage.removeItem(SESS_KEY); } catch (e) {} }
const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
async function hashPw(pw, salt) {
  const enc = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:enc.encode(salt), iterations:150000, hash:'SHA-256' }, key, 256);
    return 'pbkdf2$' + b64(bits);
  } catch (e) {
    /* insecure context (file://, plain http): no WebCrypto. Still salted,
       but weak — the gate stays, the claim of strength does not. */
    let h = 0; const str = salt + '|' + pw;
    for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
    return 'weak$' + (h >>> 0).toString(36);
  }
}
async function localSignIn(name, pw, remember) {
  const id = String(name || '').trim().toLowerCase();
  const a = acctAll()[id];
  if (!a) throw new Error('No profile called “' + esc(name) + '” on this device.');   // shown as HTML in the gate
  const h = await hashPw(pw, a.salt);
  if (h !== a.hash) throw new Error('That password does not match.');
  sessionSet(id, remember);
  return { id:a.id, name:a.name, email:a.email || null, provider:'local', mustChange:!!a.mustChange };
}
async function localSignUp(name, pw, remember) {
  const id = String(name || '').trim().toLowerCase();
  if (!id) throw new Error('Pick a username or email.');
  if (String(pw || '').length < 4) throw new Error('Use at least four characters.');
  const all = acctAll();
  if (all[id]) throw new Error('That profile already exists on this device — sign in instead.');
  const salt = uid() + uid();
  all[id] = { id:'u_' + uid(), name:String(name).trim(), email:/@/.test(name) ? String(name).trim() : null,
              salt, hash: await hashPw(pw, salt), created:Date.now() };
  acctSave(all); sessionSet(id, remember);
  return { id:all[id].id, name:all[id].name, email:all[id].email, provider:'local' };
}
async function localChangePw(pw) {
  const id = sessionGet(); const all = acctAll(); const a = all[id];
  if (!a) throw new Error('Not signed in to a local profile.');
  if (String(pw || '').length < 4) throw new Error('Use at least four characters.');
  a.salt = uid() + uid(); a.hash = await hashPw(pw, a.salt); a.mustChange = false;
  acctSave(all); if (AUTH.user) AUTH.user.mustChange = false;
}
function seedAdmin() {
  if (!CFG.seedAdmin) return;
  const all = acctAll();
  if (Object.keys(all).length) return;
  const salt = uid() + uid();
  hashPw('admin', salt).then(hash => {
    const cur = acctAll();
    if (Object.keys(cur).length) return;
    cur.admin = { id:'u_admin', name:'admin', email:null, salt, hash, created:Date.now(), mustChange:true };
    acctSave(cur);
  });
}

/* ---------- firebase (loaded only when configured) ----------
   The modular SDK from gstatic, pinned so a Firebase release can never
   change the page underneath it; the page's CSP allows www.gstatic.com for
   exactly this. FB.auth wraps it in the few calls the rest of the app makes. */
const FB_SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const FB = { app:null, auth:null, db:null, fs:null, err:null };
async function fbInit() {
  if (FB.auth) return true;
  const [appSdk, authSdk, fs] = await Promise.all([
    import(`${FB_SDK}/firebase-app.js`),
    import(`${FB_SDK}/firebase-auth.js`),
    import(`${FB_SDK}/firebase-firestore.js`)
  ]);
  FB.app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(CFG.firebase);
  FB.fs = fs;
  FB.db = fs.initializeFirestore(FB.app, {
    ignoreUndefinedProperties: true,
    /* IndexedDB cache: the workspace opens offline and writes queue until the
       connection returns. Where IndexedDB is unavailable (some private
       windows) the SDK falls back to memory on its own. */
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
  });
  const auth = authSdk.getAuth(FB.app);
  FB.auth = {
    onAuthStateChanged: cb => authSdk.onAuthStateChanged(auth, cb),
    signOut: () => authSdk.signOut(auth),
    signInWithEmailAndPassword: (u, p) => authSdk.signInWithEmailAndPassword(auth, u, p),
    createUserWithEmailAndPassword: (u, p) => authSdk.createUserWithEmailAndPassword(auth, u, p),
    /* Popup only. A redirect needs the auth domain's storage, which browsers
       partition when the site (GitHub Pages) and the Firebase authDomain
       differ — so a blocked popup gets a message instead of a broken flow. */
    signInWithGoogle() {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt:'select_account' });
      return authSdk.signInWithPopup(auth, provider);
    }
  };
  return true;
}
const fbDoc = (...path) => FB.fs.doc(FB.db, 'users', AUTH.user.id, ...(path.length ? path : ['workspace', 'state']));
/* Last JSON known to be in Firestore: lets writes skip no-op saves and lets
   the live listener ignore this tab's own echo. */
let fbKnown = null, fbUnwatch = null;
/* Throws on failure on purpose. Returning null would open an empty
   workspace, and its first autosave would overwrite the real one. */
async function fbRead() {
  if (!FB.db || !AUTH.user) return null;
  const snap = await FB.fs.getDoc(fbDoc());
  if (!snap.exists()) { fbKnown = null; return null; }
  const d = snap.data();
  fbKnown = d && d.json || null;
  return d && d.json ? JSON.parse(d.json) : (d && d.state) || null;
}
/* Resolves once the write is in the local Firestore cache. The server ack is
   not awaited: offline it would never settle and stall every later save. */
async function fbWrite(state) {
  if (!FB.db || !AUTH.user) throw new Error('not signed in');
  const json = JSON.stringify(state);
  if (json === fbKnown) return;
  fbKnown = json;
  FB.fs.setDoc(fbDoc(), { json, updated: Date.now(), app: VERSION })
    .catch(err => { fbKnown = null; setStoreStatus('error', err); });
}
/* Changes made on another device or tab arrive here while this one is open.
   A local edit still waiting to save wins — it is about to overwrite this. */
function fbWatch() {
  fbUnwatchNow();
  if (!FB.db || !AUTH.user) return;
  fbUnwatch = FB.fs.onSnapshot(fbDoc(), snap => {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return;
    const json = snap.data().json;
    if (!json || json === fbKnown || saveT) return;
    fbKnown = json;
    const next = migrate(JSON.parse(json)); if (!next) return;
    S = next;
    renderAll();
    toast('Updated from another device');
  }, err => console.warn('Study pack: live sync stopped', err));
}
function fbUnwatchNow() { if (fbUnwatch) { fbUnwatch(); fbUnwatch = null; } }
const FB_ERRORS = {
  'auth/invalid-email':'That is not a valid email address.',
  'auth/user-not-found':'No account with that email — create one below.',
  'auth/wrong-password':'That password does not match.',
  'auth/invalid-credential':'That email and password do not match an account.',
  'auth/email-already-in-use':'That email already has an account — sign in instead.',
  'auth/weak-password':'Firebase wants at least six characters.',
  'auth/popup-blocked':'Your browser blocked the Google window. Allow pop-ups for this site, then press the button again.',
  'auth/popup-closed-by-user':'The Google window closed before finishing.',
  'auth/cancelled-popup-request':'The Google window closed before finishing.',
  'auth/network-request-failed':'Could not reach Google. Check the connection and try again.',
  'auth/unauthorized-domain':'Add this domain under Firebase → Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed':'Enable that sign-in method in the Firebase console first.'
};
const fbMsg = e => (e && FB_ERRORS[e.code]) || (e && e.message) || 'Something went wrong.';

/* ---------- toast + tooltip + modal ---------- */
function toast(msg, ms) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms || 2600);
}
const tipEl = () => $('#tip');
document.addEventListener('mouseover', e => {
  const host = e.target.closest && e.target.closest('[data-tip]');
  if (!host) return;
  const t = tipEl(); t.textContent = host.dataset.tip; t.classList.add('on');
  const move = ev => { const r = t.getBoundingClientRect();
    t.style.left = clamp(ev.clientX + 12, 8, innerWidth - r.width - 8) + 'px';
    t.style.top = clamp(ev.clientY - r.height - 10, 8, innerHeight - r.height - 8) + 'px'; };
  move(e); host.addEventListener('mousemove', move);
  host.addEventListener('mouseleave', () => { t.classList.remove('on'); host.removeEventListener('mousemove', move); }, { once:true });
});
let modalDone = null;
function openModal(title, bodyHTML, actions, onMount) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;
  const foot = $('#modalFoot'); foot.innerHTML = '';
  (actions || [{ label:'Close' }]).forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn' + (a.primary ? ' primary' : '') ; b.textContent = a.label;
    b.onclick = () => { if (!a.onClick || a.onClick() !== false) closeModal(); };
    foot.appendChild(b);
  });
  $('#scrim').classList.add('on');
  if (onMount) onMount($('#modalBody'));
  const f = $('#modalBody').querySelector('input,textarea,select'); if (f) setTimeout(() => f.focus(), 40);
}
function closeModal() { $('#scrim').classList.remove('on'); if (modalDone) { modalDone(); modalDone = null; } }
$('#modalX').onclick = closeModal;
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeModal(); });

/* ---------- theme ---------- */
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-accent', S.settings.accent);
  $('#themeLbl').textContent = t === 'auto' ? 'Auto' : (t === 'dark' ? 'Dark' : 'Light');
}
$('#themeBtn').onclick = () => {
  const order = ['auto','light','dark'];
  S.settings.theme = order[(order.indexOf(S.settings.theme) + 1) % 3];
  applyTheme(); save(); renderSettings();
};

/* ---------- router ---------- */
let view = 'focus';
function go(v) {
  view = v;
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
  $$('.rail-btn[data-view]').forEach(b => b.setAttribute('aria-current', String(b.dataset.view === v)));
  $('#miniTimer').hidden = (v === 'focus');
  if (v === 'stats') renderStats();
  if (v === 'plan') renderCalendar();
  if (v === 'notes') renderBoard();
  if (v === 'settings') renderSettings();
  if (v === 'calm') renderCalm();
  if (v === 'sound') renderSound();
  if (v === 'tasks') renderTasks();
  if (v === 'matrix') renderMatrix();
}
$$('.rail-btn[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) go(g.dataset.goto); });

/* =====================================================================
   TIMER — wall-clock anchored so background tab throttling can't drift it
   ===================================================================== */
const PHASES = {
  focus: { label:'Focus',       varName:'--focus', wash:'--focus-wash', mins: () => S.settings.focus },
  short: { label:'Short break', varName:'--rest',  wash:'--rest-wash',  mins: () => S.settings.short },
  long:  { label:'Long break',  varName:'--long',  wash:'--long-wash',  mins: () => S.settings.long }
};
const T = { phase:'focus', running:false, endsAt:0, remain:0, startedAt:null, distractions:[], planned:0 };
const CIRC = 2 * Math.PI * 132;

function phaseMs(p) { return Math.round(PHASES[p].mins() * 60000); }
function setPhase(p, keepRun) {
  T.phase = p; S.timer.phase = p;
  T.planned = PHASES[p].mins();
  T.remain = phaseMs(p);
  T.running = !!keepRun;
  T.endsAt = T.running ? Date.now() + T.remain : 0;
  T.startedAt = T.running ? Date.now() : null;
  T.distractions = [];
  paintPhase(); renderDial(); renderPips();
  emit('phase', { phase:p, running:T.running, minutes:T.planned, cycle:S.timer.cycle });
}
function paintPhase() {
  const p = PHASES[T.phase];
  document.documentElement.style.setProperty('--phase', `var(${p.varName})`);
  document.documentElement.style.setProperty('--phase-wash', `var(${p.wash})`);
  $('#phaseName').textContent = p.label;
  $('#miniPhase').textContent = p.label;
  $('#stage').classList.toggle('paused', !T.running);
  $('#runIcon').innerHTML = T.running ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
  $('#runBtn').setAttribute('aria-label', T.running ? 'Pause' : 'Start');
}
function tickRemain() {
  if (T.running) T.remain = Math.max(0, T.endsAt - Date.now());
  return T.remain;
}
function fmtClock(ms) {
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60), r = s % 60;
  if (S.settings.hideSeconds && T.running) return `${m + (r > 0 ? 1 : 0)} min`;
  return `${pad2(m)}:${pad2(r)}`;
}
function renderDial() {
  const total = phaseMs(T.phase) || 1;
  const frac = clamp(T.remain / total, 0, 1);
  $('#prog').style.strokeDasharray = CIRC;
  $('#prog').style.strokeDashoffset = CIRC * (1 - frac);
  const txt = fmtClock(T.remain);
  $('#clock').textContent = txt;
  $('#miniTime').textContent = txt;
  $('#endsAt').textContent = T.running ? 'ends ' + hhmm(new Date(T.endsAt)) : PHASES[T.phase].mins() + ' minute interval';
  const task = S.tasks.find(t => t.id === S.timer.taskId);
  $('#dialTask').textContent = task ? task.title : 'No task selected — pick one, it doubles the odds you start';
  $('#cycleLbl').textContent = `Cycle ${S.timer.cycle} of ${S.settings.cycles}`;
  if (S.settings.titleClock && T.running) document.title = `${txt} · ${PHASES[T.phase].label}`;
  else if (S.settings.titleClock && S.track) document.title = trackTitle();
  else document.title = CFG.appName;
}
function renderPips() {
  const n = S.settings.cycles, done = (S.timer.cycle - 1) % n;
  $('#pips').innerHTML = Array.from({ length:n }, (_, i) =>
    `<span class="pip ${i < done ? 'done' : ''} ${i === done && T.phase === 'focus' ? 'now' : ''}" data-tip="Focus interval ${i + 1} of ${n} before the long break"></span>`).join('');
}
function renderTicks() {
  let out = '';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, maj = i % 5 === 0;
    const r1 = maj ? 146 : 149, r2 = 153;
    out += `<line class="tick ${maj ? 'maj' : ''}" x1="${(160 + Math.cos(a) * r1).toFixed(1)}" y1="${(160 + Math.sin(a) * r1).toFixed(1)}" x2="${(160 + Math.cos(a) * r2).toFixed(1)}" y2="${(160 + Math.sin(a) * r2).toFixed(1)}" stroke-width="${maj ? 1.8 : 1}"/>`;
  }
  $('#ticks').innerHTML = out;
}
function start() {
  ensureAudio();
  if (!T.running) {
    // One clock at a time, so no minute is counted twice.
    if (T.phase === 'focus' && S.track) stopTracking({ because:'The stopwatch was stopped and logged — the pomodoro takes over' });
    T.running = true;
    T.endsAt = Date.now() + (T.remain || phaseMs(T.phase));
    if (!T.startedAt) T.startedAt = Date.now();
    paintPhase();
    if (T.phase === 'focus') toast(S.timer.intent ? 'Go: ' + S.timer.intent.slice(0, 48) : 'Timer running — one thing only');
  }
}
function pause() { if (T.running) { T.remain = Math.max(0, T.endsAt - Date.now()); T.running = false; paintPhase(); renderDial(); } }
function toggleRun() { T.running ? pause() : start(); }
function resetInterval() { T.remain = phaseMs(T.phase); T.running = false; T.startedAt = null; T.distractions = []; $('#tallyCount').textContent = '0'; paintPhase(); renderDial(); }
function skipPhase() { completePhase(true); }

function completePhase(skipped) {
  const wasFocus = T.phase === 'focus';
  const elapsedMin = Math.round(((T.startedAt ? Date.now() - T.startedAt : 0)) / 60000);
  if (wasFocus && !skipped) {
    logSession(T.planned);
    S.timer.cycle = S.timer.cycle % S.settings.cycles + 1;
  } else if (wasFocus && skipped && elapsedMin >= 5) {
    logSession(elapsedMin, true);
    S.timer.cycle = S.timer.cycle % S.settings.cycles + 1;
  }
  const next = wasFocus ? ((S.timer.cycle === 1) ? 'long' : 'short') : 'focus';
  if (!skipped) chime(wasFocus ? 'up' : 'down');
  notify(wasFocus ? 'Interval done — stand up' : 'Break over — one thing, small start');
  const auto = wasFocus ? S.settings.autoBreak : S.settings.autoFocus;
  setPhase(next, auto && !skipped);
  save(); renderFocusSide(); renderTasks();
  if (wasFocus && !skipped && S.settings.checkinAfter) postSessionCheckin();
  else if (wasFocus && !skipped && S.settings.moveBreak) toast(movementSnack());
}
function logSession(minutes, partial) {
  const end = Date.now(), start = end - minutes * 60000;
  const task = S.tasks.find(t => t.id === S.timer.taskId);
  S.sessions.push({
    id: uid(), start: new Date(start).toISOString(), end: new Date(end).toISOString(),
    minutes, taskId: S.timer.taskId || null, subjectId: task ? task.subjectId : null,
    intent: S.timer.intent || '', activation: S.timer.activation, quality: null,
    distractions: T.distractions.slice(), partial: !!partial
  });
  if (task) { task.done_pomos = (task.done_pomos || 0) + 1; if (task.done_pomos >= task.est && !task.done) toast('Estimate reached on "' + task.title.slice(0, 30) + '"'); }
  T.distractions = []; $('#tallyCount').textContent = '0';
  renderTopStats(); renderQuickStart();
  emit('session', clone(S.sessions[S.sessions.length - 1]));
}
setInterval(() => {
  if (!T.running) return;
  tickRemain(); renderDial();
  if (T.remain <= 0) completePhase(false);
}, 250);

/* =====================================================================
   STOPWATCH — time a task or a calendar block by just starting it.
   The pomodoro only logs an interval that reaches the bell; this counts
   up for as long as the work actually runs and logs it when stopped, as a
   session marked `tracked`, so it lands in minutes today, the streak, the
   charts, time by course and the matrix split like any other session.
   S.track lives in the workspace, so a reload or another device keeps the
   same clock running. Only one thing is ever timed at once, and starting
   the pomodoro stops it (and vice versa) so no minute is counted twice.
   ===================================================================== */
const TRACK_CONFIRM_MIN = 180;          // this long, and the stop asks "really?" — a forgotten stopwatch is common
const trackElapsed = () => S.track ? Math.max(0, Date.now() - S.track.startedAt) : 0;
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(r)}` : `${pad2(m)}:${pad2(r)}`;
}
const trackTitle = () => `⏱ ${fmtElapsed(trackElapsed())} · ${S.track ? S.track.title : ''}`;
const isTracking = (kind, id) => !!S.track && S.track[kind] === id;
/* target: { taskId?, eventId?, subjectId?, title } */
function startTracking(target) {
  if (!target || !target.title) return;
  if (S.track && (S.track.taskId || null) === (target.taskId || null) && (S.track.eventId || null) === (target.eventId || null)) return;
  if (S.track) stopTracking({ quiet:true });
  if (T.running && T.phase === 'focus') { pause(); toast('Pomodoro paused — the stopwatch is timing this now'); }
  S.track = { taskId:target.taskId || null, eventId:target.eventId || null, subjectId:target.subjectId || null,
              title:String(target.title).slice(0, 120), startedAt:Date.now() };
  save(); renderTrackingEverywhere();
  toast('Timing “' + S.track.title.slice(0, 40) + '” — press T or ■ to stop');
}
function stopTracking(opts) {
  const o = opts || {}, tr = S.track; if (!tr) return;
  const mins = Math.round(trackElapsed() / 60000);
  const finish = m => {
    logTracked(tr, m, o);
    S.track = null; save(); renderTrackingEverywhere(); renderTopStats();
    if (view === 'stats') renderStats();
  };
  if (!o.quiet && mins >= TRACK_CONFIRM_MIN) {
    openModal('Log this time?', `
      <p style="font-size:12.5px;color:var(--ink-2);margin:0">The stopwatch on <strong>${esc(tr.title)}</strong> has run for <strong>${minsToHM(mins)}</strong>, since ${hhmm(new Date(tr.startedAt))}${new Date(tr.startedAt).toDateString() !== new Date().toDateString() ? ' on ' + new Date(tr.startedAt).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) : ''}. If it kept going after you stopped, correct it here.</p>
      <div class="field"><label for="trMins">Minutes to log</label><input type="number" id="trMins" min="0" max="1440" value="${mins}"></div>`,
      [{ label:'Keep it running' },
       { label:'Discard', onClick: () => { S.track = null; save(); renderTrackingEverywhere(); toast('Discarded — nothing logged'); } },
       { label:'Log it', primary:true, onClick: () => finish(clamp(Math.round(+$('#trMins').value || 0), 0, 1440)) }]);
    return;
  }
  finish(mins);
}
function logTracked(tr, minutes, o) {
  if (minutes < 1) { if (!o.quiet) toast('Under a minute — not logged'); return; }
  const task = S.tasks.find(t => t.id === tr.taskId), ev = S.events.find(e => e.id === tr.eventId);
  const sess = {
    id:uid(), start:new Date(tr.startedAt).toISOString(), end:new Date(tr.startedAt + minutes * 60000).toISOString(),
    minutes, taskId:tr.taskId || null, eventId:tr.eventId || null, title:tr.title,
    subjectId:tr.subjectId || (task && task.subjectId) || (ev && ev.subjectId) || null,
    intent:'', activation:null, quality:null, distractions:[], partial:false, tracked:true
  };
  S.sessions.push(sess);
  S.sessions.sort((a, b) => new Date(a.start) - new Date(b.start));     // it began earlier than sessions logged since
  if (task) task.tracked_min = (task.tracked_min || 0) + minutes;
  toast(o.because || `Logged ${minsToHM(minutes)} on “${tr.title.slice(0, 32)}”`);
  emit('session', clone(sess));
}
/* T key / command: stop the stopwatch, or start it on the session task. */
function toggleTracking() {
  if (S.track) { stopTracking(); return; }
  const t = S.tasks.find(x => x.id === S.timer.taskId && !x.done);
  if (t) startTracking({ taskId:t.id, subjectId:t.subjectId, title:t.title });
  else toast('Pick a session task first, or press ▶ Time on any task');
}
function renderTracking() {
  const chip = $('#trackChip'); if (!chip) return;
  const tr = S.track;
  chip.hidden = !tr;
  if (tr) {
    chip.innerHTML = `<span class="dot"></span><span class="tt">${esc(tr.title)}</span><span class="num" data-track-clock>${fmtElapsed(trackElapsed())}</span>
      <button class="btn sm ghost" id="trackStopBtn" aria-label="Stop the stopwatch and log the time">■ Stop</button>`;
    chip.dataset.tip = 'Stopwatch running since ' + hhmm(new Date(tr.startedAt)) + ' — stop it to log the time';
    $('#trackStopBtn').onclick = () => stopTracking();
  }
  if (!T.running) document.title = S.settings.titleClock && tr ? trackTitle() : CFG.appName;
}
/* Every ▶ / ■ button reflects which one thing is being timed. */
function renderTrackingEverywhere() {
  renderTracking(); renderTasks();                   // task lists, and through them the focus panels
  if (view === 'plan') renderCalendar();
}
setInterval(() => {
  if (!S.track) return;
  const txt = fmtElapsed(trackElapsed());
  $$('[data-track-clock]').forEach(el => { el.textContent = txt; });
  if (S.settings.titleClock && !T.running) document.title = trackTitle();
}, 1000);

/* ---------- distraction tally + parking ---------- */
$('#tallyBtn').onclick = () => {
  openModal('What pulled you away?', `<div style="display:flex;flex-wrap:wrap;gap:8px" id="dGrid">${
    LIST('distractions').map(d => `<button class="btn sm" data-d="${esc(d)}">${esc(d)}</button>`).join('')}</div>
    <p style="font-size:12px;color:var(--muted);margin:0">Logging it takes two seconds and is not a failure — it is the data that tells you which hour of the day is actually workable.</p>`,
    [{ label:'Cancel' }], body => {
      body.onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return;
        T.distractions.push(b.dataset.d); $('#tallyCount').textContent = T.distractions.length;
        closeModal(); toast('Logged — now back to it'); };
    });
};
$('#parkBtn').onclick = $('#dumpBtn').onclick = () => brainDump();
function brainDump() {
  openModal('Park it', `<div class="field"><label for="dumpTxt">Get it out of your head, keep the session</label>
    <textarea id="dumpTxt" rows="4" placeholder="Email the TA about the deadline extension"></textarea></div>`,
    [{ label:'Cancel' }, { label:'Park it', primary:true, onClick: () => {
      const v = $('#dumpTxt').value.trim(); if (!v) return;
      addNote(v, 'parked'); toast('Parked — it will be there at the break'); renderFocusSide();
    } }]);
}
$('#bodyDoubleBtn').onclick = () => {
  const lines = ['I am working too. Head down.','Still going. What is the next sentence?','No new tabs. Back to the page.','Halfway. Keep the same task.','Nearly there — finish the thought, not the whole thing.','If you drifted: no story about it, just return.'];
  let i = 0;
  openModal('Body double', `<div style="display:grid;place-items:center;gap:14px;padding:8px 0 4px">
      <div style="width:84px;height:84px;border-radius:50%;background:var(--long-wash);display:grid;place-items:center">
        <span class="dot" style="width:14px;height:14px;background:var(--long);animation:breathe 3.4s ease-in-out infinite"></span></div>
      <p id="bdLine" style="font-family:var(--font-display);font-size:17px;text-align:center;margin:0;max-width:34ch">${lines[0]}</p>
      <p style="font-size:12px;color:var(--muted);text-align:center;margin:0;max-width:40ch">A quiet presence that checks in every 45 seconds. Leave it open on a second monitor.</p>
    </div>`, [{ label:'Done' }]);
  const iv = setInterval(() => { i = (i + 1) % lines.length; const n = $('#bdLine'); if (!n) { clearInterval(iv); return; } n.textContent = lines[i]; }, 45000);
  modalDone = () => clearInterval(iv);
};
function movementSnack() { const m = LIST('moves'); return 'Break: ' + m[Math.floor(Math.random() * m.length)]; }

/* =====================================================================
   AUDIO — every layer is synthesised: no files, no network, works offline
   ===================================================================== */
let AC = null, MASTER = null, NOISE = {};
const LIVE = {};            // id -> { gain, stop() }
function ensureAudio() {
  if (!AC) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    AC = new Ctor();
    MASTER = AC.createGain(); MASTER.gain.value = (S.sound.master / 100) * 0.85; MASTER.connect(AC.destination);
    ['white','pink','brown'].forEach(t => NOISE[t] = makeNoise(t));
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function makeNoise(type) {
  const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0, last=0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'white') d[i] = w * 0.6;
    else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else { // pink — Paul Kellet's economy filter
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759; b2=0.96900*b2+w*0.1538520;
      b3=0.86650*b3+w*0.3104856; b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  }
  return buf;
}
function src(type, loop) { const s = AC.createBufferSource(); s.buffer = NOISE[type]; s.loop = loop !== false; s.start(); return s; }
function lfo(freq, min, max, param) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.value = freq; g.gain.value = (max - min) / 2;
  param.value = (max + min) / 2; o.connect(g); g.connect(param); o.start();
  return () => { try { o.stop(); } catch (e) {} };
}
function burst(dest, { dur = 0.06, freq = 1400, q = 1, peak = 0.5, type = 'white' } = {}) {
  const s = src(type, false), f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const t = AC.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.stop(t + dur + 0.05);
}
const LAYERS = [
  { id:'rain',  name:'Rain on glass', hint:'Broadband and unpredictable — the classic default for a reason.',
    build(out) { const s = src('white'), hp = AC.createBiquadFilter(), lp = AC.createBiquadFilter(), sp = src('white'), bp = AC.createBiquadFilter(), spg = AC.createGain();
      hp.type='highpass'; hp.frequency.value=420; lp.type='lowpass'; lp.frequency.value=4200;
      bp.type='bandpass'; bp.frequency.value=1900; bp.Q.value=0.6; spg.gain.value=0.25;
      s.connect(hp); hp.connect(lp); lp.connect(out); sp.connect(bp); bp.connect(spg); spg.connect(out);
      const stopLfo = lfo(0.07, 0.7, 1, spg.gain);
      return () => { s.stop(); sp.stop(); stopLfo(); }; } },
  { id:'ocean', name:'Ocean swell', hint:'Slow 11-second waves. Good when rain feels too busy.',
    build(out) { const s = src('brown'), lp = AC.createBiquadFilter(), g = AC.createGain();
      lp.type='lowpass'; lp.frequency.value=520; s.connect(lp); lp.connect(g); g.connect(out);
      const a = lfo(0.09, 0.25, 1, g.gain), b = lfo(0.09, 320, 900, lp.frequency);
      return () => { s.stop(); a(); b(); }; } },
  { id:'brown', name:'Brown noise', hint:'Deep, bass-weighted hush. The most masking per decibel.',
    build(out) { const s = src('brown'), lp = AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400;
      s.connect(lp); lp.connect(out); return () => s.stop(); } },
  { id:'pink',  name:'Pink noise', hint:'Balanced across octaves — less muffled than brown.',
    build(out) { const s = src('pink'); s.connect(out); return () => s.stop(); } },
  { id:'fire',  name:'Fireplace', hint:'Low hiss plus irregular crackle. Warm without being musical.',
    build(out) { const s = src('pink'), lp = AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=760;
      s.connect(lp); lp.connect(out);
      const iv = setInterval(() => { if (Math.random() < 0.55) burst(out, { dur:0.05, freq:900 + Math.random()*2200, q:2.5, peak:0.12 + Math.random()*0.2 }); }, 140);
      return () => { s.stop(); clearInterval(iv); }; } },
  { id:'cafe',  name:'Café hum', hint:'Muffled room tone and the occasional cup. Company without conversation.',
    build(out) { const s = src('pink'), bp = AC.createBiquadFilter(), g = AC.createGain();
      bp.type='bandpass'; bp.frequency.value=430; bp.Q.value=0.7; s.connect(bp); bp.connect(g); g.connect(out);
      const a = lfo(0.13, 0.5, 1, g.gain);
      const iv = setInterval(() => { if (Math.random() < 0.35) burst(out, { dur:0.28, freq:2400 + Math.random()*1200, q:9, peak:0.09 }); }, 4200);
      return () => { s.stop(); a(); clearInterval(iv); }; } },
  { id:'forest',name:'Forest edge', hint:'Leaf rustle with sparse birds — novelty in small, harmless doses.',
    build(out) { const s = src('pink'), hp = AC.createBiquadFilter(), g = AC.createGain();
      hp.type='highpass'; hp.frequency.value=1900; g.gain.value=0.5; s.connect(hp); hp.connect(g); g.connect(out);
      const a = lfo(0.11, 0.3, 0.85, g.gain);
      const iv = setInterval(() => { if (Math.random() < 0.5) chirp(out); }, 5200);
      return () => { s.stop(); a(); clearInterval(iv); }; } },
  { id:'tick',  name:'Clock tick', hint:'One click a second. Turns invisible time into something you can hear.',
    build(out) { const iv = setInterval(() => burst(out, { dur:0.035, freq:2600, q:6, peak:0.28 }), 1000);
      return () => clearInterval(iv); } },
  { id:'bin',   name:'Binaural tones', hint:'Two carriers a few hertz apart, one per ear. Headphones only.',
    build(out) { const o1 = AC.createOscillator(), o2 = AC.createOscillator(),
        p1 = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain(), p2 = AC.createStereoPanner ? AC.createStereoPanner() : AC.createGain(), g = AC.createGain();
      if (p1.pan) { p1.pan.value = -1; p2.pan.value = 1; }
      o1.type = o2.type = 'sine'; g.gain.value = 0.34;
      const set = () => { const c = S.sound.carrier, b = S.sound.beat; o1.frequency.value = c - b/2; o2.frequency.value = c + b/2; };
      set(); o1.connect(p1); o2.connect(p2); p1.connect(g); p2.connect(g); g.connect(out); o1.start(); o2.start();
      LIVE._binSet = set;
      return () => { o1.stop(); o2.stop(); delete LIVE._binSet; }; } }
];
function chirp(out) {
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(2300, t); o.frequency.exponentialRampToValueAtTime(3400, t + 0.09);
  o.frequency.exponentialRampToValueAtTime(2500, t + 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
}
function layerOn(id, on) {
  if (!ensureAudio()) { toast('This browser blocked audio'); return; }
  const def = LAYERS.find(l => l.id === id); if (!def) return;
  if (on && !LIVE[id]) {
    const g = AC.createGain();
    g.gain.value = ((S.sound.layers[id] != null ? S.sound.layers[id] : 55) / 100) * 0.5;
    g.connect(MASTER);
    LIVE[id] = { gain: g, stop: def.build(g) };
    if (S.sound.layers[id] == null) S.sound.layers[id] = 55;
  } else if (!on && LIVE[id]) { try { LIVE[id].stop(); } catch (e) {} LIVE[id].gain.disconnect(); delete LIVE[id]; }
  save(); renderSound(); renderMiniMix();
}
function layerVol(id, v) {
  S.sound.layers[id] = v;
  if (LIVE[id]) LIVE[id].gain.gain.setTargetAtTime((v / 100) * 0.5, AC.currentTime, 0.05);
  save();
}
function silenceAll() { Object.keys(LIVE).forEach(id => { if (id[0] !== '_') layerOn(id, false); }); }
function chime(dir) {
  if (!S.settings.chime || !ensureAudio()) return;
  const base = dir === 'up' ? 523.25 : 392.00, seq = dir === 'up' ? [1, 1.5, 2] : [1, 0.75];
  seq.forEach((mul, i) => {
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + i * 0.16;
    o.type = 'sine'; o.frequency.value = base * mul;
    const peak = (S.settings.chimeVol / 100) * 0.35;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 1.6);
  });
}
function notify(msg) {
  if (!S.settings.notify) return;
  try { if (window.Notification && Notification.permission === 'granted') new Notification(CFG.appName, { body: msg }); } catch (e) {}
}
const SOUND_PRESETS = Object.assign({
  'Rain café': { rain:60, cafe:35 }, 'Deep brown': { brown:70 }, 'Ocean night': { ocean:65, pink:20 },
  'Library tick': { tick:40, brown:35 }, 'Hearth': { fire:60, forest:25 }
}, CFG.soundPresets || {});

/* =====================================================================
   SOUND VIEW
   ===================================================================== */
function renderSound() {
  $('#mixGrid').innerHTML = LAYERS.map(l => {
    const on = !!LIVE[l.id], v = S.sound.layers[l.id] != null ? S.sound.layers[l.id] : 55;
    return `<div class="layer ${on ? 'on' : ''}" data-layer="${l.id}">
      <div class="lh"><span class="nm">${esc(l.name)}</span><button class="pwr" aria-label="Toggle ${esc(l.name)}" aria-pressed="${on}"></button></div>
      <div class="hint">${esc(l.hint)}</div>
      <input type="range" min="0" max="100" value="${v}" aria-label="${esc(l.name)} volume">
    </div>`;
  }).join('');
  $$('#mixGrid .layer').forEach(box => {
    const id = box.dataset.layer;
    $('.pwr', box).onclick = () => layerOn(id, !LIVE[id]);
    $('input', box).oninput = e => layerVol(id, +e.target.value);
  });
  $('#soundPresets').innerHTML = Object.keys(SOUND_PRESETS).map(p => `<button class="btn sm" data-preset="${esc(p)}">${esc(p)}</button>`).join('');
  $$('#soundPresets [data-preset]').forEach(b => b.onclick = () => {
    silenceAll(); const p = SOUND_PRESETS[b.dataset.preset];
    Object.entries(p).forEach(([id, v]) => { S.sound.layers[id] = v; layerOn(id, true); });
    toast(b.dataset.preset + ' on');
  });
  $('#beatVal').textContent = S.sound.beat; $('#carrierVal').textContent = S.sound.carrier;
  $('#beatFreq').value = S.sound.beat; $('#carrierFreq').value = S.sound.carrier;
  $('#beatBand').textContent = S.sound.beat < 4 ? 'delta' : S.sound.beat < 8 ? 'theta' : S.sound.beat < 13 ? 'alpha' : 'beta';
  renderLinks();
}
$('#beatFreq').oninput = e => { S.sound.beat = +e.target.value; if (LIVE._binSet) LIVE._binSet(); renderSound(); save(); };
$('#carrierFreq').oninput = e => { S.sound.carrier = +e.target.value; if (LIVE._binSet) LIVE._binSet(); renderSound(); save(); };
$('#soundStop').onclick = () => { silenceAll(); toast('Silence'); };
$('#masterVol').oninput = e => {
  S.sound.master = +e.target.value; $('#masterVal').textContent = e.target.value;
  if (MASTER) MASTER.gain.setTargetAtTime((S.sound.master / 100) * 0.85, AC.currentTime, 0.05); save();
};
$('#soundBtn').onclick = () => {
  const any = Object.keys(LIVE).some(k => k[0] !== '_');
  if (any) { silenceAll(); toast('Sound off'); }
  else { const p = SOUND_PRESETS['Rain café']; Object.entries(p).forEach(([id, v]) => { S.sound.layers[id] = v; layerOn(id, true); }); toast('Rain café on'); }
};
function renderMiniMix() {
  $('#miniMix').innerHTML = LAYERS.slice(0, 5).map(l => {
    const on = !!LIVE[l.id];
    return `<button class="btn sm" data-mini="${l.id}" style="justify-content:space-between;${on ? 'border-color:var(--accent);color:var(--ink)' : ''}">
      <span>${esc(l.name)}</span><span class="dot" style="background:${on ? 'var(--accent)' : 'var(--line-2)'}"></span></button>`;
  }).join('');
  $$('#miniMix [data-mini]').forEach(b => b.onclick = () => layerOn(b.dataset.mini, !LIVE[b.dataset.mini]));
  $('#masterVol').value = S.sound.master; $('#masterVal').textContent = S.sound.master;
}
function renderLinks() {
  const box = $('#linkList');
  if (!S.links.length) { box.innerHTML = '<div class="empty">No playlists saved yet.</div>'; return; }
  box.innerHTML = S.links.map(l => `<div style="display:flex;align-items:center;gap:8px">
      <a class="btn sm" style="flex:1;justify-content:flex-start" href="${esc(safeUrl(l.url) || '#')}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>
      <button class="btn sm ghost" data-copy="${esc(l.url)}" data-tip="Copy the link">⧉</button>
      <button class="btn sm ghost" data-dellink="${l.id}" aria-label="Remove">✕</button></div>`).join('');
  $$('#linkList [data-dellink]').forEach(b => b.onclick = () => { S.links = S.links.filter(x => x.id !== b.dataset.dellink); save(); renderLinks(); });
  $$('#linkList [data-copy]').forEach(b => b.onclick = () => copyText(b.dataset.copy, 'Link copied'));
}
$('#addLink').onclick = () => openModal('Add a playlist', `
  <div class="field"><label for="lkName">Name</label><input type="text" id="lkName" placeholder="Deep focus — instrumental"></div>
  <div class="field"><label for="lkUrl">Link</label><input type="url" id="lkUrl" placeholder="https://open.spotify.com/playlist/…"></div>
  <p style="font-size:12px;color:var(--muted);margin:0">Spotify, YouTube, Apple Music, a local radio stream — anything with a URL. It opens in a new tab.</p>`,
  [{ label:'Cancel' }, { label:'Save', primary:true, onClick: () => {
    const n = $('#lkName').value.trim(), u = $('#lkUrl').value.trim();
    if (!n || !u) { toast('Both a name and a link, please'); return false; }
    if (!safeUrl(u)) { toast('Links need to start with https:// or http://'); return false; }
    S.links.push({ id:uid(), name:n, url:u }); save(); renderLinks();
  } }]);
/* Only web links open from a saved playlist — never javascript: or data: URLs. */
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null;
function copyText(txt, msg) {
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast(msg || 'Copied'), () => fallbackCopy(txt, msg));
  else fallbackCopy(txt, msg);
}
function fallbackCopy(txt, msg) {
  const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(msg || 'Copied'); } catch (e) { toast('Copy failed — select it by hand'); }
  ta.remove();
}

/* =====================================================================
   TASKS
   ===================================================================== */
/* ---------------------------------------------------------------------
   EISENHOWER MATRIX
   Two independent axes: does it have a real deadline (urgency), and does
   it change anything that matters (importance). Stored per task as
   `quad` (q1..q4, or null while unsorted) so every other view can read it.
   --------------------------------------------------------------------- */
const QUADS = {
  q1: { n:'Q1', name:'Do first',   axis:'Urgent · Important',     color:'var(--crit)',  act:'Do it today',
        note:'A real deadline with a real consequence. Clear it, then ask what let it get this close.',
        empty:'Nothing on fire. That is the point of the other three boxes.' },
  q2: { n:'Q2', name:'Schedule',   axis:'Important · Not urgent', color:'var(--rest)',  act:'Give it a block',
        note:'The chapter, the rerun, the reading. Nothing forces it today — it decides how the term ends.',
        empty:'Empty here is the warning sign, not a clean desk. What actually matters this month?' },
  q3: { n:'Q3', name:'Trim',       axis:'Urgent · Not important', color:'var(--alert)', act:'Cap it at one pomodoro',
        note:'Loud, low value, usually someone else\u2019s clock. Batch it, template it, or hand it back.',
        empty:'Nothing noisy queued.' },
  q4: { n:'Q4', name:'Drop',       axis:'Neither',                color:'var(--muted)', act:'Delete it',
        note:'Be honest about this box. A week untouched here means delete, not \u201clater\u201d.',
        empty:'Clean. Anything that sits here a week belongs in the bin.' }
};
const QORDER = ['q1','q2','q3','q4'];
const qOf = t => (t && QUADS[t.quad]) ? t.quad : null;
const qRank = t => { const k = qOf(t); return k === 'q1' ? 0 : k === 'q2' ? 1 : k ? (k === 'q3' ? 3 : 4) : 2; };
function setQuad(id, q) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  t.quad = q || null; save(); renderTasks();
}
function quadButtons(id) {
  return `<div class="mx-pick">${QORDER.map(k => `<button class="btn" data-setq="${k}" style="--q:${QUADS[k].color}">
    <strong>${QUADS[k].n} · ${QUADS[k].name}</strong><span>${QUADS[k].axis}</span></button>`).join('')}</div>`;
}
function taskQuadModal(id) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  openModal('Where does this sit?', `
    <p style="font-family:var(--font-display);font-size:16px;margin:0;line-height:1.35">${esc(t.title)}</p>
    <p style="font-size:12px;color:var(--muted);margin:0">Two questions, in this order. Is there a real deadline? Does finishing it change anything you care about?</p>
    ${quadButtons(id)}`,
    [{ label:'Close' },
     { label:'Make it the session task', onClick: () => setActiveTask(id) }],
    body => { $$('[data-setq]', body).forEach(b => b.onclick = () => {
      setQuad(id, b.dataset.setq); closeModal(); toast(QUADS[b.dataset.setq].n + ' — ' + QUADS[b.dataset.setq].act);
    }); });
}
/* One unsorted task at a time: the whole point is that sorting must cost
   less than avoiding it. Skip advances without closing the modal. */
function triage() {
  const queue = S.tasks.filter(t => !t.done && !qOf(t));
  if (!queue.length) { toast('Everything open is already placed'); return; }
  let i = 0;
  const step = () => {
    if (i >= queue.length) { closeModal(); toast('Inbox sorted'); go('matrix'); return; }
    const t = queue[i];
    openModal(`Sort ${i + 1} of ${queue.length}`, `
      <p style="font-family:var(--font-display);font-size:17px;margin:0;line-height:1.35">${esc(t.title)}</p>
      <p style="font-size:12px;color:var(--muted);margin:0">${t.est} pomodoro${t.est > 1 ? 's' : ''} · ${ENERGY_LABEL[t.energy].toLowerCase()}</p>
      ${quadButtons(t.id)}`,
      [{ label:'Stop' }, { label:'Skip this one', onClick: () => { i++; step(); return false; } }],
      body => { $$('[data-setq]', body).forEach(b => b.onclick = () => {
        setQuad(t.id, b.dataset.setq); i++; step(); return false;
      }); });
  };
  step();
}
/* Focus minutes split by the quadrant of the task they were spent on. */
function quadMinutes(days) {
  const since = Date.now() - days * DAY;
  const m = { q1:0, q2:0, q3:0, q4:0, none:0 };
  S.sessions.forEach(x => {
    if (+new Date(x.start) < since) return;
    const t = S.tasks.find(y => y.id === x.taskId);
    m[(t && qOf(t)) || 'none'] += x.minutes;
  });
  return m;
}
function mxChip(t) {
  const sub = S.subjects.find(x => x.id === t.subjectId);
  return `<div class="mx-chip ${S.timer.taskId === t.id ? 'on' : ''}" draggable="true" data-mxtask="${t.id}"
      data-tip="${esc(t.title)} — click to move it, or drag">
    <span class="energy ${t.energy}" style="width:4px;border-radius:2px;align-self:stretch"></span>
    <span class="mx-t">${esc(t.title)}</span>
    ${sub ? `<span class="dot" style="margin-top:5px;background:${sub.color}"></span>` : ''}
    <span class="m">${t.done_pomos || 0}/${t.est}</span></div>`;
}
let mxDrag = null;
function wireMx(root) {
  $$('[data-mxtask]', root).forEach(el => {
    el.addEventListener('dragstart', e => {
      mxDrag = el.dataset.mxtask; el.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', mxDrag); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); mxDrag = null; });
    el.onclick = () => taskQuadModal(el.dataset.mxtask);
  });
  $$('[data-drop]', root).forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('over');
      let id = ''; try { id = e.dataTransfer.getData('text/plain'); } catch (err) {}
      id = id || mxDrag; if (!id) return;
      const q = zone.dataset.drop;
      setQuad(id, q === 'none' ? null : q);
      toast(q === 'none' ? 'Back to unsorted' : QUADS[q].n + ' — ' + QUADS[q].act);
    });
  });
}
function renderMatrix() {
  const root = $('#view-matrix'); if (!root) return;
  const open = S.tasks.filter(t => !t.done);
  QORDER.forEach(k => {
    const cell = $(`.mx-cell[data-quad="${k}"]`, root); if (!cell) return;
    const q = QUADS[k], list = open.filter(t => qOf(t) === k);
    const pom = list.reduce((a, t) => a + Math.max(0, t.est - (t.done_pomos || 0)), 0);
    cell.style.setProperty('--q', q.color);
    cell.innerHTML = `<div class="mx-head"><span class="mx-badge">${q.n}</span><strong>${q.name}</strong>
        <span class="top-sp"></span><span class="m num" style="font-size:10.5px;color:var(--muted)">${list.length} · ${pom} pom</span></div>
      <div class="mx-note">${q.note}</div>
      <div class="mx-list">${list.length ? list.map(mxChip).join('') : `<div class="mx-empty">${q.empty}</div>`}</div>`;
  });
  const un = open.filter(t => !qOf(t));
  $('#mxUnsortedN').textContent = un.length;
  $('#mxTray').innerHTML = `<div class="mx-head"><span class="mx-badge" style="--q:var(--muted)">?</span><strong>Unsorted</strong>
      <span class="top-sp"></span><span class="m num" style="font-size:10.5px;color:var(--muted)">${un.length}</span></div>
    <div class="mx-note">Anything new lands here. Drop it into a box, or run the sorter above.</div>
    <div class="mx-list">${un.length ? un.map(mxChip).join('') : '<div class="mx-empty">Nothing waiting.</div>'}</div>`;
  wireMx(root);

  /* --- balance card: where the focus time actually went --- */
  const m = quadMinutes(30), tot = QORDER.reduce((a, k) => a + m[k], 0) + m.none;
  const share = k => tot ? Math.round(m[k] / tot * 100) : 0;
  const q2s = share('q2'), q13 = share('q1') + share('q3');
  $('#mxBalance').innerHTML = `<div class="panel-head"><h3>Where the time went</h3><span class="eyebrow">30 days</span></div>` + (tot
    ? `<div class="mx-bar">${QORDER.map(k => m[k] ? `<span style="width:${m[k] / tot * 100}%;background:${QUADS[k].color}" data-tip="${QUADS[k].n} · ${minsToHM(m[k])}"></span>` : '').join('')}
         ${m.none ? `<span style="width:${m.none / tot * 100}%;background:var(--surface-3)" data-tip="Unsorted · ${minsToHM(m.none)}"></span>` : ''}</div>
       ${QORDER.map(k => `<div class="mx-legend"><span style="display:flex;align-items:center;gap:7px"><span class="dot" style="background:${QUADS[k].color}"></span>${QUADS[k].n} ${QUADS[k].name}</span>
          <strong class="num">${minsToHM(m[k])} · ${share(k)}%</strong></div>`).join('')}
       ${m.none ? `<div class="mx-legend"><span style="display:flex;align-items:center;gap:7px"><span class="dot" style="background:var(--surface-3)"></span>Unsorted</span><strong class="num">${minsToHM(m.none)} · ${share('none')}%</strong></div>` : ''}
       <div class="mx-nudge" style="--q:${q2s >= 30 ? 'var(--good)' : 'var(--warn)'}">${
         q2s >= 30 ? `<strong>${q2s}% of your focus time went to Q2.</strong> That is the number that compounds — hold it there.`
                   : `<strong>Only ${q2s}% went to Q2</strong>, against ${q13}% spent on things that were merely urgent. A third in Q2 is the target; below twenty percent means the week is running you.`}</div>`
    : '<div class="empty">Run a few sessions on placed tasks and the split shows up here.</div>');

  /* --- guide card --- */
  $('#mxGuide').innerHTML = `<div class="panel-head"><h3>How to place a task</h3></div>
    <p style="font-size:12px;color:var(--ink-2);line-height:1.6;margin:0 0 10px"><strong>Urgent</strong> is a clock: someone or something is waiting today or tomorrow. <strong>Important</strong> is a consequence: finishing it changes the thesis, the grade, the health, the relationship. They feel identical when you are behind — they are not.</p>
    ${QORDER.map(k => `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)">
        <span class="mx-badge" style="--q:${QUADS[k].color};margin-top:1px">${QUADS[k].n}</span>
        <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600">${QUADS[k].act}</div>
        <div style="font-size:11.5px;color:var(--muted);line-height:1.4">${QUADS[k].axis}</div></div></div>`).join('')}
    <p style="font-size:12px;color:var(--ink-2);line-height:1.6;margin:11px 0 0">Urgency is loud and importance is quiet, so a brain that responds to loud will spend the whole week in Q1 and Q3 and call it a productive week. Placing a task takes two taps; the matrix is there so the choice is made once, in advance, rather than forty times a day under pressure.</p>
    <p style="font-size:12px;color:var(--muted);line-height:1.6;margin:8px 0 0">One protected Q2 block a day is the entire intervention. The rest is bookkeeping.</p>`;
}
/* --- the auxiliary reminder that rides along in the focus view --- */
function renderFocusMatrix() {
  const box = $('#focusMatrix'); if (!box) return;
  const open = S.tasks.filter(t => !t.done);
  const count = {}; QORDER.forEach(k => count[k] = open.filter(t => qOf(t) === k).length);
  const un = open.filter(t => !qOf(t));
  const t = S.tasks.find(x => x.id === S.timer.taskId), k = qOf(t);
  const week = quadMinutes(7);
  let nudge, colour = k ? QUADS[k].color : 'var(--muted)', action = '';
  if (!t) {
    nudge = 'No session task yet. A Q2 task in a 25-minute block is worth more than three Q3 ones.';
    const c = open.filter(x => qOf(x) === 'q2')[0];
    if (c) action = `<button class="btn sm" style="margin-top:8px" data-mxswap="${c.id}">Take the top Q2 task</button>`;
  } else if (!k) {
    nudge = 'This one has never been placed. Two taps now and the matrix can defend the rest of your week.';
    action = `<button class="btn sm" style="margin-top:8px" data-mxsort="${t.id}">Place it</button>`;
  } else if (k === 'q1') {
    nudge = 'Fire duty — fair enough, it is real. Afterwards, note what made it urgent: most Q1 items were Q2 items a fortnight ago.';
  } else if (k === 'q2') {
    nudge = 'This is the block that pays. Nothing about it will feel urgent, which is exactly why it needs the timer.';
  } else if (k === 'q3') {
    nudge = 'Urgent but not important. Cap it at this one interval — do not let it eat the good hours of the day.';
    const c = open.filter(x => qOf(x) === 'q2')[0];
    if (c) action = `<button class="btn sm" style="margin-top:8px" data-mxswap="${c.id}">Swap to a Q2 task</button>`;
  } else {
    nudge = 'Q4. If it is genuinely worth 25 minutes it belongs in another box; if it is not, delete it and take the time back.';
    const c = open.filter(x => qOf(x) === 'q2')[0];
    if (c) action = `<button class="btn sm" style="margin-top:8px" data-mxswap="${c.id}">Swap to a Q2 task</button>`;
  }
  if (count.q2 && !week.q2 && k !== 'q2') nudge += ' Nothing from Q2 has had a single interval in seven days.';
  box.innerHTML = `<div class="panel-head"><h3>Priority check</h3><button class="btn sm ghost" data-goto="matrix">Matrix</button></div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span class="mx-badge" style="--q:${colour}">${k ? QUADS[k].n : '?'}</span>
      <strong style="font-size:12.5px">${k ? QUADS[k].name : (t ? 'Unsorted' : 'No task selected')}</strong>
      <span class="m" style="font-family:var(--font-mono);font-size:10.5px;color:var(--muted)">${k ? QUADS[k].axis : ''}</span>
    </div>
    <div class="mini2">${QORDER.map(q => `<button class="mini-q" style="--q:${QUADS[q].color}" data-goto="matrix" data-tip="${QUADS[q].name} — ${QUADS[q].axis}">
        <span class="n">${count[q]}</span><span class="l">${QUADS[q].n} ${QUADS[q].name}</span></button>`).join('')}</div>
    ${un.length ? `<button class="btn sm" style="width:100%;justify-content:center;margin-top:8px" id="mxSortAll">${un.length} unsorted — sort them</button>` : ''}
    <div class="mx-nudge" style="--q:${colour}">${nudge}</div>${action}`;
  const sa = $('#mxSortAll'); if (sa) sa.onclick = triage;
  $$('#focusMatrix [data-mxswap]').forEach(b => b.onclick = () => setActiveTask(b.dataset.mxswap));
  $$('#focusMatrix [data-mxsort]').forEach(b => b.onclick = () => taskQuadModal(b.dataset.mxsort));
}
$('#mxTriage').onclick = triage;
$('#triageBtn').onclick = triage;

const ENERGY_LABEL = { low:'Low activation', med:'Medium', high:'High activation' };
function taskRow(t, opts) {
  const o = opts || {};
  const sub = S.subjects.find(s => s.id === t.subjectId);
  const timing = isTracking('taskId', t.id);
  return `<div class="task ${t.done ? 'done' : ''} ${S.timer.taskId === t.id ? 'active' : ''} ${timing ? 'tracking' : ''}" data-task="${t.id}">
    <div class="energy ${t.energy}" data-tip="${ENERGY_LABEL[t.energy]} — how hard it is to start"></div>
    <button class="box" data-done="${t.id}" aria-label="Mark done"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></button>
    <div class="t-body">
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-meta">
        ${sub ? `<span class="m" style="color:${sub.color}">${esc(sub.name)}</span>` : ''}
        ${qOf(t) ? `<span class="qtag" style="color:${QUADS[qOf(t)].color}" data-tip="${QUADS[qOf(t)].n} · ${QUADS[qOf(t)].name} — ${QUADS[qOf(t)].axis}">${QUADS[qOf(t)].n}</span>`
                 : `<span class="qtag" style="color:var(--muted)" data-tip="Not placed on the matrix yet">?</span>`}
        <span class="m">${t.done_pomos || 0}/${t.est} pomos</span>
        ${t.tracked_min ? `<span class="m" data-tip="Time logged on this task with the stopwatch">⏱ ${minsToHM(t.tracked_min)}</span>` : ''}
        ${t.due ? `<span class="m">due ${esc(t.due)}</span>` : ''}
      </div>
    </div>
    <div class="t-actions">
      ${timing ? `<button class="btn sm primary" data-trackstop data-tip="Stop and log the time">■ <span class="num" data-track-clock>${fmtElapsed(trackElapsed())}</span></button>`
        : t.done || o.noFocus ? '' : `<button class="btn sm ghost" data-track="${t.id}" data-tip="Start a stopwatch on this task — the time counts as study time">▶ Time</button>`}
      ${o.noFocus ? '' : `<button class="btn sm ghost" data-focus="${t.id}" data-tip="Make this the session task">Focus</button>`}
      <button class="btn sm ghost" data-deltask="${t.id}" aria-label="Delete">✕</button>
    </div></div>`;
}
function wireTasks(root) {
  $$('[data-done]', root).forEach(b => b.onclick = () => {
    const t = S.tasks.find(x => x.id === b.dataset.done); t.done = !t.done;
    if (t.done && isTracking('taskId', t.id)) stopTracking();          // finishing it is when you would forget the clock
    save(); renderTasks(); renderFocusSide();
  });
  $$('[data-focus]', root).forEach(b => b.onclick = () => setActiveTask(b.dataset.focus));
  $$('[data-track]', root).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const t = S.tasks.find(x => x.id === b.dataset.track);
    if (t) startTracking({ taskId:t.id, subjectId:t.subjectId, title:t.title });
  });
  $$('[data-trackstop]', root).forEach(b => b.onclick = e => { e.stopPropagation(); stopTracking(); });
  $$('.qtag[data-tip]', root).forEach(el => { const row = el.closest('[data-task]'); if (row) el.onclick = () => taskQuadModal(row.dataset.task); el.style.cursor = 'pointer'; });
  $$('[data-deltask]', root).forEach(b => b.onclick = () => { S.tasks = S.tasks.filter(x => x.id !== b.dataset.deltask); if (S.timer.taskId === b.dataset.deltask) S.timer.taskId = null; save(); renderTasks(); renderFocusSide(); });
}
function setActiveTask(id) {
  S.timer.taskId = id; save(); renderFocusSide(); renderDial(); renderTasks();
  const t = S.tasks.find(x => x.id === id); if (t) toast('Session task: ' + t.title.slice(0, 40));
  if (view !== 'focus') go('focus');
}
function renderTasks() {
  const open = S.tasks.filter(t => !t.done), done = S.tasks.filter(t => t.done);
  const list = $('#taskList');
  if (list) {
    list.innerHTML = (open.length ? open.map(t => taskRow(t)).join('') : '<div class="empty">Nothing queued. Add the smallest next action, not the project.</div>')
      + (done.length ? `<div class="eyebrow" style="margin:14px 0 6px">Finished — ${done.length}</div>` + done.map(t => taskRow(t)).join('') : '');
    wireTasks(list);
    const dread = open.filter(t => t.energy === 'high').slice(0, 4);
    $('#dreadList').innerHTML = dread.length ? dread.map(t => taskRow(t, { noFocus:false })).join('') : '<div class="empty">No dreaded tasks flagged. Suspicious.</div>';
    wireTasks($('#dreadList'));
    const totalPomos = open.reduce((a, t) => a + Math.max(0, t.est - (t.done_pomos || 0)), 0);
    const hrs = (totalPomos * S.settings.focus / 60);
    const perWeek = weekCapacityHours();
    $('#loadCheck').innerHTML = `
      <div style="display:flex;justify-content:space-between"><span>Open tasks</span><strong class="num">${open.length}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Pomodoros left</span><strong class="num">${totalPomos}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>That is</span><strong class="num">${hrs.toFixed(1)} h</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Free this week</span><strong class="num">${perWeek.toFixed(1)} h</strong></div>
      <p style="font-size:12px;color:${hrs > perWeek ? 'var(--warn)' : 'var(--muted)'};margin:6px 0 0">${
        hrs > perWeek ? 'Over capacity by ' + (hrs - perWeek).toFixed(1) + ' h. Cut something now rather than discovering it on Sunday night.' : 'Fits inside the free hours in your week window.'}</p>`;
  }
  renderMatrix();
  const sel = $('#taskSubject');
  if (sel) sel.innerHTML = '<option value="">No course</option>' + S.subjects.map(s => `<option value="${s.id}" ${s.id === (sel.value || '') ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  renderFocusSide();
}
$('#taskForm').onsubmit = e => {
  e.preventDefault();
  const title = $('#taskTitle').value.trim(); if (!title) return;
  S.tasks.unshift({ id:uid(), title, est:+$('#taskEst').value || 1, energy:$('#taskEnergy').value,
                    subjectId:$('#taskSubject').value || null, quad:$('#taskQuad').value || null,
                    done:false, done_pomos:0, created:Date.now() });
  $('#taskTitle').value = ''; save(); renderTasks(); toast('Added');
};
$('#clearDone').onclick = () => { const n = S.tasks.filter(t => t.done).length; S.tasks = S.tasks.filter(t => !t.done); save(); renderTasks(); toast(n + ' cleared'); };
$('#pasteTasks').onclick = () => openModal('Paste a list', `
  <div class="field"><label for="pasteBox">One task per line. Bullets, numbers and checkboxes are stripped.</label>
  <textarea id="pasteBox" rows="8" placeholder="- Read Ch. 4&#10;- 5 recall questions&#10;- Fix the eval script"></textarea></div>
  <p style="font-size:12px;color:var(--muted);margin:0">Everything lands as 2 pomodoros, medium activation. Adjust after — or don't.</p>`,
  [{ label:'Cancel' }, { label:'Add them', primary:true, onClick: () => {
    const lines = $('#pasteBox').value.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]\])\s*/, '').trim()).filter(Boolean);
    lines.reverse().forEach(t => S.tasks.unshift({ id:uid(), title:t, est:2, energy:'med', subjectId:null, quad:null, done:false, done_pomos:0, created:Date.now() }));
    save(); renderTasks(); toast(lines.length + ' tasks added — unsorted on the matrix');
  } }]);

/* =====================================================================
   FOCUS SIDE PANELS
   ===================================================================== */
function renderFocusSide() {
  const t = S.tasks.find(x => x.id === S.timer.taskId);
  $('#activeTaskBox').innerHTML = t
    ? `<div class="t-title" style="font-size:14px;margin-bottom:6px">${esc(t.title)}</div>
       <div class="t-meta"><span class="m">${t.done_pomos || 0}/${t.est} pomos</span><span class="m">${ENERGY_LABEL[t.energy]}</span></div>
       <div style="height:6px;border-radius:99px;background:var(--surface-3);margin-top:9px;overflow:hidden">
         <div style="height:100%;width:${clamp((t.done_pomos || 0) / t.est * 100, 0, 100)}%;background:var(--accent);border-radius:99px"></div></div>
       ${isTracking('taskId', t.id)
         ? `<button class="btn sm primary" data-trackstop style="width:100%;justify-content:center;margin-top:10px">■ Stop stopwatch · <span class="num" data-track-clock>${fmtElapsed(trackElapsed())}</span></button>`
         : `<button class="btn sm" data-track="${t.id}" style="width:100%;justify-content:center;margin-top:10px" data-tip="Count up instead of down: no interval, just the time you actually put in">▶ Time it with a stopwatch instead</button>`}`
    : `<div class="empty">Nothing selected. A named task beats "study" — pick one below.</div>`;
  wireTasks($('#activeTaskBox'));
  const queue = S.tasks.filter(x => !x.done && x.id !== S.timer.taskId)
    .sort((a, b) => qRank(a) - qRank(b)).slice(0, 4);   // Q1 then Q2 float to the top of the queue
  $('#focusQueue').innerHTML = queue.length ? queue.map(x => taskRow(x)).join('') : '<div class="empty">Queue is empty.</div>';
  wireTasks($('#focusQueue'));
  $('#queueCount').textContent = S.tasks.filter(x => !x.done).length + ' open';

  const now = new Date(), k = dayKey(now);
  const today = dayEvents(k);
  $('#todayBlocks').innerHTML = today.length ? today.map(e => {
    const s = new Date(e.start), en = new Date(e.end), live = now >= s && now <= en;
    const hue = e.source === 'google' ? (e.free ? 'muted' : 'ink-2') : (e.kind === 'class' ? 'long' : e.kind === 'break' ? 'rest' : 'focus');
    const timing = isTracking('eventId', e.id);
    return `<div style="display:flex;gap:9px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)">
      <span class="dot" style="margin-top:6px;background:var(--${hue})"></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:${live ? 700 : 500}">${esc(e.title)}${live ? ' <span class="eyebrow" style="color:var(--focus)">now</span>' : ''}</div>
        <div class="m num" style="font-size:10.5px;color:var(--muted)">${e.allDay ? 'all day' : hhmm(s) + '–' + hhmm(en)}${e.source === 'google' ? ' · google' : ''}</div>
      </div>
      ${timing ? `<button class="btn sm primary" data-trackstop data-tip="Stop and log the time">■ <span class="num" data-track-clock>${fmtElapsed(trackElapsed())}</span></button>`
               : `<button class="btn sm ghost" data-trackev="${esc(e.id)}" data-tip="Start timing this block">▶</button>`}</div>`;
  }).join('') : '<div class="empty">Nothing scheduled today. The plan view can fill it in.</div>';
  $$('#todayBlocks [data-trackev]').forEach(b => b.onclick = () => {
    const e = today.find(x => x.id === b.dataset.trackev);
    if (e) startTracking({ eventId:e.id, subjectId:e.subjectId || null, title:e.title });
  });
  wireTasks($('#todayBlocks'));                        // the ■ stop buttons

  const parked = S.notes.filter(n => n.tag === 'parked').slice(-5).reverse();
  $('#parkedCount').textContent = parked.length ? parked.length + ' waiting' : '';
  $('#parkedList').innerHTML = parked.length ? parked.map(n => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)">
      <div style="flex:1;font-size:12.5px;line-height:1.4">${esc(n.text)}</div>
      <button class="btn sm ghost" data-topark="${n.id}" data-tip="Turn it into a task">→</button>
      <button class="btn sm ghost" data-delpark="${n.id}" data-tip="Let it go">✕</button></div>`).join('')
    : '<div class="empty">Nothing parked.</div>';
  $$('#parkedList [data-delpark]').forEach(b => b.onclick = () => { S.notes = S.notes.filter(n => n.id !== b.dataset.delpark); save(); renderFocusSide(); renderBoard(); });
  $$('#parkedList [data-topark]').forEach(b => b.onclick = () => {
    const n = S.notes.find(x => x.id === b.dataset.topark); if (!n) return;
    S.tasks.unshift({ id:uid(), title:n.text, est:1, energy:'med', subjectId:null, quad:null, done:false, done_pomos:0, created:Date.now() });
    S.notes = S.notes.filter(x => x.id !== n.id); save(); renderFocusSide(); renderTasks(); renderBoard(); toast('Now a task');
  });
  $('#intentInput').value = S.timer.intent || '';
  $('#activationRow').innerHTML = ['low','med','high'].map(k2 =>
    `<button class="scale-btn ${S.timer.activation === k2 ? 'on' : ''}" data-act="${k2}" data-tip="How hard was it to start this session?">${k2 === 'low' ? 'Easy' : k2 === 'med' ? 'Middling' : 'Uphill'}</button>`).join('');
  $$('#activationRow [data-act]').forEach(b => b.onclick = () => { S.timer.activation = b.dataset.act; save(); renderFocusSide(); });
  renderFocusMatrix(); renderMiniMix(); renderTopStats(); renderQuickStart();
}
$('#intentInput').oninput = e => { S.timer.intent = e.target.value; save(); };
$('#pickTask').onclick = () => {
  const open = S.tasks.filter(t => !t.done).sort((a, b) => qRank(a) - qRank(b));
  openModal('Pick the session task', open.length
    ? `<div class="stack" id="pickList">${open.map(t => taskRow(t, { noFocus:true })).join('')}</div>`
    : '<div class="empty">No open tasks — add one in the Tasks view.</div>',
    [{ label:'Close' }], body => {
      $$('.task', body).forEach(row => row.onclick = () => { setActiveTask(row.dataset.task); closeModal(); });
    });
};
function renderTopStats() {
  const k = dayKey(new Date());
  const mins = S.sessions.filter(s => dayKey(new Date(s.start)) === k).reduce((a, s) => a + s.minutes, 0);
  $('#todayMin').textContent = mins;
  $('#streakVal').textContent = streakDays();
  $('#todayLbl').textContent = new Date().toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' });
}
function streakDays() {
  const days = new Set(S.sessions.map(s => dayKey(new Date(s.start))));
  let n = 0, d = startOfDay(new Date());
  if (!days.has(dayKey(d))) d = new Date(d - DAY);      // today not started yet: yesterday still counts
  while (days.has(dayKey(d))) { n++; d = new Date(d - DAY); }
  return n;
}

/* =====================================================================
   NOTES — a sticky wall you can actually throw things at
   ===================================================================== */
const NOTE_COLORS = ['#F6E27F','#F8C6A4','#CFE7A9','#A9D9EC','#E6C8F2','#F5B7B1'];
function addNote(text, tag) {
  const n = S.notes.length;
  S.notes.push({ id:uid(), text:text || '', tag:tag || 'note', color:NOTE_COLORS[n % NOTE_COLORS.length],
                 x:24 + (n % 5) * 214, y:24 + Math.floor(n / 5) * 150, pinned:false, at:Date.now() });
  save(); renderBoard(); return S.notes[S.notes.length - 1];
}
function renderBoard() {
  const q = ($('#noteSearch').value || '').toLowerCase();
  const board = $('#board');
  board.innerHTML = S.notes.map(n => {
    const hidden = q && !n.text.toLowerCase().includes(q);
    return `<div class="sticky ${n.pinned ? 'pinned' : ''}" data-note="${n.id}" style="left:${n.x}px;top:${n.y}px;background:${n.color};opacity:${hidden ? .25 : 1}">
      <textarea placeholder="Type…">${esc(n.text)}</textarea>
      <div class="s-foot">
        <span class="s-tag">${n.tag === 'parked' ? 'parked mid-session' : new Date(n.at).toLocaleDateString(undefined, { month:'short', day:'numeric' })}</span>
        <span style="display:flex;gap:2px">
          <button class="s-btn" data-color data-tip="Change colour"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></button>
          <button class="s-btn" data-pin data-tip="Pin to the top"><svg viewBox="0 0 24 24"><path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3z"/></svg></button>
          <button class="s-btn" data-del data-tip="Delete"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
        </span></div></div>`;
  }).join('') || '<div class="empty" style="margin:24px">Nothing on the wall yet. The brain-dump button in the header throws things here.</div>';
  $$('#board .sticky').forEach(el => {
    const n = S.notes.find(x => x.id === el.dataset.note);
    $('textarea', el).oninput = e => { n.text = e.target.value; save(); };
    $('[data-del]', el).onclick = () => { S.notes = S.notes.filter(x => x.id !== n.id); save(); renderBoard(); renderFocusSide(); };
    $('[data-pin]', el).onclick = () => { n.pinned = !n.pinned; save(); renderBoard(); };
    $('[data-color]', el).onclick = () => { n.color = NOTE_COLORS[(NOTE_COLORS.indexOf(n.color) + 1) % NOTE_COLORS.length]; save(); renderBoard(); };
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('textarea,button')) return;
      const r = el.getBoundingClientRect(), br = board.getBoundingClientRect();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      el.setPointerCapture(e.pointerId); el.classList.add('drag');
      const move = ev => {
        n.x = clamp(ev.clientX - br.left - ox + board.scrollLeft, 0, 4000);
        n.y = clamp(ev.clientY - br.top - oy + board.scrollTop, 0, 4000);
        el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      };
      const up = () => { el.classList.remove('drag'); el.removeEventListener('pointermove', move); save(); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up, { once:true });
    });
  });
}
$('#addNote').onclick = () => { const n = addNote('', 'note'); setTimeout(() => { const el = $(`[data-note="${n.id}"] textarea`); if (el) el.focus(); }, 30); };
$('#noteSearch').oninput = renderBoard;

/* =====================================================================
   CALENDAR — week grid, .ics both directions, and the auto-scheduler
   ===================================================================== */
let weekAnchor = startOfWeek(new Date());
const EV_KINDS = { study:'Study', class:'Class or meeting', break:'Recovery', other:'Other' };
function winHours() {
  const a = Math.floor(parseHM(S.settings.dayStart) / 60), b = Math.ceil(parseHM(S.settings.dayEnd) / 60);
  return { a, b, n: Math.max(1, b - a) };
}
function dayEvents(k) {
  const local = S.events.filter(e => dayKey(new Date(e.start)) === k);
  return local.concat(gcalEventsFor(k)).sort((x, y) => new Date(x.start) - new Date(y.start) || (new Date(y.end) - new Date(x.end)));
}
/* Overlapping events share the day column: sweep into clusters, give each
   event the first free lane, then split the width across the cluster. */
function layoutDay(evs) {
  const out = []; let cluster = [], clusterEnd = 0;
  const flush = () => {
    if (!cluster.length) return;
    const lanes = Math.max(...cluster.map(x => x.lane)) + 1;
    cluster.forEach(x => out.push({ ev:x.ev, lane:x.lane, lanes }));
    cluster = [];
  };
  evs.forEach(ev => {
    const s0 = +new Date(ev.start), e0 = +new Date(ev.end);
    if (s0 >= clusterEnd) { flush(); clusterEnd = 0; }
    const taken = new Set(cluster.filter(x => +new Date(x.ev.end) > s0).map(x => x.lane));
    let lane = 0; while (taken.has(lane)) lane++;
    cluster.push({ ev, lane }); clusterEnd = Math.max(clusterEnd, e0);
  });
  flush();
  return out;
}
function renderCalendar() {
  const { a, b, n } = winHours(), H = 44;
  const days = Array.from({ length:7 }, (_, i) => new Date(weekAnchor.getTime() + i * DAY));
  const todayK = dayKey(new Date());
  $('#weekLbl').textContent = days[0].toLocaleDateString(undefined, { month:'long', day:'numeric' }) + ' – ' +
    days[6].toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  let html = '<div class="cal-h"></div>';
  days.forEach((d, i) => { html += `<div class="cal-h ${dayKey(d) === todayK ? 'today' : ''}"><div class="d">${DOW[i]}</div><div class="n">${d.getDate()}</div></div>`; });
  html += '<div class="cal-hours">' + Array.from({ length:n }, (_, i) => `<div class="hour-lbl">${pad2(a + i)}:00</div>`).join('') + '</div>';
  days.forEach(d => {
    const k = dayKey(d), all = dayEvents(k);
    const allDay = all.filter(e => e.allDay), timed = all.filter(e => !e.allDay);
    let inner = Array.from({ length:n }, () => '<div class="hour"></div>').join('');
    allDay.forEach((e, i) => {
      inner += `<div class="ev allday ${e.source === 'google' ? 'gcal' : (e.kind || 'other')}" ${e.source === 'google' ? `data-glink="${esc(e.link || '')}"` : `data-ev="${e.id}"`}
        style="top:${1 + i * 17}px;height:15px" data-tip="${esc(e.title)} · all day"><div class="ttl">${esc(e.title)}</div></div>`;
    });
    const offset = allDay.length ? allDay.length * 17 + 2 : 0;
    layoutDay(timed).forEach(({ ev: e, lane, lanes }) => {
      const s0 = new Date(e.start), en = new Date(e.end);
      const top = ((s0.getHours() * 60 + s0.getMinutes()) - a * 60) / 60 * H + offset;
      const h = Math.max(17, ((en - s0) / 60000) / 60 * H - 2);
      if (top < -H || top > n * H + offset) return;
      /* Two abreast still reads; beyond that, indent and stack like Google's
         own grid rather than slicing the column into unreadable slivers. */
      const w = lanes <= 2 ? 100 / lanes : 100 - lane * 17, left = lanes <= 2 ? lane * (100 / lanes) : lane * 17;
      const cls = (e.source === 'google' ? (e.kind === 'gfocus' ? 'gfocus' : 'gcal') + (e.free ? ' free' : '') : (e.kind || 'other'))
        + (isTracking('eventId', e.id) ? ' tracking' : '');
      const attr = e.source === 'google' ? `data-glink="${esc(e.link || '')}" data-gid="${esc(e.id)}"` : `data-ev="${e.id}"`;
      inner += `<div class="ev ${cls}" ${attr} style="top:${Math.max(0, top)}px;height:${h}px;left:calc(${left}% + 3px);width:calc(${w}% - 6px);z-index:${2 + lane}"
          data-tip="${esc(e.title)} · ${hhmm(s0)}–${hhmm(en)}${e.source === 'google' ? ' · from Google Calendar' + (e.free ? ', marked free' : '') : ''}">
        <div class="ttl">${esc(e.title)}</div><div class="tm">${hhmm(s0)}–${hhmm(en)}</div>
        ${e.source === 'google' && h > 40 ? '<div class="src">google</div>' : ''}</div>`;
    });
    if (k === todayK) {
      const now = new Date(), mins = now.getHours() * 60 + now.getMinutes() - a * 60;
      if (mins >= 0 && mins <= n * 60) inner += `<div class="nowline" style="top:${mins / 60 * H + offset}px"></div>`;
    }
    html += `<div class="cal-body" data-day="${k}" style="height:${n * H + offset}px">${inner}</div>`;
  });
  $('#calGrid').innerHTML = html;
  $$('#calGrid .ev[data-ev]').forEach(el => el.onclick = ev => { ev.stopPropagation(); editEvent(el.dataset.ev); });
  /* A Google event (a lecture, a meeting) can be timed too; editing it stays in Google. */
  $$('#calGrid .ev[data-glink]').forEach(el => el.onclick = ev => {
    ev.stopPropagation();
    const g = Object.values(GCAL.events).flat().find(x => x.id === el.dataset.gid);
    if (!g) return;
    const s0 = new Date(g.start), e0 = new Date(g.end), timing = isTracking('eventId', g.id);
    openModal(g.title, `<p style="font-size:12.5px;color:var(--ink-2);margin:0">${g.allDay ? 'All day' : hhmm(s0) + '–' + hhmm(e0)} · ${s0.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' })} · from Google Calendar</p>
      <p style="font-size:12px;color:var(--muted);margin:0">Timing it logs the minutes you actually spend as study time, like any focus session.</p>`,
      [{ label:'Close' }]
        .concat(g.link ? [{ label:'Open in Google', onClick: () => { window.open(g.link, '_blank', 'noopener'); } }] : [])
        .concat([timing ? { label:'■ Stop timing', primary:true, onClick: () => stopTracking() }
                        : { label:'▶ Start timing', primary:true, onClick: () => startTracking({ eventId:g.id, title:g.title }) }]));
  });
  $$('#calGrid .cal-body').forEach(el => el.onclick = ev => {
    if (ev.target.closest('.ev')) return;
    const hour = a + Math.floor(ev.offsetY / H);
    newEvent(el.dataset.day, pad2(clamp(hour, a, b - 1)) + ':00');
  });
  renderSubjects(); renderGcal();
}
$('#weekPrev').onclick = () => { weekAnchor = new Date(weekAnchor - 7 * DAY); renderCalendar(); gcalSubscribe(); };
$('#weekNext').onclick = () => { weekAnchor = new Date(+weekAnchor + 7 * DAY); renderCalendar(); gcalSubscribe(); };
$('#weekToday').onclick = () => { weekAnchor = startOfWeek(new Date()); renderCalendar(); gcalSubscribe(); };
$('#addEventBtn').onclick = () => newEvent(dayKey(new Date()), '09:00');
function eventForm(e) {
  return `<div class="field"><label for="evT">Title</label><input type="text" id="evT" value="${esc(e.title || '')}" placeholder="Optimization — problem set"></div>
  <div style="display:flex;gap:10px">
    <div class="field" style="flex:1"><label for="evD">Date</label><input type="date" id="evD" value="${e.date}"></div>
    <div class="field" style="width:110px"><label for="evS">Start</label><input type="time" id="evS" value="${e.s}"></div>
    <div class="field" style="width:110px"><label for="evE">End</label><input type="time" id="evE" value="${e.e}"></div>
  </div>
  <div style="display:flex;gap:10px">
    <div class="field" style="flex:1"><label for="evK">Kind</label><select id="evK">${Object.entries(EV_KINDS).map(([k, v]) => `<option value="${k}" ${e.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field" style="flex:1"><label for="evSub">Course</label><select id="evSub"><option value="">—</option>${S.subjects.map(s => `<option value="${s.id}" ${e.subjectId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
  </div>`;
}
function readEventForm() {
  const d = $('#evD').value, s = $('#evS').value, e = $('#evE').value;
  if (!d || !s || !e) { toast('Date and both times are required'); return null; }
  const start = new Date(`${d}T${s}`), end = new Date(`${d}T${e}`);
  if (end <= start) { toast('The end time has to come after the start'); return null; }
  return { title:$('#evT').value.trim() || 'Untitled block', start:start.toISOString(), end:end.toISOString(),
           kind:$('#evK').value, subjectId:$('#evSub').value || null };
}
function newEvent(dateKeyStr, timeStr) {
  const endH = pad2(clamp(parseInt(timeStr) + 1, 0, 23)) + ':00';
  openModal('New block', eventForm({ date:dateKeyStr, s:timeStr, e:endH, kind:'study' }),
    [{ label:'Cancel' }, { label:'Add block', primary:true, onClick: () => {
      const v = readEventForm(); if (!v) return false;
      S.events.push(Object.assign({ id:uid() }, v)); save(); renderCalendar(); renderFocusSide();
    } }]);
}
function editEvent(id) {
  const ev = S.events.find(x => x.id === id); if (!ev) return;
  const s = new Date(ev.start), e = new Date(ev.end);
  const timing = isTracking('eventId', id);
  openModal('Edit block', eventForm({ title:ev.title, date:dayKey(s), s:hhmm(s), e:hhmm(e), kind:ev.kind, subjectId:ev.subjectId }),
    [{ label:'Delete', onClick: () => { S.events = S.events.filter(x => x.id !== id); save(); renderCalendar(); renderFocusSide(); } },
     // With live sync on, blocks already reach Google on their own; the template link is for when it is off.
     ...(S.gcal.on ? [] : [{ label:'Add to Google', onClick: () => { gcalLink(ev); return false; } }]),
     timing ? { label:'■ Stop timing', onClick: () => stopTracking() }
            : { label:'▶ Start timing', onClick: () => startTracking({ eventId:ev.id, subjectId:ev.subjectId, title:ev.title }) },
     { label:'Save', primary:true, onClick: () => { const v = readEventForm(); if (!v) return false; Object.assign(ev, v); save(); renderCalendar(); renderFocusSide(); } }]);
}
const icsStamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function gcalLink(ev) {
  const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(ev.title)
    + '&dates=' + icsStamp(ev.start) + '/' + icsStamp(ev.end)
    + '&details=' + encodeURIComponent('Planned in Focus Dial');
  window.open(url, '_blank', 'noopener');
  copyText(url, 'Google Calendar link copied — paste it if the tab was blocked');
}
$('#gcalPushBtn').onclick = () => {
  const upcoming = S.events.filter(e => new Date(e.end) > new Date()).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 12);
  openModal('Push a block to Google', upcoming.length ? `<div class="stack">${upcoming.map(e =>
    `<button class="btn" style="justify-content:space-between" data-push="${e.id}"><span>${esc(e.title)}</span>
      <span class="num" style="color:var(--muted);font-size:11px">${new Date(e.start).toLocaleDateString(undefined, { weekday:'short' })} ${hhmm(new Date(e.start))}</span></button>`).join('')}</div>`
    : '<div class="empty">No upcoming blocks.</div>', [{ label:'Close' }], body => {
      $$('[data-push]', body).forEach(b => b.onclick = () => { gcalLink(S.events.find(e => e.id === b.dataset.push)); });
    });
};
/* ---- .ics in ---- */
function parseICS(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const out = [], blocks = unfolded.split('BEGIN:VEVENT').slice(1);
  const parseDT = v => {
    const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (!h) return new Date(+y, +mo - 1, +d, 9, 0);
    return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  };
  blocks.forEach(b => {
    const body = b.split('END:VEVENT')[0];
    const get = re => { const m = body.match(re); return m ? m[1].trim() : null; };
    const sRaw = get(/DTSTART[^:\n]*:([^\n\r]+)/), eRaw = get(/DTEND[^:\n]*:([^\n\r]+)/);
    if (!sRaw) return;
    const start = parseDT(sRaw); if (!start) return;
    const end = eRaw ? parseDT(eRaw) : new Date(+start + 3600000);
    const title = (get(/SUMMARY[^:\n]*:([^\n\r]+)/) || 'Imported block').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ');
    const rrule = get(/RRULE:([^\n\r]+)/);
    const kind = /class|lecture|seminar|meeting|lab|office hour/i.test(title) ? 'class' : 'other';
    const base = { title, kind, dur: +end - +start };
    const push = st => out.push({ id:uid(), title:base.title, kind:base.kind, subjectId:null, origin:'ics',   // never sent back to Google
      start:new Date(st).toISOString(), end:new Date(+st + base.dur).toISOString() });
    push(start);
    if (rrule && /FREQ=WEEKLY/i.test(rrule)) {          // expand 8 weeks out — enough for a term view
      const cm = rrule.match(/COUNT=(\d+)/i), um = rrule.match(/UNTIL=([0-9TZ]+)/i);
      const until = um ? parseDT(um[1]) : null, count = cm ? +cm[1] : 8;
      const byday = (rrule.match(/BYDAY=([^;]+)/i) || [])[1];
      const map = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
      const targets = byday ? byday.split(',').map(x => map[x.trim().slice(-2)]) : [start.getDay()];
      let made = 1;
      for (let w = 0; w < 8 && made < count; w++) {
        targets.forEach(dow => {
          if (made >= count) return;
          const d0 = new Date(start); d0.setDate(d0.getDate() - ((d0.getDay() - dow + 7) % 7) + w * 7);
          if (+d0 <= +start) return;
          if (until && +d0 > +until) return;
          push(d0); made++;
        });
      }
    }
  });
  return out;
}
$('#icsImportBtn').onclick = () => openModal('Import from Google Calendar', `
  <p style="font-size:12.5px;color:var(--ink-2);margin:0">Paste the contents of your .ics export, or pick the file. Times land in your local timezone; weekly repeats are expanded eight weeks out.</p>
  <div class="field"><label for="icsBox">.ics text</label><textarea id="icsBox" rows="7" placeholder="BEGIN:VCALENDAR…"></textarea></div>
  <button class="btn" id="icsFile" style="justify-content:center">Choose an .ics file instead</button>`,
  [{ label:'Cancel' }, { label:'Import', primary:true, onClick: () => {
    const txt = $('#icsBox').value; if (!txt.trim()) { toast('Nothing to import'); return false; }
    doImportICS(txt);
  } }], body => {
    $('#icsFile', body).onclick = () => pickFile('.ics', txt => { $('#icsBox').value = txt; toast('File loaded — press Import'); });
  });
function doImportICS(txt) {
  const evs = parseICS(txt);
  if (!evs.length) { toast('No events found in that file'); return; }
  const seen = new Set(S.events.map(e => e.title + e.start));
  const fresh = evs.filter(e => !seen.has(e.title + e.start));
  S.events.push(...fresh); save(); renderCalendar(); renderFocusSide();
  toast(`${fresh.length} blocks imported${evs.length - fresh.length ? ', ' + (evs.length - fresh.length) + ' already there' : ''}`);
}
function pickFile(accept, cb) {
  const inp = $('#filePick'); inp.accept = accept; inp.value = '';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsText(f); };
  inp.click();
}
/* ---- .ics out ---- */
function buildICS(events) {
  const esc2 = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Focus Dial//EN','CALSCALE:GREGORIAN']
    .concat(events.flatMap(e => ['BEGIN:VEVENT', 'UID:' + e.id + '@focusdial', 'DTSTAMP:' + icsStamp(Date.now()),
      'DTSTART:' + icsStamp(e.start), 'DTEND:' + icsStamp(e.end), 'SUMMARY:' + esc2(e.title),
      'DESCRIPTION:' + esc2('Planned in Focus Dial · ' + (EV_KINDS[e.kind] || 'Block')), 'END:VEVENT']))
    .concat(['END:VCALENDAR']).join('\r\n');
}
$('#icsExportBtn').onclick = () => {
  const end = new Date(+weekAnchor + 7 * DAY);
  const evs = S.events.filter(e => new Date(e.start) >= weekAnchor && new Date(e.start) < end);
  if (!evs.length) { toast('No blocks in this week to export'); return; }
  offerText('focus-week.ics', buildICS(evs), 'Save this as <strong>focus-week.ics</strong>, then in Google Calendar: Settings → Import &amp; export → Import.');
};
const MIME = { json:'application/json', csv:'text/csv', ics:'text/calendar' };
/* Save the file for real, then show it in a modal as well: the note says
   what to do with it, and the text is a fallback if the download was blocked. */
function offerText(filename, text, note) {
  let downloaded = false;
  try {
    const url = URL.createObjectURL(new Blob([text], { type:(MIME[filename.split('.').pop()] || 'text/plain') + ';charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    downloaded = true;
  } catch (e) {}
  openModal('Export · ' + filename, `
    <p style="font-size:12.5px;color:var(--ink-2);margin:0">${note || ''}</p>
    <p style="font-size:12px;color:var(--muted);margin:0">${downloaded
      ? `<strong>${esc(filename)}</strong> should be in your downloads. If the browser blocked it, copy the text below into a file with that name.`
      : 'This browser would not start a download, so here is the file itself — copy it into a text editor and save it under that name.'}</p>
    <textarea id="expBox" rows="10" readonly style="font-family:var(--font-mono);font-size:11px">${esc(text)}</textarea>`,
    [{ label:'Close' }, { label:'Copy to clipboard', primary:true, onClick: () => { copyText(text, 'Copied — paste it into a file'); return false; } }],
    body => { const t = $('#expBox', body); t.focus(); t.select(); });
}

/* =====================================================================
   COURSES + AUTO-SCHEDULER
   Greedy packing: rank free slots by your historically best hours, then
   hand each slot to whichever course is furthest behind its weekly target
   (weighted by priority), with a penalty against three slots in a row.
   ===================================================================== */
const SUB_COLORS = ['var(--focus)','var(--long)','var(--rest)','var(--alert)','#8E7CC3','#3D85C6'];
function renderSubjects() {
  const box = $('#subjectList'); if (!box) return;
  const end = new Date(+weekAnchor + 7 * DAY);
  box.innerHTML = S.subjects.length ? S.subjects.map(s => {
    const planned = S.events.filter(e => e.subjectId === s.id && new Date(e.start) >= weekAnchor && new Date(e.start) < end)
      .reduce((a, e) => a + (new Date(e.end) - new Date(e.start)) / 60000, 0);
    const doneMin = S.sessions.filter(x => x.subjectId === s.id && new Date(x.start) >= weekAnchor && new Date(x.start) < end)
      .reduce((a, x) => a + x.minutes, 0);
    const target = s.targetHours * 60;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--line)" data-sub="${s.id}">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="dot" style="background:${s.color}"></span>
        <strong style="font-size:12.5px;flex:1">${esc(s.name)}</strong>
        <span class="eyebrow">P${s.priority}</span>
        <button class="btn sm ghost" data-editsub="${s.id}" aria-label="Edit">✎</button>
      </div>
      <div style="height:5px;border-radius:99px;background:var(--surface-3);margin:7px 0 4px;overflow:hidden;display:flex">
        <div style="width:${clamp(doneMin / target * 100, 0, 100)}%;background:${s.color}"></div>
        <div style="width:${clamp((planned - doneMin) / target * 100, 0, 100)}%;background:${s.color};opacity:.32"></div>
      </div>
      <div class="num" style="font-size:10.5px;color:var(--muted)">${Math.round(doneMin)}m done · ${Math.round(Math.max(0, planned - doneMin))}m planned · ${s.targetHours}h target</div>
    </div>`;
  }).join('') : '<div class="empty">No courses yet. Add one so the scheduler knows what to pack.</div>';
  $$('#subjectList [data-editsub]').forEach(b => b.onclick = () => subjectModal(b.dataset.editsub));
}
function subjectModal(id) {
  const s = S.subjects.find(x => x.id === id) || { name:'', targetHours:4, priority:2, color:SUB_COLORS[S.subjects.length % SUB_COLORS.length] };
  openModal(id ? 'Edit course' : 'New course', `
    <div class="field"><label for="sbN">Name</label><input type="text" id="sbN" value="${esc(s.name)}" placeholder="Vision-Language Models"></div>
    <div style="display:flex;gap:10px">
      <div class="field" style="flex:1"><label for="sbH">Hours per week</label><input type="number" id="sbH" min="1" max="40" step="0.5" value="${s.targetHours}"></div>
      <div class="field" style="flex:1"><label for="sbP">Priority</label><select id="sbP">
        <option value="1" ${s.priority === 1 ? 'selected' : ''}>1 — background</option>
        <option value="2" ${s.priority === 2 ? 'selected' : ''}>2 — normal</option>
        <option value="3" ${s.priority === 3 ? 'selected' : ''}>3 — exam or deadline</option></select></div>
    </div>`,
    [{ label:'Cancel' }].concat(id ? [{ label:'Delete', onClick: () => { S.subjects = S.subjects.filter(x => x.id !== id); save(); renderSubjects(); renderTasks(); } }] : [])
      .concat([{ label:'Save', primary:true, onClick: () => {
        const name = $('#sbN').value.trim(); if (!name) { toast('Give it a name'); return false; }
        const rec = { name, targetHours:+$('#sbH').value || 4, priority:+$('#sbP').value, color:s.color };
        if (id) Object.assign(S.subjects.find(x => x.id === id), rec);
        else S.subjects.push(Object.assign({ id:uid() }, rec));
        save(); renderSubjects(); renderTasks();
      } }]));
}
$('#addSubject').onclick = () => subjectModal(null);
function busyIntervals(dateKeyStr) {
  const local = S.events.filter(e => dayKey(new Date(e.start)) === dateKeyStr);
  const live = gcalEventsFor(dateKeyStr).filter(e => !e.free && !e.allDay);
  return local.concat(live).map(e => ({ s:new Date(e.start), e:new Date(e.end) })).sort((a, b) => a.s - b.s);
}
function freeSlots(d, blockMin) {
  const { a, b } = winHours(), k = dayKey(d);
  let cursor = new Date(d); cursor.setHours(a, 0, 0, 0);
  const dayEnd = new Date(d); dayEnd.setHours(b, 0, 0, 0);
  const slots = [];
  const busy = busyIntervals(k);
  const nowPlus = new Date(Date.now() + 15 * 60000);
  busy.concat([{ s:dayEnd, e:dayEnd }]).forEach(iv => {
    while (+cursor + blockMin * 60000 <= +iv.s) {
      const st = new Date(cursor);
      if (st >= nowPlus) slots.push({ start:st, end:new Date(+st + blockMin * 60000) });
      cursor = new Date(+cursor + blockMin * 60000);
    }
    if (+iv.e > +cursor) cursor = new Date(iv.e);
  });
  return slots;
}
function hourScores() {
  const h = new Array(24).fill(0);
  S.sessions.forEach(s => { h[new Date(s.start).getHours()] += s.minutes; });
  const max = Math.max(...h);
  if (max === 0) return h.map((_, i) => (i >= 9 && i <= 11) ? 1 : (i >= 14 && i <= 17) ? 0.85 : (i >= 19 && i <= 21) ? 0.6 : 0.3);
  return h.map(v => 0.25 + 0.75 * (v / max));
}
function weekCapacityHours() {
  let mins = 0;
  for (let i = 0; i < 7; i++) mins += freeSlots(new Date(+weekAnchor + i * DAY), 30).length * 30;
  return mins / 60;
}
$('#autoPlan').onclick = () => {
  if (!S.subjects.length) { toast('Add at least one course first'); return; }
  const blockMin = S.settings.focus + S.settings.short;
  const scores = hourScores();
  let slots = [];
  for (let i = 0; i < 7; i++) slots = slots.concat(freeSlots(new Date(+weekAnchor + i * DAY), blockMin));
  if (!slots.length) { toast('No free slots left in this week window'); return; }
  slots.forEach(s => s.score = scores[s.start.getHours()]);
  slots.sort((a, b) => b.score - a.score || a.start - b.start);
  const end = new Date(+weekAnchor + 7 * DAY);
  const need = {};
  S.subjects.forEach(s => {
    const planned = S.events.filter(e => e.subjectId === s.id && new Date(e.start) >= weekAnchor && new Date(e.start) < end)
      .reduce((a, e) => a + (new Date(e.end) - new Date(e.start)) / 60000, 0);
    need[s.id] = Math.max(0, s.targetHours * 60 - planned);
  });
  const perDay = {}, made = [];
  let lastId = null, run = 0;
  slots.forEach(slot => {
    const k = dayKey(slot.start);
    perDay[k] = perDay[k] || 0;
    if (perDay[k] >= 5) return;                                  // never more than 5 blocks in one day
    let best = null, bestScore = -1;
    S.subjects.forEach(s => {
      if (need[s.id] < S.settings.focus) return;
      let sc = (need[s.id] / 60) * s.priority;
      if (s.id === lastId && run >= 2) sc *= 0.45;               // stop one course eating a whole day
      if (sc > bestScore) { bestScore = sc; best = s; }
    });
    if (!best) return;
    need[best.id] -= blockMin;
    run = best.id === lastId ? run + 1 : 1; lastId = best.id;
    perDay[k]++;
    made.push({ id:uid(), title:best.name, kind:'study', subjectId:best.id,
                start:slot.start.toISOString(), end:slot.end.toISOString() });
  });
  if (!made.length) { toast('Every course already hits its target this week'); return; }
  S.events.push(...made); save(); renderCalendar(); renderFocusSide();
  toast(`${made.length} study blocks placed — ${(made.length * blockMin / 60).toFixed(1)} h`);
};
$('#dayStart').onchange = e => { S.settings.dayStart = e.target.value; save(); renderCalendar(); };
$('#dayEnd').onchange = e => { S.settings.dayEnd = e.target.value; save(); renderCalendar(); };

/* =====================================================================
   CALM — breathing, grounding, check-ins
   ===================================================================== */
const BREATH = Object.assign({
  box:   { name:'Box 4-4-4-4', steps:[['Breathe in',4],['Hold',4],['Breathe out',4],['Hold',4]], hint:'Even and square. The default when you are wired and cannot settle.' },
  '478': { name:'4-7-8',       steps:[['Breathe in',4],['Hold',7],['Breathe out',8]],            hint:'The long exhale is what does the work. Strong down-regulator — good after a spike, or before sleep.' },
  coh:   { name:'Coherent 5.5',steps:[['Breathe in',5.5],['Breathe out',5.5]],                   hint:'About five and a half breaths a minute. Steady rather than sedating — fine to run during a break.' }
}, CFG.breathPatterns || {});
let breathMode = BREATH.box ? 'box' : Object.keys(BREATH)[0];   // integer-like keys sort first, so name the default
let breathTimer = null, breathStep = 0, breathCycles = 0, breathStart = 0;
function renderCalm() {
  $('#breathModes').innerHTML = Object.entries(BREATH).map(([k, v]) =>
    `<button class="scale-btn ${breathMode === k ? 'on' : ''}" data-bm="${k}">${esc(v.name)}</button>`).join('');
  $$('#breathModes [data-bm]').forEach(b => b.onclick = () => { breathMode = b.dataset.bm; stopBreath(); renderCalm(); });
  $('#breathHint').textContent = BREATH[breathMode].hint;
  const last = S.checkins[S.checkins.length - 1];
  $('#lastCheckin').textContent = last ? 'last ' + new Date(last.at).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : '';
  $('#checkinSliders').innerHTML = [['energy','Energy','flat','buzzing'],['stress','Stress','calm','fried'],['focus','Focus','scattered','locked in']]
    .map(([k, label, lo, hi]) => `<div class="field">
      <label for="ck_${k}">${label} <span class="num" id="ckv_${k}">5</span></label>
      <input type="range" id="ck_${k}" min="1" max="10" value="5">
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted)"><span>${lo}</span><span>${hi}</span></div></div>`).join('');
  ['energy','stress','focus'].forEach(k => { const i = $('#ck_' + k); i.oninput = () => $('#ckv_' + k).textContent = i.value; });
  const gr = LIST('ground');
  $('#groundList').innerHTML = gr.map((g, i) => `<div style="display:flex;gap:8px;padding:5px 0;font-size:12.5px"><span class="num" style="color:var(--muted)">${gr.length - i}</span><span>${esc(g)}</span></div>`).join('');
  $('#moveList').innerHTML = LIST('moves').map(m => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px"><span class="dot" style="margin-top:6px;background:var(--rest)"></span><span>${esc(m)}</span></div>`).join('');
}
function stepBreath() {
  const steps = BREATH[breathMode].steps, [label, secs] = steps[breathStep % steps.length];
  const orb = $('#orb');
  orb.style.setProperty('--bt', secs + 's');
  orb.classList.toggle('expand', /in/i.test(label) || (/hold/i.test(label) && orb.classList.contains('expand')));
  $('#orbTxt').textContent = label;
  breathTimer = setTimeout(() => {
    breathStep++;
    if (breathStep % steps.length === 0) breathCycles++;
    stepBreath();
  }, secs * 1000);
}
function stopBreath() {
  clearTimeout(breathTimer); breathTimer = null;
  $('#orb').classList.remove('expand'); $('#orbTxt').textContent = 'Ready';
  $('#breathBtn').textContent = 'Start breathing';
}
$('#breathBtn').onclick = () => {
  if (breathTimer) { stopBreath(); return; }
  breathStep = 0; breathCycles = 0; breathStart = Date.now();
  $('#breathBtn').textContent = 'Pause';
  stepBreath();
};
$('#breathStop').onclick = stopBreath;
setInterval(() => {
  if (!breathTimer) return;
  const el = $('#orbCount'); if (!el) return;
  const s = Math.floor((Date.now() - breathStart) / 1000);
  el.textContent = `${breathCycles} cycles · ${Math.floor(s / 60)}:${pad2(s % 60)}`;
}, 1000);
$('#groundStart').onclick = () => {
  const steps = LIST('ground'); let i = 0;
  openModal(steps.length + '-' + steps.map((_, n) => steps.length - n).slice(1).join('-'), `<div style="display:grid;place-items:center;gap:12px;padding:10px 0">
      <div class="num" style="font-family:var(--font-display);font-size:56px;font-weight:700;color:var(--long)" id="gN">${steps.length}</div>
      <p id="gT" style="font-size:15px;text-align:center;margin:0;max-width:32ch">${esc(steps[0] || '')}</p>
      <p style="font-size:12px;color:var(--muted);margin:0">Take your time. Advances every 18 seconds.</p></div>`, [{ label:'Done' }]);
  const iv = setInterval(() => {
    i++; if (i >= steps.length) { clearInterval(iv); const t = $('#gT'); if (t) { t.textContent = 'Back in the room. Pick the smallest next step.'; $('#gN').textContent = '·'; } return; }
    const n = $('#gN'); if (!n) { clearInterval(iv); return; }
    n.textContent = steps.length - i; $('#gT').textContent = steps[i];
  }, 18000);
  modalDone = () => clearInterval(iv);
};
$('#saveCheckin').onclick = () => {
  S.checkins.push({ id:uid(), at:new Date().toISOString(), energy:+$('#ck_energy').value,
                    stress:+$('#ck_stress').value, focus:+$('#ck_focus').value, note:$('#checkNote').value.trim(), when:'manual' });
  $('#checkNote').value = ''; save(); renderCalm(); toast('Logged — the pattern is worth more than any one entry');
};
function postSessionCheckin() {
  openModal('How did that go?', `
    <p style="font-size:12.5px;color:var(--ink-2);margin:0">${esc(S.timer.intent || 'Interval complete.')}</p>
    <div class="field"><label>Session quality <span class="num" id="qv">3</span> of 5</label>
      <div class="scale-row" id="qRow">${[1,2,3,4,5].map(n => `<button class="scale-btn" data-q="${n}">${n}</button>`).join('')}</div></div>
    <div class="field"><label for="ck2_stress">Stress right now <span class="num" id="ckv2">5</span></label><input type="range" id="ck2_stress" min="1" max="10" value="5"></div>
    <p style="font-size:12px;color:var(--muted);margin:0">${esc(movementSnack())}</p>`,
    [{ label:'Skip' }, { label:'Save', primary:true, onClick: () => {
      const last = S.sessions[S.sessions.length - 1];
      if (last) last.quality = +($('#qRow .on') ? $('#qRow .on').dataset.q : 3);
      S.checkins.push({ id:uid(), at:new Date().toISOString(), energy:null, stress:+$('#ck2_stress').value, focus:last && last.quality ? last.quality * 2 : null, note:'', when:'post' });
      save(); renderStats();
    } }], body => {
      $$('[data-q]', body).forEach(b => b.onclick = () => { $$('[data-q]', body).forEach(x => x.classList.remove('on')); b.classList.add('on'); $('#qv').textContent = b.dataset.q; });
      $('#ck2_stress', body).oninput = e => $('#ckv2').textContent = e.target.value;
    });
}

/* =====================================================================
   STATISTICS — every chart is one series against one scale
   ===================================================================== */
let range = 30;
const barPath = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`; };
function rangeDays(n) {
  const out = [], t = startOfDay(new Date());
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(+t - i * DAY)));
  return out;
}
function minutesByDay() {
  const m = {};
  S.sessions.forEach(s => { const k = dayKey(new Date(s.start)); m[k] = (m[k] || 0) + s.minutes; });
  return m;
}
function renderStats() {
  $('#rangeBtns').innerHTML = [7, 30, 90].map(n => `<button class="scale-btn ${range === n ? 'on' : ''}" data-range="${n}">${n}d</button>`).join('');
  $$('#rangeBtns [data-range]').forEach(b => b.onclick = () => { range = +b.dataset.range; renderStats(); });
  const keys = rangeDays(range), inRange = new Set(keys), byDayMap = minutesByDay();
  const sess = S.sessions.filter(s => inRange.has(dayKey(new Date(s.start))));
  const mins = sess.reduce((a, s) => a + s.minutes, 0);
  const quality = sess.filter(s => s.quality).map(s => s.quality);
  const distr = sess.reduce((a, s) => a + (s.distractions ? s.distractions.length : 0), 0);
  const activeDays = new Set(sess.map(s => dayKey(new Date(s.start)))).size;
  $('#kpis').innerHTML = [
    ['Focus time', minsToHM(mins), `${sess.filter(s => !s.tracked).length} intervals${sess.some(s => s.tracked) ? ` + ${sess.filter(s => s.tracked).length} timed` : ''} across ${activeDays} days`],
    ['Median active day', minsToHM(median(keys.map(k => byDayMap[k] || 0).filter(v => v > 0))), `${activeDays} days with any focus`],
    ['Current streak', streakDays() + 'd', 'days in a row with at least one interval'],
    ['Session quality', quality.length ? (quality.reduce((a, b) => a + b, 0) / quality.length).toFixed(1) + '/5' : '—', quality.length ? quality.length + ' rated' : 'rate a few to see this'],
    ['Distractions', distr ? (distr / Math.max(1, sess.length)).toFixed(1) : '0', 'logged per interval'],
    // Stopwatch sessions have no bell to run to, so they stay out of this one.
    ['Finished', sess.some(s => !s.tracked) ? Math.round(sess.filter(s => !s.tracked && !s.partial).length / sess.filter(s => !s.tracked).length * 100) + '%' : '—', 'intervals run to the bell']
  ].map(([k, v, d]) => `<div class="kpi"><div class="v">${v}</div><div class="k">${k}</div><div class="d">${d}</div></div>`).join('');
  drawDaily(keys); drawHours(sess); drawHeat(); drawDistract(sess); drawSparks(); drawSubjects(sess); drawLog(sess); drawInsights(sess);
}
const median = arr => { const a = arr.slice().sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2)) : 0; };

function drawDaily(keys) {
  const W = 760, H = 220, L = 38, R = 10, TP = 14, B = 26;
  const byDay = minutesByDay();
  const vals = keys.map(k => byDay[k] || 0);
  const max = Math.max(30, Math.ceil(Math.max(...vals) / 30) * 30);
  const iw = W - L - R, ih = H - TP - B;
  const bw = Math.max(3, iw / keys.length - (keys.length > 45 ? 1.5 : 3));
  const x = i => L + (i + 0.5) * (iw / keys.length) - bw / 2;
  const y = v => TP + ih - (v / max) * ih;
  let g = '';
  [0, max / 2, max].forEach(v => {
    g += `<line class="gl" x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - R}" y2="${y(v).toFixed(1)}"/>`;
    g += `<text x="${L - 7}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v)}</text>`;
  });
  const maxI = vals.indexOf(Math.max(...vals));
  const bars = vals.map((v, i) => {
    const h = v === 0 ? 0 : Math.max(2, (v / max) * ih);
    const isToday = i === vals.length - 1;
    return v === 0 ? `<rect x="${x(i).toFixed(1)}" y="${(TP + ih - 2).toFixed(1)}" width="${bw.toFixed(1)}" height="2" fill="var(--surface-3)" data-tip="${keys[i]} · nothing logged"/>`
      : `<path class="bar ${isToday ? '' : ''}" d="${barPath(x(i), y(v), bw, h, 4)}" ${isToday ? 'fill="var(--accent)"' : 'fill="var(--accent)" opacity=".72"'} data-tip="${keys[i]} · ${v} min"/>`;
  }).join('');
  const step = keys.length > 45 ? 14 : keys.length > 20 ? 7 : 2;
  const gapOK = i => (keys.length - 1 - i) >= Math.max(2, Math.round(step * 0.7));
  const ticks = keys.map((k, i) => (i === keys.length - 1 || (i % step === 0 && gapOK(i)))
    ? `<text x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${keyToDate(k).toLocaleDateString(undefined, { month:'short', day:'numeric' })}</text>` : '').join('');
  const peak = vals[maxI] > 0 ? `<text class="lbl" x="${(x(maxI) + bw / 2).toFixed(1)}" y="${(y(vals[maxI]) - 6).toFixed(1)}" text-anchor="middle">${vals[maxI]}</text>` : '';
  $('#chDaily').innerHTML = g + bars + ticks + peak;
  $('#capDaily').textContent = `Completed focus intervals only. Peak in this range: ${vals[maxI]} minutes.`;
}
function drawHours(sess) {
  const W = 480, H = 220, L = 30, R = 8, TP = 12, B = 26;
  const h = new Array(24).fill(0);
  sess.forEach(s => h[new Date(s.start).getHours()] += s.minutes);
  const from = 5, to = 23, n = to - from + 1;
  const vals = h.slice(from, to + 1), max = Math.max(20, Math.max(...vals));
  const iw = W - L - R, ih = H - TP - B, bw = iw / n - 3;
  const x = i => L + i * (iw / n), y = v => TP + ih - (v / max) * ih;
  const best = vals.indexOf(Math.max(...vals));
  let out = `<line class="gl" x1="${L}" y1="${TP + ih}" x2="${W - R}" y2="${TP + ih}"/>`;
  out += vals.map((v, i) => v === 0
    ? `<rect x="${x(i).toFixed(1)}" y="${TP + ih - 2}" width="${bw.toFixed(1)}" height="2" fill="var(--surface-3)"/>`
    : `<path d="${barPath(x(i), y(v), bw, Math.max(2, (v / max) * ih), 4)}" fill="var(--accent)" opacity="${i === best ? 1 : .6}" data-tip="${pad2(from + i)}:00 · ${v} min"/>`).join('');
  out += vals.map((v, i) => (i % 3 === 0) ? `<text x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${pad2(from + i)}</text>` : '').join('');
  if (vals[best] > 0) out += `<text class="lbl" x="${(x(best) + bw / 2).toFixed(1)}" y="${(y(vals[best]) - 6).toFixed(1)}" text-anchor="middle">${pad2(from + best)}:00</text>`;
  $('#chHours').innerHTML = out;
}
function drawHeat() {
  const W = 480, cell = 15, gap = 3, weeks = 13;
  const byDay = minutesByDay();
  const end = startOfWeek(new Date()), startD = new Date(+end - (weeks - 1) * 7 * DAY);
  const max = Math.max(60, ...Object.values(byDay));
  const L = 26, TP = 20;
  let out = '';
  ['Mon','Wed','Fri','Sun'].forEach((d, i) => { out += `<text x="${L - 6}" y="${TP + [0,2,4,6][i] * (cell + gap) + 11}" text-anchor="end">${d}</text>`; });
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(+startD + (w * 7 + d) * DAY);
      if (date > new Date()) continue;
      const k = dayKey(date), v = byDay[k] || 0;
      const X = L + w * (cell + gap), Y = TP + d * (cell + gap);
      out += `<rect x="${X}" y="${Y}" width="${cell}" height="${cell}" rx="3.5" fill="var(--surface-3)"/>`;
      if (v > 0) out += `<rect x="${X}" y="${Y}" width="${cell}" height="${cell}" rx="3.5" fill="var(--accent)" opacity="${(0.18 + 0.82 * Math.min(1, v / max)).toFixed(2)}" data-tip="${k} · ${v} min"/>`;
      else out += `<rect x="${X}" y="${Y}" width="${cell}" height="${cell}" rx="3.5" fill="transparent" data-tip="${k} · nothing logged"/>`;
      if (d === 0 && date.getMonth() !== lastMonth) { lastMonth = date.getMonth(); out += `<text x="${X}" y="${TP - 7}">${date.toLocaleDateString(undefined, { month:'short' })}</text>`; }
    }
  }
  const legX = L + weeks * (cell + gap) + 14;
  out += `<text x="${legX}" y="${TP + 11}">less</text>`;
  [0.18, 0.45, 0.7, 1].forEach((o, i) => out += `<rect x="${legX + 4}" y="${TP + 20 + i * 18}" width="12" height="12" rx="3" fill="var(--accent)" opacity="${o}"/>`);
  out += `<text x="${legX}" y="${TP + 20 + 4 * 18 + 8}">more</text>`;
  $('#chHeat').innerHTML = out;
}
function drawDistract(sess) {
  const W = 480, H = 190, L = 118, R = 38, TP = 10;
  const counts = {};
  sess.forEach(s => (s.distractions || []).forEach(d => counts[d] = (counts[d] || 0) + 1));
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!rows.length) {
    $('#chDistract').innerHTML = `<text x="16" y="94" style="font-family:var(--font-ui);font-size:12px" fill="var(--muted)">Nothing logged yet \u2014 tap \u201cCaught a distraction\u201d mid-session.</text>`;
    return;
  }
  const max = rows[0][1], iw = W - L - R;
  const lane = (H - TP * 2) / rows.length, bh = Math.min(24, lane - 8);
  $('#chDistract').innerHTML = rows.map(([k, v], i) => {
    const y = TP + i * lane, w = Math.max(4, (v / max) * iw);
    return `<text x="${L - 10}" y="${(y + bh / 2 + 4).toFixed(1)}" text-anchor="end" class="lbl">${esc(k)}</text>
      <rect x="${L}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="var(--accent)" opacity="${(0.42 + 0.58 * v / max).toFixed(2)}" data-tip="${esc(k)} \u00b7 ${v} times"/>
      <text x="${(L + w + 8).toFixed(1)}" y="${(y + bh / 2 + 4).toFixed(1)}" class="lbl">${v}</text>`;
  }).join('');
}
function spark(id, title, values, labels, hint) {
  const W = 240, H = 96, L = 6, R = 6, TP = 10, B = 14;
  if (values.filter(v => v != null).length < 2)
    return `<div class="card chart-card"><h3>${title}</h3><p class="cap">${hint}</p><div class="empty">Not enough check-ins yet.</div></div>`;
  const pts = values.map((v, i) => [L + i * ((W - L - R) / Math.max(1, values.length - 1)), v]);
  const max = 10, min = 0, ih = H - TP - B;
  const y = v => TP + ih - ((v - min) / (max - min)) * ih;
  const d = pts.map(([px, v], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${TP + ih} L${pts[0][0].toFixed(1)},${TP + ih} Z`;
  const last = pts[pts.length - 1];
  return `<div class="card chart-card"><h3>${title}</h3><p class="cap">${hint}</p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
      <line class="gl" x1="${L}" y1="${y(5).toFixed(1)}" x2="${W - R}" y2="${y(5).toFixed(1)}"/>
      <path d="${area}" fill="var(--accent)" opacity=".12"/>
      <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${y(last[1]).toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
      <text x="${(last[0] - 4).toFixed(1)}" y="${(y(last[1]) - 9).toFixed(1)}" text-anchor="end" class="lbl">${last[1].toFixed(1)}</text>
      <text x="${L}" y="${H - 2}">${labels[0]}</text><text x="${W - R}" y="${H - 2}" text-anchor="end">${labels[1]}</text>
    </svg></div>`;
}
function drawSparks() {
  const cks = S.checkins.slice(-14);
  const lbl = [cks.length ? new Date(cks[0].at).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : '', 'now'];
  const pick = k => cks.map(c => c[k]).filter(v => v != null);
  $('#sparkRow').innerHTML =
    spark('e', 'Energy', pick('energy'), lbl, 'Self-rated, 1 flat to 10 buzzing.') +
    spark('s', 'Stress', pick('stress'), lbl, 'Lower is calmer. Watch it against session quality.') +
    spark('f', 'Focus', pick('focus'), lbl, 'How locked in you felt, 1 to 10.');
}
function drawSubjects(sess) {
  const W = 480, H = 220, L = 132, R = 40, TP = 10;
  const totals = {};
  sess.forEach(s => { if (s.subjectId) totals[s.subjectId] = (totals[s.subjectId] || 0) + s.minutes; });
  const rows = S.subjects.map(s => [s, totals[s.id] || 0]).sort((a, b) => b[1] - a[1]);
  if (!rows.length || !rows[0][1]) { $('#chSubjects').innerHTML = `<text x="18" y="100" style="font-family:var(--font-ui);font-size:12px" fill="var(--muted)">No course time logged in this range.</text>`; return; }
  const max = rows[0][1], iw = W - L - R, gap = 10;
  const bh = Math.min(26, (H - TP * 2) / rows.length - gap);
  $('#chSubjects').innerHTML = rows.map(([s, v], i) => {
    const y = TP + i * ((H - TP * 2) / rows.length), w = Math.max(3, (v / max) * iw);
    const target = s.targetHours * 60 * (range / 7);
    return `<text x="${L - 10}" y="${y + bh / 2 + 4}" text-anchor="end" class="lbl">${esc(s.name.slice(0, 18))}</text>
      <rect x="${L}" y="${y}" width="${w.toFixed(1)}" height="${bh}" rx="4" fill="${s.color}" data-tip="${esc(s.name)} · ${minsToHM(v)} · target ${Math.round(target / 60)}h over ${range}d"/>
      <text x="${L + w + 8}" y="${y + bh / 2 + 4}" class="lbl">${minsToHM(v)}</text>`;
  }).join('');
}
function drawLog(sess) {
  const rows = sess.slice().reverse().slice(0, 40);
  $('#logTbl').innerHTML = `<thead><tr><th>When</th><th>Task</th><th>Min</th><th>Quality</th><th>Pulls</th></tr></thead><tbody>${
    rows.length ? rows.map(s => {
      const t = S.tasks.find(x => x.id === s.taskId);
      const d = new Date(s.start);
      return `<tr><td class="num">${d.toLocaleDateString(undefined, { month:'short', day:'numeric' })} ${hhmm(d)}</td>
        <td>${esc(t ? t.title.slice(0, 40) : s.title ? s.title.slice(0, 40) : (s.intent ? s.intent.slice(0, 40) : '—'))}</td>
        <td class="num"${s.tracked ? ' data-tip="Timed with the stopwatch"' : ''}>${s.minutes}${s.partial ? '*' : ''}${s.tracked ? ' ⏱' : ''}</td>
        <td class="num">${s.quality ? '★'.repeat(s.quality) : '—'}</td>
        <td class="num">${(s.distractions || []).length}</td></tr>`;
    }).join('') : '<tr><td colspan="5" style="color:var(--muted);padding:16px">No sessions in this range.</td></tr>'}</tbody>`;
}
function drawInsights(sess) {
  const bits = [];
  const h = new Array(24).fill(0); sess.forEach(s => h[new Date(s.start).getHours()] += s.minutes);
  const bestH = h.indexOf(Math.max(...h));
  if (Math.max(...h) > 0) bits.push(`Your densest hour is <strong>${pad2(bestH)}:00</strong>. Put the course you are most behind on there, not the easy one.`);
  const dw = new Array(7).fill(0); sess.forEach(s => dw[(new Date(s.start).getDay() + 6) % 7] += s.minutes);
  const worst = dw.indexOf(Math.min(...dw));
  if (sess.length > 6) bits.push(`<strong>${DOW[worst]}</strong> is your thinnest day — either protect a block or stop scheduling one and take the day honestly.`);
  const counts = {}; sess.forEach(s => (s.distractions || []).forEach(d => counts[d] = (counts[d] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top) bits.push(`<strong>${esc(top[0])}</strong> is your most common pull (${top[1]}×). That one is worth an environment change, not more willpower.`);
  const rated = sess.filter(s => s.quality);
  if (rated.length > 3) {
    const byAct = {}; rated.forEach(s => { const k = s.activation || 'unrated'; (byAct[k] = byAct[k] || []).push(s.quality); });
    const line = Object.entries(byAct).filter(([k]) => k !== 'unrated')
      .map(([k, v]) => `${k === 'low' ? 'easy starts' : k === 'med' ? 'middling starts' : 'uphill starts'} average ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}/5`).join(', ');
    if (line) bits.push(`Once you are running, quality barely cares how hard it was to begin — ${line}. The hard part really is only the start.`);
  }
  const short = sess.filter(s => s.partial).length;
  if (short > 2) bits.push(`${short} intervals ended early. If that keeps up, shorten the focus length to ${Math.max(10, S.settings.focus - 5)} minutes rather than fighting it.`);
  $('#insightCard').innerHTML = `<div class="panel-head"><h3>What the data is telling you</h3><span class="eyebrow">last ${range} days</span></div>` +
    (bits.length ? `<ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px;font-size:13px;line-height:1.55">${bits.map(b => `<li>${b}</li>`).join('')}</ul>`
      : '<div class="empty">Run a few sessions and the patterns show up here.</div>');
}
$('#exportCsv').onclick = () => {
  const rows = [['start','end','minutes','task','course','quality','activation','distractions','intent','timed']];
  S.sessions.forEach(s => {
    const t = S.tasks.find(x => x.id === s.taskId), sub = S.subjects.find(x => x.id === s.subjectId);
    rows.push([s.start, s.end, s.minutes, t ? t.title : (s.title || ''), sub ? sub.name : '', s.quality || '', s.activation || '', (s.distractions || []).join('|'), s.intent || '', s.tracked ? 'stopwatch' : 'pomodoro']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  offerText('focus-sessions.csv', csv, 'Every session you have logged, ready for a spreadsheet or pandas.');
};


/* =====================================================================
   GOOGLE CALENDAR — two-way sync straight from the browser.

   Google Identity Services asks the viewer for calendar access in a popup
   and hands back a short-lived access token (about an hour). The page then
   talks to the Calendar API directly; no server, no connector, and the token
   is only ever held in memory and in this tab's sessionStorage.

   In:  events from the calendars ticked in the card show up read-only in the
        planner and count as busy time for the auto-scheduler.
   Out: blocks made here (by hand or by the auto-scheduler) are created in
        the chosen Google calendar, updated when edited here, and deleted
        when deleted here. S.gcal.links maps each local block id to its
        Google event; every pushed event also carries the block id in
        extendedProperties.private.studyPackId, so it is never shown twice
        and another device can adopt it. Blocks imported from an .ics file
        came from a calendar already and are never pushed back.

   Scopes: calendar.events (see and edit events) and
   calendar.calendarlist.readonly (list the calendars to pick from).
   ===================================================================== */
const GCAL_SCOPES = ['https://www.googleapis.com/auth/calendar.events',
                     'https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
const GCAL_API = 'https://www.googleapis.com/calendar/v3';
const GCAL_TOKEN_KEY = CFG.storageKey + '.gcal-token';
const GCAL_COLORS = { study:'6', break:'2', class:'9' };          // Google's tangerine, sage, blueberry
const GCAL = { state:'idle', cals:[], events:{}, error:null, lastAt:null, lastPushAt:null, busy:false,
               token:null, exp:0, canList:false, pushing:false, pushT:null, planSig:null };
const enc = encodeURIComponent;
const gcalReady = () => !!CFG.googleClientId;
const gcalTokenValid = () => !!GCAL.token && Date.now() < GCAL.exp - 60000;

function gcalLoadToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(GCAL_TOKEN_KEY) || 'null');
    if (t && t.exp > Date.now() + 60000) { GCAL.token = t.token; GCAL.exp = t.exp; GCAL.canList = !!t.canList; }
  } catch (e) {}
}
function gcalStoreToken() {
  try {
    if (GCAL.token) sessionStorage.setItem(GCAL_TOKEN_KEY, JSON.stringify({ token:GCAL.token, exp:GCAL.exp, canList:GCAL.canList }));
    else sessionStorage.removeItem(GCAL_TOKEN_KEY);
  } catch (e) {}
}

/* The Google Identity Services script, loaded ahead of time so the click
   that opens the consent popup is not spent waiting on the network. */
let gisLoading = null;
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisLoading || (gisLoading = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = ok; s.onerror = () => { gisLoading = null; no(new Error('Google sign-in did not load')); };
    document.head.appendChild(s);
  }));
}
const gErr = (message, extra) => Object.assign(new Error(message), extra || {});

/* Opens Google's consent popup. Call it straight from a click. */
function gcalAuthorize() {
  return new Promise((ok, no) => {
    if (!(window.google && google.accounts && google.accounts.oauth2)) { no(gErr('Google sign-in is still loading — press the button again.', { code:'gis_loading' })); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CFG.googleClientId,
      scope: GCAL_SCOPES.join(' '),
      include_granted_scopes: true,
      prompt: '',
      login_hint: (AUTH.user && AUTH.user.email) || undefined,
      callback: r => {
        if (r.error) { no(gErr(r.error_description || r.error, { code:r.error })); return; }
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, GCAL_SCOPES[0])) {
          no(gErr('Calendar access was not granted. Try again and tick the calendar box on Google’s screen.', { code:'scope_denied' })); return;
        }
        GCAL.token = r.access_token;
        GCAL.exp = Date.now() + (+r.expires_in || 3600) * 1000;
        GCAL.canList = google.accounts.oauth2.hasGrantedAllScopes(r, GCAL_SCOPES[1]);
        gcalStoreToken(); ok();
      },
      error_callback: e => no(gErr(e && e.message || 'The Google window closed', { code:e && e.type }))
    });
    client.requestAccessToken();
  });
}
async function gFetch(path, opts) {
  if (!gcalTokenValid()) throw gErr('Google access has expired.', { code:'expired' });
  const o = opts || {};
  const r = await fetch(GCAL_API + path, Object.assign({}, o, {
    headers: Object.assign({ Authorization:'Bearer ' + GCAL.token }, o.body ? { 'Content-Type':'application/json' } : {})
  }));
  if (r.status === 401) { GCAL.token = null; gcalStoreToken(); throw gErr('Google access has expired.', { code:'expired' }); }
  if (r.status === 204) return null;
  const data = await r.json().catch(() => null);
  if (!r.ok) throw gErr((data && data.error && data.error.message) || ('Google answered ' + r.status), { status:r.status });
  return data;
}
function gcalEventsFor(k) {
  if (!S.gcal.on) return [];
  const out = [];
  S.gcal.cals.forEach(id => (GCAL.events[id] || []).forEach(e => { if (e.dayKey === k) out.push(e); }));
  return out;
}
function normaliseGoogle(payload, calId) {
  const list = (payload && payload.events) || [];
  const out = [];
  list.forEach(e => {
    if (e.status === 'cancelled') return;
    const rawS = e.start && (e.start.dateTime || e.start.date);
    if (!rawS) return;
    const allDay = !(e.start && e.start.dateTime);
    const start = allDay ? keyToDate(rawS.slice(0, 10)) : new Date(rawS);
    const rawE = e.end && (e.end.dateTime || e.end.date);
    const end = rawE ? (allDay ? keyToDate(rawE.slice(0, 10)) : new Date(rawE)) : new Date(+start + 3600000);
    if (isNaN(+start)) return;
    if (S.gcal.hideDeclined) {
      const me = (e.attendees || []).find(a => a.self);
      if (me && me.responseStatus === 'declined') return;
    }
    out.push({
      id: 'g:' + calId + ':' + e.id, source:'google', calId,
      title: e.summary || '(no title)', allDay,
      start: start.toISOString(), end: end.toISOString(), dayKey: dayKey(start),
      free: e.transparency === 'transparent' || allDay,
      kind: e.eventType === 'focusTime' ? 'gfocus' : 'gcal',
      link: e.htmlLink || '', location: e.location || ''
    });
  });
  return out;
}
const pushedId = e => e && e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.studyPackId;

async function gcalLoadCalendars() {
  if (GCAL.canList) {
    const d = await gFetch('/users/me/calendarList?minAccessRole=reader&maxResults=100');
    GCAL.cals = (d.items || []).map(c => ({ id:c.id, summary:c.summaryOverride || c.summary || c.id, primary:!!c.primary,
      color:c.backgroundColor || '', writable:c.accessRole === 'owner' || c.accessRole === 'writer' }));
  } else {
    GCAL.cals = [{ id:'primary', summary:'Your main calendar', primary:true, color:'', writable:true }];
  }
  const main = GCAL.cals.find(c => c.primary) || GCAL.cals[0];
  const known = id => GCAL.cals.some(c => c.id === id);
  S.gcal.cals = S.gcal.cals.filter(known);
  if (!S.gcal.cals.length && main) S.gcal.cals = [main.id];
  if (!GCAL.cals.some(c => c.id === S.gcal.target && c.writable) && main) S.gcal.target = main.id;
}
/* Pull the visible week from every ticked calendar. Events this planner
   pushed are skipped (the local block already shows), and adopted into
   S.gcal.links if this device did not know about them. */
async function gcalFetchWeek() {
  const from = new Date(weekAnchor), to = new Date(+weekAnchor + 7 * DAY);
  const q = `timeMin=${enc(from.toISOString())}&timeMax=${enc(to.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const next = {};
  let adopted = false;
  for (const id of S.gcal.cals) {
    const d = await gFetch(`/calendars/${enc(id)}/events?${q}`);
    const items = (d && d.items) || [];
    items.forEach(e => {
      const lid = pushedId(e);
      if (lid && !S.gcal.links[lid] && S.events.some(x => x.id === lid)) { S.gcal.links[lid] = { id:e.id, cal:id, sig:null }; adopted = true; }
    });
    next[id] = normaliseGoogle({ events: items.filter(e => !pushedId(e)) }, id);
  }
  GCAL.events = next; GCAL.lastAt = Date.now(); GCAL.state = 'live'; GCAL.error = null;
  if (adopted) save();
}

const gcalSig = ev => [ev.title, ev.start, ev.end, ev.kind, ev.subjectId || ''].join('|');
const gcalPushable = ev => ev.origin !== 'ics' && new Date(ev.end) > new Date(Date.now() - 7 * DAY);
function gcalBody(ev) {
  const sub = S.subjects.find(s => s.id === ev.subjectId);
  return {
    summary: ev.title,
    description: `Planned in ${CFG.appName}` + (sub ? ` · ${sub.name}` : '') + ` · ${EV_KINDS[ev.kind] || 'Block'}. Edit it in the planner — changes made here are replaced on the next sync.`,
    start: { dateTime: ev.start }, end: { dateTime: ev.end },
    colorId: GCAL_COLORS[ev.kind],
    extendedProperties: { private: { studyPackId: ev.id } }
  };
}
/* Make Google match the planner: create, update and delete linked events. */
async function gcalPush() {
  if (GCAL.pushing || !S.gcal.on || !S.gcal.push || S.meta.sample || !gcalTokenValid()) return null;
  GCAL.pushing = true; renderGcal();
  const n = { made:0, changed:0, removed:0 };
  const links = S.gcal.links;
  const planSig = gcalPlanSig();
  try {
    const live = new Set(S.events.map(e => e.id));
    for (const [lid, l] of Object.entries(links)) {
      if (live.has(lid)) continue;
      try { await gFetch(`/calendars/${enc(l.cal)}/events/${enc(l.id)}`, { method:'DELETE' }); }
      catch (e) { if (![404, 410].includes(e.status)) throw e; }
      delete links[lid]; n.removed++;
    }
    for (const ev of S.events) {
      if (!gcalPushable(ev)) continue;
      const sig = gcalSig(ev), l = links[ev.id];
      if (l && l.sig === sig) continue;
      if (l) {
        try {
          await gFetch(`/calendars/${enc(l.cal)}/events/${enc(l.id)}`, { method:'PATCH', body:JSON.stringify(gcalBody(ev)) });
          l.sig = sig; n.changed++; continue;
        } catch (e) { if (![404, 410].includes(e.status)) throw e; delete links[ev.id]; }   // gone in Google: make it again
      }
      const cal = S.gcal.target || 'primary';
      const g = await gFetch(`/calendars/${enc(cal)}/events`, { method:'POST', body:JSON.stringify(gcalBody(ev)) });
      links[ev.id] = { id:g.id, cal, sig }; n.made++;
    }
    GCAL.planSig = planSig; GCAL.lastPushAt = Date.now(); GCAL.error = null;
  } catch (e) { gcalFail(e); }
  finally {
    GCAL.pushing = false;
    if (n.made || n.changed || n.removed) save();
    renderGcal();
  }
  return n;
}
function gcalPlanSig() { return JSON.stringify(S.events.map(e => [e.id, gcalSig(e)])); }
/* Called from save(): send planner changes a moment after they settle. */
function gcalQueuePush() {
  if (!S.gcal || !S.gcal.on || !S.gcal.push || !gcalTokenValid()) return;
  clearTimeout(GCAL.pushT);
  GCAL.pushT = setTimeout(() => { if (gcalPlanSig() !== GCAL.planSig) gcalPush(); }, 1500);
}
function gcalFail(err) {
  GCAL.error = err || gErr('Unknown failure');
  GCAL.state = err && err.code === 'expired' ? 'expired' : 'stale';
  if (view === 'plan') renderCalendar();
  renderFocusSide(); renderGcal();
}
async function gcalRefresh() {
  if (!S.gcal.on || !gcalTokenValid()) { renderGcal(); return; }
  GCAL.busy = true; renderGcal();
  try {
    if (!GCAL.cals.length) await gcalLoadCalendars();
    await gcalFetchWeek();
  } catch (e) { gcalFail(e); }
  GCAL.busy = false;
  if (view === 'plan') renderCalendar();
  renderFocusSide(); renderGcal();
}
/* Week navigation and demo loading call this; it refreshes when it can. */
function gcalSubscribe() { if (S.gcal.on && gcalTokenValid()) gcalRefresh(); }

function gcalAuthFailed(e) {
  const code = e && e.code;
  if (code === 'popup_closed' || code === 'access_denied') return;        // the viewer changed their mind
  toast(code === 'popup_failed_to_open'
    ? 'Your browser blocked the Google window. Allow pop-ups for this site, then press the button again.'
    : (e && e.message) || 'Google did not grant calendar access.', 5000);
}
async function gcalConnect() {
  try { await gcalAuthorize(); } catch (e) { gcalAuthFailed(e); return; }
  GCAL.busy = true; renderGcal();
  try {
    await gcalLoadCalendars();
    S.gcal.on = true; S.gcal.push = S.gcal.push !== false;
    save();
    await gcalFetchWeek();
    GCAL.busy = false;
    const n = await gcalPush();
    toast('Google Calendar connected' + (n && n.made ? ` — ${plural(n.made, 'block')} sent to Google` : ''));
  } catch (e) { gcalFail(e); }
  GCAL.busy = false;
  renderCalendar(); renderFocusSide(); renderGcal();
}
async function gcalSyncNow() {
  if (!S.gcal.on) return;
  if (!gcalTokenValid()) { try { await gcalAuthorize(); } catch (e) { gcalAuthFailed(e); return; } }
  await gcalRefresh();
  const n = await gcalPush();
  if (GCAL.state === 'live') toast(n && (n.made || n.changed || n.removed)
    ? `Synced — ${[n.made && n.made + ' sent', n.changed && n.changed + ' updated', n.removed && n.removed + ' removed'].filter(Boolean).join(', ')}`
    : 'Up to date with Google');
}
function gcalDisconnect() {
  try { if (GCAL.token && window.google && google.accounts) google.accounts.oauth2.revoke(GCAL.token, () => {}); } catch (e) {}
  GCAL.token = null; gcalStoreToken();
  S.gcal.on = false; GCAL.events = {}; GCAL.cals = []; GCAL.error = null; GCAL.state = 'idle'; save();
  renderGcal(); renderCalendar(); renderFocusSide();
  toast('Disconnected — blocks already in Google stay there, and your planner is untouched');
}
/* Delete every event this planner put in Google, and stop sending new ones. */
async function gcalRemoveAll() {
  if (!gcalTokenValid()) { try { await gcalAuthorize(); } catch (e) { gcalAuthFailed(e); return; } }
  let n = 0;
  try {
    for (const [lid, l] of Object.entries(S.gcal.links)) {
      try { await gFetch(`/calendars/${enc(l.cal)}/events/${enc(l.id)}`, { method:'DELETE' }); }
      catch (e) { if (![404, 410].includes(e.status)) throw e; }
      delete S.gcal.links[lid]; n++;
    }
    S.gcal.push = false; save();
    toast(`Removed ${plural(n, 'block')} from Google. Sending is off until you turn it back on.`);
  } catch (e) { save(); gcalFail(e); }
  renderGcal();
}
function gcalReset() {
  clearTimeout(GCAL.pushT);
  GCAL.token = null; GCAL.exp = 0; gcalStoreToken();
  Object.assign(GCAL, { state:'idle', cals:[], events:{}, error:null, lastAt:null, lastPushAt:null, busy:false, planSig:null });
}
function agoLabel(ts) {
  if (!ts) return 'never';
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 min ago' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
}
function renderGcal() {
  const box = $('#gcalCard'); if (!box) return;
  const valid = gcalTokenValid();
  const head = '<div class="panel-head"><h3>Google Calendar</h3>' +
    (S.gcal.on ? `<button class="btn sm ghost" id="gSync" ${GCAL.busy || GCAL.pushing ? 'disabled' : ''}>${GCAL.busy || GCAL.pushing ? 'Syncing…' : 'Sync now'}</button>`
               : '<span class="eyebrow">two-way</span>') + '</div>';
  let body = '';
  if (!gcalReady()) {
    body = `<p style="font-size:12px;color:var(--muted);margin:0">Google Calendar sync is not set up on this copy of the app. The .ics bridge below still brings your week in and out.</p>`;
  } else if (!S.gcal.on) {
    body = `<p style="font-size:12px;color:var(--muted);margin:0 0 10px">Your Google events appear in the planner and the auto-scheduler works around them. Blocks you plan here are added to your Google Calendar, and edits and deletions follow them.</p>
      <button class="btn primary" id="gConnect" style="width:100%;justify-content:center">${GCAL.busy ? 'Connecting…' : 'Connect Google Calendar'}</button>
      <p style="font-size:11px;color:var(--muted);line-height:1.5;margin:9px 0 0">Google asks you to allow calendar access in a popup. Until Google finishes reviewing this app it also says the app is <em>unverified</em>: choose <strong>Advanced</strong>, then continue. Access lasts about an hour at a time and is never stored on a server.</p>`;
  } else {
    const pushed = Object.keys(S.gcal.links).length;
    const count = S.gcal.cals.reduce((a, id) => a + (GCAL.events[id] || []).length, 0);
    const colour = !valid ? 'var(--alert)' : GCAL.state === 'live' ? 'var(--good)' : 'var(--alert)';
    const status = !valid ? 'Connected — press Sync now to refresh (Google’s access lasts about an hour)'
      : GCAL.busy && !GCAL.lastAt ? 'Reading your calendar…'
      : `${plural(count, 'Google event')} this week · ${plural(pushed, 'block')} in Google · updated ${agoLabel(GCAL.lastAt)}`;
    body = `<div class="gstat"><span class="dot" style="background:${colour}"></span><span>${esc(status)}</span></div>`;
    if (GCAL.error && GCAL.error.code !== 'expired') body += `<div class="gerr"><strong>Google Calendar did not answer as expected</strong>${esc(GCAL.error.message || String(GCAL.error))}</div>`;
    if (valid && GCAL.cals.length) {
      body += '<div class="eyebrow" style="margin:4px 0 2px">Show in the planner</div>';
      body += '<div class="callist">' + GCAL.cals.map(c => `<label><input type="checkbox" data-cal="${esc(c.id)}" ${S.gcal.cals.includes(c.id) ? 'checked' : ''}>
          <span class="swatch" style="background:${esc(c.color || 'var(--muted)')}"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.summary)}</span></label>`).join('') + '</div>';
      const writable = GCAL.cals.filter(c => c.writable);
      body += `<div class="field" style="margin:4px 0 8px"><label for="gTarget">Send my blocks to</label><select id="gTarget">${writable.map(c =>
          `<option value="${esc(c.id)}" ${c.id === S.gcal.target ? 'selected' : ''}>${esc(c.summary)}</option>`).join('')}</select></div>`;
    }
    body += `<div class="switch-row" style="padding:6px 0"><div><div class="lbl" style="font-size:12.5px">Send my blocks to Google</div>
        <div class="hint">New, edited and deleted blocks follow automatically. Blocks imported from .ics stay here.</div></div>
        <input type="checkbox" id="gPush" ${S.gcal.push ? 'checked' : ''}></div>`;
    body += `<div class="switch-row" style="padding:6px 0"><div class="lbl" style="font-size:12.5px">Hide events I declined</div>
        <input type="checkbox" id="gDeclined" ${S.gcal.hideDeclined ? 'checked' : ''}></div>`;
    body += `<p style="font-size:11.5px;color:var(--muted);margin:8px 0 10px">Google events are read-only here — change them in Google. Blocks from this planner are managed here; edit them in the planner, not in Google.</p>`;
    body += `<div style="display:flex;gap:8px"><button class="btn sm" id="gOff" style="flex:1;justify-content:center">Disconnect</button>`
      + (pushed ? `<button class="btn sm ghost" id="gWipe" style="flex:1;justify-content:center" data-tip="Deletes the ${pushed} events this planner created in Google">Remove my blocks</button>` : '') + '</div>';
  }
  box.innerHTML = head + body;
  const c = $('#gConnect'); if (c) c.onclick = gcalConnect;
  const sy = $('#gSync'); if (sy) sy.onclick = gcalSyncNow;
  const off = $('#gOff'); if (off) off.onclick = gcalDisconnect;
  const wipe = $('#gWipe'); if (wipe) wipe.onclick = () => openModal('Remove your blocks from Google?',
    `<p style="font-size:12.5px;margin:0">This deletes the ${plural(Object.keys(S.gcal.links).length, 'event')} this planner created in Google Calendar and turns sending off. Your blocks in the planner and every other Google event stay as they are.</p>`,
    [{ label:'Keep them' }, { label:'Remove from Google', onClick: () => { gcalRemoveAll(); } }]);
  const tg = $('#gTarget'); if (tg) tg.onchange = e => { S.gcal.target = e.target.value; save(); toast('New blocks will go to ' + e.target.selectedOptions[0].textContent); };
  const ps = $('#gPush'); if (ps) ps.onchange = e => { S.gcal.push = e.target.checked; GCAL.planSig = null; save(); if (S.gcal.push) gcalPush(); };
  const dec = $('#gDeclined'); if (dec) dec.onchange = e => { S.gcal.hideDeclined = e.target.checked; save(); gcalRefresh(); };
  $$('#gcalCard [data-cal]').forEach(cb => cb.onchange = () => {
    const id = cb.dataset.cal;
    S.gcal.cals = cb.checked ? S.gcal.cals.concat([id]) : S.gcal.cals.filter(x => x !== id);
    if (!cb.checked) delete GCAL.events[id];
    save(); gcalRefresh(); renderCalendar(); renderFocusSide();
  });
}
/* After a workspace loads: pick up a token from earlier in this tab, pull
   the week, and send anything planned while access had lapsed. */
function gcalAfterLoad() {
  if (!gcalReady()) { renderGcal(); return; }
  loadGis().catch(() => {});
  gcalLoadToken();
  if (S.gcal.on && gcalTokenValid()) gcalRefresh().then(() => gcalPush());
  else renderGcal();
}
function gcalBoot() {
  if (!gcalReady()) { renderGcal(); return; }
  loadGis().catch(() => {});
  setInterval(() => { if (S.gcal.on && gcalTokenValid() && !GCAL.busy && !GCAL.pushing) gcalRefresh(); }, 300000);
  renderGcal();
}

/* =====================================================================
   SETTINGS + DATA
   ===================================================================== */
const TIMER_PRESETS = Object.assign({
  'Classic 25/5':      { focus:25, short:5,  long:15, cycles:4 },
  'Short burst 15/3':  { focus:15, short:3,  long:12, cycles:4 },
  'Deep work 50/10':   { focus:50, short:10, long:25, cycles:2 },
  'Ultradian 90/20':   { focus:90, short:20, long:30, cycles:2 },
  'Two-minute start':  { focus:10, short:5,  long:15, cycles:4 }
}, CFG.timerPresets || {});
function renderSettings() {
  $('#durFields').innerHTML = [
    ['focus','Focus interval','minutes'], ['short','Short break','minutes'],
    ['long','Long break','minutes'], ['cycles','Focus intervals before a long break','count']
  ].map(([k, label, unit]) => `<div class="field"><label for="set_${k}">${label} <span style="color:var(--muted)">(${unit})</span></label>
      <input type="number" id="set_${k}" min="1" max="${k === 'cycles' ? 12 : 180}" value="${S.settings[k]}"></div>`).join('');
  ['focus','short','long','cycles'].forEach(k => $('#set_' + k).onchange = e => {
    S.settings[k] = clamp(+e.target.value || 1, 1, k === 'cycles' ? 12 : 180);
    save(); if (!T.running) setPhase(T.phase, false); renderPips(); renderDial();
  });
  const rows = [
    ['autoBreak','Start breaks automatically','The bell rings and the break is already running — no decision needed.'],
    ['autoFocus','Start the next focus automatically','Off by default: coming back should be a choice you make.'],
    ['checkinAfter','Ask how it went','A ten-second rating after each interval. This is what fills the charts.'],
    ['moveBreak','Suggest a movement snack','A physical prompt at every break, because sitting through the break defeats it.'],
    ['titleClock','Countdown in the browser tab','Time stays visible even when the tab is behind something else.'],
    ['hideSeconds','Hide the seconds','Round to the minute while running — some people watch seconds tick and lose the thread.'],
    ['chime','Chime at the bell',''],
    ['notify','Desktop notifications','Needs one permission click from your browser.']
  ];
  $('#behaviourRows').innerHTML = rows.map(([k, lbl, hint]) => `<div class="switch-row">
      <div><div class="lbl">${lbl}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>
      <input type="checkbox" id="beh_${k}" ${S.settings[k] ? 'checked' : ''}></div>`).join('')
    + `<div class="field" style="margin-top:10px"><label for="chimeVol">Chime volume <span class="num">${S.settings.chimeVol}</span></label>
       <input type="range" id="chimeVol" min="0" max="100" value="${S.settings.chimeVol}"></div>`;
  rows.forEach(([k]) => $('#beh_' + k).onchange = e => {
    S.settings[k] = e.target.checked; save();
    if (k === 'notify' && e.target.checked && window.Notification) Notification.requestPermission().then(p => { if (p !== 'granted') { S.settings.notify = false; save(); renderSettings(); toast('Notifications stayed blocked'); } });
    if (k === 'chime' && e.target.checked) chime('up');
  });
  $('#chimeVol').oninput = e => { S.settings.chimeVol = +e.target.value; save(); };
  $('#chimeVol').onchange = () => chime('up');
  $('#themeRow').innerHTML = ['auto','light','dark'].map(t => `<button class="scale-btn ${S.settings.theme === t ? 'on' : ''}" data-theme-set="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  $$('#themeRow [data-theme-set]').forEach(b => b.onclick = () => { S.settings.theme = b.dataset.themeSet; applyTheme(); save(); renderSettings(); });
  $('#accentRow').innerHTML = [['focus','Ember'],['rest','Moss'],['long','Iris'],['alert','Amber']].map(([k, n]) =>
    `<button class="scale-btn ${S.settings.accent === k ? 'on' : ''}" data-accent-set="${k}"><span class="dot" style="background:var(--${k});display:inline-block;margin-right:5px"></span>${n}</button>`).join('');
  $$('#accentRow [data-accent-set]').forEach(b => b.onclick = () => { S.settings.accent = b.dataset.accentSet; applyTheme(); save(); renderSettings(); });
  $('#appearanceRows').innerHTML = `<p style="font-size:12px;color:var(--muted);margin:12px 0 0">The page also follows your system theme on its own — "Auto" means it flips when your OS does.</p>`;
  const bytes = STORE.bytes() || JSON.stringify(S).length;
  $('#storageInfo').textContent = `${S.sessions.length} sessions · ${S.tasks.length} tasks · ${S.notes.length} notes · ${S.events.length} blocks — about ${(bytes / 1024).toFixed(1)} KB in ${STORE.label()}.`;
  $('#dataExtra').innerHTML = (CFG.demo && !S.meta.sample)
    ? `<button class="btn" id="demoBtn" style="width:100%;justify-content:center;margin-top:8px">Load a demo workspace</button>
       <p style="font-size:11.5px;color:var(--muted);margin:7px 0 0">Three weeks of generated sessions so you can see the charts working. It is stamped as demo data and clears in one click — nothing is ever seeded without you asking.</p>`
    : (S.meta.sample ? `<button class="btn" id="demoClearBtn" style="width:100%;justify-content:center;margin-top:8px">Clear the demo workspace</button>` : '');
  const db = $('#demoBtn'); if (db) db.onclick = loadDemo;
  const dc = $('#demoClearBtn'); if (dc) dc.onclick = clearDemo;
  renderAccountCard(); renderStorageCard(); renderListsCard(); renderEmbedCard();
  $('#dayStart').value = S.settings.dayStart; $('#dayEnd').value = S.settings.dayEnd;
}
$('#presetsBtn').onclick = () => openModal('Interval presets', `<div class="stack">${Object.entries(TIMER_PRESETS).map(([n, p]) =>
  `<button class="btn" style="justify-content:space-between" data-preset2="${esc(n)}"><span>${esc(n)}</span>
    <span class="num" style="color:var(--muted);font-size:11px">${p.focus}/${p.short}/${p.long} ×${p.cycles}</span></button>`).join('')}</div>
  <p style="font-size:12px;color:var(--muted);margin:0">If 25 minutes feels impossible on a bad day, drop to "Two-minute start". Starting is the whole game; length is negotiable.</p>`,
  [{ label:'Close' }], body => {
    $$('[data-preset2]', body).forEach(b => b.onclick = () => {
      Object.assign(S.settings, TIMER_PRESETS[b.dataset.preset2]); save();
      if (!T.running) setPhase(T.phase, false);
      renderSettings(); renderPips(); renderDial(); closeModal(); toast(b.dataset.preset2 + ' set');
    });
  });
$('#exportBtn').onclick = () => offerText('focus-dial-backup.json', JSON.stringify(S, null, 2),
  'Your whole workspace — settings, sessions, tasks, notes, blocks. Keep it somewhere safe; it is also what a desktop build would read.');
$('#importBtn').onclick = () => openModal('Import a backup', `
  <div class="field"><label for="impBox">Paste the JSON backup</label><textarea id="impBox" rows="7" placeholder="{ &quot;settings&quot;: … }"></textarea></div>
  <button class="btn" id="impFile" style="justify-content:center">Choose a .json file instead</button>
  <p style="font-size:12px;color:var(--crit);margin:0">This replaces everything currently in the browser.</p>`,
  [{ label:'Cancel' }, { label:'Replace everything', primary:true, onClick: () => {
    try {
      window.FocusDial.importJSON($('#impBox').value); applyTheme();
      toast('Backup restored');
    } catch (e) { toast('That did not parse as a Focus Dial backup'); return false; }
  } }], body => { $('#impFile', body).onclick = () => pickFile('.json', txt => { $('#impBox').value = txt; toast('File loaded — press Replace'); }); });
$('#resetBtn2').onclick = () => openModal('Erase everything?', `
  <p style="font-size:13px;margin:0">This deletes every session, task, note and block in this browser. There is no undo, and no copy on any server.</p>
  <p style="font-size:12.5px;color:var(--muted);margin:0">Export a backup first if there is any doubt.</p>`,
  [{ label:'Keep my data' }, { label:'Erase it all', onClick: () => {
    window.FocusDial.wipe().then(() => { applyTheme(); toast('Cleared'); });
  } }]);
/* Demo blocks are never sent to Google (gcalPush skips a sample workspace),
   and loading or clearing the demo forgets existing Google links rather than
   letting the next sync delete the real events they point to. */
function clearDemo() {
  S.gcal.links = {};
  S.sessions = []; S.checkins = []; S.notes = []; S.tasks = []; S.events = []; S.subjects = [];
  S.meta.sample = false; S.meta.notice = null; S.timer.taskId = null; S.timer.intent = ''; S.timer.activation = null;
  save(); renderAll(); if (S.gcal.on) gcalSubscribe();
  toast('Clean slate — your Google link and settings are untouched');
}
function loadDemo() {
  S.gcal.links = {};
  seedDemo(); S.meta.notice = null;
  setPhase(S.timer.phase || 'focus', false);
  renderAll(); if (S.gcal.on) gcalSubscribe();
  toast('Demo workspace loaded — clear it whenever');
}

/* =====================================================================
   COMMAND PALETTE + KEYBOARD
   ===================================================================== */
const COMMANDS = () => [
  { k:'Start / pause timer', s:'Space', run:toggleRun },
  { k:'Skip to next interval', s:'N', run:skipPhase },
  { k:'Reset this interval', s:'R', run:resetInterval },
  { k:'Start / stop the stopwatch on the session task', s:'T', run:toggleTracking },
  { k:'Park a thought', s:'B', run:brainDump },
  { k:'Log a distraction', s:'D', run:() => $('#tallyBtn').click() },
  { k:'Toggle the sound mix', s:'M', run:() => $('#soundBtn').click() },
  { k:'Silence all sound', s:'', run:silenceAll },
  { k:'Sort unsorted tasks on the matrix', s:'P', run:triage },
  { k:'Go to Focus', s:'1', run:() => go('focus') },
  { k:'Go to Plan', s:'2', run:() => go('plan') },
  { k:'Go to Tasks', s:'3', run:() => go('tasks') },
  { k:'Go to Priority matrix', s:'4', run:() => go('matrix') },
  { k:'Go to Notes', s:'5', run:() => go('notes') },
  { k:'Go to Sound', s:'6', run:() => go('sound') },
  { k:'Go to Calm', s:'7', run:() => go('calm') },
  { k:'Go to Statistics', s:'8', run:() => go('stats') },
  { k:'Go to Setup', s:'9', run:() => go('settings') },
  { k:'Auto-schedule this week', s:'', run:() => { go('plan'); $('#autoPlan').click(); } },
  { k:'Sync Google Calendar now', s:'', run:() => { go('plan'); gcalSyncNow(); } },
  { k:'Import an .ics file', s:'', run:() => { go('plan'); $('#icsImportBtn').click(); } },
  { k:'Export everything (JSON)', s:'', run:() => $('#exportBtn').click() },
  { k:'Start a breathing round', s:'', run:() => { go('calm'); $('#breathBtn').click(); } },
  { k:'Switch theme', s:'', run:() => $('#themeBtn').click() }
];
let cmdSel = 0, cmdRows = [];
function openCmd() {
  $('#cmdScrim').classList.add('on'); $('#cmdInput').value = ''; cmdSel = 0; fillCmd('');
  setTimeout(() => $('#cmdInput').focus(), 30);
}
function closeCmd() { $('#cmdScrim').classList.remove('on'); }
function fillCmd(q) {
  cmdRows = COMMANDS().filter(c => c.k.toLowerCase().includes(q.toLowerCase()));
  cmdSel = clamp(cmdSel, 0, Math.max(0, cmdRows.length - 1));
  $('#cmdList').innerHTML = cmdRows.map((c, i) => `<div class="cmd ${i === cmdSel ? 'sel' : ''}" data-i="${i}">${esc(c.k)}<span class="k">${c.s}</span></div>`).join('')
    || '<div class="cmd" style="color:var(--muted)">Nothing matches</div>';
  $$('#cmdList .cmd[data-i]').forEach(r => r.onclick = () => { const c = cmdRows[+r.dataset.i]; closeCmd(); c.run(); });
}
$('#cmdBtn').onclick = openCmd;
$('#cmdInput').oninput = e => fillCmd(e.target.value);
$('#cmdScrim').addEventListener('click', e => { if (e.target.id === 'cmdScrim') closeCmd(); });
$('#cmdInput').onkeydown = e => {
  if (e.key === 'ArrowDown') { cmdSel = Math.min(cmdSel + 1, cmdRows.length - 1); fillCmd($('#cmdInput').value); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { cmdSel = Math.max(0, cmdSel - 1); fillCmd($('#cmdInput').value); e.preventDefault(); }
  else if (e.key === 'Enter') { const c = cmdRows[cmdSel]; if (c) { closeCmd(); c.run(); } }
};
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmd(); return; }
  if (e.key === 'Escape') { closeCmd(); closeModal(); return; }
  if (document.querySelector('.scrim.on')) return;
  const typing = /input|textarea|select/i.test(document.activeElement.tagName);
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const map = { '1':'focus','2':'plan','3':'tasks','4':'matrix','5':'notes','6':'sound','7':'calm','8':'stats','9':'settings' };
  if (map[e.key]) { go(map[e.key]); return; }
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); toggleRun(); }
  else if (k === 'n') skipPhase();
  else if (k === 'r') resetInterval();
  else if (k === 'b') brainDump();
  else if (k === 'd') $('#tallyBtn').click();
  else if (k === 'm') $('#soundBtn').click();
  else if (k === 'p') triage();
  else if (k === 't') toggleTracking();
});
$('#runBtn').onclick = toggleRun;
$('#skipBtn').onclick = skipPhase;
$('#resetBtn').onclick = resetInterval;

/* =====================================================================
   DEMO WORKSPACE — never loaded on its own. It exists only behind an
   explicit button, is stamped meta.sample, and is one click to erase.
   ===================================================================== */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedDemo() {
  const r = rng(20260903);
  const pick = a => a[Math.floor(r() * a.length)];
  S.subjects = [
    { id:'s1', name:'Vision-Language Models', targetHours:8, priority:3, color:SUB_COLORS[0] },
    { id:'s2', name:'Convex Optimization',    targetHours:5, priority:2, color:SUB_COLORS[1] },
    { id:'s3', name:'Thesis writing',         targetHours:6, priority:3, color:SUB_COLORS[2] },
    { id:'s4', name:'Reading group',          targetHours:2, priority:1, color:SUB_COLORS[3] }
  ];
  S.tasks = [
    { id:'t1', title:'Re-run the floorplan grounding eval on the held-out split', est:3, energy:'high', subjectId:'s1', quad:'q2', done:false, done_pomos:1, created:Date.now() },
    { id:'t2', title:'Write the related-work paragraph on spatial graph construction', est:4, energy:'high', subjectId:'s3', quad:'q2', done:false, done_pomos:0, created:Date.now() },
    { id:'t3', title:'Problem set 4 — duality, questions 1–3', est:2, energy:'med', subjectId:'s2', quad:'q1', done:false, done_pomos:0, created:Date.now() },
    { id:'t4', title:'Skim the two nav-instruction papers for Thursday', est:1, energy:'low', subjectId:'s4', quad:'q3', done:false, done_pomos:0, created:Date.now() },
    { id:'t5', title:'Clean up the YOLO inference wrapper and pin versions', est:2, energy:'low', subjectId:'s1', quad:null, done:false, done_pomos:0, created:Date.now() },
    { id:'t6', title:'Email the committee about the proposal date', est:1, energy:'high', subjectId:'s3', quad:'q1', done:false, done_pomos:0, created:Date.now() },
    { id:'t8', title:'Re-tag the whole reference manager library', est:3, energy:'low', subjectId:null, quad:'q4', done:false, done_pomos:0, created:Date.now() },
    { id:'t7', title:'Redo figure 3 with the corrected axis labels', est:1, energy:'med', subjectId:'s3', quad:'q1', done:true, done_pomos:1, created:Date.now() }
  ];
  const wk = startOfWeek(new Date());
  const at = (day, h, m, dur, title, kind, sub) => {
    const s = new Date(+wk + day * DAY); s.setHours(h, m, 0, 0);
    return { id:uid(), title, kind, subjectId:sub || null, start:s.toISOString(), end:new Date(+s + dur * 60000).toISOString() };
  };
  S.events = [
    at(0, 10, 0, 90, 'Advanced Deep Learning — lecture', 'class', 's1'),
    at(2, 10, 0, 90, 'Advanced Deep Learning — lecture', 'class', 's1'),
    at(1, 14, 0, 60, 'Lab meeting', 'class', null),
    at(3, 11, 0, 45, 'Advisor 1:1', 'class', 's3'),
    at(4, 16, 0, 60, 'Reading group', 'class', 's4'),
    at(0, 14, 0, 90, 'Vision-Language Models', 'study', 's1'),
    at(1, 9, 30, 90, 'Thesis writing', 'study', 's3'),
    at(2, 15, 0, 60, 'Convex Optimization', 'study', 's2'),
    at(3, 14, 0, 90, 'Vision-Language Models', 'study', 's1'),
    at(4, 9, 30, 60, 'Thesis writing', 'study', 's3'),
    at(1, 18, 0, 60, 'Gym', 'break', null),
    at(3, 18, 0, 60, 'Gym', 'break', null)
  ];
  const NOTES = [
    ['Ask about whether the graph should be metric or topological before I build either', 'note'],
    ['If the eval stalls again: it is the dataloader worker count, not the model', 'note'],
    ['Renew the parking permit', 'parked'],
    ['Idea — ablate the depth branch and see if instruction quality actually drops', 'note'],
    ['Reviewer 2 wanted the failure-mode table. Put it in section 5.', 'note']
  ];
  S.notes = NOTES.map(([text, tag], i) => ({ id:uid(), text, tag, color:NOTE_COLORS[i % NOTE_COLORS.length],
    x:24 + (i % 4) * 214, y:24 + Math.floor(i / 4) * 150, pinned:i === 1, at:Date.now() - i * DAY }));
  const HOURS = [9, 9, 10, 10, 11, 14, 15, 15, 16, 17, 20, 21];
  const today = startOfDay(new Date());
  S.sessions = []; S.checkins = [];
  for (let d = 20; d >= 0; d--) {
    const date = new Date(+today - d * DAY), dow = date.getDay();
    const pool = d === 0 ? HOURS.filter(h => h < new Date().getHours()) : HOURS;
    const skip = pool.length === 0 || (d > 0 && r() < (dow === 0 || dow === 6 ? 0.55 : 0.12));
    if (!skip) {
      const n = dow === 0 || dow === 6 ? 1 + Math.floor(r() * 3) : 2 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const h = pool[Math.floor(r() * pool.length)], mi = Math.floor(r() * 3) * 20;
        const st = new Date(date); st.setHours(h, mi, 0, 0);
        if (st > new Date()) continue;
        const task = pick(S.tasks), partial = r() < 0.13;
        const mins = partial ? 8 + Math.floor(r() * 12) : 25;
        const dcount = Math.floor(r() * 3);
        S.sessions.push({ id:uid(), start:st.toISOString(), end:new Date(+st + mins * 60000).toISOString(),
          minutes:mins, taskId:task.id, subjectId:task.subjectId, intent:'', activation:pick(['low','med','high']),
          quality: r() < 0.85 ? 2 + Math.floor(r() * 4) : null, partial,
          distractions: Array.from({ length:dcount }, () => pick(LIST('distractions'))) });
      }
    }
    if (d < 14) {
      const at2 = new Date(date); at2.setHours(20, 0, 0, 0);
      S.checkins.push({ id:uid(), at:at2.toISOString(), energy:3 + Math.floor(r() * 6),
        stress:2 + Math.floor(r() * 7), focus:3 + Math.floor(r() * 6), note:'', when:'manual' });
    }
  }
  S.sessions.sort((a, b) => new Date(a.start) - new Date(b.start));
  S.timer.taskId = 't1';
  S.timer.intent = 'Get the eval running end to end, even if the numbers are bad.';
  S.timer.activation = 'high';
  S.meta.sample = true;
  save();
}

/* =====================================================================
   EMPTY STATE, STORAGE READOUT, AND THE HOST-PAGE SURFACE
   ===================================================================== */
function hasDemoBackup() {
  try { const w = STORE.web(); return !!(w && w.getItem(CFG.storageKey + '.demo-backup')); } catch (e) { return false; }
}
function restoreDemoBackup() {
  try {
    const w = STORE.web(), raw = w && w.getItem(CFG.storageKey + '.demo-backup');
    if (!raw) { toast('Nothing to restore'); return; }
    S = migrate(JSON.parse(raw)); S.meta.notice = null;
    save(); setPhase(S.timer.phase || 'focus', false); renderAll();
    toast('Restored the previous workspace');
  } catch (e) { toast('That backup could not be read'); }
}
function renderBanner() {
  const b = $('#sampleBanner'); if (!b) return;
  if (S.meta.sample) {
    b.hidden = false;
    b.innerHTML = `<span class="dot" style="background:var(--long)"></span><strong>Demo workspace</strong>
      <span>— generated tasks, blocks and sessions you asked for. None of it is your own history.</span>
      <span class="top-sp"></span><button class="btn sm" id="bannerClear">Clear it</button>`;
    $('#bannerClear').onclick = clearDemo;
  } else if (S.meta.notice === 'demo-cleared') {
    b.hidden = false;
    b.innerHTML = `<span class="dot" style="background:var(--good)"></span><strong>Starting empty</strong>
      <span>— the example data earlier builds seeded themselves with is gone. Every number from here on is yours.</span>
      <span class="top-sp"></span>
      ${hasDemoBackup() ? '<button class="btn sm" id="bannerUndo">Put it back</button>' : ''}
      <button class="btn sm ghost" id="bannerX">Dismiss</button>`;
    const u = $('#bannerUndo'); if (u) u.onclick = restoreDemoBackup;
    $('#bannerX').onclick = () => { S.meta.notice = null; save(); renderBanner(); };
  } else b.hidden = true;
}
/* The first-run panel replaces seeded data: it shows what is missing and
   opens the screen that fills it, then disappears for good. */
function renderQuickStart() {
  const box = $('#quickStart'); if (!box) return;
  const steps = [
    { done:S.tasks.length > 0, t:'Add your first task',
      h:'The smallest next action, not the whole project.', b:'Add a task',
      go:() => { go('tasks'); setTimeout(() => { const f = $('#taskTitle'); if (f) f.focus(); }, 60); } },
    { done:S.subjects.length > 0, t:'Name a course or project',
      h:'Optional. It is what the auto-scheduler packs your week with.', b:'Add a course',
      go:() => { go('plan'); subjectModal(null); } },
    { done:S.events.length > 0 || S.gcal.on, t:'Bring in your real week',
      h:'Link Google Calendar, import an .ics, or draw blocks by hand.', b:'Open the planner',
      go:() => go('plan') },
    { done:S.sessions.length > 0, t:'Run one interval',
      h:'Twenty-five minutes against one named task. That is the whole product.', b:'Start the timer',
      go:() => { go('focus'); start(); } }
  ];
  const done = steps.filter(x => x.done).length;
  if (done === steps.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div class="panel-head"><h3>First run</h3><span class="eyebrow">${done} of ${steps.length}</span></div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 8px">Nothing is filled in for you. Every chart, streak and suggestion in here is computed from what you actually do.</p>
    ${steps.map((x, i) => `<div class="qs-row ${x.done ? 'done' : ''}">
        <span class="qs-tick"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>
        <span class="qs-b"><span class="qs-t">${x.t}</span><span class="qs-h">${x.h}</span></span>
        ${x.done ? '' : `<button class="btn sm" data-qs="${i}">${x.b}</button>`}</div>`).join('')}
    ${(CFG.demo && !S.meta.sample) ? `<button class="btn sm ghost" id="qsDemo" style="width:100%;justify-content:center;margin-top:9px">Or load a demo workspace to look around</button>` : ''}`;
  $$('#quickStart [data-qs]').forEach(b => b.onclick = () => steps[+b.dataset.qs].go());
  const d = $('#qsDemo'); if (d) d.onclick = loadDemo;
}
const STORE_LABELS = {
  idle:   ['var(--muted)', 'Nothing saved yet'],
  loading:['var(--alert)', 'Loading…'],
  pending:['var(--alert)', 'Unsaved'],
  saving: ['var(--alert)', 'Saving…'],
  saved:  ['var(--good)',  'Saved'],
  error:  ['var(--crit)',  'Not saved']
};
function renderStoreChip() {
  const el = $('#storeChip'); if (!el) return;
  const st = STORE_LABELS[STORE.status] || STORE_LABELS.idle;
  el.hidden = (STORE.status === 'idle' && STORE.mode === 'local');
  el.innerHTML = `<span class="dot" style="background:${st[0]}"></span><span>${st[1]}</span>`;
  el.dataset.tip = STORE.label() + (STORE.error ? ' · ' + (STORE.error.message || STORE.error) : '');
  const card = $('#storageCard'); if (card && view === 'settings') renderStorageCard();
}
function renderAccountCard() {
  const box = $('#accountCard'); if (!box) return;
  const u = AUTH.user;
  const how = !u ? 'Not signed in'
    : u.provider === 'google' ? 'Google account'
    : u.provider === 'firebase' ? 'Email and password, verified by Firebase'
    : u.provider === 'none' ? 'Authentication handled by the host page'
    : 'Local profile on this device';
  box.innerHTML = `<div class="panel-head"><h3>Account</h3><span class="eyebrow">${AUTH.mode}</span></div>
    ${u ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span class="av" style="width:34px;height:34px;font-size:13px">${esc(initials(u.name || u.email))}</span>
        <div style="min-width:0"><div style="font-size:13.5px;font-weight:600">${esc(u.name || u.email || 'You')}</div>
        <div style="font-size:11.5px;color:var(--muted)">${esc(u.email || how)}</div></div></div>` : ''}
    <div class="kv"><span>Signed in with</span><strong>${esc(how)}</strong></div>
    <div class="kv"><span>Workspace</span><strong>${esc(STORE.label())}</strong></div>
    ${AUTH.mode === 'local' ? `
      <div class="mx-nudge" style="--q:var(--warn);margin-top:10px">A local profile keeps a shared laptop honest. It is <strong>not</strong> security: this page's source is readable, so anyone determined can get past it. Point <code>firebase</code> at a project in the config block for real accounts, Google sign-in and per-user server rules.</div>
      <div style="display:flex;gap:8px;margin-top:11px">
        <button class="btn sm" id="pwBtn" style="flex:1;justify-content:center">Change password</button>
        <button class="btn sm" id="outBtn" style="flex:1;justify-content:center">Sign out</button>
      </div>`
    : AUTH.mode === 'firebase' ? `
      <p style="font-size:12px;color:var(--muted);line-height:1.55;margin:10px 0 0">Firebase verifies the password and Firestore rules decide who may read <code>users/{uid}</code>. Nothing sensitive lives in this page.</p>
      <button class="btn sm" id="outBtn" style="width:100%;justify-content:center;margin-top:10px">Sign out</button>`
    : ''}`;
  const pb = $('#pwBtn'); if (pb) pb.onclick = () => changePwModal(true);
  const ob = $('#outBtn'); if (ob) ob.onclick = signOut;
}
function renderStorageCard() {
  const box = $('#storageCard'); if (!box) return;
  const st = STORE_LABELS[STORE.status] || STORE_LABELS.idle;
  const notes = {
    local:  'This browser only. Nothing leaves the machine, and clearing site data clears the workspace.',
    session:'This tab only. Everything goes when the tab closes — useful for a kiosk or a demo.',
    memory: 'Nothing is persisted at all. The page is a pure component; your code owns the state.',
    rest:   'Your own endpoint owns the data. GET returns the state, PUT receives it, DELETE clears it — sent same-origin with any headers you configured.'
  };
  box.innerHTML = `<div class="panel-head"><h3>Where this data lives</h3><span class="eyebrow">${STORE.mode}</span></div>
    <p style="font-size:12px;color:var(--muted);line-height:1.55;margin:0 0 10px">${notes[STORE.mode] || ''}</p>
    <div class="kv"><span>Status</span><strong style="color:${st[0]}">${st[1]}${STORE.lastAt ? ' · ' + agoLabel(STORE.lastAt) : ''}</strong></div>
    <div class="kv"><span>${STORE.mode === 'rest' ? 'Endpoint' : 'Key'}</span><strong>${esc(STORE.mode === 'rest' ? String(CFG.endpoint) : CFG.storageKey)}</strong></div>
    <div class="kv"><span>Autosave</span><strong>${CFG.autosaveMs} ms after a change</strong></div>
    <div class="kv"><span>Records</span><strong>${S.sessions.length}s · ${S.tasks.length}t · ${S.events.length}b · ${S.notes.length}n</strong></div>
    <div class="kv"><span>Size</span><strong>${(JSON.stringify(S).length / 1024).toFixed(1)} KB</strong></div>
    ${STORE.error ? `<div class="gerr" style="margin:10px 0 0"><strong>Last write failed</strong>${esc(STORE.error.message || String(STORE.error))}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:11px">
      <button class="btn sm" id="storeReload" style="flex:1;justify-content:center">Reload</button>
      <button class="btn sm" id="storeFlush" style="flex:1;justify-content:center">Save now</button>
    </div>
    <p style="font-size:11.5px;color:var(--muted);margin:9px 0 0">The mode is set by the page that hosts this app, not from here — see <em>Embedding</em> below.</p>`;
  $('#storeReload').onclick = async () => {
    let ok;
    try { ok = await load(); }
    catch (e) { toast('Could not reload — keeping what is on screen'); return; }
    setPhase(S.timer.phase || 'focus', false); renderAll();
    toast(ok ? 'Reloaded from storage' : 'Storage was empty');
  };
  $('#storeFlush').onclick = () => { clearTimeout(saveT);
    setStoreStatus('saving');
    STORE.write(clone(S)).then(() => { setStoreStatus('saved'); toast('Saved'); },
                               e => { setStoreStatus('error', e); toast('Save failed — ' + (e.message || e)); }); };
}
function renderListsCard() {
  const box = $('#listsCard'); if (!box) return;
  const fields = [
    ['distractions', 'Distraction reasons', 'The buttons offered when you tap “Caught a distraction”.'],
    ['moves',        'Movement snacks',     'Suggested at every break, and listed in Calm.'],
    ['ground',       'Grounding steps',     'The 5-4-3-2-1 sequence, counted down from however many lines you leave.']
  ];
  box.innerHTML = `<div class="panel-head"><h3>Prompts you can edit</h3><button class="btn sm ghost" id="listsReset">Reset</button></div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px">One per line. These are the only words this app puts in your mouth — change them to yours.</p>
    ${fields.map(([k, label, hint]) => `<div class="field" style="margin-bottom:11px">
        <label for="lst_${k}">${label}</label>
        <textarea id="lst_${k}" rows="${k === 'moves' ? 5 : 4}" spellcheck="false">${esc(LIST(k).join('\n'))}</textarea>
        <span style="font-size:11px;color:var(--muted)">${hint}</span></div>`).join('')}`;
  fields.forEach(([k]) => $('#lst_' + k).onchange = e => {
    const lines = e.target.value.split('\n').map(x => x.trim()).filter(Boolean);
    S.lists[k] = lines.length ? lines : clone(DEFAULT_LISTS[k]);
    save(); renderCalm(); toast(lines.length + ' lines saved');
  });
  $('#listsReset').onclick = () => { S.lists = clone(DEFAULT_LISTS); save(); renderListsCard(); renderCalm(); toast('Back to the defaults'); };
}
const EMBED_SNIPPET = `<!-- optional: configure before the app script runs -->
<script type="application/json" id="focus-dial-config">
{
  "storage":  "rest",
  "endpoint": "/api/focus-dial",
  "headers":  { "X-CSRF-Token": "…" },
  "startView":"focus",
  "demo":     false
}
<\/script>`;
function renderEmbedCard() {
  const box = $('#embedCard'); if (!box) return;
  box.hidden = !CFG.embedDocs; if (!CFG.embedDocs) return;
  box.innerHTML = `<div class="panel-head"><h3>Embedding this on your own site</h3><span class="eyebrow">v${VERSION}</span></div>
    <div class="doc-grid">
      <div>
        <p class="doc" style="margin:0">One file, no dependencies, no build step: drop the page in as-is, or paste its markup, styles and script into a template. It renders into whatever container holds it and asks the page nothing.</p>
        <span class="code">${esc(EMBED_SNIPPET)}</span>
        <div style="display:flex;gap:8px">
          <button class="btn sm" id="copyCfg">Copy the config block</button>
          <button class="btn sm" id="copyState">Copy the current state</button>
        </div>
      </div>
      <div>
        <p class="doc" style="margin:0 0 6px"><strong>auth</strong> — <code>auto</code> (Firebase when <code>firebase</code> is set, otherwise a local profile), <code>local</code>, <code>firebase</code>, or <code>none</code> when the host page already gates the route. With Firebase configured you get email + password, Google sign-in, and the workspace at <code>users/{uid}/workspace/state</code>.</p>
        <p class="doc" style="margin:0"><strong>storage</strong> — <code>local</code> (default), <code>session</code>, <code>memory</code>, or <code>rest</code>. The same block also seeds first-run <code>settings</code>, and replaces the <code>lists</code>, <code>timerPresets</code>, <code>soundPresets</code> and <code>breathPatterns</code> tables outright.</p>
        <p class="doc" style="margin:0 0 6px">The REST contract is three calls against one URL:</p>
        <span class="code">GET    ${esc(String(CFG.endpoint || '/api/focus-dial'))}   → 200 state JSON, or 404 for a new user
PUT    ${esc(String(CFG.endpoint || '/api/focus-dial'))}   ← the whole state JSON
DELETE ${esc(String(CFG.endpoint || '/api/focus-dial'))}   clears it</span>
        <p class="doc" style="margin:0">Requests carry same-origin credentials, so a session cookie is enough; add <code>headers</code> for a token. Writes are debounced by <code>autosaveMs</code> and the last one is flushed with <code>sendBeacon</code> on unload.</p>
      </div>
      <div>
        <p class="doc" style="margin:0 0 6px"><strong>window.FocusDial</strong> — drive it from your own code:</p>
        <span class="code">FocusDial.getState()          // deep copy
FocusDial.setState(patch)     // merge + re-render
FocusDial.subscribe(fn)       // → unsubscribe
FocusDial.addTask({ title, est, energy, quad })
FocusDial.addEvent({ title, start, end, kind })
FocusDial.addNote(text)
FocusDial.start() / .pause() / .skip() / .reset()
FocusDial.view('matrix')      // any rail view
FocusDial.exportJSON() / .importJSON(text)
FocusDial.loadDemo() / .clear()</span>
        <p class="doc" style="margin:0">Events fire on <code>document</code>: <code>focusdial:ready</code>, <code>focusdial:change</code>, <code>focusdial:phase</code>, <code>focusdial:session</code>, <code>focusdial:task</code> — each with the relevant object in <code>event.detail</code>.</p>
      </div>
    </div>`;
  $('#copyCfg').onclick = () => copyText(EMBED_SNIPPET, 'Config block copied');
  $('#copyState').onclick = () => copyText(JSON.stringify(S, null, 2), 'State copied as JSON');
}

/* =====================================================================
   SIGN-IN GATE
   ===================================================================== */
function gateMsg(text, tone) {
  const box = $('#gateMsg'); if (!box) return;
  if (!text) { box.innerHTML = ''; return; }
  const c = tone === 'ok' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--crit)';
  box.innerHTML = `<div class="gate-msg" style="--q:${c}">${text}</div>`;
}
function gateBusy(on, label) {
  AUTH.busy = on;
  const b = $('#gateGo'); if (b) { b.disabled = on; b.textContent = on ? (label || 'Working…') : 'Sign in'; }
}
function showGate(msg, tone) {
  $('#gate').classList.add('on');
  const cloud = AUTH.mode === 'firebase', form = !cloud || CFG.emailSignIn;
  $('#gateCloud').hidden = !cloud;
  $('#gateForm').hidden = !form;                     // Google-only sites hide email + password
  $('.gate-or', $('#gateCloud')).hidden = !form;
  $('#googleBtn').classList.toggle('primary', !form);
  $('#gateLocal').textContent = cloud ? 'Use a local profile instead' : 'Use Google sign-in instead';
  $('#gateLocal').hidden = !cloud && !CFG.firebase;
  $('#gateNote').innerHTML = cloud
    ? (form ? 'Accounts and data live in your own Firebase project. Passwords never reach this page — Firebase verifies them, and Firestore rules decide who can read a workspace.'
            : 'Signing in with Google keeps your workspace in this site’s Firebase database under your account, readable only by you, so it follows you to any device. A local profile keeps everything in this browser instead.')
    : `This profile lives in <strong>this browser only</strong>, and the password is hashed before it is stored. Be clear-eyed about it: a login written in a page anyone can view-source is a courtesy lock, not security.${CFG.firebase ? ' Sign in with Google for a real account that syncs.' : ' Configure Firebase for real accounts.'}`;
  if (msg) gateMsg(msg, tone);
  setTimeout(() => { const f = form ? $('#gateUser') : $('#googleBtn'); if (f && !f.value) f.focus(); }, 60);
}
function hideGate() { $('#gate').classList.remove('on'); gateMsg(''); }
function renderWho() {
  const c = $('#whoChip'), out = $('#signOutBtn');
  if (!c) return;
  if (!AUTH.user || AUTH.mode === 'none') { c.hidden = true; if (out) out.hidden = true; return; }
  const u = AUTH.user;
  c.hidden = false; if (out) out.hidden = false;
  c.innerHTML = `<span class="av">${esc(initials(u.name || u.email))}</span><span class="nm">${esc(u.name || u.email)}</span>`;
  c.dataset.tip = (u.provider === 'google' ? 'Signed in with Google' : u.provider === 'firebase' ? 'Signed in with email' : 'Local profile on this device')
    + (u.email ? ' · ' + u.email : '') + ' · workspace in ' + STORE.label();
}
function renderSiteNav() {
  const n = $('#siteNav'); if (!n) return;
  const links = [];
  if (CFG.homeUrl) links.push(['Portfolio', CFG.homeUrl]);
  if (CFG.projectsUrl) links.push(['All projects', CFG.projectsUrl]);
  n.innerHTML = links.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join('');
}
function applyBrand() {
  document.title = CFG.appName;
  const ini = String(CFG.appName).split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const b = $('.brand'); if (b) { b.textContent = ini; b.title = CFG.appName; }
  const gl = $('#gateLogo'); if (gl) gl.textContent = ini;
  const gt = $('#gateTitle'); if (gt) gt.textContent = CFG.appName;
  const gs = $('#gateSub');
  if (gs) gs.textContent = AUTH.mode === 'firebase'
    ? 'Sign in to load your workspace from your account.'
    : 'Sign in to open your workspace on this device.';
}
/* One entry point for "a user is now present": load their workspace and draw. */
async function enterApp(user) {
  AUTH.user = user;
  STORE.mode = (AUTH.mode === 'firebase') ? 'cloud' : CFG.storage;
  STORE.blocked = false;
  if (STORE.mode === 'cloud') sessionClear();         // a Google session outranks an old local one
  gateMsg('Opening your workspace…', 'ok');
  try {
    await load();
  } catch (e) {
    STORE.blocked = true; AUTH.user = null;
    if (FB.auth) { try { await FB.auth.signOut(); } catch (err) {} }
    showGate('Signed in, but your workspace could not be loaded (' + esc(e && e.message || String(e)) +
      '). Nothing was changed — check the connection and try again.', 'warn');
    return;
  }
  hideGate();
  setPhase(S.timer.phase || 'focus', false);
  renderAll();
  go(CFG.startView || 'focus');
  if (STORE.mode === 'cloud') fbWatch();
  gcalAfterLoad();
  emit('signin', { id:user.id, name:user.name, email:user.email, provider:user.provider });
  if (user.mustChange) setTimeout(changePwModal, 700);
  else offerLegacyImport();
}

/* ---------------------------------------------------------------------
   ONE-TIME IMPORT from the first version of this page, which kept a
   simpler pack (tasks with steps, parked thoughts, sessions) under
   localStorage "adhd-study-pack:<profile>:<slice>" and, for Google users,
   Firestore users/{uid}/pack/<slice>. Offered once, only into an empty
   workspace; the old copies are left untouched.
   --------------------------------------------------------------------- */
const LEGACY_PREFIX = 'adhd-study-pack';
const LEGACY_SLICES = ['tasks', 'parked', 'sessions', 'activeTaskId'];
const legacyHasData = p => (p.tasks || []).length || (p.parked || []).length || (p.sessions || []).length;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
async function legacySources() {
  const out = [];
  if (STORE.mode === 'cloud' && FB.db) {
    try {
      const pack = {};
      for (const k of LEGACY_SLICES) {
        const snap = await FB.fs.getDoc(fbDoc('pack', k));
        if (snap.exists()) pack[k] = snap.data().value;
      }
      if (legacyHasData(pack)) out.push({ label:'Your Google account', pack });
    } catch (e) { /* nothing there, or offline: just do not offer it */ }
  }
  try {
    const get = (name, k) => JSON.parse(localStorage.getItem(`${LEGACY_PREFIX}:${name}:${k}`) || 'null');
    JSON.parse(localStorage.getItem(LEGACY_PREFIX + ':profiles') || '[]').forEach(name => {
      const pack = {}; LEGACY_SLICES.forEach(k => pack[k] = get(name, k));
      if (legacyHasData(pack)) out.push({ label:`Profile “${name}” in this browser`, pack });
    });
  } catch (e) {}
  return out;
}
function importLegacy(pack) {
  const tasks = (pack.tasks || []).filter(t => t && t.title);
  tasks.slice().reverse().forEach(t => {
    S.tasks.unshift({ id:t.id || uid(), title:String(t.title), est:1, energy:'med', subjectId:null, quad:null,
                      done:!!t.done, done_pomos:0, created:t.created || Date.now() });
    const steps = (t.steps || []).filter(s => s && s.label);
    if (steps.length) addNote(`Steps — ${t.title}\n` + steps.map(s => (s.done ? '☑ ' : '☐ ') + s.label).join('\n'), 'note');
  });
  (pack.parked || []).forEach(p => { if (p && p.text) addNote(String(p.text), 'parked'); });
  (pack.sessions || []).forEach(s => {
    if (!s || !s.minutes) return;
    const end = s.at || Date.now();
    S.sessions.push({ id:s.id || uid(), start:new Date(end - s.minutes * 60000).toISOString(), end:new Date(end).toISOString(),
      minutes:s.minutes, taskId:s.taskId || null, subjectId:null, intent:'', activation:null, quality:null,
      distractions:[], partial:!s.completed });
  });
  S.sessions.sort((a, b) => new Date(a.start) - new Date(b.start));
  if (pack.activeTaskId && S.tasks.some(t => t.id === pack.activeTaskId)) S.timer.taskId = pack.activeTaskId;
  S.meta.legacyChecked = true;
  save(); renderAll();
  toast(`Brought over ${plural(tasks.length, 'task')}, ${plural((pack.parked || []).length, 'parked thought')} and ${plural((pack.sessions || []).length, 'session')}`);
}
async function offerLegacyImport() {
  if (S.meta.legacyChecked || S.meta.sample) return;
  if (S.tasks.length || S.sessions.length || S.notes.length) return;
  const found = await legacySources();
  if (!found.length || S.tasks.length || S.sessions.length || S.notes.length) return;
  const done = () => { S.meta.legacyChecked = true; save(); };
  openModal('Bring over your earlier pack?', `
    <p style="font-size:12.5px;color:var(--ink-2);margin:0">The first version of this page saved a simpler pack. Copy it into this workspace? Tasks land unsorted on the matrix, step lists become notes, and the old copy stays where it is.</p>
    <div class="stack" style="gap:8px">${found.map((f, i) => `<button class="btn" style="justify-content:space-between" data-legacy="${i}">
      <span>${esc(f.label)}</span><span class="num" style="color:var(--muted);font-size:11px">${plural((f.pack.tasks || []).length, 'task')} · ${plural((f.pack.sessions || []).length, 'session')}</span></button>`).join('')}</div>`,
    [{ label:'No thanks', onClick: done }],
    body => { $$('[data-legacy]', body).forEach(b => b.onclick = () => { importLegacy(found[+b.dataset.legacy].pack); closeModal(); }); });
}
function changePwModal(force) {
  openModal('Set your own password', `
    <p style="font-size:12.5px;color:var(--ink-2);margin:0">This profile is still on the seeded <strong>admin / admin</strong> password. Anyone who opens this page on this device can read your workspace until you change it.</p>
    <div class="field"><label for="npw">New password</label><input type="password" id="npw" autocomplete="new-password"></div>
    <div class="field"><label for="npw2">Again</label><input type="password" id="npw2" autocomplete="new-password"></div>`,
    [{ label: force ? 'Not now' : 'Later' }, { label:'Save it', primary:true, onClick: () => {
      const a = $('#npw').value, b2 = $('#npw2').value;
      if (a !== b2) { toast('Those do not match'); return false; }
      localChangePw(a).then(() => toast('Password changed'), e => toast(e.message));
    } }]);
}
async function signOut() {
  clearTimeout(saveT); saveT = null;
  if (!STORE.blocked) STORE.writeSync(S);
  fbUnwatchNow(); fbKnown = null;
  gcalReset();                                        // the calendar token belongs to whoever just left
  sessionClear();                                     // before Firebase's own sign-out event fires
  AUTH.user = null;
  if (AUTH.mode === 'firebase' && FB.auth) { try { await FB.auth.signOut(); } catch (e) {} }
  S = DEFAULTS();
  renderWho(); renderAll();
  showGate('Signed out.', 'ok');
  emit('signout', {});
}
function wireGate() {
  $('#gateForm').onsubmit = async e => {
    e.preventDefault();
    if (AUTH.busy) return;
    const u = $('#gateUser').value.trim(), pw = $('#gatePass').value, remember = $('#gateRemember').checked;
    if (!u || !pw) { gateMsg('Both fields, please.'); return; }
    gateBusy(true);
    try {
      if (AUTH.mode === 'firebase') { await fbInit(); await FB.auth.signInWithEmailAndPassword(u, pw); }
      else await enterApp(await localSignIn(u, pw, remember));
    } catch (err) { gateMsg(AUTH.mode === 'firebase' ? fbMsg(err) : err.message); }
    gateBusy(false);
  };
  $('#gateSignup').onclick = async () => {
    if (AUTH.busy) return;
    const u = $('#gateUser').value.trim(), pw = $('#gatePass').value, remember = $('#gateRemember').checked;
    if (!u || !pw) { gateMsg('Fill both fields, then press Create account.', 'warn'); return; }
    gateBusy(true, 'Creating…');
    try {
      if (AUTH.mode === 'firebase') { await fbInit(); await FB.auth.createUserWithEmailAndPassword(u, pw); }
      else { await enterApp(await localSignUp(u, pw, remember)); toast('Profile created'); }
    } catch (err) { gateMsg(AUTH.mode === 'firebase' ? fbMsg(err) : err.message); }
    gateBusy(false);
  };
  $('#googleBtn').onclick = async () => {
    gateMsg('');
    const btn = $('#googleBtn'); btn.disabled = true;
    try {
      await fbInit();                                  // already done at boot, so the popup keeps the click
      await FB.auth.signInWithGoogle();                // onAuthStateChanged takes it from here
    } catch (err) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(err && err.code)) gateMsg(fbMsg(err));
    } finally { btn.disabled = false; }
  };
  $('#gateLocal').onclick = async () => {
    if (AUTH.mode === 'local' && CFG.firebase) {       // back to Google
      try { await fbInit(); AUTH.mode = 'firebase'; applyBrand(); showGate(); gateMsg(''); }
      catch (e) { gateMsg('Google sign-in could not load right now. Local profiles still work.', 'warn'); }
      return;
    }
    AUTH.mode = 'local'; seedAdmin(); applyBrand();
    showGate('Local profile mode. Nothing leaves this browser.', 'ok');
  };
  $('#gateTheme').onclick = () => $('#themeBtn').click();
  const so = $('#signOutBtn'); if (so) so.onclick = signOut;
}

/* =====================================================================
   BOOT
   ===================================================================== */
function renderAll() {
  applyTheme(); renderPips(); renderDial(); renderFocusSide(); renderTasks();
  renderCalendar(); renderBoard(); renderSound(); renderCalm(); renderSettings(); renderStats(); renderGcal();
  renderBanner(); renderQuickStart(); renderStoreChip(); renderWho(); renderTracking();
  $('#dayStart').value = S.settings.dayStart; $('#dayEnd').value = S.settings.dayEnd;
}
window.FocusDial = {
  version: VERSION,
  config: CFG,
  getState: () => clone(S),
  setState(patch) {
    if (!patch || typeof patch !== 'object') return;
    Object.keys(patch).forEach(k => {
      if (k in S && patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && !Array.isArray(S[k]))
        S[k] = Object.assign(S[k], patch[k]);
      else S[k] = patch[k];
    });
    save(); setPhase(S.timer.phase || 'focus', false); renderAll();
    return this.getState();
  },
  subscribe(fn) { (HOOKS.change = HOOKS.change || []).push(fn); return () => { HOOKS.change = HOOKS.change.filter(f => f !== fn); }; },
  on(name, fn) { (HOOKS[name] = HOOKS[name] || []).push(fn); return () => { HOOKS[name] = HOOKS[name].filter(f => f !== fn); }; },
  addTask(t) {
    const task = Object.assign({ id:uid(), title:'Untitled', est:1, energy:'med', subjectId:null, quad:null,
                                 done:false, done_pomos:0, created:Date.now() }, t || {});
    S.tasks.unshift(task); save(); renderTasks(); emit('task', task); return clone(task);
  },
  addEvent(e) {
    const ev = Object.assign({ id:uid(), title:'Block', kind:'study', subjectId:null,
                               start:new Date().toISOString(), end:new Date(Date.now() + 3600000).toISOString() }, e || {});
    S.events.push(ev); save(); renderCalendar(); renderFocusSide(); return clone(ev);
  },
  addNote(text, tag) { return clone(addNote(text, tag)); },
  focusTask(id) { setActiveTask(id); },
  start, pause, skip: skipPhase, reset: resetInterval,
  view: go,
  exportJSON: () => JSON.stringify(S, null, 2),
  importJSON(text) {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    const next = migrate(data); if (!next) throw new Error('not a Focus Dial state object');
    S = next; save(); setPhase(S.timer.phase || 'focus', false); renderAll(); return this.getState();
  },
  loadDemo, clear: clearDemo,
  get user() { return AUTH.user ? clone(AUTH.user) : null; },
  signOut, signIn: (u, p, remember) => AUTH.mode === 'firebase'
    ? fbInit().then(() => FB.auth.signInWithEmailAndPassword(u, p))
    : localSignIn(u, p, remember !== false).then(enterApp),
  async wipe() { clearTimeout(saveT); await STORE.clear(); S = DEFAULTS(); save(); setPhase('focus', false); renderAll(); }
};
(async function init() {
  renderTicks(); applyTheme(); renderSiteNav(); applyBrand(); wireGate();
  setInterval(() => { if (view === 'plan') renderCalendar(); renderTopStats(); }, 60000);
  window.addEventListener('beforeunload', () => { clearTimeout(saveT); if (AUTH.user || AUTH.mode === 'none') STORE.writeSync(S); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tickRemain(); renderDial(); } });

  if (AUTH.mode === 'none') {                       // embedded with the host page doing its own auth
    await enterApp({ id:'', name:'', email:null, provider:'none' });
  } else if (AUTH.mode === 'firebase') {
    try {
      await fbInit();
      FB.auth.onAuthStateChanged(u => {
        if (u) {
          AUTH.mode = 'firebase';
          enterApp({ id:u.uid, name:u.displayName || (u.email || '').split('@')[0], email:u.email,
                     provider:(u.providerData[0] && u.providerData[0].providerId === 'google.com') ? 'google' : 'firebase' });
          return;
        }
        if (AUTH.user && AUTH.user.provider === 'local') return;   // a local profile is open; not ours to close
        AUTH.user = null; renderWho();
        /* No Google session, but a local profile from an earlier visit: reopen it. */
        const id = sessionGet(), a = id ? acctAll()[id] : null;
        if (a) { AUTH.mode = 'local'; applyBrand(); enterApp({ id:a.id, name:a.name, email:a.email, provider:'local', mustChange:!!a.mustChange }); }
        else showGate();
      });
    } catch (e) {
      AUTH.mode = 'local'; seedAdmin(); applyBrand();
      showGate('Could not reach Firebase (' + (e.message || e) + '). Falling back to a local profile on this device.', 'warn');
    }
  } else {
    seedAdmin();
    const id = sessionGet(), a = id ? acctAll()[id] : null;
    if (a) await enterApp({ id:a.id, name:a.name, email:a.email, provider:'local', mustChange:!!a.mustChange });
    else showGate(Object.keys(acctAll()).length ? '' : CFG.seedAdmin
      ? 'First run on this device: sign in with <strong>admin / admin</strong>, or create your own profile.'
      : 'First run on this device: pick a name and a password, then press <strong>Create account</strong>.', 'ok');
  }
  gcalBoot();
  AUTH.ready = true;
  emit('ready', { version:VERSION, storage:STORE.mode, auth:AUTH.mode, signedIn:!!AUTH.user });
})();
