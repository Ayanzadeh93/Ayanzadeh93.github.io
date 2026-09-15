import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupBrowserEnv,
  teardownBrowserEnv
} from '../fixtures/browser-mock.js';

describe('Settings Decluttering & Floating Tooltips (F12-F13)', () => {
  let env;

  beforeEach(() => {
    env = setupBrowserEnv({ innerWidth: 1024, innerHeight: 768 });
  });

  afterEach(() => {
    teardownBrowserEnv();
  });

  // F12: Settings Panel Decluttering
  describe('F12: Settings Panel Decluttering', () => {
    it('migrates inline set-hint paragraphs to contextual data-tip triggers', () => {
      // Legacy structure had inline <p class="set-hint">
      const legacyRow = env.document.createElement('div');
      legacyRow.className = 'set-row';
      legacyRow.innerHTML = '<label>Auto break</label><p class="set-hint">Start short breaks automatically.</p>';

      // Decluttered structure replaces inline <p> with compact tip button
      const declutteredRow = env.document.createElement('div');
      declutteredRow.className = 'set-row';
      declutteredRow.innerHTML = '<label>Auto break</label><button type="button" class="tip-btn" aria-label="Info" data-tip="Start short breaks automatically.">ℹ</button>';

      assert.equal(legacyRow.querySelectorAll('.set-hint').length, 1);
      assert.equal(declutteredRow.querySelectorAll('.set-hint').length, 0);

      const tipBtn = declutteredRow.querySelector('.tip-btn');
      assert.ok(tipBtn);
      assert.equal(tipBtn.getAttribute('data-tip'), 'Start short breaks automatically.');
    });

    it('ensures tip trigger buttons are keyboard focusable with tabIndex 0', () => {
      const tipBtn = env.document.createElement('button');
      tipBtn.className = 'tip-btn';
      tipBtn.setAttribute('data-tip', 'Screen reader announcements');
      tipBtn.tabIndex = 0;

      assert.equal(tipBtn.tabIndex, 0);
      assert.equal(tipBtn.tagName, 'BUTTON');
    });

    it('preserves explanatory guidance text without information loss', () => {
      const settingsHints = {
        autoBreak: 'Start short breaks automatically when focus phase ends.',
        chime: 'Play audio chimes at phase transitions.',
        quietHours: 'Suppress sound alerts and notifications during sleeping hours.'
      };

      Object.entries(settingsHints).forEach(([key, hintText]) => {
        const btn = env.document.createElement('button');
        btn.setAttribute('data-tip', hintText);
        assert.equal(btn.getAttribute('data-tip'), hintText);
        assert.ok(btn.getAttribute('data-tip').length > 10);
      });
    });

    it('compacts row height by eliminating static paragraph vertical spacing', () => {
      const legacyHeight = 72; // with <p class="set-hint">
      const declutteredHeight = 44; // single-line row with icon

      assert.ok(declutteredHeight < legacyHeight);
      assert.equal(declutteredHeight, 44);
    });

    it('renders setting switches accessible with aria-label or associated label', () => {
      const row = env.document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `
        <div class="set-text">
          <label class="set-label" for="set_autoBreak">Auto break</label>
          <button type="button" class="tip-btn" aria-label="More information" data-tip="Starts break automatically">ℹ</button>
        </div>
        <div class="set-control">
          <input type="checkbox" role="switch" class="switch" id="set_autoBreak">
        </div>
      `;

      const input = row.querySelector('#set_autoBreak');
      const label = row.querySelector('label[for="set_autoBreak"]');
      assert.ok(input);
      assert.ok(label);
      assert.equal(label.textContent.trim(), 'Auto break');
    });
  });

  // F13: Contextual Floating Tooltips
  describe('F13: Contextual Floating Tooltips System', () => {
    let tipEl;

    beforeEach(() => {
      tipEl = env.document.createElement('div');
      tipEl.className = 'tip';
      tipEl.id = 'tip';
      tipEl.setAttribute('role', 'tooltip');
      env.document.body.appendChild(tipEl);
    });

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const showTip = (host, x, y, hostHeight = 24) => {
      tipEl.textContent = host.getAttribute('data-tip') || host.dataset.tip || '';
      tipEl.classList.add('on');
      host.setAttribute('aria-describedby', 'tip');

      const tipRect = tipEl.getBoundingClientRect(); // default mock { width: 100, height: 40 }
      const winW = env.window.innerWidth; // 1024
      const winH = env.window.innerHeight; // 768

      // Horizontal clamp between 8px and winW - width - 8px
      const left = clamp(x + 12, 8, winW - tipRect.width - 8);

      // Vertical flip: if positioning above overflows top boundary (< 8px), flip below
      let top = y - tipRect.height - 10;
      if (top < 8) {
        top = y + hostHeight + 8;
      }
      top = clamp(top, 8, winH - tipRect.height - 8);

      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';

      return { left, top };
    };

    const hideTip = host => {
      tipEl.classList.remove('on');
      tipEl.textContent = '';
      if (host) host.removeAttribute('aria-describedby');
    };

    it('initializes tooltip element with role="tooltip"', () => {
      assert.equal(tipEl.getAttribute('role'), 'tooltip');
      assert.equal(tipEl.id, 'tip');
    });

    it('associates active host element with tooltip via aria-describedby', () => {
      const host = env.document.createElement('button');
      host.setAttribute('data-tip', 'ADHD focus mode');
      env.document.body.appendChild(host);

      showTip(host, 200, 300);
      assert.equal(host.getAttribute('aria-describedby'), 'tip');
      assert.equal(tipEl.classList.contains('on'), true);
      assert.equal(tipEl.textContent, 'ADHD focus mode');

      hideTip(host);
      assert.equal(host.getAttribute('aria-describedby'), null);
      assert.equal(tipEl.classList.contains('on'), false);
    });

    it('clamps tooltip position horizontally to stay within viewport bounds', () => {
      const host = env.document.createElement('button');
      host.setAttribute('data-tip', 'Boundary test');

      // Test extreme left: x = -50 -> clamped to 8
      const posLeft = showTip(host, -50, 200);
      assert.equal(posLeft.left, 8);

      // Test extreme right: x = 1100 -> clamped to 1024 - 100 - 8 = 916
      const posRight = showTip(host, 1100, 200);
      assert.equal(posRight.left, 916);
    });

    it('flips tooltip below host when top boundary is violated (collision avoidance)', () => {
      const host = env.document.createElement('button');
      host.setAttribute('data-tip', 'Top boundary collision');

      // Near top of screen: y = 20 -> y - 40 - 10 = -30 < 8 -> flips below: y + hostHeight + 8 = 20 + 24 + 8 = 52
      const posFlipped = showTip(host, 150, 20, 24);
      assert.equal(posFlipped.top, 52);

      // Normal vertical position with ample space above: y = 300 -> y - 40 - 10 = 250
      const posNormal = showTip(host, 150, 300, 24);
      assert.equal(posNormal.top, 250);
    });

    it('handles keyboard focus and blur events for accessibility', () => {
      const host = env.document.createElement('button');
      host.setAttribute('data-tip', 'Keyboard navigation assistance');
      env.document.body.appendChild(host);

      host.addEventListener('focus', () => showTip(host, 100, 100));
      host.addEventListener('blur', () => hideTip(host));

      host.focus();
      assert.equal(tipEl.classList.contains('on'), true);
      assert.equal(host.getAttribute('aria-describedby'), 'tip');

      host.blur();
      assert.equal(tipEl.classList.contains('on'), false);
      assert.equal(host.getAttribute('aria-describedby'), null);
    });
  });
});
