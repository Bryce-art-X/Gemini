import os
import numpy as np
from PIL import Image, ImageDraw

SRC = r"C:\Users\ymxiong\.gemini\antigravity\brain\058b76cf-1930-49db-bca2-364667b3bb04\concept_style_b_pixel_1794890993648.jpg"
PROJ = r"C:\Users\ymxiong\.gemini\antigravity\scratch\rhythm-heaven-mini"
OUT_G = os.path.join(PROJ, "assets", "textures")
OUT_W = os.path.join(PROJ, "docs", "assets", "textures")

for d in (OUT_G, OUT_W):
    os.makedirs(d, exist_ok=True)


def save_both(img, name):
    img.save(os.path.join(OUT_G, name), optimize=True)
    img.save(os.path.join(OUT_W, name), optimize=True)


def build_base_and_boss():
    raw = Image.open(SRC).convert("RGBA")
    # 640x360 crisp workspace for BG & Boss
    base640 = raw.resize((640, 360), Image.Resampling.BILINEAR)
    arr640 = np.array(base640)

    # 1. Extract Boss Silhouette cleanly (strip doorway frame edges & floor speck)
    boss_crop = base640.crop((503, 66, 582, 237)).copy()
    barr = np.array(boss_crop)
    lum = (barr[:, :, 0].astype(int) + barr[:, :, 1].astype(int) + barr[:, :, 2].astype(int)) / 3.0
    is_dark_boss = lum < 82
    bh, bw, _ = barr.shape
    eye_zone = np.zeros((bh, bw), dtype=bool)
    eye_zone[18:27, 29:47] = True
    is_eyes = eye_zone & (lum > 125)
    keep = is_dark_boss | is_eyes
    keep[:, :5] = False
    keep[:, 74:] = False
    keep[165:, 60:] = False
    barr[~keep, 3] = 0

    boss_sil_arr = barr.copy()
    boss_sil_arr[keep, :3] = [28, 38, 54]
    boss_sil_arr[keep, 3] = 105
    save_both(Image.fromarray(boss_sil_arr, "RGBA"), "boss_glass.png")

    # Add iconic menacing anime glowing pixel glasses onto boss_door & boss_eyes!
    boss_im = Image.fromarray(barr, "RGBA")
    db = ImageDraw.Draw(boss_im)
    eyes_im = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    de = ImageDraw.Draw(eyes_im)
    for d_cur in (db, de):
        # Left lens & right lens slightly turned left toward player
        d_cur.rectangle([28, 20, 34, 23], fill=(235, 248, 255, 255))
        d_cur.rectangle([37, 20, 44, 23], fill=(235, 248, 255, 255))
        # Diagonal anime glasses glint highlight
        d_cur.line([(29, 23), (32, 20)], fill=(140, 225, 255, 255), width=1)
        d_cur.line([(38, 23), (41, 20)], fill=(140, 225, 255, 255), width=1)
    save_both(boss_im, "boss_door.png")
    save_both(eyes_im, "boss_eyes.png")

    sh_crop = base640.crop((455, 237, 588, 360)).copy()
    sarr = np.array(sh_crop)
    slum = (sarr[:, :, 0].astype(int) + sarr[:, :, 1].astype(int) + sarr[:, :, 2].astype(int)) / 3.0
    is_shad = slum < 45
    sarr[~is_shad, 3] = 0
    sarr[is_shad] = [10, 14, 24, 145]
    save_both(Image.fromarray(sarr, "RGBA"), "boss_shadow.png")

    # 2. Empty Office Background
    bg_arr = arr640.copy()
    for y in range(66, 237):
        left_col = bg_arr[y, 505:508].mean(axis=0)
        right_col = bg_arr[y, 576:579].mean(axis=0)
        for x in range(505, 581):
            t = (x - 505) / 75.0
            bg_arr[y, x] = np.clip(left_col * (1 - t) + right_col * t, 0, 255).astype(np.uint8)

    c_beam_base = bg_arr[236, 515:570].mean(axis=0).astype(np.float32)
    for y in range(237, 360):
        prog = (y - 237.0) / 123.0
        c_beam = c_beam_base * (1.0 - 0.58 * prog)
        c_beam[3] = 255.0
        c_side_l = bg_arr[y, 444:450].mean(axis=0).astype(np.float32)
        c_side_r = bg_arr[y, 584:590].mean(axis=0).astype(np.float32)
        beam_l = 505.0 - 46.0 * prog
        beam_r = 581.0 + 4.0 * prog
        for x in range(452, 588):
            if beam_l <= x <= beam_r:
                tile_shade = 0.90 if (y in (260, 286, 315, 346)) else 1.0
                edge = min((x - beam_l) / 10.0, (beam_r - x) / 8.0, 1.0)
                side_c = c_side_l if x < 540 else c_side_r
                col = side_c * (1.0 - edge) + (c_beam * tile_shade) * edge
                col[3] = 255.0
                bg_arr[y, x] = np.clip(col, 0, 255).astype(np.uint8)
            else:
                side_c = c_side_l if x < 540 else c_side_r
                bg_arr[y, x] = np.clip(side_c, 0, 255).astype(np.uint8)

    bg_arr[82:96, 215:261, :3] = [20, 28, 26]
    save_both(Image.fromarray(bg_arr, "RGBA"), "bg_office.png")

    # 3. CRT Monitor Screens (68x54 at x:233, y:141)
    scr_orig = base640.crop((233, 141, 301, 195)).copy()
    save_both(scr_orig, "screen_game_0.png")

    g1_arr = np.array(scr_orig)
    mid_strip = g1_arr[14:38, 18:48].copy()
    sky_col = g1_arr[12, 10]
    g1_arr[14:38, 18:48] = sky_col
    g1_arr[12:36, 18:48] = mid_strip
    save_both(Image.fromarray(g1_arr, "RGBA"), "screen_game_1.png")

    def make_excel_screen(tall_bump=0):
        ex = Image.new("RGBA", (68, 54), (242, 248, 244, 255))
        d = ImageDraw.Draw(ex)
        d.rectangle([0, 0, 67, 10], fill=(24, 142, 68, 255))
        d.rectangle([3, 3, 28, 7], fill=(220, 250, 228, 255))
        for gx in range(0, 68, 14):
            d.line([(gx, 11), (gx, 53)], fill=(215, 224, 220, 255), width=1)
        for gy in range(18, 54, 9):
            d.line([(0, gy), (67, gy)], fill=(215, 224, 220, 255), width=1)
        bars = [
            (8, 22, (52, 128, 235, 255)),
            (22, 28, (32, 178, 108, 255)),
            (36, 34, (242, 168, 36, 255)),
            (50, 40 + tall_bump, (232, 68, 72, 255)),
        ]
        for bx, bh_bar, col in bars:
            d.rectangle([bx, 50 - bh_bar, bx + 9, 50], fill=col, outline=(28, 34, 46, 255))
        return ex

    save_both(make_excel_screen(0), "screen_excel_0.png")
    save_both(make_excel_screen(4), "screen_excel_1.png")

    sc_caught = Image.new("RGBA", (68, 54), (195, 28, 38, 255))
    dc = ImageDraw.Draw(sc_caught)
    dc.rectangle([2, 2, 65, 51], outline=(255, 230, 80, 255), width=2)
    dc.rectangle([28, 10, 39, 32], fill=(255, 240, 110, 255))
    dc.rectangle([28, 37, 39, 44], fill=(255, 240, 110, 255))
    save_both(sc_caught, "screen_caught.png")


def build_slacker_320():
    raw = Image.open(SRC).convert("RGBA")
    im320 = raw.resize((320, 180), Image.Resampling.BILINEAR)
    arr = np.array(im320)

    def make_pose(mode, dy_l=0, dy_r=0):
        w = arr.copy()
        if mode in ("work", "barely"):
            # 1. Cleanly restore wall, ruler, binder & desk behind ENTIRE raised chip arm + resting elbow!
            for yy in range(88, 112):
                for xx in range(85, 113):
                    if xx < 87 and yy < 96:
                        continue
                    w[yy, xx] = arr[82 + (yy % 5), xx]
            # Desk / wall transition at y=112..122, x=98..115
            for yy in range(112, 119):
                for xx in range(101, 115):
                    w[yy, xx] = arr[yy, 117 + (xx % 4)]  # Extend keyboard edge smoothly
            for yy in range(118, 123):
                for xx in range(102, 115):
                    w[yy, xx] = arr[yy, 117 + (xx % 4)]  # Extend brown wood desk smoothly
            # Restore green shirt belly edge behind where elbow sat (x=96..104, y=111..122)
            for yy in range(111, 123):
                for xx in range(96, 104):
                    w[yy, xx] = arr[yy, 94] if arr[yy, 94, 1] > arr[yy, 94, 0] else [74, 104, 52, 255]

        # Eyes inside glasses
        for (lx0, lx1, ly0, ly1) in ((71, 76, 82, 85), (81, 85, 81, 84)):
            w[ly0:ly1, lx0:lx1] = [244, 228, 208, 255]
            if mode in ("work", "barely"):
                w[ly0:ly0 + 2, lx1 - 2:lx1] = [26, 20, 26, 255]
            elif mode == "caught":
                mx = (lx0 + lx1) // 2
                w[ly0:ly0 + 2, mx:mx + 2] = [26, 20, 26, 255]

        # Mouth (cover full y=89..96 cleanly using true cheek skin at x=70, x=85!)
        for yy in range(89, 96):
            cl = arr[min(93, yy), 70].astype(np.float32)
            cr = arr[min(93, yy), 85].astype(np.float32)
            for xx in range(72, 85):
                t = (xx - 72) / 13.0
                w[yy, xx] = np.clip(cl * (1.0 - t) + cr * t, 0, 255).astype(np.uint8)

        if mode in ("work", "barely"):
            w[92, 75:81] = [34, 22, 26, 255]
            w[77:80, 65] = [90, 205, 255, 255]
            w[77, 65] = [220, 248, 255, 255]
            if mode == "barely":
                # Cheek crumb!
                w[92:94, 82:84] = [255, 202, 54, 255]
        elif mode == "caught":
            w[91:95, 76:80] = [165, 34, 46, 255]
            w[91, 76:80] = [28, 18, 22, 255]
            w[94, 76:80] = [28, 18, 22, 255]

        if mode in ("slack_open", "slack_chew"):
            if mode == "slack_chew":
                # Mouth closed happily chewing + eyes smiling (^^)
                for yy in range(89, 96):
                    cl = arr[min(93, yy), 70].astype(np.float32)
                    cr = arr[min(93, yy), 85].astype(np.float32)
                    for xx in range(72, 85):
                        t = (xx - 72) / 13.0
                        w[yy, xx] = np.clip(cl * (1.0 - t) + cr * t, 0, 255).astype(np.uint8)
                w[92, 76:82] = [34, 22, 26, 255]
                w[91, 75] = [34, 22, 26, 255]
                w[91, 82] = [34, 22, 26, 255]
                # Rosy cheek chew puff + chip crumb
                w[91:93, 73:75] = [235, 130, 108, 255]
            return Image.fromarray(w, "RGBA").crop((55, 60, 152, 145)).resize((194, 170), Image.Resampling.NEAREST)

        if mode in ("work", "barely"):
            # Cleanly cover top of CRUNCHY bag with green shirt tone while leaving collar & red tie intact
            for yy in range(111, 126):
                for xx in range(74, 100):
                    w[yy, xx] = arr[115, 70]
            out_im = Image.fromarray(w, "RGBA")
            d = ImageDraw.Draw(out_im)
            ink = (36, 28, 30, 255)
            sh_l = (128, 162, 92, 255)
            sh_g = (106, 136, 76, 255)
            sh_d = (72, 98, 48, 255)
            sk = (234, 164, 112, 255)
            sk_d = (198, 122, 74, 255)

            # Natural diagonal typing arm reaching down from shoulder/chest (88,108) -> keyboard keys (115, 113 + dy_r)
            d.polygon([
                (86, 107), (95, 106), (114, 111 + dy_r),
                (113, 116 + dy_r), (92, 115), (84, 114)
            ], fill=sh_g, outline=ink)
            d.line([(87, 108), (113, 112 + dy_r)], fill=sh_l, width=1)
            d.line([(86, 113), (112, 115 + dy_r)], fill=sh_d, width=1)
            # Wrist & typing fingers resting naturally on the beige keyboard!
            d.rectangle([114, 111 + dy_r, 122, 115 + dy_r], fill=sk)
            d.line([(114, 115 + dy_r), (122, 115 + dy_r)], fill=sk_d, width=1)
            d.point((121, 112 + dy_r), fill=ink)
            d.point((121, 114 + dy_r), fill=ink)

            # Crisp 3-tone shaded Office KPI Clipboard / Folder resting neatly on lap in foreground hand!
            d.rectangle([73, 114, 100, 144], fill=(48, 72, 110, 255), outline=ink)
            d.rectangle([75, 117, 98, 142], fill=(238, 244, 240, 255), outline=(92, 116, 148, 255))
            d.rectangle([81, 112, 92, 116], fill=(172, 184, 198, 255), outline=ink)
            d.rectangle([76, 118, 97, 122], fill=(26, 142, 70, 255))
            d.rectangle([78, 131, 81, 140], fill=(54, 128, 232, 255))
            d.rectangle([83, 128, 86, 140], fill=(34, 176, 106, 255))
            d.rectangle([88, 126, 91, 140], fill=(240, 166, 38, 255))
            d.rectangle([93, 124, 96, 140], fill=(228, 66, 72, 255))

            # Re-draw his original foreground right hand fingers cleanly gripping the left edge of the clipboard!
            for yy in range(126, 136):
                for xx in range(62, 77):
                    out_im.putpixel((xx, yy), tuple(int(c) for c in arr[yy, xx]))

            return out_im.crop((55, 60, 152, 145)).resize((194, 170), Image.Resampling.NEAREST)

        return Image.fromarray(w, "RGBA").crop((55, 60, 152, 145)).resize((194, 170), Image.Resampling.NEAREST)

    save_both(make_pose("slack_open"), "slacker_slack_0.png")
    save_both(make_pose("slack_chew"), "slacker_slack_1.png")
    save_both(make_pose("work", -1, 1), "slacker_work_0.png")
    save_both(make_pose("work", 1, -1), "slacker_work_1.png")
    save_both(make_pose("barely", 0, 0), "slacker_barely.png")
    save_both(make_pose("caught"), "slacker_caught.png")

    # Crisp 2x-pixel rubber stamp "OT!"
    stamp = Image.new("RGBA", (80, 34), (0, 0, 0, 0))
    ds = ImageDraw.Draw(stamp)
    ds.rectangle([1, 1, 78, 32], fill=(214, 34, 44, 242), outline=(255, 235, 120, 255), width=2)
    ds.rectangle([4, 4, 75, 29], outline=(255, 235, 120, 255), width=1)
    # Chunky 5x7 pixel glyphs for "OT!" scaled inside center
    glyphs = {
        "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
        "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
        "!": ["0110", "0110", "0110", "0110", "0000", "0110", "0110"],
    }
    gx = 18
    for ch in "OT!":
        pat = glyphs[ch]
        for row_i, row in enumerate(pat):
            for col_i, bit in enumerate(row):
                if bit == "1":
                    px = gx + col_i * 2
                    py = 10 + row_i * 2
                    ds.rectangle([px + 1, py + 1, px + 2, py + 2], fill=(120, 12, 20, 255))
                    ds.rectangle([px, py, px + 1, py + 1], fill=(255, 245, 185, 255))
        gx += (len(pat[0]) + 3) * 2
    save_both(stamp.resize((160, 68), Image.Resampling.NEAREST), "stamp_ot.png")


if __name__ == "__main__":
    build_base_and_boss()
    build_slacker_320()
    print("All pixel-grid assets finalized!")
