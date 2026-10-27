# UX-001 — Extension UX Audit & Redesign (mechanics + look & feel)

- **Phase:** Post-MVP (after REL-001 / `v0.1.0-mvp`)
- **Track / Agent:** Agent B — Extension / Frontend (with design input)
- **Priority:** P1
- **Status:** ready (Phase A audit merged: [`docs/ux-audit.md`](../../docs/ux-audit.md))
- **Depends on:** EXT-001…EXT-006, REL-001
- **Parallel with:** INTE-002, Phase 4 (DES-*)
- **Critical path:** No (quality/usability track; does not block the MVP gate)
- **Milestone gates:** none directly — de-risks G1 adoption (voice actually gets used)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/41
- **GitHub labels:** `backlog`, `post-mvp`, `P1`, `agent-frontend`
- **GitHub milestone:** Post-MVP

## Objective

Fix how the extension is **configured and used**: one explicit setup place
instead of floating windows, and a launch flow that starts by **finding the
forms on the page** — so voice → parse → confirm → fill is obvious without
instructions and without juggling two windows.

## Why now (observed + stakeholder direction)

Dogfooding `v0.1.0-mvp`:

1. “I got a bit confused by the UI, didn’t know what to do.”
2. Mic permission failure surfaced as raw `Mic unavailable: Permission dismissed`.
3. Two surfaces (action popup **and** separate voice window) with overlapping
   but different controls — unclear which one is “the app”.
4. No first-run onboarding; Core URL / permission gates discoverable only by
   exploration.
5. **No point of reference for how the thing works** — there is no tutorial,
   tour, or sample walkthrough anywhere in the product; users must learn by
   trial and error.

**Stakeholder decision (this issue’s direction, supersedes any “persistent
secondary window” idea):**

- ❌ The **secondary (Stage) window is rejected**. Asking users to maintain
  focus across two windows while filling a form is **harder than filling the
  form by hand** — friction, not help.
- ✅ Users get a **configuration page** (Chrome options page) where all setup
  happens, **including microphone setup**, if the platform allows it there.
- ⚠️ **Feasibility spike (explicit):** confirm `getUserMedia` + permission
  persistence on a full-tab options page. Expected: *yes* — options pages are
  normal tabs, so the prompt can’t “dismiss” the way it does in an action
  popup, and a grant stored for the `chrome-extension://` origin is then used
  silently by the popup. **If it turns out setup-on-options is impossible,
  stop and document an alternative strategy in `docs/ux-audit.md` before
  building more UI** (do not revive the two-window flow without a new
  decision).
- ✅ Once configured, **launching the extension’s first act is form
  identification**: scan the current page, show the user what forms/fields
  were found, then start voice/typed commands against that context.
- ✅ **Easy launch of a quick learning/tutorial** — a one-click way (from the
  popup and automatically on first install) to open a short, guided
  “how this works” experience. Research how others do it first (below), pick a
  pattern, implement it as part of B-5.

### Research — how others teach an extension (desk research, refine during Phase C)

| Pattern | Who does it | Trade-offs for us |
|---|---|---|
| **First-install welcome tab** (`chrome.runtime.onInstalled` → open `onboarding.html`) | 1Password, Grammarly, Loom, Honey | Full-page = durable (unlike popup); can host multi-step setup + live buttons. **Best fit for “no point of reference”** |
| **Interactive coach-marks** (highlight UI pieces in sequence) | Intro.js-style product tours, Linear/Notion | Weak inside a tiny popup that closes on blur; doable *inside* a full tab |
| **Demo / sandbox mode** — let the user run the real loop safely | Duolingo practice, product demos | **Killer feature for us:** extension ships its own `demo.html` (reuse `tests/fixtures/form-checkout.html`) → full voice/typed → fill loop with zero website risk |
| **In-context examples** (sample commands to copy) | Raycast, command palettes | Cheap; put 2–3 samples in popup empty state + onboarding |
| **Toolbar badge until complete** (`action.setBadgeText`) | many install-time flows | Cheap reminder: “1” until onboarding dismissed |
| **Always-available Help** (“?” / context menu) | near-universal | Required so the tutorial is *launchable*, not just first-run |
| **Embedded short video** | SaaS onboarding | Heavier assets, i18n; skip for MVP of this item |
| **Tooltips on first hover** | scattered | Too easy to miss; not sufficient alone |

**Direction:** welcome **tab** on install + **“?” in popup reopens it** +
**built-in demo page** for a safe full-loop walkthrough. No modal-in-popup,
no second always-on window. Confirm/refine this list during Phase C with a
quick pass over 2–3 reference extensions (inspect their `onInstalled` +
options pages) and record the final choice in `docs/ux-audit.md`.

## Specification

### Phase A — Audit (✅ done)

[`docs/ux-audit.md`](../../docs/ux-audit.md) — current-state map, scored
walkthroughs T1–T5, friction log F1–F9, constraints ledger. Walkthrough scores
and mechanics stay valid; the Phase B *surface* proposal there is **superseded
by this file** (see “Direction update” below).

### Phase B — Target model (stakeholder direction)

Deliverable: update `docs/ux-audit.md` Phase B to match this section
(“Direction update — config page, no secondary window”), then build it.

**B-1. Configuration page (`options_ui`, full tab — the only setup surface)**

- Declared as `options_ui` in the manifest (openable from `chrome://extensions`
  → Details → Extension options, and linked from first-run).
- Contents:
  1. **Microphone setup** — explicit “Enable microphone” button →
     `getUserMedia` **in this tab** (prompt appears here, tab stays alive) →
     success/fail state with retry + “open Chrome site settings” fallback.
  2. **Core URL + health** — ping `GET /api/v1/health`, show Core/STT dots,
     STT-first-run note (model download).
  3. **First-run walkthrough** — 3 steps: mic → stack → “nothing runs until
     Confirm” + copyable sample command.
  4. Diagnostics: session id (copy), link to re-run onboarding.
- Feasibility spike (above) is a **Phase C gate**: write the finding into the
  audit doc before merging UI that depends on it.

**B-2. Popup = the only runtime surface (no Stage window)**

- All recording happens **in the popup**, because mic setup already happened:
  `getUserMedia` resolves without a prompt while permission is granted.
- If permission is missing/revoked (prompt would kill the popup): show the
  friendly copy + one button **“Open microphone setup”** → jumps to the
  options page. Never open a companion window.
- Delete `recorder.html` flow as the primary path (keep code only if the spike
  proves popup recording impossible — then audit must say why and propose the
  alternative; still no unvetted second window).
- Typed path unchanged (E2E contract: `.card`, `Confirm`, `Executed` stay).

**B-3. Launch flow starts with form identification**

On popup open (and on demand):

1. **Identify forms** on the active page via the existing content-script
   context (`GET_CONTEXT`): group nodes by `<form>` (fallback: interactive
   regions when no `<form>` exists) → list each form with title/field count
   (e.g. “Checkout — 6 fields”, “Sign in — 3 fields”).
2. Show the list **before** any command UI: “What should I fill?” with the
   detected forms; selecting one scopes `context` for parse/execute (or
   “whole page” default, clearly labelled).
3. Then the normal voice/typed input against the chosen form.

Implementation note: grouping by form is an **extractor/normalizer add-on**
(extension-side only; contract keeps a flat node list — add form metadata as
optional grouping in the snapshot the popup already receives, or compute in
the content script from `form` ancestry).

**B-4. Shared polish (from original spec)**

- One copy module for phases/errors (B4 table in the audit stays).
- Health strip, demoted cursor tools, unified ambiguity UI, visual tokens —
  all apply to the popup + options page only.

**B-5. Quick learning / tutorial (launchable, not buried)**

Answers “no point of reference on how the thing works”:

- **`onboarding.html`** — full-tab tutorial opened:
  automatically on `chrome.runtime.onInstalled` (reason `install` / after
  updates that need re-setup), and **any time from a “?” button** in the
  popup (+ optional context-menu item “How to use VoiceForm”).
- Content (3 short steps, each with a live action):
  1. **Setup** — jumps to / embeds mic + Core health (shared with B-1 page —
     onboarding and options may be one page with tabs to avoid duplication).
  2. **Try the loop** — “open the **demo form**” → extension-owned
     `demo.html` (checkout fixture) → type (or speak) a sample command →
     Confirm → watch fields fill. Safe sandbox, no real site, full pipeline.
  3. **On a real page** — “pin the icon, open any form, press ●” + link back
     to popup flow (form list first, per B-3).
- **Toolbar badge** (“!” or “?”) until onboarding completed/dismissed.
- Re-entry is one click forever after (popup “?”) — tutorial is a
  *product surface*, not a one-shot email.
- Research note (table above) gets a reality-check pass against 2–3 shipped
  extensions during Phase C; findings appended to `docs/ux-audit.md`.

### Phase C — Implement (revised scope)

1. Spike: options-page `getUserMedia` + persisted grant → note in audit.  
2. `options.html` (B-1) + manifest `options_ui`.  
3. Popup: inline recording when granted; “Open microphone setup” when not;
   **remove Stage window from the happy path**.  
4. Form identification panel (B-3) as the popup’s first block.  
5. **Tutorial (B-5):** `onboarding.html` + `onInstalled` open + popup “?” +
   demo page + badge; desk-research reality check appended to audit.  
6. Copy/error pass + shared tokens; context-menu silent-log fix if touched.  
7. E2E: keep existing flow green; add popup-side form-list assertion if
   selectors allow; recorder-window-specific tests updated to new path.

## Files & deliverables

- `/docs/ux-audit.md` — Phase B “Direction update” section (supersedes Stage);
  research appendix (final pattern choice)
- `/extensions/browser/manifest.json` (`options_ui`), `src/options/**`,
  `src/onboarding/**` (or tabs of the same page), `src/popup/**`,
  `src/content/*` or extractor grouping helper; `demo.html` (fixture copy)
- Remove/demote `src/recorder/**` from the happy path (per B-2)
- `/tests/e2e/browser-flow.spec.ts` updates if popup selectors change

## Acceptance criteria

- [ ] Feasibility spike written up (options-page mic works / or alternative
      strategy documented **before** further UI build).
- [ ] Configuration page exists and can: grant mic, show Core/STT health,
      complete onboarding without the popup.
- [ ] **No secondary window in the configured happy path** — voice records
      inside the popup; no `chrome.windows.create` for recording.
- [ ] On popup launch, the user sees **detected forms** (count + labels)
      before command entry; parse context can be scoped to a chosen form.
- [ ] **Tutorial launchable in one click** from the popup (“?”); opens
      automatically on first install; includes a runnable demo-form step that
      completes the full loop; toolbar badge clears when done.
- [ ] Research reality-check appended to `docs/ux-audit.md` (final pattern +
      why, referencing ≥2 shipped extensions).
- [ ] A cold user completes setup + tutorial + T1/T2 with no external docs.
- [ ] Friendly copy for every error (audit B4 table); no raw exception strings.
- [ ] Typecheck + unit + **E2E job green (5×)**.

## Handoffs

- **Input ←** EXT-001…006, QA-001 (permissions copy), INTE-001 (harness),
  Phase A audit (`docs/ux-audit.md`).
- **Output →** post-mvp extension release; optional AND-004 adoption of the
  setup-first + form-identification pattern; INTE-002 if session UI changes.
