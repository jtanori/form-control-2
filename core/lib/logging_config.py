"""Structured JSON logging (INFR-002) for every core endpoint.

Log lines share one shape with the TypeScript logger in `extensions/shared/`:

    {"ts": "...", "level": "info", "component": "core.nlu", "sessionId": "...", "message": "...", ...}

`sessionId` is carried in a contextvar so handlers never have to thread it
through call signatures; the FastAPI middleware in `core.api.middleware` binds
it from the `X-Session-Id` header or the JSON body.
"""

from __future__ import annotations

import json
import logging
import sys
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Iterator

_session_id: ContextVar[str | None] = ContextVar("session_id", default=None)
_component: ContextVar[str | None] = ContextVar("component", default=None)

#: Attributes present on every `logging.LogRecord`; anything else is treated as
#: structured extra data and merged into the JSON line.
_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName", "message", "asctime", "sessionId",
    "component",
}


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": utcnow_iso(),
            "level": record.levelname.lower(),
            "component": getattr(record, "component", None) or _component.get() or record.name,
            "sessionId": getattr(record, "sessionId", None) or _session_id.get(),
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED or key.startswith("_"):
                continue
            try:
                json.dumps(value)
            except (TypeError, ValueError):  # pragma: no cover - fallback for odd objects
                value = repr(value)
            payload[key] = value
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging(
    session_id: str | None = None,
    component: str = "core",
    level: str | int | None = None,
) -> None:
    """Install the JSON formatter on the `core` root logger (idempotent)."""
    if session_id:
        _session_id.set(session_id)
    _component.set(component)

    logger = logging.getLogger("core")
    resolved_level = level if level is not None else None
    if resolved_level is not None:
        logger.setLevel(resolved_level)

    if not any(isinstance(h.formatter, JsonFormatter) for h in logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    logger.propagate = False
    if logger.level == logging.NOTSET:
        logger.setLevel(logging.INFO)


class _ComponentAdapter(logging.LoggerAdapter):
    """LoggerAdapter that merges (instead of replacing) caller `extra` fields."""

    def process(self, msg, kwargs):  # noqa: D102
        merged = dict(self.extra or {})
        merged.update(kwargs.get("extra") or {})
        kwargs["extra"] = merged
        return msg, kwargs


def get_logger(component: str | None = None) -> logging.Logger:
    logger = logging.getLogger(f"core.{component}" if component else "core")
    if component:
        return _ComponentAdapter(logger, {"component": f"core.{component}"})  # type: ignore[return-value]
    return logger


def current_session_id() -> str | None:
    return _session_id.get()


def bind_session_id(session_id: str | None):
    """Return the token so the caller can `_session_id.reset(token)`."""
    return _session_id.set(session_id)


def reset_session_id(token) -> None:
    _session_id.reset(token)


@contextmanager
def session_context(session_id: str | None) -> Iterator[None]:
    token = _session_id.set(session_id)
    try:
        yield
    finally:
        _session_id.reset(token)


configure_logging()
