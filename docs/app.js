(() => {
  const ACE_PRESS_SEC = 0.062;
  const BARELY_PRESS_SEC = 0.120;
  const ACE_RELEASE_SEC = 0.075;
  const BARELY_RELEASE_SEC = 0.140;
  const LOOKAHEAD_SEC = 0.09;
  const BPM_DEFAULT = 118.0;

  const titleScreen = document.getElementById("title-screen");
  const gameScreen = document.getElementById("game-screen");
  const btnPlay = document.getElementById("btn-play");
  const btnCalibrate = document.getElementById("btn-calibrate");
  const loadingBar = document.getElementById("loading-bar");
  const titleRecord = document.getElementById("title-record");

  const calOverlay = document.getElementById("cal-overlay");
  const calStatus = document.getElementById("cal-status");
  const calSlider = document.getElementById("cal-slider");
  const btnCalTap = document.getElementById("btn-cal-tap");
  const btnCalClose = document.getElementById("btn-cal-close");

  const practicePill = document.getElementById("practice-pill");
  const hudProgress = document.getElementById("hud-progress");
  const hudCombo = document.getElementById("hud-combo");
  const resultOverlay = document.getElementById("result-overlay");
  const resultRank = document.getElementById("result-rank");
  const resultHeadline = document.getElementById("result-headline");
  const resultStats = document.getElementById("result-stats");

  const titleCanvas = document.getElementById("title-canvas");
  const tCtx = titleCanvas.getContext("2d");
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const tapPad = document.getElementById("tap-pad");

  let audioOffsetMs = Number(localStorage.getItem("os_offset_ms") || 0);
  let bestRecord = JSON.parse(localStorage.getItem("os_best") || "null");
  let chart = null;

  let isRunning = false;
  let isFinished = false;
  let rafId = null;
  let titleRafId = null;
  let startTime = 0;
  let beatSec = 60.0 / BPM_DEFAULT;
  let totalBeats = 144.0;
  let lastTs = 0;
  let lastBeat = -1;
  let clockSec = 0;
  let beatPulse = 0;

  // Stage visual & gameplay state
  let cues = [];
  let targets = [];
  let targetCursor = 0;
  let slackerPose = "slack";
  let poseUntilBeat = -1;
  let slackerBounce = 0;

  let holdActive = false;
  let holdTargetIdx = -1;
  let holdClackStep = -1;

  let glassSpanStart = -1;
  let glassSpanEnd = -1;
  let bossDoorUntil = -1;
  let bossDoorVis = 0;
  let bossPop = 0;

  let blackoutTarget = 0;
  let blackoutAlpha = 0;
  let caughtT = 0;
  let suspiciousT = 0;
  let stampT = 0;
  let shakeAmp = 0;
  let shakeX = 0;
  let shakeY = 0;
  let is1800 = false;
  let particles = [];

  let aceCount = 0;
  let barelyCount = 0;
  let missCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let totalScored = 0;

  // Input state tracking
  let keyHeld = false;
  let activePointerId = null;

  // Calibration state
  let calActive = false;
  let calRaf = null;
  let calStart = 0;
  let calLastBeat = -1;
  let calSamples = [];

  async function initAssets() {
    try {
      const [chartRes] = await Promise.all([
        fetch("data/office_slacker_chart.json?v=7").then((r) => r.json()),
        window.OfficePainter.preloadAll(),
        window.AudioEngine.preloadAll(),
      ]);
      chart = chartRes;
      btnPlay.disabled = false;
      btnPlay.textContent = "开始摸鱼 ▶";
      loadingBar.textContent = "资产加载完成，点击按钮即可激活音频开摸！";
      updateRecordLabel();
      startTitleLoop();
    } catch (err) {
      loadingBar.textContent = `加载失败：${err.message || err}`;
    }
  }

  function updateRecordLabel() {
    btnCalibrate.textContent = `延迟校准 (${audioOffsetMs >= 0 ? "+" : ""}${audioOffsetMs} ms)`;
    if (bestRecord && bestRecord.rank) {
      const medal = bestRecord.perfect ? "  ★摸鱼大师" : "";
      titleRecord.textContent = `历史战绩：${bestRecord.rank} (${bestRecord.acc.toFixed(1)}% · ${bestRecord.combo}连摸)${medal}`;
    } else {
      titleRecord.textContent = "操作：按住 / 轻点屏幕 或 Space / J（听脚步轻点，听咳长按）";
    }
  }

  function startTitleLoop() {
    cancelAnimationFrame(titleRafId);
    const loop = (ts) => {
      if (!titleScreen.classList.contains("active")) return;
      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;
      const t = ts / 1000;
      const bf = t / (60.0 / BPM_DEFAULT);
      const bi = Math.floor(bf);
      if (bi > lastBeat) {
        lastBeat = bi;
        beatPulse = 1.0;
      }
      beatPulse = Math.max(0, beatPulse - dt * 5.2);
      const barPos = bf % 4.0;
      const isWork = barPos >= 3.0 && barPos < 3.85;
      const glassP = barPos < 3.0 ? barPos / 3.0 : -1.0;

      window.OfficePainter.drawScene(tCtx, {
        beatFloat: bf,
        beatPulse,
        clock: t,
        slackerPose: isWork ? "work" : "slack",
        slackerBounce: beatPulse * 2.0,
        glassProgress: glassP,
        bossDoorVis: isWork ? 1.0 : 0.0,
        bossPop: isWork ? Math.max(0, 1.0 - (barPos - 3.0) * 3.0) : 0.0,
        timeStr: "17:58",
      });
      titleRafId = requestAnimationFrame(loop);
    };
    titleRafId = requestAnimationFrame(loop);
  }

  function spawnParticles(ox, oy, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * (0.1 + Math.random() * 0.8);
      const spd = 35 + Math.random() * 80;
      particles.push({
        x: ox + (Math.random() - 0.5) * 12,
        y: oy + (Math.random() - 0.5) * 8,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.28 + Math.random() * 0.27,
        maxLife: 0.55,
        size: 2 + Math.floor(Math.random() * 3),
        color,
      });
    }
  }

  function resetStage() {
    beatSec = 60.0 / (chart.bpm || BPM_DEFAULT);
    totalBeats = chart.total_beats || 144.0;
    cues = (chart.cues || []).map((c) => ({ ...c, firedAudio: false, firedVisual: false }));
    targets = (chart.targets || []).map((t) => ({ ...t, state: "pending" }));
    totalScored = targets.filter((t) => !t.practice).length;
    targetCursor = 0;

    isFinished = false;
    clockSec = 0;
    beatPulse = 0;
    lastBeat = -1;

    slackerPose = "slack";
    poseUntilBeat = -1;
    slackerBounce = 0;

    holdActive = false;
    holdTargetIdx = -1;
    holdClackStep = -1;
    keyHeld = false;
    activePointerId = null;

    glassSpanStart = -1;
    glassSpanEnd = -1;
    bossDoorUntil = -1;
    bossDoorVis = 0;
    bossPop = 0;

    blackoutTarget = 0;
    blackoutAlpha = 0;
    caughtT = 0;
    suspiciousT = 0;
    stampT = 0;
    shakeAmp = 0;
    shakeX = 0;
    shakeY = 0;
    is1800 = false;
    particles = [];

    aceCount = 0;
    barelyCount = 0;
    missCount = 0;
    combo = 0;
    maxCombo = 0;

    practicePill.classList.remove("hidden");
    hudCombo.classList.add("hidden");
    hudProgress.style.width = "0%";
    resultOverlay.classList.add("hidden");
    tapPad.classList.remove("pressed");
  }

  async function startGame() {
    btnPlay.disabled = true;
    await window.AudioEngine.unlockAndDecode();
    btnPlay.disabled = false;

    resetStage();
    titleScreen.classList.remove("active");
    gameScreen.classList.add("active");

    isRunning = true;
    startTime = window.AudioEngine.now() + 0.08;
    window.AudioEngine.startBGM("bgm_main", startTime, false);
    lastTs = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function backToTitle() {
    isRunning = false;
    cancelAnimationFrame(rafId);
    window.AudioEngine.stopBGM();
    gameScreen.classList.remove("active");
    titleScreen.classList.add("active");
    updateRecordLabel();
    startTitleLoop();
  }

  function scheduleAndProcessCues(curAudioTime, curBeat) {
    for (const c of cues) {
      const cueAudioTime = startTime + c.beat * beatSec;
      if (!c.firedAudio && cueAudioTime <= curAudioTime + LOOKAHEAD_SEC) {
        c.firedAudio = true;
        const when = Math.max(curAudioTime, cueAudioTime);
        switch (c.kind) {
          case "count_in":
            window.AudioEngine.playCue("cue_count", when, 0.10);
            break;
          case "step":
            window.AudioEngine.playCue(`cue_step_${Math.min(3, Math.max(1, c.step || 1))}`, when, 0.12);
            break;
          case "cough":
            window.AudioEngine.playCue("cue_cough", when, 0.22);
            break;
          case "hmm_leave":
            window.AudioEngine.playCue("cue_hmm", when, 0.18);
            break;
          case "turnaround":
            window.AudioEngine.playCue("cue_turnaround", when, 0.16);
            break;
          case "blackout_on":
            window.AudioEngine.playBuffer("sfx_power_off", "master", when, 0.88);
            break;
          case "blackout_off":
            window.AudioEngine.playBuffer("sfx_power_on", "master", when, 0.88);
            break;
          case "bell_1800":
            window.AudioEngine.playBuffer("sfx_bell_1800", "master", when, 0.95);
            break;
        }
      }

      if (!c.firedVisual && curBeat >= c.beat) {
        c.firedVisual = true;
        switch (c.kind) {
          case "step":
            glassSpanStart = c.spawn_beat ?? c.beat;
            glassSpanEnd = c.hit_beat ?? (c.beat + 3.0);
            break;
          case "cough":
            glassSpanStart = c.spawn_beat ?? (c.beat - 2.0);
            glassSpanEnd = c.hit_beat ?? (c.beat + 1.0);
            break;
          case "boss_peek":
            bossDoorUntil = c.beat + (c.duration || 0.9);
            bossPop = 1.0;
            glassSpanStart = -1;
            break;
          case "boss_stare":
            bossDoorUntil = c.beat + (c.duration || 3.0) + 0.15;
            bossPop = 1.0;
            glassSpanStart = -1;
            break;
          case "turnaround":
            bossPop = 0.85;
            break;
          case "blackout_on":
            blackoutTarget = 1.0;
            break;
          case "blackout_off":
            blackoutTarget = 0.0;
            break;
          case "practice_done":
            practicePill.classList.add("hidden");
            break;
          case "bell_1800":
            is1800 = true;
            spawnParticles(200, 120, "#73ffa6", 14);
            spawnParticles(270, 130, "#ffe659", 14);
            break;
        }
      }
    }
  }

  function triggerMiss(isPractice, curBeat) {
    holdActive = false;
    holdTargetIdx = -1;
    slackerPose = "caught";
    poseUntilBeat = curBeat + 1.05;
    caughtT = 1.0;
    stampT = 1.0;
    shakeAmp = 10.0;
    bossDoorUntil = Math.max(bossDoorUntil, curBeat + 1.05);
    window.AudioEngine.playBuffer("sfx_caught_stamp", "master", null, 0.92);
    spawnParticles(195, 185, "#ff4d40", 10);
    if (!isPractice) {
      missCount++;
      combo = 0;
      updateComboHud();
    }
  }

  function checkMissedTargets(curSongSec, curBeat) {
    for (let i = targetCursor; i < targets.length; i++) {
      const t = targets[i];
      if (t.state !== "pending") continue;
      const lateLim = t.kind === "hold_release" ? BARELY_RELEASE_SEC : BARELY_PRESS_SEC;
      const targetSec = t.beat * beatSec;
      if (curSongSec > targetSec + lateLim) {
        t.state = "missed";
        targetCursor = i + 1;
        if (t.kind === "hold_start") {
          for (let j = i + 1; j < targets.length; j++) {
            if (targets[j].kind === "hold_release" && targets[j].state === "pending") {
              targets[j].state = "missed";
              break;
            }
          }
        }
        triggerMiss(!!t.practice, curBeat);
      } else {
        break;
      }
    }
  }

  function updateComboHud() {
    if (combo >= 2) {
      hudCombo.textContent = `${combo} 连摸!`;
      hudCombo.classList.remove("hidden");
    } else {
      hudCombo.classList.add("hidden");
    }
  }

  function getSongSeconds(nowCtx) {
    return nowCtx - startTime - audioOffsetMs / 1000.0;
  }

  function handlePress() {
    if (!isRunning || isFinished) return;
    tapPad.classList.add("pressed");
    const songSec = getSongSeconds(window.AudioEngine.now());
    const curBeat = songSec / beatSec;

    let bestIdx = -1;
    let bestErr = Infinity;
    for (let i = targetCursor; i < targets.length; i++) {
      const t = targets[i];
      if (t.state !== "pending" || t.kind === "hold_release") continue;
      const dt = Math.abs(songSec - t.beat * beatSec);
      if (dt <= BARELY_PRESS_SEC && dt < bestErr) {
        bestErr = dt;
        bestIdx = i;
      } else if (t.beat * beatSec - songSec > BARELY_PRESS_SEC + 0.1) {
        break;
      }
    }

    if (bestIdx < 0) {
      slackerBounce = 4.0;
      window.AudioEngine.playFoley("sfx_empty_tap", 0.35, false);
      return;
    }

    const t = targets[bestIdx];
    const dt = Math.abs(songSec - t.beat * beatSec);
    const isAce = dt <= ACE_PRESS_SEC;
    t.state = "hit";
    if (bestIdx === targetCursor) targetCursor = bestIdx + 1;

    slackerBounce = 7.5;
    const chordIdx = t.chord_idx ?? 0;

    if (isAce) {
      slackerPose = "work";
      window.AudioEngine.playFoley("sfx_type_ace", 1.0, true);
      window.AudioEngine.playQuantizedChord(chordIdx, startTime + audioOffsetMs / 1000.0, beatSec);
      spawnParticles(268, 165, "#73ffa6", 10);
      if (!t.practice) {
        aceCount++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
      }
    } else {
      slackerPose = "barely";
      suspiciousT = 0.9;
      window.AudioEngine.playFoley("sfx_barely", 0.85, false);
      spawnParticles(250, 180, "#ffd94d", 6);
      if (!t.practice) {
        barelyCount++;
        combo = 0;
      }
    }

    if (t.kind === "hold_start") {
      holdActive = true;
      holdClackStep = -1;
      poseUntilBeat = (t.end_beat ?? (curBeat + 3.0)) + 0.25;
      for (let j = bestIdx + 1; j < targets.length; j++) {
        if (targets[j].kind === "hold_release" && targets[j].state === "pending") {
          holdTargetIdx = j;
          break;
        }
      }
    } else {
      poseUntilBeat = Math.max(curBeat, t.beat) + 0.90;
    }
    updateComboHud();
  }

  function handleRelease() {
    tapPad.classList.remove("pressed");
    if (!isRunning || isFinished || !holdActive) return;
    holdActive = false;
    if (holdTargetIdx < 0 || holdTargetIdx >= targets.length) return;

    const t = targets[holdTargetIdx];
    if (t.state !== "pending") {
      holdTargetIdx = -1;
      return;
    }

    const songSec = getSongSeconds(window.AudioEngine.now());
    const curBeat = songSec / beatSec;
    const dt = Math.abs(songSec - t.beat * beatSec);

    if (dt <= BARELY_RELEASE_SEC) {
      t.state = "hit";
      targetCursor = Math.max(targetCursor, holdTargetIdx + 1);
      holdTargetIdx = -1;
      slackerPose = "slack";
      poseUntilBeat = -1;
      slackerBounce = 6.0;
      if (dt <= ACE_RELEASE_SEC) {
        window.AudioEngine.playFoley("sfx_crunch", 0.95, false);
        window.AudioEngine.playQuantizedChord(t.chord_idx ?? 0, startTime + audioOffsetMs / 1000.0, beatSec);
        spawnParticles(195, 195, "#ffe059", 9);
        if (!t.practice) {
          aceCount++;
          combo++;
          maxCombo = Math.max(maxCombo, combo);
        }
      } else {
        slackerPose = "barely";
        poseUntilBeat = curBeat + 0.55;
        suspiciousT = 0.85;
        window.AudioEngine.playFoley("sfx_barely", 0.80, false);
        if (!t.practice) {
          barelyCount++;
          combo = 0;
        }
      }
      updateComboHud();
    } else {
      t.state = "missed";
      targetCursor = Math.max(targetCursor, holdTargetIdx + 1);
      triggerMiss(!!t.practice, curBeat);
    }
  }

  function gameLoop(ts) {
    if (!isRunning) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    clockSec += dt;

    const audioNow = window.AudioEngine.now();
    const songSec = getSongSeconds(audioNow);
    const curBeat = songSec / beatSec;

    beatPulse = Math.max(0, beatPulse - dt * 5.2);
    const bi = Math.floor(curBeat);
    if (bi > lastBeat && bi >= 0) {
      lastBeat = bi;
      beatPulse = 1.0;
    }

    slackerBounce = Math.max(0, slackerBounce - dt * 26.0);
    bossPop = Math.max(0, bossPop - dt * 4.0);
    caughtT = Math.max(0, caughtT - dt * 1.1);
    suspiciousT = Math.max(0, suspiciousT - dt * 1.2);
    stampT = Math.max(0, stampT - dt * 1.15);
    blackoutAlpha += (blackoutTarget - blackoutAlpha) * Math.min(1, dt * 8.0);

    if (shakeAmp > 0.1) {
      shakeX = (Math.random() * 2 - 1) * shakeAmp;
      shakeY = (Math.random() * 2 - 1) * shakeAmp;
      shakeAmp = Math.max(0, shakeAmp - dt * 36.0);
    } else {
      shakeX = 0;
      shakeY = 0;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (!isFinished) {
      scheduleAndProcessCues(audioNow, curBeat);
      checkMissedTargets(songSec, curBeat);

      if (holdActive) {
        slackerPose = "work";
        const step = Math.floor(curBeat * 2.0);
        if (step > holdClackStep) {
          holdClackStep = step;
          slackerBounce = 3.0;
          window.AudioEngine.playFoley("sfx_type_clack", 0.42, false);
        }
      } else if (poseUntilBeat > 0 && curBeat >= poseUntilBeat) {
        poseUntilBeat = -1;
        slackerPose = "slack";
      }

      const wantDoor = bossDoorUntil > 0 && curBeat <= bossDoorUntil ? 1.0 : 0.0;
      bossDoorVis += (wantDoor - bossDoorVis) * Math.min(1, dt * 18.0);

      hudProgress.style.width = `${Math.max(0, Math.min(100, (curBeat / totalBeats) * 100)).toFixed(1)}%`;

      if (curBeat >= totalBeats) {
        finishStage();
      }
    }

    const glassP =
      glassSpanStart >= 0 && curBeat >= glassSpanStart && curBeat <= glassSpanEnd
        ? (curBeat - glassSpanStart) / Math.max(0.01, glassSpanEnd - glassSpanStart)
        : -1;
    let timeStr = "17:58";
    if (is1800 || curBeat >= 142.0) timeStr = "18:00";
    else if (curBeat >= 72.0) timeStr = "17:59";

    window.OfficePainter.drawScene(ctx, {
      beatFloat: curBeat,
      beatPulse,
      clock: clockSec,
      slackerPose,
      slackerBounce,
      glassProgress: glassP,
      bossDoorVis,
      bossPop,
      blackoutAlpha,
      caughtT,
      suspiciousT,
      stampT,
      timeStr,
      shakeX,
      shakeY,
      particles,
    });

    rafId = requestAnimationFrame(gameLoop);
  }

  function finishStage() {
    if (isFinished) return;
    isFinished = true;
    isRunning = false;
    window.AudioEngine.stopBGM();

    const total = Math.max(1, totalScored);
    const accuracy = ((aceCount + barelyCount * 0.5) / total) * 100.0;
    let rank = "通宵加班 Try Again";
    let headline = "表格没切快、零食渣没擦干净……今晚工位过夜！";
    let color = "#ff6b6b";

    if (accuracy >= 85.0) {
      rank = "按时下班! Superb";
      headline = "丝滑切屏堪比职业电竞选手，18:00 准点拎包开溜！";
      color = "#6ef59e";
    } else if (accuracy >= 60.0) {
      rank = "勉强打卡 OK";
      headline = "好几次险些被老板当场抓包，幸亏你眼疾手快糊弄过去！";
      color = "#ffe066";
    }

    const isPerfect = missCount === 0 && accuracy >= 95.0;
    if (!bestRecord || accuracy > bestRecord.acc) {
      bestRecord = {
        rank,
        acc: accuracy,
        combo: Math.max(bestRecord?.combo || 0, maxCombo),
        perfect: (bestRecord?.perfect || false) || isPerfect,
      };
      localStorage.setItem("os_best", JSON.stringify(bestRecord));
    } else if (maxCombo > bestRecord.combo || isPerfect) {
      bestRecord.combo = Math.max(bestRecord.combo, maxCombo);
      bestRecord.perfect = bestRecord.perfect || isPerfect;
      localStorage.setItem("os_best", JSON.stringify(bestRecord));
    }

    resultRank.textContent = rank;
    resultRank.style.color = color;
    resultHeadline.textContent = headline;
    resultStats.textContent = `准确率：${accuracy.toFixed(1)}%   ·   最高连摸：${maxCombo}\n完美切换 ${aceCount}   ·   险些露馅 ${barelyCount}   ·   当场抓包 ${missCount}`;
    resultOverlay.classList.remove("hidden");
  }

  // Calibration Modal
  async function openCalibration() {
    await window.AudioEngine.unlockAndDecode();
    calActive = true;
    calSamples = [];
    calSlider.value = String(audioOffsetMs);
    calStart = window.AudioEngine.now() + 0.1;
    calLastBeat = -1;
    calOverlay.classList.remove("hidden");
    updateCalText();

    const calTick = () => {
      if (!calActive) return;
      const elapsed = window.AudioEngine.now() - calStart;
      if (elapsed >= 0) {
        const b = Math.floor(elapsed / beatSec);
        if (b > calLastBeat) {
          calLastBeat = b;
          window.AudioEngine.playCue("cue_step_3", null, 0.08);
        }
      }
      calRaf = requestAnimationFrame(calTick);
    };
    calRaf = requestAnimationFrame(calTick);
  }

  function closeCalibration() {
    calActive = false;
    cancelAnimationFrame(calRaf);
    calOverlay.classList.add("hidden");
    updateRecordLabel();
  }

  function recordCalTap() {
    if (!calActive) return;
    const elapsed = Math.max(0, window.AudioEngine.now() - calStart);
    const nearest = Math.round(elapsed / beatSec);
    const errMs = Math.max(-120, Math.min(120, (elapsed - nearest * beatSec) * 1000));
    calSamples.push(errMs);
    window.AudioEngine.playFoley("sfx_type_ace", 0.9, false);
    if (calSamples.length >= 4) {
      const avg = calSamples.reduce((a, b) => a + b, 0) / calSamples.length;
      audioOffsetMs = Math.max(-120, Math.min(120, Math.round(avg / 5) * 5));
      localStorage.setItem("os_offset_ms", String(audioOffsetMs));
      calSlider.value = String(audioOffsetMs);
      calSamples = [];
    }
    updateCalText();
  }

  function updateCalText() {
    calStatus.textContent = `跟着老板脚步点击按钮或按 Space (${calSamples.length}/4 次)\n当前音频偏移：${audioOffsetMs >= 0 ? "+" : ""}${audioOffsetMs} ms`;
  }

  // Event Bindings (Unified pointer & keyboard support for Tap + Hold-Release)
  btnPlay.addEventListener("click", startGame);
  btnCalibrate.addEventListener("click", openCalibration);
  btnCalTap.addEventListener("click", recordCalTap);
  btnCalClose.addEventListener("click", closeCalibration);
  calSlider.addEventListener("input", () => {
    audioOffsetMs = Number(calSlider.value);
    localStorage.setItem("os_offset_ms", String(audioOffsetMs));
    updateCalText();
  });

  document.getElementById("btn-back").addEventListener("click", backToTitle);
  document.getElementById("btn-menu").addEventListener("click", backToTitle);
  document.getElementById("btn-retry").addEventListener("click", startGame);

  function bindPointerTarget(el) {
    el.addEventListener("pointerdown", (e) => {
      if (!isRunning || isFinished) return;
      e.preventDefault();
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      handlePress();
    });
    const endPointer = (e) => {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      handleRelease();
    };
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);
  }
  bindPointerTarget(tapPad);
  bindPointerTarget(canvas);

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (calActive && (e.code === "Space" || e.code === "KeyJ")) {
      e.preventDefault();
      recordCalTap();
      return;
    }
    if (isRunning && !isFinished && (e.code === "Space" || e.code === "KeyJ")) {
      e.preventDefault();
      if (!keyHeld) {
        keyHeld = true;
        handlePress();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "KeyJ") {
      if (keyHeld) {
        keyHeld = false;
        handleRelease();
      }
    }
  });

  initAssets();
})();
