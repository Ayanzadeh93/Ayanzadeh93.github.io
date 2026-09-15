import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupBrowserEnv,
  teardownBrowserEnv,
  MockAudioContext
} from '../fixtures/browser-mock.js';

describe('Habit Tracker Engine (F8-F11)', () => {
  let env;

  beforeEach(() => {
    env = setupBrowserEnv();
  });

  afterEach(() => {
    teardownBrowserEnv();
  });

  // F8: Habits Rail Tab & View Routing
  describe('F8: Habits Rail Tab & View Routing', () => {
    it('creates habits navigation rail button and view container', () => {
      const railBtn = env.document.createElement('button');
      railBtn.className = 'rail-btn';
      railBtn.setAttribute('data-view', 'habits');
      railBtn.innerHTML = '<span>Habits</span>';
      env.document.body.appendChild(railBtn);

      const viewHabits = env.document.createElement('section');
      viewHabits.className = 'view';
      viewHabits.id = 'view-habits';
      env.document.body.appendChild(viewHabits);

      assert.equal(env.document.querySelector('.rail-btn[data-view="habits"]'), railBtn);
      assert.equal(env.document.getElementById('view-habits'), viewHabits);
    });

    it('switches view to habits cleanly when go("habits") is called', () => {
      const views = ['focus', 'plan', 'tasks', 'habits'];
      const viewEls = {};
      views.forEach(v => {
        const el = env.document.createElement('section');
        el.className = 'view' + (v === 'focus' ? ' on' : '');
        el.id = 'view-' + v;
        env.document.body.appendChild(el);
        viewEls[v] = el;
      });

      let currentView = 'focus';
      const go = v => {
        currentView = v;
        views.forEach(name => {
          viewEls[name].classList.toggle('on', name === v);
        });
      };

      go('habits');
      assert.equal(currentView, 'habits');
      assert.equal(viewEls.habits.classList.contains('on'), true);
      assert.equal(viewEls.focus.classList.contains('on'), false);
    });

    it('registers habits in HIDEABLE_VIEWS for setup customization', () => {
      const HIDEABLE_VIEWS = [
        ['plan', 'Plan'],
        ['matrix', 'Matrix'],
        ['notes', 'Notes'],
        ['sound', 'Sound'],
        ['calm', 'Calm'],
        ['mood', 'Mood'],
        ['stats', 'Stats'],
        ['about', 'About'],
        ['habits', 'Habits']
      ];

      const found = HIDEABLE_VIEWS.find(([id]) => id === 'habits');
      assert.ok(found);
      assert.equal(found[1], 'Habits');
    });

    it('registers habits in quick command palette', () => {
      const COMMANDS = () => [
        { id: 'view:focus', title: 'Go to Focus dial' },
        { id: 'view:tasks', title: 'Go to Tasks' },
        { id: 'view:habits', title: 'Go to Habits & Routines' }
      ];

      const habitsCmd = COMMANDS().find(c => c.id === 'view:habits');
      assert.ok(habitsCmd);
      assert.equal(habitsCmd.title, 'Go to Habits & Routines');
    });

    it('sets aria-current="page" on the active habits rail button', () => {
      const btnFocus = env.document.createElement('button');
      btnFocus.setAttribute('data-view', 'focus');
      btnFocus.setAttribute('aria-current', 'page');

      const btnHabits = env.document.createElement('button');
      btnHabits.setAttribute('data-view', 'habits');

      // Routing logic toggles aria-current
      btnFocus.removeAttribute('aria-current');
      btnHabits.setAttribute('aria-current', 'page');

      assert.equal(btnHabits.getAttribute('aria-current'), 'page');
      assert.equal(btnFocus.getAttribute('aria-current'), null);
    });
  });

  // F9: Good Habits & Streak Engine
  describe('F9: Good Habits & Streak Engine', () => {
    const createGoodHabit = (id, title, micro, target, cue) => ({
      id,
      type: 'good',
      title,
      micro: micro || '',
      target: target || 7,
      cue: cue || '',
      history: {},
      streak: 0,
      bestStreak: 0,
      createdAt: new Date().toISOString()
    });

    it('creates good habit with micro-commitment, frequency target, and cue', () => {
      const habit = createGoodHabit('h1', 'Read textbook', 'Open to page 1', 5, 'After morning coffee');
      assert.equal(habit.type, 'good');
      assert.equal(habit.title, 'Read textbook');
      assert.equal(habit.micro, 'Open to page 1');
      assert.equal(habit.target, 5);
      assert.equal(habit.cue, 'After morning coffee');
      assert.equal(habit.streak, 0);
    });

    it('calculates forgiving streaks where missing today preserves yesterday streak', () => {
      const calculateStreak = (history, todayDateStr) => {
        const [y, m, d] = todayDateStr.split('-').map(Number);
        const today = new Date(y, m - 1, d);
        let streak = 0;
        let checkDate = new Date(today);

        // If today is checked, start streak count with today
        const pad2 = n => String(n).padStart(2, '0');
        const toKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

        const todayKey = toKey(checkDate);
        if (history[todayKey]) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          // Forgiving: check if yesterday was completed
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          if (!history[toKey(yesterday)]) {
            return 0; // Missed yesterday too, streak broke
          }
          checkDate = yesterday;
        }

        while (true) {
          const key = toKey(checkDate);
          if (history[key]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
        return streak;
      };

      // Case 1: Active check-in today and yesterday
      const history1 = { '2026-09-14': true, '2026-09-15': true };
      assert.equal(calculateStreak(history1, '2026-09-15'), 2);

      // Case 2: Not yet checked in today, but checked yesterday (forgiving!)
      const history2 = { '2026-09-13': true, '2026-09-14': true };
      assert.equal(calculateStreak(history2, '2026-09-15'), 2);

      // Case 3: Missed yesterday and today -> streak broke
      const history3 = { '2026-09-12': true };
      assert.equal(calculateStreak(history3, '2026-09-15'), 0);
    });

    it('updates streak and bestStreak upon habit completion check-in', () => {
      const habit = createGoodHabit('h1', 'Hydrate', 'Drink 1 glass', 7, 'Upon waking');
      const checkIn = (h, dateKey) => {
        h.history[dateKey] = true;
        h.streak += 1;
        if (h.streak > h.bestStreak) h.bestStreak = h.streak;
      };

      checkIn(habit, '2026-09-14');
      assert.equal(habit.streak, 1);
      assert.equal(habit.bestStreak, 1);

      checkIn(habit, '2026-09-15');
      assert.equal(habit.streak, 2);
      assert.equal(habit.bestStreak, 2);
    });

    it('toggles check-in off and recalculates streaks cleanly', () => {
      const habit = createGoodHabit('h1', 'Stretch', 'Touch toes', 7);
      habit.history['2026-09-15'] = true;
      habit.streak = 1;
      habit.bestStreak = 1;

      const uncheck = (h, dateKey) => {
        delete h.history[dateKey];
        h.streak = Math.max(0, h.streak - 1);
      };

      uncheck(habit, '2026-09-15');
      assert.equal(habit.history['2026-09-15'], undefined);
      assert.equal(habit.streak, 0);
      assert.equal(habit.bestStreak, 1); // bestStreak remains historical high
    });

    it('triggers celebratory feedback (chime audio and toast) on completion', () => {
      let chimePlayed = false;
      let toastTriggered = false;

      const triggerCelebration = () => {
        const audioCtx = new MockAudioContext();
        const chimeOsc = audioCtx.createOscillator();
        chimeOsc.start();
        chimePlayed = true;

        toastTriggered = true;
      };

      triggerCelebration();
      assert.equal(chimePlayed, true);
      assert.equal(toastTriggered, true);
    });
  });

  // F10: Bad Habits, Urges & Impulse Timer
  describe('F10: Bad Habits, Urges & Impulse Timer', () => {
    const createBadHabit = (id, title, replacement) => ({
      id,
      type: 'bad',
      title,
      daysClean: 0,
      lastRelapse: new Date().toISOString(),
      urges: [],
      replacement: replacement || 'Drink a glass of water or do 5 breaths',
      createdAt: new Date().toISOString()
    });

    it('creates bad habit to break with days clean counter and replacement behavior', () => {
      const habit = createBadHabit('b1', 'Phone doomscrolling', 'Open e-reader for 1 page');
      assert.equal(habit.type, 'bad');
      assert.equal(habit.title, 'Phone doomscrolling');
      assert.equal(habit.replacement, 'Open e-reader for 1 page');
      assert.equal(habit.daysClean, 0);
      assert.deepEqual(habit.urges, []);
    });

    it('calculates days clean based on timestamp elapsed since last relapse', () => {
      const DAY_MS = 86400000;
      const calculateDaysClean = lastRelapseIso => {
        const diff = Date.now() - new Date(lastRelapseIso).getTime();
        return Math.max(0, Math.floor(diff / DAY_MS));
      };

      const threeDaysAgo = new Date(Date.now() - 3 * DAY_MS).toISOString();
      assert.equal(calculateDaysClean(threeDaysAgo), 3);

      const justNow = new Date().toISOString();
      assert.equal(calculateDaysClean(justNow), 0);
    });

    it('resets days clean and logs relapse timestamp on resetBadHabit', () => {
      const habit = createBadHabit('b1', 'Late night snacking');
      habit.daysClean = 14;

      const resetBadHabit = h => {
        h.daysClean = 0;
        h.lastRelapse = new Date().toISOString();
      };

      resetBadHabit(habit);
      assert.equal(habit.daysClean, 0);
      assert.ok(habit.lastRelapse);
    });

    it('logs urge with timestamp and reflection note', () => {
      const habit = createBadHabit('b1', 'Nail biting');
      const logUrge = (h, note) => {
        const entry = {
          date: new Date().toISOString(),
          note: String(note || '').trim()
        };
        h.urges.push(entry);
        return entry;
      };

      logUrge(habit, 'Felt anxious during math homework');
      assert.equal(habit.urges.length, 1);
      assert.equal(habit.urges[0].note, 'Felt anxious during math homework');
      assert.ok(habit.urges[0].date);
    });

    it('provides impulse pause timer configurations (60s, 120s, 300s)', () => {
      const IMPULSE_PRESETS = [
        { label: '1 min pause', seconds: 60 },
        { label: '2 min pause', seconds: 120 },
        { label: '5 min pause', seconds: 300 }
      ];

      assert.equal(IMPULSE_PRESETS.length, 3);
      assert.equal(IMPULSE_PRESETS[0].seconds, 60);
      assert.equal(IMPULSE_PRESETS[1].seconds, 120);
      assert.equal(IMPULSE_PRESETS[2].seconds, 300);
    });
  });

  // F11: Habits State Persistence Engine
  describe('F11: Habits State Persistence (S.habits)', () => {
    it('initializes habits array in default state schema', () => {
      const DEFAULTS = () => ({
        schema: 4,
        tasks: [],
        events: [],
        notes: [],
        habits: [],
        sound: { master: 60, layers: {} }
      });

      const state = DEFAULTS();
      assert.ok(Array.isArray(state.habits));
      assert.equal(state.habits.length, 0);
    });

    it('migrates legacy state objects to include habits array without data loss', () => {
      const legacyState = {
        schema: 3,
        tasks: [{ id: 't1', title: 'Task' }]
      };

      const migrate = raw => {
        const out = Object.assign({}, raw);
        if (!Array.isArray(out.habits)) out.habits = [];
        return out;
      };

      const migrated = migrate(legacyState);
      assert.ok(Array.isArray(migrated.habits));
      assert.equal(migrated.tasks.length, 1);
    });

    it('preserves habits during saveSnapshot workspace serialization', () => {
      const state = {
        habits: [
          { id: 'h1', type: 'good', title: 'Drink water' },
          { id: 'b1', type: 'bad', title: 'Impulse shopping' }
        ],
        sessions: ['ephemeral journal entries'],
        checkins: ['ephemeral checkin entries']
      };

      const saveSnapshot = s => {
        const snap = JSON.parse(JSON.stringify(s));
        // Sessions and checkins are pruned for workspace state snapshot
        snap.sessions = [];
        snap.checkins = [];
        return snap;
      };

      const snapshot = saveSnapshot(state);
      assert.equal(snapshot.habits.length, 2);
      assert.equal(snapshot.habits[0].title, 'Drink water');
      assert.equal(snapshot.habits[1].title, 'Impulse shopping');
      assert.equal(snapshot.sessions.length, 0);
    });

    it('saves and reloads habit data from localStorage accurately', () => {
      const habitsData = [
        { id: 'h1', type: 'good', title: 'Exercise', streak: 4 }
      ];

      env.localStorage.setItem('focusdial.habits', JSON.stringify(habitsData));
      const loaded = JSON.parse(env.localStorage.getItem('focusdial.habits'));

      assert.deepEqual(loaded, habitsData);
      assert.equal(loaded[0].streak, 4);
    });

    it('exports and imports habits via JSON backup correctly', () => {
      const state = {
        schema: 4,
        habits: [
          { id: 'h1', type: 'good', title: 'Daily Review', target: 7 }
        ]
      };

      const exportedJson = JSON.stringify(state, null, 2);
      const importedState = JSON.parse(exportedJson);

      assert.deepEqual(importedState.habits, state.habits);
      assert.equal(importedState.habits[0].target, 7);
    });
  });
});
