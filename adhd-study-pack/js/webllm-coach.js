/**
 * On-device study coach — MLC WebLLM, wired to FocusDial workspace state.
 */
const MODEL_OPTIONS = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Small', hint: 'Fastest download' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Default', hint: 'Best balance' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Heavy', hint: 'Stronger replies' }
];
const WEBLLM_SRC = [
  'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm',
  'https://esm.run/@mlc-ai/web-llm@0.2.85'
];
const SYSTEM = `You are the ADHD Study Pack coach inside this workspace.
You receive a live WORKSPACE snapshot. Trust it over guesses.
For how many / find / list / open / add / start / pause, the app may already have acted; confirm that result.
Voice: calm, specific, adult. Stay under 90 words.`;
const STARTERS = [
  { label: 'How many tasks', prompt: 'How many tasks do I have open?' },
  { label: 'List tasks', prompt: 'List my open tasks' },
  { label: 'Start focus', prompt: 'Start the focus timer' },
  { label: 'Open plan', prompt: 'Open the plan' },
  { label: 'Cannot start', prompt: 'I am staring at the work and cannot start. Shrink the first move to two minutes.' }
];
const STORE_KEY = 'adhd-study-pack.coach.size';
const state = { engine: null, loading: false, busy: false, messages: [], modelId: defaultModelId() };
function defaultModelId() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && MODEL_OPTIONS.some((m) => m.id === saved)) return saved;
  } catch (e) {}
  return MODEL_OPTIONS[1].id;
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function appState() {
  try {
    if (window.FocusDial && typeof window.FocusDial.getState === 'function') return window.FocusDial.getState() || {};
  } catch (e) {}
  return {};
}
function subjectName(S, id) {
  const sub = (S.subjects || []).find((x) => x.id === id);
  return sub && sub.name ? sub.name : '';
}
function workspaceSnapshot() {
  const S = appState();
  const tasks = Array.isArray(S.tasks) ? S.tasks : [];
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const events = S.events || [];
  const notes = S.notes || [];
  const habits = S.habits || [];
  const sessions = S.sessions || [];
  const timer = S.timer || {};
  const active = tasks.find((t) => t.id === timer.taskId);
  const intent = (($('#intentInput') || {}).value || timer.intent || '').trim();
  const taskLine = (t) => '- ' + (t.done ? '[done] ' : '[open] ') + (t.title || 'Untitled');
  return [
    'WORKSPACE',
    'Tasks: ' + tasks.length + ' total, ' + open.length + ' open, ' + done.length + ' done.',
    'Plan blocks: ' + events.length + '. Notes: ' + notes.length + '. Habits: ' + habits.length + '. Sessions: ' + sessions.length + '.',
    'Today min: ' + (($('#todayMin') || {}).textContent || '0') + '. Streak: ' + (($('#streakVal') || {}).textContent || '0') + '.',
    'Active task: ' + (active && active.title ? active.title : 'none') + '. Intent: ' + (intent || 'none') + '.',
    open.length ? 'Open tasks:\n' + open.slice(0, 12).map(taskLine).join('\n') : 'Open tasks: none.'
  ].join('\n');
}
function fd() { return window.FocusDial || null; }
function goView(name) { const app = fd(); if (app && app.view) app.view(name); }
function stripQuote(s) { return String(s || '').replace(/^[\s"'"\u201c\u201d]+|[\s"'"\u201c\u201d?!.]+$/g, '').trim(); }
function findTasks(query) {
  const q = String(query || '').trim().toLowerCase();
  const tasks = appState().tasks || [];
  if (!q) return tasks.slice(0, 8);
  return tasks.filter((t) => [t.title, t.energy, t.quad, subjectName(appState(), t.subjectId)].join(' ').toLowerCase().includes(q));
}
function titles(items, key) {
  return items.slice(0, 8).map((x) => '"' + ((key ? x[key] : x.title || x.name || x.text || 'Untitled') + '').replace(/\s+/g, ' ').slice(0, 60) + '"');
}
const VIEW_ALIASES = {
  focus:'focus', timer:'focus', pomodoro:'focus', home:'focus',
  plan:'plan', planner:'plan', calendar:'plan', week:'plan', schedule:'plan',
  task:'tasks', tasks:'tasks', todo:'tasks', todos:'tasks', queue:'tasks',
  matrix:'matrix', eisenhower:'matrix', priority:'matrix',
  note:'notes', notes:'notes', stickies:'notes', board:'notes',
  sound:'sound', sounds:'sound', audio:'sound', noise:'sound',
  calm:'calm', breathe:'calm', breathing:'calm', ground:'calm',
  mood:'mood', feelings:'mood',
  habit:'habits', habits:'habits',
  stat:'stats', stats:'stats', statistics:'stats', progress:'stats',
  passport:'passport', badge:'passport', badges:'passport',
  help:'help', guide:'help', about:'about',
  setup:'settings', setting:'settings', settings:'settings', coach:'coach'
};
function matchView(word) { return VIEW_ALIASES[String(word || '').toLowerCase()] || ''; }
function tryLocalAnswer(text) {
  const raw = String(text || '').trim();
  const q = raw.toLowerCase();
  const S = appState();
  const tasks = S.tasks || [];
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const notes = S.notes || [];
  const habits = S.habits || [];
  const events = S.events || [];
  const sessions = S.sessions || [];
  const app = fd();
  const nav = q.match(/\b(?:open|show|go to|switch to|take me to|jump to)\s+(?:the\s+)?([a-z]+)/i) || q.match(/^(?:tasks|plan|focus|notes|habits|mood|stats|matrix|sound|calm|passport|help|setup|settings|coach)$/);
  if (nav) {
    const view = matchView(nav[1] || nav[0]);
    if (view) {
      goView(view);
      const extra = view === 'tasks' ? ' ' + open.length + ' open.' : view === 'plan' ? ' ' + events.length + ' blocks.' : view === 'notes' ? ' ' + notes.length + ' notes.' : view === 'habits' ? ' ' + habits.length + ' habits.' : '';
      return 'Opened ' + view + '.' + extra;
    }
  }
  if ((/\b(start|run|resume)\b/.test(q) && /\b(timer|focus|pomo|pomodoro|session|dial)\b/.test(q) && !/\btask\b/.test(q)) || /^(start|go|begin)$/.test(q) || q === 'start focus' || q === 'start timer') {
    if (app && app.start) { app.start(); goView('focus'); return 'Focus timer started.'; }
  }
  if (/\b(pause|stop timer|stop the timer|hold)\b/.test(q) && !/\badd\b/.test(q)) {
    if (app && app.pause) { app.pause(); return 'Timer paused.'; }
  }
  if (/\b(skip|next phase|skip break|skip focus)\b/.test(q)) {
    if (app && app.skip) { app.skip(); goView('focus'); return 'Skipped to the next phase.'; }
  }
  if (/\breset (the )?(timer|interval|dial|pomo)/.test(q)) {
    if (app && app.reset) { app.reset(); goView('focus'); return 'Timer reset.'; }
  }
  const addTask = q.match(/^(?:add|create|new|make)\s+(?:a\s+)?(?:new\s+)?task(?:\s+(?:called|named|for|to|about))?\s*[:\-]?\s*(.+)$/i) || q.match(/^remind me to\s+(.+)$/i);
  if (addTask && app && app.addTask) {
    const title = stripQuote(addTask[1]);
    if (title) {
      const t = app.addTask({ title: title.slice(0, 120) });
      goView('tasks');
      return 'Added task "' + t.title + '". ' + (open.length + 1) + ' open now.';
    }
  }
  const addNote = q.match(/^(?:add|create|new|park|dump)\s+(?:a\s+)?note(?:\s+(?:that|saying|about))?\s*[:\-]?\s*(.+)$/i) || q.match(/^park this[:\-]?\s*(.+)$/i);
  if (addNote && app && app.addNote) {
    const body = stripQuote(addNote[1]);
    if (body) {
      app.addNote(body.slice(0, 280), 'note');
      goView('notes');
      return 'Parked a note: "' + body.slice(0, 80) + '".';
    }
  }
  const workOn = q.match(/^(?:work on|start(?: working on)?|focus on|do|pick)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?$/i);
  if (workOn && app && app.focusTask) {
    const needle = stripQuote(workOn[1]);
    const hits = findTasks(needle);
    if (!hits.length) return 'No task matches "' + needle + '". Say list tasks.';
    app.focusTask(hits[0].id);
    if (app.start && /\b(start|work on|do)\b/.test(q)) app.start();
    goView('focus');
    return 'Session task is now "' + hits[0].title + '".';
  }
  const askingCount = /\b(how many|number of|count of|# of)\b/.test(q);
  if (askingCount && /task/.test(q)) return 'You have ' + tasks.length + ' tasks: ' + open.length + ' open, ' + done.length + ' done.' + (open[0] ? ' Next open: "' + open[0].title + '".' : '');
  if (askingCount && /note/.test(q)) return 'You have ' + notes.length + ' notes.';
  if (askingCount && /habit/.test(q)) return 'You have ' + habits.length + ' habits.';
  if (askingCount && /(session|pomo|block)/.test(q)) return 'You have ' + sessions.length + ' sessions and ' + events.length + ' plan blocks.';
  const findHit = q.match(/\b(?:find|search|where is|look for|locate)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s*$/i);
  if (findHit) {
    const needle = stripQuote(findHit[1]);
    const hits = findTasks(needle);
    if (!hits.length) return 'No task matches "' + needle + '".';
    goView('tasks');
    return 'Found ' + hits.length + ': ' + hits.slice(0, 5).map((t) => (t.done ? 'done' : 'open') + ' "' + t.title + '"').join('; ') + '.';
  }
  if (/^(list|show) (my |all )?(open )?tasks\b/.test(q) || /^(what are my tasks|what tasks do i have|my tasks)$/.test(q)) {
    goView('tasks');
    return open.length ? 'Open tasks (' + open.length + '): ' + titles(open).join('; ') + '.' : 'No open tasks. Say add task plus a title.';
  }
  if (/^(list|show) (my |all )?(done|finished) tasks\b/.test(q)) { goView('tasks'); return done.length ? 'Done (' + done.length + '): ' + titles(done).join('; ') + '.' : 'Nothing marked done yet.'; }
  if (/^(list|show) (my |all )?notes\b/.test(q)) { goView('notes'); const named = notes.filter((n) => (n.text || '').trim()); return named.length ? 'Notes (' + named.length + '): ' + titles(named, 'text').join('; ') + '.' : 'The note wall is empty.'; }
  if (/^(list|show) (my |all )?habits\b/.test(q)) { goView('habits'); return habits.length ? 'Habits (' + habits.length + '): ' + titles(habits).join('; ') + '.' : 'No habits yet.'; }
  if (/^(list|show) (my |all )?(plan|events|blocks|calendar)\b/.test(q)) { goView('plan'); return events.length ? 'Plan blocks (' + events.length + '): ' + titles(events).join('; ') + '.' : 'No plan blocks yet.'; }
  if (/\b(minutes today|today's minutes|how long (have i|did i) focus)/.test(q)) return 'Focus minutes today: ' + (($('#todayMin') || {}).textContent || '0') + '.';
  if (/\bstreak\b/.test(q)) return 'Current streak: ' + (($('#streakVal') || {}).textContent || '0') + ' days.';
  if (/^(what can you do|help|commands)\b/.test(q)) return 'I can list or count tasks, notes, habits, and plan blocks; find a title; add a task or note; start, pause, skip, or reset the timer; work on a task; and open Focus, Plan, Tasks, Matrix, Notes, Sound, Calm, Mood, Habits, Stats, Passport, Help, or Setup.';
  return '';
}
function chatPayload() {
  const turns = state.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  return [{ role: 'system', content: SYSTEM + '\n\n' + workspaceSnapshot() }, ...turns];
}
function friendlyError(err) {
  const raw = (err && err.message) ? err.message : String(err || 'Unknown error');
  const text = raw.toLowerCase();
  if (!navigator.gpu) return 'This browser cannot run a local model. Use Chrome, Edge, or Safari 18+.';
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('cors')) return 'Could not download the weights. Try Small first.';
  return raw;
}
function setStatus(text, cls) {
  $$('[data-coach-status]').forEach((el) => { el.textContent = text; });
  $$('.coach-fab').forEach((el) => { el.classList.toggle('is-ready', cls === 'ready'); el.classList.toggle('is-busy', cls === 'busy'); });
}
function setProgress(pct) {
  $$('[data-coach-bar]').forEach((el) => { el.style.width = Math.max(0, Math.min(100, pct * 100)) + '%'; });
}
function bubble(role, text, typing) {
  const wrap = document.createElement('article');
  wrap.className = 'coach-msg ' + role + (typing ? ' is-typing' : '');
  wrap.innerHTML = '<div class="who">' + (role === 'user' ? 'You' : role === 'assistant' ? 'Coach' : 'Note') + '</div><div class="bubble"></div>';
  wrap.querySelector('.bubble').textContent = text;
  return wrap;
}
function appendMsg(role, text, typing) {
  const nodes = [];
  $$('[data-coach-log]').forEach((log) => { const el = bubble(role, text, typing); log.appendChild(el); log.scrollTop = log.scrollHeight; nodes.push(el); });
  return nodes;
}
function writeBubbles(nodes, text) {
  nodes.forEach((n) => { const b = n.querySelector('.bubble'); if (b) b.textContent = text; n.classList.remove('is-typing'); });
  $$('[data-coach-log]').forEach((log) => { log.scrollTop = log.scrollHeight; });
}
function syncComposer(value) { $$('[data-coach-input]').forEach((el) => { if (el.value !== value) el.value = value; }); }
async function loadWebllm() {
  let last;
  for (const src of WEBLLM_SRC) { try { return await import(src); } catch (err) { last = err; } }
  throw last || new Error('Could not load the on-device runtime');
}
async function ensureEngine() {
  if (state.engine) return state.engine;
  if (!navigator.gpu) throw new Error('WebGPU is required. Use current Chrome, Edge, or Safari 18+.');
  if (state.loading) { while (state.loading) await new Promise((r) => setTimeout(r, 80)); if (state.engine) return state.engine; }
  state.loading = true;
  setStatus('Downloading into this browser\u2026', 'busy');
  setProgress(0.02);
  try {
    const webllm = await loadWebllm();
    const prefix = webllm.modelLibURLPrefix, ver = webllm.modelVersion;
    const appConfig = { model_list: [
      { model: 'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', model_id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', model_lib: prefix + ver + '/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', low_resource_required: true, overrides: { context_window_size: 2048 } },
      { model: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC', model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', model_lib: prefix + ver + '/Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm', low_resource_required: true, overrides: { context_window_size: 2048 } },
      { model: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC', model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', model_lib: prefix + ver + '/Llama-3.2-3B-Instruct-q4f16_1_cs1k-webgpu.wasm', low_resource_required: true, overrides: { context_window_size: 2048 } }
    ]};
    const engine = await webllm.CreateMLCEngine(state.modelId, {
      appConfig,
      initProgressCallback: (p) => {
        const frac = typeof p.progress === 'number' ? p.progress : 0;
        setProgress(frac);
        setStatus((p.text || '').replace(/huggingface\.co\/mlc-ai\/[^\s]+/gi, 'weights') || ('Loading ' + Math.round(frac * 100) + '%'), 'busy');
      }
    });
    state.engine = engine;
    setProgress(1);
    setStatus('Ready \u00b7 on this device', 'ready');
    return engine;
  } catch (err) { setStatus(friendlyError(err), ''); throw err; }
  finally { state.loading = false; }
}
async function send(text) {
  const content = (text || '').trim();
  if (!content || state.busy) return;
  state.busy = true;
  $$('[data-coach-send]').forEach((b) => { b.disabled = true; });
  appendMsg('user', content);
  state.messages.push({ role: 'user', content });
  const nodes = appendMsg('assistant', 'Thinking\u2026', true);
  try {
    const local = tryLocalAnswer(content);
    if (local) { writeBubbles(nodes, local); state.messages.push({ role: 'assistant', content: local }); return; }
    const engine = await ensureEngine();
    const chunks = await engine.chat.completions.create({ messages: chatPayload(), stream: true, temperature: 0.55, max_tokens: 220 });
    let reply = '';
    for await (const chunk of chunks) {
      const piece = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
      if (piece) reply += piece;
      writeBubbles(nodes, reply || '\u2026');
    }
    if (!reply && engine.getMessage) reply = await engine.getMessage();
    if (!reply) reply = 'I could not finish that reply. Try a shorter prompt.';
    writeBubbles(nodes, reply);
    state.messages.push({ role: 'assistant', content: reply });
    const turns = state.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    if (turns.length > 12) state.messages = turns.slice(-12);
  } catch (err) {
    writeBubbles(nodes, 'Could not run the local model. ' + friendlyError(err));
    nodes.forEach((n) => n.classList.add('system'));
    setStatus('Load failed', '');
  } finally {
    state.busy = false;
    $$('[data-coach-send]').forEach((b) => { b.disabled = false; });
  }
}
function clearChat() {
  state.messages = [];
  $$('[data-coach-log]').forEach((log) => { log.innerHTML = ''; log.appendChild(bubble('system', 'Thread cleared. Try: how many tasks, list tasks, open plan, start focus, add task read chapter.')); });
}
function bindPanel(root) {
  const form = $('[data-coach-form]', root);
  const input = $('[data-coach-input]', root);
  const select = $('[data-coach-model]', root);
  const loadBtn = $('[data-coach-load]', root);
  const clearBtn = $('[data-coach-clear]', root);
  if (select) {
    select.innerHTML = MODEL_OPTIONS.map((m) => '<option value="' + m.id + '">' + m.label + '</option>').join('');
    if (![...select.options].some((o) => o.value === state.modelId)) state.modelId = MODEL_OPTIONS[1].id;
    select.value = state.modelId;
    select.onchange = () => {
      state.modelId = select.value;
      try { localStorage.setItem(STORE_KEY, state.modelId); } catch (e) {}
      state.engine = null;
      setStatus('Size changed \u2014 load again', '');
      setProgress(0);
    };
  }
  if (loadBtn) { loadBtn.textContent = 'Load'; loadBtn.onclick = () => ensureEngine().catch((err) => setStatus(friendlyError(err), '')); }
  if (clearBtn) clearBtn.onclick = clearChat;
  if (form && input) {
    form.onsubmit = (e) => { e.preventDefault(); const v = input.value; input.value = ''; syncComposer(''); send(v); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  }
  $$('[data-coach-chip]', root).forEach((btn) => { btn.onclick = () => send(btn.dataset.coachChip || btn.textContent); });
}
function mountDock() {
  if ($('#coachDock')) return;
  const dock = document.createElement('div');
  dock.className = 'coach-dock';
  dock.id = 'coachDock';
  dock.innerHTML = '<div class="coach-panel" id="coachPanel" hidden><div class="coach-head"><div class="coach-id"><div class="coach-avatar" aria-hidden="true">SC</div><div><h3>Study coach</h3><p class="sub">Wired to this workspace</p></div></div><div class="coach-head-actions"><button type="button" class="btn sm ghost" data-coach-clear>Clear</button><button type="button" class="btn icon ghost" data-coach-close aria-label="Close coach">\u2715</button></div></div><div class="coach-stage"><select data-coach-model aria-label="Model size"></select><button type="button" class="btn sm primary" data-coach-load>Load</button><p class="coach-status" data-coach-status>Ask to list, find, open, add, or start</p><div class="coach-progress" aria-hidden="true"><span data-coach-bar></span></div></div><div class="coach-log" data-coach-log><article class="coach-msg system"><div class="who">Note</div><div class="bubble">Try: how many tasks, list tasks, open plan, start focus, add task read chapter.</div></article></div><div class="coach-chips" id="coachDockChips"></div><form class="coach-composer" data-coach-form><label class="sr-only" for="coachDockInput">Message the coach</label><textarea id="coachDockInput" data-coach-input rows="2" placeholder="How many tasks do I have?"></textarea><button class="btn primary" type="submit" data-coach-send>Send</button></form></div><button type="button" class="coach-fab" id="coachFab" aria-expanded="false" aria-controls="coachPanel"><span class="mark" aria-hidden="true">SC</span>Coach<span class="pip" aria-hidden="true"></span></button>';
  document.body.appendChild(dock);
  const chips = document.getElementById('coachDockChips');
  if (chips) STARTERS.forEach((s) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.coachChip = s.prompt; b.textContent = s.label; chips.appendChild(b); });
  const panel = $('#coachPanel'), fab = $('#coachFab');
  fab.onclick = () => { const open = panel.hasAttribute('hidden'); panel.toggleAttribute('hidden', !open); fab.setAttribute('aria-expanded', String(open)); };
  const closeBtn = $('[data-coach-close]', dock);
  if (closeBtn) closeBtn.onclick = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
  bindPanel(dock);
}
function enhanceFullView() {
  const view = $('#view-coach');
  if (!view) return;
  const note = view.querySelector('.coach-msg.system .bubble');
  if (note) note.textContent = 'Try: how many tasks, list tasks, open plan, start focus, add task read chapter.';
  bindPanel(view);
}
function watchRail() {
  document.addEventListener('click', () => setTimeout(() => {
    const el = document.getElementById('view-coach');
    document.body.classList.toggle('coach-view-on', !!(el && el.classList.contains('on')));
  }, 0));
}
function boot() {
  mountDock(); enhanceFullView(); watchRail();
  window.StudyCoach = { snapshot: workspaceSnapshot, findTasks: findTasks, ask: send, state: function () { return appState(); } };
}
document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
