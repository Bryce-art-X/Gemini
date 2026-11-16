(() => {
  const PERFECT_WIN = 0.052;
  const GOOD_WIN = 0.110;
  const MISS_WIN = 0.135;
  const LOOKAHEAD_SEC = 0.10;

  const LEFT_ANVIL = { x: 385, y: 505 };
  const RIGHT_ANVIL = { x: 885, y: 505 };
  const SPAWN_POS = { x: 385, y: 466 };
  const LAND_POS = { x: 885, y: 466 };
  const BARREL_POS = { x: 1170, y: 560 };
  const MASTER_FOOT = { x: 210, y: 615 };
  const PLAYER_FOOT = { x: 1040, y: 615 };

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

  const titleCanvas = document.getElementById("title-canvas");
  const tCtx = titleCanvas.getContext("2d");
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const tapPad = document.getElementById("tap-pad");

  let audioOffsetMs = Number(localStorage.getItem("fp_offset_ms") || 0);
  let bestRecord = JSON.parse(localStorage.getItem("fp_best") || "null");
  let chart = null;

  let isRunning = false;
  let isFinished = false;
  let rafId = null;
  let titleRafId = null;
  let startTime = 0;
  let beatSec = 0.5;
  let lastTs = 0;
  let lastBeat = -1;
  let timeSec = 0;
  let beatPulse = 0;
  let hitstopTimer = 0;
  let shakeTrauma = 0;
  let bellowsSqueeze = 0;

  let masterStrikeT = 0;
  let masterWindupT = 0;
  let playerStrikeT = 0;
  let playerBonkT = 0;
  let anvilFlash = 0;
  let masterMood = "normal";
  let playerMood = "normal";
  let moodTimer = 0;

  let isBlackout = false;
  let blackoutAlpha = 0;
  let bulbAngle = 0;
  let bulbVel = 0;
  let bulbSparks = [];

  let barrelWobble = 0;
  let barrelWeapons = [];

  let perfectCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let swordsForged = 0;
  let judgeTimer = null;

  let flyingIngots = [];
  let flyingWeapons = [];
  let scrapIngots = [];
  let sparks = [];

  let calActive = false;
  let calRaf = null;
  let calStart = 0;
  let calLastBeat = -1;
  let calSamples = [];

  async function initAssets() {
    const [chartRes] = await Promise.all([
      fetch("data/forge_pass_chart.json?v=6").then((r) => r.json()),
      AudioEngine.preloadAll(),
    ]);
    chart = chartRes;
    loadingBar.textContent = "母带音频加载完成！点击开始畅玩";
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
    startTitleLoop();
  }

  function startTitleLoop() {
    if (titleRafId) cancelAnimationFrame(titleRafId);
    let prev = performance.now();
    const renderTitle = (ts) => {
      if (!titleScreen.classList.contains("active")) return;
      const dt = Math.min(0.05, (ts - prev) / 1000);
      prev = ts;
      const t = ts / 1000;
      const pulse = Math.pow(1 - ((t * 2) % 1), 3);
      tCtx.clearRect(0, 0, 1280, 720);
      ForgePainter.drawWorkshopBg(tCtx, pulse, t, "normal", Math.sin(t * 1.5) * 0.04, true, pulse * 0.4);
      ForgePainter.drawAnvilStation(tCtx, LEFT_ANVIL.x, LEFT_ANVIL.y, pulse, 0, false, false);
      ForgePainter.drawAnvilStation(tCtx, RIGHT_ANVIL.x, RIGHT_ANVIL.y, pulse, 0, true, false);
      ForgePainter.drawBarrel(tCtx, BARREL_POS.x, BARREL_POS.y, 0, [{ kind: "sword", rot: -0.1 }, { kind: "pan", rot: 0.16 }], false);
      ForgePainter.drawMaster(tCtx, MASTER_FOOT.x, MASTER_FOOT.y, pulse, t, 0, 0, "normal", false);
      ForgePainter.drawPlayer(tCtx, PLAYER_FOOT.x, PLAYER_FOOT.y, pulse, t, 0, 0, "normal", 385, 450, false);
      titleRafId = requestAnimationFrame(renderTitle);
    };
    titleRafId = requestAnimationFrame(renderTitle);
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
    timeSec = 0;
    beatPulse = 0;
    hitstopTimer = 0;
    shakeTrauma = 0;
    bellowsSqueeze = 0;

    masterStrikeT = 0;
    masterWindupT = 0;
    playerStrikeT = 0;
    playerBonkT = 0;
    anvilFlash = 0;
    masterMood = "normal";
    playerMood = "normal";
    moodTimer = 0;

    isBlackout = false;
    blackoutAlpha = 0;
    bulbAngle = 0;
    bulbVel = 0;
    bulbSparks = [];

    barrelWobble = 0;
    barrelWeapons = [];

    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    combo = 0;
    maxCombo = 0;
    swordsForged = 0;
    flyingIngots = [];
    flyingWeapons = [];
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

    if (titleRafId) { cancelAnimationFrame(titleRafId); titleRafId = null; }
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
      const spd = 210 + Math.random() * 260;
      sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.45, size: 7 + Math.random() * 6 });
    }
  }

  function resolveIngot(hitBeat) {
    const fi = flyingIngots.find((it) => !it.resolved && Math.abs(it.hit_beat - hitBeat) < 0.08);
    if (fi) fi.resolved = true;
  }

  function pickWeapon(kind, heavy) {
    if (heavy) return swordsForged % 2 === 0 ? "excalibur" : "pan";
    if (kind === "triple") return combo >= 6 ? "fish" : "sword";
    return swordsForged % 5 === 4 ? "pan" : "sword";
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
    AudioEngine.playFoley("sfx_bonk", 0.92, false);
    playerBonkT = 1.0;
    masterMood = "sideeye";
    moodTimer = 1.1;
    shakeTrauma = 0.35;
  }

  function handleTap() {
    if (!isRunning || isFinished) return;
    tapPad.classList.add("pressed");
    setTimeout(() => tapPad.classList.remove("pressed"), 90);

    playerStrikeT = 1.0;

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
    const kind = bestT.kind || "normal";
    const heavy = kind === "heavy";
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

      hitstopTimer = 0.042;
      shakeTrauma = heavy ? 0.85 : 0.55;
      anvilFlash = 1.0;
      spawnSparks(LAND_POS.x, LAND_POS.y, heavy ? 20 : 14);
      masterMood = "happy";
      playerMood = "happy";
      moodTimer = 0.65;

      if (bestT.finish_sword) {
        if (!isPractice) swordsForged += 1;
        AudioEngine.playFoley("sfx_sword_fly", 0.65, false);
        flyingWeapons.push({
          sx: LAND_POS.x, sy: LAND_POS.y,
          ex: BARREL_POS.x + (Math.random() * 32 - 16), ey: BARREL_POS.y - 42,
          t: 0, kind: pickWeapon(kind, heavy), scale: heavy ? 1.35 : 1.0,
        });
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
      masterMood = "sideeye";
      moodTimer = 0.55;
      scrapIngots.push({ x: LAND_POS.x, y: LAND_POS.y, vx: 140, vy: -200, rot: 0, spin: 9, life: 0.85 });
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
      acc >= 85 ? "“天才打铁匠横空出世！木桶都插满黄金平底锅与圣剑啦！”" :
      acc >= 60 ? "“火候不错，再把三连快传和停电段稳住就是大师了！”" :
      "“脑袋上被铁块砸出好几个大包……多听木鱼与风箱声吧！”";
    const medalTxt = medal ? "   ★获得完美奖章！" : "";
    resultStats.textContent = `准确度：${acc.toFixed(1)}%   神兵入桶：${swordsForged} 件${medalTxt}\nACE: ${perfectCount}    BARELY: ${goodCount}    MISS: ${missCount}\n最大连击：${maxCombo}`;
    resultOverlay.classList.remove("hidden");
  }

  function scheduleCueAudio(c, exactTime) {
    if (c.kind === "count_in") AudioEngine.playCue("cue_hit_1", exactTime, 0.10);
    else if (c.kind === "pass_normal") AudioEngine.playCue("cue_hit_2", exactTime, 0.14);
    else if (c.kind === "pass_triple") AudioEngine.playCue(`cue_hit_${Math.min(3, Math.max(1, c.step || 1))}`, exactTime, 0.12);
    else if (c.kind === "pass_heavy") AudioEngine.playCue("cue_lob", exactTime, 0.35);
    else if (c.kind === "blackout_on") AudioEngine.playBuffer("sfx_bulb_snap", "master", exactTime, 0.9);
    else if (c.kind === "blackout_off") AudioEngine.playBuffer("sfx_power_on", "master", exactTime, 0.85);
  }

  function triggerCueVisual(c) {
    if (c.kind === "pass_normal" || c.kind === "pass_triple") {
      masterStrikeT = 1.0;
      flyingIngots.push({ spawn_beat: c.beat, hit_beat: c.hit_beat, kind: c.kind === "pass_triple" ? "triple" : "normal", blind: Boolean(c.blind), resolved: false });
    } else if (c.kind === "pass_heavy") {
      masterWindupT = 1.0;
      masterStrikeT = 1.0;
      flyingIngots.push({ spawn_beat: c.beat, hit_beat: c.hit_beat, kind: "heavy", blind: Boolean(c.blind), resolved: false });
    } else if (c.kind === "practice_done") {
      practicePill.textContent = "正式演出!";
      setTimeout(() => { practicePill.style.opacity = "0"; }, 1200);
    } else if (c.kind === "blackout_on") {
      isBlackout = true;
      bulbVel = 6.5;
      for (let i = 0; i < 10; i++) {
        bulbSparks.push({ x: 640, y: 128, vx: Math.random() * 360 - 180, vy: Math.random() * 260 - 80, life: 0.45 });
      }
    } else if (c.kind === "blackout_off") {
      isBlackout = false;
      bulbVel = -3.0;
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
      bellowsSqueeze = 1.0;
    }
    hudProgress.style.width = `${Math.max(0, Math.min(100, (curBeat / chart.total_beats) * 100))}%`;

    if (hitstopTimer > 0) {
      hitstopTimer = Math.max(0, hitstopTimer - rawDt);
    } else {
      updatePhysics(rawDt, curBeat);
    }
    drawScene(curBeat);

    if (curBeat >= chart.total_beats) {
      finishStage();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function updatePhysics(dt, curBeat) {
    timeSec += dt;
    beatPulse = Math.max(0, beatPulse - dt * 5.2);
    bellowsSqueeze = Math.max(0, bellowsSqueeze - dt * 4.0);
    blackoutAlpha += ((isBlackout ? 0.93 : 0) - blackoutAlpha) * Math.min(1, dt * 9);
    masterStrikeT = Math.max(0, masterStrikeT - dt * 6.0);
    masterWindupT = Math.max(0, masterWindupT - dt * 2.5);
    playerStrikeT = Math.max(0, playerStrikeT - dt * 6.2);
    playerBonkT = Math.max(0, playerBonkT - dt * 1.1);
    anvilFlash = Math.max(0, anvilFlash - dt * 8.0);
    shakeTrauma = Math.max(0, shakeTrauma - dt * 3.0);

    bulbVel += (-18 * bulbAngle - 1.4 * bulbVel) * dt;
    bulbAngle += bulbVel * dt;
    barrelWobble += (0 - barrelWobble) * Math.min(1, dt * 9);

    if (moodTimer > 0) {
      moodTimer -= dt;
      if (moodTimer <= 0) { masterMood = "normal"; playerMood = "normal"; }
    }

    flyingIngots = flyingIngots.filter((fi) => !fi.resolved && curBeat - fi.hit_beat <= 0.2);

    for (let i = flyingWeapons.length - 1; i >= 0; i--) {
      const fw = flyingWeapons[i];
      fw.t += dt * 2.8;
      if (fw.t >= 1) {
        barrelWobble = 1.0;
        barrelWeapons.push({ kind: fw.kind, rot: Math.random() * 0.56 - 0.28 });
        if (barrelWeapons.length > 14) barrelWeapons.shift();
        flyingWeapons.splice(i, 1);
      }
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
    for (let i = bulbSparks.length - 1; i >= 0; i--) {
      const bs = bulbSparks[i];
      bs.life -= dt; bs.vy += 650 * dt; bs.x += bs.vx * dt; bs.y += bs.vy * dt;
      if (bs.life <= 0) bulbSparks.splice(i, 1);
    }
  }

  function computeIngotPos(fi, curBeat) {
    const t = Math.max(0, Math.min(1.15, (curBeat - fi.spawn_beat) / Math.max(0.05, fi.hit_beat - fi.spawn_beat)));
    const heavy = fi.kind === "heavy";
    const arcH = heavy ? 285 : 170;
    return {
      x: SPAWN_POS.x + (LAND_POS.x - SPAWN_POS.x) * t,
      y: SPAWN_POS.y + (LAND_POS.y - SPAWN_POS.y) * t - 4 * arcH * t * (1 - t),
      t, heavy,
    };
  }

  function drawScene(curBeat) {
    ctx.clearRect(0, 0, 1280, 720);
    const sh = shakeTrauma * shakeTrauma * 15;
    const ox = (Math.random() * 2 - 1) * sh;
    const oy = (Math.random() * 2 - 1) * sh;

    ctx.save();
    ctx.translate(ox, oy);

    ForgePainter.drawWorkshopBg(ctx, beatPulse, timeSec, masterMood, bulbAngle, !isBlackout, bellowsSqueeze);

    if (blackoutAlpha > 0.01) {
      ctx.fillStyle = `rgba(8, 8, 15, ${blackoutAlpha})`;
      ctx.fillRect(-40, -40, 1360, 800);
    }

    const sil = blackoutAlpha > 0.5;
    ForgePainter.drawAnvilStation(ctx, LEFT_ANVIL.x, LEFT_ANVIL.y, beatPulse, 0, false, sil);
    ForgePainter.drawAnvilStation(ctx, RIGHT_ANVIL.x, RIGHT_ANVIL.y, beatPulse, anvilFlash, true, sil);
    ForgePainter.drawBarrel(ctx, BARREL_POS.x, BARREL_POS.y, barrelWobble, barrelWeapons, sil);

    let trackX = SPAWN_POS.x, trackY = SPAWN_POS.y;
    for (const fi of flyingIngots) {
      if (!fi.resolved && !fi.blind) {
        const p = computeIngotPos(fi, curBeat);
        trackX = p.x; trackY = p.y;
        break;
      }
    }

    ForgePainter.drawMaster(ctx, MASTER_FOOT.x, MASTER_FOOT.y, beatPulse, timeSec, masterStrikeT, masterWindupT, masterMood, sil);
    ForgePainter.drawPlayer(ctx, PLAYER_FOOT.x, PLAYER_FOOT.y, beatPulse, timeSec, playerStrikeT, playerBonkT, playerMood, trackX, trackY, sil);

    for (const fi of flyingIngots) {
      if (fi.resolved || fi.blind) continue;
      const p = computeIngotPos(fi, curBeat);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * Math.PI * 2 * (p.heavy ? 1.5 : 1));
      if (p.heavy) ctx.scale(1.4, 1.4);
      ctx.fillStyle = "rgba(255, 115, 26, 0.35)";
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
      ForgePainter.rect(ctx, -26, -11, 52, 22, "#ff701f", 4);
      ctx.fillStyle = "#ffe059";
      ctx.fillRect(-18, -6, 36, 9);
      ctx.restore();
    }

    for (const fw of flyingWeapons) {
      const t = fw.t;
      const x = fw.sx + (fw.ex - fw.sx) * t;
      const y = fw.sy + (fw.ey - fw.sy) * t - 4 * 180 * t * (1 - t);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * Math.PI * 3);
      ForgePainter.drawWeaponShape(ctx, 0, 0, fw.kind, fw.scale, false);
      ctx.restore();
    }

    for (const sc of scrapIngots) {
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.rotate(sc.rot);
      ctx.scale(1.3, 0.45);
      ForgePainter.rect(ctx, -22, -9, 44, 18, "#8c6b66", 3.5);
      ctx.restore();
    }

    for (const sp of sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life / 0.45);
      ForgePainter.star4(ctx, sp.x, sp.y, sp.size, "#ffeb59");
      ctx.restore();
    }

    for (const bs of bulbSparks) {
      ctx.fillStyle = "#fff059";
      ctx.beginPath(); ctx.arc(bs.x, bs.y, Math.max(1, 5 * bs.life * 2), 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

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
