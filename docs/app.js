(() => {
  const PERFECT_WIN = 0.055;
  const GOOD_WIN = 0.112;
  const MISS_WIN = 0.14;
  const LOOKAHEAD_SEC = 0.09;

  const menuScreen = document.getElementById("menu-screen");
  const gameScreen = document.getElementById("game-screen");
  const stageCardsEl = document.getElementById("stage-cards");
  const offsetSlider = document.getElementById("offset-slider");
  const offsetValueEl = document.getElementById("offset-value");

  const hudTitle = document.getElementById("hud-title");
  const hudBpm = document.getElementById("hud-bpm");
  const hudProgress = document.getElementById("hud-progress");
  const hudCombo = document.getElementById("hud-combo");
  const judgePopup = document.getElementById("judge-popup");
  const resultOverlay = document.getElementById("result-overlay");
  const resultRank = document.getElementById("result-rank");
  const resultStats = document.getElementById("result-stats");

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const tapPad = document.getElementById("tap-pad");

  let audioOffsetMs = Number(localStorage.getItem("rh_offset_ms") || 0);
  let records = JSON.parse(localStorage.getItem("rh_records") || "{}");

  let activeMeta = null;
  let controller = null;
  let rafId = null;
  let isRunning = false;
  let isFinished = false;

  let startTime = 0;
  let beatSec = 0.5;
  let lastFrameTime = 0;
  let nextHalfBeat = 0;
  let lastVisualBeat = -1;
  let beatPulse = 0;

  let perfectCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let judgeTimer = null;

  offsetSlider.value = String(audioOffsetMs);
  offsetValueEl.textContent = `${audioOffsetMs >= 0 ? "+" : ""}${audioOffsetMs} ms`;
  offsetSlider.addEventListener("input", () => {
    audioOffsetMs = Number(offsetSlider.value);
    offsetValueEl.textContent = `${audioOffsetMs >= 0 ? "+" : ""}${audioOffsetMs} ms`;
    localStorage.setItem("rh_offset_ms", String(audioOffsetMs));
  });

  function computeRank(acc) {
    if (acc >= 85) return { text: "超棒! Superb", color: "#ffd84d" };
    if (acc >= 60) return { text: "合格 OK", color: "#6ee88c" };
    return { text: "再试试 Try Again", color: "#f26b6b" };
  }

  function renderMenu() {
    stageCardsEl.innerHTML = "";
    for (const st of window.STAGES_META) {
      const card = document.createElement("div");
      card.className = "stage-card";
      card.style.setProperty("--accent", st.accent);

      const rec = records[st.id];
      const recText = rec
        ? `最佳成绩：${rec.rank} (${rec.accuracy.toFixed(1)}%)`
        : "最佳成绩：尚未挑战";

      card.innerHTML = `
        <h2>${st.title}</h2>
        <div class="stage-meta">${st.subtitle} • ${st.bpm} BPM</div>
        <div class="stage-desc">${st.description}</div>
        <div class="stage-record ${rec ? "" : "empty"}">${recText}</div>
        <button class="btn-play" type="button">开始演出 ▶</button>
      `;

      card.querySelector(".btn-play").addEventListener("click", () => startStage(st));
      stageCardsEl.appendChild(card);
    }
  }

  async function startStage(meta) {
    await AudioEngine.unlock();
    activeMeta = meta;
    controller = window.createStageController(meta.id);

    beatSec = 60 / meta.bpm;
    startTime = AudioEngine.now() + 0.12;
    lastFrameTime = performance.now();
    nextHalfBeat = 0;
    lastVisualBeat = -1;
    beatPulse = 0;

    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    combo = 0;
    maxCombo = 0;
    isFinished = false;
    isRunning = true;

    hudTitle.textContent = meta.title;
    hudBpm.textContent = `${meta.bpm} BPM`;
    hudProgress.style.width = "0%";
    hudCombo.classList.add("hidden");
    judgePopup.classList.add("hidden");
    resultOverlay.classList.add("hidden");

    menuScreen.classList.remove("active");
    gameScreen.classList.add("active");

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stopStage() {
    isRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function goToMenu() {
    stopStage();
    gameScreen.classList.remove("active");
    menuScreen.classList.add("active");
    renderMenu();
  }

  function showJudge(text, color) {
    judgePopup.textContent = text;
    judgePopup.style.color = color;
    judgePopup.classList.remove("hidden");
    judgePopup.style.transform = "translateX(-50%) scale(1.22)";
    requestAnimationFrame(() => {
      judgePopup.style.transform = "translateX(-50%) scale(1)";
    });
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

  function registerMiss(target) {
    missCount += 1;
    combo = 0;
    updateCombo();
    showJudge("MISS", "#f2525c");
    AudioEngine.playMiss();
    controller.onMiss(target);
  }

  function handleTap() {
    if (!isRunning || isFinished) return;
    tapPad.classList.add("pressed");
    setTimeout(() => tapPad.classList.remove("pressed"), 90);

    const offsetSec = audioOffsetMs / 1000;
    const curSec = AudioEngine.now() - startTime - offsetSec;

    let bestTarget = null;
    let bestErr = 999;
    for (const t of controller.targets) {
      if (t.judged) continue;
      const err = Math.abs(curSec - t.beat * beatSec);
      if (err <= MISS_WIN && err < bestErr) {
        bestErr = err;
        bestTarget = t;
      }
    }

    if (!bestTarget) {
      controller.onEmptyTap();
      return;
    }

    bestTarget.judged = true;
    if (bestErr <= PERFECT_WIN) {
      perfectCount += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      updateCombo();
      showJudge("PERFECT!", "#ffd938");
      AudioEngine.playChord([523.25, 659.25, 783.99], 0.15, "triangle", 0.22);
      controller.onHit(bestTarget, "perfect");
    } else if (bestErr <= GOOD_WIN) {
      goodCount += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      updateCombo();
      showJudge("GOOD", "#70eb8c");
      AudioEngine.playTone(440, 0.1, "triangle", 0.2);
      controller.onHit(bestTarget, "good");
    } else {
      registerMiss(bestTarget);
    }
  }

  function finishStage() {
    isFinished = true;
    isRunning = false;
    const total = Math.max(1, perfectCount + goodCount + missCount);
    const acc = ((perfectCount + goodCount * 0.65) / total) * 100;
    const rank = computeRank(acc);

    const prev = records[activeMeta.id];
    if (!prev || acc > prev.accuracy) {
      records[activeMeta.id] = { rank: rank.text, accuracy: acc };
      localStorage.setItem("rh_records", JSON.stringify(records));
    }

    resultRank.textContent = rank.text;
    resultRank.style.color = rank.color;
    resultStats.textContent = `准确度：${acc.toFixed(1)}%\nPERFECT: ${perfectCount}   GOOD: ${goodCount}   MISS: ${missCount}\n最大连击：${maxCombo}`;
    resultOverlay.classList.remove("hidden");
  }

  function loop(ts) {
    if (!isRunning) return;
    const dt = Math.min(0.05, (ts - lastFrameTime) / 1000);
    lastFrameTime = ts;

    const audioNow = AudioEngine.now();
    const offsetSec = audioOffsetMs / 1000;
    const curSec = audioNow - startTime - offsetSec;
    const currentBeat = curSec / beatSec;

    // 1. Sample-accurate lookahead audio scheduling
    const scheduleHorizonBeat = (audioNow + LOOKAHEAD_SEC - startTime) / beatSec;
    while (nextHalfBeat * 0.5 <= scheduleHorizonBeat && nextHalfBeat * 0.5 < activeMeta.totalBeats) {
      const exactTime = startTime + nextHalfBeat * 0.5 * beatSec;
      if (exactTime >= audioNow - 0.02) {
        AudioEngine.scheduleBackingHalfBeat(nextHalfBeat, beatSec, activeMeta.id, exactTime);
      }
      nextHalfBeat += 1;
    }

    for (const cue of controller.cues) {
      if (!cue.audioScheduled && cue.beat <= scheduleHorizonBeat) {
        cue.audioScheduled = true;
        const exactTime = startTime + cue.beat * beatSec;
        if (exactTime >= audioNow - 0.02) {
          controller.scheduleCueAudio(cue, exactTime);
        }
      }
      if (!cue.triggered && currentBeat >= cue.beat) {
        cue.triggered = true;
        controller.onCueVisual(cue);
      }
    }

    // 2. Auto-miss passed targets
    for (const t of controller.targets) {
      if (!t.judged && curSec - t.beat * beatSec > MISS_WIN) {
        t.judged = true;
        registerMiss(t);
      }
    }

    // 3. Beat pulse & progress
    const beatIdx = Math.floor(currentBeat);
    if (beatIdx > lastVisualBeat && beatIdx >= 0) {
      lastVisualBeat = beatIdx;
      beatPulse = 1;
    }
    beatPulse = Math.max(0, beatPulse - dt * 4.5);
    hudProgress.style.width = `${Math.max(0, Math.min(100, (currentBeat / activeMeta.totalBeats) * 100))}%`;

    controller.update(dt);
    controller.draw(ctx, beatPulse, currentBeat);

    if (currentBeat >= activeMeta.totalBeats) {
      finishStage();
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  // Input listeners (pointerdown for zero-latency mobile touch + keyboard)
  tapPad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleTap();
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleTap();
  });
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "KeyJ") {
      if (isRunning && !isFinished) {
        e.preventDefault();
        handleTap();
      }
    } else if (e.code === "Escape" && gameScreen.classList.contains("active")) {
      goToMenu();
    }
  });

  document.getElementById("btn-back").addEventListener("click", goToMenu);
  document.getElementById("btn-menu").addEventListener("click", goToMenu);
  document.getElementById("btn-retry").addEventListener("click", () => startStage(activeMeta));

  renderMenu();
})();
