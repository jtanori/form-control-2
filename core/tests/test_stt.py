"""Tests for STT-001 — contract, service backends, HTTP endpoints."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from core.lib import contracts
from core.main import create_app
from core.nlu.parser import Parser
from core.nlu.provider import RuleProvider
from core.session.store import InMemorySessionStore
from core.stt import SttError, SttNotConfigured, TranscriptionService

MOCK = Path(__file__).resolve().parents[2] / "contracts" / "v1" / "mocks" / "stt-response.json"


# ---- contract -------------------------------------------------------------


def test_stt_response_mock_validates():
    payload = json.loads(MOCK.read_text(encoding="utf-8"))
    contracts.validate("stt-response", payload)


def test_stt_response_rejects_missing_fields():
    with pytest.raises(contracts.ContractError):
        contracts.validate("stt-response", {"transcript": "hi"})


# ---- service --------------------------------------------------------------


def _whisper_ok(url="http://whisper.test/inference", language="en", text="hello"):
    def post(url_arg, *, files=None, data=None, headers=None, timeout=None):
        assert url_arg == url
        assert files is not None and "file" in files
        return httpx.Response(
            200,
            json={"text": text, "detected_language": language, "duration": 1.5},
        )

    return post


def test_backend_selection():
    off = TranscriptionService(Settings())
    assert off.backend == "off"

    whisper = TranscriptionService(Settings(stt_whisper_url="http://w:8080"))
    assert whisper.backend == "whisper"

    openai = TranscriptionService(
        Settings(stt_fallback="openai_whisper_api", openai_api_key="sk-test"),
    )
    assert openai.backend == "openai"


def test_unconfigured_backend_raises_503():
    svc = TranscriptionService(Settings())
    with pytest.raises(SttNotConfigured) as exc:
        svc.transcribe(b"audio", "a.webm")
    assert exc.value.status_code == 503


def test_empty_audio_raises_400():
    svc = TranscriptionService(Settings(stt_whisper_url="http://w"), post=_whisper_ok())
    with pytest.raises(SttError) as exc:
        svc.transcribe(b"", "a.webm")
    assert exc.value.status_code == 400


def test_whisper_proxy_success_language_auto():
    seen = {}

    def post(url, *, files=None, data=None, headers=None, timeout=None):
        seen["data"] = data
        return httpx.Response(
            200,
            json={
                "text": "click submit billing",
                "detected_language": "en",
                "transcription": [
                    {"text": " click", "avg_logprob": -0.2, "offsets": {"to": 900}},
                    {"text": " submit billing", "avg_logprob": -0.2, "offsets": {"to": 1500}},
                ],
            },
        )

    svc = TranscriptionService(Settings(stt_whisper_url="http://w:8080"), post=post)
    result = svc.transcribe(b"RIFF....", "speech.webm", language="auto")
    assert result["transcript"] == "click submit billing"
    assert result["language"] == "en"
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["duration_sec"] == pytest.approx(1.5)
    # auto must not pin a language on the wire
    assert "language" not in seen["data"]


def test_whisper_explicit_language_is_forwarded():
    seen = {}

    def post(url, *, files=None, data=None, headers=None, timeout=None):
        seen["data"] = data
        return httpx.Response(200, json={"text": "bonjour"})

    svc = TranscriptionService(Settings(stt_whisper_url="http://w"), post=post)
    result = svc.transcribe(b"x", "a.wav", language="fr")
    assert seen["data"]["language"] == "fr"
    assert result["language"] == "fr"
    assert result["transcript"] == "bonjour"


def test_whisper_server_error_maps_to_502():
    def post(url, **kwargs):
        return httpx.Response(500, text="boom")

    svc = TranscriptionService(Settings(stt_whisper_url="http://w"), post=post)
    with pytest.raises(SttError) as exc:
        svc.transcribe(b"x", "a.webm")
    assert exc.value.status_code == 502


def test_openai_fallback_requires_key():
    svc = TranscriptionService(Settings(stt_fallback="openai_whisper_api"))
    with pytest.raises(SttNotConfigured):
        svc.transcribe(b"x", "a.webm")


def test_openai_fallback_posts_to_api():
    seen = {}

    def post(url, *, files=None, data=None, headers=None, timeout=None):
        seen.update(url=url, data=data, auth=headers.get("Authorization"))
        return httpx.Response(200, json={"text": "fill email please"})

    svc = TranscriptionService(
        Settings(stt_fallback="openai_whisper_api", openai_api_key="sk-abc"),
        post=post,
    )
    result = svc.transcribe(b"RIFF", "speech.webm", language="auto")
    assert seen["url"] == "https://api.openai.com/v1/audio/transcriptions"
    assert seen["auth"] == "Bearer sk-abc"
    assert seen["data"]["model"] == "whisper-1"
    assert "language" not in seen["data"]  # auto → omit for detection
    assert result["transcript"] == "fill email please"
    assert result["language"] == "unknown"  # hosted API does not report it


# ---- HTTP endpoints -------------------------------------------------------


class FakeStt(TranscriptionService):
    """Service double installed on the app for endpoint tests."""

    def __init__(self) -> None:
        super().__init__(Settings(stt_whisper_url="http://fake"))
        self.calls: list[dict] = []

    @property
    def backend(self) -> str:  # noqa: D401
        return "whisper"

    def transcribe(self, audio, filename="speech.webm", *, language="auto"):
        if not audio:
            raise SttError("audio file is empty", status_code=400)
        self.calls.append({"filename": filename, "language": language, "n": len(audio)})
        return {
            "transcript": "fill the email address",
            "language": "en",
            "confidence": 0.9,
            "duration_sec": 1.0,
        }


@pytest.fixture
def stt_client():
    settings = Settings(nlu_provider="rule", log_level="WARNING")
    app = create_app(
        settings=settings,
        parser=Parser(provider=RuleProvider(), settings=settings),
        store=InMemorySessionStore(),
    )
    fake = FakeStt()
    app.state.stt = fake
    with TestClient(app) as client:
        client.fake_stt = fake  # type: ignore[attr-defined]
        yield client


def test_transcribe_endpoint_contract(stt_client):
    resp = stt_client.post(
        "/stt/transcribe",
        files={"audio": ("speech.webm", b"fake-webm-bytes", "audio/webm")},
        data={"language": "auto"},
    )
    assert resp.status_code == 200
    body = resp.json()
    contracts.validate("stt-response", body)
    assert body["transcript"] == "fill the email address"
    assert stt_client.fake_stt.calls[0]["filename"] == "speech.webm"


def test_transcribe_alias_endpoint(stt_client):
    resp = stt_client.post(
        "/transcribe",
        files={"audio": ("x.wav", b"RIFFdata", "audio/wav")},
    )
    assert resp.status_code == 200
    contracts.validate("stt-response", resp.json())


def test_transcribe_rejects_empty_file(stt_client):
    resp = stt_client.post(
        "/stt/transcribe",
        files={"audio": ("speech.webm", b"", "audio/webm")},
    )
    assert resp.status_code == 400


def test_health_reports_stt_backend(stt_client):
    body = stt_client.get("/api/v1/health").json()
    assert body["sttBackend"] == "whisper"


def test_unconfigured_endpoint_returns_503():
    settings = Settings(nlu_provider="rule", log_level="WARNING")
    app = create_app(
        settings=settings,
        parser=Parser(provider=RuleProvider(), settings=settings),
        store=InMemorySessionStore(),
    )
    with TestClient(app) as client:
        resp = client.post(
            "/stt/transcribe",
            files={"audio": ("speech.webm", b"abc", "audio/webm")},
        )
    assert resp.status_code == 503
    assert "STT_WHISPER_URL" in resp.json()["detail"]


def test_middleware_does_not_413_stt_uploads(stt_client):
    """JSON sniff cap must not reject multipart audio (the whole file streams)."""
    big = b"\x00" * (2 * 1024 * 1024)  # 2 MiB > JSON MAX_BODY_BYTES
    resp = stt_client.post(
        "/stt/transcribe",
        files={"audio": ("big.webm", big, "audio/webm")},
    )
    assert resp.status_code == 200
