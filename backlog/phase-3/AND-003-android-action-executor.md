# AND-003 — Android Action Executor

- **Phase:** 3 — Android Universal Bridge (Week 2–4)
- **Track / Agent:** Agent C — Mobile / Kotlin
- **Priority:** P0
- **Status:** ready
- **Depends on:** AND-002
- **Parallel with:** AND-004
- **Critical path:** No
- **Milestone gates:** G4

## Objective

Execute `Command[]` against live `AccessibilityNodeInfo` nodes in Chrome and native apps.

## Specification

- **File:** `/android/app/src/main/java/com/voiceform/executor/ActionExecutor.kt`
- **Signature:** `execute(node: AccessibilityNodeInfo?, cmd: Command)`
  - **Fill:** `Bundle args = Bundle(); args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHAR_SEQUENCE, cmd.value); node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);`
  - **Click:** `node.performAction(AccessibilityNodeInfo.ACTION_CLICK)`
  - **Check:** `node.performAction(AccessibilityNodeInfo.ACTION_CHECK)` / `ACTION_UNCHECK`
  - **Focus/Navigate:** `node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)`; if navigating, find next `isEditable` node in the tree and focus it.
- Mirror EXT-003 semantics: ambiguity (>1 fuzzy label match >70%) → return candidates, do not act.

## Acceptance criteria

- [ ] Fills, clicks, and checks work in Chrome and at least 3 native apps.
- [ ] Ambiguous commands return candidates instead of acting.
- [ ] Results returned as `ExecutionResult` matching the CONTRACT-001-compatible shape used by EXT-003.

## Handoffs

- **Input ←** AND-002 (node matching), CONTRACT-001 (Command).
- **Output →** AND-004 (confirmation flow calls execute after Confirm), INTE-001 counterpart manual mobile test (Agent E).
