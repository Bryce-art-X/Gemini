extends Control

const ACE_PRESS_SEC := 0.062
const BARELY_PRESS_SEC := 0.120
const ACE_RELEASE_SEC := 0.075
const BARELY_RELEASE_SEC := 0.140
const SLACK_IGNORE_SEC := 0.155

var _conductor: RhythmConductor
var _stage_canvas: Node2D
var _is_headless: bool = false

# Chart & Audio Data
var _chart: Dictionary = {}
var _bpm: float = 118.0
var _beat_sec: float = 60.0 / 118.0
var _total_beats: float = 144.0
var _cues: Array = []
var _targets: Array = []
var _cue_idx: int = 0
var _target_idx: int = 0

var _bgm_stream: AudioStream
var _sfx: Dictionary = {}
var _chords: Array[AudioStream] = []

# Gameplay State
var _beat_pulse: float = 0.0
var _clock: float = 0.0
var _slacker_pose: String = "slack"
var _pose_until_beat: float = -1.0
var _slacker_bounce: float = 0.0

var _hold_active: bool = false
var _hold_target_idx: int = -1
var _hold_clack_step: int = -1

var _glass_span_start: float = -1.0
var _glass_span_end: float = -1.0
var _boss_door_until: float = -1.0
var _boss_door_vis: float = 0.0
var _boss_pop: float = 0.0

var _blackout_target: float = 0.0
var _blackout_alpha: float = 0.0
var _caught_t: float = 0.0
var _suspicious_t: float = 0.0
var _stamp_t: float = 0.0
var _shake_amp: float = 0.0
var _shake_vec: Vector2 = Vector2.ZERO
var _is_1800: bool = false
var _particles: Array = []

# Score & Combo (Scored targets exclude warmup practice targets!)
var _ace_count: int = 0
var _barely_count: int = 0
var _miss_count: int = 0
var _combo: int = 0
var _max_combo: int = 0
var _total_scored: int = 0
var _stage_done: bool = false

# Minimal Crisp HUD & Result Card
var _combo_lbl: Label
var _practice_lbl: Label
var _result_overlay: ColorRect
var _result_title: Label
var _result_rank: Label
var _result_stats: Label


func _ready() -> void:
	_is_headless = DisplayServer.get_name() == "headless"
	theme = UITheme.make_theme()
	_load_chart_and_audio()
	_build_nodes()
	_conductor.setup(_bpm, _bgm_stream)
	_conductor.start()


func _load_chart_and_audio() -> void:
	var f := FileAccess.open("res://assets/data/office_slacker_chart.json", FileAccess.READ)
	if f != null:
		var parsed: Variant = JSON.parse_string(f.get_as_text())
		if parsed is Dictionary:
			_chart = parsed
	_bpm = float(_chart.get("bpm", 118.0))
	_beat_sec = 60.0 / _bpm
	_total_beats = float(_chart.get("total_beats", 144.0))
	_cues = _chart.get("cues", [])
	_targets = _chart.get("targets", [])
	for t in _targets:
		t["state"] = "pending"
		if not bool(t.get("practice", false)):
			_total_scored += 1

	_bgm_stream = load("res://assets/audio/bgm_main.ogg")
	var sfx_names := [
		"cue_step_1", "cue_step_2", "cue_step_3", "cue_count",
		"cue_cough", "cue_hmm", "cue_turnaround",
		"sfx_type_ace", "sfx_type_clack", "sfx_empty_tap",
		"sfx_crunch", "sfx_barely", "sfx_caught_stamp",
		"sfx_power_off", "sfx_power_on", "sfx_bell_1800",
	]
	for n in sfx_names:
		_sfx[n] = load("res://assets/audio/%s.wav" % n)
	for i in range(8):
		_chords.append(load("res://assets/audio/chord_%d.wav" % i))


func _build_nodes() -> void:
	_conductor = RhythmConductor.new()
	_conductor.beat_hit.connect(_on_beat_hit)
	_conductor.song_finished.connect(_on_song_finished)
	add_child(_conductor)

	_stage_canvas = Node2D.new()
	_stage_canvas.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_stage_canvas.draw.connect(_on_draw_stage)
	add_child(_stage_canvas)

	# Unobtrusive corner HUD (Zero mid-song clutter!)
	var hud := MarginContainer.new()
	hud.set_anchors_preset(Control.PRESET_TOP_WIDE)
	hud.add_theme_constant_override("margin_left", 20)
	hud.add_theme_constant_override("margin_right", 20)
	hud.add_theme_constant_override("margin_top", 14)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud)

	var top_bar := HBoxContainer.new()
	top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(top_bar)

	_combo_lbl = Label.new()
	_combo_lbl.text = ""
	_combo_lbl.add_theme_font_size_override("font_size", 22)
	_combo_lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.36))
	_combo_lbl.add_theme_color_override("font_outline_color", Color(0.06, 0.07, 0.12))
	_combo_lbl.add_theme_constant_override("outline_size", 6)
	top_bar.add_child(_combo_lbl)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_bar.add_child(spacer)

	_practice_lbl = Label.new()
	_practice_lbl.text = "热身演练"
	_practice_lbl.add_theme_font_size_override("font_size", 18)
	_practice_lbl.add_theme_color_override("font_color", Color(0.42, 0.95, 0.65))
	_practice_lbl.add_theme_color_override("font_outline_color", Color(0.06, 0.07, 0.12))
	_practice_lbl.add_theme_constant_override("outline_size", 5)
	top_bar.add_child(_practice_lbl)

	var exit_btn := Button.new()
	exit_btn.text = "✕"
	exit_btn.custom_minimum_size = Vector2(40, 36)
	exit_btn.focus_mode = Control.FOCUS_NONE
	UITheme.style_button(exit_btn, Color(0.24, 0.27, 0.36), Color(0.95, 0.96, 1.0))
	exit_btn.pressed.connect(_return_to_title)
	top_bar.add_child(exit_btn)

	_build_result_modal()


func _build_result_modal() -> void:
	_result_overlay = ColorRect.new()
	_result_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_result_overlay.color = Color(0.04, 0.05, 0.09, 0.86)
	_result_overlay.visible = false
	add_child(_result_overlay)

	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	_result_overlay.add_child(cc)

	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(540, 0)
	UITheme.style_card(card, Color(0.14, 0.15, 0.22), Color(1.0, 0.82, 0.28))
	cc.add_child(card)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	card.add_child(vb)

	_result_title = Label.new()
	_result_title.text = "18:00 考勤日报 • HR 摸鱼绩效"
	_result_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_title.add_theme_font_size_override("font_size", 20)
	_result_title.modulate = Color(0.75, 0.85, 1.0)
	vb.add_child(_result_title)

	_result_rank = Label.new()
	_result_rank.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_rank.add_theme_font_size_override("font_size", 42)
	_result_rank.modulate = Color(1.0, 0.88, 0.30)
	vb.add_child(_result_rank)

	_result_stats = Label.new()
	_result_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_stats.add_theme_font_size_override("font_size", 19)
	vb.add_child(_result_stats)

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	vb.add_child(row)

	var retry := Button.new()
	retry.text = "再摸一天 ↻"
	retry.custom_minimum_size = Vector2(200, 52)
	retry.add_theme_font_size_override("font_size", 20)
	UITheme.style_button(retry, Color(0.35, 0.88, 0.56))
	retry.pressed.connect(func() -> void: get_tree().reload_current_scene())
	row.add_child(retry)

	var back := Button.new()
	back.text = "下班回家"
	back.custom_minimum_size = Vector2(180, 52)
	back.add_theme_font_size_override("font_size", 20)
	UITheme.style_button(back, Color(0.36, 0.78, 0.98))
	back.pressed.connect(_return_to_title)
	row.add_child(back)


func _return_to_title() -> void:
	_conductor.stop()
	get_tree().change_scene_to_file("res://scenes/title_screen.tscn")


func _on_beat_hit(_beat_idx: int) -> void:
	_beat_pulse = 1.0


func _on_song_finished() -> void:
	if not _stage_done:
		_finish_stage()


func _spawn_particles(ox: float, oy: float, col: Color, count: int = 8) -> void:
	for i in range(count):
		var ang := randf_range(-PI * 0.9, -PI * 0.1)
		var spd := randf_range(35.0, 115.0)
		_particles.append({
			"pos": Vector2(ox + randf_range(-6.0, 6.0), oy + randf_range(-4.0, 4.0)),
			"vel": Vector2(cos(ang) * spd, sin(ang) * spd),
			"life": randf_range(0.28, 0.55),
			"max_life": 0.55,
			"size": float(randi_range(2, 4)),
			"color": col,
		})


func _process_cues(cur_beat: float) -> void:
	while _cue_idx < _cues.size() and cur_beat >= float(_cues[_cue_idx]["beat"]):
		var cue: Dictionary = _cues[_cue_idx]
		_cue_idx += 1
		var kind := str(cue.get("kind", ""))
		match kind:
			"count_in":
				_conductor.play_cue(_sfx["cue_count"], 0.10)
			"step":
				var step_num := clampi(int(cue.get("step", 1)), 1, 3)
				_conductor.play_cue(_sfx["cue_step_%d" % step_num], 0.12)
				_glass_span_start = float(cue.get("spawn_beat", cur_beat))
				_glass_span_end = float(cue.get("hit_beat", cur_beat + 3.0))
			"cough":
				_conductor.play_cue(_sfx["cue_cough"], 0.22)
				_glass_span_start = float(cue.get("spawn_beat", cur_beat - 2.0))
				_glass_span_end = float(cue.get("hit_beat", cur_beat + 1.0))
			"boss_peek":
				_boss_door_until = float(cue["beat"]) + float(cue.get("duration", 0.9))
				_boss_pop = 1.0
				_glass_span_start = -1.0
			"boss_stare":
				_boss_door_until = float(cue["beat"]) + float(cue.get("duration", 3.0)) + 0.15
				_boss_pop = 1.0
				_glass_span_start = -1.0
			"hmm_leave":
				_conductor.play_cue(_sfx["cue_hmm"], 0.18)
			"turnaround":
				_conductor.play_cue(_sfx["cue_turnaround"], 0.16)
				_boss_pop = 0.85
			"blackout_on":
				_conductor.play_sfx(_sfx["sfx_power_off"], &"Master", -1.5)
				_blackout_target = 1.0
			"blackout_off":
				_conductor.play_sfx(_sfx["sfx_power_on"], &"Master", -1.5)
				_blackout_target = 0.0
			"practice_done":
				_practice_lbl.visible = false
			"bell_1800":
				_conductor.play_sfx(_sfx["sfx_bell_1800"], &"Master", 0.0)
				_is_1800 = true
				_spawn_particles(200.0, 120.0, Color(0.45, 1.0, 0.65), 14)
				_spawn_particles(270.0, 130.0, Color(1.0, 0.90, 0.35), 14)


func _check_missed_targets(cur_time: float, cur_beat: float) -> void:
	for i in range(_target_idx, _targets.size()):
		var t: Dictionary = _targets[i]
		if t["state"] != "pending":
			continue
		var kind := str(t["kind"])
		var late_lim := BARELY_RELEASE_SEC if kind == "hold_release" else BARELY_PRESS_SEC
		var target_t := float(t["beat"]) * _beat_sec
		if cur_time > target_t + late_lim:
			t["state"] = "missed"
			_target_idx = i + 1
			if kind == "hold_start":
				# Also skip paired hold_release cleanly as missed if player never held!
				for j in range(i + 1, _targets.size()):
					if str(_targets[j]["kind"]) == "hold_release" and _targets[j]["state"] == "pending":
						_targets[j]["state"] = "missed"
						break
			_trigger_miss(bool(t.get("practice", false)), cur_beat)
		else:
			break


func _trigger_miss(is_practice: bool, cur_beat: float) -> void:
	_hold_active = false
	_hold_target_idx = -1
	_slacker_pose = "caught"
	_pose_until_beat = cur_beat + 1.05
	_caught_t = 1.0
	_stamp_t = 1.0
	_shake_amp = 10.0
	_boss_door_until = maxf(_boss_door_until, cur_beat + 1.05)
	_conductor.play_sfx(_sfx["sfx_caught_stamp"], &"Master", -1.0)
	_spawn_particles(195.0, 185.0, Color(1.0, 0.30, 0.25), 10)
	if not is_practice:
		_miss_count += 1
		_combo = 0
		_update_combo_label()


func _find_matching_press_target(cur_time: float) -> int:
	var best_idx := -1
	var best_err := INF
	for i in range(_target_idx, _targets.size()):
		var t: Dictionary = _targets[i]
		if t["state"] != "pending":
			continue
		if str(t["kind"]) == "hold_release":
			continue
		var dt := absf(cur_time - float(t["beat"]) * _beat_sec)
		if dt <= BARELY_PRESS_SEC and dt < best_err:
			best_err = dt
			best_idx = i
		elif float(t["beat"]) * _beat_sec - cur_time > BARELY_PRESS_SEC + 0.1:
			break
	return best_idx


func _handle_press() -> void:
	if _stage_done:
		return
	var cur_time := _conductor.current_time_sec
	var cur_beat := _conductor.current_beat
	var idx := _find_matching_press_target(cur_time)

	if idx < 0:
		# Nervous quiet tap without awarding points or locking out upcoming note
		_slacker_bounce = 4.0
		_conductor.play_foley(_sfx["sfx_empty_tap"], -8.0, false)
		return

	var t: Dictionary = _targets[idx]
	var dt := absf(cur_time - float(t["beat"]) * _beat_sec)
	var is_ace := dt <= ACE_PRESS_SEC
	var is_practice := bool(t.get("practice", false))
	var kind := str(t["kind"])
	t["state"] = "hit"
	if idx == _target_idx:
		_target_idx = idx + 1

	_slacker_bounce = 7.5
	var chord_i := clampi(int(t.get("chord_idx", 0)), 0, _chords.size() - 1)

	if is_ace:
		_slacker_pose = "work"
		_conductor.play_foley(_sfx["sfx_type_ace"], 0.5, true)
		_conductor.play_quantized_chord(_chords[chord_i], -3.0)
		_spawn_particles(268.0, 165.0, Color(0.45, 1.0, 0.62), 10)
		if not is_practice:
			_ace_count += 1
			_combo += 1
			_max_combo = maxi(_max_combo, _combo)
	else:
		_slacker_pose = "barely"
		_suspicious_t = 0.9
		_conductor.play_foley(_sfx["sfx_barely"], -1.5, false)
		_spawn_particles(250.0, 180.0, Color(1.0, 0.85, 0.30), 6)
		if not is_practice:
			_barely_count += 1
			_combo = 0

	if kind == "hold_start":
		_hold_active = true
		_hold_clack_step = -1
		_pose_until_beat = float(t.get("end_beat", cur_beat + 3.0)) + 0.25
		for j in range(idx + 1, _targets.size()):
			if str(_targets[j]["kind"]) == "hold_release" and _targets[j]["state"] == "pending":
				_hold_target_idx = j
				break
	else:
		_pose_until_beat = maxf(cur_beat, float(t["beat"])) + 0.90

	_update_combo_label()


func _handle_release() -> void:
	if _stage_done or not _hold_active:
		return
	_hold_active = false
	if _hold_target_idx < 0 or _hold_target_idx >= _targets.size():
		return

	var t: Dictionary = _targets[_hold_target_idx]
	if t["state"] != "pending":
		_hold_target_idx = -1
		return

	var cur_time := _conductor.current_time_sec
	var cur_beat := _conductor.current_beat
	var dt := absf(cur_time - float(t["beat"]) * _beat_sec)
	var is_practice := bool(t.get("practice", false))

	if dt <= BARELY_RELEASE_SEC:
		t["state"] = "hit"
		_target_idx = maxi(_target_idx, _hold_target_idx + 1)
		_hold_target_idx = -1
		_slacker_pose = "slack"
		_pose_until_beat = -1.0
		_slacker_bounce = 6.0
		if dt <= ACE_RELEASE_SEC:
			var chord_i := clampi(int(t.get("chord_idx", 0)), 0, _chords.size() - 1)
			_conductor.play_foley(_sfx["sfx_crunch"], 0.0, false)
			_conductor.play_quantized_chord(_chords[chord_i], -3.5)
			_spawn_particles(195.0, 195.0, Color(1.0, 0.88, 0.35), 9)
			if not is_practice:
				_ace_count += 1
				_combo += 1
				_max_combo = maxi(_max_combo, _combo)
		else:
			_slacker_pose = "barely"
			_pose_until_beat = cur_beat + 0.55
			_suspicious_t = 0.85
			_conductor.play_foley(_sfx["sfx_barely"], -2.0, false)
			if not is_practice:
				_barely_count += 1
				_combo = 0
		_update_combo_label()
	else:
		# Released TOO early right while Boss is still staring!
		t["state"] = "missed"
		_target_idx = maxi(_target_idx, _hold_target_idx + 1)
		_trigger_miss(is_practice, cur_beat)


func _update_combo_label() -> void:
	if _combo >= 2:
		_combo_lbl.text = "%d 连摸!" % _combo
	else:
		_combo_lbl.text = ""


func _unhandled_input(event: InputEvent) -> void:
	if _stage_done:
		return
	if event.is_action_pressed("ui_cancel"):
		_return_to_title()
		return
	if event.is_action_pressed("rhythm_hit") and not event.is_echo():
		_handle_press()
	elif event.is_action_released("rhythm_hit"):
		_handle_release()


func _process(delta: float) -> void:
	_clock += delta
	_beat_pulse = maxf(0.0, _beat_pulse - delta * 5.2)
	_slacker_bounce = maxf(0.0, _slacker_bounce - delta * 26.0)
	_boss_pop = maxf(0.0, _boss_pop - delta * 4.0)
	_caught_t = maxf(0.0, _caught_t - delta * 1.1)
	_suspicious_t = maxf(0.0, _suspicious_t - delta * 1.2)
	_stamp_t = maxf(0.0, _stamp_t - delta * 1.15)
	_blackout_alpha = lerpf(_blackout_alpha, _blackout_target, clampf(delta * 8.0, 0.0, 1.0))

	if _shake_amp > 0.1:
		_shake_vec = Vector2(randf_range(-_shake_amp, _shake_amp), randf_range(-_shake_amp, _shake_amp))
		_shake_amp = maxf(0.0, _shake_amp - delta * 36.0)
	else:
		_shake_vec = Vector2.ZERO

	# Update pixel particles
	for i in range(_particles.size() - 1, -1, -1):
		var p: Dictionary = _particles[i]
		p["pos"] += p["vel"] * delta
		p["vel"] += Vector2(0.0, 260.0) * delta
		p["life"] -= delta
		if p["life"] <= 0.0:
			_particles.remove_at(i)

	if not _stage_done:
		var cur_beat := _conductor.current_beat
		var cur_time := _conductor.current_time_sec

		_process_cues(cur_beat)
		_check_missed_targets(cur_time, cur_beat)

		# Typing clacks while sustaining Boss stare Hold!
		if _hold_active:
			_slacker_pose = "work"
			var step := int(floorf(cur_beat * 2.0))
			if step > _hold_clack_step:
				_hold_clack_step = step
				_slacker_bounce = 3.0
				_conductor.play_foley(_sfx["sfx_type_clack"], -7.5, false)
		elif _pose_until_beat > 0.0 and cur_beat >= _pose_until_beat:
			_pose_until_beat = -1.0
			_slacker_pose = "slack"

		# Smooth doorway Boss visibility fade in/out
		var want_door := 1.0 if (_boss_door_until > 0.0 and cur_beat <= _boss_door_until) else 0.0
		_boss_door_vis = lerpf(_boss_door_vis, want_door, clampf(delta * 18.0, 0.0, 1.0))

		if cur_beat >= _total_beats:
			_finish_stage()

	_stage_canvas.queue_redraw()


func _on_draw_stage() -> void:
	var cur_beat := _conductor.current_beat
	var glass_p := -1.0
	if _glass_span_start >= 0.0 and cur_beat >= _glass_span_start and cur_beat <= _glass_span_end:
		glass_p = (cur_beat - _glass_span_start) / maxf(0.01, _glass_span_end - _glass_span_start)

	var time_str := "17:58"
	if _is_1800 or cur_beat >= 142.0:
		time_str = "18:00"
	elif cur_beat >= 72.0:
		time_str = "17:59"

	OfficePainter.draw_office_scene(_stage_canvas, {
		"beat_float": cur_beat,
		"beat_pulse": _beat_pulse,
		"clock": _clock,
		"slacker_pose": _slacker_pose,
		"slacker_bounce": _slacker_bounce,
		"glass_progress": glass_p,
		"boss_door_vis": _boss_door_vis,
		"boss_pop": _boss_pop,
		"blackout_alpha": _blackout_alpha,
		"caught_t": _caught_t,
		"suspicious_t": _suspicious_t,
		"stamp_t": _stamp_t,
		"time_str": time_str,
		"shake": _shake_vec,
		"particles": _particles,
	})


func _finish_stage() -> void:
	if _stage_done:
		return
	_stage_done = true
	_conductor.stop()
	var total := maxf(1.0, float(_total_scored))
	var raw_pts := float(_ace_count) + float(_barely_count) * 0.5
	var accuracy := (raw_pts / total) * 100.0
	var rank := GameState.update_record(accuracy, _max_combo, _miss_count)

	_result_rank.text = rank
	if accuracy >= 85.0:
		_result_rank.modulate = Color(0.45, 1.0, 0.58)
	elif accuracy >= 60.0:
		_result_rank.modulate = Color(1.0, 0.88, 0.35)
	else:
		_result_rank.modulate = Color(1.0, 0.42, 0.42)

	_result_stats.text = (
		"准确率：%.1f%%   最高连摸：%d\n" % [accuracy, _max_combo]
		+ "完美切换 %d   ·   险些露馅 %d   ·   当场抓包 %d" % [_ace_count, _barely_count, _miss_count]
	)
	_result_overlay.visible = true
