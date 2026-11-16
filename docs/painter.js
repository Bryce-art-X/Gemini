window.ForgePainter = (() => {
  const INK = "#12121a";

  function poly(ctx, pts, fill, lw = 4.5, sil = false) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = sil ? "#0f0f17" : fill;
    ctx.fill();
    if (!sil && lw > 0) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  function rect(ctx, x, y, w, h, fill, lw = 4.5, sil = false) {
    ctx.fillStyle = sil ? "#0f0f17" : fill;
    ctx.fillRect(x, y, w, h);
    if (!sil) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.strokeRect(x, y, w, h);
    }
  }

  function circle(ctx, x, y, r, fill, lw = 4.5, sil = false) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = sil ? "#0f0f17" : fill;
    ctx.fill();
    if (!sil) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  function capsule(ctx, x1, y1, x2, y2, r, fill, lw = 4, sil = false) {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = sil ? "#0d0d14" : INK;
    ctx.lineWidth = (r + lw) * 2;
    ctx.stroke();
    if (!sil) {
      ctx.strokeStyle = fill;
      ctx.lineWidth = r * 2;
      ctx.stroke();
    }
  }

  function star4(ctx, x, y, r, fill) {
    poly(ctx, [
      [x, y - r], [x + r * 0.28, y - r * 0.28],
      [x + r, y], [x + r * 0.28, y + r * 0.28],
      [x, y + r], [x - r * 0.28, y + r * 0.28],
      [x - r, y], [x - r * 0.28, y - r * 0.28],
    ], fill, 2.5, false);
  }

  function drawFireBuddy(ctx, bx, by, beatPulse, timeSec, mood) {
    const sx = 1 + beatPulse * 0.14;
    const sy = 1 - beatPulse * 0.12 + Math.sin(timeSec * 9) * 0.05;
    const sway = Math.sin(timeSec * 6) * 5;
    poly(ctx, [
      [bx - 42 * sx, by],
      [bx - 46 * sx, by - 42 * sy],
      [bx - 18 * sx + sway, by - 82 * sy],
      [bx + sway * 1.4, by - 108 * sy],
      [bx + 20 * sx + sway, by - 76 * sy],
      [bx + 46 * sx, by - 40 * sy],
      [bx + 42 * sx, by],
    ], "#ff6b14", 3.0, false);

    poly(ctx, [
      [bx - 24 * sx, by],
      [bx - 22 * sx, by - 35 * sy],
      [bx + sway, by - 68 * sy],
      [bx + 22 * sx, by - 35 * sy],
      [bx + 24 * sx, by],
    ], "#ffdb38", 0.0, false);

    const ey = by - 34 * sy;
    const lx = bx - 13;
    const rx = bx + 13;
    if (mood === "sideeye") {
      for (const ex of [lx, rx]) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(ex, ey, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff8f1f";
        ctx.fillRect(ex - 8, ey - 8, 16, 7);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ex - 8, ey - 1); ctx.lineTo(ex + 8, ey - 1); ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(ex + 4, ey + 2, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (mood === "happy") {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (const ex of [lx, rx]) {
        ctx.beginPath(); ctx.arc(ex, ey + 2, 6, Math.PI, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "#bf1f26";
      ctx.beginPath(); ctx.arc(bx, ey + 13, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const ex of [lx, rx]) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(ex + 1, ey, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawWorkshopBg(ctx, beatPulse, timeSec, flameMood, bulbAngle, bulbOn, bellowsSqueeze) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.fillStyle = "#3d2929";
    ctx.fillRect(0, 0, 1280, 720);

    ctx.fillStyle = "rgba(74, 48, 46, 0.65)";
    for (let row = 0; row < 8; row++) {
      const y = 95 + row * 52;
      const off = row % 2 === 1 ? 45 : 0;
      for (let col = 0; col < 14; col++) {
        ctx.fillRect(off + col * 96, y, 82, 40);
      }
    }

    rect(ctx, 0, 0, 1280, 76, "#613b26");
    rect(ctx, 18, 76, 46, 480, "#593624");
    rect(ctx, 1216, 76, 46, 480, "#593624");

    rect(ctx, -10, 550, 1300, 180, "#383640");
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (let row = 0; row < 4; row++) {
      const fy = 550 + row * 44;
      ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(1280, fy); ctx.stroke();
      const foff = row % 2 === 1 ? 55 : 0;
      for (let col = 0; col < 12; col++) {
        const fx = foff + col * 115;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + 44); ctx.stroke();
      }
    }

    // Hanging wall tools
    rect(ctx, 150, 175, 130, 16, "#7a4d2e", 3.5);
    for (let i = 0; i < 2; i++) {
      const tx = 185 + i * 48;
      ctx.strokeStyle = INK; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(tx, 187); ctx.lineTo(tx, 257); ctx.stroke();
      ctx.strokeStyle = "#9ea8b8"; ctx.lineWidth = 4; ctx.stroke();
      circle(ctx, tx, 263, 11, "#9ea8b8", 3.5);
    }
    rect(ctx, 1000, 175, 130, 16, "#7a4d2e", 3.5);
    ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(1038, 187); ctx.lineTo(1038, 237); ctx.stroke();
    circle(ctx, 1038, 261, 24, "#525766", 3.5);
    ctx.beginPath(); ctx.moveTo(1092, 187); ctx.lineTo(1092, 247); ctx.stroke();
    rect(ctx, 1074, 243, 36, 20, "#9ea8b8", 3.5);

    // Furnace
    const cx = 640;
    rect(ctx, cx - 80, 76, 160, 150, "#9e4d33");
    rect(ctx, cx - 125, 210, 250, 340, "#b35738");
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(cx, 370, 76, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 76, 370, 152, 84);
    ctx.fillStyle = "#2e1412";
    ctx.beginPath(); ctx.arc(cx, 370, 68, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 68, 370, 136, 76);

    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(cx, 505, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 42, 505, 84, 45);

    // Bellows
    const belY = 522 + bellowsSqueeze * 16;
    poly(ctx, [[100, 550], [210, 550], [205, belY], [105, belY - 12]], "#ad703d");
    ctx.strokeStyle = INK; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(210, 535); ctx.lineTo(515, 535); ctx.stroke();
    ctx.strokeStyle = "#c79942"; ctx.lineWidth = 6; ctx.stroke();

    // Furnace glow & Fire Buddy
    ctx.fillStyle = `rgba(255, 128, 30, ${0.16 + beatPulse * 0.08})`;
    ctx.beginPath(); ctx.arc(cx, 385, 110 + beatPulse * 18 + bellowsSqueeze * 20, 0, Math.PI * 2); ctx.fill();
    drawFireBuddy(ctx, cx, 444, beatPulse, timeSec, flameMood);

    // Overhead Swinging Lightbulb
    const bx = 640 + Math.sin(bulbAngle) * -128;
    const by = Math.cos(bulbAngle) * 128;
    if (bulbOn) {
      ctx.fillStyle = `rgba(255, 230, 140, ${0.10 + beatPulse * 0.03})`;
      ctx.beginPath();
      ctx.moveTo(bx - 12, by + 8); ctx.lineTo(bx + 12, by + 8);
      ctx.lineTo(1020, 650); ctx.lineTo(260, 650);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(640, 0); ctx.lineTo(bx, by); ctx.stroke();
    circle(ctx, bx, by, 18, bulbOn ? "#fff07a" : "#474d5c", 4);
    if (bulbOn) {
      ctx.fillStyle = "rgba(255, 235, 115, 0.25)";
      ctx.beginPath(); ctx.arc(bx, by, 32, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAnvilStation(ctx, x, y, beatPulse, flash, facingLeft, sil) {
    const sx = 1 + beatPulse * 0.05;
    const sy = 1 - beatPulse * 0.05;
    const dir = facingLeft ? -1 : 1;

    if (!sil) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(x, y + 108, 66, 16, 0, 0, Math.PI * 2); ctx.fill();
    }

    const stY = y + 32 * sy;
    poly(ctx, [[x - 50 * sx, stY], [x + 50 * sx, stY], [x + 64 * sx, y + 108], [x - 64 * sx, y + 108]], "#9e5929", 4.5, sil);
    if (!sil) {
      ctx.strokeStyle = "#6b3819"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - 20, stY + 14); ctx.lineTo(x - 24, y + 96);
      ctx.moveTo(x + 18, stY + 16); ctx.lineTo(x + 22, y + 96); ctx.stroke();
    }

    const topY = y - 34 * sy;
    const col = flash > 0.1 ? "#fff7bd" : "#7a8a9e";
    poly(ctx, [[x + 28 * dir * sx, topY + 4], [x + 84 * dir * sx, topY + 14], [x + 28 * dir * sx, topY + 28]], flash > 0.1 ? "#fff7bd" : "#616f82", 4.5, sil);
    poly(ctx, [
      [x - 54 * sx, topY], [x + 42 * sx, topY], [x + 36 * sx, topY + 26],
      [x + 24 * sx, y + 16], [x + 46 * sx, y + 34], [x - 46 * sx, y + 34],
      [x - 24 * sx, y + 16], [x - 36 * sx, topY + 22],
    ], col, 4.5, sil);
    if (!sil) {
      ctx.strokeStyle = "#d6e6f5"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - 46 * sx, topY + 6); ctx.lineTo(x + 34 * sx, topY + 6); ctx.stroke();
    }
  }

  function drawWeaponShape(ctx, x, y, kind, sc = 1, sil = false) {
    ctx.save();
    ctx.translate(x, y);
    if (kind === "pan") {
      ctx.strokeStyle = INK; ctx.lineWidth = 10 * sc;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44 * sc); ctx.stroke();
      circle(ctx, 0, -14 * sc, 24 * sc, "#ffd13d", 4 * sc, sil);
    } else if (kind === "fish") {
      poly(ctx, [
        [0, -48 * sc], [16 * sc, -14 * sc], [10 * sc, 24 * sc],
        [18 * sc, 42 * sc], [-18 * sc, 42 * sc], [-10 * sc, 24 * sc], [-16 * sc, -14 * sc],
      ], "#8cd6fa", 3.5 * sc, sil);
      if (!sil) {
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-6 * sc, -26 * sc, 3.5 * sc, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const bladeCol = kind === "excalibur" ? "#ffe657" : "#d6f0ff";
      poly(ctx, [[0, -52 * sc], [12 * sc, -30 * sc], [10 * sc, 24 * sc], [-10 * sc, 24 * sc], [-12 * sc, -30 * sc]], bladeCol, 4 * sc, sil);
      rect(ctx, -18 * sc, 22 * sc, 36 * sc, 10 * sc, "#f5b833", 3.5 * sc, sil);
      rect(ctx, -5 * sc, 32 * sc, 10 * sc, 16 * sc, "#854729", 3 * sc, sil);
    }
    ctx.restore();
  }

  function drawBarrel(ctx, x, y, wobble, weapons, sil) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wobble * 0.16);
    ctx.scale(1 + Math.abs(wobble) * 0.08, 1 - Math.abs(wobble) * 0.08);
    if (!sil) {
      for (let i = 0; i < weapons.length; i++) {
        const w = weapons[i];
        const wx = -28 + (i % 5) * 14;
        ctx.save();
        ctx.translate(wx, -36);
        ctx.rotate(w.rot);
        drawWeaponShape(ctx, 0, 0, w.kind, 0.72, false);
        ctx.restore();
      }
    }
    poly(ctx, [[-44, -44], [44, -44], [52, 0], [40, 56], [-40, 56], [-52, 0]], "#8f572e", 4.5, sil);
    if (!sil) {
      rect(ctx, -49, -22, 98, 11, "#6b758a", 3.5);
      rect(ctx, -48, 22, 96, 11, "#6b758a", 3.5);
    }
    ctx.restore();
  }

  function drawMaster(ctx, fx, fy, beatPulse, timeSec, strikeT, windupT, mood, sil) {
    const bopX = 1 + beatPulse * 0.07;
    const bopY = 1 - beatPulse * 0.07;
    const lunge = Math.sin(Math.max(0, Math.min(1, strikeT)) * Math.PI);
    const lean = -0.14 * windupT + 0.16 * lunge;

    const hx = fx + lunge * 14;
    const hy = fy - 76 * bopY;
    capsule(ctx, hx - 24, hy + 6, fx - 42, fy - 12, 14, "#333d47", 4, sil);
    capsule(ctx, hx + 24, hy + 6, fx + 38, fy - 12, 14, "#333d47", 4, sil);
    rect(ctx, fx - 62, fy - 22, 42, 22, "#5c3d2e", 4, sil);
    rect(ctx, fx + 20, fy - 22, 46, 22, "#5c3d2e", 4, sil);

    const scx = hx + Math.sin(lean) * 95;
    const scy = hy - 95 * bopY;
    poly(ctx, [[hx - 44 * bopX, hy + 8], [hx + 44 * bopX, hy + 8], [scx + 36 * bopX, scy], [scx - 36 * bopX, scy]], "#e06b24", 4.5, sil);
    if (!sil) {
      poly(ctx, [[hx - 32 * bopX, hy + 22], [hx + 34 * bopX, hy + 22], [scx + 24 * bopX, scy + 10], [scx - 18 * bopX, scy + 10]], "#f58f1f", 3.5);
    }

    const headX = scx + Math.sin(lean) * 34 + 4;
    const headY = scy - 34;
    circle(ctx, headX, headY, 38, "#facca3", 4.5, sil);
    poly(ctx, [
      [headX - 34, headY + 2], [headX - 24, headY + 34], [headX + 8, headY + 38],
      [headX + 35, headY + 22], [headX + 34, headY - 2], [headX + 14, headY + 14], [headX - 16, headY + 12],
    ], "#573829", 4, sil);

    const tailWag = Math.sin(timeSec * 10) * 6 - lunge * 12;
    poly(ctx, [[headX - 36, headY - 14], [headX - 66, headY - 24 + tailWag], [headX - 58, headY - 8 + tailWag]], "#db3d33", 3.5, sil);
    rect(ctx, headX - 38, headY - 24, 76, 15, "#db3d33", 4, sil);

    const e1x = headX + 8, e2x = headX + 26, ey = headY - 4;
    if (sil) {
      ctx.fillStyle = "#fff073";
      ctx.beginPath(); ctx.arc(e1x, ey, 5, 0, Math.PI * 2); ctx.arc(e2x, ey, 5, 0, Math.PI * 2); ctx.fill();
    } else if (mood === "sideeye") {
      for (const ex of [e1x, e2x]) {
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#facca3"; ctx.fillRect(ex - 7, ey - 7, 14, 7);
        ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - 7, ey); ctx.lineTo(ex + 7, ey); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 4, ey + 2, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(headX + 2, headY + 22); ctx.lineTo(headX + 24, headY + 20); ctx.stroke();
    } else if (mood === "happy") {
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(e1x, ey + 2, 6, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(e2x, ey + 2, 6, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#d13842"; ctx.beginPath(); ctx.arc(headX + 14, headY + 20, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const ex of [e1x, e2x]) {
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 2, ey, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      if (windupT > 0.05) {
        ctx.fillStyle = "#b82933"; ctx.beginPath(); ctx.arc(headX + 16, headY + 20, 9, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(headX + 12, headY + 16, 9, 0.1, Math.PI - 0.1); ctx.stroke();
      }
    }

    const shX = scx + 12, shY = scy + 12;
    const ang = -2.15 + 2.05 * lunge - 0.45 * windupT;
    const elX = shX + Math.cos(ang) * 50, elY = shY + Math.sin(ang) * 50;
    const haX = elX + Math.cos(ang + 0.45) * 46, haY = elY + Math.sin(ang + 0.45) * 46;
    capsule(ctx, shX, shY, elX, elY, 11, "#facca3", 4, sil);
    capsule(ctx, elX, elY, haX, haY, 10, "#facca3", 4, sil);

    const dx = Math.cos(ang + 0.15), dy = Math.sin(ang + 0.15);
    const tipX = haX + dx * 72, tipY = haY + dy * 72;
    ctx.strokeStyle = INK; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(haX - dx * 14, haY - dy * 14); ctx.lineTo(tipX, tipY); ctx.stroke();
    if (!sil) { ctx.strokeStyle = "#945c2e"; ctx.lineWidth = 7; ctx.stroke(); }

    const px = -dy, py = dx;
    poly(ctx, [
      [tipX - dx * 18 + px * 26, tipY - dy * 18 + py * 26],
      [tipX + dx * 18 + px * 26, tipY + dy * 18 + py * 26],
      [tipX + dx * 18 - px * 26, tipY + dy * 18 - py * 26],
      [tipX - dx * 18 - px * 26, tipY - dy * 18 - py * 26],
    ], "#6b7585", 4.5, sil);

    if (lunge > 0.35 && !sil) {
      ctx.strokeStyle = `rgba(255, 240, 158, ${lunge * 0.65})`;
      ctx.lineWidth = 14 * lunge;
      ctx.beginPath(); ctx.arc(shX + 20, shY + 10, 125, -1.75, 0.15); ctx.stroke();
    }
  }

  function drawPlayer(ctx, fx, fy, beatPulse, timeSec, strikeT, bonkT, mood, trackX, trackY, sil) {
    const bopX = 1 + beatPulse * 0.07;
    const bopY = 1 - beatPulse * 0.07;
    const bonkSquash = Math.sin(Math.max(0, Math.min(1, bonkT)) * Math.PI) * 0.24;
    const lunge = Math.sin(Math.max(0, Math.min(1, strikeT)) * Math.PI);
    const lean = -0.18 * lunge;

    const hx = fx - lunge * 14;
    const hy = fy - 70 * (bopY - bonkSquash);
    capsule(ctx, hx - 20, hy + 6, fx - 36, fy - 10, 12, "#7a4d2e", 4, sil);
    capsule(ctx, hx + 20, hy + 6, fx + 36, fy - 10, 12, "#7a4d2e", 4, sil);
    rect(ctx, fx - 56, fy - 20, 38, 20, "#613824", 4, sil);
    rect(ctx, fx + 18, fy - 20, 38, 20, "#613824", 4, sil);

    const scx = hx + Math.sin(lean) * 80;
    const scy = hy - 80 * (bopY - bonkSquash);
    poly(ctx, [[hx - 36 * bopX, hy + 10], [hx + 36 * bopX, hy + 10], [scx + 28 * bopX, scy], [scx - 28 * bopX, scy]], "#3db8f5", 4.5, sil);

    const headX = scx + Math.sin(lean) * 28 - 4;
    const headY = scy - 34;
    circle(ctx, headX, headY, 35, "#ffdeb8", 4.5, sil);
    poly(ctx, [
      [headX - 34, headY - 8], [headX - 42, headY - 26], [headX - 12, headY - 40],
      [headX + 20, headY - 40], [headX + 40, headY - 20], [headX + 36, headY + 4],
      [headX + 14, headY - 14], [headX - 12, headY - 16],
    ], "#5c381f", 4, sil);

    const gogY = headY - 24 - bonkSquash * 48;
    circle(ctx, headX - 18, gogY, 11, "#bfebff", 3.5, sil);
    circle(ctx, headX + 2, gogY, 11, "#bfebff", 3.5, sil);

    const e1x = headX - 20, e2x = headX - 2, ey = headY + 2;
    const ddx = trackX - headX, ddy = trackY - headY;
    const dlen = Math.hypot(ddx, ddy) || 1;
    const lx = (ddx / dlen) * 3, ly = (ddy / dlen) * 3;

    if (sil) {
      ctx.fillStyle = "#fff073";
      ctx.beginPath(); ctx.arc(e1x, ey, 5, 0, Math.PI * 2); ctx.arc(e2x, ey, 5, 0, Math.PI * 2); ctx.fill();
    } else if (bonkT > 0.05) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      for (const ex of [e1x, e2x]) {
        ctx.beginPath(); ctx.moveTo(ex - 5, ey - 5); ctx.lineTo(ex + 5, ey + 5);
        ctx.moveTo(ex + 5, ey - 5); ctx.lineTo(ex - 5, ey + 5); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(headX - 12, headY + 22, 8, Math.PI, Math.PI * 2); ctx.stroke();
      circle(ctx, headX - 4, headY - 44, 14 * Math.max(0.3, Math.min(1, bonkT * 2)), "#fa4752", 3.5);
      for (let i = 0; i < 3; i++) {
        const sa = timeSec * 8 + (i * Math.PI * 2) / 3;
        star4(ctx, headX + Math.cos(sa) * 34, headY - 56 + Math.sin(sa) * 10, 9, "#ffe040");
      }
    } else if (mood === "happy") {
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(e1x, ey + 2, 5.5, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(e2x, ey + 2, 5.5, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#d63842"; ctx.beginPath(); ctx.arc(headX - 12, headY + 18, 6.5, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const ex of [e1x, e2x]) {
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lx, ey + ly, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(headX - 12, headY + 15, 7.5, 0.1, Math.PI - 0.1); ctx.stroke();
    }

    const shX = scx - 10, shY = scy + 12;
    const ang = -0.92 + (-2.98 + 0.92) * lunge;
    const elX = shX + Math.cos(ang) * 46, elY = shY + Math.sin(ang) * 46;
    const haX = elX + Math.cos(ang - 0.38) * 42, haY = elY + Math.sin(ang - 0.38) * 42;
    capsule(ctx, shX, shY, elX, elY, 9.5, "#ffdeb8", 4, sil);
    capsule(ctx, elX, elY, haX, haY, 9, "#6b3d24", 4, sil);

    const dx = Math.cos(ang - 0.15), dy = Math.sin(ang - 0.15);
    const tipX = haX + dx * 66, tipY = haY + dy * 66;
    ctx.strokeStyle = INK; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(haX - dx * 12, haY - dy * 12); ctx.lineTo(tipX, tipY); ctx.stroke();
    if (!sil) { ctx.strokeStyle = "#945c2e"; ctx.lineWidth = 6; ctx.stroke(); }

    const px = -dy, py = dx;
    poly(ctx, [
      [tipX - dx * 16 + px * 22, tipY - dy * 16 + py * 22],
      [tipX + dx * 16 + px * 22, tipY + dy * 16 + py * 22],
      [tipX + dx * 16 - px * 22, tipY + dy * 16 - py * 22],
      [tipX - dx * 16 - px * 22, tipY - dy * 16 - py * 22],
    ], "#8f9ead", 4, sil);

    if (lunge > 0.35 && !sil) {
      ctx.strokeStyle = `rgba(255, 240, 158, ${lunge * 0.65})`;
      ctx.lineWidth = 14 * lunge;
      ctx.beginPath(); ctx.arc(shX - 20, shY + 10, 118, -3.25, -1.25); ctx.stroke();
    }
  }

  return {
    drawWorkshopBg,
    drawAnvilStation,
    drawBarrel,
    drawWeaponShape,
    drawMaster,
    drawPlayer,
    star4,
    rect,
  };
})();
