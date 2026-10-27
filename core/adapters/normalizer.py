"""CORE-004 — Context normalizer (bridge adapter).

One adapter in front of the parser so a DOM snapshot, an Android
AccessibilityService dump and a vision/desktop extraction all become the same
`FormSnapshot` (CONTRACT-001):

* labels are normalized (lowercase, trimmed, whitespace collapsed, decorative
  punctuation stripped) with the *same* function the parser matches against,
* nodeIds are deterministic and prefixed per source (`b`/`a`/`v`),
* rects are standardized to pixels `{x, y, w, h}`; zero/offscreen rects are
  clamped to zeros and flagged with `offscreen: true`,
* `actions[]` is inferred from `type` when a bridge omits it,
* the result validates against `contracts/v1/form-context.schema.json`.

Upstream extractors are explicitly *not* required to match byte-for-byte; this
layer is what guarantees equivalence.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

from core.lib import contracts
from core.lib.contracts import ContractError
from core.lib.logging_config import get_logger
from core.lib.text import normalize_label, normalize_text

log = get_logger("adapters.normalizer")

SOURCE_PREFIX = {"dom": "b", "accessibility": "a", "vision": "v"}

TYPE_ACTIONS: dict[str, list[str]] = {
    "input": ["fill", "clear"],
    "button": ["click"],
    "checkbox": ["check", "uncheck"],
    "select": ["click", "fill"],
    "link": ["navigate", "click"],
}

TYPE_ROLE: dict[str, str] = {
    "input": "textbox",
    "button": "button",
    "checkbox": "checkbox",
    "select": "combobox",
    "link": "link",
}

_NODE_TYPES = set(TYPE_ACTIONS)
_NODE_ACTIONS = {"fill", "click", "check", "uncheck", "navigate", "clear"}

_INPUT_TYPES = {
    "text": "input", "email": "input", "password": "input", "tel": "input",
    "number": "input", "search": "input", "url": "input", "date": "input",
    "time": "input", "textarea": "input", "input": "input",
    "checkbox": "checkbox", "radio": "checkbox", "switch": "checkbox",
    "toggle": "checkbox",
    "select": "select", "dropdown": "select", "combobox": "select",
    "button": "button", "submit": "button", "reset": "button",
    "link": "link", "a": "link",
}

_VISION_KINDS = {
    "textfield": "input", "text_field": "input", "input": "input",
    "edit_text": "input", "entry": "input", "textbox": "input",
    "button": "button", "btn": "button", "submit": "button",
    "checkbox": "checkbox", "toggle": "checkbox", "switch": "checkbox",
    "dropdown": "select", "select": "select", "combobox": "select",
    "link": "link", "hyperlink": "link",
}

_BOUNDS = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")
_CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


class NormalizationError(ValueError):
    """The payload cannot be turned into a valid FormSnapshot."""


# --------------------------------------------------------------------------- #
# Primitives
# --------------------------------------------------------------------------- #

def _iso_timestamp(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            parsed = None
        if parsed is not None:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat(timespec="seconds").replace(
                "+00:00", "Z"
            )
    if isinstance(value, (int, float)) and value > 0:
        seconds = value / 1000 if value > 1e11 else value
        return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat(
            timespec="seconds"
        ).replace("+00:00", "Z")
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(round(float(value))))
    except (TypeError, ValueError):
        return default


def standardize_rect(rect: Any) -> tuple[dict[str, int], bool]:
    """`{x,y,w,h}` in pixels plus an `offscreen` flag. Never negative."""
    if isinstance(rect, str):
        match = _BOUNDS.fullmatch(rect.strip())
        if match:
            x1, y1, x2, y2 = (int(group) for group in match.groups())
            rect = {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}
    if isinstance(rect, (list, tuple)) and len(rect) == 4:
        x, y, w, h = rect
        rect = {"x": x, "y": y, "w": w, "h": h}
    if not isinstance(rect, dict):
        return {"x": 0, "y": 0, "w": 0, "h": 0}, True

    x = _int(rect.get("x", rect.get("left", 0)))
    y = _int(rect.get("y", rect.get("top", 0)))
    w = _int(rect.get("w", rect.get("width", 0)))
    h = _int(rect.get("h", rect.get("height", 0)))
    if w == 0 or h == 0:
        return {"x": 0, "y": 0, "w": 0, "h": 0}, True
    return {"x": x, "y": y, "w": w, "h": h}, False


def infer_type(*candidates: Any) -> str:
    """Map bridge-specific type hints onto `input|button|checkbox|select|link`."""
    for candidate in candidates:
        if not candidate:
            continue
        raw = str(candidate).strip().lower()
        if raw in _NODE_TYPES:
            return raw
        if raw in _INPUT_TYPES:
            return _INPUT_TYPES[raw]
    return "input"


def infer_actions(node_type: str, provided: Iterable[str] | None = None) -> list[str]:
    actions: list[str] = []
    for action in provided or []:
        if action in _NODE_ACTIONS and action not in actions:
            actions.append(action)
    if not actions:
        actions = list(TYPE_ACTIONS.get(node_type, ["click"]))
    return actions


def _humanize_view_id(view_id: str) -> str:
    """`com.shop:id/et_email_address` -> `et email address` (last resort label)."""
    tail = view_id.rsplit("/", 1)[-1].rsplit(".", 1)[-1]
    tail = _CAMEL.sub(" ", tail.replace("_", " ").replace("-", " "))
    return normalize_text(tail)


# --------------------------------------------------------------------------- #
# Node builders
# --------------------------------------------------------------------------- #

def _finish_node(
    *,
    source: str,
    index: int,
    label: Any,
    node_type: str,
    rect: Any,
    actions: Iterable[str] | None,
    role: Any = None,
    value: Any = None,
    checked: Any = None,
    display_label: str | None = None,
    offscreen_hint: bool = False,
    provided_id: Any = None,
) -> dict[str, Any]:
    rect_px, rect_offscreen = standardize_rect(rect)
    node: dict[str, Any] = {
        "nodeId": str(provided_id) if provided_id else f"{SOURCE_PREFIX[source]}{index + 1}",
        "label": normalize_label(label) if label is not None else "",
        "type": node_type,
        "rect": rect_px,
        "source": source,
        "actions": infer_actions(node_type, actions),
    }
    if display_label:
        node["displayLabel"] = display_label
    if isinstance(value, str):
        node["value"] = value
    if isinstance(checked, bool):
        node["checked"] = checked
    if isinstance(role, str) and role:
        node["role"] = role
    else:
        node["role"] = TYPE_ROLE.get(node_type, "textbox")
    if rect_offscreen or offscreen_hint:
        node["offscreen"] = True
    return node


def _artifact_keys(node: dict[str, Any]) -> dict[str, Any]:
    """Keep only contract keys, dropping bridge noise."""
    allowed = {
        "nodeId", "label", "displayLabel", "type", "value", "checked", "rect",
        "offscreen", "role", "source", "actions",
    }
    return {key: value for key, value in node.items() if key in allowed}


def _from_canonical(raw: dict[str, Any], source: str) -> list[dict[str, Any]]:
    nodes = []
    for index, node in enumerate(raw.get("nodes") or []):
        if not isinstance(node, dict):
            raise NormalizationError("nodes must be objects")
        node_type = infer_type(node.get("type"), node.get("role"))
        display = node.get("displayLabel") or node.get("label") or ""
        built = _finish_node(
            source=source,
            index=index,
            label=node.get("label"),
            node_type=node_type,
            rect=node.get("rect"),
            actions=node.get("actions"),
            role=node.get("role"),
            value=node.get("value"),
            checked=node.get("checked"),
            display_label=str(display) if display else None,
            offscreen_hint=bool(node.get("offscreen")),
            provided_id=node.get("nodeId"),
        )
        nodes.append(_artifact_keys(built))
    return nodes


def _from_dom(raw: dict[str, Any], source: str) -> list[dict[str, Any]]:
    nodes = []
    for index, node in enumerate(raw.get("nodes") or raw.get("elements") or []):
        if not isinstance(node, dict):
            continue
        tag = str(node.get("tagName") or node.get("tag") or "").lower()
        input_type = str(node.get("inputType") or node.get("htmlType") or "").lower()
        if tag == "a":
            node_type = "link"
        elif tag == "select":
            node_type = "select"
        elif tag == "textarea":
            node_type = "input"
        elif tag == "button":
            node_type = "button"
        elif tag == "input":
            node_type = infer_type(input_type or node.get("type") or "text")
        else:
            node_type = infer_type(node.get("type"), node.get("role"))
        label = (
            node.get("ariaLabel") or node.get("label") or node.get("placeholder")
            or node.get("name") or node.get("text")
        )
        display = node.get("ariaLabel") or node.get("label") or node.get("text") or (
            node.get("placeholder") or ""
        )
        offscreen = node.get("visible") is False
        nodes.append(
            _artifact_keys(
                _finish_node(
                    source=source,
                    index=index,
                    label=label,
                    node_type=node_type,
                    rect=node.get("rect") or node.get("boundingRect"),
                    actions=node.get("actions"),
                    role=node.get("role"),
                    value=node.get("value"),
                    checked=node.get("checked"),
                    display_label=str(display) if display else None,
                    offscreen_hint=offscreen,
                    provided_id=node.get("id") or node.get("nodeId"),
                )
            )
        )
    return nodes


def _from_accessibility(raw: dict[str, Any], source: str) -> list[dict[str, Any]]:
    nodes = []
    for index, node in enumerate(raw.get("nodes") or raw.get("elements") or []):
        if not isinstance(node, dict):
            continue
        class_name = str(node.get("className") or node.get("class") or "").lower()
        clickable = bool(node.get("clickable") or node.get("isClickable"))
        if any(key in class_name for key in ("edittext", "autocompletetextview")):
            node_type = "input"
        elif any(key in class_name for key in ("checkbox", "switch", "checkedtextview", "radiobutton", "togglebutton")):
            node_type = "checkbox"
        elif any(key in class_name for key in ("spinner", "dropdown")):
            node_type = "select"
        elif "button" in class_name:
            node_type = "button"
        elif "textview" in class_name:
            node_type = "link" if clickable else "input"
        else:
            node_type = "input" if node.get("editable") or node.get("isEditable") else (
                "link" if clickable else "input"
            )
        humanized = _humanize_view_id(str(node.get("viewIdResourceName") or ""))
        if node_type == "input":
            # `text` is the field *value* on EditText; labels come from a11y metadata.
            label = (
                node.get("contentDescription") or node.get("hintText") or node.get("hint")
                or humanized or node.get("text")
            )
            display = (
                node.get("contentDescription") or node.get("hintText") or node.get("text")
            )
            value = node.get("text") or node.get("value")
        else:
            label = (
                node.get("text") or node.get("contentDescription") or node.get("hintText")
                or humanized
            )
            display = node.get("text") or node.get("contentDescription") or node.get("hintText")
            value = node.get("value")
        nodes.append(
            _artifact_keys(
                _finish_node(
                    source=source,
                    index=index,
                    label=label,
                    node_type=node_type,
                    rect=node.get("bounds") or node.get("rect"),
                    actions=node.get("actions"),
                    role=node.get("role"),
                    value=value if isinstance(value, str) else None,
                    checked=node.get("isChecked", node.get("checked")),
                    display_label=str(display) if display else None,
                    offscreen_hint=node.get("visibleToUser") is False,
                    provided_id=node.get("nodeId") or node.get("viewIdResourceName"),
                )
            )
        )
    return nodes


def _from_vision(raw: dict[str, Any], source: str) -> list[dict[str, Any]]:
    nodes = []
    for index, node in enumerate(raw.get("elements") or raw.get("nodes") or []):
        if not isinstance(node, dict):
            continue
        kind = str(node.get("kind") or node.get("type") or node.get("role") or "").lower()
        node_type = _VISION_KINDS.get(kind) or infer_type(node.get("type"), node.get("role"))
        label = node.get("text") or node.get("label") or node.get("contentDescription")
        nodes.append(
            _artifact_keys(
                _finish_node(
                    source=source,
                    index=index,
                    label=label,
                    node_type=node_type,
                    rect=node.get("bbox") or node.get("rect") or node.get("bounds"),
                    actions=node.get("actions"),
                    role=node.get("role"),
                    value=node.get("value"),
                    checked=node.get("checked"),
                    display_label=str(label) if label else None,
                    offscreen_hint=node.get("visible") is False,
                    provided_id=node.get("nodeId") or node.get("id"),
                )
            )
        )
    return nodes


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

_ADAPTERS = {
    "dom": _from_dom,
    "accessibility": _from_accessibility,
    "vision": _from_vision,
}

_CANONICAL_REQUIRED = {"label", "type", "actions", "rect"}


def _looks_canonical(raw: dict[str, Any]) -> bool:
    nodes = raw.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        return False
    return all(isinstance(node, dict) and _CANONICAL_REQUIRED <= set(node) for node in nodes)


def _detect_source(raw: dict[str, Any], source: str | None) -> str:
    candidate = (source or raw.get("source") or "").strip().lower()
    if candidate:
        if candidate in _ADAPTERS:
            return candidate
        raise NormalizationError(
            f"unsupported source {candidate!r}; expected one of {sorted(_ADAPTERS)}"
        )
    nodes = raw.get("nodes") or raw.get("elements") or []
    first = nodes[0] if isinstance(nodes, list) and nodes and isinstance(nodes[0], dict) else {}
    if "viewIdResourceName" in first or "isClickable" in first or "bounds" in first:
        return "accessibility"
    if "bbox" in first or "kind" in first:
        return "vision"
    if "tagName" in first or "placeholder" in first or "ariaLabel" in first:
        return "dom"
    raise NormalizationError(
        "cannot determine snapshot source; pass source='dom'|'accessibility'|'vision'"
    )


def normalize_snapshot(
    raw: dict[str, Any] | None,
    *,
    source: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Normalize any bridge payload into a contract-valid `FormSnapshot`."""
    if raw is None:
        raise NormalizationError("snapshot is required")
    if not isinstance(raw, dict):
        raise NormalizationError("snapshot must be an object")

    resolved_source = _detect_source(raw, source)
    if resolved_source not in _ADAPTERS:  # pragma: no cover - defensive
        raise NormalizationError(
            f"unsupported source {resolved_source!r}; expected one of {sorted(_ADAPTERS)}"
        )
    nodes = (
        _from_canonical(raw, resolved_source)
        if _looks_canonical(raw)
        else _ADAPTERS[resolved_source](raw, resolved_source)
    )

    snapshot: dict[str, Any] = {
        "source": resolved_source,
        "capturedAt": _iso_timestamp(raw.get("capturedAt") or raw.get("captured_at")),
        "title": normalize_text(
            raw.get("title") or raw.get("windowTitle") or raw.get("pageTitle") or ""
        ),
        "nodes": nodes,
    }
    sid = session_id or raw.get("sessionId")
    if sid:
        snapshot["sessionId"] = str(sid)
    url = raw.get("url") or raw.get("href")
    if isinstance(url, str) and url.strip():
        snapshot["url"] = url.strip()

    try:
        contracts.validate("form-context", snapshot)
    except ContractError as exc:
        raise NormalizationError(f"normalized snapshot violates the contract: {exc}") from exc

    log.debug(
        "snapshot normalized",
        extra={
            "source": resolved_source,
            "nodeCount": len(nodes),
            "offscreenCount": sum(1 for node in nodes if node.get("offscreen")),
        },
    )
    return snapshot


def normalize_nodes(nodes: Sequence[dict], *, source: str = "dom") -> list[dict[str, Any]]:
    """Normalize bare nodes (used by tests and by bridges sending partial context)."""
    return normalize_snapshot(
        {"source": source, "nodes": list(nodes), "capturedAt": None}, source=source
    )["nodes"]
