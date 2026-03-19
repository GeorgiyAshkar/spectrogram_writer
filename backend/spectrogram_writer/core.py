from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

from .io_utils import save_wav_mono_16bit
from .rendering import build_bitmap, save_preview_png
from .synthesis import bandpass_filter, smooth_along_frequency, synthesize_signal


@dataclass(slots=True)
class GenerationConfig:
    text: str
    fmin: float
    fmax: float
    signal_duration: float
    leading_silence: float = 0.0
    trailing_silence: float = 0.0
    samplerate: int = 48_000
    output: Optional[str] = None
    preview_png: Optional[str] = None
    orientation: str = "time-x"
    freq_x_rotation: str = "ccw"
    edge_pad_cols: int = -1
    img_width: int = 1000
    img_height: int = 160
    font_size: int = 180
    font_path: Optional[str] = None
    margin: int = 12
    vertical_margin: int = 8
    smooth_freq: int = 5
    smooth_sigma: float = 1.0
    contrast: float = 1.0
    invert: bool = False
    fixed_phase: bool = False
    timbre_mode: str = "pure"
    instrument_type: str = "piano"
    num_harmonics: int = 5
    harmonic_decay_mode: str = "1/n"
    harmonic_weights: Optional[list[float]] = None
    adsr_attack: float = 0.02
    adsr_decay: float = 0.08
    adsr_sustain: float = 0.9
    adsr_release: float = 0.05
    sample_masked: bool = False

    def validate(self) -> None:
        """Validate user-facing generation parameters."""
        if not self.text.strip():
            raise ValueError("Текст не должен быть пустым.")
        if self.fmin <= 0:
            raise ValueError("fmin должен быть > 0.")
        if self.fmax <= self.fmin:
            raise ValueError("fmax должен быть больше fmin.")
        if self.fmax >= self.samplerate / 2:
            raise ValueError("fmax должен быть меньше samplerate / 2.")
        if self.signal_duration <= 0:
            raise ValueError("signal_duration должен быть > 0.")
        if self.leading_silence < 0 or self.trailing_silence < 0:
            raise ValueError("Тишина не может быть отрицательной.")
        if self.samplerate < 8000:
            raise ValueError("samplerate должен быть не меньше 8000 Гц.")
        if self.img_width < 8 or self.img_height < 8:
            raise ValueError("img_width и img_height должны быть не меньше 8.")
        if self.font_size < 8:
            raise ValueError("font_size должен быть не меньше 8.")
        if self.orientation not in {"time-x", "freq-x"}:
            raise ValueError("orientation должен быть time-x или freq-x.")
        if self.freq_x_rotation not in {"ccw", "cw"}:
            raise ValueError("freq_x_rotation должен быть ccw или cw.")
        if self.smooth_freq < 1:
            raise ValueError("smooth_freq должен быть >= 1.")
        if self.smooth_sigma <= 0:
            raise ValueError("smooth_sigma должен быть > 0.")
        if self.contrast <= 0:
            raise ValueError("contrast должен быть > 0.")
        if self.timbre_mode not in {"pure", "harmonic", "sample_masked"}:
            raise ValueError("timbre_mode должен быть pure, harmonic или sample_masked.")
        if self.sample_masked or self.timbre_mode == "sample_masked":
            raise ValueError("Режим sample_masked пока не реализован.")
        if self.instrument_type not in {"piano", "guitar", "synth", "custom"}:
            raise ValueError("instrument_type должен быть piano, guitar, synth или custom.")
        if self.harmonic_decay_mode not in {"1/n", "1/n^2", "custom_list"}:
            raise ValueError("harmonic_decay_mode должен быть 1/n, 1/n^2 или custom_list.")
        if self.num_harmonics < 1:
            raise ValueError("num_harmonics должен быть >= 1.")
        for name, value in {
            "adsr_attack": self.adsr_attack,
            "adsr_decay": self.adsr_decay,
            "adsr_sustain": self.adsr_sustain,
            "adsr_release": self.adsr_release,
        }.items():
            if value < 0:
                raise ValueError(f"{name} не может быть отрицательным.")
        if self.harmonic_decay_mode == "custom_list" and not self.harmonic_weights:
            raise ValueError("Для harmonic_decay_mode=custom_list задайте harmonic_weights.")
        if self.instrument_type == "custom" and not self.harmonic_weights:
            raise ValueError("Для instrument_type=custom задайте harmonic_weights.")


@dataclass(slots=True)
class GeneratedArtifacts:
    bitmap: np.ndarray
    preview_png: bytes
    wav_bytes: bytes
    auto_edge_pad: int
    total_duration: float


def generate_artifacts(config: GenerationConfig) -> GeneratedArtifacts:
    """Generate bitmap preview and synthesized WAV payloads."""
    config.validate()
    bitmap, auto_edge_pad = build_bitmap(
        text=config.text,
        img_width=config.img_width,
        img_height=config.img_height,
        font_size=config.font_size,
        font_path=config.font_path,
        margin=config.margin,
        vertical_margin=config.vertical_margin,
        invert=config.invert,
        orientation=config.orientation,
        freq_x_rotation=config.freq_x_rotation,
        edge_pad_cols=config.edge_pad_cols,
    )
    bitmap = smooth_along_frequency(bitmap, config.smooth_freq, config.smooth_sigma)
    useful_signal = synthesize_signal(
        bitmap=bitmap,
        fmin=config.fmin,
        fmax=config.fmax,
        signal_duration=config.signal_duration,
        samplerate=config.samplerate,
        contrast_power=config.contrast,
        fixed_phase=config.fixed_phase,
        timbre_mode=config.timbre_mode,
        instrument_type=config.instrument_type,
        num_harmonics=config.num_harmonics,
        harmonic_decay_mode=config.harmonic_decay_mode,
        harmonic_weights_list=config.harmonic_weights,
        adsr_attack=config.adsr_attack,
        adsr_decay=config.adsr_decay,
        adsr_sustain=config.adsr_sustain,
        adsr_release=config.adsr_release,
    )
    useful_signal = bandpass_filter(useful_signal, config.samplerate, config.fmin, config.fmax, order=5)
    useful_peak = float(np.max(np.abs(useful_signal))) if useful_signal.size else 0.0
    if useful_peak > 0:
        useful_signal = useful_signal / useful_peak * 0.95
    lead = np.zeros(int(round(config.leading_silence * config.samplerate)), dtype=np.float32)
    trail = np.zeros(int(round(config.trailing_silence * config.samplerate)), dtype=np.float32)
    full_signal = np.concatenate([lead, useful_signal, trail])
    return GeneratedArtifacts(
        bitmap=bitmap,
        preview_png=save_preview_png(bitmap),
        wav_bytes=save_wav_mono_16bit(full_signal, config.samplerate),
        auto_edge_pad=auto_edge_pad,
        total_duration=len(full_signal) / config.samplerate,
    )
