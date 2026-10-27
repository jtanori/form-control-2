"""Contract loading / validation helpers for `/contracts/v1/`.

Single entry point so CORE-001 (tool schema + output validation), CORE-003
(SessionState) and CORE-004 (normalized FormSnapshot) can never drift from the
schemas on disk.
"""

from __future__ import annotations

import copy
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

CONTRACTS_DIR = Path(__file__).resolve().parents[2] / "contracts" / "v1"
BASE_URI = "https://form-control.dev/contracts/v1"

SCHEMA_FILES = {
    "form-context": CONTRACTS_DIR / "form-context.schema.json",
    "command": CONTRACTS_DIR / "command.schema.json",
}

#: Local prefix used for `form-context` definitions when inlined into a tool schema.
CONTEXT_DEF_PREFIX = "ctx_"

_REF_RE = re.compile(
    re.escape(BASE_URI) + r"/(?P<doc>form-context|command)\.schema\.json#/\$defs/(?P<def>\w+)"
)
_DOC_FOR_KEY = {"form-context": "form-context", "command": "command"}


class ContractError(RuntimeError):
    """Raised when a payload violates the v1 contract."""


@lru_cache(maxsize=1)
def _schemas() -> dict[str, dict[str, Any]]:
    schemas: dict[str, dict[str, Any]] = {}
    for name, path in SCHEMA_FILES.items():
        with path.open(encoding="utf-8") as fh:
            schemas[name] = json.load(fh)
    return schemas


@lru_cache(maxsize=1)
def _registry() -> Registry:
    registry: Registry = Registry()
    for schema in _schemas().values():
        resource = Resource.from_contents(schema)
        registry = registry.with_resource(schema["$id"], resource)
    return registry


def schema(name: str) -> dict[str, Any]:
    try:
        return _schemas()[name]
    except KeyError as exc:  # pragma: no cover - programmer error
        raise KeyError(f"unknown contract schema {name!r}; known: {sorted(_schemas())}") from exc


def validator(name: str) -> Draft202012Validator:
    @lru_cache(maxsize=None)
    def _build(key: str) -> Draft202012Validator:
        return Draft202012Validator(
            _schemas()[key], registry=_registry(), format_checker=FormatChecker()
        )

    return _build(name)


def validate(name: str, payload: Any) -> Any:
    """Validate `payload`; raises :class:`ContractError` with a readable path."""
    errors = sorted(validator(name).iter_errors(payload), key=lambda err: list(err.path))
    if errors:
        first = errors[0]
        path = "$" + "".join(f"[{p}]" if isinstance(p, int) else f".{p}" for p in first.path)
        raise ContractError(f"{name} violation at {path}: {first.message}")
    return payload


def is_valid(name: str, payload: Any) -> bool:
    return validator(name).is_valid(payload)


def defs(name: str) -> dict[str, Any]:
    return schema(name).get("$defs", {})


def _local_id(doc: str, key: str) -> str:
    return key if doc == "command" else f"{CONTEXT_DEF_PREFIX}{key}"


def command_tool_schema() -> dict[str, Any]:
    """Self-contained `emit_commands` parameters for OpenAI function calling.

    Tool schemas cannot reference external documents, so the definitions
    reachable from `command.schema.json` are inlined and every cross-document
    `$ref` is rewritten to a local pointer. Command items remain exactly
    `command.schema.json#/$defs/command`.
    """
    pools = {name: copy.deepcopy(defs(name)) for name in SCHEMA_FILES}
    needed: dict[str, dict[str, Any]] = {}
    pending: list[tuple[str, str]] = [("command", key) for key in pools["command"]]

    while pending:
        doc, key = pending.pop()
        local = _local_id(doc, key)
        if local in needed:
            continue
        body = pools.get(doc, {}).get(key)
        if body is None:  # pragma: no cover - dangling reference
            continue
        needed[local] = body
        for match in _REF_RE.finditer(json.dumps(body)):
            pending.append((match.group("doc"), match.group("def")))

    def _rewrite(node: Any) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str):
                match = _REF_RE.match(ref)
                if match:
                    node["$ref"] = f"#/$defs/{_local_id(match.group('doc'), match.group('def'))}"
            return {key: _rewrite(value) for key, value in node.items()}
        if isinstance(node, list):
            return [_rewrite(item) for item in node]
        return node

    return _rewrite(
        {
            "type": "object",
            "required": ["commands"],
            "additionalProperties": False,
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {"$ref": "#/$defs/command"},
                },
                "needsClarification": {"type": "boolean", "default": False},
                "clarificationQuestion": {"type": "string"},
                "candidateNodeIds": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "nodeIds the question refers to, when clarification is requested."
                    ),
                },
            },
            "$defs": needed,
        }
    )


def main() -> int:
    """`python -m core.lib.contracts` — validate every mock payload (CI hook)."""
    mocks = sorted((CONTRACTS_DIR / "mocks").glob("*.json"))
    if not mocks:
        print("no mocks found")
        return 1
    failures = 0
    for path in mocks:
        payload = json.loads(path.read_text(encoding="utf-8"))
        stem = path.stem
        if stem.startswith(("command", "clarification")):
            name = "command"
        elif stem.startswith(("form-snapshot", "session-state")):
            name = "form-context"
        else:
            print(f"SKIP {path.name} (no schema mapping)")
            continue
        try:
            validate(name, payload)
        except ContractError as exc:
            print(f"FAIL {path.name}: {exc}")
            failures += 1
        else:
            print(f"OK   {path.name} -> {name}")
    return 1 if failures else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
