# AND-006 — Mobile UX parity & shared visual identity

- **Phase:** Post-MVP (with UX-001 / UX-002)
- **Track / Agent:** Agent C — Mobile / Kotlin (+ design ops)
- **Priority:** P1
- **Status:** **in epic [UX-003](UX-003-spec-adoption-epic.md) as item P3** — spec refs: layouts §6.6–6.8, Compose tokens §1.8, Back precedence §8.3; D1/D2/D3 deferrals from the epic apply (no 3s gating / read-back / FSM work here)
- **Depends on:** AND-001…005, UX-001 C1/C2 (behavior reference), UX-002 (tokens/copy), STT-001 compose stack
- **Parallel with:** UX-002 generation, extension residuals
- **Critical path:** No — quality/parity track
- **Milestone gates:** none directly; de-risks G1/G4 consistency
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/51
- **GitHub labels:** `backlog`, `post-mvp`, `P1`, `agent-mobile`
- **GitHub milestone:** Post-MVP

## Objective

Bring the Android experience to **feature parity with UX-001** where it maps
onto AccessibilityService + overlay (no popup-focus constraints), and skin it
with the **shared design identity** from UX-002 so both platforms feel like
one product.

## Parity map (extension → Android)

| UX-001 feature | Android target |
|---|---|
| Side Panel workspace | Floating overlay becomes the **workspace** (collapsed / expanded / listening / confirm) |
| Options/onboarding (just-in-time mic) | **Setup activity** — Enable voice, Core health, demo loop; never request mic at install |
| Always-on form discovery | Already running — **surface a count** on the overlay + form list before commands |
| Active-form 2–3px border; others muted+blur | Overlay drawing on active window form rects |
| Tap-to-talk, LISTENING badge, live transcript, chimes | Tap form → listening HUD over field + live partial text |
| 3s confirm pill (submits/pay) | In-overlay pill before `performAction` on risky targets |
| Zen reading mode | **Reading-mode sheet** (ordered fields, next/back voice, dismiss restores UI) |
| B-0 tokens + copy | Consume `contracts/design/tokens.json` + `copy.json` |

## Specification

1. **Mechanics first** (no design assets required): overlay state machine
   matching C2 (idle/listening/reviewing/confirm), always-on form count,
   form list, confirm pill logic aligned with `confirmRequired` + risky labels.
2. **Setup activity** mirroring B-1/B-1a copy slots (from `copy.json`).
3. **Indicators + zen sheet** using token mappings once UX-002 lands.
4. **Parity QA checklist** walked on a device (same wording as extension).
5. No new NLU verbs unless audit proves a gap — reuse form-core executor.

## Acceptance criteria

- [ ] Overlay state machine + tap-to-talk loop works on device (mic already granted via setup)
- [ ] Form count + list visible without opening settings
- [ ] Confirm pill blocks risky actions until tap/say-confirm
- [ ] Zen sheet: full field list, dismiss leaves no overlay residue
- [ ] Theme/copy from `contracts/design/` (or interim B-0 mappings documented if assets pending)
- [ ] form-core tests + debug APK CI still green; device checklist signed on the issue

## Handoffs

- **Input ←** UX-001 behavior, UX-002 assets, AND-002/003 parser+executor
- **Output →** G1/G4 device sign-off refresh, INTE-002 if session UX changes
