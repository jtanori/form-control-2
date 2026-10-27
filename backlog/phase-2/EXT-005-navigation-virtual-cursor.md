# EXT-005 — Navigation / Virtual Cursor Mode

- **Phase:** 2 — Browser Bridge (Week 2–3)
- **Track / Agent:** Agent B — Extension / Frontend
- **Priority:** P1
- **Status:** ready
- **Depends on:** EXT-002
- **Parallel with:** EXT-003, EXT-006
- **Critical path:** No
- **Milestone gates:** G3 (quality)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/13
- **GitHub labels:** `backlog`, `phase-2`, `P1`, `agent-extension`
- **GitHub milestone:** Phase 2 — Browser

## Objective

Speech-driven traversal: "next field", "previous button", "read email" move a visible virtual cursor by index instead of matching labels.

## Specification

- **Files:** `/extensions/browser/src/background/navigation.ts`, `/extensions/browser/src/content/highlight.ts`
- Background listens for messages `"NAV_NEXT"`, `"NAV_PREV"`, `"NAV_READ"`.
- It queries the content script for current context nodes and sends index updates.
- Content script applies `focus()` plus visual highlight:
  ```css
  .voiceform-cursor { outline: 3px solid #00ff88 !important; z-index: 999999; }
  ```
- Commands like "next field", "previous button", "read email" use this index — **not** target matching.
- `NAV_READ` returns the focused node's label/value to the popup (TTS-optional, out of MVP scope).

## Acceptance criteria

- [ ] Voice "next field" moves the highlight sequentially through 10 inputs.
- [ ] "previous" reverses; wrap-around behavior documented.
- [ ] Cursor state resets on navigation/page change.

## Handoffs

- **Input ←** EXT-002 (node list), EXT-006 (message routing).
- **Output →** CORE-001 may emit `navigate` actions that map to NAV_* messages (parser rule documented in `/core/prompts/form-control-v1.md`).
