"""CORE-001 — Intent parser.

`POST /api/v1/parse` turns `transcript + FormSnapshot` into validated
`Command[]`. The parser owns the safety rules so that no provider (rule-based or
LLM) can bypass them:

1. explicit labels are preferred over indices,
2. more than one matching node => clarification instead of a guess,
3. fill values must occur verbatim in the transcript (never invented),
4. every emitted command validates against `contracts/v1/command.schema.json`.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Sequence

from core.config import Settings, get_settings
from core.lib import contracts
from core.lib.contracts import ContractError
from core.lib.logging_config import get_logger
from core.lib.text import contains_value, normalize_label, normalize_text
from core.nlu import matching
from core.nlu.provider import (
    RISKY_PATTERN,
    Provider,
    ProviderError,
    ProviderOutput,
    get_provider,
)

log = get_logger("nlu.parser")

ACTIONS = {"fill", "click", "check", "uncheck", "navigate", "clear"}
_TYPE_WORDS = {
    "input": "field",
    "select": "dropdown",
    "checkbox": "checkbox",
    "button": "button",
    "link": "link",
}


class ParseInputError(ValueError):
    """The request itself is unusable (empty transcript, bad context, ...)."""


class ParseError(RuntimeError):
    """The parser produced something that violates the contract."""


@dataclass
class ParseResult:
    session_id: str
    transcript: str
    commands: list[dict[str, Any]] = field(default_factory=list)
    needs_clarification: bool = False
    clarification_question: str | None = None
    clarification: dict[str, Any] | None = None
    model: str = ""
    latency_ms: float = 0.0

    def response_payload(self, *, withhold_commands: bool = False) -> dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "commands": [] if withhold_commands else list(self.commands),
            "needsClarification": self.needs_clarification,
            "clarificationQuestion": self.clarification_question,
            "clarification": self.clarification,
            "model": self.model,
        }


def _question_for(candidates: Sequence[dict], fallback: str | None = None) -> str:
    if fallback:
        return fallback
    if not candidates:
        return "Which field do you mean?"
    word = _TYPE_WORDS.get(candidates[0].get("type", ""), "option")
    return (
        f"Which {word} do you mean: {matching.describe_candidates(candidates)}?"
    )


def _node_public(node: dict) -> dict[str, Any]:
    """Only contract fields are exposed to clients (drops source-specific extras)."""
    allowed = {
        "nodeId", "label", "displayLabel", "type", "value", "checked", "rect",
        "offscreen", "role", "source", "actions",
    }
    return {key: value for key, value in node.items() if key in allowed}


class Parser:
    def __init__(self, provider: Provider | None = None, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._provider = provider

    @property
    def provider(self) -> Provider:
        if self._provider is None:
            self._provider = get_provider(self.settings)
        return self._provider

    # -- public API --------------------------------------------------------- #

    def parse(
        self,
        *,
        session_id: str,
        transcript: str,
        snapshot: dict[str, Any] | None = None,
        history: Sequence[dict] | None = None,
    ) -> ParseResult:
        started = time.perf_counter()
        clean_transcript = normalize_text(transcript)
        if not clean_transcript:
            raise ParseInputError("transcript must not be empty")
        if not session_id:
            raise ParseInputError("sessionId is required")

        nodes = self._nodes(snapshot)
        try:
            output = self.provider.generate(
                transcript=clean_transcript, nodes=nodes, history=list(history or [])
            )
        except ProviderError as exc:
            log.error("parse provider failed", extra={"error": str(exc)})
            raise

        result = self._finalize(
            session_id=session_id,
            transcript=clean_transcript,
            nodes=nodes,
            output=output,
        )
        result.latency_ms = round((time.perf_counter() - started) * 1000, 1)
        log.info(
            "parse",
            extra={
                "transcriptLength": len(clean_transcript),
                "commandCount": len(result.commands),
                "needsClarification": result.needs_clarification,
                "model": result.model,
                "latencyMs": result.latency_ms,
                "nodeCount": len(nodes),
            },
        )
        return result

    # -- internals ---------------------------------------------------------- #

    @staticmethod
    def _nodes(snapshot: dict[str, Any] | None) -> list[dict[str, Any]]:
        if snapshot is None:
            return []
        if not isinstance(snapshot, dict):
            raise ParseInputError("context must be a FormSnapshot object")
        nodes = snapshot.get("nodes") or []
        if not isinstance(nodes, list):
            raise ParseInputError("context.nodes must be an array")
        return [node for node in nodes if isinstance(node, dict)]

    def _finalize(
        self,
        *,
        session_id: str,
        transcript: str,
        nodes: Sequence[dict],
        output: ProviderOutput,
    ) -> ParseResult:
        commands: list[dict[str, Any]] = []
        missing: list[dict[str, Any]] = []
        ambiguity: list[dict] | None = None

        for raw in output.commands:
            if not isinstance(raw, dict):
                log.warning("dropping non-object command from provider")
                continue
            action = raw.get("action")
            target = raw.get("target") if isinstance(raw.get("target"), dict) else {}
            if action not in ACTIONS:
                log.warning("dropping command with unknown action", extra={"action": action})
                continue
            try:
                contracts.validate("command", raw)
            except ContractError as exc:
                log.warning("dropping contract-invalid command", extra={"error": str(exc)})
                continue

            resolution = matching.resolve_target(nodes, target, action)
            if resolution.ambiguous:
                ambiguity = resolution.candidates
                break
            if resolution.node is None:
                missing.append({"action": action, "target": target})
                continue

            value = raw.get("value")
            if action == "fill":
                if not isinstance(value, str) or not value.strip():
                    missing.append({"action": action, "target": target, "reason": "missing value"})
                    continue
                if not contains_value(transcript, value):
                    # prompt rule 3: never invent values
                    log.warning("dropping fill whose value is absent from the transcript")
                    missing.append(
                        {"action": action, "target": target, "reason": "value not spoken"}
                    )
                    continue

            command: dict[str, Any] = {
                "action": action,
                "target": {
                    "label": normalize_label(resolution.node.get("label", ""))
                    or normalize_label(str(target.get("label") or "")),
                    "nodeId": resolution.node.get("nodeId"),
                },
            }
            if isinstance(value, str):
                command["value"] = value
            label_for_risk = f"{resolution.node.get('label', '')} {target.get('label', '')}"
            if raw.get("confirmRequired") or RISKY_PATTERN.search(label_for_risk):
                command["confirmRequired"] = True

            try:
                contracts.validate("command", command)
            except ContractError as exc:  # pragma: no cover - defensive
                raise ParseError(f"internal command invalid: {exc}") from exc
            commands.append(command)

        clarification = None
        if output.needs_clarification:
            candidates = self._candidates_from_ids(nodes, output.candidate_ids)
            clarification = self._clarification(
                session_id=session_id,
                transcript=transcript,
                candidates=candidates,
                question=output.clarification_question,
                ambiguity="provider",
            )
        elif ambiguity is not None:
            clarification = self._clarification(
                session_id=session_id,
                transcript=transcript,
                candidates=ambiguity,
                question=None,
                ambiguity=f"{len(ambiguity)} nodes match the request",
            )
        elif not commands and missing:
            first = missing[0]
            label = normalize_label(str(first["target"].get("label") or ""))
            clarification = self._clarification(
                session_id=session_id,
                transcript=transcript,
                candidates=[],
                question=(
                    f"I couldn't find '{label}' on this form. Which field do you mean?"
                    if label
                    else "Which field should I use?"
                ),
                ambiguity=first.get("reason", "unmatched target"),
            )
        elif not commands and not output.needs_clarification:
            clarification = self._clarification(
                session_id=session_id,
                transcript=transcript,
                candidates=[],
                question="I couldn't map that to a field on this form. Which field should I use?",
                ambiguity="no command produced",
            )

        return ParseResult(
            session_id=session_id,
            transcript=transcript,
            commands=commands,
            needs_clarification=clarification is not None,
            clarification_question=clarification["question"] if clarification else None,
            clarification=clarification,
            model=output.model or self.provider.name,
        )

    @staticmethod
    def _candidates_from_ids(nodes: Sequence[dict], ids: Sequence[str]) -> list[dict]:
        if not ids:
            return []
        by_id = {node.get("nodeId"): node for node in nodes}
        return [by_id[node_id] for node_id in ids if node_id in by_id]

    @staticmethod
    def _clarification(
        *,
        session_id: str,
        transcript: str,
        candidates: Sequence[dict],
        question: str | None,
        ambiguity: str | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "sessionId": session_id,
            "question": _question_for(candidates, question),
            "candidates": [_node_public(node) for node in candidates],
            "previousTranscript": transcript,
        }
        if ambiguity:
            payload["ambiguity"] = ambiguity
        try:
            contracts.validate("command", payload)
        except ContractError as exc:  # pragma: no cover - defensive
            raise ParseError(f"internal clarification invalid: {exc}") from exc
        return payload
