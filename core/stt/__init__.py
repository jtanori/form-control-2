"""STT-001 — local speech-to-text microservice surface (mounted on core)."""

from core.stt.service import (
    MAX_AUDIO_BYTES,
    SttError,
    SttNotConfigured,
    TranscriptionService,
)

__all__ = [
    "MAX_AUDIO_BYTES",
    "SttError",
    "SttNotConfigured",
    "TranscriptionService",
]
