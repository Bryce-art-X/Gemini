window.AudioEngine = (() => {
  let ctx = null;
  let bgmGain = null;
  let cueGain = null;
  let playerGain = null;
  const buffers = {};
  const rawBytes = {};
  let bgmSource = null;
  let loaded = false;

  const ASSET_URLS = {
    bgm_main: "assets/audio/bgm_main.mp3?v=7",
    bgm_title: "assets/audio/bgm_title.mp3?v=7",
    cue_step_1: "assets/audio/cue_step_1.wav?v=7",
    cue_step_2: "assets/audio/cue_step_2.wav?v=7",
    cue_step_3: "assets/audio/cue_step_3.wav?v=7",
    cue_count: "assets/audio/cue_count.wav?v=7",
    cue_cough: "assets/audio/cue_cough.wav?v=7",
    cue_hmm: "assets/audio/cue_hmm.wav?v=7",
    cue_turnaround: "assets/audio/cue_turnaround.wav?v=7",
    sfx_type_ace: "assets/audio/sfx_type_ace.wav?v=7",
    sfx_type_clack: "assets/audio/sfx_type_clack.wav?v=7",
    sfx_empty_tap: "assets/audio/sfx_empty_tap.wav?v=7",
    sfx_crunch: "assets/audio/sfx_crunch.wav?v=7",
    sfx_barely: "assets/audio/sfx_barely.wav?v=7",
    sfx_caught_stamp: "assets/audio/sfx_caught_stamp.wav?v=7",
    sfx_power_off: "assets/audio/sfx_power_off.wav?v=7",
    sfx_power_on: "assets/audio/sfx_power_on.wav?v=7",
    sfx_bell_1800: "assets/audio/sfx_bell_1800.wav?v=7",
    chord_0: "assets/audio/chord_0.wav?v=7",
    chord_1: "assets/audio/chord_1.wav?v=7",
    chord_2: "assets/audio/chord_2.wav?v=7",
    chord_3: "assets/audio/chord_3.wav?v=7",
    chord_4: "assets/audio/chord_4.wav?v=7",
    chord_5: "assets/audio/chord_5.wav?v=7",
    chord_6: "assets/audio/chord_6.wav?v=7",
    chord_7: "assets/audio/chord_7.wav?v=7",
  };

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();

      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.88;
      bgmGain.connect(ctx.destination);

      cueGain = ctx.createGain();
      cueGain.gain.value = 1.0;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = 0.28; // Boss footsteps & doorway on the right
        cueGain.connect(p);
        p.connect(ctx.destination);
      } else {
        cueGain.connect(ctx.destination);
      }

      playerGain = ctx.createGain();
      playerGain.gain.value = 1.0;
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = -0.22; // Desk, keyboard & snacks on the left
        playerGain.connect(p);
        p.connect(ctx.destination);
      } else {
        playerGain.connect(ctx.destination);
      }
    }
    return ctx;
  }

  async function preloadAll() {
    if (loaded) return;
    const entries = Object.entries(ASSET_URLS);
    await Promise.all(
      entries.map(async ([key, url]) => {
        const res = await fetch(url);
        rawBytes[key] = await res.arrayBuffer();
      })
    );
    loaded = true;
  }

  async function unlockAndDecode() {
    const c = ensureContext();
    if (c.state === "suspended") {
      await c.resume();
    }
    const keys = Object.keys(rawBytes);
    await Promise.all(
      keys.map(async (k) => {
        if (!buffers[k] && rawBytes[k]) {
          buffers[k] = await c.decodeAudioData(rawBytes[k].slice(0));
        }
      })
    );
    return c;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function duckBGM(when = null, holdSec = 0.16) {
    if (!bgmGain || !ctx) return;
    const t = when ?? ctx.currentTime;
    bgmGain.gain.cancelScheduledValues(t);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, t);
    bgmGain.gain.linearRampToValueAtTime(0.24, t + 0.004);
    bgmGain.gain.linearRampToValueAtTime(0.88, t + 0.004 + holdSec);
  }

  function startBGM(key, when, loop = false) {
    stopBGM();
    if (!ctx || !buffers[key]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[key];
    src.loop = loop;
    src.connect(bgmGain);
    src.start(when);
    bgmSource = src;
  }

  function stopBGM() {
    if (bgmSource) {
      try { bgmSource.stop(); } catch (_) {}
      bgmSource = null;
    }
  }

  function playBuffer(key, bus = "master", when = null, gainVal = 1.0) {
    if (!ctx || !buffers[key]) return;
    const t = when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffers[key];
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(g);
    if (bus === "cue") g.connect(cueGain);
    else if (bus === "player") g.connect(playerGain);
    else g.connect(ctx.destination);
    src.start(t);
  }

  function playCue(key, when, holdDuck = 0.15) {
    duckBGM(when, holdDuck);
    playBuffer(key, "cue", when, 0.92);
  }

  function playFoley(key, gainVal = 1.0, duck = false) {
    if (duck) duckBGM(null, 0.18);
    playBuffer(key, "player", null, gainVal);
  }

  function playQuantizedChord(chordIdx, startTime, beatSec) {
    if (!ctx) return;
    const grid = beatSec * 0.25;
    const elapsed = Math.max(0, ctx.currentTime - startTime);
    const nearest = Math.round(elapsed / grid);
    const when = Math.max(ctx.currentTime, startTime + nearest * grid);
    playBuffer(`chord_${chordIdx}`, "player", when, 0.72);
  }

  return {
    preloadAll,
    unlockAndDecode,
    now,
    startBGM,
    stopBGM,
    playBuffer,
    playCue,
    playFoley,
    playQuantizedChord,
  };
})();
