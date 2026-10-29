# UX-003-R — Spec reconciliation (speakalika v1.0 × current implementation)

- **Epic:** [#54 UX-003](https://github.com/jtanori/form-control-2/issues/54) · item **#59**
- **Source:** `speakalika/voiceform_universal_multi_surface_spec.md` (v1.0) + design board + showcase HTML — to be vendored by UX-003-C into `contracts/design/`
- **Rules applied:** decision register **D1–D12** (epic body). This document is the **review gate** before contracts (D7).
- **Verdicts:** **Adopt** = implement as specified · **Simplify** = take the intent, shaped to our codebase · **Defer** = deferred register / future track.

---

## 1. Decision register (copy, binding)

| # | Decision |
|---|---|
| D1 | 3s Confirm gating, authorization IDs, fingerprint revalidate, voice-“Confirm” → **deferred**; current pill stays |
| D2 | Execution read-back verification → **deferred to future discussion** |
| D3 | Typed events / FSM / `VoiceSession` / stale-event discipline → **deferred** |
| D4 | Partial/live streaming transcript → **deferred post-MVP** |
| D5 | Spec-vs-implementation conflicts or non-UX-appropriate proposals → **defer per-row below** |
| D6/D9 | Token migration = **clean `--vf-*` break**, no legacy aliases |
| D7 | Order: Reconciliation → Contracts → P-phases |
| D8 | **E2E hooks hard guardrail** (`.card`, `.cmd-title`, `Confirm`, `Executed`, sidepanel surface) |
| D10 | Start-voice gating on form selection; **page-tap tap-to-talk stays** as parallel entry |
| D11 | History nav adopt-lite; **auto-defer post-MVP on friction**; Settings ships |
| D12 | **Manual suite = QA gate** (per-item reasons allowed; CI never overrides) |

**Deferred register:** D1 (countdown/auth/voice-Confirm) · D2 (read-back) · D3 (FSM/events) · D4 (streaming) · QA-010→014 · target-fingerprint invalidation.

---

## 2. Section-by-section reconciliation

### §1 Design system

| Spec proposal | Verdict | Notes / current anchor |
|---|---|---|
| §1.1 visual principles | **Adopt** | ≡ our B-0; wording already merged in UX-001 |
| §1.2 color tokens (light/dark, accent ramp, semantic) | **Adopt** | Replace hand palette in `src/ui/tokens.css` (UX-003-C) |
| §1.3 type scale (`vf.type.*`) | **Adopt** | Currently implicit sizes in popup.css → named tokens |
| §1.4 spacing (4px base) | **Adopt** | Same sweep |
| §1.5 radius/elevation/material | **Adopt** | `--vf-radius-card/sheet/pill`, shadow recipes replace ad-hoc `box-shadow` |
| §1.6 focus/selection (2px inset + glow) | **Adopt** | Executor focus restyle yellow-dashed → accent inset ring (P1) |
| §1.7 CSS custom properties | **Adopt** | Canonical `tokens.css` (D6/D9) |
| §1.8 Compose mapping | **Adopt → P3; mismatch filed** | Dark `onPrimary=#0B0F14` in spec vs `on-accent=#FFFFFF` in tokens.json is tracked as UX-003 child #68; resolve canonically before visual sign-off. Triage: `P1`, `backlog`, `post-mvp`, `design`, `agent-mobile`, `accessibility`; milestone `Post-MVP` (GitHub edit permission pending). |
| WCAG contrast verification note | **Adopt (checklist)** | GATE manual rows |

### §2 Component catalog (20)

| Proposal | Verdict | Notes |
|---|---|---|
| Naming `VF/*` + “components expose tokens” | **Adopt (map)** | `components-map.md`: class-level mapping, no framework |
| Shared interaction states (§2.2) | **Adopt** | focus/pressed/disabled via tokens; loading states where we have async actions |
| `Button/PrimaryPill`, `SecondaryGhostPill` | **Adopt (have)** | `vf-btn.primary` / `vf-btn` — resize to ≥44px targets |
| `Status/Dot`, `Status/Chip` | **Adopt (have)** | `vf-dot`, `vf-pill` — ensure label pairing (never color-only) |
| `Input/TextField` | **Adopt (have)** | popup/options inputs → tokenized; visible-label rule for options |
| `Control/Segmented` (All/Web/Native) | **Simplify → Ditch** | No use case in our surfaces (D5) |
| `Row/FormItem` | **Adopt (have)** | FormList rows; add source context line (host label) per §2.3 |
| `Command/ActionCard` | **Adopt (have)** | `.card/.cmd-title` = E2E hooks (D8); enrich anatomy (value row) cosmetically **without renaming hooks** |
| `Safety/ConfirmPill` | **Simplify** | Keep current pill: visible countdown **text** only; **no** enabled-gating (D1); copy from bank |
| `Status/ListeningBadge` | **Adopt (have)** | 1,600 ms pulse (motion token) + aria once (not per frame) |
| `Transcript/PreviewBubble` | **Simplify** | Final-transcript variants only (D4); debounce n/a until streaming |
| `Control/HelperChip` | **Adopt (have)** | copy-bank wording |
| `Sheet/Zen` | **Adopt (simplified)** | P2 scope; web drag handle dropped (D5) |
| `Permission/BlockedBanner` | **Adopt (have)** | options denial banner ≡ anatomy |
| `Health/HealthStrip` | **Adopt (new)** | P1: panel + options; re-ping on open (no stale “Healthy”) |
| `Overlay/DragHandle` | **Adopt → P3 (Android only)** | Android overlay already drags via header; formalize per spec |
| `Progress/SegmentedProgress` | **Adopt (new, light)** | options 3-step dots + zen n/N (text “Step 2 of 3” required) |
| `Feedback/InlineError` | **Adopt (light)** | copy keys + bubble-adjacent placement (Simplify vs strict adjacency) |
| `Control/IconButton` | **Adopt (have)** | 44px, `x` = dismiss never confirm (already true) |
| `Control/DisclosureRow` | **Adopt (have)** | options `<details>` ≡ disclosure |

### §3 State machines & session model

| Proposal | Verdict |
|---|---|
| §3.1 setup FSM (welcome→permission→health→demo→ready) | **Simplify (P1)** | Our options keeps 3 cards; add step labels/progress/copy; **in-wizard mic demo loop ditched** — demo = open `demo.html` + sample command (spec blesses local/sample demo) |
| §3.2 tap-to-talk FSM + guard column | **Defer full FSM (D3)**; **Adopt copy** | States we already emit; copy keys applied in P1. Attempt IDs/stale-event guards deferred |
| §3.3 confirm pill FSM (COUNTDOWN_3 gating, auth IDs) | **Defer (D1)** | Current pill stays |
| §3.4 zen FSM | **Adopt simplified (P2)** | speak/next/back/review/dismiss; submit → current pill |
| §3.5 `VoiceSession` + authorization model | **Defer (D1/D3)** | Future validation track |

### §4 Copy bank

| Proposal | Verdict |
|---|---|
| §4.1–4.5 keyed EN copy | **Adopt filtered** | ~40 keys we surface → `copy.json` (C); applied P1/P2. Payment/delete-specific keys kept only if risk regex keeps them |

### §5 Motion & sound

| Proposal | Verdict |
|---|---|
| Motion tokens + easing + reduced-motion | **Adopt** | P1 |
| Listening pulse 1,600 ms | **Adopt** | replace 1.2s blink |
| Sound cues (start/stop; optional completion) | **Adopt start/stop spec shape**; completion blip **optional — skip** (D5: ornamental) | Android ToneGenerator start/stop cues are P3; M32 manual device verification remains |
| Mute/respect OS prefs + visual-always-sufficient | **Adopt** (visual status already primary) |

### §6 Surfaces

| Spec | Verdict | Notes |
|---|---|---|
| §6.1 Side Panel order + frame contract | **Adopt, simplified** | header → forms+count → **Start voice gated on selection (D10)** → command area → zen row → **HealthStrip** → nav **Settings (open options)** + **History-lite (D11)** from `GET /api/v1/session/{id}`; **drop header `[x]`**; page-tap + typed entries stay (D10/D8). Residual audit: registry and active-form selection are scoped to the current tab; tab changes clear stale selection/cues; parse, clarify, execute, and approvals retain the originating tab. See M08/M15. |
| §6.2 Options wizard + in-wizard demo loop | **Simplify** | 3 cards + “Step n of 3” + dots + copy; **demo loop in-wizard ditched** (duplicate of panel flow; demo.html path instead); health strip adopted |
| §6.3 In-page cues | **Adopt adjusted** | field-anchored LISTENING/preview; accent inset ring (§1.6); no full-page scrim (already true); SPA re-apply (have) |
| §6.4 Zen sheet | **Adopt simplified (P2)** | n/N, Speak/Next/Back, final review list, dismiss; **no** voice-Confirm (D1), web drag handle dropped |
| §6.5 Mini popup | **Adopt** | mic launcher + form-count chip + `? Setup`; never a workspace (true today) |
| §6.6 Android overlay collapsed | **Adopt → P3** | AND-006 |
| §6.7 Android overlay expanded | **Adopt → P3** | Back precedence §8.3; field-scoped tap-to-talk/HUD, field outline, and start/stop cues. True active-form grouping/other-form dimming is tracked in child #69; auth-invalidation bullets marked D1-deferred. Triage for #69: `P1`, `backlog`, `post-mvp`, `agent-mobile`, `accessibility`; milestone `Post-MVP` (GitHub edit permission pending). |
| §6.8 Android setup | **Adopt → P3** | Checklist with 3-step progress dots, persisted denied-mic recovery, overlay/Core checks, and copy alignment |

### §7 Component↔surface mapping
**Adopt** as living checklist inside `components-map.md` (C).

### §8 Accessibility, privacy, compliance

| Proposal | Verdict |
|---|---|
| 44px/48dp targets, focus order, SR single announcements, reduced motion, zoom | **Adopt (cheap wins in P1; full audit in GATE)** |
| Privacy rules (local detection, no install mic, ephemeral transcripts, redact logs) | **Adopt — verify**: per-tab context scoping and log redaction hardened in residual audit; M29 remains a runtime sanity check (no transcript or field values in logs) |
| §8.3 Android Back precedence / confirmation ownership | **Adopt → P3 + web audit** | Android Back cancels active work before collapsing; web confirmation approval is tied to the originating tab, never a mutable last-active tab. Verify M15/M31/M33/M34 |

### §9 Engineering notes
| Proposal | Verdict |
|---|---|
| Controller/adapters layering, typed events, idempotency+read-back, fingerprint re-resolve | **Defer (D2/D3)** | Architecture note for future validation epic; current SW/bridge stands |

### §10 QA matrix
**Adopt minus D1:** automate QA-001–009, 015–024 where feasible (P4); **manual** rows map into `tests/manual/QA-GATE.md` M-ids; **QA-010–014 excluded (D1)**.

### §11 Guardrails / §12 build checklist
**Adopt** — §12 becomes PR template content (P4); §11 do/don’t enforced by D-register + review.

---

## 3. Current-vs-spec delta (documentation only — D3)

| Ours today | Spec | Action |
|---|---|---|
| phase: idle/recording/transcribing/parsing/ready/clarifying/executing (popup+voice) | §3.2 richer FSM w/ guards | keep ours; copy aligned in P1; FSM deferred |
| pill: countdown label, click always allowed | §3.3 gated confirm | **D1 defer** |
| success = executor OK | §9.3 verified read-back | **D2 defer** |
| no attemptId/session events | typed events + stale drops | **D3 defer** |
| final STT only | partial+final | **D4 defer** |

---

## 4. Sign-off

- [ ] Stakeholder approves this reconciliation (gate for UX-003-C)
- [ ] Open questions (if any) resolved in comments on #59
