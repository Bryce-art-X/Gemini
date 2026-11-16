class_name ForgePainter
extends RefCounted

const INK := Color(0.07, 0.07, 0.10)


static func draw_capsule(canvas: CanvasItem, a: Vector2, b: Vector2, radius: float, fill: Color, outline: float = 4.5, sil: bool = false) -> void:
	var c_ink := Color(0.05, 0.05, 0.08) if sil else INK
	var c_fill := Color(0.06, 0.06, 0.09) if sil else fill
	canvas.draw_line(a, b, c_ink, (radius + outline) * 2.0, true)
	canvas.draw_circle(a, radius + outline, c_ink)
	canvas.draw_circle(b, radius + outline, c_ink)
	if not sil:
		canvas.draw_line(a, b, c_fill, radius * 2.0, true)
		canvas.draw_circle(a, radius, c_fill)
		canvas.draw_circle(b, radius, c_fill)


static func draw_outlined_circle(canvas: CanvasItem, center: Vector2, r: float, fill: Color, outline: float = 4.5, sil: bool = false) -> void:
	var c_ink := Color(0.05, 0.05, 0.08) if sil else INK
	canvas.draw_circle(center, r + outline, c_ink)
	if not sil:
		canvas.draw_circle(center, r, fill)


static func draw_outlined_rect(canvas: CanvasItem, rect: Rect2, fill: Color, outline: float = 4.5, sil: bool = false) -> void:
	var c_fill := Color(0.06, 0.06, 0.09) if sil else fill
	canvas.draw_rect(rect, c_fill, true)
	if not sil:
		canvas.draw_rect(rect, INK, false, outline)


static func draw_outlined_poly(canvas: CanvasItem, pts: PackedVector2Array, fill: Color, outline: float = 4.5, sil: bool = false) -> void:
	var c_fill := Color(0.06, 0.06, 0.09) if sil else fill
	canvas.draw_colored_polygon(pts, c_fill)
	if not sil:
		var closed := PackedVector2Array(pts)
		closed.append(pts[0])
		canvas.draw_polyline(closed, INK, outline, true)


static func draw_workshop_bg(canvas: CanvasItem, beat_pulse: float, time_sec: float, flame_mood: String, bulb_angle: float, bulb_on: bool, bellows_squeeze: float) -> void:
	# 1. Warm brick & timber interior
	canvas.draw_rect(Rect2(0, 0, 1280, 720), Color(0.24, 0.16, 0.16))
	# Subtle brick pattern
	for row in range(8):
		var y := 95.0 + float(row) * 52.0
		var off := 45.0 if row % 2 == 1 else 0.0
		for col in range(14):
			var x := off + float(col) * 96.0
			canvas.draw_rect(Rect2(x, y, 82, 40), Color(0.28, 0.19, 0.18, 0.65))

	# Wooden ceiling beams & side pillars
	draw_outlined_rect(canvas, Rect2(0, 0, 1280, 76), Color(0.38, 0.23, 0.15))
	draw_outlined_rect(canvas, Rect2(18, 76, 46, 480), Color(0.35, 0.21, 0.14))
	draw_outlined_rect(canvas, Rect2(1216, 76, 46, 480), Color(0.35, 0.21, 0.14))

	# Stone tile floor
	draw_outlined_rect(canvas, Rect2(-10, 550, 1300, 180), Color(0.22, 0.21, 0.25))
	for row in range(4):
		var fy := 550.0 + float(row) * 44.0
		canvas.draw_line(Vector2(0, fy), Vector2(1280, fy), INK, 3.0)
		var foff := 55.0 if row % 2 == 1 else 0.0
		for col in range(12):
			var fx := foff + float(col) * 115.0
			canvas.draw_line(Vector2(fx, fy), Vector2(fx, fy + 44.0), INK, 3.0)

	# Hanging absurd tools on left & right walls
	_draw_wall_rack(canvas, Vector2(160, 175), false)
	_draw_wall_rack(canvas, Vector2(1010, 175), true)

	# 2. Central Brick Furnace + Expressive Fire Buddy!
	var cx := 640.0
	draw_outlined_rect(canvas, Rect2(cx - 80, 76, 160, 150), Color(0.62, 0.30, 0.20))
	draw_outlined_rect(canvas, Rect2(cx - 125, 210, 250, 340), Color(0.70, 0.34, 0.22))
	# Furnace arch opening
	canvas.draw_circle(Vector2(cx, 370), 76, INK)
	canvas.draw_rect(Rect2(cx - 76, 370, 152, 84), INK)
	canvas.draw_circle(Vector2(cx, 370), 68, Color(0.18, 0.08, 0.07))
	canvas.draw_rect(Rect2(cx - 68, 370, 136, 76), Color(0.18, 0.08, 0.07))
	# Ash pit
	canvas.draw_circle(Vector2(cx, 505), 42, INK)
	canvas.draw_rect(Rect2(cx - 42, 505, 84, 45), INK)

	# Bellows on left connected to furnace
	var bel_y := 522.0 + bellows_squeeze * 16.0
	draw_outlined_poly(canvas, PackedVector2Array([
		Vector2(100, 550), Vector2(210, 550),
		Vector2(205, bel_y), Vector2(105, bel_y - 12),
	]), Color(0.68, 0.44, 0.24))
	canvas.draw_line(Vector2(210, 535), Vector2(515, 535), INK, 12.0)
	canvas.draw_line(Vector2(210, 535), Vector2(515, 535), Color(0.78, 0.60, 0.26), 6.0)

	# Furnace Glow + Dancing Fire Buddy inside furnace!
	var glow_r := 110.0 + beat_pulse * 18.0 + bellows_squeeze * 20.0
	canvas.draw_circle(Vector2(cx, 385), glow_r, Color(1.0, 0.50, 0.12, 0.16 + beat_pulse * 0.08))
	_draw_fire_buddy(canvas, Vector2(cx, 444), beat_pulse, time_sec, flame_mood)

	# 3. Overhead Swinging Lightbulb + Light Cone
	var pivot := Vector2(640, 0)
	var bulb_pos := pivot + Vector2(0, 128).rotated(bulb_angle)
	if bulb_on:
		var cone := PackedVector2Array([
			bulb_pos + Vector2(-12, 8),
			bulb_pos + Vector2(12, 8),
			Vector2(1020, 650),
			Vector2(260, 650),
		])
		canvas.draw_colored_polygon(cone, Color(1.0, 0.90, 0.56, 0.10 + beat_pulse * 0.03))
	canvas.draw_line(pivot, bulb_pos, INK, 5.0)
	draw_outlined_circle(canvas, bulb_pos, 18.0, Color(1.0, 0.94, 0.48) if bulb_on else Color(0.28, 0.30, 0.36), 4.0)
	if bulb_on:
		canvas.draw_circle(bulb_pos, 32.0, Color(1.0, 0.92, 0.45, 0.25))


static func _draw_wall_rack(canvas: CanvasItem, pos: Vector2, is_right: bool) -> void:
	draw_outlined_rect(canvas, Rect2(pos.x - 10, pos.y, 130, 16), Color(0.48, 0.30, 0.18), 3.5)
	if not is_right:
		# Tongs & ladle
		for i in range(2):
			var tx := pos.x + 25.0 + float(i) * 48.0
			canvas.draw_line(Vector2(tx, pos.y + 12), Vector2(tx, pos.y + 82), INK, 8.0)
			canvas.draw_line(Vector2(tx, pos.y + 12), Vector2(tx, pos.y + 82), Color(0.62, 0.66, 0.72), 4.0)
			draw_outlined_circle(canvas, Vector2(tx, pos.y + 88), 11.0, Color(0.62, 0.66, 0.72), 3.5)
	else:
		# Frying pan silhouette & spare mallet
		canvas.draw_line(Vector2(pos.x + 28, pos.y + 12), Vector2(pos.x + 28, pos.y + 62), INK, 8.0)
		draw_outlined_circle(canvas, Vector2(pos.x + 28, pos.y + 86), 24.0, Color(0.32, 0.34, 0.40), 3.5)
		canvas.draw_line(Vector2(pos.x + 82, pos.y + 12), Vector2(pos.x + 82, pos.y + 72), INK, 8.0)
		draw_outlined_rect(canvas, Rect2(pos.x + 64, pos.y + 68, 36, 20), Color(0.62, 0.66, 0.72), 3.5)


static func _draw_fire_buddy(canvas: CanvasItem, base: Vector2, beat_pulse: float, time_sec: float, mood: String) -> void:
	var sx := 1.0 + beat_pulse * 0.14
	var sy := 1.0 - beat_pulse * 0.12 + sin(time_sec * 9.0) * 0.05
	var sway := sin(time_sec * 6.0) * 5.0
	var flame := PackedVector2Array([
		base + Vector2(-42 * sx, 0),
		base + Vector2(-46 * sx, -42 * sy),
		base + Vector2(-18 * sx + sway, -82 * sy),
		base + Vector2(0 + sway * 1.4, -108 * sy),
		base + Vector2(20 * sx + sway, -76 * sy),
		base + Vector2(46 * sx, -40 * sy),
		base + Vector2(42 * sx, 0),
	])
	canvas.draw_colored_polygon(flame, Color(1.0, 0.42, 0.08))
	var inner := PackedVector2Array([
		base + Vector2(-24 * sx, 0),
		base + Vector2(-22 * sx, -35 * sy),
		base + Vector2(sway, -68 * sy),
		base + Vector2(22 * sx, -35 * sy),
		base + Vector2(24 * sx, 0),
	])
	canvas.draw_colored_polygon(inner, Color(1.0, 0.86, 0.22))

	# Cute expressive eyes on the fire buddy!
	var ey := base.y - 34.0 * sy
	var lx := base.x - 13.0
	var rx := base.x + 13.0
	if mood == "sideeye":
		canvas.draw_circle(Vector2(lx, ey), 7.5, Color.WHITE)
		canvas.draw_circle(Vector2(rx, ey), 7.5, Color.WHITE)
		canvas.draw_rect(Rect2(lx - 8, ey - 8, 16, 7), Color(1.0, 0.56, 0.12))
		canvas.draw_rect(Rect2(rx - 8, ey - 8, 16, 7), Color(1.0, 0.56, 0.12))
		canvas.draw_line(Vector2(lx - 8, ey - 1), Vector2(lx + 8, ey - 1), INK, 2.5)
		canvas.draw_line(Vector2(rx - 8, ey - 1), Vector2(rx + 8, ey - 1), INK, 2.5)
		canvas.draw_circle(Vector2(lx + 4, ey + 2), 3.2, INK)
		canvas.draw_circle(Vector2(rx + 4, ey + 2), 3.2, INK)
	elif mood == "happy":
		canvas.draw_arc(Vector2(lx, ey + 2), 6.0, PI, TAU, 8, INK, 3.0)
		canvas.draw_arc(Vector2(rx, ey + 2), 6.0, PI, TAU, 8, INK, 3.0)
		canvas.draw_circle(Vector2(base.x, ey + 13), 6.0, Color(0.75, 0.12, 0.15))
	else:
		canvas.draw_circle(Vector2(lx, ey), 6.5, Color.WHITE)
		canvas.draw_circle(Vector2(rx, ey), 6.5, Color.WHITE)
		canvas.draw_circle(Vector2(lx + 1, ey), 3.2, INK)
		canvas.draw_circle(Vector2(rx + 1, ey), 3.2, INK)


static func draw_anvil_station(canvas: CanvasItem, pos: Vector2, beat_pulse: float, flash: float, facing_left: bool, sil: bool) -> void:
	var sx := 1.0 + beat_pulse * 0.05
	var sy := 1.0 - beat_pulse * 0.05
	var dir := -1.0 if facing_left else 1.0

	# Shadow
	if not sil:
		canvas.draw_set_transform(pos + Vector2(0, 108), 0.0, Vector2(1.0, 0.25))
		canvas.draw_circle(Vector2.ZERO, 66.0, Color(0, 0, 0, 0.28))
		canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	# Tree Stump Base
	var stump_top := pos + Vector2(0, 32 * sy)
	var stump_pts := PackedVector2Array([
		stump_top + Vector2(-50 * sx, 0),
		stump_top + Vector2(50 * sx, 0),
		pos + Vector2(64 * sx, 108),
		pos + Vector2(-64 * sx, 108),
	])
	draw_outlined_poly(canvas, stump_pts, Color(0.62, 0.35, 0.16), 4.5, sil)
	if not sil:
		canvas.draw_line(stump_top + Vector2(-20, 14), pos + Vector2(-24, 96), Color(0.42, 0.22, 0.10), 4.0)
		canvas.draw_line(stump_top + Vector2(18, 16), pos + Vector2(22, 96), Color(0.42, 0.22, 0.10), 4.0)

	# Anvil Body (top impact surface at pos + Vector2(0, -34))
	var top_y := pos.y - 34.0 * sy
	var horn_pts := PackedVector2Array([
		Vector2(pos.x + 28 * dir * sx, top_y + 4),
		Vector2(pos.x + 84 * dir * sx, top_y + 14),
		Vector2(pos.x + 28 * dir * sx, top_y + 28),
	])
	var body_col := Color(0.48, 0.54, 0.62).lerp(Color(1.0, 0.96, 0.72), flash)
	draw_outlined_poly(canvas, horn_pts, body_col.darkened(0.15), 4.5, sil)

	var anvil_pts := PackedVector2Array([
		Vector2(pos.x - 54 * sx, top_y),
		Vector2(pos.x + 42 * sx, top_y),
		Vector2(pos.x + 36 * sx, top_y + 26),
		Vector2(pos.x + 24 * sx, pos.y + 16),
		Vector2(pos.x + 46 * sx, pos.y + 34),
		Vector2(pos.x - 46 * sx, pos.y + 34),
		Vector2(pos.x - 24 * sx, pos.y + 16),
		Vector2(pos.x - 36 * sx, top_y + 22),
	])
	draw_outlined_poly(canvas, anvil_pts, body_col, 4.5, sil)
	if not sil:
		canvas.draw_line(Vector2(pos.x - 46 * sx, top_y + 6), Vector2(pos.x + 34 * sx, top_y + 6), Color(0.84, 0.90, 0.96), 4.0)


static func draw_barrel(canvas: CanvasItem, pos: Vector2, wobble: float, weapons: Array, sil: bool) -> void:
	canvas.draw_set_transform(pos, wobble * 0.16, Vector2(1.0 + absf(wobble) * 0.08, 1.0 - absf(wobble) * 0.08))
	# Draw stacked weapons sticking out behind barrel rim!
	if not sil:
		for i in range(weapons.size()):
			var w: Dictionary = weapons[i]
			var wx := -28.0 + float(i % 5) * 14.0
			var wrot := float(w["rot"])
			canvas.draw_set_transform(pos + Vector2(wx, -36), wobble * 0.16 + wrot, Vector2.ONE)
			draw_weapon_shape(canvas, Vector2.ZERO, str(w["kind"]), 0.72, false)
	canvas.draw_set_transform(pos, wobble * 0.16, Vector2(1.0 + absf(wobble) * 0.08, 1.0 - absf(wobble) * 0.08))
	var pts := PackedVector2Array([
		Vector2(-44, -44), Vector2(44, -44),
		Vector2(52, 0), Vector2(40, 56),
		Vector2(-40, 56), Vector2(-52, 0),
	])
	draw_outlined_poly(canvas, pts, Color(0.56, 0.34, 0.18), 4.5, sil)
	if not sil:
		draw_outlined_rect(canvas, Rect2(-49, -22, 98, 11), Color(0.42, 0.46, 0.54), 3.5)
		draw_outlined_rect(canvas, Rect2(-48, 22, 96, 11), Color(0.42, 0.46, 0.54), 3.5)
	canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


static func draw_master(canvas: CanvasItem, foot_pos: Vector2, beat_pulse: float, time_sec: float, strike_t: float, windup_t: float, mood: String, sil: bool) -> void:
	# Master faces RIGHT (+1), anvil top at (385, 470)
	var bop_x := 1.0 + beat_pulse * 0.07
	var bop_y := 1.0 - beat_pulse * 0.07
	var lunge := sin(clampf(strike_t, 0.0, 1.0) * PI)
	var lean := -0.14 * windup_t + 0.16 * lunge

	var hip := foot_pos + Vector2(lunge * 14.0, -76.0 * bop_y)
	# Legs & Boots
	draw_capsule(canvas, hip + Vector2(-24, 6), foot_pos + Vector2(-42, -12), 14.0, Color(0.20, 0.24, 0.28), 4.0, sil)
	draw_capsule(canvas, hip + Vector2(24, 6), foot_pos + Vector2(38, -12), 14.0, Color(0.20, 0.24, 0.28), 4.0, sil)
	draw_outlined_rect(canvas, Rect2(foot_pos + Vector2(-62, -22), Vector2(42, 22)), Color(0.36, 0.24, 0.18), 4.0, sil)
	draw_outlined_rect(canvas, Rect2(foot_pos + Vector2(20, -22), Vector2(46, 22)), Color(0.36, 0.24, 0.18), 4.0, sil)

	# Torso & Apron
	var shoulder_center := hip + Vector2(sin(lean) * 95.0, -95.0 * bop_y)
	var body_pts := PackedVector2Array([
		hip + Vector2(-44 * bop_x, 8),
		hip + Vector2(44 * bop_x, 8),
		shoulder_center + Vector2(36 * bop_x, 0),
		shoulder_center + Vector2(-36 * bop_x, 0),
	])
	draw_outlined_poly(canvas, body_pts, Color(0.88, 0.42, 0.14), 4.5, sil)
	if not sil:
		# Orange apron front
		var ap := PackedVector2Array([
			hip + Vector2(-32 * bop_x, 22),
			hip + Vector2(34 * bop_x, 22),
			shoulder_center + Vector2(24 * bop_x, 10),
			shoulder_center + Vector2(-18 * bop_x, 10),
		])
		draw_outlined_poly(canvas, ap, Color(0.96, 0.56, 0.12), 3.5)

	# Head + Red Headband + Fluffy Beard
	var head_c := shoulder_center + Vector2(sin(lean) * 34.0 + 4.0, -34.0)
	draw_outlined_circle(canvas, head_c, 38.0, Color(0.98, 0.80, 0.64), 4.5, sil)
	# Beard
	var beard := PackedVector2Array([
		head_c + Vector2(-34, 2),
		head_c + Vector2(-24, 34),
		head_c + Vector2(8, 38),
		head_c + Vector2(35, 22),
		head_c + Vector2(34, -2),
		head_c + Vector2(14, 14),
		head_c + Vector2(-16, 12),
	])
	draw_outlined_poly(canvas, beard, Color(0.34, 0.22, 0.16), 4.0, sil)
	# Fluttering headband tails
	var tail_wag := sin(time_sec * 10.0) * 6.0 - lunge * 12.0
	draw_outlined_poly(canvas, PackedVector2Array([
		head_c + Vector2(-36, -14),
		head_c + Vector2(-66, -24 + tail_wag),
		head_c + Vector2(-58, -8 + tail_wag),
	]), Color(0.86, 0.24, 0.20), 3.5, sil)
	draw_outlined_rect(canvas, Rect2(head_c + Vector2(-38, -24), Vector2(76, 15)), Color(0.86, 0.24, 0.20), 4.0, sil)

	# Expressive Eyes & Mouth (Glowing in Blackout!)
	var e1 := head_c + Vector2(8, -4)
	var e2 := head_c + Vector2(26, -4)
	if sil:
		canvas.draw_circle(e1, 5.0, Color(1.0, 0.94, 0.45))
		canvas.draw_circle(e2, 5.0, Color(1.0, 0.94, 0.45))
	else:
		if mood == "sideeye":
			for ep in [e1, e2]:
				canvas.draw_circle(ep, 7.0, Color.WHITE)
				canvas.draw_rect(Rect2(ep + Vector2(-7, -7), Vector2(14, 7)), Color(0.98, 0.80, 0.64))
				canvas.draw_line(ep + Vector2(-7, 0), ep + Vector2(7, 0), INK, 3.5)
				canvas.draw_circle(ep + Vector2(4, 2), 3.0, INK)
			canvas.draw_line(head_c + Vector2(2, 22), head_c + Vector2(24, 20), INK, 3.5)
		elif mood == "happy":
			canvas.draw_arc(e1 + Vector2(0, 2), 6.0, PI, TAU, 8, INK, 3.5)
			canvas.draw_arc(e2 + Vector2(0, 2), 6.0, PI, TAU, 8, INK, 3.5)
			canvas.draw_circle(head_c + Vector2(14, 20), 8.0, Color(0.82, 0.22, 0.26))
		else:
			canvas.draw_circle(e1, 6.5, Color.WHITE)
			canvas.draw_circle(e2, 6.5, Color.WHITE)
			canvas.draw_circle(e1 + Vector2(2, 0), 3.2, INK)
			canvas.draw_circle(e2 + Vector2(2, 0), 3.2, INK)
			if windup_t > 0.05:
				canvas.draw_circle(head_c + Vector2(16, 20), 9.0, Color(0.72, 0.16, 0.20))
			else:
				canvas.draw_arc(head_c + Vector2(12, 16), 9.0, 0.1, PI - 0.1, 8, INK, 3.5)

	# 2-Bone Arm + Giant Hammer smashing onto (385, 470)
	var sh := shoulder_center + Vector2(12, 12)
	var ang := lerpf(-2.15, -0.10, lunge) - 0.45 * windup_t
	var elbow := sh + Vector2(cos(ang), sin(ang)) * 50.0
	var hand := elbow + Vector2(cos(ang + 0.45), sin(ang + 0.45)) * 46.0
	draw_capsule(canvas, sh, elbow, 11.0, Color(0.98, 0.80, 0.64), 4.0, sil)
	draw_capsule(canvas, elbow, hand, 10.0, Color(0.98, 0.80, 0.64), 4.0, sil)

	# Hammer handle & head
	var h_dir := Vector2(cos(ang + 0.15), sin(ang + 0.15))
	var h_tip := hand + h_dir * 72.0
	canvas.draw_line(hand - h_dir * 14.0, h_tip, INK, 13.0)
	if not sil:
		canvas.draw_line(hand - h_dir * 14.0, h_tip, Color(0.58, 0.36, 0.18), 7.0)
	var perp := Vector2(-h_dir.y, h_dir.x)
	var hm_pts := PackedVector2Array([
		h_tip - h_dir * 18 + perp * 26,
		h_tip + h_dir * 18 + perp * 26,
		h_tip + h_dir * 18 - perp * 26,
		h_tip - h_dir * 18 - perp * 26,
	])
	draw_outlined_poly(canvas, hm_pts, Color(0.42, 0.46, 0.52), 4.5, sil)

	# Motion smear arc on rapid smash!
	if lunge > 0.35 and not sil:
		canvas.draw_arc(sh + Vector2(20, 10), 125.0, -1.75, 0.15, 16, Color(1.0, 0.94, 0.62, lunge * 0.65), 14.0 * lunge)


static func draw_player(canvas: CanvasItem, foot_pos: Vector2, beat_pulse: float, time_sec: float, strike_t: float, bonk_t: float, mood: String, track_pos: Vector2, sil: bool) -> void:
	# Apprentice faces LEFT (-1), anvil top at (885, 470)
	var bop_x := 1.0 + beat_pulse * 0.07
	var bop_y := 1.0 - beat_pulse * 0.07
	var bonk_squash := sin(clampf(bonk_t, 0.0, 1.0) * PI) * 0.24
	var lunge := sin(clampf(strike_t, 0.0, 1.0) * PI)
	var lean := -0.18 * lunge

	var hip := foot_pos + Vector2(-lunge * 14.0, -70.0 * (bop_y - bonk_squash))
	# Legs & Boots
	draw_capsule(canvas, hip + Vector2(-20, 6), foot_pos + Vector2(-36, -10), 12.0, Color(0.48, 0.30, 0.18), 4.0, sil)
	draw_capsule(canvas, hip + Vector2(20, 6), foot_pos + Vector2(36, -10), 12.0, Color(0.48, 0.30, 0.18), 4.0, sil)
	draw_outlined_rect(canvas, Rect2(foot_pos + Vector2(-56, -20), Vector2(38, 20)), Color(0.38, 0.22, 0.14), 4.0, sil)
	draw_outlined_rect(canvas, Rect2(foot_pos + Vector2(18, -20), Vector2(38, 20)), Color(0.38, 0.22, 0.14), 4.0, sil)

	# Torso & Sky-Blue Apron
	var sh_c := hip + Vector2(sin(lean) * 80.0, -80.0 * (bop_y - bonk_squash))
	var body := PackedVector2Array([
		hip + Vector2(-36 * bop_x, 10),
		hip + Vector2(36 * bop_x, 10),
		sh_c + Vector2(28 * bop_x, 0),
		sh_c + Vector2(-28 * bop_x, 0),
	])
	draw_outlined_poly(canvas, body, Color(0.24, 0.72, 0.96), 4.5, sil)

	# Head + Fluffy Brown Hair + Bouncing Goggles!
	var head_c := sh_c + Vector2(sin(lean) * 28.0 - 4.0, -34.0)
	draw_outlined_circle(canvas, head_c, 35.0, Color(1.0, 0.87, 0.72), 4.5, sil)
	# Hair cap
	var hair := PackedVector2Array([
		head_c + Vector2(-34, -8),
		head_c + Vector2(-42, -26),
		head_c + Vector2(-12, -40),
		head_c + Vector2(20, -40),
		head_c + Vector2(40, -20),
		head_c + Vector2(36, 4),
		head_c + Vector2(14, -14),
		head_c + Vector2(-12, -16),
	])
	draw_outlined_poly(canvas, hair, Color(0.36, 0.22, 0.12), 4.0, sil)

	# Goggles on forehead (bounce up when bonked!)
	var gog_y := head_c.y - 24.0 - bonk_squash * 48.0
	draw_outlined_circle(canvas, Vector2(head_c.x - 18, gog_y), 11.0, Color(0.75, 0.92, 1.0), 3.5, sil)
	draw_outlined_circle(canvas, Vector2(head_c.x + 2, gog_y), 11.0, Color(0.75, 0.92, 1.0), 3.5, sil)

	# Real-Time Eyeball Tracking + Bonk Dizzy Gag!
	var e1 := head_c + Vector2(-20, 2)
	var e2 := head_c + Vector2(-2, 2)
	var look_dir := (track_pos - head_c).normalized() * 3.0 if track_pos != Vector2.ZERO else Vector2(-2.0, 0.0)
	if sil:
		canvas.draw_circle(e1, 5.0, Color(1.0, 0.94, 0.45))
		canvas.draw_circle(e2, 5.0, Color(1.0, 0.94, 0.45))
	elif bonk_t > 0.05:
		# X_X dizzy eyes + red bump + spinning stars!
		for ep in [e1, e2]:
			canvas.draw_line(ep + Vector2(-5, -5), ep + Vector2(5, 5), INK, 3.5)
			canvas.draw_line(ep + Vector2(5, -5), ep + Vector2(-5, 5), INK, 3.5)
		canvas.draw_arc(head_c + Vector2(-12, 22), 8.0, PI, TAU, 8, INK, 3.0)
		# Red smoking bump on head
		draw_outlined_circle(canvas, head_c + Vector2(-4, -44), 14.0 * clampf(bonk_t * 2.0, 0.3, 1.0), Color(0.98, 0.28, 0.32), 3.5)
		for si in range(3):
			var sa := time_sec * 8.0 + float(si) * TAU / 3.0
			var sp := head_c + Vector2(cos(sa) * 34.0, -56.0 + sin(sa) * 10.0)
			draw_star_4(canvas, sp, 9.0, Color(1.0, 0.88, 0.25))
	elif mood == "happy":
		canvas.draw_arc(e1 + Vector2(0, 2), 5.5, PI, TAU, 8, INK, 3.5)
		canvas.draw_arc(e2 + Vector2(0, 2), 5.5, PI, TAU, 8, INK, 3.5)
		canvas.draw_circle(head_c + Vector2(-12, 18), 6.5, Color(0.84, 0.22, 0.26))
	else:
		canvas.draw_circle(e1, 6.5, Color.WHITE)
		canvas.draw_circle(e2, 6.5, Color.WHITE)
		canvas.draw_circle(e1 + look_dir, 3.2, INK)
		canvas.draw_circle(e2 + look_dir, 3.2, INK)
		canvas.draw_arc(head_c + Vector2(-12, 15), 7.5, 0.1, PI - 0.1, 8, INK, 3.0)

	# 2-Bone Arm + Hammer smashing LEFT onto (885, 470)
	var sh := sh_c + Vector2(-10, 12)
	var ang := lerpf(-0.92, -2.98, lunge) # swings from top-right down to left anvil!
	var elbow := sh + Vector2(cos(ang), sin(ang)) * 46.0
	var hand := elbow + Vector2(cos(ang - 0.38), sin(ang - 0.38)) * 42.0
	draw_capsule(canvas, sh, elbow, 9.5, Color(1.0, 0.87, 0.72), 4.0, sil)
	draw_capsule(canvas, elbow, hand, 9.0, Color(0.42, 0.24, 0.14), 4.0, sil) # leather gloves

	var h_dir := Vector2(cos(ang - 0.15), sin(ang - 0.15))
	var h_tip := hand + h_dir * 66.0
	canvas.draw_line(hand - h_dir * 12.0, h_tip, INK, 12.0)
	if not sil:
		canvas.draw_line(hand - h_dir * 12.0, h_tip, Color(0.58, 0.36, 0.18), 6.0)
	var perp := Vector2(-h_dir.y, h_dir.x)
	var hm_pts := PackedVector2Array([
		h_tip - h_dir * 16 + perp * 22,
		h_tip + h_dir * 16 + perp * 22,
		h_tip + h_dir * 16 - perp * 22,
		h_tip - h_dir * 16 - perp * 22,
	])
	draw_outlined_poly(canvas, hm_pts, Color(0.56, 0.62, 0.68), 4.0, sil)

	if lunge > 0.35 and not sil:
		canvas.draw_arc(sh + Vector2(-20, 10), 118.0, -3.25, -1.25, 16, Color(1.0, 0.94, 0.62, lunge * 0.65), 14.0 * lunge)


static func draw_star_4(canvas: CanvasItem, center: Vector2, r: float, fill: Color) -> void:
	var pts := PackedVector2Array([
		center + Vector2(0, -r),
		center + Vector2(r * 0.28, -r * 0.28),
		center + Vector2(r, 0),
		center + Vector2(r * 0.28, r * 0.28),
		center + Vector2(0, r),
		center + Vector2(-r * 0.28, r * 0.28),
		center + Vector2(-r, 0),
		center + Vector2(-r * 0.28, -r * 0.28),
	])
	draw_outlined_poly(canvas, pts, fill, 2.5, false)


static func draw_weapon_shape(canvas: CanvasItem, pos: Vector2, kind: String, sc: float, sil: bool) -> void:
	if kind == "pan":
		# Absurd Golden Frying Pan!
		canvas.draw_line(pos, pos + Vector2(0, 44 * sc), INK, 10.0 * sc)
		draw_outlined_circle(canvas, pos + Vector2(0, -14 * sc), 24.0 * sc, Color(1.0, 0.82, 0.24), 4.0 * sc, sil)
	elif kind == "fish":
		# Absurd Salted Fish Sword!
		var fpts := PackedVector2Array([
			pos + Vector2(0, -48 * sc),
			pos + Vector2(16 * sc, -14 * sc),
			pos + Vector2(10 * sc, 24 * sc),
			pos + Vector2(18 * sc, 42 * sc),
			pos + Vector2(-18 * sc, 42 * sc),
			pos + Vector2(-10 * sc, 24 * sc),
			pos + Vector2(-16 * sc, -14 * sc),
		])
		draw_outlined_poly(canvas, fpts, Color(0.55, 0.84, 0.98), 3.5 * sc, sil)
		if not sil:
			canvas.draw_circle(pos + Vector2(-6 * sc, -26 * sc), 3.5 * sc, INK)
	else:
		# Gleaming Sword / Radiant Excalibur
		var blade_col := Color(1.0, 0.90, 0.34) if kind == "excalibur" else Color(0.84, 0.94, 1.0)
		var bpts := PackedVector2Array([
			pos + Vector2(0, -52 * sc),
			pos + Vector2(12 * sc, -30 * sc),
			pos + Vector2(10 * sc, 24 * sc),
			pos + Vector2(-10 * sc, 24 * sc),
			pos + Vector2(-12 * sc, -30 * sc),
		])
		draw_outlined_poly(canvas, bpts, blade_col, 4.0 * sc, sil)
		draw_outlined_rect(canvas, Rect2(pos + Vector2(-18 * sc, 22 * sc), Vector2(36 * sc, 10 * sc)), Color(0.96, 0.72, 0.20), 3.5 * sc, sil)
		draw_outlined_rect(canvas, Rect2(pos + Vector2(-5 * sc, 32 * sc), Vector2(10 * sc, 16 * sc)), Color(0.52, 0.28, 0.16), 3.0 * sc, sil)
