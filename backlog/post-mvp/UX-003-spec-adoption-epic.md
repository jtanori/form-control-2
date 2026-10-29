# UX-003 — [EPIC] Multi-Surface Spec v1.0 Adoption & UX Alignment

- **Phase:** Post-MVP
- **Track / Agent:** Agent B — Extension / Frontend (+ design ops, Agent C for Android child)
- **Priority:** P1
- **Status:** ready (approved plan; execution = sub-issues below)
- **Depends on:** UX-001 C1/C2 (shipped), `speakalika` spec package (design source), AND-001…005, STT-001
- **Supersedes:** UX-001 residuals, UX-002 (generation pipeline), parts of AND-006 scope refit (kept as child)
- **Critical path:** No — quality/alignment track (blocks its own close via the manual gate)
- **Milestone gates:** none of G1–G4 directly; **D12 manual gate** required to close this epic
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/54
- **GitHub labels:** `backlog`, `post-mvp`, `P1`, `design`, `epic`
- **GitHub milestone:** Post-MVP

## Source of truth

Design/UX source = the **`speakalika` package** (multi-surface spec v1.0 MD +
design board PNG + showcase HTML), to be vendored under `contracts/design/`
by item **UX-003-C**. Gemini/ChatGPT remain only a *future refresh* channel
(see deferred register) — the spec baseline wins.

## Decision register (binding for all children)

| # | Decision |
|---|---|
| D1 | 3s Confirm gating, authorization IDs, fingerprint revalidate, voice-“Confirm” → **deferred** (“validation extractor & mapper” future track; not MVP). Current pill stays. |
| D2 | Execution read-back verification → **deferred to future discussion** (current success = executor OK). |
| D3 | Typed events / FSM / `VoiceSession` / stale-event discipline → **deferred (follow-up discussion).** |
| D4 | Partial/live streaming transcript → **deferred post-MVP nice-to-have.** |
| D5 | Any spec point conflicting with our implementation or common-sense UX → **defer to future analysis** (per-item in reconciliation). |
| D6 | Token migration = **clean break to `--vf-*`** (no legacy vars). |
| D7 | Order: **Reconciliation → Normative contracts → P-phases.** |
| D8 | **E2E hooks are a hard guardrail** (`.card`, `.cmd-title`, `Confirm`, `Executed`, sidepanel surface). |
| D9 | Clean token break **confirmed**. |
| D10 | **Start-voice gating confirmed**; page-tap tap-to-talk stays as parallel entry. |
| D11 | History nav = adopt-lite; **auto-defer post-MVP on friction**. Settings nav ships. |
| D12 | **Manual test suite (`tests/manual/`) = QA gate** – implemented as a **side‑panel UI** with per‑session **JSON log** (`run‑log‑<timestamp>.json`). Passes only on a completed run **or** per‑item valid reasons. CI green never overrides an incomplete manual run. PR workflow uses **Option B** (edit Draft #67). |

**Deferred register (carry everywhere):** D1 (countdown/auth/voice-Confirm) ·
D2 (read-back) · D3 (FSM/events) · D4 (streaming) · QA-010→014 ·
target-fingerprint invalidation.

## Sub-issues (execution units)

| Item | Title | Depends | Summary |
|---|---|---|---|
| **UX-003-R** | Reconciliation + manual suite v1 | — | `docs/spec-reconciliation.md` (Adopt/Simplify/Defer per spec section, D-register applied); `tests/manual/` (README, `QA-GATE.md` M01–M36, `coverage-matrix.md`); 3 fixtures (`multi-form`, `ambiguous-labels`, `spa-rerender`); backlog amendments. **Gate:** your review before contracts. |
| **UX-003-C** | Normative contracts | R | `contracts/design/`: vendored `spec-v1.md` + `showcase.html`, `tokens.json`, **`tokens.css` `--vf-*` (D6/D9)** + hex sweep of surfaces **and shadow-DOM JS styles**, filtered `copy.json`, `components-map.md`, `qa-automatable.md`. |
| **UX-003-P1** | Web surface alignment | C | Side Panel §6.1 (HealthStrip, Start-voice gating D10, Settings nav, History-lite D11), options steps+progress+copy, mini popup mic+count, field-anchored cues + accent focus ring, motion/reduced-motion. D8 guardrail. |
| **UX-003-P2** | Zen v2 (simplified §6.4) | P1 | n/N + progress, Speak/Next/Back/Dismiss, final-review list; Submit → current pill (D1). |
| **UX-003-P3** | Android parity | R, C | **Sub-issue = AND-006 (#51)** — body carries spec §6.6–6.8, §1.8, §8.3 + D1/D2/D3 notes. |
| **UX-003-P4** | QA matrix automation + PR checklist | P1 | Non-deferred §10 rows (QA-001–009, 015–024) automated where possible; §12 checklist → PR template; QA-010–014 excluded (D1). |
| **UX-003-GATE** | D12 manual QA gate | P1 (smoke), P4 (full) | Smoke after P1; full M01–M29 before epic close (M30+ after P3); results in `QA-GATE.md` / epic comment. |

## Close criteria

- [ ] All sub-issues closed
- [ ] **D12 gate green** (completed suite or per-item written reasons)
- [ ] E2E 5× + unit + contracts CI green on final merge
- [ ] Deferred register still documented in this issue (for future tracks)

## Handoffs

- **Input ←** UX-001 (shipped), speakalika spec package, QA-001 constraints
- **Output →** post-MVP polish baseline; deferred register feeds a future
  “validation & session-control” epic; AND-006/G1/G4 device refresh
