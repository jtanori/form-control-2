# INTE-001 — End-to-End Browser Integration (Playwright)

- **Phase:** 5 — Integration, Security & MVP Gate (Week 5)
- **Track / Agent:** Agent E — QA / Integration
- **Priority:** P0
- **Status:** ready
- **Depends on:** EXT-001…EXT-006, CORE-001
- **Parallel with:** QA-001 (doc-level), AND-004 manual test
- **Critical path:** Yes
- **Milestone gates:** G3 proof, MVP gate
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/24
- **GitHub labels:** `backlog`, `phase-5`, `P0`, `agent-qa`, `critical-path`
- **GitHub milestone:** Phase 5 — MVP Gate

## Objective

Automated proof that a transcript becomes a filled, submitted checkout form through the real extension.

## Specification

- **File:** `/tests/e2e/browser-flow.spec.ts`
- Load extension in Playwright Chromium (`--load-extension` or temporary profile with extension unpacked).
- Open `/tests/fixtures/form-checkout.html`.
- Simulate transcript via extension popup **or** direct `chrome.runtime.sendMessage` injection.
- **Assertions:**
  1. `input[name="email"]` value set to `test@example.com`
  2. `button[type="submit"]` clicked
  3. Confirmation overlay shown
- Mock Core in CI (stub `/api/v1/parse` + `/stt/transcribe`); one job optionally runs against real `docker compose` Core.

## Acceptance criteria

- [ ] Spec passes **5 times continuously**.
- [ ] Runs in GitHub Actions (CI job added in INFR-001 workflow).
- [ ] Failure output includes `sessionId` correlation with INFR-002 logs.

## Handoffs

- **Input ←** EXT-006 (message injection surface), EXT-002/003 (fixture forms), CORE-001.
- **Output →** REL-001 (release gate requires green E2E), milestone G3 sign-off.
