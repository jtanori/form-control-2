"""OpenAI provider path, exercised with a fake client (no network, no key).

The review flagged that only the deterministic provider was covered, leaving the
tool-calling path - the one production actually uses - untested.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from core.lib import contracts
from core.main import create_app
from core.nlu.parser import Parser
from core.nlu.provider import ProviderError, RuleProvider, get_provider
from core.session.store import InMemorySessionStore


class _FakeCompletions:
    def __init__(self, arguments=None, *, tool_calls=None, raw=None):
        self.arguments = arguments
        self.raw = raw
        self.tool_calls = tool_calls
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.raw is not None:
            raise self.raw
        if self.tool_calls is not None:
            calls = self.tool_calls
        else:
            calls = [
                SimpleNamespace(
                    function=SimpleNamespace(
                        name="emit_commands",
                        arguments=json.dumps(self.arguments),
                    )
                )
            ]
        message = SimpleNamespace(tool_calls=calls)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeClient:
    def __init__(self, completions: _FakeCompletions):
        self.chat = SimpleNamespace(completions=completions)


def _provider(payload=None, **kwargs):
    completions = _FakeCompletions(payload, **kwargs)
    settings = Settings(
        nlu_provider="openai", openai_api_key="test-key", openai_model="gpt-4o-test"
    )
    from core.nlu.provider import OpenAIProvider

    return OpenAIProvider(settings=settings, client=FakeClient(completions)), completions


def test_tool_call_payload_becomes_commands(checkout):
    provider, completions = _provider(
        {
            "commands": [
                {
                    "action": "fill",
                    "target": {"label": "email address", "nodeId": "b1"},
                    "value": "a@b.com",
                }
            ],
            "needsClarification": False,
        }
    )
    parser = Parser(provider=provider, settings=Settings(nlu_provider="openai"))

    result = parser.parse(
        session_id="sess-openai",
        transcript="fill the email address with a@b.com",
        snapshot=checkout,
        history=[{"action": "click", "target": {"label": "other", "nodeId": "b9"}}],
    )

    assert result.needs_clarification is False
    assert result.commands == [
        {
            "action": "fill",
            "target": {"label": "email address", "nodeId": "b1"},
            "value": "a@b.com",
        }
    ]
    assert result.model == "gpt-4o-test"

    call = completions.calls[0]
    assert call["model"] == "gpt-4o-test"
    assert call["temperature"] == 0
    assert call["tool_choice"] == {
        "type": "function",
        "function": {"name": "emit_commands"},
    }
    tool = call["tools"][0]["function"]
    assert tool["name"] == "emit_commands"
    # tool schema must be self-contained (OpenAI cannot resolve external $refs)
    assert "form-control.dev/contracts" not in json.dumps(tool["parameters"])
    assert tool["parameters"]["properties"]["commands"]["items"]["$ref"] == "#/$defs/command"
    # system prompt + history are sent
    assert call["messages"][0]["role"] == "system"
    assert "emit_commands" in call["messages"][0]["content"]
    sent = json.loads(call["messages"][1]["content"].split("\n", 1)[1])
    assert sent["history"][0]["target"]["nodeId"] == "b9"
    assert sent["context"]["FormSnapshot"]["nodes"]


def test_tool_call_clarification_is_honoured(checkout):
    provider, _ = _provider(
        {
            "commands": [],
            "needsClarification": True,
            "clarificationQuestion": "Which submit button do you mean?",
            "candidateNodeIds": ["b5", "b6"],
        }
    )
    parser = Parser(provider=provider, settings=Settings(nlu_provider="openai"))
    result = parser.parse(
        session_id="sess-openai", transcript="click submit", snapshot=checkout
    )

    assert result.needs_clarification
    assert result.commands == []
    assert result.clarification_question == "Which submit button do you mean?"
    assert [c["nodeId"] for c in result.clarification["candidates"]] == ["b5", "b6"]
    contracts.validate("command", result.clarification)


def test_model_inventing_a_value_is_still_rejected(checkout):
    provider, _ = _provider(
        {
            "commands": [
                {
                    "action": "fill",
                    "target": {"label": "email address"},
                    "value": "hallucinated@example.com",
                }
            ]
        }
    )
    parser = Parser(provider=provider, settings=Settings(nlu_provider="openai"))
    result = parser.parse(
        session_id="sess-openai",
        transcript="fill the email address please",
        snapshot=checkout,
    )
    assert result.commands == []
    assert result.needs_clarification
    assert result.clarification["ambiguity"] == "value not spoken"


def test_missing_tool_call_raises_provider_error(checkout):
    provider, _ = _provider({"commands": []}, tool_calls=[])
    parser = Parser(provider=provider, settings=Settings(nlu_provider="openai"))
    with pytest.raises(ProviderError, match="did not call emit_commands"):
        parser.parse(
            session_id="sess-openai", transcript="click submit billing", snapshot=checkout
        )


def test_invalid_tool_arguments_raise_provider_error(checkout):
    completions = _FakeCompletions(
        tool_calls=[SimpleNamespace(function=SimpleNamespace(arguments="{not json"))]
    )
    settings = Settings(nlu_provider="openai", openai_api_key="k")
    from core.nlu.provider import OpenAIProvider

    provider = OpenAIProvider(settings=settings, client=FakeClient(completions))
    parser = Parser(provider=provider, settings=settings)
    with pytest.raises(ProviderError, match="invalid tool arguments"):
        parser.parse(
            session_id="sess-openai", transcript="click submit billing", snapshot=checkout
        )


def test_api_maps_provider_failure_to_502(checkout):
    provider, _ = _provider(None, raw=RuntimeError("upstream exploded"))
    parser = Parser(provider=provider, settings=Settings(nlu_provider="openai"))
    app = create_app(
        settings=Settings(nlu_provider="openai", log_level="WARNING"),
        parser=parser,
        store=InMemorySessionStore(),
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/parse",
            json={
                "sessionId": "sess-openai",
                "transcript": "click submit billing",
                "context": checkout,
            },
        )
    assert response.status_code == 502
    assert response.json()["detail"] == "NLU provider unavailable"


def test_provider_selection_follows_configuration():
    assert isinstance(
        get_provider(Settings(nlu_provider="rule", openai_api_key="k")), RuleProvider
    )
    assert isinstance(get_provider(Settings(nlu_provider="auto")), RuleProvider)
    selected = get_provider(Settings(nlu_provider="auto", openai_api_key="k"))
    assert selected.name == "openai"


def test_missing_openai_package_is_a_clear_provider_error(monkeypatch, checkout):
    """`openai` is an optional dependency (requirements-llm.txt)."""
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "openai" or name.startswith("openai."):
            raise ImportError("simulated: openai not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    from core.nlu.provider import OpenAIProvider

    with pytest.raises(ProviderError, match="requirements-llm.txt"):
        OpenAIProvider(settings=Settings(nlu_provider="openai", openai_api_key="k"))


def test_health_survives_an_unbuildable_provider():
    """GET /health must not 500 when the configured provider needs a key."""
    settings = Settings(nlu_provider="openai", log_level="WARNING")  # no key
    app = create_app(
        settings=settings,
        parser=Parser(settings=settings),  # lazily builds -> ProviderError
        store=InMemorySessionStore(),
    )
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["provider"] == "openai:unavailable"
