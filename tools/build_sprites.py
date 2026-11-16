import os
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BRAIN = r"C:\Users\ymxiong\.gemini\antigravity\brain\058b76cf-1930-49db-bca2-364667b3bb04"
PROJ = r"C:\Users\ymxiong\.gemini\antigravity\scratch\rhythm-heaven-mini"
TEX_GODOT = os.path.join(PROJ, "assets", "textures")
TEX_WEB = os.path.join(PROJ, "docs", "assets")

for d in (TEX_GODOT, TEX_WEB):
    os.makedirs(d, exist_ok=True)


def save_both(img, name):
    img.save(os.path.join(TEX_GODOT, name), optimize=True)
    img.save(os.path.join(TEX_WEB, name), optimize=True)


def flood_remove_white(path, thresh=226, chroma=28):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    bg_mask = (r > thresh) & (g > thresh) & (b > thresh) & ((np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < chroma)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg_mask[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if bg_mask[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and bg_mask[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))

    arr[visited, 3] = 0
    # Soft anti-aliased edge cleanup on pixels bordering transparent background
    alpha = arr[:, :, 3].astype(np.float32)
    # Remove faint white halo on 1px outer fringe
    border_dilated = np.zeros_like(visited)
    border_dilated[1:, :] |= visited[:-1, :]
    border_dilated[:-1, :] |= visited[1:, :]
    border_dilated[:, 1:] |= visited[:, :-1]
    border_dilated[:, :-1] |= visited[:, 1:]
    fringe = border_dilated & (~visited)
    bright = (r + g + b) / 3.0
    halo = fringe & (bright > 190)
    arr[halo, 3] = np.clip((255 - bright[halo]) * 3.0, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def trim_and_scale_height(img, target_h, pad=8):
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    new_w = max(1, int(round(w * target_h / h)))
    scaled = img.resize((new_w, target_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (new_w + pad * 2, target_h + pad * 2), (0, 0, 0, 0))
    canvas.paste(scaled, (pad, pad))
    return canvas


def build_clean_bg():
    bg = Image.open(os.path.join(BRAIN, "forge_bg_1794799959970.jpg")).convert("RGBA")
    bg = bg.resize((1280, 720), Image.Resampling.LANCZOS)
    # Remove the small left-center anvil/stump in background (x: 310..505, y: 375..565)
    # Cleanly patch wall bricks from right-symmetric mirror & clean floor tiles from below
    arr = np.array(bg)
    # Wall region (y 375..538, x 315..495) <- mirror from clean wall region around furnace right side or adjacent left brick
    # Actually left wall x 180..315 and floor y 565..700 are super clean! Let's inspect coordinates carefully.
    wall_patch = bg.crop((190, 380, 320, 536))
    wall_patch_flipped = wall_patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    bg.paste(wall_patch_flipped, (320, 380))
    wall_patch2 = bg.crop((235, 380, 325, 536))
    bg.paste(wall_patch2, (425, 380))

    # Floor tile patch (y 515..575, x 315..495) <- sample clean tiles from x 560..740 at y 540..600
    floor_patch = bg.crop((540, 545, 730, 605))
    bg.paste(floor_patch, (315, 515))
    # Smooth vertical seam feathering around x=320, x=495, y=515
    bg_arr = np.array(bg).astype(np.float32)
    orig_arr = arr.astype(np.float32)
    # Blend only inside mask with 12px feather
    mask = np.zeros((720, 1280), dtype=np.float32)
    mask[382:568, 322:492] = 1.0
    mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))
    m = (np.array(mask_img).astype(np.float32) / 255.0)[:, :, None]
    blended = orig_arr * (1.0 - m) + bg_arr * m
    clean = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8), "RGBA")
    save_both(clean, "forge_bg.png")
    # Also save 960x540 copy? Actually 1280x720 works great for both Godot and 960x540 canvas!
    print("Saved forge_bg.png:", clean.size)


def align_pair_by_feet(img_a, img_b, target_h=340):
    """Scale both poses proportionally so feet align at the same bottom Y baseline."""
    ba = img_a.getbbox()
    bb = img_b.getbbox()
    ca = img_a.crop(ba) if ba else img_a
    cb = img_b.crop(bb) if bb else img_b
    # Master in windup has hammer raised higher than strike, so align body height (~same scale factor!)
    scale = target_h / max(ca.height, cb.height)
    wa, ha = int(round(ca.width * scale)), int(round(ca.height * scale))
    wb, hb = int(round(cb.width * scale)), int(round(cb.height * scale))
    sa = ca.resize((wa, ha), Image.Resampling.LANCZOS)
    sb = cb.resize((wb, hb), Image.Resampling.LANCZOS)

    out_w = max(wa, wb) + 24
    out_h = max(ha, hb) + 24
    out_a = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    out_b = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    # Anchor bottom-center!
    out_a.paste(sa, ((out_w - wa) // 2, out_h - ha - 6))
    out_b.paste(sb, ((out_w - wb) // 2 + 18, out_h - hb - 6))
    return out_a, out_b


def make_silhouette(img, eye_boxes=None):
    arr = np.array(img)
    sil = np.zeros_like(arr)
    sil[:, :, 0] = 14
    sil[:, :, 1] = 14
    sil[:, :, 2] = 20
    sil[:, :, 3] = arr[:, :, 3]
    out = Image.fromarray(sil, "RGBA")
    if eye_boxes:
        d = ImageDraw.Draw(out)
        for ex, ey, er in eye_boxes:
            d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(255, 240, 120, 255))
    return out


def build_characters_and_anvil():
    # Anvil
    anvil = flood_remove_white(os.path.join(BRAIN, "anvil_raw_1794799967993.jpg"))
    anvil = trim_and_scale_height(anvil, 145, pad=6)
    save_both(anvil, "anvil.png")

    # Master Windup + Master Strike
    m_wind = flood_remove_white(os.path.join(BRAIN, "master_raw_1794799963219.jpg"))
    m_strk = flood_remove_white(os.path.join(BRAIN, "master_strike_1794837730540.jpg"))
    m_wind, m_strk = align_pair_by_feet(m_wind, m_strk, target_h=335)
    save_both(m_wind, "master_windup.png")
    save_both(m_strk, "master_strike.png")

    # Create Master Side-Eye Glare & Happy expression on m_wind cleanly!
    # Locate white eye pixels inside Master's face region (upper-mid center)
    w, h = m_wind.size
    m_side = m_wind.copy()
    arr = np.array(m_side)
    # Master's face eyes are in normalized box y:[0.22..0.33], x:[0.44..0.66]
    y0, y1 = int(h * 0.21), int(h * 0.34)
    x0, x1 = int(w * 0.44), int(w * 0.68)
    face_skin = (242, 185, 132, 255)
    d = ImageDraw.Draw(m_side)
    # Paint crisp Rhythm Heaven deadpan half-lidded side-eye glare over original eyes!
    # Check exact eye white centroid automatically:
    sub = arr[y0:y1, x0:x1]
    white_mask = (sub[:, :, 0] > 230) & (sub[:, :, 1] > 225) & (sub[:, :, 2] > 215) & (sub[:, :, 3] > 200)
    ys, xs = np.where(white_mask)
    if len(xs) > 10:
        # Split left eye and right eye clusters by x median
        med_x = np.median(xs)
        for mask_side in (xs <= med_x, xs > med_x):
            if np.any(mask_side):
                ex0 = x0 + int(xs[mask_side].min()) - 2
                ex1 = x0 + int(xs[mask_side].max()) + 2
                ey0 = y0 + int(ys[mask_side].min()) - 2
                ey1 = y0 + int(ys[mask_side].max()) + 2
                # Half-lid cover top half with skin, crisp dark horizontal lid line, pupil shifted right!
                mid_y = (ey0 + ey1) // 2
                d.rectangle([ex0 - 2, ey0 - 3, ex1 + 2, mid_y], fill=face_skin)
                d.line([ex0 - 2, mid_y, ex1 + 2, mid_y], fill=(17, 17, 22, 255), width=3)
                d.ellipse([ex1 - 6, mid_y + 1, ex1, ey1], fill=(17, 17, 22, 255))
    save_both(m_side, "master_sideeye.png")

    # Master Happy: glowing curved ^ ^ eyes on m_wind
    m_happy = m_wind.copy()
    dh = ImageDraw.Draw(m_happy)
    if len(xs) > 10:
        med_x = np.median(xs)
        for mask_side in (xs <= med_x, xs > med_x):
            if np.any(mask_side):
                ex0 = x0 + int(xs[mask_side].min()) - 2
                ex1 = x0 + int(xs[mask_side].max()) + 2
                ey0 = y0 + int(ys[mask_side].min()) - 2
                ey1 = y0 + int(ys[mask_side].max()) + 2
                dh.rectangle([ex0 - 1, ey0 - 1, ex1 + 1, ey1 + 1], fill=face_skin)
                dh.arc([ex0, ey0 + 2, ex1, ey1 + 4], 190, 350, fill=(17, 17, 22, 255), width=4)
    save_both(m_happy, "master_happy.png")

    # Player Ready (from player_raw_1794799962574.jpg)
    p_raw = flood_remove_white(os.path.join(BRAIN, "player_raw_1794799962574.jpg"))
    p_ready = trim_and_scale_height(p_raw, 310, pad=10)
    save_both(p_ready, "player_ready.png")

    # Player Strike: clean torso+legs + rotated illustrated hammer/arms OR full pose squash/tilt
    # Let's segment player_ready cleanly into body (without raised upper-right hammer) & separate hammer-arm pivot!
    # Look at player_raw: the raised hammer + forearms sit cleanly in top-right (above line from shoulder to top-right).
    # Actually let's check visually via read_file before doing risky cuts — better yet, let's build a clean rotated arm+hammer overlay OR test!
    # Even safer: let's save player_ready.png AND inspect its exact pixel coords in read_file first!

    # Silhouettes for Blackout!
    save_both(make_silhouette(m_wind), "master_windup_sil.png")
    save_both(make_silhouette(m_strk), "master_strike_sil.png")
    save_both(make_silhouette(p_ready), "player_ready_sil.png")
    save_both(make_silhouette(anvil), "anvil_sil.png")
    print("Saved master & player & anvil sprites:", m_wind.size, m_strk.size, p_ready.size, anvil.size)


def build_cel_props():
    S = 4
    INK = (17, 17, 22, 255)

    # 1. Molten Glowing Ingot (68x34) with inner gradient & specular highlight
    w, h = 68, 34
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Outer glow aura
    d.rounded_rectangle([2 * S, 2 * S, (w - 2) * S, (h - 2) * S], radius=8 * S, fill=(255, 130, 30, 80))
    # Main bar body
    d.rounded_rectangle([8 * S, 7 * S, (w - 8) * S, (h - 7) * S], radius=6 * S, fill=(255, 110, 28, 255), outline=INK, width=4 * S)
    # Hot core highlight
    d.rounded_rectangle([13 * S, 10 * S, (w - 14) * S, 18 * S], radius=3 * S, fill=(255, 220, 95, 255))
    d.rounded_rectangle([16 * S, 11 * S, (w - 22) * S, 14 * S], radius=2 * S, fill=(255, 250, 195, 255))
    save_both(img.resize((w, h), Image.Resampling.LANCZOS), "ingot_normal.png")

    # 2. Giant Fiery Greatsword Blank (104x46) for 2-beat Heavy Lob!
    w2, h2 = 104, 46
    img2 = Image.new("RGBA", (w2 * S, h2 * S), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(img2)
    pts = [(10 * S, 14 * S), (72 * S, 10 * S), (96 * S, 23 * S), (72 * S, 36 * S), (10 * S, 32 * S)]
    d2.polygon(pts, fill=(255, 85, 25, 255), outline=INK, width=4 * S)
    inner_pts = [(16 * S, 17 * S), (70 * S, 14 * S), (86 * S, 23 * S), (70 * S, 27 * S), (16 * S, 26 * S)]
    d2.polygon(inner_pts, fill=(255, 225, 90, 255))
    save_both(img2.resize((w2, h2), Image.Resampling.LANCZOS), "ingot_heavy.png")

    # 3. Gleaming Finished Sword (54x118) matching Anvil cel-shaded steel style
    ws, hs = 54, 118
    imgs = Image.new("RGBA", (ws * S, hs * S), (0, 0, 0, 0))
    ds = ImageDraw.Draw(imgs)
    # Blade left & right bevels
    ds.polygon([(27 * S, 4 * S), (14 * S, 24 * S), (16 * S, 82 * S), (27 * S, 82 * S)], fill=(230, 244, 255, 255))
    ds.polygon([(27 * S, 4 * S), (40 * S, 24 * S), (38 * S, 82 * S), (27 * S, 82 * S)], fill=(148, 175, 202, 255))
    ds.polygon([(27 * S, 4 * S), (40 * S, 24 * S), (38 * S, 82 * S), (16 * S, 82 * S), (14 * S, 24 * S)], outline=INK, width=4 * S)
    ds.line([(27 * S, 8 * S), (27 * S, 80 * S)], fill=(100, 122, 148, 255), width=2 * S)
    # Gold crossguard
    ds.rounded_rectangle([6 * S, 80 * S, 48 * S, 92 * S], radius=4 * S, fill=(248, 184, 52, 255), outline=INK, width=4 * S)
    # Grip & pommel
    ds.rounded_rectangle([21 * S, 92 * S, 33 * S, 108 * S], radius=3 * S, fill=(132, 74, 42, 255), outline=INK, width=3 * S)
    ds.ellipse([19 * S, 104 * S, 35 * S, 115 * S], fill=(248, 184, 52, 255), outline=INK, width=3 * S)
    save_both(imgs.resize((ws, hs), Image.Resampling.LANCZOS), "sword.png")

    # 4. Crisp 4-point comic star spark (36x36)
    wk = 36
    imgk = Image.new("RGBA", (wk * S, wk * S), (0, 0, 0, 0))
    dk = ImageDraw.Draw(imgk)
    dk.polygon([(18*S,2*S),(22*S,14*S),(34*S,18*S),(22*S,22*S),(18*S,34*S),(14*S,22*S),(2*S,18*S),(14*S,14*S)], fill=(255, 236, 90, 255), outline=INK, width=3*S)
    save_both(imgk.resize((wk, wk), Image.Resampling.LANCZOS), "spark.png")
    print("Saved cel-shaded props!")


if __name__ == "__main__":
    build_clean_bg()
    build_characters_and_anvil()
    build_cel_props()
