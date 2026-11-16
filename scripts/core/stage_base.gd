class_name StageBase
extends Node2D

const PERFECT_WINDOW := 0.052
const GOOD_WINDOW := 0.108
const MISS_WINDOW := 0.135

var stage_id: String = "base"
var stage_title: String = "Stage"
var stage_bpm: float = 120.0
var music_style: String = "forge"
var total_beats: float = 64.0

var conductor: RhythmConductor
var cues: Array[Dictionary] = []
var targets: Array[Dictionary] = []

var perfect_count: int = 0
var good_count: int = 0
var miss_count: int = 0
var combo: int = 0
var max_combo: int = 0
var stage_finished: bool = false
var beat_pulse: float = 0.0

# Shared synthesized feedback SFX
var _sfx_perfect: AudioStreamWAV
var _sfx_good: AudioStreamWAV
var _sfx_miss: AudioStreamWAV

# HUD nodes
var _hud_layer: CanvasLayer
var _progress_bar: ProgressBar
var _combo_label: Label
var _judge_label: Label
var _judge_tween: Tween
var _result_panel: PanelContainer
var _result_summary: Label
var _result_rank: Label


func _ready() -> void:
	_sfx_perfect = SoundSynth.make_chord([523.25, 659.25, 783.99], 0.16, "triangle", 0.32)
	_sfx_good = SoundSynth.make_tone(440.0, 0.11, "triangle", 0.28)
	_sfx_miss = SoundSynth.make_miss_buzz(0.32)

	conductor = RhythmConductor.new()
	add_child(conductor)
	conductor.beat_hit.connect(_on_beat_hit)

	_configure_stage()
	conductor.setup(stage_bpm, music_style)
	_build_chart()
	_build_hud()
	conductor.start()


## Subclasses override these to define stage metadata, chart, and visuals.
func _configure_stage() -> void:
	pass


func _build_chart() -> void:
	pass


func _on_cue_triggered(_cue: Dictionary) -> void:
	pass


func _on_player_hit(_target: Dictionary, _grade: String, _err_sec: float) -> void:
	pass


func _on_player_miss(_target: Dictionary, _was_early_or_wrong: bool) -> void:
	pass


func _on_empty_tap() -> void:
	pass


func _on_beat(_beat_idx: int) -> void:
	pass


func add_cue(beat: float, kind: String, extra: Dictionary = {}) -> void:
	var item := {"beat": beat, "kind": kind, "triggered": false}
	for k in extra.keys():
		item[k] = extra[k]
	cues.append(item)


func add_target(beat: float, kind: String, extra: Dictionary = {}) -> void:
	var item := {"beat": beat, "kind": kind, "judged": false, "result": ""}
	for k in extra.keys():
		item[k] = extra[k]
	targets.append(item)


func _on_beat_hit(beat_idx: int) -> void:
	beat_pulse = 1.0
	_on_beat(beat_idx)


func _process(delta: float) -> void:
	beat_pulse = maxf(0.0, beat_pulse - delta * 4.5)
	if stage_finished:
		return

	var cur_beat := conductor.current_beat
	_progress_bar.value = clampf(cur_beat / maxf(1.0, total_beats) * 100.0, 0.0, 100.0)

	# Trigger cues
	for cue in cues:
		if not cue["triggered"] and cur_beat >= float(cue["beat"]):
			cue["triggered"] = true
			_on_cue_triggered(cue)

	# Auto-miss targets that passed the window
	var cur_sec := cur_beat * conductor.beat_duration
	for target in targets:
		if not target["judged"]:
			var target_sec := float(target["beat"]) * conductor.beat_duration
			if cur_sec - target_sec > MISS_WINDOW:
				target["judged"] = true
				target["result"] = "miss"
				_register_miss(target, false)

	if cur_beat >= total_beats:
		_finish_stage()

	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_go_back_to_menu()
		return

	if stage_finished:
		return

	if event.is_action_pressed("rhythm_hit"):
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			# Avoid triggering hit when clicking top-right back button
			if event.position.y < 76.0 and event.position.x > 1080.0:
				return
		_handle_player_tap()


func _handle_player_tap() -> void:
	var cur_sec := conductor.current_beat * conductor.beat_duration
	var best_target: Dictionary = {}
	var best_abs_err := 999.0
	var signed_err := 0.0

	for target in targets:
		if target["judged"]:
			continue
		var target_sec := float(target["beat"]) * conductor.beat_duration
		var err := cur_sec - target_sec
		var abs_err := absf(err)
		if abs_err <= MISS_WINDOW and abs_err < best_abs_err:
			best_abs_err = abs_err
			signed_err = err
			best_target = target

	if best_target.is_empty():
		_on_empty_tap()
		return

	best_target["judged"] = true
	var is_practice := bool(best_target.get("practice", false))
	if best_abs_err <= PERFECT_WINDOW:
		best_target["result"] = "perfect"
		if not is_practice:
			perfect_count += 1
			combo += 1
			max_combo = maxi(max_combo, combo)
		_show_judge("很好! (练习)" if is_practice else "ACE!", Color(1.0, 0.86, 0.22))
		conductor.play_sfx(_sfx_perfect, 1.0, -3.0)
		_on_player_hit(best_target, "perfect", signed_err)
	elif best_abs_err <= GOOD_WINDOW:
		best_target["result"] = "good"
		if not is_practice:
			good_count += 1
			combo += 1
			max_combo = maxi(max_combo, combo)
		_show_judge("不错 (练习)" if is_practice else "BARELY", Color(0.62, 0.92, 0.42))
		conductor.play_sfx(_sfx_good, 1.0, -3.0)
		_on_player_hit(best_target, "good", signed_err)
	else:
		best_target["result"] = "miss"
		_register_miss(best_target, true)

	_update_combo_label()


func _register_miss(target: Dictionary, was_early_or_wrong: bool) -> void:
	if bool(target.get("practice", false)):
		_show_judge("试着跟上!", Color(0.62, 0.72, 0.92))
		_on_player_miss(target, was_early_or_wrong)
		return
	miss_count += 1
	combo = 0
	_show_judge("MISS", Color(0.95, 0.32, 0.36))
	conductor.play_sfx(_sfx_miss, 1.0, -2.0)
	_on_player_miss(target, was_early_or_wrong)
	_update_combo_label()


func _update_combo_label() -> void:
	if combo >= 2:
		_combo_label.text = "%d COMBO" % combo
		_combo_label.visible = true
	else:
		_combo_label.visible = false


func _show_judge(text: String, color: Color) -> void:
	_judge_label.text = text
	_judge_label.modulate = color
	_judge_label.scale = Vector2(1.35, 1.35)
	_judge_label.visible = true
	if _judge_tween and _judge_tween.is_valid():
		_judge_tween.kill()
	_judge_tween = create_tween()
	_judge_tween.tween_property(_judge_label, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_judge_tween.tween_interval(0.28)
	_judge_tween.tween_property(_judge_label, "modulate:a", 0.0, 0.15)


func _finish_stage() -> void:
	stage_finished = true
	conductor.stop()

	var total := maxi(1, perfect_count + good_count + miss_count)
	var weighted := float(perfect_count) + float(good_count) * 0.65
	var accuracy := (weighted / float(total)) * 100.0
	var rank := GameState.compute_rank(accuracy)
	GameState.update_record(stage_id, rank, accuracy)

	_result_rank.text = rank
	if accuracy >= 85.0:
		_result_rank.modulate = Color(1.0, 0.85, 0.2)
	elif accuracy >= 60.0:
		_result_rank.modulate = Color(0.45, 0.92, 0.55)
	else:
		_result_rank.modulate = Color(0.95, 0.45, 0.45)

	_result_summary.text = "准确度: %.1f%%\nPERFECT: %d    GOOD: %d    MISS: %d\n最大连击: %d" % [
		accuracy, perfect_count, good_count, miss_count, max_combo
	]
	_result_panel.visible = true


func _retry_stage() -> void:
	get_tree().reload_current_scene()


func _go_back_to_menu() -> void:
	conductor.stop()
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")


func _build_hud() -> void:
	_hud_layer = CanvasLayer.new()
	add_child(_hud_layer)

	var top_bar := HBoxContainer.new()
	top_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top_bar.offset_left = 28
	top_bar.offset_top = 18
	top_bar.offset_right = -28
	top_bar.offset_bottom = 66
	top_bar.add_theme_constant_override("separation", 18)
	_hud_layer.add_child(top_bar)

	var title_lbl := Label.new()
	title_lbl.text = "%s  (%d BPM)" % [stage_title, int(stage_bpm)]
	title_lbl.add_theme_font_size_override("font_size", 24)
	top_bar.add_child(title_lbl)

	_progress_bar = ProgressBar.new()
	_progress_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_progress_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_progress_bar.custom_minimum_size = Vector2(200, 18)
	_progress_bar.show_percentage = false
	top_bar.add_child(_progress_bar)

	_combo_label = Label.new()
	_combo_label.add_theme_font_size_override("font_size", 24)
	_combo_label.modulate = Color(1.0, 0.88, 0.32)
	_combo_label.visible = false
	top_bar.add_child(_combo_label)

	var back_btn := Button.new()
	back_btn.text = "返回选关 (ESC)"
	back_btn.custom_minimum_size = Vector2(150, 40)
	back_btn.pressed.connect(_go_back_to_menu)
	top_bar.add_child(back_btn)

	var hint_lbl := Label.new()
	hint_lbl.text = "操作：Space / J / 鼠标左键"
	hint_lbl.add_theme_font_size_override("font_size", 18)
	hint_lbl.modulate = Color(1, 1, 1, 0.7)
	hint_lbl.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hint_lbl.offset_left = 28
	hint_lbl.offset_top = -42
	hint_lbl.offset_bottom = -16
	_hud_layer.add_child(hint_lbl)

	_judge_label = Label.new()
	_judge_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_judge_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_judge_label.add_theme_font_size_override("font_size", 42)
	_judge_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_judge_label.offset_left = -180
	_judge_label.offset_right = 180
	_judge_label.offset_top = 90
	_judge_label.offset_bottom = 155
	_judge_label.pivot_offset = Vector2(180, 32)
	_judge_label.visible = false
	_hud_layer.add_child(_judge_label)

	# Result Overlay
	_result_panel = PanelContainer.new()
	_result_panel.set_anchors_preset(Control.PRESET_CENTER)
	_result_panel.offset_left = -260
	_result_panel.offset_right = 260
	_result_panel.offset_top = -185
	_result_panel.offset_bottom = 185
	_result_panel.visible = false
	_hud_layer.add_child(_result_panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 24)
	_result_panel.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 16)
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	margin.add_child(vbox)

	var done_title := Label.new()
	done_title.text = "演出结束！"
	done_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	done_title.add_theme_font_size_override("font_size", 26)
	vbox.add_child(done_title)

	_result_rank = Label.new()
	_result_rank.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_rank.add_theme_font_size_override("font_size", 38)
	vbox.add_child(_result_rank)

	_result_summary = Label.new()
	_result_summary.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_summary.add_theme_font_size_override("font_size", 20)
	vbox.add_child(_result_summary)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 18)
	vbox.add_child(btn_row)

	var retry_btn := Button.new()
	retry_btn.text = "再玩一次"
	retry_btn.custom_minimum_size = Vector2(150, 46)
	retry_btn.pressed.connect(_retry_stage)
	btn_row.add_child(retry_btn)

	var menu_btn := Button.new()
	menu_btn.text = "返回选关"
	menu_btn.custom_minimum_size = Vector2(150, 46)
	menu_btn.pressed.connect(_go_back_to_menu)
	btn_row.add_child(menu_btn)
