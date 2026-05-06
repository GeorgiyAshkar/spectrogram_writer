from __future__ import annotations

import io
import os
import base64
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


def _measure_text(text: str, font: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> tuple[int, int, tuple[int, int, int, int]]:
    measure_img = Image.new("L", (16, 16), color=0)
    measure_draw = ImageDraw.Draw(measure_img)
    bbox = measure_draw.textbbox((0, 0), text, font=font, stroke_width=0)
    return bbox[2] - bbox[0], bbox[3] - bbox[1], bbox


def _emoji_aliases() -> dict[str, str]:
    return {
        "❤": "❤️",
        "♥": "❤️",
        ":heart:": "❤️",
        ":joy:": "😊",
        ":sad:": "😢",
        ":angry:": "😡",
        ":star:": "⭐",
        ":sun:": "☀️",
        ":moon:": "🌙",
        ":cloud:": "☁️",
        ":lightning:": "⚡",
        ":music:": "🎵",
    }


def _normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip()
    return _emoji_aliases().get(normalized, normalized)


def _draw_supported_emoji(draw: ImageDraw.ImageDraw, symbol: str, width: int, height: int, fg: int, bg: int) -> bool:
    symbol = _normalize_symbol(symbol)
    left = int(width * 0.18)
    right = int(width * 0.82)
    top = int(height * 0.18)
    bottom = int(height * 0.82)
    cx = width // 2
    cy = height // 2
    stroke = max(2, min(width, height) // 18)

    if symbol == "❤️":
        r = min(width, height) * 0.17
        draw.ellipse((cx - 2.1 * r, top, cx - 0.1 * r, top + 2 * r), fill=fg)
        draw.ellipse((cx + 0.1 * r, top, cx + 2.1 * r, top + 2 * r), fill=fg)
        draw.polygon([(left, top + int(1.3 * r)), (right, top + int(1.3 * r)), (cx, bottom)], fill=fg)
        return True
    if symbol in {"😊", "😢", "😡"}:
        draw.ellipse((left, top, right, bottom), outline=fg, width=stroke)
        eye_r = max(3, stroke)
        eye_y = int(height * 0.42)
        draw.ellipse((int(width * 0.35) - eye_r, eye_y - eye_r, int(width * 0.35) + eye_r, eye_y + eye_r), fill=fg)
        draw.ellipse((int(width * 0.65) - eye_r, eye_y - eye_r, int(width * 0.65) + eye_r, eye_y + eye_r), fill=fg)
        if symbol == "😊":
            draw.arc((int(width * 0.3), int(height * 0.42), int(width * 0.7), int(height * 0.76)), start=10, end=170, fill=fg, width=stroke)
        elif symbol == "😢":
            draw.arc((int(width * 0.3), int(height * 0.58), int(width * 0.7), int(height * 0.78)), start=190, end=350, fill=fg, width=stroke)
            draw.ellipse((int(width * 0.62), int(height * 0.46), int(width * 0.7), int(height * 0.62)), fill=fg)
        else:
            draw.line((int(width * 0.28), int(height * 0.34), int(width * 0.4), int(height * 0.38)), fill=fg, width=stroke)
            draw.line((int(width * 0.6), int(height * 0.38), int(width * 0.72), int(height * 0.34)), fill=fg, width=stroke)
            draw.arc((int(width * 0.3), int(height * 0.58), int(width * 0.7), int(height * 0.78)), start=190, end=350, fill=fg, width=stroke)
        return True
    if symbol == "⭐":
        points = []
        outer = min(width, height) * 0.32
        inner = outer * 0.42
        import math
        for i in range(10):
            angle = -math.pi / 2 + i * math.pi / 5
            radius = outer if i % 2 == 0 else inner
            points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
        draw.polygon(points, fill=fg)
        return True
    if symbol == "☀️":
        import math
        core = min(width, height) * 0.18
        draw.ellipse((cx - core, cy - core, cx + core, cy + core), fill=fg)
        for i in range(8):
            angle = i * math.pi / 4
            x1 = cx + math.cos(angle) * core * 1.5
            y1 = cy + math.sin(angle) * core * 1.5
            x2 = cx + math.cos(angle) * core * 2.4
            y2 = cy + math.sin(angle) * core * 2.4
            draw.line((x1, y1, x2, y2), fill=fg, width=stroke)
        return True
    if symbol == "🌙":
        r = min(width, height) * 0.28
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fg)
        cut = int(r * 0.7)
        draw.ellipse((cx - r + cut, cy - r * 1.05, cx + r + cut, cy + r * 0.95), fill=bg)
        return True
    if symbol == "☁️":
        draw.ellipse((int(width * 0.22), int(height * 0.42), int(width * 0.5), int(height * 0.72)), fill=fg)
        draw.ellipse((int(width * 0.4), int(height * 0.3), int(width * 0.72), int(height * 0.68)), fill=fg)
        draw.ellipse((int(width * 0.56), int(height * 0.42), int(width * 0.82), int(height * 0.72)), fill=fg)
        draw.rounded_rectangle((int(width * 0.24), int(height * 0.52), int(width * 0.8), int(height * 0.76)), radius=stroke * 2, fill=fg)
        return True
    if symbol == "⚡":
        draw.polygon([(int(width * 0.56), top), (int(width * 0.4), int(height * 0.47)), (int(width * 0.58), int(height * 0.47)), (int(width * 0.42), bottom), (int(width * 0.64), int(height * 0.58)), (int(width * 0.48), int(height * 0.58))], fill=fg)
        return True
    if symbol == "🎵":
        draw.line((int(width * 0.42), int(height * 0.28), int(width * 0.42), int(height * 0.72)), fill=fg, width=stroke)
        draw.line((int(width * 0.42), int(height * 0.3), int(width * 0.72), int(height * 0.22)), fill=fg, width=stroke)
        draw.line((int(width * 0.72), int(height * 0.22), int(width * 0.72), int(height * 0.58)), fill=fg, width=stroke)
        draw.ellipse((int(width * 0.28), int(height * 0.62), int(width * 0.48), int(height * 0.82)), fill=fg)
        draw.ellipse((int(width * 0.58), int(height * 0.48), int(width * 0.78), int(height * 0.68)), fill=fg)
        return True
    return False


def _normalize_bitmap_intensity(bitmap: np.ndarray, invert: bool) -> np.ndarray:
    threshold = 0.04
    if invert:
        ink_mask = bitmap < 1.0 - threshold
        normalized = np.ones_like(bitmap, dtype=np.float32)
        normalized[ink_mask] = 0.0
        return normalized
    ink_mask = bitmap > threshold
    normalized = np.zeros_like(bitmap, dtype=np.float32)
    normalized[ink_mask] = 1.0
    return normalized


def _normalize_uploaded_image(bitmap: np.ndarray, invert: bool) -> np.ndarray:
    """Prepare uploaded images for synthesis with robust auto-contrast."""
    values = np.clip(bitmap.astype(np.float32), 0.0, 1.0)
    # For regular mode dark pixels should become "ink" (high amplitude).
    working = values if invert else (1.0 - values)
    low = float(np.percentile(working, 2.0))
    high = float(np.percentile(working, 98.0))
    if high - low < 1e-6:
        low = float(np.min(working))
        high = float(np.max(working))
    if high - low < 1e-6:
        return np.clip(working, 0.0, 1.0).astype(np.float32)
    normalized = (working - low) / (high - low)
    normalized = np.clip(normalized, 0.0, 1.0)
    # Slight gamma lift preserves faint details.
    normalized = normalized**0.85
    return normalized.astype(np.float32)


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

    normalized_text = _normalize_symbol(text)
    text_lines = text.splitlines()
    if len(text_lines) > 1:
        final_img = Image.new("L", (width, height), color=bg)
        usable_lines = [line if line.strip() else " " for line in text_lines]
        slot_h = max(1, target_h // max(1, len(usable_lines)))
        for line_index, line in enumerate(usable_lines):
            line_bitmap = render_text_bitmap(
                text=line,
                width=width,
                height=max(8, slot_h + 2 * vertical_margin_px),
                font_size=font_size,
                font_path=font_path,
                margin_px=margin_px,
                vertical_margin_px=vertical_margin_px,
                invert=invert,
            )
            line_img = Image.fromarray((line_bitmap * 255.0).astype(np.uint8), mode="L")
            top = vertical_margin_px + line_index * slot_h
            final_img.paste(line_img.crop((0, vertical_margin_px, width, line_img.height - vertical_margin_px)), (0, min(top, height - 1)))
        bitmap = np.asarray(final_img, dtype=np.float32) / 255.0
        return _normalize_bitmap_intensity(bitmap, invert)
    supported_emojis = set(_emoji_aliases().values())
    if normalized_text in supported_emojis:
        final_img = Image.new("L", (width, height), color=bg)
        icon_w = max(1, target_w)
        icon_h = max(1, target_h)
        icon = Image.new("L", (icon_w, icon_h), color=bg)
        icon_draw = ImageDraw.Draw(icon)
        if _draw_supported_emoji(icon_draw, normalized_text, icon_w, icon_h, fg, bg):
            offset_x = margin_px + max(0, (target_w - icon_w) // 2)
            offset_y = vertical_margin_px + max(0, (target_h - icon_h) // 2)
            final_img.paste(icon, (offset_x, offset_y))
            bitmap = np.asarray(final_img, dtype=np.float32) / 255.0
            return _normalize_bitmap_intensity(bitmap, invert)

    chosen_font = None
    chosen_bbox = None
    chosen_w = chosen_h = 0
    for test_size in range(max(8, font_size), 7, -2):
        font = find_font(font_path, test_size)
        text_w, text_h, bbox = _measure_text(text, font)
        if text_w <= target_w and text_h <= target_h:
            chosen_font = font
            chosen_bbox = bbox
            chosen_w = text_w
            chosen_h = text_h
            break
        chosen_font = font
        chosen_bbox = bbox
        chosen_w = text_w
        chosen_h = text_h

    assert chosen_font is not None and chosen_bbox is not None
    pad = 6
    scratch = Image.new("L", (max(1, chosen_w + 2 * pad), max(1, chosen_h + 2 * pad)), color=bg)
    draw = ImageDraw.Draw(scratch)
    draw.text((pad - chosen_bbox[0], pad - chosen_bbox[1]), text, fill=fg, font=chosen_font)

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
    bitmap = np.asarray(final_img, dtype=np.float32) / 255.0
    return _normalize_bitmap_intensity(bitmap, invert)


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


def _split_freq_x_segments(text: str, freq_x_marquee: bool, freq_x_word_rows: bool) -> list[str]:
    if freq_x_marquee:
        return [char for char in text if char.strip()]
    if freq_x_word_rows:
        return [word for word in text.split() if word.strip()]
    return [text]


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
    freq_x_marquee: bool,
    freq_x_word_rows: bool,
    edge_pad_cols: int,
    image_base64: Optional[str] = None,
) -> tuple[np.ndarray, int, float]:
    """Render, orient and pad bitmap into the working [freq_bins, time_bins] shape."""
    resolved_pad = auto_edge_pad_cols(img_width, img_height, orientation, edge_pad_cols)
    segments = _split_freq_x_segments(text, freq_x_marquee if orientation == "freq-x" else False, freq_x_word_rows if orientation == "freq-x" else False)
    rendered_segments: list[np.ndarray] = []

    def render_segment(segment_text: str) -> np.ndarray:
        if image_base64:
            try:
                image_bytes = base64.b64decode(image_base64, validate=True)
                with Image.open(io.BytesIO(image_bytes)) as uploaded:
                    prepared = uploaded.convert("L").resize((img_width, img_height), Image.Resampling.LANCZOS)
                    bitmap = np.asarray(prepared, dtype=np.float32) / 255.0
                    return _normalize_uploaded_image(bitmap, invert)
            except Exception as exc:
                raise ValueError("Не удалось декодировать image_base64.") from exc
        return bitmap_from_text(
            text=segment_text,
            width=img_width,
            height=img_height,
            font_size=font_size,
            font_path=font_path,
            margin_px=margin,
            vertical_margin_px=vertical_margin,
            invert=invert,
        )

    for segment in segments:
        bitmap_img = render_segment(segment)
        bitmap = orient_bitmap(bitmap_img, orientation, freq_x_rotation)
        rendered_segments.append(bitmap)

    if len(rendered_segments) == 1:
        bitmap = pad_bitmap_time_axis(rendered_segments[0], resolved_pad, resolved_pad)
        return bitmap, resolved_pad, 1

    inter_segment_gap = max(1, resolved_pad // 5)
    gap_bitmap = np.zeros((rendered_segments[0].shape[0], inter_segment_gap), dtype=np.float32)
    composite: list[np.ndarray] = []
    for index, segment_bitmap in enumerate(rendered_segments):
        if index > 0:
            composite.append(gap_bitmap)
        composite.append(segment_bitmap)

    bitmap = np.concatenate(composite, axis=1)
    bitmap = pad_bitmap_time_axis(bitmap, resolved_pad, resolved_pad)
    baseline_segment = rendered_segments[0].shape[1] + 2 * resolved_pad
    duration_multiplier = max(1.0, bitmap.shape[1] / baseline_segment)
    return bitmap, resolved_pad, duration_multiplier


def save_preview_png(bitmap: np.ndarray) -> bytes:
    """Serialize a preview PNG from the synthesis bitmap."""
    preview = np.flipud(np.clip(bitmap, 0.0, 1.0))
    image = Image.fromarray((preview * 255.0).astype(np.uint8), mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
