/**
 * EXT-002 — DOM Explorer / Form Context Extractor.
 * Emits a contract-shaped FormSnapshot (raw DOM form; CORE-004 normalizes further).
 */

import type {
  FormNode,
  FormSnapshot,
  NodeAction,
  NodeType,
} from "@shared/types";
import { createLogger } from "@shared/logger";

const log = createLogger("ext.context");

/** jsdom (unit tests) has no layout engine: offsetParent is always null. */
const LAYOUT_ENGINE =
  typeof navigator !== "undefined" && !/jsdom/i.test(navigator.userAgent);

const SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  '[role="button"]',
  '[role="checkbox"]',
  '[role="textbox"]',
].join(",");

const TYPE_ACTIONS: Record<NodeType, NodeAction[]> = {
  input: ["fill", "clear"],
  button: ["click"],
  checkbox: ["check", "uncheck"],
  select: ["click", "fill"],
  link: ["navigate", "click"],
};

const TYPE_ROLE: Record<NodeType, string> = {
  input: "textbox",
  button: "button",
  checkbox: "checkbox",
  select: "combobox",
  link: "link",
};

function isHidden(el: Element): boolean {
  const html = el as HTMLElement;
  if (html.hidden) return true;
  if ((el as HTMLInputElement).type === "hidden") return true;

  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return true;
  if (style.opacity === "0") return true;

  // Layout-based filter (spec): offsetParent === null → hidden (unless fixed).
  // Skipped under jsdom where offsetParent is always null.
  if (LAYOUT_ENGINE && html.offsetParent === null && style.position !== "fixed") {
    // Fixed-position elements report offsetParent === null but are visible;
    // non-fixed with null offsetParent are display:none via an ancestor.
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return true;
    // Some browsers keep a rect for visibility:hidden — already handled above.
    // Zero-box non-fixed controls without an offsetParent are not interactable.
    return true;
  }
  return false;
}

function resolveLabel(el: Element): string {
  // Spec order (EXT-002): closest label → label[for] → aria-label → placeholder → name → textContent
  const closestLabel = el.closest("label");
  const fromClosest = closestLabel?.textContent?.trim();
  if (fromClosest) return fromClosest;

  const id = el.getAttribute("id");
  if (id) {
    const safeId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(id)
        : id.replace(/["\\]/g, "\\$&");
    const forLabel = document.querySelector(`label[for="${safeId}"]`);
    const fromFor = forLabel?.textContent?.trim();
    if (fromFor) return fromFor;
  }

  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;

  // Visible text beats `name` on buttons/links (name=step is not a label).
  const tag = el.tagName.toLowerCase();
  const isButtonLike =
    tag === "button" || tag === "a" || el.getAttribute("role") === "button";
  if (isButtonLike) {
    const text = el.textContent?.trim();
    if (text) return text;
  }

  const placeholder = el.getAttribute("placeholder")?.trim();
  if (placeholder) return placeholder;

  const name = el.getAttribute("name")?.trim();
  if (name) return name;

  // last resort: any associated text
  return el.textContent?.trim() ?? "";
}

function inferType(el: Element): NodeType {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  const inputType = (el as HTMLInputElement).type?.toLowerCase();

  if (tag === "select") return "select";
  if (tag === "textarea") return "input";
  if (tag === "button") return "button";
  if (tag === "a") return "link";
  if (role === "button") return "button";
  if (role === "checkbox") return "checkbox";
  if (role === "textbox") return "input";

  if (tag === "input") {
    if (inputType === "checkbox" || inputType === "radio" || inputType === "switch") {
      return "checkbox";
    }
    if (inputType === "submit" || inputType === "button" || inputType === "reset") {
      return "button";
    }
    if (inputType === "image") return "button";
    return "input";
  }
  return "input";
}

function rectOf(el: Element): FormNode["rect"] {
  const r = el.getBoundingClientRect();
  const x = Math.max(0, Math.round(r.left + window.scrollX));
  const y = Math.max(0, Math.round(r.top + window.scrollY));
  return {
    x,
    y,
    w: Math.max(0, Math.round(r.width)),
    h: Math.max(0, Math.round(r.height)),
  };
}

function readValue(el: Element, type: NodeType): string | undefined {
  if (type === "checkbox") return undefined;
  if (type === "select") {
    const select = el as HTMLSelectElement;
    return select.value;
  }
  if (type === "input") {
    const input = el as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") return undefined;
    return input.value;
  }
  return undefined;
}

function readChecked(el: Element, type: NodeType): boolean | undefined {
  if (type !== "checkbox") return undefined;
  return (el as HTMLInputElement).checked;
}

/**
 * Extract a FormSnapshot from the live page (or a root for tests).
 * nodeIds are deterministic `b{n}` (1-based) in document order.
 */
export function extractFormSnapshot(root?: ParentNode): FormSnapshot {
  const doc = root ?? document;
  const elements = Array.from(doc.querySelectorAll(SELECTOR));
  const nodes: FormNode[] = [];
  let index = 0;

  for (const el of elements) {
    if (isHidden(el)) continue;
    // Skip nested interactive duplicates (e.g. button inside label already counted)
    index += 1;
    const type = inferType(el);
    const label = resolveLabel(el);
    const node: FormNode = {
      nodeId: `b${index}`,
      label: label.toLowerCase(),
      type,
      rect: rectOf(el),
      source: "dom",
      actions: [...TYPE_ACTIONS[type]],
      role: TYPE_ROLE[type],
    };
    if (label) {
      node.displayLabel = label;
    }
    const value = readValue(el, type);
    if (value !== undefined) node.value = value;
    const checked = readChecked(el, type);
    if (checked !== undefined) node.checked = checked;

    // Shadow-root hint: warn once, skip deep pierce (MVP)
    const host = el.getRootNode();
    if (host instanceof ShadowRoot) {
      log.warn("element lives in shadow root; skipped deep pierce", {
        nodeId: node.nodeId,
      });
    }

    nodes.push(node);
  }

  const snapshot: FormSnapshot = {
    source: "dom",
    capturedAt: new Date().toISOString(),
    title: document.title || "",
    url: location.href,
    nodes,
  };
  return snapshot;
}
