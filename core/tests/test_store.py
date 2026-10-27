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
