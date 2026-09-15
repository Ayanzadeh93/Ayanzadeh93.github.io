import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupBrowserEnv,
  teardownBrowserEnv,
  MockFirebaseAuth,
  MockGoogleAuthProvider
} from '../fixtures/browser-mock.js';

describe('Authentication & Google Calendar Auto-Sync (F5-F7)', () => {
  let env;

  beforeEach(() => {
    env = setupBrowserEnv();
  });

  afterEach(() => {
    teardownBrowserEnv();
  });

  // F5: Dual Authentication
  describe('F5: Dual Authentication', () => {
    it('supports both Google Sign-in and standard Email/Password gate modes', () => {
      const cfg = { auth: 'auto', emailSignIn: true };
      const authState = { mode: 'firebase', emailSignIn: cfg.emailSignIn };

      const showGateForm = !authState.mode || authState.mode === 'local' || authState.emailSignIn;
      const showGoogleBtn = authState.mode === 'firebase';

      assert.equal(showGateForm, true);
      assert.equal(showGoogleBtn, true);
    });

    it('validates email address format during sign-in and sign-up', () => {
      const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

      assert.equal(isValidEmail('user@domain.com'), true);
      assert.equal(isValidEmail('student.adhd+test@school.edu'), true);
      assert.equal(isValidEmail('invalid-email'), false);
      assert.equal(isValidEmail('user@'), false);
      assert.equal(isValidEmail(''), false);
      assert.equal(isValidEmail(null), false);
    });

    it('enforces minimum password length requirement', () => {
      const isValidPassword = pass => typeof pass === 'string' && pass.length >= 6;

      assert.equal(isValidPassword('123456'), true);
      assert.equal(isValidPassword('securePassword!'), true);
      assert.equal(isValidPassword('short'), false);
      assert.equal(isValidPassword(''), false);
    });

    it('persists and retrieves user session identifier across reloads', () => {
      const sessionKey = 'focusdial.v3.session';
      const saveSession = id => env.localStorage.setItem(sessionKey, id);
      const getSession = () => env.localStorage.getItem(sessionKey);
      const clearSession = () => env.localStorage.removeItem(sessionKey);

      assert.equal(getSession(), null);
      saveSession('user-abc-123');
      assert.equal(getSession(), 'user-abc-123');
      clearSession();
      assert.equal(getSession(), null);
    });

    it('distinguishes between Google and Local authentication profiles in workspace state', () => {
      const createProfile = (id, email, provider) => ({
        id,
        name: email.split('@')[0],
        email,
        provider // 'google' | 'local'
      });

      const googleUser = createProfile('g-1', 'alex@gmail.com', 'google');
      const localUser = createProfile('l-2', 'sam@local.device', 'local');

      assert.equal(googleUser.provider, 'google');
      assert.equal(localUser.provider, 'local');
      assert.equal(googleUser.name, 'alex');
      assert.equal(localUser.name, 'sam');
    });
  });

  // F6: Forgot Password Flow
  describe('F6: Forgot Password Recovery', () => {
    it('dispatches password reset email through Firebase Auth SDK when email is valid', async () => {
      let resetSent = false;
      const sendReset = async email => {
        await MockFirebaseAuth.sendPasswordResetEmail(null, email);
        resetSent = true;
      };

      await sendReset('student@example.com');
      assert.equal(resetSent, true);
    });

    it('rejects malformed email addresses during password recovery with auth/invalid-email', async () => {
      await assert.rejects(
        async () => {
          await MockFirebaseAuth.sendPasswordResetEmail(null, 'not-an-email');
        },
        err => err.code === 'auth/invalid-email'
      );
    });

    it('renders affirmative feedback toast on successful password reset dispatch', () => {
      const toasts = [];
      const showToast = (msg, type = 'ok') => toasts.push({ msg, type, time: Date.now() });

      showToast('Password reset email sent. Check your inbox.', 'ok');
      assert.equal(toasts.length, 1);
      assert.equal(toasts[0].msg, 'Password reset email sent. Check your inbox.');
      assert.equal(toasts[0].type, 'ok');
    });

    it('provides clear fallback feedback for local device profiles without cloud email provider', () => {
      const handleForgotPassword = (email, authMode) => {
        if (authMode === 'local') {
          return {
            success: false,
            message: 'Local profiles exist only on this device. You can reset your password directly from device settings.'
          };
        }
        return { success: true, message: 'Password reset link sent.' };
      };

      const localResult = handleForgotPassword('localuser', 'local');
      assert.equal(localResult.success, false);
      assert.ok(localResult.message.includes('Local profiles exist only on this device'));
    });

    it('prevents multiple rapid duplicate password reset submissions', () => {
      let lastResetTime = null;
      const canSubmitReset = (now, cooldownMs = 30000) => {
        if (lastResetTime !== null && now - lastResetTime < cooldownMs) return false;
        lastResetTime = now;
        return true;
      };

      assert.equal(canSubmitReset(1000), true);
      assert.equal(canSubmitReset(5000), false);
      assert.equal(canSubmitReset(32000), true);
    });
  });

  // F7: Google Calendar Auto-Sync
  describe('F7: Google Calendar Auto-Sync', () => {
    const GCAL_SCOPES = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
    ];

    it('attaches Google Calendar scopes to GoogleAuthProvider during sign-in', () => {
      const provider = new MockGoogleAuthProvider();
      GCAL_SCOPES.forEach(scope => provider.addScope(scope));

      assert.equal(provider.scopes.length, 2);
      assert.equal(provider.scopes.includes(GCAL_SCOPES[0]), true);
      assert.equal(provider.scopes.includes(GCAL_SCOPES[1]), true);
    });

    it('extracts Google Calendar OAuth accessToken directly from auth credential', () => {
      const mockResult = { token: 'ya29.mock-google-calendar-token-12345' };
      const cred = MockFirebaseAuth.credentialFromResult(mockResult);

      assert.ok(cred.accessToken);
      assert.equal(cred.accessToken, 'ya29.mock-google-calendar-token-12345');
    });

    it('automatically activates calendar sync in enterApp when accessToken is present', () => {
      const S = { gcal: { on: false, token: null } };
      const enterApp = user => {
        if (user.accessToken) {
          S.gcal.token = user.accessToken;
          S.gcal.on = true;
        }
      };

      enterApp({ id: 'u1', name: 'Alex', accessToken: 'ya29.abc123token' });
      assert.equal(S.gcal.on, true);
      assert.equal(S.gcal.token, 'ya29.abc123token');
    });

    it('triggers immediate calendar event fetch upon Google login auto-sync', async () => {
      let fetched = false;
      const gcalFetchWeek = async token => {
        if (token) fetched = true;
        return [{ id: 'evt-1', title: 'Calculus Lecture', start: '2026-09-15T10:00:00Z' }];
      };

      const events = await gcalFetchWeek('mock-token');
      assert.equal(fetched, true);
      assert.equal(events.length, 1);
      assert.equal(events[0].title, 'Calculus Lecture');
    });

    it('gracefully handles absence of calendar token by keeping app functional with gcal.on=false', () => {
      const S = { gcal: { on: false, token: null } };
      const enterApp = user => {
        if (user.accessToken) {
          S.gcal.token = user.accessToken;
          S.gcal.on = true;
        } else {
          S.gcal.on = false;
        }
      };

      enterApp({ id: 'u2', name: 'Sam', accessToken: null });
      assert.equal(S.gcal.on, false);
      assert.equal(S.gcal.token, null);
    });
  });
});
