class_name RhythmConductor
extends Node

signal beat_hit(beat_index: int)
signal song_finished

@export var bpm: float = 120.0

var beat_duration: float = 0.5
var current_time_sec: float = 0.0
var current_beat: float = 0.0
var is_running: bool = false

var _backing_player: AudioStreamPlayer
var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_cursor: int = 0
var _bgm_bus_idx: int = -1
var _duck_tween: Tween
var _song_clock: float = 0.0
var _audio_ended: bool = false
var _last_emitted_beat: int = -1
var _is_headless: bool = false


func _ready() -> void:
	_is_headless = DisplayServer.get_name() == "headless"
	_bgm_bus_idx = AudioServer.get_bus_index("BGM")
	_backing_player = AudioStreamPlayer.new()
	_backing_player.volume_db = -1.5
	if _bgm_bus_idx >= 0:
		_backing_player.bus = &"BGM"
	_backing_player.finished.connect(_on_audio_finished)
	add_child(_backing_player)

	for i in range(16):
		var p := AudioStreamPlayer.new()
		add_child(p)
		_sfx_pool.append(p)


func setup(new_bpm: float, stream: AudioStream) -> void:
	bpm = new_bpm
	beat_duration = 60.0 / bpm
	_backing_player.stream = stream


func start() -> void:
	_song_clock = 0.0
	_audio_ended = false
	_last_emitted_beat = -1
	current_time_sec = 0.0
	current_beat = 0.0
	is_running = true
	if _bgm_bus_idx >= 0:
		AudioServer.set_bus_volume_db(_bgm_bus_idx, -1.5)
	if not _is_headless and _backing_player.stream != null:
		_backing_player.play()


func stop() -> void:
	is_running = false
	_backing_player.stop()


func _on_audio_finished() -> void:
	_audio_ended = true
	song_finished.emit()


func duck_bgm(hold_sec: float = 0.16) -> void:
	if _bgm_bus_idx < 0 or _is_headless:
		return
	if _duck_tween and _duck_tween.is_valid():
		_duck_tween.kill()
	AudioServer.set_bus_volume_db(_bgm_bus_idx, -13.0)
	_duck_tween = create_tween()
	_duck_tween.tween_method(
		func(db: float) -> void: AudioServer.set_bus_volume_db(_bgm_bus_idx, db),
		-13.0,
		-1.5,
		hold_sec
	)


func play_sfx(stream: AudioStream, bus_name: StringName = &"Master", volume_db: float = 0.0, pitch_scale: float = 1.0) -> void:
	if stream == null or _is_headless:
		return
	var p := _sfx_pool[_sfx_cursor]
	_sfx_cursor = (_sfx_cursor + 1) % _sfx_pool.size()
	p.stream = stream
	p.volume_db = volume_db
	p.pitch_scale = pitch_scale
	p.bus = bus_name if AudioServer.get_bus_index(bus_name) >= 0 else &"Master"
	p.play()


func play_cue(stream: AudioStream, hold_duck: float = 0.15) -> void:
	duck_bgm(hold_duck)
	play_sfx(stream, &"TeacherCue", -1.0)


func play_foley(stream: AudioStream, volume_db: float = 0.0, duck: bool = false) -> void:
	if duck:
		duck_bgm(0.18)
	play_sfx(stream, &"PlayerHit", volume_db)


func play_quantized_chord(stream: AudioStream, volume_db: float = -3.0) -> void:
	if stream == null or _is_headless:
		return
	var grid := beat_duration * 0.25 # 16th-note grid
	var next_grid := ceilf(current_time_sec / grid) * grid
	var wait := next_grid - current_time_sec
	if wait > 0.008 and wait <= 0.045:
		get_tree().create_timer(wait, false, true).timeout.connect(
			func() -> void: play_sfx(stream, &"PlayerHit", volume_db)
		)
	else:
		play_sfx(stream, &"PlayerHit", volume_db)


func _process(delta: float) -> void:
	if not is_running:
		return

	if _is_headless or _audio_ended or not _backing_player.playing:
		_song_clock += delta
	else:
		var raw_pos := _backing_player.get_playback_position() + AudioServer.get_time_since_last_mix() - AudioServer.get_output_latency()
		if raw_pos > _song_clock:
			_song_clock = raw_pos

	var offset_sec := GameState.audio_offset_ms / 1000.0
	current_time_sec = _song_clock - offset_sec
	current_beat = current_time_sec / beat_duration

	var beat_idx := int(floorf(current_beat))
	if beat_idx > _last_emitted_beat and beat_idx >= 0:
		_last_emitted_beat = beat_idx
		beat_hit.emit(beat_idx)
