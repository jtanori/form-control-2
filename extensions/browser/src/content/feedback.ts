/**
 * B-7 micro-feedback + 3s confirm pill (shadow-DOM, B-0 look).
 * B-8 zen mode lives in zen.ts; this file is the hot-mic UX.
 */

import { SHADOW_HOST_VARS } from "./shadow-tokens";

const HOST_ID = "voiceform-cue-host";

let shadow: ShadowRoot | null = null;
let ui: {
  chip: HTMLDivElement;
  listening: HTMLDivElement;
  preview: HTMLDivElement;
  pill: HTMLDivElement;
  pillTimer: number | null;
} | null = null;

function ensure(): typeof ui {
  if (shadow && ui && document.body.contains(shadow.host as Node)) return ui;
  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  // Same rule as cues.ts: zero-geometry, click-through host.
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483000;";
  shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadow.querySelector("#vf-feedback-style")) {
    const style = document.createElement("style");
    style.id = "vf-feedback-style";
    style.textContent = `
      ${SHADOW_HOST_VARS}
      .vf-chip { position: fixed; right: 16px; bottom: 72px;
        pointer-events: auto;
        font: 600 12px/1.4 var(--vf-font-family); color: var(--vf-on-accent);
        background: var(--vf-accent-600); backdrop-filter: blur(12px) saturate(180%);
        padding: 8px 14px; border-radius: var(--vf-radius-pill);
        box-shadow: var(--vf-shadow-floating);
        display: none; z-index: 2147483647; }
      .vf-chip.show { display: block; }
      .vf-listen { position: fixed; z-index: 2147483647;
        font: 600 10px/1 var(--vf-font-family);
        color: var(--vf-on-accent); background: var(--vf-accent-500);
        border-radius: var(--vf-radius-pill); padding: 3px 8px;
        display: none; animation: vf-blink var(--vf-listening-pulse) var(--vf-ease-out) infinite; }
      .vf-listen.show { display: block; }
      .vf-preview { position: fixed; z-index: 2147483647; max-width: 280px;
        font: 500 12px/1.4 var(--vf-font-family);
        color: var(--vf-text-primary); background: var(--vf-surface-elevated);
        border: var(--vf-border-hairline) solid var(--vf-hairline);
        border-radius: var(--vf-radius-card); padding: 8px 10px;
        box-shadow: var(--vf-shadow-floating); display: none; }
      .vf-preview.show { display: block; }
      .vf-preview.err { color: var(--vf-danger); }
      @keyframes vf-blink { 50% { opacity: .45; } }
      @media (prefers-reduced-motion: reduce) {
        .vf-listen { animation: none; }
      }
      .vf-pill2 { position: fixed; z-index: 2147483647; left: 50%; transform: translateX(-50%);
        pointer-events: auto;
        bottom: 24px; font: 600 13px/1.4 var(--vf-font-family);
        color: var(--vf-on-accent);
        background: var(--vf-accent-600); backdrop-filter: blur(12px);
        border-radius: var(--vf-radius-pill); padding: 12px 18px; display: none;
        box-shadow: var(--vf-shadow-floating); gap: 12px; align-items: center; }
      .vf-pill2.show { display: flex; }
      .vf-pill2 button { border: 0; border-radius: var(--vf-radius-pill);
        padding: 8px 14px; font: inherit; cursor: pointer; }
      .vf-pill2 .yes { background: var(--vf-surface); color: var(--vf-accent-700, var(--vf-accent-600)); }
      .vf-pill2 .no { background: transparent; color: var(--vf-on-accent);
        border: 1px solid color-mix(in srgb, var(--vf-on-accent) 35%, transparent); }
    `;
    shadow.appendChild(style);
  }
  if (!ui) {
    const chip = document.createElement("div");
    chip.className = "vf-chip show";
    chip.textContent = "Tap this form to talk";
    const listening = document.createElement("div");
    listening.className = "vf-listen";
    listening.textContent = "LISTENING…";
    const preview = document.createElement("div");
    preview.className = "vf-preview";
    const pill = document.createElement("div");
    pill.className = "vf-pill2";
    pill.innerHTML =
      '<span class="vf-q"></span><button type="button" class="yes">Confirm</button><button type="button" class="no">Cancel</button>';
    shadow.append(chip, listening, preview, pill);
    ui = {
      chip,
      listening,
      preview,
      pill,
      pillTimer: null,
    };
  }
  return ui;
}

export function chime(kind: "start" | "stop"): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === "start" ? 880 : 520;
    gain.gain.value = 0.04;
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio optional */
  }
}

export function placeAt(el: Element, node: HTMLElement, dy = -28): void {
  const r = el.getBoundingClientRect();
  node.style.top = `${Math.max(8, r.top + dy)}px`;
  node.style.left = `${Math.max(8, r.left)}px`;
}

export function setListeningUi(opts: {
  listening: boolean;
  anchor?: Element | null;
  preview?: string;
  error?: string;
}): void {
  const e = ensure();
  if (!e) return;
  const { listening, anchor, preview, error } = opts;
  if (listening) {
    chime("start");
    e.listening.classList.add("show");
    if (anchor) placeAt(anchor, e.listening, -24);
    e.preview.classList.remove("show", "err");
  } else {
    chime("stop");
    e.listening.classList.remove("show");
    if (preview || error) {
      e.preview.textContent = preview ?? error ?? "";
      e.preview.classList.toggle("err", Boolean(error));
      e.preview.classList.add("show");
      if (anchor) placeAt(anchor, e.preview, -40);
      window.setTimeout(() => e.preview.classList.remove("show"), 4000);
    }
  }
}

export function showConfirmPill(
  question: string,
  seconds: number,
  onResult: (approved: boolean) => void,
): void {
  const e = ensure();
  if (!e) return;
  const q = e.pill.querySelector(".vf-q");
  if (q) q.textContent = `${question} (${seconds}s)`;
  e.pill.classList.add("show");
  const yes = e.pill.querySelector(".yes") as HTMLButtonElement | null;
  const no = e.pill.querySelector(".no") as HTMLButtonElement | null;
  let left = seconds;
  const tick = () => {
    if (left > 0) {
      if (q) q.textContent = `${question} (${left}s)`;
      left -= 1;
      return;
    }
    // Countdown finished → pill stays enabled until Confirm/Cancel/Esc
    // (spec §3.3 enabled state; D1: no gating — expiry never auto-closes).
    if (e.pillTimer !== null) window.clearInterval(e.pillTimer);
    e.pillTimer = null;
    if (q) q.textContent = question;
  };
  const cleanup = (approved: boolean) => {
    if (e.pillTimer !== null) window.clearInterval(e.pillTimer);
    e.pillTimer = null;
    yes?.removeEventListener("click", onYes);
    no?.removeEventListener("click", onNo);
    window.removeEventListener("keydown", onKey);
    e.pill.classList.remove("show");
    onResult(approved);
  };
  const onYes = () => cleanup(true);
  const onNo = () => cleanup(false);
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") cleanup(false);
  };
  yes?.addEventListener("click", onYes);
  no?.addEventListener("click", onNo);
  window.addEventListener("keydown", onKey);
  e.pillTimer = window.setInterval(tick, 1000);
  tick();
}

export function showHelperChip(anchor: Element, onClick: () => void): void {
  const e = ensure();
  if (!e) return;
  e.chip.classList.add("show");
  placeAt(anchor, e.chip, -36);
  e.chip.onclick = onClick;
}

export function hideHelperChip(): void {
  ui?.chip.classList.remove("show");
}
