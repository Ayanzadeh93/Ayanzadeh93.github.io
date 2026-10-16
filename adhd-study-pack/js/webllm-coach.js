/**
 * Study coach — on-device (MLC WebLLM) or online (Claude / OpenAI / OpenRouter),
 * both wired to FocusDial workspace state.
 */
import { PROVIDERS, isValidKey, chatStream, listModels, preferChatModels } from './lib/coach-providers.js?v=4.45.0';
import { secretName } from './lib/secrets.js?v=4.45.0';

const MODEL_OPTIONS = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Small', hint: 'Fastest download', mb: 350, phone: true },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Default', hint: 'Best balance', mb: 880, phone: false },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Heavy', hint: 'Stronger replies', mb: 1900, phone: false }
];
/* Keys live outside the workspace, and under the signed-in account, so an
   export never contains them and the next account on this browser cannot
   read them. */
const KEY_PREFIX = 'adhd-study-pack.coach.key.';
const PROVIDER_KEY = 'adhd-study-pack.coach.provider';
const ONLINE_MODEL_PREFIX = 'adhd-study-pack.coach.model.';
/* Which on-device models have finished loading here before. A model already in
   the browser cache reopens instantly, so that one may auto-load; a first-ever
   download never starts without being asked. */
const CACHED_KEY = 'adhd-study-pack.coach.cached';

const store = {
  get(k, dflt = '') { try { return localStorage.getItem(k) ?? dflt; } catch (e) { return dflt; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} }
};
function coachOwner() {
  try {
    const user = window.FocusDial && window.FocusDial.user;
    return user && user.id || '';
  } catch (e) { return ''; }
}
function coachKeyName(provider) { return secretName(KEY_PREFIX + provider, coachOwner()); }
export function apiKeyFor(provider) { return store.get(coachKeyName(provider)); }
function setApiKey(provider, key) { store.set(coachKeyName(provider), key); }
function onlineModelFor(provider) {
  return store.get(ONLINE_MODEL_PREFIX + provider) || (PROVIDERS[provider] && PROVIDERS[provider].defaultModel) || '';
}
function setOnlineModel(provider, model) { store.set(ONLINE_MODEL_PREFIX + provider, model); }
function cachedModels() {
  try { return JSON.parse(store.get(CACHED_KEY, '[]')) || []; } catch (e) { return []; }
}
function markCached(id) {
  const all = cachedModels();
  if (!all.includes(id)) store.set(CACHED_KEY, JSON.stringify(all.concat(id)));
}
/* A phone will not hold a billion-parameter model. Saying so up front beats
   letting someone start a download that cannot finish. */
function isPhone() {
  return /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent || '')
    || (window.matchMedia && window.matchMedia('(max-width: 560px)').matches);
}
function deviceCapable() { return !!navigator.gpu; }
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
const state = {
  engine: null, loading: false, busy: false, abortController: null, messages: [],
  modelId: defaultModelId(),
  provider: defaultProvider()
};
function defaultModelId() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && MODEL_OPTIONS.some((m) => m.id === saved)) return saved;
  } catch (e) {}
  /* Small on a phone, the balanced one everywhere else. */
  return isPhone() ? MODEL_OPTIONS[0].id : MODEL_OPTIONS[1].id;
}
/* A phone or a browser without WebGPU cannot run the on-device coach, so start
   those people on the online group instead of on a button that will fail. */
function defaultProvider() {
  const saved = store.get(PROVIDER_KEY);
  if (saved && (saved === 'device' || PROVIDERS[saved])) return saved;
  if (!deviceCapable() || isPhone()) return 'anthropic';
  return 'device';
}
function currentOnlineProvider() { return state.provider === 'device' ? null : state.provider; }
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
/* Every on-device failure used to print the same two words — "Load failed" —
   whether WebGPU was missing, the CDN was blocked, or the phone ran out of
   memory. Each of these names the cause and the way forward. */
function friendlyError(err) {
  const raw = (err && err.message) ? err.message : String(err || 'Unknown error');
  const text = raw.toLowerCase();
  if (!navigator.gpu) {
    return 'This browser has no WebGPU, so it cannot run the on-device coach. Chrome, Edge or Safari 18+ can — or pick an online coach below, which works anywhere.';
  }
  if (text.includes('out of memory') || text.includes('oom') || text.includes('allocation') || text.includes('device lost')) {
    return isPhone()
      ? 'This phone does not have enough memory for the on-device model. Pick an online coach below — it runs nothing locally.'
      : 'This device ran out of memory loading that size. Try Small, or pick an online coach below.';
  }
  if (text.includes('jsdelivr') || text.includes('esm.run') || text.includes('runtime')) {
    return 'Could not reach the model runtime (cdn.jsdelivr.net). A network or extension may be blocking it. An online coach does not need it.';
  }
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('cors')) {
    return 'Could not download the weights from huggingface.co. Check the connection, try Small, or pick an online coach below.';
  }
  return raw;
}
function setStatus(text, cls) {
  $$('[data-coach-status]').forEach((el) => { el.textContent = text; el.dataset.state = cls || 'idle'; });
  $$('.coach-fab').forEach((el) => { el.classList.toggle('is-ready', cls === 'ready'); el.classList.toggle('is-busy', cls === 'busy'); });
}
function syncBusyUi() {
  $$('[data-coach-send]').forEach((button) => { button.disabled = state.busy; });
  $$('[data-coach-model], [data-coach-online-model], [data-coach-load], [data-coach-save-key], [data-coach-forget]').forEach((control) => { control.disabled = state.busy; });
  $$('[data-coach-stop]').forEach((button) => { button.hidden = !state.busy; });
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
  speakReply(text);
}

/* ---------------------------------------------------------------------------
   Voice. Off by default and never automatic on first use: audio that starts by
   itself is exactly the kind of interruption this app exists to avoid. Once
   switched on it reads each reply, and Stop works mid-sentence. The voice and
   speaking rate are the ones already chosen in Setup → Reading and speech, so
   there is one place to change them rather than two.
   --------------------------------------------------------------------------- */
const VOICE_KEY = 'adhd-study-pack.coach.speak';
const voice = { on: false, last: '' };
try { voice.on = localStorage.getItem(VOICE_KEY) === '1'; } catch (e) {}

function comfortPrefs() {
  try { return (window.FocusDial && window.FocusDial.getState().settings.comfort) || {}; } catch (e) { return {}; }
}
function voiceSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}
function speakReply(text) {
  if (!voice.on || !text || !voiceSupported()) return;
  voice.last = text;
  const c = comfortPrefs();
  const u = new SpeechSynthesisUtterance(String(text));
  const chosen = c.voice && window.speechSynthesis.getVoices().find((v) => v.voiceURI === c.voice);
  if (chosen) { u.voice = chosen; u.lang = chosen.lang; } else u.lang = document.documentElement.lang || 'en';
  u.rate = Math.min(2, Math.max(0.5, Number(c.rate) || 1));
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  paintVoice();
}
function stopSpeaking() { if (voiceSupported()) window.speechSynthesis.cancel(); paintVoice(); }
function paintVoice() {
  const box = document.getElementById('coachVoice');
  if (!box) return;
  const supported = voiceSupported();
  box.hidden = false;
  const toggle = document.getElementById('coachSpeakToggle');
  const replay = document.getElementById('coachReplay');
  const stop = document.getElementById('coachStopVoice');
  const note = document.getElementById('coachVoiceNote');
  if (toggle) {
    toggle.disabled = !supported;
    toggle.setAttribute('aria-pressed', String(voice.on && supported));
    toggle.lastChild.textContent = voice.on ? ' Reading replies aloud' : ' Read replies aloud';
  }
  if (replay) replay.hidden = !(supported && voice.on && voice.last);
  if (stop) stop.hidden = !(supported && window.speechSynthesis.speaking);
  if (note) note.textContent = supported ? (voice.on ? 'Voice and speed follow Setup → Reading and speech.' : '') : 'This browser has no built-in voice.';
}
function wireVoice() {
  const toggle = document.getElementById('coachSpeakToggle');
  if (toggle && !toggle.dataset.wired) {
    toggle.dataset.wired = '1';
    toggle.onclick = () => {
      voice.on = !voice.on;
      try { localStorage.setItem(VOICE_KEY, voice.on ? '1' : '0'); } catch (e) {}
      if (!voice.on) stopSpeaking(); else paintVoice();
    };
  }
  const replay = document.getElementById('coachReplay');
  if (replay && !replay.dataset.wired) { replay.dataset.wired = '1'; replay.onclick = () => { if (voice.last) { voice.on = true; speakReply(voice.last); } }; }
  const stop = document.getElementById('coachStopVoice');
  if (stop && !stop.dataset.wired) { stop.dataset.wired = '1'; stop.onclick = stopSpeaking; }
  /* The Stop button should disappear once the utterance finishes on its own. */
  if (voiceSupported() && !wireVoice.polling) {
    wireVoice.polling = setInterval(() => {
      const el = document.getElementById('coachStopVoice');
      if (el) el.hidden = !(voice.on && window.speechSynthesis.speaking);
    }, 700);
  }
  paintVoice();
}
function syncComposer(value) { $$('[data-coach-input]').forEach((el) => { if (el.value !== value) el.value = value; }); }
async function loadWebllm() {
  let last;
  for (const src of WEBLLM_SRC) { try { return await import(src); } catch (err) { last = err; } }
  throw last || new Error('Could not load the on-device runtime');
}
async function ensureEngine(signal) {
  const stopped = () => { const err = new Error('Response stopped.'); err.name = 'AbortError'; return err; };
  if (signal && signal.aborted) throw stopped();
  if (state.engine) return state.engine;
  if (!navigator.gpu) throw new Error('WebGPU is required. Use current Chrome, Edge, or Safari 18+.');
  if (state.loading) {
    while (state.loading) {
      if (signal && signal.aborted) throw stopped();
      await new Promise((r) => setTimeout(r, 80));
    }
    if (signal && signal.aborted) throw stopped();
    if (state.engine) return state.engine;
  }
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
    markCached(state.modelId);       // next visit may load this one without asking
    setProgress(1);
    setStatus('Ready \u00b7 on this device', 'ready');
    paintProviderUi();
    return engine;
  } catch (err) { setStatus(friendlyError(err), ''); throw err; }
  finally { state.loading = false; }
}
async function send(text) {
  const content = (text || '').trim();
  if (!content || state.busy) return;
  state.busy = true;
  const controller = new AbortController();
  state.abortController = controller;
  syncBusyUi();
  appendMsg('user', content);
  state.messages.push({ role: 'user', content });
  const nodes = appendMsg('assistant', 'Thinking\u2026', true);
  try {
    /* Workspace questions are answered from state without any model at all \u2014
       that path is the same whichever coach is selected. */
    const local = tryLocalAnswer(content);
    if (local) {
      writeBubbles(nodes, local);
      state.messages.push({ role: 'assistant', content: local });
      if (state.messages.length > 12) state.messages = state.messages.slice(-12);
      return;
    }

    let reply = '';
    const online = currentOnlineProvider();
    if (online) {
      setStatus('Thinking \u00b7 ' + PROVIDERS[online].label, 'busy');
      reply = await chatStream({
        provider: online,
        apiKey: apiKeyFor(online),
        model: onlineModelFor(online),
        system: SYSTEM + '\n\n' + workspaceSnapshot(),
        messages: chatPayload().filter((m) => m.role !== 'system'),
        signal: controller.signal,
        onDelta: (piece, sofar) => { if (!controller.signal.aborted) writeBubbles(nodes, sofar); }
      });
      setStatus('Ready \u00b7 ' + PROVIDERS[online].label, 'ready');
    } else {
      const engine = await ensureEngine(controller.signal);
      if (controller.signal.aborted) {
        writeBubbles(nodes, 'Response stopped.');
        nodes.forEach((n) => n.classList.add('system'));
        setStatus('Response stopped', '');
        return;
      }
      const chunks = await engine.chat.completions.create({ messages: chatPayload(), stream: true, temperature: 0.55, max_tokens: 220 });
      for await (const chunk of chunks) {
        if (controller.signal.aborted) break;
        const piece = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
        if (piece) reply += piece;
        writeBubbles(nodes, reply || '\u2026');
      }
      if (!reply && engine.getMessage && !controller.signal.aborted) reply = await engine.getMessage();
    }
    if (controller.signal.aborted) {
      writeBubbles(nodes, 'Response stopped.');
      nodes.forEach((n) => n.classList.add('system'));
      setStatus('Response stopped', '');
      return;
    }
    if (!reply) reply = 'I could not finish that reply. Try a shorter prompt.';
    writeBubbles(nodes, reply);
    state.messages.push({ role: 'assistant', content: reply });
    const turns = state.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    if (turns.length > 12) state.messages = turns.slice(-12);
  } catch (err) {
    if (controller.signal.aborted || (err && err.name === 'AbortError')) {
      writeBubbles(nodes, 'Response stopped.');
      nodes.forEach((n) => n.classList.add('system'));
      setStatus('Response stopped', '');
      return;
    }
    const online = currentOnlineProvider();
    /* An online provider already explains itself; only the device path needs
       translating from a WebGPU or download failure into something readable. */
    writeBubbles(nodes, online ? ((err && err.message) || 'That did not go through.') : friendlyError(err));
    nodes.forEach((n) => n.classList.add('system'));
    paintProviderUi();
    setStatus(online ? 'Not sent · see the reply' : 'Could not load the on-device model', 'error');
  } finally {
    if (state.abortController === controller) state.abortController = null;
    state.busy = false;
    syncBusyUi();
  }
}
function clearChat() {
  if (state.abortController) state.abortController.abort();
  state.messages = [];
  $$('[data-coach-log]').forEach((log) => { log.innerHTML = ''; log.appendChild(bubble('system', 'Thread cleared. Try: how many tasks, list tasks, open plan, start focus, add task read chapter.')); });
  paintProviderUi();
  syncBusyUi();
}
function replyLocal(text, answer) {
  const question = String(text || '').trim();
  const reply = String(answer || '').trim();
  if (!question || !reply || state.busy) return false;
  appendMsg('user', question);
  appendMsg('assistant', reply);
  state.messages.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
  if (state.messages.length > 12) state.messages = state.messages.slice(-12);
  return true;
}
/* ---------------------------------------------------------------------------
   Picker, connect row, and auto-load.
   --------------------------------------------------------------------------- */

/** One grouped select: the three on-device sizes, then the three online coaches. */
function paintPicker(select) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const phone = isPhone(), gpu = deviceCapable();
  const device = MODEL_OPTIONS.map((m) => {
    const tooBig = phone && !m.phone;
    const note = tooBig ? ' — needs a laptop' : (cachedModels().includes(m.id) ? ' — ready' : ' — ' + m.mb + ' MB');
    return `<option value="${esc(m.id)}"${tooBig || !gpu ? ' disabled' : ''}>${esc(m.label + note)}</option>`;
  }).join('');
  const online = Object.keys(PROVIDERS).filter((id) => PROVIDERS[id].online).map((id) => {
    const ready = isValidKey(id, apiKeyFor(id));
    return `<option value="online:${esc(id)}">${esc(PROVIDERS[id].label + (ready ? ' — key saved' : ' — add a key'))}</option>`;
  }).join('');
  select.innerHTML =
    `<optgroup label="On this device${gpu ? '' : ' (unavailable here)'}">${device}</optgroup>` +
    `<optgroup label="Online — your own API key">${online}</optgroup>`;
  select.value = state.provider === 'device' ? state.modelId : 'online:' + state.provider;
}

/** Show the Load button and progress bar only when there is something to load. */
function paintProviderUi() {
  const online = currentOnlineProvider();
  $$('[data-coach-model]').forEach((s) => paintPicker(s));
  $$('[data-coach-load]').forEach((b) => { b.hidden = !!online || !deviceCapable(); });
  $$('.coach-progress').forEach((el) => { el.hidden = !!online; });
  /* Say where the words actually go. "Nothing leaves the browser" is true of
     the on-device coach and false of every online one. */
  $$('[data-coach-privacy]').forEach((el) => {
    el.textContent = online
      ? `Your message and recent thread go to ${PROVIDERS[online].label}, with a short workspace summary: counts, up to 12 open task names, today’s focus minutes, streak, and current intention. Mood entries and note contents stay out. Your API key is sent for provider authentication, never in the prompt or an export.`
      : 'Runs on your own device. Nothing you type here leaves the browser.';
  });
  paintConnectRow();
  if (online) {
    const ready = isValidKey(online, apiKeyFor(online));
    setStatus(ready ? 'Key saved · ' + PROVIDERS[online].label : 'Add your ' + PROVIDERS[online].label + ' API key', ready ? 'ready' : '');
  } else if (!deviceCapable()) {
    setStatus('No WebGPU here — pick an online coach', '');
  } else if (state.engine) {
    setStatus('Ready · on this device', 'ready');
  }
}

/** The key field for the selected online coach. Absent for the device coach. */
function paintConnectRow() {
  const online = currentOnlineProvider();
  $$('[data-coach-connect]').forEach((row) => {
    if (!online) { row.hidden = true; row.innerHTML = ''; return; }
    const p = PROVIDERS[online];
    const connected = isValidKey(online, apiKeyFor(online));
    row.hidden = false;
    if (connected) {
      const model = onlineModelFor(online);
      row.innerHTML = `
        <div class="coach-connected">
          <span class="coach-badge">Key saved for ${p.label}</span>
          <label class="sr-only" for="coachOnlineModel">Model</label>
          <select id="coachOnlineModel" data-coach-online-model></select>
          <button type="button" class="btn sm ghost" data-coach-forget>Disconnect</button>
        </div>`;
      const sel = row.querySelector('[data-coach-online-model]');
      const fill = (rows) => {
        const preferred = online === 'openai' ? preferChatModels(rows) : rows;
        const list = preferred.length ? preferred : (p.models.length ? p.models : [{ id: model, label: model }]);
        sel.innerHTML = list.map((m) => `<option value="${m.id}">${m.label || m.id}</option>`).join('');
        if (list.some((m) => m.id === model)) sel.value = model;
        else if (list[0]) { setOnlineModel(online, list[0].id); sel.value = list[0].id; }
      };
      fill(p.models);
      if (p.modelsUrl) {
        listModels({ provider: online, apiKey: apiKeyFor(online) })
          .then((rows) => { if (rows.length) fill(rows); })
          .catch(() => {});
      }
      sel.onchange = () => setOnlineModel(online, sel.value);
      row.querySelector('[data-coach-forget]').onclick = () => {
        setApiKey(online, '');
        paintProviderUi();
      };
    } else {
      row.innerHTML = `
        <p class="coach-connect-lead">${online === 'openai'
          ? 'Paste an OpenAI API key. A ChatGPT Plus plan cannot be linked on this site. The key stays in this browser and is sent only to OpenAI.'
          : 'Paste your ' + p.label + ' API key. It stays in this browser and is sent only to ' + p.label + '.'}</p>
        <div class="coach-connect-row">
          <label class="sr-only" for="coachKey">${p.label} API key</label>
          <input type="password" id="coachKey" data-coach-key autocomplete="off" spellcheck="false" placeholder="${p.keyPrefix}…">
          <button type="button" class="btn sm primary" data-coach-save-key>Save key</button>
        </div>
        <p class="coach-connect-note">Anyone who can use this browser can read the key, so use one you can revoke — <a href="${p.keyUrl}" target="_blank" rel="noopener noreferrer">create a key</a>. Your key is never put in an export file or synced to your account.</p>
        <p class="coach-connect-msg" data-coach-key-msg role="status"></p>`;
      const input = row.querySelector('[data-coach-key]');
      const msg = row.querySelector('[data-coach-key-msg]');
      row.querySelector('[data-coach-save-key]').onclick = () => {
        const value = (input.value || '').trim();
        if (!isValidKey(online, value)) {
          msg.textContent = `That does not look like a ${p.label} key — they start with ${p.keyPrefix}`;
          return;
        }
        setApiKey(online, value);
        if (!onlineModelFor(online) && p.defaultModel) setOnlineModel(online, p.defaultModel);
        paintProviderUi();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); row.querySelector('[data-coach-save-key]').click(); } });
    }
  });
}

/** A model this browser has loaded before reopens silently; a fresh one asks. */
function autoLoadIfCached() {
  if (currentOnlineProvider() || state.engine || state.loading) return;
  if (!deviceCapable()) return;
  if (!cachedModels().includes(state.modelId)) return;
  ensureEngine().catch((err) => setStatus(friendlyError(err), ''));
}

function bindPanel(root) {
  const form = $('[data-coach-form]', root);
  const input = $('[data-coach-input]', root);
  const select = $('[data-coach-model]', root);
  const loadBtn = $('[data-coach-load]', root);
  const clearBtn = $('[data-coach-clear]', root);
  const stopBtn = $('[data-coach-stop]', root);
  if (select) {
    paintPicker(select);
    select.onchange = () => {
      const value = select.value;
      if (value.startsWith('online:')) {
        state.provider = value.slice(7);
      } else {
        state.provider = 'device';
        state.modelId = value;
        store.set(STORE_KEY, value);
        state.engine = null;
        setProgress(0);
      }
      store.set(PROVIDER_KEY, state.provider);
      paintProviderUi();
      autoLoadIfCached();
    };
  }
  if (loadBtn) { loadBtn.onclick = () => ensureEngine().catch((err) => setStatus(friendlyError(err), '')); }
  if (clearBtn) clearBtn.onclick = clearChat;
  if (stopBtn) stopBtn.onclick = () => { if (state.abortController) state.abortController.abort(); };
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
  dock.innerHTML = '<div class="coach-panel" id="coachPanel" hidden><div class="coach-head"><div class="coach-id"><div class="coach-avatar" aria-hidden="true">✦</div><div><h3>Study coach</h3><p class="sub">One next step, at your pace</p></div></div><div class="coach-head-actions"><button type="button" class="btn sm ghost" data-coach-clear>Clear thread</button><button type="button" class="btn icon ghost" data-coach-close aria-label="Close coach">\u2715</button></div></div><div class="coach-stage"><label class="sr-only" for="coachDockModel">Choose a coach</label><select id="coachDockModel" data-coach-model aria-label="Choose a coach"></select><button type="button" class="btn sm primary" data-coach-load hidden>Load on this device</button><button type="button" class="btn sm ghost" data-coach-stop hidden>Stop response</button><p class="coach-status" data-coach-status role="status" aria-live="polite">Ask to list, find, open, add, or start</p><div class="coach-progress" aria-hidden="true"><span data-coach-bar></span></div></div><div class="coach-connect" data-coach-connect hidden></div><div class="coach-log" data-coach-log role="log" aria-live="polite"><article class="coach-msg system"><div class="who">Note</div><div class="bubble">One next step is enough. Try a prompt or tell me what feels stuck.</div></article></div><div class="coach-chips" id="coachDockChips" role="group" aria-label="Suggested prompts"></div><form class="coach-composer" data-coach-form><label class="sr-only" for="coachDockInput">Message the coach</label><textarea id="coachDockInput" data-coach-input rows="2" placeholder="What would help you get started?"></textarea><div class="coach-compose-action"><span>Enter to send · Shift + Enter for a new line</span><button class="btn primary" type="submit" data-coach-send>Send</button></div></form></div><button type="button" class="coach-fab" id="coachFab" aria-expanded="false" aria-controls="coachPanel"><span class="mark" aria-hidden="true">✦</span>Coach<span class="pip" aria-hidden="true"></span></button>';
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
  const chips = view.querySelector('.coach-chips');
  if (chips && !chips.dataset.built) {
    chips.dataset.built = '1';
    STARTERS.forEach((starter) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.coachChip = starter.prompt;
      button.textContent = starter.label;
      chips.appendChild(button);
    });
  }
  bindPanel(view);
}
function watchRail() {
  document.addEventListener('click', () => setTimeout(() => {
    const el = document.getElementById('view-coach');
    document.body.classList.toggle('coach-view-on', !!(el && el.classList.contains('on')));
  }, 0));
}
function boot() {
  mountDock(); enhanceFullView(); watchRail(); wireVoice();
  paintProviderUi();
  autoLoadIfCached();
  window.StudyCoach = {
    snapshot: workspaceSnapshot,
    findTasks: findTasks,
    ask: send,
    replyLocal: replyLocal,
    busy: function () { return state.busy; },
    state: function () { return appState(); },
    chatgpt: {
      connected: function () { return isValidKey('openai', apiKeyFor('openai')); },
      connect: function (key) {
        const value = String(key || '').trim();
        if (!isValidKey('openai', value)) return false;
        setApiKey('openai', value);
        state.provider = 'openai';
        store.set(PROVIDER_KEY, 'openai');
        listModels({ provider: 'openai', apiKey: value }).then((rows) => {
          const chat = preferChatModels(rows);
          if (chat[0] && !onlineModelFor('openai')) setOnlineModel('openai', chat[0].id);
          paintProviderUi();
        }).catch(() => {});
        paintProviderUi();
        return true;
      },
      disconnect: function () {
        setApiKey('openai', '');
        if (state.provider === 'openai') {
          state.provider = deviceCapable() && !isPhone() ? 'device' : 'anthropic';
          store.set(PROVIDER_KEY, state.provider);
        }
        paintProviderUi();
      },
      model: function () { return onlineModelFor('openai'); },
      tail: function () {
        const k = apiKeyFor('openai');
        return k.length > 4 ? k.slice(-4) : '';
      },
      models: function () {
        return listModels({ provider: 'openai', apiKey: apiKeyFor('openai') }).then(preferChatModels);
      },
      setModel: function (id) {
        setOnlineModel('openai', id);
        state.provider = 'openai';
        store.set(PROVIDER_KEY, 'openai');
        paintProviderUi();
      },
      use: function () {
        state.provider = 'openai';
        store.set(PROVIDER_KEY, 'openai');
        paintProviderUi();
      }
    }
  };
}
document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
