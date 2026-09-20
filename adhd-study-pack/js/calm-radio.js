/**
 * Calm radio — default shelf of public-domain / Creative Commons stations.
 */
const commons = (file) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file);
const STATIONS = [
  { id: 'harbor', title: 'Harbor rain', artist: 'Synthesised in this browser', license: 'No recording — generated live', kind: 'preset', preset: { rain: 62, cafe: 28 }, art: 'https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=400&q=60' },
  { id: 'brown', title: 'Deep brown', artist: 'Synthesised in this browser', license: 'No recording — generated live', kind: 'preset', preset: { brown: 72 }, art: 'https://images.unsplash.com/photo-1482192594855-10d6e375abe0?auto=format&fit=crop&w=400&q=60' },
  { id: 'ocean', title: 'Ocean night', artist: 'Synthesised in this browser', license: 'No recording — generated live', kind: 'preset', preset: { ocean: 66, pink: 18 }, art: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=60' },
  { id: 'hearth', title: 'Hearth', artist: 'Synthesised in this browser', license: 'No recording — generated live', kind: 'preset', preset: { fire: 60, forest: 24 }, art: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=60' },
  { id: 'study-relax', title: 'Study and Relax', artist: 'Kevin MacLeod', license: 'CC BY 4.0 · incompetech / filmmusic.io', kind: 'file', src: commons('Study_And_Relax_by_Kevin_MacLeod.ogg'), page: 'https://commons.wikimedia.org/wiki/File:Study_And_Relax_by_Kevin_MacLeod.ogg', art: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=400&q=60' },
  { id: 'long-dark', title: 'The Long Dark', artist: 'Scott Buckley', license: 'CC BY 3.0 · scottbuckley.com.au', kind: 'file', src: commons('Scott_Buckley_–_The_Long_Dark_(Ambient_Neoclassical_Piano).ogg'), page: 'https://commons.wikimedia.org/wiki/File:Scott_Buckley_%E2%80%93_The_Long_Dark_(Ambient_Neoclassical_Piano).ogg', art: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=400&q=60' },
  { id: 'forest', title: 'Forest', artist: 'SoundAudio', license: 'CC BY 3.0', kind: 'file', src: commons('SoundAudio_-_Forest_(relaxing_music).opus'), page: 'https://commons.wikimedia.org/wiki/File:SoundAudio_-_Forest_(relaxing_music).opus', art: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=400&q=60' },
  { id: 'rain-glass', title: 'Rain on the glass', artist: 'ezwa', license: 'Public domain · pdsounds.org', kind: 'file', src: commons('Rain_(1).ogg'), page: 'https://commons.wikimedia.org/wiki/File:Rain_(1).ogg', art: 'https://images.unsplash.com/photo-1468581264429-2548ef9ebcd9?auto=format&fit=crop&w=400&q=60' },
  { id: 'cello', title: 'Cello Suite No. 1 — Prelude', artist: 'J. S. Bach · John Michel', license: 'CC BY-SA 3.0 · composition is public domain', kind: 'file', src: commons('JOHN MICHEL CELLO-J S BACH CELLO SUITE 1 in G Prelude.ogg'), page: 'https://commons.wikimedia.org/wiki/File:JOHN_MICHEL_CELLO-J_S_BACH_CELLO_SUITE_1_in_G_Prelude.ogg', art: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=60' },
  { id: 'brenticus', title: 'Ambient', artist: 'Brenticus', license: 'CC (see Commons file page)', kind: 'file', src: commons('Brenticus_-_Ambient.ogg'), page: 'https://commons.wikimedia.org/wiki/File:Brenticus_-_Ambient.ogg', art: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=400&q=60' }
];
const KEY = 'adhd-study-pack.calm.station';
const state = { id: STATIONS[0].id, playing: false, audio: null };
function app() { return window.FocusDial || null; }
function silencePreset() {
  const fd = app();
  if (fd && fd.applyPreset) fd.applyPreset({ rain: 0, cafe: 0, brown: 0, ocean: 0, pink: 0, fire: 0, forest: 0, tick: 0, bin: 0 });
}
function playPreset(layers) {
  const fd = app();
  if (fd && fd.applyPreset) fd.applyPreset(layers);
}
function current() { return STATIONS.find((s) => s.id === state.id) || STATIONS[0]; }
function status(text) {
  const el = document.getElementById('radioStatus');
  if (el) el.textContent = text;
}
function paint() {
  const now = current();
  const art = document.getElementById('radioArt');
  const title = document.getElementById('radioTitle');
  const meta = document.getElementById('radioMeta');
  const play = document.getElementById('radioPlay');
  if (art) art.style.backgroundImage = 'url(' + now.art + ')';
  if (title) title.textContent = now.title;
  if (meta) meta.textContent = now.artist + ' · ' + now.license;
  if (play) play.textContent = state.playing ? 'Pause' : 'Play';
  document.querySelectorAll('#radioList .station').forEach((b) => b.classList.toggle('on', b.dataset.station === state.id));
}
function stopFile() {
  if (state.audio) {
    try { state.audio.pause(); } catch (e) {}
    state.audio.removeAttribute('src');
    state.audio.load();
  }
}
function playStation(id, autoplay) {
  const next = STATIONS.find((s) => s.id === id) || STATIONS[0];
  state.id = next.id;
  try { localStorage.setItem(KEY, next.id); } catch (e) {}
  stopFile();
  silencePreset();
  if (next.kind === 'preset') {
    if (autoplay) { playPreset(next.preset); state.playing = true; status('Playing a live bed · nothing streamed'); }
    else { state.playing = false; status('Ready · generated in this browser'); }
    paint();
    return;
  }
  if (!state.audio) return;
  state.audio.loop = true;
  state.audio.src = next.src;
  if (autoplay) {
    state.audio.play().then(() => { state.playing = true; status('Streaming a free-license record'); paint(); }).catch(() => { state.playing = false; status('Could not reach that file. Try Harbor rain.'); paint(); });
  } else { state.playing = false; status('Ready · ' + next.license); paint(); }
}
function toggle() {
  const now = current();
  if (now.kind === 'preset') {
    if (state.playing) { silencePreset(); state.playing = false; status('Paused'); }
    else playStation(now.id, true);
    paint();
    return;
  }
  if (!state.audio) return;
  if (state.playing) { state.audio.pause(); state.playing = false; status('Paused'); paint(); }
  else playStation(now.id, true);
}
function mount() {
  const view = document.getElementById('view-calm');
  if (!view || document.getElementById('calmRadio')) return;
  const wrap = document.createElement('div');
  wrap.className = 'radio';
  wrap.id = 'calmRadio';
  wrap.innerHTML = '<div class="radio-head"><div><h3>Cove radio</h3><p>A default shelf of quiet rooms. Four beds are synthesised here. Six records are public domain or Creative Commons — credit stays on the station.</p></div><span class="eyebrow" id="radioStatus">Ready</span></div><div class="radio-now"><div class="radio-art" id="radioArt" role="img" aria-label="Station artwork"></div><div><h4 id="radioTitle"></h4><div class="radio-meta" id="radioMeta"></div><audio id="radioAudio" preload="none"></audio></div><div class="radio-controls"><button type="button" class="btn primary" id="radioPlay">Play</button><button type="button" class="btn ghost" id="radioStop">Stop</button></div></div><div class="radio-list" id="radioList"></div>';
  const grid = view.querySelector('.grid') || view;
  grid.parentNode.insertBefore(wrap, grid.nextSibling);
  const list = document.getElementById('radioList');
  STATIONS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'station';
    b.dataset.station = s.id;
    b.innerHTML = '<span class="thumb"></span><span><b></b><small></small></span>';
    b.querySelector('.thumb').style.backgroundImage = 'url(' + s.art + ')';
    b.querySelector('b').textContent = s.title;
    b.querySelector('small').textContent = s.artist + ' · ' + (s.kind === 'preset' ? 'live bed' : s.license.split('·')[0].trim());
    list.appendChild(b);
  });
  state.audio = document.getElementById('radioAudio');
  state.audio.addEventListener('ended', () => { state.playing = false; paint(); });
  state.audio.addEventListener('error', () => { state.playing = false; status('That record did not load. Harbor rain still works offline.'); paint(); });
  document.getElementById('radioPlay').onclick = toggle;
  document.getElementById('radioStop').onclick = () => { stopFile(); silencePreset(); state.playing = false; status('Stopped'); paint(); };
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-station]');
    if (btn) playStation(btn.dataset.station, true);
  });
  let saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch (e) {}
  playStation(saved || STATIONS[0].id, false);
}
function boot() {
  const start = () => mount();
  if (document.getElementById('view-calm')) start();
  else document.addEventListener('DOMContentLoaded', start);
  const btn = document.querySelector('.rail-btn[data-view="calm"]');
  if (btn) btn.addEventListener('click', () => setTimeout(start, 40));
}
if (typeof document !== 'undefined') boot();
export { STATIONS };
