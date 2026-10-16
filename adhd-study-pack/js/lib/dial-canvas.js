/* Focus dial — the one moving object on the desk.
   Pure helpers so the page can draw a canvas arc without a DOM, and so
   reduced motion paints one still frame instead of a loop. */

const STEPS = ['start', 'stay', 'close'];

export function sessionCue({ phase, running, remain, total } = {}) {
  const left = Math.max(0, Number(remain) || 0);
  const span = Math.max(1, Number(total) || 1);
  if (phase === 'short') return { step: 'close', line: 'Short break. Stand up. Do not open a new tab.' };
  if (phase === 'long') return { step: 'close', line: 'Long break. Leave the desk.' };
  if (!running && left >= span - 800) return { step: 'start', line: 'Name the one thing, then start.' };
  if (!running) return { step: 'stay', line: 'Paused. The minutes left are saved.' };
  if (left <= 60000) return { step: 'close', line: 'Almost done. Finish this sentence, then stop.' };
  return { step: 'stay', line: 'Stay with this until the dial ends.' };
}

export function stepIndex(step) {
  const i = STEPS.indexOf(step);
  return i < 0 ? 0 : i;
}

/* Draw in CSS pixels. The caller sets the canvas bitmap and passes dpr. */
export function paintDialFrame(ctx, cssW, cssH, state) {
  const dpr = state.dpr || 1;
  const frac = Math.min(1, Math.max(0, Number(state.frac)));
  const color = state.color || '#CC4520';
  const spent = 1 - frac;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const cx = cssW / 2;
  const cy = cssH / 2;
  const r = Math.min(cssW, cssH) * 0.412;
  const wash = ctx.createRadialGradient(cx, cy * 0.96, r * 0.2, cx, cy, r * 1.02);
  const live = !!state.running && !state.reduced;
  wash.addColorStop(0, color);
  wash.addColorStop(1, color);
  ctx.globalAlpha = live ? 0.10 : 0.05;
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (spent < 0.004) return;
  const start = -Math.PI / 2;
  const end = start + spent * Math.PI * 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = live ? 0.55 : 0.32;
  ctx.lineWidth = Math.max(14, Math.min(cssW, cssH) * 0.055);
  ctx.shadowColor = color;
  ctx.shadowBlur = state.reduced ? 0 : 18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
  ctx.restore();
  if (!live) return;
  const pulse = 0.65 + 0.35 * Math.sin((Number(state.now) || 0) / 700);
  const hx = cx + Math.cos(end) * r;
  const hy = cy + Math.sin(end) * r;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.arc(hx, hy, 3.2 + pulse * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function mountDialCanvas(canvas, read) {
  if (!canvas || typeof canvas.getContext !== 'function') return { sync() {}, stop() {} };
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
  if (!ctx) return { sync() {}, stop() {} };
  let raf = 0;
  let shown = null;
  function draw(now, frac) {
    const rect = typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : { width: 320, height: 320 };
    const cssW = Math.max(1, rect.width || canvas.clientWidth || 320);
    const cssH = Math.max(1, rect.height || canvas.clientHeight || 320);
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const s = read() || {};
    paintDialFrame(ctx, cssW, cssH, {
      frac, running: !!s.running, reduced: !!s.reduced, now, color: s.color, dpr
    });
  }
  function frame(now) {
    try {
      const s = read() || {};
      const target = Math.min(1, Math.max(0, Number(s.frac)));
      if (shown == null || s.reduced) shown = target;
      else shown += (target - shown) * 0.22;
      if (Math.abs(target - shown) < 0.002) shown = target;
      draw(now, shown);
      if (s.running && !s.reduced) raf = requestAnimationFrame(frame);
      else raf = 0;
    } catch (e) {
      raf = 0;
    }
  }
  function sync() {
    try {
      const s = read() || {};
      const live = !!(s.running && !s.reduced);
      if (live) {
        if (!raf) raf = requestAnimationFrame(frame);
        return;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      shown = Math.min(1, Math.max(0, Number(s.frac)));
      draw(typeof performance !== 'undefined' ? performance.now() : 0, shown);
    } catch (e) { /* the SVG ring still shows the time */ }
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  return { sync, stop };
}
