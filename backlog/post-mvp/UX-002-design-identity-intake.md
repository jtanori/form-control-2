# UX-002 — Design identity intake (Gemini / ChatGPT design board)

- **Phase:** Post-MVP (parallel with UX-001 C residuals / AND-006)
- **Track / Agent:** Design ops (human) → Agent B / C (implementation)
- **Priority:** P1
- **Status:** ready (prompts delivered to stakeholder; awaiting generated assets)
- **Depends on:** UX-001 B-0 rules (shipped), C1/C2 surfaces (shipped)
- **Parallel with:** AND-006
- **Critical path:** No — quality/identity track
- **Milestone gates:** none directly; unblocks consistent AND-006 + visual polish
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/50
- **GitHub labels:** `backlog`, `post-mvp`, `P1`, `design`
- **GitHub milestone:** Post-MVP

## Objective

Produce a **single visual identity** (tokens, components, microcopy, screen specs)
for every surface — browser + Android — by using **Gemini and ChatGPT as the
generation studio** from a fixed brief; humans art-direct; the repo stores the
merged, implementation-ready artifacts as the source of truth.

## Process

1. **Brief prompts** (already delivered by the stakeholder session):
   master design-system brief · mechanics/state choreography · multi-surface
   board layout. Same brief goes to Gemini and ChatGPT.
2. **Diff & merge** — keep only what obeys UX-001 B-0 hard rules (one accent +
   grayscale, pills, calm motion, indicators over text, honest errors).
3. **Land artifacts in-repo** under `contracts/design/`:
   - `tokens.json` — color/type/space/radius/elevation/blur (light+dark)
   - `copy.json` — EN microcopy slots (permission, denial, listening, confirm,
     errors, onboarding)
   - `components.md` — inventory, states, anatomy
   - `screens.md` — side panel, options, mini popup, in-page cues, zen sheet,
     Android overlay states, Android setup
   - `mechanics.md` — state machines, timing, chimes, failure paths
4. **Implement** — regenerate extension `tokens.css` from `tokens.json`;
   Android theme from the same file; copy module from `copy.json`.
5. **Sign-off** — visual QA checklist (light/dark, both platforms, contrast).

## Acceptance criteria

- [ ] Generated assets from Gemini + ChatGPT merged into `contracts/design/*` and reviewed against B-0
- [ ] Extension CSS tokens derived from `tokens.json` (no hard-coded hex in new UI)
- [ ] Android theme mapping documented in `screens.md` / `components.md`
- [ ] Copy slots in `copy.json` cover B-4 error table + B-1a permission flow
- [ ] Human “looks like one product” sign-off noted on the issue

## Handoffs

- **Input ←** UX-001 B-0/B-4/B-1a, C1/C2 surfaces, AND-001…005 Android baseline
- **Output →** AND-006 (consumes tokens/copy), residual UX-001 polish
