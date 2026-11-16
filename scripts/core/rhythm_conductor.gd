class_name RhythmConductor
extends Node

signal beat_hit(beat_index: int)
signal half_beat_hit(half_index: int)

@export var bpm: float = 120.0
@export var loop_beats: float = 16.0

var beat_duration: float = 0.5
var current_time_sec: float = 0.0
var current_beat: float = 0.0
var is_running: bool = false

var _backing_player: AudioStreamPlayer
var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_cursor: int = 0
var _bgm_bus_idx: int = -1
var _duck_tween: Tween

var _loop_sec: float = 8.0
var _loop_count: int = 0
var _prev_raw_pos: float = 0.0
var _last_emitted_beat: int = -1
var _last_emitted_half: int = -1
var _headless_time: float = 0.0
var _is_headless: bool = false


func _ready() -> void:
	_is_headless = DisplayServer.get_name() == "headless"
	_bgm_bus_idx = AudioServer.get_bus_index("BGM")
	_backing_player = AudioStreamPlayer.new()
	_backing_player.volume_db = -3.0
	if _bgm_bus_idx >= 0:
		_backing_player.bus = &"BGM"
	add_child(_backing_player)

	for i in range(12):
		var p := AudioStreamPlayer.new()
		add_child(p)
		_sfx_pool.append(p)


func setup(new_bpm: float, style: String) -> void:
	bpm = new_bpm
	beat_duration = 60.0 / bpm
	_loop_sec = loop_beats * beat_duration
	_backing_player.stream = SoundSynth.make_backing_loop(bpm, style)


func start() -> void:
	_loop_count = 0
	_prev_raw_pos = 0.0
	_last_emitted_beat = -1
	_last_emitted_half = -1
	_headless_time = 0.0
	current_time_sec = 0.0
	current_beat = 0.0
	is_running = true
	if not _is_headless:
		_backing_player.play()


func stop() -> void:
	is_running = false
	_backing_player.stop()


func pause_audio(paused: bool) -> void:
	_backing_player.stream_paused = paused
	is_running = not paused


func duck_bgm(hold_sec: float = 0.16) -> void:
	if _bgm_bus_idx < 0 or _is_headless:
		return
	if _duck_tween and _duck_tween.is_valid():
		_duck_tween.kill()
	AudioServer.set_bus_volume_db(_bgm_bus_idx, -14.0)
	_duck_tween = create_tween()
	_duck_tween.tween_method(
		func(db: float) -> void: AudioServer.set_bus_volume_db(_bgm_bus_idx, db),
		-14.0,
		-2.0,
		hold_sec
	)


func play_sfx(stream: AudioStream, pitch_scale: float = 1.0, volume_db: float = 0.0, bus_name: StringName = &"Master") -> void:
	if stream == null or _is_headless:
		return
	var p := _sfx_pool[_sfx_cursor]
	_sfx_cursor = (_sfx_cursor + 1) % _sfx_pool.size()
	p.stream = stream
	p.pitch_scale = pitch_scale
	p.volume_db = volume_db
	p.bus = bus_name if AudioServer.get_bus_index(bus_name) >= 0 else &"Master"
	p.play()


func play_teacher_cue(stream: AudioStream, hold_duck: float = 0.16) -> void:
	duck_bgm(hold_duck)
	play_sfx(stream, 1.0, 0.0, &"TeacherCue")


func play_player_sfx(stream: AudioStream, pitch_scale: float = 1.0, volume_db: float = 0.0, duck: bool = false) -> void:
	if duck:
		duck_bgm(0.18)
	play_sfx(stream, pitch_scale, volume_db, &"PlayerHit")


func _process(delta: float) -> void:
	if not is_running:
		return

	if _is_headless:
		_headless_time += delta
		current_time_sec = _headless_time
	else:
		var raw_pos := _backing_player.get_playback_position() + AudioServer.get_time_since_last_mix() - AudioServer.get_output_latency()
		raw_pos = fposmod(raw_pos, _loop_sec)
		if raw_pos < _prev_raw_pos - (_loop_sec * 0.5):
			_loop_count += 1
		_prev_raw_pos = raw_pos
		current_time_sec = float(_loop_count) * _loop_sec + raw_pos

	var offset_sec := GameState.audio_offset_ms / 1000.0
	var adjusted_time := current_time_sec - offset_sec
	current_beat = adjusted_time / beat_duration

	var beat_idx := int(floorf(current_beat))
	if beat_idx > _last_emitted_beat and beat_idx >= 0:
		_last_emitted_beat = beat_idx
		beat_hit.emit(beat_idx)

	var half_idx := int(floorf(current_beat * 2.0))
	if half_idx > _last_emitted_half and half_idx >= 0:
		_last_emitted_half = half_idx
		half_beat_hit.emit(half_idx)
