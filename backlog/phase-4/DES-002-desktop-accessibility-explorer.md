# DES-002 — Desktop Accessibility Explorer

- **Phase:** 4 — Desktop Native Agent (Week 3–4)
- **Track / Agent:** Agent D — Desktop / Python
- **Priority:** P2
- **Status:** ready
- **Depends on:** DES-001, CONTRACT-001
- **Parallel with:** DES-003
- **Critical path:** No
- **Milestone gates:** G5
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/21
- **GitHub labels:** `backlog`, `phase-4`, `P2`, `agent-desktop`
- **GitHub milestone:** Phase 4 — Desktop

## Objective

Extract a `FormSnapshot` from native desktop windows via UI Automation, with a vision-capture fallback hook.

## Specification

- **File:** `/desktop/daemon/explorer.py`
- Uses `uiautomation`: `Desktop().Window(closest=True)` or `AutomationElement.FromHandle()`.
- Filter `ControlType` ∈ `EditControl`, `ButtonControl`, `CheckBoxControl`, `ComboBoxControl`.
- Extract `Name`, `ValuePattern.CurrentValue`, `BoundingRectangle`, `ControlType`, `IsKeyboardFocusable`.
- Build `FormSnapshot` per CONTRACT-001 (`nodeId` prefixed `d#`, `source: "accessibility"`).
- If no accessibility node found: capture `PIL.ImageGrab.grab()` and log for vision fallback (`source: "vision"` path in CORE-004).

## Acceptance criteria

- [ ] On Notepad, a .NET form, and an Electron app: extracts **≥80%** of interactive elements.
- [ ] Output validates against `/contracts/v1/form-context.schema.json`.
- [ ] Vision fallback image logged (not uploaded) when UIA fails.

## Handoffs

- **Input ←** DES-001 (host process), CONTRACT-001.
- **Output →** DES-003 (controls to act on), DES-004 (context for `/parse`), CORE-004 (normalization parity with browser/Android).
