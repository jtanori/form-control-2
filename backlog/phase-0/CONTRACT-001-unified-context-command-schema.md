# CONTRACT-001 — Unified Context & Command Schema

- **Phase:** 0 — Contracts, Infra & Skeleton (Week 1)
- **Track / Agent:** Agent A — Backend / AI
- **Priority:** P0
- **Status:** ready
- **Depends on:** INFR-001 (folder scaffold)
- **Parallel with:** STT-001, INFR-002
- **Critical path:** Yes — blocks CORE-001 and every client extractor
- **Milestone gates:** G2
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/1
- **GitHub labels:** `backlog`, `phase-0`, `P0`, `agent-backend`, `critical-path`
- **GitHub milestone:** Phase 0 — Infra

## Objective

Define the single data contract shared by browser, Android, desktop, and core: `FormSnapshot`, `FormNode`, `Command`, `ClarificationRequest`, `SessionState`. This prevents integration failure when agents merge code in parallel.

## Specification

Files:

- `/contracts/v1/form-context.schema.json` — `FormSnapshot`, `FormNode`, `SessionState`
- `/contracts/v1/command.schema.json` — `Command`, `ClarificationRequest`
- `/contracts/v1/mocks/` — valid mock payloads for each schema (used by tests)

### `FormNode` (normative)

```json
{
  "nodeId": "b2",
  "label": "Email address",
  "type": "input|button|checkbox|select|link",
  "value": "optional",
  "checked": "optional bool",
  "rect": { "x": 0, "y": 0, "w": 0, "h": 0 },
  "role": "textbox",
  "source": "dom|accessibility|vision",
  "actions": ["fill", "click", "check", "uncheck", "navigate", "clear"]
}
```

### `Command` (normative)

```json
{
  "action": "fill|click|check|uncheck|navigate|clear",
  "target": { "label": "optional", "nodeId": "optional", "index": "optional", "rect": "optional" },
  "value": "optional string",
  "confirmRequired": "optional bool"
}
```

### `FormSnapshot` (contract addition — normative)

```json
{
  "sessionId": "optional",
  "source": "dom|accessibility|vision",
  "capturedAt": "ISO-8601",
  "title": "page/window title",
  "url": "optional (browser/desktop)",
  "nodes": ["FormNode"]
}
```

### `ClarificationRequest` (contract addition — normative)

```json
{
  "sessionId": "string",
  "question": "Which submit button do you mean?",
  "candidates": ["FormNode"],
  "previousTranscript": "optional",
  "ambiguity": "optional description"
}
```

### `SessionState` (contract addition — normative)

```json
{
  "sessionId": "string",
  "currentContextSnapshot": "FormSnapshot | null",
  "history": ["Command"],
  "currentActiveNodeId": "optional string",
  "formSteps": ["Next", "Previous", "Step 2"]
}
```

## Acceptance criteria

- [ ] All downstream specs (EXT-002, EXT-003, AND-002, AND-003, DES-002, DES-003, CORE-001…004) reference these files as the source of truth.
- [ ] `jsonschema.validate(...)` passes on every mock payload in `/contracts/v1/mocks/`.
- [ ] Schemas are strict enough to catch a wrong `action` or missing `target`, loose enough for optional fields.
- [ ] CI validates mocks against schemas.

## Handoffs

- **Input ←** INFR-001 provides `/contracts/v1/`.
- **Output →** CORE-001 (parse input/output), CORE-003 (SessionState), CORE-004 (normalization target), EXT-002/AND-002/DES-002 (extraction output), EXT-003/AND-003/DES-003 (Command consumption).
- **Rule:** Any change to these schemas requires updating every referencing spec in this backlog in the same PR.
