extends StageBase

const BlacksmithRigScene := preload("res://scenes/characters/blacksmith_rig.tscn")

var _sfx_cue_normal: AudioStreamWAV
var _sfx_cue_offbeat: AudioStreamWAV
var _sfx_cue_charge: AudioStreamWAV
var _sfx_foley_normal: AudioStreamWAV
var _sfx_foley_heavy: AudioStreamWAV
var _sfx_barely: AudioStreamWAV
var _sfx_chord_a: AudioStreamWAV
var _sfx_chord_c: AudioStreamWAV
var _sfx_chord_d: AudioStreamWAV
var _sfx_sword_done: AudioStreamWAV

var _camera: Camera2D
var _bg_sprite: Sprite2D
var _furnace_glow: ColorRect
var _master_rig: BlacksmithRig
var _player_rig: BlacksmithRig
var _master_anvil: Sprite2D
var _player_anvil: Sprite2D
var _ingot_sprite: Sprite2D
var _ingot_shader: ShaderMaterial
var _sparks_particles: CPUParticles2D
var _smoke_layer: Node2D
var _smoke_alpha: float = 0.0
var _smoke_target: float = 0.0

var _shake_trauma: float = 0.0
var _hitstop_timer: float = 0.0
var _flash_amount: float = 0.0
var _mood_timer: float = 0.0
var _swords_forged: int = 0
var _chord_idx: int = 0
var _flying_swords: Array[Dictionary] = []
var _banner_text: String = "听师傅木鱼+口令，闭眼也能打！"


func _configure_stage() -> void:
	stage_id = "forge"
	stage_title = "铁匠打铁 ★分件骨骼版"
	stage_bpm = 115.0
	music_style = "forge"
	total_beats = 72.0

	_sfx_cue_normal = SoundSynth.make_teacher_cue(660.0, 0.12, false)
	_sfx_cue_offbeat = SoundSynth.make_teacher_cue(820.0, 0.10, true)
	_sfx_cue_charge = SoundSynth.make_charge_cue(260.0, 620.0, 0.78)
	_sfx_foley_normal = SoundSynth.make_anvil_foley(false)
	_sfx_foley_heavy = SoundSynth.make_anvil_foley(true)
	_sfx_barely = SoundSynth.make_barely_thud()
	_sfx_chord_a = SoundSynth.make_chord([440.0, 554.37, 659.25], 0.24, "triangle", 0.30)
	_sfx_chord_c = SoundSynth.make_chord([523.25, 659.25, 783.99], 0.24, "triangle", 0.30)
	_sfx_chord_d = SoundSynth.make_chord([587.33, 739.99, 880.0], 0.24, "triangle", 0.30)
	_sfx_sword_done = SoundSynth.make_chord([587.33, 739.99, 880.0, 1174.66], 0.36, "triangle", 0.34)

	_build_visual_stage()


func _build_visual_stage() -> void:
	_camera = Camera2D.new()
	_camera.position = Vector2(640, 360)
	add_child(_camera)

	_bg_sprite = Sprite2D.new()
	_bg_sprite.texture = load("res://assets/textures/forge_bg.png")
	_bg_sprite.position = Vector2(640, 360)
	_bg_sprite.scale = Vector2(1280.0 / 960.0, 720.0 / 540.0)
	add_child(_bg_sprite)

	_furnace_glow = ColorRect.new()
	_furnace_glow.size = Vector2(1280, 720)
	_furnace_glow.color = Color(1.0, 0.55, 0.16, 0.0)
	_furnace_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_furnace_glow)

	_master_anvil = Sprite2D.new()
	_master_anvil.texture = load("res://assets/textures/anvil.png")
	_master_anvil.position = Vector2(440, 530)
	add_child(_master_anvil)

	_player_anvil = Sprite2D.new()
	_player_anvil.texture = load("res://assets/textures/anvil.png")
	_player_anvil.position = Vector2(840, 530)
	add_child(_player_anvil)

	_ingot_shader = ShaderMaterial.new()
	_ingot_shader.shader = load("res://assets/shaders/hit_flash.gdshader")

	_ingot_sprite = Sprite2D.new()
	_ingot_sprite.texture = load("res://assets/textures/ingot.png")
	_ingot_sprite.position = Vector2(840, 466)
	_ingot_sprite.material = _ingot_shader
	add_child(_ingot_sprite)

	_master_rig = BlacksmithRigScene.instantiate()
	_master_rig.is_player = false
	_master_rig.facing_left = false
	_master_rig.position = Vector2(275, 582)
	_master_rig.scale = Vector2(1.25, 1.25)
	add_child(_master_rig)

	_player_rig = BlacksmithRigScene.instantiate()
	_player_rig.is_player = true
	_player_rig.facing_left = true
	_player_rig.position = Vector2(1005, 582)
	_player_rig.scale = Vector2(-1.25, 1.25)
	add_child(_player_rig)

	# Particle sparks
	_sparks_particles = CPUParticles2D.new()
	_sparks_particles.texture = load("res://assets/textures/spark.png")
	_sparks_particles.position = Vector2(840, 466)
	_sparks_particles.emitting = false
	_sparks_particles.one_shot = true
	_sparks_particles.explosiveness = 0.92
	_sparks_particles.amount = 18
	_sparks_particles.lifetime = 0.45
	_sparks_particles.direction = Vector2(0, -1)
	_sparks_particles.spread = 80.0
	_sparks_particles.initial_velocity_min = 180.0
	_sparks_particles.initial_velocity_max = 420.0
	_sparks_particles.gravity = Vector2(0, 720.0)
	_sparks_particles.scale_amount_min = 0.45
	_sparks_particles.scale_amount_max = 0.95
	add_child(_sparks_particles)

	_smoke_layer = Node2D.new()
	add_child(_smoke_layer)


func _build_chart() -> void:
	for i in range(4):
		add_cue(float(i), "count_in", {"num": 4 - i})

	# 8-beat Practice Warm-up
	_add_single(4.0, true)
	_add_single(6.0, true)
	_add_single(8.0, true)
	add_cue(10.0, "practice_done", {"msg": "热身结束！正式演出开始！"})

	_add_single(12.0)
	_add_single(14.0)
	_add_double(16.0)
	_add_triple(20.0)
	_add_heavy_charge(24.0)
	_add_single(28.0)
	_add_heavy_charge(29.0)
	_add_offbeat_run(32.0)
	_add_single(36.0)
	_add_single(38.0)

	add_cue(40.0, "smoke_on", {"msg": "浓烟遮挡！靠耳朵盲打三连敲！"})
	_add_triple(42.0)
	add_cue(46.5, "smoke_off", {"msg": "烟雾散去！"})

	_add_heavy_charge(48.0)
	_add_offbeat_run(52.0)
	_add_double(56.0)
	_add_triple(60.0)
	_add_heavy_charge(64.0)
	_add_triple(67.0)


func _add_single(b: float, practice: bool = false) -> void:
	add_cue(b, "master_hit", {"msg": "【练习】听师傅：叮！" if practice else "叮！"})
	add_target(b + 1.0, "single", {"heavy": false, "finish_sword": false, "practice": practice})


func _add_double(b: float) -> void:
	add_cue(b, "master_hit", {"msg": "叮！"})
	add_cue(b + 1.0, "master_hit", {"msg": "叮-叮！"})
	add_target(b + 2.0, "double", {"heavy": false, "finish_sword": false})
	add_target(b + 3.0, "double", {"heavy": false, "finish_sword": true})


func _add_triple(b: float) -> void:
	add_cue(b, "master_hit", {"msg": "三连敲：叮-"})
	add_cue(b + 0.5, "master_hit", {"msg": "三连敲：叮-叮-"})
	add_cue(b + 1.0, "master_hit", {"msg": "三连敲：叮-叮-叮！"})
	add_target(b + 2.0, "triple", {"heavy": false, "finish_sword": false})
	add_target(b + 2.5, "triple", {"heavy": false, "finish_sword": false})
	add_target(b + 3.0, "triple", {"heavy": false, "finish_sword": true})


func _add_heavy_charge(b: float) -> void:
	add_cue(b, "charge_start", {"msg": "重锤蓄力：呼——！"})
	add_target(b + 2.0, "heavy", {"heavy": true, "finish_sword": true})


func _add_offbeat_run(b: float) -> void:
	add_cue(b, "offbeat_cue", {"msg": "切换反拍：嘿-哒！"})
	add_cue(b + 0.5, "offbeat_cue", {"msg": "反拍准备：哒-哒！"})
	add_cue(b + 1.0, "offbeat_cue", {"msg": "跟上反拍空隙！"})
	add_target(b + 1.5, "offbeat", {"heavy": false, "finish_sword": false})
	add_target(b + 2.5, "offbeat", {"heavy": false, "finish_sword": false})
	add_target(b + 3.5, "offbeat", {"heavy": false, "finish_sword": true})


func _on_beat(_beat_idx: int) -> void:
	_master_rig.play_bop()
	_player_rig.play_bop()


func _on_cue_triggered(cue: Dictionary) -> void:
	var kind: String = cue["kind"]
	if kind == "count_in":
		_banner_text = "热身准备... %d" % int(cue["num"])
		conductor.play_teacher_cue(_sfx_cue_normal, 0.12)
	elif kind == "practice_done":
		_banner_text = str(cue.get("msg", "正式开始！"))
	elif kind == "master_hit":
		_banner_text = str(cue.get("msg", "叮！"))
		_master_rig.play_strike()
		_ingot_sprite.scale = Vector2(1.0, 1.0)
		_ingot_sprite.modulate = Color(1, 1, 1)
		conductor.play_teacher_cue(_sfx_cue_normal, 0.16)
	elif kind == "charge_start":
		_banner_text = str(cue.get("msg", "重锤蓄力！"))
		_master_rig.play_windup()
		_ingot_sprite.scale = Vector2(1.15, 1.15)
		conductor.play_teacher_cue(_sfx_cue_charge, 0.65)
	elif kind == "offbeat_cue":
		_banner_text = str(cue.get("msg", "反拍！"))
		_master_rig.play_strike()
		conductor.play_teacher_cue(_sfx_cue_offbeat, 0.14)
	elif kind == "smoke_on":
		_banner_text = str(cue.get("msg", ""))
		_smoke_target = 1.0
	elif kind == "smoke_off":
		_banner_text = str(cue.get("msg", ""))
		_smoke_target = 0.0


func _on_player_hit(target: Dictionary, grade: String, _err_sec: float) -> void:
	var heavy: bool = bool(target.get("heavy", false))
	_player_rig.play_strike()

	if grade == "perfect":
		conductor.play_player_sfx(_sfx_foley_heavy if heavy else _sfx_foley_normal, 1.0, 0.0, true)
		var chords := [_sfx_chord_a, _sfx_chord_c, _sfx_chord_d]
		conductor.play_player_sfx(chords[_chord_idx % chords.size()], 1.0, -3.0, false)
		_chord_idx += 1

		_shake_trauma = 0.9 if heavy else 0.55
		_hitstop_timer = 0.045
		_flash_amount = 1.0
		_ingot_shader.set_shader_parameter("flash_amount", _flash_amount)
		_sparks_particles.restart()
		_master_rig.set_mood("happy")
		_mood_timer = 0.7

		if target.get("finish_sword", false):
			_swords_forged += 1
			_banner_text = "名剑出炉！(%d)" % _swords_forged
			conductor.play_player_sfx(_sfx_sword_done, 1.0, -2.0, false)
			_flying_swords.append({
				"pos": Vector2(840, 450),
				"vel": Vector2(220, -420),
				"rot": -0.3,
				"life": 1.1,
			})
	else:
		# Barely: flat crooked ingot + confused master
		conductor.play_player_sfx(_sfx_barely, 1.0, 0.0, false)
		_shake_trauma = 0.25
		_ingot_sprite.scale = Vector2(1.3, 0.48)
		_master_rig.set_mood("confused")
		_mood_timer = 0.75
		_banner_text = "擦边打歪了点..."


func _on_player_miss(_target: Dictionary, _was_early_or_wrong: bool) -> void:
	_master_rig.set_mood("sideeye")
	_mood_timer = 1.2
	_ingot_sprite.modulate = Color(0.45, 0.45, 0.5)
	_banner_text = "漏拍啦！师傅在斜眼看你..."


func _on_empty_tap() -> void:
	_player_rig.play_strike()
	conductor.play_player_sfx(_sfx_barely, 0.85, -10.0, false)


func _process(delta: float) -> void:
	if _hitstop_timer > 0.0:
		_hitstop_timer -= delta
		return

	super._process(delta)

	_furnace_glow.color.a = beat_pulse * 0.14
	_flash_amount = maxf(0.0, _flash_amount - delta * 8.0)
	_ingot_shader.set_shader_parameter("flash_amount", _flash_amount)

	_shake_trauma = maxf(0.0, _shake_trauma - delta * 2.8)
	var shake_amt := _shake_trauma * _shake_trauma * 16.0
	_camera.offset = Vector2(randf_range(-shake_amt, shake_amt), randf_range(-shake_amt, shake_amt))

	_smoke_alpha = lerpf(_smoke_alpha, _smoke_target, minf(1.0, delta * 4.5))
	if _mood_timer > 0.0:
		_mood_timer -= delta
		if _mood_timer <= 0.0:
			_master_rig.set_mood("normal")

	for i in range(_flying_swords.size() - 1, -1, -1):
		var sw := _flying_swords[i]
		sw["life"] -= delta
		sw["vel"].y += 720.0 * delta
		sw["pos"] += sw["vel"] * delta
		sw["rot"] += 4.5 * delta
		if sw["life"] <= 0.0:
			_flying_swords.remove_at(i)


func _draw() -> void:
	var sword_tex: Texture2D = load("res://assets/textures/sword.png")
	for sw in _flying_swords:
		draw_set_transform(sw["pos"], sw["rot"], Vector2.ONE)
		draw_texture(sword_tex, -sword_tex.get_size() * 0.5)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	if _smoke_alpha > 0.02:
		var col := Color(0.16, 0.17, 0.22, _smoke_alpha * 0.95)
		for puff in [[340.0, 390.0, 140.0], [500.0, 360.0, 155.0], [660.0, 395.0, 160.0], [820.0, 375.0, 155.0], [960.0, 405.0, 140.0]]:
			draw_circle(Vector2(puff[0], puff[1]), puff[2], col)
			draw_arc(Vector2(puff[0], puff[1]), puff[2], 0.0, TAU, 32, Color(0.07, 0.07, 0.09, _smoke_alpha), 4.0)

	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(0, 130), _banner_text, HORIZONTAL_ALIGNMENT_CENTER, 1280, 28, Color(1.0, 0.94, 0.80))
	draw_string(font, Vector2(38, 650), "成品神兵: %d" % _swords_forged, HORIZONTAL_ALIGNMENT_LEFT, 360, 26, Color(1.0, 0.86, 0.36))
