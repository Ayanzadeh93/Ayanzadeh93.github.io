/* Leaderboard — live XP ranks for the ADHD Study Pack.
 *
 * Additive module, same pattern as the coach and radio: boot.js imports it
 * after the engine, and if anything here fails the workspace is untouched.
 *
 * How it works:
 *   - Firebase Auth (same project as sign-in) tells us who is signed in.
 *   - We read our own users/{uid}/workspace/state document (owner-only read,
 *     already allowed by the rules), compute XP with the passport helpers,
 *     and publish one small public row: leaderboard/{uid}.
 *   - The board itself is a live listener on the leaderboard collection,
 *     ordered by XP. Any signed-in user can read it; everyone writes only
 *     their own row (see firebase/firestore.rules).
 *
 * Nothing loads at all until the engine is up; signed-out visitors just get
 * a resting trophy button that asks them to sign in.
 */

import { firebaseConfig } from './firebase-config.js';

const FB = '10.12.5';
const SYNC_EVERY_MS = 5 * 60 * 1000;
const BOARD_SIZE = 50;

const css = `
:root { --lb-gold:#fbbf24; --lb-aurora1:#22d3ee; --lb-aurora2:#a78bfa; }
.lb-fab{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;align-items:center;gap:.5rem;
  padding:.7rem 1.1rem;border:none;border-radius:999px;cursor:pointer;
  font:700 14px/1 system-ui,sans-serif;color:#0b1020;
  background:linear-gradient(135deg,var(--lb-gold),#f59e0b);
  box-shadow:0 6px 24px rgba(251,191,36,.35),0 2px 6px rgba(0,0,0,.4);
  transition:transform .18s cubic-bezier(.2,.9,.3,1.4),box-shadow .18s ease;}
.lb-fab:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 12px 32px rgba(251,191,36,.5)}
.lb-fab:active{transform:scale(.96)}
.lb-fab .lb-pulse{animation:lb-pulse 2.4s ease-in-out infinite}
@keyframes lb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18) rotate(-6deg)}}
.coach-dock .lb-fab{position:static;right:auto;bottom:auto;margin:0}
.lb-scrim{position:fixed;inset:0;z-index:70;background:rgba(4,6,16,.6);backdrop-filter:blur(6px);
  display:grid;place-items:center;padding:1rem;opacity:0;pointer-events:none;transition:opacity .25s ease}
.lb-scrim.lb-open{opacity:1;pointer-events:auto}
.lb-panel{width:min(440px,100%);max-height:min(640px,86vh);display:flex;flex-direction:column;overflow:hidden;
  border-radius:24px;border:1px solid rgba(255,255,255,.09);position:relative;color:#e7ecf7;
  background:linear-gradient(160deg,#141a2e 0%,#0c1122 60%,#0b0f1e 100%);
  box-shadow:0 30px 80px rgba(0,0,0,.6);
  transform:translateY(26px) scale(.96);opacity:0;transition:transform .3s cubic-bezier(.2,.9,.25,1.2),opacity .25s ease}
.lb-scrim.lb-open .lb-panel{transform:none;opacity:1}
.lb-aurora{position:absolute;inset:-40% -20% auto;height:70%;pointer-events:none;filter:blur(60px);opacity:.35;
  background:radial-gradient(circle at 20% 40%,var(--lb-aurora1),transparent 55%),
             radial-gradient(circle at 80% 30%,var(--lb-aurora2),transparent 55%);
  animation:lb-drift 14s ease-in-out infinite alternate}
@keyframes lb-drift{from{transform:translateX(-6%)}to{transform:translateX(6%)}}
.lb-head{position:relative;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 1.25rem .6rem}
.lb-head h2{margin:0;font:800 20px/1.1 system-ui,sans-serif;letter-spacing:.02em}
.lb-head .lb-sub{font:500 11px/1.4 system-ui,sans-serif;color:#8b95b3;letter-spacing:.14em;text-transform:uppercase}
.lb-close{border:none;background:rgba(255,255,255,.07);color:#cfd6ea;width:32px;height:32px;border-radius:10px;
  cursor:pointer;font-size:16px;line-height:1;transition:background .15s ease}
.lb-close:hover{background:rgba(255,255,255,.15)}
.lb-list{position:relative;overflow-y:auto;padding:.4rem .9rem 1rem;display:flex;flex-direction:column;gap:.45rem}
.lb-row{display:flex;align-items:center;gap:.7rem;padding:.6rem .75rem;border-radius:16px;
  background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.05);
  animation:lb-in .45s cubic-bezier(.2,.9,.3,1.2) both}
.lb-row.lb-me{background:linear-gradient(135deg,rgba(251,191,36,.14),rgba(245,158,11,.07));
  border-color:rgba(251,191,36,.4);box-shadow:0 0 0 1px rgba(251,191,36,.25),0 4px 18px rgba(251,191,36,.12)}
@keyframes lb-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
.lb-rank{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:10px;
  font:800 13px/1 system-ui,sans-serif;background:rgba(255,255,255,.06);color:#aab3cf}
.lb-rank.lb-r1{background:linear-gradient(135deg,#fde68a,#f59e0b);color:#3b2503}
.lb-rank.lb-r2{background:linear-gradient(135deg,#e5e7eb,#9ca3af);color:#1f2937}
.lb-rank.lb-r3{background:linear-gradient(135deg,#fdba74,#c2691e);color:#3a1c04}
.lb-ava{width:36px;height:36px;flex:none;border-radius:50%;display:grid;place-items:center;
  font:800 13px/1 system-ui,sans-serif;color:#0b1020;
  background:linear-gradient(135deg,var(--lb-aurora1),var(--lb-aurora2))}
.lb-who{min-width:0;flex:1}
.lb-name{font:700 14px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-name .lb-you{color:var(--lb-gold);font-size:11px;margin-left:.4rem;letter-spacing:.08em}
.lb-meta{font:500 11px/1.3 system-ui,sans-serif;color:#8b95b3;margin-top:2px}
.lb-xp{font:800 15px/1 system-ui,sans-serif;color:var(--lb-gold);white-space:nowrap}
.lb-empty,.lb-note{padding:2rem 1.4rem;text-align:center;font:500 14px/1.6 system-ui,sans-serif;color:#9aa4c2}
.lb-note small{display:block;margin-top:.6rem;color:#6b7494}
.lb-rank-chip{display:inline-flex;align-items:center;gap:.35rem;margin:0 0 .6rem;padding:.34rem .72rem;border-radius:999px;
  font:700 12px/1 system-ui,sans-serif;color:var(--lb-gold);background:rgba(251,191,36,.12);
  border:1px solid rgba(251,191,36,.35);white-space:nowrap;letter-spacing:.01em}
@media (prefers-reduced-motion:reduce){.lb-row,.lb-aurora,.lb-fab .lb-pulse{animation:none!important}}
`;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || '').toUpperCase()).join('') || '?';
}

/* XP from whatever the workspace JSON carries. Prefer the passport module's
   own helpers so the board always matches the passport; fall back to the same
   formula by hand (minutes + sessions x10 + streak x15 + badges x50). */
function fallbackStats(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  let minutes = 0;
  const days = new Set();
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    minutes += Number(s.minutes ?? s.mins ?? Math.round(Number(s.duration || 0) / 60) ?? 0) || 0;
    const t = Number(s.at ?? s.ended ?? s.time ?? s.date ?? 0);
    if (t) days.add(new Date(t).toISOString().slice(0, 10));
  }
  let streak = 0;
  const day = new Date();
  if (days.size) {
    const cursor = new Date(day);
    if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return { sessions: list.length, minutes, streak };
}

async function computeMyScore(workspaceJson, passportMod) {
  let S = {};
  try { S = JSON.parse(workspaceJson || '{}') || {}; } catch { S = {}; }
  const sessions = S.sessions || [];
  let stats = fallbackStats(sessions);
  if (passportMod && typeof passportMod.computeStats === 'function') {
    try {
      const s = passportMod.computeStats(sessions, S);
      if (s && typeof s === 'object') {
        stats = {
          sessions: Number(s.sessions ?? stats.sessions) || 0,
          minutes: Number(s.minutes ?? stats.minutes) || 0,
          streak: Number(s.streak ?? stats.streak) || 0,
        };
      }
    } catch { /* keep fallback */ }
  }
  let badges = 0;
  if (passportMod && typeof passportMod.earnedKeys === 'function') {
    try { badges = (passportMod.earnedKeys(S, stats) || []).length; } catch { badges = 0; }
  } else if (Array.isArray(S.passport?.earned)) {
    badges = S.passport.earned.length;
  } else if (S.passport && typeof S.passport.earned === 'object') {
    badges = Object.keys(S.passport.earned).length;
  }
  const xp = stats.minutes + stats.sessions * 10 + stats.streak * 15 + badges * 50;
  return { xp, minutes: stats.minutes, sessions: stats.sessions, streak: stats.streak, badges };
}

async function main() {
  if (!firebaseConfig) return; // local-only build: no button, no network

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const [{ initializeApp, getApps, getApp }, auth, firestore] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`),
  ]);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const authApi = auth.getAuth(app);
  const db = firestore.getFirestore(app);

  let passportMod = null;
  try { passportMod = await import('./lib/passport.js'); } catch { /* formula fallback */ }

  // --- UI skeleton -------------------------------------------------------
  const fab = el('button', 'lb-fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Open leaderboard');
  fab.innerHTML = '<span class="lb-pulse">🏆</span><span>Ranks</span>';
  // Stack the Ranks button ABOVE the coach button (same bottom-right dock),
  // instead of covering it. Falls back to body if the coach dock never loads.
  function boardOff() {
    return document.documentElement.getAttribute('data-board') === 'off';
  }

  function mountFab() {
    const dock = document.querySelector('.coach-dock');
    if (dock) { dock.insertBefore(fab, dock.firstChild); return; }
    let tries = 0;
    const tick = setInterval(() => {
      const d = document.querySelector('.coach-dock');
      if (d) { clearInterval(tick); d.insertBefore(fab, d.firstChild); }
      else if (++tries > 24) { clearInterval(tick); document.body.appendChild(fab); }
    }, 250);
  }
  mountFab();

  const scrim = el('div', 'lb-scrim');
  const panel = el('section', 'lb-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Leaderboard');
  const aurora = el('div', 'lb-aurora');
  const head = el('header', 'lb-head');
  const titleWrap = el('div');
  titleWrap.append(el('h2', null, 'Leaderboard'), el('p', 'lb-sub', 'Season one · live XP'));
  const closeBtn = el('button', 'lb-close', '✕');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close leaderboard');
  head.append(titleWrap, closeBtn);
  const list = el('div', 'lb-list');
  panel.append(aurora, head, list);
  scrim.appendChild(panel);
  document.body.appendChild(scrim);

  const open = () => { scrim.classList.add('lb-open'); render(); };
  const close = () => scrim.classList.remove('lb-open');
  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // --- state -------------------------------------------------------------
  let me = null;          // firebase user
  let myScore = null;     // last published score
  let rows = [];          // live board rows
  let boardOn = false;
  let unsubscribe = null;
  let syncTimer = null;

  // --- rank chip inside the passport XP card (always visible) ------------
  const rankChip = el('div', 'lb-rank-chip');
  rankChip.setAttribute('role', 'status');
  function placeChip() {
    const card = document.getElementById('xpCard');
    if (card && rankChip.parentElement !== card) card.insertBefore(rankChip, card.firstChild);
  }
  function updateRankChip() {
    placeChip();
    let txt;
    if (!me) txt = '🏆 Sign in to rank';
    else if (!boardOn || !rows.length) txt = '🏆 Rank —';
    else {
      const i = rows.findIndex((r) => r.id === me.uid);
      txt = i >= 0 ? `🏆 Rank #${i + 1} of ${rows.length}` : `🏆 Top ${rows.length}+`;
    }
    rankChip.textContent = txt;
  }
  // The engine re-renders #xpCard; keep the chip pinned on top.
  const xpCardEl = document.getElementById('xpCard');
  if (xpCardEl) new MutationObserver(placeChip).observe(xpCardEl, { childList: true });
  setInterval(placeChip, 1500);

  // --- Ranks card inside the Progress screen (a subcategory of Passport) ---
  const inlineCard = el('div', 'card pad lb-inline');
  const inlineHead = el('div', 'lb-inline-head');
  inlineHead.append(el('h3', null, 'Leaderboard'), el('span', 'eyebrow', 'Season one · live XP'));
  const inlineList = el('div', 'lb-list');
  inlineCard.append(inlineHead, inlineList);
  function placeInline() {
    const host = document.querySelector('#view-passport .passport-wrap .side-stack')
      || document.querySelector('#view-passport .passport-wrap');
    if (host && inlineCard.parentElement !== host) { host.appendChild(inlineCard); render(); }
  }
  placeInline();
  setInterval(placeInline, 1500);

  // --- XP + streak chips in the coach dock ---------------------------------
  const statDock = el('div', 'lb-stat-dock');
  const statXp = el('span', 'lb-stat-xp', '⚡ 0 XP');
  const statStreak = el('span', 'lb-stat-streak', '🔥 0 days');
  statDock.append(statXp, statStreak);
  function mountStats() {
    const dock = document.querySelector('.coach-dock');
    if (dock && statDock.parentElement !== dock) dock.insertBefore(statDock, dock.firstChild);
  }
  mountStats();
  setInterval(mountStats, 1500);
  function updateStatDock() {
    const mine = me && rows.find((r) => r.id === me.uid);
    const xp = Number((myScore && myScore.xp) ?? (mine && mine.xp) ?? 0);
    const streak = Number((myScore && myScore.streak) ?? (mine && mine.streak) ?? 0);
    statDock.hidden = !me;
    statXp.textContent = `⚡ ${xp.toLocaleString()} XP`;
    statStreak.textContent = `🔥 ${streak} day${streak === 1 ? '' : 's'}`;
  }
  updateStatDock();

  function paint(target) {
    target.textContent = '';
    if (!me) {
      const note = el('div', 'lb-note');
      note.append(
        document.createTextNode('Sign in with Google on the gate to join the board and see every quester’s XP.'),
      );
      const small = el('small', null, 'Your name and XP are the only things ever published — sessions and notes stay private to your account.');
      note.appendChild(small);
      target.appendChild(note);
      return;
    }
    if (!boardOn) {
      target.appendChild(el('div', 'lb-empty', 'Warming up the board…'));
      return;
    }
    if (!rows.length) {
      target.appendChild(el('div', 'lb-empty', 'No questers on the board yet — your next focus session claims the first spot.'));
      return;
    }
    rows.forEach((row, i) => {
      const isMe = row.id === me.uid;
      const line = el('div', 'lb-row' + (isMe ? ' lb-me' : ''));
      line.style.animationDelay = `${Math.min(i, 14) * 40}ms`;
      const rank = el('span', 'lb-rank' + (i === 0 ? ' lb-r1' : i === 1 ? ' lb-r2' : i === 2 ? ' lb-r3' : ''),
        i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1));
      const ava = el('span', 'lb-ava', initials(row.name));
      const who = el('div', 'lb-who');
      const name = el('p', 'lb-name', row.name || 'Quester');
      if (isMe) name.appendChild(el('span', 'lb-you', 'YOU'));
      const meta = el('p', 'lb-meta',
        `${row.minutes || 0} min · ${row.sessions || 0} sessions · ${row.badges || 0} badges`);
      who.append(name, meta);
      line.append(rank, ava, who, el('span', 'lb-xp', `⚡${Number(row.xp || 0).toLocaleString()}`));
      target.appendChild(line);
    });
  }

  function render() {
    updateRankChip();
    updateStatDock();
    paint(list);
    paint(inlineList);
  }

  async function publishMyScore() {
    if (!me || boardOff()) return;
    try {
      const ref = firestore.doc(db, 'users', me.uid, 'workspace', 'state');
      const snap = await firestore.getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      myScore = await computeMyScore(data.json, passportMod);
      const name = (me.displayName || 'Quester').trim().slice(0, 40) || 'Quester';
      await firestore.setDoc(firestore.doc(db, 'leaderboard', me.uid), {
        name,
        xp: myScore.xp,
        minutes: myScore.minutes,
        sessions: myScore.sessions,
        streak: myScore.streak,
        badges: myScore.badges,
        updated: Date.now(),
      }, { merge: true });
      updateStatDock();
    } catch (err) {
      console.warn('[leaderboard] could not publish score:', err);
    }
  }

  function startBoard() {
    if (unsubscribe || boardOff()) return;
    const q = firestore.query(
      firestore.collection(db, 'leaderboard'),
      firestore.orderBy('xp', 'desc'),
      firestore.limit(BOARD_SIZE),
    );
    unsubscribe = firestore.onSnapshot(q, (snap) => {
      rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      boardOn = true;
      render();
    }, (err) => {
      console.warn('[leaderboard] board listener failed:', err);
      boardOn = false;
      render();
    });
  }

  function stopBoard() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    boardOn = false;
    rows = [];
  }

  auth.onAuthStateChanged(authApi, async (user) => {
    me = user || null;
    clearInterval(syncTimer);
    syncTimer = null;
    fab.hidden = boardOff();
    if (me && !boardOff()) {
      startBoard();
      await publishMyScore();
      render();
      // Republish periodically and whenever the tab wakes, so XP climbs live.
      syncTimer = setInterval(publishMyScore, SYNC_EVERY_MS);
      document.addEventListener('visibilitychange', onWake);
    } else {
      stopBoard();
      document.removeEventListener('visibilitychange', onWake);
      render();
    }
  });

  function onWake() {
    if (document.visibilityState === 'visible' && !boardOff()) publishMyScore();
  }

  document.addEventListener('focusdial-scores', () => {
    fab.hidden = boardOff();
    if (boardOff()) {
      stopBoard();
      if (me) {
        firestore.deleteDoc(firestore.doc(db, 'leaderboard', me.uid)).catch(() => {});
      }
      return;
    }
    if (me) {
      startBoard();
      publishMyScore();
    }
  });
}

main().catch((err) => console.warn('[leaderboard] module did not start:', err));

export {};
