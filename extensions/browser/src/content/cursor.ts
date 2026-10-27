/**
 * EXT-005 — virtual cursor state machine (content side).
 * Index-based traversal over the current FormSnapshot node list.
 */

import type { FormSnapshot } from "@shared/types";
import { setCursor, getCursor } from "./highlight";
import { extractFormSnapshot } from "./context-extractor";

export interface CursorState {
  index: number;
  snapshot: FormSnapshot;
}

let state: CursorState | null = null;

export function resetCursor(): void {
  state = null;
  setCursor(null);
}

export function ensureState(snapshot?: FormSnapshot): CursorState {
  const snap = snapshot ?? state?.snapshot ?? extractFormSnapshot();
  if (!state) {
    state = { index: 0, snapshot: snap };
  } else {
    state.snapshot = snap;
  }
  return state;
}

function elementForIndex(index: number): Element | null {
  const snap = state!.snapshot;
  const node = snap.nodes[index];
  if (!node) return null;
  // reuse executor resolution: order-based among visible controls
  const selector = [
    "input",
    "textarea",
    "select",
    "button",
    "a[href]",
    '[role="button"]',
    '[role="checkbox"]',
    '[role="textbox"]',
  ].join(",");
  const all = Array.from(document.querySelectorAll(selector)).filter((el) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  });
  const idx = snap.nodes.findIndex((n) => n.nodeId === node.nodeId);
  return all[idx] ?? all[index] ?? null;
}

export interface NavResult {
  index: number;
  label: string;
  value?: string;
  nodeId: string;
}

/** Move cursor forward; wraps around (documented). */
export function navNext(snapshot?: FormSnapshot): NavResult {
  const s = ensureState(snapshot);
  if (s.snapshot.nodes.length === 0) {
    return { index: 0, label: "", nodeId: "" };
  }
  s.index = (s.index + 1) % s.snapshot.nodes.length;
  return apply(s);
}

/** Move cursor backward; wraps around (documented). */
export function navPrev(snapshot?: FormSnapshot): NavResult {
  const s = ensureState(snapshot);
  const n = s.snapshot.nodes.length;
  if (n === 0) return { index: 0, label: "", nodeId: "" };
  s.index = (s.index - 1 + n) % n;
  return apply(s);
}

/** Read the focused node's label/value (TTS out of MVP scope). */
export function navRead(snapshot?: FormSnapshot): NavResult {
  const s = ensureState(snapshot);
  return apply(s);
}

function apply(s: CursorState): NavResult {
  const node = s.snapshot.nodes[s.index];
  if (!node) return { index: s.index, label: "", nodeId: "" };
  const el = elementForIndex(s.index);
  if (el) setCursor(el);
  return {
    index: s.index,
    label: node.displayLabel ?? node.label,
    value: node.value,
    nodeId: node.nodeId,
  };
}

export function cursorElement(): Element | null {
  return getCursor();
}
