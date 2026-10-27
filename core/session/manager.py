"""CORE-003 — Session & multi-form state manager.

Holds everything a client needs before it speaks: the last form snapshot, the
command history, the active node and the detected form steps. Backed by
`SessionStore`, so Redis and the in-memory fallback are interchangeable.
"""

from __future__ import annotations

from typing import Any, Iterable

from core.lib.logging_config import get_logger
from core.session.navigation import detect_form_steps
from core.session.store import SessionStore, SessionStoreError

log = get_logger("session.manager")


def empty_state(session_id: str) -> dict[str, Any]:
    """A valid `SessionState` (CONTRACT-001) for a session with no activity yet."""
    return {
        "sessionId": session_id,
        "currentContextSnapshot": None,
        "history": [],
        "formSteps": [],
    }


class SessionManager:
    def __init__(self, store: SessionStore, history_limit: int = 200) -> None:
        self.store = store
        self.history_limit = max(1, int(history_limit))

    # -- read --------------------------------------------------------------- #

    def get(self, session_id: str) -> dict[str, Any]:
        """Current state, or a fresh empty state (not persisted)."""
        state = self._read(session_id)
        return state if state is not None else empty_state(session_id)

    def get_existing(self, session_id: str) -> dict[str, Any] | None:
        return self._read(session_id)

    def history(self, session_id: str, limit: int = 10) -> list[dict[str, Any]]:
        """Recent commands, for the parser prompt."""
        state = self._read(session_id)
        if not state:
            return []
        return list(state["history"][-limit:])

    # -- write -------------------------------------------------------------- #

    def record(
        self,
        session_id: str,
        *,
        snapshot: dict[str, Any] | None = None,
        commands: Iterable[dict[str, Any]] = (),
        active_node_id: str | None = None,
    ) -> dict[str, Any]:
        """Merge a snapshot and/or executed commands into the session."""
        with self.store.lock:
            state = self.get(session_id)
            if snapshot is not None:
                state["currentContextSnapshot"] = snapshot
                state["formSteps"] = detect_form_steps(snapshot.get("nodes") or [])

            new_commands = [command for command in commands if isinstance(command, dict)]
            if new_commands:
                state["history"] = (state["history"] + new_commands)[-self.history_limit :]
                node_id = (new_commands[-1].get("target") or {}).get("nodeId")
                if node_id:
                    state["currentActiveNodeId"] = node_id
            if active_node_id:
                state["currentActiveNodeId"] = active_node_id

            return self._save(state)

    def set_active_node(self, session_id: str, node_id: str) -> dict[str, Any]:
        with self.store.lock:
            state = self.get(session_id)
            state["currentActiveNodeId"] = node_id
            return self._save(state)

    def clear(self, session_id: str) -> None:
        with self.store.lock:
            self.store.delete_session(session_id)
            self.store.clear_clarification(session_id)

    # -- internals ---------------------------------------------------------- #

    def _read(self, session_id: str) -> dict[str, Any] | None:
        # SessionStore validates against CONTRACT-001 and discards bad payloads.
        return self.store.get_session(session_id)

    def _save(self, state: dict[str, Any]) -> dict[str, Any]:
        try:
            return self.store.save_session(state)
        except SessionStoreError as exc:  # pragma: no cover - network path
            log.error("could not persist session state", extra={"error": str(exc)})
            return state
