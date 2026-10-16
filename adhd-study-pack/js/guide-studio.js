/**
 * Figurative Study Coach help — slides + photo cards injected into Help.
 */
const SLIDES = [
  { kicker: 'Coach', title: 'You steer.', body: 'The coach looks at this list and names one step.', say: 'Try: brief me', photo: 'img/scene-ocean.jpg?v=4.45.0', alt: 'A fine ember line meets a quiet ocean at dusk' },
  { kicker: 'Coach', title: 'Three sizes.', body: 'Small, Default, or Heavy. Load once. It stays on this device.', say: 'Coach → Load', photo: 'img/scene-hearth.jpg?v=4.45.0', alt: 'A small hearth beside a stack of paper' },
  { kicker: 'Coach', title: 'Plain words.', body: 'List, find, open, add, start, pause.', say: 'Try: list tasks', photo: 'img/assistant-desk.jpg?v=4.45.0', alt: 'A focus dial sketched beside a blank notecard' },
  { kicker: 'Focus', title: 'One next step.', body: 'If you cannot start, ask for two minutes.', say: 'Try: what next', photo: 'img/scene-forest.jpg?v=4.45.0', alt: 'Fern leaves catching soft light in a forest' },
  { kicker: 'Mood', title: 'One mark.', body: 'Say how the day feels. It files a note.', say: 'Try: log mood', photo: 'img/scene-rain.jpg?v=4.45.0', alt: 'Warm lamplight beside a rain-covered window' },
  { kicker: 'Sound', title: 'A glass player.', body: 'Eight pieces, written here. Previous and next. They loop.', say: 'Wellbeing → Music', photo: 'img/scene-ocean.jpg?v=4.45.0', alt: 'A fine ember line meets a quiet ocean at dusk' }
];
const CARDS = [
  { id: 'coach-pilot', title: 'One step', body: 'The coach reads this workspace and stops there.', shot: 'img/scene-ocean.jpg?v=4.45.0', tag: 'Coach', go: 'coach' },
  { id: 'coach-lanterns', title: 'Three sizes', body: 'Small, Default, Heavy. Load once.', shot: 'img/scene-hearth.jpg?v=4.45.0', tag: 'Coach', go: 'coach' },
  { id: 'coach-chart', title: 'Short commands', body: 'List, find, open, add, start, pause.', shot: 'img/assistant-desk.jpg?v=4.45.0', tag: 'Coach', go: 'coach' },
  { id: 'coach-cairn', title: 'Two minutes', body: 'If starting sticks, shrink the first move.', shot: 'img/scene-forest.jpg?v=4.45.0', tag: 'Tips', go: 'focus' },
  { id: 'coach-tide', title: 'Mood', body: 'One number and a note. No lecture.', shot: 'img/scene-rain.jpg?v=4.45.0', tag: 'Wellness', go: 'mood' },
  { id: 'coach-cove', title: 'Music', body: 'A glass player. Previous, next, loop. No old recording.', shot: 'img/scene-ocean.jpg?v=4.45.0', tag: 'Wellness', go: 'sound' }
];
let slide = 0;
const SCENE_FALLBACK = '<svg viewBox="0 0 320 240" aria-hidden="true"><circle cx="160" cy="120" r="78" fill="var(--surface)" fill-opacity=".55" stroke="var(--line-2)" stroke-width="2"/><circle cx="160" cy="120" r="61" fill="none" stroke="var(--accent)" stroke-width="5" stroke-dasharray="240 145" stroke-linecap="round" transform="rotate(-90 160 120)"/><path d="M160 82v39l25 16" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/><path d="M160 24v17M246 120h17M57 120h17" fill="none" stroke="var(--line-2)" stroke-width="3" stroke-linecap="round"/></svg>';
function attachPhoto(stage, src, alt) {
  stage.classList.add('has-photo');
  if (alt) {
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', alt);
  }
  const fallback = document.createElement('span');
  fallback.className = 'guide-photo-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  fallback.innerHTML = SCENE_FALLBACK;
  const img = document.createElement('img');
  img.className = 'guide-photo-image';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => stage.classList.add('is-fallback'), { once: true });
  stage.append(fallback, img);
  img.src = src;
}
function goView(name) {
  const app = window.FocusDial;
  if (app && typeof app.view === 'function') app.view(name);
  else {
    const btn = document.querySelector('.rail-btn[data-view="' + name + '"]');
    if (btn) btn.click();
  }
}
function slideNode(s) {
  const art = document.createElement('article');
  art.className = 'guide-slide';
  art.setAttribute('role', 'group');
  art.setAttribute('aria-roledescription', 'slide');
  art.setAttribute('aria-label', `Slide ${slide + 1} of ${SLIDES.length}: ${s.title}`);
  art.innerHTML = '<figure class="guide-photo"></figure><div class="guide-copy"><div class="guide-kicker"></div><h3></h3><p></p><span class="guide-say"></span></div>';
  attachPhoto(art.querySelector('.guide-photo'), s.photo, s.alt);
  art.querySelector('.guide-kicker').textContent = s.kicker;
  art.querySelector('h3').textContent = s.title;
  art.querySelector('p').textContent = s.body;
  art.querySelector('.guide-say').textContent = s.say;
  return art;
}
function renderDeck() {
  const host = document.getElementById('guideDeck');
  if (!host) return;
  const stage = host.querySelector('[data-guide-stage]');
  stage.replaceChildren(slideNode(SLIDES[slide]));
  host.querySelectorAll('[data-guide-dot]').forEach((d, i) => {
    const active = i === slide;
    d.classList.toggle('on', active);
    d.setAttribute('aria-selected', String(active));
    d.tabIndex = active ? 0 : -1;
    d.setAttribute('aria-label', `Slide ${i + 1}: ${SLIDES[i].title}`);
  });
}
function mountDeck() {
  const host = document.getElementById('guideStudio');
  if (!host || document.getElementById('guideDeck')) return;
  const deck = document.createElement('div');
  deck.className = 'guide-studio';
  deck.innerHTML = '<div class="guide-deck" id="guideDeck"><div data-guide-stage></div><div class="guide-nav"><div class="guide-dots" role="tablist" aria-label="Study Coach tour slides"></div><div class="guide-actions"><button type="button" class="btn sm ghost" data-guide-prev>Back</button><button type="button" class="btn sm" data-guide-next>Next</button><button type="button" class="btn sm primary" data-guide-open>Open Study Coach</button></div></div></div><div class="guide-cards" id="guideCards"></div>';
  const dots = deck.querySelector('.guide-dots');
  SLIDES.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.guideDot = String(i);
    dots.appendChild(b);
  });
  host.appendChild(deck);
  const cards = deck.querySelector('#guideCards');
  CARDS.forEach((c) => {
    const el = document.createElement('article');
    el.className = 'guide-card';
    el.id = 'help-' + c.id;
    el.innerHTML = '<div class="shot"><span class="guide-photo-fallback" aria-hidden="true">' + SCENE_FALLBACK + '</span><img class="guide-photo-image" alt="" loading="lazy" decoding="async"><span class="guide-photo-tag"></span></div><div class="pad"><h3></h3><p></p><button type="button" class="btn sm ghost"></button></div>';
    const shot = el.querySelector('.shot'), image = shot.querySelector('img');
    image.addEventListener('error', () => shot.classList.add('is-fallback'), { once: true });
    image.src = c.shot;
    shot.classList.add('has-photo');
    el.querySelector('.guide-photo-tag').textContent = c.tag;
    el.querySelector('h3').textContent = c.title;
    el.querySelector('p').textContent = c.body;
    const btn = el.querySelector('button');
    btn.dataset.gotoGuide = c.go;
    const label = c.go === 'sound' ? 'Music & sound' : c.go.charAt(0).toUpperCase() + c.go.slice(1);
    btn.textContent = 'Open ' + label;
    btn.setAttribute('aria-label', 'Open ' + label);
    cards.appendChild(el);
  });
  deck.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.guideDot != null) { slide = Number(t.dataset.guideDot); renderDeck(); }
    if (t.dataset.guidePrev != null) { slide = (slide + SLIDES.length - 1) % SLIDES.length; renderDeck(); }
    if (t.dataset.guideNext != null) { slide = (slide + 1) % SLIDES.length; renderDeck(); }
    if (t.dataset.guideOpen != null) goView('coach');
  });
  deck.addEventListener('keydown', (e) => {
    const current = e.target.closest('[data-guide-dot]');
    if (!current) return;
    const dots = [...deck.querySelectorAll('[data-guide-dot]')];
    const at = dots.indexOf(current);
    const next = e.key === 'ArrowRight' ? (at + 1) % dots.length
      : e.key === 'ArrowLeft' ? (at - 1 + dots.length) % dots.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? dots.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); dots[next].click(); dots[next].focus();
  });
  cards.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.gotoGuide) goView(t.dataset.gotoGuide);
  });
  renderDeck();
}
function bindHelpSearch() {
  const search = document.getElementById('helpSearch');
  if (!search || search.dataset.guideBound) return;
  search.dataset.guideBound = '1';
  const apply = () => {
    const tour = document.getElementById('helpCoachTour');
    const hasQuery = Boolean(search.value.trim());
    if (tour) {
      tour.hidden = hasQuery;
      if (hasQuery) tour.open = false;
    }
  };
  search.addEventListener('input', apply);
  document.addEventListener('help:render', apply);
  apply();
}
function boot() {
  const start = () => { mountDeck(); bindHelpSearch(); };
  if (document.getElementById('view-help')) start();
  else document.addEventListener('DOMContentLoaded', start);
  const helpBtn = document.querySelector('.rail-btn[data-view="help"]');
  if (helpBtn) helpBtn.addEventListener('click', () => setTimeout(start, 40));
}
if (typeof document !== 'undefined') boot();
export { SLIDES, CARDS };
