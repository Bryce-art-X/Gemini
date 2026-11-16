import json
import math
import os
import subprocess
import wave
import numpy as np

SR = 44100
BPM = 120.0
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


# Chords (MIDI note lists)
CHORDS = {
    "Fmaj7": [53, 60, 64, 69],
    "Em7":   [52, 59, 62, 67],
    "Dm7":   [50, 57, 60, 65],
    "Cmaj7": [48, 55, 59, 64],
    "G7":    [55, 59, 62, 65],
    "Am7":   [57, 60, 64, 67],
    "C7":    [48, 55, 58, 64],
    "Am9":   [57, 64, 67, 71],
    "Cmaj9": [48, 55, 59, 62, 64],
}
CHORD_LIST = ["Fmaj7", "Em7", "Dm7", "Cmaj7", "G7", "Am7", "C7", "Cmaj9"]
CHORD_TO_IDX = {name: i for i, name in enumerate(CHORD_LIST)}

BASS_ROOTS = {
    "Fmaj7": 41, "Em7": 40, "Dm7": 38, "Cmaj7": 36,
    "G7": 43, "Am7": 45, "C7": 36, "Am9": 45, "Cmaj9": 36,
}

# 36-bar progression
BAR_CHORDS = [
    # Bars 0..7: Intro / Practice
    "Fmaj7", "G7", "Em7", "Am7", "Dm7", "G7", "Cmaj7", "C7",
    # Bars 8..15: Verse A
    "Fmaj7", "Em7", "Dm7", "Cmaj7", "Fmaj7", "Em7", "Dm7", "G7",
    # Bars 16..23: Chorus B
    "Fmaj7", "G7", "Em7", "Am7", "Dm7", "G7", "Cmaj7", "C7",
    # Bars 24..29: Blackout Break
    "Am9", "Am9", "Fmaj7", "G7", "Am9", "G7",
    # Bars 30..35: Final Climax
    "Fmaj7", "G7", "Em7", "Am7", "Dm7", "Cmaj9",
]


def build_chart():
    cues = []
    targets = []

    def chord_idx_at(beat):
        bar = min(len(BAR_CHORDS) - 1, max(0, int(beat // 4)))
        name = BAR_CHORDS[bar]
        return CHORD_TO_IDX.get(name, 3)

    def add_pass(spawn_beat, kind="normal", practice=False, blind=False):
        if kind == "normal":
            hit_beat = spawn_beat + 1.0
            cues.append({"beat": spawn_beat, "kind": "pass_normal", "hit_beat": hit_beat, "practice": practice, "blind": blind})
            targets.append({"beat": hit_beat, "spawn_beat": spawn_beat, "kind": "normal", "practice": practice, "blind": blind, "chord_idx": chord_idx_at(hit_beat), "finish_sword": True})
        elif kind == "triple":
            for i in range(3):
                sb = spawn_beat + i * 0.5
                hb = spawn_beat + 2.0 + i * 0.5
                cues.append({"beat": sb, "kind": "pass_triple", "step": i + 1, "hit_beat": hb, "practice": practice, "blind": blind})
                targets.append({"beat": hb, "spawn_beat": sb, "kind": "triple", "step": i + 1, "practice": practice, "blind": blind, "chord_idx": chord_idx_at(hb), "finish_sword": (i == 2)})
        elif kind == "heavy":
            hit_beat = spawn_beat + 2.0
            cues.append({"beat": spawn_beat, "kind": "pass_heavy", "hit_beat": hit_beat, "practice": practice, "blind": blind})
            targets.append({"beat": hit_beat, "spawn_beat": spawn_beat, "kind": "heavy", "practice": practice, "blind": blind, "chord_idx": chord_idx_at(hit_beat), "finish_sword": True})

    # Practice (Bars 0..7, beats 0..31)
    for i in range(4):
        cues.append({"beat": float(i + 4), "kind": "count_in", "num": 4 - i})
    for b in (8.0, 10.0, 12.0, 14.0):
        add_pass(b, "normal", practice=True)
    add_pass(16.0, "triple", practice=True)
    add_pass(20.0, "triple", practice=True)
    add_pass(24.0, "heavy", practice=True)
    cues.append({"beat": 28.0, "kind": "practice_done"})

    # Verse A (Beats 32..63)
    for b in (32.0, 34.0, 36.0, 38.0):
        add_pass(b, "normal")
    add_pass(40.0, "triple")
    add_pass(44.0, "normal")
    add_pass(46.0, "normal")
    add_pass(48.0, "heavy")
    add_pass(52.0, "normal")
    add_pass(54.0, "normal")
    add_pass(56.0, "heavy")
    add_pass(60.0, "triple")

    # Chorus B (Beats 64..95)
    add_pass(64.0, "normal")
    add_pass(66.0, "normal")
    add_pass(68.0, "triple")
    add_pass(72.0, "heavy")
    add_pass(76.0, "heavy")
    add_pass(80.0, "normal")
    add_pass(82.0, "normal")
    add_pass(84.0, "triple")
    add_pass(88.0, "heavy")
    add_pass(92.0, "triple")

    # Blackout Break (Beats 96..119)
    cues.append({"beat": 96.0, "kind": "blackout_on"})
    add_pass(96.0, "normal", blind=False)   # glowing iron arc visible in dark
    add_pass(98.0, "normal", blind=False)
    add_pass(100.0, "heavy", blind=False)
    cues.append({"beat": 103.5, "kind": "total_dark_on"})
    add_pass(104.0, "triple", blind=True)   # pure ear blind-test!
    add_pass(108.0, "heavy", blind=True)
    cues.append({"beat": 112.0, "kind": "blackout_off"})
    add_pass(116.0, "normal")
    add_pass(118.0, "normal")

    # Final Climax (Beats 120..143)
    add_pass(120.0, "triple")
    add_pass(124.0, "heavy")
    add_pass(128.0, "triple")
    add_pass(132.0, "triple")
    add_pass(136.0, "heavy")
    add_pass(139.0, "triple")
    cues.append({"beat": 143.0, "kind": "big_finish"})

    cues.sort(key=lambda x: x["beat"])
    targets.sort(key=lambda x: x["beat"])
    chart = {
        "id": "forge_pass",
        "title": "铁匠传球！Forge Pass!",
        "bpm": BPM,
        "total_beats": TOTAL_BEATS,
        "cues": cues,
        "targets": targets,
    }
    return chart


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
    att = np.minimum(1.0, t / 0.008)
    dec = np.exp(-t * 3.2)
    tine = np.sin(2 * np.pi * freq * 3.0 * t) * np.exp(-t * 24.0) * 0.45
    body = np.sin(2 * np.pi * freq * t + tine)
    sub = np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 9.0) * 0.18
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


def synth_slap_bass(midi_note, dur, vol=0.36):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    f = midi_to_hz(midi_note)
    att = np.minimum(1.0, t / 0.004)
    dec = np.exp(-t * 7.5)
    pluck = np.exp(-t * 28.0)
    sig = (
        np.sin(2 * np.pi * f * t) * 0.72
        + np.sin(2 * np.pi * f * 2.0 * t) * (0.28 + 0.35 * pluck)
        + np.sin(2 * np.pi * f * 3.0 * t) * 0.22 * pluck
    )
    return sig * att * dec * vol


def synth_lead_note(midi_note, dur, vol=0.16):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    f = midi_to_hz(midi_note)
    att = np.minimum(1.0, t / 0.014)
    rel = np.minimum(1.0, (dur - t) / 0.03)
    vib = 1.0 + 0.004 * np.sin(2 * np.pi * 5.8 * t) * np.minimum(1.0, t / 0.12)
    phase = np.cumsum(2 * np.pi * f * vib / SR)
    bright = np.exp(-t * 5.0)
    sig = np.sin(phase) * 0.65 + np.sin(2 * phase) * (0.25 + 0.2 * bright) + np.sin(3 * phase) * 0.12 * bright
    return sig * att * rel * vol


def synth_kick(vol=0.72):
    n = int(0.24 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    freq = 44.0 + 115.0 * np.exp(-t * 36.0)
    phase = np.cumsum(2 * np.pi * freq / SR)
    env = np.exp(-t * 13.0) * np.minimum(1.0, t / 0.002)
    click = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120.0) * 0.22
    return np.tanh((np.sin(phase) * env + click) * 1.3) * vol


def synth_snare(rng, vol=0.42):
    n = int(0.18 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    body = np.sin(2 * np.pi * (185.0 + 80 * np.exp(-t * 45)) * t) * np.exp(-t * 24.0) * 0.55
    noise = rng.uniform(-1.0, 1.0, n)
    # High-shelf emphasis
    hp = noise - np.concatenate(([0.0], noise[:-1])) * 0.72
    snappy = hp * np.exp(-t * 18.0) * 0.7
    return (body + snappy) * vol


def synth_clap(rng, vol=0.38):
    n = int(0.16 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    env = np.zeros(n)
    for delay in (0.0, 0.011, 0.022):
        idx = int(delay * SR)
        rem = n - idx
        env[idx:] += np.exp(-np.arange(rem) / SR * 26.0) * 0.45
    noise = rng.uniform(-1.0, 1.0, n)
    bp = noise - np.concatenate(([0.0], noise[:-1])) * 0.55
    return bp * env * vol


def synth_hat(rng, open_hat=False, vol=0.16):
    dur = 0.18 if open_hat else 0.055
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float64) / SR
    noise = rng.uniform(-1.0, 1.0, n)
    hp = noise - np.concatenate(([0.0], noise[:-1])) * 0.88
    decay = 14.0 if open_hat else 65.0
    return hp * np.exp(-t * decay) * vol


def build_bgm(chart):
    rng = np.random.default_rng(2026)
    buf = np.zeros((2, N_SAMPLES), dtype=np.float64)

    target_beats = [t["beat"] for t in chart["targets"]]

    def has_target_near(b):
        return any(abs(tb - b) < 0.12 for tb in target_beats)

    kick = synth_kick(0.68)
    snare = synth_snare(rng, 0.36)
    clap = synth_clap(rng, 0.32)
    hat_c = synth_hat(rng, False, 0.13)
    hat_o = synth_hat(rng, True, 0.12)

    # Melodic hook phrases (MIDI offsets relative to C major pentatonic/major7)
    verse_hook = [
        (0.0, 72, 0.45), (0.5, 74, 0.4), (1.0, 76, 0.7), (2.0, 79, 0.45), (2.5, 76, 0.45), (3.0, 74, 0.75),
        (4.0, 72, 0.45), (4.5, 74, 0.4), (5.0, 76, 0.7), (6.0, 74, 0.45), (6.5, 72, 0.45), (7.0, 71, 0.75),
    ]
    chorus_hook = [
        (0.0, 76, 0.4), (0.5, 79, 0.4), (1.0, 81, 0.85), (2.0, 79, 0.45), (2.5, 76, 0.4), (3.0, 79, 0.8),
        (4.0, 77, 0.4), (4.5, 76, 0.4), (5.0, 74, 0.85), (6.0, 72, 0.45), (6.5, 74, 0.45), (7.0, 76, 0.85),
    ]

    for bar_idx, cname in enumerate(BAR_CHORDS):
        bar_beat = bar_idx * 4.0
        is_intro = bar_idx < 8
        is_verse = 8 <= bar_idx < 16
        is_chorus = 16 <= bar_idx < 24
        is_blackout = 24 <= bar_idx < 30
        is_climax = bar_idx >= 30

        # 1. Rhodes Chords (warm lush harmony, omitted in minimal blackout bars 26..27)
        if not (26 <= bar_idx <= 27):
            chord_notes = CHORDS[cname]
            if is_intro:
                l, r = synth_rhodes_chord(chord_notes, BEAT_SEC * 3.6, 0.22)
                add_slice(buf, int(bar_beat * BEAT_SEC * SR), l, r)
            else:
                # Funky comping hits on beat 0 and beat 2.5
                l1, r1 = synth_rhodes_chord(chord_notes, BEAT_SEC * 1.8, 0.24)
                add_slice(buf, int(bar_beat * BEAT_SEC * SR), l1, r1)
                if not has_target_near(bar_beat + 2.5):
                    l2, r2 = synth_rhodes_chord(chord_notes, BEAT_SEC * 1.2, 0.20)
                    add_slice(buf, int((bar_beat + 2.5) * BEAT_SEC * SR), l2, r2)

        # 2. Funky Slap Bass
        root = BASS_ROOTS[cname]
        bass_pattern = [(0.0, 0, 0.45), (1.5, 12, 0.35), (2.0, 0, 0.45), (3.0, 7, 0.35), (3.5, 12, 0.35)]
        if is_blackout:
            bass_pattern = [(0.0, 0, 0.65), (2.0, 0, 0.55)]
        for off_b, semi, dur_b in bass_pattern:
            b_pos = bar_beat + off_b
            b_sig = synth_slap_bass(root + semi, BEAT_SEC * dur_b, 0.34 if not is_intro else 0.26)
            add_slice(buf, int(b_pos * BEAT_SEC * SR), b_sig * 0.9, b_sig * 0.9)

        # 3. Lead Hook Melody (every 2 bars on even bars)
        if bar_idx % 2 == 0 and not is_blackout:
            hook = chorus_hook if (is_chorus or is_climax) else verse_hook
            oct_shift = 12 if is_climax else 0
            vol_lead = 0.11 if is_intro else (0.16 if is_verse else 0.20)
            for off_b, midi_n, dur_b in hook:
                b_pos = bar_beat + off_b
                if has_target_near(b_pos):
                    continue  # Missing Instrument Principle!
                sig = synth_lead_note(midi_n + oct_shift, BEAT_SEC * dur_b, vol_lead)
                add_slice(buf, int(b_pos * BEAT_SEC * SR), sig * 0.85, sig * 0.95)

        # 4. Drums (Missing Instrument Principle: drop snare/clap if player hits there!)
        for beat_in_bar in range(4):
            b = bar_beat + beat_in_bar
            s_idx = int(round(b * BEAT_SEC * SR))
            if beat_in_bar in (0, 2):
                add_slice(buf, s_idx, kick)
            elif not has_target_near(b):
                if is_blackout:
                    add_slice(buf, s_idx, clap)
                else:
                    add_slice(buf, s_idx, snare)

            # Syncopated kick on 2.5 in Chorus/Climax
            if (is_chorus or is_climax) and beat_in_bar == 2 and not has_target_near(b + 0.5):
                add_slice(buf, int(round((b + 0.5) * BEAT_SEC * SR)), kick * 0.72)

            # Hi-hat / Shaker 8ths (mute during total blackout bars 26..27)
            if not (26 <= bar_idx <= 27):
                add_slice(buf, s_idx, hat_c)
                if not has_target_near(b + 0.5):
                    add_slice(buf, int(round((b + 0.5) * BEAT_SEC * SR)), hat_o if (beat_in_bar == 3 and is_chorus) else hat_c)

    # Final Big Crash at beat 143
    crash_idx = int(round(143.0 * BEAT_SEC * SR))
    l_end, r_end = synth_rhodes_chord(CHORDS["Cmaj9"], 1.0, 0.35)
    add_slice(buf, crash_idx, l_end, r_end)

    # Master soft saturation & normalize to -1.5 dBFS
    buf = np.tanh(buf * 1.15)
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

    # Also slice bars 16..23 (beats 64..96) as a catchy 16-second Title Screen loop!
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
    rng = np.random.default_rng(777)

    def write_both(name, mono):
        peak = np.max(np.abs(mono))
        if peak > 0:
            mono = mono * (0.90 / peak)
        save_wav_mono(os.path.join(AUDIO_GODOT, name), mono)
        save_wav_mono(os.path.join(AUDIO_WEB, name), mono)

    # 1. Teacher Master Forge Pings (Woodblock + bright harmonic ping)
    for idx, freq in enumerate((698.46, 783.99, 880.0), start=1):
        n = int(0.16 * SR)
        t = np.arange(n, dtype=np.float64) / SR
        wood = np.sin(2 * np.pi * (freq * 2.2) * np.exp(-t * 35) * t) * np.exp(-t * 45) * 0.45
        chime = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.0 * t)) * np.exp(-t * 16.0) * 0.65
        write_both(f"cue_hit_{idx}.wav", (wood + chime) * np.minimum(1.0, t / 0.002))

    # 2. Heavy 2-Beat Lob Cue ("Wooo-PING!")
    n = int(0.55 * SR)
    t = np.arange(n, dtype=np.float64) / SR
    glide_f = 330.0 * (2.6 ** (t / 0.55))
    phase = np.cumsum(2 * np.pi * glide_f / SR)
    whistle = (np.sin(phase) * 0.7 + np.sin(2 * phase) * 0.25) * np.minimum(1.0, t / 0.03) * np.exp(-np.maximum(0.0, t - 0.38) * 14.0)
    ping_t = np.maximum(0.0, t - 0.38)
    ping = np.where(t >= 0.38, np.sin(2 * np.pi * 1046.5 * ping_t) * np.exp(-ping_t * 18.0) * 0.65, 0.0)
    write_both("cue_lob.wav", whistle * 0.6 + ping)

    # 3. Player Anvil Smash Foley (Normal & Heavy)
    for fname, heavy in (("sfx_hit_ace.wav", False), ("sfx_hit_heavy.wav", True)):
        dur = 0.32 if heavy else 0.22
        n = int(dur * SR)
        t = np.arange(n, dtype=np.float64) / SR
        kick_p = np.cumsum(2 * np.pi * (155.0 * np.exp(-t * 28.0) + 46.0) / SR)
        sub = np.sin(kick_p) * np.exp(-t * 14.0) * (0.85 if heavy else 0.65)
        ring = (
            np.sin(2 * np.pi * 1380 * t)
            + 0.65 * np.sin(2 * np.pi * 2070 * t)
            + 0.40 * np.sin(2 * np.pi * 3110 * t)
        ) * np.exp(-t * (10.0 if heavy else 15.0)) * 0.35
        crack = rng.uniform(-1.0, 1.0, n) * np.exp(-t * 95.0) * 0.5
        write_both(fname, np.tanh((sub + ring + crack) * 1.4))

    # 4. Barely Clank & Miss Slide
    n_b = int(0.16 * SR)
    tb = np.arange(n_b, dtype=np.float64) / SR
    barely = (np.sin(2 * np.pi * (240 - 110 * tb / 0.16) * tb) * 0.7 + np.sin(2 * np.pi * 315 * tb) * 0.3) * np.exp(-tb * 18.0)
    write_both("sfx_hit_barely.wav", barely)

    n_m = int(0.28 * SR)
    tm = np.arange(n_m, dtype=np.float64) / SR
    mf = 520.0 * np.exp(-tm * 5.2) + 95.0
    mp = np.cumsum(2 * np.pi * mf / SR)
    miss = np.sin(mp) * np.exp(-tm * 6.0) * 0.7 + rng.uniform(-1, 1, n_m) * np.exp(-tm * 32.0) * 0.25
    write_both("sfx_miss.wav", miss)

    # 5. Power Off / On & Sword Shing
    n_p = int(0.35 * SR)
    tp = np.arange(n_p, dtype=np.float64) / SR
    poff = np.sin(np.cumsum(2 * np.pi * (420 * np.exp(-tp * 9.0) + 55) / SR)) * np.exp(-tp * 6.0)
    pon = np.sin(np.cumsum(2 * np.pi * (140 + 620 * (tp / 0.35)) / SR)) * np.exp(-tp * 5.0)
    write_both("sfx_power_off.wav", poff)
    write_both("sfx_power_on.wav", pon)

    n_s = int(0.30 * SR)
    ts = np.arange(n_s, dtype=np.float64) / SR
    shing = (np.sin(2 * np.pi * 1760 * ts) + 0.6 * np.sin(2 * np.pi * 2637 * ts)) * np.minimum(1.0, ts / 0.01) * np.exp(-ts * 10.0)
    write_both("sfx_sword_fly.wav", shing)

    # 6. 8 Bar-Matched Resolution Chord Stabs!
    for i, cname in enumerate(CHORD_LIST):
        l, r = synth_rhodes_chord(CHORDS[cname], 0.38, 0.75)
        mono = (l + r) * 0.5
        write_both(f"chord_{i}.wav", mono)

    # 7. Comedic BONK + Sizzle (on Miss) & Bulb Snap Spark
    n_bk = int(0.32 * SR)
    tbk = np.arange(n_bk, dtype=np.float64) / SR
    bonk_f = 280.0 + 190.0 * np.sin(2 * np.pi * 12.0 * tbk) * np.exp(-tbk * 10.0)
    bonk = np.sin(np.cumsum(2 * np.pi * bonk_f / SR)) * np.exp(-tbk * 9.0) * 0.75
    sizzle = rng.uniform(-1.0, 1.0, n_bk)
    sizzle = (sizzle - np.concatenate(([0.0], sizzle[:-1])) * 0.85) * np.exp(-tbk * 7.0) * 0.35
    write_both("sfx_bonk.wav", np.tanh((bonk + sizzle) * 1.2))

    n_bs = int(0.28 * SR)
    tbs = np.arange(n_bs, dtype=np.float64) / SR
    pop = np.sin(np.cumsum(2 * np.pi * (950.0 * np.exp(-tbs * 25.0) + 90.0) / SR)) * np.exp(-tbs * 18.0) * 0.7
    zap = (rng.uniform(-1.0, 1.0, n_bs) * (np.sin(2 * np.pi * 60.0 * tbs) > 0)) * np.exp(-tbs * 11.0) * 0.5
    write_both("sfx_bulb_snap.wav", np.tanh((pop + zap) * 1.3))


if __name__ == "__main__":
    chart = build_chart()
    for d in (DATA_GODOT, DATA_WEB):
        with open(os.path.join(d, "forge_pass_chart.json"), "w", encoding="utf-8") as f:
            json.dump(chart, f, ensure_ascii=False, indent=2)
    print(f"Chart written: {len(chart['cues'])} cues, {len(chart['targets'])} targets")
    build_bgm(chart)
    print("BGM stems built!")
    build_sfx()
    print("All SFX & harmonic chords built!")
