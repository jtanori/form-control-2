"""CORE-002 acceptance suite: ambiguity -> question -> resolved nodeId."""

from __future__ import annotations

import fakeredis

from core.lib import contracts
from core.nlu.clarify import ClarificationError, ClarificationResolver
from core.nlu.parser import Parser
from core.nlu.provider import RuleProvider
from core.session.store import (
    InMemorySessionStore,
    RedisSessionStore,
    clarification_key,
    session_key,
)

SESSION = "sess-clarify"


def _ask(parser: Parser, resolver: ClarificationResolver, checkout, transcript="click submit"):
    result = parser.parse(session_id=SESSION, transcript=transcript, snapshot=checkout)
    assert result.needs_clarification
    resolver.remember(result, checkout)
    return result


def test_ambiguous_submit_is_stored_in_the_session(parser, resolver, store, checkout):
    result = _ask(parser, resolver, checkout)
    pending = store.get_clarification(SESSION)
    assert pending is not None
    assert pending["clarification"]["question"] == result.clarification_question
    assert [c["nodeId"] for c in pending["clarification"]["candidates"]] == ["b5", "b6"]
    assert pending["pendingCommand"]["action"] == "click"


def test_billing_submit_resolves_to_the_correct_node(parser, resolver, store, checkout):
    _ask(parser, resolver, checkout)

    result = resolver.resolve(session_id=SESSION, clarification_text="billing submit")

    assert result.needs_clarification is False
    assert len(result.commands) == 1
    command = result.commands[0]
    assert command["action"] == "click"
    assert command["target"]["nodeId"] == "b5"
    assert command["confirmRequired"] is True
    contracts.validate("command", command)
    assert store.get_clarification(SESSION) is None


def test_shipping_submit_resolves_to_the_other_node(parser, resolver, store, checkout):
    _ask(parser, resolver, checkout)
    result = resolver.resolve(session_id=SESSION, clarification_text="the shipping one")
    assert [c["target"]["nodeId"] for c in result.commands] == ["b6"]


def test_unrelated_answer_reasks_instead_of_guessing(parser, resolver, store, checkout):
    _ask(parser, resolver, checkout)
    result = resolver.resolve(session_id=SESSION, clarification_text="the purple one")

    assert result.needs_clarification is True
    assert result.commands == []
    assert [c["nodeId"] for c in result.clarification["candidates"]] == ["b5", "b6"]
    assert "didn't catch" in result.clarification_question
    # state is still pending, with the same choices
    assert store.get_clarification(SESSION) is not None


def test_commands_before_the_ambiguity_are_replayed(parser, resolver, checkout):
    transcript = "fill the email address with a@b.com and click submit"
    result = parser.parse(session_id=SESSION, transcript=transcript, snapshot=checkout)
    assert result.needs_clarification
    assert [c["target"]["nodeId"] for c in result.commands] == ["b1"]
    resolver.remember(result, checkout)

    resolved = resolver.resolve(session_id=SESSION, clarification_text="submit billing")

    assert [(c["action"], c["target"]["nodeId"]) for c in resolved.commands] == [
        ("fill", "b1"),
        ("click", "b5"),
    ]
    for command in resolved.commands:
        contracts.validate("command", command)


def test_missing_value_is_answered_by_the_clarification(parser, resolver, checkout):
    result = parser.parse(
        session_id=SESSION, transcript="fill the email address", snapshot=checkout
    )
    assert result.needs_clarification
    assert "email address" in result.clarification_question
    resolver.remember(result, checkout)

    resolved = resolver.resolve(
        session_id=SESSION, clarification_text="test@example.com"
    )
    assert resolved.needs_clarification is False
    assert resolved.commands == [
        {
            "action": "fill",
            "target": {"label": "email address", "nodeId": "b1"},
            "value": "test@example.com",
        }
    ]


def test_clarification_without_pending_state_fails(parser, resolver):
    try:
        resolver.resolve(session_id="sess-unknown", clarification_text="billing")
    except ClarificationError as exc:
        assert "no pending clarification" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected ClarificationError")


def test_clarification_state_survives_a_redis_round_trip(checkout):
    server = fakeredis.FakeServer()
    client_one = fakeredis.FakeRedis(server=server, decode_responses=True)
    client_two = fakeredis.FakeRedis(server=server, decode_responses=True)

    store_one = RedisSessionStore(client_one, ttl_seconds=60)
    parser = Parser(provider=RuleProvider())
    resolver_one = ClarificationResolver(parser, store_one)

    result = parser.parse(session_id=SESSION, transcript="click submit", snapshot=checkout)
    resolver_one.remember(result, checkout)
    assert client_one.exists(clarification_key(SESSION))
    assert 0 < store_one.ttl(clarification_key(SESSION)) <= 60

    # a completely separate process/connection sees the same state
    store_two = RedisSessionStore(client_two, ttl_seconds=60)
    resolver_two = ClarificationResolver(parser, store_two)
    resolved = resolver_two.resolve(session_id=SESSION, clarification_text="submit billing")

    assert [c["target"]["nodeId"] for c in resolved.commands] == ["b5"]
    assert not client_two.exists(clarification_key(SESSION))


def test_clarification_expires_with_the_session_ttl(checkout):
    clock = [0.0]
    store = InMemorySessionStore(ttl_seconds=10, clock=lambda: clock[0])
    parser = Parser(provider=RuleProvider())
    resolver = ClarificationResolver(parser, store)

    result = parser.parse(session_id=SESSION, transcript="click submit", snapshot=checkout)
    resolver.remember(result, checkout)
    assert store.get_clarification(SESSION) is not None

    clock[0] = 11.0
    assert store.get_clarification(SESSION) is None


def test_clarify_endpoint_round_trip(client, checkout, store):
    parsed = client.post(
        "/api/v1/parse",
        json={"sessionId": SESSION, "transcript": "click submit", "context": checkout},
    ).json()
    assert parsed["needsClarification"] is True
    assert parsed["commands"] == []

    response = client.post(
        "/api/v1/clarify",
        json={"sessionId": SESSION, "clarificationText": "submit shipping"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["needsClarification"] is False
    assert body["commands"][0]["target"]["nodeId"] == "b6"
    assert store.get_clarification(SESSION) is None


def test_clarify_endpoint_without_pending_state_is_409(client):
    response = client.post(
        "/api/v1/clarify",
        json={"sessionId": "sess-nothing", "clarificationText": "billing"},
    )
    assert response.status_code == 409


def test_clarify_endpoint_requires_text(client):
    response = client.post(
        "/api/v1/clarify", json={"sessionId": SESSION, "clarificationText": "  "}
    )
    assert response.status_code == 409


def test_clarification_uses_contract_keys(parser, resolver, checkout):
    result = _ask(parser, resolver, checkout)
    contracts.validate("command", result.clarification)
    assert set(result.clarification) <= {
        "sessionId", "question", "candidates", "previousTranscript", "ambiguity"
    }
