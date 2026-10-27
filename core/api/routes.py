"""HTTP routes for Phase 1 (CORE-001 … CORE-004)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from core import __version__
from core.adapters.normalizer import NormalizationError, normalize_snapshot
from core.api.schemas import (
    ClarifyRequest,
    ClarifyResponse,
    HealthResponse,
    NormalizeResponse,
    ParseRequest,
    ParseResponse,
    SessionStateResponse,
)
from core.lib.logging_config import get_logger
from core.nlu.clarify import (
    ClarificationError,
    ClarificationInputError,
    ClarificationResolver,
)
from core.nlu.parser import ParseResult
from core.session.manager import SessionManager

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
    sessions: SessionManager = request.app.state.sessions
    history = payload.history or sessions.history(payload.sessionId)
    result = parser.parse(
        session_id=payload.sessionId,
        transcript=payload.transcript,
        snapshot=payload.context,
        history=history,
    )
    if result.needs_clarification:
        ClarificationResolver(parser, request.app.state.store).remember(
            result, result.snapshot
        )
        sessions.record(payload.sessionId, snapshot=result.snapshot)
        return _parse_response(result, withhold=True)

    sessions.record(
        payload.sessionId, snapshot=result.snapshot, commands=result.commands
    )
    # A successful parse supersedes any pending ambiguity (CORE-002).
    request.app.state.store.clear_clarification(payload.sessionId)
    return _parse_response(result)


@router.post("/clarify", response_model=ClarifyResponse)
def clarify(payload: ClarifyRequest, request: Request) -> ClarifyResponse:
    """Resolve a pending ambiguity (CORE-002).

    The answer is matched against the stored candidates only - the parser never
    re-guesses. Commands resolved before the ambiguity are replayed together
    with the newly disambiguated one.
    """
    resolver = ClarificationResolver(request.app.state.parser, request.app.state.store)
    try:
        result = resolver.resolve(
            session_id=payload.sessionId,
            clarification_text=payload.text,
            snapshot=payload.context,
        )
    except ClarificationInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ClarificationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if not result.needs_clarification:
        request.app.state.sessions.record(
            payload.sessionId, snapshot=result.snapshot, commands=result.commands
        )
    return ParseResponse(**result.response_payload())


@router.post("/context/normalize", response_model=NormalizeResponse)
def normalize_context(payload: dict[str, Any]) -> NormalizeResponse:
    """CORE-004 adapter: any bridge payload -> canonical `FormSnapshot`.

    Bridges may POST their raw DOM/Accessibility/vision dump here to validate it
    before sending commands; `/parse` runs the same normalizer automatically.
    """
    try:
        snapshot = normalize_snapshot(payload)
    except NormalizationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return NormalizeResponse(snapshot=snapshot)


@router.get("/session/{session_id}", response_model=SessionStateResponse)
def get_session(session_id: str, request: Request) -> SessionStateResponse:
    """Current `SessionState` for a session (CORE-003).

    Clients fetch this before speaking; unknown sessions return an empty state
    rather than a 404 so the bridge can start a conversation unconditionally.
    """
    state = request.app.state.sessions.get(session_id)
    return SessionStateResponse(**state)


__all__ = ["router"]
