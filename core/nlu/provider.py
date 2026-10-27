"""Command providers.

Two implementations behind one interface:

* `RuleProvider` — deterministic, offline, zero-dependency. Used for tests, CI
  and any deployment without an LLM key (the ticket requires the parser to run
  end-to-end on mock text).
* `OpenAIProvider` — live `gpt-4o` function calling, emits commands through the
  `emit_commands` tool whose parameter schema is derived from
  `contracts/v1/command.schema.json`.

Providers return *raw* commands (targets may be label-only); the parser resolves
and validates them, so both paths share identical safety checks.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence

from core.config import Settings, get_settings
from core.lib import contracts
from core.lib.logging_config import get_logger
from core.lib.text import contains_value, normalize_label, normalize_text
from core.nlu import matching
from core.session import navigation

log = get_logger("nlu.provider")

PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "form-control-v1.md"

RISKY_PATTERN = re.compile(
    r"\b(submit|pay|payment|purchase|buy|checkout|place order|delete|remove|"
    r"cancel|confirm|send|book|sign|apply)\b",
    re.IGNORECASE,
)


class ProviderError(RuntimeError):
    """The model call failed or returned something unusable."""


@dataclass
class ProviderOutput:
    commands: list[dict[str, Any]] = field(default_factory=list)
    needs_clarification: bool = False
    clarification_question: str | None = None
    candidate_ids: list[str] = field(default_factory=list)
    #: The intent the clarification is about (action + label), so CORE-002 can
    #: finish it once the user picks a candidate.
    pending_command: dict[str, Any] | None = None
    model: str = "rule-v1"


class Provider:
    name = "provider"

    def generate(
        self,
        *,
        transcript: str,
        nodes: Sequence[dict],
        history: Sequence[dict] | None = None,
    ) -> ProviderOutput:  # pragma: no cover - interface
        raise NotImplementedError


# --------------------------------------------------------------------------- #
# Deterministic rule provider
# --------------------------------------------------------------------------- #

_VERB_FILL = r"(?:fill(?:\s+(?:in|out))?|type|enter|write|put|set)"

FILL_INTO = re.compile(
    r"^(?:type|enter|write|put)\s+(?P<value>.+?)\s+(?:in|into|to)\s+(?:the\s+|a\s+)?(?P<label>.+)$",
    re.IGNORECASE,
)
FILL_WITH = re.compile(
    rf"^{_VERB_FILL}\s+(?:the\s+|a\s+)?(?P<label>.+?)\s+(?:with|to|as|equals?)\s+(?P<value>.+)$",
    re.IGNORECASE,
)
FILL_BARE = re.compile(
    rf"^{_VERB_FILL}\s+(?:the\s+|a\s+)?(?P<label>.+)$", re.IGNORECASE
)
SELECT_WITH = re.compile(
    r"^(?:select|choose|pick)\s+(?P<value>.+?)\s+(?:in|from|for|under|on)\s+"
    r"(?:the\s+|a\s+)?(?P<label>.+)$",
    re.IGNORECASE,
)
SELECT_BARE = re.compile(
    r"^(?:select|choose|pick)\s+(?:the\s+|a\s+)?(?P<label>.+)$", re.IGNORECASE
)
CLICK = re.compile(
    r"^(?:click|press|tap|hit|push)\s+(?:on\s+)?(?:the\s+|a\s+)?(?P<label>.+)$",
    re.IGNORECASE,
)
CHECK = re.compile(r"^(?:check|tick|mark)\s+(?:the\s+|a\s+)?(?P<label>.+)$", re.IGNORECASE)
UNCHECK = re.compile(
    r"^(?:uncheck|untick|deselect|un-select)\s+(?:the\s+|a\s+)?(?P<label>.+)$",
    re.IGNORECASE,
)
CLEAR = re.compile(
    r"^(?:clear|erase|empty|wipe)\s+(?:the\s+|a\s+)?(?P<label>.+)$", re.IGNORECASE
)
SUBMIT_BARE = re.compile(
    r"^(?:submit|send)(?:\s+(?:the\s+)?(?:form|page|application|order))?$", re.IGNORECASE
)
NAV = re.compile(
    r"^(?:go|navigate|move|jump|take\s+me)\s*(?:to\s+)?(?:the\s+)?"
    r"(?P<direction>back|previous|next|forward|continue)\b.*$",
    re.IGNORECASE,
)
BARE_NAV = re.compile(r"^(?P<direction>back|previous|next|forward)\b.*$", re.IGNORECASE)

_CLAUSE_SPLIT = re.compile(
    r"\s*(?:,\s*(?:and\s+)?|;\s*|\s+and\s+(?:then\s+)?|\s+then\s+)"
    r"(?=(?:please\s+)?(?:fill|type|enter|write|put|set|click|press|tap|hit|push|"
    r"check|tick|uncheck|untick|clear|erase|wipe|select|choose|pick|go|navigate|"
    r"move|jump|submit|send)\b)",
    re.IGNORECASE,
)
_LEADING_NOISE = re.compile(
    r"^(?:(?:and|then|also|now|okay|ok|so|please|could you|can you|would you|"
    r"i want to|i need to|let's|lets)\b[\s,]*)+",
    re.IGNORECASE,
)

def split_clauses(transcript: str) -> list[str]:
    """Split a multi-instruction transcript into one clause per instruction."""
    parts = _CLAUSE_SPLIT.split(normalize_text(transcript))
    clauses = []
    for part in parts:
        clause = _LEADING_NOISE.sub("", normalize_text(part)).strip(" ,;.")
        if clause:
            clauses.append(clause)
    return clauses


def _command(action: str, label: str, *, value: str | None = None, index: int | None = None) -> dict:
    target: dict[str, Any] = {"label": normalize_label(label)}
    if index is not None:
        target["index"] = index
    command: dict[str, Any] = {"action": action, "target": target}
    if value is not None:
        command["value"] = value
    return command


def _type_word(nodes: Sequence[dict]) -> str:
    types = {node.get("type") for node in nodes}
    if len(types) == 1:
        return {"input": "field", "select": "dropdown", "checkbox": "checkbox", "link": "link"}.get(
            next(iter(types)), next(iter(types))
        )
    return "option"


def _ambiguity(
    clause: str,
    nodes: Sequence[dict],
    action: str = "click",
    value: str | None = None,
) -> ProviderOutput:
    candidates = list(nodes)
    question = (
        f"Which {_type_word(candidates)} do you mean: "
        f"{matching.describe_candidates(candidates)}?"
    )
    pending: dict[str, Any] = {
        "action": action,
        "target": {"label": normalize_label(clause)},
    }
    if value is not None:
        pending["value"] = value
    return ProviderOutput(
        commands=[],
        needs_clarification=True,
        clarification_question=question,
        candidate_ids=[n.get("nodeId", "") for n in candidates],
        pending_command=pending,
    )


class RuleProvider(Provider):
    name = "rule-v1"

    def generate(
        self,
        *,
        transcript: str,
        nodes: Sequence[dict],
        history: Sequence[dict] | None = None,
    ) -> ProviderOutput:
        commands: list[dict] = []
        for clause in split_clauses(transcript):
            result = self._parse_clause(clause, nodes)
            if result is None:
                continue
            if result.needs_clarification:
                result.commands = commands + result.commands
                return result
            commands.extend(result.commands)
        if not commands:
            return ProviderOutput(
                commands=[],
                needs_clarification=True,
                clarification_question=(
                    "I couldn't map that to a field on this form. "
                    "Which field should I use?"
                ),
            )
        return ProviderOutput(commands=commands, model=self.name)

    # -- clause grammar ----------------------------------------------------- #

    def _parse_clause(self, clause: str, nodes: Sequence[dict]) -> ProviderOutput | None:
        # navigation first: "go back", "next step"
        nav = NAV.match(clause) or BARE_NAV.match(clause)
        if nav:
            return self._navigate(nav.group("direction").lower(), nodes)

        if SUBMIT_BARE.match(clause):
            return self._target("click", "submit", nodes)

        match = UNCHECK.match(clause)
        if match:
            return self._target("uncheck", match.group("label"), nodes)
        match = CHECK.match(clause)
        if match:
            return self._target("check", match.group("label"), nodes)
        match = CLEAR.match(clause)
        if match:
            return self._target("clear", match.group("label"), nodes)

        match = FILL_INTO.match(clause) or FILL_WITH.match(clause)
        if match:
            return self._target(
                "fill",
                match.group("label"),
                nodes,
                value=match.group("value"),
                transcript=clause,
            )
        match = SELECT_WITH.match(clause)
        if match:
            return self._select(match.group("label"), match.group("value"), nodes)
        match = SELECT_BARE.match(clause)
        if match:
            return self._select(match.group("label"), None, nodes)

        match = CLICK.match(clause)
        if match:
            return self._target("click", match.group("label"), nodes)

        match = FILL_BARE.match(clause)
        if match:
            label = match.group("label")
            return ProviderOutput(
                commands=[],
                needs_clarification=True,
                clarification_question=f"What should I enter in the {normalize_label(label)}?",
                candidate_ids=[
                    n.get("nodeId", "")
                    for n in matching.match_nodes_preferred(nodes, label, "fill")
                ],
                pending_command={
                    "action": "fill",
                    "target": {"label": normalize_label(label)},
                },
            )
        return None

    def _select(self, label: str, value: str | None, nodes: Sequence[dict]) -> ProviderOutput:
        candidates = matching.match_nodes_preferred(nodes, label, "fill")
        if len(candidates) == 1 and candidates[0].get("type") == "checkbox":
            return self._target("check", label, nodes)
        if value is None:
            return self._target("click", label, nodes)
        return self._target("fill", label, nodes, value=value, transcript=label + " " + value)

    def _navigate(self, direction: str, nodes: Sequence[dict]) -> ProviderOutput:
        hits = navigation.navigation_candidates(nodes, direction)
        if len(hits) == 1:
            return ProviderOutput(
                commands=[
                    {
                        "action": "click",
                        "target": {
                            "label": normalize_label(hits[0].get("label", "")),
                            "nodeId": hits[0].get("nodeId"),
                        },
                    }
                ],
                model=self.name,
            )
        if len(hits) > 1:
            return _ambiguity(direction, hits, action="click")
        return ProviderOutput(
            commands=[],
            needs_clarification=True,
            clarification_question=(
                f"I couldn't find a '{direction}' button on this form. "
                "Which control should I use?"
            ),
        )

    def _target(
        self,
        action: str,
        label: str,
        nodes: Sequence[dict],
        *,
        value: str | None = None,
        transcript: str = "",
    ) -> ProviderOutput:
        index = matching.extract_ordinal(label)
        candidates = matching.match_nodes_preferred(nodes, label, action)
        if not candidates:
            return ProviderOutput(
                commands=[],
                needs_clarification=True,
                clarification_question=(
                    f"I couldn't find '{normalize_label(label)}' on this form. "
                    "Which field do you mean?"
                ),
            )
        if len(candidates) > 1:
            chosen = matching.pick_by_index(candidates, index)
            if chosen is None:
                return _ambiguity(label, candidates, action=action, value=value)
            candidates = [chosen]
        node = candidates[0]
        command = {
            "action": action,
            "target": {
                "label": normalize_label(node.get("label", "")) or normalize_label(label),
                "nodeId": node.get("nodeId"),
            },
        }
        if value is not None:
            command["value"] = value
            if transcript and not contains_value(transcript, value):
                return ProviderOutput(
                    commands=[],
                    needs_clarification=True,
                    clarification_question=(
                        f"What value should I use for "
                        f"{normalize_label(node.get('label', '')) or normalize_label(label)}?"
                    ),
                    candidate_ids=[node.get("nodeId", "")],
                )
            # never invent: the spoken clause is the source of truth
            if not contains_value(transcript or value, value):
                return ProviderOutput(commands=[])
        return ProviderOutput(commands=[command], model=self.name)


# --------------------------------------------------------------------------- #
# OpenAI provider
# --------------------------------------------------------------------------- #

class OpenAIProvider(Provider):
    name = "openai"

    def __init__(self, settings: Settings | None = None, client: Any | None = None) -> None:
        self.settings = settings or get_settings()
        if client is not None:
            self._client = client
        else:  # pragma: no cover - requires network/key
            if not self.settings.openai_api_key:
                raise ProviderError("OPENAI_API_KEY is not configured")
            try:
                from openai import OpenAI
            except ImportError as exc:
                raise ProviderError(
                    "the openai package is not installed; install "
                    "requirements-llm.txt or run with NLU_PROVIDER=rule"
                ) from exc

            self._client = OpenAI(api_key=self.settings.openai_api_key, timeout=30.0)
        self.model = self.settings.openai_model
        self.system_prompt = PROMPT_PATH.read_text(encoding="utf-8")

    def _messages(
        self, transcript: str, nodes: Sequence[dict], history: Sequence[dict]
    ) -> list[dict]:
        context: dict[str, Any] = {
            "transcript": transcript,
            "context": {"FormSnapshot": {"nodes": list(nodes)}},
            "history": list(history),
        }
        return [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": "Parse this request and call emit_commands.\n"
                + json.dumps(context, ensure_ascii=False),
            },
        ]

    def generate(
        self,
        *,
        transcript: str,
        nodes: Sequence[dict],
        history: Sequence[dict] | None = None,
    ) -> ProviderOutput:
        tool = {
            "type": "function",
            "function": {
                "name": "emit_commands",
                "description": (
                    "Emit ordered form commands, or request clarification when the "
                    "target is ambiguous or the value is missing."
                ),
                "parameters": contracts.command_tool_schema(),
            },
        }
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=self._messages(transcript, nodes, history or []),
                tools=[tool],
                tool_choice={"type": "function", "function": {"name": "emit_commands"}},
                temperature=0,
            )
        except Exception as exc:  # pragma: no cover - network path
            raise ProviderError(f"OpenAI request failed: {exc}") from exc

        message = response.choices[0].message
        calls = getattr(message, "tool_calls", None) or []
        if not calls:  # pragma: no cover - model misbehaviour
            raise ProviderError("model did not call emit_commands")
        try:
            payload = json.loads(calls[0].function.arguments)
        except (json.JSONDecodeError, TypeError) as exc:  # pragma: no cover
            raise ProviderError(f"invalid tool arguments: {exc}") from exc

        pending = payload.get("pendingCommand")
        return ProviderOutput(
            commands=list(payload.get("commands") or []),
            needs_clarification=bool(payload.get("needsClarification")),
            clarification_question=payload.get("clarificationQuestion"),
            candidate_ids=list(payload.get("candidateNodeIds") or []),
            pending_command=pending if isinstance(pending, dict) else None,
            model=self.model,
        )


def get_provider(settings: Settings | None = None) -> Provider:
    settings = settings or get_settings()
    if settings.resolved_provider == "openai":
        return OpenAIProvider(settings)
    return RuleProvider()
