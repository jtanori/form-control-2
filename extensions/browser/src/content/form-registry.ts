/**
 * B-3 Tier 1 — always-on passive form registry (local only, cheap).
 * Runs in the content script; shared MutationObserver signal keeps it fresh.
 */

import type { FormSummary } from "@shared/types";
import { createLogger } from "@shared/logger";

const log = createLogger("ext.registry");

const DEBOUNCE_MS = 400;
const CONTROLS = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  '[role="button"]',
  '[role="checkbox"]',
  '[role="textbox"]',
].join(",");

let lastSignature = "";
let timer: number | null = null;
let observer: MutationObserver | null = null;

function visible(el: Element): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const html = el as HTMLElement;
  return html.offsetParent !== null || style.position === "fixed";
}

function formKey(form: HTMLFormElement, fallbackIndex: number): string {
  return (
    form.id ||
    form.getAttribute("name") ||
    form.getAttribute("action") ||
    `form-${fallbackIndex}`
  );
}

function summarize(): FormSummary[] {
  const forms = Array.from(document.querySelectorAll("form")).filter((f) =>
    visible(f),
  );
  const out: FormSummary[] = [];

  forms.forEach((form, i) => {
    const controls = Array.from(form.querySelectorAll(CONTROLS)).filter(visible);
    if (controls.length === 0) return;
    const r = form.getBoundingClientRect();
    out.push({
      key: formKey(form as HTMLFormElement, i),
      title:
        form.getAttribute("aria-label") ||
        form.id ||
        form.querySelector("legend, h1, h2, h3")?.textContent?.trim() ||
        `Form ${i + 1}`,
      fieldCount: controls.length,
      rect: {
        x: Math.round(r.left + window.scrollX),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
      formIndex: i,
    });
  });

  // Forms-less pages: one synthetic "page" region when controls exist outside forms
  if (out.length === 0) {
    const loose = Array.from(document.querySelectorAll(CONTROLS)).filter(
      (el) => visible(el) && !el.closest("form"),
    );
    if (loose.length >= 1) {
      out.push({
        key: "page",
        title: document.title || "Page fields",
        fieldCount: loose.length,
        rect: null,
        formIndex: -1,
      });
    }
  }
  return out;
}

function publish(forms: FormSummary[]): void {
  const signature = JSON.stringify(forms);
  if (signature === lastSignature) return;
  lastSignature = signature;
  log.debug("form registry update", { count: forms.length });
  void chrome.runtime.sendMessage({
    type: "FORM_REGISTRY",
    forms,
    href: location.href,
  }).catch(() => {
    /* SW asleep on first paint is fine */
  });
}

function refresh(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    publish(summarize());
  }, DEBOUNCE_MS);
}

export function startFormRegistry(): void {
  refresh();
  if (observer) return;
  observer = new MutationObserver(() => refresh());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "style", "class", "open"],
  });
  window.addEventListener("pageshow", refresh);
  log.info("form registry active", { url: location.href });
}
