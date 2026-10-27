# CORE-001 — Intent Parser Endpoint

- **Phase:** 1 — The Brain: NLU, Ambiguity, Session (Week 1–2)
- **Track / Agent:** Agent A — Backend / AI (Stream A Lead)
- **Priority:** P0
- **Status:** done (Phase 1 PR)
- **Depends on:** CONTRACT-001; STT-001 for integration (parser itself runs with mock text)
- **Parallel with:** EXT-001, AND-001, DES-001 (they use the schema, not the running parser)
- **Critical path:** Yes
- **Milestone gates:** G2
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/5
- **GitHub labels:** `backlog`, `phase-1`, `P0`, `agent-backend`, `critical-path`
- **GitHub milestone:** Phase 1 — Core NLU

## Objective

Turn a transcript + form context into structured `Command[]` using LLM function calling, with ambiguity detection instead of guessing.

## Specification

- **File:** `/core/nlu/parser.py`
- **Endpoint:** `POST /api/v1/parse`
- **Input:**

```json
{
  "sessionId": "string",
  "transcript": "fill the email with test@example.com and click submit",
  "context": { "FormSnapshot": "..." },
  "history": ["Command (optional)"]
}
```

- **Process:**
  - Build messages array; system prompt loaded from `/core/prompts/form-control-v1.md`.
  - Prompt rules (must include, verbatim in spirit):
    1. Always prefer explicit labels over index.
    2. If ambiguous (>1 match), ask clarification — never guess.
    3. Never invent values not present in the transcript.
  - Model: OpenAI `gpt-4o` (or Claude 3.5 Sonnet) with **function calling / tool use**: `tools=[{type:"function", function:{name:"emit_commands", parameters: <command.schema.json>}}]`.
- **Output:**

```json
{
  "sessionId": "string",
  "commands": ["Command"],
  "needsClarification": false,
  "clarificationQuestion": "optional string"
}
```

- Structured logging (INFR-002) on every parse: `sessionId`, transcript length, command count, model used, latency.

## Files & deliverables

- `/core/nlu/parser.py`
- `/core/prompts/form-control-v1.md`
- `/core/tests/test_parser.py` — the 20-utterance suite
- Uses `/contracts/v1/command.schema.json` for tool schema + output validation

## Acceptance criteria

- [x] 20 test utterances (fill, click, select, navigate, ambiguous "submit") mapped correctly >90% of the time.
- [x] Ambiguous utterances return `needsClarification=true` with a question instead of a guessed command.
- [x] Output validates against `command.schema.json`.
- [x] Runs end-to-end with mock text (no STT dependency).

## Handoffs

- **Input ←** CONTRACT-001 (schemas), INFR-002 (logging), STT-001 transcripts (integration).
- **Output →** CORE-002 appends clarification turns; EXT-006 `PARSE` handler consumes response shape; AND-004 consumes it; DES-004 consumes it.
- **Interface freeze:** The output JSON above is consumed by 3 clients — changing it requires updating EXT-006, AND-004, DES-004 specs.
