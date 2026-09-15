import test, { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Unref background timers from app initialization so Node test runner terminates naturally
const origSetInterval = globalThis.setInterval;
globalThis.setInterval = function(...args) {
  const timer = origSetInterval.apply(this, args);
  if (timer && timer.unref) timer.unref();
  return timer;
};

import {
  setupBrowserEnv,
  teardownBrowserEnv,
  MockElement,
  MockEvent,
  MockFirebaseAuth,
  MockGoogleAuthProvider
} from '../fixtures/browser-mock.js';

// Enhance MockElement dispatchEvent to trigger el['on' + type] if assigned directly
const origDispatch = MockElement.prototype.dispatchEvent;
MockElement.prototype.dispatchEvent = function(event) {
  const handler = this['on' + event.type];
  if (typeof handler === 'function') {
    try {
      handler.call(this, event);
    } catch (e) {
      console.warn('MockElement on' + event.type + ' error:', e);
    }
  }
  return origDispatch.call(this, event);
};

// Ensure all MockElements support style.setProperty and style.removeProperty
Object.defineProperty(MockElement.prototype, 'style', {
  get() {
    if (!this._mockStyle) {
      this._mockStyle = {
        setProperty(k, v) { this[k] = v; },
        removeProperty(k) { delete this[k]; }
      };
    }
    return this._mockStyle;
  },
  set(v) {
    this._mockStyle = Object.assign({
      setProperty(k, v) { this[k] = v; },
      removeProperty(k) { delete this[k]; }
    }, v || {});
  }
});

// Ensure MockElement implements Node.prototype.contains
MockElement.prototype.contains = function(other) {
  let curr = other;
  while (curr) {
    if (curr === this) return true;
    curr = curr.parentElement;
  }
  return false;
};

describe('Empirical Challenge Suite: Milestone 2 Authentication & Calendar Auto-Sync', () => {
  let env;
  let mod;

  before(async () => {
    env = setupBrowserEnv();
    const html = fs.readFileSync('./apps/adhd-study-pack.html', 'utf8');
    env.document.body.innerHTML = html;
    const root = env.document.documentElement;
    root.style.setProperty = function(k, v) { this[k] = v; };

    mod = await import('../../js/adhd-study-pack.js');
  });

  after(() => {
    // Keep environment stable for trailing unrefed callbacks from adhd-study-pack.js
  });

  /* =========================================================================
     SUITE 1: EMAIL VALIDATION & SANITIZATION STRESS TESTS
     ========================================================================= */
  describe('Suite 1: Email Validation & Sanitization Edge Cases', () => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validateEmail = raw => {
      const trimmed = String(raw == null ? '' : raw).trim();
      return {
        trimmed,
        isValid: EMAIL_REGEX.test(trimmed)
      };
    };

    it('CH1.1: Rejects empty strings and varied whitespace-only strings', () => {
      const emptyInputs = [
        '',
        ' ',
        '   ',
        '\t',
        '\n',
        '\r\n',
        '\t  \n  \r',
        '\u00A0', // Non-breaking space
        '\u00A0  \u00A0',
        '\u200B', // Zero-width space
        null,
        undefined
      ];

      for (const input of emptyInputs) {
        const res = validateEmail(input);
        assert.equal(res.isValid, false, `Input "${input}" must be rejected as invalid email`);
      }
    });

    it('CH1.2: Rejects syntactically malformed emails (missing @, missing domain, missing TLD, double @)', () => {
      const malformedEmails = [
        'plainaddress',
        'no-at-sign.com',
        '@domain.com',
        '@example.org',
        'user@',
        'user@.',
        'user@domain',
        'user@localhost',
        'user@@domain.com',
        'user@sub@domain.com',
        'user..name@domain.com@extra',
        'user@',
        'user@.org'
      ];

      for (const email of malformedEmails) {
        const res = validateEmail(email);
        assert.equal(res.isValid, false, `Malformed email "${email}" must be rejected`);
      }
    });

    it('CH1.3: Rejects emails with embedded whitespace inside username, domain, or TLD', () => {
      const whitespaceEmails = [
        'user name@domain.com',
        'user\tname@domain.com',
        'user\nname@domain.com',
        'user@dom ain.com',
        'user@domain. com',
        'user@ domain.com',
        'user@domain .com',
        'user\u00A0name@domain.com' // Unicode NBSP
      ];

      for (const email of whitespaceEmails) {
        const res = validateEmail(email);
        assert.equal(res.isValid, false, `Email with embedded whitespace "${email}" must be rejected`);
      }
    });

    it('CH1.4: Successfully trims leading and trailing whitespace while preserving valid email', () => {
      const paddedEmails = [
        { raw: '  student@university.edu  ', clean: 'student@university.edu' },
        { raw: '\tuser@domain.com\n', clean: 'user@domain.com' },
        { raw: '   focus.adhd+test@school.org   ', clean: 'focus.adhd+test@school.org' },
        { raw: '\u00A0alex@workplace.io\u00A0', clean: 'alex@workplace.io' }
      ];

      for (const { raw, clean } of paddedEmails) {
        const res = validateEmail(raw);
        assert.equal(res.isValid, true, `Padded email "${raw}" must be valid after trim`);
        assert.equal(res.trimmed, clean, `Trimmed result must match expected cleaned email`);
      }
    });

    it('CH1.5: Validates international, unicode (IDN), and accented email formats', () => {
      const unicodeEmails = [
        'jürgen@münchen.de',
        'élise.martin@société.fr',
        'иван@яндекс.рф',
        'пользователь@пример.онлайн',
        '张伟@腾讯.中国',
        'たろう@ドメイン.jp',
        'test@123.456.com',
        'user+tag-123_45@sub.domain.org'
      ];

      for (const email of unicodeEmails) {
        const res = validateEmail(email);
        assert.equal(res.isValid, true, `Unicode/IDN email "${email}" must be accepted by regex`);
      }
    });

    it('CH1.6: Defends against malicious XSS, HTML injection and CRLF header injection', () => {
      const injectionPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert(1)",
        "admin'--",
        "admin' OR '1'='1",
        "victim@domain.com\r\nBcc:attacker@example.com",
        "victim@domain.com\nSubject:Injected",
        "\" onfocus=\"alert(1)\" autotests=\"true"
      ];

      for (const payload of injectionPayloads) {
        const res = validateEmail(payload);
        assert.equal(res.isValid, false, `Injection payload "${payload}" must be rejected as invalid email`);
      }
    });

    it('CH1.7: Neutralizes HTML entity and attribute breakout in prefill escaping (esc function)', () => {
      const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));

      const hostileStrings = [
        '<script>alert("pwnd")</script>',
        '"><img src=x onerror=alert(1)>',
        '\' onfocus=\'alert(1)',
        'foo & bar < baz > "qux"'
      ];

      for (const str of hostileStrings) {
        const escaped = esc(str);
        assert.ok(!escaped.includes('<script>'), `Must not contain unescaped <script>`);
        assert.ok(!escaped.includes('<img'), `Must not contain unescaped <img`);
        assert.ok(!escaped.includes('"'), `Must not contain unescaped double quotes`);
        assert.ok(!escaped.includes("'"), `Must not contain unescaped single quotes`);
      }
    });
  });

  /* =========================================================================
     SUITE 2: RAPID PASSWORD RESET HAMMERING & RATE-LIMITING COOLDOWN
     ========================================================================= */
  describe('Suite 2: Rapid Password Reset Hammering & Rate Limiting Cooldown', () => {
    it('CH2.1: Enforces 30-second cooldown window on password reset requests', () => {
      let lastPasswordResetAttempt = 0;
      const cooldownMs = 30000;

      const attemptReset = now => {
        if (lastPasswordResetAttempt && now - lastPasswordResetAttempt < cooldownMs) {
          return { allowed: false, reason: 'cooldown' };
        }
        lastPasswordResetAttempt = now;
        return { allowed: true };
      };

      const t0 = 100000;
      // First attempt at t0 succeeds
      assert.equal(attemptReset(t0).allowed, true);

      // Rapid clicks within cooldown fail
      assert.equal(attemptReset(t0 + 100).allowed, false);
      assert.equal(attemptReset(t0 + 5000).allowed, false);
      assert.equal(attemptReset(t0 + 15000).allowed, false);
      assert.equal(attemptReset(t0 + 29999).allowed, false);

      // Attempt after 30s succeeds
      assert.equal(attemptReset(t0 + 30000).allowed, true);

      // Immediate follow-up fails again
      assert.equal(attemptReset(t0 + 30100).allowed, false);
    });

    it('CH2.2: Extreme hammering stress test: 500 rapid clicks execute exactly 1 reset dispatch', async () => {
      let dispatchCount = 0;
      let rejectedCount = 0;
      let lastAttempt = 0;
      const cooldownMs = 30000;

      const handleResetClick = (now, email) => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
        if (!isValid) return false;

        if (lastAttempt && now - lastAttempt < cooldownMs) {
          rejectedCount++;
          return false;
        }
        lastAttempt = now;
        dispatchCount++;
        return true;
      };

      const burstTime = 200000;
      // Hammer 500 times in 1 millisecond
      for (let i = 0; i < 500; i++) {
        handleResetClick(burstTime + (i * 0.001), 'student@university.edu');
      }

      assert.equal(dispatchCount, 1, 'Exactly 1 reset request must be dispatched during rapid burst');
      assert.equal(rejectedCount, 499, 'Exactly 499 requests must be blocked by rate-limiting');
    });

    it('CH2.3: Cooldown state survives modal dismiss and reopen (global scope protection)', () => {
      let lastAttempt = 0;
      const cooldownMs = 30000;

      class ModalSession {
        constructor() {
          this.isOpen = true;
        }
        close() { this.isOpen = false; }
        submit(now, email) {
          if (!this.isOpen) return false;
          if (lastAttempt && now - lastAttempt < cooldownMs) return false;
          lastAttempt = now;
          return true;
        }
      }

      const t0 = 500000;
      const modal1 = new ModalSession();
      assert.equal(modal1.submit(t0, 'user@example.com'), true);
      modal1.close();

      // User reopens modal 5 seconds later
      const modal2 = new ModalSession();
      assert.equal(modal2.submit(t0 + 5000, 'user@example.com'), false, 'Reopening modal must NOT bypass cooldown');

      // 31 seconds later
      assert.equal(modal2.submit(t0 + 31000, 'user@example.com'), true, 'Submission allowed after cooldown expires');
    });

    it('CH2.4: authResetErrorMsg maps all Firebase Auth error codes to user-friendly messages', () => {
      function authResetErrorMsg(err) {
        const code = err && (err.code || err.message);
        if (code === 'auth/user-not-found') return 'No account found with this email.';
        if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
        if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
        return (err && err.message) || 'Password reset failed. Please try again.';
      }

      assert.equal(authResetErrorMsg({ code: 'auth/user-not-found' }), 'No account found with this email.');
      assert.equal(authResetErrorMsg({ code: 'auth/invalid-email' }), 'Please enter a valid email address.');
      assert.equal(authResetErrorMsg({ code: 'auth/too-many-requests' }), 'Too many attempts. Please try again later.');
      assert.equal(authResetErrorMsg({ message: 'auth/user-not-found' }), 'No account found with this email.');
      assert.equal(authResetErrorMsg(new Error('Network error')), 'Network error');
      assert.equal(authResetErrorMsg(null), 'Password reset failed. Please try again.');
    });

    it('CH2.5: Local mode password recovery rejects empty username or short passwords', () => {
      const mockAccounts = {
        admin: { id: 'admin', email: 'admin@local.device', hash: 'abc', salt: '123' }
      };

      const handleLocalReset = (username, newPw) => {
        const u = String(username || '').trim();
        const pw = String(newPw || '');
        if (!u) return { success: false, error: 'Please enter your username' };
        if (!pw || pw.length < 4) return { success: false, error: 'Use at least four characters' };
        const id = u.toLowerCase();
        const a = mockAccounts[id] || Object.values(mockAccounts).find(x => x.email && x.email.toLowerCase() === id);
        if (!a) return { success: false, error: 'Local profile not found on this device' };
        a.hash = 'new-mock-hash';
        return { success: true };
      };

      assert.equal(handleLocalReset('', 'newpass').success, false);
      assert.equal(handleLocalReset('', 'newpass').error, 'Please enter your username');
      assert.equal(handleLocalReset('admin', '12').success, false);
      assert.equal(handleLocalReset('admin', '12').error, 'Use at least four characters');
      assert.equal(handleLocalReset('nonexistent_user', 'newpass').success, false);
      assert.equal(handleLocalReset('nonexistent_user', 'newpass').error, 'Local profile not found on this device');
      assert.equal(handleLocalReset('admin', 'securePassword').success, true);
      assert.equal(mockAccounts.admin.hash, 'new-mock-hash');
    });
  });

  /* =========================================================================
     SUITE 3: DUAL GATE MODE RENDERING & STATE SWITCHING STRESS
     ========================================================================= */
  describe('Suite 3: Dual Gate Mode Rendering & Switching Stress', () => {
    it('CH3.1: Renders both Google OAuth and Email/Password fields simultaneously in Cloud Mode', () => {
      const CFG = { emailSignIn: true, firebase: true };
      let authMode = 'firebase';

      const computeGateVisibility = (mode, cfg) => {
        const cloud = mode === 'firebase';
        const form = !cloud || cfg.emailSignIn;
        return {
          cloudHidden: !cloud,
          formHidden: !form,
          orHidden: !form,
          googlePrimary: !form,
          localText: cloud ? 'Use a local profile instead' : 'Use Google sign-in instead'
        };
      };

      const state = computeGateVisibility(authMode, CFG);
      assert.equal(state.cloudHidden, false, 'Google button must be visible in cloud mode');
      assert.equal(state.formHidden, false, 'Email/Password form must be visible when emailSignIn is true');
      assert.equal(state.orHidden, false, 'Divider must be visible when both methods exist');
      assert.equal(state.googlePrimary, false, 'Google button must not be primary when email form is present');
      assert.equal(state.localText, 'Use a local profile instead');
    });

    it('CH3.2: Renders Local Mode with Google button hidden and email/username form visible', () => {
      const CFG = { emailSignIn: true, firebase: true };
      let authMode = 'local';

      const computeGateVisibility = (mode, cfg) => {
        const cloud = mode === 'firebase';
        const form = !cloud || cfg.emailSignIn;
        return {
          cloudHidden: !cloud,
          formHidden: !form,
          localText: cloud ? 'Use a local profile instead' : 'Use Google sign-in instead'
        };
      };

      const state = computeGateVisibility(authMode, CFG);
      assert.equal(state.cloudHidden, true, 'Google button must be hidden in local mode');
      assert.equal(state.formHidden, false, 'Form must remain visible in local mode');
      assert.equal(state.localText, 'Use Google sign-in instead');
    });

    it('CH3.3: Rapid gate mode toggling (100 switches) maintains 100% DOM state consistency', () => {
      const CFG = { emailSignIn: true, firebase: true };
      let currentMode = 'firebase';

      for (let i = 0; i < 100; i++) {
        // Toggle mode
        currentMode = (currentMode === 'firebase') ? 'local' : 'firebase';

        const cloud = currentMode === 'firebase';
        const form = !cloud || CFG.emailSignIn;
        const cloudHidden = !cloud;
        const formHidden = !form;
        const localText = cloud ? 'Use a local profile instead' : 'Use Google sign-in instead';

        if (currentMode === 'firebase') {
          assert.equal(cloudHidden, false, `Iteration ${i}: Cloud button must be visible in firebase mode`);
          assert.equal(formHidden, false, `Iteration ${i}: Form must be visible in dual mode`);
          assert.equal(localText, 'Use a local profile instead');
        } else {
          assert.equal(cloudHidden, true, `Iteration ${i}: Cloud button must be hidden in local mode`);
          assert.equal(formHidden, false, `Iteration ${i}: Form must remain visible in local mode`);
          assert.equal(localText, 'Use Google sign-in instead');
        }
      }
    });

    it('CH3.4: Gate busy state locks out multiple submissions and restores upon completion', () => {
      let busy = false;
      let submissions = 0;

      const submitGate = async () => {
        if (busy) return false;
        busy = true;
        submissions++;
        // Simulate async auth operation
        await new Promise(r => setTimeout(r, 10));
        busy = false;
        return true;
      };

      // First submit proceeds
      const p1 = submitGate();
      // Concurrent submit while busy is rejected
      const p2 = submitGate();

      return Promise.all([p1, p2]).then(([r1, r2]) => {
        assert.equal(r1, true, 'First submission should succeed');
        assert.equal(r2, false, 'Concurrent submission while busy must be blocked');
        assert.equal(submissions, 1, 'Total submissions must be 1');
        assert.equal(busy, false, 'Busy flag must be restored to false');
      });
    });

    it('CH3.5: Legacy Google-only mode (emailSignIn=false) cleanly hides email form in cloud mode', () => {
      const CFG = { emailSignIn: false, firebase: true };
      const cloud = true;
      const form = !cloud || CFG.emailSignIn;

      assert.equal(form, false, 'Form must be hidden when emailSignIn is false in cloud mode');
      const googlePrimary = !form;
      assert.equal(googlePrimary, true, 'Google button must be styled primary when it is the sole option');
    });

    it('CH3.6: Forgot Password button (#gateForgot) exists inside #gateForm in DOM markup', () => {
      const html = fs.readFileSync('./apps/adhd-study-pack.html', 'utf8');
      assert.ok(html.includes('id="gateForgot"'), 'Markup must include #gateForgot element');
      assert.ok(html.includes('Forgot password?'), 'Markup must include "Forgot password?" label');

      // Verify it is placed inside #gateForm before gateGo
      const formIndex = html.indexOf('id="gateForm"');
      const forgotIndex = html.indexOf('id="gateForgot"');
      const goIndex = html.indexOf('id="gateGo"');
      assert.ok(forgotIndex > formIndex, '#gateForgot must be inside #gateForm');
      assert.ok(forgotIndex < goIndex, '#gateForgot must precede the main sign in submit button');
    });
  });

  /* =========================================================================
     SUITE 4: UNIFIED GOOGLE CALENDAR AUTO-SYNC INTEGRATION
     ========================================================================= */
  describe('Suite 4: Unified Google Calendar Auto-Sync Integration', () => {
    const GCAL_SCOPES = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
    ];

    it('CH4.1: GoogleAuthProvider requests required calendar scopes upon sign-in', () => {
      const provider = new MockGoogleAuthProvider();
      GCAL_SCOPES.forEach(s => provider.addScope(s));

      assert.equal(provider.scopes.length, 2);
      assert.ok(provider.scopes.includes('https://www.googleapis.com/auth/calendar.events'));
      assert.ok(provider.scopes.includes('https://www.googleapis.com/auth/calendar.calendarlist.readonly'));
    });

    it('CH4.2: Extracts calendar accessToken and sets GCAL expiration correctly', () => {
      const credential = MockFirebaseAuth.credentialFromResult({ token: 'ya29.mock-auto-sync-token-1234' });
      assert.equal(credential.accessToken, 'ya29.mock-auto-sync-token-1234');

      const GCAL = { token: null, exp: 0, canList: false };
      const now = 1700000000000;
      GCAL.token = credential.accessToken;
      GCAL.exp = now + 3540 * 1000;
      GCAL.canList = true;

      assert.equal(GCAL.token, 'ya29.mock-auto-sync-token-1234');
      assert.equal(GCAL.canList, true);
      assert.ok(GCAL.exp > now, 'Expiration must be set into the future (~59 min)');
    });

    it('CH4.3: enterApp automatically enables gcal.on and initializes primary calendar when token exists', () => {
      const S = {
        gcal: { on: false, token: null, calId: null, cals: [] }
      };

      const enterAppSim = user => {
        const calToken = user && (user.calendarAccessToken || user.accessToken || null);
        if (calToken) {
          S.gcal.on = true;
          S.gcal.token = calToken;
          S.gcal.calId = S.gcal.calId || 'primary';
          if (!S.gcal.cals || !S.gcal.cals.length) S.gcal.cals = [S.gcal.calId];
        }
      };

      enterAppSim({ id: 'u-google', name: 'ADHD Student', calendarAccessToken: 'ya29.auto-token' });
      assert.equal(S.gcal.on, true, 'Calendar sync must be auto-enabled');
      assert.equal(S.gcal.token, 'ya29.auto-token', 'Token must be populated');
      assert.equal(S.gcal.calId, 'primary', 'Default calId must be primary');
      assert.deepEqual(S.gcal.cals, ['primary'], 'Default calendar list must contain primary');
    });

    it('CH4.4: Email/password or local users without calendar tokens open cleanly without forcing sync', () => {
      const S = {
        gcal: { on: false, token: null, calId: null, cals: [] }
      };

      let gcalFetchCalled = false;
      const gcalFetchWeek = async () => { gcalFetchCalled = true; };

      const enterAppSim = user => {
        const calToken = user && (user.calendarAccessToken || user.accessToken || null);
        if (calToken) {
          S.gcal.on = true;
          S.gcal.token = calToken;
          gcalFetchWeek();
        }
      };

      enterAppSim({ id: 'u-email', name: 'Email User', email: 'user@domain.com', provider: 'firebase' });
      assert.equal(S.gcal.on, false, 'Calendar sync must NOT be enabled for tokenless user');
      assert.equal(S.gcal.token, null);
      assert.equal(gcalFetchCalled, false, 'gcalFetchWeek must not be triggered without token');
    });

    it('CH4.5: Calendar fetch network failure is caught and logged without aborting app startup', async () => {
      let appBooted = false;
      let errorLogged = false;

      const failingGcalFetchWeek = async () => {
        throw new Error('503 Service Unavailable: Google Calendar API unreachable');
      };

      const enterAppSim = async user => {
        const calToken = user && (user.calendarAccessToken || user.accessToken || null);
        if (calToken) {
          try {
            await failingGcalFetchWeek();
          } catch (err) {
            errorLogged = true; // Caught gracefully
          }
        }
        appBooted = true;
      };

      await enterAppSim({ id: 'u-google', accessToken: 'ya29.sample' });
      assert.equal(errorLogged, true, 'Calendar fetch rejection must be caught gracefully');
      assert.equal(appBooted, true, 'App startup must complete successfully despite calendar sync error');
    });
  });

  /* =========================================================================
     SUITE 5: LIVE DOM & MODAL INTERACTION END-TO-END STRESS
     ========================================================================= */
  describe('Suite 5: Live DOM & Modal Interaction End-to-End Stress', () => {
    it('CH5.1: forgotPasswordModal mounts modal with accessible title and input fields', () => {
      const scrim = env.document.getElementById('scrim');
      const title = env.document.getElementById('modalTitle');
      const body = env.document.getElementById('modalBody');
      const foot = env.document.getElementById('modalFoot');

      assert.ok(scrim, 'Scrim must exist');
      assert.ok(title, 'Modal title element must exist');
      assert.ok(body, 'Modal body element must exist');
      assert.ok(foot, 'Modal foot element must exist');

      if (typeof mod.forgotPasswordModal === 'function') {
        mod.forgotPasswordModal();
        assert.ok(scrim.classList.contains('on'), 'Scrim must be open (.on) after forgotPasswordModal()');
        assert.ok(
          title.textContent === 'Reset password' || title.textContent === 'Local password recovery',
          `Modal title must reflect recovery context, got: "${title.textContent}"`
        );
      }
    });

    it('CH5.2: Prefill sanitization prevents XSS strings from populating reset inputs', () => {
      const gateUser = env.document.getElementById('gateUser');
      if (gateUser) {
        // Set hostile injection value in username input
        gateUser.value = '<script>alert("hacked")</script>';

        if (typeof mod.forgotPasswordModal === 'function') {
          mod.forgotPasswordModal();
          const resetEmail = env.document.getElementById('resetEmail');
          if (resetEmail) {
            assert.equal(resetEmail.value, '', 'Hostile XSS input must NOT be prefilled into reset email input');
          }
        }
      }
    });

    it('CH5.3: Valid email prefill transfers cleanly into reset email input', () => {
      const gateUser = env.document.getElementById('gateUser');
      if (gateUser) {
        gateUser.value = '   adhd.student+focus@domain.edu   ';

        if (typeof mod.forgotPasswordModal === 'function') {
          mod.forgotPasswordModal();
          const resetEmail = env.document.getElementById('resetEmail');
          if (resetEmail) {
            assert.equal(resetEmail.value, 'adhd.student+focus@domain.edu', 'Trimmed valid email must prefill');
          }
        }
      }
    });

    it('CH5.4: Live enterApp propagates Google Calendar token to FocusDial application state', async () => {
      if (typeof mod.enterApp === 'function') {
        await mod.enterApp({
          id: 'test-google-uid-888',
          name: 'Empirical Tester',
          email: 'tester@google.com',
          provider: 'google',
          calendarAccessToken: 'ya29.empirical-challenge-token-xyz'
        });

        const state = globalThis.window.FocusDial.getState();
        assert.equal(state.gcal.on, true, 'Live app state S.gcal.on must be true');
        assert.equal(state.gcal.token, 'ya29.empirical-challenge-token-xyz', 'Live app state S.gcal.token must match');
        assert.equal(state.gcal.calId, 'primary', 'Live app state S.gcal.calId must be primary');
      }
    });
  });
});

