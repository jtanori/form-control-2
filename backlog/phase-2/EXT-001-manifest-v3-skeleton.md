# EXT-001 — Extension Manifest V3 Skeleton

- **Phase:** 2 — Browser Bridge (Week 2–3)
- **Track / Agent:** Agent B — Extension / Frontend
- **Priority:** P0
- **Status:** ready
- **Depends on:** INFR-001
- **Parallel with:** CONTRACT-001, CORE-001 (spec-level only)
- **Critical path:** No (scaffold for EXT-002…006)
- **Milestone gates:** G3
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/9
- **GitHub labels:** `backlog`, `phase-2`, `P0`, `agent-extension`
- **GitHub milestone:** Phase 2 — Browser

## Objective

A Manifest V3 extension skeleton that loads unpacked in Chrome and Firefox with content script, background service worker, and popup wired through Vite.

## Specification

- **Files:** `/extensions/browser/manifest.json`, `/extensions/browser/vite.config.ts`
- **Manifest V3** permissions:
  - `activeTab`, `scripting`, `storage`
  - `host_permissions`: `<all_urls>` (required for content script; justified in QA-001)
  - `nativeMessaging` (optional, for desktop bridge), `contextMenus` (optional)
- **Content script** registered in `content_scripts`:
  - `matches: ["<all_urls>"]`, `run_at: "document_idle"`, `all_frames: true`, `js: ["content.js"]`
- **Background:** service worker `background.ts`
- **Popup:** `popup.html` + `popup.ts`
- Build outputs to `/dist/extension`.

## Acceptance criteria

- [ ] Loads unpacked in Chrome **and** Firefox without errors.
- [ ] Content script logs `VoiceForm: active` on `example.com`.
- [ ] `npm run build` emits a loadable `/dist/extension`.
- [ ] Shared logger (INFR-002) importable from extension code.

## Handoffs

- **Input ←** INFR-001 scaffold, INFR-002 `extensions/shared/logger.ts`.
- **Output →** EXT-002 (content script host), EXT-003 (content script host), EXT-004 (popup host), EXT-005/EXT-006 (background worker).
