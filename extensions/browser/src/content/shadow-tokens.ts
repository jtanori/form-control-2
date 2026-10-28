/**
 * UX-003-C — CSS variables for shadow-DOM in-page styles.
 *
 * Host pages don't load contracts/design/tokens.css (and must not inherit our
 * page-level vars), so cue/zen/feedback shadow roots declare the subset they
 * need on `:host`. Values MUST mirror `contracts/design/tokens.css` (edit both).
 */

export const SHADOW_HOST_VARS = `:host {
  --vf-bg: #ffffff;
  --vf-surface: #f7f8fa;
  --vf-surface-subtle: #f1f3f6;
  --vf-text-primary: #0b0f14;
  --vf-text-secondary: #667085;
  --vf-hairline: #e5e7eb;
  --vf-border-strong: #cbd2dc;
  --vf-accent-50: #eff6ff;
  --vf-accent-500: #3b82f6;
  --vf-accent-600: #2878f0;
  --vf-success: #0d9488;
  --vf-warning: #b7791f;
  --vf-danger: #d94848;
  --vf-disabled-fill: #eef1f5;
  --vf-on-accent: #ffffff;
  --vf-radius-control: 12px;
  --vf-radius-pill: 999px;
  --vf-radius-card: 14px;
  --vf-radius-sheet: 22px;
  --vf-shadow-floating: 0 8px 24px rgba(0, 0, 0, 0.14);
  --vf-listening-pulse: 1600ms;
  --vf-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --vf-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;
}`;

/** Badge/API literals that cannot resolve CSS vars (chrome.action, outline on host nodes). */
export const VF_ACCENT_600 = "#2878f0"; // tokens.json color.light.accent-600
export const VF_ACCENT_500 = "#3b82f6"; // tokens.json color.light.accent-500
export const VF_INFO = "#64748b"; // tokens.json color.light.info
export const VF_WARNING = "#b7791f"; // tokens.json color.light.warning
