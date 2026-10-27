"""Deterministic target resolution against a form snapshot.

The parser never guesses: `match_nodes` returns *all* equally-good candidates and
callers must treat `len(candidates) > 1` as ambiguity (prompt rule 2).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Sequence

from core.lib.text import normalize_label, tokens

#: Words that carry no identifying power inside a spoken target.
FILLER_TOKENS = {
    "the", "a", "an", "one", "that", "this", "it", "its", "my", "our", "your",
    "please", "current", "there", "here", "field", "box", "input", "button",
    "btn", "link", "checkbox", "check", "tick", "dropdown", "select", "option",
    "form", "panel", "section", "area", "element", "control", "on", "into",
    "in", "to", "of", "for", "with", "value",
}

ORDINALS = {
    "first": 0,
    "second": 1,
    "third": 2,
    "fourth": 3,
    "fifth": 4,
    "sixth": 5,
    "last": -1,
    "final": -1,
}

#: Preferred node types per action; a *preference*, not a hard filter.
ACTION_TYPE_PREFERENCE = {
    "fill": ("input", "select"),
    "clear": ("input",),
    "check": ("checkbox",),
    "uncheck": ("checkbox",),
    "navigate": ("link", "button"),
    "click": (),
}


def label_tokens(label: str | None) -> set[str]:
    return tokens(label)


def target_tokens(text: str | None) -> set[str]:
    """Tokens of a spoken target with fillers/ordinals removed."""
    toks = tokens(text) - FILLER_TOKENS - set(ORDINALS)
    # a target that is *only* filler (e.g. "the checkbox") keeps its meaningful
    # remainder; if nothing is left fall back to the raw tokens minus ordinals.
    if not toks:
        toks = tokens(text) - set(ORDINALS) - {"the", "a", "an"}
    return toks


def extract_ordinal(text: str | None) -> int | None:
    for tok in tokens(text):
        if tok in ORDINALS:
            return ORDINALS[tok]
    return None


def score(target: set[str], label: set[str]) -> float:
    """Higher is better; 0 means "no match". Ties are ambiguity."""
    if not target or not label:
        return 0.0
    if target == label:
        return 3.0
    overlap = target & label
    if not overlap:
        return 0.0
    if target <= label:
        return 2.0 + len(overlap) / len(label)
    if label <= target:
        return 1.5 + len(overlap) / len(target)
    ratio = len(overlap) / len(target)
    if ratio >= 0.5:
        return 1.0 + ratio
    return 0.0


def match_nodes(
    nodes: Sequence[dict],
    text: str | None,
    *,
    types: Iterable[str] | None = None,
) -> list[dict]:
    """Best-scoring nodes for a spoken target, preserving snapshot order."""
    target = target_tokens(text)
    if not target:
        return []
    allowed = set(types) if types else None
    scored: list[tuple[float, dict]] = []
    for node in nodes:
        if allowed is not None and node.get("type") not in allowed:
            continue
        node_score = score(target, label_tokens(node.get("label", "")))
        if node_score > 0:
            scored.append((node_score, node))
    if not scored:
        return []
    best = max(s for s, _ in scored)
    return [node for s, node in scored if abs(s - best) < 1e-9]


def match_nodes_preferred(
    nodes: Sequence[dict],
    text: str | None,
    action: str,
) -> list[dict]:
    """Match, preferring the node types an action can actually act on."""
    preferred = ACTION_TYPE_PREFERENCE.get(action, ())
    if preferred:
        hits = match_nodes(nodes, text, types=preferred)
        if hits:
            return hits
    return match_nodes(nodes, text)


def pick_by_index(candidates: Sequence[dict], index: int | None) -> dict | None:
    if index is None or not candidates:
        return None
    try:
        return candidates[index]
    except IndexError:
        return None


@dataclass
class Resolution:
    """Outcome of resolving one command target."""

    node: dict | None = None
    candidates: list[dict] = field(default_factory=list)
    ambiguous: bool = False
    unmatched: bool = False


def resolve_target(nodes: Sequence[dict], target: dict, action: str) -> Resolution:
    """Resolve a `commandTarget` against the snapshot, never guessing."""
    node_id = target.get("nodeId")
    if node_id:
        for node in nodes:
            if node.get("nodeId") == node_id:
                return Resolution(node=node)

    label = target.get("label")
    candidates = match_nodes_preferred(nodes, label, action) if label else []
    index = target.get("index")
    if index is None:
        index = extract_ordinal(label or "")
    if candidates:
        chosen = pick_by_index(candidates, index)
        if chosen is not None:
            return Resolution(node=chosen, candidates=candidates)
        if index is not None:
            return Resolution(candidates=candidates, unmatched=True)
        if len(candidates) == 1:
            return Resolution(node=candidates[0], candidates=candidates)
        return Resolution(candidates=candidates, ambiguous=True)

    if index is not None and 0 <= index < len(nodes):
        return Resolution(node=nodes[index], candidates=[nodes[index]])

    return Resolution(unmatched=True)


def describe_candidates(nodes: Sequence[dict], limit: int = 6) -> str:
    labels = [normalize_label(n.get("label", "")) or n.get("nodeId", "?") for n in nodes[:limit]]
    if len(labels) <= 1:
        return "".join(labels)
    return ", ".join(labels[:-1]) + " or " + labels[-1]
