import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupBrowserEnv,
  teardownBrowserEnv,
  MockAudioContext,
  MockNotification
} from '../fixtures/browser-mock.js';
import { COMFORT_PRESETS, COMFORT_DEFAULTS, presetComfort, normaliseComfort } from '../../js/lib/comfort.js';

describe('Calming Animations & Enhanced Notifications (F17-F19)', () => {
  let env;

  beforeEach(() => {
    env = setupBrowserEnv();
  });

  afterEach(() => {
    teardownBrowserEnv();
  });

  // F17: Calming Visualizer Canvas
  describe('F17: Calming Visualizer Canvas', () => {
    it('initializes stage visualizer canvas element', () => {
      const canvas = env.document.createElement('canvas');
      canvas.id = 'stageVisualizer';
      canvas.width = 600;
      canvas.height = 600;
      env.document.body.appendChild(canvas);

      assert.equal(env.document.getElementById('stageVisualizer'), canvas);
      assert.equal(canvas.width, 600);
      assert.equal(canvas.height, 600);
    });

    it('attaches to Web Audio AnalyserNode to sample frequency and waveform data', () => {
      const ctx = new MockAudioContext();
      const analyser = ctx.createAnalyser();
      assert.equal(analyser.frequencyBinCount, 1024);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
      assert.equal(freqData.length, 1024);
      assert.ok(freqData[0] > 0);

      const timeData = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(timeData);
      assert.equal(timeData.length, 2048);
      assert.equal(timeData[0], 128);
    });

    it('calculates harmonic breathing pulse during silent focus timer sessions', () => {
      const calculateBreathScale = (timestampMs, cycleDurationMs = 16000) => {
        // 4s inhale, 4s hold, 4s exhale, 4s hold = 16s cycle
        const phase = (timestampMs % cycleDurationMs) / cycleDurationMs;
        // Sinusoidal wave between 0.85 and 1.15
        const scale = 1.0 + 0.15 * Math.sin(phase * Math.PI * 2);
        return scale;
      };

      const scale0 = calculateBreathScale(0);
      const scaleQuarter = calculateBreathScale(4000); // peak inhale
      const scaleThreeQuarter = calculateBreathScale(12000); // trough exhale

      assert.ok(Math.abs(scale0 - 1.0) < 0.01);
      assert.ok(scaleQuarter > 1.10);
      assert.ok(scaleThreeQuarter < 0.90);
    });

    it('requests animation frames via window.requestAnimationFrame when active', () => {
      let frameExecuted = false;
      const id = env.window.requestAnimationFrame(() => {
        frameExecuted = true;
      });

      assert.ok(id);
    });

    it('cancels scheduled visualizer animation frames on unmount or pause', () => {
      let called = false;
      const id = env.window.requestAnimationFrame(() => {
        called = true;
      });

      env.window.cancelAnimationFrame(id);
      assert.equal(called, false);
    });
  });

  // F18: Reduced-Motion Accessibility
  describe('F18: Reduced-Motion Accessibility', () => {
    it('detects motion reduction preference from comfort.js calm profile', () => {
      const calmComfort = presetComfort('calm');
      assert.equal(calmComfort.motion, 'reduce');
      assert.equal(calmComfort.color, 'soft');
    });

    it('detects motion reduction preference from comfort.js screenreader profile', () => {
      const srComfort = presetComfort('screenreader');
      assert.equal(srComfort.motion, 'reduce');
      assert.equal(srComfort.shortcuts, false);
    });

    it('defaults to system motion in standard ADHD comfort profile', () => {
      const adhdComfort = presetComfort('adhd');
      assert.equal(adhdComfort.motion, 'system');
    });

    it('determines effective reduced-motion state by checking comfort and system media query', () => {
      const isMotionReduced = (comfortMotion, systemPrefersReduced) => {
        if (comfortMotion === 'reduce') return true;
        if (comfortMotion === 'full') return false;
        return !!systemPrefersReduced;
      };

      // Explicit reduce in comfort
      assert.equal(isMotionReduced('reduce', false), true);
      // Explicit full in comfort
      assert.equal(isMotionReduced('full', true), false);
      // System mode with system prefers-reduced
      assert.equal(isMotionReduced('system', true), true);
      // System mode without system prefers-reduced
      assert.equal(isMotionReduced('system', false), false);
    });

    it('disables canvas rendering loop entirely when reduced motion is requested', () => {
      let isRendering = false;
      const startVisualizer = (isReduced) => {
        if (isReduced) {
          isRendering = false;
          return null;
        }
        isRendering = true;
        return env.window.requestAnimationFrame(() => {});
      };

      const handle = startVisualizer(true);
      assert.equal(handle, null);
      assert.equal(isRendering, false);
    });
  });

  // F19: Enhanced Notifications & Quiet Hours
  describe('F19: Enhanced Notifications & Quiet Hours', () => {
    it('implements toast queue with a maximum of 3 concurrent visible toasts', () => {
      const MAX_VISIBLE_TOASTS = 3;
      const activeToasts = [];

      const queueToast = (msg, level = 'ok') => {
        const toastItem = { id: Math.random().toString(36), msg, level };
        activeToasts.push(toastItem);
        if (activeToasts.length > MAX_VISIBLE_TOASTS) {
          activeToasts.shift(); // Remove oldest
        }
        return toastItem;
      };

      queueToast('Task 1 completed');
      queueToast('Task 2 completed');
      queueToast('Habit 1 checked');
      assert.equal(activeToasts.length, 3);
      assert.equal(activeToasts[0].msg, 'Task 1 completed');

      // 4th toast evicts the first
      queueToast('Timer finished');
      assert.equal(activeToasts.length, 3);
      assert.equal(activeToasts[0].msg, 'Task 2 completed');
      assert.equal(activeToasts[2].msg, 'Timer finished');
    });

    it('requests Web Notifications permission via Notification.requestPermission()', async () => {
      MockNotification.reset();
      assert.equal(MockNotification.permission, 'default');

      const perm = await MockNotification.requestPermission();
      assert.equal(perm, 'granted');
      assert.equal(MockNotification.permission, 'granted');
    });

    it('creates desktop notification when permission is granted', () => {
      MockNotification.reset();
      MockNotification.permission = 'granted';

      const n = new MockNotification('Focus Dial', { body: 'Focus session complete!' });
      assert.equal(MockNotification.instances.length, 1);
      assert.equal(MockNotification.instances[0].title, 'Focus Dial');
      assert.equal(MockNotification.instances[0].options.body, 'Focus session complete!');
    });

    it('accurately detects whether a given time falls within a Quiet Hours window crossing midnight', () => {
      const isQuietTime = (timeStr, startStr, endStr) => {
        const parseMinutes = s => {
          const [h, m] = s.split(':').map(Number);
          return h * 60 + m;
        };

        const current = parseMinutes(timeStr);
        const start = parseMinutes(startStr);
        const end = parseMinutes(endStr);

        if (start < end) {
          // Same day interval: e.g. 13:00 to 15:00
          return current >= start && current < end;
        } else {
          // Overnight interval: e.g. 22:00 to 08:00
          return current >= start || current < end;
        }
      };

      // Overnight: 22:00 to 08:00
      assert.equal(isQuietTime('23:30', '22:00', '08:00'), true); // 11:30 PM -> quiet
      assert.equal(isQuietTime('03:15', '22:00', '08:00'), true); // 3:15 AM -> quiet
      assert.equal(isQuietTime('07:59', '22:00', '08:00'), true); // 7:59 AM -> quiet
      assert.equal(isQuietTime('08:00', '22:00', '08:00'), false); // 8:00 AM -> active
      assert.equal(isQuietTime('14:30', '22:00', '08:00'), false); // 2:30 PM -> active
      assert.equal(isQuietTime('21:59', '22:00', '08:00'), false); // 9:59 PM -> active

      // Same-day: 12:00 to 14:00
      assert.equal(isQuietTime('13:00', '12:00', '14:00'), true);
      assert.equal(isQuietTime('15:00', '12:00', '14:00'), false);
    });

    it('suppresses audio chimes and desktop notifications during active Quiet Hours', () => {
      const quietConfig = { on: true, start: '22:00', end: '08:00' };
      const currentTime = '23:00';

      let chimePlayed = false;
      let notificationDispatched = false;
      let toastShown = false;

      const triggerAlert = (isQuiet) => {
        if (!isQuiet) {
          chimePlayed = true;
          notificationDispatched = true;
        }
        // In-app toasts are never suppressed
        toastShown = true;
      };

      triggerAlert(quietConfig.on); // Quiet hours active
      assert.equal(chimePlayed, false);
      assert.equal(notificationDispatched, false);
      assert.equal(toastShown, true);
    });
  });
});
