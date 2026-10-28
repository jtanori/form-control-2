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
- ✅ **Architecture brief (stakeholder) — build past today’s constraints:**
  - **Chrome Side Panel API** as the persistent workspace (transcript,
    commands, form list, controls) — native docked panel tied to the tab;
    *not* a floating second window (consistent with the “no juggling” rule)
    and *not* the popup (dies on page interaction). Resolves the
    popup-closes-on-tap constraint that motivated spike #2.
  - **DOM isolation + SPA resilience for all injected UI:** Shadow DOM
    container on `document.body` (host CSS can’t leak in, our styles can’t
    leak out) + **MutationObserver** to re-apply indicators/focus rings when
    React/Vue CRMs tear the form down and rebuild it.
  - **Micro-interaction standards:** non-destructive focus rings (inset
    box-shadow + thin accent glow, no modals), in-field **`LISTENING…`**
    badge with animated wave dot, **live transcript preview** floating above
    the active element (catch misrecognitions pre-commit), and a **3-second
    floating confirm pill** for high-stakes actions (“Say ‘Confirm’ or click”)
    on top of the existing `confirmRequired` gate.

### Reference architecture & docs (stakeholder-provided)

1. Chrome **Side Panel API** —
   <https://developer.chrome.com/docs/extensions/reference/api/sidePanel>
2. MDN — **Using the Shadow DOM** —
   <https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM>
3. Chrome Extensions **best practices** (performance, layout shift,
   non-intrusive UX) —
   <https://developer.chrome.com/docs/extensions/get-started/best-practices>
4. Chrome Web Store **best practices** (trust, permissions posture) —
   <https://developer.chrome.com/docs/webstore/best-practices>
5. Community write-ups on **CSS/JS interference in extensions** (React/Tailwind
   + shadow roots inside content scripts).

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

Scope: **Side Panel workspace (B-2)**, popup, options/onboarding, zen panel
(B-8), helper chip + in-page cues (B-6/B-7).
Implementation: extend the existing `popup.css` custom-property tokens
(radius, spacing, shadow, blur, accent, muted) — one token file shared by all
extension HTML (popup, side panel, options, onboarding); do not fork styles
per surface. Light **and** dark parity via the existing
`prefers-color-scheme` block.

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

**B-1a. Microphone permissions — just-in-time flow (stakeholder brief)**

Architecture fact that drives the UX: **content scripts cannot call
`getUserMedia`**, and prompting from a surface that dies on focus (popup) or
on install is hostile. Canonical MV3 split:

| Layer | Role |
|---|---|
| **Side Panel or Options page** | *Requests* permission (persistent, extension-origin, prompt can’t “dismiss” the surface) with contextual value-first copy |
| **Offscreen document** (`chrome.offscreen`, reason `USER_MEDIA`) | *Captures* audio in the background once granted — the modern solution for recording/STT without a visible window |
| **Content script** | Never touches `getUserMedia`; only renders cues |

**Progressive-disclosure flow (never request on install):**

1. **Value before prompt** — first voice affordance (Side Panel / onboarding)
   explains *why* before the bubble:
   > “VoiceForm uses speech-to-text to fill complex CRM forms faster. We only
   > listen when you activate voice controls.”
   Single primary button: **“Enable Voice Control”**.
2. **Native prompt, contextual** — that button triggers
   `navigator.mediaDevices.getUserMedia({ audio: true })`; keep our own UI
   adjacent to where Chrome anchors the bubble (top-left / address bar / panel)
   so the prompt clearly belongs to us.
3. **Graceful denial** — never a dead end:
   > “Microphone access is currently blocked. Click the mic icon in the
   > address bar to allow access, or retry below.”
   with a **Re-check Permission** button (`navigator.permissions.query` +
   re-request). Denial state persists visibly (muted mic + banner), typed path
   always available.

**Manifest/checklist:** declare `offscreen` (and `activeTab` where it suffices)
— no blanket host permissions for audio; **never** `getUserMedia` on install;
hot-mic state always visible; fallback path for blockers (above).

**B-2. Side Panel = the persistent runtime workspace (replaces popup-as-primary)**

*Stakeholder architecture brief — supersedes the earlier “popup-only” idea.*

- **`chrome.sidePanel`** (manifest `side_panel.default_path`, open from the
  toolbar icon / action click per `sidePanel.setPanelBehavior`):
  - Native panel **docked to the tab** — persists across page clicks, scrolls,
    and site re-renders; *not* a floating window the user must babysit (still
    honors the “no juggling” rule), and *not* the popup (which dies on any
    page interaction — so tap-to-talk, live transcript, and command review can
    live here).
  - Hosts: form list (B-3), transcript + **live preview**, command cards +
    Confirm (keep E2E hooks — decide whether E2E drives popup or panel; the
    Confirm gate stays either way), health strip, session/settings entry.
- **Popup shrinks to quick entry**: open side panel, last status, “?”, typed
  one-shot field (E2E may stay on popup if cheapest — call it in spike #1).
- **Mic home:** prefer **Side Panel for `getUserMedia`** (extension-origin,
  prompt doesn’t destroy the surface) with options page (B-1) as the explicit
  setup path; **spike #2 revised** — evaluate side panel *and* offscreen
  `USER_MEDIA` as the listener for page-tap flows (B-7), pick the smallest
  mechanism that passes; document in audit.
- Delete `recorder.html` from the happy path (dead once panel+options exist).

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
- **Isolation (hard requirement):** every in-page visual lives in a single
  **shadow-DOM host** appended to `document.body`
  (`container.attachShadow({ mode: 'open' })` → render cue layer inside).
  Host CRM CSS cannot restyle our pills/rings; our tokens cannot leak into
  the page. Blueprint: stakeholder brief §2.
- **SPA resilience (hard requirement):** a **MutationObserver** watches
  `document.body` (route/step re-renders in React/Vue CRMs) and **re-applies**
  indicators, focus rings, chip, and aria hooks the moment the form DOM is
  rebuilt. Indicator state (active form id + node ids) lives in the SW/side
  panel so re-apply is automatic, not user-driven.
- Anchor strategy: host node on `document.body`, position overlays to the
  form’s viewport rect; `pointer-events: none` on decorative layers; fall back
  to `outline` on the `<form>` only when simpler.
- Clears on: dismiss, submit, unmount; follows selection changes from B-3.
- Zen mode (B-8) may dim everything except the active form further.

**B-7. Tap-to-talk initiation (how filling starts, and with what)**

- **Helper chip** anchored to the active form: “Tap and talk to start filling
  your form” (Apple-style pill, soft material, dismissible, shadow-DOM).
- **Tap anywhere on the form** (or the chip) → focus the **first interactive
  field**, apply the **non-destructive focus ring** (smooth inset box-shadow +
  thin accent glow — never a blocking modal; B-0), play a **soft start sound**
  (WebAudio cue — no bundled asset), and begin listening **on the Side Panel /
  offscreen channel** (spike #2), *not* in the popup.
- **While talking, fields fill sequentially:** utterance → fill focused field →
  advance focus → next utterance. (Phrase-level loop first; true streaming
  partial-fill is stretch — spec it, don’t block on it.)
- **In-field micro-feedback (hard requirement):**
  - tiny **`LISTENING…`** badge inside the active input with an animated
    sound-wave dot (styled in shadow DOM; must not alter the field’s stored
    value or fire spurious input events);
  - **live transcript preview** floating just above the active element so the
    user catches misrecognitions **before** committing (replaces text on
    accept; Esc/discard undoes).
- **Controls** (buttons/checkbox/selects/links) get **navigation &
  activation instructions**, surfaced in the helper + onboarding:
  “next / back” (virtual cursor), “check / uncheck”, “select …”, “submit /
  continue”. Map to existing `NAV_*` + command actions — no new NLU verbs
  beyond what CORE-001 already parses unless the audit proves a gap.
- **High-stakes safety cushion (hard requirement):** submitting, clearing, or
  other `confirmRequired` actions never fire on voice alone — a temporary
  **floating action pill**: *“Voice command: ‘Submit registration’ — say
  **Confirm** or click to execute”* with a **3-second** window (counts down,
  Esc/timeout cancels). Stacks on top of the existing Confirm gate (E2E keeps
  asserting an explicit confirm step).
- **“Always know you’re heard” (hard requirement, stakeholder brief):**
  - **Idle vs listening states:** idle mic = subtle/muted; listening = soft
    glowing panel border + waveform (in-field badge above) — one glance tells
    hot vs cold.
  - **Audio chimes:** ultra-subtle start **and** stop blips (WebAudio) so
    recognition boundaries are never a guess.
  - **Global kill switch:** Esc (and a persistent mute button in the Side
    Panel) instantly stops recognition — unmissable, always available.

**Feasibility spike #2 (revised — gates B-7/B-8):** interacting with the page
closes the popup, so the listener cannot live there. Content scripts can
**never** call `getUserMedia` (platform rule). Per B-1a the canonical split is:
permission **requested** from Side Panel/Options (persistent surface),
audio **captured** by an **offscreen document** (`chrome.offscreen`, reason
`USER_MEDIA`, Chrome 109+). Evaluate, in order:
1. **Offscreen capture** after Side Panel/Options grant (the modern default —
   verify prompt attaches to a surviving surface and capture continues while
   the user clicks the page);
2. **Side Panel itself as capture host** — only if offscreen proves
   insufficient (e.g. latency), since offscreen keeps audio headless.
Verify: grant reuse without re-prompt, capture continuity during page
interaction, latency acceptable for sequential fill, SW lifetime rules,
`offscreen` manifest permission posture (QA-001-compatible).
**Document the winner (or the failure + alternative) in `docs/ux-audit.md`
before building B-7/B-8** — same rule as spike #1; still no user-visible
floating second window.

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

1. **Spike #1:** options-page `getUserMedia` + persisted grant (+ decide
   whether E2E stays on popup or moves to side panel) → note in audit.  
2. **Spike #2:** Side Panel vs offscreen `USER_MEDIA` as page-tap listener →
   note in audit (gates B-7/B-8).  
3. **Side Panel workspace (B-2)** + manifest `side_panel`; popup demoted to
   quick entry; shared shell with options/onboarding.  
4. `options.html` (B-1) + manifest `options_ui`.  
5. **Shadow-DOM cue layer + MutationObserver re-apply** (B-6): active/muted
   form indicators survive SPA re-renders.  
6. Form identification panel (B-3) as first block of the side panel.  
7. **Tutorial (B-5):** `onboarding.html` + `onInstalled` + popup “?” + demo
   page + badge; desk-research reality check appended to audit.  
8. **B-7 tap-to-talk** on the spike-#2 channel (chip, focus ring, sound,
   sequential fill, `LISTENING…` badge, live transcript, 3 s confirm pill,
   control instructions); **B-8 zen panel** if spike holds.  
9. **B-0 design pass** across side panel/popup/options/onboarding/zen: token
   file, pill controls, one accent, light/dark.  
10. Copy/error pass; context-menu silent-log fix if touched.  
11. E2E: existing flow green on chosen surface; recorder-window tests → new
    path; optional form-list + indicator assertions.

## Files & deliverables

- `/docs/ux-audit.md` — direction update + both spike write-ups + research
  appendix (final pattern choice)
- `/extensions/browser/manifest.json` (`side_panel`, `options_ui`, `offscreen`
  only if spike #2 needs it), `src/sidepanel/**`, `src/options/**`,
  `src/onboarding/**`, `src/popup/**`, `src/content/*` (shadow-DOM cue layer,
  MutationObserver, form grouping, zen overlay), `src/offscreen/**` (if
  needed), `demo.html`
- Shared token stylesheet (B-0) consumed by all extension HTML
- Remove/demote `src/recorder/**` from the happy path (per B-2)
- `/tests/e2e/browser-flow.spec.ts` updates for chosen surface + selectors

## Acceptance criteria

- [ ] Feasibility spike #1 written up (options-page mic works / alternative
      documented **before** further UI build).
- [ ] Feasibility spike #2 written up (side panel vs offscreen) **before**
      B-7/B-8 build; fallback documented if both fail.
- [ ] Configuration page exists and can: grant mic, show Core/STT health,
      complete onboarding without the popup.
- [ ] **Mic is never requested on install** — value-first copy + single
      “Enable Voice Control” action triggers the prompt (B-1a); denial shows
      the non-punitive banner + **Re-check Permission**, typed path intact.
- [ ] Manifest declares only needed perms (`side_panel`, `options_ui`,
      `offscreen` if used, `activeTab` where it suffices) — auditable under
      QA-001 rules.
- [ ] **Hot-mic is always visible:** idle vs listening states, start/stop
      chimes, Esc + Side-Panel mute kill switch (B-7).
- [ ] **Side Panel hosts the runtime flow** (form list, transcript, cards,
      Confirm) and **persists across page interaction**; no user-managed
      floating window anywhere.
- [ ] On launch, the user sees **detected forms** (count + labels) before
      command entry; context scoped to a chosen form.
- [ ] **Active form** shows the 2–3 px indicator; other forms show the muted,
      slightly blurred variant — **and both re-apply after a simulated SPA
      form re-render** (MutationObserver test or manual note).
- [ ] **All in-page UI renders inside a shadow root** — verified no style
      leak in either direction (spot-check against a CSS-reset host page).
- [ ] **Tap-to-talk works end-to-end:** tap → focus ring + sound → sequential
      fill; **`LISTENING…` in-field badge** + **live transcript preview**;
      control vocabulary documented in onboarding.
- [ ] **High-stakes actions show the 3-second confirm pill** (say Confirm /
      click) in addition to the programmatic Confirm gate.
- [ ] **Zen mode (if shipped in this item):** input list + guided pass;
      submit/dismiss restores the original page with no residue.
- [ ] **Tutorial launchable in one click** (popup “?”), auto-opens on install,
      demo-form full loop, badge clears.
- [ ] **Design review:** B-0 rules visible on every surface — checked against
      the table, not ad-hoc.
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
