# VoiceForm Universal

## Multi-Surface UI Specification, Design System, Component Catalog, Copy Bank & Interaction Contracts

**Artifact type:** Implementation specification\
**Version:** 1.0\
**Status:** Proposed baseline for design and engineering\
**Platforms:** Chrome extension (Side Panel, Options, toolbar popup,
in-page UI) and Android accessibility service (overlay and setup
activity)\
**Design language:** Apple-calm, non-skeuomorphic, one accent hue plus
grayscale\
**Safety invariant:** No consequential action executes without explicit
confirmation for that exact action.

------------------------------------------------------------------------

# 0. How to use this specification

This document expands the supplied Multi-Surface Design Board into
implementable specifications. It is the source of truth for tokens,
reusable components, state behavior, copy, surface layouts, motion, and
acceptance criteria.

### Normative language

-   **MUST**: required for correctness, accessibility, privacy, or
    safety.
-   **SHOULD**: default behavior; deviations require a documented
    platform reason.
-   **MAY**: optional enhancement that must not violate a MUST.

### Product contract

VoiceForm Universal detects forms locally, lets a user choose a form,
captures speech only after an explicit start action, converts speech
into structured commands through Core NLU, resolves field targets,
previews interpretation where appropriate, and applies authorized
changes. Web and Android surfaces share the same interaction model while
respecting platform-specific permissions and capabilities.

The UI is not allowed to imply that detection equals recording,
transcription equals understanding, understanding equals authorization,
or a field edit equals form submission.

### Surface inventory

  ---------------------------------------------------------------------------
  ID                Surface           Host              Primary purpose
  ----------------- ----------------- ----------------- ---------------------
  `VF-SURF-01`      Browser Side      Chrome extension  Persistent workspace:
                    Panel                               detected forms,
                                                        active form, command
                                                        flow, status,
                                                        settings

  `VF-SURF-02`      Options /         Extension full    Explain product,
                    Onboarding        tab               request permissions
                                                        just-in-time, health
                                                        check, demo,
                                                        preferences

  `VF-SURF-03`      In-Page Cues      Web page via      Non-destructive form
                                      extension         discovery, active
                                                        field focus,
                                                        listening status,
                                                        transcript preview,
                                                        confirmation

  `VF-SURF-04`      Zen Sheet         Side panel /      Guided
                                      supported web     one-field-at-a-time
                                      surface           form completion

  `VF-SURF-05`      Mini Popup        Chrome toolbar    Launcher only; never
                                      popup             a full command
                                                        workspace

  `VF-SURF-06A`     Android Overlay   Android           Compact floating
                    --- Collapsed     accessibility     launcher
                                      service           

  `VF-SURF-06B`     Android Overlay   Android           Active voice session
                    --- Expanded      accessibility     and compact field
                                      service           interaction

  `VF-SURF-07`      Android Setup     Android activity  Explain and guide
                                                        accessibility and
                                                        microphone setup
  ---------------------------------------------------------------------------

### Global invariants

1.  Passive form detection is local-only and does not activate the
    microphone.
2.  Microphone access is requested only after a user action that
    explains why it is needed.
3.  Ambiguous target resolution MUST refuse to execute until the user
    clarifies.
4.  A risky or externally consequential action MUST pass through an
    explicit confirmation gate.
5.  The three-second countdown is a minimum delay; it never triggers
    execution by itself.
6.  Cancel, Escape, Android Back, dismiss, timeout, permission loss, and
    session loss never mean Confirm.
7.  Field execution must be verified before success is shown.
8.  A failed or interrupted command must not be silently replayed.
9.  Dismissing VoiceForm stops its work but does not automatically roll
    back field edits already applied. Undo, if provided, is a separate
    explicit action.
10. A user must always have a clear manual fallback where the host
    permits one.

------------------------------------------------------------------------

# 1. Design system

## 1.1 Visual principles

-   **One accent hue:** blue. All other UI colors are grayscale or
    semantic feedback colors used sparingly.
-   **Surface hierarchy:** page background → elevated card → floating
    chrome. Use soft fills, hairline borders, rounded corners, and
    restrained shadows.
-   **Typography:** system UI stack; hierarchy primarily through weight,
    size, and opacity.
-   **Progressive disclosure:** one visible primary action per state;
    advanced controls sit behind a disclosure row or settings surface.
-   **Motion:** 150--250 ms ease-out transitions; one restrained
    listening pulse; no bounce or continuous ornamental animation.
-   **Focus:** inset ring plus thin accent glow around the active
    target; never a full-page modal takeover for ordinary field
    interaction.
-   **Copy:** calm, direct, honest. Error copy states what happened and
    the next safe step.
-   **Privacy:** local-first indicators are factual, not decorative. Do
    not claim local processing if any current stage sends data
    elsewhere.

## 1.2 Color tokens

Values below are the canonical proposed baseline. They should be checked
in actual UI contexts against WCAG contrast requirements before release.
Semantic colors are muted and must never replace text labels or icons as
the only status signal.

  -----------------------------------------------------------------------------------------------
  Token                         Light                   Dark                 Use
  ----------------------------- ----------------------- -------------------- --------------------
  `vf.color.bg`                 `#FFFFFF`               `#0B0F14`            Main surface
                                                                             background

  `vf.color.surface`            `#F7F8FA`               `#111827`            Card / raised
                                                                             section fill

  `vf.color.surface-elevated`   `#FFFFFF`               `#172033`            Floating panel,
                                                                             popover

  `vf.color.surface-subtle`     `#F1F3F6`               `#1C2638`            Quiet row,
                                                                             selected-neutral
                                                                             fill

  `vf.color.text-primary`       `#0B0F14`               `#F3F5F7`            Main labels and
                                                                             titles

  `vf.color.text-secondary`     `#667085`               `#A3ADBC`            Supporting copy

  `vf.color.text-tertiary`      `#8993A3`               `#7F8A9C`            Metadata; do not use
                                                                             for essential text
                                                                             without contrast
                                                                             validation

  `vf.color.hairline`           `#E5E7EB`               `#293344`            Borders and
                                                                             separators

  `vf.color.border-strong`      `#CBD2DC`               `#3B475B`            Focus-adjacent
                                                                             borders and stronger
                                                                             outlines

  `vf.color.accent-50`          `#EFF6FF`               `#101F36`            Accent wash

  `vf.color.accent-100`         `#DBEAFE`               `#142A49`            Selected row
                                                                             background

  `vf.color.accent-200`         `#BFDBFE`               `#1D3B63`            Soft active border

  `vf.color.accent-300`         `#93C5FD`               `#28528A`            Decorative ramp only

  `vf.color.accent-400`         `#60A5FA`               `#3470BD`            Hover / secondary
                                                                             accent

  `vf.color.accent-500`         `#3B82F6`               `#3B82F6`            Main accent

  `vf.color.accent-600`         `#2878F0`               `#5B9BFF`            Primary controls

  `vf.color.accent-700`         `#1D5FC7`               `#83B4FF`            Strong accent text
                                                                             where contrast
                                                                             allows

  `vf.color.success`            `#0D9488`               `#34B8A6`            Verified completion
                                                                             status

  `vf.color.warning`            `#B7791F`               `#E7B14D`            Recoverable warning

  `vf.color.danger`             `#D94848`               `#FF7777`            Error /
                                                                             destructive-action
                                                                             semantics

  `vf.color.info`               `#64748B`               `#94A3B8`            Neutral information

  `vf.color.scrim`              `rgba(15,23,42,0.08)`   `rgba(0,0,0,0.32)`   Floating chrome
                                                                             separation; never
                                                                             use for a full-page
                                                                             takeover

  `vf.color.focus-ring`         `#2878F0`               `#83B4FF`            Keyboard /
                                                                             accessibility focus

  `vf.color.disabled-fill`      `#EEF1F5`               `#202A3A`            Disabled controls

  `vf.color.disabled-text`      `#98A2B3`               `#69778D`            Disabled labels;
                                                                             must remain legible
  -----------------------------------------------------------------------------------------------

### Accent ramp

Use one blue hue family for interactive states. Do not introduce a
second decorative brand hue. Success, warning, and danger are semantic
feedback tokens, not additional brand accents.

## 1.3 Typography

Font stack:

``` css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
             "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

  Token                   Size / line height   Weight   Use
  ----------------------- -------------------- -------- ----------------------------
  `vf.type.title`         24 / 30 px           600      Full-tab page title, rare
  `vf.type.heading`       18 / 24 px           600      Panel and sheet heading
  `vf.type.subheading`    15 / 20 px           600      Card heading, field name
  `vf.type.body`          14 / 20 px           400      Primary body, form labels
  `vf.type.body-medium`   14 / 20 px           500      Buttons, selected values
  `vf.type.caption`       12 / 16 px           400      Helper copy, status detail
  `vf.type.micro`         11 / 14 px           500      Nonessential metadata only

Use no more than three sizes within a compact surface where practical.
Do not use micro text for controls, permission explanations, or error
recovery.

## 1.4 Spacing scale

Base unit: 4 px on web; map to dp on Android using platform density and
layout conventions.

  Token             Value Typical use
  --------------- ------- ---------------------------------
  `vf.space.0`          0 Reset
  `vf.space.1`       4 px Icon-label gap
  `vf.space.2`       8 px Compact control spacing
  `vf.space.3`      12 px Row/card interior gap
  `vf.space.4`      16 px Standard card padding
  `vf.space.5`      20 px Section spacing
  `vf.space.6`      24 px Large section gap
  `vf.space.8`      32 px Page-level separation
  `vf.space.10`     40 px Onboarding illustration spacing
  `vf.space.12`     48 px Large vertical rhythm

## 1.5 Radius, elevation, and material

  ------------------------------------------------------------------------------
  Token                                              Value Use
  ---------------------- --------------------------------- ---------------------
  `vf.radius.control`            12 px web / 12 dp Android Inputs, compact cards

  `vf.radius.pill`                                  999 px Buttons, chips,
                                                           status pills

  `vf.radius.card`                                   14 px Cards, rows grouped
                                                           in a card

  `vf.radius.sheet`                                  22 px Zen sheet / expanded
                                                           Android panel

  `vf.radius.overlay`                                24 px Android floating
                                                           container

  `vf.border.hairline`                                1 px Standard outline

  `vf.shadow.card`          `0 1px 2px rgba(15,23,42,.04)` Cards

  `vf.shadow.panel`        `0 4px 16px rgba(15,23,42,.08)` Side panel elevation

  `vf.shadow.floating`        `0 8px 24px rgba(0,0,0,.14)` Floating pill /
                                                           overlay

  `vf.blur.floating`                              8--12 px Optional behind
                                                           floating chrome only
  ------------------------------------------------------------------------------

Material recipe: `surface-elevated` + hairline border +
`vf.shadow.floating` + optional `backdrop-filter: blur(8px)`. Keep text
and control surfaces opaque enough to preserve contrast. Avoid blur on
the full page and avoid translucency behind dense text.

## 1.6 Focus and selection

-   `vf.focus.inset`: 2 px inset ring.
-   `vf.focus.glow`: 1 px accent edge plus low-opacity external glow,
    max 4 px spread.
-   `vf.state.selected`: accent-50 fill in light mode / accent-100 dark
    token with a visible outline.
-   `vf.state.hover`: subtle surface shift, not a hue shift across the
    entire control.
-   `vf.state.pressed`: slight fill/opacity change; no scale bounce.
-   `vf.state.disabled`: reduced emphasis, still readable; no
    interaction affordance.

Focus ring must not obscure the field's existing validation border. If
both are present, show focus plus a separate error icon/label.

## 1.7 CSS custom properties

``` css
:root {
  color-scheme: light;
  --vf-bg: #FFFFFF;
  --vf-surface: #F7F8FA;
  --vf-surface-elevated: #FFFFFF;
  --vf-surface-subtle: #F1F3F6;
  --vf-text-primary: #0B0F14;
  --vf-text-secondary: #667085;
  --vf-text-tertiary: #8993A3;
  --vf-hairline: #E5E7EB;
  --vf-border-strong: #CBD2DC;
  --vf-accent-50: #EFF6FF;
  --vf-accent-100: #DBEAFE;
  --vf-accent-200: #BFDBFE;
  --vf-accent-300: #93C5FD;
  --vf-accent-400: #60A5FA;
  --vf-accent-500: #3B82F6;
  --vf-accent-600: #2878F0;
  --vf-accent-700: #1D5FC7;
  --vf-success: #0D9488;
  --vf-warning: #B7791F;
  --vf-danger: #D94848;
  --vf-info: #64748B;
  --vf-focus-ring: #2878F0;
  --vf-disabled-fill: #EEF1F5;
  --vf-disabled-text: #98A2B3;
  --vf-radius-control: 12px;
  --vf-radius-card: 14px;
  --vf-radius-sheet: 22px;
  --vf-radius-pill: 999px;
  --vf-shadow-card: 0 1px 2px rgba(15,23,42,.04);
  --vf-shadow-panel: 0 4px 16px rgba(15,23,42,.08);
  --vf-shadow-floating: 0 8px 24px rgba(0,0,0,.14);
  --vf-motion-fast: 120ms;
  --vf-motion-standard: 180ms;
  --vf-motion-panel: 220ms;
  --vf-ease-out: cubic-bezier(.2,.8,.2,1);
}
[data-theme="dark"] {
  color-scheme: dark;
  --vf-bg: #0B0F14;
  --vf-surface: #111827;
  --vf-surface-elevated: #172033;
  --vf-surface-subtle: #1C2638;
  --vf-text-primary: #F3F5F7;
  --vf-text-secondary: #A3ADBC;
  --vf-text-tertiary: #7F8A9C;
  --vf-hairline: #293344;
  --vf-border-strong: #3B475B;
  --vf-accent-50: #101F36;
  --vf-accent-100: #142A49;
  --vf-accent-200: #1D3B63;
  --vf-accent-300: #28528A;
  --vf-accent-400: #3470BD;
  --vf-accent-500: #3B82F6;
  --vf-accent-600: #5B9BFF;
  --vf-accent-700: #83B4FF;
  --vf-success: #34B8A6;
  --vf-warning: #E7B14D;
  --vf-danger: #FF7777;
  --vf-info: #94A3B8;
  --vf-focus-ring: #83B4FF;
  --vf-disabled-fill: #202A3A;
  --vf-disabled-text: #69778D;
}
```

## 1.8 Compose color mapping

Use a `ColorScheme` rather than hard-coded colors inside composables.
Map semantic tokens as follows; verify contrast for each actual
text/background pair.

``` kotlin
private val VoiceFormLight = lightColorScheme(
    primary = Color(0xFF2878F0),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFDBEAFE),
    onPrimaryContainer = Color(0xFF0B0F14),
    secondary = Color(0xFF667085),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFFFFFFF),
    onBackground = Color(0xFF0B0F14),
    surface = Color(0xFFF7F8FA),
    onSurface = Color(0xFF0B0F14),
    surfaceVariant = Color(0xFFF1F3F6),
    onSurfaceVariant = Color(0xFF667085),
    outline = Color(0xFFE5E7EB),
    error = Color(0xFFD94848)
)

private val VoiceFormDark = darkColorScheme(
    primary = Color(0xFF5B9BFF),
    onPrimary = Color(0xFF0B0F14),
    primaryContainer = Color(0xFF142A49),
    onPrimaryContainer = Color(0xFFF3F5F7),
    secondary = Color(0xFFA3ADBC),
    onSecondary = Color(0xFF0B0F14),
    background = Color(0xFF0B0F14),
    onBackground = Color(0xFFF3F5F7),
    surface = Color(0xFF111827),
    onSurface = Color(0xFFF3F5F7),
    surfaceVariant = Color(0xFF1C2638),
    onSurfaceVariant = Color(0xFFA3ADBC),
    outline = Color(0xFF293344),
    error = Color(0xFFFF7777)
)
```

Map `success`, `warning`, `info`, scrim, and focus-ring to named
extension tokens rather than overloading Material roles.

------------------------------------------------------------------------

# 2. Component catalog

## 2.1 Naming convention

Component IDs are stable implementation references. Suggested component
names are:

-   `VF/Button/PrimaryPill`
-   `VF/Button/SecondaryGhostPill`
-   `VF/Status/Dot`
-   `VF/Status/Chip`
-   `VF/Input/TextField`
-   `VF/Control/Segmented`
-   `VF/Row/FormItem`
-   `VF/Command/ActionCard`
-   `VF/Safety/ConfirmPill`
-   `VF/Status/ListeningBadge`
-   `VF/Transcript/PreviewBubble`
-   `VF/Control/HelperChip`
-   `VF/Sheet/Zen`
-   `VF/Permission/BlockedBanner`
-   `VF/Health/HealthStrip`
-   `VF/Overlay/DragHandle`
-   `VF/Progress/SegmentedProgress`
-   `VF/Feedback/InlineError`
-   `VF/Control/IconButton`
-   `VF/Control/DisclosureRow`

Every component must expose design tokens rather than defining its own
independent palette, radius, or motion values.

## 2.2 Shared interaction states

  -----------------------------------------------------------------------
  State                   Appearance              Behavior
  ----------------------- ----------------------- -----------------------
  Default                 Base fill and hairline  Available

  Hover                   Slight surface shift    Pointer feedback only

  Focus                   Visible accent focus    Keyboard/switch
                          ring                    accessible

  Pressed                 Slight fill shift       No bounce

  Selected                Accent wash + visible   Current choice
                          border/indicator        

  Disabled                Muted fill/text         No action; explain why
                                                  if important

  Loading                 Stable dimensions +     Prevent duplicate
                          small progress          activation
                          indicator               

  Error                   Semantic border/icon +  Recovery action
                          explicit text           provided

  Success                 Muted success           Only after verified
                          icon/dot + text         result
  -----------------------------------------------------------------------

## 2.3 Component specs

### `VF/Button/PrimaryPill`

**Purpose:** The one primary action for the current UI state.

**Anatomy:** label; optional leading icon; optional trailing progress
indicator; pill container.

**Tokens:** `vf.color.accent-600`, `vf.radius.pill`, `vf.space.3`
vertical padding, `vf.space.4` horizontal padding,
`vf.type.body-medium`.

**Sizing:** minimum 44 × 44 CSS px on web where practical; 48 × 48 dp on
Android. Full width in onboarding and compact surfaces where
appropriate.

**Variants:** `standard`, `full-width`, `with-icon`, `loading`,
`destructive-confirmation` (only if action semantics require a
destructive treatment; never recolor all primary actions red).

**States:** default, hover, pressed, focus, disabled, loading.

**Rules:** one per visible state. Disabled state needs a reason nearby
if the disabled condition is not obvious. Loading must prevent duplicate
requests.

``` text
+--------------------------------------+
|  [icon]  Start voice            [..] |
+--------------------------------------+
  12px pill radius? NO: radius = 999px
  Height >= 44px web / 48dp Android
```

### `VF/Button/SecondaryGhostPill`

**Purpose:** Safe alternative, cancel, skip, retry-secondary, or manual
fallback.

**Anatomy:** label and optional icon; transparent or surface fill;
hairline outline.

**Tokens:** `vf.color.text-primary`, `vf.color.hairline`,
`vf.radius.pill`.

**Variants:** `outline`, `ghost`, `icon-leading`.

**Rules:** must not visually compete with the primary action. Cancel
must remain available in any pending or active command state.

``` text
+--------------------------------------+
|               Type instead           |
+--------------------------------------+
  Transparent fill; 1px hairline; pill
```

### `VF/Status/Dot`

**Purpose:** Compact machine/service or form-detection status.

**Variants:** `neutral`, `active`, `success`, `warning`, `error`,
`offline`.

**Size:** 6--8 px web / 8 dp Android, with a larger hit area if
interactive.

**Rules:** never communicate status by color alone. Pair with label or
accessible name. Only `active` may pulse, and only for a real active
process.

``` text
● Core ready     ● Mic off     ● Listening
```

### `VF/Status/Chip`

**Purpose:** Text-bearing compact status: `Connected`,
`Needs attention`, `Offline`, `3 forms found`.

**Anatomy:** status dot/icon + short label; pill fill; optional dismiss
only for dismissible notices.

**Rules:** 24--30 px height; status copy must be concise. Avoid multiple
status chips competing in a single row.

### `VF/Input/TextField`

**Purpose:** Manual entry, editing transcript values, or changing a
proposed field value.

**Anatomy:** visible label; input container; placeholder/value; optional
helper text; optional error line; optional trailing clear/edit icon.

**Tokens:** `vf.radius.control`, `vf.border.hairline`, `vf.focus.inset`,
`vf.focus.glow`.

**States:** default, focused, filled, disabled, read-only, error,
success-verified.

**Rules:** visible label must remain when the field is populated.
Placeholder is not a label. Do not auto-clear existing values on focus.
Preserve entered text on recoverable errors.

``` text
Company name
+--------------------------------------+
| Acme Inc.                         [x]|
+--------------------------------------+
  Error: Use a valid company name.
```

### `VF/Control/Segmented`

**Purpose:** Small mutually exclusive choices such as
`All / Web / Native` or a compact settings mode.

**Anatomy:** track; segments; selected fill; selected label.

**Rules:** 2--4 segments preferred. If options are numerous, use a list
or select control. Support arrow-key navigation on web and accessible
selected-state announcements.

### `VF/Row/FormItem`

**Purpose:** One detected form or candidate field.

**Anatomy:** optional icon; primary title; secondary context/source;
trailing count/status/chevron.

**Variants:** `detected-form`, `candidate-field`, `field-progress`,
`history-item`.

**States:** default, hover, selected, focused, unavailable, ambiguous.

**Rules:** the entire row can be selectable, but nested controls need
separate hit targets. Candidate-field rows must show enough context to
disambiguate same-name fields.

``` text
+------------------------------------------------+
| [form]  Contact form                           |
|         Salesforce · 6 fields              [>] |
+------------------------------------------------+
```

### `VF/Command/ActionCard`

**Purpose:** Show a parsed command as action + target + optional value
before it is applied.

**Anatomy:** action label; target field; proposed value; optional edit
affordance; risk/confirmation indicator when applicable.

**Variants:** `field-edit`, `clear-field`, `navigation`, `submit`,
`unsupported`.

**Rules:** action and target must be readable without expanding.
High-risk commands show the actual external action and use
`VF/Safety/ConfirmPill`. Unsupported commands explain why and provide
manual fallback. Never display a confidence score as a substitute for
ambiguity resolution.

``` text
+------------------------------------------+
| Set company                         [edit]|
| Target: Company name                     |
| Value:  Acme Inc.                        |
+------------------------------------------+
```

### `VF/Safety/ConfirmPill`

**Purpose:** Gate consequential actions with a three-second minimum
delay and explicit authorization.

**Anatomy:** short action-specific label; countdown/progress;
disabled/enabled Confirm; Cancel affordance.

**States:** hidden, countdown-3, countdown-2, countdown-1, enabled,
canceled, timed-out, invalidated.

**Rules:** countdown uses a monotonic deadline. Confirm is disabled
until elapsed time is at least 3,000 ms. Countdown completion does not
execute. Escape, Cancel, Android Back, timeout, target change, or
session loss cancels. `Say Confirm` is accepted only as a fresh
utterance for the active pending-action ID and only after the delay.

``` text
+--------------------------------------------------+
| Submit this form?              [Confirm · 3s] [x]|
+--------------------------------------------------+
       3 → 2 → 1 → Confirm enabled
```

### `VF/Status/ListeningBadge`

**Purpose:** Make active microphone capture obvious.

**Anatomy:** one pulsing dot/wave icon; `LISTENING…` label.

**Rules:** shown only while capture is truly active. One 1,600 ms pulse
cycle. No pulse during parsing or transcription. Accessible label
announces listening state once, not on every animation tick.

### `VF/Transcript/PreviewBubble`

**Purpose:** Display live partial and final transcript without implying
command execution.

**Variants:** `partial`, `final`, `empty`, `editable`.

**Rules:** partial text updates may debounce visually by 120--180 ms;
audio processing must not be delayed. Final transcript is visibly
distinct from partial text. A transcript alone never authorizes action.

``` text
+----------------------------------------------+
| [wave] “Set company to Acme…”                |
|        Listening · partial transcript        |
+----------------------------------------------+
```

### `VF/Control/HelperChip`

**Purpose:** Small suggestion or manual recovery action,
e.g. `Say “Set company to Acme”`, `Type instead`.

**Rules:** one-line, compact, optional. Must not be the only way to
discover a critical action. Never place a high-risk action in a helper
chip that bypasses confirmation.

### `VF/Sheet/Zen`

**Purpose:** Guided form completion, one field at a time.

**Anatomy:** drag/close handle; form title; `n/N` counter; segmented
progress; field label/value; Speak/Next; Back; Dismiss.

**States:** closed, opening, field, listening, reviewing, final-review,
confirming, closing.

**Rules:** keep the underlying page visible where feasible. Dismiss
stops the session and does not submit. Back changes the current field
index but does not erase previous values. Submit uses the shared
confirmation controller.

### `VF/Permission/BlockedBanner`

**Purpose:** Explain a missing capability and provide recovery.

**Anatomy:** neutral warning icon; concise title; one-sentence reason;
primary recovery; secondary manual fallback.

**Variants:** `mic-blocked`, `accessibility-disabled`, `core-offline`,
`service-unavailable`.

**Rules:** permission request must be preceded by an explanation. Never
imply that the user must grant permission to use manual workflows.

### `VF/Health/HealthStrip`

**Purpose:** Compact status for Core, STT, and microphone.

**Anatomy:** three labeled indicators: `Core`, `Speech`, `Mic`; each
with dot and text or accessible state.

**States:** checking, healthy, degraded, blocked, offline.

**Rules:** distinguish app processing from permission status. Do not
show `Healthy` based only on a stale previous check. Recheck on
voice-session start and after returning from system settings.

### `VF/Overlay/DragHandle`

**Purpose:** Discoverable movement affordance for the Android floating
overlay and Zen sheet.

**Rules:** 32--48 dp wide visual handle with a sufficiently large touch
target. Drag and tap must not conflict. Provide a non-drag way to
dismiss or collapse.

### `VF/Progress/SegmentedProgress`

**Purpose:** Setup step progress or Zen field progress.

**Variants:** `setup-3-step`, `field-n-of-N`.

**Rules:** pair visual progress with textual `Step 2 of 3` or `2 of 6`.
Progress never communicates completion before work is verified.

### `VF/Feedback/InlineError`

**Purpose:** Local error attached to the failed field or command.

**Anatomy:** error icon; brief description; recovery link/button.

**Rules:** place next to the affected object; avoid global alert banners
for a local field issue. Use danger color sparingly and always include
text.

### `VF/Control/IconButton`

**Purpose:** Close, clear, help, settings, edit, or navigation.

**Rules:** accessible name required. Minimum target 44 CSS px / 48 dp.
`x` means dismiss/cancel, never confirm. Destructive operations must not
be represented by an unlabeled generic icon.

### `VF/Control/DisclosureRow`

**Purpose:** Progressive disclosure for advanced settings and
diagnostics.

**Anatomy:** label; optional subtitle; chevron; expanded content.

**Rules:** show current state and preserve it when expanded/collapsed.
Keep primary action outside the advanced section.

------------------------------------------------------------------------

# 3. State machines and operational mechanics

## 3.1 Setup / onboarding

``` text
WELCOME
  └─ Enable voice → EXPLAIN_PERMISSION → SYSTEM_PERMISSION
       ├─ Granted → CHECK_HEALTH
       │    ├─ Core + STT ready → DEMO_READY
       │    │    ├─ Start demo → DEMO_LISTENING → DEMO_REVIEW → DEMO_SUCCESS → READY
       │    │    ├─ Demo failure → DEMO_ERROR → Retry / Skip
       │    │    └─ Skip → READY
       │    └─ Core unavailable → CORE_OFFLINE → Retry / Continue without voice
       ├─ Denied → MIC_BLOCKED → Open Settings / Retry / Type instead
       └─ Cancel → WELCOME
```

  ---------------------------------------------------------------------------------------
  State                  Copy           Primary        Secondary      Exit condition
  ---------------------- -------------- -------------- -------------- -------------------
  `welcome`              "Fill forms by Enable voice   Not now        User chooses
                         voice." /                                    
                         "Voice access                                
                         is requested                                 
                         only when you                                
                         choose to                                    
                         enable it."                                  

  `explain_permission`   "VoiceForm     Continue       Cancel         User continues
                         needs                                        
                         microphone                                   
                         access to hear                               
                         your command."                               

  `mic_requesting`       OS permission  OS action      OS cancel      Permission result
                         prompt                                       

  `mic_blocked`          "Microphone    Open Settings  Try again;     Recheck on resume
                         access is                     Type instead   
                         off." /                                      
                         "Enable it to                                
                         speak                                        
                         commands."                                   

  `checking_health`      "Checking      None           Cancel setup   Health result
                         voice                                        
                         services..."                                 

  `core_offline`         "Voice         Retry          Continue       Recheck or skip
                         processing                    without voice  
                         isn't                                        
                         available."                                  

  `demo_ready`           "Try a sample  Start demo     Skip demo      User choice
                         form." / "Say:                               
                         Set company to                               
                         Acme."                                       

  `demo_listening`       `LISTENING…`   Stop           Cancel         Final
                                                                      transcript/cancel

  `demo_review`          "I heard: Set  Apply demo     Edit / Retry   Explicit action
                         company to                                   
                         Acme."                                       

  `demo_success`         "Demo          Finish setup   Try again      Verified demo
                         complete." /                                 
                         "1 field                                     
                         updated."                                    

  `demo_error`           Specific       Retry          Skip demo      Retry/skip
                         error +                                      
                         recovery copy                                

  `ready`                "VoiceForm is  Return to form Open settings  Exit setup
                         ready."                                      
  ---------------------------------------------------------------------------------------

Permission must never be requested on install or because a form was
passively detected. Android accessibility service enablement is separate
from microphone permission.

## 3.2 Tap-to-talk

``` text
IDLE
  └─ explicit Start → LISTENING
       ├─ Cancel → IDLE
       └─ Stop / speech end → TRANSCRIBING
            ├─ empty / timeout → ERROR_EMPTY_STT
            └─ final transcript → PARSING
                 ├─ Core unavailable → ERROR_CORE_OFFLINE
                 ├─ ambiguous target → ERROR_AMBIGUOUS
                 ├─ no match → ERROR_NO_MATCH
                 └─ valid intent → REVIEWING
                      ├─ Cancel → IDLE
                      ├─ ordinary field edit → EXECUTING
                      └─ consequential action → CONFIRM_GATE
                           ├─ Cancel / timeout → IDLE
                           └─ explicit Confirm → EXECUTING
                                ├─ verified → DONE
                                └─ failure → ERROR_EXECUTION
```

  ----------------------------------------------------------------------------
  State                  Copy              Required UI       Guard
  ---------------------- ----------------- ----------------- -----------------
  `idle`                 "Choose a form to Form list + Start No mic capture
                         start."           voice             

  `listening`            `LISTENING…`      Listening badge,  Capture active
                                           partial           
                                           transcript, Stop, 
                                           Cancel            

  `transcribing`         "Finishing        Stable transcript Capture stopped
                         transcript..."    preview/loading   

  `parsing`              "Understanding    Compact progress  Core available
                         command..."       state             

  `reviewing`            "Set company →    Action card,      Unique target and
                         Acme"             Edit,             valid command
                                           Apply/Cancel      

  `executing`            "Filling          Focus cue,        Authorized
                         Company..."       progress on       mutation
                                           target            

  `done`                 "Company filled." Verified status,  Read-back passed
                                           next              
                                           command/dismiss   

  `error_empty_stt`      "I didn't catch   Retry + Type      No mutation
                         that."            instead           

  `error_core_offline`   "Voice processing Retry + Type      No mutation
                         isn't available." instead           

  `error_ambiguous`      "Which field do   Candidate rows    No automatic
                         you mean?"                          choice

  `error_no_match`       "I couldn't find  Choose field /    No substitution
                         that field."      retry / type      

  `error_execution`      "That field       Retry field /     Avoid duplicate
                         couldn't be       Edit manually     writes
                         updated."                           
  ----------------------------------------------------------------------------

A state transition must carry a structured event, guard result, and
session/attempt ID. Stale events from prior attempts must be ignored.

## 3.3 Confirm pill

``` text
HIDDEN
  └─ risky action proposed → COUNTDOWN_3
       ├─ Cancel / Esc / Android Back → CANCELLED → HIDDEN
       ├─ target changed / session lost → INVALIDATED → HIDDEN
       └─ deadline elapsed → ENABLED
            ├─ Cancel → CANCELLED
            └─ tap Confirm / valid fresh “Confirm” → REVALIDATE
                 ├─ validation failed → INVALIDATED
                 └─ valid → EXECUTE EXACT PENDING ACTION
```

Copy examples: - `Submit this form?` -
`Review this payment before continuing.` -
`Confirm available in 3 seconds` - `Confirm` -
`Cancelled. Nothing was submitted.` -
`The form changed. Please review again.`

Countdown ticks at `3`, `2`, `1`, then enables Confirm at elapsed time ≥
3,000 ms. Never auto-submit. A fresh spoken "Confirm" is eligible only
after the prompt is visible and the gate is enabled. The transcript used
to create the pending action cannot also confirm it.

## 3.4 Zen mode

``` text
CLOSED → OPENING → FIELD(n/N)
                  ├─ Speak → LISTENING → REVIEW_VALUE → FIELD(n/N)
                  ├─ Next → FIELD(n+1/N)
                  ├─ Back → FIELD(n-1/N)
                  ├─ last field → FINAL_REVIEW
                  │                  └─ Submit → CONFIRM_GATE → EXECUTE → CLOSED
                  └─ Dismiss / Esc / Android Back → CLOSED
```

-   `FIELD(n/N)`: "Company name", current value, Speak, Next, Back,
    Dismiss.
-   `LISTENING`: "Listening..." and transcript; no automatic advancement
    from partial text.
-   `REVIEW_VALUE`: show proposed value; Apply, Edit, Retry.
-   `FINAL_REVIEW`: list changes; Submit (if a submit action exists),
    Continue editing, Dismiss.
-   `CLOSED`: stop capture, cancel pending action, release focus. Do not
    rollback applied edits.

## 3.5 Shared session data contract

Suggested logical model (language-agnostic):

``` ts
type VoiceSession = {
  sessionId: string;
  surfaceId: string;
  formId?: string;
  state: "idle" | "listening" | "transcribing" | "parsing" |
         "reviewing" | "executing" | "done" | "error";
  attemptId?: string;
  transcript?: { text: string; final: boolean };
  pendingCommand?: {
    commandId: string;
    action: string;
    targetId?: string;
    value?: unknown;
    risk: "ordinary" | "consequential" | "unsupported";
  };
  pendingAuthorization?: {
    authorizationId: string;
    commandId: string;
    targetFingerprint: string;
    createdAtMonotonic: number;
    confirmAfterMonotonic: number;
    status: "countdown" | "enabled" | "cancelled" | "invalidated";
  };
};
```

This is a conceptual contract, not a demand to use a specific language.
Authorization must be server-/controller-validated at execution time and
bound to the exact command and target fingerprint. Never persist a live
authorization across process restart.

------------------------------------------------------------------------

# 4. Copy bank (English)

## 4.1 Permission and setup

  -----------------------------------------------------------------------
  Key                                 Copy
  ----------------------------------- -----------------------------------
  `copy.permission.title`             "Allow microphone access"

  `copy.permission.reason`            "VoiceForm needs microphone access
                                      to hear your spoken commands."

  `copy.permission.enable`            "Enable voice"

  `copy.permission.denied.title`      "Microphone access is off."

  `copy.permission.denied.body`       "Enable it to speak commands."

  `copy.permission.open_settings`     "Open Settings"

  `copy.permission.retry`             "Try again"

  `copy.permission.manual`            "Type instead"

  `copy.accessibility.reason`         "VoiceForm uses accessibility
                                      access to identify form fields and
                                      interact with them when you ask."

  `copy.setup.health_check`           "Checking voice services..."

  `copy.setup.ready`                  "VoiceForm is ready."

  `copy.setup.skip`                   "Continue without voice"

  `copy.setup.demo`                   "Try a sample form."

  `copy.setup.demo_command`           "Say: Set company to Acme."

  `copy.setup.demo_success`           "Demo complete."

  `copy.setup.demo_success_detail`    "1 field updated."
  -----------------------------------------------------------------------

## 4.2 Listening and transcript

  -----------------------------------------------------------------------
  Key                                 Copy
  ----------------------------------- -----------------------------------
  `copy.voice.start`                  "Listening..."

  `copy.voice.stop`                   "Stop listening"

  `copy.voice.transcribing`           "Finishing transcript..."

  `copy.voice.parsing`                "Understanding command..."

  `copy.voice.partial_label`          "Live transcript"

  `copy.voice.final_label`            "I heard"

  `copy.voice.cancelled`              "Listening stopped. No new changes
                                      were made."

  `copy.voice.try_again`              "Try again"
  -----------------------------------------------------------------------

## 4.3 Confirmation

  -----------------------------------------------------------------------
  Key                                 Copy
  ----------------------------------- -----------------------------------
  `copy.confirm.submit`               "Submit this form?"

  `copy.confirm.payment`              "Review this payment before
                                      continuing."

  `copy.confirm.delete`               "Delete this item?"

  `copy.confirm.countdown`            "Confirm available in {seconds}
                                      seconds"

  `copy.confirm.enabled`              "Confirm"

  `copy.confirm.cancel`               "Cancel"

  `copy.confirm.voice_hint`           "You can say "Confirm" when the
                                      button is enabled."

  `copy.confirm.cancelled`            "Cancelled. Nothing was submitted."

  `copy.confirm.expired`              "Confirmation expired. Review the
                                      action to try again."

  `copy.confirm.invalidated`          "The form changed. Please review
                                      again."
  -----------------------------------------------------------------------

## 4.4 Failure and recovery

  -----------------------------------------------------------------------
  Key                                 Copy
  ----------------------------------- -----------------------------------
  `copy.error.empty_stt.title`        "I didn't catch that."

  `copy.error.empty_stt.body`         "Try speaking again, or enter the
                                      value."

  `copy.error.core.title`             "Voice processing isn't available."

  `copy.error.core.body`              "Your form hasn't been changed by
                                      this command."

  `copy.error.ambiguous.title`        "Which field do you mean?"

  `copy.error.ambiguous.body`         "I found more than one match."

  `copy.error.no_match.title`         "I couldn't find that field."

  `copy.error.no_match.body`          "Try its visible label or choose a
                                      field from the list."

  `copy.error.execution.title`        "That field couldn't be updated."

  `copy.error.execution.body`         "Check the field and try again."

  `copy.error.retry`                  "Retry"

  `copy.error.choose_field`           "Choose field"

  `copy.error.edit_manually`          "Edit manually"

  `copy.error.diagnostics`            "Open diagnostics"
  -----------------------------------------------------------------------

## 4.5 Success and demo commands

  Key                       Copy
  ------------------------- ------------------------------------
  `copy.success.field`      "{field} filled."
  `copy.success.count`      "{count} fields updated."
  `copy.success.verified`   "Changes verified."
  `copy.demo.company`       "Set company to Acme."
  `copy.demo.contact`       "Set contact name to Jordan Lee."
  `copy.demo.email`         "Set email to jordan@example.com."
  `copy.demo.clear`         "Clear the company field."
  `copy.demo.next`          "Next field."
  `copy.zen.next`           "Next field"
  `copy.zen.back`           "Previous field"
  `copy.zen.dismiss`        "Dismiss"
  `copy.zen.final_review`   "Review your changes."

Do not use "Done" when only transcription or parsing completed. Use the
phase-specific copy above.

------------------------------------------------------------------------

# 5. Screen and motion specifications

## 5.1 Global motion tokens

  Token                                        Value Use
  --------------------------------- ---------------- ---------------------------------
  `vf.motion.press`                      100--150 ms Pressed feedback
  `vf.motion.fast`                            120 ms Small color/opacity transitions
  `vf.motion.standard`                   150--180 ms Focus, hover, status changes
  `vf.motion.panel`                      180--220 ms Panel transitions
  `vf.motion.sheet`                      220--250 ms Zen sheet
  `vf.motion.success`                    300--500 ms Success indicator
  `vf.motion.listening-pulse`         1,600 ms cycle Active mic only
  `vf.motion.transcript-debounce`        120--180 ms Render batching only
  `vf.motion.confirm-tick`                  1,000 ms Countdown display
  `vf.motion.confirm-minimum`               3,000 ms Authorization delay

Easing: `cubic-bezier(.2,.8,.2,1)` on web; use Compose
`FastOutSlowInEasing` or a similar restrained ease-out curve where it
feels native. Under reduced motion, remove spatial translation and
pulse; use immediate changes or brief opacity fades.

### Sound cues

-   Start: soft ascending two-part blip, perceived range roughly
    600--900 Hz, 80--140 ms. Play only after capture has started.
-   Stop: related descending blip, roughly 500--750 Hz, 70--120 ms. Play
    once when capture ends normally.
-   Completion: optional single neutral high-mid blip, 80--120 ms, only
    after field mutation is verified.
-   Never use repeated chimes on partial transcript updates. Support
    mute and respect OS preferences. Sound is supplementary, never the
    only status channel.

------------------------------------------------------------------------

# 6. Surface specifications

## 6.1 `VF-SURF-01` --- Browser Side Panel

### Goal

Persistent workspace for finding forms, starting voice interaction,
reviewing commands, checking health, and opening Zen mode/settings. It
is the primary browser experience.

### Proposed layout

``` text
+--------------------------------------------+
| [VF icon] VoiceForm                 [x]     |
|--------------------------------------------|
| DETECTED FORMS                         3   |
| +----------------------------------------+ |
| | New opportunity                        | |
| | Salesforce · 8 fields               >  | |
| +----------------------------------------+ |
| | Contact form                            | |
| | CRM · 6 fields                       >  | |
| +----------------------------------------+ |
| | Checkout                                | |
| | Store · 4 fields                     >  | |
| +----------------------------------------+ |
|                                            |
| [ Primary: Start voice ]                   |
|                                            |
| ACTIVE FORM                                |
| Set company → Acme Inc.                    |
| [Edit] [Apply]                             |
|                                            |
| [Health: Core ● Speech ● Mic ●]            |
| Forms     History     Settings              |
+--------------------------------------------+
```

### Layout order

1.  Header: product mark, `VoiceForm`, close/collapse affordance.
2.  Detected forms section: count + rows.
3.  Empty/error state for discovery, when applicable.
4.  Primary `Start voice` button, enabled only when a form is selected
    and prerequisites are met.
5.  Active command area: transcript, action card, or execution status.
6.  Optional Zen mode row.
7.  Health strip.
8.  Bottom navigation: Forms, History (if supported), Settings.

### Frame contract

-   **Goal:** fast access to detected forms and active command.
-   **Primary control:** `VF/Button/PrimaryPill` --- Start voice / Stop
    listening / Apply based on state.
-   **Status affordance:** `VF/Status/Chip` count +
    `VF/Health/HealthStrip`.
-   **Empty state:** "No forms found on this page." / "Open a page with
    a form, or try the demo."
-   **Error state:** "Form detection isn't available on this page." /
    "Try another page or enter values manually."
-   **Component relationships:** `FormItem` → selected form →
    `ListeningBadge` + `TranscriptPreview` → `ActionCard` →
    `ConfirmPill` if risk requires → `HealthStrip`.
-   **Design compliance:** grayscale surfaces, blue primary action, one
    primary at a time, no full-screen modal, 14 px body and 12 px
    captions, 12--14 px control radius, hairline dividers.
-   **Variants:** no forms; forms detected; form selected; listening;
    transcript ready; parsing; reviewing; executing; done; Core offline;
    permission blocked.

### ASCII state variations

``` text
EMPTY                    DETECTED
+------------------+     +------------------+
| No forms found   |     | 3 forms found    |
| Open a form or   |     | [Form row]       |
| try the demo     |     | [Form row]       |
| [Try demo]       |     | [Start voice]    |
+------------------+     +------------------+

LISTENING                REVIEWING
+------------------+     +------------------+
| LISTENING...     |     | Set company      |
| "Acme..."        |     | Target: Company  |
| [Stop] [Cancel]  |     | Value: Acme      |
+------------------+     | [Apply] [Cancel] |
                         +------------------+
```

### Operational mechanics

-   Form detection updates the list locally; do not start mic capture.
-   Selecting a form sets active form context but does not mutate
    fields.
-   Starting voice rechecks mic and Core health, then starts capture.
-   Side panel closure cancels active capture and pending authorization.
    It does not undo already-applied fields.
-   A form list row must show enough source context to distinguish
    duplicate forms.

## 6.2 `VF-SURF-02` --- Options / Onboarding

### Goal

Explain value, obtain permissions only after user intent, verify
Core/STT, and demonstrate a safe command.

### Proposed layout

``` text
+----------------------------------------------------+
| VoiceForm Universal                                |
| Fill forms by voice. On web and Android.           |
|                                                    |
| Step 1 of 3 — Enable voice                         |
| [mic illustration]                                 |
| VoiceForm needs microphone access to hear commands.|
| [Enable voice]                                     |
| [Skip for now]                                     |
|                                                    |
| Step 2 — Connection healthy                         |
| Core      ● Ready                                  |
| Speech    ● Ready                                  |
| Mic       ● Ready                                  |
| [Continue]                                         |
|                                                    |
| Step 3 — Try demo form                              |
| Say: “Set company to Acme.”                        |
| [Start demo]                                       |
+----------------------------------------------------+
```

### Frame contract

-   **Goal:** onboarding and capability setup.
-   **Primary control:** `Enable voice`, then `Continue`, then
    `Start demo` / `Finish setup`.
-   **Status affordance:** `SegmentedProgress` plus `HealthStrip`.
-   **Empty state:** not applicable before permission; if no demo form
    exists, show "Demo form unavailable" and offer Skip.
-   **Error state:** permission denied banner; Core offline retry; demo
    failure with retry/skip.
-   **Component relationships:** `SegmentedProgress` →
    `PermissionBlockedBanner` or `HealthStrip` → `PrimaryPill` +
    `SecondaryGhostPill` → demo `ActionCard`.
-   **Design compliance:** one primary action visible per step; explain
    permission before OS prompt; illustration must not imply recording
    before permission/start; no install-time permission request.
-   **Variants:** welcome; permission rationale; OS permission request;
    denied; health check; Core offline; demo ready; demo listening; demo
    success; demo error; complete.

### Workflow diagram

``` text
WELCOME
  | Enable voice
  v
PERMISSION RATIONALE
  | Continue
  v
OS MIC PROMPT ---- denied ----> BLOCKED
  | granted                         | Open Settings / Retry / Skip
  v                                 |
HEALTH CHECK <----------------------+
  | ready
  v
DEMO READY -- Start --> LISTENING --> REVIEW --> VERIFIED SUCCESS
  | Skip                                   | failure
  v                                        v
READY <-------------------------------- DEMO ERROR
```

### Behavior

-   Each step can be revisited from settings.
-   Skip never creates a broken or blocked experience; manual entry
    remains available.
-   When returning from OS settings, re-evaluate permissions and service
    status rather than trusting stale state.
-   Demo commands must operate on a local/sample form and must not send
    external submissions.

## 6.3 `VF-SURF-03` --- In-Page Cues

### Goal

Provide subtle, non-destructive cues on the actual page: detected form
border, active field focus, listening status, transcript preview, and
authorization pill.

### Proposed layout

``` text
Browser page
+----------------------------------------------------+
| CRM page                                           |
| Company name                                       |
| +----------------------------------------------+   |
| | Acme Inc.                    [LISTENING...]  |   |
| +----------------------------------------------+   |
|   ^ thin accent outline; no large overlay          |
|                                                    |
|       [ transcript preview bubble ]                |
|                                                    |
|                         [Submit · Confirm 3s] [x]  |
+----------------------------------------------------+
```

### Frame contract

-   **Goal:** communicate context and active target without obscuring
    the host page.
-   **Primary control:** context-specific field action / Stop / Confirm
    only when the relevant state requires it.
-   **Status affordance:** subtle form border, `ListeningBadge`,
    `TranscriptPreview`, active field ring.
-   **Empty state:** no persistent in-page cue if no eligible form is
    detected.
-   **Error state:** small anchored `InlineError` near the active
    target, with retry/type/choose field.
-   **Component relationships:** `FormItem` detection → active field
    focus → `ListeningBadge` → `TranscriptPreview` →
    `ActionCard`/`ConfirmPill`.
-   **Design compliance:** no full-page scrim; preserve host controls;
    no layout shift; focus ring inset + thin glow; floating chrome may
    use blur, not page content.
-   **Variants:** detected form; active form; listening; transcript;
    target candidate; ambiguous target; no match; confirm countdown;
    Core unavailable.

### ASCII variants

``` text
DETECTED FORM             ACTIVE FIELD
+-------------------+     +===================+
| Contact form      |     || Company name    ||
| subtle blue edge  |     || Acme Inc.       ||
+-------------------+     +===================+
                                  ^
                         thin accent ring only

CONFIRM PILL
+-------------------------------------------+
| Submit this form?        [Confirm · 3s] [x]|
+-------------------------------------------+
```

### Behavior

-   Passive detection is local-only and never activates the mic.
-   Avoid shifting page layout; use overlays/anchored cues with
    collision avoidance.
-   If the page rerenders and the target node changes, re-resolve it. If
    identity is uncertain, stop and request review.
-   If a host page blocks extension injection or uses inaccessible
    fields, report the limitation rather than guessing.

## 6.4 `VF-SURF-04` --- Zen Sheet

### Goal

Guide a user through all fields in sequence while keeping the underlying
form visible and dismissible.

### Proposed layout

``` text
        [drag / close handle]
+--------------------------------------+
| FORM GUIDANCE                    [x] |
| Contact form                    2 of 6|
| [=====-------------]                  |
|                                      |
| CURRENT FIELD                        |
| Company name                         |
| +----------------------------------+ |
| | Acme Inc.                        | |
| +----------------------------------+ |
|                                      |
| [Speak value]       [Next field]     |
| 1 field completed          Dismiss   |
+--------------------------------------+
```

### Frame contract

-   **Goal:** one-field-at-a-time guidance.
-   **Primary control:** `Next field` during navigation; `Confirm` only
    inside submit authorization.
-   **Status affordance:** `n/N` + `SegmentedProgress`, current field
    label, listening badge if active.
-   **Empty state:** "No fields to guide through." / "Close Zen mode and
    choose another form."
-   **Error state:** inline error attached to field; retry/edit
    manually.
-   **Component relationships:** `ZenSheet` → `SegmentedProgress` →
    `TextField`/`ActionCard` → `ListeningBadge`/`TranscriptPreview` →
    shared `ConfirmPill`.
-   **Design compliance:** 22 px sheet radius, one accent, background
    page visible, no auto-advance on partial transcript, safe dismiss.
-   **Variants:** opening; field n/N; listening; reviewing value;
    validation error; final review; confirming submit; dismissed.

### Operational diagram

``` text
OPEN
  v
FIELD n/N <---- Back ---- FIELD n-1/N
  | Speak
  v
LISTENING -> REVIEW VALUE -> Apply -> FIELD n/N
  |
  +-- Next ----------------------> FIELD n+1/N
  |
  +-- Last field ----------------> FINAL REVIEW
                                      | Submit
                                      v
                                  CONFIRM GATE
                                   /       \
                               Cancel     Confirm
                                 |          |
                              REVIEW     EXECUTE
                                            |
                                        VERIFIED
                                            |
                                          CLOSE
```

### Behavior

-   Back changes field index without erasing prior values.
-   Next commits only the current authorized field edit.
-   Dismiss cancels capture and pending authorization. Applied values
    remain.
-   Final Review summarizes the changes and separates "Submit" from
    "Finish filling."
-   The sheet must not steal focus from a field in a way that prevents
    assistive technology from understanding the page.

## 6.5 `VF-SURF-05` --- Mini Popup

### Goal

Provide a tiny launcher and entry point only. Detailed command review
belongs in the Side Panel or in-page cues.

### Proposed layout

``` text
+-------------------------------+
| [VF] VoiceForm           [⚙]  |
|                               |
|          [ mic ]              |
|         Tap to start          |
|                               |
| Detected forms            3 > |
+-------------------------------+
```

### Frame contract

-   **Goal:** launch the workflow quickly.
-   **Primary control:** mic / `Start voice` (routes to Side Panel or
    explicit supported flow).
-   **Status affordance:** mic state + detected form count.
-   **Empty state:** "No forms detected." / "Open a page with a form."
-   **Error state:** "Microphone access is off." with Open Settings /
    Type instead.
-   **Component relationships:** `IconButton`, `PrimaryPill` (only if
    needed), `StatusDot`, `StatusChip`, `FormItem` summary.
-   **Design compliance:** compact 280--320 px width, no transcript
    editing workspace, no multi-step confirmation workflow housed solely
    in popup.
-   **Variants:** idle; forms detected; mic blocked; Core unavailable;
    launching.

### Behavior

-   Popup closes when Chrome closes it; treat it as ephemeral.
-   Do not start recording merely because popup opens.
-   If active voice work needs a stable workspace, open the Side Panel
    and show the session state there.
-   A popup close must not be interpreted as Confirm.

## 6.6 `VF-SURF-06A` --- Android Overlay: Collapsed

### Goal

Persistent compact launcher that is easy to find and move, without
recording.

### Proposed layout

``` text
      host app content
+----------------------------+
|                            |
|                       +--+ |
|                       |VF| |
|                       |mic| |
|                       +--+ |
|                            |
+----------------------------+
```

### Frame contract

-   **Goal:** one-tap access to VoiceForm.
-   **Primary control:** floating VoiceForm button.
-   **Status affordance:** optional neutral availability dot; never a
    listening pulse when idle.
-   **Empty state:** not applicable; collapsed overlay is the launcher.
-   **Error state:** if overlay permission/service is unavailable, show
    setup activity with actionable recovery.
-   **Component relationships:** `Overlay/DragHandle` (movement
    affordance), `IconButton`, `StatusDot`.
-   **Design compliance:** compact floating surface, shadow, 48 dp
    minimum interactive target, no content-heavy card, one blue accent.
-   **Variants:** idle; dragging; unavailable; dismissed.

### Behavior

-   Tap expands; drag repositions; long-press may expose movement
    affordance but must not conflict with tap.
-   The overlay must not start microphone capture passively.
-   Provide a clear dismissal/collapse path.
-   Respect system insets and avoid covering essential host-app
    controls.

## 6.7 `VF-SURF-06B` --- Android Overlay: Expanded

### Goal

Show the active voice session and minimum required controls without
becoming a full app window.

### Proposed layout

``` text
+-----------------------------------+
|             [handle]              |
| VoiceForm                    [x]  |
|-----------------------------------|
| [dot] LISTENING...                 |
| “Set company to Acme”              |
|-----------------------------------|
| [Stop listening]                  |
| Company name  → Acme Inc.     [edit]|
|-----------------------------------|
| [Cancel] / [Confirm · 3s] as needed|
+-----------------------------------+
```

### Frame contract

-   **Goal:** manage a live command from any supported app.
-   **Primary control:** Stop listening, Apply, or enabled Confirm
    according to state.
-   **Status affordance:** `ListeningBadge`, transcript preview, drag
    handle, Core/Speech/Mic status when relevant.
-   **Empty state:** "Choose a field or form to start." if no target is
    available.
-   **Error state:** inline error with Retry, Open Settings, Choose
    field, or Type instead.
-   **Component relationships:** `DragHandle`, `ListeningBadge`,
    `TranscriptPreview`, `ActionCard`, `ConfirmPill`, `InlineError`.
-   **Design compliance:** sheet radius 22--24 dp, limited height, text
    contrast, no content overflow, 48 dp targets.
-   **Variants:** expanded idle; listening; transcribing; reviewing;
    executing; confirm countdown; error; collapsed; dismissed.

### Behavior

-   Drag handle moves the overlay; controls remain individually
    tappable.
-   Reposition around keyboard and system insets.
-   Back closes Zen or cancels pill first, then collapses expanded
    overlay. Back never confirms.
-   If accessibility focus or node identity becomes unreliable, stop and
    ask for user selection.
-   When the app goes to background or service is interrupted, stop
    capture and invalidate pending authorization.

## 6.8 `VF-SURF-07` --- Android Setup

### Goal

Guide the user through enabling accessibility service and microphone
permission, explain each requirement, verify status, and offer a test.

### Proposed layout

``` text
+--------------------------------------+
| Set up VoiceForm                     |
| Allow accessibility access to detect |
| forms and interact with them.        |
|                                      |
| 1. Enable accessibility service      |
|    [Open Settings]                   |
|                                      |
| 2. Allow microphone permission       |
|    [Allow microphone]                |
|                                      |
| 3. Check and continue                |
|    Accessibility  ○                  |
|    Microphone      ○                 |
|    Core            ○                 |
|                                      |
| [Continue]                           |
| Learn more                           |
+--------------------------------------+
```

### Frame contract

-   **Goal:** explain and verify required Android capabilities.
-   **Primary control:** Open Settings for accessibility setup, then
    Allow microphone, then Continue after validation.
-   **Status affordance:** step indicator + checklist of service, mic,
    Core.
-   **Empty state:** not applicable; setup is the empty/first-run path.
-   **Error state:** "Accessibility access is off." / "Microphone access
    is off." with direct recovery.
-   **Component relationships:** `SegmentedProgress`,
    `PermissionBlockedBanner`, `HealthStrip`, `PrimaryPill`,
    `DisclosureRow`.
-   **Design compliance:** permission rationale before system settings;
    separate explanations for microphone and accessibility; no
    misleading one-step grant claim.
-   **Variants:** first launch; accessibility disabled; accessibility
    enabled; mic blocked; Core offline; all ready; verification error.

### Workflow

``` text
SETUP INTRO
  |
  v
EXPLAIN ACCESSIBILITY
  | Open Settings
  v
ANDROID ACCESSIBILITY SETTINGS
  | User enables service and returns
  v
RECHECK SERVICE
  |
  v
MIC RATIONALE -> OS MIC PROMPT
  | granted / blocked
  v
HEALTH CHECK
  | all ready
  v
TRY DEMO / FINISH
```

### Behavior

-   Opening Settings is not equivalent to enabling the service. Recheck
    on resume.
-   If the user declines microphone permission, the app may still
    explain setup and manual options but cannot start voice capture.
-   Do not repeatedly prompt if Android indicates the user must change
    settings.
-   Provide a Learn more disclosure with plain-language description of
    accessibility use and data handling.
-   The service must not collect or transmit unrelated screen contents.

------------------------------------------------------------------------

# 7. Component-to-surface mapping

  ----------------------------------------------------------------------------------------------------------------------------------------------
  Component                   Side Panel       Options          In-page       Zen        Popup            Android      Android      Android
                                                                                                          collapsed    expanded     setup
  --------------------------- ---------------- ---------------- ------------- ---------- ---------------- ------------ ------------ ------------
  `PrimaryPill`               Primary          Primary          Contextual    Next /     Optional         No           Contextual   Primary
                                                                              Apply                                                 

  `SecondaryGhostPill`        Cancel /         Skip / Cancel    Cancel        Back /     Optional         No           Cancel       Secondary
                              fallback                                        Dismiss                                               

  `StatusDot`                 Yes              Health           Optional      Optional   Yes              Optional     Yes          Health

  `StatusChip`                Form count       Health           Optional      Progress   Form count       No           Optional     Step state
                                                                              status                                                

  `TextField`                 Edit value       Settings / demo  Host field or Current    No               No           Compact edit No
                                                                editor        value                                                 

  `Segmented`                 Optional filters Optional         No            No         No               No           Rare         No
                                               settings                                                                             

  `FormItem`                  Core             Demo only        Target cues   Field      Summary          No           Target       No
                                                                              context                                  candidate    

  `ActionCard`                Yes              Demo review      Optional      Value      No               No           Yes          Demo
                                                                              review                                                

  `ConfirmPill`               Yes              Demo if needed   Yes           Shared     No               No           Yes          No
                                                                              gate                                                  

  `ListeningBadge`            Yes              Demo             Yes           Yes        No               No           Yes          Demo

  `TranscriptPreview`         Yes              Demo             Yes           Yes        No               No           Yes          Demo

  `HelperChip`                Yes              Yes              Yes           Yes        Rare             No           Yes          Yes

  `ZenSheet`                  Entry point      No               Entry point   Main       No               No           Optional     No
                                                                                                                       entry        

  `PermissionBlockedBanner`   Yes              Yes              Compact       Yes        Compact          Setup route  Yes          Main
                                                                fallback                                                            

  `HealthStrip`               Yes              Yes              Minimal       Optional   Minimal          No           Optional     Yes

  `DragHandle`                No               No               No            Optional   No               Movement     Yes          No
                                                                                                          affordance                

  `SegmentedProgress`         No               Onboarding       No            Field      No               No           Optional     Setup
                                                                              progress                                              progress

  `InlineError`               Yes              Yes              Yes           Yes        Compact          No           Yes          Yes

  `IconButton`                Header/actions   Header/actions   Close/clear   Close      Settings/close   Main mic     Close/edit   Help/close

  `DisclosureRow`             Settings         Advanced setup   No            No         No               No           Rare         Learn more
  ----------------------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 8. Accessibility, privacy, and platform compliance

## 8.1 Accessibility

-   Target WCAG 2.2 AA contrast: 4.5:1 for normal text and 3:1 for large
    text and meaningful UI boundaries/graphics, subject to the
    applicable WCAG definition.
-   Minimum targets: 44 × 44 CSS px on web as a product baseline;
    Android 48 × 48 dp.
-   Keyboard: logical focus order, visible focus, Escape cancellation,
    arrow-key support for segmented controls and candidate lists.
-   Screen readers: announce meaningful state changes once. Do not
    announce every countdown animation frame or partial transcript
    token.
-   Reduced motion: no pulsing, sliding, or spatial movement where
    reduced motion is requested; use immediate state changes or short
    fades.
-   Do not rely on color or sound alone. Pair dots with text and icons.
-   Preserve text selection and host page interaction where possible.
-   Zoom/reflow: content must remain usable at narrow widths and
    increased text size; scrolling should be local to the relevant
    panel/sheet.

## 8.2 Privacy and permissions

-   Passive detection is local-only.
-   Mic is never active during install or passive detection.
-   Permission rationale appears before requesting access.
-   No unrelated screen contents are collected or transmitted.
-   Transcripts should be ephemeral by default; retention/history must
    be an explicit product setting with clear disclosure.
-   Error logging must redact transcript contents and field values by
    default.
-   Do not persist pending authorization across restart, reload, or
    service recovery.
-   Accessibility access is explained separately from microphone access.
-   A local-first claim must reflect actual processing architecture and
    be revised if any stage uses remote processing.

## 8.3 Android Back and cancellation precedence

1.  If a Zen sheet is open, dismiss Zen and cancel any active capture.
2.  Else if a confirmation pill is visible, cancel the pending action
    and close the pill.
3.  Else if the overlay is expanded, collapse it.
4.  Else dismiss the collapsed overlay if platform policy permits.
5.  Never reinterpret Back as Confirm.
6.  On all paths, stop capture and invalidate pending authorization if
    the owning session is dismissed.

------------------------------------------------------------------------

# 9. Engineering implementation notes

## 9.1 Suggested architecture

Separate the state controller from surface rendering. Surfaces subscribe
to a shared session model and dispatch typed events. Platform adapters
own permission requests, audio capture, DOM/accessibility-node
resolution, focus, and mutation.

``` text
UI surfaces
  ├─ Side Panel
  ├─ Options
  ├─ In-page cues
  ├─ Zen
  ├─ Popup
  └─ Android overlay/setup
        |
        v
Shared interaction controller
  ├─ Setup controller
  ├─ Voice session controller
  ├─ Authorization controller
  └─ Zen navigation controller
        |
        v
Capability adapters
  ├─ Mic / STT
  ├─ Core NLU
  ├─ Web DOM resolver + executor
  └─ Android accessibility resolver + executor
```

## 9.2 Typed events

Suggested events: - `FORM_DETECTED` - `FORM_SELECTED` -
`START_REQUESTED` - `MIC_PERMISSION_GRANTED` - `MIC_PERMISSION_DENIED` -
`CAPTURE_STARTED` - `CAPTURE_STOPPED` - `TRANSCRIPT_PARTIAL` -
`TRANSCRIPT_FINAL` - `TRANSCRIPT_EMPTY` - `CORE_READY` -
`CORE_UNAVAILABLE` - `COMMAND_PARSED` - `TARGET_AMBIGUOUS` -
`TARGET_NOT_FOUND` - `REVIEW_ACCEPTED` - `REVIEW_CANCELLED` -
`AUTHORIZATION_CREATED` - `AUTHORIZATION_ENABLED` -
`AUTHORIZATION_CONFIRMED` - `AUTHORIZATION_CANCELLED` -
`TARGET_INVALIDATED` - `EXECUTION_STARTED` - `EXECUTION_VERIFIED` -
`EXECUTION_FAILED` - `SESSION_DISMISSED`

Every event must carry session/attempt identifiers as appropriate.
Ignore late events for stale sessions.

## 9.3 Idempotency and verification

-   Assign a unique command ID to each parsed command.
-   Assign a separate authorization ID to each consequential action.
-   Revalidate the target immediately before mutation/submission.
-   Avoid automatic retries for non-idempotent actions.
-   For field updates, read back the value and compare to expected
    normalized value.
-   For form submission, use host-confirmed result when available; do
    not assume clicking Submit equals successful submission.
-   If result is indeterminate, report "We couldn't verify that the form
    was submitted" and do not retry automatically.

## 9.4 Detection and target resolution

-   Prefer stable DOM/accessibility identifiers and semantic labels.
-   Candidate resolution may use labels, placeholders, nearby context,
    field type, and form identity, but ambiguity must be surfaced.
-   Never use "first match" as the final selection rule when more than
    one plausible target remains.
-   On dynamic pages, use a target fingerprint and re-resolve before
    executing.
-   If an Android field cannot be reliably targeted, prompt the user to
    focus/select it manually.
-   Passive detection must not create focus changes or mutate form
    values.

------------------------------------------------------------------------

# 10. QA acceptance matrix

  -----------------------------------------------------------------------
  ID                      Scenario                Expected result
  ----------------------- ----------------------- -----------------------
  `QA-001`                Install extension       No microphone prompt

  `QA-002`                Passive form detection  Local detection only;
                                                  mic remains off

  `QA-003`                Mic permission denied   Clear blocked state,
                                                  Settings recovery,
                                                  manual fallback

  `QA-004`                Empty transcript        No parse or mutation;
                                                  Retry/Type instead

  `QA-005`                Core offline            No command execution;
                                                  retry/manual fallback

  `QA-006`                Two fields share a      Candidate selection
                          label                   required

  `QA-007`                No target matches       No substitution; show
                                                  no-match recovery

  `QA-008`                Ordinary field edit     Verify field value
                                                  before success

  `QA-009`                Submit command          Confirm pill appears

  `QA-010`                Tap Confirm before 3    No authorization
                          seconds                 

  `QA-011`                Countdown reaches zero  Confirm becomes
                                                  enabled; no auto-submit

  `QA-012`                Voice "Confirm" before  Reject; continue
                          enabled                 countdown

  `QA-013`                Voice "Confirm" after   Reject
                          enabled but from stale  
                          transcript              

  `QA-014`                Target changes during   Invalidate
                          countdown               authorization

  `QA-015`                Escape / Cancel /       Cancel; no submission
                          Android Back on pill    

  `QA-016`                Dismiss Zen during      Stop capture; no new
                          listening               mutation

  `QA-017`                Retry after partial     Do not duplicate
                          failure                 completed operations

  `QA-018`                Android service loses   Stop safely and offer
                          access                  setup recovery

  `QA-019`                Reduced motion enabled  No pulse or spatial
                                                  slide

  `QA-020`                Sound muted             All states remain
                                                  understandable visually

  `QA-021`                Screen reader enabled   Meaningful state
                                                  announcements; no
                                                  animation spam

  `QA-022`                Panel or overlay closes Invalidate pending
                                                  authorization

  `QA-023`                Submit result uncertain Report unverified
                                                  result; do not
                                                  auto-retry

  `QA-024`                Host page rerenders     Re-resolve or refuse;
                          target                  never mutate stale node
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 11. Final design guardrails

## Do

-   Keep confirmation explicit for submits, payments, deletes, and other
    consequential actions.
-   Separate capture, transcription, parsing, review, execution, and
    verification.
-   Use one blue accent with grayscale surfaces and typography-driven
    hierarchy.
-   Keep the page visible and field focus non-destructive.
-   Provide immediate recovery and manual alternatives.
-   Make all Android overlay states draggable only through a dedicated
    affordance.
-   Revalidate target identity immediately before execution.
-   Treat cancellation and refusal as first-class outcomes.

## Don't

-   Don't auto-execute high-stakes voice commands.
-   Don't treat countdown expiry as consent.
-   Don't guess among ambiguous fields.
-   Don't request mic permission on install or passive detection.
-   Don't call a field fill a successful form submission.
-   Don't use color, sound, or animation as the only status channel.
-   Don't let dismissal, Escape, or Android Back mean Confirm.
-   Don't restore an old authorization after reload, process death, or
    target change.
-   Don't claim "local-first" unless the real processing path supports
    the claim.

------------------------------------------------------------------------

# 12. Build checklist

Before shipping any surface, verify:

-   [ ] Tokens are used; no one-off colors, radii, or shadows were
    introduced without design review.
-   [ ] Every state has copy, primary action, secondary recovery, and
    exit behavior.
-   [ ] Every interactive component has default, pressed, disabled, and
    focus states.
-   [ ] All errors have a next step.
-   [ ] All destructive/consequential actions require fresh explicit
    authorization.
-   [ ] Countdown is monotonic, at least 3,000 ms, and never
    auto-executes.
-   [ ] Mic starts only after explicit user intent.
-   [ ] Ambiguous targets are refused until clarified.
-   [ ] Execution is verified and retries are idempotent or guarded.
-   [ ] Reduced motion, screen readers, keyboard, and target-size
    requirements pass.
-   [ ] Light and dark themes both pass contrast review.
-   [ ] Chrome and Android platform-specific permission/lifecycle paths
    pass QA.
