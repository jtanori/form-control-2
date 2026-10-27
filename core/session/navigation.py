"""Multi-step form navigation helpers (CORE-003).

"go back" must find the form's own Back/Previous control instead of inventing a
command, and step labels ("Step 2", "Next") are surfaced as `SessionState.formSteps`.
"""

from __future__ import annotations

import re
from typing import Sequence

from core.nlu import matching

DIRECTION_SYNONYMS: dict[str, tuple[str, ...]] = {
    "back": ("back", "previous"),
    "previous": ("previous", "back"),
    "next": ("next", "continue"),
    "forward": ("forward", "next", "continue"),
    "continue": ("continue", "next"),
}

_STEP_PATTERN = re.compile(r"\bstep\s*\d+\b", re.IGNORECASE)
_STEP_WORDS = {"next", "previous", "back", "continue", "forward"}


def navigation_candidates(nodes: Sequence[dict], direction: str) -> list[dict]:
    """Buttons/links that move the form in `direction`, best match first."""
    for token in DIRECTION_SYNONYMS.get(direction, (direction,)):
        hits = matching.match_nodes(nodes, token, types=("button", "link"))
        if not hits:
            hits = matching.match_nodes(nodes, token)
        if hits:
            return hits
    return []


def find_navigation_node(nodes: Sequence[dict], direction: str) -> dict | None:
    """The single control for `direction`, or None when missing/ambiguous."""
    hits = navigation_candidates(nodes, direction)
    return hits[0] if len(hits) == 1 else None


def is_step_node(node: dict) -> bool:
    label = (node.get("label") or "").lower()
    if label in _STEP_WORDS:
        return True
    return bool(_STEP_PATTERN.search(label))


def detect_form_steps(nodes: Sequence[dict]) -> list[str]:
    """Detected step labels, unique and in snapshot order (`SessionState.formSteps`)."""
    steps: list[str] = []
    for node in nodes:
        if not is_step_node(node):
            continue
        label = node.get("displayLabel") or node.get("label") or ""
        if label and label not in steps:
            steps.append(label)
    return steps
