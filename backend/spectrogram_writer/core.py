from __future__ import annotations

import io
import os
import wave
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont


@dataclass(slots=True)
class GenerationConfig:
    text: str
    fmin: float
    fmax: float
    signal_duration: float
    leading_silence: float = 0.0
    trailing_silence: float = 0.0
    samplerate: int = 48_000
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

    def validate(self) -> None:
        if not self.text.strip():
            raise ValueError("Текст не должен быть пустым.")
        if self.fmin <= 0:
            raise ValueError("fmin должен быть > 0.")
        if self.fmax <= self.fmin:
            raise ValueError("fmax должен быть больше fmin.")
        if self.signal_duration <= 0:
            raise ValueError("signal_duration должен быть > 0.")
        if self.leading_silence < 0 or self.trailing_silence < 0:
            raise ValueError("Тишина не может быть отрицательной.")
        if self.img_width < 8 or self.img_height < 8:
            raise ValueError("img_width и img_height должны быть не меньше 8.")
        if self.orientation not in {"time-x", "freq-x"}:
            raise ValueError("orientation должен быть time-x или freq-x.")
        if self.freq_x_rotation not in {"ccw", "cw"}:
            raise ValueError("freq_x_rotation должен быть ccw или cw.")


@dataclass(slots=True)
class GeneratedArtifacts:
    bitmap: np.ndarray
    preview_png: bytes
    wav_bytes: bytes
    auto_edge_pad: int
    total_duration: float


def find_font(user_font_path: Optional[str] = None, font_size: int = 120):
    if user_font_path:
        if not os.path.exists(user_font_path):
            raise FileNotFoundError(f"Шрифт не найден: {user_font_path}")
        return ImageFont.truetype(user_font_path, font_size)

    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]

    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, font_size)

    return ImageFont.load_default()


def render_text_bitmap_stretched(
    text: str,
    width: int,
    height: int,
    font_size: int,
    font_path: Optional[str] = None,
    margin_px: int = 12,
    vertical_margin_px: int = 8,
    invert: bool = False,
) -> np.ndarray:
    if width <= 2 * margin_px:
        raise ValueError("width слишком мал относительно margin_px")
    if height <= 2 * vertical_margin_px:
        raise ValueError("height слишком мал относительно vertical_margin_px")

    bg = 0 if not invert else 255
    fg = 255 if not invert else 0
    target_w = max(1, width - 2 * margin_px)
    target_h = max(1, height - 2 * vertical_margin_px)

    measure_img = Image.new("L", (10, 10), color=bg)
    measure_draw = ImageDraw.Draw(measure_img)
    test_font_size = max(8, font_size)

    while True:
        font = find_font(font_path, test_font_size)
        bbox = measure_draw.textbbox((0, 0), text, font=font, stroke_width=0)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        if text_w <= target_w and text_h <= target_h:
            break
        test_font_size -= 2
        if test_font_size < 8:
            font = find_font(font_path, 8)
            bbox = measure_draw.textbbox((0, 0), text, font=font, stroke_width=0)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            break

    pad = 4
    text_img = Image.new("L", (max(1, text_w + 2 * pad), max(1, text_h + 2 * pad)), color=bg)
    text_draw = ImageDraw.Draw(text_img)
    text_draw.text((pad - bbox[0], pad - bbox[1]), text, fill=fg, font=font)

    arr = np.asarray(text_img, dtype=np.uint8)
    ys, xs = np.where(arr > 10) if not invert else np.where(arr < 245)
    if len(xs) == 0 or len(ys) == 0:
        raise ValueError("Не удалось отрендерить текст.")

    cropped = text_img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    src_w, src_h = cropped.size
    scale = min(target_w / src_w, target_h / src_h, 1.0)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    if (new_w, new_h) != (src_w, src_h):
        cropped = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    final_img = Image.new("L", (width, height), color=bg)
    final_img.paste(cropped, ((width - cropped.size[0]) // 2, (height - cropped.size[1]) // 2))
    return np.asarray(final_img, dtype=np.float32) / 255.0


def pad_bitmap_time_axis(bitmap: np.ndarray, left_cols: int = 0, right_cols: int = 0) -> np.ndarray:
    if left_cols < 0 or right_cols < 0:
        raise ValueError("left_cols/right_cols не могут быть отрицательными")
    if left_cols == 0 and right_cols == 0:
        return bitmap
    freq_bins = bitmap.shape[0]
    return np.concatenate(
        [
            np.zeros((freq_bins, left_cols), dtype=bitmap.dtype),
            bitmap,
            np.zeros((freq_bins, right_cols), dtype=bitmap.dtype),
        ],
        axis=1,
    )


def orient_bitmap_for_synthesis(
    bitmap_img: np.ndarray,
    orientation: str,
    edge_pad_cols: int = 0,
    freq_x_rotation: str = "ccw",
) -> np.ndarray:
    if orientation == "time-x":
        bitmap = np.flipud(bitmap_img)
    elif orientation == "freq-x":
        rotated = np.rot90(bitmap_img, k=1 if freq_x_rotation == "ccw" else 3)
        bitmap = np.flipud(rotated)
    else:
        raise ValueError(f"Неизвестная orientation: {orientation}")

    bitmap = bitmap.astype(np.float32)
    return pad_bitmap_time_axis(bitmap, edge_pad_cols, edge_pad_cols) if edge_pad_cols > 0 else bitmap


def gaussian_kernel(size: int, sigma: float) -> np.ndarray:
    if size <= 1:
        return np.array([1.0], dtype=np.float32)
    radius = size // 2
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-(x ** 2) / (2 * sigma ** 2))
    kernel /= np.sum(kernel)
    return kernel.astype(np.float32)


def smooth_along_frequency(bitmap: np.ndarray, kernel_size: int = 5, sigma: float = 1.0) -> np.ndarray:
    if kernel_size <= 1:
        return bitmap.copy()
    kernel = gaussian_kernel(kernel_size, sigma)
    pad = kernel_size // 2
    padded = np.pad(bitmap, ((pad, pad), (0, 0)), mode="edge")
    out = np.zeros_like(bitmap)
    for row in range(bitmap.shape[0]):
        out[row, :] = np.sum(padded[row:row + kernel_size, :] * kernel[:, None], axis=0)
    return np.clip(out, 0.0, 1.0)


def synthesize_waterfall_signal(
    bitmap: np.ndarray,
    fmin: float,
    fmax: float,
    signal_duration: float,
    samplerate: int,
    contrast_power: float = 1.0,
    random_phase: bool = True,
    fade_ratio: float = 0.02,
) -> np.ndarray:
    freq_bins, time_bins = bitmap.shape
    if fmax >= samplerate / 2:
        raise ValueError(f"fmax={fmax} Гц должен быть меньше Nyquist={samplerate / 2:.1f} Гц.")

    total_samples = int(round(signal_duration * samplerate))
    if total_samples < time_bins:
        raise ValueError("Слишком малая signal_duration для выбранной ширины bitmap.")

    freqs = np.linspace(fmin, fmax, freq_bins, dtype=np.float64)
    samples_per_col = total_samples // time_bins
    remainder = total_samples - samples_per_col * time_bins
    phases = np.random.uniform(0, 2 * np.pi, size=freq_bins) if random_phase else np.zeros(freq_bins)
    parts: list[np.ndarray] = []

    for col in range(time_bins):
        seg_len = samples_per_col + (1 if col < remainder else 0)
        t = np.arange(seg_len, dtype=np.float64) / samplerate
        amplitudes = bitmap[:, col].astype(np.float64)
        if contrast_power != 1.0:
            amplitudes = amplitudes ** contrast_power
        active = amplitudes > 1e-4
        if not np.any(active):
            segment = np.zeros(seg_len, dtype=np.float64)
        else:
            phase_matrix = 2 * np.pi * freqs[active, None] * t[None, :] + phases[active, None]
            segment = np.sum(amplitudes[active, None] * np.sin(phase_matrix), axis=0)
            segment /= max(np.sqrt(np.sum(active)), 1.0)

        fade_len = min(int(seg_len * fade_ratio), seg_len // 2)
        if fade_len > 1:
            envelope = np.ones(seg_len, dtype=np.float64)
            envelope[:fade_len] *= np.linspace(0.0, 1.0, fade_len)
            envelope[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)
            segment *= envelope
        parts.append(segment)

    signal = np.concatenate(parts).astype(np.float32)
    peak = float(np.max(np.abs(signal))) if signal.size else 0.0
    if peak > 0:
        signal = signal / peak * 0.95
    return signal


def save_bitmap_preview_png(bitmap: np.ndarray) -> bytes:
    preview = np.flipud(np.clip(bitmap, 0.0, 1.0))
    image = Image.fromarray((preview * 255.0).astype(np.uint8), mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def save_wav_mono_16bit(signal: np.ndarray, samplerate: int) -> bytes:
    pcm = (np.clip(signal, -1.0, 1.0) * 32767.0).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(pcm.tobytes())
    return buffer.getvalue()


def build_bitmap(config: GenerationConfig) -> tuple[np.ndarray, int]:
    config.validate()
    bitmap_img = render_text_bitmap_stretched(
        text=config.text,
        width=config.img_width,
        height=config.img_height,
        font_size=config.font_size,
        font_path=config.font_path,
        margin_px=config.margin,
        vertical_margin_px=config.vertical_margin,
        invert=config.invert,
    )
    auto_edge_pad = (
        max(6, int(round(0.06 * max(config.img_width, config.img_height))))
        if config.edge_pad_cols == -1 and config.orientation == "freq-x"
        else max(config.edge_pad_cols, 0)
    )
    bitmap = orient_bitmap_for_synthesis(bitmap_img, config.orientation, auto_edge_pad, config.freq_x_rotation)
    bitmap = smooth_along_frequency(bitmap, config.smooth_freq, config.smooth_sigma)
    return bitmap, auto_edge_pad


def generate_artifacts(config: GenerationConfig) -> GeneratedArtifacts:
    bitmap, auto_edge_pad = build_bitmap(config)
    useful_signal = synthesize_waterfall_signal(
        bitmap=bitmap,
        fmin=config.fmin,
        fmax=config.fmax,
        signal_duration=config.signal_duration,
        samplerate=config.samplerate,
        contrast_power=config.contrast,
        random_phase=not config.fixed_phase,
    )
    lead = np.zeros(int(round(config.leading_silence * config.samplerate)), dtype=np.float32)
    trail = np.zeros(int(round(config.trailing_silence * config.samplerate)), dtype=np.float32)
    full_signal = np.concatenate([lead, useful_signal, trail])
    return GeneratedArtifacts(
        bitmap=bitmap,
        preview_png=save_bitmap_preview_png(bitmap),
        wav_bytes=save_wav_mono_16bit(full_signal, config.samplerate),
        auto_edge_pad=auto_edge_pad,
        total_duration=len(full_signal) / config.samplerate,
    )
