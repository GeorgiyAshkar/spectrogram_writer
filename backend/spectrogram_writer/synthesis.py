from __future__ import annotations

from typing import Iterable

import numpy as np


PRESET_HARMONICS: dict[str, list[float]] = {
    "piano": [1.0, 0.62, 0.31, 0.14, 0.07, 0.03],
    "guitar": [1.0, 0.88, 0.44, 0.26, 0.13, 0.06],
    "synth": [1.0, 1.0, 0.82, 0.62, 0.46, 0.34, 0.22],
}

INSTRUMENT_TRANSIENT_STRENGTH: dict[str, float] = {
    "piano": 0.52,
    "guitar": 0.72,
    "synth": 0.18,
    "custom": 0.35,
}


def gaussian_kernel(size: int, sigma: float) -> np.ndarray:
    """Build a normalized Gaussian kernel."""
    if size <= 1:
        return np.array([1.0], dtype=np.float32)
    radius = size // 2
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-(x**2) / (2 * max(sigma, 1e-6) ** 2))
    kernel /= kernel.sum()
    return kernel.astype(np.float32)


def smooth_along_frequency(bitmap: np.ndarray, kernel_size: int = 5, sigma: float = 1.0) -> np.ndarray:
    """Apply frequency-axis smoothing to reduce spectrogram jaggies."""
    if kernel_size <= 1:
        return bitmap.copy()
    kernel = gaussian_kernel(kernel_size, sigma)
    pad = kernel_size // 2
    padded = np.pad(bitmap, ((pad, pad), (0, 0)), mode="edge")
    out = np.zeros_like(bitmap)
    for row in range(bitmap.shape[0]):
        out[row, :] = np.sum(padded[row : row + kernel_size, :] * kernel[:, None], axis=0)
    return np.clip(out, 0.0, 1.0)


def apply_contrast(bitmap: np.ndarray, contrast_power: float) -> np.ndarray:
    """Map pixel brightness to synthesis amplitudes."""
    contrast_power = max(contrast_power, 1e-6)
    return np.clip(bitmap, 0.0, 1.0) ** contrast_power


def harmonic_weights(
    *,
    instrument_type: str,
    num_harmonics: int,
    decay_mode: str,
    custom_weights: Iterable[float] | None,
) -> np.ndarray:
    """Resolve harmonic weights for the requested timbre profile."""
    if decay_mode == "custom_list" and custom_weights:
        weights = np.asarray(list(custom_weights), dtype=np.float64)
    elif instrument_type in PRESET_HARMONICS:
        weights = np.asarray(PRESET_HARMONICS[instrument_type], dtype=np.float64)
    elif instrument_type == "custom":
        if not custom_weights:
            raise ValueError("Для instrument_type=custom необходимо задать harmonic_weights.")
        weights = np.asarray(list(custom_weights), dtype=np.float64)
    else:
        base = np.arange(1, num_harmonics + 1, dtype=np.float64)
        weights = 1.0 / (base**2 if decay_mode == "1/n^2" else base)

    if weights.size == 0:
        raise ValueError("Список гармоник не должен быть пустым.")
    if num_harmonics > 0:
        if weights.size < num_harmonics:
            weights = np.pad(weights, (0, num_harmonics - weights.size))
        weights = weights[:num_harmonics]
    weights = np.clip(weights, 0.0, None)
    if not np.any(weights > 0):
        raise ValueError("Хотя бы одна гармоника должна иметь положительный вес.")
    return weights


def adsr_envelope(length: int, attack: float, decay: float, sustain: float, release: float) -> np.ndarray:
    """Create a simple ADSR envelope for a segment."""
    if length <= 0:
        return np.zeros(0, dtype=np.float64)
    sustain = float(np.clip(sustain, 0.0, 1.0))
    attack_n = max(0, min(length, int(round(length * max(attack, 0.0)))))
    decay_n = max(0, min(length - attack_n, int(round(length * max(decay, 0.0)))))
    release_n = max(0, min(length - attack_n - decay_n, int(round(length * max(release, 0.0)))))
    sustain_n = max(0, length - attack_n - decay_n - release_n)

    pieces = []
    if attack_n:
        pieces.append(np.linspace(0.0, 1.0, attack_n, endpoint=False, dtype=np.float64))
    if decay_n:
        pieces.append(np.linspace(1.0, sustain, decay_n, endpoint=False, dtype=np.float64))
    if sustain_n:
        pieces.append(np.full(sustain_n, sustain, dtype=np.float64))
    if release_n:
        start = sustain if sustain_n or decay_n or attack_n else 1.0
        pieces.append(np.linspace(start, 0.0, release_n, endpoint=True, dtype=np.float64))

    env = np.concatenate(pieces) if pieces else np.ones(length, dtype=np.float64)
    if env.size < length:
        env = np.pad(env, (0, length - env.size), constant_values=(sustain, 0.0))
    return env[:length]


def edge_fade_envelope(length: int, fade_ratio: float = 0.02) -> np.ndarray:
    """Create a short fade-only envelope for the pure mode."""
    if length <= 0:
        return np.zeros(0, dtype=np.float64)
    fade_n = max(1, min(length // 2, int(round(length * max(fade_ratio, 0.0)))))
    env = np.ones(length, dtype=np.float64)
    if fade_n > 1:
        env[:fade_n] = np.linspace(0.0, 1.0, fade_n, endpoint=True, dtype=np.float64)
        env[-fade_n:] *= np.linspace(1.0, 0.0, fade_n, endpoint=True, dtype=np.float64)
    return env


def harmonic_transient_envelope(length: int, harmonic_idx: int, instrument_type: str) -> np.ndarray:
    """Emphasize upper partials at note onset to make harmonic mode audibly distinct."""
    if length <= 0:
        return np.zeros(0, dtype=np.float64)
    strength = INSTRUMENT_TRANSIENT_STRENGTH.get(instrument_type, INSTRUMENT_TRANSIENT_STRENGTH["custom"])
    if harmonic_idx <= 1 or strength <= 0:
        return np.ones(length, dtype=np.float64)
    x = np.linspace(0.0, 1.0, length, endpoint=True, dtype=np.float64)
    onset = np.exp(-6.0 * x)
    return 1.0 + strength * (harmonic_idx - 1) * 0.22 * onset


def instrument_color_envelope(length: int, instrument_type: str) -> np.ndarray:
    if length <= 0:
        return np.zeros(0, dtype=np.float64)
    x = np.linspace(0.0, 1.0, length, endpoint=True, dtype=np.float64)
    if instrument_type == "piano":
        return 1.0 - 0.24 * x**0.7
    if instrument_type == "guitar":
        return 1.06 * np.exp(-1.3 * x) + 0.08
    if instrument_type == "synth":
        return 0.92 + 0.1 * np.sin(2 * np.pi * (1.25 * x + 0.05)) ** 2
    return np.ones(length, dtype=np.float64)


def _phases(count: int, fixed_phase: bool) -> np.ndarray:
    if fixed_phase:
        return np.zeros(count, dtype=np.float64)
    return np.random.uniform(0.0, 2 * np.pi, size=count)


def _segment_lengths(total_samples: int, time_bins: int) -> list[int]:
    base = total_samples // time_bins
    remainder = total_samples - base * time_bins
    return [base + (1 if idx < remainder else 0) for idx in range(time_bins)]


def project_to_fundamentals(
    amplitudes: np.ndarray,
    target_freqs: np.ndarray,
    fundamental_freqs: np.ndarray,
    weights: np.ndarray,
) -> np.ndarray:
    """Project visible spectral pixels onto lower fundamentals so the text is formed by harmonics only."""
    projected = np.zeros_like(fundamental_freqs, dtype=np.float64)
    harmonic_indices = [idx for idx, weight in enumerate(weights, start=1) if idx >= 2 and weight > 0]
    if not harmonic_indices:
        return projected
    active = np.where(amplitudes > 1e-4)[0]
    for row_idx in active:
        amp = float(amplitudes[row_idx])
        target_freq = float(target_freqs[row_idx])
        for harmonic_idx in harmonic_indices:
            fundamental = target_freq / harmonic_idx
            nearest = int(np.argmin(np.abs(fundamental_freqs - fundamental)))
            projected[nearest] += amp * weights[harmonic_idx - 1]
    if np.max(projected) > 0:
        projected /= float(np.max(projected))
    return projected


def _synthesize_column_pure(
    amplitudes: np.ndarray,
    freqs: np.ndarray,
    seg_len: int,
    samplerate: int,
    fixed_phase: bool,
    envelope: np.ndarray,
    amplitude_scale: float,
) -> np.ndarray:
    active = amplitudes > 1e-4
    if not np.any(active):
        return np.zeros(seg_len, dtype=np.float64)
    t = np.arange(seg_len, dtype=np.float64) / samplerate
    phases = _phases(int(active.sum()), fixed_phase)
    signal = np.sum(
        amplitudes[active, None] * np.sin(2 * np.pi * freqs[active, None] * t[None, :] + phases[:, None]),
        axis=0,
    )
    signal *= envelope
    signal /= max(amplitude_scale, 1.0)
    return signal


def _synthesize_column_harmonic(
    amplitudes: np.ndarray,
    freqs: np.ndarray,
    seg_len: int,
    samplerate: int,
    fixed_phase: bool,
    envelope: np.ndarray,
    weights: np.ndarray,
    fmax: float,
    instrument_type: str,
    amplitude_scale: float,
) -> np.ndarray:
    active = amplitudes > 1e-4
    if not np.any(active):
        return np.zeros(seg_len, dtype=np.float64)

    t = np.arange(seg_len, dtype=np.float64) / samplerate
    signal = np.zeros(seg_len, dtype=np.float64)
    nyquist = samplerate / 2.0
    spectral_color = instrument_color_envelope(seg_len, instrument_type)
    norm = 0.0
    for amp, fundamental_freq in zip(amplitudes[active], freqs[active], strict=False):
        partial = np.zeros(seg_len, dtype=np.float64)
        partial_norm = 0.0
        for harmonic_idx, weight in enumerate(weights, start=1):
            harmonic_freq = fundamental_freq * harmonic_idx
            if harmonic_freq > fmax or harmonic_freq >= nyquist or weight <= 0:
                continue
            phase = 0.0 if fixed_phase else float(np.random.uniform(0.0, 2 * np.pi))
            transient = harmonic_transient_envelope(seg_len, harmonic_idx, instrument_type)
            sinusoid = np.sin(2 * np.pi * harmonic_freq * t + phase)
            partial_component = weight * transient * sinusoid
            partial += partial_component
            partial_norm += float(np.mean((weight * transient) ** 2))
        if partial_norm > 0:
            signal += amp * spectral_color * partial / np.sqrt(partial_norm)
            norm += 1.0
    signal *= envelope
    signal /= max(amplitude_scale, 1.0)
    signal /= max(np.sqrt(norm), 1.0)
    return signal


def synthesize_signal(
    *,
    bitmap: np.ndarray,
    fmin: float,
    fmax: float,
    signal_duration: float,
    samplerate: int,
    contrast_power: float,
    fixed_phase: bool,
    timbre_mode: str,
    instrument_type: str,
    num_harmonics: int,
    harmonic_decay_mode: str,
    harmonic_weights_list: Iterable[float] | None,
    adsr_attack: float,
    adsr_decay: float,
    adsr_sustain: float,
    adsr_release: float,
) -> np.ndarray:
    """Synthesize a mono waveform from a [freq_bins, time_bins] bitmap."""
    freq_bins, time_bins = bitmap.shape
    if fmax >= samplerate / 2:
        raise ValueError(f"fmax={fmax} Гц должен быть меньше Nyquist={samplerate / 2:.1f} Гц.")
    total_samples = int(round(signal_duration * samplerate))
    if total_samples < time_bins:
        raise ValueError("Слишком малая signal_duration для выбранной ширины bitmap.")

    bitmap = apply_contrast(bitmap, contrast_power)
    freqs = np.linspace(fmin, fmax, freq_bins, dtype=np.float64)
    seg_lengths = _segment_lengths(total_samples, time_bins)
    column_activity = np.sqrt(np.maximum(np.count_nonzero(bitmap > 1e-4, axis=0), 1))
    amplitude_scale = float(np.max(column_activity))
    harmonic_profile = None
    fundamental_freqs = None
    if timbre_mode == "harmonic":
        harmonic_profile = harmonic_weights(
            instrument_type=instrument_type,
            num_harmonics=num_harmonics,
            decay_mode=harmonic_decay_mode,
            custom_weights=harmonic_weights_list,
        )
        lowest_fundamental = max(20.0, fmin / max(len(harmonic_profile), 2))
        fundamental_freqs = np.linspace(lowest_fundamental, fmax, freq_bins, dtype=np.float64)

    parts: list[np.ndarray] = []
    for col, seg_len in enumerate(seg_lengths):
        amplitudes = bitmap[:, col].astype(np.float64)
        if timbre_mode == "harmonic":
            envelope = adsr_envelope(seg_len, adsr_attack, adsr_decay, adsr_sustain, adsr_release)
            harmonic_amplitudes = project_to_fundamentals(amplitudes, freqs, fundamental_freqs, harmonic_profile)
            segment = _synthesize_column_harmonic(
                harmonic_amplitudes,
                fundamental_freqs,
                seg_len,
                samplerate,
                fixed_phase,
                envelope,
                harmonic_profile,
                fmax,
                instrument_type,
                amplitude_scale,
            )
        else:
            envelope = edge_fade_envelope(seg_len)
            segment = _synthesize_column_pure(
                amplitudes,
                freqs,
                seg_len,
                samplerate,
                fixed_phase,
                envelope,
                amplitude_scale,
            )
        parts.append(segment)

    signal = np.concatenate(parts).astype(np.float32)
    peak = float(np.max(np.abs(signal))) if signal.size else 0.0
    if peak > 0:
        signal = signal / peak * 0.95
    return signal
