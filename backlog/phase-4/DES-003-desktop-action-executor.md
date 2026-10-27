# DES-003 — Desktop Action Executor

- **Phase:** 4 — Desktop Native Agent (Week 3–4)
- **Track / Agent:** Agent D — Desktop / Python
- **Priority:** P2
- **Status:** ready
- **Depends on:** DES-002
- **Parallel with:** DES-004
- **Critical path:** No
- **Milestone gates:** G5

## Objective

Execute `Command[]` against desktop UIA controls.

## Specification

- **File:** `/desktop/daemon/executor.py`
- Find control by `Name` (fuzzy match — same >70% / ambiguity-refusal rule as EXT-003 and AND-003) + `ControlType`.
- Actions:
  - `SetValue` when `ValuePattern` available.
  - Else: click and type via `SendKeys` fallback.
  - `Click()` for buttons.
  - Check/uncheck via `TogglePattern` where available.
- Return the shared `ExecutionResult` shape.

## Acceptance criteria

- [ ] Fills 2 desktop forms end-to-end.
- [ ] Ambiguous labels return candidates instead of acting.
- [ ] Works on Notepad (Save dialog) and one .NET form.

## Handoffs

- **Input ←** DES-002 (control list), CONTRACT-001.
- **Output →** DES-004 (voice loop), optional EXT-006 `ws://localhost:8021` remote-execution path.
