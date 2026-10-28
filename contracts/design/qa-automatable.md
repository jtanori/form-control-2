# QA matrix — automatable subset (UX-003-C)

Source: `spec-v1.md` §10, minus **D1 rows** (QA-010–014 excluded — countdown/auth deferred).
**Status legend:** `auto` = CI test (id) · `manual` = `tests/manual/QA-GATE.md` M-id · `later` = needs P-phases first.

| Spec row | Scenario | Where | Status |
|---|---|---|---|
| QA-001 | Install → no mic prompt | manual M01 (+ P4: automation attempt) | manual |
| QA-002 | Passive detection local-only | manual M07/M08 + P4 (no `/stt` on load) | later-auto |
| QA-003 | Mic denied → recovery | manual M03 | manual |
| QA-004 | Empty transcript → no mutation | unit (voice path) / manual M18 | later-auto |
| QA-005 | Core offline → no execution | manual M05 (+ P4 dead-port test) | later-auto |
| QA-006 | Twin labels → candidate selection | unit `ActionExecutorTest` ambiguity + manual M16 | auto ✅ |
| QA-007 | No match → no substitution | unit (executor error) + manual M17 | auto ✅ |
| QA-008 | Ordinary fill executes once | **E2E** browser-flow (D8) + manual M11 | auto ✅ |
| QA-009 | Submit → confirm pill appears | manual M15 (+ P4 possible E2E assert) | later-auto |
| QA-015 | Esc/Cancel pill → no execute | manual M15 (+ P4) | later-auto |
| QA-016 | Dismiss zen mid-listening | manual M19 | manual |
| QA-017 | Retry after partial failure → no dup ops | unit (prefix-on-error) + GATE spot | auto ✅ |
| QA-018 | Android service loss | manual M31+ (P3) | manual |
| QA-019 | Reduced motion | manual M25 | manual |
| QA-020 | Sound muted → visual sufficiency | manual M25 note | manual |
| QA-021 | Screen reader announcements | manual (GATE extra) | manual |
| QA-022 | Panel close → invalidate pending | **D1** partial: pill has nothing pending pre-gate — cancel-on-close noted manual M15 | manual |
| QA-023 | Submit unverified → no auto-retry | **D2 deferred** (read-back) — row tracked in epic deferred register | deferred |
| QA-024 | Host rerender → re-resolve/refuse | manual M21 (+ executor re-extract exists) | manual |

**Excluded (D1):** QA-010, QA-011, QA-012, QA-013, QA-014.

P4 turns every `later-auto` row into a concrete CI test (or flips it to `manual` with justification).
