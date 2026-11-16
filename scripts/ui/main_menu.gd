extends Control

var _offset_label: Label
var _sfx_click: AudioStreamWAV
var _sfx_player: AudioStreamPlayer


func _ready() -> void:
	_sfx_click = SoundSynth.make_tone(660.0, 0.08, "triangle", 0.3)
	_sfx_player = AudioStreamPlayer.new()
	add_child(_sfx_player)
	_build_ui()


func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.09, 0.10, 0.15)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var root_margin := MarginContainer.new()
	root_margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	root_margin.add_theme_constant_override("margin_left", 48)
	root_margin.add_theme_constant_override("margin_right", 48)
	root_margin.add_theme_constant_override("margin_top", 36)
	root_margin.add_theme_constant_override("margin_bottom", 32)
	add_child(root_margin)

	var main_vbox := VBoxContainer.new()
	main_vbox.add_theme_constant_override("separation", 24)
	root_margin.add_child(main_vbox)

	# Title Header
	var title_lbl := Label.new()
	title_lbl.text = "节奏天国 · 迷你合集"
	title_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_lbl.add_theme_font_size_override("font_size", 42)
	main_vbox.add_child(title_lbl)

	var sub_lbl := Label.new()
	sub_lbl.text = "听音辨拍 · 操作方式：Space / J / 鼠标左键"
	sub_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub_lbl.add_theme_font_size_override("font_size", 20)
	sub_lbl.modulate = Color(0.82, 0.86, 0.96, 0.85)
	main_vbox.add_child(sub_lbl)

	# Stage Cards Row
	var cards_row := HBoxContainer.new()
	cards_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	cards_row.add_theme_constant_override("separation", 24)
	main_vbox.add_child(cards_row)

	for stage in GameState.STAGES:
		cards_row.add_child(_create_stage_card(stage))

	# Footer Calibration Bar
	var footer := HBoxContainer.new()
	footer.alignment = BoxContainer.ALIGNMENT_CENTER
	footer.add_theme_constant_override("separation", 16)
	main_vbox.add_child(footer)

	var cal_title := Label.new()
	cal_title.text = "音频延迟校准 (Offset):"
	cal_title.add_theme_font_size_override("font_size", 18)
	footer.add_child(cal_title)

	var slider := HSlider.new()
	slider.min_value = -100.0
	slider.max_value = 100.0
	slider.step = 5.0
	slider.value = GameState.audio_offset_ms
	slider.custom_minimum_size = Vector2(260, 24)
	slider.value_changed.connect(_on_offset_changed)
	footer.add_child(slider)

	_offset_label = Label.new()
	_offset_label.text = "%+d ms" % int(GameState.audio_offset_ms)
	_offset_label.custom_minimum_size = Vector2(85, 0)
	_offset_label.add_theme_font_size_override("font_size", 18)
	footer.add_child(_offset_label)


func _create_stage_card(stage: Dictionary) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.14, 0.16, 0.23)
	style.border_color = stage["accent"]
	style.set_border_width_all(3)
	style.set_corner_radius_all(14)
	style.set_content_margin_all(22)
	panel.add_theme_stylebox_override("panel", style)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 14)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = stage["title"]
	title.add_theme_font_size_override("font_size", 28)
	title.modulate = stage["accent"]
	vbox.add_child(title)

	var meta := Label.new()
	meta.text = "%s  •  %d BPM" % [stage["subtitle"], int(stage["bpm"])]
	meta.add_theme_font_size_override("font_size", 16)
	meta.modulate = Color(0.75, 0.80, 0.90)
	vbox.add_child(meta)

	var desc := Label.new()
	desc.text = stage["description"]
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	desc.add_theme_font_size_override("font_size", 18)
	vbox.add_child(desc)

	var sid: String = stage["id"]
	var rec_lbl := Label.new()
	if GameState.best_records.has(sid):
		var rec: Dictionary = GameState.best_records[sid]
		rec_lbl.text = "最佳成绩: %s (%.1f%%)" % [rec["rank"], float(rec["accuracy"])]
		rec_lbl.modulate = Color(1.0, 0.86, 0.30)
	else:
		rec_lbl.text = "最佳成绩: 尚未挑战"
		rec_lbl.modulate = Color(0.62, 0.66, 0.74)
	rec_lbl.add_theme_font_size_override("font_size", 17)
	vbox.add_child(rec_lbl)

	var play_btn := Button.new()
	play_btn.text = "开始演出 ▶"
	play_btn.custom_minimum_size = Vector2(0, 50)
	play_btn.add_theme_font_size_override("font_size", 20)
	var scene_path: String = stage["scene_path"]
	play_btn.pressed.connect(func() -> void:
		_sfx_player.stream = _sfx_click
		_sfx_player.play()
		get_tree().change_scene_to_file(scene_path)
	)
	vbox.add_child(play_btn)

	return panel


func _on_offset_changed(val: float) -> void:
	GameState.audio_offset_ms = val
	_offset_label.text = "%+d ms" % int(val)
	GameState.save_data()
