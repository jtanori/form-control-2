"""QA-001 security/permission regressions (evidence for docs/security-audit.md)."""

from __future__ import annotations

import json
from pathlib import Path

from core.config import Settings
from core.main import create_app
from core.nlu.parser import Parser
from core.nlu.provider import RuleProvider
from core.session.store import InMemorySessionStore
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]


def _client(**settings_kwargs) -> TestClient:
    settings = Settings(nlu_provider="rule", log_level="WARNING", **settings_kwargs)
    app = create_app(
        settings=settings,
        parser=Parser(provider=RuleProvider(), settings=settings),
        store=InMemorySessionStore(),
    )
    return TestClient(app)


# ---- CORS (Q-1) -----------------------------------------------------------


def test_cors_allows_loopback_dev_origin():
    with _client() as client:
        resp = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://127.0.0.1:4173",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert resp.status_code in (200, 204)
    assert resp.headers.get("access-control-allow-origin") == "http://127.0.0.1:4173"


def test_cors_rejects_foreign_origin():
    with _client() as client:
        resp = client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )
    # Starlette omits ACAO for disallowed origins (browser blocks the call).
    assert resp.headers.get("access-control-allow-origin") is None


def test_cors_allowlist_override_via_env():
    with _client(allowed_origins=("https://trusted.example",)) as client:
        resp = client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://trusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        allowed = resp.headers.get("access-control-allow-origin")
        evil = client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert allowed == "https://trusted.example"
    assert evil.headers.get("access-control-allow-origin") is None


# ---- input caps (Q-2) -----------------------------------------------------


def test_oversized_transcript_rejected():
    with _client() as client:
        resp = client.post(
            "/api/v1/parse",
            json={
                "sessionId": "s1",
                "transcript": "x" * 5000,
                "context": None,
            },
        )
    assert resp.status_code == 422


def test_oversized_clarify_text_rejected():
    with _client() as client:
        resp = client.post(
            "/api/v1/clarify",
            json={"sessionId": "s1", "clarificationText": "y" * 600},
        )
    assert resp.status_code == 422


def test_oversized_session_id_rejected():
    with _client() as client:
        resp = client.post(
            "/api/v1/parse",
            json={"sessionId": "s" * 300, "transcript": "click submit", "context": None},
        )
    assert resp.status_code == 422


def test_normal_transcript_still_works(checkout):
    with _client() as client:
        resp = client.post(
            "/api/v1/parse",
            json={
                "sessionId": "s1",
                "transcript": "fill the email address with a@b.com",
                "context": checkout,
            },
        )
    assert resp.status_code == 200


# ---- extension manifest (Q-3) --------------------------------------------


def test_manifest_permissions_are_minimal():
    manifest = json.loads(
        (REPO / "extensions" / "browser" / "manifest.json").read_text(encoding="utf-8")
    )
    perms = set(manifest["permissions"])
    # No passive tab/scripting access (QA-001 checklist).
    assert "scripting" not in perms
    assert "activeTab" not in perms
    assert "tabs" not in perms
    assert "nativeMessaging" not in perms
    # Only what the code actually calls.
    assert perms == {"storage", "contextMenus", "alarms"}
    # Host access is scoped to Core only, not <all_urls>.
    assert manifest["host_permissions"] == [
        "http://localhost:8020/*",
        "http://127.0.0.1:8020/*",
    ]
    assert "optional_host_permissions" not in manifest


def test_content_scripts_use_matches_not_host_permissions():
    manifest = json.loads(
        (REPO / "extensions" / "browser" / "manifest.json").read_text(encoding="utf-8")
    )
    scripts = manifest["content_scripts"]
    assert scripts[0]["matches"] == ["<all_urls>"]
    # Static content scripts do not require host_permissions grants.


# ---- compose publish bindings (Q-4) --------------------------------------


def test_compose_ports_bind_loopback_only():
    text = (REPO / "docker-compose.yml").read_text(encoding="utf-8")
    assert "127.0.0.1:8020:8020" in text
    assert "127.0.0.1:6379:6379" in text
    assert "127.0.0.1:8081:8080" in text
    # no wildcard publishes
    assert '\n      - "8020:8020"' not in text
    assert '\n      - "6379:6379"' not in text


# ---- core default bind (Q-5) ---------------------------------------------


def test_core_default_bind_is_loopback():
    from core.config import load_settings

    assert load_settings().host == "127.0.0.1"
