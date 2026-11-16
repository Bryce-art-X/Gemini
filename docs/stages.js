window.STAGES_META = [
  {
    id: "forge",
    title: "铁匠打铁 ★分件骨骼版",
    subtitle: "Forge Beat (Rigged)",
    bpm: 115,
    totalBeats: 72,
    accent: "#fa7a38",
    description: "阶段一升级：4 关节骨骼动画 + 热身教学！\n• 8 拍无惩罚热身试打后进入正曲\n• 挥锤残影、表情切换、重锤蓄力与浓烟盲打",
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
    const loadImg = (src) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    const imgs = {
      bg: loadImg("assets/forge_bg.png?v=4"),
      anvil: loadImg("assets/anvil.png?v=4"),
      mTorso: loadImg("assets/master_torso.png?v=4"),
      mNormal: loadImg("assets/master_head_normal.png?v=4"),
      mHappy: loadImg("assets/master_head_happy.png?v=4"),
      mConfused: loadImg("assets/master_head_confused.png?v=4"),
      mSideeye: loadImg("assets/master_head_sideeye.png?v=4"),
      pTorso: loadImg("assets/player_torso.png?v=4"),
      pNormal: loadImg("assets/player_head_normal.png?v=4"),
      armUpper: loadImg("assets/arm_upper.png?v=4"),
      hammerArm: loadImg("assets/hammer_arm.png?v=4"),
      ingot: loadImg("assets/ingot.png?v=4"),
      sword: loadImg("assets/sword.png?v=4"),
      spark: loadImg("assets/spark.png?v=4"),
    };

    const state = {
      masterSwing: 0,
      masterWindup: 0,
      playerSwing: 0,
      masterTrail: 0,
      playerTrail: 0,
      isPractice: true,
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
      banner: "热身教学：听师傅敲『叮』，你跟敲『咚』！",
    };

    const addSingle = (b, practice = false) => {
      addCue(b, "master_hit", { msg: practice ? "【练习】听师傅：叮！" : "叮！" });
      addTarget(b + 1, "single", { heavy: false, finishSword: false, practice });
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

    // Beats 4..11: 8-Beat Practice Warm-up (No Penalty!)
    addSingle(4, true);
    addSingle(6, true);
    addSingle(8, true);
    addCue(10, "practice_done", { msg: "热身结束！正式演出开始！" });

    // Main Song (Beats 12..71)
    addSingle(12);
    addSingle(14);
    addDouble(16);
    addTriple(20);
    addHeavyCharge(24);
    addSingle(28);
    addHeavyCharge(29);
    addOffbeatRun(32);
    addSingle(36);
    addSingle(38);

    // Blackout Smoke Blind-Test!
    addCue(40, "smoke_on", { msg: "浓烟遮挡！靠耳朵盲打三连敲！" });
    addTriple(42);
    addCue(46.5, "smoke_off", { msg: "烟雾散去！" });

    addHeavyCharge(48);
    addOffbeatRun(52);
    addDouble(56);
    addTriple(60);
    addHeavyCharge(64);
    addTriple(67);

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
          state.banner = `热身准备... ${cue.num}`;
        } else if (cue.kind === "practice_done") {
          state.isPractice = false;
          state.banner = cue.msg;
        } else if (cue.kind === "master_hit") {
          state.banner = cue.msg;
          state.masterSwing = 1;
          state.masterTrail = 1;
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
          state.masterTrail = 0.85;
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
        state.playerTrail = 1;
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
        state.masterTrail = Math.max(0, state.masterTrail - dt * 7.5);
        state.playerTrail = Math.max(0, state.playerTrail - dt * 7.5);
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

        ctx.fillStyle = "#1c1414";
        ctx.fillRect(0, 0, 960, 540);

        ctx.save();
        ctx.translate(sx, sy);

        // 1. Illustrated Forge Background
        if (imgs.bg.complete && imgs.bg.naturalWidth > 0) {
          ctx.drawImage(imgs.bg, 0, 0, 960, 540);
        }
        // Subtle warm beat-pulse furnace glow overlay
        if (beatPulse > 0.02) {
          ctx.fillStyle = `rgba(255, 140, 40, ${beatPulse * 0.14})`;
          ctx.fillRect(0, 0, 960, 540);
        }

        // Universal Beat Bop factor
        const bopX = 1 + beatPulse * 0.07;
        const bopY = 1 - beatPulse * 0.07;

        const drawSprite = (img, x, y, scaleX, scaleY, rot = 0) => {
          if (!img.complete || img.naturalWidth === 0) return;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.scale(scaleX, scaleY);
          ctx.drawImage(img, -img.width * 0.5, -img.height);
          ctx.restore();
        };

        // Ground contact shadows
        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
        for (const [cx, cy, rx] of [[190, 435, 72], [325, 435, 58], [635, 435, 58], [765, 435, 68]]) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Anvils (Left = Master, Right = Player)
        drawSprite(imgs.anvil, 325, 438, bopX, bopY, 0);
        drawSprite(imgs.anvil, 635, 438, bopX, bopY, 0);

        // 3. Articulated 4-Joint Blacksmith Rig Renderer
        const drawRig = (x, y, torsoImg, headImg, swing, windup, trail, facingLeft) => {
          ctx.save();
          ctx.translate(x, y);
          if (facingLeft) ctx.scale(-1, 1);

          // Beat Bop squash & stretch + strike lean
          const s = Math.max(0, swing);
          const wScale = bopX * (1 + s * 0.14);
          const hScale = bopY * (1 - s * 0.12);
          const bodyTilt = windup > 0 ? -0.18 * windup : 0.14 * s;
          ctx.rotate(bodyTilt);
          ctx.scale(wScale, hScale);

          // Torso
          if (torsoImg.complete && torsoImg.naturalWidth > 0) {
            ctx.drawImage(torsoImg, -torsoImg.width * 0.5, -torsoImg.height);
          }

          // Head (independent Beat Bop nod)
          if (headImg.complete && headImg.naturalWidth > 0) {
            ctx.save();
            ctx.translate(0, -110);
            ctx.rotate(beatPulse * 0.09);
            ctx.drawImage(headImg, -headImg.width * 0.5, -headImg.height + 16);
            ctx.restore();
          }

          // Shoulder -> UpperArm -> Elbow -> HammerArm
          const shRot = windup > 0 ? (-0.75 - 1.25 * windup) : (-0.75 + 1.22 * s);
          const elRot = windup > 0 ? (-0.60 - 0.35 * windup) : (-0.60 + 0.90 * s);

          // Motion-blur Hammer Swing Trail!
          if (trail > 0.05) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 240, 150, ${trail * 0.65})`;
            ctx.lineWidth = 14 * trail;
            ctx.beginPath();
            ctx.arc(32, -82, 74, -1.65, 0.35);
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.translate(18, -88);
          ctx.rotate(shRot);
          if (imgs.armUpper.complete && imgs.armUpper.naturalWidth > 0) {
            ctx.drawImage(imgs.armUpper, -10, -imgs.armUpper.height * 0.5);
          }
          ctx.translate(44, 0);
          ctx.rotate(elRot);
          if (imgs.hammerArm.complete && imgs.hammerArm.naturalWidth > 0) {
            ctx.drawImage(imgs.hammerArm, -10, -imgs.hammerArm.height + 22);
          }
          ctx.restore();

          ctx.restore();
        };

        const masterHead =
          state.masterMood === "happy" ? imgs.mHappy :
          state.masterMood === "confused" ? imgs.mConfused :
          state.masterMood === "sideeye" ? imgs.mSideeye : imgs.mNormal;

        drawRig(195, 438, imgs.mTorso, masterHead, state.masterSwing, state.masterWindup, state.masterTrail, false);

        // Master Reaction Bubble (Ace / Barely / Miss Side-Eye!)
        if (state.masterMood !== "normal") {
          ctx.save();
          ctx.translate(215, 165);
          ctx.fillStyle = state.masterMood === "sideeye" ? "#ff5252" : state.masterMood === "confused" ? "#ffb84d" : "#ffe84d";
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.roundRect(-52, -24, 104, 40, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#111116";
          ctx.font = "bold 18px sans-serif";
          ctx.textAlign = "center";
          const moodTxt = state.masterMood === "sideeye" ? "😒 漏拍!" : state.masterMood === "confused" ? "⁉️ 打歪?" : "👍 漂亮!";
          ctx.fillText(moodTxt, 0, 3);
          ctx.restore();
        }

        // 4. Player Apprentice (Right, facing left)
        drawRig(765, 438, imgs.pTorso, imgs.pNormal, state.playerSwing, 0, state.playerTrail, true);

        // 5. Ingot on Player Anvil
        if (imgs.ingot.complete && imgs.ingot.naturalWidth > 0) {
          ctx.save();
          ctx.translate(635, 326);
          if (state.ingotState === "flat") {
            ctx.scale(1.25, 0.45);
          } else if (state.ingotState === "miss") {
            ctx.globalAlpha = 0.5;
            ctx.translate(0, 16);
          }
          ctx.drawImage(imgs.ingot, -imgs.ingot.width * 0.5, -imgs.ingot.height * 0.5);
          ctx.restore();
        }

        // 6. Flying Forged Swords
        for (const sw of state.flyingSwords) {
          ctx.save();
          ctx.translate(sw.x, sw.y);
          ctx.rotate(sw.rot);
          if (imgs.sword.complete && imgs.sword.naturalWidth > 0) {
            ctx.drawImage(imgs.sword, -imgs.sword.width * 0.5, -imgs.sword.height * 0.5);
          }
          ctx.restore();
        }

        // 7. Sparks & 4-Point Comic Stars
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

        // 8. Comic Radial Speed Lines on Ace Hit!
        if (state.speedLines > 0.05) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 240, 140, ${state.speedLines * 0.65})`;
          ctx.lineWidth = 3.5;
          for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 * i) / 12 + 0.15;
            ctx.beginPath();
            ctx.moveTo(635 + Math.cos(a) * 55, 325 + Math.sin(a) * 55);
            ctx.lineTo(635 + Math.cos(a) * 165, 325 + Math.sin(a) * 165);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 9. Blackout Smoke Cloud
        if (state.smokeAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = state.smokeAlpha * 0.96;
          ctx.fillStyle = "#2b2c38";
          ctx.strokeStyle = "#111116";
          ctx.lineWidth = 4;
          const puffs = [[240, 290, 105], [380, 270, 115], [500, 295, 120], [630, 280, 115], [750, 305, 105]];
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

        // Top Banner Pill
        ctx.save();
        ctx.fillStyle = "rgba(17, 17, 22, 0.72)";
        ctx.strokeStyle = "#ffd84d";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(230, 56, 500, 46, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff2d6";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.banner, 480, 86);
        ctx.restore();

        ctx.fillStyle = "#ffdc5c";
        ctx.strokeStyle = "#111116";
        ctx.lineWidth = 4;
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "left";
        ctx.strokeText(`成品神兵: ${state.swords}`, 28, 508);
        ctx.fillText(`成品神兵: ${state.swords}`, 28, 508);
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
