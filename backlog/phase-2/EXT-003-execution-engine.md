# EXT-003 — Execution Engine (Content Script)

- **Phase:** 2 — Browser Bridge (Week 2–3)
- **Track / Agent:** Agent B — Extension / Frontend
- **Priority:** P0
- **Status:** ready
- **Depends on:** EXT-002 (mock targets OK for unit tests; E2E needs EXT-002 + EXT-006)
- **Parallel with:** EXT-004, EXT-005
- **Critical path:** Yes
- **Milestone gates:** G3

## Objective

Safely execute `Command[]` against the live DOM with fuzzy target matching, ambiguity refusal, and visible feedback.

## Specification

- **File:** `/extensions/browser/src/content/executor.ts`
- **Export:** `executeCommands(commands: Command[], context: FormSnapshot): Promise<ExecutionResult>`
- **Match target:** fuzzy match on `label` (Levenshtein or substring) against context nodes. If >1 match with >70% similarity → return `{status:"ambiguity", candidates:[...]}` to background — **do not guess**.
- **Action execution:**
  - `fill`: `target.value = cmd.value`; dispatch `new Event('input', {bubbles:true, cancelable:true})`; dispatch `new Event('change', ...)`; `target.focus(); target.blur();`
  - `click`: `target.click()`
  - `check` / `uncheck`: `target.checked = true/false`; dispatch `change`
  - `select`: if `<select>` → `target.value = cmd.value`; else MVP custom-dropdown path: click target, then click option with matching text.
  - `navigate`: if `cmd.target.label` contains "next" or "back" → match button; else `focus()` on `nodeId` with index from context.
- **Visual feedback:** before click, apply temporary `outline: 3px dashed #ff0;` and `scrollIntoView({block:'center'})`.
- **`ExecutionResult`:** `{status: "ok" | "ambiguity" | "error", executed: Command[], candidates?: FormNode[], error?: string}`.

## Acceptance criteria

- [ ] 20 command sequences on 5 forms complete with **100% success** (no errors).
- [ ] Ambiguous "submit" with 2 candidates returns `status:"ambiguity"` — never a blind click.
- [ ] Unit tests cover each action type without a live page (mocked targets).
- [ ] Visual highlight visible during execution.

## Handoffs

- **Input ←** EXT-002 context, EXT-006 `EXECUTE` message, CONTRACT-001 Command.
- **Output →** EXT-006 (results relayed), INTE-001 (assertions on executed state).
