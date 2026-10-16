/* Study together — a table with a camera, for one partner or up to six.
 *
 * Video and audio go browser to browser (WebRTC). Firestore only holds the
 * table code, a display name, and the short notes the browsers need in order
 * to find each other. Nothing here is recorded.
 *
 * Loaded after the workspace. If this file fails, the planner still runs.
 */
import { firebaseConfig } from './firebase-config.js';
import {
  vibeById, makeTableCode, codeFromInput, tableLink, publicName,
  roomCreateBody, memberBody, shouldOffer, startsMuted,
  formatLeft, formatElapsed, formatWait, checkDue, isFresh,
  pickOpenRoom, sessionLabel, sessionTypeLabel
} from './lib/study-table.js?v=4.45.0';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }
  ],
  iceCandidatePoolSize: 4
};
const RULES_HELP = 'https://console.firebase.google.com/project/adhdrelief-bdbea/firestore/rules';
const STALE_MS = 90000;
const INVITE_KEY = 'adhd-study-pack.invite';

const $ = (id) => document.getElementById(id);

let sdk = null;
let me = null;
let localStream = null;
let roomCode = '';
let roomData = null;
let leaving = false;
let busy = false;
let lastCheck = 0;
let peers = new Map();
let stops = [];
let heart = 0;
let clockTimer = 0;
let listUnsub = null;
let phase = 'lobby';
let celebrated = false;
let revealTimer = 0;
let yieldTimer = 0;
let waitedFrom = 0;
let sharing = false;
let screenTrack = null;
let audioCtx = null;
let dialLeft = 25 * 60;
let dialTotal = 25 * 60;
let dialRun = false;

function say(text, link) {
  const el = $('tblStatus');
  if (!el) return;
  el.replaceChildren(document.createTextNode(text || ''));
  if (link) {
    el.append(' ');
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = link.label;
    el.append(a);
  }
}

function viewOn() {
  const el = $('view-together');
  return !!(el && el.classList.contains('on'));
}

function selected(name) {
  const el = document.querySelector('#view-together input[name="' + name + '"]:checked');
  return el ? el.value : '';
}

function myName() {
  let passport = null;
  try {
    const state = window.FocusDial && FocusDial.getState && FocusDial.getState();
    passport = state && state.passport;
  } catch (e) { passport = null; }
  return publicName(passport, me);
}

function paintChoices() {
  document.querySelectorAll('#view-together .tbl-opt').forEach((label) => {
    const input = label.querySelector('input');
    label.classList.toggle('is-on', !!(input && input.checked));
  });
  const start = $('tblStart');
  const ready = !!(selected('tbl-type') && selected('tbl-vibe') && selected('tbl-cam'));
  if (start) start.disabled = !ready || busy;
  const join = $('tblJoin');
  if (join) join.disabled = busy || !selected('tbl-cam') || !codeFromInput(($('tblCodeIn') || {}).value);
}

async function ensureSdk() {
  if (sdk) return sdk;
  if (!firebaseConfig) return null;
  const appSdk = await import(`${SDK}/firebase-app.js`);
  const authSdk = await import(`${SDK}/firebase-auth.js`);
  const fs = await import(`${SDK}/firebase-firestore.js`);
  if (!appSdk.getApps().length) return null;
  const app = appSdk.getApp();
  sdk = { fs, auth: authSdk.getAuth(app), db: fs.getFirestore(app) };
  sdk.auth.onAuthStateChanged((user) => {
    me = user || null;
    const sign = $('tblSign');
    if (sign) sign.hidden = !!me;
    if (viewOn() && !roomCode) watchTables();
  });
  me = sdk.auth.currentUser || null;
  const sign = $('tblSign');
  if (sign) sign.hidden = !!me;
  return sdk;
}

function mediaError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'The browser did not share the camera. Allow it for this site, then try again. Voice only works without a camera.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found. Choose voice only, then try again.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is in use by another app. Close it, or choose voice only.';
  }
  return (err && err.message) || 'The camera did not start.';
}

function firestoreError(err) {
  const code = err && (err.code || '');
  if (code === 'permission-denied' || /permission/i.test(String(err && err.message || ''))) {
    return { text: 'Signed in, but the table was refused. Publish the latest Firestore rules, then try again.', link: { href: RULES_HELP, label: 'Open the rules' } };
  }
  if (code === 'unavailable') return { text: 'The connection dropped. Try again in a moment.' };
  return { text: (err && err.message) || 'Could not open the table.' };
}

async function capture(kind) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser has no camera API. Use Safari or Chrome.');
  }
  const audio = { echoCancellation: true, noiseSuppression: true };
  const video = kind === 'audio' ? false : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
  return navigator.mediaDevices.getUserMedia({ audio, video });
}

function stopStream() {
  if (!localStream) return;
  localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
}

function seatEl(id, mine) {
  const box = $('tblSeats');
  if (!box) return null;
  let el = box.querySelector('[data-seat="' + id + '"]');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'tbl-seat' + (mine ? ' me' : '');
  el.dataset.seat = id;
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  if (mine) video.muted = true;
  const face = document.createElement('span');
  face.className = 'tbl-face';
  face.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'tbl-name';
  el.append(video, face, name);
  el.addEventListener('click', () => {
    const v = el.querySelector('video');
    if (!v) return;
    v.play().then(() => el.classList.remove('needs-tap')).catch(() => {});
  });
  box.append(el);
  return el;
}

function paintSeat(id, { name, stream, videoOn, muted, mine, conn }) {
  const el = seatEl(id, mine);
  if (!el) return;
  el.classList.toggle('me', !!mine);
  el.classList.toggle('is-off', !videoOn);
  const video = el.querySelector('video');
  if (stream && video.srcObject !== stream) {
    video.srcObject = stream;
    const played = video.play();
    if (played && played.catch) {
      played.then(() => el.classList.remove('needs-tap')).catch(() => el.classList.add('needs-tap'));
    }
  }
  const label = mine ? 'You' : (name || 'Student');
  el.querySelector('.tbl-name').textContent = muted && !mine ? label + ' · muted' : label;
  const face = el.querySelector('.tbl-face');
  face.textContent = label.replace(/^@/, '').slice(0, 2).toUpperCase();
  el.dataset.conn = conn || '';
  const seats = $('tblSeats');
  if (seats && roomData) seats.classList.toggle('tbl-pair', roomData.seats === 2 && seats.querySelectorAll('.tbl-seat:not(.me)').length > 0);
}

function dropSeat(id) {
  const el = $('tblSeats') && $('tblSeats').querySelector('[data-seat="' + id + '"]');
  if (el) el.remove();
}

function previewStream() {
  if (!screenTrack) return localStream;
  const mixed = new MediaStream();
  mixed.addTrack(screenTrack);
  const audio = localStream && localStream.getAudioTracks()[0];
  if (audio) mixed.addTrack(audio);
  return mixed;
}

function showLocal() {
  const kind = (roomData && roomData.cam) || selected('tbl-cam');
  const videoOn = !screenTrack && kind !== 'audio' && !!(localStream && localStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'));
  const audio = localStream && localStream.getAudioTracks()[0];
  const el = seatEl(me ? me.uid : 'me', true);
  if (el) el.classList.toggle('is-screen', !!screenTrack);
  paintSeat(me ? me.uid : 'me', {
    name: 'You',
    stream: previewStream(),
    videoOn: videoOn || !!screenTrack,
    muted: !audio || !audio.enabled,
    mine: true,
    conn: ''
  });
  const mute = $('tblMute');
  const cam = $('tblCam');
  const screen = $('tblScreen');
  if (mute) {
    const on = !!(audio && audio.enabled);
    mute.setAttribute('aria-label', on ? 'Mute microphone' : 'Unmute microphone');
    mute.setAttribute('aria-pressed', on ? 'false' : 'true');
    mute.classList.toggle('is-off', !on);
  }
  if (cam) {
    cam.hidden = kind === 'audio';
    cam.setAttribute('aria-label', videoOn ? 'Turn camera off' : 'Turn camera on');
    cam.setAttribute('aria-pressed', videoOn ? 'false' : 'true');
    cam.classList.toggle('is-off', !videoOn);
  }
  if (screen) {
    screen.setAttribute('aria-label', screenTrack ? 'Stop screen share' : 'Share screen');
    screen.setAttribute('aria-pressed', screenTrack ? 'true' : 'false');
    screen.classList.toggle('is-on', !!screenTrack);
  }
  paintAway();
}

function paintAway() {
  const chip = $('tblAway');
  if (!chip) return;
  const on = !!roomCode && !viewOn();
  chip.hidden = !on;
  if (!on) return;
  const video = localStream && localStream.getVideoTracks().some((t) => t.enabled);
  chip.textContent = video ? 'Camera on · return to table' : 'At the table';
}

function currentLink(code) {
  return tableLink(location.origin + location.pathname, code);
}

function publishUrl(code) {
  const link = currentLink(code);
  try { history.replaceState(null, '', link); } catch (e) {}
  try { sessionStorage.setItem(INVITE_KEY, code); } catch (e) {}
  return link;
}

function clearInviteUrl(code) {
  try { sessionStorage.removeItem(INVITE_KEY); } catch (e) {}
  try {
    if (code && codeFromInput(location.search || '') === code) history.replaceState(null, '', location.pathname);
  } catch (e) {}
}

function showPanels(which) {
  const lobby = $('tblLobby');
  const match = $('tblMatch');
  const room = $('tblRoom');
  if (lobby) lobby.hidden = which !== 'lobby';
  if (match) match.hidden = which !== 'match';
  if (room) room.hidden = which !== 'room';
  const view = $('view-together');
  if (view) view.classList.toggle('tbl-live-view', which === 'match' || which === 'room');
}

function paintMatch() {
  const type = (roomData && roomData.type) || selected('tbl-type') || 'pair';
  const vibe = vibeById((roomData && roomData.vibe) || selected('tbl-vibe'));
  const cam = (roomData && roomData.cam) || selected('tbl-cam');
  const typeEl = $('tblMatchType');
  const vibeEl = $('tblMatchVibe');
  const camEl = $('tblMatchCam');
  if (typeEl) typeEl.textContent = sessionTypeLabel(type);
  if (vibeEl) vibeEl.textContent = vibe.label;
  if (camEl) camEl.textContent = cam === 'audio' ? 'Off' : 'On';
  const title = $('tblMatchTitle');
  const sub = $('tblMatchSub');
  const banner = $('tblMatchBanner');
  const shareInstead = $('tblMatchShare');
  if (phase === 'found') {
    if (title) title.textContent = 'Perfect match found!';
    if (sub) sub.textContent = 'Connecting…';
    if (banner) banner.hidden = false;
    if (shareInstead) shareInstead.hidden = true;
  } else {
    if (title) title.textContent = type === 'group' ? 'Finding a study group…' : 'Looking for your study partner…';
    if (sub) sub.textContent = 'Finding someone ready to focus…';
    if (banner) banner.hidden = true;
    if (shareInstead) shareInstead.hidden = false;
  }
  const wait = $('tblMatchWait');
  if (wait) wait.textContent = formatWait(waitedFrom ? Date.now() - waitedFrom : 0);
}

function revealRoom() {
  if (leaving || !roomCode) return;
  phase = 'room';
  if (revealTimer) { clearTimeout(revealTimer); revealTimer = 0; }
  showPanels('room');
  showLocal();
  paintSession();
}

function celebrate() {
  if (celebrated || leaving) return;
  celebrated = true;
  phase = 'found';
  paintMatch();
  showPanels('match');
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(revealRoom, 1600);
}

function showRoom(code) {
  roomCode = code;
  leaving = false;
  const codeEl = $('tblCodeShow');
  if (codeEl) codeEl.textContent = code;
  const link = $('tblLink');
  const href = publishUrl(code);
  if (link) {
    if ('value' in link) link.value = href;
    else link.textContent = href;
  }
  stopList();
  resetDial();
}

function showLobby() {
  roomCode = '';
  roomData = null;
  phase = 'lobby';
  celebrated = false;
  waitedFrom = 0;
  if (revealTimer) { clearTimeout(revealTimer); revealTimer = 0; }
  if (yieldTimer) { clearTimeout(yieldTimer); yieldTimer = 0; }
  dialRun = false;
  stopScreen(true);
  showPanels('lobby');
  const seats = $('tblSeats');
  if (seats) seats.replaceChildren();
  const banner = $('tblInvite');
  if (banner && !codeFromInput(location.search || '')) banner.hidden = true;
  paintAway();
  if (viewOn()) watchTables();
}

function clearNet() {
  stops.splice(0).forEach((fn) => { try { fn(); } catch (e) {} });
  peers.forEach((state) => { try { state.pc.close(); } catch (e) {} });
  peers = new Map();
  if (heart) clearInterval(heart);
  if (clockTimer) clearInterval(clockTimer);
  heart = 0;
  clockTimer = 0;
}

async function hangup(opts) {
  if (leaving) return;
  leaving = true;
  const quiet = !!(opts && opts.quiet);
  const code = roomCode;
  const user = me;
  const db = sdk && sdk.db;
  const fs = sdk && sdk.fs;
  clearNet();
  if (!(opts && opts.keepStream)) stopStream();
  if (!quiet) {
    clearInviteUrl(code);
    showLobby();
  } else {
    roomCode = '';
    roomData = null;
    phase = 'lobby';
    celebrated = false;
    const seats = $('tblSeats');
    if (seats) seats.replaceChildren();
  }
  if (opts && opts.remote) {
    leaving = false;
    return;
  }
  if (!db || !user || !code) {
    leaving = false;
    return;
  }
  try {
    const roomRef = fs.doc(db, 'rooms', code);
    const memberRef = fs.doc(db, 'rooms', code, 'members', user.uid);
    await fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const mine = await tx.get(memberRef);
      if (!snap.exists()) {
        if (mine.exists()) tx.delete(memberRef);
        return;
      }
      const data = snap.data() || {};
      const count = Number(data.count) || 1;
      if (data.host === user.uid && count <= 1) {
        if (mine.exists()) tx.delete(memberRef);
        tx.delete(roomRef);
        return;
      }
      tx.update(roomRef, { count: Math.max(0, count - 1), beat: Date.now() });
    });
    await fs.deleteDoc(memberRef).catch(() => {});
  } catch (e) { /* the camera is already off; a stale seat expires on its own */ }
  leaving = false;
}

function peerFor(remoteUid) {
  if (peers.has(remoteUid)) return peers.get(remoteUid);
  const pc = new RTCPeerConnection(ICE);
  const state = { pc, ice: [], making: false, recovery: 0 };
  peers.set(remoteUid, state);
  if (localStream) {
    if (shouldOffer(me.uid, remoteUid)) {
      pc.onnegotiationneeded = async () => {
        if (state.making || pc.signalingState !== 'stable') return;
        state.making = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await send(remoteUid, 'offer', JSON.stringify(pc.localDescription));
        } catch (err) { say(mediaError(err)); }
        finally { state.making = false; }
      };
    }
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }
  pc.onicecandidate = (ev) => {
    if (ev.candidate) send(remoteUid, 'ice', JSON.stringify(ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate));
  };
  pc.ontrack = (ev) => {
    const stream = (ev.streams && ev.streams[0]) || new MediaStream([ev.track]);
    const seat = $('tblSeats') && $('tblSeats').querySelector('[data-seat="' + remoteUid + '"]');
    const name = seat ? seat.querySelector('.tbl-name').textContent.replace(/ · muted$/, '') : 'Student';
    paintSeat(remoteUid, {
      name: name === 'You' ? 'Student' : name,
      stream,
      videoOn: stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'),
      muted: false,
      mine: false,
      conn: pc.connectionState
    });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState !== 'failed' && pc.connectionState !== 'disconnected') return;
    if (pc.connectionState === 'disconnected') return;
    say('Still looking for a path between you. Same Wi-Fi is the sure one. The room stays open.');
    if (!shouldOffer(me.uid, remoteUid) || state.recovery >= 2 || pc.signalingState !== 'stable') return;
    state.recovery += 1;
    pc.createOffer({ iceRestart: true }).then(async (offer) => {
      await pc.setLocalDescription(offer);
      await send(remoteUid, 'offer', JSON.stringify(pc.localDescription));
    }).catch(() => {});
  };
  return state;
}

async function flushIce(state) {
  const queued = state.ice.splice(0);
  for (const candidate of queued) {
    try { await state.pc.addIceCandidate(candidate); } catch (e) {}
  }
}

async function onSignal(msg) {
  if (!msg || msg.from === (me && me.uid)) return;
  const state = peerFor(msg.from);
  const pc = state.pc;
  if (msg.kind === 'offer' || msg.kind === 'answer') {
    const desc = JSON.parse(msg.payload);
    if (msg.kind === 'answer' && pc.signalingState !== 'have-local-offer') return;
    await pc.setRemoteDescription(desc);
    if (msg.kind === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send(msg.from, 'answer', JSON.stringify(pc.localDescription));
    }
    await flushIce(state);
  } else if (msg.kind === 'ice') {
    const candidate = JSON.parse(msg.payload);
    if (!pc.remoteDescription) state.ice.push(candidate);
    else { try { await pc.addIceCandidate(candidate); } catch (e) {} }
  }
}

async function send(to, kind, payload) {
  if (!sdk || !me || !roomCode) return;
  const code = roomCode;
  const { fs, db } = sdk;
  for (let i = 0; i < 4; i++) {
    if (roomCode !== code) return;
    try {
      await fs.addDoc(fs.collection(db, 'rooms', code, 'signals'), {
        from: me.uid,
        to,
        kind,
        payload,
        at: Date.now()
      });
      return;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 280 * (i + 1)));
    }
  }
  if (roomCode === code) say('The connection note did not send. Stay on this page — it will try again.');
}

function resetDial() {
  dialTotal = 25 * 60;
  dialLeft = dialTotal;
  dialRun = false;
  const btn = $('tblTimerStart');
  if (btn) btn.textContent = 'Start';
  paintDial();
}

function paintDial() {
  const clock = $('tblClock');
  if (clock) clock.textContent = formatLeft(dialLeft * 1000);
  const dial = $('tblDial');
  if (dial) {
    const p = dialTotal ? (dialTotal - dialLeft) / dialTotal : 0;
    dial.style.setProperty('--p', String(Math.min(1, Math.max(0, p))));
  }
}

function paintSession() {
  if (!roomData) return;
  const label = $('tblSessionLabel');
  if (label) label.textContent = sessionLabel(roomData.type);
  const elapsed = $('tblElapsed');
  if (elapsed) elapsed.textContent = formatElapsed(Date.now() - (roomData.started || roomData.created || Date.now()));
  const intent = $('tblRoomIntent');
  if (intent) {
    const text = String(roomData.intent || '').trim();
    intent.hidden = !text;
    intent.textContent = text ? 'Today: ' + text : '';
  }
  paintDial();
  paintMatch();
}

function tickDial() {
  if (!dialRun) return;
  dialLeft = Math.max(0, dialLeft - 1);
  if (dialLeft <= 0) {
    dialRun = false;
    const btn = $('tblTimerStart');
    if (btn) btn.textContent = 'Start';
    say('Focus block done. Reset when you want another.');
  }
}

function paintClock() {
  if (!roomData) {
    paintDial();
    return;
  }
  tickDial();
  paintSession();
  const check = $('tblCheck');
  if (check) check.hidden = !checkDue(lastCheck, Date.now(), vibeById(roomData.vibe).check);
}

function noteRoster(count) {
  const n = Math.max(1, count || 1);
  const el = $('tblCount');
  if (el) el.textContent = n === 1 ? '1 participant' : n + ' participants';
  const wait = $('tblWait');
  if (wait) wait.hidden = n > 1;
  if (n > 1 && phase === 'look') celebrate();
}

function bindRoom(code) {
  const { fs, db } = sdk;
  const roomRef = fs.doc(db, 'rooms', code);
  stops.push(fs.onSnapshot(roomRef, (snap) => {
    if (leaving) return;
    if (!snap.exists()) { say('That table closed.'); hangup({ remote: true }); return; }
    roomData = snap.data();
    paintSession();
    showLocal();
  }, (err) => {
    const msg = firestoreError(err);
    say(msg.text, msg.link);
  }));
  stops.push(fs.onSnapshot(fs.collection(db, 'rooms', code, 'members'), (snap) => {
    if (leaving) return;
    const live = new Set();
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (!isFresh(data.seen, Date.now(), STALE_MS) && docSnap.id !== me.uid) return;
      live.add(docSnap.id);
      if (docSnap.id === me.uid) return;
      paintSeat(docSnap.id, {
        name: data.name || 'Student',
        videoOn: !!data.video,
        muted: !!data.muted,
        mine: false,
        conn: ''
      });
      peerFor(docSnap.id);
    });
    peers.forEach((state, id) => {
      if (!live.has(id)) { state.pc.close(); peers.delete(id); dropSeat(id); }
    });
    noteRoster(live.size);
  }));
  const incoming = fs.query(fs.collection(db, 'rooms', code, 'signals'), fs.where('to', '==', me.uid));
  stops.push(fs.onSnapshot(incoming, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type !== 'added') return;
      const data = change.doc.data();
      onSignal(data).catch(() => {});
      fs.deleteDoc(change.doc.ref).catch(() => {});
    });
  }));
  const memberRef = fs.doc(db, 'rooms', code, 'members', me.uid);
  heart = setInterval(() => {
    const now = Date.now();
    fs.updateDoc(memberRef, { seen: now }).catch(() => {});
    fs.updateDoc(roomRef, { beat: now }).catch(() => {});
  }, 25000);
  clockTimer = setInterval(paintClock, 1000);
}

async function createTable() {
  const { fs, db } = sdk;
  const type = selected('tbl-type');
  const vibe = selected('tbl-vibe');
  const cam = selected('tbl-cam');
  const open = !!($('tblOpen') && $('tblOpen').checked);
  const intent = String(($('tblIntent') || {}).value || '').trim().slice(0, 160);
  const now = Date.now();
  let code = '';
  for (let i = 0; i < 5; i++) {
    const candidate = makeTableCode();
    const ref = fs.doc(db, 'rooms', candidate);
    try {
      await fs.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error('taken');
        tx.set(ref, roomCreateBody({ uid: me.uid, name: myName(), type, vibe, cam, open, now, intent }));
        tx.set(fs.doc(db, 'rooms', candidate, 'members', me.uid), memberBody({
          name: myName(),
          now,
          muted: startsMuted(vibe),
          video: cam !== 'audio'
        }));
      });
      code = candidate;
      break;
    } catch (err) {
      if (err && err.message === 'taken') continue;
      throw err;
    }
  }
  if (!code) throw new Error('Could not find a free table code. Try again.');
  const audio = localStream && localStream.getAudioTracks()[0];
  if (audio) audio.enabled = !startsMuted(vibe);
  lastCheck = now;
  roomData = roomCreateBody({ uid: me.uid, name: myName(), type, vibe, cam, open, now, intent });
  present(code);
}

async function listedCode(type, vibe) {
  const { fs, db } = sdk;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'rooms'), fs.where('open', '==', true), fs.limit(20)));
  const rows = [];
  snap.forEach((docSnap) => rows.push([docSnap.id, docSnap.data() || {}]));
  return pickOpenRoom(rows, { type, vibe, now: Date.now(), mine: roomCode });
}

async function maybeYield() {
  if (phase !== 'look' || !roomCode || !roomData || !me || roomData.host !== me.uid || !roomData.open) return;
  const box = $('tblSeats');
  if (box && box.querySelector('.tbl-seat:not(.me)')) return;
  let rows = [];
  try {
    const { fs, db } = sdk;
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'rooms'), fs.where('open', '==', true), fs.limit(20)));
    snap.forEach((docSnap) => rows.push([docSnap.id, docSnap.data() || {}]));
  } catch (e) { return; }
  const better = pickOpenRoom(rows, { type: roomData.type, vibe: roomData.vibe, now: Date.now(), mine: roomCode });
  const other = rows.find((row) => row[0] === better);
  if (!other || (other[1].created || 0) >= (roomData.created || 0) || phase !== 'look') return;
  const next = better;
  try {
    await hangup({ quiet: true, keepStream: true });
    if (!localStream) return;
    await joinTable(next);
  } catch (err) {
    stopStream();
    showLobby();
    say((err && err.message) || 'Could not sit down. Start again.');
  }
}

function present(code) {
  showRoom(code);
  waitedFrom = waitedFrom || Date.now();
  const others = Number(roomData && roomData.count || 1) > 1;
  const matching = !!(roomData && roomData.open);
  if (matching && !others) {
    phase = 'look';
    celebrated = false;
    paintMatch();
    showPanels('match');
    if (yieldTimer) clearTimeout(yieldTimer);
    yieldTimer = setTimeout(() => { yieldTimer = 0; maybeYield().catch(() => {}); }, 1400);
  } else if (matching && others) {
    phase = 'look';
    paintMatch();
    showPanels('match');
    celebrate();
  } else {
    phase = 'room';
    showPanels('room');
    say('Share the room. Only someone with the link can sit down.');
  }
  showLocal();
  bindRoom(code);
}

async function joinTable(code) {
  const { fs, db } = sdk;
  const ref = fs.doc(db, 'rooms', code);
  const memberRef = fs.doc(db, 'rooms', code, 'members', me.uid);
  const existing = await fs.getDocs(fs.collection(db, 'rooms', code, 'members'));
  const stale = [];
  existing.forEach((docSnap) => {
    const seen = docSnap.data() && docSnap.data().seen;
    if (docSnap.id !== me.uid && !isFresh(seen, Date.now(), STALE_MS)) stale.push(docSnap.ref);
  });
  await fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No table with that code.');
    const room = snap.data();
    const mine = await tx.get(memberRef);
    let count = Number(room.count) || 0;
    if (stale[0]) { tx.delete(stale[0]); count = Math.max(0, count - 1); }
    if (!mine.exists()) {
      if (count >= Number(room.seats || 2)) throw new Error('That table is full. If someone just left, try again.');
      tx.update(ref, { count: count + 1, beat: Date.now() });
    }
    const cam = selected('tbl-cam') || room.cam;
    tx.set(memberRef, memberBody({
      name: myName(),
      now: Date.now(),
      muted: startsMuted(room.vibe),
      video: cam !== 'audio'
    }));
  });
  const snap = await fs.getDoc(ref);
  roomData = snap.data();
  const audio = localStream && localStream.getAudioTracks()[0];
  if (audio) audio.enabled = !startsMuted(roomData.vibe);
  lastCheck = Date.now();
  waitedFrom = Date.now();
  present(code);
}

async function begin(mode) {
  if (busy) return;
  primePlayback();
  paintChoices();
  const cam = selected('tbl-cam');
  if (!cam) { say('Choose camera or voice first.'); return; }
  if (mode === 'create' && (!selected('tbl-type') || !selected('tbl-vibe'))) {
    say('Choose who is at the table, and how you will work.');
    return;
  }
  let code = '';
  if (mode === 'join') {
    code = codeFromInput(($('tblCodeIn') || {}).value);
    if (!code) { say('That is not a table code.'); return; }
  }
  busy = true;
  paintChoices();
  say(cam === 'audio' ? 'Asking for the microphone…' : 'Asking for the camera…');
  try {
    /* The camera prompt has to be the first wait. Anything before it, including
       loading Firebase, can make iOS drop the tap and never show the prompt. */
    localStream = await capture(cam);
    const got = await ensureSdk();
    if (sdk && sdk.auth) me = sdk.auth.currentUser;
    if (!got || !me) {
      stopStream();
      say('Sign in with Google first. A local profile stays on this device, so a friend cannot join it.');
      return;
    }
    if (mode === 'create') {
      const matching = !!($('tblOpen') && $('tblOpen').checked);
      let joined = '';
      if (matching) {
        try { joined = await listedCode(selected('tbl-type'), selected('tbl-vibe')); }
        catch (e) { joined = ''; }
      }
      if (joined) await joinTable(joined);
      else await createTable();
    } else {
      await joinTable(code);
    }
  } catch (err) {
    stopStream();
    clearNet();
    showLobby();
    if (err && (err.name === 'NotAllowedError' || err.name === 'NotFoundError' || err.name === 'NotReadableError' || err.name === 'OverconstrainedError')) {
      say(mediaError(err));
    } else if (err && err.code) {
      const msg = firestoreError(err);
      say(msg.text, msg.link);
    } else {
      say((err && err.message) || 'Could not sit down.');
    }
  } finally {
    busy = false;
    paintChoices();
  }
}

function stopList() {
  if (listUnsub) { listUnsub(); listUnsub = null; }
}

async function watchTables() {
  stopList();
  const box = $('tblOpenList');
  if (!box) return;
  const got = await ensureSdk();
  if (!got || !sdk.auth.currentUser) {
    box.replaceChildren();
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Sign in with Google to see open tables.';
    box.append(p);
    return;
  }
  const { fs, db } = sdk;
  const q = fs.query(fs.collection(db, 'rooms'), fs.where('open', '==', true), fs.limit(20));
  listUnsub = fs.onSnapshot(q, (snap) => {
    box.replaceChildren();
    const rows = [];
    snap.forEach((docSnap) => rows.push([docSnap.id, docSnap.data() || {}]));
    const now = Date.now();
    const open = rows
      .filter(([, data]) => isFresh(data.beat, now) && Number(data.count || 0) < Number(data.seats || 2))
      .sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
    if (!open.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'No open rooms right now. Start studying and you will be the one waiting.';
      box.append(p);
      return;
    }
    open.forEach(([id, data]) => {
      const row = document.createElement('div');
      row.className = 'tbl-open-row';
      const text = document.createElement('span');
      const vibe = vibeById(data.vibe).label;
      text.textContent = (data.hostName || 'Student') + ' · ' + vibe + ' · ' + (data.count || 1) + ' of ' + (data.seats || 2);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn sm';
      btn.textContent = 'Sit';
      btn.addEventListener('click', () => {
        const input = $('tblCodeIn');
        if (input) input.value = id;
        paintChoices();
        if (!selected('tbl-cam')) { say('Choose camera or voice, then sit.'); return; }
        begin('join');
      });
      row.append(text, btn);
      box.append(row);
    });
  }, () => {
    box.replaceChildren();
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Open tables are not available yet.';
    box.append(p);
  });
}

function prefill() {
  if (roomCode) return;
  let stored = '';
  try { stored = sessionStorage.getItem(INVITE_KEY) || ''; } catch (e) { stored = ''; }
  const code = codeFromInput(location.search || '') || codeFromInput(stored);
  if (!code) return;
  try { sessionStorage.setItem(INVITE_KEY, code); } catch (e) {}
  if (!viewOn() && window.FocusDial && typeof FocusDial.view === 'function') FocusDial.view('together');
  const input = $('tblCodeIn');
  if (input && document.activeElement !== input) input.value = code;
  if (!selected('tbl-cam')) {
    const video = document.querySelector('#view-together input[name="tbl-cam"][value="video"]');
    if (video) video.checked = true;
  }
  paintChoices();
  const banner = $('tblInvite');
  if (banner) banner.hidden = false;
  const shown = $('tblInviteCode');
  if (shown) shown.textContent = code;
  const join = $('tblJoin');
  if (join) join.textContent = 'Join this table';
  say('This link is a seat at ' + code + '. Join when you are ready.');
}

async function shareInvite() {
  if (!roomCode) return;
  const link = currentLink(roomCode);
  sharing = true;
  try {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Study together', text: 'Sit with me and study. Room ' + roomCode, url: link });
        say('Send that to a friend. Opening it joins this room.');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      say('Room link copied.');
    } catch (e) {
      const box = $('tblLink');
      if (box && box.select) box.select();
      say(link);
    }
  } finally {
    setTimeout(() => { sharing = false; }, 800);
  }
}

function primePlayback() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

function stopScreen(silent) {
  if (screenTrack) {
    try { screenTrack.onended = null; screenTrack.stop(); } catch (e) {}
  }
  screenTrack = null;
  if (silent) return;
  const cam = localStream && localStream.getVideoTracks()[0];
  peers.forEach((state) => {
    const sender = state.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender && cam) sender.replaceTrack(cam).catch(() => {});
  });
  showLocal();
}

async function toggleScreen() {
  if (!roomCode) return;
  if (screenTrack) { stopScreen(false); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    say('This phone cannot share the screen. The camera still works.');
    return;
  }
  let display = null;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (err) {
    if (err && err.name === 'NotAllowedError') return;
    say('This phone cannot share the screen. The camera still works.');
    return;
  }
  const track = display.getVideoTracks()[0];
  if (!track) return;
  screenTrack = track;
  track.onended = () => stopScreen(false);
  peers.forEach((state) => {
    const sender = state.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(track).catch(() => {});
  });
  showLocal();
}

function wire() {
  const root = $('view-together');
  if (!root || root.dataset.wired) return;
  root.dataset.wired = '1';
  root.addEventListener('change', (e) => {
    if (e.target && e.target.matches && e.target.matches('input')) paintChoices();
  });
  const input = $('tblCodeIn');
  if (input) input.addEventListener('input', paintChoices);
  const start = $('tblStart');
  if (start) start.addEventListener('click', () => begin('create'));
  const join = $('tblJoin');
  if (join) join.addEventListener('click', () => begin('join'));
  const sign = $('tblSign');
  if (sign) sign.addEventListener('click', () => {
    const btn = $('googleBtn');
    if (btn) btn.click();
    else say('Google sign-in is not on this copy of the page.');
  });
  const mute = $('tblMute');
  if (mute) mute.addEventListener('click', async () => {
    const audio = localStream && localStream.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = !audio.enabled;
    showLocal();
    if (sdk && roomCode && me) {
      sdk.fs.updateDoc(sdk.fs.doc(sdk.db, 'rooms', roomCode, 'members', me.uid), { muted: !audio.enabled, seen: Date.now() }).catch(() => {});
    }
  });
  const cam = $('tblCam');
  if (cam) cam.addEventListener('click', async () => {
    const video = localStream && localStream.getVideoTracks()[0];
    if (!video) return;
    video.enabled = !video.enabled;
    showLocal();
    if (sdk && roomCode && me) {
      sdk.fs.updateDoc(sdk.fs.doc(sdk.db, 'rooms', roomCode, 'members', me.uid), { video: video.enabled, seen: Date.now() }).catch(() => {});
    }
  });
  const copy = $('tblCopy');
  if (copy) copy.addEventListener('click', async () => {
    if (!roomCode) return;
    const link = currentLink(roomCode);
    try {
      await navigator.clipboard.writeText(link);
      say('Link copied. Send it to a friend.');
    } catch (e) {
      const box = $('tblLink');
      if (box && box.select) box.select();
      say(link);
    }
  });
  const share = $('tblShare');
  if (share) share.addEventListener('click', () => shareInvite());
  const matchShare = $('tblMatchShare');
  if (matchShare) matchShare.addEventListener('click', () => revealRoom());
  const matchBack = $('tblMatchBack');
  if (matchBack) matchBack.addEventListener('click', () => hangup());
  const screenBtn = $('tblScreen');
  if (screenBtn) screenBtn.addEventListener('click', () => toggleScreen());
  const timerStart = $('tblTimerStart');
  if (timerStart) timerStart.addEventListener('click', () => {
    if (dialLeft <= 0) resetDial();
    dialRun = !dialRun;
    timerStart.textContent = dialRun ? 'Pause' : 'Start';
    paintDial();
  });
  const timerReset = $('tblTimerReset');
  if (timerReset) timerReset.addEventListener('click', () => resetDial());
  const timerClose = $('tblTimerClose');
  const timerCard = $('tblTimer');
  const timerShow = $('tblTimerShow');
  if (timerClose && timerCard) timerClose.addEventListener('click', () => { timerCard.hidden = true; if (timerShow) timerShow.hidden = false; });
  if (timerShow && timerCard) timerShow.addEventListener('click', () => { timerCard.hidden = false; timerShow.hidden = true; });
  const leave = $('tblLeave');
  if (leave) leave.addEventListener('click', () => hangup());
  const here = $('tblHere');
  if (here) here.addEventListener('click', () => {
    lastCheck = Date.now();
    paintClock();
    if (sdk && roomCode && me) {
      sdk.fs.updateDoc(sdk.fs.doc(sdk.db, 'rooms', roomCode, 'members', me.uid), { check: lastCheck, seen: lastCheck }).catch(() => {});
    }
    say('Checked in.');
  });
  const back = document.createElement('button');
  back.type = 'button';
  back.id = 'tblAway';
  back.className = 'chip tbl-away';
  back.hidden = true;
  back.textContent = 'At the table';
  const bar = document.querySelector('.topbar');
  if (bar) bar.append(back);
  back.addEventListener('click', () => {
    if (window.FocusDial && typeof FocusDial.view === 'function') FocusDial.view('together');
  });
  document.addEventListener('visibilitychange', paintAway);
  window.addEventListener('pagehide', () => { if (roomCode && !sharing) hangup(); });
  const obs = new MutationObserver(() => {
    paintAway();
    if (viewOn() && !roomCode) {
      ensureSdk().then(() => { watchTables(); prefill(); }).catch(() => {});
    } else if (!roomCode) stopList();
  });
  obs.observe(root, { attributes: true, attributeFilter: ['class'] });
  paintChoices();
}

function boot() {
  wire();
  if (codeFromInput(location.search || '') && window.FocusDial && typeof FocusDial.view === 'function' && !viewOn()) {
    FocusDial.view('together');
  }
  if (!firebaseConfig) {
    say('Study together needs Google sign-in, which is not set up on this copy.');
    return;
  }
  if (viewOn()) ensureSdk().then(() => { watchTables(); prefill(); }).catch(() => {});
  else prefill();
}

document.addEventListener('focusdial:ready', boot);
if (window.FocusDial && document.getElementById('view-together')) boot();
