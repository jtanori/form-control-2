"""CORE-001 acceptance suite: the 20-utterance parser suite.

Every assertion runs the deterministic provider (no network, no API key) and
validates the emitted commands against `contracts/v1/command.schema.json`.
"""

from __future__ import annotations

import pytest

from core.lib import contracts
from core.lib.contracts import ContractError
from core.nlu.parser import ParseInputError, Parser
from core.nlu.provider import ProviderOutput, RuleProvider

SESSION = "sess-ut"

# (utterance, fixture, expected (action, nodeId, value) tuples)
UTTERANCE_SUITE = [
    ("fill the email address with test@example.com", "checkout",
     [("fill", "b1", "test@example.com")]),
    ("fill in the email address with a@b.com", "checkout",
     [("fill", "b1", "a@b.com")]),
    ("type john doe into the full name field", "checkout",
     [("fill", "b2", "john doe")]),
    ("enter jane doe in the full name", "checkout",
     [("fill", "b2", "jane doe")]),
    ("set the email to me@example.com", "checkout",
     [("fill", "b1", "me@example.com")]),
    ("click submit billing", "checkout",
     [("click", "b5", None)]),
    ("click the submit billing button", "checkout",
     [("click", "b5", None)]),
    ("press submit shipping", "checkout",
     [("click", "b6", None)]),
    ("click the terms checkbox", "checkout",
     [("click", "b4", None)]),
    ("check the terms checkbox", "checkout",
     [("check", "b4", None)]),
    ("uncheck the terms checkbox", "checkout",
     [("uncheck", "b4", None)]),
    ("select canada in the country dropdown", "checkout",
     [("fill", "b3", "canada")]),
    ("choose canada from the country dropdown", "checkout",
     [("fill", "b3", "canada")]),
    ("clear the full name field", "checkout",
     [("clear", "b2", None)]),
    ("fill the email address with a@b.com and click submit billing", "checkout",
     [("fill", "b1", "a@b.com"), ("click", "b5", None)]),
    ("fill the email address with test@example.com then check the terms checkbox",
     "checkout",
     [("fill", "b1", "test@example.com"), ("check", "b4", None)]),
    ("click submit", "checkout", "clarify"),
    ("submit the form", "checkout", "clarify"),
    ("click the second submit button", "checkout",
     [("click", "b6", None)]),
    ("fill the email address with test@example.com and go back", "multistep",
     [("fill", "b1", "test@example.com"), ("click", "b3", None)]),
]


@pytest.mark.parametrize(
    "utterance,fixture_name,expected",
    UTTERANCE_SUITE,
    ids=[case[0][:48] for case in UTTERANCE_SUITE],
)
def test_utterance_suite(utterance, fixture_name, expected, parser, request):
    snapshot = request.getfixturevalue(fixture_name)
    result = parser.parse(session_id=SESSION, transcript=utterance, snapshot=snapshot)

    if expected == "clarify":
        assert result.needs_clarification is True
        assert result.commands == []
        assert result.clarification_question
        assert [c["nodeId"] for c in result.clarification["candidates"]] == ["b5", "b6"]
        contracts.validate("command", result.clarification)
        return

    assert result.needs_clarification is False, result.clarification
    assert [
        (c["action"], c["target"]["nodeId"], c.get("value")) for c in result.commands
    ] == expected
    for command in result.commands:
        contracts.validate("command", command)


def test_utterance_suite_accuracy_at_least_90_percent(parser, checkout, multistep):
    fixtures = {"checkout": checkout, "multistep": multistep}
    passed = 0
    for utterance, fixture_name, expected in UTTERANCE_SUITE:
        result = parser.parse(
            session_id=SESSION,
            transcript=utterance,
            snapshot=fixtures[fixture_name],
        )
        if expected == "clarify":
            passed += int(result.needs_clarification and not result.commands)
            continue
        got = [(c["action"], c["target"]["nodeId"], c.get("value")) for c in result.commands]
        passed += int(not result.needs_clarification and got == expected)
    ratio = passed / len(UTTERANCE_SUITE)
    assert ratio >= 0.9, f"accuracy {ratio:.0%} ({passed}/{len(UTTERANCE_SUITE)})"


def test_ambiguous_submit_asks_instead_of_guessing(parser, checkout):
    result = parser.parse(
        session_id=SESSION, transcript="click submit", snapshot=checkout
    )
    assert result.needs_clarification
    assert result.commands == []
    clarification = result.clarification
    assert "submit billing" in clarification["question"]
    assert "submit shipping" in clarification["question"]
    assert clarification["ambiguity"]
    assert clarification["previousTranscript"] == "click submit"


def test_confirm_required_set_for_destructive_actions(parser, checkout):
    result = parser.parse(
        session_id=SESSION, transcript="click submit billing", snapshot=checkout
    )
    assert result.commands[0]["confirmRequired"] is True


def test_non_risky_click_has_no_confirm_flag(parser, checkout):
    result = parser.parse(
        session_id=SESSION, transcript="click the terms checkbox", snapshot=checkout
    )
    assert "confirmRequired" not in result.commands[0]


def test_unknown_target_yields_clarification_not_a_command(parser, checkout):
    result = parser.parse(
        session_id=SESSION, transcript="click the cancel subscription button", snapshot=checkout
    )
    assert result.needs_clarification
    assert result.commands == []
    assert "couldn't find" in result.clarification_question


def test_empty_transcript_is_rejected(parser, checkout):
    with pytest.raises(ParseInputError):
        parser.parse(session_id=SESSION, transcript="   ", snapshot=checkout)


def test_missing_session_id_is_rejected(parser, checkout):
    with pytest.raises(ParseInputError):
        parser.parse(session_id="", transcript="click submit billing", snapshot=checkout)


def test_parser_works_without_snapshot(parser):
    result = parser.parse(session_id=SESSION, transcript="click submit billing", snapshot=None)
    assert result.needs_clarification
    assert result.commands == []


def test_invented_value_is_dropped(checkout):
    """Prompt rule 3 is enforced in code, even if a model invents a value."""

    class InventingProvider(RuleProvider):
        def generate(self, *, transcript, nodes, history=None):  # noqa: ARG002
            return ProviderOutput(
                commands=[
                    {
                        "action": "fill",
                        "target": {"label": "email address"},
                        "value": "invented@example.com",
                    }
                ],
                model="inventive",
            )

    parser = Parser(provider=InventingProvider())
    result = parser.parse(
        session_id=SESSION,
        transcript="fill the email address please",
        snapshot=checkout,
    )
    assert result.commands == []
    assert result.needs_clarification
    assert "email address" in result.clarification_question
    # distinct from "couldn't find" — the field exists, the value was not spoken
    assert "couldn't find" not in result.clarification_question
    assert "said out loud" in result.clarification_question
    assert result.clarification["ambiguity"] == "value not spoken"


def test_invalid_provider_output_is_rejected(checkout):
    class BrokenProvider(RuleProvider):
        def generate(self, *, transcript, nodes, history=None):  # noqa: ARG002
            return ProviderOutput(
                commands=[{"action": "teleport", "target": {"label": "email address"}}]
            )

    parser = Parser(provider=BrokenProvider())
    result = parser.parse(
        session_id=SESSION, transcript="teleport me", snapshot=checkout
    )
    assert result.commands == []
    assert result.needs_clarification


def test_llm_style_command_is_resolved_by_label(parser, checkout):
    """Label-only targets (what the LLM often emits) resolve to nodeIds."""

    class LabelOnlyProvider(RuleProvider):
        def generate(self, *, transcript, nodes, history=None):  # noqa: ARG002
            return ProviderOutput(
                commands=[
                    {
                        "action": "fill",
                        "target": {"label": "Email Address:"},
                        "value": "test@example.com",
                    }
                ],
                model="label-only",
            )

    parser = Parser(provider=LabelOnlyProvider())
    result = parser.parse(
        session_id=SESSION,
        transcript="fill the email address with test@example.com",
        snapshot=checkout,
    )
    assert result.commands == [
        {
            "action": "fill",
            "target": {"label": "email address", "nodeId": "b1"},
            "value": "test@example.com",
        }
    ]


def test_ambiguous_llm_target_is_routed_to_clarification(checkout):
    class AmbiguousProvider(RuleProvider):
        def generate(self, *, transcript, nodes, history=None):  # noqa: ARG002
            return ProviderOutput(
                commands=[{"action": "click", "target": {"label": "submit"}}],
                model="ambiguous",
            )

    parser = Parser(provider=AmbiguousProvider())
    result = parser.parse(
        session_id=SESSION, transcript="click submit", snapshot=checkout
    )
    assert result.commands == []
    assert result.needs_clarification
    assert len(result.clarification["candidates"]) == 2


def test_tool_schema_is_self_contained():
    schema = contracts.command_tool_schema()
    assert schema["properties"]["commands"]["items"]["$ref"] == "#/$defs/command"
    import json

    serialized = json.dumps(schema)
    assert "form-control.dev/contracts" not in serialized
    assert "#/$defs/ctx_rect" in serialized
    assert "ctx_rect" in schema["$defs"]


def test_invalid_payload_fails_contract_validation():
    with pytest.raises(ContractError):
        contracts.validate("command", {"action": "teleport", "target": {"label": "x"}})
