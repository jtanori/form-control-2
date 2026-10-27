# QA-001 — Security & Permission Audit

- **Phase:** 5 — Integration, Security & MVP Gate (Week 5)
- **Track / Agent:** Agent E — QA / Security
- **Priority:** P1
- **Status:** ready
- **Depends on:** All implementation items
- **Parallel with:** INTE-001
- **Critical path:** No (but blocks REL-001)
- **Milestone gates:** MVP gate
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/26
- **GitHub labels:** `backlog`, `phase-5`, `P1`, `agent-qa`
- **GitHub milestone:** Phase 5 — MVP Gate

## Objective

Audit permissions, data handling, and network exposure before shipping; sign off with no critical findings.

## Specification

**Checklist:**

- **Browser manifest**
  - [ ] No unnecessary permissions; `host_permissions: <all_urls>` is justified (content script requirement) and documented.
  - [ ] `activeTab` prevents passive access; `nativeMessaging`/`contextMenus` remain optional and off if unused.
- **Android**
  - [ ] Accessibility service description is truthful about what is read.
  - [ ] No `RECORD_AUDIO` abuse — requested only at capture time.
  - [ ] User must explicitly approve overlay permission.
- **STT**
  - [ ] Default is local Whisper; if `STT_FALLBACK=openai_whisper_api`, data-retention policy documented.
- **Core**
  - [ ] Binds `127.0.0.1:8020`, not `0.0.0.0`, unless explicitly configured otherwise.
  - [ ] `transcript` sanitized to prevent prompt/injection abuse (length caps, no system-prompt leakage).

**Deliverable:** `/docs/security-audit.md` with findings table and sign-off.

## Acceptance criteria

- [ ] Audit doc signed; **no critical findings** open.
- [ ] Each checklist line checked with evidence (screenshot, config line, or test).
- [ ] Any accepted risk recorded with owner.

## Handoffs

- **Input ←** All implementation items.
- **Output →** REL-001 (release blocked until signed).
