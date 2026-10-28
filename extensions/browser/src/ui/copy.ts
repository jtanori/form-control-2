/**
 * Copy slots (contracts/design/copy.json — UX-003-C).
 * Values imported from the contract file so UI cannot drift from it.
 */
import copyBank from "../../../../contracts/design/copy.json";

export type CopyKey = keyof typeof copyBank;

export const C = copyBank as Record<CopyKey, string>;

export function copy(key: CopyKey, vars?: Record<string, string | number>): string {
  let text = C[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
