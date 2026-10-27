/**
 * EXT-005 — background navigation message router.
 * Content script owns cursor state; this just forwards NAV_* and surfaces results.
 */

import type { ExtensionMessage } from "@shared/types";

export type NavType = "NAV_NEXT" | "NAV_PREV" | "NAV_READ";

export function isNavMessage(
  message: ExtensionMessage,
): message is Extract<ExtensionMessage, { type: NavType }> {
  return (
    message.type === "NAV_NEXT" ||
    message.type === "NAV_PREV" ||
    message.type === "NAV_READ"
  );
}

/** Map natural-language hints from core `navigate` actions to NAV_* messages. */
export function navMessageForLabel(label: string): NavType | null {
  const l = label.toLowerCase();
  if (/\b(next|forward|continue)\b/.test(l)) return "NAV_NEXT";
  if (/\b(back|previous|prev)\b/.test(l)) return "NAV_PREV";
  if (/\b(read|say|current)\b/.test(l)) return "NAV_READ";
  return null;
}
