/* Bilateral Beats — research-inspired sounds generated live with Web Audio.
   Shared by the classic app and the React shell: mount(el) renders the cards. */
const CSS = `
.bil{margin-top:22px}
.bil-head h3{margin:0 0 4px}.bil-head p{margin:0 0 14px;opacity:.75;font-size:.92rem;line-height:1.45}
.bil-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.bil-card{all:unset;cursor:pointer;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;
 background:color-mix(in srgb,var(--paper,#f6f1e7) 70%,transparent);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);
 border:1px solid color-mix(in srgb,var(--ink,#222) 10%,transparent);box-shadow:0 6px 22px -12px rgba(0,0,0,.35);transition:transform .25s,box-shadow .25s}
.bil-card:hover,.bil-card:focus-visible{transform:translateY(-2px);box-shadow:0 10px 30px -10px var(--accent,#e2643a)}
.bil-card.on{box-shadow:0 0 0 2px var(--accent,#e2643a),0 10px 34px -8px var(--accent,#e2643a)}
.bil-art{aspect-ratio:3/2;position:relative;display:grid;place-items:center;overflow:hidden}
.bil-art::before{content:"";position:absolute;inset:-20%;background:var(--g);filter:blur(14px)}
.bil-orb{position:relative;width:38%;aspect-ratio:1;border-radius:50%;background:var(--o);box-shadow:0 0 0 8px rgba(255,255,255,.18)}
.bil-orb::after{content:"";position:absolute;inset:32%;border-radius:50%;background:#fff}
.bil-card.on .bil-orb{animation:bilSway var(--p,2s) ease-in-out infinite alternate}
@keyframes bilSway{from{transform:translateX(-55%)}to{transform:translateX(55%)}}
.bil-body{padding:10px 14px 14px}.bil-body b{display:block;font-size:1rem}.bil-body small{opacity:.7;display:block;margin-top:3px;line-height:1.35}
.bil-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}
.bil-bar label{font-size:.88rem}.bil-left{font-variant-numeric:tabular-nums;opacity:.8;font-size:.88rem}
.bil-note{font-size:.8rem;opacity:.65;margin-top:10px;line-height:1.45}
@media (prefers-reduced-motion:reduce){.bil-card.on .bil-orb{animation:none}.bil-card{transition:none}}
`;

export const TRACKS = [
  { id:'warmth', name:'Ease and Warmth', hint:'A warm drone gliding left to right every 2 s — slow bilateral stimulation.',
    g:'radial-gradient(circle at 20% 50%,#ffb703,transparent 55%),radial-gradient(circle at 80% 50%,#ff8fab,transparent 55%),#fb6f92', o:'conic-gradient(#ff7b00,#ff8fab,#ff7b00,#ff8fab,#ff7b00)', p:'2s' },
  { id:'settled', name:'Settled Mind', hint:'Soft bell tones alternating ears once a second, like EMDR tapping.',
    g:'radial-gradient(circle at 15% 50%,#00b4ff,transparent 50%),radial-gradient(circle at 85% 50%,#00b4ff,transparent 50%),#050a3a', o:'conic-gradient(#7b5cff,#1677ff,#00a6ff,#7b5cff)', p:'1s' },
  { id:'grounded', name:'Cool and Grounded', hint:'Brown noise drifting slowly between ears. Low noise can steady ADHD attention.',
    g:'radial-gradient(circle at 20% 50%,#1fa38a,transparent 55%),radial-gradient(circle at 80% 50%,#6c5ce7,transparent 55%),#0b3d2e', o:'repeating-linear-gradient(#17a2ff 0 14%,#0e8a3a 14% 28%)', p:'5s' },
  { id:'focus', name:'Gentle Focus', hint:'14 Hz beta binaural beat under soft pink noise. Use headphones.',
    g:'radial-gradient(circle at 15% 30%,#ffb703,transparent 45%),radial-gradient(circle at 85% 70%,#ffb703,transparent 45%),#ff6fb5', o:'repeating-radial-gradient(#ff5d00 0 10%,#ff9de2 10% 20%)', p:'3s' },
  { id:'hope', name:'Hope and Light', hint:'A bright major chord trading sides with a gentle 10 Hz alpha pulse.',
    g:'radial-gradient(circle at 50% 0%,#ffd166,transparent 60%),radial-gradient(circle at 10% 80%,#a0e7ff,transparent 50%),#ffafcc', o:'conic-gradient(#ffd000,#ff8800,#ffd000,#ff8800,#ffd000)', p:'2.5s' },
  { id:'release', name:'Pressure Release', hint:'Ocean-like swells at 6 breaths a minute over a 6 Hz theta beat.',
    g:'radial-gradient(circle at 20% 70%,#2ecc71,transparent 50%),radial-gradient(circle at 80% 20%,#74c0fc,transparent 55%),#0c1a2b', o:'radial-gradient(#ffe066 30%,#ff9f1c 31% 55%,#1c7ed6 56%)', p:'5s' },
];

let ctx = null, live = null, timer = 0;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function noise(c, kind) {
  const len = c.sampleRate * 4, buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let last = 0, b0=0,b1=0,b2=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = .997*b0 + w*.029; b1 = .985*b1 + w*.032; b2 = .95*b2 + w*.048; d[i] = (b0+b1+b2+w*.018)*.9; }
    }
  }
  const s = c.createBufferSource(); s.buffer = buf; s.loop = true; return s;
}
function osc(c, f, type='sine') { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function lfo(c, rate, depth, target) {
  const o = osc(c, rate), g = c.createGain(); g.gain.value = depth; o.connect(g).connect(target); o.start(); return o;
}
function panner(c, out) { const p = c.createStereoPanner(); p.connect(out); return p; }
function binaural(c, out, carrier, beat, vol) {
  const m = c.createChannelMerger(2), g = c.createGain(); g.gain.value = vol;
  const l = osc(c, carrier), r = osc(c, carrier + beat);
  l.connect(m, 0, 0); r.connect(m, 0, 1); m.connect(g).connect(out); l.start(); r.start(); return [l, r];
}

function build(id, out) {
  const c = ac(), nodes = [];
  const add = n => (nodes.push(n), n);
  if (id === 'warmth') {
    const p = panner(c, out); add(lfo(c, 0.25, 0.9, p.pan));
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(p);
    [110, 164.8, 220, 277.2].forEach((hz, i) => { const o = add(osc(c, hz, i % 2 ? 'triangle' : 'sine')); const g = c.createGain(); g.gain.value = .12; o.connect(g).connect(f); o.start(); });
  } else if (id === 'settled' || id === 'hope') {
    const notes = id === 'settled' ? [392, 523.25, 440, 587.3] : [523.25, 659.3, 784, 659.3];
    const pad = c.createGain(); pad.gain.value = id === 'hope' ? .05 : .025; pad.connect(out);
    (id === 'hope' ? [261.6, 329.6, 392] : [196, 293.7]).forEach(hz => { const o = add(osc(c, hz)); o.connect(pad); o.start(); });
    if (id === 'hope') add(lfo(c, 10, .02, pad.gain));
    let n = 0; const step = id === 'settled' ? 1 : 1.25;
    const tick = () => {
      const t = c.currentTime, p = c.createStereoPanner(); p.pan.value = n % 2 ? .85 : -.85; p.connect(out);
      const o = osc(c, notes[n % notes.length]), o2 = osc(c, notes[n % notes.length] * 2.76), g = c.createGain();
      const g2 = c.createGain(); g2.gain.value = .25; o2.connect(g2).connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
      o.connect(g).connect(p); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7); n++;
    };
    tick(); const iv = setInterval(tick, step * 1000); nodes.push({ stop: () => clearInterval(iv) });
  } else if (id === 'grounded') {
    const p = panner(c, out); add(lfo(c, 0.1, 0.8, p.pan));
    const s = add(noise(c, 'brown')), g = c.createGain(); g.gain.value = .55; s.connect(g).connect(p); s.start();
  } else if (id === 'focus') {
    nodes.push(...binaural(c, out, 200, 14, .18));
    const s = add(noise(c, 'pink')), g = c.createGain(); g.gain.value = .12; const p = panner(c, out);
    add(lfo(c, 0.33, .5, p.pan)); s.connect(g).connect(p); s.start();
  } else if (id === 'release') {
    nodes.push(...binaural(c, out, 150, 6, .14));
    const s = add(noise(c, 'pink')), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = c.createGain(); g.gain.value = .25; add(lfo(c, 0.1, .22, g.gain));
    add(lfo(c, 0.1, 500, f.frequency));
    const p = panner(c, out); add(lfo(c, 0.05, .7, p.pan)); s.connect(f).connect(g).connect(p); s.start();
  }
  return nodes;
}

function stop(fade = .6) {
  if (!live) return; const { out, nodes } = live, c = ac(), t = c.currentTime;
  out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + fade);
  setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch {} }); out.disconnect(); }, fade * 1000 + 50);
  live = null; clearInterval(timer);
}
function start(id, vol, minutes, onEnd, onTick) {
  stop(.3); const c = ac(); c.resume();
  const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  out.gain.linearRampToValueAtTime(vol, c.currentTime + (reduce ? .15 : 1.5));
  live = { id, out, nodes: build(id, out) };
  const end = Date.now() + minutes * 60000;
  timer = setInterval(() => { const left = end - Date.now(); onTick(left); if (left <= 0) { stop(3); onEnd(); } }, 1000); onTick(end - Date.now());
}
const setVol = v => { if (live) live.out.gain.setTargetAtTime(v, ac().currentTime, .2); };

export function mount(el) {
  if (!el || el.dataset.bil) return () => {};
  el.dataset.bil = '1';
  if (!document.getElementById('bilCss')) { const s = document.createElement('style'); s.id = 'bilCss'; s.textContent = CSS; document.head.append(s); }
  el.innerHTML = `<section class="bil panel" aria-labelledby="bilTitle">
    <div class="bil-head"><h3 id="bilTitle">Bilateral beats</h3>
    <p>Science-inspired sounds that move between your left and right ear, plus binaural and noise tracks used in focus and calm research. Headphones work best.</p></div>
    <div class="bil-grid">${TRACKS.map(t => `<button type="button" class="bil-card" data-bil="${t.id}" aria-pressed="false" style="--g:${t.g};--o:${t.o};--p:${t.p}">
      <span class="bil-art"><span class="bil-orb"></span></span>
      <span class="bil-body"><b>${t.name}</b><small>${t.hint}</small></span></button>`).join('')}</div>
    <div class="bil-bar">
      <label>Length <select class="bil-min">${[3,5,10,15,20,30,45,60].map(m => `<option value="${m}"${m===10?' selected':''}>${m} min</option>`).join('')}</select></label>
      <label>Volume <input type="range" class="bil-vol" min="0" max="100" value="40"></label>
      <span class="bil-left" aria-live="polite"></span></div>
    <p class="bil-note">Generated live in your browser, no recordings. Based on studies of bilateral alternating stimulation (as in EMDR), binaural beats and brown/pink noise for attention. Effects vary from person to person; this isn't a medical treatment. Keep the volume low.</p></section>`;
  const cards = [...el.querySelectorAll('.bil-card')], left = el.querySelector('.bil-left');
  const vol = () => el.querySelector('.bil-vol').value / 100 * .8;
  const paint = () => cards.forEach(b => { const on = live?.id === b.dataset.bil; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const tick = ms => { const s = Math.max(0, Math.round(ms / 1000)); left.textContent = live ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} left` : ''; };
  cards.forEach(b => b.onclick = () => {
    if (live?.id === b.dataset.bil) { stop(); left.textContent = ''; }
    else start(b.dataset.bil, vol(), +el.querySelector('.bil-min').value, () => { paint(); left.textContent = 'Done'; }, tick);
    paint();
  });
  el.querySelector('.bil-vol').oninput = () => setVol(vol());
  return () => { stop(.2); delete el.dataset.bil; el.innerHTML = ''; };
}

if (typeof document !== 'undefined') {
  const go = () => document.querySelectorAll('#bilateralMount').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
}
