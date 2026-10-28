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
- ✅ **Clever active-form indication** — the form being handled gets a clear
  affordance (≈2–3 px border); *other* detected forms get the same indicator in
  a **muted tone** with a **slight blur**, so attention lands on one form
  without hiding page context (B-6).
- ✅ **Tap-to-talk initiation** — an in-form helper (“Tap and talk to start
  filling your form”); tapping focuses the first field, a **sound cue** signals
  listening, speech fills inputs **sequentially as the user talks**; for
  non-text controls, standard navigation/activation voice instructions
  (“next / back / check / submit”) (B-7).
- ✅ **Zen / reading mode** (exploratory) — tapping a form starts a quiet
  “reading mode” that lists the form’s inputs and guides the user through them
  with simple voice commands; **submit or dismiss restores the original page**
  untouched (B-8). Evaluate as the natural host for B-7’s interaction.
- ✅ **Design language: simplistic, Apple-inspired** — controls, indicators and
  surfaces follow a small, explicit rule set (one accent, pill controls,
  material/blur, typography hierarchy, progressive disclosure, calm motion) —
  see B-0; applies to every surface in this item.

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

**B-0. Design language — Apple-inspired simplicity (applies to every surface)**

Stakeholder direction: a **very simplistic UI** in the spirit of Apple
controls, indicators, and surfaces. Codified so every Phase C screen inherits
it (and the reviewer can check taste against rules, not vibes):

| Rule | Meaning in our UI |
|---|---|
| **One accent, grayscale rest** | Single accent color for primary action/active state; everything else neutral. No rainbow statuses — use one warm + one muted gray system |
| **Surfaces, not boxes** | Cards = soft fill + large radius (≈12–14 px), hairline borders or none; no hard boxed grids |
| **Material & depth** | Subtle backdrop blur/translucency on overlays (zen panel, helper chip); soft, low-opacity shadows — never heavy drop shadows |
| **Typography as hierarchy** | One type family (system UI stack: `-apple-system, SF…`), 2–3 sizes only; weight + opacity carry meaning, not more colors |
| **Pill controls** | Primary buttons and status chips = full-radius pills, generous padding, large hit targets (≥36 px in popup) |
| **Indicators over text** | State = dot/segmented control/badge first; sentence only when it adds the next step (pairs with B-6 muted indicators) |
| **Progressive disclosure** | Each surface shows **one primary action** for the current phase; advanced stuff behind chevrons (settings, diagnostics) |
| **Calm motion** | Short (~150–250 ms), ease-out transitions; one “listening” affordance; no bouncing or looping chrome animations |
| **Honest empty states** | Empty = one line of guidance + one example, not a wall of tips |

Scope: popup, options/onboarding, zen panel (B-8), helper chip (B-7).
Implementation: extend the existing `popup.css` custom-property tokens
(radius, spacing, shadow, blur, accent, muted) — one token file shared by all
extension HTML; do not fork styles per surface. Light **and** dark parity via
the existing `prefers-color-scheme` block.

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

**B-6. Active-form indication (attention without hiding context)**

After B-3 identifies forms (and whenever a command targets one):

- **Active form:** ~2–3 px accent border (hairline radius, slight offset) —
  unmistakable but quiet; optional 150 ms settle animation on activation.
- **Other detected forms:** same indicator **muted** (low-opacity border) with
  a **slight blur** (`filter: blur(1–2 px)` on non-active form containers, or
  a translucent scrim over them) so page context stays readable.
- Prefer **overlay elements positioned to the form’s rect** (content-script
  injected, shadow-DOM, pointer-events: none) over mutating site CSS — avoids
  breaking page layout/CSP; fall back to `outline` on the `<form>` when simpler.
- Clears on: dismiss, submit, unmount; follows selection changes from B-3.
- Zen mode (B-8) may dim everything except the active form further.

**B-7. Tap-to-talk initiation (how filling starts, and with what)**

- **Helper chip** anchored to the active form: “Tap and talk to start filling
  your form” (Apple-style pill, soft material, dismissible).
- **Tap anywhere on the form** (or the chip) → focus the **first interactive
  field**, apply the existing green cursor highlight, play a **soft start
  sound** (WebAudio cue — no bundled asset), and begin listening.
- **While talking, fields fill sequentially:** utterance → fill focused field →
  advance focus → next utterance. (Phrase-level loop first; true streaming
  partial-fill is stretch — spec it, don’t block on it.)
- **Controls** (buttons/checkbox/selects/links) get **navigation &
  activation instructions**, surfaced in the helper + onboarding:
  “next / back” (virtual cursor), “check / uncheck”, “select …”, “submit /
  continue”. Map to existing `NAV_*` + command actions — no new NLU verbs
  beyond what CORE-001 already parses unless the audit proves a gap.
- Safety: Confirm gate **stays** for scriptable multi-step parses (E2E
  contract); tap-to-talk mode confirms per-utterance or per-field (focus acts
  as implicit review) — decide in spike write-up, default = keep explicit
  Confirm for submits/risky actions only (already `confirmRequired`).

**Feasibility spike #2 (gate with B-7/B-8):** interacting with the page closes
the popup, so listening can’t live there. Investigate **MV3 offscreen
document** (`chrome.offscreen`, reason `USER_MEDIA`, Chrome 109+): extension-
origin page → reuses the grant from B-1, survives popup/page focus, streams
audio to the SW → `TRANSCRIBE` → commands → content script. Verify:
mic grant reuse without prompt, latency acceptable for sequential fill, SW
lifetime rules. **If offscreen fails the spike → document alternative in
`docs/ux-audit.md` before building B-7/B-8** (same rule as spike #1; still no
user-visible second window).

**B-8. Zen / reading mode (exploratory — evaluate as B-7’s host)**

- Tap active form → **reading mode**: quiet overlay listing the form’s inputs
  in order (label + current value), soft material panel (B-0), page dimmed —
  “reading the form” without site noise.
- Guides through fields with simple voice commands (B-7 vocabulary); progress
  indicator (n / total) in Apple-style segmented/dots.
- **On submit or dismiss** (close affordance / Esc / “done”): overlay hides,
  page restored exactly as before — no layout residue, no injected styles left
  behind.
- Decide in spike: same offscreen mic channel as B-7; zen = presentation layer
  over the same tap-to-talk loop. If scope must split, B-7 ships as chip +
  focus + sound first, zen panel follows in the same release.

**B-9. Shared polish (from original spec)**

- One copy module for phases/errors (audit B4 table stays).
- Health strip, demoted cursor tools, unified ambiguity UI — popup + options +
  zen surfaces only; visual tokens come from B-0.

### Phase C — Implement (revised scope)

1. **Spike #1:** options-page `getUserMedia` + persisted grant → note in audit.  
2. **Spike #2:** offscreen document (`USER_MEDIA`) as the page-interaction mic
   channel → note in audit (gates B-7/B-8).  
3. `options.html` (B-1) + manifest `options_ui`.  
4. Popup: inline recording when granted; “Open microphone setup” when not;
   **remove Stage window from the happy path**.  
5. Form identification panel (B-3) + **active-form indicators (B-6)**.  
6. **Tutorial (B-5):** `onboarding.html` + `onInstalled` + popup “?” + demo
   page + badge; desk-research reality check appended to audit.  
7. **B-7 tap-to-talk** (chip, focus, sound, sequential fill, control
   instructions) on the spike-#2 channel; **B-8 zen panel** if spike holds
   (else split note in audit).  
8. **B-0 design pass** across popup/options/onboarding/zen: token file,
   pill controls, one accent, light/dark.  
9. Copy/error pass; context-menu silent-log fix if touched.  
10. E2E: existing flow green; recorder-window tests → new path; optional
    form-list assertion.

## Files & deliverables

- `/docs/ux-audit.md` — direction update + both spike write-ups + research
  appendix (final pattern choice)
- `/extensions/browser/manifest.json` (`options_ui`, `offscreen` if spike #2
  passes), `src/options/**`, `src/onboarding/**` (or tabs of one page),
  `src/popup/**`, `src/content/*` (indicators, chip, zen overlay, form
  grouping helper), `src/offscreen/**` (if needed), `demo.html`
- Shared token stylesheet (B-0) consumed by all extension HTML
- Remove/demote `src/recorder/**` from the happy path (per B-2)
- `/tests/e2e/browser-flow.spec.ts` updates if popup selectors change

## Acceptance criteria

- [ ] Feasibility spike #1 written up (options-page mic works / alternative
      documented **before** further UI build).
- [ ] Feasibility spike #2 written up (offscreen mic channel) **before** B-7/B-8
      build; fallback documented if it fails.
- [ ] Configuration page exists and can: grant mic, show Core/STT health,
      complete onboarding without the popup.
- [ ] **No secondary window in the configured happy path** — voice records
      inside the popup (B-7’s offscreen listener is invisible infrastructure,
      not a window); no `chrome.windows.create` for recording.
- [ ] On popup launch, the user sees **detected forms** (count + labels)
      before command entry; parse context can be scoped to a chosen form.
- [ ] **Active form** shows the 2–3 px indicator; other forms show the muted,
      slightly blurred variant; indicators clear on dismiss/submit.
- [ ] **Tap-to-talk works end-to-end:** tap form → first field focused +
      sound cue → speech fills fields sequentially; control vocabulary
      (next/back/check/submit) documented in onboarding.
- [ ] **Zen mode (if shipped in this item):** input list + guided pass;
      submit/dismiss restores the original page with no residue.
- [ ] **Tutorial launchable in one click** from the popup (“?”); auto-opens on
      first install; demo-form step completes the full loop; badge clears.
- [ ] **Design review:** B-0 rules visible on every surface (one accent, pill
      primary, single token file, light/dark parity) — checked against the
      table, not ad-hoc.
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
