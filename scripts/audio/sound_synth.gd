class_name SoundSynth
extends RefCounted

const SAMPLE_RATE := 22050


static func _samples_to_wav(samples: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var n := samples.size()
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in range(n):
		var v := clampf(samples[i], -1.0, 1.0)
		var s := int(round(v * 32767.0))
		data.encode_s16(i * 2, s)

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.data = data
	if loop:
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = n
	return wav


static func _wave_sample(phase: float, wave: String) -> float:
	var p := phase - floorf(phase)
	match wave:
		"sine":
			return sin(p * TAU)
		"triangle":
			return 1.0 - 4.0 * absf(p - 0.5)
		"square":
			return 1.0 if p < 0.5 else -1.0
		"saw":
			return 2.0 * p - 1.0
		_:
			return sin(p * TAU)


static func make_tone(freq: float, duration: float, wave: String = "triangle", volume: float = 0.5) -> AudioStreamWAV:
	var n := maxi(1, int(duration * SAMPLE_RATE))
	var samples := PackedFloat32Array()
	samples.resize(n)
	var attack := mini(int(0.006 * SAMPLE_RATE), n / 4)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var env := 1.0
		if i < attack:
			env = float(i) / maxf(1.0, float(attack))
		else:
			var rem := float(n - i) / maxf(1.0, float(n - attack))
			env = rem * rem
		samples[i] = _wave_sample(t * freq, wave) * env * volume
	return _samples_to_wav(samples)


static func make_chord(freqs: Array, duration: float, wave: String = "triangle", volume: float = 0.4) -> AudioStreamWAV:
	var n := maxi(1, int(duration * SAMPLE_RATE))
	var samples := PackedFloat32Array()
	samples.resize(n)
	var attack := mini(int(0.006 * SAMPLE_RATE), n / 4)
	var inv := 1.0 / maxf(1.0, float(freqs.size()))
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var env := 1.0
		if i < attack:
			env = float(i) / maxf(1.0, float(attack))
		else:
			var rem := float(n - i) / maxf(1.0, float(n - attack))
			env = rem * rem
		var sum := 0.0
		for f in freqs:
			sum += _wave_sample(t * float(f), wave)
		samples[i] = sum * inv * env * volume
	return _samples_to_wav(samples)


static func make_kick(volume: float = 0.7) -> AudioStreamWAV:
	var duration := 0.18
	var n := int(duration * SAMPLE_RATE)
	var samples := PackedFloat32Array()
	samples.resize(n)
	var phase := 0.0
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var progress := float(i) / float(n)
		var freq := lerpf(155.0, 46.0, minf(1.0, progress * 2.5))
		phase += freq / SAMPLE_RATE
		var env := pow(1.0 - progress, 2.2)
		samples[i] = sin(phase * TAU) * env * volume
	return _samples_to_wav(samples)


static func make_snare(volume: float = 0.45) -> AudioStreamWAV:
	var duration := 0.14
	var n := int(duration * SAMPLE_RATE)
	var samples := PackedFloat32Array()
	samples.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var progress := float(i) / float(n)
		var noise := rng.randf_range(-1.0, 1.0) * pow(1.0 - progress, 2.4)
		var body := sin(t * 185.0 * TAU) * pow(1.0 - progress, 3.5) * 0.5
		samples[i] = (noise * 0.65 + body) * volume
	return _samples_to_wav(samples)


static func make_hihat(volume: float = 0.22) -> AudioStreamWAV:
	var duration := 0.055
	var n := int(duration * SAMPLE_RATE)
	var samples := PackedFloat32Array()
	samples.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 108
	var prev := 0.0
	for i in range(n):
		var progress := float(i) / float(n)
		var raw := rng.randf_range(-1.0, 1.0)
		var hp := raw - prev * 0.85
		prev = raw
		samples[i] = hp * pow(1.0 - progress, 3.0) * volume
	return _samples_to_wav(samples)


static func make_miss_buzz(volume: float = 0.35) -> AudioStreamWAV:
	var duration := 0.16
	var n := int(duration * SAMPLE_RATE)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var progress := float(i) / float(n)
		var env := (1.0 - progress)
		var s := _wave_sample(t * 110.0, "saw") * 0.6 + _wave_sample(t * 116.0, "saw") * 0.4
		samples[i] = s * env * volume
	return _samples_to_wav(samples)


static func _mix_kick(buf: PackedFloat32Array, start_idx: int, vol: float) -> void:
	var n := int(0.16 * SAMPLE_RATE)
	var phase := 0.0
	for i in range(n):
		var idx := start_idx + i
		if idx >= buf.size():
			break
		var p := float(i) / float(n)
		var freq := lerpf(140.0, 44.0, minf(1.0, p * 2.5))
		phase += freq / SAMPLE_RATE
		buf[idx] += sin(phase * TAU) * pow(1.0 - p, 2.2) * vol


static func _mix_hat(buf: PackedFloat32Array, start_idx: int, vol: float) -> void:
	var n := int(0.045 * SAMPLE_RATE)
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var prev := 0.0
	for i in range(n):
		var idx := start_idx + i
		if idx >= buf.size():
			break
		var p := float(i) / float(n)
		var raw := rng.randf_range(-1.0, 1.0)
		var hp := raw - prev * 0.85
		prev = raw
		buf[idx] += hp * pow(1.0 - p, 3.0) * vol


static func _mix_bass(buf: PackedFloat32Array, start_idx: int, freq: float, dur: float, vol: float) -> void:
	var n := int(dur * SAMPLE_RATE)
	var attack := mini(int(0.008 * SAMPLE_RATE), n / 4)
	for i in range(n):
		var idx := start_idx + i
		if idx >= buf.size():
			break
		var t := float(i) / SAMPLE_RATE
		var env := 1.0
		if i < attack:
			env = float(i) / maxf(1.0, float(attack))
		else:
			env = pow(float(n - i) / maxf(1.0, float(n - attack)), 1.4)
		buf[idx] += _wave_sample(t * freq, "triangle") * env * vol


static func make_backing_loop(bpm: float, style: String = "forge") -> AudioStreamWAV:
	var beat_sec := 60.0 / bpm
	var total_beats := 16 # 4 bars of 4/4
	var total_sec := beat_sec * total_beats
	var total_samples := int(round(total_sec * SAMPLE_RATE))
	var buf := PackedFloat32Array()
	buf.resize(total_samples)

	var bass_roots := [110.0, 110.0, 130.81, 146.83] # A2, A2, C3, D3
	if style == "factory":
		bass_roots = [130.81, 146.83, 164.81, 146.83] # C3, D3, E3, D3
	elif style == "choir":
		bass_roots = [146.83, 130.81, 110.0, 123.47] # D3, C3, A2, B2

	for b in range(total_beats):
		var s_idx := int(round(b * beat_sec * SAMPLE_RATE))
		var half_idx := int(round((b + 0.5) * beat_sec * SAMPLE_RATE))
		var bar := b / 4
		var beat_in_bar := b % 4

		# Kick on 0 and 2, subtle hihat on offbeats
		if beat_in_bar == 0 or beat_in_bar == 2:
			_mix_kick(buf, s_idx, 0.36)
		else:
			_mix_hat(buf, s_idx, 0.14)
		_mix_hat(buf, half_idx, 0.10)

		# Simple groovy bassline
		var root: float = bass_roots[bar % bass_roots.size()]
		if beat_in_bar == 0:
			_mix_bass(buf, s_idx, root, beat_sec * 0.75, 0.22)
		elif beat_in_bar == 2:
			_mix_bass(buf, s_idx, root * 1.5, beat_sec * 0.45, 0.18)
		elif beat_in_bar == 3:
			_mix_bass(buf, half_idx, root * 1.25, beat_sec * 0.4, 0.15)

	return _samples_to_wav(buf, true)
