# DES-004 — Desktop Voice Client / Bridge

- **Phase:** 4 — Desktop Native Agent (Week 3–4)
- **Track / Agent:** Agent D — Desktop / Python
- **Priority:** P2
- **Status:** ready
- **Depends on:** DES-003, CORE-001
- **Parallel with:** EXT-006 (bridge pattern)
- **Critical path:** No
- **Milestone gates:** G5

## Objective

Desktop voice loop (record → core → execute), plus an optional WebSocket so the desktop daemon can act as a **remote executor** for browser commands.

## Specification

- **File:** `/desktop/daemon/voice_client.py`
- Records via `pyaudio` **or** delegates to STT service; sends audio to `POST /stt/transcribe`.
- Sends `{sessionId, transcript, context}` to `POST /api/v1/parse`; receives commands; executes via DES-003.
- **Remote executor mode:** listens on `ws://localhost:8021` so the browser extension can hand off commands to desktop apps (extension on laptop → control native desktop window).
- Confirmation prompt required before `click`/`fill`-with-submit (parity with popup/overlay flows).

## Acceptance criteria

- [ ] Voice controls at least one native desktop form (G5 gate).
- [ ] `ws://localhost:8021` accepts a command JSON from a test client and executes it.
- [ ] Confirmation gating matches EXT-004/AND-004 behavior.

## Handoffs

- **Input ←** DES-003, STT-001, CORE-001/002, EXT-006 (optional WS contract — document message shape in `/docs/session-sync.md` alongside INTE-002).
- **Output →** REL-001 packaging notes (desktop daemon is a Phase 4/stretch artifact).
