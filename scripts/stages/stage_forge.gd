extends StageBase

var _sfx_master_ding: AudioStreamWAV
var _sfx_player_clang: AudioStreamWAV
var _sfx_sword_done: AudioStreamWAV

var _master_swing: float = 0.0
var _player_swing: float = 0.0
var _ingot_heat: float = 0.0
var _shake: float = 0.0
var _swords_forged: int = 0
var _sparks: Array[Dictionary] = []
var _banner_text: String = "听师傅敲击的节奏！"


func _configure_stage() -> void:
	stage_id = "forge"
	stage_title = "铁匠打铁"
	stage_bpm = 115.0
	music_style = "forge"
	total_beats = 64.0

	_sfx_master_ding = SoundSynth.make_tone(880.0, 0.14, "triangle", 0.45)
	_sfx_player_clang = SoundSynth.make_chord([293.66, 587.33, 880.0], 0.22, "square", 0.25)
	_sfx_sword_done = SoundSynth.make_chord([587.33, 739.99, 880.0, 1174.66], 0.35, "triangle", 0.35)


func _build_chart() -> void:
	# Intro count-in: beats 0..3
	for i in range(4):
		add_cue(float(i), "count_in", {"num": 4 - i})

	# Bar 1 (4..7): Single strike x2
	_add_single_pair(4.0)
	_add_single_pair(6.0)
	# Bar 2 (8..11): Single strike x2
	_add_single_pair(8.0)
	_add_single_pair(10.0)
	# Bar 3 (12..15): Double strike (12, 13 -> 14, 15)
	_add_double_pair(12.0)
	# Bar 4 (16..19): Triple fast!
	_add_triple_pair(16.0)
	# Bar 5 (20..23): Single + Single
	_add_single_pair(20.0)
	_add_single_pair(22.0)
	# Bar 6 (24..27): Triple fast!
	_add_triple_pair(24.0)
	# Bar 7 (28..31): Double strike
	_add_double_pair(28.0)
	# Bar 8 (32..35): Triple fast!
	_add_triple_pair(32.0)
	# Bar 9 (36..39): Single x2
	_add_single_pair(36.0)
	_add_single_pair(38.0)
	# Bar 10 (40..43): Triple fast!
	_add_triple_pair(40.0)
	# Bar 11 (44..47): Double strike
	_add_double_pair(44.0)
	# Bar 12 (48..51): Triple fast!
	_add_triple_pair(48.0)
	# Bar 13 (52..55): Triple fast!
	_add_triple_pair(52.0)
	# Bar 14 (56..59): Final Big Triple!
	_add_triple_pair(56.0)


func _add_single_pair(b: float) -> void:
	add_cue(b, "master_hit", {"msg": "叮！"})
	add_target(b + 1.0, "single", {"finish_sword": false})


func _add_double_pair(b: float) -> void:
	add_cue(b, "master_hit", {"msg": "叮！"})
	add_cue(b + 1.0, "master_hit", {"msg": "叮-叮！"})
	add_target(b + 2.0, "double", {"finish_sword": false})
	add_target(b + 3.0, "double", {"finish_sword": true})


func _add_triple_pair(b: float) -> void:
	add_cue(b, "master_hit", {"msg": "三连敲：叮-"})
	add_cue(b + 0.5, "master_hit", {"msg": "三连敲：叮-叮-"})
	add_cue(b + 1.0, "master_hit", {"msg": "三连敲：叮-叮-叮！"})
	add_target(b + 2.0, "triple", {"finish_sword": false})
	add_target(b + 2.5, "triple", {"finish_sword": false})
	add_target(b + 3.0, "triple", {"finish_sword": true})


func _on_cue_triggered(cue: Dictionary) -> void:
	if cue["kind"] == "count_in":
		_banner_text = "准备... %d" % int(cue["num"])
		conductor.play_sfx(_sfx_master_ding, 0.75, -6.0)
	elif cue["kind"] == "master_hit":
		_banner_text = str(cue.get("msg", "叮！"))
		_master_swing = 1.0
		_ingot_heat = 1.0
		conductor.play_sfx(_sfx_master_ding, 1.0, -2.0)


func _on_player_hit(target: Dictionary, grade: String, _err_sec: float) -> void:
	_player_swing = 1.0
	_shake = 8.0 if grade == "perfect" else 4.0
	_spawn_sparks(Vector2(820, 445), 16 if grade == "perfect" else 8)
	conductor.play_sfx(_sfx_player_clang, 1.0 if grade == "perfect" else 0.92, -3.0)
	if target.get("finish_sword", false):
		_swords_forged += 1
		_banner_text = "名剑出炉！(%d)" % _swords_forged
		conductor.play_sfx(_sfx_sword_done, 1.0, -3.0)


func _on_player_miss(_target: Dictionary, _was_early_or_wrong: bool) -> void:
	_player_swing = 0.5
	_banner_text = "哎呀，打歪了！"


func _on_empty_tap() -> void:
	_player_swing = 0.65
	conductor.play_sfx(_sfx_player_clang, 0.7, -14.0)


func _spawn_sparks(origin: Vector2, count: int) -> void:
	for i in range(count):
		var ang := randf_range(-PI * 0.95, -PI * 0.05)
		var spd := randf_range(160.0, 420.0)
		_sparks.append({
			"pos": origin,
			"vel": Vector2(cos(ang), sin(ang)) * spd,
			"life": randf_range(0.25, 0.55),
			"max_life": 0.55,
		})


func _process(delta: float) -> void:
	super._process(delta)
	_master_swing = maxf(0.0, _master_swing - delta * 5.0)
	_player_swing = maxf(0.0, _player_swing - delta * 5.0)
	_ingot_heat = maxf(0.2, _ingot_heat - delta * 1.4)
	_shake = maxf(0.0, _shake - delta * 28.0)

	for i in range(_sparks.size() - 1, -1, -1):
		var sp := _sparks[i]
		sp["life"] -= delta
		if sp["life"] <= 0.0:
			_sparks.remove_at(i)
		else:
			sp["vel"].y += 680.0 * delta
			sp["pos"] += sp["vel"] * delta


func _draw() -> void:
	var shake_off := Vector2(randf_range(-_shake, _shake), randf_range(-_shake, _shake))
	var bg_col := Color(0.14, 0.09, 0.08).lerp(Color(0.22, 0.12, 0.09), beat_pulse * 0.4)
	draw_rect(Rect2(0, 0, 1280, 720), bg_col)

	# Furnace glow in center-back
	var glow_r := 180.0 + beat_pulse * 18.0
	draw_circle(Vector2(640, 360) + shake_off, glow_r, Color(0.95, 0.36, 0.12, 0.18))
	draw_rect(Rect2(Vector2(540, 230) + shake_off, Vector2(200, 190)), Color(0.22, 0.16, 0.16))
	draw_circle(Vector2(640, 340) + shake_off, 68.0 + beat_pulse * 6.0, Color(1.0, 0.48, 0.12, 0.85))

	# Floor
	draw_rect(Rect2(Vector2(0, 500) + shake_off, Vector2(1280, 220)), Color(0.18, 0.14, 0.13))

	# Master Blacksmith (Left)
	_draw_blacksmith(Vector2(360, 420) + shake_off, _master_swing, Color(0.92, 0.42, 0.25), true)
	# Master Anvil
	_draw_anvil(Vector2(450, 465) + shake_off)

	# Player Apprentice (Right)
	_draw_blacksmith(Vector2(920, 420) + shake_off, _player_swing, Color(0.30, 0.72, 0.96), false)
	# Player Anvil + Hot Ingot
	_draw_anvil(Vector2(820, 465) + shake_off)
	var ingot_col := Color(0.95, 0.35, 0.15).lerp(Color(1.0, 0.92, 0.55), _ingot_heat)
	draw_rect(Rect2(Vector2(790, 438) + shake_off, Vector2(60, 16)), ingot_col)

	# Sparks
	for sp in _sparks:
		var a := clampf(sp["life"] / sp["max_life"], 0.0, 1.0)
		draw_circle(sp["pos"] + shake_off, 4.0 * a + 1.5, Color(1.0, 0.82, 0.25, a))

	# Banner & Sword Count
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(0, 190), _banner_text, HORIZONTAL_ALIGNMENT_CENTER, 1280, 30, Color(1.0, 0.94, 0.82))
	draw_string(font, Vector2(40, 620), "成品名剑: %d" % _swords_forged, HORIZONTAL_ALIGNMENT_LEFT, 400, 26, Color(1.0, 0.86, 0.36))


func _draw_anvil(pos: Vector2) -> void:
	draw_rect(Rect2(pos - Vector2(48, 22), Vector2(96, 26)), Color(0.34, 0.37, 0.42))
	draw_rect(Rect2(pos - Vector2(26, -4), Vector2(52, 32)), Color(0.25, 0.27, 0.31))


func _draw_blacksmith(pos: Vector2, swing: float, shirt_col: Color, facing_right: bool) -> void:
	var dir := 1.0 if facing_right else -1.0
	var squash := Vector2(1.0 + swing * 0.14, 1.0 - swing * 0.14)
	# Body
	var body_size := Vector2(64 * squash.x, 86 * squash.y)
	draw_rect(Rect2(pos - Vector2(body_size.x * 0.5, body_size.y), body_size), shirt_col)
	# Head
	var head_pos := pos - Vector2(0, body_size.y + 26)
	draw_circle(head_pos, 26, Color(0.96, 0.82, 0.70))
	draw_circle(head_pos + Vector2(dir * 9, -4), 4, Color(0.12, 0.12, 0.15))

	# Hammer arm
	var angle := lerpf(-1.1 * dir, 0.35 * dir, swing)
	var shoulder := pos - Vector2(-10 * dir, body_size.y * 0.7)
	var hand := shoulder + Vector2(dir * 62.0, 0).rotated(angle)
	draw_line(shoulder, hand, Color(0.96, 0.82, 0.70), 10.0)
	# Hammer head
	draw_rect(Rect2(hand - Vector2(16, 12), Vector2(32, 24)), Color(0.55, 0.58, 0.64))
