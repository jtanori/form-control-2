# UX-001 Phase A + B — Extension UX Audit & Proposed Model

- **Item:** [`backlog/post-mvp/UX-001`](../backlog/post-mvp/UX-001-extension-ux-audit-redesign.md) · [issue #41](https://github.com/jtanori/form-control-2/issues/41)
- **Scope:** browser extension surfaces only (Android overlay adoption is a Phase C optional handoff)
- **Inputs:** source as of `v0.1.0-mvp` + mic recorder-window fix (#40); dogfooding notes from the first real session
- **Status:** Phase A ✅ · Phase B ⚠️ **revised by stakeholder direction — see below** · Phase C ⏳

> **⚠️ Direction update (stakeholder, on #41) — read first**
>
> The **persistent secondary “Stage” window proposed in Phase B is rejected**:
> two-window focus while filling a form is harder than filling by hand.
> The target model is now:
> 1. **Configuration page** (Chrome `options_ui`, full tab) = the only setup
>    surface — mic setup, Core health, onboarding. Feasibility spike required
>    (options-page `getUserMedia` + persisted grant; if impossible, document an
>    alternative here **before** building more UI).
> 2. **Popup = the only runtime surface** — records inline once permission is
>    granted; missing permission → CTA to the options page, never a companion
>    window. `recorder.html` leaves the happy path.
> 3. **Launch = form identification first** — detect/group the page’s forms,
>    show them (“Checkout — 6 fields”), then accept voice/typed commands scoped
>    to the chosen form.
> 4. **Quick learning/tutorial** — one-click launch from the popup + auto-open
>    on first install (welcome **tab**, not a popup modal); includes a safe
>    **demo-form** full-loop step. Pattern research table lives in the UX-001
>    item; reality-check against shipped extensions is a Phase C task.
> 5. **Active-form indication** — accent 2–3 px border on the handled form;
>    other detected forms muted border + slight blur (attention, not hiding).
> 6. **Tap-to-talk** — in-form helper chip → tap focuses first field + sound
>    cue → sequential voice fill; control vocabulary (next/back/check/submit).
>    Requires **spike #2: offscreen `USER_MEDIA` document** (popup closes on
>    page interaction, so listening cannot live there).
> 7. **Zen / reading mode (exploratory)** — quiet overlay guiding through the
>    form’s inputs; submit/dismiss restores the original page. Likely host for
>    #6’s interaction loop.
> 8. **Design language: Apple-inspired simplicity** — B-0 table in the UX-001
>    item: one accent, grayscale rest, pill controls, material/blur surfaces,
>    typography-as-hierarchy, progressive disclosure, calm motion; single token
>    file across popup/options/onboarding/zen, light + dark.
>
> Phase A (map, scores, friction, constraints) still stands. The “Console +
> Stage” write-up below is retained as the superseded draft for traceability.

---

## Phase A — Current-state map

### Surfaces

| # | Surface | How you get there | Role today |
|---|---|---|---|
| S1 | **Action popup** (`popup.html`, React) | toolbar icon | hub: mic ●, cursor ←→🔊, typed command, command cards, clarify, status, Core URL (collapsed) |
| S2 | **Voice window** (`recorder.html`, vanilla) | popup ● → `chrome.windows.create` | record → transcribe → parse → confirm → execute; permission prompt lives here |
| S3 | **Page content script** | auto on every page | executes commands; yellow/green highlights; silent unless executing |
| S4 | **Context menu** “VoiceForm: capture page form” | right-click page | logs capture only — **no user-visible feedback** (dead-end) |
| S5 | **Background SW** | invisible | bridge, queue; only visible as JSON logs in `chrome://extensions` → service worker → console |

### S1 popup — control inventory

| Control | Copy / affordance | Notes |
|---|---|---|
| `●` (mic style) | title “Open the voice window…” | Looks like record; actually **launches another window** — surprise |
| `←` `→` `🔊` | titles only | Virtual cursor; result lands in the status line as `[#2] country` — cryptic, easy to miss |
| Transcript box | “● opens the voice window — or type a command below…” | Doubles as hint + output; empty-state only |
| input + **Parse** | “Type a command…” | Works; primary path for T1 |
| Command cards | `fill · email address`, badge `confirm` | Editable fill values; **Confirm/Cancel/Reset** row appears only after parse |
| Clarify panel | “Clarification: {question}” | Only when `phase === "clarifying"`; separate **executor-ambiguity** panel uses candidate buttons instead — two different ambiguity UIs |
| Status line | mixed raw/domain copy | see error table |
| `▸ Core URL` details | collapsed | invisible until discovered; no health indicator |
| header `sess-…` | truncated id, full in `title` | no explanation of what a session is |

### S2 voice window — states

`listening (● pulsing) → Transcribing… → Parsing… → [clarify | cards+Confirm | no-match] → Executed…`

Permission failure adds **Ask again** + **Open mic settings** (added in #40).

### S1 phases (code)

`idle | recording | transcribing | parsing | ready | clarifying | executing` — several are now **vestigial** after the mic moved to S2 (`recording`/`transcribing` no longer reachable from the popup; still in the `Phase` union and set when the voice window merely *opens*).

### Walkthrough scores (no external docs; 1 = fails unaided, 5 = effortless)

| ID | Task | Score | What happens today |
|---|---|---|---|
| **T1** | Typed command → confirm → fill | **4** | Parse → cards → Confirm works; discoverable. Half point lost: no example transcript, cards appear below status (easy to miss Confirm) |
| **T2** | Voice end-to-end incl. permission | **2** | ● opens an *unexpected* second window; prompt copy now helps (#40) but mental model of “popup vs window” is unexplained; user reported confusion verbatim |
| **T3** | Recover from Core/STT down | **2** | Errors are raw (`core parse -> HTTP 502 …`, `Transcription failed`) with no “is my stack up?” affordance; health only via curl |
| **T4** | Ambiguous target → clarify | **3** | Two mechanisms (core clarify input vs executor candidate buttons) in two surfaces — works but inconsistent; recorder only has core-clarify |
| **T5** | Change Core URL / see session | **2** | Hidden in `<details>`; no ping/status; session id unexplained |

**Cold-user pass (T1+T2 without docs): fails on T2 today.**

### Friction log

| ID | Symptom (observed) | Root cause |
|---|---|---|
| F1 | “Confused by the UI, didn’t know what to do” | No onboarding; empty state lists actions but not the *goal*; two surfaces compete |
| F2 | Mic “Permission dismissed” storm | **Mechanical**: popup closes on prompt focus (fixed by S2 window). **Copy**: pre-fix string was raw; post-fix still jargon-y if permission already denied |
| F3 | “Is the mic broken or did I do it wrong?” | Site mic grants ≠ extension grants — we explain only *after* failure, in S2 |
| F4 | Results in wrong window | Flow starts in S1, completes in S2, user still looking at popup (“Voice window opened” status only) |
| F5 | Cursor buttons feel random | No labels, output is `[#n] …`, never mentioned in empty state |
| F6 | Context-menu item does nothing visible | Logs only — trust leak |
| F7 | Status line is a mixed channel | loading + success + errors + cursor output + session hints in one 12px line, no icons/structure |
| F8 | Two ambiguity UIs | Core `clarificationQuestion` vs executor `candidates` buttons — different containers, different copy |
| F9 | `recording` phase lies in popup | Phase union not pruned after #40 — code smell that will confuse the next contributor too |

### Constraints ledger (cannot violate)

| Constraint | Source | UX consequence |
|---|---|---|
| Action popup **closes on focus loss** | Chrome | Mic prompt + any modal must live in a non-popping context (S2 or content) |
| Permission prompt is per **extension origin**; site grants don’t apply | Chrome | Onboarding must say so *before* first ● |
| E2E asserts `.card`, `.cmd-title`, `Confirm`, status contains `Executed` | `tests/e2e/browser-flow.spec.ts` | Keep these hooks or update E2E in the same PR; confirm-gate must stay |
| MV3 SW may sleep; messages via `chrome.runtime` | Chrome | No in-SW UI state; UI state must live in storage or pages |
| `host_permissions` = Core `:8020` only; no `<all_urls>` hosts | QA-001 | Health checks limited to Core origin; settings deep-link is `chrome://` (tab create may be blocked → copy-paste fallback already coded) |
| Confirm-before-execute is a **product safety rule** | EXT-003 / G3 | Never collapse confirm for “speed” |
| Typed fallback must remain when STT missing | STT-001 handoff | Don’t make mic the only path |

---

## Phase B — Proposed model (“what should be”)

### B1. One mental model: **“Console + Stage”**

| Surface | Name (user-facing) | Job |
|---|---|---|
| Popup S1 | **Console** | always-open-able status hub: current step, last transcript, health dot, typed entry, settings. *Never starts the scary part.* |
| Voice window S2 | **Stage** | the single place where voice flows (listen → review → confirm → done). Auto-focus; one primary button per step. |

Alternative considered: merge everything into the popup — **rejected**: Chrome will keep closing it (F2/F4 recur). Merge everything into one always-on window — rejected for v1 (window fatigue); revisit if usage shows S1 is redundant.

**Rule:** the Console *launches* the Stage and mirrors its state live (via `chrome.storage.session` key `stageState`, which both sides already share infrastructure for).

### B2. First-run onboarding (dismissable, 3 steps, localStorage)

1. **Mic** — “VoiceForm needs its own microphone permission (not the site’s). We’ll open the voice window; click Allow once.”
2. **Stack** — health dots for Core + STT (ping `GET /api/v1/health`); fix Core URL inline if red.
3. **Safety** — “Nothing runs until you press Confirm.” + one sample typed command to copy.

Shown when `onboarded` flag unset; re-openable from a “?” button.

### B3. Shared state machine (one vocabulary, both surfaces)

```
idle → listening → transcribing → parsing → reviewing → executing → done
                 ↘ needs_input (clarify | permission | no_match | error)
```

- **Copy table** (single module, e.g. `src/ui/copy.ts`): every phase/status/error has `{ title, body, cta }`.
- Popup shows the **mirror** (“Stage: reviewing — 2 commands waiting” + “Open” button); Stage shows controls.

### B4. Error voice (map of today → target)

| Today (raw) | Target copy | CTA |
|---|---|---|
| `Mic unavailable: Permission dismissed…` | “Microphone not allowed for VoiceForm yet.” | **Allow microphone** (opens Stage) |
| `core parse -> HTTP 502 …` | “Can’t reach VoiceForm Core at localhost:8020.” | **Retry** + **Check Core URL** (show health) |
| `Transcription failed` | “Couldn’t turn speech into text.” | **Try again** / **Type instead** |
| `no node matches "…"` | “No field matched that instruction on this page.” | **Try different wording** |
| `ambiguous target …` (executor) + separate clarify box | “Did you mean:” + candidates **or** question — **one component** on both surfaces | buttons |
| `Executed N command(s)` | “Done — ran N step(s).” + checkmark | **Record again** / close |
| `session…` header | drop from primary UI; keep in details “Diagnostics” with copy button | — |

### B5. Information architecture (popup/Console, top → bottom)

1. **Health strip** (● Core · ● STT · mic status) — always visible, click = details  
2. **Last result / current phase** (mirror of state machine, icon + title + body)  
3. **Primary actions**: `Start voice` (launches Stage) · typed input + Parse  
4. **Review cards** (existing `.card`/`.cmd-title`/Confirm — E2E contract)  
5. **Details**: session, Core URL, cursor tools (moved out of the main row; tooltip explains virtual cursor)  
6. **?** onboarding replay  

Cursor ←→🔊 demoted to Details (or a “Page tools” popover) — they’re power features (F5).

### B6. Voice window/Stage chrome

- Title = phase (“Listening…”, “Review commands”), not a static “VoiceForm — Listening”
- Primary button morphs: ● stop → spinner → list → **Confirm**
- Permission education **before** first `getUserMedia` (one sentence + Continue), so the prompt has context (F3)
- Same card/Confirm component as Console (F8)

### B7. Visual system

- Keep existing CSS custom properties; add tokens for: status colors (ok/warn/error/muted), spacing scale, radius, focus ring
- Both surfaces consume the same stylesheet (Stage already links `popup.css`) — extract shared rules, delete the recorder-only duplicate where possible
- Light/dark parity via existing `prefers-color-scheme` block; verify Stage in dark

### B8. Out of scope / later

- Android overlay adoption of B3/B4 copy (handoff, optional)
- Full redesign of E2E-visible DOM (only additive changes preferred)
- Branding/marketing polish beyond tokens

---

## Phase C checklist (next PR)

- [ ] Extract `src/ui/copy.ts` + shared state enum; prune dead popup `Phase` values (F9)
- [ ] Health strip + onboarding (B2) in Console
- [ ] Stage: pre-permission sentence (B6), title=phase
- [ ] Unify ambiguity component (F8)
- [ ] Demote cursor tools; move session/URL into Details (B5)
- [ ] Context menu → show toast/notification instead of silent log (F6)
- [ ] Error copy pass per B4 table (grep `setStatus` to prove none remain raw)
- [ ] E2E green (hooks unchanged) + typecheck + unit
