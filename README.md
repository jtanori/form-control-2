# form-control-2 — VoiceForm Universal

Voice-controlled universal form filling: **Core (FastAPI + LLM/NLU)** + **Browser Extension (MV3)** + **Android AccessibilityService**, with an optional desktop native daemon.

## 🗂 Backlog

The full zero-to-MVP backlog lives in [`backlog/`](backlog/README.md):

- **27 spec'd items** across 6 phases — each with file paths, APIs, interfaces, acceptance criteria, and explicit handoffs.
- **GitHub issues #1–#27** mirror the files 1:1, labeled by phase (`phase-0`…`phase-5`), priority (`P0`/`P1`/`P2`), agent track (`agent-*`), and `critical-path`.
- **Milestones:** Phase 0 — Infra · Phase 1 — Core NLU · Phase 2 — Browser · Phase 3 — Android · Phase 4 — Desktop · Phase 5 — MVP Gate.

**Critical path (do not split):**
`INFR-001 → CONTRACT-001 → CORE-001 → EXT-002 → EXT-003 → EXT-006 → INTE-001 → REL-001`

**MVP = gates G1 + G2 + G3 + G4** (voice input → parsed commands → browser form filled → Android form filled). G5 (desktop native) is stretch.

Start here: [backlog/README.md](backlog/README.md) — see "Coding Agent Takeaway List" for your track.
