"""STT-001 — local speech-to-text backends.

Default: proxy to a whisper.cpp server (`STT_WHISPER_URL`).
Fallback: `STT_FALLBACK=openai_whisper_api` forwards to the OpenAI Whisper API.

Response shape is the v1 contract `stt-response` (transcript/language/confidence/
duration_sec) — EXT-006 and AND-004 consume it as-is.
"""

from __future__ import annotations

import time
from typing import Any, Callable

import httpx

from core.config import Settings
from core.lib import contracts
from core.lib.logging_config import get_logger

log = get_logger("stt")

#: post(url, *, data, files, headers, timeout) -> httpx.Response
PostFn = Callable[..., httpx.Response]

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MiB — long clips, still bounded


class SttError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class SttNotConfigured(SttError):
    def __init__(self, message: str | None = None) -> None:
        super().__init__(
            message
            or (
                "no STT backend configured — set STT_WHISPER_URL "
                "(local whisper.cpp) or STT_FALLBACK=openai_whisper_api"
            ),
            status_code=503,
        )


class TranscriptionService:
    """Selects a backend and returns a contract-valid stt-response payload."""

    def __init__(
        self,
        settings: Settings,
        post: PostFn | None = None,
    ) -> None:
        self.settings = settings
        self._post = post or httpx.post

    @property
    def backend(self) -> str:
        """`openai` | `whisper` | `off` — reported by /api/v1/health."""
        fallback = (self.settings.stt_fallback or "").strip().lower()
        if fallback == "openai_whisper_api":
            return "openai"
        if self.settings.stt_whisper_url:
            return "whisper"
        return "off"

    def transcribe(
        self,
        audio: bytes,
        filename: str = "speech.webm",
        *,
        language: str = "auto",
    ) -> dict[str, Any]:
        if not audio:
            raise SttError("audio file is empty", status_code=400)
        if len(audio) > MAX_AUDIO_BYTES:
            raise SttError(
                f"audio exceeds {MAX_AUDIO_BYTES} bytes", status_code=413
            )

        backend = self.backend
        if backend == "openai":
            result = self._transcribe_openai(audio, filename, language=language)
        elif backend == "whisper":
            result = self._transcribe_whisper(audio, filename, language=language)
        else:
            raise SttNotConfigured()

        contracts.validate("stt-response", result)
        log.info(
            "transcribed",
            extra={
                "backend": backend,
                "language": result["language"],
                "audioBytes": len(audio),
                "transcriptChars": len(result["transcript"]),
            },
        )
        return result

    # ---- whisper.cpp server (POST /inference) ----

    def _transcribe_whisper(
        self,
        audio: bytes,
        filename: str,
        *,
        language: str,
    ) -> dict[str, Any]:
        base = (self.settings.stt_whisper_url or "").rstrip("/")
        content_type = _guess_content_type(filename)
        params: dict[str, str] = {"response_format": "json"}
        if language and language.lower() != "auto":
            params["language"] = language.lower()

        try:
            resp = self._post(
                f"{base}/inference",
                files={"file": (filename, audio, content_type)},
                data=params,
                timeout=self.settings.stt_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise SttError(f"whisper server unreachable: {exc}") from exc

        if resp.status_code >= 400:
            raise SttError(
                f"whisper server -> HTTP {resp.status_code}: {resp.text[:200]}"
            )
        try:
            payload = resp.json()
        except ValueError as exc:
            raise SttError("whisper server returned non-JSON body") from exc
        return _normalize_whisper_payload(payload, requested_language=language)

    # ---- OpenAI Whisper API ----

    def _transcribe_openai(
        self,
        audio: bytes,
        filename: str,
        *,
        language: str,
    ) -> dict[str, Any]:
        api_key = self.settings.openai_api_key
        if not api_key:
            raise SttNotConfigured(
                "STT_FALLBACK=openai_whisper_api requires OPENAI_API_KEY",
            )
        content_type = _guess_content_type(filename)
        data: dict[str, str] = {"model": "whisper-1"}
        if language and language.lower() != "auto":
            data["language"] = language.lower().split("-")[0]

        try:
            resp = self._post(
                "https://api.openai.com/v1/audio/transcriptions",
                files={"file": (filename, audio, content_type)},
                data=data,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=self.settings.stt_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise SttError(f"OpenAI STT unreachable: {exc}") from exc

        if resp.status_code >= 400:
            raise SttError(
                f"OpenAI STT -> HTTP {resp.status_code}: {resp.text[:200]}"
            )
        try:
            payload = resp.json()
        except ValueError as exc:
            raise SttError("OpenAI STT returned non-JSON body") from exc

        text = str(payload.get("text") or "").strip()
        # The hosted API does not report a detected language; echo the request
        # (or "unknown" for auto) so the contract stays honest.
        if language and language.lower() != "auto":
            lang = language.lower().split("-")[0]
        else:
            lang = str(payload.get("language") or "unknown")
        result = {
            "transcript": text,
            "language": lang,
            "confidence": 0.0,
            "duration_sec": 0.0,
        }
        return result


def _guess_content_type(filename: str) -> str:
    name = filename.lower()
    if name.endswith(".wav"):
        return "audio/wav"
    if name.endswith(".ogg") or name.endswith(".opus"):
        return "audio/ogg"
    if name.endswith(".mp3"):
        return "audio/mpeg"
    if name.endswith(".m4a"):
        return "audio/mp4"
    return "audio/webm"


def _normalize_whisper_payload(
    payload: Any,
    *,
    requested_language: str,
) -> dict[str, Any]:
    """Best-effort parse of whisper.cpp server JSON into the v1 contract."""
    if not isinstance(payload, dict):
        raise SttError("whisper server JSON was not an object")

    text = str(payload.get("text") or "").strip()
    segments = payload.get("transcription") if isinstance(payload.get("transcription"), list) else None
    if not text and segments:
        text = "".join(str(seg.get("text") or "") for seg in segments).strip()

    detected = payload.get("detected_language") or payload.get("language")
    if isinstance(detected, str) and detected.strip():
        language = detected.strip().lower()
    elif requested_language and requested_language.lower() != "auto":
        language = requested_language.lower().split("-")[0]
    else:
        language = "unknown"

    confidence = _confidence(payload, segments)
    duration = _duration(payload, segments)
    return {
        "transcript": text,
        "language": language,
        "confidence": confidence,
        "duration_sec": duration,
    }


def _confidence(payload: dict[str, Any], segments: list[Any] | None) -> float:
    for key in ("confidence", "avg_logprob", "average_confidence"):
        value = payload.get(key)
        if isinstance(value, (int, float)):
            return _clamp01(value)
    if segments:
        probs = [
            float(seg["avg_logprob"])
            for seg in segments
            if isinstance(seg, dict) and isinstance(seg.get("avg_logprob"), (int, float))
        ]
        if probs:
            # avg_logprob is <=0 (nats); map exp(avg) into 0..1 as a proxy
            import math

            return _clamp01(math.exp(sum(probs) / len(probs)))
    return 0.0


def _duration(payload: dict[str, Any], segments: list[Any] | None) -> float:
    for key in ("duration_sec", "duration", "audio_duration"):
        value = payload.get(key)
        if isinstance(value, (int, float)) and value >= 0:
            return float(value)
    if segments:
        ends = []
        for seg in segments:
            if not isinstance(seg, dict):
                continue
            offsets = seg.get("offsets")
            if isinstance(offsets, dict):
                to = offsets.get("to")
                if isinstance(to, (int, float)):
                    ends.append(float(to))
            end = seg.get("end")
            if isinstance(end, (int, float)):
                ends.append(float(end))
        if ends:
            # whisper.cpp offsets are milliseconds
            span = max(ends)
            return span / 1000.0 if span > 600 else span
    return 0.0


def _clamp01(value: float) -> float:
    if value < 0:
        # avg_logprob-like inputs: exp already applied by caller in those cases
        return 0.0
    if value > 1:
        return 1.0
    return float(value)


def elapsed_seconds(started: float) -> float:
    return round(max(0.0, time.perf_counter() - started), 3)
