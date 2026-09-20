/**
 * Figurative Study Coach help — slides + photo cards injected into Help.
 */
const SLIDES = [
  { kicker: 'Slide 01 · Harbor pilot', title: 'The coach is a pilot, not the captain.', body: 'You still steer the ship. The coach stands on the jetty with a lamp and a chart of this workspace — open tasks, the timer, the next cairn on the path. Ask it to look. Then you walk.', say: 'Try: brief me', photo: 'https://images.unsplash.com/photo-1468581264429-2548ef9ebcd9?auto=format&fit=crop&w=1400&q=70', alt: 'Harbor wall and still water at dusk' },
  { kicker: 'Slide 02 · Three lanterns', title: 'Small. Default. Heavy.', body: 'Three lamps on the same dock. Small lights the path quickly. Default is the everyday lantern. Heavy burns longer and sees farther — and takes a while to kindle. Pick a size, press Load, wait until the lamp is warm. Nothing leaves this browser.', say: 'Coach → Load', photo: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=70', alt: 'Night mountains under a field of stars' },
  { kicker: 'Slide 03 · Chart room', title: 'Name the weather, then name the work.', body: 'The coach can count the crates, find a title in the fog, open a room, add a task, start or pause the dial. Plain speech. No ritual. If the model is still downloading, the chart room still answers the short commands.', say: 'Try: list tasks · open plan · start focus', photo: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1400&q=70', alt: 'Notebook, pen and coffee on a wooden desk' },
  { kicker: 'Slide 04 · Next cairn', title: 'When the trail disappears, ask for the next stone.', body: 'ADHD days do not fail from a lack of maps. They fail from too many maps. What next looks only at what is already in this workspace and points at one stone you can step on.', say: 'Try: what next · I cannot start', photo: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=70', alt: 'Sunlit path through a green forest' },
  { kicker: 'Slide 05 · Weather log', title: 'Mood is tide, not a verdict.', body: 'A one-line check-in is a pencil mark on the harbor wall. Later the tide makes sense. Say how the day feels in ordinary words and the coach files it on Mood.', say: 'Try: I am feeling steady · log mood fried', photo: 'https://images.unsplash.com/photo-1482192594855-10d6e375abe0?auto=format&fit=crop&w=1400&q=70', alt: 'Fog moving through a mountain forest' },
  { kicker: 'Slide 06 · Sound of the cove', title: 'Rain, brown noise, a hearth — or a licensed quiet record.', body: 'Ask the coach to play rain and the Sound tab wakes. On Calm, a separate radio shelves public-domain and Creative Commons records so the room can have music without a copyright snare.', say: 'Try: play rain · open calm', photo: 'https://images.unsplash.com/photo-1428592953211-077101b2021b?auto=format&fit=crop&w=1400&q=70', alt: 'Rain on a window at night' }
];
const CARDS = [
  { id: 'coach-pilot', title: 'Harbor pilot', body: 'The coach reads this workspace. Trust the snapshot over guesses. Under ninety words. Adult voice. No pep-talk fog.', shot: SLIDES[0].photo, tag: 'Coach', go: 'coach' },
  { id: 'coach-lanterns', title: 'Three lanterns', body: 'Sizes only: Small, Default, Heavy. Load once. Weights stay on this device. If a fetch fails, light Small first.', shot: SLIDES[1].photo, tag: 'Coach', go: 'coach' },
  { id: 'coach-chart', title: 'Chart-room verbs', body: 'list, find, open, add, start, pause, skip, reset. Also: brief me, what next, mark done, add habit, play rain.', shot: SLIDES[2].photo, tag: 'Coach', go: 'coach' },
  { id: 'coach-cairn', title: 'The next cairn', body: 'Frozen at the desk? The first move shrinks to two minutes on the first open task. Say I cannot start.', shot: SLIDES[3].photo, tag: 'Tips', go: 'focus' },
  { id: 'coach-tide', title: 'Tide marks', body: 'Mood words become a number and a note. The day is allowed to be fried. The log does not argue.', shot: SLIDES[4].photo, tag: 'Wellness', go: 'mood' },
  { id: 'coach-cove', title: 'Cove radio', body: 'Calm now ships a default shelf of public-domain rain, forest, piano, and cello. Attribution sits on each station.', shot: SLIDES[5].photo, tag: 'Wellness', go: 'calm' }
];
let slide = 0;
const reduce = () => document.documentElement.getAttribute('data-motion') === 'reduce' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
  art.innerHTML = '<div class="guide-photo" role="img"></div><div class="guide-copy"><div class="guide-kicker"></div><h3></h3><p></p><span class="guide-say"></span></div>';
  art.querySelector('.guide-photo').style.backgroundImage = 'url(' + s.photo + ')';
  art.querySelector('.guide-photo').setAttribute('aria-label', s.alt);
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
  host.querySelectorAll('[data-guide-dot]').forEach((d, i) => d.classList.toggle('on', i === slide));
}
function mountDeck() {
  const help = document.getElementById('view-help');
  if (!help || document.getElementById('guideDeck')) return;
  const lead = help.querySelector('.help-lead');
  const deck = document.createElement('div');
  deck.id = 'guideStudio';
  deck.innerHTML = '<p class="help-lead guide-lead">The coach is a harbor pilot. These slides are the chart. Flip them when the room feels too loud for a manual.</p><div class="guide-deck" id="guideDeck"><div data-guide-stage></div><div class="guide-nav"><div class="guide-dots" role="tablist" aria-label="Coach help slides"></div><div class="guide-actions"><button type="button" class="btn sm ghost" data-guide-prev>Back</button><button type="button" class="btn sm" data-guide-next>Next slide</button><button type="button" class="btn sm primary" data-guide-open>Open coach</button></div></div></div><div class="guide-cards" id="guideCards"></div>';
  const dots = deck.querySelector('.guide-dots');
  SLIDES.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.guideDot = String(i);
    b.setAttribute('aria-label', 'Slide ' + (i + 1));
    dots.appendChild(b);
  });
  if (lead) lead.replaceWith(deck);
  else help.querySelector('.help').prepend(deck);
  const cards = document.getElementById('guideCards');
  CARDS.forEach((c) => {
    const el = document.createElement('article');
    el.className = 'guide-card';
    el.id = 'help-' + c.id;
    el.innerHTML = '<div class="shot"><span></span></div><div class="pad"><h3></h3><p></p><button type="button" class="btn sm ghost"></button></div>';
    el.querySelector('.shot').style.backgroundImage = 'url(' + c.shot + ')';
    el.querySelector('.shot span').textContent = c.tag;
    el.querySelector('h3').textContent = c.title;
    el.querySelector('p').textContent = c.body;
    const btn = el.querySelector('button');
    btn.dataset.gotoGuide = c.go;
    btn.textContent = 'Open ' + c.go;
    cards.appendChild(el);
  });
  deck.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.guideDot != null) { slide = Number(t.dataset.guideDot); renderDeck(); }
    if (t.dataset.guidePrev != null) { slide = (slide + SLIDES.length - 1) % SLIDES.length; renderDeck(); }
    if (t.dataset.guideNext != null) { slide = (slide + 1) % SLIDES.length; renderDeck(); }
    if (t.dataset.guideOpen != null) goView('coach');
    if (t.dataset.gotoGuide) goView(t.dataset.gotoGuide);
  });
  cards.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.gotoGuide) goView(t.dataset.gotoGuide);
  });
  renderDeck();
  if (!reduce()) {
    setInterval(() => {
      const on = document.getElementById('view-help') && document.getElementById('view-help').classList.contains('on');
      if (!on || document.hidden) return;
      slide = (slide + 1) % SLIDES.length;
      renderDeck();
    }, 14000);
  }
}
function bindHelpSearch() {
  const search = document.getElementById('helpSearch');
  const cards = document.getElementById('guideCards');
  const deck = document.getElementById('guideDeck');
  if (!search || search.dataset.guideBound) return;
  search.dataset.guideBound = '1';
  const apply = () => {
    const q = search.value.toLowerCase().trim();
    const coachish = !q || /coach|pilot|lantern|cairn|harbor|radio|calm|mood|brief|next/.test(q);
    if (deck) deck.hidden = q.length > 0 && !coachish;
    if (!cards) return;
    [...cards.children].forEach((el) => {
      const hay = el.textContent.toLowerCase();
      el.hidden = q.length > 0 && hay.indexOf(q) === -1 && !coachish;
    });
  };
  search.addEventListener('input', apply);
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
