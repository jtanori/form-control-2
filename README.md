# form-control-2 — VoiceForm Universal

Voice-controlled universal form filling: **Core (FastAPI + LLM/NLU)** + **Browser Extension (MV3)** + **Android AccessibilityService**, with an optional desktop native daemon.

## 🗂 Backlog

The full zero-to-MVP backlog lives in [`backlog/`](backlog/README.md):

- **27 spec'd items** across 6 phases — each with file paths, APIs, interfaces, acceptance criteria, and explicit handoffs.
- **GitHub issues #1–#27** mirror the files 1:1, labeled by phase (`phase-0`…`phase-5`), priority (`P0`/`P1`/`P2`), agent track (`agent-*`), and `critical-path`.
- **Milestones:** Phase 0 — Infra · Phase 1 — Core NLU · Phase 2 — Browser · Phase 3 — Android · Phase 4 — Desktop · Phase 5 — MVP Gate.

**Critical path (do not split):**
`INFR-001 → CONTRACT-001 → CORE-001 → EXT-002 → EXT-003 → EXT-006 → INTE-001 → REL-001`

**MVP = gates G1 + G2 + G3 + G4** (voice input → parsed commands → browser form filled → Android form filled). G5 (desktop native) is stretch.

Start here: [backlog/README.md](backlog/README.md) — see "Coding Agent Takeaway List" for your track.

## ✅ Implemented so far

**Phase 1 — Core NLU** (the brain) is in: transcript + form context → validated
`Command[]`, ambiguity handling, sessions and a bridge-agnostic normalizer.

| Ticket | Delivered | Where |
|---|---|---|
| CORE-001 | `POST /api/v1/parse` — label-first resolution, clarification instead of guessing, no invented values | [`core/nlu/parser.py`](core/nlu/parser.py), [`core/prompts/`](core/prompts) |
| CORE-002 | `POST /api/v1/clarify` — persisted ambiguity, candidates only, replayed commands | [`core/nlu/clarify.py`](core/nlu/clarify.py) |
| CORE-003 | `GET /api/v1/session/{id}` — snapshot, bounded history, active node, form steps; Redis or in-memory | [`core/session/`](core/session) |
| CORE-004 | One `FormSnapshot` for DOM / accessibility / vision bridges | [`core/adapters/normalizer.py`](core/adapters/normalizer.py) |
| CONTRACT-001 | `FormSnapshot`, `FormNode`, `Command`, `ClarificationRequest`, `SessionState` schemas + mocks | [`contracts/v1/`](contracts/v1) |
| INFR-002 | Structured JSON logs with a correlated `sessionId` | [`core/lib/logging_config.py`](core/lib/logging_config.py) |

CI (GitHub Actions) runs lint (`compileall` + `pyflakes`), the full test suite and
the contract-mock validation on every PR — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Quickstart

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt   # requirements.txt alone = rule provider only
.venv/bin/python -m pytest                       # 130 tests, offline
.venv/bin/python -m uvicorn core.main:app --host 0.0.0.0 --port 8020
curl -s localhost:8020/api/v1/health
```

No API key needed: `NLU_PROVIDER=auto` falls back to the deterministic rule
provider. Set `OPENAI_API_KEY` (and optionally `NLU_PROVIDER=openai`) to use
`gpt-4o` function calling. Session storage uses `REDIS_URL` when available and an
in-memory store otherwise.

Full endpoint reference, request/response examples and the parser safety rules:
[docs/core-api.md](docs/core-api.md).
