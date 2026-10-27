# INTE-002 — Cross-Platform Session Sync Protocol

- **Phase:** 5 — Integration, Security & MVP Gate (Week 5)
- **Track / Agent:** Agent E — Integration
- **Priority:** P1
- **Status:** ready
- **Depends on:** CONTRACT-001
- **Parallel with:** INTE-001
- **Critical path:** No
- **Milestone gates:** MVP documentation

## Objective

Document the `sessionId` contract across browser/Android/desktop so a future sync feature can be added without breaking clients.

## Specification

- **File:** `/docs/session-sync.md`
- Define `sessionId` format: `{device-type}:{hash}` (aligns with AND-005's `deviceId + windowHash` MVP rule).
- MVP decision (documented, not implemented): **session is local per device**; user must say "start over" on a new device.
- Specify (as future-compatible stub) `POST /api/v1/sync` to merge histories: payload = two `SessionState` objects + merge rule (append histories, last-write-wins on `currentContextSnapshot`).
- Backward compatibility statement: v1 clients ignore `sync` fields.

## Acceptance criteria

- [ ] Document exists with format, examples, and the MVP local-only statement.
- [ ] Protocol spec is backward-compatible for future sync (explicit versioning note).
- [ ] Cross-references CORE-003 keys and AND-005 sessionId rule.

## Handoffs

- **Input ←** CONTRACT-001 (`SessionState`), CORE-003 (store design), AND-005 (client rule).
- **Output →** DES-004 WS message shape also documented here; future sync implementation backlog.
