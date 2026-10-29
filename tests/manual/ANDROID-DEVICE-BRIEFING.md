# Android device-test briefing (M30–M36)

Parent work: [AND-006 / issue #51](https://github.com/jtanori/form-control-2/issues/51) · UX-003 gate: [#58](https://github.com/jtanori/form-control-2/issues/58)

This is a **test plan, not a result**. Record the real device/OS, build SHA, outcomes, and notes in `QA-GATE.md` after running. Do not mark an unexecuted check as passed.

## Before testing

- Build/install the debug APK from the candidate P3 commit, not the earlier green PR #67 SHA.
- Use a real Android device with overlay and Accessibility permissions available; keep a second app with editable controls in the foreground.
- Test with notification volume audible, then repeat the sound check with notification volume at zero or ringer silent.
- Use a reachable Core first; keep a known-good Core URL for M36 recovery.

## M30 — setup, progress, and microphone denial

1. Fresh-install or clear VoiceForm app data, open Setup, and inspect the three step dots and checklist.
2. Enable accessibility and overlay permissions; return to Setup and verify the checklist refreshes.
3. Deny the microphone request. Verify the denied explanation persists, the recovery action opens VoiceForm app settings, and “Continue without voice” remains usable.
4. Grant the microphone permission in app settings, return, and verify the denied state clears and progress/checklist update.

**Expected:** No microphone prompt before the user taps Allow; progress dots have accessible step labels/state; denial has a direct recovery path and does not falsely block voiceless continuation.

## M31 — collapsed/expanded shell, drag, and Back

1. Expand the floating overlay, drag it near screen edges and around the keyboard, then collapse it.
2. Press Android Back while expanded, then again while collapsed.
3. During listening and parsing, press Back and verify the capture/request is cancelled before the overlay collapses.

**Expected:** Back never confirms an action; it cancels active work first, then collapses. At collapsed state Back is not consumed by VoiceForm.

## M32 — field tap, anchored HUD, and sound cues

1. In a native form, tap an editable field. Verify listening starts only after the tap and the overlay moves near the field.
2. Verify the tapped field receives an accent outline and the transcript/parse path is limited to that field.
3. With notification audio enabled, listen for one soft start cue after capture is ready and one stop cue when capture ends. Repeat with notification volume muted/ringer silent and verify silence.
4. Try a page with multiple forms if available. **True active-form grouping and dimming of other forms is still pending #69**; do not treat the field outline as proof of form-level grouping.

**Expected:** Field-level HUD, outline, field-scoped command, and optional/supplementary audio. Visual state remains understandable with audio muted. Do not mark form grouping passed until #69 is resolved.

## M33 — risky action and cancellation

1. Tap a submit-like control or issue a submit-like voice command.
2. Verify the shared confirmation pill appears before execution.
3. Press Back and verify the action is cancelled and no submit occurs. Repeat and confirm only by tapping Confirm.

## M34 — Zen and Back precedence

1. Open Zen, advance through the final field into final review, and inspect the values.
2. Use Continue editing, then submit through the shared confirmation pill.
3. Press Back with Zen open and with the pill open. Verify Zen/pending authorization is dismissed safely and Back never confirms.
4. Dismiss Zen during capture/parse and verify no late execution or overlay residue.

## M35 — light/dark tokens and copy

1. Inspect setup, overlay, Zen, and listening cues in light and dark system themes.
2. Compare button foregrounds against accent fills and record the actual theme/colors.

**Blocking note:** dark Compose `onPrimary=#0B0F14` conflicts with dark `tokens.json` `on-accent=#FFFFFF`; see child issue #68. Record contrast observations, but do not sign off token parity until the canonical mapping is resolved.

## M36 — wrong Core URL and recovery

1. Configure an invalid/unreachable Core URL in Setup and run the health check.
2. Verify offline/error copy and that the setup remains usable without voice.
3. Restore the known-good URL, recheck, and verify Core returns healthy without restarting the app.

## Recording

For each M-id, update the corresponding row in `tests/manual/QA-GATE.md` with ✅, ❌ plus a tracked fix, or R plus a valid written reason. Add date, device/OS, candidate build SHA, and Core/STT state. This briefing does not substitute for the full D12 M01–M36 run or stakeholder sign-off.
