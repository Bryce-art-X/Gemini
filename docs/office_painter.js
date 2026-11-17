window.OfficePainter = (() => {
  const BASE_W = 640;
  const BASE_H = 360;
  const SCALE = 2; // 1280x720 target canvas

  const TEXTURE_NAMES = [
    "bg_office",
    "boss_door",
    "boss_eyes",
    "boss_glass",
    "boss_shadow",
    "screen_game_0",
    "screen_game_1",
    "screen_excel_0",
    "screen_excel_1",
    "screen_caught",
    "slacker_slack_0",
    "slacker_slack_1",
    "slacker_work_0",
    "slacker_work_1",
    "slacker_barely",
    "slacker_caught",
    "stamp_ot",
  ];

  const PIXEL_FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "5": ["111", "100", "111", "001", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    ":": ["000", "010", "000", "010", "000"],
  };

  const textures = {};
  let preloaded = false;

  async function preloadAll() {
    if (preloaded) return;
    await Promise.all(
      TEXTURE_NAMES.map(
        (name) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              textures[name] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `assets/textures/${name}.png?v=7`;
          })
      )
    );
    preloaded = true;
  }

  function drawTex(ctx, name, x, y, w = null, h = null, alpha = 1.0) {
    const tex = textures[name];
    if (!tex) return;
    const dw = w === null ? tex.width : w;
    const dh = h === null ? tex.height : h;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(tex, Math.round(x * SCALE), Math.round(y * SCALE), Math.round(dw * SCALE), Math.round(dh * SCALE));
    ctx.restore();
  }

  function drawLcdClock(ctx, timeStr, isVictory) {
    ctx.fillStyle = isVictory ? "#59ff8c" : "#e0f56b";
    let ox = 222;
    const oy = 86;
    for (let i = 0; i < timeStr.length; i++) {
      const ch = timeStr[i];
      const rows = PIXEL_FONT[ch] || [];
      for (let r = 0; r < rows.length; r++) {
        const line = rows[r];
        for (let c = 0; c < line.length; c++) {
          if (line[c] === "1") {
            ctx.fillRect(
              Math.round((ox + c * 2.0) * SCALE),
              Math.round((oy + r * 1.4) * SCALE),
              Math.round(1.8 * SCALE),
              Math.round(1.3 * SCALE)
            );
          }
        }
      }
      ox += ch === ":" ? 5.0 : 7.5;
    }
  }

  function drawScene(ctx, st) {
    const beatF = st.beatFloat || 0;
    const beatPulse = st.beatPulse || 0;
    const clock = st.clock || 0;
    const pose = st.slackerPose || "slack";
    const bounce = st.slackerBounce || 0;
    const glassProg = st.glassProgress ?? -1;
    const bossDoorVis = st.bossDoorVis || 0;
    const bossPop = st.bossPop || 0;
    const blackout = st.blackoutAlpha || 0;
    const caughtT = st.caughtT || 0;
    const suspiciousT = st.suspiciousT || 0;
    const stampT = st.stampT || 0;
    const timeStr = st.timeStr || "17:58";
    const shakeX = st.shakeX || 0;
    const shakeY = st.shakeY || 0;
    const particles = st.particles || [];

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, BASE_W * SCALE, BASE_H * SCALE);
    ctx.translate(shakeX, shakeY);

    // 1. Background
    drawTex(ctx, "bg_office", 0, 0, BASE_W, BASE_H, 1.0);

    // 2. Digital LCD Wall Clock
    drawLcdClock(ctx, timeStr, timeStr === "18:00");

    // 3. Frosted Glass Boss Walking Silhouette
    if (glassProg >= 0 && blackout < 0.85) {
      const bx = 208 + (396 - 208) * Math.max(0, Math.min(1, glassProg));
      const by = 26 - Math.abs(Math.sin(glassProg * Math.PI * 3)) * 4;
      ctx.save();
      ctx.beginPath();
      ctx.rect(204 * SCALE, 18 * SCALE, 238 * SCALE, 138 * SCALE);
      ctx.clip();
      drawTex(ctx, "boss_glass", bx, by, 79, 171, (1.0 - blackout) * 0.95);
      ctx.restore();
    }

    // Frosted glass slat highlight sheen
    if (blackout < 0.95) {
      ctx.fillStyle = `rgba(219, 240, 255, ${(0.08 * (1 - blackout)).toFixed(3)})`;
      for (let gx = 214; gx < 440; gx += 24) {
        ctx.fillRect(gx * SCALE, 18 * SCALE, 2 * SCALE, 138 * SCALE);
      }
    }

    // 4. Hallway Corridor Lights-Off Blackout (cubicle desk stays lit!)
    if (blackout > 0.01) {
      ctx.fillStyle = `rgba(5, 8, 20, ${(0.92 * blackout).toFixed(3)})`;
      ctx.fillRect(202 * SCALE, 16 * SCALE, 242 * SCALE, 142 * SCALE);
      ctx.fillRect(444 * SCALE, 0, 196 * SCALE, 360 * SCALE);
      ctx.fillStyle = `rgba(5, 10, 26, ${(0.28 * blackout).toFixed(3)})`;
      ctx.fillRect(0, 0, 444 * SCALE, 360 * SCALE);
    }

    // 5. Doorway Boss + Shadow
    if (bossDoorVis > 0.01) {
      const slideIn = (1.0 - bossDoorVis) * 14.0;
      const popScale = 1.0 + bossPop * 0.05;
      const shAlpha = bossDoorVis * (1.0 - blackout * 0.85);
      if (shAlpha > 0.02) {
        drawTex(ctx, "boss_shadow", 455, 237, 133, 123, shAlpha);
      }
      const bw = 79 * popScale;
      const bh = 171 * popScale;
      const bx = 503 + slideIn - (bw - 79) * 0.5;
      const by = 66 - (bh - 171) + (caughtT <= 0 ? beatPulse * 1.5 : 0);

      if (blackout < 0.85) {
        drawTex(ctx, "boss_door", bx, by, bw, bh, bossDoorVis * (1.0 - blackout * 0.5));
        if (caughtT > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "source-atop";
          ctx.restore();
          // Subtle red anger tint halo near doorway when caught
          ctx.fillStyle = `rgba(255, 50, 50, ${(0.22 * caughtT).toFixed(3)})`;
          ctx.fillRect(500 * SCALE, 64 * SCALE, 86 * SCALE, 174 * SCALE);
        }
      }
      if (blackout > 0.15) {
        drawTex(ctx, "boss_eyes", bx, by, bw, bh, bossDoorVis);
      }

      if (suspiciousT > 0) {
        ctx.fillStyle = `rgba(255, 217, 64, ${suspiciousT.toFixed(3)})`;
        ctx.fillRect(538 * SCALE, 46 * SCALE, 8 * SCALE, 14 * SCALE);
        ctx.fillStyle = `rgba(38, 26, 12, ${suspiciousT.toFixed(3)})`;
        ctx.fillRect(540 * SCALE, 48 * SCALE, 4 * SCALE, 6 * SCALE);
        ctx.fillRect(540 * SCALE, 56 * SCALE, 4 * SCALE, 3 * SCALE);
      } else if (caughtT > 0) {
        ctx.fillStyle = "#ff3838";
        ctx.fillRect(537 * SCALE, 40 * SCALE, 10 * SCALE, 14 * SCALE);
        ctx.fillRect(537 * SCALE, 56 * SCALE, 10 * SCALE, 4 * SCALE);
      }
    }

    // 6. CRT Monitor Screen (68x54 at x=233, y=141)
    const beatStep = ((Math.floor(beatF * 2) % 2) + 2) % 2;
    const beatWhole = ((Math.floor(beatF) % 2) + 2) % 2;
    let crtTex = `screen_game_${beatWhole}`;
    if (pose === "caught") crtTex = "screen_caught";
    else if (pose === "work" || pose === "barely") crtTex = `screen_excel_${beatStep}`;
    drawTex(ctx, crtTex, 233, 141, 68, 54, 1.0);

    // 7. Slacker Sprite (194x170 at x=110, y=120)
    let slackerTex = `slacker_slack_${beatWhole}`;
    if (pose === "work") slackerTex = `slacker_work_${beatStep}`;
    else if (pose === "barely") slackerTex = "slacker_barely";
    else if (pose === "caught") slackerTex = "slacker_caught";
    const bobY = beatPulse * 1.5 - bounce;
    drawTex(ctx, slackerTex, 110, 120 + bobY, 194, 170, 1.0);

    // 8. Coffee Mug Pixel Steam
    for (let i = 0; i < 3; i++) {
      const ph = (clock * 1.6 + i * 0.33) % 1.0;
      const sx = 291 + Math.sin(clock * 4.0 + i * 2.1) * 2.5 + i * 2.0;
      const sy = 264 - ph * 16;
      ctx.fillStyle = `rgba(255, 245, 224, ${((1 - ph) * 0.55).toFixed(3)})`;
      ctx.fillRect(Math.round(sx * SCALE), Math.round(sy * SCALE), 2 * SCALE, 2 * SCALE);
    }

    // 9. Pixel Particles
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x * SCALE), Math.round(p.y * SCALE), p.size * SCALE, p.size * SCALE);
      ctx.restore();
    }

    // 10. Giant Pixel "OT!" Stamp when Caught
    if (stampT > 0.01) {
      const sc = 1.35 + (1.0 - 1.35) * Math.min(1, (1 - stampT) * 4);
      const sw = 160 * sc;
      const sh = 68 * sc;
      drawTex(ctx, "stamp_ot", 410 - sw * 0.5, 42 - sh * 0.5, sw, sh, Math.min(1, stampT * 2.5));
    }

    ctx.restore();
  }

  return { preloadAll, drawScene };
})();
