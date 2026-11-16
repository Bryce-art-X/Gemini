window.STAGES_META = [
  {
    id: "forge",
    title: "铁匠打铁 ★精修标杆",
    subtitle: "Forge Beat (Pro)",
    bpm: 115,
    totalBeats: 64,
    accent: "#fa7a38",
    description: "全套声学与演出升级！\n• 普通/三连敲：叮-叮-叮 后三连击\n• 重锤蓄力(2拍)：听『呼——』再重砸\n• 反拍切分 & 浓烟盲打挑战！",
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

  for (let i = 0; i < 4; i++) {
    addCue(i, "count_in", { num: 4 - i });
  }

  if (stageId === "forge") {
    const state = {
      masterSwing: 0,
      masterWindup: 0,
      playerSwing: 0,
      ingotHeat: 0.25,
      ingotSquash: 0, // >0 crooked pancake on Barely
      ingotState: "ready", // ready, flat, miss, sword
      masterMood: "normal", // normal, happy, confused, sideeye
      moodTimer: 0,
      shake: 0,
      speedLines: 0,
      smokeAlpha: 0,
      smokeTarget: 0,
      swords: 0,
      sparks: [],
      stars: [],
      flyingSwords: [],
      banner: "听师傅木鱼+口令，闭眼也能打！",
    };

    const addSingle = (b) => {
      addCue(b, "master_hit", { msg: "叮！" });
      addTarget(b + 1, "single", { heavy: false, finishSword: false });
    };
    const addDouble = (b) => {
      addCue(b, "master_hit", { msg: "叮！" });
      addCue(b + 1, "master_hit", { msg: "叮-叮！" });
      addTarget(b + 2, "double", { heavy: false, finishSword: false });
      addTarget(b + 3, "double", { heavy: false, finishSword: true });
    };
    const addTriple = (b) => {
      addCue(b, "master_hit", { msg: "三连敲：叮-" });
      addCue(b + 0.5, "master_hit", { msg: "三连敲：叮-叮-" });
      addCue(b + 1.0, "master_hit", { msg: "三连敲：叮-叮-叮！" });
      addTarget(b + 2.0, "triple", { heavy: false, finishSword: false });
      addTarget(b + 2.5, "triple", { heavy: false, finishSword: false });
      addTarget(b + 3.0, "triple", { heavy: false, finishSword: true });
    };
    // Archetype D: 2-beat Heavy Charge (Binary Cue Discrimination)
    const addHeavyCharge = (b) => {
      addCue(b, "charge_start", { msg: "重锤蓄力：呼——！" });
      addTarget(b + 2.0, "heavy", { heavy: true, finishSword: true });
    };
    // Archetype E: Off-beat Lockstep (8th-note syncopation)
    const addOffbeatRun = (b) => {
      addCue(b, "offbeat_cue", { msg: "切换反拍：嘿-哒！" });
      addCue(b + 0.5, "offbeat_cue", { msg: "反拍准备：哒-哒！" });
      addCue(b + 1.0, "offbeat_cue", { msg: "跟上反拍空隙！" });
      addTarget(b + 1.5, "offbeat", { heavy: false, finishSword: false });
      addTarget(b + 2.5, "offbeat", { heavy: false, finishSword: false });
      addTarget(b + 3.5, "offbeat", { heavy: false, finishSword: true });
    };

    // Bar 1 (4..7): Warm-up Singles
    addSingle(4);
    addSingle(6);
    // Bar 2 (8..11): Double
    addDouble(8);
    // Bar 3 (12..15): Triple Fast Forge
    addTriple(12);
    // Bar 4 (16..19): Archetype D - Heavy 2-beat Charge!
    addHeavyCharge(16);
    // Bar 5 (20..23): Single + Heavy Charge
    addSingle(20);
    addHeavyCharge(21);
    // Bar 6..7 (24..31): Archetype E - Off-beat Lockstep!
    addOffbeatRun(24);
    addSingle(28);
    addSingle(30);
    // Bar 8..9 (32..39): Blackout Smoke Blind-Test!
    addCue(32, "smoke_on", { msg: "浓烟遮挡！靠耳朵盲打三连敲！" });
    addTriple(34);
    addCue(38.5, "smoke_off", { msg: "烟雾散去！" });
    // Bar 10..11 (40..47): Heavy + Offbeat
    addHeavyCharge(40);
    addOffbeatRun(44);
    // Bar 12..13 (48..55): Double + Triple
    addDouble(48);
    addTriple(52);
    // Bar 14..15 (56..63): Grand Finale Heavy + Triple!
    addHeavyCharge(56);
    addTriple(59);

    const spawnSparks = (x, y, count, gold = false) => {
      for (let i = 0; i < count; i++) {
        const ang = -Math.PI * (0.05 + Math.random() * 0.9);
        const spd = 160 + Math.random() * 300;
        state.sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.45, gold });
      }
    };

    const spawnStars = (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const spd = 120 + Math.random() * 140;
        state.stars.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40, life: 0.48, size: 12 + Math.random() * 8 });
      }
    };

    const chords = [
      [440.0, 554.37, 659.25], // A major
      [523.25, 659.25, 783.99], // C major
      [587.33, 739.99, 880.0], // D major
    ];
    let chordIdx = 0;

    return {
      cues,
      targets,
      customHitAudio: true,
      scheduleCueAudio(cue, when, beatSec) {
        if (cue.kind === "count_in") {
          AudioEngine.playTeacherCue(520, 1500, 0.09, when, false);
        } else if (cue.kind === "master_hit") {
          AudioEngine.playTeacherCue(660, 1850, 0.12, when, false);
        } else if (cue.kind === "charge_start") {
          AudioEngine.playChargeCue(260, 620, beatSec * 1.75, when);
        } else if (cue.kind === "offbeat_cue") {
          AudioEngine.playTeacherCue(820, 2300, 0.10, when, true);
        }
      },
      onCueVisual(cue) {
        if (cue.kind === "count_in") {
          state.banner = `准备... ${cue.num}`;
        } else if (cue.kind === "master_hit") {
          state.banner = cue.msg;
          state.masterSwing = 1;
          state.ingotHeat = 1;
          state.ingotState = "ready";
          state.ingotSquash = 0;
        } else if (cue.kind === "charge_start") {
          state.banner = cue.msg;
          state.masterWindup = 1;
          state.ingotHeat = 1;
          state.ingotState = "ready";
          state.ingotSquash = 0;
        } else if (cue.kind === "offbeat_cue") {
          state.banner = cue.msg;
          state.masterSwing = 0.85;
          state.ingotState = "ready";
        } else if (cue.kind === "smoke_on") {
          state.banner = cue.msg;
          state.smokeTarget = 1;
        } else if (cue.kind === "smoke_off") {
          state.banner = cue.msg;
          state.smokeTarget = 0;
        }
      },
      onHit(target, grade, timingCtx) {
        const heavy = Boolean(target.heavy);
        state.playerSwing = 1;
        AudioEngine.playAnvilFoley(grade, heavy);

        if (grade === "perfect") {
          state.shake = heavy ? 11 : 7;
          state.speedLines = 1;
          state.masterMood = "happy";
          state.moodTimer = 0.65;
          spawnSparks(615, 332, heavy ? 26 : 16, true);
          spawnStars(615, 315, heavy ? 7 : 4);

          // Quantized Resolution Harmony on 16th-note grid!
          const ch = chords[chordIdx % chords.length];
          chordIdx += 1;
          AudioEngine.playQuantizedChord(ch, timingCtx.startTime, timingCtx.beatSec, 0.24, 0.28);

          if (target.finishSword) {
            state.swords += 1;
            state.ingotState = "sword";
            state.flyingSwords.push({ x: 615, y: 325, vx: 210, vy: -320, rot: -0.3, life: 1.1, heavy });
            state.banner = heavy ? `战斧铸成！(${state.swords})` : `名剑出炉！(${state.swords})`;
            AudioEngine.playQuantizedChord([587.33, 739.99, 880.0, 1174.66], timingCtx.startTime, timingCtx.beatSec, 0.34, 0.30);
          }
        } else {
          // Barely! Crooked flattened ingot + Master confused
          state.shake = 2.5;
          state.ingotState = "flat";
          state.ingotSquash = 1;
          state.masterMood = "confused";
          state.moodTimer = 0.75;
          spawnSparks(615, 335, 5, false);
          state.banner = "擦边打歪了点...";
        }
      },
      onMiss() {
        state.playerSwing = 0.45;
        state.ingotState = "miss";
        state.masterMood = "sideeye";
        state.moodTimer = 1.15;
        state.banner = "漏拍啦！师傅在斜眼看你...";
      },
      onEmptyTap() {
        state.playerSwing = 0.65;
        AudioEngine.playAnvilFoley("good", false);
      },
      update(dt) {
        state.masterSwing = Math.max(0, state.masterSwing - dt * 5.2);
        state.masterWindup = Math.max(0, state.masterWindup - dt * 1.3);
        state.playerSwing = Math.max(0, state.playerSwing - dt * 5.2);
        state.ingotHeat = Math.max(0.25, state.ingotHeat - dt * 1.2);
        state.shake = Math.max(0, state.shake - dt * 28);
        state.speedLines = Math.max(0, state.speedLines - dt * 4.5);
        state.smokeAlpha += (state.smokeTarget - state.smokeAlpha) * Math.min(1, dt * 4.5);
        if (state.moodTimer > 0) {
          state.moodTimer -= dt;
          if (state.moodTimer <= 0) state.masterMood = "normal";
        }

        for (let i = state.sparks.length - 1; i >= 0; i--) {
          const sp = state.sparks[i];
          sp.life -= dt;
          if (sp.life <= 0) state.sparks.splice(i, 1);
          else {
            sp.vy += 620 * dt;
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
          }
        }
        for (let i = state.stars.length - 1; i >= 0; i--) {
          const st = state.stars[i];
          st.life -= dt;
          if (st.life <= 0) state.stars.splice(i, 1);
          else {
            st.x += st.vx * dt;
            st.y += st.vy * dt;
          }
        }
        for (let i = state.flyingSwords.length - 1; i >= 0; i--) {
          const sw = state.flyingSwords[i];
          sw.life -= dt;
          sw.vy += 520 * dt;
          sw.x += sw.vx * dt;
          sw.y += sw.vy * dt;
          sw.rot += 4.2 * dt;
          if (sw.life <= 0) state.flyingSwords.splice(i, 1);
        }
      },
      draw(ctx, beatPulse) {
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        const sx = (Math.random() * 2 - 1) * state.shake;
        const sy = (Math.random() * 2 - 1) * state.shake;
        // Flat vibrant Rhythm Heaven warm background
        ctx.fillStyle = `rgb(${44 + beatPulse * 14}, ${24 + beatPulse * 8}, ${22 + beatPulse * 6})`;
        ctx.fillRect(0, 0, 960, 540);

        ctx.save();
        ctx.translate(sx, sy);

        // Universal Beat Bop factor
        const bopX = 1 + beatPulse * 0.08;
        const bopY = 1 - beatPulse * 0.08;

        // Furnace (with bold black ink outline)
        ctx.save();
        ctx.translate(480, 345);
        ctx.scale(bopX, bopY);
        ctx.fillStyle = "rgba(255, 130, 40, 0.20)";
        ctx.beginPath();
        ctx.arc(0, -85, 135, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#594040";
        ctx.strokeStyle = "#111116";
        ctx.lineWidth = 4.5;
        ctx.fillRect(-78, -170, 156, 170);
        ctx.strokeRect(-78, -170, 156, 170);

        ctx.fillStyle = "#ff8a24";
        ctx.beginPath();
        ctx.arc(0, -80, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Floor
        ctx.fillStyle = "#362826";
        ctx.fillRect(0, 368, 960, 172);
        ctx.strokeStyle = "#111116";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(0, 368);
        ctx.lineTo(960, 368);
        ctx.stroke();

        const drawAnvil = (x, y) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(bopX, bopY);
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 4.5;
          ctx.fillStyle = "#677282";
          ctx.fillRect(-40, -28, 80, 22);
          ctx.strokeRect(-40, -28, 80, 22);
          ctx.fillStyle = "#48505c";
          ctx.fillRect(-20, -6, 40, 24);
          ctx.strokeRect(-20, -6, 40, 24);
          ctx.restore();
        };

        const drawSmith = (x, y, swing, windup, shirt, dir, mood) => {
          ctx.save();
          ctx.translate(x, y);
          const sSwing = swing > 0 ? swing : 0;
          const w = 52 * bopX * (1 + sSwing * 0.16);
          const h = 72 * bopY * (1 - sSwing * 0.16);

          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 4.5;

          // Body
          ctx.fillStyle = shirt;
          ctx.fillRect(-w / 2, -h, w, h);
          ctx.strokeRect(-w / 2, -h, w, h);

          // Head
          const hy = -h - 24;
          ctx.fillStyle = "#ffd9bd";
          ctx.beginPath();
          ctx.arc(0, hy, 23, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Ko Takeuchi expressive eyes & brows!
          ctx.fillStyle = "#111116";
          if (mood === "sideeye") {
            // Iconic Side-Eye Glare!
            ctx.beginPath();
            ctx.arc(8, hy - 3, 3.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-8, hy - 9);
            ctx.lineTo(14, hy - 9);
            ctx.stroke();
          } else if (mood === "happy") {
            ctx.beginPath();
            ctx.arc(dir * 7, hy - 4, 4, Math.PI, 0);
            ctx.stroke();
          } else if (mood === "confused") {
            ctx.beginPath();
            ctx.moveTo(dir * 2, hy - 5);
            ctx.lineTo(dir * 12, hy - 5);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(dir * 7, hy - 4, 3.6, 0, Math.PI * 2);
            ctx.fill();
          }

          // Hammer Arm
          const baseAng = windup > 0 ? -1.65 * dir : -1.05 * dir;
          const ang = baseAng + 1.45 * dir * sSwing;
          const sx0 = dir * 6;
          const sy0 = -h * 0.7;
          const hx = sx0 + Math.cos(ang) * 52 * dir;
          const hy2 = sy0 + Math.sin(ang) * 52 * dir;

          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(hx, hy2);
          ctx.stroke();
          ctx.strokeStyle = "#ffd9bd";
          ctx.lineWidth = 6.5;
          ctx.stroke();

          ctx.fillStyle = "#959dad";
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 4;
          ctx.fillRect(hx - 14, hy2 - 11, 28, 22);
          ctx.strokeRect(hx - 14, hy2 - 11, 28, 22);

          ctx.restore();
        };

        // Master (Left) & Player (Right)
        drawAnvil(335, 355);
        drawSmith(245, 368, state.masterSwing, state.masterWindup, "#ff683b", 1, state.masterMood);

        drawAnvil(615, 355);
        drawSmith(710, 368, state.playerSwing, 0, "#3db8ff", -1, "normal");

        // Ingot on Player Anvil
        ctx.strokeStyle = "#111116";
        ctx.lineWidth = 3.5;
        if (state.ingotState === "flat") {
          ctx.fillStyle = "#c95b38";
          ctx.fillRect(584, 322, 62, 6);
          ctx.strokeRect(584, 322, 62, 6);
        } else if (state.ingotState === "miss") {
          ctx.fillStyle = "#5c575c";
          ctx.fillRect(598, 344, 34, 10);
          ctx.strokeRect(598, 344, 34, 10);
        } else {
          ctx.fillStyle = state.ingotHeat > 0.6 ? "#fff078" : "#ff6b2b";
          ctx.fillRect(590, 315, 50, 14);
          ctx.strokeRect(590, 315, 50, 14);
        }

        // Flying Forged Swords
        for (const sw of state.flyingSwords) {
          ctx.save();
          ctx.translate(sw.x, sw.y);
          ctx.rotate(sw.rot);
          ctx.fillStyle = sw.heavy ? "#ffbe3b" : "#d9f4ff";
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 3.5;
          ctx.fillRect(-6, -34, 12, 50);
          ctx.strokeRect(-6, -34, 12, 50);
          ctx.fillStyle = "#e0842d";
          ctx.fillRect(-14, 12, 28, 8);
          ctx.strokeRect(-14, 12, 28, 8);
          ctx.restore();
        }

        // Sparks & 4-Point Comic Stars
        for (const sp of state.sparks) {
          const a = Math.max(0, sp.life / 0.45);
          ctx.fillStyle = sp.gold ? `rgba(255, 224, 66, ${a})` : `rgba(255, 160, 80, ${a})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 4 * a + 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const st of state.stars) {
          const a = Math.max(0, st.life / 0.48);
          ctx.save();
          ctx.translate(st.x, st.y);
          ctx.globalAlpha = a;
          ctx.fillStyle = "#ffe84d";
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          const r = st.size;
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.28, -r * 0.28);
          ctx.lineTo(r, 0);
          ctx.lineTo(r * 0.28, r * 0.28);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.28, r * 0.28);
          ctx.lineTo(-r, 0);
          ctx.lineTo(-r * 0.28, -r * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Comic Radial Speed Lines on Ace Hit!
        if (state.speedLines > 0.05) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 240, 140, ${state.speedLines * 0.55})`;
          ctx.lineWidth = 3;
          for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 * i) / 12 + 0.15;
            ctx.beginPath();
            ctx.moveTo(615 + Math.cos(a) * 55, 320 + Math.sin(a) * 55);
            ctx.lineTo(615 + Math.cos(a) * 155, 320 + Math.sin(a) * 155);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Blackout Smoke Cloud (Visual Occlusion Gag!)
        if (state.smokeAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = state.smokeAlpha * 0.96;
          ctx.fillStyle = "#2b2c38";
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 4;
          const puffs = [[260, 290, 95], [380, 270, 110], [500, 295, 115], [620, 280, 110], [720, 305, 95]];
          for (const [px, py, pr] of puffs) {
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.fillStyle = "#ffd84d";
          ctx.font = "bold 26px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("浓烟遮挡！闭眼听拍！", 480, 295);
          ctx.restore();
        }

        ctx.restore();

        ctx.fillStyle = "#fff2d6";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.banner, 480, 115);
        ctx.fillStyle = "#ffdc5c";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`成品神兵: ${state.swords}`, 30, 470);
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
      customHitAudio: false,
      scheduleCueAudio(cue, when) {
        if (cue.kind === "count_in") AudioEngine.playTeacherCue(440, 1400, 0.08, when, false);
        else if (cue.kind === "spawn_normal") AudioEngine.playTeacherCue(523.25, 1600, 0.09, when, false);
        else if (cue.kind === "spawn_fast") AudioEngine.playTeacherCue(783.99, 2100, 0.09, when, true);
        else if (cue.kind === "hop_beep") AudioEngine.playTeacherCue(cue.high ? 880 : 523.25, 1750, 0.08, when, cue.high);
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

        ctx.strokeStyle = `rgba(64, 216, 255, ${0.35 + beatPulse * 0.25})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(clawX, beltY - 26, 30, 0, Math.PI * 2);
        ctx.stroke();

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
    customHitAudio: false,
    scheduleCueAudio(cue, when) {
      if (cue.kind === "count_in") AudioEngine.playTeacherCue(740, 1600, 0.1, when, false);
      else if (cue.kind === "kid_sing") AudioEngine.playTeacherCue(cue.idx === 0 ? 261.63 : 329.63, 1400, 0.2, when, false);
      else if (cue.kind === "conductor_cue") AudioEngine.playTeacherCue(392.0, 1750, 0.2, when, false);
      else if (cue.kind === "tutti_prep") AudioEngine.playTeacherCue(880.0, 2200, 0.11, when, true);
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
