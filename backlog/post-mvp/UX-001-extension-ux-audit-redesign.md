# UX-001 — Extension UX Audit & Redesign (mechanics + look & feel)

- **Phase:** Post-MVP (after REL-001 / `v0.1.0-mvp`)
- **Track / Agent:** Agent B — Extension / Frontend (with design input)
- **Priority:** P1
- **Status:** ready
- **Depends on:** EXT-001…EXT-006, EXT-004 follow-ups (recorder window fix), REL-001
- **Parallel with:** INTE-002, Phase 4 (DES-*)
- **Critical path:** No (quality/usability track; does not block the MVP gate)
- **Milestone gates:** none directly — de-risks G1 adoption (voice actually gets used)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/41
- **GitHub labels:** `backlog`, `post-mvp`, `P1`, `agent-frontend`
- **GitHub milestone:** Post-MVP

## Objective

Audit how the extension **actually behaves today** (popup + voice window +
bridge mechanics) against how a first-time user expects it to work, then
redesign information architecture, copy, and visual treatment so the
voice → parse → confirm → fill loop is obvious without instructions.

## Why now (observed, first session)

Real feedback from dogfooding `v0.1.0-mvp`:

1. “I got a bit confused by the UI, didn’t know what to do.”
2. Mic permission failure surfaced as raw `Mic unavailable: Permission dismissed`.
3. Two surfaces (action popup **and** separate voice window) with overlapping
   but different controls — unclear which one is “the app”.
4. No first-run onboarding: Core URL, permission gates, and the typed fallback
   are discoverable only by exploration.
5. Status line, session id, and cursor buttons (← → 🔊) are unexplained.

The mic fix (durable `recorder.html` window) is **mechanically correct** but is
a patch on a split UX — this item decides what the model *should* be.

## Specification

### Phase A — Audit (evidence, no redesign yet)

Deliverable: **`docs/ux-audit.md`** containing:

- **Current-state map:** every surface (action popup, voice window, content
  script feedback, context menu), every control, every state/phase, every
  error string — with screenshots or DOM excerpts.
- **Task walkthroughs** scored for first-run success without docs:
  - T1: typed command → parse → confirm → fill
  - T2: voice command end-to-end (permission grant included)
  - T3: recover from STT/Core down
  - T4: ambiguous target → clarify
  - T5: change Core URL / session visibility
- **Friction log:** each confusion/failure mapped to root cause
  (e.g. split surfaces, focus-loss constraint, missing onboarding, raw errors).
- **Constraints ledger:** what *cannot* change (Chrome popup focus-loss → mic
  must live in a non-closing context; E2E selectors in
  `tests/e2e/browser-flow.spec.ts`; `chrome.*` permission rules; MV3 SW lifetime).

### Phase B — Proposed model

In the same doc, specify the target design:

- **Surface decision:** single primary surface vs popup+window roles (e.g.
  popup = quick actions/status; window = full flow) — justify with the audit.
- **Information architecture:** first-run checklist, where Core health/session
  live, where cursor controls live (or drop them from primary UI).
- **State machine:** explicit phases with copy per state (idle → listening →
  transcribing → parsed → confirming → done/error) shared across surfaces.
- **Error voice:** map every current raw string to user-facing copy +
  next action (permission, STT, core down, ambiguity, no-match).
- **Visual system:** minimal design tokens (spacing, type scale, status colors),
  dark-mode parity (popup.css already has tokens — extend, don’t fork).

### Phase C — Implement

- Redesign popup + voice window per the approved model (shared styles,
  shared phase copy; consider merging flows so there is one mental model).
- First-run onboarding (dismissable) covering: mic permission, load-unpacked
  reminder, Core URL/health.
- Keep typed fallback prominent; never hide the confirm gate.

## Files & deliverables

- `/docs/ux-audit.md` — Phase A + B (the decision record)
- `/extensions/browser/src/popup/**`, `/extensions/browser/src/recorder/**`
  (+ any shared `src/ui/` tokens extracted from `popup.css`)
- E2E updates in `/tests/e2e/browser-flow.spec.ts` **only if** selectors
  change — flow assertions (fill/submit/confirm-first) must not weaken

## Acceptance criteria

- [ ] `docs/ux-audit.md` exists: current-state map, ≥5 scored walkthroughs,
      friction log with root causes, constraints ledger, proposed model.
- [ ] A cold user completes T1 and T2 with no external docs (walkthrough note
      in the audit, recorded during dogfooding).
- [ ] Every error state has friendly copy + a next step (table in audit →
      implemented in UI).
- [ ] Unit tests + typecheck green; **E2E job green** (5×) after any selector
      changes.
- [ ] Visual pass: light/dark, no raw exceptions or `Permission …` strings in
      the primary flow.

## Handoffs

- **Input ←** EXT-001…006 (as shipped), recorder-window fix (mic mechanics),
  QA-001 (constraints on permissions copy), INTE-001 (regression harness).
- **Output →** next extension release (post-mvp tag), optional AND-004 overlay
  adoption of the same state/copy model, INTE-002 (if session UI changes).
