from __future__ import annotations

import io
import os
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont


FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


def find_font(user_font_path: Optional[str] = None, font_size: int = 120) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Find a usable font, preferring an explicit user path."""
    if user_font_path:
        if not os.path.exists(user_font_path):
            raise FileNotFoundError(f"Шрифт не найден: {user_font_path}")
        return ImageFont.truetype(user_font_path, font_size)

    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, font_size)

    return ImageFont.load_default()


def _normalized_lines(text: str) -> list[str]:
    lines = [line.rstrip() for line in text.splitlines()]
    return lines or [text]


def _measure_text_block(
    lines: list[str],
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    line_spacing: int,
) -> tuple[int, int, list[tuple[int, int, int, int]]]:
    measure_img = Image.new("L", (16, 16), color=0)
    measure_draw = ImageDraw.Draw(measure_img)
    bboxes: list[tuple[int, int, int, int]] = []
    widths: list[int] = []
    heights: list[int] = []
    for line in lines:
        sample = line if line else " "
        bbox = measure_draw.textbbox((0, 0), sample, font=font, stroke_width=0)
        bboxes.append(bbox)
        widths.append(bbox[2] - bbox[0])
        heights.append(bbox[3] - bbox[1])
    total_height = sum(heights) + max(0, len(lines) - 1) * line_spacing
    return max(widths, default=0), total_height, bboxes


def render_text_bitmap(
    text: str,
    width: int,
    height: int,
    font_size: int,
    font_path: Optional[str] = None,
    margin_px: int = 12,
    vertical_margin_px: int = 8,
    invert: bool = False,
) -> np.ndarray:
    """Render text to a grayscale bitmap without clipping edge glyphs."""
    if width <= 2 * margin_px:
        raise ValueError("img_width слишком мал относительно margin")
    if height <= 2 * vertical_margin_px:
        raise ValueError("img_height слишком мал относительно vertical_margin")

    bg = 255 if invert else 0
    fg = 0 if invert else 255
    target_w = width - 2 * margin_px
    target_h = height - 2 * vertical_margin_px
    lines = _normalized_lines(text)

    chosen_font = None
    chosen_bboxes = None
    chosen_line_spacing = 0
    chosen_w = chosen_h = 0
    for test_size in range(max(8, font_size), 7, -2):
        font = find_font(font_path, test_size)
        line_spacing = max(2, int(round(test_size * 0.18)))
        text_w, text_h, bboxes = _measure_text_block(lines, font, line_spacing)
        if text_w <= target_w and text_h <= target_h:
            chosen_font = font
            chosen_bboxes = bboxes
            chosen_line_spacing = line_spacing
            chosen_w = text_w
            chosen_h = text_h
            break
        chosen_font = font
        chosen_bboxes = bboxes
        chosen_line_spacing = line_spacing
        chosen_w = text_w
        chosen_h = text_h

    assert chosen_font is not None and chosen_bboxes is not None
    pad = 6
    scratch = Image.new("L", (max(1, chosen_w + 2 * pad), max(1, chosen_h + 2 * pad)), color=bg)
    draw = ImageDraw.Draw(scratch)

    baseline_y = pad
    for line, bbox in zip(lines, chosen_bboxes, strict=False):
        sample = line if line else " "
        line_w = bbox[2] - bbox[0]
        x = pad + max(0, (chosen_w - line_w) // 2) - bbox[0]
        y = baseline_y - bbox[1]
        draw.text((x, y), sample, fill=fg, font=chosen_font)
        baseline_y += (bbox[3] - bbox[1]) + chosen_line_spacing

    arr = np.asarray(scratch, dtype=np.uint8)
    if invert:
        ys, xs = np.where(arr < 245)
    else:
        ys, xs = np.where(arr > 10)
    if xs.size == 0 or ys.size == 0:
        raise ValueError("Не удалось отрендерить текст в bitmap.")

    cropped = scratch.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    src_w, src_h = cropped.size
    scale = min(target_w / src_w, target_h / src_h)
    if scale < 1.0:
        cropped = cropped.resize(
            (max(1, int(round(src_w * scale))), max(1, int(round(src_h * scale)))),
            Image.Resampling.LANCZOS,
        )

    final_img = Image.new("L", (width, height), color=bg)
    offset_x = margin_px + max(0, (target_w - cropped.size[0]) // 2)
    offset_y = vertical_margin_px + max(0, (target_h - cropped.size[1]) // 2)
    final_img.paste(cropped, (offset_x, offset_y))
    return np.asarray(final_img, dtype=np.float32) / 255.0


def bitmap_from_text(**kwargs: object) -> np.ndarray:
    """Compatibility wrapper for text rendering."""
    return render_text_bitmap(**kwargs)


def pad_bitmap_time_axis(bitmap: np.ndarray, left_cols: int = 0, right_cols: int = 0) -> np.ndarray:
    """Pad the time axis with silent columns."""
    if left_cols < 0 or right_cols < 0:
        raise ValueError("Поля по временной оси не могут быть отрицательными")
    if left_cols == 0 and right_cols == 0:
        return bitmap
    return np.pad(bitmap, ((0, 0), (left_cols, right_cols)), mode="constant")


def orient_bitmap(bitmap_img: np.ndarray, orientation: str, freq_x_rotation: str = "ccw") -> np.ndarray:
    """Convert image-space bitmap to synthesis-space shape [freq_bins, time_bins]."""
    if orientation == "time-x":
        return np.flipud(bitmap_img).astype(np.float32)
    if orientation == "freq-x":
        rotated = np.rot90(bitmap_img, k=1 if freq_x_rotation == "ccw" else 3)
        return np.flipud(rotated).astype(np.float32)
    raise ValueError(f"Неизвестная orientation: {orientation}")


def auto_edge_pad_cols(img_width: int, img_height: int, orientation: str, edge_pad_cols: int) -> int:
    """Select internal edge padding for freq-x to preserve edge letters through fades."""
    if edge_pad_cols >= 0:
        return edge_pad_cols
    if orientation != "freq-x":
        return 0
    return max(6, int(round(0.06 * max(img_width, img_height))))


def split_text_units(text: str, scrolling_text: bool, word_per_line: bool) -> list[str]:
    normalized = " ".join(text.split())
    if word_per_line:
        return [word for word in normalized.split(" ") if word]
    if scrolling_text:
        return [char if char != " " else " " for char in normalized]
    return [normalized]


def _render_freq_x_units(
    *,
    text: str,
    img_width: int,
    img_height: int,
    font_size: int,
    font_path: Optional[str],
    margin: int,
    vertical_margin: int,
    invert: bool,
    freq_x_rotation: str,
    scrolling_text: bool,
    word_per_line: bool,
) -> np.ndarray:
    units = split_text_units(text, scrolling_text, word_per_line)
    if not units:
        raise ValueError("Не удалось разбить текст на элементы для freq-x.")

    parts: list[np.ndarray] = []
    for unit in units:
        if unit.strip():
            unit_img = render_text_bitmap(
                text=unit,
                width=img_width,
                height=img_height,
                font_size=font_size,
                font_path=font_path,
                margin_px=margin,
                vertical_margin_px=vertical_margin,
                invert=invert,
            )
            unit_bitmap = orient_bitmap(unit_img, "freq-x", freq_x_rotation)
        else:
            unit_bitmap = np.zeros((img_width, img_height), dtype=np.float32)
        parts.append(unit_bitmap)
    return np.concatenate(parts, axis=1)


def build_bitmap(
    *,
    text: str,
    img_width: int,
    img_height: int,
    font_size: int,
    font_path: Optional[str],
    margin: int,
    vertical_margin: int,
    invert: bool,
    orientation: str,
    freq_x_rotation: str,
    edge_pad_cols: int,
    scrolling_text: bool,
    word_per_line: bool,
) -> tuple[np.ndarray, int, float]:
    """Render, orient and pad bitmap into the working [freq_bins, time_bins] shape."""
    if orientation == "freq-x" and (scrolling_text or word_per_line):
        bitmap = _render_freq_x_units(
            text=text,
            img_width=img_width,
            img_height=img_height,
            font_size=font_size,
            font_path=font_path,
            margin=margin,
            vertical_margin=vertical_margin,
            invert=invert,
            freq_x_rotation=freq_x_rotation,
            scrolling_text=scrolling_text,
            word_per_line=word_per_line,
        )
    else:
        bitmap_img = bitmap_from_text(
            text=" ".join(text.split()),
            width=img_width,
            height=img_height,
            font_size=font_size,
            font_path=font_path,
            margin_px=margin,
            vertical_margin_px=vertical_margin,
            invert=invert,
        )
        bitmap = orient_bitmap(bitmap_img, orientation, freq_x_rotation)
    resolved_pad = auto_edge_pad_cols(img_width, img_height, orientation, edge_pad_cols)
    duration_multiplier = 1.0
    if orientation == "freq-x" and (scrolling_text or word_per_line):
        units = split_text_units(text, scrolling_text, word_per_line)
        duration_multiplier = float(len(units)) if units else 1.0
    bitmap = pad_bitmap_time_axis(bitmap, resolved_pad, resolved_pad)
    return bitmap, resolved_pad, duration_multiplier


def save_preview_png(bitmap: np.ndarray) -> bytes:
    """Serialize a preview PNG from the synthesis bitmap."""
    preview = np.flipud(np.clip(bitmap, 0.0, 1.0))
    image = Image.fromarray((preview * 255.0).astype(np.uint8), mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
