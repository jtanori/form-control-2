# CORE-003 — Session & Multi-Form State Manager

- **Phase:** 1 — The Brain: NLU, Ambiguity, Session (Week 1–2)
- **Track / Agent:** Agent A — Backend / AI
- **Priority:** P1 (MVP can ship with an in-memory dict, but the spec is required now for navigation)
- **Status:** ready
- **Depends on:** CONTRACT-001
- **Parallel with:** CORE-002, CORE-004, EXT-003, EXT-005
- **Critical path:** No (required for G3)
- **Milestone gates:** G3
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/7
- **GitHub labels:** `backlog`, `phase-1`, `P1`, `agent-backend`
- **GitHub milestone:** Phase 1 — Core NLU

## Objective

Hold per-session state — last form snapshot, command history, active node, and detected form steps — so multi-step forms and "go back" work.

## Specification

- **File:** `/core/session/store.py`
- **`SessionStore` interface** backed by Redis (in-memory fallback implementing the same interface for dev/tests).
- **Key:** `session:{sessionId}` storing a `SessionState` (CONTRACT-001):
  - `currentContextSnapshot` — last extracted form
  - `history: Command[]`
  - `currentActiveNodeId`
  - `formSteps: string[]` — detected via button text patterns: "Next", "Previous", "Step X"
- **Endpoint:** `GET /api/v1/session/{id}` — clients fetch current state before sending a command.
- TTL/eviction policy: document (suggested 30 min idle).

## Acceptance criteria

- [ ] Session survives 5 sequential commands (history intact).
- [ ] "go back" finds a button with text "Back/Previous" and adds it to the command queue.
- [ ] `GET /api/v1/session/{id}` returns the CONTRACT-001 `SessionState` shape.
- [ ] In-memory and Redis backends are interchangeable behind `SessionStore`.

## Handoffs

- **Input ←** CONTRACT-001 (`SessionState`), INFR-001 (redis service), CORE-004 (normalized snapshots to store).
- **Output →** CORE-001 (history), CORE-002 (clarification state), EXT-006/AND-005 (fetch state), INTE-002 (sync protocol drafts from this design).
