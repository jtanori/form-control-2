/**
 * B-8 / spec §6.4 — Zen v2: guided one-field-at-a-time completion.
 * n/N + segmented progress · Speak / Next / Back / Dismiss · final review ·
 * Submit → shared confirm pill (D1: no countdown gating).
 * Dismiss removes the host entirely (no residue) and restores focus.
 */

import type { Command, FormNode, FormSnapshot } from "@shared/types";
import { extractFormSnapshot } from "./context-extractor";
import { SHADOW_HOST_VARS } from "./shadow-tokens";
import { setListeningUi } from "./feedback";
import { copy } from "../ui/copy";

const HOST_ID = "voiceform-zen-host";
const SUBMIT_LIKE = /\b(submit|continue|place order|pay|purchase|checkout|sign in|log in)\b/i;

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let panel: HTMLDivElement | null = null;
let index = 0;
let mode: "field" | "review" = "field";
let nodes: FormNode[] = [];
let snapshot: FormSnapshot | null = null;
let onClose: (() => void) | null = null;
let restoreFocus: HTMLElement | null = null;
let rebuild: (() => void) | null = null;

function ensureShadow(): ShadowRoot {
  if (shadow && host && document.body.contains(host)) return shadow;
  host = document.getElementById(HOST_ID) ?? document.createElement("div");
  host.id = HOST_ID;
  if (!host.isConnected) document.body.appendChild(host);
  shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  return shadow;
}

function liveFieldEl(n: FormNode | undefined): HTMLElement | null {
  if (!n) return null;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "input, textarea, select, button, [role='button'], [role='checkbox']",
    ),
  );
  const byOrder = candidates;
  // label-based match first (display/label normalized both ways)
  const hit = candidates.find(
    (el) =>
      (el.textContent ?? "").trim().toLowerCase() === n.label ||
      (el.getAttribute("aria-label") ?? "").toLowerCase() === n.label ||
      (el.getAttribute("name") ?? "").toLowerCase() === n.label,
  );
  if (hit) return hit;
  const idx = nodes.findIndex((x) => x.nodeId === n.nodeId);
  return byOrder[idx] ?? null;
}

export function zenOpen(snap?: FormSnapshot): void {
  snapshot = snap ?? extractFormSnapshot();
  nodes = snapshot.nodes.filter((n) => !n.offscreen);
  index = 0;
  mode = "field";
  restoreFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const root = ensureShadow();
  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = `
    ${SHADOW_HOST_VARS}
    .veil { position: fixed; inset: 0;
      background: color-mix(in srgb, var(--vf-text-primary) 42%, transparent);
      backdrop-filter: blur(2px); z-index: 2147483000; }
    .panel { position: fixed; top: 10vh; left: 50%; transform: translateX(-50%);
      width: min(420px, 92vw);
      background: color-mix(in srgb, var(--vf-surface-elevated) 96%, transparent);
      color: var(--vf-text-primary);
      border-radius: var(--vf-radius-sheet); padding: 18px;
      box-shadow: var(--vf-shadow-floating);
      font: var(--vf-type-body) / 1.45 var(--vf-font-family);
      border: var(--vf-border-hairline) solid var(--vf-hairline);
      backdrop-filter: blur(16px) saturate(180%); z-index: 2147483100; }
    .handle { width: 36px; height: 4px; border-radius: 2px;
      background: var(--vf-border-strong); margin: 0 auto 10px; }
    .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    h2 { margin: 0; font: var(--vf-type-subheading) var(--vf-font-family); }
    .count { color: var(--vf-text-secondary); font: var(--vf-type-caption); }
    .progress { height: 6px; border-radius: var(--vf-radius-pill);
      background: var(--vf-surface-subtle); margin: 8px 0 12px; overflow: hidden; }
    .progress > i { display: block; height: 100%;
      background: var(--vf-accent-600);
      transition: width var(--vf-motion-panel) var(--vf-ease-out); }
    .field-label { color: var(--vf-text-secondary); font: var(--vf-type-caption);
      margin-bottom: 4px; }
    .field-value { border: var(--vf-border-hairline) solid var(--vf-hairline);
      background: var(--vf-surface); border-radius: var(--vf-radius-control);
      padding: 8px 10px; font: var(--vf-type-body-medium); min-height: 38px; }
    ul { list-style: none; margin: 8px 0; padding: 0;
      max-height: 34vh; overflow: auto; }
    li { padding: 6px 8px; border-radius: var(--vf-radius-control);
      display: flex; justify-content: space-between; gap: 8px;
      font: var(--vf-type-body); }
    li.cur { background: var(--vf-accent-50);
      outline: 1px solid var(--vf-accent-500); }
    .val { color: var(--vf-text-secondary); font: var(--vf-type-caption); }
    .row { display: flex; gap: 8px; margin-top: 12px;
      justify-content: flex-end; flex-wrap: wrap; }
    button { border: 0; border-radius: var(--vf-radius-pill);
      padding: 8px 14px; font: var(--vf-type-body-medium);
      font-family: var(--vf-font-family);
      cursor: pointer; min-height: 36px; min-width: 44px;
      transition: opacity var(--vf-motion-fast) var(--vf-ease-out); }
    button:focus-visible { outline: var(--vf-focus-inset) solid var(--vf-focus-ring); }
    .primary { background: var(--vf-accent-600); color: var(--vf-on-accent); }
    .primary:disabled { background: var(--vf-disabled-fill);
      color: var(--vf-disabled-text); }
    .ghost { background: transparent;
      border: var(--vf-border-hairline) solid var(--vf-border-strong);
      color: var(--vf-text-primary); }
    .meta { color: var(--vf-text-secondary); font: var(--vf-type-caption);
      margin-top: 8px; }
    @media (prefers-reduced-motion: reduce) {
      .progress > i { transition: none; }
    }
  `;
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.addEventListener("click", () => zenClose());

  const panelEl = document.createElement("div");
  panelEl.className = "panel";
  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-label", "Form guidance");
  panel = panelEl;
  const paintAll = () => rebuild?.();
  rebuild = () => {
    root.innerHTML = "";
    root.append(style, veil, panelEl);
    renderPanel(panelEl, paintAll);
  };
  rebuild();

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      zenClose();
      return;
    }
    if (mode === "field") {
      if (ev.key === "ArrowDown") {
        step(1, paintAll);
      }
      if (ev.key === "ArrowUp") {
        step(-1, paintAll);
      }
    }
  };
  window.addEventListener("keydown", onKey);
  onClose = () => {
    window.removeEventListener("keydown", onKey);
    rebuild = null;
    restoreFocus?.focus?.();
  };
}

function step(delta: number, repaint: () => void): void {
  if (nodes.length === 0) return;
  index = Math.min(Math.max(index + delta, 0), nodes.length - 1);
  repaint();
}

function renderPanel(panelEl: HTMLDivElement, repaint: () => void): void {
  panelEl.innerHTML = "";
  const handle = document.createElement("div");
  handle.className = "handle";
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("h2");
  title.textContent =
    mode === "review" ? copy("zen.final_review") : "Form guidance";
  const count = document.createElement("span");
  count.className = "count";
  count.textContent =
    nodes.length > 0 ? `${index + 1} of ${nodes.length}` : "0 of 0";
  head.append(title, count);

  const progress = document.createElement("div");
  progress.className = "progress";
  const fill = document.createElement("i");
  const pct =
    nodes.length > 0
      ? (mode === "review" ? nodes.length : index + 1) / nodes.length
      : 0;
  fill.style.width = `${Math.round(pct * 100)}%`;
  progress.appendChild(fill);
  panelEl.append(handle, head, progress);

  if (nodes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "meta";
    empty.textContent = "No fields to guide through.";
    const close = document.createElement("button");
    close.className = "ghost";
    close.textContent = copy("zen.dismiss");
    close.addEventListener("click", () => zenClose());
    panelEl.append(empty, close);
    return;
  }

  const list = document.createElement("ul");
  nodes.forEach((n, i) => {
    const li = document.createElement("li");
    if (mode === "field" && i === index) li.className = "cur";
    if (mode === "review") li.className = "cur";
    const label = document.createElement("span");
    label.textContent = n.displayLabel ?? n.label;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent =
      n.value ??
      (n.checked !== undefined ? (n.checked ? "checked" : "unchecked") : "—");
    li.append(label, val);
    li.addEventListener("click", () => {
      mode = "field";
      index = i;
      repaint();
    });
    list.appendChild(li);
  });
  panelEl.appendChild(list);

  if (mode === "field") {
    const current = nodes[index];
    const fl = document.createElement("div");
    fl.className = "field-label";
    fl.textContent = "Current field";
    const fv = document.createElement("div");
    fv.className = "field-value";
    fv.textContent =
      `${current.displayLabel ?? current.label}` +
      (current.value ? ` = ${current.value}` : "");
    panelEl.append(fl, fv);

    const row = document.createElement("div");
    row.className = "row";
    const speak = document.createElement("button");
    speak.className = "primary";
    speak.textContent = "🎤 Speak value";
    speak.addEventListener("click", () => {
      const el = liveFieldEl(current);
      void chrome.runtime
        .sendMessage({ type: "TAP_TO_TALK" })
        .then(() => {
          setListeningUi({ listening: true, anchor: el });
        })
        .catch((err: unknown) => {
          setListeningUi({
            listening: false,
            anchor: el,
            error: err instanceof Error ? err.message : "Voice failed",
          });
        });
    });
    const back = document.createElement("button");
    back.className = "ghost";
    back.textContent = copy("zen.back");
    back.disabled = index === 0;
    back.addEventListener("click", () => step(-1, repaint));
    const next = document.createElement("button");
    next.className = "ghost";
    next.textContent = copy("zen.next");
    next.addEventListener("click", () => {
      if (index >= nodes.length - 1) {
        mode = "review";
        repaint();
      } else {
        step(1, repaint);
      }
    });
    const dismiss = document.createElement("button");
    dismiss.className = "ghost";
    dismiss.textContent = copy("zen.dismiss");
    dismiss.addEventListener("click", () => zenClose());
    row.append(speak, back, next, dismiss);
    panelEl.appendChild(row);
  } else {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "Review your changes. Submit goes through the shared confirm pill.";
    panelEl.appendChild(meta);

    const submitTarget = nodes.find(
      (n) => n.type === "button" && SUBMIT_LIKE.test(n.label),
    );
    const row = document.createElement("div");
    row.className = "row";
    const edit = document.createElement("button");
    edit.className = "ghost";
    edit.textContent = "Continue editing";
    edit.addEventListener("click", () => {
      mode = "field";
      repaint();
    });
    const dismiss = document.createElement("button");
    dismiss.className = "ghost";
    dismiss.textContent = copy("zen.dismiss");
    dismiss.addEventListener("click", () => zenClose());
    const submit = document.createElement("button");
    submit.className = "primary";
    submit.textContent = submitTarget ? "Submit" : "No submit action found";
    submit.disabled = !submitTarget;
    submit.addEventListener("click", () => {
      if (!submitTarget) return;
      const command: Command = {
        action: "click",
        target: { nodeId: submitTarget.nodeId, label: submitTarget.label },
      };
      void chrome.runtime
        .sendMessage({ type: "ZEN_EXECUTE", commands: [command] })
        .then(() => zenClose())
        .catch(() => undefined);
    });
    row.append(edit, dismiss, submit);
    panelEl.appendChild(row);
  }
}

export function zenClose(): void {
  onClose?.();
  onClose = null;
  panel = null;
  mode = "field";
  if (host) {
    host.remove();
    host = null;
    shadow = null;
  }
}

export function zenToggle(snap?: FormSnapshot): void {
  if (host?.isConnected && panel) zenClose();
  else zenOpen(snap);
}

export function zenIsOpen(): boolean {
  return Boolean(host?.isConnected && panel);
}
