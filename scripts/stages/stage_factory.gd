extends StageBase

const BELT_Y := 470.0
const SPAWN_X := 200.0
const CLAW_X := 920.0

var _sfx_beep_low: AudioStreamWAV
var _sfx_beep_high: AudioStreamWAV
var _sfx_claw_snap: AudioStreamWAV

var _claw_anim: float = 0.0
var _boxes_caught: int = 0
var _items: Array[Dictionary] = []
var _banner_text: String = "盯紧传送带上的零件！"


func _configure_stage() -> void:
	stage_id = "factory"
	stage_title = "流水线接球"
	stage_bpm = 120.0
	music_style = "factory"
	total_beats = 64.0

	_sfx_beep_low = SoundSynth.make_tone(523.25, 0.09, "square", 0.22)
	_sfx_beep_high = SoundSynth.make_tone(783.99, 0.09, "square", 0.24)
	_sfx_claw_snap = SoundSynth.make_snare(0.42)


func _build_chart() -> void:
	for i in range(4):
		add_cue(float(i), "count_in", {"num": 4 - i})

	# Normal 3-beat lead-ins (spawn at b, catch at b+3)
	_add_normal_box(4.0)
	_add_normal_box(8.0)
	_add_normal_box(12.0)

	# Introduce Fast Gold Box (1.5-beat lead-in)
	_add_fast_box(16.0)
	_add_fast_box(18.0)

	_add_normal_box(20.0)
	_add_fast_box(24.0)
	_add_fast_box(26.0)

	_add_normal_box(28.0)
	_add_normal_box(32.0)

	# Rapid sequence
	_add_fast_box(36.0)
	_add_fast_box(38.0)
	_add_fast_box(40.0)
	_add_normal_box(42.0)

	_add_normal_box(46.0)
	_add_fast_box(50.0)
	_add_fast_box(52.0)
	_add_normal_box(54.0)
	_add_fast_box(58.0)


func _add_normal_box(b: float) -> void:
	add_cue(b, "spawn_normal", {"spawn_beat": b, "target_beat": b + 3.0})
	add_cue(b + 1.0, "hop_beep", {"high": false})
	add_cue(b + 2.0, "hop_beep", {"high": false})
	add_target(b + 3.0, "normal")


func _add_fast_box(b: float) -> void:
	add_cue(b, "spawn_fast", {"spawn_beat": b, "target_beat": b + 1.5})
	add_cue(b + 0.5, "hop_beep", {"high": true})
	add_target(b + 1.5, "fast")


func _on_cue_triggered(cue: Dictionary) -> void:
	var kind: String = cue["kind"]
	if kind == "count_in":
		_banner_text = "开机准备... %d" % int(cue["num"])
		conductor.play_sfx(_sfx_beep_low, 0.85, -5.0)
	elif kind == "spawn_normal":
		_banner_text = "普通件：1 - 2 - 3 - 抓！"
		conductor.play_sfx(_sfx_beep_low, 1.0, -4.0)
		_items.append({
			"spawn_beat": float(cue["spawn_beat"]),
			"target_beat": float(cue["target_beat"]),
			"fast": false,
			"state": "moving", # moving, caught, missed
			"fly_t": 0.0,
		})
	elif kind == "spawn_fast":
		_banner_text = "金色加速件：哔哔 - 快抓！"
		conductor.play_sfx(_sfx_beep_high, 1.0, -4.0)
		_items.append({
			"spawn_beat": float(cue["spawn_beat"]),
			"target_beat": float(cue["target_beat"]),
			"fast": true,
			"state": "moving",
			"fly_t": 0.0,
		})
	elif kind == "hop_beep":
		var is_high: bool = cue.get("high", false)
		conductor.play_sfx(_sfx_beep_high if is_high else _sfx_beep_low, 1.15 if is_high else 1.0, -4.0)


func _on_player_hit(_target: Dictionary, grade: String, _err_sec: float) -> void:
	_claw_anim = 1.0
	_boxes_caught += 1
	conductor.play_sfx(_sfx_claw_snap, 1.0 if grade == "perfect" else 0.9, -3.0)
	for item in _items:
		if item["state"] == "moving":
			item["state"] = "caught"
			break


func _on_player_miss(_target: Dictionary, _was_early_or_wrong: bool) -> void:
	_claw_anim = 0.6
	for item in _items:
		if item["state"] == "moving":
			item["state"] = "missed"
			break


func _on_empty_tap() -> void:
	_claw_anim = 0.7
	conductor.play_sfx(_sfx_claw_snap, 0.75, -14.0)


func _process(delta: float) -> void:
	super._process(delta)
	_claw_anim = maxf(0.0, _claw_anim - delta * 6.0)
	for i in range(_items.size() - 1, -1, -1):
		var item := _items[i]
		if item["state"] != "moving":
			item["fly_t"] += delta * 2.5
			if item["fly_t"] >= 1.2:
				_items.remove_at(i)


func _draw() -> void:
	var bg_col := Color(0.08, 0.13, 0.19).lerp(Color(0.11, 0.18, 0.26), beat_pulse * 0.35)
	draw_rect(Rect2(0, 0, 1280, 720), bg_col)

	# Conveyor Belt
	draw_rect(Rect2(140, BELT_Y, 880, 36), Color(0.24, 0.28, 0.34))
	draw_rect(Rect2(140, BELT_Y + 36, 880, 14), Color(0.16, 0.18, 0.22))

	# Belt rollers
	var rot := conductor.current_beat * 2.2
	for x in range(180, 1020, 120):
		var c := Vector2(float(x), BELT_Y + 18)
		draw_circle(c, 14, Color(0.45, 0.52, 0.60))
		draw_line(c, c + Vector2(cos(rot), sin(rot)) * 12.0, Color(0.15, 0.18, 0.22), 3.0)

	# Catch Zone Target Ring
	var ring_col := Color(0.25, 0.85, 1.0, 0.35 + beat_pulse * 0.25)
	draw_arc(Vector2(CLAW_X, BELT_Y - 34), 38.0, 0.0, TAU, 32, ring_col, 4.0)

	# Mechanical Claw above CLAW_X
	var claw_y := lerpf(250.0, BELT_Y - 56.0, _claw_anim)
	draw_line(Vector2(CLAW_X, 120), Vector2(CLAW_X, claw_y), Color(0.65, 0.72, 0.80), 12.0)
	var spread := lerpf(34.0, 14.0, _claw_anim)
	draw_line(Vector2(CLAW_X, claw_y), Vector2(CLAW_X - spread, claw_y + 34), Color(0.88, 0.52, 0.24), 8.0)
	draw_line(Vector2(CLAW_X, claw_y), Vector2(CLAW_X + spread, claw_y + 34), Color(0.88, 0.52, 0.24), 8.0)

	# Items on belt
	var cur_beat := conductor.current_beat
	for item in _items:
		var pos := Vector2.ZERO
		if item["state"] == "moving":
			var t := clampf((cur_beat - float(item["spawn_beat"])) / maxf(0.1, float(item["target_beat"]) - float(item["spawn_beat"])), 0.0, 1.15)
			var x := lerpf(SPAWN_X, CLAW_X, t)
			var hop_freq := 2.0 if item["fast"] else 3.0
			var hop := absf(sin(t * PI * hop_freq)) * 42.0
			pos = Vector2(x, BELT_Y - 26.0 - hop)
		elif item["state"] == "caught":
			var ft: float = item["fly_t"]
			pos = Vector2(CLAW_X + ft * 220.0, BELT_Y - 40.0 - ft * 260.0)
		else:
			var ft: float = item["fly_t"]
			pos = Vector2(CLAW_X + ft * 160.0, BELT_Y - 20.0 + ft * ft * 320.0)

		var box_col := Color(1.0, 0.82, 0.22) if item["fast"] else Color(0.42, 0.84, 0.96)
		if item["state"] == "missed":
			box_col = Color(0.75, 0.25, 0.28)
		draw_rect(Rect2(pos - Vector2(24, 24), Vector2(48, 48)), box_col)
		draw_circle(pos + Vector2(-8, -4), 4, Color(0.1, 0.1, 0.15))
		draw_circle(pos + Vector2(8, -4), 4, Color(0.1, 0.1, 0.15))

	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(0, 185), _banner_text, HORIZONTAL_ALIGNMENT_CENTER, 1280, 30, Color(0.88, 0.96, 1.0))
	draw_string(font, Vector2(40, 620), "已打包零件: %d" % _boxes_caught, HORIZONTAL_ALIGNMENT_LEFT, 400, 26, Color(0.45, 0.92, 1.0))
