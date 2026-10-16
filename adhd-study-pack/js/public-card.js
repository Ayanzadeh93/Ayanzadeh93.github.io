/* Public study card.
 *
 * A signed-in student can show one small card: name, @username, a line,
 * photo, and study totals. Other signed-in students open it by that
 * username. Tasks, notes, email, and keys stay on the device.
 *
 * Loaded after the workspace. If this file fails, the profile form still works.
 */
import { firebaseConfig } from './firebase-config.js';
import { publicCardBody, shareablePhoto } from './lib/public-card.js?v=4.45.0';
import { computeStats, computeXp, earnedKeys, levelFor, initialsOf } from './lib/passport.js?v=4.45.0';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const RULES = 'https://console.firebase.google.com/project/adhdrelief-bdbea/firestore/rules';

let sdk = null;
let me = null;
let timer = 0;
let gen = 0;
let sent = '';
let knownHandle = '';

const $ = (id) => document.getElementById(id);

function state() {
  try { return window.FocusDial && FocusDial.getState ? FocusDial.getState() : null; } catch (e) { return null; }
}

function say(text, link) {
  const el = $('pubStatus');
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

function mine() {
  const S = state();
  if (!S) return null;
  const stats = computeStats(S.sessions || []);
  const lv = levelFor(computeXp(stats, earnedKeys(stats)));
  const p = S.passport || {};
  return {
    listed: p.listed === true,
    localPhoto: p.avatar || '',
    card: publicCardBody({
      name: p.displayName,
      username: p.username,
      bio: p.bio,
      avatar: p.avatar,
      level: lv.level,
      xp: lv.xp,
      minutes: stats.minutes,
      streak: stats.streak
    })
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function paintInto(host, card, caption) {
  if (!host) return;
  host.replaceChildren();
  if (!card) return;
  host.classList.add('pub-card');
  const top = el('div', 'pub-top');
  const photo = el('div', 'pub-photo');
  if (card.avatar) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = card.avatar;
    photo.append(img);
  } else {
    photo.textContent = initialsOf(card.name, '?');
  }
  const id = el('div', 'pub-id');
  id.append(el('p', 'pub-name', card.name));
  id.append(el('p', 'pub-handle', card.username ? '@' + card.username : 'No username yet'));
  top.append(photo, id);
  host.append(top);
  if (card.bio) host.append(el('p', 'pub-bio', card.bio));
  const stats = el('div', 'pub-stats');
  [['Level', String(card.level)], ['Minutes', String(card.minutes)], ['Streak', String(card.streak) + (card.streak === 1 ? ' day' : ' days')]].forEach(([k, v]) => {
    const cell = el('div', 'pub-stat');
    cell.append(el('strong', '', v), el('span', '', k));
    stats.append(cell);
  });
  host.append(stats);
  if (caption) host.append(el('p', 'pub-cap', caption));
}

function paintPreview() {
  const info = mine();
  if (!info) return;
  const cap = info.listed
    ? (info.card.username ? 'Signed-in students can open this card.' : 'Add a username before this card can be found.')
    : 'Only you. Turn on Show my card when you want it found.';
  paintInto($('pubPreview'), info.card, cap);
  const box = $('pubListed');
  if (box && document.activeElement !== box) box.checked = info.listed;
}

async function ensureSdk() {
  if (sdk) return sdk;
  if (!firebaseConfig) return null;
  const appMod = await import(`${SDK}/firebase-app.js`);
  const authMod = await import(`${SDK}/firebase-auth.js`);
  const fsMod = await import(`${SDK}/firebase-firestore.js`);
  if (!appMod.getApps().length) return null;
  const app = appMod.getApp();
  sdk = { auth: authMod.getAuth(app), fs: fsMod, db: fsMod.getFirestore(app) };
  return sdk;
}

function denied(err) {
  const code = err && (err.code || '');
  return code === 'permission-denied' || code === 'failed-precondition';
}

async function publish() {
  const info = mine();
  if (!info || !info.listed) return;
  if (!info.card.username) {
    say('Choose a username first. That is the name a friend types.');
    return;
  }
  const body = JSON.stringify(info.card);
  if (body === sent) return;
  const n = ++gen;
  try {
    const live = await ensureSdk();
    if (!live || !me) { say('Sign in with Google to show this card.'); return; }
    const { fs, db } = live;
    const profileRef = fs.doc(db, 'profiles', me.uid);
    const prev = await fs.getDoc(profileRef);
    if (n !== gen) return;
    const oldName = (prev.exists() && prev.data().username) || knownHandle;
    const handleRef = fs.doc(db, 'handles', info.card.username);
    await fs.runTransaction(db, async (tx) => {
      const handle = await tx.get(handleRef);
      if (handle.exists() && handle.data().uid !== me.uid) {
        const err = new Error('taken');
        err.code = 'taken';
        throw err;
      }
      tx.set(handleRef, { uid: me.uid });
      if (oldName && oldName !== info.card.username) {
        const oldRef = fs.doc(db, 'handles', oldName);
        const old = await tx.get(oldRef);
        if (old.exists() && old.data().uid === me.uid) tx.delete(oldRef);
      }
    });
    if (n !== gen) return;
    await fs.setDoc(profileRef, info.card);
    if (n !== gen) return;
    sent = body;
    knownHandle = info.card.username;
    const dropped = info.localPhoto && !info.card.avatar && !shareablePhoto(info.localPhoto);
    say(dropped
      ? 'Card is public. The photo was too large, so the card shows your initials.'
      : 'Card is public. A friend can open @' + info.card.username + '.');
  } catch (err) {
    if (n !== gen) return;
    if (err && err.code === 'taken') {
      say('That username is already on someone else’s card. Pick another.');
      if (!knownHandle) setListed(false);
    }
    else if (denied(err)) say('The card could not be saved until the database rules are published.', { href: RULES, label: 'Publish rules' });
    else say('The card did not save. Try again.');
  }
}

async function unpublish() {
  const n = ++gen;
  sent = '';
  try {
    const live = await ensureSdk();
    if (!live || !me) { say('Private. Only you can see this card.'); return; }
    const { fs, db } = live;
    const profileRef = fs.doc(db, 'profiles', me.uid);
    const prev = await fs.getDoc(profileRef);
    const name = (prev.exists() && prev.data().username) || knownHandle;
    await fs.deleteDoc(profileRef);
    if (name) {
      const handleRef = fs.doc(db, 'handles', name);
      const handle = await fs.getDoc(handleRef);
      if (handle.exists() && handle.data().uid === me.uid) await fs.deleteDoc(handleRef);
    }
    if (n !== gen) return;
    knownHandle = '';
    say('Private. Only you can see this card.');
  } catch (err) {
    if (n !== gen) return;
    if (denied(err)) say('Could not hide the card until the database rules are published.', { href: RULES, label: 'Publish rules' });
    else say('Could not hide the card. Try again.');
  }
}

function schedule() {
  clearTimeout(timer);
  const info = mine();
  if (!info || !info.listed) return;
  timer = setTimeout(publish, 700);
}

function setListed(on) {
  if (!window.FocusDial || !FocusDial.setState) return;
  const S = state();
  if (!S || !S.passport || S.passport.listed === on) return;
  FocusDial.setState({ passport: { listed: on } });
}

async function findCard() {
  const input = $('pubFind');
  const host = $('pubResult');
  const raw = (input && input.value || '').trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9_]{2,24}$/.test(raw)) {
    if (host) host.replaceChildren();
    say('Type a username, like @aydin.');
    return;
  }
  try {
    const live = await ensureSdk();
    if (!live || !me) { say('Sign in with Google to open someone else’s card.'); return; }
    const { fs, db } = live;
    const handle = await fs.getDoc(fs.doc(db, 'handles', raw));
    if (!handle.exists()) {
      if (host) { host.className = ''; host.replaceChildren(); }
      say('No public card for @' + raw + '.');
      return;
    }
    const profile = await fs.getDoc(fs.doc(db, 'profiles', handle.data().uid));
    if (!profile.exists()) {
      if (host) { host.className = ''; host.replaceChildren(); }
      say('No public card for @' + raw + '.');
      return;
    }
    const card = publicCardBody(profile.data(), profile.data().updated);
    paintInto(host, card, handle.data().uid === me.uid ? 'This is your card.' : 'A public study card.');
    say('Opened @' + (card.username || raw) + '.');
  } catch (err) {
    if (denied(err)) say('Cards are not available until the database rules are published.', { href: RULES, label: 'Publish rules' });
    else say('Could not open that card.');
  }
}

function wire() {
  const root = $('view-profile');
  if (!root || root.dataset.pubWired) return;
  root.dataset.pubWired = '1';
  const box = $('pubListed');
  if (box) box.addEventListener('change', () => {
    const info = mine();
    if (box.checked && info && !info.card.username) {
      box.checked = false;
      say('Choose a username first. That is the name a friend types.');
      return;
    }
    if (box.checked && !me) {
      box.checked = false;
      say('Sign in with Google to show this card.');
      return;
    }
    setListed(box.checked);
    if (box.checked) publish();
    else unpublish();
  });
  const go = $('pubFindGo');
  if (go) go.addEventListener('click', findCard);
  const input = $('pubFind');
  if (input) input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); findCard(); }
  });
}

let wired = false;
let watching = false;
let arming = false;

async function boot() {
  if (!wired) {
    wired = true;
    wire();
    document.addEventListener('focusdial:change', () => {
      paintPreview();
      schedule();
    });
  }
  paintPreview();
  if (!firebaseConfig) {
    say('Public cards need Google sign-in, which is not set up on this copy.');
    return;
  }
  if (watching || arming) return;
  arming = true;
  try {
    const live = await ensureSdk();
    if (!live) { arming = false; return; }
    watching = true;
    live.auth.onAuthStateChanged((user) => {
      me = user || null;
      paintPreview();
      if (!me) { say('Sign in with Google to show your card, or to open someone else’s.'); return; }
      const info = mine();
      if (info && info.listed) publish();
      else say('Private. Only you can see this card.');
    });
  } catch (e) {
    arming = false;
    say('Public cards could not reach the sign-in service.');
  }
}

document.addEventListener('focusdial:ready', boot);
if (window.FocusDial && document.getElementById('view-profile')) boot();
