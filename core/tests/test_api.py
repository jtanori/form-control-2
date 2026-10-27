"""HTTP-level tests for the Phase-1 endpoints (CORE-001 / CORE-002)."""

from __future__ import annotations

from core.lib import contracts


def test_root_redirects_to_the_docs(client):
    response = client.get("/", follow_redirects=False)
    assert response.status_code in (302, 307)
    assert response.headers["location"] == "/docs"
    assert client.get("/docs").status_code == 200


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["provider"] == "rule-v1"


def test_parse_returns_commands(client, checkout):
    response = client.post(
        "/api/v1/parse",
        json={
            "sessionId": "sess-api",
            "transcript": "fill the email address with test@example.com",
            "context": checkout,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sessionId"] == "sess-api"
    assert body["needsClarification"] is False
    assert body["commands"][0]["action"] == "fill"
    assert body["commands"][0]["target"]["nodeId"] == "b1"
    for command in body["commands"]:
        contracts.validate("command", command)


def test_parse_accepts_form_snapshot_envelope(client, checkout):
    response = client.post(
        "/api/v1/parse",
        json={
            "sessionId": "sess-api",
            "transcript": "click submit billing",
            "context": {"FormSnapshot": checkout},
        },
    )
    assert response.status_code == 200
    assert response.json()["commands"][0]["target"]["nodeId"] == "b5"


def test_parse_ambiguity_withholds_commands(client, checkout):
    response = client.post(
        "/api/v1/parse",
        json={"sessionId": "sess-api", "transcript": "click submit", "context": checkout},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["needsClarification"] is True
    assert body["commands"] == []
    assert body["clarificationQuestion"]
    assert [c["nodeId"] for c in body["clarification"]["candidates"]] == ["b5", "b6"]


def test_parse_without_context_is_still_safe(client):
    response = client.post(
        "/api/v1/parse",
        json={"sessionId": "sess-api", "transcript": "click submit billing"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["needsClarification"] is True
    assert body["commands"] == []


def test_parse_rejects_blank_transcript(client, checkout):
    response = client.post(
        "/api/v1/parse",
        json={"sessionId": "sess-api", "transcript": "   ", "context": checkout},
    )
    assert response.status_code == 422


def test_parse_rejects_missing_session(client, checkout):
    response = client.post(
        "/api/v1/parse",
        json={"transcript": "click submit billing", "context": checkout},
    )
    assert response.status_code == 422


def test_parse_rejects_unknown_fields(client, checkout):
    response = client.post(
        "/api/v1/parse",
        json={
            "sessionId": "sess-api",
            "transcript": "click submit billing",
            "context": checkout,
            "sessoinId": "typo",
        },
    )
    assert response.status_code == 422
