# VoiceForm Universal — MVP Backlog

Zero-to-MVP development roadmap engineered for **multi-agent assignment**. Every item is specified with file paths, APIs, interfaces, and explicit handoffs so a coding agent can take it with zero ambiguity.

**Philosophy:** MVP = **Universal Core (LLM/NLU)** + **Browser Extension** (desktop/mobile browser via desktop + Firefox Android) + **Android AccessibilityService** (native mobile apps / Chrome). Desktop native app (Windows/macOS) is Phase 4 but fully specified so it does not block Phase 2/3.

**Fixed Stack (do not change without updating contracts):**

- **Client / Bridge:** TypeScript (Browser Extension Manifest V3) / Kotlin (Android) / Python 3.11 (Desktop) / React (optional overlay shared lib)
- **Core / NLU:** Python 3.11, FastAPI, OpenAI / Anthropic SDK, `jsonschema`, `redis` (session), `whisper.cpp` (STT Docker)
- **Data Contract:** JSON Schema (`/contracts/v1/`)
- **Transport:** Browser → Core via `fetch` to `http://localhost:8020`; Android → Core via HTTP (same LAN or localhost); Desktop → Core via HTTP.

---

## Backlog Index (27 items → GitHub issues + post-MVP track)

### Phase 0 — Contracts, Infra & Skeleton (Week 1) — sequential start, then parallel

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| INFR-001 | Monorepo & Dev Environment | Platform / DevOps | P0 | [phase-0/INFR-001](phase-0/INFR-001-monorepo-dev-environment.md) | [#2](https://github.com/jtanori/form-control-2/issues/2) |
| CONTRACT-001 | Unified Context & Command Schema | Backend / AI | P0 | [phase-0/CONTRACT-001](phase-0/CONTRACT-001-unified-context-command-schema.md) | [#1](https://github.com/jtanori/form-control-2/issues/1) |
| STT-001 | Local Whisper STT Microservice | Backend / ML | P0 | [phase-0/STT-001](phase-0/STT-001-local-whisper-stt-microservice.md) | [#4](https://github.com/jtanori/form-control-2/issues/4) |
| INFR-002 | Shared Debug / Logger Library | Platform | P1 | [phase-0/INFR-002](phase-0/INFR-002-shared-debug-logger.md) | [#3](https://github.com/jtanori/form-control-2/issues/3) |

### Phase 1 — The Brain: NLU, Ambiguity, Session (Week 1–2) — Stream A (1 backend + 1 AI agent)

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| CORE-001 | Intent Parser Endpoint | Backend / AI (Lead) | P0 | [phase-1/CORE-001](phase-1/CORE-001-intent-parser-endpoint.md) | [#5](https://github.com/jtanori/form-control-2/issues/5) |
| CORE-002 | Clarification / Ambiguity Resolver | Backend / AI | P0 | [phase-1/CORE-002](phase-1/CORE-002-clarification-ambiguity-resolver.md) | [#6](https://github.com/jtanori/form-control-2/issues/6) |
| CORE-003 | Session & Multi-Form State Manager | Backend / AI | P1 | [phase-1/CORE-003](phase-1/CORE-003-session-multiform-state-manager.md) | [#7](https://github.com/jtanori/form-control-2/issues/7) |
| CORE-004 | Context Normalizer (Bridge Adapter) | Backend / AI | P1 | [phase-1/CORE-004](phase-1/CORE-004-context-normalizer.md) | [#8](https://github.com/jtanori/form-control-2/issues/8) |

### Phase 2 — Browser Bridge: The High-ROI Execution Layer (Week 2–3) — Stream B (1 extension + 1 frontend agent)

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| EXT-001 | Extension Manifest V3 Skeleton | Frontend / Extension | P0 | [phase-2/EXT-001](phase-2/EXT-001-manifest-v3-skeleton.md) | [#9](https://github.com/jtanori/form-control-2/issues/9) |
| EXT-002 | DOM Explorer / Form Context Extractor | Frontend / Extension | P0 | [phase-2/EXT-002](phase-2/EXT-002-dom-context-extractor.md) | [#10](https://github.com/jtanori/form-control-2/issues/10) |
| EXT-003 | Execution Engine (Content Script) | Frontend / Extension | P0 | [phase-2/EXT-003](phase-2/EXT-003-execution-engine.md) | [#11](https://github.com/jtanori/form-control-2/issues/11) |
| EXT-004 | Voice Capture & Popup UI | Frontend / Extension | P0 | [phase-2/EXT-004](phase-2/EXT-004-voice-capture-popup.md) | [#12](https://github.com/jtanori/form-control-2/issues/12) |
| EXT-005 | Navigation / Virtual Cursor Mode | Frontend / Extension | P1 | [phase-2/EXT-005](phase-2/EXT-005-navigation-virtual-cursor.md) | [#13](https://github.com/jtanori/form-control-2/issues/13) |
| EXT-006 | Extension ↔ Core Bridge (Background) | Frontend / Extension | P0 | [phase-2/EXT-006](phase-2/EXT-006-extension-core-bridge.md) | [#14](https://github.com/jtanori/form-control-2/issues/14) |

### Phase 3 — Android Universal Bridge: The Mobile Layer (Week 2–4) — Stream C (1 mobile agent)

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| AND-001 | AccessibilityService Project & Manifest | Mobile / Kotlin | P0 | [phase-3/AND-001](phase-3/AND-001-accessibility-service-manifest.md) | [#15](https://github.com/jtanori/form-control-2/issues/15) |
| AND-002 | Android Node Tree Parser | Mobile / Kotlin | P0 | [phase-3/AND-002](phase-3/AND-002-android-node-tree-parser.md) | [#16](https://github.com/jtanori/form-control-2/issues/16) |
| AND-003 | Android Action Executor | Mobile / Kotlin | P0 | [phase-3/AND-003](phase-3/AND-003-android-action-executor.md) | [#17](https://github.com/jtanori/form-control-2/issues/17) |
| AND-004 | Android Voice Overlay & STT Client | Mobile / Kotlin | P0 | [phase-3/AND-004](phase-3/AND-004-voice-overlay-stt-client.md) | [#18](https://github.com/jtanori/form-control-2/issues/18) |
| AND-005 | Android Context Sender to Core | Mobile / Kotlin | P1 | [phase-3/AND-005](phase-3/AND-005-context-sender-core.md) | [#19](https://github.com/jtanori/form-control-2/issues/19) |

### Phase 4 — Desktop Native Agent (Week 3–4) — Stream D (1 desktop agent)

> MVP is technically viable without this if the browser covers desktop web; included because "universal" implies native desktop apps. Can be delayed to Phase 5 — spec is complete either way.

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| DES-001 | Desktop Tray Daemon Skeleton | Desktop / Python | P2 | [phase-4/DES-001](phase-4/DES-001-desktop-tray-daemon.md) | [#20](https://github.com/jtanori/form-control-2/issues/20) |
| DES-002 | Desktop Accessibility Explorer | Desktop / Python | P2 | [phase-4/DES-002](phase-4/DES-002-desktop-accessibility-explorer.md) | [#21](https://github.com/jtanori/form-control-2/issues/21) |
| DES-003 | Desktop Action Executor | Desktop / Python | P2 | [phase-4/DES-003](phase-4/DES-003-desktop-action-executor.md) | [#22](https://github.com/jtanori/form-control-2/issues/22) |
| DES-004 | Desktop Voice Client / Bridge | Desktop / Python | P2 | [phase-4/DES-004](phase-4/DES-004-desktop-voice-client.md) | [#23](https://github.com/jtanori/form-control-2/issues/23) |

### Phase 5 — Integration, Security & MVP Gate (Week 5) — Stream E (1 QA / Integration agent)

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| INTE-001 | End-to-End Browser Integration (Playwright) | QA / Integration | P0 | [phase-5/INTE-001](phase-5/INTE-001-e2e-browser-integration.md) | [#24](https://github.com/jtanori/form-control-2/issues/24) |
| INTE-002 | Cross-Platform Session Sync Protocol | Integration | P1 | [phase-5/INTE-002](phase-5/INTE-002-cross-platform-session-sync.md) | [#25](https://github.com/jtanori/form-control-2/issues/25) |
| QA-001 | Security & Permission Audit | QA / Security | P1 | [phase-5/QA-001](phase-5/QA-001-security-permission-audit.md) | [#26](https://github.com/jtanori/form-control-2/issues/26) |
| REL-001 | MVP Packaging & Release | Platform / DevOps | P0 | [phase-5/REL-001](phase-5/REL-001-mvp-packaging-release.md) | [#27](https://github.com/jtanori/form-control-2/issues/27) |

### Post-MVP — Quality & Polish (after `v0.1.0-mvp`)

| ID | Title | Agent | Priority | File | Issue |
|---|---|---|---|---|---|
| UX-003 | **[EPIC] Multi-Surface Spec v1.0 Adoption** (R/C/P1/P2/P3/P4/GATE + manual QA gate) | Frontend / Design | P1 | [post-mvp/UX-003](post-mvp/UX-003-spec-adoption-epic.md) | [#54](https://github.com/jtanori/form-control-2/issues/54) |
| UX-001 | Extension UX Audit & Redesign — *delivered → folded into UX-003* | Frontend / Extension | P1 | [post-mvp/UX-001](post-mvp/UX-001-extension-ux-audit-redesign.md) | [#41](https://github.com/jtanori/form-control-2/issues/41) |
| UX-002 | Design identity intake — *superseded by UX-003 (spec baseline)* | Design ops | P1 | [post-mvp/UX-002](post-mvp/UX-002-design-identity-intake.md) | [#50](https://github.com/jtanori/form-control-2/issues/50) |
| AND-006 | Mobile UX parity — *UX-003 sub-item P3* | Mobile / Kotlin | P1 | [post-mvp/AND-006](post-mvp/AND-006-mobile-ux-parity.md) | [#51](https://github.com/jtanori/form-control-2/issues/51) |
| UX-003-70 | Manual‑Testing Suite (Side‑panel UI) | QA / Integration | P1 | - | [#70](https://github.com/jtanori/form-control-2/issues/70) |

---

## GitHub metadata sync

Because the GitHub connector may be flaky, **every item file carries its own GitHub metadata inline** (issue URL, intended labels, milestone) right in the header — so the data always lives in the repo *and* ends up inside each issue description:

- `GitHub issue:` / `GitHub labels:` / `GitHub milestone:` bullets in every item file below.
- The issue **description is the item file content**, so this metadata is visible in the issue itself.
- [`apply-issue-metadata.sh`](apply-issue-metadata.sh) re-syncs all item issues (description + labels + milestone) in one run; idempotent, safe to re-run whenever the connector recovers.

```bash
./backlog/apply-issue-metadata.sh
```

---

## Multi-Agent Assignment & Parallelization Matrix

| Track / Agent Profile | Work Package | Parallel With (Can be done simultaneously) | Blocked By (Cannot start until) |
|---|---|---|---|
| **Agent A: Backend / AI** | CONTRACT-001, STT-001, CORE-001, CORE-002, CORE-003, CORE-004, INTE-002 | EXT-001, AND-001, DES-001 (independent skeletons) | INFR-001 (repo) |
| **Agent B: Extension / Frontend** | INFR-001 (repo scaffold), EXT-001, EXT-002, EXT-003, EXT-004, EXT-005, EXT-006 | CORE-001 (parser spec), AND-001 (Android setup), DES-001 (desktop skeleton) | CONTRACT-001 (for EXT-002), CORE-001 (for EXT-006 E2E) |
| **Agent C: Mobile / Kotlin** | AND-001, AND-002, AND-003, AND-004, AND-005 | EXT-002 (design parallel), CORE-001 (interface spec) | INFR-001, CONTRACT-001 |
| **Agent D: Desktop / Python** | DES-001, DES-002, DES-003, DES-004 | All Phase 2/3 | INFR-001, CONTRACT-001 |
| **Agent E: QA / Integration** | INTE-001, QA-001, REL-001 | AND-004 (for manual mobile test) | EXT-006, AND-003, CORE-001 (for E2E) |

### Critical Path (Sequential Chain — Do Not Split)

```
INFR-001 → CONTRACT-001 → CORE-001 → EXT-002 → EXT-003 → EXT-006 → INTE-001 → REL-001
```

Everything else can be developed in the tracks above and plugged in.

---

## Milestone Gates (What Defines "MVP Finished")

| Gate | Definition | Required Items |
|---|---|---|
| **G1: Voice Input Working** | User speaks into popup / overlay; transcript appears; no errors. | STT-001, EXT-004, AND-004 |
| **G2: Command Parsed** | Transcript converted to structured JSON commands; ambiguity handled. | CONTRACT-001, CORE-001, CORE-002 |
| **G3: Browser Form Filled** | On desktop browser + Firefox Android, a checkout form is filled, checkbox toggled, submitted via voice with confirmation step. | EXT-001…EXT-006, CORE-003 |
| **G4: Mobile Native App Filled** | On Android native app (or Chrome via AccessibilityService), same command flow works. | AND-001…AND-005 |
| **G5: Desktop Native (Bonus)** | At least one native desktop window (Notepad/Calculator/form) controlled by voice via daemon. | DES-001…DES-004 |

**MVP = G1 + G2 + G3 + G4.** G5 is a stretch / Phase 4 deliverable that can ship in v1.1.

---

## Coding Agent Takeaway List (Start Here Depending on Role)

- **If you are Agent A:** Open `CONTRACT-001`, write `/contracts/v1/`. Then `CORE-001`: build FastAPI with OpenAI tool calling.
- **If you are Agent B:** Open `EXT-001`; get the extension loading. Then `EXT-002`: write `extractFormSnapshot` with label resolution rules exactly as written.
- **If you are Agent C:** Open `AND-001`; declare the service in the manifest. Then `AND-002`: traverse `AccessibilityNodeInfo`.
- **If you are Agent D:** Open `DES-001`; build tray + `requests` to `localhost:8020`.
- **If you are Agent E:** Wait for `EXT-006` and `AND-003`, then build the Playwright spec against the fixture form.

This backlog is fully assignable, fully sequenced, and has explicit interface contracts (the JSON schemas) that prevent integration failure when agents merge code.
