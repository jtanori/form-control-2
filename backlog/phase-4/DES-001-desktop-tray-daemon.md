# DES-001 — Desktop Tray Daemon Skeleton

- **Phase:** 4 — Desktop Native Agent (Week 3–4)
- **Track / Agent:** Agent D — Desktop / Python
- **Priority:** P2 (MVP optional; fully specified so it never blocks Phases 2/3)
- **Status:** ready
- **Depends on:** INFR-001
- **Parallel with:** All
- **Critical path:** No
- **Milestone gates:** G5 (stretch)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/20
- **GitHub labels:** `backlog`, `phase-4`, `P2`, `agent-desktop`
- **GitHub milestone:** Phase 4 — Desktop

## Objective

Background tray daemon that is the desktop agent's host process: tray icon, config, health check, and a place for explorer/executor/voice modules.

## Specification

- **File:** `/desktop/daemon/main.py`
- Python `pystray` tray app; `requests` to Core; `uiautomation` (Windows-only for MVP — document macOS/Linux as follow-up in `/docs/desktop.md`).
- Config file `config.ini`: `CORE_URL`, `SESSION_ID`, `STT_LOCAL`.
- Exposes/answers `GET /health` (Core-side or local status endpoint — whichever INFR-001 wires).
- Graceful shutdown; reconnection to Core on restart.

## Acceptance criteria

- [ ] Runs in background; tray icon visible.
- [ ] Responds to `GET /health`.
- [ ] Config read from `config.ini`; defaults documented.

## Handoffs

- **Input ←** INFR-001 scaffold, INFR-002 logging pattern.
- **Output →** DES-002/003/004 modules live under `/desktop/daemon/`.
