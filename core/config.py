"""Runtime configuration for the core service.

Everything is environment driven so the same image runs in compose, in CI and in
tests:

    CORE_HOST                  default 127.0.0.1
    CORE_PORT                  default 8020
    REDIS_URL                  default redis://localhost:6379/0
    SESSION_TTL_SECONDS        default 1800 (30 min idle, CORE-003)
    NLU_PROVIDER               auto | rule | openai        (default auto)
    OPENAI_API_KEY             enables the live LLM provider
    OPENAI_MODEL               default gpt-4o
    STT_WHISPER_URL            whisper.cpp server base (e.g. http://stt-whisper:8080)
    STT_FALLBACK               openai_whisper_api → use OpenAI Whisper API instead
    STT_TIMEOUT_SECONDS        per-request STT timeout (default 30)
    ALLOWED_ORIGINS            CSV of browser origins allowed by CORS
                               (default: loopback web + chrome-extension pages)
    TRANSCRIPT_MAX_CHARS        hard cap for /parse transcript (default 4000)
    LOG_LEVEL                  default INFO
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:  # pragma: no cover - defensive
        return default


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 8020
    redis_url: str = "redis://localhost:6379/0"
    session_ttl_seconds: int = 1800
    nlu_provider: str = "auto"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    stt_whisper_url: str | None = None
    stt_fallback: str | None = None
    stt_timeout_seconds: float = 30.0
    allowed_origins: tuple[str, ...] = ()
    transcript_max_chars: int = 4000
    log_level: str = "INFO"
    history_limit: int = 200
    prompt_path: str | None = field(default=None)

    @property
    def resolved_provider(self) -> str:
        """`auto` picks the live model only when a key is configured."""
        if self.nlu_provider in {"rule", "openai"}:
            return self.nlu_provider
        return "openai" if self.openai_api_key else "rule"


def load_settings() -> Settings:
    return Settings(
        host=os.getenv("CORE_HOST", "127.0.0.1"),
        port=_int("CORE_PORT", 8020),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        session_ttl_seconds=_int("SESSION_TTL_SECONDS", 1800),
        nlu_provider=os.getenv("NLU_PROVIDER", "auto").strip().lower() or "auto",
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        stt_whisper_url=os.getenv("STT_WHISPER_URL") or None,
        stt_fallback=os.getenv("STT_FALLBACK") or None,
        stt_timeout_seconds=float(os.getenv("STT_TIMEOUT_SECONDS", "30") or "30"),
        allowed_origins=tuple(
            part.strip()
            for part in (os.getenv("ALLOWED_ORIGINS") or "").split(",")
            if part.strip()
        ),
        transcript_max_chars=_int("TRANSCRIPT_MAX_CHARS", 4000),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        history_limit=_int("HISTORY_LIMIT", 200),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
