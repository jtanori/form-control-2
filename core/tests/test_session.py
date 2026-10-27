"""CORE-003 acceptance suite: session state, history, multi-form navigation."""

from __future__ import annotations

import fakeredis
import pytest

from core.lib import contracts
from core.nlu.parser import Parser
from core.nlu.provider import RuleProvider
from core.session.manager import SessionManager, empty_state
from core.session.navigation import detect_form_steps, find_navigation_node
from core.session.store import InMemorySessionStore, RedisSessionStore

SESSION = "sess-003"


def _manager(store=None, history_limit: int = 200) -> SessionManager:
    return SessionManager(store or InMemorySessionStore(), history_limit=history_limit)


def test_empty_state_is_contract_valid():
    contracts.validate("form-context", empty_state(SESSION))


def test_session_survives_five_sequential_commands(parser, checkout):
    manager = _manager()
    transcript = [
        "fill the email address with a@b.com",
        "fill the full name with jane doe",
        "select canada in the country dropdown",
        "check the terms checkbox",
        "click submit billing",
    ]
    for utterance in transcript:
        result = parser.parse(
            session_id=SESSION,
            transcript=utterance,
            snapshot=checkout,
            history=manager.history(SESSION),
        )
        assert not result.needs_clarification
        manager.record(SESSION, snapshot=checkout, commands=result.commands)

    state = manager.get(SESSION)
    assert len(state["history"]) == 5
    assert [c["action"] for c in state["history"]] == [
        "fill", "fill", "fill", "check", "click"
    ]
    assert [c["target"]["nodeId"] for c in state["history"]] == ["b1", "b2", "b3", "b4", "b5"]
    assert state["currentActiveNodeId"] == "b5"
    assert state["currentContextSnapshot"]["title"] == "Checkout"
    contracts.validate("form-context", state)


def test_go_back_finds_the_back_button_and_queues_a_command(parser, multistep):
    manager = _manager()

    assert find_navigation_node(multistep["nodes"], "back")["label"] == "back"

    result = parser.parse(
        session_id=SESSION, transcript="go back", snapshot=multistep,
        history=manager.history(SESSION),
    )
    assert result.needs_clarification is False
    assert result.commands == [
        {"action": "click", "target": {"label": "back", "nodeId": "b3"}}
    ]
    manager.record(SESSION, snapshot=multistep, commands=result.commands)
    assert manager.get(SESSION)["history"][-1]["target"]["nodeId"] == "b3"


def test_go_back_without_a_back_button_asks(parser, checkout):
    result = parser.parse(session_id=SESSION, transcript="go back", snapshot=checkout)
    assert result.needs_clarification
    assert result.commands == []
    assert "back" in result.clarification_question


def test_form_steps_are_detected(multistep):
    manager = _manager()
    manager.record(SESSION, snapshot=multistep)
    assert manager.get(SESSION)["formSteps"] == ["Next", "Back", "Step 2 of 3"]


def test_detect_form_steps_ignores_non_navigation_nodes(checkout):
    assert detect_form_steps(checkout["nodes"]) == []


def test_history_is_trimmed_to_the_limit(parser, checkout):
    manager = _manager(history_limit=3)
    result = parser.parse(
        session_id=SESSION, transcript="click submit billing", snapshot=checkout
    )
    for _ in range(5):
        manager.record(SESSION, commands=result.commands)
    state = manager.get(SESSION)
    assert len(state["history"]) == 3


def test_state_expires_after_ttl_idle(checkout):
    clock = [0.0]
    store = InMemorySessionStore(ttl_seconds=1800, clock=lambda: clock[0])
    manager = SessionManager(store)
    manager.record(SESSION, snapshot=checkout)
    assert manager.get_existing(SESSION) is not None

    clock[0] = 1801.0
    assert manager.get_existing(SESSION) is None
    # reading a missing session yields a usable empty state
    assert manager.get(SESSION)["history"] == []


def test_write_refreshes_the_idle_ttl(checkout):
    clock = [0.0]
    store = InMemorySessionStore(ttl_seconds=1800, clock=lambda: clock[0])
    manager = SessionManager(store)
    manager.record(SESSION, snapshot=checkout)
    clock[0] = 1700.0
    manager.record(SESSION, snapshot=checkout)
    clock[0] = 3400.0
    assert manager.get_existing(SESSION) is not None


def test_corrupt_state_is_discarded(checkout):
    store = InMemorySessionStore()
    store._write(f"session:{SESSION}", '{"sessionId": "x"}')
    manager = SessionManager(store)
    assert manager.get_existing(SESSION) is None


def test_get_session_endpoint_returns_contract_shape(client, checkout):
    client.post(
        "/api/v1/parse",
        json={
            "sessionId": SESSION,
            "transcript": "fill the email address with a@b.com",
            "context": checkout,
        },
    )
    response = client.get(f"/api/v1/session/{SESSION}")
    assert response.status_code == 200
    body = response.json()
    contracts.validate("form-context", body)
    assert body["sessionId"] == SESSION
    assert body["currentActiveNodeId"] == "b1"
    assert len(body["history"]) == 1
    assert body["currentContextSnapshot"]["nodes"]


def test_get_session_endpoint_unknown_session_is_empty(client):
    response = client.get("/api/v1/session/sess-new")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "sessionId": "sess-new",
        "currentContextSnapshot": None,
        "history": [],
        "formSteps": [],
    }


def test_parse_reuses_stored_history(parser, checkout):
    """Clients may omit `history`: the session is the source of truth."""
    manager = _manager()
    first = parser.parse(
        session_id=SESSION, transcript="click submit billing", snapshot=checkout
    )
    manager.record(SESSION, snapshot=checkout, commands=first.commands)
    assert manager.history(SESSION) == first.commands


def test_clarification_flow_lands_in_history(client, checkout):
    client.post(
        "/api/v1/parse",
        json={"sessionId": SESSION, "transcript": "click submit", "context": checkout},
    )
    assert client.get(f"/api/v1/session/{SESSION}").json()["history"] == []

    client.post(
        "/api/v1/clarify",
        json={"sessionId": SESSION, "clarificationText": "submit billing"},
    )
    body = client.get(f"/api/v1/session/{SESSION}").json()
    assert [c["target"]["nodeId"] for c in body["history"]] == ["b5"]


def test_ambiguous_parse_keeps_the_snapshot_but_no_commands(client, checkout):
    client.post(
        "/api/v1/parse",
        json={"sessionId": SESSION, "transcript": "click submit", "context": checkout},
    )
    body = client.get(f"/api/v1/session/{SESSION}").json()
    assert body["history"] == []
    assert body["currentContextSnapshot"]["title"] == "Checkout"


@pytest.mark.parametrize("backend", ["memory", "redis"])
def test_session_backends_are_interchangeable(backend, checkout):
    store = (
        InMemorySessionStore()
        if backend == "memory"
        else RedisSessionStore(fakeredis.FakeRedis(decode_responses=True))
    )
    manager = SessionManager(store)
    manager.record(SESSION, snapshot=checkout, commands=[
        {"action": "fill", "target": {"label": "email address", "nodeId": "b1"}, "value": "a@b.com"}
    ])
    state = manager.get_existing(SESSION)
    assert state["history"][0]["value"] == "a@b.com"
    contracts.validate("form-context", state)
    # a second manager on another connection sees the same state (redis only)
    if backend == "redis":
        other = SessionManager(RedisSessionStore(store._client))
        assert other.get_existing(SESSION)["currentActiveNodeId"] == "b1"


def test_clear_removes_state_and_pending_clarification(parser, checkout):
    manager = _manager()
    result = parser.parse(session_id=SESSION, transcript="click submit", snapshot=checkout)
    manager.store.save_clarification(SESSION, {"clarification": result.clarification})
    manager.record(SESSION, snapshot=checkout)
    manager.clear(SESSION)
    assert manager.get_existing(SESSION) is None
    assert manager.store.get_clarification(SESSION) is None
