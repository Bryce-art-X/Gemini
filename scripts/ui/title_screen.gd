extends Control

var _bgm_player: AudioStreamPlayer
var _sfx_player: AudioStreamPlayer
var _sfx_cue: AudioStreamWAV
var _sfx_tap: AudioStreamWAV

var _master_spr: Sprite2D
var _player_spr: Sprite2D
var _title_box: VBoxContainer
var _beat_pulse: float = 0.0
var _last_beat: int = -1
var _clock: float = 0.0
var _is_headless: bool = false

# Calibration modal
var _cal_overlay: ColorRect
var _cal_btn: Button
var _cal_status: Label
var _cal_slider: HSlider
var _cal_samples: Array[float] = []
var _cal_active: bool = false
var _cal_clock: float = 0.0
var _cal_last_beat: int = -1


func _ready() -> void:
	_is_headless = DisplayServer.get_name() == "headless"
	theme = UITheme.make_theme()
	_sfx_cue = load("res://assets/audio/cue_hit_2.wav")
	_sfx_tap = load("res://assets/audio/sfx_hit_ace.wav")

	_bgm_player = AudioStreamPlayer.new()
	var title_stream: AudioStream = load("res://assets/audio/bgm_title.ogg")
	if title_stream is AudioStreamOggVorbis:
		title_stream.loop = true
	_bgm_player.stream = title_stream
	_bgm_player.volume_db = -3.0
	add_child(_bgm_player)

	_sfx_player = AudioStreamPlayer.new()
	add_child(_sfx_player)

	_build_scene()
	if not _is_headless:
		_bgm_player.play()


func _build_scene() -> void:
	var stage_layer := Node2D.new()
	add_child(stage_layer)

	var bg := Sprite2D.new()
	bg.texture = load("res://assets/textures/forge_bg.png")
	bg.position = Vector2(640, 360)
	stage_layer.add_child(bg)

	var tint := ColorRect.new()
	tint.size = Vector2(1280, 720)
	tint.color = Color(0.06, 0.04, 0.05, 0.42)
	tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stage_layer.add_child(tint)

	var left_stump := Sprite2D.new()
	left_stump.texture = load("res://assets/textures/stump.png")
	left_stump.position = Vector2(360, 620)
	stage_layer.add_child(left_stump)

	var left_anvil := Sprite2D.new()
	left_anvil.texture = load("res://assets/textures/anvil.png")
	left_anvil.position = Vector2(360, 530)
	stage_layer.add_child(left_anvil)

	var right_stump := Sprite2D.new()
	right_stump.texture = load("res://assets/textures/stump.png")
	right_stump.position = Vector2(920, 620)
	stage_layer.add_child(right_stump)

	var right_anvil := Sprite2D.new()
	right_anvil.texture = load("res://assets/textures/anvil.png")
	right_anvil.position = Vector2(920, 530)
	right_anvil.flip_h = true
	stage_layer.add_child(right_anvil)

	_master_spr = Sprite2D.new()
	_master_spr.texture = load("res://assets/textures/master_windup.png")
	_master_spr.offset = Vector2(0, -172)
	_master_spr.position = Vector2(190, 650)
	stage_layer.add_child(_master_spr)

	_player_spr = Sprite2D.new()
	_player_spr.texture = load("res://assets/textures/player_ready.png")
	_player_spr.offset = Vector2(0, -162)
	_player_spr.position = Vector2(1090, 650)
	stage_layer.add_child(_player_spr)

	# Foreground UI
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(620, 0)
	UITheme.style_card(card, Color(0.14, 0.13, 0.20, 0.94), Color(1.0, 0.80, 0.26))
	center.add_child(card)

	_title_box = VBoxContainer.new()
	_title_box.add_theme_constant_override("separation", 14)
	_title_box.alignment = BoxContainer.ALIGNMENT_CENTER
	card.add_child(_title_box)

	var badge := Label.new()
	badge.text = "RHYTHM FORGE • 120 BPM"
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.add_theme_font_size_override("font_size", 16)
	badge.modulate = Color(1.0, 0.82, 0.34)
	_title_box.add_child(badge)

	var title := Label.new()
	title.text = "铁匠传球！"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 56)
	title.add_theme_color_override("font_outline_color", Color(0.06, 0.06, 0.09))
	title.add_theme_constant_override("outline_size", 10)
	_title_box.add_child(title)

	var sub := Label.new()
	sub.text = "FORGE PASS!  —  看飞铁弧线 · 听木鱼风箱 · 一锤定音"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_size_override("font_size", 18)
	sub.modulate = Color(0.88, 0.92, 1.0)
	_title_box.add_child(sub)

	var rec_lbl := Label.new()
	rec_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rec_lbl.add_theme_font_size_override("font_size", 18)
	if GameState.best_rank != "":
		var medal := "  ★完美奖章" if GameState.has_perfect_medal else ""
		rec_lbl.text = "最佳评价：%s (%.1f%% · %d连击)%s" % [GameState.best_rank, GameState.best_accuracy, GameState.best_combo, medal]
		rec_lbl.modulate = Color(1.0, 0.88, 0.35)
	else:
		rec_lbl.text = "操作：Space / J / 鼠标左键"
		rec_lbl.modulate = Color(0.75, 0.80, 0.92)
	_title_box.add_child(rec_lbl)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 18)
	_title_box.add_child(btn_row)

	var play_btn := Button.new()
	play_btn.text = "开始锻造 ▶"
	play_btn.custom_minimum_size = Vector2(240, 60)
	play_btn.add_theme_font_size_override("font_size", 24)
	UITheme.style_button(play_btn, Color(1.0, 0.80, 0.24))
	play_btn.pressed.connect(_start_game)
	btn_row.add_child(play_btn)

	_cal_btn = Button.new()
	_cal_btn.text = "延迟校准 (%+d ms)" % int(GameState.audio_offset_ms)
	_cal_btn.custom_minimum_size = Vector2(210, 60)
	_cal_btn.add_theme_font_size_override("font_size", 18)
	UITheme.style_button(_cal_btn, Color(0.36, 0.78, 0.98))
	_cal_btn.pressed.connect(_open_calibration)
	btn_row.add_child(_cal_btn)

	_build_calibration_modal()


func _build_calibration_modal() -> void:
	_cal_overlay = ColorRect.new()
	_cal_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cal_overlay.color = Color(0.05, 0.05, 0.09, 0.84)
	_cal_overlay.visible = false
	add_child(_cal_overlay)

	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cal_overlay.add_child(cc)

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(540, 0)
	UITheme.style_card(panel, Color(0.15, 0.16, 0.24), Color(0.36, 0.78, 0.98))
	cc.add_child(panel)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 16)
	panel.add_child(vb)

	var h := Label.new()
	h.text = "音频延迟校准 (Tap-to-Calibrate)"
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	h.add_theme_font_size_override("font_size", 24)
	vb.add_child(h)

	_cal_status = Label.new()
	_cal_status.text = "跟着稳恒鼓点按 Space 或点击下方按钮 4 次\n当前偏移：%+d ms" % int(GameState.audio_offset_ms)
	_cal_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_cal_status.add_theme_font_size_override("font_size", 18)
	vb.add_child(_cal_status)

	var tap_test_btn := Button.new()
	tap_test_btn.text = "跟着节拍点我！(Space)"
	tap_test_btn.custom_minimum_size = Vector2(0, 62)
	tap_test_btn.add_theme_font_size_override("font_size", 22)
	UITheme.style_button(tap_test_btn, Color(1.0, 0.80, 0.24))
	tap_test_btn.pressed.connect(_record_cal_tap)
	vb.add_child(tap_test_btn)

	_cal_slider = HSlider.new()
	_cal_slider.min_value = -120.0
	_cal_slider.max_value = 120.0
	_cal_slider.step = 5.0
	_cal_slider.value = GameState.audio_offset_ms
	_cal_slider.value_changed.connect(func(v: float) -> void:
		GameState.audio_offset_ms = v
		GameState.save_data()
		_update_cal_labels()
	)
	vb.add_child(_cal_slider)

	var close_btn := Button.new()
	close_btn.text = "完成并返回"
	close_btn.custom_minimum_size = Vector2(0, 48)
	UITheme.style_button(close_btn, Color(0.55, 0.92, 0.56))
	close_btn.pressed.connect(_close_calibration)
	vb.add_child(close_btn)


func _open_calibration() -> void:
	_cal_samples.clear()
	_cal_active = true
	_cal_clock = 0.0
	_cal_last_beat = -1
	_bgm_player.stop()
	_cal_overlay.visible = true
	_update_cal_labels()


func _close_calibration() -> void:
	_cal_active = false
	_cal_overlay.visible = false
	if not _is_headless:
		_bgm_player.play()


func _record_cal_tap() -> void:
	if not _cal_active:
		return
	var beat_pos := _cal_clock / 0.5
	var nearest := roundf(beat_pos)
	var err_ms := (_cal_clock - nearest * 0.5) * 1000.0
	_cal_samples.append(clampf(err_ms, -120.0, 120.0))
	if not _is_headless:
		_sfx_player.stream = _sfx_tap
		_sfx_player.play()
	if _cal_samples.size() >= 4:
		var sum := 0.0
		for s in _cal_samples:
			sum += s
		var avg := roundf((sum / float(_cal_samples.size())) / 5.0) * 5.0
		GameState.audio_offset_ms = clampf(avg, -120.0, 120.0)
		GameState.save_data()
		_cal_slider.value = GameState.audio_offset_ms
		_cal_samples.clear()
	_update_cal_labels()


func _update_cal_labels() -> void:
	_cal_btn.text = "延迟校准 (%+d ms)" % int(GameState.audio_offset_ms)
	_cal_status.text = "跟着木鱼拍点按 Space 或点击按钮 (%d/4 次)\n当前偏移：%+d ms" % [_cal_samples.size(), int(GameState.audio_offset_ms)]


func _start_game() -> void:
	_bgm_player.stop()
	get_tree().change_scene_to_file("res://scenes/stage_forge_pass.tscn")


func _unhandled_input(event: InputEvent) -> void:
	if _cal_active:
		if event.is_action_pressed("rhythm_hit") and event is InputEventKey:
			_record_cal_tap()
		elif event.is_action_pressed("ui_cancel"):
			_close_calibration()
		return
	if event.is_action_pressed("ui_accept"):
		_start_game()


func _process(delta: float) -> void:
	if _cal_active:
		_cal_clock += delta
		var cb := int(floorf(_cal_clock / 0.5))
		if cb > _cal_last_beat:
			_cal_last_beat = cb
			_beat_pulse = 1.0
			if not _is_headless:
				_sfx_player.stream = _sfx_cue
				_sfx_player.play()
	else:
		_clock += delta
		var b := int(floorf(_clock / 0.5))
		if b > _last_beat:
			_last_beat = b
			_beat_pulse = 1.0

	_beat_pulse = maxf(0.0, _beat_pulse - delta * 5.5)
	var sx := 1.0 + _beat_pulse * 0.06
	var sy := 1.0 - _beat_pulse * 0.06
	_master_spr.scale = Vector2(sx, sy)
	_player_spr.scale = Vector2(sx, sy)
