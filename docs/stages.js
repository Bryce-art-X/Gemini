window.STAGES_META = [
  {
    id: "forge",
    title: "铁匠打铁",
    subtitle: "Forge Beat",
    bpm: 115,
    totalBeats: 64,
    accent: "#fa7a38",
    description: "听师傅打铁的节奏！\n普通拍：师傅敲1下，你跟敲1下。\n三连敲：叮-叮-叮 后紧跟三连击！",
  },
  {
    id: "factory",
    title: "流水线接球",
    subtitle: "Factory Catch",
    bpm: 120,
    totalBeats: 64,
    accent: "#3dc2f5",
    description: "盯紧传送带上的零件！\n普通件：1 - 2 - 3 - 【抓！】\n金色加速件：哔哔 - 【快抓！】",
  },
  {
    id: "choir",
    title: "合唱团点名",
    subtitle: "Choir Snap",
    bpm: 108,
    totalBeats: 64,
    accent: "#f25994",
    description: "你是站在最右边的小合唱员！\n听队友点名：1 - 2 - 3 - 【轮到你！】\n注意齐唱信号：一起——【嘿！】",
  },
];

window.createStageController = function createStageController(stageId) {
  const cues = [];
  const targets = [];

  const addCue = (beat, kind, extra = {}) =>
    cues.push({ beat, kind, triggered: false, audioScheduled: false, ...extra });
  const addTarget = (beat, kind, extra = {}) =>
    targets.push({ beat, kind, judged: false, result: "", ...extra });

  // Count-in
  for (let i = 0; i < 4; i++) {
    addCue(i, "count_in", { num: 4 - i });
  }

  if (stageId === "forge") {
    const state = {
      masterSwing: 0,
      playerSwing: 0,
      ingotHeat: 0.2,
      shake: 0,
      swords: 0,
      sparks: [],
      banner: "听师傅敲击的节奏！",
    };

    const addSingle = (b) => {
      addCue(b, "master_hit", { msg: "叮！" });
      addTarget(b + 1, "single", { finishSword: false });
    };
    const addDouble = (b) => {
      addCue(b, "master_hit", { msg: "叮！" });
      addCue(b + 1, "master_hit", { msg: "叮-叮！" });
      addTarget(b + 2, "double", { finishSword: false });
      addTarget(b + 3, "double", { finishSword: true });
    };
    const addTriple = (b) => {
      addCue(b, "master_hit", { msg: "三连敲：叮-" });
      addCue(b + 0.5, "master_hit", { msg: "三连敲：叮-叮-" });
      addCue(b + 1.0, "master_hit", { msg: "三连敲：叮-叮-叮！" });
      addTarget(b + 2.0, "triple", { finishSword: false });
      addTarget(b + 2.5, "triple", { finishSword: false });
      addTarget(b + 3.0, "triple", { finishSword: true });
    };

    addSingle(4); addSingle(6);
    addSingle(8); addSingle(10);
    addDouble(12);
    addTriple(16);
    addSingle(20); addSingle(22);
    addTriple(24);
    addDouble(28);
    addTriple(32);
    addSingle(36); addSingle(38);
    addTriple(40);
    addDouble(44);
    addTriple(48);
    addTriple(52);
    addTriple(56);

    const spawnSparks = (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const ang = -Math.PI * (0.05 + Math.random() * 0.9);
        const spd = 140 + Math.random() * 260;
        state.sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.45 });
      }
    };

    return {
      cues,
      targets,
      scheduleCueAudio(cue, when) {
        if (cue.kind === "count_in") AudioEngine.playTone(660, 0.1, "triangle", 0.2, when);
        else if (cue.kind === "master_hit") AudioEngine.playTone(880, 0.14, "triangle", 0.34, when);
      },
      onCueVisual(cue) {
        if (cue.kind === "count_in") state.banner = `准备... ${cue.num}`;
        else if (cue.kind === "master_hit") {
          state.banner = cue.msg;
          state.masterSwing = 1;
          state.ingotHeat = 1;
        }
      },
      onHit(target, grade) {
        state.playerSwing = 1;
        state.shake = grade === "perfect" ? 7 : 3.5;
        spawnSparks(615, 335, grade === "perfect" ? 16 : 8);
        AudioEngine.playChord([293.66, 587.33, 880], 0.18, "square", 0.16);
        if (target.finishSword) {
          state.swords += 1;
          state.banner = `名剑出炉！(${state.swords})`;
          AudioEngine.playChord([587.33, 739.99, 880, 1174.66], 0.3, "triangle", 0.26);
        }
      },
      onMiss() {
        state.playerSwing = 0.5;
        state.banner = "哎呀，打歪了！";
      },
      onEmptyTap() {
        state.playerSwing = 0.6;
        AudioEngine.playTone(220, 0.08, "triangle", 0.08);
      },
      update(dt) {
        state.masterSwing = Math.max(0, state.masterSwing - dt * 5);
        state.playerSwing = Math.max(0, state.playerSwing - dt * 5);
        state.ingotHeat = Math.max(0.2, state.ingotHeat - dt * 1.4);
        state.shake = Math.max(0, state.shake - dt * 26);
        for (let i = state.sparks.length - 1; i >= 0; i--) {
          const sp = state.sparks[i];
          sp.life -= dt;
          if (sp.life <= 0) state.sparks.splice(i, 1);
          else {
            sp.vy += 580 * dt;
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
          }
        }
      },
      draw(ctx, beatPulse) {
        const sx = (Math.random() * 2 - 1) * state.shake;
        const sy = (Math.random() * 2 - 1) * state.shake;
        ctx.fillStyle = `rgb(${28 + beatPulse * 14}, ${18 + beatPulse * 8}, 16)`;
        ctx.fillRect(0, 0, 960, 540);

        ctx.save();
        ctx.translate(sx, sy);

        // Furnace
        ctx.fillStyle = "rgba(255, 110, 35, 0.16)";
        ctx.beginPath();
        ctx.arc(480, 260, 145 + beatPulse * 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#392929";
        ctx.fillRect(405, 175, 150, 150);
        ctx.fillStyle = "#ff7c1f";
        ctx.beginPath();
        ctx.arc(480, 255, 52 + beatPulse * 5, 0, Math.PI * 2);
        ctx.fill();

        // Floor
        ctx.fillStyle = "#2b211f";
        ctx.fillRect(0, 380, 960, 160);

        const drawSmith = (x, y, swing, shirt, dir) => {
          const w = 48 * (1 + swing * 0.14);
          const h = 68 * (1 - swing * 0.14);
          ctx.fillStyle = shirt;
          ctx.fillRect(x - w / 2, y - h, w, h);
          ctx.fillStyle = "#f5d0b5";
          ctx.beginPath();
          ctx.arc(x, y - h - 20, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1c1c24";
          ctx.beginPath();
          ctx.arc(x + dir * 7, y - h - 23, 3.2, 0, Math.PI * 2);
          ctx.fill();

          const ang = (-1.1 + 1.45 * swing) * dir;
          const sx0 = x + dir * 8;
          const sy0 = y - h * 0.72;
          const hx = sx0 + Math.cos(ang) * 48 * dir;
          const hy = sy0 + Math.sin(ang) * 48 * dir;
          ctx.strokeStyle = "#f5d0b5";
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = "#8d94a3";
          ctx.fillRect(hx - 12, hy - 10, 24, 20);
        };

        const drawAnvil = (x, y) => {
          ctx.fillStyle = "#565e6b";
          ctx.fillRect(x - 36, y - 16, 72, 20);
          ctx.fillStyle = "#3e434d";
          ctx.fillRect(x - 20, y + 4, 40, 24);
        };

        drawSmith(260, 355, state.masterSwing, "#eb6b40", 1);
        drawAnvil(335, 355);
        drawSmith(700, 355, state.playerSwing, "#4bb8f5", -1);
        drawAnvil(615, 355);

        // Hot ingot
        ctx.fillStyle = state.ingotHeat > 0.6 ? "#ffe885" : "#ff6b2b";
        ctx.fillRect(592, 333, 46, 12);

        // Sparks
        for (const sp of state.sparks) {
          const a = Math.max(0, sp.life / 0.45);
          ctx.fillStyle = `rgba(255, 210, 64, ${a})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 3.5 * a + 1, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        ctx.fillStyle = "#fff2d6";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.banner, 480, 130);
        ctx.fillStyle = "#ffdc5c";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`成品名剑: ${state.swords}`, 30, 470);
      },
    };
  }

  if (stageId === "factory") {
    const state = {
      clawAnim: 0,
      caught: 0,
      items: [],
      banner: "盯紧传送带上的零件！",
    };

    const addNormal = (b) => {
      addCue(b, "spawn_normal", { spawnBeat: b, targetBeat: b + 3 });
      addCue(b + 1, "hop_beep", { high: false });
      addCue(b + 2, "hop_beep", { high: false });
      addTarget(b + 3, "normal");
    };
    const addFast = (b) => {
      addCue(b, "spawn_fast", { spawnBeat: b, targetBeat: b + 1.5 });
      addCue(b + 0.5, "hop_beep", { high: true });
      addTarget(b + 1.5, "fast");
    };

    addNormal(4); addNormal(8); addNormal(12);
    addFast(16); addFast(18);
    addNormal(20);
    addFast(24); addFast(26);
    addNormal(28); addNormal(32);
    addFast(36); addFast(38); addFast(40);
    addNormal(42); addNormal(46);
    addFast(50); addFast(52);
    addNormal(54); addFast(58);

    return {
      cues,
      targets,
      scheduleCueAudio(cue, when) {
        if (cue.kind === "count_in") AudioEngine.playTone(440, 0.08, "square", 0.14, when);
        else if (cue.kind === "spawn_normal") AudioEngine.playTone(523.25, 0.09, "square", 0.16, when);
        else if (cue.kind === "spawn_fast") AudioEngine.playTone(783.99, 0.09, "square", 0.18, when);
        else if (cue.kind === "hop_beep") AudioEngine.playTone(cue.high ? 880 : 523.25, 0.08, "square", 0.16, when);
      },
      onCueVisual(cue) {
        if (cue.kind === "count_in") state.banner = `开机准备... ${cue.num}`;
        else if (cue.kind === "spawn_normal") {
          state.banner = "普通件：1 - 2 - 3 - 抓！";
          state.items.push({ spawnBeat: cue.spawnBeat, targetBeat: cue.targetBeat, fast: false, state: "moving", fly: 0 });
        } else if (cue.kind === "spawn_fast") {
          state.banner = "金色加速件：哔哔 - 快抓！";
          state.items.push({ spawnBeat: cue.spawnBeat, targetBeat: cue.targetBeat, fast: true, state: "moving", fly: 0 });
        }
      },
      onHit() {
        state.clawAnim = 1;
        state.caught += 1;
        AudioEngine.playSnare(null, 0.32);
        const item = state.items.find((it) => it.state === "moving");
        if (item) item.state = "caught";
      },
      onMiss() {
        state.clawAnim = 0.6;
        const item = state.items.find((it) => it.state === "moving");
        if (item) item.state = "missed";
      },
      onEmptyTap() {
        state.clawAnim = 0.7;
        AudioEngine.playSnare(null, 0.12);
      },
      update(dt) {
        state.clawAnim = Math.max(0, state.clawAnim - dt * 6);
        for (let i = state.items.length - 1; i >= 0; i--) {
          const it = state.items[i];
          if (it.state !== "moving") {
            it.fly += dt * 2.5;
            if (it.fly >= 1.2) state.items.splice(i, 1);
          }
        }
      },
      draw(ctx, beatPulse, currentBeat) {
        const beltY = 365;
        const spawnX = 140;
        const clawX = 710;

        ctx.fillStyle = `rgb(${18 + beatPulse * 8}, ${28 + beatPulse * 10}, ${42 + beatPulse * 12})`;
        ctx.fillRect(0, 0, 960, 540);

        // Belt
        ctx.fillStyle = "#3c4654";
        ctx.fillRect(100, beltY, 690, 28);
        ctx.fillStyle = "#262b36";
        ctx.fillRect(100, beltY + 28, 690, 12);

        const rot = currentBeat * 2.2;
        for (let x = 135; x < 780; x += 95) {
          ctx.fillStyle = "#738499";
          ctx.beginPath();
          ctx.arc(x, beltY + 14, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#232830";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, beltY + 14);
          ctx.lineTo(x + Math.cos(rot) * 10, beltY + 14 + Math.sin(rot) * 10);
          ctx.stroke();
        }

        // Target Ring
        ctx.strokeStyle = `rgba(64, 216, 255, ${0.35 + beatPulse * 0.25})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(clawX, beltY - 26, 30, 0, Math.PI * 2);
        ctx.stroke();

        // Claw
        const clawY = 185 + (beltY - 46 - 185) * state.clawAnim;
        ctx.strokeStyle = "#a3b5cc";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(clawX, 80);
        ctx.lineTo(clawX, clawY);
        ctx.stroke();

        const spread = 28 - 17 * state.clawAnim;
        ctx.strokeStyle = "#e0853d";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(clawX, clawY);
        ctx.lineTo(clawX - spread, clawY + 26);
        ctx.moveTo(clawX, clawY);
        ctx.lineTo(clawX + spread, clawY + 26);
        ctx.stroke();

        // Items
        for (const it of state.items) {
          let x = clawX;
          let y = beltY - 20;
          if (it.state === "moving") {
            const t = Math.max(0, Math.min(1.15, (currentBeat - it.spawnBeat) / Math.max(0.1, it.targetBeat - it.spawnBeat)));
            x = spawnX + (clawX - spawnX) * t;
            const hopFreq = it.fast ? 2 : 3;
            y = beltY - 20 - Math.abs(Math.sin(t * Math.PI * hopFreq)) * 34;
          } else if (it.state === "caught") {
            x = clawX + it.fly * 180;
            y = beltY - 30 - it.fly * 210;
          } else {
            x = clawX + it.fly * 130;
            y = beltY - 15 + it.fly * it.fly * 260;
          }

          ctx.fillStyle = it.state === "missed" ? "#bf3f47" : it.fast ? "#ffd138" : "#6be0f5";
          ctx.fillRect(x - 19, y - 19, 38, 38);
          ctx.fillStyle = "#181a24";
          ctx.beginPath();
          ctx.arc(x - 6, y - 3, 3, 0, Math.PI * 2);
          ctx.arc(x + 6, y - 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#e0f5ff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.banner, 480, 125);
        ctx.fillStyle = "#73ebff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`已打包零件: ${state.caught}`, 30, 470);
      },
    };
  }

  // Choir Snap
  const state = {
    sing: [0, 0, 0],
    sideEye: 0,
    baton: 0,
    notes: [],
    banner: "听点名：1 - 2 - 3 - 【轮到你！】",
  };

  const addRelay = (b) => {
    addCue(b, "kid_sing", { idx: 0, msg: "点名：1..." });
    addCue(b + 1, "kid_sing", { idx: 1, msg: "点名：1 - 2..." });
    addCue(b + 2, "conductor_cue", { msg: "点名：1 - 2 - 3（准备！）" });
    addTarget(b + 3, "solo");
  };
  const addTutti = (b) => {
    addCue(b, "tutti_prep", { msg: "大家一起——" });
    addTarget(b + 1, "tutti");
  };

  addRelay(4); addRelay(8); addRelay(12);
  addTutti(16); addTutti(18);
  addRelay(20);
  addTutti(24); addTutti(26);
  addRelay(28); addRelay(32);
  addTutti(36); addTutti(38);
  addRelay(40);
  addTutti(44); addTutti(46);
  addRelay(48); addRelay(52);
  addTutti(56); addTutti(58);

  const spawnNote = (x, y, col) => state.notes.push({ x, y, col, life: 0.75 });

  return {
    cues,
    targets,
    scheduleCueAudio(cue, when) {
      if (cue.kind === "count_in") AudioEngine.playTone(740, 0.1, "triangle", 0.2, when);
      else if (cue.kind === "kid_sing") AudioEngine.playTone(cue.idx === 0 ? 261.63 : 329.63, 0.2, "sine", 0.3, when);
      else if (cue.kind === "conductor_cue") AudioEngine.playTone(392.0, 0.2, "sine", 0.3, when);
      else if (cue.kind === "tutti_prep") AudioEngine.playTone(880.0, 0.11, "triangle", 0.24, when);
    },
    onCueVisual(cue) {
      if (cue.kind === "count_in") state.banner = `开嗓准备... ${cue.num}`;
      else if (cue.kind === "kid_sing") {
        state.banner = cue.msg;
        state.sing[cue.idx] = 1;
        spawnNote(270 + cue.idx * 180, 240, "#f2b8d8");
      } else if (cue.kind === "conductor_cue" || cue.kind === "tutti_prep") {
        state.banner = cue.msg;
        state.baton = 1;
      }
    },
    onHit(target, grade) {
      state.sing[2] = 1;
      spawnNote(630, 240, "#ffe047");
      if (target.kind === "tutti") {
        state.sing[0] = 1;
        state.sing[1] = 1;
        spawnNote(270, 240, "#8cebff");
        spawnNote(450, 240, "#8cebff");
        state.banner = grade === "perfect" ? "嘿！完美齐唱！" : "嘿！";
        AudioEngine.playChord([261.63, 329.63, 392.0, 523.25], 0.28, "triangle", 0.28);
      } else {
        state.banner = grade === "perfect" ? "漂亮高音！" : "唱响了！";
        AudioEngine.playTone(523.25, 0.24, "triangle", 0.3);
      }
    },
    onMiss(target) {
      state.sideEye = 1.2;
      state.banner = "走调啦！队友在盯着你...";
      if (target.kind === "tutti") {
        state.sing[0] = 1;
        state.sing[1] = 1;
      }
    },
    onEmptyTap() {
      state.sing[2] = 0.65;
      AudioEngine.playTone(392, 0.08, "sine", 0.08);
    },
    update(dt) {
      for (let i = 0; i < 3; i++) state.sing[i] = Math.max(0, state.sing[i] - dt * 4);
      state.sideEye = Math.max(0, state.sideEye - dt);
      state.baton = Math.max(0, state.baton - dt * 4.5);
      for (let i = state.notes.length - 1; i >= 0; i--) {
        state.notes[i].life -= dt;
        state.notes[i].y -= 75 * dt;
        if (state.notes[i].life <= 0) state.notes.splice(i, 1);
      }
    },
    draw(ctx, beatPulse, currentBeat) {
      ctx.fillStyle = `rgb(${36 + beatPulse * 12}, ${22 + beatPulse * 6}, ${40 + beatPulse * 12})`;
      ctx.fillRect(0, 0, 960, 540);

      // Stage
      ctx.fillStyle = "#472b24";
      ctx.fillRect(100, 380, 760, 140);
      ctx.fillStyle = "#d9a347";
      ctx.fillRect(100, 380, 760, 12);

      if (state.baton > 0.05) {
        ctx.fillStyle = `rgba(255, 217, 64, ${state.baton * 0.55})`;
        ctx.beginPath();
        ctx.arc(480, 175, 18 + state.baton * 10, 0, Math.PI * 2);
        ctx.fill();
      }

      const bounce = Math.abs(Math.sin(currentBeat * Math.PI)) * 3.5;
      for (let i = 0; i < 3; i++) {
        const x = 270 + i * 180;
        const isPlayer = i === 2;
        const sing = state.sing[i];
        const stretch = 1 + sing * 0.12;
        const h = 88 * stretch;
        const w = 58 / stretch;
        const topY = 380 - h - bounce;

        ctx.fillStyle = isPlayer ? "#f56b94" : "#5caef0";
        ctx.fillRect(x - w / 2, topY, w, h);

        const hy = topY - 22;
        ctx.fillStyle = "#fadbc2";
        ctx.beginPath();
        ctx.arc(x, hy, 24, 0, Math.PI * 2);
        ctx.fill();

        const ex = !isPlayer && state.sideEye > 0 ? 5 : 0;
        ctx.fillStyle = "#191924";
        ctx.beginPath();
        ctx.arc(x - 8 + ex, hy - 5, 3.2, 0, Math.PI * 2);
        ctx.arc(x + 8 + ex, hy - 5, 3.2, 0, Math.PI * 2);
        ctx.fill();

        if (sing > 0.15) {
          ctx.fillStyle = "#a61e33";
          ctx.beginPath();
          ctx.arc(x, hy + 8, 5 + sing * 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "#332626";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - 5, hy + 8);
          ctx.lineTo(x + 5, hy + 8);
          ctx.stroke();
        }
      }

      ctx.textAlign = "center";
      for (const n of state.notes) {
        ctx.globalAlpha = Math.max(0, n.life / 0.75);
        ctx.fillStyle = n.col;
        ctx.font = "bold 30px sans-serif";
        ctx.fillText("♪", n.x, n.y);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#ffebf2";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(state.banner, 480, 125);
      ctx.fillStyle = "#ffdc52";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("YOU", 630, 415);
    },
  };
};
