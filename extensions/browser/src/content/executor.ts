/**
 * EXT-003 — Execution Engine: run Command[] against the live DOM.
 * Never guesses on ambiguity — returns candidates for clarification.
 */

import type {
  Command,
  ExecutionResult,
  FormNode,
  FormSnapshot,
} from "@shared/types";
import { createLogger } from "@shared/logger";
import { highlightElement, clearHighlights } from "./highlight";

const log = createLogger("ext.executor");

/** Similarity 0..1 via normalized Levenshtein on lowercased strings. */
export function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  const dist = levenshtein(s1, s2);
  const max = Math.max(s1.length, s2.length);
  return 1 - dist / max;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

const LAYOUT_ENGINE =
  typeof navigator !== "undefined" && !/jsdom/i.test(navigator.userAgent);

/** Map FormNode → live Element via nodeId index in current extraction order. */
export function resolveElement(
  node: FormNode,
  context: FormSnapshot,
): Element | null {
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
    if (!LAYOUT_ENGINE) return true;
    const html = el as HTMLElement;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return html.offsetParent !== null || style.position === "fixed";
  });
  // nodeId is 1-based index into the *snapshot* node list; map by order + label match
  const idx = context.nodes.findIndex((n) => n.nodeId === node.nodeId);
  if (idx >= 0 && idx < all.length) {
    // Prefer label match among live nodes for robustness across re-renders
    const byLabel = all.find(
      (el) => resolveLabelQuick(el) === (node.displayLabel ?? node.label),
    );
    if (byLabel) return byLabel;
    return all[idx] ?? null;
  }
  const byLabel = all.find(
    (el) => resolveLabelQuick(el) === (node.displayLabel ?? node.label),
  );
  return byLabel ?? null;
}

function resolveLabelQuick(el: Element): string {
  const closest = el.closest("label")?.textContent?.trim();
  if (closest) return closest;
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const placeholder = el.getAttribute("placeholder")?.trim();
  if (placeholder) return placeholder;
  const name = el.getAttribute("name")?.trim();
  if (name) return name;
  return el.textContent?.trim() ?? "";
}

export interface MatchResult {
  status: "ok" | "ambiguity" | "error";
  node?: FormNode;
  candidates?: FormNode[];
  error?: string;
}

/** Fuzzy-match command target against context nodes. >1 match above 70% → ambiguity. */
export function matchTarget(
  command: Command,
  context: FormSnapshot,
): MatchResult {
  const { target } = command;
  if (target.nodeId) {
    const exact = context.nodes.find((n) => n.nodeId === target.nodeId);
    if (exact) return { status: "ok", node: exact };
  }
  const label = (target.label ?? "").toLowerCase().trim();
  if (!label && target.index === undefined && !target.rect) {
    return { status: "error", error: "command target has no locator" };
  }

  if (target.index !== undefined) {
    const byIndex = context.nodes[target.index];
    if (byIndex) return { status: "ok", node: byIndex };
  }

  if (!label) {
    return { status: "error", error: "unresolved target" };
  }

  const scored = context.nodes
    .map((n) => ({ node: n, score: Math.max(similarity(label, n.label), similarity(label, n.displayLabel ?? "")) }))
    .filter((s) => s.score >= 0.7)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) return { status: "ok", node: scored[0].node };
  if (scored.length > 1) {
    // Exact equality collapses to one
    const exact = scored.filter((s) => s.score === 1);
    if (exact.length === 1) return { status: "ok", node: exact[0].node };
    return { status: "ambiguity", candidates: scored.map((s) => s.node) };
  }

  // substring fallback
  const contains = context.nodes.filter(
    (n) => n.label.includes(label) || label.includes(n.label),
  );
  if (contains.length === 1) return { status: "ok", node: contains[0] };
  if (contains.length > 1) return { status: "ambiguity", candidates: contains };

  return { status: "error", error: `no node matches "${label}"` };
}

function prepare(el: Element): void {
  const target = el as Element & {
    scrollIntoView?: (options?: unknown) => void;
  };
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "center", behavior: "instant" });
  }
  highlightElement(el);
}

function dispatchInputEvents(el: Element): void {
  el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
}

function runAction(command: Command, el: Element, context: FormSnapshot): void {
  const action = command.action;
  prepare(el);

  switch (action) {
    case "fill": {
      const value = command.value ?? "";
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        el.value = value;
        dispatchInputEvents(el);
        el.blur();
      } else if (el instanceof HTMLSelectElement) {
        el.focus();
        el.value = value;
        dispatchInputEvents(el);
        el.blur();
      } else {
        // contenteditable fallback
        (el as HTMLElement).textContent = value;
        dispatchInputEvents(el);
      }
      break;
    }
    case "clear": {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        el.value = "";
        dispatchInputEvents(el);
        el.blur();
      } else if (el instanceof HTMLSelectElement) {
        el.selectedIndex = -1;
        dispatchInputEvents(el);
      }
      break;
    }
    case "click": {
      (el as HTMLElement).click();
      break;
    }
    case "check":
    case "uncheck": {
      const input = el as HTMLInputElement;
      input.checked = action === "check";
      if (input instanceof HTMLInputElement || el.getAttribute("role") === "checkbox") {
        // role=checkbox may be a div/button — toggle aria + click if needed
        if (!(el instanceof HTMLInputElement)) {
          (el as HTMLElement).click();
          el.setAttribute("aria-checked", action === "check" ? "true" : "false");
        }
      }
      dispatchInputEvents(el);
      break;
    }
    case "navigate": {
      const label = (command.target.label ?? "").toLowerCase();
      if (label.includes("next") || label.includes("back") || label.includes("previous")) {
        (el as HTMLElement).click();
      } else {
        (el as HTMLElement).focus?.();
      }
      break;
    }
    default: {
      throw new Error(`unsupported action: ${action satisfies never}`);
    }
  }
  void context;
}

/**
 * Execute a command list. Stops at first ambiguity/error (executed prefix kept).
 */
export async function executeCommands(
  commands: Command[],
  context: FormSnapshot,
): Promise<ExecutionResult> {
  const executed: Command[] = [];
  clearHighlights();

  try {
    for (const command of commands) {
      const match = matchTarget(command, context);
      if (match.status === "ambiguity") {
        log.warn("ambiguous target; refusing to guess", {
          label: command.target.label,
          candidateCount: match.candidates?.length ?? 0,
        });
        return {
          status: "ambiguity",
          executed,
          candidates: match.candidates ?? [],
          error: `ambiguous target "${command.target.label}"`,
        };
      }
      if (match.status === "error" || !match.node) {
        return {
          status: "error",
          executed,
          error: match.error ?? "target not found",
        };
      }
      const el = resolveElement(match.node, context);
      if (!el) {
        return {
          status: "error",
          executed,
          error: `element for ${match.node.nodeId} not in DOM`,
        };
      }
      runAction(command, el, context);
      executed.push(command);
      log.info("executed command", {
        action: command.action,
        nodeId: match.node.nodeId,
      });
    }
    return { status: "ok", executed };
  } catch (err) {
    return {
      status: "error",
      executed,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // leave highlight briefly for visibility; content index schedules clear
  }
}
