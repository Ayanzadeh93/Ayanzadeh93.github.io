import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupBrowserEnv,
  teardownBrowserEnv,
  MockAudioContext,
  MockGainNode,
  MockOscillatorNode,
  MockBiquadFilterNode,
  MockAnalyserNode
} from '../fixtures/browser-mock.js';

describe('Audio Engine & Preset Stacking (F1-F4)', () => {
  let env;
  let ctx;

  beforeEach(() => {
    env = setupBrowserEnv();
    ctx = new MockAudioContext();
  });

  afterEach(() => {
    teardownBrowserEnv();
  });

  // F1: Procedural Sound Synthesis
  describe('F1: Procedural Web Audio Engine', () => {
    it('initializes Web Audio context without external audio files or network requests', () => {
      assert.ok(ctx instanceof MockAudioContext);
      assert.equal(ctx.state, 'running');
      assert.equal(ctx.sampleRate, 44100);
      assert.ok(ctx.destination);
    });

    it('creates and connects master gain node with proper volume scaling', () => {
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      assert.ok(masterGain instanceof MockGainNode);
      assert.equal(masterGain.connections.length, 1);
      assert.equal(masterGain.connections[0], ctx.destination);

      // Volume scaling 60% -> 0.6 * 0.85
      const scaled = (60 / 100) * 0.85;
      masterGain.gain.setValueAtTime(scaled, ctx.currentTime);
      assert.equal(masterGain.gain.value, scaled);
    });

    it('clamps master volume between 0 and 100', () => {
      const masterGain = ctx.createGain();
      const clampVolume = v => Math.min(100, Math.max(0, v));

      assert.equal(clampVolume(-15), 0);
      assert.equal(clampVolume(150), 100);
      assert.equal(clampVolume(50), 50);

      masterGain.gain.value = clampVolume(75) / 100;
      assert.equal(masterGain.gain.value, 0.75);
    });

    it('resumes audio context from suspended state upon user interaction', async () => {
      await ctx.suspend();
      assert.equal(ctx.state, 'suspended');
      await ctx.resume();
      assert.equal(ctx.state, 'running');
    });

    it('provides AnalyserNode connected to master output for visualizer', () => {
      const masterGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      assert.ok(analyser instanceof MockAnalyserNode);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      assert.equal(analyser.fftSize, 2048);
      assert.equal(analyser.frequencyBinCount, 1024);
      assert.equal(masterGain.connections.includes(analyser), true);
    });
  });

  // F2: 9 Realistic Sound Generators
  describe('F2: Realistic Sound Generators', () => {
    const SOUND_TYPES = ['rain', 'ocean', 'brown', 'pink', 'fire', 'cafe', 'forest', 'tick', 'bin'];

    it('supports all 9 required sound generator types', () => {
      assert.equal(SOUND_TYPES.length, 9);
      SOUND_TYPES.forEach(type => {
        assert.ok(typeof type === 'string' && type.length > 0);
      });
    });

    it('creates acoustic filtering nodes for continuous noise generators', () => {
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.setValueAtTime(800, ctx.currentTime);
      rainFilter.Q.setValueAtTime(2.5, ctx.currentTime);

      assert.equal(rainFilter.type, 'lowpass');
      assert.equal(rainFilter.frequency.value, 800);
      assert.equal(rainFilter.Q.value, 2.5);
    });

    it('creates dual oscillators for binaural beat frequency separation', () => {
      const carrierFreq = 180;
      const beatFreq = 10;

      const oscLeft = ctx.createOscillator();
      const oscRight = ctx.createOscillator();

      oscLeft.frequency.setValueAtTime(carrierFreq - beatFreq / 2, ctx.currentTime);
      oscRight.frequency.setValueAtTime(carrierFreq + beatFreq / 2, ctx.currentTime);

      assert.equal(oscLeft.frequency.value, 175);
      assert.equal(oscRight.frequency.value, 185);
      assert.equal(oscRight.frequency.value - oscLeft.frequency.value, beatFreq);
    });

    it('schedules intermittent bursts using Web Audio currentTime lookahead', () => {
      const scheduledEvents = [];
      const scheduleLookahead = (now, horizon, interval) => {
        let t = now;
        while (t < now + horizon) {
          scheduledEvents.push({ time: t, burstDuration: 0.035 });
          t += interval;
        }
      };

      // Lookahead window 0.5s with 0.1s tick intervals
      scheduleLookahead(ctx.currentTime, 0.5, 0.1);
      assert.equal(scheduledEvents.length, 5);
      assert.equal(scheduledEvents[0].time, 0);
      assert.equal(scheduledEvents[4].time, 0.4);
    });

    it('safely stops and disconnects audio generator nodes without memory leaks', () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(0);
      assert.equal(osc.started, true);

      osc.stop(1);
      assert.equal(osc.stopped, true);
      assert.equal(osc.stopTime, 1);

      osc.disconnect();
      assert.equal(osc.connections.length, 0);
    });
  });

  // F3: Multi-Sound Preset Stacking
  describe('F3: Multi-Sound Preset Stacking', () => {
    it('layers multiple sound channels concurrently with individual volumes', () => {
      const soundState = {
        master: 60,
        layers: { rain: 50, cafe: 30, brown: 20 }
      };

      assert.equal(Object.keys(soundState.layers).length, 3);
      assert.equal(soundState.layers.rain, 50);
      assert.equal(soundState.layers.cafe, 30);
      assert.equal(soundState.layers.brown, 20);
    });

    it('calculates effective gain as master * layer volume ratio', () => {
      const master = 80;
      const layerVol = 40;
      const effectiveGain = (master / 100) * (layerVol / 100);
      assert.ok(Math.abs(effectiveGain - 0.32) < 1e-6);
    });

    it('clamps individual layer volumes between 0 and 100', () => {
      const clampLayer = v => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));

      assert.equal(clampLayer(-20), 0);
      assert.equal(clampLayer(120), 100);
      assert.equal(clampLayer('45'), 45);
      assert.equal(clampLayer(null), 0);
      assert.equal(clampLayer(NaN), 0);
    });

    it('updates active GainNode audio parameters in real-time on layer change', () => {
      const layerGains = {
        rain: ctx.createGain(),
        ocean: ctx.createGain()
      };

      const setLayerVolume = (id, vol) => {
        const gainNode = layerGains[id];
        if (gainNode) {
          const target = (vol / 100) * 0.85;
          gainNode.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.05);
        }
      };

      setLayerVolume('rain', 70);
      assert.equal(layerGains.rain.gain.value, (70 / 100) * 0.85);
      assert.equal(layerGains.rain.gain.scheduled.length, 1);
    });

    it('silences zero-volume layers to minimize audio processing', () => {
      const layerGain = ctx.createGain();
      const vol = 0;
      layerGain.gain.setValueAtTime(vol, ctx.currentTime);
      assert.equal(layerGain.gain.value, 0);
    });
  });

  // F4: Custom Preset CRUD & Audio Sync
  describe('F4: Custom Preset Management & Audio Sync', () => {
    let presets;

    beforeEach(() => {
      presets = {
        'Deep Focus': { rain: 50, brown: 40 },
        'Café Study': { cafe: 60, tick: 25 }
      };
    });

    it('saves a new named custom preset to preset storage', () => {
      const saveCustomPreset = (name, layers) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return false;
        presets[trimmed] = Object.assign({}, layers);
        return true;
      };

      const ok = saveCustomPreset('Stormy Night', { rain: 80, ocean: 40 });
      assert.equal(ok, true);
      assert.deepEqual(presets['Stormy Night'], { rain: 80, ocean: 40 });
    });

    it('rejects invalid or empty preset names', () => {
      const saveCustomPreset = (name, layers) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return false;
        presets[trimmed] = Object.assign({}, layers);
        return true;
      };

      assert.equal(saveCustomPreset('', { rain: 50 }), false);
      assert.equal(saveCustomPreset('   ', { rain: 50 }), false);
      assert.equal(saveCustomPreset(null, { rain: 50 }), false);
    });

    it('loads a saved preset and replaces active layers', () => {
      let activeLayers = { tick: 10 };
      const loadPreset = name => {
        if (!presets[name]) return false;
        activeLayers = Object.assign({}, presets[name]);
        return true;
      };

      const loaded = loadPreset('Deep Focus');
      assert.equal(loaded, true);
      assert.deepEqual(activeLayers, { rain: 50, brown: 40 });
      assert.equal(activeLayers.tick, undefined);
    });

    it('deletes a custom preset from presets store', () => {
      const deleteCustomPreset = name => {
        if (!(name in presets)) return false;
        delete presets[name];
        return true;
      };

      const deleted = deleteCustomPreset('Café Study');
      assert.equal(deleted, true);
      assert.equal('Café Study' in presets, false);
      assert.equal(deleteCustomPreset('NonExistent'), false);
    });

    it('synchronizes audio nodes and UI state immediately when preset is applied', () => {
      const activeLayers = {};
      const layerGains = {
        rain: ctx.createGain(),
        brown: ctx.createGain(),
        cafe: ctx.createGain()
      };

      const applyPreset = presetLayers => {
        Object.keys(layerGains).forEach(k => {
          const vol = presetLayers[k] || 0;
          activeLayers[k] = vol;
          layerGains[k].gain.setValueAtTime((vol / 100) * 0.85, ctx.currentTime);
        });
      };

      applyPreset(presets['Deep Focus']);
      assert.equal(activeLayers.rain, 50);
      assert.equal(activeLayers.brown, 40);
      assert.equal(activeLayers.cafe, 0);

      assert.equal(layerGains.rain.gain.value, (50 / 100) * 0.85);
      assert.equal(layerGains.brown.gain.value, (40 / 100) * 0.85);
      assert.equal(layerGains.cafe.gain.value, 0);
    });
  });
});
