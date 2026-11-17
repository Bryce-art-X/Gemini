class_name OfficePainter
extends Object

const BASE_W := 640.0
const BASE_H := 360.0
const SCALE := 2.0  # Maps 640x360 cleanly onto 1280x720 with NEAREST filtering

static var _textures: Dictionary = {}

const PIXEL_FONT := {
	"0": ["111", "101", "101", "101", "111"],
	"1": ["010", "110", "010", "010", "111"],
	"5": ["111", "100", "111", "001", "111"],
	"7": ["111", "001", "010", "010", "010"],
	"8": ["111", "101", "111", "101", "111"],
	"9": ["111", "101", "111", "001", "111"],
	":": ["000", "010", "000", "010", "000"],
}


static func ensure_loaded() -> void:
	if not _textures.is_empty():
		return
	var names := [
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
	]
	for n in names:
		_textures[n] = load("res://assets/textures/%s.png" % n)


static func _px_rect(x: float, y: float, w: float, h: float) -> Rect2:
	return Rect2(x * SCALE, y * SCALE, w * SCALE, h * SCALE)


static func _draw_tex(canvas: CanvasItem, name: String, x: float, y: float, w: float = -1.0, h: float = -1.0, tint: Color = Color.WHITE) -> void:
	var tex: Texture2D = _textures.get(name, null)
	if tex == null:
		return
	var tw: float = float(tex.get_width()) if w < 0.0 else w
	var th: float = float(tex.get_height()) if h < 0.0 else h
	canvas.draw_texture_rect(tex, _px_rect(x, y, tw, th), false, tint)


static func _draw_lcd_clock(canvas: CanvasItem, time_str: String, is_victory: bool) -> void:
	# Wall LCD clock area at x=215..261, y=82..96 in 640x360
	var col := Color(0.35, 1.0, 0.55) if is_victory else Color(0.88, 0.96, 0.42)
	var ox := 222.0
	var oy := 86.0
	for i in range(time_str.length()):
		var ch := time_str.substr(i, 1)
		var rows: Array = PIXEL_FONT.get(ch, [])
		for r in range(rows.size()):
			var line: String = rows[r]
			for c in range(line.length()):
				if line.substr(c, 1) == "1":
					canvas.draw_rect(_px_rect(ox + c * 2.0, oy + r * 1.4, 1.8, 1.3), col)
		ox += 7.5 if ch != ":" else 5.0


static func draw_office_scene(canvas: CanvasItem, st: Dictionary) -> void:
	ensure_loaded()

	var beat_f: float = st.get("beat_float", 0.0)
	var beat_pulse: float = st.get("beat_pulse", 0.0)
	var clock: float = st.get("clock", 0.0)
	var pose: String = st.get("slacker_pose", "slack")
	var slacker_bounce: float = st.get("slacker_bounce", 0.0)
	var glass_prog: float = st.get("glass_progress", -1.0)
	var boss_door_vis: float = st.get("boss_door_vis", 0.0)
	var boss_pop: float = st.get("boss_pop", 0.0)
	var blackout: float = st.get("blackout_alpha", 0.0)
	var caught_t: float = st.get("caught_t", 0.0)
	var suspicious_t: float = st.get("suspicious_t", 0.0)
	var stamp_t: float = st.get("stamp_t", 0.0)
	var time_str: String = st.get("time_str", "17:58")
	var shake_vec: Vector2 = st.get("shake", Vector2.ZERO)
	var particles: Array = st.get("particles", [])

	canvas.draw_set_transform(shake_vec, 0.0, Vector2.ONE)

	# 1. Main background layer (clean empty doorway + crisp desk)
	_draw_tex(canvas, "bg_office", 0.0, 0.0, BASE_W, BASE_H)

	# 2. Digital wall clock LCD (17:58 -> 17:59 -> 18:00)
	_draw_lcd_clock(canvas, time_str, time_str == "18:00")

	# 3. Frosted glass boss walking silhouette (hidden in hallway blackout!)
	var glass_rect := Rect2(204.0, 18.0, 238.0, 138.0)
	if glass_prog >= 0.0 and blackout < 0.85:
		var bx := lerpf(208.0, 396.0, clampf(glass_prog, 0.0, 1.0))
		var by := 26.0 - absf(sin(glass_prog * PI * 3.0)) * 4.0
		var boss_rect := Rect2(bx, by, 79.0, 171.0)
		var vis := boss_rect.intersection(glass_rect)
		if vis.size.x > 0.0 and vis.size.y > 0.0:
			var src := Rect2(vis.position - boss_rect.position, vis.size)
			var dst := _px_rect(vis.position.x, vis.position.y, vis.size.x, vis.size.y)
			var gtex: Texture2D = _textures["boss_glass"]
			var alpha := (1.0 - blackout) * 0.95
			canvas.draw_texture_rect_region(gtex, dst, src, Color(1, 1, 1, alpha))

	# Subtle frosted glass vertical slat sheen
	if blackout < 0.95:
		var gx := 214.0
		while gx < 440.0:
			canvas.draw_rect(_px_rect(gx, 18.0, 2.0, 138.0), Color(0.86, 0.94, 1.0, 0.08 * (1.0 - blackout)))
			gx += 24.0

	# 4. Hallway Shadow / Blackout Darkness (glass + right doorway hall only, CRT cubicle stays lit!)
	if blackout > 0.01:
		var dark_col := Color(0.02, 0.03, 0.08, 0.92 * blackout)
		canvas.draw_rect(_px_rect(202.0, 16.0, 242.0, 142.0), dark_col)
		canvas.draw_rect(_px_rect(444.0, 0.0, 196.0, 360.0), dark_col)
		# Soft warm desk glow spilling right slightly from CRT monitor
		canvas.draw_rect(_px_rect(0.0, 0.0, 444.0, 360.0), Color(0.02, 0.04, 0.10, 0.28 * blackout))

	# 5. Doorway Boss + Floor Shadow
	if boss_door_vis > 0.01:
		var slide_in := (1.0 - boss_door_vis) * 14.0
		var pop_scale := 1.0 + boss_pop * 0.05
		var shadow_alpha := boss_door_vis * (1.0 - blackout * 0.85)
		if shadow_alpha > 0.02:
			_draw_tex(canvas, "boss_shadow", 455.0, 237.0, 133.0, 123.0, Color(1, 1, 1, shadow_alpha))

		var b_w := 79.0 * pop_scale
		var b_h := 171.0 * pop_scale
		var b_x := 503.0 + slide_in - (b_w - 79.0) * 0.5
		var b_y := 66.0 - (b_h - 171.0) + (beat_pulse * 1.5 if caught_t <= 0.0 else 0.0)
		if blackout < 0.85:
			var door_tint := Color(1.0, 0.55, 0.55, boss_door_vis) if caught_t > 0.0 else Color(1, 1, 1, boss_door_vis * (1.0 - blackout * 0.5))
			_draw_tex(canvas, "boss_door", b_x, b_y, b_w, b_h, door_tint)
		# In Blackout, glowing cyan-white glasses shine cleanly out of pitch darkness!
		if blackout > 0.15:
			_draw_tex(canvas, "boss_eyes", b_x, b_y, b_w, b_h, Color(1.0, 1.0, 1.0, boss_door_vis))

		# Comedic Boss emotion pixel glyph above head
		if suspicious_t > 0.0:
			canvas.draw_rect(_px_rect(538.0, 46.0, 8.0, 14.0), Color(1.0, 0.85, 0.25, suspicious_t))
			canvas.draw_rect(_px_rect(540.0, 48.0, 4.0, 6.0), Color(0.15, 0.1, 0.05, suspicious_t))
			canvas.draw_rect(_px_rect(540.0, 56.0, 4.0, 3.0), Color(0.15, 0.1, 0.05, suspicious_t))
		elif caught_t > 0.0:
			canvas.draw_rect(_px_rect(537.0, 40.0, 10.0, 14.0), Color(1.0, 0.22, 0.22))
			canvas.draw_rect(_px_rect(537.0, 56.0, 10.0, 4.0), Color(1.0, 0.22, 0.22))

	# 6. CRT Monitor Screen (68x54 at x=233, y=141)
	var beat_step := posmod(int(floorf(beat_f * 2.0)), 2)
	var beat_whole := posmod(int(floorf(beat_f)), 2)
	var crt_tex := "screen_game_%d" % beat_whole
	if pose == "caught":
		crt_tex = "screen_caught"
	elif pose == "work" or pose == "barely":
		crt_tex = "screen_excel_%d" % beat_step
	_draw_tex(canvas, crt_tex, 233.0, 141.0, 68.0, 54.0)

	# 7. Slacker Character Sprite (194x170 at x=110, y=120)
	var slacker_tex := "slacker_slack_%d" % beat_whole
	if pose == "work":
		slacker_tex = "slacker_work_%d" % beat_step
	elif pose == "barely":
		slacker_tex = "slacker_barely"
	elif pose == "caught":
		slacker_tex = "slacker_caught"
	var bob_y := beat_pulse * 1.5 - slacker_bounce
	_draw_tex(canvas, slacker_tex, 110.0, 120.0 + bob_y, 194.0, 170.0)

	# 8. Coffee Mug Pixel Steam (gentle floating pixels above cup at x=290..298, y=248..266)
	for s_i in range(3):
		var ph := fmod(clock * 1.6 + s_i * 0.33, 1.0)
		var sx := 291.0 + sin(clock * 4.0 + s_i * 2.1) * 2.5 + s_i * 2.0
		var sy := 264.0 - ph * 16.0
		canvas.draw_rect(_px_rect(sx, sy, 2.0, 2.0), Color(1.0, 0.96, 0.88, (1.0 - ph) * 0.55))

	# 9. Crisp Pixel Particle Bursts (crumbs / KPI sparkles)
	for p in particles:
		var alpha: float = clampf(p.life / p.max_life, 0.0, 1.0)
		var col: Color = p.color
		col.a *= alpha
		canvas.draw_rect(_px_rect(p.pos.x, p.pos.y, p.size, p.size), col)

	# 10. Giant Pixel "OT!" Stamp when Caught (top-right corridor area so workspace stays clear!)
	if stamp_t > 0.01:
		var sc := lerpf(1.35, 1.0, clampf((1.0 - stamp_t) * 4.0, 0.0, 1.0))
		var sw := 160.0 * sc
		var sh := 68.0 * sc
		var sx := 410.0 - sw * 0.5
		var sy := 42.0 - sh * 0.5
		var alpha := clampf(stamp_t * 2.5, 0.0, 1.0)
		_draw_tex(canvas, "stamp_ot", sx, sy, sw, sh, Color(1, 1, 1, alpha))

	canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
