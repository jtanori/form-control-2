"""STT-001 HTTP endpoints: POST /stt/transcribe (+ alias /transcribe).

Kept at the root (not under /api/v1) so extension/Android bridges that were
spec'd against `POST /stt/transcribe` work unchanged.
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from core.lib import contracts
from core.lib.logging_config import get_logger
from core.stt import MAX_AUDIO_BYTES, SttError, TranscriptionService

log = get_logger("api.stt")

router = APIRouter(tags=["stt"])


async def _transcribe(
    request: Request,
    audio: UploadFile,
    language: str,
) -> dict:
    service: TranscriptionService = request.app.state.stt
    payload = await audio.read()
    if not payload:
        raise HTTPException(status_code=400, detail="audio file is empty")
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio file too large")
    try:
        result = service.transcribe(
            payload,
            audio.filename or "speech.webm",
            language=language or "auto",
        )
    except SttError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    contracts.validate("stt-response", result)
    return result


@router.post("/stt/transcribe")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    language: str = Form("auto"),
) -> dict:
    """Multipart upload (`audio` field) → contract stt-response JSON."""
    return await _transcribe(request, audio, language)


@router.post("/transcribe")
async def transcribe_alias(
    request: Request,
    audio: UploadFile = File(...),
    language: str = Form("auto"),
) -> dict:
    """Alias kept for the original STT-001 spec wording."""
    return await _transcribe(request, audio, language)
