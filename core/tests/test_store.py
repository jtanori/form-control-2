"""Store-level tests: key naming, TTL and backend interchangeability."""

from __future__ import annotations

import fakeredis
import pytest

from core.session.store import (
    InMemorySessionStore,
    RedisSessionStore,
    clarification_key,
    session_key,
)


def test_key_naming_matches_the_core_003_contract():
    assert session_key("abc") == "session:abc"
    assert clarification_key("abc") == "session:abc:clarification"


def test_validator_instances_are_cached():
    from core.lib.contracts import validator

    assert validator("command") is validator("command")
    assert validator("form-context") is validator("form-context")


def test_session_store_exposes_a_reentrant_lock():
    store = InMemorySessionStore()
    assert hasattr(store, "lock")
    with store.lock:
        with store.lock:  # RLock: nested RMW is fine
            store.save_clarification("s", {"a": 1})
    assert store.get_clarification("s") is not None


def test_get_session_store_reprobes_after_failure_window():
    """A memory fallback must not be permanent — re-probe after the TTL."""
    import core.session.store as store_mod
    from core.config import Settings

    original_cache = dict(store_mod._store_cache)
    original_recheck = store_mod._STORE_RECHECK_SECONDS
    try:
        store_mod._store_cache.update(key=None, store=None, checked_at=0.0)
        settings = Settings(redis_url="redis://127.0.0.1:1/0", session_ttl_seconds=60)
        first = store_mod.get_session_store(settings)
        assert first.backend_name == "memory"
        # within the window the fallback is reused
        assert store_mod.get_session_store(settings) is first
        # after the window it is re-probed (still down → new memory store object)
        store_mod._store_cache["checked_at"] = (
            store_mod.time.monotonic() - store_mod._STORE_RECHECK_SECONDS - 1
        )
        second = store_mod.get_session_store(settings)
        assert second is not first
        assert second.backend_name == "memory"
    finally:
        store_mod._store_cache.clear()
        store_mod._store_cache.update(original_cache)
        store_mod._STORE_RECHECK_SECONDS = original_recheck


def test_in_memory_ttl_expiry():
    clock = [100.0]
    store = InMemorySessionStore(ttl_seconds=60, clock=lambda: clock[0])
    store.save_clarification("s", {"a": 1})
    pending = store.get_clarification("s")
    assert pending is not None and pending["a"] == 1
    clock[0] = 161.0
    assert store.get_clarification("s") is None


def test_clear_removes_only_the_clarification_key():
    store = InMemorySessionStore()
    store.save_clarification("s", {"a": 1})
    store.clear_clarification("s")
    assert store.get_clarification("s") is None
    assert store.keys() == []


def test_corrupt_payload_is_discarded():
    store = InMemorySessionStore()
    store._write(clarification_key("s"), "{not json")
    assert store.get_clarification("s") is None
    assert store.keys() == []


def test_redis_ttl_is_applied():
    client = fakeredis.FakeRedis(decode_responses=True)
    store = RedisSessionStore(client, ttl_seconds=120)
    store.save_clarification("s", {"a": 1})
    assert 0 < store.ttl(clarification_key("s")) <= 120
    store.clear_clarification("s")
    assert store.get_clarification("s") is None


@pytest.mark.parametrize("backend", ["memory", "redis"])
def test_backends_are_interchangeable_for_clarification(backend):
    if backend == "memory":
        store = InMemorySessionStore()
    else:
        store = RedisSessionStore(fakeredis.FakeRedis(decode_responses=True))
    assert store.backend_name in {"memory", "redis"}
    store.save_clarification("s", {"clarification": {"question": "q"}, "commands": []})
    pending = store.get_clarification("s")
    assert pending["clarification"]["question"] == "q"
    assert "updatedAt" in pending
