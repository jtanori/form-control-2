## Description
Implement an interactive manual-testing UI inside the extension's side-panel. The suite will:
1. Host UI in a new "Manual Test" tab of the side-panel (no conflict with existing UI).
2. Persist results to a per-session JSON log (`tests/manual/run-log-<timestamp>.json`).
3. Guide the tester through the full first-run voice workflow, including stress/conflict variants (concurrent tabs, interrupted voice, rapid commands).
4. Show UI hints and expected outcomes for each step.
5. Capture defects via a lightweight modal per assertion, storing them in the same JSON log.
6. Export (later) to `QA-GATE.md` if needed.

**Related issues**: #68 (token‑mapping conflict), #69 (active‑form border & dimming), #67 (PR workflow).

**Acceptance criteria**:
- Side‑panel contains a "Manual Test" tab showing an index of test categories (UI, Navigation, Form handling, Multiple Forms, Massive Forms, Full Native Form Elements, …).
- Each test step displays an instruction panel, a visual overlay hint, and a PASS/FAIL console entry.
- Defect‑capture modal records free‑text, a category dropdown, and stores data in the session JSON log.
- JSON log file is written to `chrome.storage.local` and can be exported via a "Download Log" button.
- All automated unit tests (`npm test`) pass; a smoke manual run validates the side‑panel UI.

**Labels**: backlog, post-mvp, P1, feature, qa
