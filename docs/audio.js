window.AudioEngine = (() => {
  let ctx = null;
  let noiseBuffer = null;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      noiseBuffer = createNoiseBuffer(ctx);
    }
    return ctx;
  }

  async function unlock() {
    const c = ensureContext();
    if (c.state === "suspended") {
      await c.resume();
    }
    // Silent 1-sample buffer to fully unlock iOS Safari
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
    const len = c.sampleRate * 0.25;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function playTone(freq, dur = 0.14, wave = "triangle", vol = 0.28, when = null) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playChord(freqs, dur = 0.22, wave = "triangle", vol = 0.22, when = null) {
    const per = vol / Math.max(1, freqs.length);
    for (const f of freqs) {
      playTone(f, dur, wave, per, when);
    }
  }

  function playKick(when = null, vol = 0.48) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  function playSnare(when = null, vol = 0.3) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
    src.stop(t + 0.14);
  }

  function playHat(when = null, vol = 0.12) {
    const c = ensureContext();
    const t = when ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 4800;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
    src.stop(t + 0.055);
  }

  function playMiss() {
    playTone(115, 0.15, "sawtooth", 0.22);
    playTone(108, 0.15, "sawtooth", 0.18);
  }

  function scheduleBackingHalfBeat(halfIdx, beatSec, style, exactTime) {
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
        playKick(exactTime, 0.42);
      } else {
        playHat(exactTime, 0.13);
      }
      if (beatInBar === 0) {
        playTone(root, beatSec * 0.7, "triangle", 0.2, exactTime);
      } else if (beatInBar === 2) {
        playTone(root * 1.5, beatSec * 0.42, "triangle", 0.16, exactTime);
      }
    } else {
      playHat(exactTime, 0.08);
      if (beatInBar === 3) {
        playTone(root * 1.25, beatSec * 0.35, "triangle", 0.13, exactTime);
      }
    }
  }

  return {
    unlock,
    now,
    playTone,
    playChord,
    playKick,
    playSnare,
    playHat,
    playMiss,
    scheduleBackingHalfBeat,
  };
})();
