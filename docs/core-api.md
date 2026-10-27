# Core API — Phase 1 (CORE-001 … CORE-004)

The "brain": transcript + form context → validated `Command[]`, with ambiguity
handling and per-session state. Implementation lives in [`core/`](../core), the
data contract in [`contracts/v1/`](../contracts/v1).

```
transcript ──┐
             ├─► CORE-004 normalizer ─► CORE-001 parser ─► Command[] ─► clients
bridge ctx ──┘                              │  ▲
                                            ▼  │
                                   CORE-002 clarify ── CORE-003 session store
```

## Run it

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt   # incl. openai
# rule-provider-only deploy:  pip install -r requirements.txt
.venv/bin/python -m uvicorn core.main:app --host 0.0.0.0 --port 8020
.venv/bin/python -m pytest              # 130 tests, no network needed
```

`NLU_PROVIDER=auto` (default) uses OpenAI when `OPENAI_API_KEY` is set and the
deterministic rule provider otherwise, so the service and its tests always run
offline.

| Env | Default | Purpose |
|---|---|---|
| `CORE_HOST` / `CORE_PORT` | `127.0.0.1` / `8020` | bind address |
| `REDIS_URL` | `redis://localhost:6379/0` | session store; falls back to in-memory when unreachable (re-probed every 30 s, the live fallback is never discarded) |
| `SESSION_TTL_SECONDS` | `1800` | idle TTL for `session:{id}` (and its clarification) |
| `NLU_PROVIDER` | `auto` | `auto` / `rule` / `openai` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | – / `gpt-4o` | live LLM function calling |
| `HISTORY_LIMIT` | `200` | commands retained per session |
| `LOG_LEVEL` | `INFO` | JSON log level |

## Endpoints

### `GET /api/v1/health`

```json
{"status":"ok","version":"0.1.0","provider":"rule-v1","sessionBackend":"memory"}
```

### `POST /api/v1/parse` — CORE-001

```json
{
  "sessionId": "sess-1",
  "transcript": "fill the email address with test@example.com and click submit",
  "context": { "source": "dom", "title": "Checkout", "nodes": [ ... ] },
  "history": []
}
```

`context` accepts a canonical `FormSnapshot`, a raw bridge payload (CORE-004
normalizes it) or the `{"FormSnapshot": {...}}` envelope. `history` is optional
— the session's stored history is used when omitted.

```json
{
  "sessionId": "sess-1",
  "commands": [
    {"action": "fill", "target": {"label": "email address", "nodeId": "b1"}, "value": "test@example.com"},
    {"action": "click", "target": {"label": "submit billing", "nodeId": "b5"}, "confirmRequired": true}
  ],
  "needsClarification": false,
  "clarificationQuestion": null,
  "clarification": null,
  "model": "rule-v1"
}
```

Ambiguous utterance → **no commands** (they are held in the session and replayed
after clarification) plus:

```json
{
  "needsClarification": true,
  "clarificationQuestion": "Which button do you mean: submit billing or submit shipping?",
  "clarification": {
    "sessionId": "sess-1",
    "question": "Which button do you mean: submit billing or submit shipping?",
    "candidates": [ { "nodeId": "b5", ... }, { "nodeId": "b6", ... } ],
    "previousTranscript": "click submit",
    "ambiguity": "provider"
  }
}
```

### `POST /api/v1/clarify` — CORE-002

```json
{ "sessionId": "sess-1", "clarificationText": "billing submit" }
```

Returns the same shape as `/parse`, with the replayed commands and
`needsClarification: false`. The answer is matched against the stored candidates
only.

| Status | Meaning |
|---|---|
| `200` | resolved (or re-asks: `needsClarification: true` with the same candidates) |
| `400` | `clarificationText` is empty/whitespace |
| `409` | nothing pending for this session |

**Lifecycle:** pending clarification is cleared as soon as it is resolved, and a
later *successful* `/parse` on the same session supersedes (clears) it — a stale
question can never be answered against an old snapshot. Abandoned questions
expire with the session TTL.

### `GET /api/v1/session/{id}` — CORE-003

Returns the contract's `SessionState`; unknown sessions return an empty state
(`currentContextSnapshot: null`, empty `history`, empty `formSteps`).

```json
{
  "sessionId": "sess-1",
  "currentContextSnapshot": { "source": "dom", "title": "Checkout", "nodes": [ ... ] },
  "history": [ { "action": "fill", ... } ],
  "currentActiveNodeId": "b5",
  "formSteps": ["Next", "Back"]
}
```

### `POST /api/v1/context/normalize` — CORE-004

Accepts any raw bridge payload and returns `{"snapshot": FormSnapshot}`. `422`
when the source is missing, unsupported (`desktop` is not part of v1) or the
result would violate the contract. `/parse` runs the same normalizer
automatically, so bridges may post raw payloads directly to it.

## Parser safety rules (enforced in code, not only in the prompt)

1. **Labels before indices** — a target resolves by label; `index` is only used
   when the user explicitly says "the second …".
2. **Ambiguity never guesses** — more than one equally good node ⇒ clarification.
3. **No invented values** — a `fill` value must occur verbatim in the transcript,
   otherwise the command is dropped and the user is asked.
4. Every emitted command and clarification validates against
   `contracts/v1/command.schema.json`; invalid model output is discarded.

`confirmRequired: true` is set for submit/pay/purchase/delete/confirm-style
targets so execution layers (EXT-003/AND-003) can insert a confirmation step.

Clarification reasons are explicit (`ambiguity`):

| `ambiguity` | Meaning |
|---|---|
| `provider` | the parser/model reported more than one match |
| `N nodes match the request` | the target text matched several nodes |
| `value not spoken` | the field exists but the value was not said out loud |
| `missing value` | the utterance named a field but no value |
| `no command produced` / `unmatched target` | nothing usable in the transcript |

## Limits

- Request bodies larger than **1 MiB** are rejected with `413` by the logging
  middleware (it buffers bodies only to bind `sessionId`).
- Unknown JSON fields on `/parse` still produce `422` (`extra="forbid"`).

## Normalizer guarantees (CORE-004)

| Bridge | Prefix | Shape handled |
|---|---|---|
| browser DOM | `b` | `tagName`/`inputType`, `ariaLabel`, `rect {left,top,width,height}` |
| Android accessibility | `a` | `className`, `contentDescription`, `bounds "[x1,y1][x2,y2]"` |
| desktop / vision | `v` | `kind`, `bbox [x,y,w,h]` |

Unknown `source` values (including `desktop`) are rejected with `422` — v1 only
accepts `dom` / `accessibility` / `vision`.

- labels: lowercase, trimmed, whitespace collapsed, decorative punctuation gone
  (unknown label ⇒ `""`, never `null`);
- nodeIds deterministic and prefixed per source;
- rects standardized to pixels; zero/offscreen rects clamped and flagged
  `offscreen: true`;
- `actions[]` inferred from `type` when a bridge omits it, and kept in sync with
  the type (a bridge claiming `fill` on a checkbox gets `check`/`uncheck`);
- a payload that merely *looks* canonical still goes through its bridge adapter
  unless every node carries `source` and a pixel `rect`;
- output validates against `contracts/v1/form-context.schema.json`;
- normalization is idempotent.

The three bridge fixtures
(`core/tests/fixtures/bridges/{dom,accessibility,vision}-checkout.json`) normalize
to identical node lists apart from provenance (`source`, `url`) and node-id
prefixes — see `core/tests/test_normalizer.py`.

## Session keys

```
session:{sessionId}                SessionState (CONTRACT-001)
session:{sessionId}:clarification  pending clarification (CORE-002)
```

Clarification state lives in the session namespace and inherits the idle TTL, so
an abandoned question expires with its session. Both backends
(`RedisSessionStore`, `InMemorySessionStore`) are interchangeable behind
`SessionStore`; pick via `REDIS_URL` availability or inject one in tests.

**Redis fallback semantics:** the store is process-wide and re-probes Redis every
30 s. While Redis is down the *same* in-memory store keeps serving requests, so
in-flight sessions and pending clarifications survive the re-probe; once Redis
answers, new requests use it. Read-modify-write cycles (`SessionManager.record`)
are serialized by `SessionStore.lock` within a process — cross-process races
still need Redis `WATCH`/Lua (tracked for INTE-002).

## Logging (INFR-002)

Every log line is JSON with the shared fields `ts`, `level`, `component`,
`sessionId`, `message`. `sessionId` is bound by middleware from the
`X-Session-Id` header or the JSON body and flows through a contextvar, so parse
lines look like:

```json
{"ts":"2026-10-27T12:03:30.072Z","level":"info","component":"core.nlu.parser","sessionId":"demo-1","message":"parse","transcriptLength":53,"commandCount":2,"needsClarification":false,"model":"rule-v1","latencyMs":0.9,"nodeCount":4}
```

## Extending

- `core/nlu/provider.py` — add a provider (e.g. Anthropic) returning
  `ProviderOutput`; the parser applies the safety rules regardless.
- `core/nlu/matching.py` — target resolution/scoring, shared by the parser and
  the clarification resolver.
- `core/adapters/normalizer.py` — add a bridge adapter and a fixture for it.
- Any contract change requires updating every referencing backlog item
  (CONTRACT-001 rule).
