/* Progress + AI plan page. Reads the Focus Dial workspace (localStorage) and the
   session journal (IndexedDB) read-only; never writes to either. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY = 86400000;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = d => { const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; };
const hm = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? Math.round(m % 60) + 'm' : ''}`.trim() : `${Math.round(m)}m`;
const GOAL_KEY = 'focusdial.v3.weeklyGoal';
const PLAN_KEY = 'focusdial.v3.aiPlan';

/* ---------- Firebase (same project + SDK as the main app) ---------- */
const FB_SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const FB = { user: null, fs: null, db: null };
async function fbConnect() {
  try {
    const { firebaseConfig, appCheckSiteKey } = await import('./firebase-config.js');
    if (!firebaseConfig) return null;
    const [appSdk, authSdk, fs] = await Promise.all([
      import(`${FB_SDK}/firebase-app.js`), import(`${FB_SDK}/firebase-auth.js`), import(`${FB_SDK}/firebase-firestore.js`)]);
    const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
    if (appCheckSiteKey) {
      try { const ac = await import(`${FB_SDK}/firebase-app-check.js`);
        ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true }); } catch (e) {}
    }
    const auth = authSdk.getAuth(app);
    const user = await new Promise(res => { const off = authSdk.onAuthStateChanged(auth, u => { off(); res(u); }); setTimeout(() => res(null), 6000); });
    if (!user) return null;
    FB.user = user; FB.fs = fs; FB.db = fs.getFirestore(app);
    return user;
  } catch (e) { console.warn('[progress] Firebase unavailable:', e && e.message); return null; }
}
async function readCloud() {
  const { fs, db, user } = FB;
  const [state, journal, goals] = await Promise.all([
    fs.getDoc(fs.doc(db, 'users', user.uid, 'workspace', 'state')),
    fs.getDocs(fs.collection(db, 'users', user.uid, 'journal')),
    fs.getDoc(fs.doc(db, 'users', user.uid, 'workspace', 'goals')).catch(() => null)]);
  const d = state.exists() ? state.data() : null;
  const ws = d && d.json ? JSON.parse(d.json) : (d && d.state) || { tasks: [], subjects: [] };
  const rows = journal.docs.map(x => Object.assign({ id: x.id }, x.data()));
  const goal = goals && goals.exists() ? goals.data().weeklyMinutes : null;
  return { ws, rows, goal };
}
let goalSaveT = null;
function saveGoal(v) {
  localStorage.setItem(GOAL_KEY, String(v));
  if (!FB.user) return;
  clearTimeout(goalSaveT);
  goalSaveT = setTimeout(() => {
    FB.fs.setDoc(FB.fs.doc(FB.db, 'users', FB.user.uid, 'workspace', 'goals'), { weeklyMinutes: Math.round(v), updated: Date.now() })
      .then(() => setSource('Synced with your account · ' + (FB.user.email || 'signed in')))
      .catch(e => setSource('Goal saved on this device only — ' + (/permission/i.test(e.message) ? 'the Firestore rules need updating' : e.message)));
  }, 600);
}
const setSource = t => { const el = document.getElementById('dataSource'); if (el) el.textContent = t; };

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.st-panel').forEach(p => { p.hidden = p.id !== name; });
  history.replaceState(null, '', '#' + name);
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
showTab(location.hash === '#planner' ? 'planner' : 'progress');

/* ---------- data ---------- */
function readWorkspace() {
  let best = null, bestKey = '';
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!/^focusdial\.v3(:[^.]+)?$/.test(k)) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (v && Array.isArray(v.tasks) && (!best || v.tasks.length > best.tasks.length)) { best = v; bestKey = k; }
    } catch (e) {}
  }
  const owner = bestKey.includes(':') ? bestKey.split(':')[1] : 'guest';
  return { ws: best || { tasks: [], subjects: [] }, owner };
}
function readJournal(owner) {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('adhd-study-pack');
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('entries')) { db.close(); return resolve([]); }
        const all = db.transaction('entries').objectStore('entries').getAll();
        all.onsuccess = () => { db.close(); resolve((all.result || []).filter(r => (r.owner || 'guest') === owner)); };
        all.onerror = () => resolve([]);
      };
    } catch (e) { resolve([]); }
  });
}
const sessTime = s => new Date(s.start || s.at || 0);

/* ---------- progress ---------- */
async function renderProgress() {
  let ws, rows, cloudGoal = null;
  setSource('Loading…');
  if (await fbConnect()) {
    try { ({ ws, rows, goal: cloudGoal } = await readCloud());
      setSource('Synced with your account · ' + (FB.user.email || 'signed in')); }
    catch (e) { FB.user = null; console.warn(e); }
  }
  if (!ws) {
    const local = readWorkspace(); ws = local.ws; rows = await readJournal(local.owner);
    setSource('From this device only. Sign in on the main page to sync across devices.');
  }
  const sessions = rows.filter(r => r.kind === 'session' && (r.minutes || 0) > 0);
  const now = new Date(), wk0 = startOfWeek(now);
  const inRange = (a, b) => sessions.filter(s => sessTime(s) >= a && sessTime(s) < b);
  const mins = list => list.reduce((a, s) => a + (s.minutes || 0), 0);

  const thisWeek = inRange(wk0, new Date(+wk0 + 7 * DAY));
  const lastWeek = inRange(new Date(+wk0 - 7 * DAY), wk0);
  const tasks = ws.tasks || [];
  const done = tasks.filter(t => t.done);
  const doneThisWeek = done.filter(t => t.doneAt && t.doneAt >= +wk0).length;
  const days = new Set(sessions.map(s => startOfDay(sessTime(s)).getTime()));
  let streak = 0, d = startOfDay(now); if (!days.has(+d)) d = new Date(+d - DAY);
  while (days.has(+d)) { streak++; d = new Date(+d - DAY); }

  const diff = mins(thisWeek) - mins(lastWeek);
  $('#statCards').innerHTML = [
    ['Focus this week', hm(mins(thisWeek)), lastWeek.length ? `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${hm(Math.abs(diff))}</span> vs last week` : 'first week tracked'],
    ['Sessions this week', thisWeek.length, `${lastWeek.length} last week`],
    ['Tasks done', `${done.length}/${tasks.length}`, `${tasks.length ? Math.round(done.length / tasks.length * 100) : 0}% complete`],
    ['Day streak', streak, `${sessions.length} sessions all time`],
  ].map(([l, v, s]) => `<div class="st-card"><small>${l}</small><b>${v}</b><small>${s}</small></div>`).join('');

  const weeks = [...Array(8)].map((_, i) => { const a = new Date(+wk0 - (7 - i) * 7 * DAY); return { a, m: mins(inRange(a, new Date(+a + 7 * DAY))) }; });
  bars('#weekBars', weeks.map((w, i) => ({ v: w.m, label: i === 7 ? 'now' : `${w.a.getDate()}/${w.a.getMonth() + 1}`, now: i === 7 })));
  const dows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  bars('#dayBars', dows.map((d, i) => { const a = new Date(+wk0 + i * DAY); return { v: mins(inRange(a, new Date(+a + DAY))), label: d, now: +a === +startOfDay(now) }; }));

  const goalInput = $('#goalInput');
  goalInput.value = Number(cloudGoal) || Number(localStorage.getItem(GOAL_KEY)) || 300;
  const drawGoal = () => {
    const g = Math.max(15, Number(goalInput.value) || 300), m = mins(thisWeek);
    $('#goalMeter').innerHTML = `<div class="st-meter"><i style="width:${Math.min(100, m / g * 100)}%"></i></div><small class="muted">${hm(m)} of ${hm(g)} · ${m >= g ? 'goal reached 🎉' : hm(g - m) + ' to go'}</small>`;
  };
  goalInput.oninput = () => { saveGoal(Number(goalInput.value) || 0); drawGoal(); };
  drawGoal();

  const subs = (ws.subjects || []).filter(s => s.targetHours > 0);
  $('#courseGoals').innerHTML = subs.length ? subs.map(s => {
    const m = mins(thisWeek.filter(x => x.subjectId === s.id)), t = s.targetHours * 60;
    return `<div style="margin:8px 0"><strong>${esc(s.name)}</strong><div class="st-meter"><i style="width:${Math.min(100, m / t * 100)}%;background:${esc(s.color || 'var(--ember)')}"></i></div><small class="muted">${hm(m)} of ${s.targetHours}h</small></div>`;
  }).join('') : '<p class="muted">Add a course with a weekly target on the Plan screen to track it here.</p>';

  const open = tasks.filter(t => !t.done && !t.someday);
  $('#taskStats').innerHTML = `<div class="st-meter"><i style="width:${tasks.length ? done.length / tasks.length * 100 : 0}%;background:var(--sage)"></i></div>
    <ul class="st-list"><li><span>Finished this week</span><b>${doneThisWeek}</b></li><li><span>Still open</span><b>${open.length}</b></li><li><span>Focus rounds logged on tasks</span><b>${tasks.reduce((a, t) => a + (t.done_pomos || 0), 0)}</b></li></ul>`;

  const recent = sessions.slice().sort((a, b) => sessTime(b) - sessTime(a)).slice(0, 6);
  $('#recentSessions').innerHTML = recent.length ? recent.map(s => `<li><span>${esc(s.title || s.intent || 'Focus session')}</span><span class="muted">${sessTime(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${hm(s.minutes)}</span></li>`).join('')
    : '<li class="muted">No finished sessions yet — run a focus round and it shows up here.</li>';
}
function bars(sel, items) {
  const max = Math.max(1, ...items.map(i => i.v));
  $(sel).innerHTML = items.map(i => `<div class="st-bar${i.now ? ' now' : ''}" title="${hm(i.v)}"><span>${i.v ? hm(i.v) : ''}</span><i style="height:${i.v / max * 75}%"></i><span>${i.label}</span></div>`).join('');
}

/* ---------- AI plan ---------- */
function renderPlan(p) {
  if (!p) { $('#planOut').innerHTML = ''; return; }
  const plan = p.plan;
  $('#planOut').innerHTML = `
  <div class="st-box">
    <div class="plan-head"><div><h1>${esc(plan.title)}</h1><p class="muted">Due ${esc(p.deadlineLabel)} · ${esc(plan.summary)}</p></div>
      <div class="no-print st-actions" style="flex:0"><button class="st-btn" id="printBtn">Export PDF</button><button class="st-btn ghost" id="clearBtn">Clear</button></div></div>
    <h2>Tasks, in order</h2>
    ${plan.tasks.map((t, i) => `<div class="plan-task"><span class="pri ${esc(t.priority)}">${esc(t.priority)}</span> <strong>${i + 1}. ${esc(t.title)}</strong> <span class="muted">· ~${hm(t.minutes)}</span><div class="muted">${esc(t.why)}</div><ul>${t.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('')}
    <h2 style="margin-top:20px">Focus sessions</h2>
    <table><thead><tr><th></th><th>When</th><th>Focus on</th><th>Time</th><th>Done when…</th></tr></thead><tbody>
    ${plan.sessions.map(s => `<tr><td class="chk">☐</td><td>${esc(s.day)}</td><td>${esc(s.focus)}</td><td>${s.minutes}m + ${s.breakMinutes}m break</td><td>${esc(s.goal)}</td></tr>`).join('')}
    </tbody></table>
    <h2 style="margin-top:20px">Tips</h2><ul>${plan.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
  </div>`;
  $('#printBtn').onclick = () => { document.title = plan.title + ' — study plan'; window.print(); };
  $('#clearBtn').onclick = () => { localStorage.removeItem(PLAN_KEY); renderPlan(null); };
}
$('#planForm').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target), btn = $('#planBtn'), status = $('#planStatus');
  const deadline = new Date(f.get('deadline'));
  btn.disabled = true; status.className = 'muted'; status.textContent = 'Thinking through your plan… (about 20 seconds)';
  try {
    const r = await fetch(window.StudyPlanApi.url(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment: f.get('assignment'), deadline: deadline.toString(), availability: f.get('availability'), today: new Date().toString() }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.plan) throw new Error(data.error || 'Could not create a plan.');
    const saved = { plan: data.plan, deadlineLabel: deadline.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), at: Date.now() };
    localStorage.setItem(PLAN_KEY, JSON.stringify(saved));
    renderPlan(saved); status.textContent = 'Plan ready ↓';
  } catch (err) { status.className = 'st-err'; status.textContent = err.message; }
  finally { btn.disabled = false; }
};
try { renderPlan(JSON.parse(localStorage.getItem(PLAN_KEY) || 'null')); } catch (e) {}

renderProgress();
