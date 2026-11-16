(() => {
  const PERFECT_WIN = 0.052;
  const GOOD_WIN = 0.110;
  const MISS_WIN = 0.135;
  const LOOKAHEAD_SEC = 0.10;

  const LEFT_ANVIL = { x: 375, y: 534 };
  const RIGHT_ANVIL = { x: 905, y: 534 };
  const SPAWN_POS = { x: 375, y: 470 };
  const LAND_POS = { x: 905, y: 470 };

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
  const judgePopup = document.getElementById("judge-popup");
  const resultOverlay = document.getElementById("result-overlay");
  const resultRank = document.getElementById("result-rank");
  const resultHeadline = document.getElementById("result-headline");
  const resultStats = document.getElementById("result-stats");

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const tapPad = document.getElementById("tap-pad");

  let audioOffsetMs = Number(localStorage.getItem("fp_offset_ms") || 0);
  let bestRecord = JSON.parse(localStorage.getItem("fp_best") || "null");
  let chart = null;
  const imgs = {};

  let isRunning = false;
  let isFinished = false;
  let rafId = null;
  let startTime = 0;
  let beatSec = 0.5;
  let lastTs = 0;
  let lastBeat = -1;
  let beatPulse = 0;
  let hitstopTimer = 0;
  let shakeTrauma = 0;

  let masterStrikeTimer = 0;
  let masterWindupTimer = 0;
  let playerStrikeTimer = 0;
  let masterSmear = 0;
  let playerSmear = 0;
  let anvilFlash = 0;
  let isBlackout = false;
  let blackoutAlpha = 0;
  let mood = null; // { text, bg, timer }

  let perfectCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let swordsForged = 0;
  let judgeTimer = null;

  let flyingIngots = [];
  let flyingSwords = [];
  let scrapIngots = [];
  let sparks = [];

  // Calibration state
  let calActive = false;
  let calRaf = null;
  let calStart = 0;
  let calLastBeat = -1;
  let calSamples = [];

  function loadImg(name, src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => { imgs[name] = im; resolve(); };
      im.onerror = resolve;
      im.src = src;
    });
  }

  async function initAssets() {
    const imgList = [
      ["bg", "assets/forge_bg.png?v=5"],
      ["stump", "assets/stump.png?v=5"],
      ["anvil", "assets/anvil.png?v=5"],
      ["mWind", "assets/master_windup.png?v=5"],
      ["mStrike", "assets/master_strike.png?v=5"],
      ["mWindSil", "assets/master_windup_sil.png?v=5"],
      ["mStrikeSil", "assets/master_strike_sil.png?v=5"],
      ["pReady", "assets/player_ready.png?v=5"],
      ["pReadySil", "assets/player_ready_sil.png?v=5"],
      ["ingotNorm", "assets/ingot_normal.png?v=5"],
      ["ingotHeavy", "assets/ingot_heavy.png?v=5"],
      ["sword", "assets/sword.png?v=5"],
      ["spark", "assets/spark.png?v=5"],
      ["smear", "assets/smear_arc.png?v=5"],
    ];
    const [chartRes] = await Promise.all([
      fetch("data/forge_pass_chart.json?v=5").then((r) => r.json()),
      AudioEngine.preloadAll(),
      ...imgList.map(([k, u]) => loadImg(k, u)),
    ]);
    chart = chartRes;
    loadingBar.textContent = "母带音频与手绘动画加载完成！";
    btnPlay.textContent = "开始锻造 ▶";
    btnPlay.disabled = false;
  }

  function refreshTitleUI() {
    btnCalibrate.textContent = `延迟校准 (${audioOffsetMs >= 0 ? "+" : ""}${audioOffsetMs} ms)`;
    calSlider.value = String(audioOffsetMs);
    if (bestRecord) {
      const medal = bestRecord.medal ? " ★完美奖章" : "";
      titleRecord.textContent = `最佳评价：${bestRecord.rank} (${bestRecord.accuracy.toFixed(1)}% · ${bestRecord.combo}连击)${medal}`;
    } else {
      titleRecord.textContent = "操作：点击屏幕 / Space / J";
    }
  }

  function computeRank(acc) {
    if (acc >= 85) return { text: "超棒! Superb", color: "#ffbf1f" };
    if (acc >= 60) return { text: "合格 OK", color: "#45c766" };
    return { text: "再试试 Try Again", color: "#eb4d55" };
  }

  async function startStage() {
    if (!chart) return;
    btnPlay.disabled = true;
    await AudioEngine.unlockAndDecode();
    btnPlay.disabled = false;

    for (const c of chart.cues) { c.triggered = false; c.audioScheduled = false; }
    for (const t of chart.targets) { t.judged = false; }

    beatSec = 60 / chart.bpm;
    startTime = AudioEngine.now() + 0.15;
    lastTs = performance.now();
    lastBeat = -1;
    beatPulse = 0;
    hitstopTimer = 0;
    shakeTrauma = 0;

    masterStrikeTimer = 0;
    masterWindupTimer = 0;
    playerStrikeTimer = 0;
    masterSmear = 0;
    playerSmear = 0;
    anvilFlash = 0;
    isBlackout = false;
    blackoutAlpha = 0;
    mood = null;

    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    combo = 0;
    maxCombo = 0;
    swordsForged = 0;
    flyingIngots = [];
    flyingSwords = [];
    scrapIngots = [];
    sparks = [];

    isFinished = false;
    isRunning = true;

    practicePill.textContent = "热身练习 (不计分)";
    practicePill.style.opacity = "1";
    hudProgress.style.width = "0%";
    hudCombo.classList.add("hidden");
    judgePopup.classList.add("hidden");
    resultOverlay.classList.add("hidden");

    titleScreen.classList.remove("active");
    gameScreen.classList.add("active");

    AudioEngine.startBGM("bgm_main", startTime, false);

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function goTitle() {
    isRunning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    AudioEngine.stopBGM();
    gameScreen.classList.remove("active");
    titleScreen.classList.add("active");
    refreshTitleUI();
  }

  function showJudge(text, color) {
    judgePopup.textContent = text;
    judgePopup.style.color = color;
    judgePopup.classList.remove("hidden");
    judgePopup.style.transform = "translateX(-50%) scale(1.25)";
    requestAnimationFrame(() => { judgePopup.style.transform = "translateX(-50%) scale(1)"; });
    clearTimeout(judgeTimer);
    judgeTimer = setTimeout(() => judgePopup.classList.add("hidden"), 420);
  }

  function updateCombo() {
    if (combo >= 2) {
      hudCombo.textContent = `${combo} COMBO`;
      hudCombo.classList.remove("hidden");
    } else {
      hudCombo.classList.add("hidden");
    }
  }

  function spawnSparks(x, y, count) {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * (0.05 + Math.random() * 0.9);
      const spd = 200 + Math.random() * 280;
      sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.45, size: 0.45 + Math.random() * 0.5 });
    }
  }

  function resolveIngot(hitBeat) {
    const fi = flyingIngots.find((it) => !it.resolved && Math.abs(it.hit_beat - hitBeat) < 0.08);
    if (fi) fi.resolved = true;
  }

  function registerMiss(t) {
    resolveIngot(t.beat);
    if (t.practice) {
      showJudge("试着跟上!", "#9ebeff");
      return;
    }
    missCount += 1;
    combo = 0;
    updateCombo();
    showJudge("MISS", "#f2525c");
    AudioEngine.playFoley("sfx_miss", 0.85, false);
    mood = { text: "😒 喂...!", bg: "#ff616b", timer: 0.8 };
    scrapIngots.push({ x: LAND_POS.x, y: LAND_POS.y, vx: 70, vy: 60, rot: 0.2, spin: 4, flat: false, life: 0.75 });
  }

  function handleTap() {
    if (!isRunning || isFinished) return;
    tapPad.classList.add("pressed");
    setTimeout(() => tapPad.classList.remove("pressed"), 90);

    playerStrikeTimer = 0.16;
    playerSmear = 1.0;

    const offsetSec = audioOffsetMs / 1000;
    const curSec = AudioEngine.now() - startTime - offsetSec;

    let bestT = null;
    let bestAbs = 999;
    for (const t of chart.targets) {
      if (t.judged) continue;
      const err = Math.abs(curSec - t.beat * beatSec);
      if (err <= MISS_WIN && err < bestAbs) {
        bestAbs = err;
        bestT = t;
      }
    }

    if (!bestT) {
      AudioEngine.playFoley("sfx_barely", 0.28, false);
      return;
    }

    bestT.judged = true;
    const isPractice = Boolean(bestT.practice);
    const heavy = bestT.kind === "heavy";
    resolveIngot(bestT.beat);

    if (bestAbs <= PERFECT_WIN) {
      if (!isPractice) {
        perfectCount += 1;
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
        updateCombo();
      }
      showJudge(isPractice ? "很好! (练习)" : "ACE!", "#ffd938");
      AudioEngine.playFoley(heavy ? "sfx_heavy" : "sfx_ace", 0.95, true);
      AudioEngine.playQuantizedChord(bestT.chord_idx || 0, startTime, beatSec);

      hitstopTimer = 0.045;
      shakeTrauma = heavy ? 0.85 : 0.55;
      anvilFlash = 1.0;
      spawnSparks(LAND_POS.x, LAND_POS.y, heavy ? 20 : 14);
      mood = { text: "👍 超赞!", bg: "#ffe047", timer: 0.7 };

      if (bestT.finish_sword) {
        if (!isPractice) swordsForged += 1;
        AudioEngine.playFoley("sfx_sword_fly", 0.65, false);
        flyingSwords.push({ x: LAND_POS.x, y: LAND_POS.y - 16, vx: 260, vy: -450, rot: -0.25, scale: heavy ? 1.35 : 1.0, life: 1.1 });
      }
    } else if (bestAbs <= GOOD_WIN) {
      if (!isPractice) {
        goodCount += 1;
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
        updateCombo();
      }
      showJudge(isPractice ? "不错 (练习)" : "BARELY", "#9ce868");
      AudioEngine.playFoley("sfx_barely", 0.78, false);
      shakeTrauma = 0.25;
      mood = { text: "❓ 差点!", bg: "#ffb84d", timer: 0.75 };
      scrapIngots.push({ x: LAND_POS.x, y: LAND_POS.y, vx: 120, vy: -180, rot: 0, spin: 8, flat: true, life: 0.8 });
    } else {
      registerMiss(bestT);
    }
  }

  function finishStage() {
    isFinished = true;
    isRunning = false;
    AudioEngine.stopBGM();

    const total = Math.max(1, perfectCount + goodCount + missCount);
    const acc = ((perfectCount + goodCount * 0.65) / total) * 100;
    const rank = computeRank(acc);
    const medal = missCount === 0 && acc >= 95;

    if (!bestRecord || acc > bestRecord.accuracy) {
      bestRecord = { rank: rank.text, accuracy: acc, combo: maxCombo, medal };
      localStorage.setItem("fp_best", JSON.stringify(bestRecord));
    }

    resultRank.textContent = rank.text;
    resultRank.style.color = rank.color;
    resultHeadline.textContent =
      acc >= 85 ? "“天才打铁匠横空出世！停电也能精准铸出名剑！”" :
      acc >= 60 ? "“火候不错，再把三连快传和停电段稳住就是大师了！”" :
      "“师傅看得直斜眼……多听木鱼与飞铁落地的节奏吧！”";
    const medalTxt = medal ? "   ★获得完美奖章！" : "";
    resultStats.textContent = `准确度：${acc.toFixed(1)}%   神兵：${swordsForged} 把${medalTxt}\nACE: ${perfectCount}    BARELY: ${goodCount}    MISS: ${missCount}\n最大连击：${maxCombo}`;
    resultOverlay.classList.remove("hidden");
  }

  function scheduleCueAudio(c, exactTime) {
    if (c.kind === "count_in") AudioEngine.playCue("cue_hit_1", exactTime, 0.10);
    else if (c.kind === "pass_normal") AudioEngine.playCue("cue_hit_2", exactTime, 0.14);
    else if (c.kind === "pass_triple") AudioEngine.playCue(`cue_hit_${Math.min(3, Math.max(1, c.step || 1))}`, exactTime, 0.12);
    else if (c.kind === "pass_heavy") AudioEngine.playCue("cue_lob", exactTime, 0.35);
    else if (c.kind === "blackout_on") AudioEngine.playBuffer("sfx_power_off", "master", exactTime, 0.85);
    else if (c.kind === "blackout_off") AudioEngine.playBuffer("sfx_power_on", "master", exactTime, 0.85);
  }

  function triggerCueVisual(c) {
    if (c.kind === "pass_normal" || c.kind === "pass_triple") {
      masterStrikeTimer = 0.15;
      masterSmear = 1.0;
      flyingIngots.push({ spawn_beat: c.beat, hit_beat: c.hit_beat, kind: c.kind === "pass_triple" ? "triple" : "normal", blind: Boolean(c.blind), resolved: false });
    } else if (c.kind === "pass_heavy") {
      masterWindupTimer = 0.25;
      masterStrikeTimer = 0.18;
      masterSmear = 1.0;
      flyingIngots.push({ spawn_beat: c.beat, hit_beat: c.hit_beat, kind: "heavy", blind: Boolean(c.blind), resolved: false });
    } else if (c.kind === "practice_done") {
      practicePill.textContent = "正式演出!";
      setTimeout(() => { practicePill.style.opacity = "0"; }, 1200);
    } else if (c.kind === "blackout_on") {
      isBlackout = true;
    } else if (c.kind === "blackout_off") {
      isBlackout = false;
    }
  }

  function loop(ts) {
    if (!isRunning) return;
    const rawDt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    const audioNow = AudioEngine.now();
    const offsetSec = audioOffsetMs / 1000;
    const curSec = audioNow - startTime - offsetSec;
    const curBeat = curSec / beatSec;

    const horizonBeat = (audioNow + LOOKAHEAD_SEC - startTime) / beatSec;
    for (const c of chart.cues) {
      if (!c.audioScheduled && c.beat <= horizonBeat) {
        c.audioScheduled = true;
        const exactTime = startTime + c.beat * beatSec;
        if (exactTime >= audioNow - 0.02) scheduleCueAudio(c, exactTime);
      }
      if (!c.triggered && curBeat >= c.beat) {
        c.triggered = true;
        triggerCueVisual(c);
      }
    }

    for (const t of chart.targets) {
      if (!t.judged && curSec - t.beat * beatSec > MISS_WIN) {
        t.judged = true;
        registerMiss(t);
      }
    }

    const bIdx = Math.floor(curBeat);
    if (bIdx > lastBeat && bIdx >= 0) {
      lastBeat = bIdx;
      beatPulse = 1.0;
    }
    beatPulse = Math.max(0, beatPulse - rawDt * 5.2);
    hudProgress.style.width = `${Math.max(0, Math.min(100, (curBeat / chart.total_beats) * 100))}%`;

    if (hitstopTimer > 0) {
      hitstopTimer = Math.max(0, hitstopTimer - rawDt);
    } else {
      updateVisuals(rawDt, curBeat);
    }
    drawScene(curBeat);

    if (curBeat >= chart.total_beats) {
      finishStage();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function updateVisuals(dt, curBeat) {
    blackoutAlpha += ((isBlackout ? 0.94 : 0) - blackoutAlpha) * Math.min(1, dt * 9);
    masterStrikeTimer = Math.max(0, masterStrikeTimer - dt);
    masterWindupTimer = Math.max(0, masterWindupTimer - dt);
    playerStrikeTimer = Math.max(0, playerStrikeTimer - dt);
    masterSmear = Math.max(0, masterSmear - dt * 10);
    playerSmear = Math.max(0, playerSmear - dt * 10);
    anvilFlash = Math.max(0, anvilFlash - dt * 8);
    shakeTrauma = Math.max(0, shakeTrauma - dt * 3);
    if (mood) {
      mood.timer -= dt;
      if (mood.timer <= 0) mood = null;
    }

    flyingIngots = flyingIngots.filter((fi) => !fi.resolved && curBeat - fi.hit_beat <= 0.2);

    for (let i = flyingSwords.length - 1; i >= 0; i--) {
      const sw = flyingSwords[i];
      sw.life -= dt; sw.vy += 780 * dt; sw.x += sw.vx * dt; sw.y += sw.vy * dt; sw.rot += 5.2 * dt;
      if (sw.life <= 0) flyingSwords.splice(i, 1);
    }
    for (let i = scrapIngots.length - 1; i >= 0; i--) {
      const sc = scrapIngots[i];
      sc.life -= dt; sc.vy += 820 * dt; sc.x += sc.vx * dt; sc.y += sc.vy * dt; sc.rot += sc.spin * dt;
      if (sc.life <= 0) scrapIngots.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.life -= dt; sp.vy += 780 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      if (sp.life <= 0) sparks.splice(i, 1);
    }
  }

  function drawCentered(im, x, y, sx = 1, sy = 1, rot = 0, flipX = false, anchorBottom = false) {
    if (!im) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(flipX ? -sx : sx, sy);
    const oy = anchorBottom ? -im.height : -im.height * 0.5;
    ctx.drawImage(im, -im.width * 0.5, oy);
    ctx.restore();
  }

  function drawScene(curBeat) {
    ctx.clearRect(0, 0, 1280, 720);
    const sh = shakeTrauma * shakeTrauma * 15;
    const ox = (Math.random() * 2 - 1) * sh;
    const oy = (Math.random() * 2 - 1) * sh;

    ctx.save();
    ctx.translate(ox, oy);

    if (imgs.bg) ctx.drawImage(imgs.bg, 0, 0, 1280, 720);
    if (beatPulse > 0.02) {
      ctx.fillStyle = `rgba(255, 132, 36, ${beatPulse * 0.12})`;
      ctx.fillRect(0, 0, 1280, 720);
    }
    if (blackoutAlpha > 0.01) {
      ctx.fillStyle = `rgba(8, 8, 15, ${blackoutAlpha})`;
      ctx.fillRect(-30, -30, 1340, 780);
    }

    const sil = blackoutAlpha > 0.5;
    const bopX = 1 + beatPulse * 0.06;
    const bopY = 1 - beatPulse * 0.06;

    // Anvils & Stumps
    drawCentered(imgs.stump, LEFT_ANVIL.x, LEFT_ANVIL.y + 88, bopX, bopY);
    drawCentered(imgs.anvil, LEFT_ANVIL.x, LEFT_ANVIL.y, bopX, bopY);
    drawCentered(imgs.stump, RIGHT_ANVIL.x, RIGHT_ANVIL.y + 88, bopX, bopY);
    drawCentered(imgs.anvil, RIGHT_ANVIL.x, RIGHT_ANVIL.y, bopX, bopY, 0, true);
    if (anvilFlash > 0.05) {
      ctx.save();
      ctx.globalAlpha = anvilFlash * 0.65;
      ctx.fillStyle = "#fff8c4";
      ctx.beginPath();
      ctx.arc(RIGHT_ANVIL.x, RIGHT_ANVIL.y - 10, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Master & Player
    if (masterStrikeTimer > 0) {
      drawCentered(sil ? imgs.mStrikeSil : imgs.mStrike, 185, 650, 1.08, 0.92, 0.05, false, true);
    } else {
      const mRot = masterWindupTimer > 0 ? -0.10 : 0;
      drawCentered(sil ? imgs.mWindSil : imgs.mWind, 185, 650, bopX, bopY, mRot, false, true);
    }

    if (playerStrikeTimer > 0) {
      const p = playerStrikeTimer / 0.16;
      drawCentered(sil ? imgs.pReadySil : imgs.pReady, 1095, 650, 1.16, 0.86, -0.31 * p, false, true);
    } else {
      drawCentered(sil ? imgs.pReadySil : imgs.pReady, 1095, 650, bopX, bopY, 0, false, true);
    }

    if (masterSmear > 0.05 && imgs.smear) {
      ctx.save(); ctx.globalAlpha = masterSmear;
      drawCentered(imgs.smear, LEFT_ANVIL.x - 20, LEFT_ANVIL.y - 60);
      ctx.restore();
    }
    if (playerSmear > 0.05 && imgs.smear) {
      ctx.save(); ctx.globalAlpha = playerSmear;
      drawCentered(imgs.smear, RIGHT_ANVIL.x + 20, RIGHT_ANVIL.y - 60, 1, 1, 0, true);
      ctx.restore();
    }

    // Parabolic Flying Ingots
    for (const fi of flyingIngots) {
      if (fi.resolved || fi.blind) continue;
      const t = Math.max(0, Math.min(1.15, (curBeat - fi.spawn_beat) / Math.max(0.05, fi.hit_beat - fi.spawn_beat)));
      const heavy = fi.kind === "heavy";
      const arcH = heavy ? 285 : 170;
      const x = SPAWN_POS.x + (LAND_POS.x - SPAWN_POS.x) * t;
      const y = SPAWN_POS.y + (LAND_POS.y - SPAWN_POS.y) * t - 4 * arcH * t * (1 - t);
      const rot = t * Math.PI * 2 * (heavy ? 1.5 : 1.0);
      drawCentered(heavy ? imgs.ingotHeavy : imgs.ingotNorm, x, y, 1, 1, rot);
    }

    for (const sw of flyingSwords) {
      drawCentered(imgs.sword, sw.x, sw.y, sw.scale, sw.scale, sw.rot);
    }
    for (const sc of scrapIngots) {
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, sc.life * 2));
      drawCentered(imgs.ingotNorm, sc.x, sc.y, sc.flat ? 1.25 : 0.85, sc.flat ? 0.45 : 0.85, sc.rot);
      ctx.restore();
    }
    for (const sp of sparks) {
      ctx.save(); ctx.globalAlpha = Math.max(0, sp.life / 0.45);
      drawCentered(imgs.spark, sp.x, sp.y, sp.size, sp.size);
      ctx.restore();
    }

    // Master Reaction Comic Bubble
    if (mood) {
      ctx.save();
      ctx.translate(220, 235);
      ctx.fillStyle = mood.bg;
      ctx.strokeStyle = "#111116";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-58, -24, 116, 44, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111116";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(mood.text, 0, 5);
      ctx.restore();
    }

    ctx.restore();
  }

  // Calibration modal logic
  async function openCalibration() {
    await AudioEngine.unlockAndDecode();
    calSamples = [];
    calActive = true;
    calStart = AudioEngine.now() + 0.15;
    calLastBeat = -1;
    calOverlay.classList.remove("hidden");
    updateCalText();
    const calLoop = () => {
      if (!calActive) return;
      const elapsed = AudioEngine.now() - calStart;
      const b = Math.floor(elapsed / 0.5);
      if (b > calLastBeat && b >= 0) {
        calLastBeat = b;
        AudioEngine.playBuffer("cue_hit_2", "cue", null, 0.9);
      }
      calRaf = requestAnimationFrame(calLoop);
    };
    calRaf = requestAnimationFrame(calLoop);
  }

  function closeCalibration() {
    calActive = false;
    if (calRaf) cancelAnimationFrame(calRaf);
    calOverlay.classList.add("hidden");
    refreshTitleUI();
  }

  function recordCalTap() {
    if (!calActive) return;
    const elapsed = AudioEngine.now() - calStart;
    const nearest = Math.round(elapsed / 0.5);
    const errMs = Math.max(-120, Math.min(120, (elapsed - nearest * 0.5) * 1000));
    calSamples.push(errMs);
    AudioEngine.playBuffer("sfx_ace", "player", null, 0.8);
    if (calSamples.length >= 4) {
      const avg = Math.round((calSamples.reduce((a, b) => a + b, 0) / calSamples.length) / 5) * 5;
      audioOffsetMs = Math.max(-120, Math.min(120, avg));
      localStorage.setItem("fp_offset_ms", String(audioOffsetMs));
      calSlider.value = String(audioOffsetMs);
      calSamples = [];
    }
    updateCalText();
  }

  function updateCalText() {
    calStatus.textContent = `跟着木鱼鼓点敲击 (${calSamples.length}/4 次)\n当前偏移：${audioOffsetMs >= 0 ? "+" : ""}${audioOffsetMs} ms`;
  }

  calSlider.addEventListener("input", () => {
    audioOffsetMs = Number(calSlider.value);
    localStorage.setItem("fp_offset_ms", String(audioOffsetMs));
    updateCalText();
  });

  btnPlay.addEventListener("click", startStage);
  btnCalibrate.addEventListener("click", openCalibration);
  btnCalTap.addEventListener("pointerdown", (e) => { e.preventDefault(); recordCalTap(); });
  btnCalClose.addEventListener("click", closeCalibration);

  document.getElementById("btn-back").addEventListener("click", goTitle);
  document.getElementById("btn-menu").addEventListener("click", goTitle);
  document.getElementById("btn-retry").addEventListener("click", startStage);

  tapPad.addEventListener("pointerdown", (e) => { e.preventDefault(); handleTap(); });
  canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); handleTap(); });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (calActive && (e.code === "Space" || e.code === "KeyJ")) {
      e.preventDefault();
      recordCalTap();
      return;
    }
    if (e.code === "Space" || e.code === "KeyJ") {
      if (isRunning && !isFinished) { e.preventDefault(); handleTap(); }
    } else if (e.code === "Escape") {
      if (calActive) closeCalibration();
      else if (gameScreen.classList.contains("active")) goTitle();
    }
  });

  refreshTitleUI();
  initAssets();
})();
