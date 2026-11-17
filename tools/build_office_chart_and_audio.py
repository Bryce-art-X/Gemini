import json
import math
import os
import subprocess
import wave
import numpy as np

SR = 44100
BPM = 118.0
BEAT_SEC = 60.0 / BPM
TOTAL_BEATS = 144
TOTAL_SEC = TOTAL_BEATS * BEAT_SEC
N_SAMPLES = int(round(TOTAL_SEC * SR))

PROJ = r"C:\Users\ymxiong\.gemini\antigravity\scratch\rhythm-heaven-mini"
AUDIO_GODOT = os.path.join(PROJ, "assets", "audio")
AUDIO_WEB = os.path.join(PROJ, "docs", "assets", "audio")
DATA_GODOT = os.path.join(PROJ, "assets", "data")
DATA_WEB = os.path.join(PROJ, "docs", "data")

for d in (AUDIO_GODOT, AUDIO_WEB, DATA_GODOT, DATA_WEB):
    os.makedirs(d, exist_ok=True)


def save_wav_stereo(path, stereo_arr):
    arr = np.clip(stereo_arr, -1.0, 1.0)
    pcm = (arr * 32767.0).astype(np.int16)
    interleaved = pcm.T.reshape(-1)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(interleaved.tobytes())


def save_wav_mono(path, mono_arr):
    arr = np.clip(mono_arr, -1.0, 1.0)
    pcm = (arr * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def wav_to_ogg_and_mp3(wav_path, ogg_path, mp3_path):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "6", ogg_path],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "libmp3lame", "-b:a", "160k", mp3_path],
        check=True,
    )


def midi_to_hz(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


# City-Pop / Office Funk Progression
CHORDS = {
    "Fmaj7": [53, 60, 64, 69],
    "G7":    [55, 59, 62, 65],
    "Em7":   [52, 59, 62, 67],
    "Am7":   [57, 60, 64, 67],
    "Dm7":   [50, 57, 60, 65],
    "Cmaj7": [48, 55, 59, 64],
    "C7":    [48, 55, 58, 64],
    "Am9":   [57, 64, 67, 71],
    "Cmaj9": [48, 55, 59, 62, 64],
}
CHORD_LIST = ["Fmaj7", "G7", "Em7", "Am7", "Dm7", "Cmaj7", "C7", "Cmaj9"]
CHORD_TO_IDX = {name: i for i, name in enumerate(CHORD_LIST)}

BASS_ROOTS = {
    "Fmaj7": 41, "G7": 43, "Em7": 40, "Am7": 45,
    "Dm7": 38, "Cmaj7": 36, "C7": 36, "Am9": 45, "Cmaj9": 36,
}

# 36 bars x 4 beats = 144 beats
BAR_CHORDS = [
    # Bars 0..7: Practice
    "Fmaj7", "G7", "Em7", "Am7", "Dm7", "G7", "Cmaj7", "C7",
    # Bars 8..15: Verse A
    "Fmaj7", "Em7", "Dm7", "Cmaj7", "Fmaj7", "Em7", "Dm7", "G7",
    # Bars 16..23: Chorus B
    "Fmaj7", "G7", "Em7", "Am7", "Dm7", "G7", "Cmaj7", "C7",
    # Bars 24..29: Corridor Blackout
    "Am9", "Am9", "Dm7", "G7", "Am9", "G7",
    # Bars 30..35: Final Climax -> 18:00
    "Fmaj7", "G7", "Em7", "Am7", "Dm7", "Cmaj9",
]


def build_chart():
    cues = []
    targets = []

    def chord_idx_at(beat):
        bar = min(len(BAR_CHORDS) - 1, max(0, int(beat // 4)))
        name = BAR_CHORDS[bar]
        return CHORD_TO_IDX.get(name, 5)

    def add_patrol(spawn_beat, with_offbeat=False, practice=False, blind=False):
        hit_beat = spawn_beat + 3.0
        for step_i in range(3):
            cues.append({
                "beat": spawn_beat + step_i,
                "kind": "step",
                "step": step_i + 1,
                "spawn_beat": spawn_beat,
                "hit_beat": hit_beat,
                "practice": practice,
                "blind": blind,
            })
        cues.append({
            "beat": hit_beat,
            "kind": "boss_peek",
            "duration": 0.9 if not with_offbeat else 0.45,
            "practice": practice,
            "blind": blind,
        })
        targets.append({
            "beat": hit_beat,
            "spawn_beat": spawn_beat,
            "kind": "patrol",
            "practice": practice,
            "blind": blind,
            "chord_idx": chord_idx_at(hit_beat),
        })
        if with_offbeat:
            turn_cue = hit_beat + 0.5
            off_hit = hit_beat + 1.5  # exact +1 beat after turn_cue!
            cues.append({
                "beat": turn_cue,
                "kind": "turnaround",
                "hit_beat": off_hit,
                "practice": practice,
                "blind": blind,
            })
            cues.append({
                "beat": off_hit,
                "kind": "boss_peek",
                "duration": 0.85,
                "is_offbeat": True,
                "practice": practice,
                "blind": blind,
            })
            targets.append({
                "beat": off_hit,
                "spawn_beat": turn_cue,
                "kind": "offbeat",
                "practice": practice,
                "blind": blind,
                "chord_idx": chord_idx_at(off_hit),
            })

    def add_hold(spawn_beat, hold_beats=3.0, practice=False, blind=False):
        start_hit = spawn_beat + 3.0
        end_hit = start_hit + hold_beats
        cues.append({
            "beat": spawn_beat,
            "kind": "step",
            "step": 1,
            "spawn_beat": spawn_beat,
            "hit_beat": start_hit,
            "practice": practice,
            "blind": blind,
        })
        cues.append({
            "beat": spawn_beat + 1.0,
            "kind": "step",
            "step": 2,
            "spawn_beat": spawn_beat,
            "hit_beat": start_hit,
            "practice": practice,
            "blind": blind,
        })
        cues.append({
            "beat": spawn_beat + 2.0,
            "kind": "cough",
            "spawn_beat": spawn_beat,
            "hit_beat": start_hit,
            "hold_beats": hold_beats,
            "practice": practice,
            "blind": blind,
        })
        cues.append({
            "beat": start_hit,
            "kind": "boss_stare",
            "duration": hold_beats,
            "practice": practice,
            "blind": blind,
        })
        cues.append({
            "beat": end_hit - 1.0,
            "kind": "hmm_leave",
            "hit_beat": end_hit,
            "practice": practice,
            "blind": blind,
        })
        targets.append({
            "beat": start_hit,
            "spawn_beat": spawn_beat,
            "kind": "hold_start",
            "end_beat": end_hit,
            "practice": practice,
            "blind": blind,
            "chord_idx": chord_idx_at(start_hit),
        })
        targets.append({
            "beat": end_hit,
            "spawn_beat": end_hit - 1.0,
            "kind": "hold_release",
            "start_beat": start_hit,
            "practice": practice,
            "blind": blind,
            "chord_idx": chord_idx_at(end_hit),
        })

    # Practice (Bars 0..7, beats 0..31)
    for i in range(4):
        cues.append({"beat": float(i + 4), "kind": "count_in", "num": 4 - i})
    add_patrol(8.0, practice=True)
    add_patrol(12.0, practice=True)
    add_hold(16.0, hold_beats=3.0, practice=True)
    add_patrol(24.0, with_offbeat=True, practice=True)
    cues.append({"beat": 30.0, "kind": "practice_done"})

    # Verse A (Beats 32..63)
    add_patrol(32.0)
    add_patrol(36.0)
    add_hold(40.0, hold_beats=3.0)
    add_patrol(48.0, with_offbeat=True)
    add_patrol(56.0)

    # Chorus B (Beats 64..95)
    add_patrol(64.0)
    add_patrol(68.0)
    add_hold(72.0, hold_beats=3.0)
    add_patrol(80.0, with_offbeat=True)
    add_hold(88.0, hold_beats=3.0)

    # Corridor Blackout (Beats 96..119)
    cues.append({"beat": 96.0, "kind": "blackout_on"})
    add_patrol(96.0, blind=True)
    add_patrol(100.0, blind=True)
    add_hold(104.0, hold_beats=3.0, blind=True)
    cues.append({"beat": 112.0, "kind": "blackout_off"})
    add_patrol(112.0, with_offbeat=True, blind=False)

    # Final Climax -> 18:00 Bell (Beats 120..143)
    add_patrol(120.0)
    add_patrol(124.0)
    add_hold(128.0, hold_beats=3.0)
    add_patrol(136.0, with_offbeat=True)
    cues.append({"beat": 142.0, "kind": "bell_1800"})

    cues.sort(key=lambda x: x["beat"])
    targets.sort(key=lambda x: x["beat"])
    return {
        "id": "office_slacker",
        "title": "社畜摸鱼防老板！Office Slacker!",
        "bpm": BPM,
        "total_beats": TOTAL_BEATS,
        "cues": cues,
        "targets": targets,
    }


# --- Vectorized Audio DSP Helpers ---
def add_slice(buf, start_s, sig_l, sig_r=None):
    if sig_r is None:
        sig_r = sig_l
    if start_s >= buf.shape[1]:
        return
    s0 = max(0, start_s)
    off = s0 - start_s
    avail = min(len(sig_l) - off, buf.shape[1] - s0)
    if avail > 0:
        buf[0, s0:s0 + avail] += sig_l[off:off + avail]
        buf[1, s0:s0 + avail] += sig_r[off:off + avail]


def synth_rhodes_note(freq, dur, vol=0.22):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    att = np.minimum(1.0, t / 0.006)
    dec = np.exp(-t * 3.0)
    tine = np.sin(2 * np.pi * freq * 3.0 * t) * np.exp(-t * 22.0) * 0.42
    body = np.sin(2 * np.pi * freq * t + tine)
    sub = np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 8.5) * 0.16
    return (body + sub) * att * dec * vol


def synth_rhodes_chord(midi_notes, dur, vol=0.24):
    n = int(dur * SR)
    l_out = np.zeros(n, dtype=np.float64)
    r_out = np.zeros(n, dtype=np.float64)
    per = vol / max(1, len(midi_notes))
    for i, m in enumerate(midi_notes):
        sig = synth_rhodes_note(midi_to_hz(m), dur, per)
        pan = -0.35 + 0.7 * (i / max(1, len(midi_notes) - 1))
        l_out += sig * math.cos((pan + 1) * math.pi / 4)
        r_out += sig * math.sin((pan + 1) * math.pi / 4)
    return l_out, r_out


def synth_clav_note(midi_note, dur, vol=0.14):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    f = midi_to_hz(midi_note)
    att = np.minimum(1.0, t / 0.002)
    dec = np.exp(-t * 14.0)
    bright = (np.sin(2 * np.pi * f * t) * 0.55
              + np.sin(2 * np.pi * f * 2 * t) * 0.45
              + np.sin(2 * np.pi * f * 3 * t) * 0.30
              + np.sin(2 * np.pi * f * 5 * t) * 0.15)
    return np.tanh(bright * 1.4) * att * dec * vol


def synth_slap_bass(midi_note, dur, vol=0.36):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    f = midi_to_hz(midi_note)
    att = np.minimum(1.0, t / 0.004)
    dec = np.exp(-t * 7.2)
    pluck = np.exp(-t * 28.0)
    sig = (
        np.sin(2 * np.pi * f * t) * 0.74
        + np.sin(2 * np.pi * f * 2.0 * t) * (0.28 + 0.36 * pluck)
        + np.sin(2 * np.pi * f * 3.0 * t) * 0.22 * pluck
    )
    return sig * att * dec * vol


def synth_lead_note(midi_note, dur, vol=0.16):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    f = midi_to_hz(midi_note)
    att = np.minimum(1.0, t / 0.012)
    rel = np.minimum(1.0, (dur - t) / 0.03)
    vib = 1.0 + 0.0045 * np.sin(2 * np.pi * 6.0 * t) * np.minimum(1.0, t / 0.12)
    phase = np.cumsum(2 * np.pi * f * vib / SR)
    bright = np.exp(-t * 4.8)
    sig = np.sin(phase) * 0.65 + np.sin(2 * phase) * (0.25 + 0.22 * bright) + np.sin(3 * phase) * 0.12 * bright
    return sig * att * rel * vol


def synth_kick(vol=0.72):
    n = int(0.24 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    freq = 44.0 + 118.0 * np.exp(-t * 36.0)
    phase = np.cumsum(2 * np.pi * freq / SR)
    env = np.exp(-t * 13.0) * np.minimum(1.0, t / 0.002)
    click = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120.0) * 0.20
    return np.tanh((np.sin(phase) * env + click) * 1.3) * vol


def synth_snare(rng, vol=0.38):
    n = int(0.18 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    body = np.sin(2 * np.pi * (185.0 + 80 * np.exp(-t * 45)) * t) * np.exp(-t * 24.0) * 0.52
    noise = rng.uniform(-1.0, 1.0, n)
    hp = noise - np.concatenate(([0.0], noise[:-1])) * 0.72
    snappy = hp * np.exp(-t * 18.0) * 0.68
    return (body + snappy) * vol


def synth_rim(vol=0.28):
    n = int(0.06 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    return (np.sin(2 * np.pi * 880 * t) * 0.55 + np.sin(2 * np.pi * 1580 * t) * 0.45) * np.exp(-t * 58.0) * vol


def synth_hat(rng, open_hat=False, vol=0.14):
    dur = 0.18 if open_hat else 0.055
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    noise = rng.uniform(-1.0, 1.0, n)
    hp = noise - np.concatenate(([0.0], noise[:-1])) * 0.88
    decay = 14.0 if open_hat else 65.0
    return hp * np.exp(-t * decay) * vol


def build_bgm(chart):
    rng = np.random.default_rng(1999)
    buf = np.zeros((2, N_SAMPLES), dtype=np.float64)
    target_beats = [t["beat"] for t in chart["targets"]]

    def has_target_near(b):
        return any(abs(tb - b) < 0.15 for tb in target_beats)

    kick = synth_kick(0.68)
    snare = synth_snare(rng, 0.35)
    rim = synth_rim(0.24)
    hat_c = synth_hat(rng, False, 0.12)
    hat_o = synth_hat(rng, True, 0.11)

    verse_hook = [
        (0.0, 72, 0.45), (0.5, 74, 0.4), (1.0, 76, 0.65), (2.0, 79, 0.45), (2.5, 76, 0.45), (3.0, 74, 0.7),
        (4.0, 72, 0.45), (4.5, 74, 0.4), (5.0, 76, 0.65), (6.0, 74, 0.45), (6.5, 72, 0.45), (7.0, 71, 0.7),
    ]
    chorus_hook = [
        (0.0, 76, 0.4), (0.5, 79, 0.4), (1.0, 81, 0.8), (2.0, 79, 0.45), (2.5, 76, 0.4), (3.0, 79, 0.75),
        (4.0, 77, 0.4), (4.5, 76, 0.4), (5.0, 74, 0.8), (6.0, 72, 0.45), (6.5, 74, 0.45), (7.0, 76, 0.8),
    ]

    for bar_idx, cname in enumerate(BAR_CHORDS):
        bar_beat = bar_idx * 4.0
        is_intro = bar_idx < 8
        is_verse = 8 <= bar_idx < 16
        is_chorus = 16 <= bar_idx < 24
        is_blackout = 24 <= bar_idx < 30
        is_climax = bar_idx >= 30
        chord_notes = CHORDS[cname]

        # 1. Warm Rhodes Chords
        if not (25 <= bar_idx <= 27):
            if is_intro:
                l, r = synth_rhodes_chord(chord_notes, BEAT_SEC * 3.4, 0.21)
                add_slice(buf, int(bar_beat * BEAT_SEC * SR), l, r)
            else:
                l1, r1 = synth_rhodes_chord(chord_notes, BEAT_SEC * 1.6, 0.23)
                add_slice(buf, int(bar_beat * BEAT_SEC * SR), l1, r1)
                if not has_target_near(bar_beat + 2.5):
                    l2, r2 = synth_rhodes_chord(chord_notes, BEAT_SEC * 1.1, 0.19)
                    add_slice(buf, int((bar_beat + 2.5) * BEAT_SEC * SR), l2, r2)

        # 2. Funky Office Clavinet Comp (omits exact target beats!)
        if is_verse or is_chorus or is_climax:
            for c_off in (0.5, 1.5, 2.5):
                cb = bar_beat + c_off
                if has_target_near(cb):
                    continue
                for n in chord_notes[1:]:
                    cs = synth_clav_note(n + 12, BEAT_SEC * 0.28, 0.085)
                    add_slice(buf, int(round(cb * BEAT_SEC * SR)), cs, cs * 0.9)

        # 3. Slap Bass
        root = BASS_ROOTS[cname]
        bass_pattern = [(0.0, 0, 0.45), (1.5, 12, 0.35), (2.0, 0, 0.45), (3.0, 7, 0.35), (3.5, 12, 0.32)]
        if is_blackout:
            bass_pattern = [(0.0, 0, 0.70), (2.0, 0, 0.60)]
        for off_b, semi, dur_b in bass_pattern:
            b_pos = bar_beat + off_b
            b_sig = synth_slap_bass(root + semi, BEAT_SEC * dur_b, 0.33 if not is_intro else 0.25)
            add_slice(buf, int(b_pos * BEAT_SEC * SR), b_sig * 0.9, b_sig * 0.9)

        # 4. City-Pop Synth Hook
        if bar_idx % 2 == 0 and not is_blackout:
            hook = chorus_hook if (is_chorus or is_climax) else verse_hook
            oct_shift = 12 if is_climax else 0
            vol_lead = 0.10 if is_intro else (0.15 if is_verse else 0.19)
            for off_b, midi_n, dur_b in hook:
                b_pos = bar_beat + off_b
                if has_target_near(b_pos):
                    continue  # Missing Instrument Principle!
                sig = synth_lead_note(midi_n + oct_shift, BEAT_SEC * dur_b, vol_lead)
                add_slice(buf, int(b_pos * BEAT_SEC * SR), sig * 0.85, sig * 0.95)

        # 5. Drums (Missing Instrument Principle: drop snare on Beat 3 whenever player hits Beat 3!)
        for beat_in_bar in range(4):
            b = bar_beat + beat_in_bar
            s_idx = int(round(b * BEAT_SEC * SR))
            if beat_in_bar in (0, 2):
                add_slice(buf, s_idx, kick)
            elif not has_target_near(b):
                if is_blackout:
                    add_slice(buf, s_idx, rim)
                else:
                    add_slice(buf, s_idx, snare)

            if (is_chorus or is_climax) and beat_in_bar == 2 and not has_target_near(b + 0.5):
                add_slice(buf, int(round((b + 0.5) * BEAT_SEC * SR)), kick * 0.70)

            if not (25 <= bar_idx <= 27):
                add_slice(buf, s_idx, hat_c)
                if not has_target_near(b + 0.5):
                    add_slice(buf, int(round((b + 0.5) * BEAT_SEC * SR)), hat_o if (beat_in_bar == 3 and is_chorus) else hat_c)

    # Final 18:00 Triumph Crash at beat 142
    crash_idx = int(round(142.0 * BEAT_SEC * SR))
    l_end, r_end = synth_rhodes_chord(CHORDS["Cmaj9"], 1.2, 0.34)
    add_slice(buf, crash_idx, l_end, r_end)

    buf = np.tanh(buf * 1.12)
    peak = np.max(np.abs(buf))
    if peak > 0:
        buf = buf * (0.84 / peak)

    wav_tmp = os.path.join(AUDIO_GODOT, "_tmp_bgm_main.wav")
    save_wav_stereo(wav_tmp, buf)
    wav_to_ogg_and_mp3(
        wav_tmp,
        os.path.join(AUDIO_GODOT, "bgm_main.ogg"),
        os.path.join(AUDIO_WEB, "bgm_main.mp3"),
    )
    os.remove(wav_tmp)

    # Slice catchy Chorus bars 16..23 (beats 64..96) as Title BGM loop!
    s_start = int(round(64.0 * BEAT_SEC * SR))
    s_end = int(round(96.0 * BEAT_SEC * SR))
    title_buf = buf[:, s_start:s_end].copy()
    fade = int(0.03 * SR)
    title_buf[:, :fade] *= np.linspace(0, 1, fade)
    title_buf[:, -fade:] *= np.linspace(1, 0, fade)
    wav_title = os.path.join(AUDIO_GODOT, "_tmp_bgm_title.wav")
    save_wav_stereo(wav_title, title_buf)
    wav_to_ogg_and_mp3(
        wav_title,
        os.path.join(AUDIO_GODOT, "bgm_title.ogg"),
        os.path.join(AUDIO_WEB, "bgm_title.mp3"),
    )
    os.remove(wav_title)


def build_sfx():
    rng = np.random.default_rng(4242)

    def write_both(name, mono):
        peak = np.max(np.abs(mono))
        if peak > 0:
            mono = mono * (0.90 / peak)
        save_wav_mono(os.path.join(AUDIO_GODOT, name), mono)
        save_wav_mono(os.path.join(AUDIO_WEB, name), mono)

    # 1. Boss Dress-Shoe Footsteps 1, 2, 3 (getting louder + brighter + glass-latch on 3!)
    for idx, (pitch_base, bright_cut, latch) in enumerate((
        (115.0, 0.35, False),
        (132.0, 0.55, False),
        (152.0, 0.85, True),
    ), start=1):
        n = int(0.14 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        heel = np.sin(np.cumsum(2 * np.pi * (pitch_base + 190 * np.exp(-t * 55)) / SR)) * np.exp(-t * 32)
        tap = rng.uniform(-1, 1, n)
        tap = (tap - np.concatenate(([0.0], tap[:-1])) * 0.65) * np.exp(-t * 68) * bright_cut * 0.65
        sig = heel * (0.55 + idx * 0.12) + tap
        if latch:
            # Subtle sharp metallic doorknob click + glass chime telling player "NEXT BEAT = HIT!"
            click = (np.sin(2 * np.pi * 1760 * t) * 0.45 + np.sin(2 * np.pi * 2640 * t) * 0.3) * np.exp(-t * 28)
            sig += click
        write_both(f"cue_step_{idx}.wav", np.tanh(sig * 1.35))

    # 2. Count-in Rim / Cowbell
    nc = int(0.10 * SR)
    tc = np.arange(nc, dtype=np.float64) / SR
    cnt = (np.sin(2 * np.pi * 660 * tc) + 0.5 * np.sin(2 * np.pi * 990 * tc)) * np.exp(-tc * 34)
    write_both("cue_count.wav", cnt)

    # 3. Boss Throat-Clear ("Ahem!" Hold Start Cue!)
    n_c = int(0.28 * SR)
    tc = np.arange(n_c, dtype=np.float64) / SR
    noise_c = rng.uniform(-1, 1, n_c)
    hp_c = noise_c - np.concatenate(([0.0], noise_c[:-1])) * 0.5
    pulse1 = np.exp(-((tc - 0.05) / 0.032) ** 2)
    pulse2 = np.exp(-((tc - 0.16) / 0.045) ** 2)
    throat = np.sin(2 * np.pi * (148.0 + 38.0 * (tc / 0.28)) * tc) * 0.55 + np.sin(2 * np.pi * 440 * tc) * 0.25
    chime_c = np.sin(2 * np.pi * 880 * tc) * np.exp(-tc * 18) * 0.35
    cough = (throat + hp_c * 0.55) * (pulse1 * 0.75 + pulse2 * 1.0) + chime_c
    write_both("cue_cough.wav", np.tanh(cough * 1.4))

    # 4. Boss Satisfied Grunt + Walk Away ("Mmm~" Hold Release Cue!)
    n_h = int(0.24 * SR)
    th = np.arange(n_h, dtype=np.float64) / SR
    f_h = 220.0 - 75.0 * (th / 0.24)
    hum = np.sin(np.cumsum(2 * np.pi * f_h / SR)) * np.minimum(1.0, th / 0.015) * np.exp(-th * 8.0) * 0.7
    bell_rel = np.sin(2 * np.pi * 1174.66 * th) * np.exp(-th * 16.0) * 0.45
    write_both("cue_hmm.wav", np.tanh((hum + bell_rel) * 1.25))

    # 5. Sudden Turnaround ("哦对了! ZIP!") Cue (0.22s bright double-take cue!)
    n_t = int(0.22 * SR)
    tt = np.arange(n_t, dtype=np.float64) / SR
    glide_t = 480.0 * (2.5 ** (tt / 0.16))
    zipper = np.sin(np.cumsum(2 * np.pi * glide_t / SR)) * np.exp(-tt * 14.0) * 0.65
    spark = (np.sin(2 * np.pi * 1318.5 * tt) + 0.5 * np.sin(2 * np.pi * 1975.5 * tt)) * np.exp(-tt * 22.0) * 0.6
    write_both("cue_turnaround.wav", np.tanh((zipper + spark) * 1.2))

    # 6. Player Mechanical Keyboard Ace Foley (punchy switch thock + crisp Alt+Tab confirm blip)
    n_k = int(0.18 * SR)
    tk = np.arange(n_k, dtype=np.float64) / SR
    thock = np.sin(np.cumsum(2 * np.pi * (210 * np.exp(-tk * 45) + 68) / SR)) * np.exp(-tk * 26) * 0.75
    clack = rng.uniform(-1, 1, n_k)
    clack = (clack - np.concatenate(([0.0], clack[:-1])) * 0.78) * np.exp(-tk * 85) * 0.7
    blip = np.sin(2 * np.pi * 1046.5 * np.maximum(0, tk - 0.008)) * np.exp(-np.maximum(0, tk - 0.008) * 28) * 0.35
    write_both("sfx_type_ace.wav", np.tanh((thock + clack + blip) * 1.4))

    # Rapid Fake-Typing Clack (for sustain loops!)
    n_cl = int(0.08 * SR)
    tcl = np.arange(n_cl, dtype=np.float64) / SR
    cl = np.sin(np.cumsum(2 * np.pi * (280 * np.exp(-tcl * 55) + 85) / SR)) * np.exp(-tcl * 42) * 0.6
    cln = rng.uniform(-1, 1, n_cl)
    cln = (cln - np.concatenate(([0.0], cln[:-1])) * 0.8) * np.exp(-tcl * 95) * 0.5
    write_both("sfx_type_clack.wav", np.tanh((cl + cln) * 1.3))

    # Empty / Idle Nervous Tap
    n_e = int(0.055 * SR)
    te = np.arange(n_e, dtype=np.float64) / SR
    write_both("sfx_empty_tap.wav", np.sin(2 * np.pi * 340 * te) * np.exp(-te * 65) * 0.45)

    # Chip Crunch (Release back to Slacking!)
    n_cr = int(0.20 * SR)
    tcr = np.arange(n_cr, dtype=np.float64) / SR
    cr_env = np.exp(-((tcr - 0.02) / 0.018) ** 2) + 0.85 * np.exp(-((tcr - 0.065) / 0.022) ** 2) + 0.55 * np.exp(-((tcr - 0.115) / 0.025) ** 2)
    cr_noise = rng.uniform(-1, 1, n_cr)
    cr_noise = cr_noise - np.concatenate(([0.0], cr_noise[:-1])) * 0.45
    cheer = np.sin(2 * np.pi * 880 * tcr) * np.exp(-tcr * 18) * 0.32
    write_both("sfx_crunch.wav", np.tanh((cr_noise * cr_env * 0.85 + cheer) * 1.25))

    # Barely Muff (awkward squeak + soft mush)
    n_b = int(0.16 * SR)
    tb = np.arange(n_b, dtype=np.float64) / SR
    bar = (np.sin(2 * np.pi * (260 - 95 * tb / 0.16) * tb) * 0.7 + np.sin(2 * np.pi * 340 * tb) * 0.3) * np.exp(-tb * 18)
    write_both("sfx_barely.wav", bar)

    # Caught! "OT! 加班!" Desk Slam + Stamp Buzzer!
    n_s = int(0.45 * SR)
    ts = np.arange(n_s, dtype=np.float64) / SR
    slam = np.sin(np.cumsum(2 * np.pi * (140 * np.exp(-ts * 18) + 42) / SR)) * np.exp(-ts * 9.0) * 0.85
    buzz = (np.sign(np.sin(2 * np.pi * 138.6 * ts)) * 0.35 + np.sign(np.sin(2 * np.pi * 146.8 * ts)) * 0.35) * np.exp(-ts * 6.5) * 0.55
    slap = rng.uniform(-1, 1, n_s) * np.exp(-ts * 55) * 0.65
    write_both("sfx_caught_stamp.wav", np.tanh((slam + buzz + slap) * 1.3))

    # Corridor Lights Off / On
    n_p = int(0.32 * SR)
    tp = np.arange(n_p, dtype=np.float64) / SR
    poff = np.sin(np.cumsum(2 * np.pi * (420 * np.exp(-tp * 10) + 52) / SR)) * np.exp(-tp * 6.5)
    pon = np.sin(np.cumsum(2 * np.pi * (160 + 680 * (tp / 0.32)) / SR)) * np.exp(-tp * 5.5)
    write_both("sfx_power_off.wav", poff)
    write_both("sfx_power_on.wav", pon)

    # 18:00 Off-Duty Chime (Crisp nostalgic 4-note school/office clock chime!)
    notes_1800 = [(0.0, 830.61), (0.22, 659.25), (0.44, 739.99), (0.68, 493.88)]
    n_bell = int(1.45 * SR)
    bell = np.zeros(n_bell, dtype=np.float64)
    for t0, f0 in notes_1800:
        idx0 = int(t0 * SR)
        seg_n = n_bell - idx0
        tsb = np.arange(seg_n, dtype=np.float64) / SR
        tone = (np.sin(2 * np.pi * f0 * tsb) * 0.7 + np.sin(2 * np.pi * f0 * 2 * tsb) * 0.25) * np.minimum(1.0, tsb / 0.008) * np.exp(-tsb * 3.8)
        bell[idx0:] += tone
    write_both("sfx_bell_1800.wav", bell)

    # 8 Bar-Matched Resolution Chords!
    for i, cname in enumerate(CHORD_LIST):
        l, r = synth_rhodes_chord(CHORDS[cname], 0.38, 0.78)
        write_both(f"chord_{i}.wav", (l + r) * 0.5)


if __name__ == "__main__":
    chart = build_chart()
    for d in (DATA_GODOT, DATA_WEB):
        with open(os.path.join(d, "office_slacker_chart.json"), "w", encoding="utf-8") as f:
            json.dump(chart, f, ensure_ascii=False, indent=2)
    print(f"Chart written: {len(chart['cues'])} cues, {len(chart['targets'])} targets")
    build_bgm(chart)
    print("BGM stems built!")
    build_sfx()
    print("All Office Slacker SFX & chords built!")
