window.AudioEngine = (() => {
  let ctx = null;
  let noiseBuffer = null;

  // 3 isolated acoustic buses
  let bgmFilter = null;
  let bgmGain = null;
  let cuePan = null;
  let cueGain = null;
  let playerPan = null;
  let playerGain = null;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      noiseBuffer = createNoiseBuffer(ctx);

      // 1. BGM Groove Bed (< 900Hz warm low-mid bed + sidechain ducking)
      bgmFilter = ctx.createBiquadFilter();
      bgmFilter.type = "lowpass";
      bgmFilter.frequency.value = 880;
      bgmFilter.Q.value = 0.7;

      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.85;
      bgmFilter.connect(bgmGain);
      bgmGain.connect(ctx.destination);

      // 2. Teacher Cue Bus (Pan Left -0.32, bright 1.5kHz-4kHz presence)
      cuePan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      cueGain = ctx.createGain();
      cueGain.gain.value = 1.0;
      if (cuePan) {
        cuePan.pan.value = -0.32;
        cueGain.connect(cuePan);
        cuePan.connect(ctx.destination);
      } else {
        cueGain.connect(ctx.destination);
      }

      // 3. Player Hit & Foley Bus (Pan Right +0.25)
      playerPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      playerGain = ctx.createGain();
      playerGain.gain.value = 1.0;
      if (playerPan) {
        playerPan.pan.value = 0.25;
        playerGain.connect(playerPan);
        playerPan.connect(ctx.destination);
      } else {
        playerGain.connect(ctx.destination);
      }
    }
    return ctx;
  }

  async function unlock() {
    const c = ensureContext();
    if (c.state === "suspended") {
      await c.resume();
    }
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    return c;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function createNoiseBuffer(c) {
    const len = c.sampleRate * 0.35;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // Aggressive 3ms Sidechain Ducking (-14dB) on BGM bus
  function duckBGM(when = null, holdSec = 0.16) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    bgmGain.gain.cancelScheduledValues(t);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, t);
    bgmGain.gain.linearRampToValueAtTime(0.18, t + 0.003);
    bgmGain.gain.linearRampToValueAtTime(0.85, t + 0.003 + holdSec);
  }

  // Dual-layer Teacher Cue: Woodblock/Cowbell 12ms Transient + Vocal Formant
  function playTeacherCue(pitchHz = 620, formantHz = 1750, dur = 0.13, when = null, isOffbeat = false) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    duckBGM(t, 0.16);

    // Layer 1: Crisp Woodblock / Cowbell Transient (12ms)
    const clickOsc = c.createOscillator();
    const clickGain = c.createGain();
    clickOsc.type = isOffbeat ? "square" : "triangle";
    clickOsc.frequency.setValueAtTime(isOffbeat ? 2100 : 1680, t);
    clickOsc.frequency.exponentialRampToValueAtTime(isOffbeat ? 1150 : 880, t + 0.016);
    clickGain.gain.setValueAtTime(0.32, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    clickOsc.connect(clickGain);
    clickGain.connect(cueGain);
    clickOsc.start(t);
    clickOsc.stop(t + 0.03);

    // Layer 2: Vocal Formant Body (Sawtooth through Bandpass Formant)
    const vOsc = c.createOscillator();
    const vFilter = c.createBiquadFilter();
    const vGain = c.createGain();
    vOsc.type = "sawtooth";
    vOsc.frequency.setValueAtTime(pitchHz, t);
    vFilter.type = "bandpass";
    vFilter.frequency.setValueAtTime(formantHz, t);
    vFilter.Q.value = 3.2;

    vGain.gain.setValueAtTime(0.0001, t);
    vGain.gain.linearRampToValueAtTime(0.42, t + 0.008);
    vGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    vOsc.connect(vFilter);
    vFilter.connect(vGain);
    vGain.connect(cueGain);
    vOsc.start(t);
    vOsc.stop(t + dur + 0.02);
  }

  // Rising pitch wind-up cue for heavy 2-beat charge strikes
  function playChargeCue(startHz = 280, endHz = 560, dur = 0.45, when = null) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    duckBGM(t, dur * 0.8);

    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + dur);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + dur);
    filter.Q.value = 2.5;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(cueGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 0ms Physical Anvil / Hammer Foley + Sub-bass Punch
  function playAnvilFoley(grade = "perfect", heavy = false) {
    const c = ensureContext();
    const t = c.currentTime;

    if (grade === "perfect") {
      duckBGM(t, 0.18);
      // Sub-bass punch (65Hz-110Hz)
      const sub = c.createOscillator();
      const subGain = c.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(heavy ? 120 : 145, t);
      sub.frequency.exponentialRampToValueAtTime(heavy ? 42 : 55, t + 0.14);
      subGain.gain.setValueAtTime(heavy ? 0.65 : 0.48, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      sub.connect(subGain);
      subGain.connect(playerGain);
      sub.start(t);
      sub.stop(t + 0.2);

      // Metallic Anvil Ring (3kHz-5kHz)
      const metalFreqs = heavy ? [1180, 1760, 2640] : [1480, 2210, 3320];
      for (const f of metalFreqs) {
        const m = c.createOscillator();
        const mg = c.createGain();
        m.type = "triangle";
        m.frequency.setValueAtTime(f, t);
        mg.gain.setValueAtTime(0.14, t);
        mg.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.28 : 0.18));
        m.connect(mg);
        mg.connect(playerGain);
        m.start(t);
        m.stop(t + 0.3);
      }

      // Crisp noise click
      const nSrc = c.createBufferSource();
      nSrc.buffer = noiseBuffer;
      const nFilt = c.createBiquadFilter();
      nFilt.type = "highpass";
      nFilt.frequency.value = 3200;
      const nGain = c.createGain();
      nGain.gain.setValueAtTime(0.32, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      nSrc.connect(nFilt);
      nFilt.connect(nGain);
      nGain.connect(playerGain);
      nSrc.start(t);
      nSrc.stop(t + 0.04);
    } else {
      // Barely: dull muffled thud without sub-bass or ring
      const thud = c.createOscillator();
      const tg = c.createGain();
      thud.type = "triangle";
      thud.frequency.setValueAtTime(210, t);
      thud.frequency.exponentialRampToValueAtTime(95, t + 0.09);
      tg.gain.setValueAtTime(0.24, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      thud.connect(tg);
      tg.connect(playerGain);
      thud.start(t);
      thud.stop(t + 0.12);
    }
  }

  // Quantize Resolution Harmony to nearest 16th-note hardware grid
  function playQuantizedChord(freqs, startTime, beatSec, dur = 0.24, vol = 0.26) {
    const c = ensureContext();
    const grid = beatSec / 4;
    const elapsed = Math.max(0, c.currentTime - startTime);
    const nearestIdx = Math.round(elapsed / grid);
    const quantizedWhen = Math.max(c.currentTime, startTime + nearestIdx * grid);
    playChord(freqs, dur, "triangle", vol, quantizedWhen, playerGain);
  }

  function playTone(freq, dur = 0.14, wave = "triangle", vol = 0.28, when = null, dest = null) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(dest || cueGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playChord(freqs, dur = 0.22, wave = "triangle", vol = 0.22, when = null, dest = null) {
    const per = vol / Math.max(1, freqs.length);
    for (const f of freqs) {
      playTone(f, dur, wave, per, when, dest || playerGain);
    }
  }

  function playKick(when = null, vol = 0.45) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(bgmFilter);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  function playSnare(when = null, vol = 0.28) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 950;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(bgmFilter);
    src.start(t);
    src.stop(t + 0.13);
  }

  function playHat(when = null, vol = 0.11) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 4500;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(bgmFilter);
    src.start(t);
    src.stop(t + 0.05);
  }

  function playMiss() {
    playTone(125, 0.16, "sawtooth", 0.24, null, playerGain);
    playTone(116, 0.16, "sawtooth", 0.20, null, playerGain);
  }

  // Missing Instrument Principle: omit snare/hit on player resolution beats!
  function scheduleBackingHalfBeat(halfIdx, beatSec, style, exactTime, hasPlayerTargetOnHalf = false) {
    const isFullBeat = halfIdx % 2 === 0;
    const beat = Math.floor(halfIdx / 2);
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;

    const bassMap = {
      forge: [110.0, 110.0, 130.81, 146.83],
      factory: [130.81, 146.83, 164.81, 146.83],
      choir: [146.83, 130.81, 110.0, 123.47],
    };
    const roots = bassMap[style] || bassMap.forge;
    const root = roots[bar % roots.length];

    if (isFullBeat) {
      if (beatInBar === 0 || beatInBar === 2) {
        playKick(exactTime, 0.44);
      } else if (!hasPlayerTargetOnHalf) {
        // Snare/hat deliberately omitted when player must supply the resolution beat!
        playHat(exactTime, 0.14);
      }
      if (beatInBar === 0) {
        playTone(root, beatSec * 0.72, "triangle", 0.22, exactTime, bgmFilter);
      } else if (beatInBar === 2) {
        playTone(root * 1.5, beatSec * 0.42, "triangle", 0.18, exactTime, bgmFilter);
      }
    } else {
      if (!hasPlayerTargetOnHalf) {
        playHat(exactTime, 0.08);
      }
      if (beatInBar === 3) {
        playTone(root * 1.25, beatSec * 0.35, "triangle", 0.14, exactTime, bgmFilter);
      }
    }
  }

  return {
    unlock,
    now,
    duckBGM,
    playTeacherCue,
    playChargeCue,
    playAnvilFoley,
    playQuantizedChord,
    playTone,
    playChord,
    playKick,
    playSnare,
    playHat,
    playMiss,
    scheduleBackingHalfBeat,
  };
})();
