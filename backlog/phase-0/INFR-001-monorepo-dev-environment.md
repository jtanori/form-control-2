# INFR-001 — Monorepo & Dev Environment

- **Phase:** 0 — Contracts, Infra & Skeleton (Week 1)
- **Track / Agent:** Platform / DevOps
- **Priority:** P0
- **Status:** ready
- **Depends on:** Nothing
- **Parallel with:** CONTRACT-001, STT-001, INFR-002 (once folder scaffold exists)
- **Critical path:** Yes — this is the root of the entire critical chain
- **Milestone gates:** Enables G1–G5

## Objective

Create the `voice-form-universal/` monorepo skeleton and the dev/CI infrastructure every other track builds on. Safety-first structure: contracts live first, services second, clients third.

## Specification

Create the repository with this exact structure:

```
/contracts/v1/                 # JSON schemas (data contract — source of truth)
/core/                         # FastAPI (Python 3.11)
/extensions/browser/           # Vite + TS + Manifest V3
/extensions/shared/            # shared TS libs (logger, types)
/android/app/                  # Kotlin, minSdk 28, targetSdk 34
/desktop/daemon/               # Python 3.11 + pystray
/tests/e2e/                    # Playwright (+ Playwright Android if needed)
/tests/fixtures/               # reference forms (form-checkout.html, etc.)
/docs/                         # protocol & setup docs
/backlog/                      # this backlog
/docker-compose.yml            # core, stt-whisper, redis
.github/workflows/ci.yml       # lint + test template
```

- **GitHub Actions template:** `lint` and `test` jobs; initially may `echo "hello"` as smoke test but must be a real, passing workflow.
- **`docker-compose.yml`** defines three services:
  - `core` — FastAPI app, port `8020`, binds `127.0.0.1:8020` by default.
  - `stt-whisper` — whisper.cpp server (consumes spec from STT-001).
  - `redis` — session store for CORE-003.
- Add `.editorconfig`, root `README.md` with setup steps (placeholder OK until REL-001).

## Files & deliverables

- `/docker-compose.yml`
- `/.github/workflows/ci.yml`
- Directory scaffold for all paths above (with `.gitkeep` where empty)
- `/README.md` updated with clone → compose → test quickstart

## Acceptance criteria

- [ ] `docker compose up` boots `core`, `stt-whisper`, `redis` without errors.
- [ ] Repository builds from a clean clone.
- [ ] CI runs successfully (lint + test jobs green; smoke `echo "hello"` acceptable for the initial template).
- [ ] All downstream backlog items reference paths that exist after this scaffold.

## Handoffs

- **Output →** CONTRACT-001 writes into `/contracts/v1/`; STT-001 wires `stt-whisper`; INFR-002 writes `core/lib/` + `extensions/shared/`.
- **Output →** EXT/AND/DES tracks create their project folders inside the scaffold.
- **Note:** Do not restructure top-level folders without updating CONTRACT-001 and all referencing specs.
