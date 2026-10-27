"""HTTP routes for Phase 1 (CORE-001 … CORE-004)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from core import __version__
from core.api.schemas import (
    ClarifyRequest,
    ClarifyResponse,
    HealthResponse,
    ParseRequest,
    ParseResponse,
)
from core.lib.logging_config import get_logger
from core.nlu.parser import ParseResult

log = get_logger("api.routes")

router = APIRouter(prefix="/api/v1")


def _parse_response(result: ParseResult, *, withhold: bool = False) -> ParseResponse:
    return ParseResponse(**result.response_payload(withhold_commands=withhold))


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    state = request.app.state
    store = getattr(state, "store", None)
    return HealthResponse(
        status="ok",
        version=__version__,
        provider=state.parser.provider.name,
        sessionBackend=getattr(store, "backend_name", "unconfigured"),
    )


@router.post("/parse", response_model=ParseResponse)
def parse(payload: ParseRequest, request: Request) -> ParseResponse:
    """Transcript + FormSnapshot -> `Command[]` (CORE-001).

    When the target is ambiguous the response carries `needsClarification` and a
    `clarification` object (CORE-002); the parser's already-resolved commands
    are held in the session and replayed by `POST /api/v1/clarify`.
    """
    parser = request.app.state.parser
    result = parser.parse(
        session_id=payload.sessionId,
        transcript=payload.transcript,
        snapshot=payload.context,
        history=payload.history,
    )
    return _parse_response(result, withhold=result.needs_clarification)


__all__ = ["router"]
