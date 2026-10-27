# REL-001 — MVP Packaging & Release

- **Phase:** 5 — Integration, Security & MVP Gate (Week 5)
- **Track / Agent:** Platform / DevOps
- **Priority:** P0
- **Status:** ready
- **Depends on:** INTE-001, QA-001
- **Parallel with:** —
- **Critical path:** Yes — final link of the critical chain
- **Milestone gates:** MVP (G1+G2+G3+G4)
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/27
- **GitHub labels:** `backlog`, `phase-5`, `P0`, `agent-platform`, `critical-path`
- **GitHub milestone:** Phase 5 — MVP Gate

## Objective

Ship artifacts a new developer can use to fill a form by voice in under 10 minutes.

## Specification

**Build artifacts:**

- `dist/extension.zip` — Chrome Web Store / Firefox unlisted submission package.
- `android/app/release/app-release.apk` — signed release (or internal testing track).
- `docker-compose.yml` — local core + STT (+ redis) as finalized by INFR-001.
- `README.md` — setup steps: enable Android accessibility → load extension → `docker compose up` → speak.

**Release engineering:**

- Tag `v0.1.0-mvp`; CI builds artifacts on tag.
- Version stamps in extension manifest, APK versionName, Core `/health`.

## Acceptance criteria

- [ ] A new developer can clone, run docker, load extension, and fill a form via voice in **<10 minutes**.
- [ ] G1 + G2 + G3 + G4 gates all checked (G5 optional/stretch documented).
- [ ] Green INTE-001 run attached to the release; QA-001 signed.
- [ ] All three artifacts downloadable from the release page.

## Handoffs

- **Input ←** INTE-001 (green E2E), QA-001 (sign-off), all phase artifacts.
- **Output →** `v0.1.0-mvp` release; post-MVP backlog seeded (G5, sync, vision fallback).
