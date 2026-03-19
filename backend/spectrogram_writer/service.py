from __future__ import annotations

import base64
from dataclasses import asdict
from pathlib import Path

from .core import GenerationConfig, generate_artifacts


def generate_assets(config: GenerationConfig) -> dict:
    """Build preview and WAV assets for API clients."""
    artifacts = generate_artifacts(config)
    if config.output:
        Path(config.output).write_bytes(artifacts.wav_bytes)
    if config.preview_png:
        Path(config.preview_png).write_bytes(artifacts.preview_png)
    return {
        "config": asdict(config),
        "previewImage": f"data:image/png;base64,{base64.b64encode(artifacts.preview_png).decode('ascii')}",
        "wavBase64": base64.b64encode(artifacts.wav_bytes).decode("ascii"),
        "autoEdgePad": artifacts.auto_edge_pad,
        "totalDuration": artifacts.total_duration,
        "bitmapShape": {
            "freqBins": int(artifacts.bitmap.shape[0]),
            "timeBins": int(artifacts.bitmap.shape[1]),
        },
    }


def build_preview(config: GenerationConfig) -> dict:
    """Build preview-only payload for API clients."""
    payload = generate_assets(config)
    payload.pop("wavBase64")
    return payload


def build_wav(config: GenerationConfig) -> bytes:
    """Build WAV bytes for download endpoints."""
    artifacts = generate_artifacts(config)
    if config.output:
        Path(config.output).write_bytes(artifacts.wav_bytes)
    if config.preview_png:
        Path(config.preview_png).write_bytes(artifacts.preview_png)
    return artifacts.wav_bytes
