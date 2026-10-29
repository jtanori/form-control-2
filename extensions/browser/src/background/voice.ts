/**
 * C2 (B-7) — tap-to-talk orchestration in the SW.
 * Content taps → offscreen records → SW transcribes/parses/executes.
 * High-stakes commands get a 3s confirm pill in the page (B-7 safety).
 */

import { createLogger } from "@shared/logger";
import type { Command, ExtensionMessage, ParseResponse } from "@shared/types";
import { copy } from "../ui/copy";
import { getSessionId, handleMessage, resolveTabId } from "./bridge";
import { isRisky } from "./risk";

const log = createLogger("ext.voice");

const OFFSCREEN_PATH = "offscreen.html";

let pendingTabId: number | undefined;

async function ensureOffscreen(): Promise<void> {
  const contexts = (await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
  })) as { contextType: string }[];
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA" as chrome.offscreen.Reason],
    justification:
      "Record the user's microphone for tap-to-talk form filling (B-7).",
  });
}

async function toTab(message: Record<string, unknown>, tabId?: number): Promise<void> {
  const id = await resolveTabId(tabId);
  await chrome.tabs.sendMessage(id, message).catch((err) => {
    log.warn("tab message failed", {
      type: message.type,
      errorType: err instanceof Error ? err.name : typeof err,
    });
  });
}

export function installVoiceHandlers(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = (message as { type?: string })?.type;

    if (type === "TAP_TO_TALK") {
      void (async () => {
        try {
          const tabId = sender.tab?.id ?? message.tabId;
          pendingTabId = tabId;
          await ensureOffscreen();
          await chrome.runtime.sendMessage({ type: "OFFSCREEN_START" });
          await toTab(
            { type: "SET_LISTENING_UI", listening: true },
            tabId,
          );
          sendResponse({ ok: true });
        } catch (err) {
          log.error("tap-to-talk start failed", {
            errorType: err instanceof Error ? err.name : typeof err,
          });
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
      return true;
    }

    if (type === "AUDIO_BLOB") {
      void (async () => {
        const blob = message.blob as Blob;
        const tabId = pendingTabId;
        try {
          const sessionId = await getSessionId();
          // Reuse the existing TRANSCRIBE bridge (host_permissions :8020).
          const tx = (await handleMessage({
            type: "TRANSCRIBE",
            blob,
            sessionId,
          } as ExtensionMessage)) as { transcript?: string };
          const text = tx.transcript ?? "";
          if (!text) {
            await toTab(
              {
                type: "SET_LISTENING_UI",
                listening: false,
                error: "No speech recognized — tap and try again.",
              },
              tabId,
            );
            sendResponse({ ok: false });
            return;
          }
          await toTab(
            { type: "SET_LISTENING_UI", listening: false, preview: text },
            tabId,
          );
          const parse = (await handleMessage({
            type: "PARSE",
            sessionId,
            transcript: text,
            tabId,
          } as ExtensionMessage)) as ParseResponse;

          if (parse.needsClarification) {
            await toTab(
              {
                type: "SET_LISTENING_UI",
                listening: false,
                error: parse.clarificationQuestion ?? "Which one did you mean?",
              },
              tabId,
            );
            sendResponse({ ok: true });
            return;
          }
          if (!parse.commands.length) {
            await toTab(
              {
                type: "SET_LISTENING_UI",
                listening: false,
                error: "No commands matched — try different wording.",
              },
              tabId,
            );
            sendResponse({ ok: true });
            return;
          }
          if (isRisky(parse.commands)) {
            await toTab(
              {
                type: "SHOW_CONFIRM_PILL",
                question: "Review this action, then tap Confirm.",
                commands: parse.commands,
                seconds: 3,
              },
              tabId,
            );
            sendResponse({ ok: true });
            return;
          }
          const result = await handleMessage({
            type: "EXECUTE",
            sessionId,
            commands: parse.commands,
            tabId,
          } as ExtensionMessage);
          await toTab(
            {
              type: "SET_LISTENING_UI",
              listening: false,
              preview: `Executed ${parse.commands.length} step(s)`,
            },
            tabId,
          );
          log.info("tap-to-talk executed", {
            sessionId,
            count: parse.commands.length,
            result: (result as { result?: { status?: string } })?.result?.status,
          });
          sendResponse({ ok: true });
        } catch (err) {
          log.error("audio result failed", {
            errorType: err instanceof Error ? err.name : typeof err,
          });
          await toTab(
            {
              type: "SET_LISTENING_UI",
              listening: false,
              error: err instanceof Error ? err.message : "Voice failed",
            },
            tabId,
          );
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (type === "CONFIRM_PILL_RESULT") {
      void (async () => {
        const { approved, commands } = message as unknown as {
          approved: boolean;
          commands: Command[];
        };
        // The approval belongs to the page that rendered the pill. Never route
        // it through the mutable global last-target tab (another tab may have
        // become active while the confirmation was visible).
        const tabId = sender.tab?.id;
        if (tabId === undefined) {
          sendResponse({ ok: false, error: "confirmation has no owning tab" });
          return;
        }
        try {
          if (approved) {
            const sessionId = await getSessionId();
            log.info("confirm pill approved — executing", {
              sessionId,
              commandCount: commands.length,
            });
            const execResult = (await handleMessage({
              type: "EXECUTE",
              sessionId,
              commands,
              tabId,
            } as ExtensionMessage)) as { result?: { status?: string; error?: string } };
            log.info("confirm execute result", {
              status: execResult?.result?.status,
              hasError: Boolean(execResult?.result?.error),
            });
            await toTab(
              {
                type: "SET_LISTENING_UI",
                listening: false,
                preview: `Executed ${commands.length} step(s)`,
              },
              tabId,
            );
          } else {
            await toTab(
              {
                type: "SET_LISTENING_UI",
                listening: false,
                error: copy("confirm.cancelled_action"),
              },
              tabId,
            );
          }
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : "confirmation failed",
          });
        }
      })();
      return true;
    }

    // Zen review Submit (§6.4) — same safety path as voice (D1: pill visible, ungated).
    if (type === "ZEN_EXECUTE") {
      void (async () => {
        try {
          const { commands } = message as unknown as { commands: Command[] };
          if (!commands?.length) {
            sendResponse({ ok: false, error: "no commands" });
            return;
          }
          const tabId = sender.tab?.id;
          pendingTabId = tabId;
          if (isRisky(commands)) {
            await toTab(
              {
                type: "SHOW_CONFIRM_PILL",
                question: "Review this action, then tap Confirm.",
                commands,
                seconds: 3,
              },
              tabId,
            );
          } else {
            const sessionId = await getSessionId();
            await handleMessage({
              type: "EXECUTE",
              sessionId,
              commands,
              tabId,
            } as ExtensionMessage);
          }
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
      return true;
    }

    if (type === "LISTENING_STARTED" || type === "LISTENING_ERROR") {
      // Offscreen → SW bookkeeping (errors surface via content UI too).
      if (type === "LISTENING_ERROR") {
        void toTab(
          {
            type: "SET_LISTENING_UI",
            listening: false,
            error: (message as { error: string }).error,
          },
          pendingTabId,
        );
      }
      return false;
    }

    return false;
  });
}
