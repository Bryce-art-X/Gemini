extends Node2D

const PERFECT_WIN := 0.052
const GOOD_WIN := 0.110
const MISS_WIN := 0.135

const LEFT_ANVIL_POS := Vector2(375, 534)
const RIGHT_ANVIL_POS := Vector2(905, 534)
const SPAWN_POS := Vector2(375, 470)
const LAND_POS := Vector2(905, 470)

var _conductor: RhythmConductor
var _cues: Array = []
var _targets: Array = []
var _total_beats: float = 144.0
var _bpm: float = 120.0

# Preloaded Audio
var _cue_hits: Array[AudioStream] = []
var _cue_lob: AudioStream
var _sfx_ace: AudioStream
var _sfx_heavy: AudioStream
var _sfx_barely: AudioStream
var _sfx_miss: AudioStream
var _sfx_power_off: AudioStream
var _sfx_power_on: AudioStream
var _sfx_sword_fly: AudioStream
var _chords: Array[AudioStream] = []

# Preloaded Textures
var _tex_master_windup: Texture2D
var _tex_master_strike: Texture2D
var _tex_master_windup_sil: Texture2D
var _tex_master_strike_sil: Texture2D
var _tex_player_ready: Texture2D
var _tex_player_ready_sil: Texture2D
var _tex_ingot_normal: Texture2D
var _tex_ingot_heavy: Texture2D
var _tex_sword: Texture2D

# Scene Nodes
var _camera: Camera2D
var _furnace_glow: ColorRect
var _blackout_rect: ColorRect
var _left_stump: Sprite2D
var _left_anvil: Sprite2D
var _right_stump: Sprite2D
var _right_anvil: Sprite2D
var _anvil_shader: ShaderMaterial
var _master_spr: Sprite2D
var _player_spr: Sprite2D
var _master_smear: Sprite2D
var _player_smear: Sprite2D
var _props_layer: Node2D
var _sparks: CPUParticles2D
var _mood_bubble: PanelContainer
var _mood_label: Label

# HUD & Result
var _hud_layer: CanvasLayer
var _progress_bar: ProgressBar
var _combo_label: Label
var _practice_pill: PanelContainer
var _practice_label: Label
var _judge_label: Label
var _judge_tween: Tween
var _result_overlay: ColorRect
var _result_rank: Label
var _result_headline: Label
var _result_stats: Label

# Runtime State
var _beat_pulse: float = 0.0
var _hitstop_timer: float = 0.0
var _shake_trauma: float = 0.0
var _anvil_flash: float = 0.0
var _master_strike_timer: float = 0.0
var _master_windup_timer: float = 0.0
var _player_strike_timer: float = 0.0
var _mood_timer: float = 0.0
var _is_blackout: bool = false
var _blackout_alpha: float = 0.0

var _perfect_count: int = 0
var _good_count: int = 0
var _miss_count: int = 0
var _combo: int = 0
var _max_combo: int = 0
var _swords_forged: int = 0
var _stage_finished: bool = false

var _flying_ingots: Array[Dictionary] = []
var _flying_swords: Array[Dictionary] = []
var _scrap_ingots: Array[Dictionary] = []


func _ready() -> void:
	_load_assets()
	_load_chart()
	_build_stage_visuals()
	_build_hud()

	_conductor = RhythmConductor.new()
	add_child(_conductor)
	_conductor.beat_hit.connect(_on_beat_hit)
	_conductor.setup(_bpm, load("res://assets/audio/bgm_main.ogg"))
	_conductor.start()


func _load_assets() -> void:
	_cue_hits = [
		load("res://assets/audio/cue_hit_1.wav"),
		load("res://assets/audio/cue_hit_2.wav"),
		load("res://assets/audio/cue_hit_3.wav"),
	]
	_cue_lob = load("res://assets/audio/cue_lob.wav")
	_sfx_ace = load("res://assets/audio/sfx_hit_ace.wav")
	_sfx_heavy = load("res://assets/audio/sfx_hit_heavy.wav")
	_sfx_barely = load("res://assets/audio/sfx_hit_barely.wav")
	_sfx_miss = load("res://assets/audio/sfx_miss.wav")
	_sfx_power_off = load("res://assets/audio/sfx_power_off.wav")
	_sfx_power_on = load("res://assets/audio/sfx_power_on.wav")
	_sfx_sword_fly = load("res://assets/audio/sfx_sword_fly.wav")
	for i in range(8):
		_chords.append(load("res://assets/audio/chord_%d.wav" % i))

	_tex_master_windup = load("res://assets/textures/master_windup.png")
	_tex_master_strike = load("res://assets/textures/master_strike.png")
	_tex_master_windup_sil = load("res://assets/textures/master_windup_sil.png")
	_tex_master_strike_sil = load("res://assets/textures/master_strike_sil.png")
	_tex_player_ready = load("res://assets/textures/player_ready.png")
	_tex_player_ready_sil = load("res://assets/textures/player_ready_sil.png")
	_tex_ingot_normal = load("res://assets/textures/ingot_normal.png")
	_tex_ingot_heavy = load("res://assets/textures/ingot_heavy.png")
	_tex_sword = load("res://assets/textures/sword.png")


func _load_chart() -> void:
	var raw := FileAccess.get_file_as_string("res://assets/data/forge_pass_chart.json")
	var parsed: Dictionary = JSON.parse_string(raw)
	_bpm = float(parsed.get("bpm", 120.0))
	_total_beats = float(parsed.get("total_beats", 144.0))
	_cues = parsed.get("cues", [])
	_targets = parsed.get("targets", [])
	for c in _cues:
		c["triggered"] = false
	for t in _targets:
		t["judged"] = false


func _build_stage_visuals() -> void:
	_camera = Camera2D.new()
	_camera.position = Vector2(640, 360)
	add_child(_camera)

	var bg := Sprite2D.new()
	bg.texture = load("res://assets/textures/forge_bg.png")
	bg.position = Vector2(640, 360)
	add_child(bg)

	_furnace_glow = ColorRect.new()
	_furnace_glow.size = Vector2(1280, 720)
	_furnace_glow.color = Color(1.0, 0.52, 0.14, 0.0)
	_furnace_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_furnace_glow)

	_blackout_rect = ColorRect.new()
	_blackout_rect.size = Vector2(1280, 720)
	_blackout_rect.color = Color(0.03, 0.03, 0.06, 0.0)
	_blackout_rect.z_index = 2
	_blackout_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_blackout_rect)

	var stump_tex: Texture2D = load("res://assets/textures/stump.png")
	var anvil_tex: Texture2D = load("res://assets/textures/anvil.png")

	_left_stump = Sprite2D.new()
	_left_stump.texture = stump_tex
	_left_stump.position = LEFT_ANVIL_POS + Vector2(0, 88)
	_left_stump.z_index = 3
	add_child(_left_stump)

	_left_anvil = Sprite2D.new()
	_left_anvil.texture = anvil_tex
	_left_anvil.position = LEFT_ANVIL_POS
	_left_anvil.z_index = 3
	add_child(_left_anvil)

	_right_stump = Sprite2D.new()
	_right_stump.texture = stump_tex
	_right_stump.position = RIGHT_ANVIL_POS + Vector2(0, 88)
	_right_stump.z_index = 3
	add_child(_right_stump)

	_anvil_shader = ShaderMaterial.new()
	_anvil_shader.shader = load("res://assets/shaders/hit_flash.gdshader")
	_right_anvil = Sprite2D.new()
	_right_anvil.texture = anvil_tex
	_right_anvil.flip_h = true
	_right_anvil.position = RIGHT_ANVIL_POS
	_right_anvil.material = _anvil_shader
	_right_anvil.z_index = 3
	add_child(_right_anvil)

	_master_spr = Sprite2D.new()
	_master_spr.texture = _tex_master_windup
	_master_spr.offset = Vector2(0, -172)
	_master_spr.position = Vector2(185, 650)
	_master_spr.z_index = 4
	add_child(_master_spr)

	_player_spr = Sprite2D.new()
	_player_spr.texture = _tex_player_ready
	_player_spr.offset = Vector2(0, -162)
	_player_spr.position = Vector2(1095, 650)
	_player_spr.z_index = 4
	add_child(_player_spr)

	var smear_tex: Texture2D = load("res://assets/textures/smear_arc.png")
	_master_smear = Sprite2D.new()
	_master_smear.texture = smear_tex
	_master_smear.position = LEFT_ANVIL_POS + Vector2(-20, -60)
	_master_smear.modulate.a = 0.0
	_master_smear.z_index = 5
	add_child(_master_smear)

	_player_smear = Sprite2D.new()
	_player_smear.texture = smear_tex
	_player_smear.flip_h = true
	_player_smear.position = RIGHT_ANVIL_POS + Vector2(20, -60)
	_player_smear.modulate.a = 0.0
	_player_smear.z_index = 5
	add_child(_player_smear)

	_props_layer = Node2D.new()
	_props_layer.z_index = 5
	_props_layer.draw.connect(_draw_props)
	add_child(_props_layer)

	_sparks = CPUParticles2D.new()
	_sparks.texture = load("res://assets/textures/spark.png")
	_sparks.position = LAND_POS
	_sparks.z_index = 6
	_sparks.emitting = false
	_sparks.one_shot = true
	_sparks.explosiveness = 0.94
	_sparks.amount = 18
	_sparks.lifetime = 0.45
	_sparks.direction = Vector2(0, -1)
	_sparks.spread = 85.0
	_sparks.initial_velocity_min = 200.0
	_sparks.initial_velocity_max = 460.0
	_sparks.gravity = Vector2(0, 780.0)
	_sparks.scale_amount_min = 0.45
	_sparks.scale_amount_max = 1.0
	add_child(_sparks)


func _build_hud() -> void:
	_hud_layer = CanvasLayer.new()
	add_child(_hud_layer)

	var ui_root := Control.new()
	ui_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_root.theme = UITheme.make_theme()
	_hud_layer.add_child(ui_root)

	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 24
	top.offset_top = 16
	top.offset_right = -24
	top.offset_bottom = 64
	top.add_theme_constant_override("separation", 16)
	ui_root.add_child(top)

	_practice_pill = PanelContainer.new()
	UITheme.style_card(_practice_pill, Color(0.20, 0.62, 0.96, 0.92), Color(0.067, 0.067, 0.086))
	var pm := _practice_pill.get_theme_stylebox("panel").duplicate()
	pm.set_content_margin_all(8)
	pm.set_corner_radius_all(12)
	_practice_pill.add_theme_stylebox_override("panel", pm)
	_practice_label = Label.new()
	_practice_label.text = "热身练习 (不计分)"
	_practice_label.add_theme_font_size_override("font_size", 16)
	_practice_pill.add_child(_practice_label)
	top.add_child(_practice_pill)

	_progress_bar = ProgressBar.new()
	_progress_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_progress_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_progress_bar.custom_minimum_size = Vector2(240, 16)
	_progress_bar.show_percentage = false
	top.add_child(_progress_bar)

	_combo_label = Label.new()
	_combo_label.add_theme_font_size_override("font_size", 24)
	_combo_label.add_theme_color_override("font_outline_color", Color(0.06, 0.06, 0.09))
	_combo_label.add_theme_constant_override("outline_size", 6)
	_combo_label.modulate = Color(1.0, 0.88, 0.30)
	_combo_label.visible = false
	top.add_child(_combo_label)

	var back_btn := Button.new()
	back_btn.text = "返回封面 (ESC)"
	back_btn.custom_minimum_size = Vector2(150, 42)
	back_btn.add_theme_font_size_override("font_size", 16)
	UITheme.style_button(back_btn, Color(0.92, 0.93, 0.98))
	back_btn.pressed.connect(_go_title)
	top.add_child(back_btn)

	# Master comic reaction bubble
	_mood_bubble = PanelContainer.new()
	_mood_bubble.position = Vector2(215, 225)
	_mood_bubble.visible = false
	UITheme.style_card(_mood_bubble, Color(1.0, 0.88, 0.28))
	var mb_sb := _mood_bubble.get_theme_stylebox("panel").duplicate()
	mb_sb.set_content_margin_all(8)
	_mood_bubble.add_theme_stylebox_override("panel", mb_sb)
	_mood_label = Label.new()
	_mood_label.add_theme_font_size_override("font_size", 20)
	_mood_label.modulate = Color(0.07, 0.07, 0.1)
	_mood_bubble.add_child(_mood_label)
	ui_root.add_child(_mood_bubble)

	_judge_label = Label.new()
	_judge_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_judge_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_judge_label.add_theme_font_size_override("font_size", 42)
	_judge_label.add_theme_color_override("font_outline_color", Color(0.06, 0.06, 0.09))
	_judge_label.add_theme_constant_override("outline_size", 8)
	_judge_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_judge_label.offset_left = -200
	_judge_label.offset_right = 200
	_judge_label.offset_top = 86
	_judge_label.offset_bottom = 152
	_judge_label.pivot_offset = Vector2(200, 32)
	_judge_label.visible = false
	ui_root.add_child(_judge_label)

	# Newspaper Result Screen
	_result_overlay = ColorRect.new()
	_result_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_result_overlay.color = Color(0.05, 0.05, 0.09, 0.82)
	_result_overlay.visible = false
	ui_root.add_child(_result_overlay)

	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	_result_overlay.add_child(cc)

	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(580, 0)
	UITheme.style_card(card, Color(0.98, 0.95, 0.88))
	cc.add_child(card)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	card.add_child(vb)

	var paper_hdr := Label.new()
	paper_hdr.text = "— 铁匠铺周刊 · 演出日报 —"
	paper_hdr.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	paper_hdr.add_theme_font_size_override("font_size", 18)
	paper_hdr.modulate = Color(0.32, 0.25, 0.20)
	vb.add_child(paper_hdr)

	_result_rank = Label.new()
	_result_rank.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_rank.add_theme_font_size_override("font_size", 42)
	_result_rank.add_theme_color_override("font_outline_color", Color(0.07, 0.07, 0.09))
	_result_rank.add_theme_constant_override("outline_size", 6)
	vb.add_child(_result_rank)

	_result_headline = Label.new()
	_result_headline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_headline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_result_headline.add_theme_font_size_override("font_size", 20)
	_result_headline.modulate = Color(0.14, 0.12, 0.14)
	vb.add_child(_result_headline)

	_result_stats = Label.new()
	_result_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_stats.add_theme_font_size_override("font_size", 19)
	_result_stats.modulate = Color(0.22, 0.20, 0.24)
	vb.add_child(_result_stats)

	var btn_row := HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 18)
	vb.add_child(btn_row)

	var retry_btn := Button.new()
	retry_btn.text = "再锻一次"
	retry_btn.custom_minimum_size = Vector2(180, 54)
	UITheme.style_button(retry_btn, Color(1.0, 0.80, 0.24))
	retry_btn.pressed.connect(func() -> void: get_tree().reload_current_scene())
	btn_row.add_child(retry_btn)

	var title_btn := Button.new()
	title_btn.text = "返回封面"
	title_btn.custom_minimum_size = Vector2(180, 54)
	UITheme.style_button(title_btn, Color(0.36, 0.78, 0.98))
	title_btn.pressed.connect(_go_title)
	btn_row.add_child(title_btn)


func _on_beat_hit(_beat_idx: int) -> void:
	_beat_pulse = 1.0


func _process(delta: float) -> void:
	if _hitstop_timer > 0.0:
		_hitstop_timer -= delta
		return

	if _stage_finished:
		return

	_beat_pulse = maxf(0.0, _beat_pulse - delta * 5.2)
	var cur_beat := _conductor.current_beat
	_progress_bar.value = clampf(cur_beat / maxf(1.0, _total_beats) * 100.0, 0.0, 100.0)

	# Trigger cues
	for c in _cues:
		if not c["triggered"] and cur_beat >= float(c["beat"]):
			c["triggered"] = true
			_handle_cue(c)

	# Auto-miss targets past MISS_WIN
	var cur_sec := cur_beat * _conductor.beat_duration
	for t in _targets:
		if not t["judged"]:
			var target_sec := float(t["beat"]) * _conductor.beat_duration
			if cur_sec - target_sec > MISS_WIN:
				t["judged"] = true
				_register_miss(t)

	_update_visuals(delta, cur_beat)

	if cur_beat >= _total_beats:
		_finish_stage()

	_props_layer.queue_redraw()


func _handle_cue(c: Dictionary) -> void:
	var kind: String = c["kind"]
	if kind == "count_in":
		_conductor.play_cue(_cue_hits[0], 0.10)
	elif kind == "pass_normal":
		_master_strike_timer = 0.16
		_master_smear.modulate.a = 1.0
		_conductor.play_cue(_cue_hits[1], 0.14)
		_spawn_flying_ingot(c, "normal")
	elif kind == "pass_triple":
		var step := clampi(int(c.get("step", 1)) - 1, 0, 2)
		_master_strike_timer = 0.14
		_master_smear.modulate.a = 1.0
		_conductor.play_cue(_cue_hits[step], 0.12)
		_spawn_flying_ingot(c, "triple")
	elif kind == "pass_heavy":
		_master_windup_timer = 0.25
		_master_strike_timer = 0.18
		_master_smear.modulate.a = 1.0
		_conductor.play_cue(_cue_lob, 0.35)
		_spawn_flying_ingot(c, "heavy")
	elif kind == "practice_done":
		_practice_label.text = "正式演出!"
		var tw := create_tween()
		tw.tween_interval(1.2)
		tw.tween_property(_practice_pill, "modulate:a", 0.0, 0.35)
	elif kind == "blackout_on":
		_is_blackout = true
		_conductor.play_sfx(_sfx_power_off, &"Master", -2.0)
	elif kind == "blackout_off":
		_is_blackout = false
		_conductor.play_sfx(_sfx_power_on, &"Master", -2.0)


func _spawn_flying_ingot(cue: Dictionary, kind: String) -> void:
	_flying_ingots.append({
		"spawn_beat": float(cue["beat"]),
		"hit_beat": float(cue["hit_beat"]),
		"kind": kind,
		"blind": bool(cue.get("blind", false)),
		"resolved": false,
	})


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_go_title()
		return
	if _stage_finished:
		return
	if event.is_action_pressed("rhythm_hit"):
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			if event.position.y < 76.0 and event.position.x > 1080.0:
				return
		_handle_tap()


func _handle_tap() -> void:
	var cur_sec := _conductor.current_beat * _conductor.beat_duration
	var best_t: Dictionary = {}
	var best_abs := 999.0

	for t in _targets:
		if t["judged"]:
			continue
		var abs_err := absf(cur_sec - float(t["beat"]) * _conductor.beat_duration)
		if abs_err <= MISS_WIN and abs_err < best_abs:
			best_abs = abs_err
			best_t = t

	_player_strike_timer = 0.16
	_player_smear.modulate.a = 1.0

	if best_t.is_empty():
		_conductor.play_foley(_sfx_barely, -12.0, false)
		return

	best_t["judged"] = true
	var is_practice := bool(best_t.get("practice", false))
	var heavy := str(best_t.get("kind", "")) == "heavy"

	# Resolve matching flying ingot
	for fi in _flying_ingots:
		if not fi["resolved"] and absf(float(fi["hit_beat"]) - float(best_t["beat"])) < 0.08:
			fi["resolved"] = true
			break

	if best_abs <= PERFECT_WIN:
		if not is_practice:
			_perfect_count += 1
			_combo += 1
			_max_combo = maxi(_max_combo, _combo)
			_update_combo()
		_show_judge("很好! (练习)" if is_practice else "ACE!", Color(1.0, 0.86, 0.22))
		_conductor.play_foley(_sfx_heavy if heavy else _sfx_ace, 0.0, true)
		var c_idx := clampi(int(best_t.get("chord_idx", 0)), 0, _chords.size() - 1)
		_conductor.play_quantized_chord(_chords[c_idx], -3.0)

		_hitstop_timer = 0.045
		_shake_trauma = 0.85 if heavy else 0.55
		_anvil_flash = 1.0
		_sparks.restart()
		_show_mood("👍 超赞!", Color(1.0, 0.88, 0.28))

		if bool(best_t.get("finish_sword", false)):
			if not is_practice:
				_swords_forged += 1
			_conductor.play_foley(_sfx_sword_fly, -4.0, false)
			_flying_swords.append({
				"pos": LAND_POS + Vector2(0, -16),
				"vel": Vector2(260, -450),
				"rot": -0.25,
				"scale": 1.35 if heavy else 1.0,
				"life": 1.1,
			})
	elif best_abs <= GOOD_WIN:
		if not is_practice:
			_good_count += 1
			_combo += 1
			_max_combo = maxi(_max_combo, _combo)
			_update_combo()
		_show_judge("不错 (练习)" if is_practice else "BARELY", Color(0.62, 0.92, 0.42))
		_conductor.play_foley(_sfx_barely, -2.0, false)
		_shake_trauma = 0.25
		_show_mood("❓ 差点!", Color(1.0, 0.72, 0.30))
		_scrap_ingots.append({
			"pos": LAND_POS,
			"vel": Vector2(120, -180),
			"rot": 0.0,
			"spin": 8.0,
			"flat": true,
			"life": 0.8,
		})
	else:
		_register_miss(best_t)


func _register_miss(t: Dictionary) -> void:
	for fi in _flying_ingots:
		if not fi["resolved"] and absf(float(fi["hit_beat"]) - float(t["beat"])) < 0.08:
			fi["resolved"] = true
			break
	if bool(t.get("practice", false)):
		_show_judge("试着跟上!", Color(0.62, 0.74, 0.94))
		return
	_miss_count += 1
	_combo = 0
	_update_combo()
	_show_judge("MISS", Color(0.96, 0.32, 0.36))
	_conductor.play_foley(_sfx_miss, -2.0, false)
	_show_mood("😒 喂...!", Color(1.0, 0.38, 0.42))
	_scrap_ingots.append({
		"pos": LAND_POS,
		"vel": Vector2(70, 60),
		"rot": 0.2,
		"spin": 4.0,
		"flat": false,
		"life": 0.75,
	})


func _show_mood(text: String, bg: Color) -> void:
	_mood_label.text = text
	var sb := _mood_bubble.get_theme_stylebox("panel").duplicate()
	sb.bg_color = bg
	_mood_bubble.add_theme_stylebox_override("panel", sb)
	_mood_bubble.visible = true
	_mood_timer = 0.75


func _update_combo() -> void:
	if _combo >= 2:
		_combo_label.text = "%d COMBO" % _combo
		_combo_label.visible = true
	else:
		_combo_label.visible = false


func _show_judge(text: String, color: Color) -> void:
	_judge_label.text = text
	_judge_label.modulate = color
	_judge_label.scale = Vector2(1.3, 1.3)
	_judge_label.visible = true
	if _judge_tween and _judge_tween.is_valid():
		_judge_tween.kill()
	_judge_tween = create_tween()
	_judge_tween.tween_property(_judge_label, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_judge_tween.tween_interval(0.25)
	_judge_tween.tween_property(_judge_label, "modulate:a", 0.0, 0.14)


func _update_visuals(delta: float, cur_beat: float) -> void:
	_furnace_glow.color.a = _beat_pulse * 0.12
	_blackout_alpha = lerpf(_blackout_alpha, 0.94 if _is_blackout else 0.0, minf(1.0, delta * 9.0))
	_blackout_rect.color.a = _blackout_alpha

	var sil := _blackout_alpha > 0.5
	_master_strike_timer = maxf(0.0, _master_strike_timer - delta)
	_master_windup_timer = maxf(0.0, _master_windup_timer - delta)
	_player_strike_timer = maxf(0.0, _player_strike_timer - delta)
	_master_smear.modulate.a = maxf(0.0, _master_smear.modulate.a - delta * 10.0)
	_player_smear.modulate.a = maxf(0.0, _player_smear.modulate.a - delta * 10.0)

	if _mood_timer > 0.0:
		_mood_timer -= delta
		if _mood_timer <= 0.0:
			_mood_bubble.visible = false

	# Beat Bop Squash & Stretch + Strike Kinematics
	var bop_x := 1.0 + _beat_pulse * 0.06
	var bop_y := 1.0 - _beat_pulse * 0.06
	_left_anvil.scale = Vector2(bop_x, bop_y)
	_right_anvil.scale = Vector2(bop_x, bop_y)
	_left_stump.scale = Vector2(bop_x, bop_y)
	_right_stump.scale = Vector2(bop_x, bop_y)

	if _master_strike_timer > 0.0:
		_master_spr.texture = _tex_master_strike_sil if sil else _tex_master_strike
		_master_spr.scale = Vector2(1.08, 0.92)
		_master_spr.rotation_degrees = 3.0
	else:
		_master_spr.texture = _tex_master_windup_sil if sil else _tex_master_windup
		_master_spr.scale = Vector2(bop_x, bop_y)
		_master_spr.rotation_degrees = -6.0 if _master_windup_timer > 0.0 else 0.0

	_player_spr.texture = _tex_player_ready_sil if sil else _tex_player_ready
	if _player_strike_timer > 0.0:
		var p := _player_strike_timer / 0.16
		_player_spr.rotation_degrees = lerpf(0.0, -18.0, p)
		_player_spr.scale = Vector2(1.16, 0.86)
	else:
		_player_spr.rotation_degrees = 0.0
		_player_spr.scale = Vector2(bop_x, bop_y)

	_anvil_flash = maxf(0.0, _anvil_flash - delta * 8.0)
	_anvil_shader.set_shader_parameter("flash_amount", _anvil_flash)

	_shake_trauma = maxf(0.0, _shake_trauma - delta * 3.0)
	var sh := _shake_trauma * _shake_trauma * 15.0
	_camera.offset = Vector2(randf_range(-sh, sh), randf_range(-sh, sh))

	# Prune finished flying ingots
	for i in range(_flying_ingots.size() - 1, -1, -1):
		if _flying_ingots[i]["resolved"] or cur_beat - float(_flying_ingots[i]["hit_beat"]) > 0.2:
			_flying_ingots.remove_at(i)

	for i in range(_flying_swords.size() - 1, -1, -1):
		var sw := _flying_swords[i]
		sw["life"] -= delta
		sw["vel"].y += 780.0 * delta
		sw["pos"] += sw["vel"] * delta
		sw["rot"] += 5.2 * delta
		if sw["life"] <= 0.0:
			_flying_swords.remove_at(i)

	for i in range(_scrap_ingots.size() - 1, -1, -1):
		var sc := _scrap_ingots[i]
		sc["life"] -= delta
		sc["vel"].y += 820.0 * delta
		sc["pos"] += sc["vel"] * delta
		sc["rot"] += float(sc["spin"]) * delta
		if sc["life"] <= 0.0:
			_scrap_ingots.remove_at(i)


func _draw_props() -> void:
	var cur_beat := _conductor.current_beat
	for fi in _flying_ingots:
		if fi["resolved"] or fi["blind"]:
			continue
		var sb := float(fi["spawn_beat"])
		var hb := float(fi["hit_beat"])
		var t := clampf((cur_beat - sb) / maxf(0.05, hb - sb), 0.0, 1.15)
		var is_heavy := str(fi["kind"]) == "heavy"
		var arc_h := 285.0 if is_heavy else 170.0
		var pos := SPAWN_POS.lerp(LAND_POS, t)
		pos.y -= 4.0 * arc_h * t * (1.0 - t)
		var rot := t * TAU * (1.5 if is_heavy else 1.0)
		var tex: Texture2D = _tex_ingot_heavy if is_heavy else _tex_ingot_normal
		_props_layer.draw_set_transform(pos, rot, Vector2.ONE)
		_props_layer.draw_texture(tex, -tex.get_size() * 0.5)

	for sw in _flying_swords:
		_props_layer.draw_set_transform(sw["pos"], sw["rot"], Vector2(sw["scale"], sw["scale"]))
		_props_layer.draw_texture(_tex_sword, -_tex_sword.get_size() * 0.5)

	for sc in _scrap_ingots:
		var s_vec := Vector2(1.25, 0.45) if sc["flat"] else Vector2(0.85, 0.85)
		_props_layer.draw_set_transform(sc["pos"], sc["rot"], s_vec)
		_props_layer.draw_texture(_tex_ingot_normal, -_tex_ingot_normal.get_size() * 0.5, Color(0.7, 0.6, 0.65, clampf(sc["life"] * 2.0, 0.0, 1.0)))

	_props_layer.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _finish_stage() -> void:
	_stage_finished = true
	_conductor.stop()

	var total := maxi(1, _perfect_count + _good_count + _miss_count)
	var acc := ((float(_perfect_count) + float(_good_count) * 0.65) / float(total)) * 100.0
	var rank := GameState.update_record(acc, _max_combo, _miss_count)

	_result_rank.text = rank
	if acc >= 85.0:
		_result_rank.modulate = Color(1.0, 0.78, 0.14)
		_result_headline.text = "“天才打铁匠横空出世！停电也能精准铸出名剑！”"
	elif acc >= 60.0:
		_result_rank.modulate = Color(0.28, 0.78, 0.40)
		_result_headline.text = "“火候不错，再把三连快传和停电段稳住就是大师了！”"
	else:
		_result_rank.modulate = Color(0.92, 0.30, 0.34)
		_result_headline.text = "“师傅看得直斜眼……多听木鱼与飞铁落地的节奏吧！”"

	var medal := "   ★获得完美奖章！" if (_miss_count == 0 and acc >= 95.0) else ""
	_result_stats.text = "准确度：%.1f%%   神兵：%d 把%s\nACE: %d    BARELY: %d    MISS: %d\n最大连击：%d" % [
		acc, _swords_forged, medal, _perfect_count, _good_count, _miss_count, _max_combo
	]
	_result_overlay.visible = true


func _go_title() -> void:
	_conductor.stop()
	get_tree().change_scene_to_file("res://scenes/title_screen.tscn")
