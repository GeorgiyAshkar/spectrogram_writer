from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from .core import GenerationConfig
from .schemas import GenerationRequest
from .service import build_preview, build_wav

router = APIRouter(prefix="/api")


@router.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@router.post("/preview")
def preview(request: GenerationRequest) -> dict:
    try:
        return build_preview(GenerationConfig(**request.model_dump()))
    except Exception as exc:  # deliberate boundary for API errors
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/render")
def render(request: GenerationRequest) -> Response:
    try:
        wav_bytes = build_wav(GenerationConfig(**request.model_dump()))
    except Exception as exc:  # deliberate boundary for API errors
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="spectrogram.wav"'},
    )
