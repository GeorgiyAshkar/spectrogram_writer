from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

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
    if LOGO_FILE.exists():
        return FileResponse(LOGO_FILE, media_type="image/png")

    svg = f"""<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 120' role='img' aria-label='Спектральный след'>
  <rect width='260' height='120' rx='20' fill='#faf5ef'/>
  <rect x='10' y='10' width='240' height='100' rx='16' fill='none' stroke='#d6ad7b' stroke-width='2'/>
  <path d='M34 78c14-34 26 8 40-22s26 10 40-18 24 8 38-16 22 12 40-10' fill='none' stroke='#b08968' stroke-width='6' stroke-linecap='round'/>
  <text x='130' y='96' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='18' font-weight='700' fill='#5f4633'>Спектральный след</text>
</svg>"""
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=3600", "Content-Disposition": f"inline; filename={quote('spectral-logo.svg')}"})


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
