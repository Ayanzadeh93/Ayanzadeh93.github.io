/**
 * ADHD Study Pack — focus and executive-function support.
 *
 * Designed around what actually derails an ADHD study session rather than
 * around a generic todo list:
 *
 *   - One task is visible at a time. A full backlog on screen is the thing
 *     that causes the freeze, so the rest stays collapsed until asked for.
 *   - Tasks break into steps, because "write the chapter" has no first move
 *     and "open the outline file" does.
 *   - Intrusive thoughts get parked in one keystroke instead of becoming a
 *     new tab, which is the usual way a session ends.
 *   - The timer is adjustable. A fixed 25 minutes is someone else's attention
 *     span; starting at whatever is survivable today is the point.
 *
 * Storage goes through one adapter (see `store`). A local profile uses
 * localStorage; signing in with Google or a phone code swaps in the Firestore
 * store from lib/cloud-store.js, keyed by the Firebase uid. No call site knows
 * which one is active.
 */

import { el, clear } from './lib/dom.js';
import { firebaseConfig, enablePhoneSignIn } from './firebase-config.js';

const STORAGE_PREFIX = 'adhd-study-pack';
const SESSION_KEY = `${STORAGE_PREFIX}:active-profile`;
const LAST_PROFILE_KEY = `${STORAGE_PREFIX}:last-profile`;

/** The pieces of a pack that get stored. Each is read and written on its own. */
const SLICES = ['tasks', 'parked', 'sessions', 'activeTaskId'];
/** A fresh empty pack. A factory, because the arrays get mutated in place. */
const emptyPack = () => ({ tasks: [], parked: [], sessions: [], activeTaskId: null });

/* ============================================================ storage */

/**
 * localStorage backend: one browser, named profiles, no account.
 * Every method is async so the Firestore backend can share its shape.
 */
const localStore = {
    backend: 'local',

    key(profile, name) {
        return `${STORAGE_PREFIX}:${profile}:${name}`;
    },

    async read(profile, name, fallback) {
        try {
            const raw = localStorage.getItem(this.key(profile, name));
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            // Private mode, blocked site data, or corrupt JSON. The app should
            // still open — the reader just starts from an empty pack.
            console.warn('Study pack: could not read stored data', error);
            return fallback;
        }
    },

    async write(profile, name, value) {
        try {
            localStorage.setItem(this.key(profile, name), JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Study pack: could not save', error);
            return false;
        }
    },

    async listProfiles() {
        try {
            const raw = localStorage.getItem(`${STORAGE_PREFIX}:profiles`);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            return [];
        }
    },

    async addProfile(name) {
        const profiles = await this.listProfiles();
        if (!profiles.includes(name)) {
            profiles.push(name);
            try {
                localStorage.setItem(`${STORAGE_PREFIX}:profiles`, JSON.stringify(profiles));
            } catch (error) {
                console.warn('Study pack: could not save profile list', error);
            }
        }
        return profiles;
    }
};

/** The backend in use. Switches to the Firestore store on Google or phone sign-in. */
let store = localStore;

/** Firebase wrapper from lib/cloud-store.js; null when not configured or not loaded. */
let cloud = null;

/** Live-sync listeners for the signed-in Google or phone account. */
let cloudUnsubscribers = [];

const usingCloud = () => cloud !== null && store === cloud.store;

/* ============================================================== state */

const state = {
    profile: null,
    tasks: [],
    parked: [],
    sessions: [],
    activeTaskId: null,
    timer: {
        minutes: 15,
        remaining: 15 * 60,
        running: false,
        intervalId: null,
        startedAt: null
    }
};

const dom = {};

/* ============================================================= helpers */

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const todayKey = () => new Date().toISOString().slice(0, 10);

function formatClock(totalSeconds) {
    const safe = Math.max(0, Math.round(totalSeconds));
    const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    const seconds = String(safe % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

let saveTimer = null;

/**
 * Write every slice to the active store. The profile, store and values are
 * captured synchronously, so a sign-out that lands mid-save cannot redirect
 * the tail of it into a different backend or profile.
 */
function savePack() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const profile = state.profile;
    const target = store;
    if (!profile) return Promise.resolve();
    return Promise.all(SLICES.map((name) => target.write(profile, name, state[name])));
}

/** Schedule a save. Debounced: typing a step is one keystroke at a time. */
function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePack, 250);
}

/** Save now if a save is waiting, e.g. before signing out or leaving the page. */
function flushSave() {
    return saveTimer === null ? Promise.resolve() : savePack();
}

function announce(message) {
    if (!dom.live) return;
    dom.live.textContent = '';
    requestAnimationFrame(() => { dom.live.textContent = message; });
}

/* =============================================================== auth */

/** Read every slice of a pack from `source` (defaults to the active store). */
async function readPack(profile, source = store) {
    const pack = emptyPack();
    for (const name of SLICES) pack[name] = await source.read(profile, name, pack[name]);
    return pack;
}

const isEmptyPack = (pack) => !pack.tasks.length && !pack.parked.length && !pack.sessions.length;

function showApp(label) {
    dom.auth.hidden = true;
    dom.app.hidden = false;
    dom.profileName.textContent = label;
    dom.profileBar.dataset.backend = store.backend;
    dom.profileBar.hidden = false;

    renderAll();
    dom.taskInput.focus();
}

/** Open a local, this-browser-only profile. */
async function signIn(name) {
    const profile = name.trim();
    if (!profile) return;

    store = localStore;
    state.profile = profile;
    await store.addProfile(profile);
    try {
        localStorage.setItem(SESSION_KEY, profile);
        localStorage.setItem(LAST_PROFILE_KEY, profile);
    } catch (error) { /* session just will not survive a reload */ }

    Object.assign(state, await readPack(profile));
    showApp(profile);
    announce(`Signed in as ${profile}`);
}

/** Open the pack stored in Firestore for a user signed in with Google or a phone code. */
async function enterCloud(user) {
    // The sign-in result and the auth listener can both deliver the same user.
    if (usingCloud() && state.profile === user.uid) return;

    store = cloud.store;
    state.profile = user.uid;
    // A Google or phone session is restored by Firebase itself, not by the local key.
    try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* fine */ }

    setCloudNote('Opening your synced pack…');
    let pack;
    try {
        pack = await readPack(user.uid);
    } catch (error) {
        console.warn('Study pack: could not load the synced pack', error);
        if (state.profile === user.uid) {
            store = localStore;
            state.profile = null;
        }
        await cloud.signOut().catch(() => {});
        setCloudNote('Signed in, but your synced pack could not be loaded. '
            + 'Check the connection and try again.', true);
        return;
    }
    // A local profile was opened while the cloud pack was loading; it wins.
    if (state.profile !== user.uid) {
        setCloudNote();
        return;
    }
    Object.assign(state, pack);

    await offerLocalImport();
    watchCloud(user.uid);
    setCloudNote(); // clear any error left from an earlier attempt

    // Phone accounts have no name or email, only the number.
    const label = user.displayName || user.email || user.phoneNumber || 'Synced account';
    showApp(label);
    announce(`Signed in as ${label}. Your pack syncs across devices.`);
}

/**
 * The first time a synced account opens with an empty pack, offer to copy in
 * the pack this browser already has, so switching to sync does not mean
 * starting over. The local copy is left where it is.
 */
async function offerLocalImport() {
    if (!isEmptyPack(state)) return;

    const profiles = await localStore.listProfiles();
    let last = null;
    try { last = localStorage.getItem(LAST_PROFILE_KEY); } catch (error) { /* none */ }
    const source = profiles.includes(last) ? last : profiles[profiles.length - 1];
    if (!source) return;

    const local = await readPack(source, localStore);
    if (isEmptyPack(local)) return;

    const ok = window.confirm(`Copy the pack saved in this browser as "${source}" into the `
        + 'account you just signed in with? It will stay in this browser too.');
    if (!ok) return;

    Object.assign(state, local);
    await savePack();
}

/** Apply changes made on another device or tab while this one is open. */
function watchCloud(uid) {
    const redraw = {
        tasks: () => { renderTasks(); renderNow(); },
        activeTaskId: () => { renderTasks(); renderNow(); },
        parked: () => renderParked(),
        sessions: () => renderStats()
    };

    cloudUnsubscribers = SLICES.map((name) => store.subscribe(uid, name, (value) => {
        // A local edit waiting to save wins; it is about to overwrite this anyway.
        if (saveTimer !== null || state.profile !== uid) return;
        state[name] = value;
        redraw[name]();
    }));
}

async function signOut() {
    stopTimer({ log: false });
    await flushSave();

    const wasCloud = usingCloud();
    cloudUnsubscribers.forEach((unsubscribe) => unsubscribe());
    cloudUnsubscribers = [];

    state.profile = null;
    Object.assign(state, emptyPack());
    store = localStore;
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (error) { /* nothing to clear */ }

    dom.app.hidden = true;
    dom.profileBar.hidden = true;
    dom.auth.hidden = false;
    dom.profileInput.value = '';
    dom.profileInput.focus();
    await renderProfileChoices();

    if (wasCloud) {
        await cloud.signOut().catch((error) => console.warn('Study pack: sign-out failed', error));
        showPhoneStep('number');
        announce('Signed out. Your synced pack stays in your account.');
    } else {
        announce('Signed out. Your pack stays on this device.');
    }
}

/* ============================================================== tasks */

function addTask(title) {
    const text = title.trim();
    if (!text) return;

    const task = { id: uid(), title: text, steps: [], done: false, created: Date.now() };
    state.tasks.unshift(task);
    if (!state.activeTaskId) state.activeTaskId = task.id;

    persist();
    renderTasks();
    renderNow();
    announce(`Added task: ${text}`);
}

function addStep(taskId, text) {
    const task = state.tasks.find((t) => t.id === taskId);
    const label = text.trim();
    if (!task || !label) return;

    task.steps.push({ id: uid(), label, done: false });
    persist();
    renderTasks();
    renderNow();
}

function toggleStep(taskId, stepId) {
    const task = state.tasks.find((t) => t.id === taskId);
    const step = task && task.steps.find((s) => s.id === stepId);
    if (!step) return;

    step.done = !step.done;
    // Finishing every step finishes the task; that closure is the reward.
    task.done = task.steps.length > 0 && task.steps.every((s) => s.done);

    persist();
    renderTasks();
    renderNow();
}

function toggleTask(taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.done = !task.done;
    if (task.done && state.activeTaskId === taskId) {
        const next = state.tasks.find((t) => !t.done);
        state.activeTaskId = next ? next.id : null;
    }

    persist();
    renderTasks();
    renderNow();
    announce(task.done ? `Completed: ${task.title}` : `Reopened: ${task.title}`);
}

function removeTask(taskId) {
    state.tasks = state.tasks.filter((t) => t.id !== taskId);
    if (state.activeTaskId === taskId) {
        const next = state.tasks.find((t) => !t.done);
        state.activeTaskId = next ? next.id : null;
    }
    persist();
    renderTasks();
    renderNow();
}

function setActiveTask(taskId) {
    state.activeTaskId = taskId;
    persist();
    renderTasks();
    renderNow();
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) announce(`Now working on: ${task.title}`);
}

/* ============================================================= parking */

function park(text) {
    const thought = text.trim();
    if (!thought) return;

    state.parked.unshift({ id: uid(), text: thought, at: Date.now() });
    persist();
    renderParked();
    announce('Parked. Back to the task.');
}

function unpark(id) {
    state.parked = state.parked.filter((p) => p.id !== id);
    persist();
    renderParked();
}

/** A parked thought that turned out to be real work becomes a task. */
function promoteParked(id) {
    const item = state.parked.find((p) => p.id === id);
    if (!item) return;
    addTask(item.text);
    unpark(id);
}

/* =============================================================== timer */

function setTimerMinutes(minutes) {
    const value = Math.min(90, Math.max(1, Math.round(minutes)));
    state.timer.minutes = value;
    if (!state.timer.running) state.timer.remaining = value * 60;
    renderTimer();
}

function startTimer() {
    if (state.timer.running) return;

    state.timer.running = true;
    state.timer.startedAt = Date.now();
    // Track against wall clock, not tick count: a background tab throttles
    // intervals, and a timer that silently runs slow is worse than none.
    const endAt = Date.now() + state.timer.remaining * 1000;

    state.timer.intervalId = setInterval(() => {
        state.timer.remaining = Math.max(0, (endAt - Date.now()) / 1000);
        renderTimer();
        if (state.timer.remaining <= 0) completeTimer();
    }, 250);

    renderTimer();
    announce(`Focus started: ${state.timer.minutes} minutes`);
}

function pauseTimer() {
    if (!state.timer.running) return;
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    state.timer.intervalId = null;
    renderTimer();
    announce('Paused');
}

function stopTimer({ log = true } = {}) {
    if (state.timer.intervalId) clearInterval(state.timer.intervalId);

    const elapsed = state.timer.minutes * 60 - state.timer.remaining;
    // Partial sessions still count. Erasing a 12-minute effort because it was
    // not 25 is exactly the discouragement this is meant to avoid.
    if (log && elapsed > 60) logSession(Math.round(elapsed / 60), false);

    state.timer.running = false;
    state.timer.intervalId = null;
    state.timer.remaining = state.timer.minutes * 60;
    renderTimer();
}

function completeTimer() {
    clearInterval(state.timer.intervalId);
    state.timer.running = false;
    state.timer.intervalId = null;
    state.timer.remaining = 0;

    logSession(state.timer.minutes, true);
    renderTimer();
    announce(`Focus block complete: ${state.timer.minutes} minutes. Take a break.`);

    dom.timerCard.classList.add('is-complete');
    setTimeout(() => dom.timerCard.classList.remove('is-complete'), 4000);
}

function logSession(minutes, completed) {
    state.sessions.push({
        id: uid(),
        minutes,
        completed,
        taskId: state.activeTaskId,
        date: todayKey(),
        at: Date.now()
    });
    persist();
    renderStats();
}

/* ============================================================ rendering */

function renderNow() {
    const task = state.tasks.find((t) => t.id === state.activeTaskId && !t.done);

    clear(dom.nowBody);

    if (!task) {
        dom.nowBody.append(
            el('p', { class: 'now-empty' },
                state.tasks.some((t) => !t.done)
                    ? 'Pick one task below to put here.'
                    : 'Nothing queued. Add one thing you want to get done.')
        );
        return;
    }

    const openStep = task.steps.find((s) => !s.done);

    dom.nowBody.append(
        el('p', { class: 'now-label' }, 'Right now'),
        el('h2', { class: 'now-title' }, task.title),
        openStep
            ? el('p', { class: 'now-step' },
                el('span', { class: 'now-step-tag' }, 'First move'),
                openStep.label)
            : el('p', { class: 'now-step now-step--none' },
                task.steps.length
                    ? 'All steps done — close it out.'
                    : 'No steps yet. Breaking it into one small move makes it easier to start.')
    );
}

function renderTimer() {
    dom.timerClock.textContent = formatClock(state.timer.remaining);
    dom.timerRange.value = String(state.timer.minutes);
    dom.timerRangeLabel.textContent = `${state.timer.minutes} min`;
    dom.timerRange.disabled = state.timer.running;

    dom.timerStart.hidden = state.timer.running;
    dom.timerPause.hidden = !state.timer.running;

    const total = state.timer.minutes * 60;
    const progress = total > 0 ? 1 - state.timer.remaining / total : 0;
    dom.timerCard.style.setProperty('--progress', String(Math.min(1, Math.max(0, progress))));
    dom.timerClock.setAttribute('aria-label', `${formatClock(state.timer.remaining)} remaining`);
}

function taskRow(task) {
    const isActive = task.id === state.activeTaskId;

    const checkbox = el('input', {
        type: 'checkbox',
        class: 'task-check',
        id: `check-${task.id}`,
        'aria-label': `Mark "${task.title}" as done`,
        onChange: () => toggleTask(task.id)
    });
    checkbox.checked = task.done;

    const steps = el('ul', { class: 'step-list' },
        task.steps.map((step) => {
            const box = el('input', {
                type: 'checkbox',
                id: `step-${step.id}`,
                'aria-label': `Step: ${step.label}`,
                onChange: () => toggleStep(task.id, step.id)
            });
            box.checked = step.done;
            return el('li', { class: step.done ? 'is-done' : null },
                box, el('label', { for: `step-${step.id}` }, step.label));
        })
    );

    const stepForm = el('form', {
        class: 'step-form',
        onSubmit: (event) => {
            event.preventDefault();
            const input = event.currentTarget.querySelector('input');
            addStep(task.id, input.value);
            input.value = '';
            input.focus();
        }
    },
        el('input', {
            type: 'text',
            placeholder: 'Break it down — one small step…',
            'aria-label': `Add a step to ${task.title}`,
            autocomplete: 'off'
        }),
        el('button', { type: 'submit', class: 'step-add' }, 'Add step')
    );

    const details = el('details', { class: 'task-details' },
        el('summary', {}, task.steps.length
            ? `${task.steps.filter((s) => s.done).length} of ${task.steps.length} steps`
            : 'Break into steps'),
        steps,
        stepForm
    );

    return el('li', {
        class: `task-row${task.done ? ' is-done' : ''}${isActive ? ' is-active' : ''}`
    },
        el('div', { class: 'task-head' },
            checkbox,
            el('label', { class: 'task-title', for: `check-${task.id}` }, task.title),
            !task.done && !isActive
                ? el('button', {
                    type: 'button',
                    class: 'task-focus',
                    onClick: () => setActiveTask(task.id)
                }, 'Focus this')
                : null,
            el('button', {
                type: 'button',
                class: 'task-remove',
                'aria-label': `Delete "${task.title}"`,
                onClick: () => removeTask(task.id)
            }, '×')
        ),
        details
    );
}

function renderTasks() {
    // The task in the Now card is pinned to the top of the list. Newly added
    // tasks go to the front of `state.tasks`, so without this the thing you
    // are supposedly doing slides down the list and the two views disagree.
    const open = state.tasks
        .filter((t) => !t.done)
        .sort((a, b) => (b.id === state.activeTaskId) - (a.id === state.activeTaskId));
    const done = state.tasks.filter((t) => t.done);

    clear(dom.taskList);

    if (!state.tasks.length) {
        dom.taskList.append(el('li', { class: 'empty-note' },
            'No tasks yet. Add the one you are avoiding.'));
    } else {
        open.forEach((task) => dom.taskList.append(taskRow(task)));
    }

    dom.doneCount.textContent = done.length ? `(${done.length})` : '';
    clear(dom.doneList);
    done.forEach((task) => dom.doneList.append(taskRow(task)));
    dom.doneWrap.hidden = done.length === 0;
}

function renderParked() {
    clear(dom.parkedList);

    if (!state.parked.length) {
        dom.parkedList.append(el('li', { class: 'empty-note' },
            'Anything pulling your attention goes here, not into a new tab.'));
        return;
    }

    state.parked.forEach((item) => {
        dom.parkedList.append(el('li', { class: 'parked-row' },
            el('span', { class: 'parked-text' }, item.text),
            el('button', {
                type: 'button',
                class: 'parked-promote',
                'aria-label': `Turn "${item.text}" into a task`,
                onClick: () => promoteParked(item.id)
            }, 'Make a task'),
            el('button', {
                type: 'button',
                class: 'parked-drop',
                'aria-label': `Discard "${item.text}"`,
                onClick: () => unpark(item.id)
            }, '×')
        ));
    });
}

function renderStats() {
    const today = todayKey();
    const todays = state.sessions.filter((s) => s.date === today);
    const minutes = todays.reduce((sum, s) => sum + s.minutes, 0);

    const days = [...new Set(state.sessions.map((s) => s.date))].sort().reverse();
    let streak = 0;
    const cursor = new Date();
    while (days.includes(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    dom.statBlocks.textContent = String(todays.length);
    dom.statMinutes.textContent = String(minutes);
    dom.statStreak.textContent = String(streak);
}

function renderAll() {
    renderNow();
    renderTimer();
    renderTasks();
    renderParked();
    renderStats();
}

/* ================================================================ init */

function cacheDom() {
    const ids = [
        'live', 'auth', 'app', 'profileBar', 'profileName', 'profileInput', 'profileForm',
        'profileList', 'signOut', 'nowBody', 'timerCard', 'timerClock', 'timerRange',
        'timerRangeLabel', 'timerStart', 'timerPause', 'timerReset', 'taskForm', 'taskInput',
        'taskList', 'doneWrap', 'doneList', 'doneCount', 'parkForm', 'parkInput', 'parkedList',
        'statBlocks', 'statMinutes', 'statStreak', 'googleSignIn', 'cloudNote',
        'phoneForm', 'phoneInput', 'phoneSend', 'otpForm', 'otpInput', 'otpVerify', 'otpBack',
        'otpTarget', 'recaptchaBox'
    ];
    ids.forEach((id) => { dom[id] = document.getElementById(id); });
}

function bind() {
    dom.profileForm.addEventListener('submit', (event) => {
        event.preventDefault();
        signIn(dom.profileInput.value);
    });

    dom.signOut.addEventListener('click', signOut);

    dom.taskForm.addEventListener('submit', (event) => {
        event.preventDefault();
        addTask(dom.taskInput.value);
        dom.taskInput.value = '';
    });

    dom.parkForm.addEventListener('submit', (event) => {
        event.preventDefault();
        park(dom.parkInput.value);
        dom.parkInput.value = '';
    });

    dom.timerRange.addEventListener('input', () => setTimerMinutes(Number(dom.timerRange.value)));
    dom.timerStart.addEventListener('click', startTimer);
    dom.timerPause.addEventListener('click', pauseTimer);
    dom.timerReset.addEventListener('click', () => stopTimer());

    // A thought arriving mid-sentence should not cost a trip to the mouse.
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'p' || !event.altKey || dom.app.hidden) return;
        event.preventDefault();
        dom.parkInput.focus();
    });

    // Saves are debounced, so an edit (or the session logged by stopping a
    // running timer) in the last 250ms would otherwise be lost on close.
    window.addEventListener('pagehide', () => {
        if (state.timer.running) stopTimer();
        flushSave();
    });
}

function defaultCloudNote() {
    return enablePhoneSignIn
        ? 'Signing in with Google or a texted code keeps your pack in this site\'s Firebase '
            + 'database, readable only by that account, so it follows you to any device. '
            + 'Google and phone sign-ins are separate accounts with separate packs. '
            + 'Local profiles stay in this browser only.'
        : 'Signing in with Google keeps your pack in this site\'s Firebase database, '
            + 'readable only by your account, so it follows you to any device. '
            + 'Local profiles stay in this browser only.';
}

function setCloudNote(message = defaultCloudNote(), isError = false) {
    dom.cloudNote.textContent = message;
    dom.cloudNote.classList.toggle('is-error', isError);
}

/** Pending phone sign-in: set once a code is texted, used to check it. */
let phoneConfirmation = null;

/** Switch phone sign-in between asking for the number and asking for the code. */
function showPhoneStep(step) {
    if (!enablePhoneSignIn || !cloud) return;
    dom.phoneForm.hidden = step !== 'number';
    dom.otpForm.hidden = step !== 'code';
    if (step === 'number') {
        phoneConfirmation = null;
        dom.otpInput.value = '';
    }
}

function bindPhoneSignIn(cloudModule) {
    const fail = (what, error) => {
        console.warn(`Study pack: ${what}`, error);
        setCloudNote(cloudModule.describeAuthError(error), true);
    };

    showPhoneStep('number');

    dom.phoneForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const number = cloudModule.normalizePhone(dom.phoneInput.value);
        if (!number) {
            setCloudNote(cloudModule.describeAuthError({ code: 'auth/invalid-phone-number' }), true);
            dom.phoneInput.focus();
            return;
        }

        dom.phoneSend.disabled = true;
        setCloudNote('Sending a code…');
        try {
            phoneConfirmation = await cloud.sendPhoneCode(number, dom.recaptchaBox);
            dom.otpTarget.textContent = number;
            showPhoneStep('code');
            setCloudNote('Code sent. A text can take a minute to arrive.');
            dom.otpInput.focus();
        } catch (error) {
            fail('could not send the phone code', error);
        } finally {
            dom.phoneSend.disabled = false;
        }
    });

    dom.otpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = dom.otpInput.value.replace(/\D/g, '');
        if (code.length !== 6 || !phoneConfirmation) {
            setCloudNote(cloudModule.describeAuthError({ code: 'auth/invalid-verification-code' }), true);
            return;
        }

        dom.otpVerify.disabled = true;
        try {
            const user = await phoneConfirmation.confirm(code);
            showPhoneStep('number');
            dom.phoneInput.value = '';
            await enterCloud(user);
        } catch (error) {
            fail('phone code was not accepted', error);
            dom.otpInput.select();
        } finally {
            dom.otpVerify.disabled = false;
        }
    });

    dom.otpBack.addEventListener('click', () => {
        showPhoneStep('number');
        setCloudNote();
        dom.phoneInput.focus();
    });
}

/**
 * Enable "Continue with Google" (and phone sign-in, if switched on) when
 * js/firebase-config.js is filled in. Without a config nothing third-party
 * loads and the button stays disabled.
 */
async function initCloud() {
    if (!firebaseConfig) return;

    let cloudModule;
    try {
        cloudModule = await import('./lib/cloud-store.js');
        cloud = await cloudModule.connectCloud(firebaseConfig);
    } catch (error) {
        console.warn('Study pack: could not load account sign-in', error);
        setCloudNote('Account sign-in could not load right now. Local profiles still work.', true);
        return;
    }

    dom.googleSignIn.disabled = false;
    setCloudNote();
    if (enablePhoneSignIn) bindPhoneSignIn(cloudModule);

    dom.googleSignIn.addEventListener('click', async () => {
        dom.googleSignIn.disabled = true;
        try {
            // First await in the handler, so pop-up blockers see a user click.
            const user = await cloud.signIn();
            await enterCloud(user);
        } catch (error) {
            if (!cloudModule.isUserCancel(error)) {
                console.warn('Study pack: Google sign-in failed', error);
                setCloudNote(cloudModule.describeAuthError(error), true);
            }
        } finally {
            dom.googleSignIn.disabled = false;
        }
    });

    // Restores a Google or phone session from an earlier visit. Ignored when a local
    // profile is already open, so the two never fight over the screen.
    cloud.onUserChange((user) => {
        if (user && !state.profile) enterCloud(user);
    });
}

async function renderProfileChoices() {
    const profiles = await store.listProfiles();
    clear(dom.profileList);
    if (!profiles.length) return;

    dom.profileList.append(el('p', { class: 'profile-list-label' }, 'Continue as'));
    profiles.forEach((name) => {
        dom.profileList.append(el('button', {
            type: 'button',
            class: 'profile-chip',
            onClick: () => signIn(name)
        }, name));
    });
}

async function init() {
    cacheDom();
    bind();
    setTimerMinutes(state.timer.minutes);
    await renderProfileChoices();

    let saved = null;
    try {
        saved = localStorage.getItem(SESSION_KEY);
    } catch (error) { /* start signed out */ }

    if (saved) await signIn(saved);
    else dom.profileInput.focus();

    // After the local restore, so a saved local session keeps priority.
    await initCloud();
}

init();
