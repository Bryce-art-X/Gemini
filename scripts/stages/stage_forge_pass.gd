extends Node2D

const PERFECT_WIN := 0.052
const GOOD_WIN := 0.110
const MISS_WIN := 0.135

const LEFT_ANVIL := Vector2(385, 505)
const RIGHT_ANVIL := Vector2(885, 505)
const SPAWN_POS := Vector2(385, 466)
const LAND_POS := Vector2(885, 466)
const BARREL_POS := Vector2(1170, 560)
const MASTER_FOOT := Vector2(210, 615)
const PLAYER_FOOT := Vector2(1040, 615)

var _conductor: RhythmConductor
var _cues: Array = []
var _targets: Array = []
var _total_beats: float = 144.0
var _bpm: float = 120.0

# Audio
var _cue_hits: Array[AudioStream] = []
var _cue_lob: AudioStream
var _sfx_ace: AudioStream
var _sfx_heavy: AudioStream
var _sfx_barely: AudioStream
var _sfx_miss: AudioStream
var _sfx_bonk: AudioStream
var _sfx_bulb_snap: AudioStream
var _sfx_power_on: AudioStream
var _sfx_sword_fly: AudioStream
var _chords: Array[AudioStream] = []

# Nodes
var _camera: Camera2D
var _world_canvas: Node2D
var _sparks: CPUParticles2D
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

# Animation & Comedy Physics State
var _time_sec: float = 0.0
var _beat_pulse: float = 0.0
var _hitstop_timer: float = 0.0
var _shake_trauma: float = 0.0
var _anvil_flash: float = 0.0
var _bellows_squeeze: float = 0.0

var _master_strike_t: float = 0.0
var _master_windup_t: float = 0.0
var _player_strike_t: float = 0.0
var _player_bonk_t: float = 0.0

var _master_mood: String = "normal"
var _player_mood: String = "normal"
var _mood_timer: float = 0.0

var _is_blackout: bool = false
var _blackout_alpha: float = 0.0
var _bulb_angle: float = 0.0
var _bulb_vel: float = 0.0
var _bulb_sparks: Array[Dictionary] = []

var _barrel_wobble: float = 0.0
var _barrel_weapons: Array[Dictionary] = []

var _perfect_count: int = 0
var _good_count: int = 0
var _miss_count: int = 0
var _combo: int = 0
var _max_combo: int = 0
var _swords_forged: int = 0
var _stage_finished: bool = false

var _flying_ingots: Array[Dictionary] = []
var _flying_weapons: Array[Dictionary] = []
var _scrap_ingots: Array[Dictionary] = []


func _ready() -> void:
	_load_audio()
	_load_chart()
	_build_visuals()
	_build_hud()

	_conductor = RhythmConductor.new()
	add_child(_conductor)
	_conductor.beat_hit.connect(_on_beat_hit)
	_conductor.setup(_bpm, load("res://assets/audio/bgm_main.ogg"))
	_conductor.start()


func _load_audio() -> void:
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
	_sfx_bonk = load("res://assets/audio/sfx_bonk.wav")
	_sfx_bulb_snap = load("res://assets/audio/sfx_bulb_snap.wav")
	_sfx_power_on = load("res://assets/audio/sfx_power_on.wav")
	_sfx_sword_fly = load("res://assets/audio/sfx_sword_fly.wav")
	for i in range(8):
		_chords.append(load("res://assets/audio/chord_%d.wav" % i))


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


func _build_visuals() -> void:
	_camera = Camera2D.new()
	_camera.position = Vector2(640, 360)
	add_child(_camera)

	_world_canvas = Node2D.new()
	_world_canvas.draw.connect(_draw_world)
	add_child(_world_canvas)

	_sparks = CPUParticles2D.new()
	_sparks.texture = load("res://assets/textures/spark.png")
	_sparks.position = LAND_POS
	_sparks.emitting = false
	_sparks.one_shot = true
	_sparks.explosiveness = 0.94
	_sparks.amount = 18
	_sparks.lifetime = 0.45
	_sparks.direction = Vector2(0, -1)
	_sparks.spread = 85.0
	_sparks.initial_velocity_min = 210.0
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
	UITheme.style_card(_practice_pill, Color(0.20, 0.62, 0.96, 0.92))
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
	_bellows_squeeze = 1.0


func _process(delta: float) -> void:
	if _hitstop_timer > 0.0:
		_hitstop_timer -= delta
		return

	if _stage_finished:
		return

	_time_sec += delta
	_beat_pulse = maxf(0.0, _beat_pulse - delta * 5.2)
	_bellows_squeeze = maxf(0.0, _bellows_squeeze - delta * 4.0)

	var cur_beat := _conductor.current_beat
	_progress_bar.value = clampf(cur_beat / maxf(1.0, _total_beats) * 100.0, 0.0, 100.0)

	for c in _cues:
		if not c["triggered"] and cur_beat >= float(c["beat"]):
			c["triggered"] = true
			_handle_cue(c)

	var cur_sec := cur_beat * _conductor.beat_duration
	for t in _targets:
		if not t["judged"]:
			var target_sec := float(t["beat"]) * _conductor.beat_duration
			if cur_sec - target_sec > MISS_WIN:
				t["judged"] = true
				_register_miss(t)

	_update_physics(delta, cur_beat)

	if cur_beat >= _total_beats:
		_finish_stage()

	_world_canvas.queue_redraw()


func _handle_cue(c: Dictionary) -> void:
	var kind: String = c["kind"]
	if kind == "count_in":
		_conductor.play_cue(_cue_hits[0], 0.10)
	elif kind == "pass_normal":
		_master_strike_t = 1.0
		_conductor.play_cue(_cue_hits[1], 0.14)
		_spawn_flying_ingot(c, "normal")
	elif kind == "pass_triple":
		var step := clampi(int(c.get("step", 1)) - 1, 0, 2)
		_master_strike_t = 1.0
		_conductor.play_cue(_cue_hits[step], 0.12)
		_spawn_flying_ingot(c, "triple")
	elif kind == "pass_heavy":
		_master_windup_t = 1.0
		_master_strike_t = 1.0
		_conductor.play_cue(_cue_lob, 0.35)
		_spawn_flying_ingot(c, "heavy")
	elif kind == "practice_done":
		_practice_label.text = "正式演出!"
		var tw := create_tween()
		tw.tween_interval(1.2)
		tw.tween_property(_practice_pill, "modulate:a", 0.0, 0.35)
	elif kind == "blackout_on":
		_is_blackout = true
		_bulb_vel = 6.5
		_conductor.play_sfx(_sfx_bulb_snap, &"Master", -1.0)
		for i in range(10):
			_bulb_sparks.append({
				"pos": Vector2(640, 128),
				"vel": Vector2(randf_range(-180, 180), randf_range(-80, 180)),
				"life": 0.45,
			})
	elif kind == "blackout_off":
		_is_blackout = false
		_bulb_vel = -3.0
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


func _pick_absurd_weapon(kind: String, heavy: bool) -> String:
	if heavy:
		return "excalibur" if _swords_forged % 2 == 0 else "pan"
	if kind == "triple":
		return "fish" if _combo >= 6 else "sword"
	return "pan" if (_swords_forged % 5 == 4) else "sword"


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

	_player_strike_t = 1.0

	if best_t.is_empty():
		_conductor.play_foley(_sfx_barely, -12.0, false)
		return

	best_t["judged"] = true
	var is_practice := bool(best_t.get("practice", false))
	var kind := str(best_t.get("kind", "normal"))
	var heavy := kind == "heavy"

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

		_hitstop_timer = 0.042
		_shake_trauma = 0.85 if heavy else 0.55
		_anvil_flash = 1.0
		_sparks.restart()
		_master_mood = "happy"
		_player_mood = "happy"
		_mood_timer = 0.65

		if bool(best_t.get("finish_sword", false)):
			if not is_practice:
				_swords_forged += 1
			_conductor.play_foley(_sfx_sword_fly, -4.0, false)
			var w_kind := _pick_absurd_weapon(kind, heavy)
			_flying_weapons.append({
				"start": LAND_POS,
				"end": BARREL_POS + Vector2(randf_range(-16, 16), -42),
				"t": 0.0,
				"kind": w_kind,
				"scale": 1.35 if heavy else 1.0,
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
		_master_mood = "sideeye"
		_mood_timer = 0.55
		_scrap_ingots.push_back({
			"pos": LAND_POS,
			"vel": Vector2(140, -200),
			"rot": 0.0,
			"spin": 9.0,
			"flat": true,
			"life": 0.85,
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
	# Physical BONK on Apprentice head + Master & Fire Buddy side-eye glare!
	_conductor.play_foley(_sfx_bonk, -1.0, false)
	_player_bonk_t = 1.0
	_master_mood = "sideeye"
	_mood_timer = 1.1
	_shake_trauma = 0.35


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


func _update_physics(delta: float, cur_beat: float) -> void:
	_blackout_alpha = lerpf(_blackout_alpha, 0.93 if _is_blackout else 0.0, minf(1.0, delta * 9.0))
	_master_strike_t = maxf(0.0, _master_strike_t - delta * 6.0)
	_master_windup_t = maxf(0.0, _master_windup_t - delta * 2.5)
	_player_strike_t = maxf(0.0, _player_strike_t - delta * 6.2)
	_player_bonk_t = maxf(0.0, _player_bonk_t - delta * 1.1)
	_anvil_flash = maxf(0.0, _anvil_flash - delta * 8.0)

	# Swinging bulb pendulum physics
	_bulb_vel += (-18.0 * _bulb_angle - 1.4 * _bulb_vel) * delta
	_bulb_angle += _bulb_vel * delta

	# Barrel spring wobble
	_barrel_wobble = lerpf(_barrel_wobble, 0.0, minf(1.0, delta * 9.0))

	if _mood_timer > 0.0:
		_mood_timer -= delta
		if _mood_timer <= 0.0:
			_master_mood = "normal"
			_player_mood = "normal"

	_shake_trauma = maxf(0.0, _shake_trauma - delta * 3.0)
	var sh := _shake_trauma * _shake_trauma * 15.0
	_camera.offset = Vector2(randf_range(-sh, sh), randf_range(-sh, sh))

	for i in range(_flying_ingots.size() - 1, -1, -1):
		if _flying_ingots[i]["resolved"] or cur_beat - float(_flying_ingots[i]["hit_beat"]) > 0.2:
			_flying_ingots.remove_at(i)

	for i in range(_flying_weapons.size() - 1, -1, -1):
		var fw := _flying_weapons[i]
		fw["t"] += delta * 2.8
		if fw["t"] >= 1.0:
			_barrel_wobble = 1.0
			_barrel_weapons.append({"kind": fw["kind"], "rot": randf_range(-0.28, 0.28)})
			if _barrel_weapons.size() > 14:
				_barrel_weapons.pop_front()
			_flying_weapons.remove_at(i)

	for i in range(_scrap_ingots.size() - 1, -1, -1):
		var sc := _scrap_ingots[i]
		sc["life"] -= delta
		sc["vel"].y += 820.0 * delta
		sc["pos"] += sc["vel"] * delta
		sc["rot"] += float(sc["spin"]) * delta
		if sc["life"] <= 0.0:
			_scrap_ingots.remove_at(i)

	for i in range(_bulb_sparks.size() - 1, -1, -1):
		var bs := _bulb_sparks[i]
		bs["life"] -= delta
		bs["vel"].y += 650.0 * delta
		bs["pos"] += bs["vel"] * delta
		if bs["life"] <= 0.0:
			_bulb_sparks.remove_at(i)


func _compute_ingot_pos(fi: Dictionary, cur_beat: float) -> Vector2:
	var sb := float(fi["spawn_beat"])
	var hb := float(fi["hit_beat"])
	var t := clampf((cur_beat - sb) / maxf(0.05, hb - sb), 0.0, 1.15)
	var is_heavy := str(fi["kind"]) == "heavy"
	var arc_h := 285.0 if is_heavy else 170.0
	var pos := SPAWN_POS.lerp(LAND_POS, t)
	pos.y -= 4.0 * arc_h * t * (1.0 - t)
	return pos


func _draw_world() -> void:
	var cur_beat := _conductor.current_beat
	var sil := _blackout_alpha > 0.5

	# 1. Workshop background + Fire Buddy + Swinging Bulb
	ForgePainter.draw_workshop_bg(_world_canvas, _beat_pulse, _time_sec, _master_mood, _bulb_angle, not _is_blackout, _bellows_squeeze)

	# 2. Blackout curtain behind foreground characters/props
	if _blackout_alpha > 0.01:
		_world_canvas.draw_rect(Rect2(-40, -40, 1360, 800), Color(0.03, 0.03, 0.06, _blackout_alpha))

	# 3. Anvils & Weapon Barrel
	ForgePainter.draw_anvil_station(_world_canvas, LEFT_ANVIL, _beat_pulse, 0.0, false, sil)
	ForgePainter.draw_anvil_station(_world_canvas, RIGHT_ANVIL, _beat_pulse, _anvil_flash, true, sil)
	ForgePainter.draw_barrel(_world_canvas, BARREL_POS, _barrel_wobble, _barrel_weapons, sil)

	# 4. Find nearest airborne ingot for real-time Apprentice eyeball tracking!
	var track_pos := SPAWN_POS
	for fi in _flying_ingots:
		if not fi["resolved"] and not fi["blind"]:
			track_pos = _compute_ingot_pos(fi, cur_beat)
			break

	# 5. Articulated 2-Bone Vector Characters
	ForgePainter.draw_master(_world_canvas, MASTER_FOOT, _beat_pulse, _time_sec, _master_strike_t, _master_windup_t, _master_mood, sil)
	ForgePainter.draw_player(_world_canvas, PLAYER_FOOT, _beat_pulse, _time_sec, _player_strike_t, _player_bonk_t, _player_mood, track_pos, sil)

	# 6. Flying Molten Ingots (hidden when blind: true!)
	for fi in _flying_ingots:
		if fi["resolved"] or fi["blind"]:
			continue
		var sb := float(fi["spawn_beat"])
		var hb := float(fi["hit_beat"])
		var t := clampf((cur_beat - sb) / maxf(0.05, hb - sb), 0.0, 1.15)
		var is_heavy := str(fi["kind"]) == "heavy"
		var pos := _compute_ingot_pos(fi, cur_beat)
		var rot := t * TAU * (1.5 if is_heavy else 1.0)
		_world_canvas.draw_set_transform(pos, rot, Vector2(1.4, 1.4) if is_heavy else Vector2.ONE)
		_world_canvas.draw_circle(Vector2.ZERO, 26.0, Color(1.0, 0.45, 0.1, 0.35))
		ForgePainter.draw_outlined_rect(_world_canvas, Rect2(-26, -11, 52, 22), Color(1.0, 0.44, 0.12), 4.0)
		_world_canvas.draw_rect(Rect2(-18, -6, 36, 9), Color(1.0, 0.88, 0.35))

	# 7. Forged Absurd Weapons arcing into Barrel!
	for fw in _flying_weapons:
		var t := float(fw["t"])
		var p: Vector2 = fw["start"].lerp(fw["end"], t)
		p.y -= 4.0 * 180.0 * t * (1.0 - t)
		_world_canvas.draw_set_transform(p, t * TAU * 1.5, Vector2(fw["scale"], fw["scale"]))
		ForgePainter.draw_weapon_shape(_world_canvas, Vector2.ZERO, str(fw["kind"]), 1.0, false)

	# 8. Crumpled Scrap Ingots on Barely
	for sc in _scrap_ingots:
		_world_canvas.draw_set_transform(sc["pos"], sc["rot"], Vector2(1.3, 0.45))
		ForgePainter.draw_outlined_rect(_world_canvas, Rect2(-22, -9, 44, 18), Color(0.55, 0.42, 0.40), 3.5)

	# 9. Bulb Snap Electric Sparks
	_world_canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	for bs in _bulb_sparks:
		_world_canvas.draw_circle(bs["pos"], 5.0 * bs["life"] * 2.0, Color(1.0, 0.94, 0.35))


func _finish_stage() -> void:
	_stage_finished = true
	_conductor.stop()

	var total := maxi(1, _perfect_count + _good_count + _miss_count)
	var acc := ((float(_perfect_count) + float(_good_count) * 0.65) / float(total)) * 100.0
	var rank := GameState.update_record(acc, _max_combo, _miss_count)

	_result_rank.text = rank
	if acc >= 85.0:
		_result_rank.modulate = Color(1.0, 0.78, 0.14)
		_result_headline.text = "“天才打铁匠横空出世！木桶都插满黄金平底锅与圣剑啦！”"
	elif acc >= 60.0:
		_result_rank.modulate = Color(0.28, 0.78, 0.40)
		_result_headline.text = "“火候不错，再把三连快传和停电段稳住就是大师了！”"
	else:
		_result_rank.modulate = Color(0.92, 0.30, 0.34)
		_result_headline.text = "“脑袋上被铁块砸出好几个大包……多听木鱼与风箱声吧！”"

	var medal := "   ★获得完美奖章！" if (_miss_count == 0 and acc >= 95.0) else ""
	_result_stats.text = "准确度：%.1f%%   神兵入桶：%d 件%s\nACE: %d    BARELY: %d    MISS: %d\n最大连击：%d" % [
		acc, _swords_forged, medal, _perfect_count, _good_count, _miss_count, _max_combo
	]
	_result_overlay.visible = true


func _go_title() -> void:
	_conductor.stop()
	get_tree().change_scene_to_file("res://scenes/title_screen.tscn")
