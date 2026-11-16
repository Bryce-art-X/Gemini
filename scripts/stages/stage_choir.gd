extends StageBase

var _sfx_do: AudioStreamWAV
var _sfx_mi: AudioStreamWAV
var _sfx_sol: AudioStreamWAV
var _sfx_high_do: AudioStreamWAV
var _sfx_tutti: AudioStreamWAV
var _sfx_cue: AudioStreamWAV

var _sing_anim: Array[float] = [0.0, 0.0, 0.0]
var _side_eye_timer: float = 0.0
var _baton_up: float = 0.0
var _notes: Array[Dictionary] = []
var _banner_text: String = "听点名：1 - 2 - 3 - 【轮到你！】"


func _configure_stage() -> void:
	stage_id = "choir"
	stage_title = "合唱团点名"
	stage_bpm = 108.0
	music_style = "choir"
	total_beats = 64.0

	_sfx_do = SoundSynth.make_tone(261.63, 0.22, "sine", 0.45)
	_sfx_mi = SoundSynth.make_tone(329.63, 0.22, "sine", 0.45)
	_sfx_sol = SoundSynth.make_tone(392.00, 0.22, "sine", 0.45)
	_sfx_high_do = SoundSynth.make_tone(523.25, 0.26, "triangle", 0.45)
	_sfx_tutti = SoundSynth.make_chord([261.63, 329.63, 392.00, 523.25], 0.30, "triangle", 0.36)
	_sfx_cue = SoundSynth.make_tone(880.0, 0.12, "triangle", 0.35)


func _build_chart() -> void:
	for i in range(4):
		add_cue(float(i), "count_in", {"num": 4 - i})

	# Relay patterns (4 beats each)
	_add_relay(4.0)
	_add_relay(8.0)
	_add_relay(12.0)

	# Together! (2 beats each)
	_add_tutti(16.0)
	_add_tutti(18.0)

	_add_relay(20.0)
	_add_tutti(24.0)
	_add_tutti(26.0)

	_add_relay(28.0)
	_add_relay(32.0)

	# Fast finale mix
	_add_tutti(36.0)
	_add_tutti(38.0)
	_add_relay(40.0)
	_add_tutti(44.0)
	_add_tutti(46.0)
	_add_relay(48.0)
	_add_relay(52.0)
	_add_tutti(56.0)
	_add_tutti(58.0)


func _add_relay(b: float) -> void:
	add_cue(b, "kid_sing", {"idx": 0, "msg": "点名：1..."})
	add_cue(b + 1.0, "kid_sing", {"idx": 1, "msg": "点名：1 - 2..."})
	add_cue(b + 2.0, "conductor_cue", {"msg": "点名：1 - 2 - 3（准备！）"})
	add_target(b + 3.0, "solo")


func _add_tutti(b: float) -> void:
	add_cue(b, "tutti_prep", {"msg": "大家一起——"})
	add_target(b + 1.0, "tutti")


func _on_cue_triggered(cue: Dictionary) -> void:
	var kind: String = cue["kind"]
	if kind == "count_in":
		_banner_text = "开嗓准备... %d" % int(cue["num"])
		conductor.play_sfx(_sfx_cue, 0.85, -5.0)
	elif kind == "kid_sing":
		var idx: int = int(cue["idx"])
		_banner_text = str(cue.get("msg", ""))
		_sing_anim[idx] = 1.0
		_spawn_note(Vector2(360 + idx * 240, 320), Color(0.95, 0.72, 0.85))
		conductor.play_sfx(_sfx_do if idx == 0 else _sfx_mi, 1.0, -3.0)
	elif kind == "conductor_cue":
		_banner_text = str(cue.get("msg", ""))
		_baton_up = 1.0
		conductor.play_sfx(_sfx_sol, 1.0, -3.0)
	elif kind == "tutti_prep":
		_banner_text = str(cue.get("msg", ""))
		_baton_up = 1.0
		conductor.play_sfx(_sfx_cue, 1.0, -4.0)


func _on_player_hit(target: Dictionary, grade: String, _err_sec: float) -> void:
	_sing_anim[2] = 1.0
	_spawn_note(Vector2(840, 320), Color(1.0, 0.88, 0.28))
	if target["kind"] == "tutti":
		_sing_anim[0] = 1.0
		_sing_anim[1] = 1.0
		_spawn_note(Vector2(360, 320), Color(0.55, 0.92, 1.0))
		_spawn_note(Vector2(600, 320), Color(0.55, 0.92, 1.0))
		_banner_text = "嘿！完美齐唱！" if grade == "perfect" else "嘿！"
		conductor.play_sfx(_sfx_tutti, 1.0, -3.0)
	else:
		_banner_text = "漂亮高音！" if grade == "perfect" else "唱响了！"
		conductor.play_sfx(_sfx_high_do, 1.0, -3.0)


func _on_player_miss(target: Dictionary, _was_early_or_wrong: bool) -> void:
	_side_eye_timer = 1.2
	_banner_text = "走调啦！队友在盯着你..."
	if target["kind"] == "tutti":
		_sing_anim[0] = 1.0
		_sing_anim[1] = 1.0


func _on_empty_tap() -> void:
	_sing_anim[2] = 0.7
	conductor.play_sfx(_sfx_high_do, 0.75, -15.0)


func _spawn_note(origin: Vector2, col: Color) -> void:
	_notes.append({
		"pos": origin,
		"col": col,
		"life": 0.75,
		"max_life": 0.75,
	})


func _process(delta: float) -> void:
	super._process(delta)
	for i in range(3):
		_sing_anim[i] = maxf(0.0, _sing_anim[i] - delta * 4.0)
	_side_eye_timer = maxf(0.0, _side_eye_timer - delta)
	_baton_up = maxf(0.0, _baton_up - delta * 4.5)

	for i in range(_notes.size() - 1, -1, -1):
		var n := _notes[i]
		n["life"] -= delta
		if n["life"] <= 0.0:
			_notes.remove_at(i)
		else:
			n["pos"].y -= 95.0 * delta


func _draw() -> void:
	var bg_col := Color(0.16, 0.10, 0.17).lerp(Color(0.24, 0.13, 0.24), beat_pulse * 0.35)
	draw_rect(Rect2(0, 0, 1280, 720), bg_col)

	# Stage floor
	draw_rect(Rect2(140, 500, 1000, 180), Color(0.28, 0.17, 0.14))
	draw_rect(Rect2(140, 500, 1000, 16), Color(0.85, 0.64, 0.28))

	# Conductor Baton Cue indicator
	if _baton_up > 0.05:
		draw_circle(Vector2(640, 235), 22.0 + _baton_up * 12.0, Color(1.0, 0.85, 0.25, _baton_up * 0.6))

	# 3 Choir Kids
	for i in range(3):
		var x := 360.0 + float(i) * 240.0
		var is_player := (i == 2)
		var robe_col := Color(0.96, 0.42, 0.58) if is_player else Color(0.36, 0.68, 0.94)
		_draw_choir_kid(Vector2(x, 500), _sing_anim[i], robe_col, is_player)

	# Floating musical notes
	var font := ThemeDB.fallback_font
	for n in _notes:
		var a := clampf(n["life"] / n["max_life"], 0.0, 1.0)
		var c: Color = n["col"]
		c.a = a
		draw_string(font, n["pos"], "♪", HORIZONTAL_ALIGNMENT_CENTER, 40, 38, c)

	draw_string(font, Vector2(0, 185), _banner_text, HORIZONTAL_ALIGNMENT_CENTER, 1280, 30, Color(1.0, 0.92, 0.96))
	draw_string(font, Vector2(840 - 45, 545), "YOU", HORIZONTAL_ALIGNMENT_CENTER, 90, 22, Color(1.0, 0.86, 0.32))


func _draw_choir_kid(base: Vector2, sing: float, robe_col: Color, is_player: bool) -> void:
	var bounce := sin(conductor.current_beat * PI) * 4.0
	var stretch := 1.0 + sing * 0.12
	var body_h := 115.0 * stretch
	var body_w := 76.0 / stretch
	var top_y := base.y - body_h - absf(bounce)

	# Robe
	draw_rect(Rect2(base.x - body_w * 0.5, top_y, body_w, body_h), robe_col)
	# Head
	var head_pos := Vector2(base.x, top_y - 28.0)
	draw_circle(head_pos, 32.0, Color(0.98, 0.86, 0.76))

	# Eyes (glare right if player missed!)
	var eye_off_x := 6.0 if (not is_player and _side_eye_timer > 0.0) else 0.0
	draw_circle(head_pos + Vector2(-11 + eye_off_x, -6), 4.0, Color(0.1, 0.1, 0.14))
	draw_circle(head_pos + Vector2(11 + eye_off_x, -6), 4.0, Color(0.1, 0.1, 0.14))

	# Mouth (opens wide when singing!)
	if sing > 0.15:
		draw_circle(head_pos + Vector2(0, 11), 6.0 + sing * 8.0, Color(0.65, 0.12, 0.20))
	else:
		draw_line(head_pos + Vector2(-7, 11), head_pos + Vector2(7, 11), Color(0.2, 0.15, 0.15), 3.0)
