# AND-005 — Android Context Sender to Core (Unified Session)

- **Phase:** 3 — Android Universal Bridge (Week 2–4)
- **Track / Agent:** Agent C — Mobile / Kotlin
- **Priority:** P1
- **Status:** ready
- **Depends on:** CONTRACT-001
- **Parallel with:** AND-004
- **Critical path:** No
- **Milestone gates:** G4

## Objective

HTTP client that sends `{sessionId, transcript, context}` to Core and handles `ClarificationRequest`, with a deterministic MVP session identity.

## Specification

- **File:** `/android/app/src/main/java/com/voiceform/network/CoreClient.kt`
- Endpoint base: `http://localhost:8020` (core on-device via Termux/local server) **or** LAN IP — configurable.
- Sends `{sessionId, transcript, context: FormSnapshot}` to `POST /api/v1/parse`.
- Handles `ClarificationRequest` responses (route to AND-004 confirmation/clarify UI).
- MVP `sessionId = deviceId + windowHash` (documented as provisional — see INTE-002).

## Acceptance criteria

- [ ] Round-trip parse works against local Core and LAN Core.
- [ ] Clarification responses surface in the overlay.
- [ ] `sessionId` stable across consecutive commands in the same window; changes when window changes (MVP rule).
- [ ] Logs carry `sessionId` (INFR-002 pattern).

## Handoffs

- **Input ←** CONTRACT-001, CORE-001/002 endpoints.
- **Output →** INTE-002 (sessionId format feeds the sync protocol doc), CORE-003 (receives sessions).
