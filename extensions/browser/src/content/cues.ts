/**
 * B-6 — in-page cue layer: shadow-DOM host + active/muted form indicators.
 * Host CSS cannot restyle us; our tokens cannot leak out (stakeholder §2).
 * A MutationObserver-driven re-apply keeps cues alive across SPA rebuilds.
 */

import type { FormSummary, Rect } from "@shared/types";

const HOST_ID = "voiceform-cue-host";

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let activeLayer: HTMLDivElement | null = null;
let mutedLayer: HTMLDivElement | null = null;
let reapply: (() => void) | null = null;

function ensureHost(): ShadowRoot | null {
  if (shadow && document.body.contains(host)) return shadow;
  host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadow.querySelector("style")) {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .layer { position: absolute; left: 0; top: 0; pointer-events: none;
               z-index: 2147483646; }
      .frame { position: fixed; border-radius: 6px; transition:
               border-color 180ms ease-out, opacity 180ms ease-out,
               filter 180ms ease-out; }
      .frame.active { border: 3px solid rgba(37, 99, 235, 0.85);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18); }
      .frame.muted { border: 2px solid rgba(107, 114, 128, 0.35);
        filter: blur(1.5px); opacity: 0.75; }
      .chip { position: fixed; right: 16px; bottom: 16px;
        font: 600 12px/1.4 -apple-system, system-ui, sans-serif;
        color: #fff; background: rgba(17, 24, 39, 0.88);
        backdrop-filter: blur(12px) saturate(180%);
        padding: 8px 14px; border-radius: 999px;
        box-shadow: 0 4px 16px rgba(0,0,0,.25); display: none; }
      .chip.show { display: block; }
    `;
    shadow.appendChild(style);
    activeLayer = document.createElement("div");
    activeLayer.className = "layer";
    mutedLayer = document.createElement("div");
    mutedLayer.className = "layer";
    shadow.appendChild(mutedLayer);
    shadow.appendChild(activeLayer);
  }
  activeLayer = shadow.querySelector(".layer:last-of-type");
  mutedLayer = shadow.querySelector(".layer:first-of-type");
  return shadow;
}

function frame(rect: Rect, kind: "active" | "muted"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `frame ${kind}`;
  el.style.left = `${rect.x - window.scrollX}px`;
  el.style.top = `${rect.y - window.scrollY}px`;
  el.style.width = `${Math.max(rect.w, 0)}px`;
  el.style.height = `${Math.max(rect.h, 0)}px`;
  return el;
}

export interface CueState {
  activeKey: string | null;
  forms: FormSummary[];
}

let state: CueState = { activeKey: null, forms: [] };

function paint(): void {
  const root = ensureHost();
  if (!root || !activeLayer || !mutedLayer) return;
  activeLayer.innerHTML = "";
  mutedLayer.innerHTML = "";
  for (const form of state.forms) {
    if (!form.rect) continue;
    if (form.key === state.activeKey) {
      activeLayer.appendChild(frame(form.rect, "active"));
    } else {
      mutedLayer.appendChild(frame(form.rect, "muted"));
    }
  }
}

export function setCues(next: Partial<CueState>): void {
  state = { ...state, ...next };
  paint();
}

export function clearCues(): void {
  state = { activeKey: null, forms: [] };
  paint();
}

/** SPA resilience: re-apply cues whenever body children churn (B-6). */
export function installCueReapply(): void {
  if (reapply) return;
  let t: number | null = null;
  const obs = new MutationObserver(() => {
    if (t !== null) window.clearTimeout(t);
    t = window.setTimeout(() => {
      t = null;
      if (state.forms.length > 0 || state.activeKey) paint();
    }, 300);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  reapply = () => paint();
}
