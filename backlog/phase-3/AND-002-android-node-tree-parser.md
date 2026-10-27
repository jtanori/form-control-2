# AND-002 — Android Node Tree Parser

- **Phase:** 3 — Android Universal Bridge (Week 2–4)
- **Track / Agent:** Agent C — Mobile / Kotlin
- **Priority:** P0
- **Status:** ready
- **Depends on:** AND-001, CONTRACT-001
- **Parallel with:** AND-003
- **Critical path:** No
- **Milestone gates:** G4
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/16
- **GitHub labels:** `backlog`, `phase-3`, `P0`, `agent-mobile`
- **GitHub milestone:** Phase 3 — Android

## Objective

Turn the active window's accessibility node tree into the same `FormSnapshot` JSON the browser extractor produces.

## Specification

- **File:** `/android/app/src/main/java/com/voiceform/parser/NodeParser.kt`
- **Function:** `parseWindowNode(root: AccessibilityNodeInfo?): ContextSnapshot`
  - Recursively traverse `root.getChildCount()`.
  - Per child extract: `text?.toString()`, `contentDescription?.toString()`, `viewIdResourceName`, `className`, `isEditable`, `isClickable`, `isCheckable`, `isChecked`, `boundsInScreen` (rect).
  - Filter out images without text and decorative nodes.
  - Build JSON matching CONTRACT-001 exactly (`nodeId` prefixed `a#`, `source: "accessibility"`).
- Label resolution mirror of EXT-002 order: text → contentDescription → viewId → className fallback.

## Acceptance criteria

- [ ] On Chrome mobile and 3 native apps, outputs JSON **comparable to the browser extractor** for equivalent forms.
- [ ] Output validates against `/contracts/v1/form-context.schema.json`.
- [ ] CORE-004 normalizes its output to be identical to EXT-002's for the same logical form.
- [ ] Unit tests use recorded node-tree fixtures (no emulator required).

## Handoffs

- **Input ←** AND-001 (service), CONTRACT-001.
- **Output →** AND-003 (nodes to act on), AND-004/AND-005 (context for `/parse`), CORE-004 (normalization parity).
