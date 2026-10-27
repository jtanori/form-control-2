# EXT-004 — Voice Capture & Popup UI

- **Phase:** 2 — Browser Bridge (Week 2–3)
- **Track / Agent:** Agent B — Extension / Frontend
- **Priority:** P0
- **Status:** ready
- **Depends on:** STT-001 (actual transcription), CORE-001 (response structure; mockable)
- **Parallel with:** EXT-003, EXT-005
- **Critical path:** No (required for G1)
- **Milestone gates:** G1, G3

## Objective

The user-facing surface: record speech, show the transcript, present parsed commands for Confirm / Edit / Cancel, and dispatch execution.

## Specification

- **Directory:** `/extensions/browser/src/popup/` — single-page React/Vite component.
- **Flow:**
  1. User clicks mic button.
  2. `navigator.mediaDevices.getUserMedia({audio:true})`; `MediaRecorder` records `audio/webm` → `Blob`.
  3. On stop: `chrome.runtime.sendMessage({type:"TRANSCRIBE", blob})` (background uploads to STT).
  4. Background sends transcript + current context to Core (`POST /api/v1/parse`).
  5. Popup displays returned commands as a list with **Confirm / Edit / Cancel** buttons.
  6. On Confirm: `chrome.runtime.sendMessage({type:"EXECUTE", commands})`.
  7. If `needsClarification`, show the question with a text input → `CLARIFY` message.
- **Design spec:** minimal floating card; dark mode support; transcript scroll area; command cards show `label: value`.

## Acceptance criteria

- [ ] Records clearly; waveform or recording-state indicator present.
- [ ] Displays parsed command cards from a real (or mocked) parse response.
- [ ] Confirm dispatches execution; Edit mutates `value` pre-dispatch; Cancel discards.
- [ ] Clarification question renders when returned.
- [ ] Dark mode readable.

## Handoffs

- **Input ←** STT-001 (`/stt/transcribe`), CORE-001 (parse), EXT-006 (transport messages).
- **Output →** EXT-006 (`TRANSCRIBE`/`PARSE`/`EXECUTE`/`CLARIFY` messages are the contract with background).
