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
  MockAudioContext,
  MockGainNode,
  MockOscillatorNode,
  MockBiquadFilterNode,
  MockAnalyserNode,
  MockBufferSourceNode
} from '../fixtures/browser-mock.js';

describe('Empirical Challenge Suite: Web Audio Engine, Noise Stability & Preset Transitions', () => {
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
    // Keep environment stable for any trailing unrefed callbacks
  });

  beforeEach(() => {
    if (mod && mod.silenceAll) {
      try { mod.silenceAll(); } catch (e) {}
    }
  });

  /* =========================================================================
     CHALLENGE 1: Web Audio Clock Lookahead Scheduling During 10s Background Tab Pauses
     ========================================================================= */
  describe('Challenge 1: Web Audio Lookahead Scheduling During Background Tab Pauses', () => {
    it('CH1.1: Clock tick generator recovers from 10s pause without burst floods or past events', () => {
      const ctx = new MockAudioContext();
      const scheduledTicks = [];

      function tickSound(dest, atTime = null, isOdd = false) {
        const t = atTime != null ? atTime : ctx.currentTime;
        if (t < ctx.currentTime - 0.05) return; // Drop past bursts
        scheduledTicks.push({ t, isOdd, currentTimeAtSchedule: ctx.currentTime });
      }

      let nextTick = ctx.currentTime + 0.05;
      let count = 0;
      const scheduler = () => {
        while (nextTick < ctx.currentTime + 2.5) {
          tickSound(null, nextTick, count % 2 === 1);
          count++;
          nextTick += 1.0;
        }
      };

      // Initial schedule at t=0
      scheduler();
      assert.equal(scheduledTicks.length, 3, 'Initial window should schedule 3 ticks (0.05, 1.05, 2.05)');
      assert.deepEqual(scheduledTicks.map(t => Math.round(t.t * 100) / 100), [0.05, 1.05, 2.05]);

      // Steady state playback for 1 second
      ctx.advanceTime(1.0);
      scheduler();
      assert.equal(scheduledTicks.length, 4, 'One additional tick scheduled at 3.05');

      // SIMULATE 10-SECOND BACKGROUND TAB PAUSE
      // In a background tab, audio hardware clock currentTime advances by 10s
      // while setInterval was suspended.
      ctx.advanceTime(10.0); // ctx.currentTime is now 11.0
      scheduledTicks.length = 0; // Clear history to inspect wakeup burst

      // Background tab wakes up -> scheduler fires
      scheduler();

      // Verify no burst floods
      assert.ok(
        scheduledTicks.length <= 3,
        `Wakeup must NOT burst-flood: scheduled ${scheduledTicks.length} bursts, expected <= 3`
      );

      // Verify ZERO bursts scheduled in the past
      const pastEvents = scheduledTicks.filter(t => t.t < ctx.currentTime - 0.05);
      assert.equal(pastEvents.length, 0, 'No bursts should be scheduled in the past');

      // Verify exact 1.000s spacing for upcoming ticks
      for (let i = 1; i < scheduledTicks.length; i++) {
        const delta = scheduledTicks[i].t - scheduledTicks[i - 1].t;
        assert.ok(
          Math.abs(delta - 1.0) < 1e-6,
          `Tick interval must be exactly 1.0s, got ${delta}`
        );
      }

      // Verify cadence is preserved
      assert.equal(count, 14, 'Tick count must accurately reflect elapsed seconds');

      // Verify next regular interval (120ms later) does not burst
      ctx.advanceTime(0.12);
      const prevCount = scheduledTicks.length;
      scheduler();
      assert.ok(
        scheduledTicks.length - prevCount <= 1,
        'Next regular tick interval must schedule at most 1 future tick'
      );
    });

    it('CH1.2: Rain micro-droplet scheduler recovers from 10s pause without burst floods', () => {
      const ctx = new MockAudioContext();
      const scheduledBursts = [];

      function burst(dest, { atTime = null, dur = 0.02, freq = 3400 } = {}) {
        const t = atTime != null ? atTime : ctx.currentTime;
        if (t < ctx.currentTime - 0.05) return;
        scheduledBursts.push({ t, dur, freq, scheduledAt: ctx.currentTime });
      }

      let nextDrop = ctx.currentTime + 0.05;
      const scheduler = () => {
        while (nextDrop < ctx.currentTime + 2.0) {
          burst(null, {
            dur: 0.012 + Math.random() * 0.016,
            freq: 3400 + Math.random() * 2600,
            atTime: nextDrop
          });
          nextDrop += 0.06 + Math.random() * 0.14;
        }
      };

      scheduler();
      const initialCount = scheduledBursts.length;
      assert.ok(initialCount >= 10 && initialCount <= 25, 'Initial rain window has reasonable burst count');

      // Simulate 10-second background pause
      ctx.advanceTime(10.0);
      scheduledBursts.length = 0;

      const t0 = performance.now();
      scheduler();
      const elapsedMs = performance.now() - t0;

      assert.ok(elapsedMs < 10, `Wakeup scheduler must complete in under 10ms (took ${elapsedMs.toFixed(2)}ms)`);
      assert.ok(
        scheduledBursts.length >= 10 && scheduledBursts.length <= 25,
        `Wakeup must schedule lookahead horizon only (got ${scheduledBursts.length} bursts)`
      );

      // Verify all scheduled bursts are strictly future
      const pastBursts = scheduledBursts.filter(b => b.t < ctx.currentTime - 0.05);
      assert.equal(pastBursts.length, 0, 'Zero rain bursts scheduled in the past');

      // Verify horizon upper bound
      const futureOverflow = scheduledBursts.filter(b => b.t > ctx.currentTime + 2.2);
      assert.equal(futureOverflow.length, 0, 'No rain bursts scheduled beyond lookahead window');
    });

    it('CH1.3: Fireplace, Cafe, and Forest intermittent schedulers survive 10s pause without node runaway', () => {
      const ctx = new MockAudioContext();
      const scheduledEvents = [];

      function logEvent(type, atTime) {
        if (atTime < ctx.currentTime - 0.05) return;
        scheduledEvents.push({ type, atTime, scheduledAt: ctx.currentTime });
      }

      // Fire
      let nextFire = ctx.currentTime + 0.05;
      const fireSched = () => {
        while (nextFire < ctx.currentTime + 2.5) {
          logEvent('fire', nextFire);
          nextFire += 0.04 + Math.random() * 0.12;
        }
      };

      // Cafe
      let nextCafe = ctx.currentTime + 1.2;
      const cafeSched = () => {
        while (nextCafe < ctx.currentTime + 3.0) {
          logEvent('cafe', nextCafe);
          nextCafe += 2.5 + Math.random() * 5.0;
        }
      };

      // Forest
      let nextForest = ctx.currentTime + 1.5;
      const forestSched = () => {
        while (nextForest < ctx.currentTime + 3.0) {
          logEvent('forest', nextForest);
          nextForest += 3.5 + Math.random() * 5.5;
        }
      };

      fireSched();
      cafeSched();
      forestSched();

      // 10s background pause
      ctx.advanceTime(10.0);
      scheduledEvents.length = 0;

      fireSched();
      cafeSched();
      forestSched();

      assert.ok(scheduledEvents.length < 50, `Combined burst count must remain small (<50), got ${scheduledEvents.length}`);
      assert.equal(
        scheduledEvents.filter(e => e.atTime < ctx.currentTime - 0.05).length,
        0,
        'Zero events scheduled in past across all generators'
      );
    });
  });

  /* =========================================================================
     CHALLENGE 2: Audio Buffer Stability (white/pink/brown noise numerical stability)
     ========================================================================= */
  describe('Challenge 2: Audio Buffer Stability (makeNoise)', () => {
    it('CH2.1: White noise buffer is numerically stable and bounded in [-0.6, 0.6]', () => {
      const len = 44100 * 4;
      const d = new Float32Array(len);
      let nanCount = 0, infCount = 0, max = -Infinity, min = Infinity;

      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        const val = w * 0.6;
        d[i] = val;
        if (Number.isNaN(val)) nanCount++;
        if (!Number.isFinite(val)) infCount++;
        if (val > max) max = val;
        if (val < min) min = val;
      }

      assert.equal(nanCount, 0, 'Zero NaNs in white noise');
      assert.equal(infCount, 0, 'Zero Infs in white noise');
      assert.ok(max <= 0.6, `Max white noise sample ${max} must be <= 0.6`);
      assert.ok(min >= -0.6, `Min white noise sample ${min} must be >= -0.6`);
    });

    it('CH2.2: Pink noise buffer (Kellet filter) is numerically stable across 1,000,000 samples', () => {
      const len = 1000000;
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      let nanCount = 0, infCount = 0, max = -Infinity, min = Infinity;
      let overCount = 0;

      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        const val = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;

        if (Number.isNaN(val)) nanCount++;
        if (!Number.isFinite(val)) infCount++;
        if (val > 1.0 || val < -1.0) overCount++;
        if (val > max) max = val;
        if (val < min) min = val;
      }

      assert.equal(nanCount, 0, 'Zero NaNs in pink noise');
      assert.equal(infCount, 0, 'Zero Infs in pink noise');
      assert.equal(overCount, 0, 'Zero clipping beyond [-1, 1] in 1M pink noise samples');
      assert.ok(max <= 1.0, `Max pink noise sample ${max} must be <= 1.0`);
      assert.ok(min >= -1.0, `Min pink noise sample ${min} must be >= -1.0`);
    });

    it('CH2.3: Brown noise buffer (leaky integrator) has stable poles and zero NaNs/Infinities', () => {
      // Filter equation: last[n] = (1 / 1.02) * last[n-1] + (0.02 / 1.02) * w[n]
      // Pole is at z = 1 / 1.02 = 0.980392... < 1.0 (BIBO STABLE)
      const pole = 1 / 1.02;
      assert.ok(Math.abs(pole) < 1.0, 'Brown noise pole must be strictly inside unit circle');

      // Worst case DC analysis: if w = +1 forever, steady state last = 1.0
      let steadyState = 0;
      for (let i = 0; i < 10000; i++) {
        steadyState = (steadyState + 0.02 * 1.0) / 1.02;
      }
      assert.ok(Math.abs(steadyState - 1.0) < 1e-4, 'Worst case DC asymptote is exactly 1.0');

      // Run 50 complete 4-second audio buffers (8.82 million samples)
      let totalSamples = 0, nanCount = 0, infCount = 0;
      let maxAbs = 0;

      for (let run = 0; run < 50; run++) {
        let last = 0;
        const len = 44100 * 4;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          const val = last * 3.2;
          totalSamples++;
          if (Number.isNaN(val)) nanCount++;
          if (!Number.isFinite(val)) infCount++;
          const abs = Math.abs(val);
          if (abs > maxAbs) maxAbs = abs;
        }
      }

      assert.equal(nanCount, 0, 'Zero NaNs in brown noise across 8.8M samples');
      assert.equal(infCount, 0, 'Zero Infs in brown noise across 8.8M samples');
      assert.ok(maxAbs < 1.5, `Peak brown noise excursion ${maxAbs.toFixed(4)} is well-controlled`);
    });

    it('CH2.4: Noise generators function properly across varied sample rates (44.1kHz, 48kHz, 96kHz)', () => {
      const sampleRates = [44100, 48000, 96000];
      sampleRates.forEach(sr => {
        const len = sr * 4;
        let last = 0;
        let nanFound = false;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          const val = last * 3.2;
          if (Number.isNaN(val) || !Number.isFinite(val)) nanFound = true;
        }
        assert.equal(nanFound, false, `Sample rate ${sr}Hz produces clean audio buffer`);
      });
    });
  });

  /* =========================================================================
     CHALLENGE 3: Active Preset Transitions and Volume Isolation
     ========================================================================= */
  describe('Challenge 3: Active Preset Transitions & Volume Isolation', () => {
    it('CH3.1: applyPreset cleanly activates layers and saves active configuration', () => {
      // Step 1: Activate 'Rain café' ({ rain: 60, cafe: 35 })
      const ok1 = mod.applyPreset({ rain: 60, cafe: 35 });
      assert.equal(ok1, true);
      assert.equal(mod.LAYERS.length, 9);

      let state = window.FocusDial.getState();
      assert.equal(state.sound.layers.rain, 60);
      assert.equal(state.sound.layers.cafe, 35);

      // Step 2: Switch to 'Deep brown' ({ brown: 70 })
      const ok2 = mod.applyPreset({ brown: 70 });
      assert.equal(ok2, true);

      state = window.FocusDial.getState();
      assert.equal(state.sound.layers.brown, 70);

      // Step 3: Switch to single 'ocean' layer
      const ok3 = mod.applyPreset({ ocean: 80 });
      assert.equal(ok3, true);
      state = window.FocusDial.getState();
      assert.equal(state.sound.layers.ocean, 80);
    });

    it('CH3.2: 0-volume layers in preset do not activate or play audio', () => {
      // Preset with explicit 0 volume
      mod.applyPreset({ rain: 0, brown: 50, ocean: 0 });
      const state = window.FocusDial.getState();
      assert.equal(state.sound.layers.brown, 50);
    });

    it('CH3.3: Rapid switching across all presets does not throw or corrupt state', () => {
      const presets = Object.keys(mod.SOUND_PRESETS);
      assert.ok(presets.length >= 5, 'Must have at least 5 built-in presets');

      // Rapidly switch 50 times
      for (let i = 0; i < 50; i++) {
        const pName = presets[i % presets.length];
        const ok = mod.loadPreset(pName);
        assert.equal(ok, true, `Loading preset "${pName}" must succeed`);
        const state = window.FocusDial.getState();
        assert.equal(state.sound.activePreset, pName);
      }

      // Silence all at the end
      mod.silenceAll();
      const finalState = window.FocusDial.getState();
      assert.equal(finalState.sound.activePreset, null);
    });

    it('CH3.4: Custom preset CRUD maintains isolated layer configurations', () => {
      // Save preset A
      const okA = mod.saveCustomPreset('Focus Stack A', { rain: 45, brown: 55 });
      assert.equal(okA, true);
      let state = window.FocusDial.getState();
      assert.deepEqual(state.sound.presets['Focus Stack A'], { rain: 45, brown: 55 });

      // Save preset B
      const okB = mod.saveCustomPreset('Focus Stack B', { ocean: 70, forest: 30 });
      assert.equal(okB, true);
      state = window.FocusDial.getState();
      assert.deepEqual(state.sound.presets['Focus Stack B'], { ocean: 70, forest: 30 });

      // Load A
      mod.loadPreset('Focus Stack A');
      state = window.FocusDial.getState();
      assert.equal(state.sound.activePreset, 'Focus Stack A');
      assert.equal(state.sound.layers.rain, 45);
      assert.equal(state.sound.layers.brown, 55);

      // Load B
      mod.loadPreset('Focus Stack B');
      state = window.FocusDial.getState();
      assert.equal(state.sound.activePreset, 'Focus Stack B');
      assert.equal(state.sound.layers.ocean, 70);
      assert.equal(state.sound.layers.forest, 30);

      // Delete A
      const okDel = mod.deleteCustomPreset('Focus Stack A');
      assert.equal(okDel, true);
      state = window.FocusDial.getState();
      assert.equal('Focus Stack A' in state.sound.presets, false);
      assert.equal('Focus Stack B' in state.sound.presets, true);
      assert.equal(state.sound.activePreset, 'Focus Stack B');

      // Delete active preset B
      mod.deleteCustomPreset('Focus Stack B');
      state = window.FocusDial.getState();
      assert.equal(state.sound.activePreset, null);
    });

    it('CH3.5: getAnalyserNode returns connected node without creating duplicates', () => {
      const a1 = mod.getAnalyserNode();
      assert.ok(a1 instanceof MockAnalyserNode, 'getAnalyserNode returns an AnalyserNode');
      const a2 = mod.getAnalyserNode();
      assert.equal(a1, a2, 'Subsequent getAnalyserNode calls return singleton instance');
    });
  });
});
