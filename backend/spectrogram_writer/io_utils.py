from __future__ import annotations

import io
import wave

import numpy as np


def save_wav_mono_16bit(signal: np.ndarray, samplerate: int) -> bytes:
    """Serialize a mono float waveform to 16-bit PCM WAV."""
    pcm = (np.clip(signal, -1.0, 1.0) * 32767.0).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(pcm.tobytes())
    return buffer.getvalue()
