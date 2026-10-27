# AND-004 — Android Voice Overlay & STT Client

- **Phase:** 3 — Android Universal Bridge (Week 2–4)
- **Track / Agent:** Agent C — Mobile / Kotlin
- **Priority:** P0
- **Status:** ready
- **Depends on:** AND-003, CORE-001 (parser endpoint; mockable), STT-001
- **Parallel with:** AND-001, AND-002 (can use mock parser)
- **Critical path:** No (required for G1 + G4)
- **Milestone gates:** G1, G4
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/18
- **GitHub labels:** `backlog`, `phase-3`, `P0`, `agent-mobile`
- **GitHub milestone:** Phase 3 — Android

## Objective

The mobile voice loop: floating button → speech → transcript → parse → confirm → execute, entirely hands-free-able.

## Specification

- **Files:**
  - `/android/app/src/main/java/com/voiceform/ui/OverlayVoice.kt`
  - `/android/app/src/main/java/com/voiceform/voice/VoiceClient.kt`
- **Flow (floating button / hotword):**
  1. Start `SpeechRecognizer` (Android built-in) **or** record `AudioRecord` and POST to Core STT (`http://core.local:8020/stt/transcribe` — configurable host).
  2. Receive transcript; fetch current window context via `AccessibilityService.getRootInActiveWindow()` (AND-002); POST to `/api/v1/parse`.
  3. Receive commands; confirmation card: "Fill Email with john@example.com? **[Confirm] [Cancel]**".
  4. Confirm → `ActionExecutor.execute()`; Cancel → prompt clarification (`POST /api/v1/clarify`).
- Overlay uses `TYPE_APPLICATION_OVERLAY`; dismissal and re-drag affordances included.

## Acceptance criteria

- [ ] User can fill a form in Chrome Mobile via voice **without touching the screen** (tap overlay only).
- [ ] Confirmation card gates destructive actions (click/submit).
- [ ] STT host configurable (localhost via Termux, or LAN IP).
- [ ] G1 check: transcript appears; G4 check: native app form filled.

## Handoffs

- **Input ←** STT-001, CORE-001/002, AND-002 (context), AND-003 (execution).
- **Output →** AND-005 (unified session context sender), Agent E manual mobile test.
