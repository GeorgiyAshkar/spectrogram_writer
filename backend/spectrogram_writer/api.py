from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from .core import GenerationConfig
from .schemas import GenerationRequest
from .service import build_preview, build_wav

router = APIRouter(prefix="/api")
ROOT_DIR = Path(__file__).resolve().parents[2]
LOGO_FILE = ROOT_DIR / "logo.png"


@router.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@router.get("/branding/logo")
def branding_logo() -> Response:
    if not LOGO_FILE.exists():
        return Response(status_code=404)
    return FileResponse(LOGO_FILE, media_type="image/png")


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
