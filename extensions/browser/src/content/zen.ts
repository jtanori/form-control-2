/**
 * B-8 — zen / reading mode: quiet overlay listing the form's inputs.
 * Submit or dismiss restores the page (shadow host only; no residue).
 */

import type { FormNode, FormSnapshot } from "@shared/types";
import { extractFormSnapshot } from "./context-extractor";

const HOST_ID = "voiceform-zen-host";

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let panel: HTMLDivElement | null = null;
let index = 0;
let nodes: FormNode[] = [];
let onClose: (() => void) | null = null;

function ensureShadow(): ShadowRoot {
  if (shadow && host && document.body.contains(host)) return shadow;
  host = document.getElementById(HOST_ID) ?? document.createElement("div");
  host.id = HOST_ID;
  if (!host.isConnected) document.body.appendChild(host);
  shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  return shadow;
}

export function zenOpen(snapshot?: FormSnapshot): void {
  const snap = snapshot ?? extractFormSnapshot();
  nodes = snap.nodes.filter((n) => !n.offscreen);
  index = 0;
  const root = ensureShadow();
  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = `
    .veil { position: fixed; inset: 0; background: rgba(15,23,42,.42);
      backdrop-filter: blur(2px); z-index: 2147483000; }
    .panel { position: fixed; top: 12vh; left: 50%; transform: translateX(-50%);
      width: min(420px, 92vw); background: rgba(255,255,255,.92);
      color: #111; border-radius: 16px; padding: 18px;
      box-shadow: 0 20px 50px rgba(0,0,0,.35);
      font: 14px/1.45 -apple-system, system-ui, sans-serif;
      backdrop-filter: blur(16px) saturate(180%); z-index: 2147483100; }
    @media (prefers-color-scheme: dark) {
      .panel { background: rgba(17,24,39,.94); color: #f9fafb; }
    }
    h2 { margin: 0 0 4px; font-size: 16px; }
    .meta { opacity: .65; font-size: 12px; margin-bottom: 10px; }
    ul { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow: auto; }
    li { padding: 8px 10px; border-radius: 10px; display: flex; justify-content: space-between; gap: 8px; }
    li.cur { background: rgba(37,99,235,.14); outline: 1px solid rgba(37,99,235,.45); }
    .val { opacity: .6; font-size: 12px; }
    .row { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
    button { border: 0; border-radius: 999px; padding: 8px 14px; font: inherit; cursor: pointer; }
    .primary { background: #2563eb; color: #fff; }
    .ghost { background: transparent; border: 1px solid rgba(127,127,127,.45); }
  `;
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.addEventListener("click", () => zenClose());
  const panelEl = document.createElement("div");
  panelEl.className = "panel";
  panelEl.setAttribute("role", "dialog");
  panelEl.setAttribute("aria-label", "Reading mode");
  panel = panelEl;

  const h = document.createElement("h2");
  h.textContent = "Reading form";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${nodes.length} field(s) — say or tap next / back; Esc exits`;
  const list = document.createElement("ul");
  nodes.forEach((n, i) => {
    const li = document.createElement("li");
    if (i === index) li.className = "cur";
    const label = document.createElement("span");
    label.textContent = n.displayLabel ?? n.label;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = n.value ?? (n.checked !== undefined ? (n.checked ? "checked" : "unchecked") : "");
    li.append(label, val);
    li.addEventListener("click", () => {
      index = i;
      paint(list);
    });
    list.appendChild(li);
  });
  const row = document.createElement("div");
  row.className = "row";
  const next = document.createElement("button");
  next.className = "ghost";
  next.textContent = "Next";
  next.addEventListener("click", () => {
    index = (index + 1) % Math.max(nodes.length, 1);
    paint(list);
  });
  const done = document.createElement("button");
  done.className = "primary";
  done.textContent = "Done";
  done.addEventListener("click", () => zenClose());
  row.append(next, done);
  panelEl.append(h, meta, list, row);
  root.append(veil, panelEl);

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") zenClose();
    if (ev.key === "ArrowDown") {
      index = (index + 1) % Math.max(nodes.length, 1);
      paint(list);
    }
    if (ev.key === "ArrowUp") {
      index = (index - 1 + nodes.length) % Math.max(nodes.length, 1);
      paint(list);
    }
  };
  window.addEventListener("keydown", onKey, { once: false });
  onClose = () => window.removeEventListener("keydown", onKey);
}

function paint(list: HTMLUListElement): void {
  Array.from(list.children).forEach((li, i) => {
    li.classList.toggle("cur", i === index);
  });
  (list.children[index] as HTMLElement | undefined)?.scrollIntoView({
    block: "nearest",
  });
  // Focus the live field when possible
  const target = nodes[index];
  if (target) {
    document
      .querySelectorAll<HTMLElement>(`[data-nodeid="${target.nodeId}"]`)
      .forEach((el) => el.focus());
  }
}

export function zenClose(): void {
  onClose?.();
  onClose = null;
  panel = null;
  if (host) {
    host.remove();
    host = null;
    shadow = null;
  }
}

export function zenToggle(snapshot?: FormSnapshot): void {
  if (host?.isConnected && panel) zenClose();
  else zenOpen(snapshot);
}

export function zenIsOpen(): boolean {
  return Boolean(host?.isConnected && panel);
}
