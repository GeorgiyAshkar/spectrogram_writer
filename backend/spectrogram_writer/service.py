from __future__ import annotations

import base64
from dataclasses import asdict

from .core import GenerationConfig, generate_artifacts


def generate_assets(config: GenerationConfig) -> dict:
    artifacts = generate_artifacts(config)
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
    payload = generate_assets(config)
    payload.pop("wavBase64")
    return payload


def build_wav(config: GenerationConfig) -> bytes:
    return generate_artifacts(config).wav_bytes
