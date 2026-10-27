# REL-001 — MVP release checklist (`v0.1.0-mvp`)

## Build artifacts

| Artifact | How | Status |
|---|---|---|
| `voiceform-extension-*.zip` | `release.yml` → `extensions/browser/dist` zipped | CI on tag |
| `voiceform-*.apk` | `release.yml` → `:app:assembleDebug` (debug-signed, sideloadable) | CI on tag |
| `docker-compose.yml` | attached to the release | in repo |
| README 10-minute path | below + repo README | ✅ |

**Play Store note:** CI emits a debug-signed APK so anyone can `adb install`.
Shipping to an internal testing track requires a release keystore
(`signingConfig` + secrets) — intentionally post-MVP (owner: Platform).

## Version stamps

| Surface | Value |
|---|---|
| Extension manifest `version` | `0.1.0` |
| Android `versionName` | `0.1.0` |
| Core `__version__` / `GET /api/v1/health` | `0.1.0` |
| Git tag | `v0.1.0-mvp` (triggers `.github/workflows/release.yml`) |

## MVP gates (G1 + G2 + G3 + G4)

| Gate | Meaning | Evidence | Status |
|---|---|---|---|
| **G1** | Voice input works | STT endpoint + contract tests; compose `stt-whisper`; E2E STT stub | 🟡 **automated plumbing green** — device mic loop needs one manual run (popup 🎤 or Android overlay) |
| **G2** | Transcript → validated commands | Core suite (parse/clarify/safety rules) + contracts CLI | ✅ |
| **G3** | Browser form filled | INTE-001 Playwright, **5 repeats**, CI `e2e` job | ✅ |
| **G4** | Android form filled | `form-core` 25 tests + debug APK builds in CI | 🟡 **build + unit green** — one manual device fill needed |
| G5 | Desktop native | — | ⏸ stretch (Phase 4) |

### Manual device sign-off (10 minutes each)

**Browser (closes G1 for extension):**
1. `docker compose up --build` → `curl -s localhost:8020/api/v1/health` shows `"sttBackend":"whisper"` (first boot downloads the model).
2. Load `extensions/browser/dist` unpacked; open any checkout form.
3. Popup → mic → “fill the email address with … and click submit …” → Confirm → form filled.

**Android (closes G4):**
1. Install `voiceform-0.1.0.apk`; grant Accessibility + overlay + microphone.
2. `Core URL` → your LAN/Termux core; float the mic over a native form.
3. Speak → confirmation card → form filled.

## Release engineering

- [x] Tag-push CI builds artifacts (`release.yml`)
- [x] Green INTE-001 attached to branch history (CI job on every PR)
- [x] QA-001 signed (`docs/security-audit.md`)
- [ ] G1/G4 device boxes above checked by a human on release day
- [ ] Release page shows zip + apk + compose (runs automatically on tag)
