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


static func make_teacher_cue(pitch_hz: float = 660.0, duration: float = 0.13, is_offbeat: bool = false) -> AudioStreamWAV:
	var n := maxi(1, int(duration * SAMPLE_RATE))
	var samples := PackedFloat32Array()
	samples.resize(n)
	var click_len := mini(n, int(0.018 * SAMPLE_RATE))
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var p := float(i) / float(n)
		# Layer 1: Woodblock / Cowbell 15ms Transient
		var click := 0.0
		if i < click_len:
			var cp := float(i) / float(click_len)
			var cf := lerpf(2100.0 if is_offbeat else 1680.0, 900.0, cp)
			click = _wave_sample(t * cf, "square" if is_offbeat else "triangle") * (1.0 - cp) * 0.45
		# Layer 2: Formant-rich Vocal Body
		var env := minf(1.0, float(i) / (0.008 * SAMPLE_RATE)) * pow(1.0 - p, 1.6)
		var body := (sin(t * pitch_hz * TAU) * 0.65 + sin(t * pitch_hz * 2.0 * TAU) * 0.25 + sin(t * pitch_hz * 3.0 * TAU) * 0.12) * env * 0.48
		samples[i] = click + body
	return _samples_to_wav(samples)


static func make_charge_cue(start_hz: float = 260.0, end_hz: float = 620.0, duration: float = 0.75) -> AudioStreamWAV:
	var n := maxi(1, int(duration * SAMPLE_RATE))
	var samples := PackedFloat32Array()
	samples.resize(n)
	var phase := 0.0
	for i in range(n):
		var p := float(i) / float(n)
		var freq := lerpf(start_hz, end_hz, p * p)
		phase += freq / SAMPLE_RATE
		var env := minf(1.0, p * 8.0) * (1.0 - p * 0.35)
		samples[i] = (_wave_sample(phase, "saw") * 0.35 + sin(phase * TAU) * 0.45) * env * 0.42
	return _samples_to_wav(samples)


static func make_anvil_foley(heavy: bool = false) -> AudioStreamWAV:
	var duration := 0.28 if heavy else 0.20
	var n := int(duration * SAMPLE_RATE)
	var samples := PackedFloat32Array()
	samples.resize(n)
	var phase := 0.0
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var p := float(i) / float(n)
		# Sub-bass punch
		var sub_f := lerpf(135.0, 44.0, minf(1.0, p * 3.0))
		phase += sub_f / SAMPLE_RATE
		var sub := sin(phase * TAU) * pow(1.0 - p, 2.5) * (0.65 if heavy else 0.48)
		# Metallic anvil ring
		var ring := (sin(t * 1480.0 * TAU) + sin(t * 2210.0 * TAU) * 0.7 + sin(t * 3320.0 * TAU) * 0.4) * pow(1.0 - p, 2.0) * 0.22
		# Crisp 25ms transient click
		var click := rng.randf_range(-1.0, 1.0) * maxf(0.0, 1.0 - p * 8.0) * 0.35
		samples[i] = sub + ring + click
	return _samples_to_wav(samples)


static func make_barely_thud() -> AudioStreamWAV:
	var duration := 0.12
	var n := int(duration * SAMPLE_RATE)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in range(n):
		var t := float(i) / SAMPLE_RATE
		var p := float(i) / float(n)
		samples[i] = sin(t * lerpf(200.0, 90.0, p) * TAU) * pow(1.0 - p, 2.0) * 0.32
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
