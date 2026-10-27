# INFR-002 — Shared Debug / Logger Library

- **Phase:** 0 — Contracts, Infra & Skeleton (Week 1)
- **Track / Agent:** Agent B — Platform
- **Priority:** P1
- **Status:** ready
- **Depends on:** INFR-001
- **Parallel with:** CONTRACT-001, STT-001
- **Critical path:** No
- **Milestone gates:** Cross-cutting (debuggability for all gates)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/3
- **GitHub labels:** `backlog`, `phase-0`, `P1`, `agent-platform`
- **GitHub milestone:** Phase 0 — Infra

## Objective

A tiny structured-JSON logger available to every core endpoint and every extension module. Required because agents work in parallel; without unified logs, cross-component integration debugging is impossible.

## Specification

- **Python:** `core/lib/logging_config.py`
  - `configure_logging(session_id=None, component="core")` — sets up structured JSON formatter.
  - Every log line: `{ts, level, component, sessionId, message, ...extra}`.
  - FastAPI middleware hooks `sessionId` from request body/headers into `contextvars` so handlers log with it automatically.
- **TypeScript:** `extensions/shared/logger.ts`
  - `createLogger(component: string, sessionId?: string)` → `{debug, info, warn, error}` emitting the same JSON shape to `console`.
- Same field names on both sides so log aggregation can join on `sessionId`.
- Android/Desktop may adopt later; schema documented in `/docs/logging.md`.

## Acceptance criteria

- [ ] Every core endpoint can import `logging_config` and emits logs containing `sessionId`.
- [ ] Every extension module can import `logger.ts` and emits logs containing `sessionId`.
- [ ] Log fields (`ts`, `level`, `component`, `sessionId`, `message`) are identical across Python and TS.
- [ ] One example of a correlated trace: extension log line → core log line with the same `sessionId`.

## Handoffs

- **Input ←** INFR-001 creates `core/lib/` and `extensions/shared/`.
- **Output →** CORE-001…004 wrap endpoints with it; EXT-001…006 log bridge/executor events with it; QA uses it for E2E failure triage.
