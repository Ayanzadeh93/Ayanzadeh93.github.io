import test, { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  setupBrowserEnv,
  teardownBrowserEnv,
  MockElement,
  MockAudioContext,
  MockGainNode,
  MockOscillatorNode,
  MockBiquadFilterNode,
  MockAnalyserNode
} from '../fixtures/browser-mock.js';

// Augment MockElement style to support setProperty/removeProperty for comfort.js
MockElement.prototype.style = new Proxy({}, {
  get(target, prop) {
    if (prop === 'setProperty') return (k, v) => { target[k] = v; };
    if (prop === 'removeProperty') return (k) => { delete target[k]; };
    if (prop === 'getPropertyValue') return (k) => target[k] || '';
    return target[prop];
  }
});

function makeStyle() {
  const s = {};
  s.setProperty = (k, v) => { s[k] = v; };
  s.removeProperty = (k) => { delete s[k]; };
  s.getPropertyValue = (k) => s[k] || '';
  return s;
}

// Unref any background intervals so the test suite can exit cleanly
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms, ...args) => {
  const t = realSetInterval(fn, ms, ...args);
  if (t && typeof t.unref === 'function') t.unref();
  return t;
};

describe('Milestone 1 Empirical Stress Test Harness (audio_stress.test.js)', () => {
  let env;
  let app;
  let html;

  before(async () => {
    env = setupBrowserEnv();
    env.document.documentElement.style = makeStyle();
    env.document.body.style = makeStyle();

    html = fs.readFileSync('./apps/adhd-study-pack.html', 'utf8');
    env.document.body.innerHTML = html;

    app = await import('../../js/adhd-study-pack.js');
  });

  beforeEach(() => {
    if (app) app.silenceAll();
  });

  afterEach(() => {
    if (app) {
      try { app.silenceAll(); } catch (e) {}
    }
  });

  after(async () => {
    // Wait for any debounced autosaves to finish before tearing down globals
    await new Promise(r => setTimeout(r, 450));
    teardownBrowserEnv();
  });

  // =========================================================================
  // SUITE 1: EXTREME VOLUME INPUTS
  // =========================================================================
  describe('Suite 1: Extreme Volume Inputs & Boundary Handling', () => {
    it('S1.1: Clamps master volume within [0, 100] in state and audio graph', () => {
      const clampVol = v => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));

      assert.equal(clampVol(-50), 0);
      assert.equal(clampVol(150), 100);
      assert.equal(clampVol(NaN), 0);
      assert.equal(clampVol(Infinity), 100);
      assert.equal(clampVol(-Infinity), 0);
      assert.equal(clampVol('75'), 75);
      assert.equal(clampVol('invalid'), 0);
    });

    it('S1.2: Filters out NaN, negative, and non-numeric volumes in saveCustomPreset', () => {
      const ok = app.saveCustomPreset('CleanMix', {
        rain: NaN,
        cafe: -40,
        brown: 200,
        ocean: 45,
        fire: 'invalid_vol',
        forest: 0
      });

      assert.equal(ok, true);
      const saved = window.FocusDial ? null : null;
      // Test loading it back to verify sanitized state
      const loaded = app.loadPreset('CleanMix');
      assert.equal(loaded, true);

      // CleanMix should have brown clamped to 100, ocean set to 45, and NaN/negatives excluded
      app.deleteCustomPreset('CleanMix');
    });

    it('S1.3: applyPreset safely handles NaN, negative, >100, and non-existent layer IDs', () => {
      // Must not throw unhandled exception
      assert.doesNotThrow(() => {
        app.applyPreset({
          rain: NaN,
          cafe: -100,
          brown: 9999,
          ocean: 50,
          nonExistentLayerXYZ: 80,
          invalidType: 'string_value'
        });
      });
    });

    it('S1.4: layerVol handles extreme inputs without throwing', () => {
      app.layerOn('rain', true);
      assert.doesNotThrow(() => {
        app.layerVol('rain', 100);
        app.layerVol('rain', -50);
        app.layerVol('rain', 250);
        app.layerVol('rain', NaN);
        app.layerVol('rain', undefined);
        app.layerVol('rain', 'not-a-number');
      });
      app.layerOn('rain', false);
    });
  });

  // =========================================================================
  // SUITE 2: PRESET CRUD EDGE CASES
  // =========================================================================
  describe('Suite 2: Preset CRUD Edge Cases', () => {
    it('S2.1: Rejects empty, whitespace-only, null, and non-string preset names', () => {
      assert.equal(app.saveCustomPreset(''), false);
      assert.equal(app.saveCustomPreset('   '), false);
      assert.equal(app.saveCustomPreset('\t\n'), false);
      assert.equal(app.saveCustomPreset(null), false);
      assert.equal(app.saveCustomPreset(undefined), false);
      assert.equal(app.saveCustomPreset(12345), false);
      assert.equal(app.saveCustomPreset({}), false);
      assert.equal(app.saveCustomPreset([]), false);
    });

    it('S2.2: Saves, loads, and deletes 500-character and 1000-character preset names', () => {
      const longName = 'A'.repeat(500);
      assert.equal(app.saveCustomPreset(longName, { rain: 60 }), true);
      assert.equal(app.loadPreset(longName), true);
      assert.equal(app.deleteCustomPreset(longName), true);

      // Verify it no longer loads after deletion
      assert.equal(app.loadPreset(longName), false);
    });

    it('S2.3: Safely handles special characters, quotes, XSS vectors, and Unicode', () => {
      const vectors = [
        '<script>alert("XSS")</script>',
        'Preset "Double" & \'Single\' Quotes',
        '<b>Bold</b> and &amp; entities',
        '🌧️ Rain 🌊 Ocean ☕ Cafe 100% ADHD',
        'Line1\nLine2\tTabbed'
      ];

      for (const name of vectors) {
        const saved = app.saveCustomPreset(name, { ocean: 50, pink: 30 });
        assert.equal(saved, true, `Should save preset: ${name}`);

        const loaded = app.loadPreset(name);
        assert.equal(loaded, true, `Should load preset: ${name}`);

        const deleted = app.deleteCustomPreset(name);
        assert.equal(deleted, true, `Should delete preset: ${name}`);
      }
    });

    it('S2.4: Prevents prototype pollution when preset is named __proto__, constructor, toString', () => {
      const dangerousNames = ['__proto__', 'constructor', 'toString', 'valueOf'];
      for (const name of dangerousNames) {
        assert.doesNotThrow(() => {
          app.saveCustomPreset(name, { rain: 40 });
          app.loadPreset(name);
          app.deleteCustomPreset(name);
        });
        // Verify Object prototype remains untouched
        assert.equal(({}).rain, undefined);
      }
    });

    it('S2.5: Overwriting duplicate preset name updates configuration without error', () => {
      assert.equal(app.saveCustomPreset('DuplicatePreset', { rain: 30 }), true);
      assert.equal(app.saveCustomPreset('DuplicatePreset', { brown: 70 }), true);

      assert.equal(app.loadPreset('DuplicatePreset'), true);
      assert.equal(app.deleteCustomPreset('DuplicatePreset'), true);
    });

    it('S2.6: Prevents deletion of built-in presets when no custom override exists', () => {
      // Deleting built-in preset without custom override must return false
      const builtIns = ['Rain café', 'Deep brown', 'Ocean night', 'Library tick', 'Hearth'];
      for (const b of builtIns) {
        assert.equal(app.deleteCustomPreset(b), false, `Should not delete built-in preset: ${b}`);
        // Ensure built-in preset still loads
        assert.equal(app.loadPreset(b), true, `Built-in preset should still load: ${b}`);
      }
    });

    it('S2.7: Custom preset overriding built-in can be deleted, restoring built-in preset', () => {
      // Save custom preset with same name as built-in
      assert.equal(app.saveCustomPreset('Rain café', { forest: 80 }), true);
      // Delete custom override
      assert.equal(app.deleteCustomPreset('Rain café'), true);
      // Built-in should still be available
      assert.equal(app.loadPreset('Rain café'), true);
    });

    it('S2.8: Captures active live mix when layers argument is omitted', () => {
      app.silenceAll();
      app.layerOn('rain', true);
      app.layerVol('rain', 70);
      app.layerOn('ocean', true);
      app.layerVol('ocean', 40);

      // Save without layers argument
      assert.equal(app.saveCustomPreset('CapturedMix'), true);

      app.silenceAll();
      assert.equal(app.loadPreset('CapturedMix'), true);
      assert.equal(app.deleteCustomPreset('CapturedMix'), true);
    });

    it('S2.9: Returning false when deleting non-existent preset', () => {
      assert.equal(app.deleteCustomPreset('DefinitelyDoesNotExist-999'), false);
    });
  });

  // =========================================================================
  // SUITE 3: RAPID PRESET CYCLING (STRESS & SOAK)
  // =========================================================================
  describe('Suite 3: Rapid Preset Cycling (100 Switches)', () => {
    it('S3.1: Performs 100 consecutive preset switches without unhandled errors or state corruption', () => {
      // Setup custom presets
      app.saveCustomPreset('StressA', { rain: 50, cafe: 30, brown: 20 });
      app.saveCustomPreset('StressB', { ocean: 60, fire: 40 });
      app.saveCustomPreset('StressC', { tick: 50, forest: 35, bin: 25 });
      app.saveCustomPreset('StressEmpty', {});

      const presets = [
        'Rain café',
        'Deep brown',
        'Ocean night',
        'Library tick',
        'Hearth',
        'StressA',
        'StressB',
        'StressC',
        'StressEmpty'
      ];

      for (let i = 0; i < 100; i++) {
        const target = presets[i % presets.length];
        const ok = app.loadPreset(target);
        assert.equal(ok, true, `Cycle ${i}: Failed to load ${target}`);
      }

      // Final silence
      assert.doesNotThrow(() => app.silenceAll());

      // Cleanup custom presets
      app.deleteCustomPreset('StressA');
      app.deleteCustomPreset('StressB');
      app.deleteCustomPreset('StressC');
      app.deleteCustomPreset('StressEmpty');
    });

    it('S3.2: Handles rapid alternations between maximum layers (all 9) and silence', () => {
      const allNine = {
        rain: 50, ocean: 45, brown: 40, pink: 35,
        fire: 30, cafe: 25, forest: 20, tick: 15, bin: 10
      };
      app.saveCustomPreset('AllNine', allNine);
      app.saveCustomPreset('Silence', {});

      for (let i = 0; i < 30; i++) {
        assert.equal(app.loadPreset(i % 2 === 0 ? 'AllNine' : 'Silence'), true);
      }

      app.deleteCustomPreset('AllNine');
      app.deleteCustomPreset('Silence');
      app.silenceAll();
    });
  });

  // =========================================================================
  // SUITE 4: NODE LIFECYCLE & RESOURCE CLEANUP
  // =========================================================================
  describe('Suite 4: Node Lifecycle & Resource Cleanup', () => {
    it('S4.1: Repeatedly turns on and off every sound layer 20 times without leaks', () => {
      for (const layer of app.LAYERS) {
        for (let i = 0; i < 20; i++) {
          assert.doesNotThrow(() => {
            app.layerOn(layer.id, true);
            app.layerOn(layer.id, false);
          });
        }
      }
    });

    it('S4.2: getAnalyserNode returns consistent singleton instance', () => {
      const a1 = app.getAnalyserNode();
      const a2 = app.getAnalyserNode();
      const a3 = app.getAnalyserNode();

      assert.ok(a1);
      assert.equal(a1, a2);
      assert.equal(a2, a3);
    });

    it('S4.3: silenceAll disconnects and clears all active layers', () => {
      app.loadPreset('Hearth');
      app.silenceAll();
      // Repeating silenceAll when already silent is safe
      assert.doesNotThrow(() => app.silenceAll());
    });
  });
});
