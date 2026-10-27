/**
 * Content script entry (EXT-001 host): logs active, serves CONTEXT / EXECUTE / NAV_*.
 */

import { createLogger } from "@shared/logger";
import type { Command, FormSnapshot } from "@shared/types";
import { extractFormSnapshot } from "./context-extractor";
import { executeCommands } from "./executor";
import { navNext, navPrev, navRead, resetCursor } from "./cursor";

const log = createLogger("ext.content");

log.info("VoiceForm: active", { url: location.href });

// Reset cursor on page navigation (SPA soft-nav + full loads)
window.addEventListener("pagehide", () => resetCursor());
window.addEventListener("popstate", () => resetCursor());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message?.type) {
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
