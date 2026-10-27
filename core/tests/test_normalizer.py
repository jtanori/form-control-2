"""CORE-004 acceptance suite: one normalized FormSnapshot for every bridge."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from core.adapters.normalizer import (
    NormalizationError,
    infer_actions,
    normalize_snapshot,
    standardize_rect,
)
from core.lib import contracts
from core.lib.text import normalize_label

BRIDGES = Path(__file__).resolve().parent / "fixtures" / "bridges"
SOURCES = ["dom", "accessibility", "vision"]


def load(source: str) -> dict:
    return json.loads((BRIDGES / f"{source}-checkout.json").read_text(encoding="utf-8"))


def logical_view(snapshot: dict) -> dict:
    """Strip provenance so the *form* can be compared across bridges."""
    view = {
        "title": snapshot["title"],
        "capturedAt": snapshot["capturedAt"],
        "nodes": [],
    }
    for index, node in enumerate(snapshot["nodes"], start=1):
        node = copy.deepcopy(node)
        node.pop("nodeId")
        node.pop("source")
        view["nodes"].append(node)
    prefix = {"dom": "b", "accessibility": "a", "vision": "v"}[snapshot["source"]]
    assert [node["nodeId"] for node in snapshot["nodes"]] == [
        f"{prefix}{index}" for index in range(1, len(snapshot["nodes"]) + 1)
    ]
    return view


@pytest.mark.parametrize("source", SOURCES)
def test_each_source_normalizes_to_a_contract_valid_snapshot(source):
    snapshot = normalize_snapshot(load(source))
    contracts.validate("form-context", snapshot)
    assert snapshot["source"] == source
    assert snapshot["title"] == "Checkout"
    assert [node["type"] for node in snapshot["nodes"]] == [
        "input", "select", "checkbox", "button"
    ]


def test_three_sources_produce_identical_normalized_json():
    views = [logical_view(normalize_snapshot(load(source))) for source in SOURCES]
    assert views[0] == views[1] == views[2], json.dumps(views, indent=2)


def test_dom_payload_carries_the_url():
    dom = normalize_snapshot(load("dom"))
    assert dom["url"] == "https://example.com/checkout"
    assert "url" not in normalize_snapshot(load("vision"))


def test_labels_are_normalized():
    assert normalize_label("  Email   Address: *") == "email address"
    assert normalize_label("I agree to the  terms!") == "i agree to the terms"
    assert normalize_label(None) == ""


def test_missing_label_becomes_empty_string_not_null():
    snapshot = normalize_snapshot(
        {
            "source": "dom",
            "title": "Weird form",
            "nodes": [{"tagName": "input", "rect": {"left": 0, "top": 0, "width": 10, "height": 10}}],
        }
    )
    node = snapshot["nodes"][0]
    assert node["label"] == ""
    assert node["nodeId"] == "b1"
    contracts.validate("form-context", snapshot)


def test_zero_rects_are_clamped_and_flagged():
    snapshot = normalize_snapshot(
        {
            "source": "dom",
            "title": "Below the fold",
            "nodes": [{"tagName": "button", "text": "Next", "rect": {"left": -5, "top": -5, "width": 0, "height": 0}}],
        }
    )
    node = snapshot["nodes"][0]
    assert node["rect"] == {"x": 0, "y": 0, "w": 0, "h": 0}
    assert node["offscreen"] is True


def test_offscreen_hint_is_preserved():
    snapshot = normalize_snapshot(
        {
            "source": "dom",
            "title": "Hidden",
            "nodes": [{"tagName": "input", "label": "Coupon", "visible": False, "rect": {"left": 1, "top": 2, "width": 10, "height": 10}}],
        }
    )
    assert snapshot["nodes"][0]["offscreen"] is True
    assert snapshot["nodes"][0]["rect"] == {"x": 1, "y": 2, "w": 10, "h": 10}


def test_actions_are_inferred_from_type():
    assert infer_actions("input") == ["fill", "clear"]
    assert infer_actions("checkbox") == ["check", "uncheck"]
    assert infer_actions("select") == ["click", "fill"]
    assert infer_actions("button") == ["click"]
    assert infer_actions("input", ["fill", "bogus"]) == ["fill"]


def test_rect_standardization_accepts_all_bridge_shapes():
    assert standardize_rect({"left": 1, "top": 2, "width": 3, "height": 4}) == (
        {"x": 1, "y": 2, "w": 3, "h": 4}, False
    )
    assert standardize_rect("[10,20][40,60]") == ({"x": 10, "y": 20, "w": 30, "h": 40}, False)
    assert standardize_rect([1, 2, 3, 4]) == ({"x": 1, "y": 2, "w": 3, "h": 4}, False)
    assert standardize_rect(None)[1] is True


def test_normalization_is_idempotent():
    once = normalize_snapshot(load("accessibility"))
    twice = normalize_snapshot(once)
    assert once == twice


def test_unknown_source_is_rejected():
    with pytest.raises(NormalizationError):
        normalize_snapshot({"title": "x", "nodes": [{"label": "a"}]})


def test_desktop_source_is_rejected_not_a_key_error():
    """v1 schema has no `desktop`; must be NormalizationError (422), not KeyError."""
    with pytest.raises(NormalizationError, match="unsupported source"):
        normalize_snapshot(
            {"source": "desktop", "title": "x", "nodes": [{"label": "a", "type": "button"}]},
            source="desktop",
        )


def test_accessibility_filled_edittext_prefers_a11y_label_over_text():
    snapshot = normalize_snapshot(
        {
            "source": "accessibility",
            "title": "Login",
            "nodes": [
                {
                    "className": "android.widget.EditText",
                    "contentDescription": "Email address",
                    "text": "user@example.com",
                    "bounds": "[0,0][100,40]",
                    "isEditable": True,
                }
            ],
        }
    )
    node = snapshot["nodes"][0]
    assert node["label"] == "email address"
    assert node["value"] == "user@example.com"
    assert node["displayLabel"] == "Email address"


def test_captured_at_is_normalized_to_utc_iso():
    snapshot = normalize_snapshot(
        {
            "source": "dom",
            "title": "T",
            "capturedAt": "2026-01-15T12:00:00+02:00",
            "nodes": [{"tagName": "button", "text": "Go", "rect": {"left": 0, "top": 0, "width": 1, "height": 1}}],
        }
    )
    assert snapshot["capturedAt"] == "2026-01-15T10:00:00Z"


def test_parse_normalizes_a_raw_dom_payload(parser):
    result = parser.parse(
        session_id="sess-norm",
        transcript="fill the email address with a@b.com",
        snapshot=load("dom"),
    )
    assert result.needs_clarification is False
    assert result.commands[0]["target"]["nodeId"] == "b1"
    assert result.snapshot["source"] == "dom"
    assert result.snapshot["nodes"][0]["actions"] == ["fill", "clear"]


def test_parse_normalizes_an_accessibility_payload(parser):
    result = parser.parse(
        session_id="sess-norm",
        transcript="click submit",
        snapshot=load("accessibility"),
    )
    # one submit button in this fixture -> no ambiguity, nodeId is prefixed `a`
    assert [c["target"]["nodeId"] for c in result.commands] == ["a4"]


def test_parse_rejects_a_broken_context(parser):
    from core.nlu.parser import ParseInputError

    with pytest.raises(ParseInputError):
        parser.parse(
            session_id="sess-norm",
            transcript="click submit",
            snapshot={"title": "x", "nodes": [{"weird": True}]},
        )


def test_normalize_endpoint(client):
    response = client.post("/api/v1/context/normalize", json=load("vision"))
    assert response.status_code == 200, response.text
    snapshot = response.json()["snapshot"]
    contracts.validate("form-context", snapshot)
    assert snapshot["source"] == "vision"
    assert snapshot["nodes"][0]["nodeId"] == "v1"


def test_normalize_endpoint_rejects_unknown_shape(client):
    response = client.post("/api/v1/context/normalize", json={"nodes": [{"weird": True}]})
    assert response.status_code == 422


def test_session_stores_the_normalized_snapshot(client):
    client.post(
        "/api/v1/parse",
        json={
            "sessionId": "sess-norm",
            "transcript": "click submit",
            "context": load("dom"),
        },
    )
    state = client.get("/api/v1/session/sess-norm").json()
    contracts.validate("form-context", state)
    snapshot = state["currentContextSnapshot"]
    assert snapshot["source"] == "dom"
    assert all(node.get("actions") for node in snapshot["nodes"])
    assert snapshot["nodes"][0]["nodeId"] == "b1"
