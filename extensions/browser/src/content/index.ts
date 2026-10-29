/**
 * Content script entry (EXT-001 host): logs active, serves CONTEXT / EXECUTE / NAV_*.
 */

import { createLogger } from "@shared/logger";
import type { Command, FormSnapshot, FormSummary } from "@shared/types";
import { extractFormSnapshot } from "./context-extractor";
import { executeCommands } from "./executor";
import { navNext, navPrev, navRead, resetCursor } from "./cursor";
import { findFormByKey, startFormRegistry } from "./form-registry";
import { clearCues, installCueReapply, setCues } from "./cues";
import {
  setListeningUi,
  showConfirmPill,
  showHelperChip,
  hideHelperChip,
} from "./feedback";
import { zenClose, zenToggle } from "./zen";

const log = createLogger("ext.content");

log.info("VoiceForm: active", { url: location.href });

// DOM-visible injection marker (E2E asserts from the page's main world).
try {
  document.documentElement.dataset.voiceform = "ready";
} catch {
  /* document not ready yet */
}

// Reset cursor on page navigation (SPA soft-nav + full loads)
window.addEventListener("pagehide", () => resetCursor());
window.addEventListener("popstate", () => resetCursor());

// B-3 Tier 1: always-on form discovery + B-6 cue layer re-apply
installCueReapply();
startFormRegistry();

let listeningAnchor: Element | null = null;
let activeFormKey: string | null = null;

/** Use the panel-selected form for panel context and execution; no stale fallback. */
function currentSnapshot(): FormSnapshot {
  const full = extractFormSnapshot();
  if (!activeFormKey || activeFormKey === "page") return full;
  const form = findFormByKey(activeFormKey);
  return form ? extractFormSnapshot(form) : { ...full, nodes: [] };
}

/** B-7: tap anywhere on a known form → start listening. */
function onDocumentClick(ev: MouseEvent): void {
  // Synthetic clicks (executor, tests) must not start listening.
  if (!ev.isTrusted) return;
  const target = ev.target as Element | null;
  if (!target || !(target instanceof Element)) return;
  if (target.closest("#voiceform-cue-host, #voiceform-zen-host")) return;
  const form = target.closest("form");
  if (!form) return;
  // Ignore pure link navigations
  if (target.closest("a[href]")) return;
  // Field-anchored feedback (spec §6.3): prefer the control over the form.
  const interactive = target.closest(
    "input, textarea, select, button, [role='button'], [role='checkbox']",
  );
  listeningAnchor = interactive ?? form;
  void chrome.runtime
    .sendMessage({ type: "TAP_TO_TALK" })
    .then(() => {
      hideHelperChip();
      setListeningUi({ listening: true, anchor: listeningAnchor });
    })
    .catch((err) => {
      setListeningUi({
        listening: false,
        anchor: listeningAnchor,
        error:
          err instanceof Error
            ? err.message
            : "Voice failed — open ? Setup to enable the mic.",
      });
    });
}
document.addEventListener("click", onDocumentClick, true);

// Show a calm helper chip when a form is in view (B-7 affordance)
const chipObserver = new MutationObserver(() => {
  const form = document.querySelector("form");
  if (form) showHelperChip(form, () => onDocumentClick(new MouseEvent("click")));
});
if (document.body) {
  chipObserver.observe(document.body, { childList: true, subtree: false });
}
window.setTimeout(() => {
  const form = document.querySelector("form");
  if (form) showHelperChip(form, () => onDocumentClick(new MouseEvent("click")));
}, 600);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message?.type) {
        case "PING":
          sendResponse({ ok: true });
          break;
        case "GET_CONTEXT": {
          const snapshot: FormSnapshot = currentSnapshot();
          if (message.sessionId) snapshot.sessionId = message.sessionId;
          sendResponse({ ok: true, context: snapshot });
          break;
        }
        case "EXECUTE": {
          const commands = (message.commands ?? []) as Command[];
          const context = (message.context ?? currentSnapshot()) as FormSnapshot;
          const result = await executeCommands(commands, context);
          log.info("execute result", {
            status: result.status,
            executed: result.executed.length,
          });
          sendResponse({ ok: true, result });
          break;
        }
        case "NAV_NEXT":
          sendResponse({ ok: true, cursor: navNext() });
          break;
        case "NAV_PREV":
          sendResponse({ ok: true, cursor: navPrev() });
          break;
        case "NAV_READ":
          sendResponse({ ok: true, cursor: navRead() });
          break;
        case "RESET_CURSOR":
          resetCursor();
          sendResponse({ ok: true });
          break;
        case "SET_CUES": {
          // B-6: side panel tells the page which form is active
          const forms = (message.forms ?? []) as FormSummary[];
          activeFormKey = (message.activeKey as string | null) ?? null;
          setCues({
            forms,
            activeKey: (message.activeKey as string | null) ?? null,
          });
          sendResponse({ ok: true });
          break;
        }
        case "CLEAR_CUES":
          activeFormKey = null;
          clearCues();
          sendResponse({ ok: true });
          break;
        case "SET_LISTENING_UI": {
          setListeningUi({
            listening: Boolean(message.listening),
            anchor: listeningAnchor,
            preview: message.preview as string | undefined,
            error: message.error as string | undefined,
          });
          sendResponse({ ok: true });
          break;
        }
        case "SHOW_CONFIRM_PILL": {
          const commands = (message.commands ?? []) as Command[];
          showConfirmPill(
            String(message.question ?? "Confirm?"),
            Number(message.seconds ?? 3),
            (approved) => {
              void chrome.runtime.sendMessage({
                type: "CONFIRM_PILL_RESULT",
                approved,
                commands,
              });
              // Zen §6.4: reading mode ends only after an approved submit.
              if (approved) zenClose();
            },
          );
          sendResponse({ ok: true });
          break;
        }
        case "TOGGLE_ZEN":
          zenToggle();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: `unknown message ${message?.type}` });
      }
    } catch (err) {
      log.error("content message failed", {
        type: message?.type,
        errorType: err instanceof Error ? err.name : typeof err,
      });
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
  return true; // async sendResponse
});
