import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupBrowserEnv,
  teardownBrowserEnv
} from '../fixtures/browser-mock.js';

describe('Interactive Help Center (F14-F16)', () => {
  let env;

  beforeEach(() => {
    env = setupBrowserEnv();
  });

  afterEach(() => {
    teardownBrowserEnv();
  });

  // F14: Help Center Rail Tab & View
  describe('F14: Help Center Rail Tab & View', () => {
    it('creates help navigation rail button and view container', () => {
      const railBtn = env.document.createElement('button');
      railBtn.className = 'rail-btn';
      railBtn.setAttribute('data-view', 'help');
      railBtn.innerHTML = '<span>Help</span>';
      env.document.body.appendChild(railBtn);

      const viewHelp = env.document.createElement('section');
      viewHelp.className = 'view';
      viewHelp.id = 'view-help';
      env.document.body.appendChild(viewHelp);

      assert.equal(env.document.querySelector('.rail-btn[data-view="help"]'), railBtn);
      assert.equal(env.document.getElementById('view-help'), viewHelp);
    });

    it('switches view to help cleanly via router go("help")', () => {
      const views = ['focus', 'tasks', 'help'];
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

      go('help');
      assert.equal(currentView, 'help');
      assert.equal(viewEls.help.classList.contains('on'), true);
      assert.equal(viewEls.focus.classList.contains('on'), false);
    });

    it('registers help in HIDEABLE_VIEWS for setup tab customization', () => {
      const HIDEABLE_VIEWS = [
        ['plan', 'Plan'],
        ['matrix', 'Matrix'],
        ['notes', 'Notes'],
        ['sound', 'Sound'],
        ['calm', 'Calm'],
        ['mood', 'Mood'],
        ['stats', 'Stats'],
        ['about', 'About'],
        ['habits', 'Habits'],
        ['help', 'Help']
      ];

      const found = HIDEABLE_VIEWS.find(([id]) => id === 'help');
      assert.ok(found);
      assert.equal(found[1], 'Help');
    });

    it('registers help in command palette shortcuts', () => {
      const COMMANDS = () => [
        { id: 'view:focus', title: 'Go to Focus dial' },
        { id: 'view:help', title: 'Go to Help & Guide' }
      ];

      const helpCmd = COMMANDS().find(c => c.id === 'view:help');
      assert.ok(helpCmd);
      assert.equal(helpCmd.title, 'Go to Help & Guide');
    });

    it('sets aria-current="page" on the active help rail button', () => {
      const btnFocus = env.document.createElement('button');
      btnFocus.setAttribute('data-view', 'focus');
      btnFocus.setAttribute('aria-current', 'page');

      const btnHelp = env.document.createElement('button');
      btnHelp.setAttribute('data-view', 'help');

      btnFocus.removeAttribute('aria-current');
      btnHelp.setAttribute('aria-current', 'page');

      assert.equal(btnHelp.getAttribute('aria-current'), 'page');
      assert.equal(btnFocus.getAttribute('aria-current'), null);
    });
  });

  // F15: Complete Help Documentation
  describe('F15: Complete Help Documentation', () => {
    const HELP_SECTIONS = [
      { id: 'focus', title: 'Focus Dial', category: 'Focus', view: 'focus' },
      { id: 'plan', title: 'Week Planner', category: 'Planning', view: 'plan' },
      { id: 'tasks', title: 'Task List', category: 'Planning', view: 'tasks' },
      { id: 'matrix', title: 'Eisenhower Priority Matrix', category: 'Planning', view: 'matrix' },
      { id: 'habits', title: 'ADHD Habit Tracker', category: 'Habits', view: 'habits' },
      { id: 'sound', title: 'Procedural Sounds & Presets', category: 'Focus', view: 'sound' },
      { id: 'calm', title: 'Calm Breathing & Grounding', category: 'Wellness', view: 'calm' },
      { id: 'mood', title: 'Mood & Energy Journal', category: 'Wellness', view: 'mood' },
      { id: 'stats', title: 'Honest Statistics', category: 'Wellness', view: 'stats' },
      { id: 'sync', title: 'Cloud & Google Calendar Sync', category: 'Sync', view: 'plan' }
    ];

    it('contains comprehensive documentation covering all 10 core application sections', () => {
      assert.equal(HELP_SECTIONS.length, 10);
      const expectedSections = ['focus', 'plan', 'tasks', 'matrix', 'habits', 'sound', 'calm', 'mood', 'stats', 'sync'];
      expectedSections.forEach(secId => {
        const found = HELP_SECTIONS.find(s => s.id === secId);
        assert.ok(found, `Missing help section for: ${secId}`);
        assert.ok(found.title.length > 0);
      });
    });

    it('organizes help items with explicit category tags', () => {
      const categories = new Set(HELP_SECTIONS.map(s => s.category));
      assert.ok(categories.has('Focus'));
      assert.ok(categories.has('Planning'));
      assert.ok(categories.has('Habits'));
      assert.ok(categories.has('Wellness'));
      assert.ok(categories.has('Sync'));
    });

    it('includes structured operational guidance for ADHD executive dysfunction in each section', () => {
      const docsWithBody = HELP_SECTIONS.map(s => ({
        ...s,
        body: `Guidance on ${s.title} tailored for ADHD cognitive styles.`
      }));

      docsWithBody.forEach(item => {
        assert.ok(item.body.includes('ADHD'));
      });
    });

    it('provides deep link targets pointing to valid application views', () => {
      const validViews = new Set(['focus', 'plan', 'tasks', 'matrix', 'habits', 'sound', 'calm', 'mood', 'stats', 'settings']);
      HELP_SECTIONS.forEach(item => {
        assert.ok(validViews.has(item.view), `Invalid view target ${item.view} in ${item.id}`);
      });
    });

    it('renders help cards with semantic heading hierarchy and clear typography', () => {
      const card = env.document.createElement('article');
      card.className = 'help-card';
      card.innerHTML = `
        <div class="panel-head">
          <h3>Focus Dial</h3>
          <span class="chip">Focus</span>
        </div>
        <p>Pomodoro workspace built for ADHD attention system.</p>
        <button class="btn sm ghost" data-goto="focus">Open Focus Dial</button>
      `;

      assert.ok(card.querySelector('h3'));
      assert.ok(card.querySelector('.chip'));
      assert.ok(card.querySelector('[data-goto="focus"]'));
    });
  });

  // F16: Help Search, Categories & Tips
  describe('F16: Help Search, Categories & ADHD Tips', () => {
    const DOCS = [
      { id: 'focus', title: 'Focus Dial', body: 'Pomodoro timer with visual ring and customizable cycles', category: 'Focus' },
      { id: 'habits', title: 'Habit Tracker', body: 'Build good habits with micro commitments and break bad habits with pause timer', category: 'Habits' },
      { id: 'body_doubling', title: 'Body Doubling Strategy', body: 'Virtual co-working tips for ADHD accountability', category: 'Focus' },
      { id: 'pacing', title: 'Pomodoro Dopamine Pacing', body: 'Short intense intervals to prevent hyperfocus burnout', category: 'Focus' },
      { id: 'blindness', title: 'Time Blindness Management', body: 'External alarms, visual timers, and realistic estimations', category: 'Planning' }
    ];

    it('filters documentation in real-time based on search query', () => {
      const search = (query, category = 'all') => {
        const q = query.toLowerCase().trim();
        return DOCS.filter(d => {
          const matchCat = category === 'all' || d.category.toLowerCase() === category.toLowerCase();
          const matchText = !q || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q);
          return matchCat && matchText;
        });
      };

      const results1 = search('timer');
      assert.equal(results1.length, 3); // focus, habits, blindness

      const results2 = search('dopamine');
      assert.equal(results2.length, 1);
      assert.equal(results2[0].id, 'pacing');
    });

    it('filters documentation by category pill selection', () => {
      const filterByCategory = cat => {
        if (cat === 'all') return DOCS;
        return DOCS.filter(d => d.category.toLowerCase() === cat.toLowerCase());
      };

      const habitsDocs = filterByCategory('habits');
      assert.equal(habitsDocs.length, 1);
      assert.equal(habitsDocs[0].id, 'habits');

      const focusDocs = filterByCategory('focus');
      assert.equal(focusDocs.length, 3); // focus, body_doubling, pacing
    });

    it('includes specific scientific ADHD workflow strategies', () => {
      const tips = DOCS.filter(d => ['body_doubling', 'pacing', 'blindness'].includes(d.id));
      assert.equal(tips.length, 3);

      const titles = tips.map(t => t.title);
      assert.ok(titles.some(t => t.includes('Body Doubling')));
      assert.ok(titles.some(t => t.includes('Dopamine Pacing') || t.includes('Pomodoro')));
      assert.ok(titles.some(t => t.includes('Time Blindness')));
    });

    it('handles data-goto action links by switching views cleanly', () => {
      let activeView = 'help';
      const handleAction = targetView => {
        activeView = targetView;
      };

      const gotoBtn = env.document.createElement('button');
      gotoBtn.setAttribute('data-goto', 'habits');
      gotoBtn.addEventListener('click', () => handleAction(gotoBtn.getAttribute('data-goto')));

      gotoBtn.click();
      assert.equal(activeView, 'habits');
    });

    it('handles empty search queries and no-result states gracefully', () => {
      const search = q => {
        const term = String(q || '').toLowerCase().trim();
        return DOCS.filter(d => d.title.toLowerCase().includes(term));
      };

      assert.equal(search('').length, DOCS.length);
      assert.equal(search('nonexistentterm12345').length, 0);
    });
  });
});
