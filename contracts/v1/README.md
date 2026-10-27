# Contracts v1 — data contract (source of truth)

Everything that crosses a process boundary between core and a client lives here.

| File | Contents |
|---|---|
| [`form-context.schema.json`](form-context.schema.json) | `formSnapshot`, `formNode`, `sessionState`, `rect` |
| [`command.schema.json`](command.schema.json) | `command`, `commandTarget`, `clarificationRequest` |
| [`mocks/`](mocks/) | Valid payloads used by tests and as client fixtures |

## Rules

- **`/contracts/v1/` is normative.** Any change here requires updating every backlog item
  that references these schemas (CONTRACT-001 handoff rule).
- Clients may send **raw** snapshots (e.g. extra DOM fields); `core/adapters/normalizer.py`
  (CORE-004) is the only layer allowed to transform them. Payloads that are already
  normalized and claimed as canonical MUST validate.
- Never send `null` for labels: unknown label = `""` (plus `nodeId`).
- `label` is **canonical/normalized** (lowercase, trimmed, collapsed whitespace, decorative
  punctuation stripped). `displayLabel` (optional) keeps the original casing for UI use.

## Node ids

| Source | Prefix | Example |
|---|---|---|
| browser / DOM | `b` | `b2` |
| Android accessibility | `a` | `a5` |
| desktop | `d` | `d1` |
| vision | `v` | `v3` |

Ids are deterministic (1-based index within the snapshot) when the source does not supply one.

## Validating

```python
from core.lib.contracts import validator

validator("command").validate(payload)      # raises jsonschema.ValidationError
validator("form-context").validate(payload)
```

CLI (also used by CI):

```bash
python -m core.lib.contracts            # validates every file in contracts/v1/mocks
```
