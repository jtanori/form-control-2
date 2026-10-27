"""Shared test fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from core.main import create_app
from core.nlu.parser import Parser
from core.nlu.provider import RuleProvider

FIXTURES = Path(__file__).resolve().parent / "fixtures"
FORMS = FIXTURES / "forms"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def checkout() -> dict:
    return load_json(FORMS / "checkout.json")


@pytest.fixture
def multistep() -> dict:
    return load_json(FORMS / "multistep.json")


@pytest.fixture
def login() -> dict:
    return load_json(FORMS / "login.json")


@pytest.fixture
def parser() -> Parser:
    return Parser(provider=RuleProvider(), settings=Settings(nlu_provider="rule"))


@pytest.fixture
def client(parser: Parser) -> TestClient:
    settings = Settings(nlu_provider="rule", log_level="WARNING")
    app = create_app(settings=settings, parser=parser)
    with TestClient(app) as test_client:
        yield test_client
