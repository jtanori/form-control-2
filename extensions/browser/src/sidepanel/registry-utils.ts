import type { FormSummary } from "@shared/types";

export interface FormRegistryEntry {
  tabId: number;
  href: string;
  forms: FormSummary[];
  at: number;
}

/** Registry entries are stored per tab; only show forms for the active page. */
export function formsForTab(
  entries: FormRegistryEntry[],
  tabId: number | undefined,
): FormSummary[] {
  if (tabId === undefined) return [];
  return entries.find((entry) => entry.tabId === tabId)?.forms ?? [];
}

export function countRegisteredForms(entries: FormRegistryEntry[]): number {
  return entries.reduce((count, entry) => count + entry.forms.length, 0);
}
