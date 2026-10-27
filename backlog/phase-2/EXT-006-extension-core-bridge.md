# EXT-006 — Extension ↔ Core Bridge (Background)

- **Phase:** 2 — Browser Bridge (Week 2–3)
- **Track / Agent:** Agent B — Extension / Frontend
- **Priority:** P0
- **Status:** ready
- **Depends on:** CORE-001 spec (mock response OK for development)
- **Parallel with:** EXT-004, EXT-005
- **Critical path:** Yes
- **Milestone gates:** G3

## Objective

The background service worker that owns all I/O: STT upload, Core parse calls, and dispatching commands to the content script — with offline resilience.

## Specification

- **File:** `/extensions/browser/src/background/bridge.ts`
- Maintains `coreUrl = "http://localhost:8020"` (configurable via `storage.sync`).
- **Message handlers:**
  - `TRANSCRIBE` → audio blob to `POST /stt/transcribe`; returns transcript.
  - `PARSE` → `{sessionId, transcript, context}` to `POST /api/v1/parse`; returns commands / clarification.
  - `EXECUTE` → commands to content script via `chrome.tabs.sendMessage(tabId)`.
  - `CLARIFY` → user clarification to `POST /api/v1/clarify`.
- **Offline/Retry:** if Core is down, queue last 2 messages and retry with exponential backoff; surface queue state to popup.
- CORS note: Core must allow the extension origin (document required FastAPI middleware in the contract — coordinate with Agent A).

## Acceptance criteria

- [ ] End-to-end latency from button press to execution **<3s** (local).
- [ ] With Core stopped, next 2 messages queue and flush on recovery.
- [ ] `coreUrl` configurable without rebuild.
- [ ] All bridge logs carry `sessionId` (INFR-002).

## Handoffs

- **Input ←** EXT-004 (messages), CORE-001/002 endpoints, STT-001.
- **Output →** EXT-003 (EXECUTE), INTE-001 (E2E injects via `chrome.runtime.sendMessage`), DES-004 (optional `ws://localhost:8021` mirror pattern).
- **Critical path:** This is the last client-side link before E2E.
