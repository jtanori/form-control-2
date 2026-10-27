# CORE-002 — Clarification / Ambiguity Resolver

- **Phase:** 1 — The Brain: NLU, Ambiguity, Session (Week 1–2)
- **Track / Agent:** Agent A — Backend / AI
- **Priority:** P0
- **Status:** done (Phase 1 PR)
- **Depends on:** CORE-001
- **Parallel with:** CORE-003, CORE-004
- **Critical path:** No (but required for G2)
- **Milestone gates:** G2
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/6
- **GitHub labels:** `backlog`, `phase-1`, `P0`, `agent-backend`
- **GitHub milestone:** Phase 1 — Core NLU

## Objective

Close the ambiguity loop: when the parser can't decide, persist the pending ambiguity in the session, ask the user, and resolve their answer into a concrete `nodeId`.

## Specification

- **File:** `/core/nlu/clarify.py`
- When parser returns `needsClarification=true`, store clarification state in Redis under the session key (coordinate key naming with CORE-003: `session:{sessionId}`).
- **Endpoint:** `POST /api/v1/clarify`
  - **Input:** `{sessionId, clarificationText}`
  - **Process:** Feed back into parser with appended context: previous ambiguity + messages get `User clarification: "{text}"` appended.
  - **Output:** same shape as `POST /api/v1/parse` (commands now resolved, `needsClarification=false`).
- State cleared once resolved or session expires.

## Acceptance criteria

- [x] Given "click submit" with 2 submit nodes → asks clarification.
- [x] After "billing submit" → resolves to the correct `nodeId`.
- [x] Clarification state survives a round-trip through Redis.
- [x] Client flow works: EXT-006 `CLARIFY` message (browser) and AND-004 confirmation card (mobile) both drive this endpoint.

## Handoffs

- **Input ←** CORE-001 (ambiguity output), CORE-003 (session storage).
- **Output →** EXT-006 `CLARIFY`, AND-004 "Cancel asks for clarification", popup clarification UI (EXT-004).
