# Feature → manual coverage map (UX-003-R)

Every epic-relevant feature appears ≥1× (D12). “Auto” = CI test that also exists.

| Feature | M-id(s) | Fixture / surface | Auto |
|---|---|---|---|
| First-install opens setup | M01 | — (fresh profile) | no |
| Just-in-time mic enable + value-first copy | M02 | — (setup) | no |
| Mic denied banner + Re-check | M03 | — (permission) | no |
| Core healthy / offline recovery | M04, M05 | — (compose stop/start) | partial (E2E reuses live/mock) |
| Demo form loop | M06 | `forms/form-checkout.html` | E2E twin |
| Badge count, zero clicks | M07 | `forms/login-bootstrap.html` | no |
| Panel list pre-populated, scoped per active tab; stale selection/cues cleared on tab change | M08 | two tabs with different forms | no |
| Active accent border + muted/blurred others | M09 | **`forms/multi-form.html`** | no |
| Start-voice gated on selection (D10) | M10 | `forms/multi-form.html` | no |
| Typed → cards → Confirm → fill/submit | M11 | `forms/checkout-plain.html` | **E2E** |
| Panel voice → STT → fill | M12 | `forms/login-plain.html` | no |
| Tap-to-talk: chime, LISTENING, preview, sequential fill | M13 | `forms/signup-aria.html` | no |
| Control vocab next/back/check/submit | M14 | `forms/shipping-step.html` | unit (executor) |
| Confirm pill on submit-like action, bound to originating tab (current behavior, D1) | M15 | `forms/checkout-plain.html` + second tab | no |
| Ambiguity → candidates, no guess | M16 | **`forms/ambiguous-labels.html`** | unit |
| No-match + recovery copy | M17 | `forms/ambiguous-labels.html` | unit |
| Empty STT retry | M18 | any | no |
| Zen n/N, next/back, dismiss no residue | M19 | `forms/checkout-plain.html` | no |
| Mini popup launcher + count + mic→panel | M20 | any | no |
| SPA re-render → cues re-apply | M21 | **`forms/spa-rerender.html`** | no |
| Helper chip | M22 | any form | no |
| Cursor nav ←→🔊 | M23 | `forms/shipping-step.html` | unit |
| Light **and** dark visual pass | M24 | panel + `multi-form` | no |
| Reduced motion | M25 | any (OS setting) | no |
| Settings nav opens setup | M26 | panel | no |
| History nav or recorded defer (D11) | M27 | panel | no |
| Context-menu capture (no crash) | M28 | any page | no |
| Log redaction sanity (no transcript text in SW console) | M29 | during M12/M13 | no |
| Android setup checklist, progress dots, denied-mic recovery | M30 | APK setup | no |
| Overlay collapsed/expanded + Back precedence | M31 | APK | no |
| Android field tap → anchored HUD, field outline, sound cues, field-scoped fill (active-form grouping pending #69) | M32 | APK + form app | no |
| Android confirm pill on submit | M33 | APK | no |
| Android zen/back precedence | M34 | APK | no |
| Android light/dark + copy pass | M35 | APK | no |
| Android Core URL / health recovery | M36 | APK | no |
