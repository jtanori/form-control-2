"""INFR-002: structured JSON logs with a correlated `sessionId`."""

from __future__ import annotations

import io
import json
import logging

from core.lib.logging_config import (
    JsonFormatter,
    configure_logging,
    get_logger,
    session_context,
)


def _record(**extra) -> logging.LogRecord:
    record = logging.LogRecord(
        name="core.test", level=logging.INFO, pathname=__file__, lineno=1,
        msg="hello %s", args=("world",), exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_formatter_emits_contract_fields():
    configure_logging(component="core")
    line = JsonFormatter().format(_record(sessionId="sess-1", commandCount=2))
    payload = json.loads(line)
    assert set(payload) >= {"ts", "level", "component", "sessionId", "message"}
    assert payload["level"] == "info"
    assert payload["sessionId"] == "sess-1"
    assert payload["message"] == "hello world"
    assert payload["commandCount"] == 2


def test_session_context_binds_and_resets():
    configure_logging(component="core")
    with session_context("sess-ctx"):
        assert json.loads(JsonFormatter().format(_record()))["sessionId"] == "sess-ctx"
    assert json.loads(JsonFormatter().format(_record()))["sessionId"] is None


def test_request_logs_carry_session_id(client, checkout):
    configure_logging(component="core", level="INFO")
    buffer = io.StringIO()
    capture = logging.StreamHandler(buffer)
    capture.setFormatter(JsonFormatter())
    logger = logging.getLogger("core")
    logger.addHandler(capture)
    try:
        client.post(
            "/api/v1/parse",
            json={
                "sessionId": "sess-correlated",
                "transcript": "click submit billing",
                "context": checkout,
            },
        )
    finally:
        logger.removeHandler(capture)
    lines = [
        json.loads(line)
        for line in buffer.getvalue().splitlines()
        if line.startswith("{")
    ]
    parse_lines = [line for line in lines if line.get("message") == "parse"]
    assert parse_lines, lines
    assert parse_lines[-1]["sessionId"] == "sess-correlated"
    assert parse_lines[-1]["commandCount"] == 1
    assert "latencyMs" in parse_lines[-1]

    request_lines = [line for line in lines if line.get("message") == "request"]
    assert request_lines
    assert request_lines[-1]["sessionId"] == "sess-correlated"


def test_get_logger_adds_component():
    configure_logging()
    logger = get_logger("nlu.parser")
    assert logger.logger.name == "core.nlu.parser"
