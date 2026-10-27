"""FastAPI application factory for the VoiceForm core service.

Run locally:

    uvicorn core.main:app --host 0.0.0.0 --port 8020

Only `GET /api/v1/health` and the Phase-1 NLU endpoints are implemented so far;
later phases mount their own routers here.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core import __version__
from core.api.middleware import SessionLoggingMiddleware
from core.api.routes import router
from core.config import Settings, get_settings
from core.lib.contracts import ContractError
from core.lib.logging_config import configure_logging, get_logger
from core.nlu.parser import ParseInputError, Parser
from core.nlu.provider import ProviderError

log = get_logger("main")


def create_app(settings: Settings | None = None, parser: Parser | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(component="core", level=settings.log_level)

    app = FastAPI(
        title="VoiceForm Universal Core",
        version=__version__,
        description="Transcript → structured form commands (Phase 1: CORE-001 … CORE-004).",
    )
    app.state.settings = settings
    app.state.parser = parser or Parser(settings=settings)

    app.add_middleware(SessionLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # loopback-only service; QA-001 tightens this
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(ParseInputError)
    async def _input_error(request: Request, exc: ParseInputError) -> JSONResponse:
        log.warning("invalid parse request", extra={"error": str(exc)})
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(ProviderError)
    async def _provider_error(request: Request, exc: ProviderError) -> JSONResponse:
        log.error("nlu provider failure", extra={"error": str(exc)})
        return JSONResponse(status_code=502, content={"detail": "NLU provider unavailable"})

    @app.exception_handler(ContractError)
    async def _contract_error(request: Request, exc: ContractError) -> JSONResponse:
        log.error("contract violation", extra={"error": str(exc)})
        return JSONResponse(status_code=500, content={"detail": "contract violation"})

    app.include_router(router)
    return app


app = create_app()
