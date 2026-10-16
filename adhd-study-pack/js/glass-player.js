/**
 * Glass player — desk pieces synthesised here, plus Spotify and YouTube Music.
 * Both stay in their own players. The equalizer can only
 * shape sound this page generates.
 */
import { FOCUS_SPOTIFY, FOCUS_YOUTUBE, EQ_BANDS, EQ_PRESETS, parseMusicLink } from './music-link.js?v=4.45.0';
import { secretName } from './lib/secrets.js?v=4.45.0';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MPENTA = [0, 3, 5, 7, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

function deg(root, scale, degree, octave) {
  const n = scale.length;
  const wrapped = ((degree % n) + n) % n;
  const oct = Math.floor(degree / n) + (octave || 0);
  return root + scale[wrapped] + oct * 12;
}
function hold(events, root, scale, degrees, beat, dur, vel, voice, octave) {
  degrees.forEach((d) => {
    events.push({ b: beat, m: deg(root, scale, d, octave), d: dur, v: vel, k: voice });
  });
}
function phrase(events, root, scale, voice, start, pattern, octave, vel) {
  let beat = start;
  pattern.trim().split(/\s+/).forEach((tok) => {
    const parts = tok.split(':');
    const note = parts[0];
    const len = Number(parts[1] || 1);
    const v = parts[2] != null ? Number(parts[2]) : vel;
    if (note !== 'r') {
      const bits = note.split('.');
      events.push({
        b: Math.round(beat * 4) / 4,
        m: deg(root, scale, Number(bits[0]), (bits[1] ? Number(bits[1]) : 0) + (octave || 0)),
        d: len,
        v: v,
        k: voice
      });
    }
    beat = Math.round((beat + len) * 4) / 4;
  });
}
function tile(events, built, times, shift) {
  for (let i = 0; i < times; i++) {
    built.forEach((ev) => events.push({ b: Math.round((ev.b + i * shift) * 4) / 4, m: ev.m, d: ev.d, v: ev.v, k: ev.k }));
  }
}
function roots(events, root, scale, degrees, span, every, dur, vel, octave) {
  degrees.forEach((degree, i) => {
    for (let b = i * span; b < (i + 1) * span; b += every) {
      events.push({ b: b, m: deg(root, scale, degree, octave), d: dur, v: vel, k: 'bass' });
    }
  });
}
function indexSong(song) {
  const map = new Map();
  song.events.forEach((ev) => {
    const q = Math.round(ev.b * 4) / 4;
    if (!map.has(q)) map.set(q, []);
    map.get(q).push(ev);
  });
  song.map = map;
  return song;
}

function paperLamp() {
  const e = [];
  const root = 62;
  [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]].forEach((ch, i) => hold(e, root, MAJOR, ch, i * 16, 16, 0.2, 'pad', -1));
  roots(e, root, MAJOR, [0, 4, 5, 3], 16, 4, 3.2, 0.34, -2);
  phrase(e, root, MAJOR, 'piano', 0, '0:1 2:1 4:2 4:1 2:1 1:2 0:2 2:2 4:4 5:1 4:1 2:2 4:1 2:1 0:2 1:2 2:2 0:4', 0, 0.55);
  phrase(e, root, MAJOR, 'piano', 32, '2:1 4:1 5:2 4:1 2:1 4:2 7:2 5:2 4:4 2:1 1:1 0:2 0:1 2:1 4:2 2:2 1:2 0:4', 0, 0.52);
  return e;
}
function windowRain() {
  const e = [];
  const root = 69;
  [[0, 2, 4], [5, 7, 9], [2, 4, 6], [6, 8, 10]].forEach((ch, i) => hold(e, root, MINOR, ch, i * 16, 16, 0.18, 'pad', -1));
  roots(e, root, MINOR, [0, 5, 2, 6], 16, 4, 3, 0.3, -2);
  const fig = [];
  phrase(fig, root, MPENTA, 'pluck', 0, '0:0.5 2:0.5 3:0.5 2:0.5 1:0.5 2:0.5 4:0.5 3:0.5', 0, 0.26);
  tile(e, fig, 8, 8);
  phrase(e, root, MINOR, 'piano', 0, '0:6 r:10 4:6 r:10 3:6 r:10 0:8', 1, 0.4);
  return e;
}
function nightLibrary() {
  const e = [];
  const root = 65;
  [[0, 2, 4], [2, 4, 6], [3, 5, 7], [0, 2, 4]].forEach((ch, i) => hold(e, root, MAJOR, ch, i * 16, 16, 0.22, 'pad', -1));
  roots(e, root, MAJOR, [0, 2, 3, 0], 16, 8, 6, 0.28, -2);
  phrase(e, root, MAJOR, 'piano', 0, '0:4 r:4 2:4 r:4 4:6 r:2 2:4 r:4 0:4 r:4 4:4 r:4 3:6 r:2 0:8', 0, 0.48);
  return e;
}
function mossPath() {
  const e = [];
  const root = 64;
  [[0, 2, 4], [3, 5, 7], [0, 2, 4], [6, 8, 10]].forEach((ch, i) => hold(e, root, MINOR, ch, i * 16, 16, 0.16, 'pad', -1));
  roots(e, root, MINOR, [0, 3, 0, 6], 16, 4, 2.4, 0.32, -2);
  const fig = [];
  phrase(fig, root, MPENTA, 'pluck', 0, '0:0.5 1:0.5 2:0.5 4:0.5 3:0.5 2:0.5 1:0.5 0:0.5', 0, 0.3);
  tile(e, fig, 8, 8);
  phrase(e, root, MINOR, 'piano', 4, '0:2 2:2 r:4 4:2 3:2 r:4 2:4 r:4 0:4', 1, 0.42);
  return e;
}
function harbor() {
  const e = [];
  const root = 60;
  [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]].forEach((ch, i) => hold(e, root, MAJOR, ch, i * 16, 16, 0.18, 'pad', -1));
  roots(e, root, MAJOR, [0, 5, 3, 4], 16, 4, 3.4, 0.32, -2);
  phrase(e, root, MAJOR, 'piano', 0, '0:2 4:2 2:2 4:2 0:2 4:2 2:4 5:2 9:2 7:2 5:2 3:2 5:2 7:2 5:4 4:2 6:2 4:2 2:2 0:2 2:2 4:4', 0, 0.5);
  return e;
}
function firstPage() {
  const e = [];
  const root = 67;
  [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]].forEach((ch, i) => hold(e, root, MAJOR, ch, i * 16, 16, 0.17, 'pad', -1));
  roots(e, root, MAJOR, [0, 3, 1, 4], 16, 4, 2.2, 0.3, -2);
  phrase(e, root, MAJOR, 'piano', 0, '0:1 2:1 4:2 5:1 4:1 2:2 0:2 4:2 2:1 1:1 0:2 2:1 4:1 5:2 4:2 2:2 0:4', 0, 0.5);
  phrase(e, root, MAJOR, 'piano', 32, '4:1 5:1 4:2 2:1 4:1 5:2 7:2 5:1 4:1 2:2 0:1 2:1 4:2 2:2 1:2 0:4', 0, 0.48);
  return e;
}
function ember() {
  const e = [];
  const root = 62;
  [[0, 2, 4], [5, 7, 9], [2, 4, 6], [6, 8, 10]].forEach((ch, i) => hold(e, root, MINOR, ch, i * 16, 16, 0.22, 'pad', -1));
  roots(e, root, MINOR, [0, 5, 2, 6], 16, 4, 3.5, 0.33, -2);
  phrase(e, root, MINOR, 'piano', 0, '0:2 r:2 2:2 r:2 3:4 5:2 r:2 3:2 r:2 2:4 0:4 r:4 3:2 2:2 0:8', 0, 0.5);
  phrase(e, root, MINOR, 'piano', 32, '4:2 r:2 5:4 3:2 r:2 2:4 0:2 r:2 2:2 0:4 r:4', 0, 0.46);
  return e;
}
function tide() {
  const e = [];
  const root = 65;
  [[0, 2, 4], [1, 3, 5], [4, 6, 8], [0, 2, 4]].forEach((ch, i) => hold(e, root, LYDIAN, ch, i * 16, 16, 0.2, 'pad', -1));
  roots(e, root, LYDIAN, [0, 1, 4, 0], 16, 8, 7, 0.26, -2);
  phrase(e, root, LYDIAN, 'piano', 2, '0:8 r:8 4:8 r:8 2:6 r:2 0:8 r:8 4:4', 0, 0.4);
  return e;
}

export const SONGS = [
  { id: 'paper-lamp', title: 'Paper lamp', feel: 'Slow piano', scene: 'desk', bpm: 66, loopBeats: 64, events: paperLamp() },
  { id: 'window-rain', title: 'Window rain', feel: 'Soft figures', scene: 'rain', bpm: 62, loopBeats: 64, events: windowRain() },
  { id: 'night-library', title: 'Night library', feel: 'Long notes', scene: 'hearth', bpm: 56, loopBeats: 64, events: nightLibrary() },
  { id: 'moss-path', title: 'Moss path', feel: 'A light path', scene: 'forest', bpm: 74, loopBeats: 64, events: mossPath() },
  { id: 'harbor', title: 'Harbor', feel: 'Open chords', scene: 'ocean', bpm: 64, loopBeats: 64, events: harbor() },
  { id: 'first-page', title: 'First page', feel: 'A brighter walk', scene: 'desk', bpm: 78, loopBeats: 64, events: firstPage() },
  { id: 'ember', title: 'Ember', feel: 'Warm and low', scene: 'hearth', bpm: 60, loopBeats: 64, events: ember() },
  { id: 'tide', title: 'Tide margin', feel: 'Almost still', scene: 'ocean', bpm: 58, loopBeats: 64, events: tide() }
].map(indexSong);

const SCENES = {
  desk: 'img/assistant-desk.jpg',
  rain: 'img/scene-rain.jpg',
  forest: 'img/scene-forest.jpg',
  hearth: 'img/scene-hearth.jpg',
  ocean: 'img/scene-ocean.jpg'
};
const KEY = 'adhd-study-pack.glass';
const state = {
  ctx: null, master: null, send: null, analyser: null, bus: null, noise: null,
  index: 0, playing: false, timer: null, viz: 0, extFade: null,
  seekBeat: 0, originBeat: 0, originTime: 0, beatAt: 0, timeAt: 0,
  seeking: false, live: [], vol: 74,
  source: 'desk', eq: EQ_PRESETS.Flat.slice(), filters: [],
  spotifyUri: FOCUS_SPOTIFY[0].uri, extTitle: FOCUS_SPOTIFY[0].title,
  yt: FOCUS_YOUTUBE[0], extPlaying: false, spotifyCtl: null, spotifyApi: null,
  spotifyLoginUntil: 0, ytPlayer: null, ytReady: null, mine: [], recent: []
};

function current() { return SONGS[state.index] || SONGS[0]; }
function reduced() {
  if (typeof document === 'undefined') return false;
  const html = document.documentElement;
  if (html.getAttribute('data-motion') === 'reduce') return true;
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && html.getAttribute('data-motion') !== 'full');
}
const LEGACY_YT = {
  'rFZHOHl-L8A': 0,
  '3PFJ9SETS4M': 3,
  'nI725iVsyoQ': 2,
  'qGohtGC5Rtk': 0
};
function loadPref() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const i = SONGS.findIndex((s) => s.id === raw.id);
    if (i >= 0) state.index = i;
    if (typeof raw.vol === 'number') state.vol = Math.max(0, Math.min(100, raw.vol));
    if (raw.source === 'spotify' || raw.source === 'youtube' || raw.source === 'desk') state.source = raw.source;
    if (Array.isArray(raw.eq) && raw.eq.length === EQ_BANDS.length) {
      state.eq = raw.eq.map((n) => Math.max(-8, Math.min(6, Number(n) || 0)));
    }
    if (typeof raw.spotifyUri === 'string' && raw.spotifyUri.startsWith('spotify:')) state.spotifyUri = raw.spotifyUri;
    if (typeof raw.extTitle === 'string' && raw.extTitle) state.extTitle = raw.extTitle;
    if (raw.yt && (raw.yt.videoId || raw.yt.list)) {
      const legacyIndex = raw.yt.list ? undefined : LEGACY_YT[raw.yt.videoId];
      state.yt = legacyIndex != null
        ? { title: FOCUS_YOUTUBE[legacyIndex].title, videoId: '', list: FOCUS_YOUTUBE[legacyIndex].list }
        : { title: raw.yt.title || 'YouTube Music', videoId: raw.yt.videoId || '', list: raw.yt.list || '' };
    }
    if (Array.isArray(raw.recent)) {
      state.recent = raw.recent.filter((r) => r && (r.uri || r.videoId || r.list) && !(r.videoId && LEGACY_YT[r.videoId] != null && !r.list)).slice(0, 4).map((r) => ({
        source: r.source === 'youtube' ? 'youtube' : 'spotify',
        title: String(r.title || 'Saved').slice(0, 80),
        uri: typeof r.uri === 'string' ? r.uri : '',
        videoId: typeof r.videoId === 'string' ? r.videoId : '',
        list: typeof r.list === 'string' ? r.list : ''
      }));
    }
  } catch (e) {}
}
function savePref() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      id: current().id, vol: state.vol, source: state.source, eq: state.eq,
      spotifyUri: state.spotifyUri, extTitle: state.extTitle, yt: state.yt, recent: state.recent
    }));
  } catch (e) {}
}
function sceneSrc(scene) {
  return (SCENES[scene] || SCENES.rain) + '?v=4.45.0';
}
function setScene(scene) {
  const img = document.getElementById('soundScene');
  if (!img) return;
  img.dataset.lock = 'song';
  const src = sceneSrc(scene);
  if (img.getAttribute('src') !== src) img.src = src;
  const room = document.querySelector('#view-sound .room');
  if (room) room.dataset.scene = scene;
}
function makeNoise(ctx) {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b = (b + 0.02 * w) / 1.02;
    d[i] = b * 3.4;
  }
  return buf;
}
function makeIR(ctx) {
  const len = Math.floor(ctx.sampleRate * 2.2);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
    }
  }
  return buf;
}
function env(ctx, t, peak, attack, hold, release) {
  const g = ctx.createGain();
  const pk = Math.max(0.0002, peak);
  const a = Math.max(0.004, attack);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pk, t + a);
  const rel = t + a + Math.max(0.02, hold);
  g.gain.setValueAtTime(Math.max(0.0002, pk * 0.7), rel);
  g.gain.exponentialRampToValueAtTime(0.0001, rel + Math.max(0.05, release));
  return { g: g, stopAt: rel + release + 0.03 };
}
function track(node) { state.live.push(node); return node; }
function playPiano(ctx, dest, freq, t, dur, vel) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4800, freq * 8), t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(280, freq * 1.6), t + Math.max(0.2, dur));
  filter.connect(dest);
  [[1, 1, 1.15], [2.003, 0.48, 0.82], [3.01, 0.24, 0.6], [4.02, 0.12, 0.45], [5.06, 0.07, 0.32], [6.1, 0.04, 0.24]].forEach((p) => {
    const o = track(ctx.createOscillator());
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * p[0], t);
    const eg = env(ctx, t, vel * 0.18 * p[1], 0.007, 0.02, Math.max(0.28, dur * p[2]));
    o.connect(eg.g); eg.g.connect(filter);
    o.start(t); o.stop(eg.stopAt);
  });
  const n = track(ctx.createBufferSource());
  n.buffer = state.noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'highpass';
  bp.frequency.value = Math.min(5000, freq * 3);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vel * 0.05, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  n.connect(bp); bp.connect(ng); ng.connect(filter);
  n.start(t); n.stop(t + 0.05);
}
function playPad(ctx, dest, freq, t, dur, vel) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(780, t);
  filter.Q.value = 0.5;
  filter.connect(dest);
  [-8, 8].forEach((cents, i) => {
    const o = track(ctx.createOscillator());
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), t);
    const eg = env(ctx, t, vel * 0.15, Math.min(0.55, dur * 0.22), dur * 0.62, 0.7);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(eg.g);
    if (panner) { panner.pan.value = i ? 0.4 : -0.4; eg.g.connect(panner); panner.connect(filter); }
    else eg.g.connect(filter);
    o.start(t); o.stop(eg.stopAt);
  });
}
function playBass(ctx, dest, freq, t, dur, vel) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 260;
  filter.connect(dest);
  [1, 2].forEach((ratio, i) => {
    const o = track(ctx.createOscillator());
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * ratio, t);
    const eg = env(ctx, t, vel * (i ? 0.08 : 0.22), 0.03, Math.max(0.05, dur * 0.7), 0.22);
    o.connect(eg.g); eg.g.connect(filter);
    o.start(t); o.stop(eg.stopAt);
  });
}
function playPluck(ctx, dest, freq, t, dur, vel) {
  const rate = ctx.sampleRate;
  const length = Math.max(8, Math.round(rate / freq));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = track(ctx.createBufferSource());
  src.buffer = buffer;
  const delay = ctx.createDelay(1);
  delay.delayTime.setValueAtTime(Math.min(1, 1 / freq), t);
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.setValueAtTime(2200, t);
  const fb = ctx.createGain();
  fb.gain.value = 0.9;
  const out = ctx.createGain();
  const stop = t + Math.min(Math.max(dur, 0.35), 2.2);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel * 0.42), t + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, stop);
  src.connect(delay);
  delay.connect(damp);
  damp.connect(fb);
  fb.connect(delay);
  damp.connect(out);
  out.connect(dest);
  src.start(t);
  src.stop(stop + 0.04);
}
function playEvent(ev, t, beatDur) {
  if (!state.bus || !state.ctx) return;
  const freq = 440 * Math.pow(2, (ev.m - 69) / 12);
  const dur = Math.max(0.12, ev.d * beatDur);
  const dest = state.bus;
  if (ev.k === 'pad') playPad(state.ctx, dest, freq, t, dur, ev.v);
  else if (ev.k === 'bass') playBass(state.ctx, dest, freq, t, dur, ev.v);
  else if (ev.k === 'pluck') playPluck(state.ctx, dest, freq, t, dur, ev.v);
  else playPiano(state.ctx, dest, freq, t, dur, ev.v);
}
function stopLive() {
  state.live.forEach((n) => { try { n.stop(); } catch (e) {} });
  state.live = [];
}
function cut() {
  stopLive();
  if (state.bus) {
    const old = state.bus;
    try {
      const t = state.ctx.currentTime;
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(Math.max(0.0001, old.gain.value), t);
      old.gain.linearRampToValueAtTime(0.0001, t + 0.04);
    } catch (e) {}
    setTimeout(() => { try { old.disconnect(); } catch (err) {} }, 90);
  }
  const bus = state.ctx.createGain();
  bus.gain.value = 1;
  bus.connect(state.master);
  bus.connect(state.send);
  state.bus = bus;
}
function ensure() {
  if (state.ctx) return state.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = (state.vol / 100) * 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 20;
  comp.ratio.value = 2.4;
  comp.attack.value = 0.012;
  comp.release.value = 0.28;
  let node = master;
  state.filters = EQ_BANDS.map((b, i) => {
    const f = ctx.createBiquadFilter();
    f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
    f.frequency.value = b.hz;
    f.Q.value = 0.9;
    f.gain.value = state.eq[i] || 0;
    node.connect(f);
    node = f;
    return f;
  });
  node.connect(comp);
  comp.connect(ctx.destination);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.82;
  comp.connect(analyser);
  const conv = ctx.createConvolver();
  conv.buffer = makeIR(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.38;
  conv.connect(wet);
  wet.connect(master);
  state.noise = makeNoise(ctx);
  const air = ctx.createBufferSource();
  air.buffer = state.noise;
  air.loop = true;
  const airF = ctx.createBiquadFilter();
  airF.type = 'lowpass';
  airF.frequency.value = 520;
  const airG = ctx.createGain();
  airG.gain.value = 0.018;
  air.connect(airF); airF.connect(airG); airG.connect(master);
  air.start();
  state.ctx = ctx;
  state.master = master;
  state.send = conv;
  state.analyser = analyser;
  return ctx;
}
function arm(beat) {
  const song = current();
  const snapped = Math.max(0, Math.min(song.loopBeats - 0.25, Math.round(beat * 4) / 4));
  cut();
  const beatDur = 60 / song.bpm;
  state.originBeat = snapped;
  state.originTime = state.ctx.currentTime + 0.05;
  state.beatAt = snapped;
  state.timeAt = state.originTime;
  state.seekBeat = snapped;
}
function tick() {
  const song = current();
  const ctx = state.ctx;
  if (!ctx || !state.playing) return;
  const beatDur = 60 / song.bpm;
  const step = beatDur * 0.25;
  if (state.timeAt < ctx.currentTime - 0.08) {
    const late = Math.ceil((ctx.currentTime - state.timeAt) / step);
    state.timeAt += late * step;
    state.beatAt = Math.round((state.beatAt + late * 0.25) * 4) / 4;
    while (state.beatAt >= song.loopBeats) state.beatAt -= song.loopBeats;
  }
  const horizon = ctx.currentTime + 0.22;
  let guard = 0;
  while (state.timeAt < horizon && guard < 48) {
    const q = Math.round(state.beatAt * 4) / 4;
    const bucket = song.map.get(q);
    if (bucket) bucket.forEach((ev) => playEvent(ev, state.timeAt, beatDur));
    state.beatAt = Math.round((state.beatAt + 0.25) * 4) / 4;
    if (state.beatAt >= song.loopBeats) state.beatAt = 0;
    state.timeAt += step;
    guard++;
  }
}
function positionBeat() {
  const song = current();
  if (!state.ctx || !state.playing) return (state.seekBeat || 0) % song.loopBeats;
  const beatDur = 60 / song.bpm;
  let b = state.originBeat + (state.ctx.currentTime - state.originTime) / beatDur;
  b %= song.loopBeats;
  if (b < 0) b += song.loopBeats;
  return b;
}
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
function loopLen() {
  const song = current();
  return song.loopBeats * (60 / song.bpm);
}
async function startAt(beat) {
  try {
    const ctx = ensure();
    if (ctx.state !== 'running') await ctx.resume();
    arm(beat);
    fadeMasterIn();
    state.playing = true;
    clearInterval(state.timer);
    state.timer = setInterval(tick, 25);
    tick();
    if (state.viz) cancelAnimationFrame(state.viz);
    const frame = () => {
      paintProgress();
      drawViz();
      if (state.playing) state.viz = requestAnimationFrame(frame);
    };
    state.viz = requestAnimationFrame(frame);
    paint();
  } catch (e) {
    state.playing = false;
    const live = document.getElementById('gpLive');
    if (live) live.textContent = 'This browser blocked the sound. Tap Play again.';
    paint();
  }
}
function pauseDesk() {
  if (!state.playing && !(state.ctx && state.ctx.state === 'running')) return;
  state.seekBeat = positionBeat();
  state.playing = false;
  clearInterval(state.timer);
  state.timer = null;
  stopLive();
  if (state.ctx && state.ctx.state === 'running') {
    fadeMasterOut(0.35);
    setTimeout(() => {
      if (!state.playing && state.ctx && state.ctx.state === 'running') {
        try { state.ctx.suspend(); } catch (e) {}
      }
    }, 380);
  }
  if (state.viz) cancelAnimationFrame(state.viz);
  state.viz = 0;
}
function pauseExternal() {
  try { if (state.spotifyCtl) state.spotifyCtl.pause(); } catch (e) {}
  try { if (state.ytPlayer && state.ytPlayer.pauseVideo) state.ytPlayer.pauseVideo(); } catch (e) {}
  state.extPlaying = false;
}
function pause() {
  pauseDesk();
  pauseExternal();
  paint();
  paintProgress();
}
function toggle() {
  if (state.source === 'spotify') { toggleSpotify(); return; }
  if (state.source === 'youtube') { toggleYouTube(); return; }
  if (state.playing) pauseDesk();
  else startAt(state.seekBeat || 0);
  paint();
  paintProgress();
}
function step(dir) {
  if (state.source === 'spotify') { stepSpotify(dir); return; }
  if (state.source === 'youtube') { stepYouTube(dir); return; }
  state.index = (state.index + dir + SONGS.length) % SONGS.length;
  state.seekBeat = 0;
  savePref();
  setScene(current().scene);
  if (state.playing) startAt(0);
  else { if (state.ctx) stopLive(); paint(); paintProgress(); }
}
function choose(i) {
  pauseExternal();
  state.source = 'desk';
  state.index = i;
  state.seekBeat = 0;
  savePref();
  setScene(current().scene);
  startAt(0);
}
function applySeek() {
  const song = current();
  const el = document.getElementById('gpSeek');
  if (!el) return;
  const beat = (Number(el.value) / 1000) * song.loopBeats;
  state.seekBeat = beat;
  if (state.playing) startAt(beat);
  else paintProgress();
}
/* Smooth fade-in/out for the desk player: the master gain ramps gently
   instead of snapping to full volume, so music arrives like a room tone. */
function masterTarget() { return (state.vol / 100) * 0.9; }
function fadeMasterIn() {
  if (!state.master || !state.ctx) return;
  const g = state.master.gain;
  const t0 = state.ctx.currentTime;
  const from = Math.max(0.0001, Math.min(g.value, masterTarget()) * 0.02);
  g.cancelScheduledValues(t0);
  g.setValueAtTime(from, t0);
  g.linearRampToValueAtTime(masterTarget(), t0 + (reduced() ? 0.15 : 1.4));
}
function fadeMasterOut(seconds) {
  if (!state.master || !state.ctx) return;
  const g = state.master.gain;
  const t0 = state.ctx.currentTime;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(Math.max(0.0001, g.value), t0);
  g.linearRampToValueAtTime(0.0001, t0 + seconds);
}
function setVol(v) {
  state.vol = v;
  stopExtFade();
  if (state.master && state.ctx) state.master.gain.setTargetAtTime((v / 100) * 0.9, state.ctx.currentTime, 0.04);
  try { if (state.ytPlayer && state.ytPlayer.setVolume) state.ytPlayer.setVolume(v); } catch (e) {}
  savePref();
}
function applyEqGain(i, value) {
  state.eq[i] = value;
  const f = state.filters[i];
  if (f && state.ctx) f.gain.setTargetAtTime(value, state.ctx.currentTime, 0.02);
  else if (f) f.gain.value = value;
  savePref();
}
function drawViz() {
  const canvas = document.getElementById('gpViz');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const bars = 32;
  let data = null;
  if (state.analyser && state.playing && !reduced()) {
    if (!state.freq) state.freq = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(state.freq);
    data = state.freq;
  }
  for (let i = 0; i < bars; i++) {
    const amp = data ? data[i % data.length] / 255 : 0.22;
    const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const inner = 46;
    const len = 8 + amp * 36;
    c.strokeStyle = amp > 0.2 ? '#e07a45' : '#8a5a42';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    c.lineTo(cx + Math.cos(ang) * (inner + len), cy + Math.sin(ang) * (inner + len));
    c.stroke();
  }
}
function paintProgress() {
  const song = current();
  const beat = state.seeking ? (Number((document.getElementById('gpSeek') || {}).value || 0) / 1000) * song.loopBeats : positionBeat();
  const pct = song.loopBeats ? beat / song.loopBeats : 0;
  const seek = document.getElementById('gpSeek');
  if (seek && !state.seeking) seek.value = String(Math.round(pct * 1000));
  const now = document.getElementById('gpNow');
  const dur = document.getElementById('gpDur');
  const sec = pct * loopLen();
  if (now) now.textContent = fmt(sec);
  if (dur) dur.textContent = fmt(loopLen());
  const ring = document.getElementById('gpRing');
  if (ring) {
    const C = 2 * Math.PI * 54;
    ring.style.strokeDasharray = String(C);
    ring.style.strokeDashoffset = String(C * (1 - pct));
  }
  const room = document.querySelector('#view-sound .room');
  if (room) room.classList.toggle('is-on', state.playing);
}
function paint() {
  const song = current();
  const external = state.source !== 'desk';
  const title = document.getElementById('gpTitle');
  const feel = document.getElementById('gpFeel');
  const kick = document.getElementById('gpKicker');
  const play = document.getElementById('gpPlay');
  const disc = document.getElementById('gpDisc');
  const live = document.getElementById('gpLive');
  const shown = state.source === 'spotify'
    ? (state.extTitle || 'Spotify')
    : state.source === 'youtube'
      ? ((state.yt && state.yt.title) || 'YouTube Music')
      : song.title;
  const feelText = state.source === 'spotify'
    ? 'Full songs after you log in to Spotify'
    : state.source === 'youtube' ? 'YouTube Music' : song.feel;
  if (title) title.textContent = shown;
  if (feel) feel.textContent = feelText;
  if (kick) {
    kick.textContent = state.source === 'spotify'
      ? 'Spotify'
      : state.source === 'youtube' ? 'YouTube Music' : ('Piece ' + String(state.index + 1).padStart(2, '0') + ' · written here');
  }
  const on = external ? state.extPlaying : state.playing;
  const label = on ? 'Pause' : 'Play';
  if (play) { play.textContent = label; play.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  if (disc) disc.setAttribute('aria-label', label + ' ' + shown);
  const lantern = document.getElementById('lantern');
  if (lantern) {
    lantern.classList.toggle('is-on', on);
    lantern.dataset.source = state.source;
  }
  document.querySelectorAll('#srcSwitch [data-src]').forEach((b) => {
    const pressed = b.dataset.src === state.source;
    b.classList.toggle('on', pressed);
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });
  document.querySelectorAll('#gpShelf [data-song]').forEach((b) => {
    const active = !external && Number(b.dataset.song) === state.index;
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const dockT = document.getElementById('dockTitle');
  const dockF = document.getElementById('dockFeel');
  const dockP = document.getElementById('dockPlay');
  if (dockT) dockT.textContent = shown;
  if (dockF) dockF.textContent = feelText;
  if (dockP) {
    dockP.textContent = on ? 'Pause' : 'Play';
    dockP.setAttribute('aria-pressed', on ? 'true' : 'false');
    dockP.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + shown);
  }
  if (live) live.textContent = (on ? 'Playing ' : '') + shown;
  const vol = document.getElementById('gpVol');
  if (vol && document.activeElement !== vol) vol.value = String(state.vol);
  const volLabel = document.querySelector('#lantern .lantern-vol span');
  if (volLabel) volLabel.textContent = state.source === 'spotify' ? 'Spotify’s own volume' : 'Volume';
  const note = document.getElementById('eqNote');
  if (note) note.textContent = external
    ? 'Equalizer shapes Desk pieces. Spotify and YouTube Music keep their own sound.'
    : 'Equalizer shapes the piece playing here.';
  document.querySelectorAll('#eqPresets [data-eqpre]').forEach((chip) => {
    const preset = EQ_PRESETS[chip.dataset.eqpre] || [];
    const on = preset.length === state.eq.length && preset.every((g, i) => g === state.eq[i]);
    chip.classList.toggle('on', on);
  });
  paintProgress();
  drawViz();
}
function setStatus(text, link) {
  const el = document.getElementById('extStatus');
  if (!el) return;
  el.replaceChildren();
  if (text) el.appendChild(document.createTextNode(text));
  if (link && link.href) {
    const a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = link.label || 'Open';
    if (text) el.appendChild(document.createTextNode(' '));
    el.appendChild(a);
  }
}
function escText(s) {
  const map = { '&': '&' + 'amp;', '<': '&' + 'lt;', '>': '&' + 'gt;', '"': '&' + 'quot;' };
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => map[c]);
}
function remember(entry) {
  const key = entry.uri || ((entry.list || '') + ':' + (entry.videoId || ''));
  if (!key) return;
  state.recent = [entry].concat(state.recent.filter((r) => (r.uri || ((r.list || '') + ':' + (r.videoId || ''))) !== key)).slice(0, 4);
  savePref();
}
function recentButtons(source) {
  return (state.recent || []).map((item, i) => {
    if (item.source !== source) return '';
    const dup = source === 'spotify'
      ? FOCUS_SPOTIFY.some((s) => s.uri === item.uri)
      : FOCUS_YOUTUBE.some((s) => (s.list && s.list === item.list) || (s.videoId && s.videoId === item.videoId && !item.list));
    if (dup) return '';
    return '<button type="button" class="focus-pick" data-recent="' + i + '">' + escText(item.title) + '</button>';
  }).join('');
}
function renderPicks() {
  const box = document.getElementById('focusPicks');
  if (!box) return;
  if (state.source === 'desk') { box.innerHTML = ''; return; }
  if (state.source === 'spotify') {
    box.innerHTML = FOCUS_SPOTIFY.map((item, i) => {
      const on = item.uri === state.spotifyUri;
      return '<button type="button" class="focus-pick' + (on ? ' on' : '') + '" data-pick="' + i + '">' + escText(item.title) + '</button>';
    }).join('') + recentButtons('spotify');
    return;
  }
  const stations = FOCUS_YOUTUBE.map((item, i) => {
    const on = item.list ? item.list === state.yt.list : item.videoId === state.yt.videoId && !state.yt.list;
    return '<button type="button" class="focus-pick' + (on ? ' on' : '') + '" data-pick="' + i + '">' + escText(item.title) + '</button>';
  }).join('');
  const mine = (state.mine || []).map((item, i) => {
    const on = item.list && item.list === state.yt.list;
    return '<button type="button" class="focus-pick' + (on ? ' on' : '') + '" data-pick="' + i + '" data-mine="1">' + escText(item.title) + '</button>';
  }).join('');
  box.innerHTML = stations + mine + recentButtons('youtube');
}
function setSource(src) {
  if (src === state.source) return;
  if (src === 'desk') pauseExternal();
  else pauseDesk();
  state.source = src;
  if (src === 'spotify' && !state.extTitle) state.extTitle = FOCUS_SPOTIFY[0].title;
  savePref();
  renderPicks();
  paint();
  if (src === 'spotify') openSpotify(state.spotifyUri, false);
  if (src === 'youtube') { loadGis().catch(() => {}); openYouTube(state.yt, false); }
}
function useSpotify(uri, title, autoplay) {
  pauseDesk();
  try { if (state.ytPlayer && state.ytPlayer.pauseVideo) state.ytPlayer.pauseVideo(); } catch (e) {}
  state.source = 'spotify';
  state.spotifyUri = uri;
  state.extTitle = title || 'Spotify';
  savePref();
  renderPicks();
  paint();
  openSpotify(uri, autoplay);
}
function useYouTube(item, autoplay) {
  pauseDesk();
  try { if (state.spotifyCtl) state.spotifyCtl.pause(); } catch (e) {}
  state.source = 'youtube';
  state.yt = { title: item.title || 'YouTube Music', videoId: item.videoId || '', list: item.list || '' };
  state.extTitle = state.yt.title;
  savePref();
  renderPicks();
  paint();
  openYouTube(state.yt, autoplay);
}
/** Start a playlist saved in the workspace using the existing player. */
export function playMusicLink(url, title) {
  const item = parseMusicLink(url);
  if (!item || typeof document === 'undefined') return false;
  mount();
  const name = String(title || item.title).slice(0, 100);
  if (item.source === 'spotify') {
    const entry = { source:'spotify', title:name, uri:item.uri, videoId:'', list:'' };
    remember(entry);
    useSpotify(entry.uri, entry.title, true);
  } else {
    const entry = { source:'youtube', title:name, uri:'', videoId:item.videoId || '', list:item.list || '' };
    remember(entry);
    useYouTube(entry, true);
  }
  return true;
}
function stepSpotify(dir) {
  let i = FOCUS_SPOTIFY.findIndex((s) => s.uri === state.spotifyUri);
  if (i < 0) i = dir > 0 ? -1 : 0;
  const next = FOCUS_SPOTIFY[(i + dir + FOCUS_SPOTIFY.length) % FOCUS_SPOTIFY.length];
  useSpotify(next.uri, next.title, true);
}
function stepYouTube(dir) {
  const pool = FOCUS_YOUTUBE.concat(state.mine || []);
  let i = pool.findIndex((s) => (s.list && s.list === state.yt.list) || (s.videoId && s.videoId === state.yt.videoId && !s.list && !state.yt.list));
  if (i < 0) i = dir > 0 ? -1 : 0;
  const next = pool[(i + dir + pool.length) % pool.length];
  useYouTube(next, true);
}
function toggleSpotify() {
  if (!state.spotifyCtl) { openSpotify(state.spotifyUri, true); return; }
  if (state.extPlaying) { try { state.spotifyCtl.pause(); } catch (e) {} state.extPlaying = false; }
  else { try { state.spotifyCtl.play(); } catch (e) {} }
  paint();
}
/* Ramp the volume of an external player (YouTube) up over about a second,
   so it fades in like the desk pieces instead of starting at full volume. */
function fadeExtIn(setV) {
  try {
    const target = state.vol;
    setV(reduced() ? target : 2);
    let step = 0;
    const steps = 12;
    clearInterval(state.extFade);
    state.extFade = setInterval(() => {
      step++;
      try { setV(Math.max(2, Math.round(target * (step / steps)))); } catch (e) {}
      if (step >= steps) clearInterval(state.extFade);
    }, 100);
  } catch (e) {}
}
function stopExtFade() { clearInterval(state.extFade); state.extFade = null; }
function toggleYouTube() {
  if (!state.ytPlayer) { openYouTube(state.yt, true); return; }
  if (state.extPlaying) { stopExtFade(); try { state.ytPlayer.pauseVideo(); } catch (e) {} state.extPlaying = false; }
  else { try { state.ytPlayer.playVideo(); fadeExtIn((v) => state.ytPlayer.setVolume(v)); } catch (e) {} }
  paint();
}
function loadSpotifyApi() {
  if (state.spotifyApi) return Promise.resolve(state.spotifyApi);
  if (state.spotifyApiPromise) return state.spotifyApiPromise;
  state.spotifyApiPromise = new Promise((ok, no) => {
    const timer = setTimeout(() => { state.spotifyApiPromise = null; no(new Error('Spotify did not load')); }, 12000);
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timer);
      state.spotifyApi = api;
      if (typeof prev === 'function') prev(api);
      ok(api);
    };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => { clearTimeout(timer); state.spotifyApiPromise = null; no(new Error('Spotify did not load')); };
    document.head.appendChild(s);
  });
  return state.spotifyApiPromise;
}
function armFrame(id) {
  const root = document.getElementById(id);
  const frame = !root ? null : (root.tagName === 'IFRAME' ? root : root.querySelector('iframe'));
  if (!frame) return;
  const allow = frame.getAttribute('allow') || '';
  if (!/encrypted-media/.test(allow)) {
    frame.setAttribute('allow', (allow ? allow + '; ' : '') + 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
  }
}
function setStatusUnlessLogin(text) {
  if (Date.now() < (state.spotifyLoginUntil || 0)) return;
  setStatus(text);
}
function loadSpotifyUri(ctl, uri) {
  if (typeof ctl.loadEntity === 'function') ctl.loadEntity(uri);
  else if (typeof ctl.loadUri === 'function') ctl.loadUri(uri);
}
function openSpotify(uri, autoplay) {
  if (!document.getElementById('spMount') && !state.spotifyCtl) return;
  setStatusUnlessLogin('Opening Spotify…');
  loadSpotifyApi().then((api) => {
    const kick = () => {
      if (!autoplay || !state.spotifyCtl) return;
      try { state.spotifyCtl.play(); } catch (e) {}
    };
    if (!state.spotifyCtl) {
      const el = document.getElementById('spMount');
      if (!el) return;
      api.createController(el, { uri: uri, width: '100%', height: 400 }, (ctl) => {
        state.spotifyCtl = ctl;
        armFrame('spWrap');
        setStatusUnlessLogin('Press Log in to Spotify for full songs.');
        ctl.addListener('playback_update', (e) => {
          const data = (e && e.data) || e || {};
          if (typeof data.isPaused !== 'boolean') return;
          const playing = data.isPaused === false;
          if (playing !== state.extPlaying) { state.extPlaying = playing; paint(); }
        });
        ctl.addListener('ready', () => {
          armFrame('spWrap');
          setStatusUnlessLogin('Press Log in to Spotify for full songs.');
          kick();
        });
      });
    } else {
      loadSpotifyUri(state.spotifyCtl, uri);
      armFrame('spWrap');
      setStatusUnlessLogin('Press Log in to Spotify for full songs.');
      kick();
      if (autoplay) setTimeout(kick, 500);
    }
  }).catch(() => setStatus('Spotify did not load. Try again in a moment.'));
}
function spotifyWebUrl(uri) {
  const parts = String(uri || '').split(':');
  const id = parts[2] || '';
  if (!id) return 'https://open.spotify.com/';
  return 'https://open.spotify.com/' + (parts[1] || 'playlist') + '/' + id;
}
function connectSpotify() {
  const popup = window.open(
    'https://accounts.spotify.com/login?continue=' + encodeURIComponent(spotifyWebUrl(state.spotifyUri)),
    'spotify-login',
    'popup,width=480,height=740'
  );
  state.spotifyLoginUntil = Date.now() + 20000;
  if (state.source !== 'spotify') setSource('spotify');
  else if (!state.spotifyCtl) openSpotify(state.spotifyUri, false);
  const frame = document.getElementById('spWrap');
  if (frame && frame.scrollIntoView) frame.scrollIntoView({ block: 'nearest' });
  if (!popup) {
    setStatus('Allow pop-ups, then press Log in to Spotify again. You can also use Log in on the player.');
    return;
  }
  setStatus('Sign in with your Spotify account in that window. Then come back and press Play.');
  const started = Date.now();
  const tick = () => {
    let closed = false;
    try { closed = !popup || popup.closed; } catch (e) { closed = true; }
    if (closed || Date.now() - started > 120000) {
      if (state.spotifyCtl) loadSpotifyUri(state.spotifyCtl, state.spotifyUri);
      if (closed) setStatus('If a song is still a preview, tap Log in on the Spotify player.');
      return;
    }
    setTimeout(tick, 800);
  };
  setTimeout(tick, 800);
}
function loadYtApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (state.ytApiPromise) return state.ytApiPromise;
  state.ytApiPromise = new Promise((ok, no) => {
    const timer = setTimeout(() => { state.ytApiPromise = null; no(new Error('YouTube did not start')); }, 12000);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof prev === 'function') prev();
      if (window.YT && window.YT.Player) ok(window.YT);
      else { state.ytApiPromise = null; no(new Error('YouTube did not start')); }
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { clearTimeout(timer); state.ytApiPromise = null; no(new Error('YouTube did not load')); };
    document.head.appendChild(s);
  });
  return state.ytApiPromise;
}
function openYouTube(item, autoplay) {
  if (!document.getElementById('ytMount') && !(state.ytPlayer && state.ytPlayer.loadVideoById)) return;
  setStatus('Opening YouTube Music…');
  loadYtApi().then((YT) => {
    const playItem = () => {
      try {
        if (item.list) {
          if (autoplay) state.ytPlayer.loadPlaylist({ list: item.list });
          else state.ytPlayer.cuePlaylist({ list: item.list });
        } else if (autoplay) state.ytPlayer.loadVideoById(item.videoId);
        else state.ytPlayer.cueVideoById(item.videoId);
        if (state.ytPlayer.setVolume) { if (autoplay) fadeExtIn((v) => state.ytPlayer.setVolume(v)); else state.ytPlayer.setVolume(state.vol); }
      } catch (e) { setStatus('That video cannot play here. Try another station.'); }
    };
    if (state.ytPlayer && state.ytPlayer.loadVideoById) { playItem(); setStatus(''); return; }
    const playerVars = { autoplay: autoplay ? 1 : 0, rel: 0, modestbranding: 1, playsinline: 1, origin: location.origin };
    if (item.list) { playerVars.listType = 'playlist'; playerVars.list = item.list; }
    state.ytPlayer = new YT.Player('ytMount', {
      host: 'https://www.youtube.com',
      width: '100%',
      height: '280',
      videoId: item.list ? undefined : (item.videoId || undefined),
      playerVars: playerVars,
      events: {
        onReady: () => { try { if (autoplay) fadeExtIn((v) => state.ytPlayer.setVolume(v)); else state.ytPlayer.setVolume(state.vol); } catch (e) {} setStatus(''); },
        onStateChange: (e) => {
          const playing = e.data === 1;
          if (playing !== state.extPlaying) { state.extPlaying = playing; paint(); }
        },
        onError: () => setStatus('That video cannot play here. Try another station.')
      }
    });
  }).catch(() => setStatus('YouTube Music did not load. Try again in a moment.'));
}
function googleClientId() {
  try {
    const el = document.getElementById('focus-dial-config');
    return (JSON.parse(el.textContent).googleClientId || '').trim();
  } catch (e) { return ''; }
}
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => no(new Error('Google did not load'));
    document.head.appendChild(s);
  });
}
const YT_TOKEN_KEY = 'adhd-study-pack.yt-token';
function ytKey() {
  const user = window.FocusDial && window.FocusDial.user;
  return secretName(YT_TOKEN_KEY, user && user.id);
}
function readYtToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(ytKey()) || 'null');
    if (t && t.token && t.exp > Date.now() + 60000) return t.token;
  } catch (e) {}
  return '';
}
function writeYtToken(token, expiresIn) {
  try {
    sessionStorage.setItem(ytKey(), JSON.stringify({
      token: token,
      exp: Date.now() + (Number(expiresIn) || 3600) * 1000
    }));
  } catch (e) {}
}
function dropYtToken() {
  try { sessionStorage.removeItem(ytKey()); } catch (e) {}
}
function ytReason(data) {
  const err = (data && data.error) || {};
  const first = (err.errors && err.errors[0]) || {};
  return String(first.reason || err.status || '');
}
function loadMine(token) {
  setStatus('Loading your library…');
  const headers = { Authorization: 'Bearer ' + token };
  const get = (path) => fetch('https://www.googleapis.com/youtube/v3/' + path, { headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  });
  return Promise.all([
    get('playlists?part=snippet&mine=true&maxResults=15'),
    get('playlistItems?part=snippet&maxResults=1&playlistId=LM')
  ]).then(([listed, likes]) => {
    if (listed.status === 401 || likes.status === 401) {
      dropYtToken();
      setStatus('Sign-in expired. Press Your library again.');
      return;
    }
    const items = [];
    if (likes.ok) items.push({ title: 'Your likes', list: 'LM', videoId: '' });
    if (listed.ok) {
      (listed.data.items || []).forEach((it) => {
        const title = (it.snippet && it.snippet.title) || 'Playlist';
        if (it.id) items.push({ title: title, list: it.id, videoId: '' });
      });
    }
    if (items.length) {
      state.mine = items;
      setStatus(items.length === 1 && items[0].list === 'LM' ? 'Your likes are in the row.' : 'Your library is in the row.');
      renderPicks();
      return;
    }
    const reason = ytReason(listed.data) || ytReason(likes.data);
    const message = String((listed.data.error && listed.data.error.message) || (likes.data.error && likes.data.error.message) || '');
    if (reason === 'insufficientPermissions' || (reason === 'forbidden' && /insufficient/i.test(message))) {
      dropYtToken();
      setStatus('Google did not grant YouTube Music. Press Your library again.');
      return;
    }
    if (reason === 'youtubeSignupRequired') {
      setStatus('This Google account has no YouTube channel yet. The stations still play.');
      return;
    }
    if (reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED' || reason === 'API_KEY_SERVICE_BLOCKED' || /has not been used|it is disabled|are blocked/i.test(message)) {
      setStatus('Google has not turned on YouTube for this site yet. The stations still play.', {
        href: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=adhdrelief-bdbea',
        label: 'Turn it on'
      });
      return;
    }
    setStatus('Signed in, but YouTube Music did not share your library. The stations still play.');
  });
}
function connectYouTube() {
  const id = googleClientId();
  if (!id) { setStatus('Google sign-in is not set up on this copy.'); return; }
  const cached = readYtToken();
  if (cached) { loadMine(cached).catch(() => setStatus('YouTube Music did not answer. The stations still play.')); return; }
  if (!(window.google && google.accounts && google.accounts.oauth2)) {
    setStatus('Google is still loading. Press Your library again.');
    loadGis().catch(() => setStatus('Google did not load. Try again in a moment.'));
    return;
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: id,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    include_granted_scopes: false,
    callback: (r) => {
      if (!(r && r.access_token)) {
        setStatus((r && (r.error_description || r.error)) || 'YouTube sign-in stopped.');
        return;
      }
      writeYtToken(r.access_token, r.expires_in);
      loadMine(r.access_token).catch(() => setStatus('YouTube Music did not answer. The stations still play.'));
    },
    error_callback: (e) => setStatus((e && e.message) || 'The Google window closed')
  });
  client.requestAccessToken();
}
function icon(name) {
  if (name === 'prev') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6v12M18 6 9 12l9 6z"/></svg>';
  if (name === 'next') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6v12M6 6l9 6-9 6z"/></svg>';
  return '';
}
function mountPlayer() {
  const host = document.getElementById('glassMount');
  if (!host || document.getElementById('lantern')) return;
  host.innerHTML = '<div class="lantern" id="lantern" data-source="desk">'
    + '<div class="src-switch" id="srcSwitch" role="tablist" aria-label="Music source">'
    + '<button type="button" role="tab" data-src="desk" aria-pressed="true">Desk</button>'
    + '<button type="button" role="tab" data-src="spotify" aria-pressed="false">Spotify</button>'
    + '<button type="button" role="tab" data-src="youtube" aria-pressed="false">YouTube Music</button>'
    + '</div>'
    + '<div class="lantern-copy"><p class="lantern-kicker" id="gpKicker">Piece 01 · written here</p>'
    + '<h2 id="gpTitle">Paper lamp</h2><p class="lantern-feel" id="gpFeel">Slow piano</p></div>'
    + '<div class="ext-only" id="extSlot">'
    + '<div class="ext-accounts">'
    + '<button type="button" class="btn sm sp-only" id="spConnect">Log in to Spotify</button>'
    + '<button type="button" class="btn sm yt-only" id="ytConnect">Your library</button>'
    + '</div>'
    + '<div class="sp-wrap" id="spWrap"><div id="spMount"></div></div>'
    + '<div class="yt-wrap" id="ytWrap"><div id="ytMount"></div></div>'
    + '<p class="ext-status" id="extStatus"></p>'
    + '<div class="focus-picks" id="focusPicks"></div>'
    + '<form class="music-load" id="musicLoad">'
    + '<label class="sr-only" for="musicUrl">Spotify or YouTube Music link</label>'
    + '<input id="musicUrl" type="url" inputmode="url" placeholder="Paste a Spotify or YouTube Music link" autocomplete="off">'
    + '<button class="btn sm" type="submit">Load</button>'
    + '</form>'
    + '</div>'
    + '<div class="lantern-stage desk-only">'
    + '<svg class="lantern-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="lantern-track" cx="60" cy="60" r="54"></circle><circle id="gpRing" cx="60" cy="60" r="54"></circle></svg>'
    + '<button type="button" class="lantern-disc" id="gpDisc" aria-label="Play"><canvas id="gpViz" width="220" height="220"></canvas></button>'
    + '</div>'
    + '<div class="lantern-transport">'
    + '<button type="button" class="glass-btn" id="gpPrev" aria-label="Previous">' + icon('prev') + '</button>'
    + '<button type="button" class="glass-btn glass-play" id="gpPlay" aria-pressed="false">Play</button>'
    + '<button type="button" class="glass-btn" id="gpNext" aria-label="Next">' + icon('next') + '</button>'
    + '</div>'
    + '<label class="lantern-seek desk-only"><span class="sr-only">Position in this piece</span><input type="range" id="gpSeek" min="0" max="1000" value="0"></label>'
    + '<div class="lantern-time desk-only"><span id="gpNow">0:00</span><span id="gpDur">0:00</span></div>'
    + '<label class="lantern-vol"><span>Volume</span><input type="range" id="gpVol" min="0" max="100" value="74" aria-valuemin="0" aria-valuemax="100"></label>'
    + '<div class="eq" id="eqPanel"><div class="eq-head"><span>Equalizer</span><div id="eqPresets"></div></div><div class="eq-bands" id="eqBands"></div><p class="eq-note" id="eqNote"></p></div>'
    + '<div class="lantern-shelf desk-only" id="gpShelf" role="listbox" aria-label="Pieces"></div>'
    + '<p class="sr-only" id="gpLive" aria-live="polite"></p>'
    + '</div>';
  const shelf = document.getElementById('gpShelf');
  SONGS.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lantern-tile';
    b.dataset.song = String(i);
    b.setAttribute('role', 'option');
    b.innerHTML = '<span class="tile-shot"></span><span class="tile-name"></span><span class="tile-feel"></span>';
    b.querySelector('.tile-shot').style.backgroundImage = 'url("' + new URL(sceneSrc(s.scene), document.baseURI).href + '")';
    b.querySelector('.tile-name').textContent = s.title;
    b.querySelector('.tile-feel').textContent = s.feel;
    b.setAttribute('aria-label', s.title + ', ' + s.feel);
    shelf.appendChild(b);
  });
  document.getElementById('gpPlay').onclick = toggle;
  document.getElementById('gpDisc').onclick = toggle;
  document.getElementById('gpPrev').onclick = () => step(-1);
  document.getElementById('gpNext').onclick = () => step(1);
  shelf.addEventListener('click', (e) => {
    const b = e.target.closest('[data-song]');
    if (b) choose(Number(b.dataset.song));
  });
  const seek = document.getElementById('gpSeek');
  seek.addEventListener('pointerdown', () => { state.seeking = true; });
  const endSeek = () => { if (!state.seeking) return; state.seeking = false; applySeek(); };
  seek.addEventListener('pointerup', endSeek);
  seek.addEventListener('change', endSeek);
  seek.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') applySeek(); });
  document.getElementById('gpVol').oninput = (e) => setVol(Number(e.target.value));
  document.getElementById('srcSwitch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-src]');
    if (b) setSource(b.dataset.src);
  });
  document.getElementById('musicLoad').addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parseMusicLink(document.getElementById('musicUrl').value);
    if (!parsed) { setStatus('That link is not a Spotify or YouTube Music address.'); return; }
    if (parsed.source === 'spotify') {
      remember({ source: 'spotify', title: parsed.title, uri: parsed.uri, videoId: '', list: '' });
      useSpotify(parsed.uri, parsed.title, true);
    } else {
      remember({ source: 'youtube', title: parsed.title, uri: '', videoId: parsed.videoId || '', list: parsed.list || '' });
      useYouTube(parsed, true);
    }
    document.getElementById('musicUrl').value = '';
  });
  document.getElementById('ytConnect').onclick = () => { connectYouTube(); };
  document.getElementById('spConnect').onclick = () => { connectSpotify(); };
  document.getElementById('focusPicks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick], [data-recent]');
    if (!b) return;
    if (b.dataset.recent != null) {
      const item = state.recent[Number(b.dataset.recent)];
      if (!item) return;
      if (item.source === 'spotify') useSpotify(item.uri, item.title, true);
      else useYouTube(item, true);
      return;
    }
    const i = Number(b.dataset.pick);
    if (state.source === 'spotify') useSpotify(FOCUS_SPOTIFY[i].uri, FOCUS_SPOTIFY[i].title, true);
    else if (b.dataset.mine) useYouTube(state.mine[i], true);
    else useYouTube(FOCUS_YOUTUBE[i], true);
  });
  const bands = document.getElementById('eqBands');
  bands.innerHTML = EQ_BANDS.map((b, i) =>
    '<label class="eq-line"><span>' + b.label + '</span><input type="range" min="-8" max="6" step="0.5" value="' + state.eq[i] + '" data-eq="' + i + '" aria-label="' + b.label + ' hertz"></label>'
  ).join('');
  bands.addEventListener('input', (e) => {
    const input = e.target.closest('[data-eq]');
    if (!input) return;
    if (!state.ctx) { try { ensure(); } catch (err) {} }
    applyEqGain(Number(input.dataset.eq), Number(input.value));
  });
  const presets = document.getElementById('eqPresets');
  presets.innerHTML = Object.keys(EQ_PRESETS).map((name) =>
    '<button type="button" class="eq-chip" data-eqpre="' + name + '">' + name + '</button>'
  ).join('');
  presets.addEventListener('click', (e) => {
    const b = e.target.closest('[data-eqpre]');
    if (!b) return;
    if (!state.ctx) { try { ensure(); } catch (err) {} }
    state.eq = EQ_PRESETS[b.dataset.eqpre].slice();
    state.eq.forEach((g, i) => applyEqGain(i, g));
    document.querySelectorAll('#eqBands [data-eq]').forEach((input) => { input.value = String(state.eq[Number(input.dataset.eq)]); });
    savePref();
  });
  renderPicks();
  const lantern = document.getElementById('lantern');
  lantern.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
  });
}
function mountDock() {
  const dock = document.getElementById('glassDock');
  if (!dock || document.getElementById('dockPlay')) return;
  dock.hidden = false;
  dock.innerHTML = '<button type="button" class="glass-btn glass-play" id="dockPlay">Play</button>'
    + '<div class="dock-copy"><strong id="dockTitle"></strong><span class="dock-feel" id="dockFeel"></span></div>'
    + '<div class="dock-nav">'
    + '<button type="button" class="glass-btn" id="dockPrev" aria-label="Previous piece">' + icon('prev') + '</button>'
    + '<button type="button" class="glass-btn" id="dockNext" aria-label="Next piece">' + icon('next') + '</button>'
    + '</div>'
    + '<button type="button" class="btn sm dock-open" data-goto="sound">Open player</button>';
  document.getElementById('dockPlay').onclick = toggle;
  document.getElementById('dockPrev').onclick = () => step(-1);
  document.getElementById('dockNext').onclick = () => step(1);
}
function bindSilence() {
  const btn = document.getElementById('soundStop');
  if (!btn || btn.dataset.glass) return;
  btn.dataset.glass = '1';
  btn.addEventListener('click', () => pause());
}
export function mount() {
  if (typeof document === 'undefined') return;
  loadPref();
  mountPlayer();
  mountDock();
  bindSilence();
  setScene(current().scene);
  paint();
  if (state.source === 'spotify' && !state.spotifyCtl) openSpotify(state.spotifyUri, false);
  if (state.source === 'youtube' && !state.ytPlayer) openYouTube(state.yt, false);
}
