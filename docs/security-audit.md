# QA-001 — Security & Permission Audit (v0.1.0-mvp)

- **Status:** ✅ signed — no critical findings open
- **Date:** 2026-10-27
- **Scope:** browser extension manifest, Android permissions, STT data path, Core network exposure + input handling
- **Evidence:** links below point at the shipped config/code or the regression test that locks it in (`core/tests/test_security.py`)

## Checklist

### Browser manifest

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No unnecessary permissions | ✅ | `permissions` = `storage`, `contextMenus`, `alarms` only — each used (`bridge.ts`: storage.sync/session, contextMenus, queue-flush alarm). `scripting`/`activeTab`/`tabs`/`nativeMessaging` **removed** (never called). Regression: `test_manifest_permissions_are_minimal`. |
| 2 | `host_permissions` scoped, not blanket | ✅ | Only `http://localhost:8020/*` + `http://127.0.0.1:8020/*` (Core API). Regression: same test. |
| 3 | Content script injection justified without `<all_urls>` host grant | ✅ | Static `content_scripts.matches = ["<all_urls>"]` is the documented MV3 pattern for a “works on any form” extension; no optional-host prompt surface remains (`optional_host_permissions` removed). Regression: `test_content_scripts_use_matches_not_host_permissions`. |
| 4 | `activeTab` prevents passive access n/a | ✅ | `activeTab` removed; bridge resolves tabs by PING-probe against its own content script, never by silent injection. |

### Android

| # | Check | Result | Evidence |
|---|---|---|---|
| 5 | Accessibility description truthful | ✅ | `res/values/strings.xml` — states it reads the visible UI tree on the floating-button flow, no keystroke/network collection. |
| 6 | `RECORD_AUDIO` not abused | ✅ | Declared in manifest but **never requested at install**. User taps “Allow microphone (when you want voice)” (`MainActivity`), and `VoiceClient.startListening()` hard-fails closed if the grant is missing. |
| 7 | Overlay requires explicit approval | ✅ | `TYPE_APPLICATION_OVERLAY` add is wrapped; missing permission → Toast + settings deep-link (`OverlayVoice.show`, `MainActivity` overlay button). `Settings.canDrawOverlays` checked first. |

### STT

| # | Check | Result | Evidence |
|---|---|---|---|
| 8 | Default is local Whisper | ✅ | `core/stt/service.py` — backend = `whisper` iff `STT_WHISPER_URL` set (compose default); `off` → `503`. Health reports `sttBackend`. |
| 9 | Fallback retention policy documented | ✅ | When `STT_FALLBACK=openai_whisper_api`, **audio bytes are forwarded to OpenAI’s Whisper API** (third-party processing; OpenAI API retention per their policy — do not enable for sensitive data). Default is local-only; documented here + `docs/core-api.md` § STT. |

### Core

| # | Check | Result | Evidence |
|---|---|---|---|
| 10 | Binds `127.0.0.1` by default | ✅ | `load_settings().host == "127.0.0.1"` (`test_core_default_bind_is_loopback`). Compose sets `CORE_HOST=0.0.0.0` **inside** the container (required for port publish) while publishing **loopback-only** on the host (`127.0.0.1:8020:8020`, `test_compose_ports_bind_loopback_only`). |
| 11 | No wildcard CORS | ✅ | Default allowlist: `http://localhost:\d+`, `http://127.0.0.1:\d+`, `chrome-extension://…` (anchored). Override via `ALLOWED_ORIGINS`. Foreign origin gets **no ACAO header**. Tests: `test_cors_*`. |
| 12 | Transcript/input bounded (prompt-stuffing) | ✅ | Caps: transcript **4000** chars, clarify text **500**, sessionId **200** (`core/api/schemas.py`) → HTTP 422 above cap. Tests: `test_oversized_*`. |
| 13 | No system-prompt leakage | ✅ | Rule provider never interpolates the prompt file into responses. OpenAI path sends the prompt as `system` and the transcript only as `user` content; invalid tool output is schema-validated and discarded (`core/nlu/parser.py`). Accepted residual risk: user transcript is *intended* LLM input — treat transcripts as untrusted text, not instructions. |

## Findings & remediation

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| Q-1 | **High** | CORS `allow_origins=["*"]` on Core | **Fixed** — loopback/chrome-extension patterns, `ALLOWED_ORIGINS` override |
| Q-2 | **High** | Compose published `8020/6379/8081` on all host interfaces | **Fixed** — `127.0.0.1:` binds |
| Q-3 | Medium | Unbounded transcript/clarify/sessionId (prompt stuffing) | **Fixed** — pydantic caps → 422 |
| Q-4 | Medium | Unused extension perms (`scripting`, `activeTab`, `optional_host_permissions`) | **Fixed** — removed |
| Q-5 | Low | `RECORD_AUDIO` declared but capture path never checked grant | **Fixed** — runtime request button + fail-closed guard |
| Q-6 | Info | Redis on compose without auth | **Accepted** — loopback-only publish; not exposed to LAN; INTE-002/production hardening backlog |
| Q-7 | Info | OpenAI STT fallback sends audio to a third party | **Accepted with policy** — documented above; off by default |

## Accepted risks (with owner)

| Risk | Owner | Notes |
|---|---|---|
| Q-6 Redis unauthenticated on loopback | Platform | Host-side `127.0.0.1` bind; container-internal network only |
| Q-7 Cloud STT retention when fallback enabled | Operator | Enable consciously; default is local whisper |
| Content script on `<all_urls>` | Product | Required for the core value proposition; static declaration, no optional broad host grant |
| Extension `host_permissions` = Core only | — | LAN Core usage needs manifest edit or re-ship with LAN origin (documented for release) |

## Sign-off

- **No critical/high findings remain open.**
- Locked in by `core/tests/test_security.py` (11 tests) + extension unit/E2E suites in CI.
- Unblocks **REL-001**.
