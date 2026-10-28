# Components map — spec `VF/*` → our implementation (UX-003-C)

Source: `spec-v1.md` §2/§7 · Verdicts per accepted reconciliation (`docs/spec-reconciliation.md`).
Class anchors live in `extensions/browser` (`tokens.css` primitives + surface CSS).

| Spec component | Our anchor | Verdict | Notes |
|---|---|---|---|
| `VF/Button/PrimaryPill` | `.vf-btn.primary` | Adopt (have) | ≥44px targets (tokens.css) |
| `VF/Button/SecondaryGhostPill` | `.vf-btn` (outline) | Adopt (have) | cancel/secondary |
| `VF/Status/Dot` | `.vf-dot` (+`.ok/.bad/.warn/.busy`) | Adopt (have) | never color-only — pair with text |
| `VF/Status/Chip` | `.vf-pill` | Adopt (have) | counts, health labels |
| `VF/Input/TextField` | popup/options inputs | Adopt (light) | visible-label rule on options (P1) |
| `VF/Control/Segmented` | — | **Ditch (D5)** | no use case |
| `VF/Row/FormItem` | `FormList` rows | Adopt (have) | + host/source context line (P1) |
| `VF/Command/ActionCard` | `.card` + `.cmd-title` (**D8 hooks — never rename**) | Adopt (have) | anatomy enrich only |
| `VF/Safety/ConfirmPill` | `feedback.ts` pill | **Simplify (D1)** | countdown text only; click always allowed; copy from bank |
| `VF/Status/ListeningBadge` | `feedback.ts` `.vf-listen` | Adopt (have) | pulse `--vf-listening-pulse` (1600ms) |
| `VF/Transcript/PreviewBubble` | `feedback.ts` `.vf-preview` | Simplify (D4) | final only |
| `VF/Control/HelperChip` | `feedback.ts` `.vf-chip` | Adopt (have) | bank copy (P1) |
| `VF/Sheet/Zen` | `zen.ts` sheet | Adopt simplified (P2) | n/N, speak/next/back, no web drag handle |
| `VF/Permission/BlockedBanner` | options `.banner.warn` | Adopt (have) | + Re-check |
| `VF/Health/HealthStrip` | **new** (P1) | Adopt (new) | panel+options; re-ping on open |
| `VF/Overlay/DragHandle` | Android overlay | Adopt → P3 | AND-006 |
| `VF/Progress/SegmentedProgress` | **new** (P1/P2) | Adopt (new) | options steps + zen n/N + text “Step n of m” |
| `VF/Feedback/InlineError` | preview bubble + status (light) | Simplify (P1) | copy keys; bubble placement |
| `VF/Control/IconButton` | header buttons | Adopt (have) | 44px; `x` never confirms |
| `VF/Control/DisclosureRow` | options `<details>` | Adopt (have) | diagnostics |

## Surface ↔ component matrix (spec §7 — web rows)

| Component | Side panel | Options | In-page | Zen | Mini popup |
|---|---|---|---|---|---|
| PrimaryPill | Start voice (gated, D10) | per step | contextual | Next / Apply | optional |
| SecondaryGhostPill | Cancel/fallback | Skip/Cancel | Cancel | Back/Dismiss | — |
| StatusDot / Chip | health + count | health | optional | progress | count |
| ActionCard | ✔ (hooks) | demo only | optional | value review | — |
| ConfirmPill | ✔ | — | ✔ (bubble) | shared | — |
| ListeningBadge / Preview | ✔ | — | ✔ (field-anchored) | ✔ | — |
| HealthStrip | ✔ (new) | ✔ (new) | — | — | minimal |
| ZenSheet entry | button | — | helper (later) | main | — |
