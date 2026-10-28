# Manual QA suite (D12 gate)

Epic: [#54 UX-003](https://github.com/jtanori/form-control-2/issues/54) ·
Item: [#59 UX-003-R](https://github.com/jtanori/form-control-2/issues/59) ·
Checklist: [`QA-GATE.md`](QA-GATE.md) · Coverage: [`coverage-matrix.md`](coverage-matrix.md)

**This suite is the acceptance gate (D12).** CI green never replaces it: a
gate run passes only when the stakeholder marks items ✅ **or** records a
written valid reason per skipped/failed item in `QA-GATE.md`.

## Environment (prerequisites)

1. **Core stack:** `docker compose up --build` →
   `curl -s localhost:8020/api/v1/health` shows `"status":"ok"` and
   `"sttBackend":"whisper"` (first boot downloads the model).
2. **Fixture server:** `node tests/e2e/static-server.mjs` →
   `http://127.0.0.1:4173/` serves this repo (forms under `tests/fixtures/forms/`).
3. **Extension:** `cd extensions/browser && npm run build` →
   `chrome://extensions` → Developer mode → **Load unpacked** → `extensions/browser/dist`
   (reload after every build).
4. **Fresh-ish profile** for M01–M03 (first-install + permission rows):
   use a separate Chrome “Guest/Testing” profile so install/onboarding fire once.
5. **Android rows (M30+):** install latest debug APK from CI/release; enable
   Accessibility + overlay + microphone (setup screen).

## Execution order (recommended)

1. **Smoke subset (after UX-003-P1):** M01, M06–M15, M20, M22–M24
2. **Full run (before epic close):** M01–M29 in order (M30–M36 after Android P3)

## Gate protocol

| Rule | Meaning |
|---|---|
| ✅ | Steps executed, expected result observed |
| ❌ | Steps executed, expected result **not** observed → record details; file/link a fix in the responsible epic item; re-run after fix |
| **R: reason** | Not executed — **written valid reason required** (environment limitation, deferred-by-register feature, hardware missing). Blank ≠ passed |
| Sign-off | Paste completed checklist or commit it; stakeholder comments sign-off on [#58 GATE](https://github.com/jtanori/form-control-2/issues/58) |

## Conventions

- One browser run may cover several M-ids; note **date, Chrome version, OS** at
  the top of `QA-GATE.md` for the run.
- Where an M-id says *(E2E twin)*, CI covers it too — the manual run still
  happens (D12).
- Sound is supplementary (QA-020): after M13, also spot-check muted-OS if handy.
