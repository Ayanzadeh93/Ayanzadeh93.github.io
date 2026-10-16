/* Voice — speak or type a list, then add it or place it on today.
 *
 * The microphone belongs to the browser. This file only receives text.
 * Loaded after the workspace. If it fails, the typed task box still works.
 */
import { interpret, formatSpan, openMinutes, packDay } from './lib/voice.js?v=4.45.0';

const CHOICES = [15, 25, 30, 45, 60, 90, 120];
const $ = (id) => document.getElementById(id);

let rows = [];
let seq = 1;
let want = false;
let rec = null;
let wired = false;

function app() {
  return window.FocusDial || null;
}

function say(text) {
  const el = $('voiceStatus');
  if (el) el.textContent = text || '';
  const live = $('voiceLive');
  if (live && !text) return;
}

function todayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function state() {
  try { return app() && app().getState ? app().getState() : null; } catch (e) { return null; }
}

function supported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function paintMic() {
  const btn = $('voiceMic');
  if (!btn) return;
  btn.textContent = want ? 'Stop' : 'Speak';
  btn.setAttribute('aria-pressed', want ? 'true' : 'false');
  btn.classList.toggle('is-on', want);
}

function paint() {
  const list = $('voiceList');
  const S = state();
  const now = new Date();
  const open = S ? openMinutes(now, S.settings.dayStart, S.settings.dayEnd, S.events) : 0;
  const picked = rows.filter(r => r.on).reduce((n, r) => n + r.minutes, 0);
  const openEl = $('voiceOpen');
  const pickEl = $('voicePick');
  const bar = $('voiceBar');
  if (openEl) openEl.textContent = formatSpan(open);
  if (pickEl) pickEl.textContent = formatSpan(picked);
  if (bar) {
    const pct = open ? Math.min(100, Math.round(picked / open * 100)) : (picked ? 100 : 0);
    bar.style.width = pct + '%';
    bar.classList.toggle('is-over', picked > open);
  }
  if (!list) return;
  list.replaceChildren();
  rows.forEach(row => {
    const li = document.createElement('li');
    li.className = 'voice-row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = row.on;
    box.setAttribute('aria-label', 'Include ' + row.title);
    box.addEventListener('change', () => { row.on = box.checked; paint(); });
    const name = document.createElement('span');
    name.className = 'voice-name';
    name.textContent = row.title;
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Time for ' + row.title);
    const mins = CHOICES.includes(row.minutes) ? CHOICES : CHOICES.concat(row.minutes).sort((a, b) => a - b);
    mins.forEach(m => {
      const opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = formatSpan(m);
      if (m === row.minutes) opt.selected = true;
      sel.append(opt);
    });
    sel.addEventListener('change', () => { row.minutes = +sel.value || 25; paint(); });
    li.append(box, name, sel);
    list.append(li);
  });
  const add = $('voiceAdd');
  const place = $('voicePlace');
  const any = rows.some(r => r.on);
  if (add) add.disabled = !any;
  if (place) place.disabled = !any;
}

function pushTasks(items) {
  items.forEach(item => {
    if (!item || item.kind !== 'task' || !item.title) return;
    if (rows.some(r => r.title.toLowerCase() === item.title.toLowerCase())) return;
    rows.push({ id: String(seq++), title: item.title, minutes: item.minutes || 25, on: true });
  });
  paint();
}

function run(act) {
  const dial = app();
  if (!dial) { say('The workspace is still loading.'); return; }
  if (act.kind === 'start') { dial.start(); dial.view('focus'); say('Focus started.'); return; }
  if (act.kind === 'pause') { dial.pause(); say('Timer paused.'); return; }
  if (act.kind === 'skip') { dial.skip(); say('Next interval.'); return; }
  if (act.kind === 'go') { dial.view(act.view); say('Opened ' + act.view + '.'); return; }
  if (act.kind === 'note') { dial.addNote(act.text, 'parked'); say('Parked. It stays in notes.'); return; }
  if (act.kind === 'focus') {
    const S = state();
    const needle = act.title.toLowerCase();
    const hit = (S && S.tasks || []).find(t => !t.done && String(t.title || '').toLowerCase().includes(needle));
    if (!hit) { say('No open task matches that.'); return; }
    dial.focusTask(hit.id);
    dial.start();
    dial.view('focus');
    say('Working on ' + hit.title + '.');
  }
}

function take(text) {
  const acts = interpret(text);
  if (!acts.length) { say('Nothing to add from that.'); return; }
  const tasks = acts.filter(a => a.kind === 'task');
  acts.filter(a => a.kind !== 'task').forEach(run);
  if (tasks.length) {
    pushTasks(tasks);
    say(tasks.length === 1 ? 'Added to the list. Nothing is saved until you confirm.' : tasks.length + ' lines on the list. Nothing is saved until you confirm.');
  }
}

function listen() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    say('This browser has no speech recognition. Type the list, then use this text.');
    return;
  }
  want = true;
  paintMic();
  try {
    rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const bit = event.results[i][0] ? event.results[i][0].transcript : '';
        if (event.results[i].isFinal) take(bit);
        else interim += bit;
      }
      const live = $('voiceLive');
      if (live) live.textContent = interim ? interim : (want ? 'Listening' : '');
    };
    rec.onerror = (event) => {
      const code = event && event.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        want = false;
        say('The browser did not share the microphone. Allow it for this site, or type the list.');
        paintMic();
      } else if (code === 'audio-capture') {
        want = false;
        say('No microphone was found. Type the list instead.');
        paintMic();
      } else if (code !== 'no-speech' && code !== 'aborted') {
        say('Listening stopped. You can type instead.');
      }
    };
    rec.onend = () => {
      if (!want) { paintMic(); return; }
      try { rec.start(); } catch (e) { want = false; paintMic(); say('Listening stopped. Tap Speak to try again.'); }
    };
    rec.start();
    const live = $('voiceLive');
    if (live) live.textContent = 'Listening';
    say('Say everything on your mind. Tap Stop when the list looks right.');
  } catch (e) {
    want = false;
    paintMic();
    say('Could not start the microphone. Type the list instead.');
  }
}

function hush() {
  want = false;
  try { if (rec) rec.stop(); } catch (e) {}
  paintMic();
  const live = $('voiceLive');
  if (live && live.textContent === 'Listening') live.textContent = '';
}

function chosen() {
  return rows.filter(r => r.on && r.title);
}

function clearList() {
  rows = [];
  const box = $('voiceWrite');
  if (box) box.value = '';
  paint();
}

function addInbox() {
  const dial = app();
  const picks = chosen();
  if (!dial || !picks.length) return;
  picks.forEach(row => {
    dial.addTask({
      title: row.title,
      est: Math.max(1, Math.min(16, Math.round(row.minutes / 25))),
      energy: 'med'
    });
  });
  clearList();
  say(picks.length === 1 ? 'In the inbox.' : picks.length + ' in the inbox.');
  dial.view('tasks');
}

function placeToday() {
  const dial = app();
  const S = state();
  const picks = chosen();
  if (!dial || !S || !picks.length) return;
  const now = new Date();
  const packed = packDay(picks, {
    now,
    dayStart: S.settings.dayStart,
    dayEnd: S.settings.dayEnd,
    events: S.events
  });
  const due = todayKey(now);
  packed.placed.forEach(p => {
    const task = dial.addTask({
      title: p.title,
      est: Math.max(1, Math.min(16, Math.round(p.minutes / 25))),
      energy: 'med',
      due
    });
    dial.addEvent({ title: p.title, start: p.start, end: p.end, kind: 'study', taskId: task && task.id });
  });
  packed.left.forEach(p => {
    dial.addTask({
      title: p.title,
      est: Math.max(1, Math.min(16, Math.round(p.minutes / 25))),
      energy: 'med'
    });
  });
  clearList();
  if (!packed.placed.length) say('No open time left today. They stayed in the inbox.');
  else if (packed.left.length) say(packed.placed.length + ' on today. ' + packed.left.length + ' stayed in the inbox.');
  else say(packed.placed.length === 1 ? 'On today.' : packed.placed.length + ' on today.');
  dial.view(packed.placed.length ? 'plan' : 'tasks');
}

function open() {
  const sheet = $('voiceSheet');
  if (!sheet) return;
  sheet.hidden = false;
  paint();
  if (!supported()) {
    const btn = $('voiceMic');
    if (btn) btn.disabled = true;
    say('This browser has no speech recognition. Type the list, then use this text.');
  }
  const close = $('voiceClose');
  if (close) close.focus();
}

function close() {
  hush();
  const sheet = $('voiceSheet');
  if (sheet) sheet.hidden = true;
}

function wire() {
  if (wired || !$('voiceSheet')) return;
  wired = true;
  const mic = $('voiceMic');
  if (mic) mic.addEventListener('click', () => { if (want) hush(); else listen(); });
  const shut = $('voiceClose');
  if (shut) shut.addEventListener('click', close);
  const sheet = $('voiceSheet');
  if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  const use = $('voiceUse');
  if (use) use.addEventListener('click', () => take(($('voiceWrite') || {}).value || ''));
  const add = $('voiceAdd');
  if (add) add.addEventListener('click', addInbox);
  const place = $('voicePlace');
  if (place) place.addEventListener('click', placeToday);
  const taskBtn = $('taskVoice');
  if (taskBtn) taskBtn.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('voiceSheet') && !$('voiceSheet').hidden) close();
  });
  window.StudyVoice = { open, close };
}

document.addEventListener('focusdial:ready', wire);
if (window.FocusDial && document.getElementById('voiceSheet')) wire();
