# QA-GATE — manual run checklist (D12)

**Epic:** [#54 UX-003](https://github.com/jtanori/form-control-2/issues/54) · **Gate issue:** [#58](https://github.com/jtanori/form-control-2/issues/58)

| Run metadata | Value |
|---|---|
| Date | _TBD_ |
| OS / Chrome | _TBD_ |
| Extension build (commit) | _TBD_ |
| Core health sttBackend | _TBD_ |
| Runner | _TBD_ |

**Result legend:** ✅ pass · ❌ fail (+ notes) · **R:** skipped + **written reason**

---

## A. Setup & permissions (M01–M06)

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M01 | Fresh profile → load unpacked dist | Setup/options tab opens automatically; **no mic prompt** | ☐ | |
| M02 | Setup → **Enable Voice Control** → allow prompt | Step 1 turns success; copy explains why (value-first) | ☐ | |
| M03 | Block mic (site settings) → reopen Setup | Blocked banner + **Re-check** + typed path unaffected | ☐ | |
| M04 | Setup → Core **Check** with compose up | Core+Speech ready dots | ☐ | |
| M05 | Stop compose → Check → restart → Check | Offline copy + recovery; then healthy again | ☐ | |
| M06 | Setup → **Open demo form** → run sample command → Confirm | `demo.html` fills; success copy; **no external submit** | ☐ | |

## B. Detection & panel (M07–M10)

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M07 | Browse `login-bootstrap` + `checkout-plain` **without clicking the icon** | Toolbar badge shows form count(s) | ☐ | |
| M08 | Open Side Panel with forms on tabs A/B; select on A, switch to B | List already populated but scoped to active tab; stale selection/cues from A are cleared on B | ☐ | |
| M09 | Open `multi-form.html`, select one form in panel | Selected form: **accent ~3px border**; others **muted + slight blur** | ☐ | |
| M10 | With **no** form selected | **Start voice disabled**; select a form → enabled (D10); page-tap still works without selection | ☐ | |

## C. Command paths (M11–M15)

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M11 | Panel: type `fill the email address with test@example.com and click submit billing` on `checkout-plain` → Parse → **Confirm** | Cards before any fill; email filled + submit clicked; status “Executed…” (**D8 hooks**) | ☐ | *(E2E twin)* |
| M12 | Panel **Start voice** (form selected) on `login-plain` → speak a fill command | LISTENING → transcript → parse → cards/execute as applicable | ☐ | |
| M13 | **Tap `signup-aria` form** → chime → speak field values sequentially | LISTENING badge near field + preview bubble; fields fill in order; stop chime | ☐ | |
| M14 | On `shipping-step`: voice/typed `next field`, `back`, `check…` where present | Navigation/activation works per control vocabulary | ☐ | |
| M15 | On `checkout-plain` tab A, issue `click submit billing`; switch to tab B while pill is open, then return to A | Confirm pill **appears with countdown text**; only A’s originating page executes on Confirm; Cancel kills it (current behavior per D1) | ☐ | |

## D. Failure & recovery (M16–M19)

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M16 | On `ambiguous-labels`: command `click continue` / ambiguous fill | **No guess** — candidates/clarification offered | ☐ | *(unit twin)* |
| M17 | Command targeting a missing label | “couldn’t find” copy + retry/choose/type recovery | ☐ | *(unit twin)* |
| M18 | Stop mic immediately / speak nothing | “didn’t catch” style copy + Retry/Type — **no mutation** | ☐ | |
| M19 | Panel **Zen** on `checkout-plain`: open → next/back → Dismiss/Esc | n/N + progress shown; **no page residue** after close; values kept | ☐ | |

## E. Shell surfaces (M20–M24)

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M20 | Toolbar popup | Mic launcher + form count + **? Setup**; popup never hosts workspace | ☐ | |
| M21 | Open `spa-rerender.html` → **Rebuild** after selecting a form | Accent/muted cues **re-apply** to the remounted form | ☐ | |
| M22 | Any form page | Helper chip visible, dismissible, copy per bank | ☐ | |
| M23 | Cursor ← → 🔊 in panel | Status shows `[#n] label = value` style output | ☐ | |
| M24 | Light **and** dark OS/Chrome theme: panel, options, zen, cues | One accent + grayscale; readable contrast both modes | ☐ | |

## F. Environment & a11y (M25–M29)

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M25 | OS reduced-motion on → use voice flow | No pulse/slide animations (instant/fade) | ☐ | |
| M26 | Panel **Settings** nav | Opens Setup/options page | ☐ | |
| M27 | Panel **History** nav | Read-only list **or** recorded D11 defer note | ☐ | |
| M28 | Right-click → “VoiceForm: capture page form” | No crash; status/log feedback | ☐ | |
| M29 | During M12/M13: open SW console | **No transcript text/field values** in logs (redaction) | ☐ | |

## G. Android (M30–M36) — after UX-003-P3

| ID | Steps | Expected | Result | Reason / notes |
|---|---|---|---|---|
| M30 | Fresh install → Setup; deny microphone, then open Settings | 3-step dots + checklist; denied copy is actionable; voiceless continuation remains available | ☐ | |
| M31 | Overlay collapsed ↔ expanded; drag handle | Spec §6.6/6.7 layout; Back precedence §8.3 | ☐ | |
| M32 | Tap native value field → speak a value | Field outline + LISTENING HUD anchored to field; start/stop cues; only tapped field may be targeted. Active-form/other-form border remains pending #69 | ☐ | |
| M33 | Submit-like command | Confirm pill before action; Back cancels, never confirms | ☐ | |
| M34 | Zen sheet + Back chain | Zen → pill → collapse order; no residue | ☐ | |
| M35 | Light/dark + copy pass | Resolve/record #68 token mapping; verify foreground contrast on accent in both themes | ☐ | *(#68 pending)*
| M36 | Wrong Core URL → fix in Setup | Offline copy + recovery | ☐ | |

---

## Sign-off

| Gate | Scope | Status |
|---|---|---|
| Smoke (after P1) | M01, M06–M15, M20, M22–M24 | ☐ recorded |
| **Full (epic close)** | **M01–M29** (+ M30+ after P3) | ☐ recorded |
| Stakeholder comment on [#58](https://github.com/jtanori/form-control-2/issues/58) | pass / pass-with-reasons | ☐ |

**Notes for reasons:** keep each R-reason one line, referencing environment
limits or an epic deferred-register ID (D1–D4) when applicable.
