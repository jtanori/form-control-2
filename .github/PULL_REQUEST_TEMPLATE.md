## Before you request review (spec-v1.md §12 build checklist)

- [ ] Only `--vf-*` tokens for color/radius/shadow/motion (no one-off hex outside `contracts/design` + `shadow-tokens.ts`)
- [ ] Every state has copy, a primary action, a recovery step, and an exit
- [ ] Interactive components have default / pressed / disabled / focus states
- [ ] All errors offer a next step (Retry / Type instead / Settings)
- [ ] Consequential actions go through the confirm pill (**D1: no countdown gating yet**)
- [ ] Mic starts only after explicit user intent (never on install / passive detection)
- [ ] Ambiguous targets refuse to execute (no guessing)
- [ ] **D8 E2E hooks intact** (`.card`, `.cmd-title`, `Confirm`, `Executed`, sidepanel surface)
- [ ] Deferred register respected (D2 read-back / D3 FSM / D4 streaming not smuggled in)
- [ ] Light **and** dark checked for touched surfaces; reduced-motion friendly
- [ ] Tests: extension `typecheck` + unit · E2E flow · core suite as relevant
- [ ] New/changed manual coverage noted on `tests/manual/QA-GATE.md` (gate runs at epic end)

See `contracts/design/spec-v1.md` §12 and `contracts/design/qa-automatable.md`.
