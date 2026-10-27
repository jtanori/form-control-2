"""Session persistence (CORE-002 clarification state, CORE-003 session state).

Keys (shared contract with CORE-003, EXT-006, AND-005):

    session:{sessionId}                -> SessionState (CONTRACT-001)
    session:{sessionId}:clarification  -> pending clarification (CORE-002)

Both backends implement the same interface, so Redis and the in-memory fallback
are interchangeable in dev, CI and production:

* `RedisSessionStore` — the compose/dev default (`REDIS_URL`).
* `InMemorySessionStore` — used when Redis is not configured/unreachable, and by
  tests. Process-local; state is lost on restart.

TTL: every write refreshes `SESSION_TTL_SECONDS` (default 30 min idle).
"""

from __future__ import annotations

import abc
import json
import threading
import time
from datetime import datetime, timezone
from typing import Any

from core.config import Settings, get_settings
from core.lib import contracts
from core.lib.contracts import ContractError
from core.lib.logging_config import get_logger

log = get_logger("session.store")

SESSION_KEY = "session:{session_id}"
CLARIFICATION_KEY = "session:{session_id}:clarification"


def session_key(session_id: str) -> str:
    return SESSION_KEY.format(session_id=session_id)


def clarification_key(session_id: str) -> str:
    return CLARIFICATION_KEY.format(session_id=session_id)


class SessionStoreError(RuntimeError):
    """Storage is unavailable or the payload cannot be (de)serialized."""


class SessionStore(abc.ABC):
    backend_name = "abstract"

    def __init__(self, ttl_seconds: int = 1800) -> None:
        self.ttl_seconds = int(ttl_seconds)
        #: Serializes read-modify-write cycles (e.g. `SessionManager.record`)
        #: within this process. Cross-process races still need Redis WATCH/Lua.
        self.lock = threading.RLock()

    # -- backend primitives ------------------------------------------------- #

    @abc.abstractmethod
    def _read(self, key: str) -> str | None: ...

    @abc.abstractmethod
    def _write(self, key: str, value: str) -> None: ...

    @abc.abstractmethod
    def _delete(self, key: str) -> None: ...

    def ping(self) -> bool:  # pragma: no cover - trivial
        try:
            self._read("__ping__")
        except Exception:
            return False
        return True

    def close(self) -> None:  # pragma: no cover - no-op by default
        return None

    # -- helpers ------------------------------------------------------------ #

    def _read_json(self, key: str) -> dict[str, Any] | None:
        raw = self._read(key)
        if raw is None:
            return None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            log.warning("discarding corrupt session payload", extra={"key": key, "error": str(exc)})
            self._delete(key)
            return None
        return payload if isinstance(payload, dict) else None

    def _write_json(self, key: str, payload: dict[str, Any]) -> None:
        try:
            serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
            raise SessionStoreError(f"payload not serializable: {exc}") from exc
        self._write(key, serialized)

    # -- CORE-002: clarification state -------------------------------------- #

    def save_clarification(self, session_id: str, pending: dict[str, Any]) -> None:
        payload = dict(pending)
        payload["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self._write_json(clarification_key(session_id), payload)

    def get_clarification(self, session_id: str) -> dict[str, Any] | None:
        return self._read_json(clarification_key(session_id))

    def clear_clarification(self, session_id: str) -> None:
        self._delete(clarification_key(session_id))

    # -- CORE-003: SessionState --------------------------------------------- #

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Stored `SessionState`, or None when absent/corrupt."""
        payload = self._read_json(session_key(session_id))
        if payload is None:
            return None
        try:
            contracts.validate("form-context", payload)
        except ContractError as exc:
            log.warning(
                "discarding contract-invalid session state",
                extra={"key": session_key(session_id), "error": str(exc)},
            )
            self._delete(session_key(session_id))
            return None
        return payload

    def save_session(self, state: dict[str, Any]) -> dict[str, Any]:
        """Persist a `SessionState`, refreshing the idle TTL."""
        try:
            contracts.validate("form-context", state)
        except ContractError as exc:
            raise SessionStoreError(f"invalid SessionState: {exc}") from exc
        self._write_json(session_key(state["sessionId"]), state)
        return state

    def delete_session(self, session_id: str) -> None:
        self._delete(session_key(session_id))


class InMemorySessionStore(SessionStore):
    """Process-local store with per-key expiry; used for dev and tests."""

    backend_name = "memory"

    def __init__(self, ttl_seconds: int = 1800, clock=time.monotonic) -> None:
        super().__init__(ttl_seconds)
        self._data: dict[str, tuple[float, str]] = {}
        self._clock = clock

    def _purge(self) -> None:
        now = self._clock()
        expired = [key for key, (expires, _) in self._data.items() if expires <= now]
        for key in expired:
            self._data.pop(key, None)

    def _read(self, key: str) -> str | None:
        self._purge()
        entry = self._data.get(key)
        return entry[1] if entry else None

    def _write(self, key: str, value: str) -> None:
        if self.ttl_seconds <= 0:  # pragma: no cover - defensive
            raise SessionStoreError("ttl must be positive")
        self._data[key] = (self._clock() + self.ttl_seconds, value)

    def _delete(self, key: str) -> None:
        self._data.pop(key, None)

    def ping(self) -> bool:
        return True

    def keys(self) -> list[str]:  # test/debug helper
        self._purge()
        return sorted(self._data)


class RedisSessionStore(SessionStore):
    """Redis-backed store; the compose default (`REDIS_URL`)."""

    backend_name = "redis"

    def __init__(self, client: Any, ttl_seconds: int = 1800) -> None:
        super().__init__(ttl_seconds)
        self._client = client

    @classmethod
    def from_url(cls, url: str, ttl_seconds: int = 1800) -> "RedisSessionStore":
        import redis

        client = redis.Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=1.0,
        )
        client.ping()
        return cls(client, ttl_seconds=ttl_seconds)

    def _read(self, key: str) -> str | None:
        try:
            return self._client.get(key)
        except Exception as exc:  # pragma: no cover - network path
            raise SessionStoreError(f"redis get failed: {exc}") from exc

    def _write(self, key: str, value: str) -> None:
        try:
            self._client.setex(key, self.ttl_seconds, value)
        except Exception as exc:  # pragma: no cover - network path
            raise SessionStoreError(f"redis setex failed: {exc}") from exc

    def _delete(self, key: str) -> None:
        try:
            self._client.delete(key)
        except Exception as exc:  # pragma: no cover - network path
            raise SessionStoreError(f"redis delete failed: {exc}") from exc

    def ping(self) -> bool:  # pragma: no cover - network path
        try:
            return bool(self._client.ping())
        except Exception:
            return False

    def ttl(self, key: str) -> int:  # test/debug helper
        return int(self._client.ttl(key))

    def close(self) -> None:  # pragma: no cover - network path
        try:
            self._client.close()
        except Exception:
            pass


_store_cache: dict[str, Any] = {"key": None, "store": None, "checked_at": 0.0}
_STORE_RECHECK_SECONDS = 30.0


def _build_store(redis_url: str, ttl_seconds: int) -> SessionStore:
    try:
        store = RedisSessionStore.from_url(redis_url, ttl_seconds=ttl_seconds)
    except Exception as exc:
        log.warning(
            "redis unavailable, falling back to in-memory sessions",
            extra={"redisUrl": redis_url, "error": str(exc)},
        )
        return InMemorySessionStore(ttl_seconds=ttl_seconds)
    log.info("using redis session store", extra={"redisUrl": redis_url})
    return store


def get_session_store(settings: Settings | None = None) -> SessionStore:
    """Cached store with periodic Redis re-probe (not a permanent fallback).

    A failed Redis connect falls back to memory for at most
    `_STORE_RECHECK_SECONDS`, then is retried. A healthy Redis client is
    re-pinged on the same interval so a mid-flight outage re-probes instead of
    using a dead client forever.
    """
    settings = settings or get_settings()
    key = (settings.redis_url, settings.session_ttl_seconds)
    now = time.monotonic()
    cached = _store_cache["store"]
    if (
        cached is not None
        and _store_cache["key"] == key
        and (now - float(_store_cache["checked_at"])) < _STORE_RECHECK_SECONDS
    ):
        if cached.backend_name != "redis" or cached.ping():
            return cached
    store = _build_store(settings.redis_url, settings.session_ttl_seconds)
    _store_cache.update(key=key, store=store, checked_at=now)
    return store
