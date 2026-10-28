/**
 * Content script entry (EXT-001 host): logs active, serves CONTEXT / EXECUTE / NAV_*.
 */

import { createLogger } from "@shared/logger";
import type { Command, FormSnapshot, FormSummary } from "@shared/types";
import { extractFormSnapshot } from "./context-extractor";
import { executeCommands } from "./executor";
import { navNext, navPrev, navRead, resetCursor } from "./cursor";
import { startFormRegistry } from "./form-registry";
import { clearCues, installCueReapply, setCues } from "./cues";

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message?.type) {
        case "PING":
          sendResponse({ ok: true });
          break;
        case "GET_CONTEXT": {
          const snapshot: FormSnapshot = extractFormSnapshot();
          if (message.sessionId) snapshot.sessionId = message.sessionId;
          sendResponse({ ok: true, context: snapshot });
          break;
        }
        case "EXECUTE": {
          const commands = (message.commands ?? []) as Command[];
          const context = (message.context ?? extractFormSnapshot()) as FormSnapshot;
          const result = await executeCommands(commands, context);
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
          setCues({
            forms,
            activeKey: (message.activeKey as string | null) ?? null,
          });
          sendResponse({ ok: true });
          break;
        }
        case "CLEAR_CUES":
          clearCues();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: `unknown message ${message?.type}` });
      }
    } catch (err) {
      log.error("content message failed", {
        type: message?.type,
        error: err instanceof Error ? err.message : String(err),
      });
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
  return true; // async sendResponse
});
