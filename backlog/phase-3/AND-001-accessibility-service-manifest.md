# AND-001 — AccessibilityService Project & Manifest

- **Phase:** 3 — Android Universal Bridge (Week 2–4)
- **Track / Agent:** Agent C — Mobile / Kotlin
- **Priority:** P0
- **Status:** ready
- **Depends on:** INFR-001
- **Parallel with:** All of Phase 2
- **Critical path:** No (scaffold for AND-002…005)
- **Milestone gates:** G4
- **GitHub issue:** https://github.com/jtanori/form-control-2/issues/15
- **GitHub labels:** `backlog`, `phase-3`, `P0`, `agent-mobile`
- **GitHub milestone:** Phase 3 — Android

## Objective

Kotlin Android app project with a working `AccessibilityService`, microphone permission, and a floating overlay — the native-mobile counterpart to the extension skeleton.

## Specification

- **Files:**
  - `/android/app/src/main/AndroidManifest.xml`
  - `/android/app/src/main/java/com/voiceform/VoiceFormService.kt`
  - `/android/app/src/main/res/xml/accessibility_service_config.xml`
- **Manifest declarations:**
  - `<service android:name=".VoiceFormService" android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE" android:exported="true">` with `<intent-filter><action android:name="android.accessibilityservice.AccessibilityService" /></intent-filter>`
  - Metadata `accessibility_service_config.xml`: `android:accessibilityEventTypes="typeAllMask"`, `android:accessibilityFeedbackType="feedbackGeneric"`, `android:canRetrieveWindowContent="true"`
  - Request `RECORD_AUDIO` permission.
- **Overlay:** `WindowManager` overlay with `TYPE_APPLICATION_OVERLAY` (runtime permission flow with truthful description — see QA-001).
- Build config: Kotlin, `minSdk 28`, `targetSdk 34`.

## Acceptance criteria

- [ ] User can enable the service in Settings → Accessibility.
- [ ] Overlay appears above other apps after explicit user approval.
- [ ] `RECORD_AUDIO` requested at runtime only when voice capture starts.
- [ ] Project builds via Gradle from the INFR-001 scaffold.

## Handoffs

- **Input ←** INFR-001 folder scaffold.
- **Output →** AND-002 (service hosts parser), AND-003, AND-004 (overlay host), AND-005.
