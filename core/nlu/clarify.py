"""CORE-002 — Clarification / ambiguity resolver.

Closes the loop started by the parser:

1. `/api/v1/parse` decides it needs clarification and the route stores the
   pending state under `session:{sessionId}:clarification` (CORE-003 key space),
2. the user answers ("billing submit"),
3. `/api/v1/clarify` matches that answer against the stored *candidates only*,
   replays the commands resolved before the ambiguity and returns the completed
   command list.

State is cleared as soon as the ambiguity is resolved, and it inherits the
session TTL, so an abandoned clarification expires with the session.
"""

from __future__ import annotations

from typing import Any

from core.lib import contracts
from core.lib.contracts import ContractError
from core.lib.logging_config import get_logger
from core.lib.text import normalize_label, normalize_text
from core.nlu import matching
from core.nlu.parser import ParseResult, Parser
from core.session.store import SessionStore, SessionStoreError

log = get_logger("nlu.clarify")


class ClarificationError(RuntimeError):
    """No clarification is pending for this session (HTTP 409)."""


class ClarificationInputError(ClarificationError):
    """The clarify request itself is unusable (HTTP 400)."""


class ClarificationResolver:
    def __init__(self, parser: Parser, store: SessionStore) -> None:
        self.parser = parser
        self.store = store

    # -- write side --------------------------------------------------------- #

    def remember(
        self,
        result: ParseResult,
        snapshot: dict[str, Any] | None,
    ) -> None:
        """Persist the pending ambiguity produced by `Parser.parse`."""
        if not result.needs_clarification or not result.clarification:
            return
        try:
            contracts.validate("command", result.clarification)
        except ContractError as exc:  # pragma: no cover - defensive
            raise ClarificationError(f"invalid clarification payload: {exc}") from exc

        pending = {
            "clarification": result.clarification,
            "commands": result.commands,
            "pendingCommand": result.pending_command,
            "snapshot": snapshot,
            "model": result.model,
        }
        self.store.save_clarification(result.session_id, pending)
        log.info(
            "clarification stored",
            extra={
                "candidateCount": len(result.clarification.get("candidates") or []),
                "replayCommandCount": len(result.commands),
            },
        )

    # -- read side ---------------------------------------------------------- #

    def resolve(
        self,
        *,
        session_id: str,
        clarification_text: str,
        snapshot: dict[str, Any] | None = None,
    ) -> ParseResult:
        answer = normalize_text(clarification_text)
        if not answer:
            raise ClarificationInputError("clarificationText must not be empty")

        pending = self.store.get_clarification(session_id)
        if not pending:
            raise ClarificationError(
                f"no pending clarification for session {session_id!r}"
            )

        clarification: dict[str, Any] = pending.get("clarification") or {}
        original = normalize_text(clarification.get("previousTranscript") or "")
        context = snapshot or pending.get("snapshot")
        prior_commands: list[dict[str, Any]] = list(pending.get("commands") or [])
        pending_command: dict[str, Any] | None = pending.get("pendingCommand")
        candidates: list[dict[str, Any]] = list(clarification.get("candidates") or [])

        resolved = self._resolve_candidate(answer, candidates, pending_command)
        if resolved is None:
            resolved = self._value_command(answer, pending_command, candidates)

        if resolved is not None:
            result = self.parser.accept(
                session_id=session_id,
                transcript=f"{original} {answer}".strip(),
                snapshot=context,
                commands=prior_commands + [resolved],
            )
            if not result.needs_clarification:
                self._finish(session_id)
                log.info(
                    "clarification resolved",
                    extra={"commandCount": len(result.commands)},
                )
                return result
            # still ambiguous (e.g. answer matched a narrower set): re-ask
            self.remember(result, context)
            log.info("clarification still ambiguous")
            return result

        if not candidates:
            # Nothing to choose from (e.g. "I couldn't find X"): treat the answer
            # as a fresh instruction.
            fresh = self.parser.parse(
                session_id=session_id,
                transcript=answer,
                snapshot=context,
                history=prior_commands,
            )
            if not fresh.needs_clarification:
                self._finish(session_id)
                return fresh
            self.remember(fresh, context)
            return fresh

        # Candidates exist but the answer did not match any of them: ask again
        # with the same choices instead of guessing.
        requestion = self._reask(clarification, candidates, answer)
        self.store.save_clarification(
            session_id,
            {
                "clarification": requestion,
                "commands": prior_commands,
                "pendingCommand": pending_command,
                "snapshot": context,
            },
        )
        log.info("clarification answer did not match candidates")
        return ParseResult(
            session_id=session_id,
            transcript=answer,
            commands=[],
            needs_clarification=True,
            clarification_question=requestion["question"],
            clarification=requestion,
            model=pending.get("model", ""),
            pending_command=pending_command,
        )

    # -- helpers ------------------------------------------------------------ #

    @staticmethod
    def _resolve_candidate(
        answer: str,
        candidates: list[dict[str, Any]],
        pending_command: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if not candidates:
            return None
        hits = matching.match_nodes(candidates, answer)
        if len(hits) != 1:
            return None
        node = hits[0]
        action = (pending_command or {}).get("action") or "click"
        command: dict[str, Any] = {
            "action": action,
            "target": {
                "label": normalize_label(node.get("label", "")),
                "nodeId": node.get("nodeId"),
            },
        }
        value = (pending_command or {}).get("value")
        if isinstance(value, str) and value:
            command["value"] = value
        return command

    @staticmethod
    def _value_command(
        answer: str,
        pending_command: dict[str, Any] | None,
        candidates: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """If the parser asked for a missing fill value, the answer *is* the value."""
        if not pending_command or pending_command.get("action") != "fill":
            return None
        if pending_command.get("value"):
            return None
        target = dict(pending_command.get("target") or {})
        if not target:
            return None
        if len(candidates) == 1:
            node = candidates[0]
            target = {
                "label": normalize_label(node.get("label", "")) or target.get("label", ""),
                "nodeId": node.get("nodeId"),
            }
        return {"action": "fill", "target": target, "value": answer}

    @staticmethod
    def _reask(
        clarification: dict[str, Any],
        candidates: list[dict[str, Any]],
        answer: str,
    ) -> dict[str, Any]:
        options = matching.describe_candidates(candidates)
        question = (
            f"I didn't catch which one you meant. Did you mean {options}?"
        )
        return {
            "sessionId": clarification.get("sessionId", ""),
            "question": question,
            "candidates": candidates,
            "previousTranscript": clarification.get("previousTranscript") or answer,
            "ambiguity": clarification.get("ambiguity") or "answer did not match candidates",
        }

    def _finish(self, session_id: str) -> None:
        try:
            self.store.clear_clarification(session_id)
        except SessionStoreError:  # pragma: no cover - network path
            log.warning("could not clear clarification state")
