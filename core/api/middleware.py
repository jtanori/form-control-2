"""Correlation middleware: bind `sessionId` into the logging contextvar.

Implements INFR-002's requirement that every core log line carries the
`sessionId` of the request that produced it, without handlers threading it
through. Pure ASGI so the buffered request body is replayed untouched.
"""

from __future__ import annotations

import json
import time

from core.lib.logging_config import bind_session_id, get_logger, reset_session_id

log = get_logger("api")


class SessionLoggingMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers") or []
        }
        session_id = headers.get("x-session-id")

        body = b""
        more = True
        started = time.perf_counter()
        # Small JSON bodies only: buffer once so we can sniff sessionId and replay.
        while more:
            message = await receive()
            if message["type"] != "http.request":
                body = None  # type: ignore[assignment]
                break
            body += message.get("body", b"")
            more = message.get("more_body", False)

        if body and not session_id:
            session_id = self._sniff_session_id(headers, body)

        replayed = False

        async def replay_receive():
            nonlocal replayed
            if body is not None and not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                log.info(
                    "request",
                    extra={
                        "method": scope.get("method"),
                        "path": scope.get("path"),
                        "status": message.get("status"),
                        "durationMs": round((time.perf_counter() - started) * 1000, 1),
                    },
                )
            await send(message)

        token = bind_session_id(session_id)
        try:
            await self.app(scope, replay_receive, send_wrapper)
        finally:
            reset_session_id(token)

    @staticmethod
    def _sniff_session_id(headers: dict[str, str], body: bytes) -> str | None:
        if "json" not in headers.get("content-type", ""):
            return None
        try:
            payload = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        if isinstance(payload, dict):
            value = payload.get("sessionId")
            if isinstance(value, str) and value:
                return value
        return None
