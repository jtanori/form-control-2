/** Visual feedback for execution + virtual cursor (EXT-003 / EXT-005). */

const EXEC_CLASS = "voiceform-exec-highlight";
const CURSOR_CLASS = "voiceform-cursor";

let styleInjected = false;

function ensureStyles(): void {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.id = "voiceform-styles";
  style.textContent = `
.${EXEC_CLASS} {
  outline: 3px dashed #ff0 !important;
  outline-offset: 2px !important;
}
.${CURSOR_CLASS} {
  outline: 3px solid #00ff88 !important;
  z-index: 999999 !important;
  outline-offset: 2px !important;
}
`;
  document.documentElement.appendChild(style);
  styleInjected = true;
}

export function highlightElement(el: Element): void {
  ensureStyles();
  el.classList.add(EXEC_CLASS);
  window.setTimeout(() => el.classList.remove(EXEC_CLASS), 600);
}

export function clearHighlights(): void {
  document.querySelectorAll(`.${EXEC_CLASS}`).forEach((el) => {
    el.classList.remove(EXEC_CLASS);
  });
}

export function setCursor(el: Element | null): void {
  ensureStyles();
  document.querySelectorAll(`.${CURSOR_CLASS}`).forEach((prev) => {
    prev.classList.remove(CURSOR_CLASS);
  });
  if (el) {
    el.classList.add(CURSOR_CLASS);
    const target = el as Element & { scrollIntoView?: (options?: unknown) => void };
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    if (el instanceof HTMLElement) {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* jsdom may not implement focus options */
        el.focus();
      }
    }
  }
}

export function getCursor(): Element | null {
  return document.querySelector(`.${CURSOR_CLASS}`);
}
