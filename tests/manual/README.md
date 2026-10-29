# Manual Testing Suite

This folder contains the resources for the **Manual‑Testing Suite** that will be hosted in the extension side‑panel.

## How to run
1. Open the browser extension side‑panel.
2. Click the **"Manual Test"** tab (will be added by the upcoming implementation).
3. The UI will display an index of test categories (UI, Navigation, Form handling, Multiple Forms, Massive Forms, Full Native Form Elements, …).
4. Select a test to view step‑by‑step instructions in a floating drawer.
5. As you perform each action, the suite will assert the expected UI state and log PASS/FAIL entries.
6. Results are persisted to a per‑session JSON log (`tests/manual/run‑log-<timestamp>.json`).
7. When the run completes, the JSON log can be downloaded via a **Download Log** button and will be used to generate the `QA‑GATE.md` report.

## Reference
- Issue tracking this work: [#70](https://github.com/jtanori/form-control-2/issues/70)
- Related epic: [UX‑003](post-mvp/UX-003-spec-adoption-epic.md) – D12 manual QA gate.

---

*This README will be expanded with screenshots and more detailed usage once the UI is available.*
