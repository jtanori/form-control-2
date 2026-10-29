/**
 * EXT-006 — Extension ↔ Core bridge (background service worker).
 * Owns all I/O: STT upload, Core parse/clarify, dispatch to content script.
 * Offline: queues the last 2 messages and retries with exponential backoff.
 */

import { createLogger } from "@shared/logger";
import type {
  Command,
  ExtensionMessage,
  FormSnapshot,
  FormSummary,
  ParseResponse,
} from "@shared/types";

const log = createLogger("ext.bridge");

const DEFAULT_CORE_URL = "http://localhost:8020";
const MAX_QUEUE = 2;

interface QueuedMessage {
  message: ExtensionMessage;
  attempts: number;
  enqueuedAt: number;
}

const queue: QueuedMessage[] = [];
let flushing = false;

export async function getCoreUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get(["coreUrl"]);
  return (stored.coreUrl as string) || DEFAULT_CORE_URL;
}

export async function setCoreUrl(coreUrl: string): Promise<void> {
  await chrome.storage.sync.set({ coreUrl });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 10000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function enqueue(message: ExtensionMessage): void {
  queue.push({ message, attempts: 0, enqueuedAt: Date.now() });
  while (queue.length > MAX_QUEUE) queue.shift();
  log.warn("queued message (core unreachable)", {
    type: message.type,
    queueSize: queue.length,
  });
}

async function flushQueue(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const item = queue[0];
      try {
        await handleMessage(item.message, { fromQueue: true });
        queue.shift();
        log.info("flushed queued message", { type: item.message.type });
      } catch {
        item.attempts += 1;
        const delay = Math.min(30000, 500 * 2 ** item.attempts);
        log.warn("queue flush retry scheduled", {
          type: item.message.type,
          attempts: item.attempts,
          delayMs: delay,
        });
        await new Promise((r) => setTimeout(r, delay));
        if (item.attempts > 8) {
          queue.shift();
          log.error("dropped queued message after retries", {
            type: item.message.type,
          });
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

function isCoreDown(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && /fetch|network|abort/i.test(err.message));
}

async function corePost<T>(
  path: string,
  body: unknown,
  opts: { formData?: FormData } = {},
): Promise<T> {
  const base = await getCoreUrl();
  const url = `${base}${path}`;
  const init: RequestInit = opts.formData
    ? { method: "POST", body: opts.formData }
    : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      };
  const res = await fetchWithTimeout(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`core ${path} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * Resolve which tab to message (INTE-001).
 *
 * Without the `tabs` permission, `tabs.query` omits URLs — so we probe tabs
 * with a side-effect-free `PING` and remember the last tab that answered
 * (the popup opened as a E2E tab has no content script and fails the probe).
 */
let lastTargetTabId: number | undefined;

async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch {
    return false;
  }
}

export async function resolveTabId(tabId?: number): Promise<number> {
  if (tabId !== undefined) return tabId;
  if (lastTargetTabId !== undefined && (await pingContentScript(lastTargetTabId))) {
    return lastTargetTabId;
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabs: chrome.tabs.Tab[] = active ? [active, ...(await chrome.tabs.query({}))] : await chrome.tabs.query({});
  const seen = new Set<number>();
  for (const tab of tabs) {
    if (tab.id === undefined || seen.has(tab.id)) continue;
    seen.add(tab.id);
    if (tab.url?.startsWith("chrome-extension://")) continue;
    if (await pingContentScript(tab.id)) {
      lastTargetTabId = tab.id;
      return tab.id;
    }
  }
  throw new Error("no active tab with a reachable content script");
}

async function sendMessageToTab<T>(
  tabId: number | undefined,
  message: unknown,
): Promise<T> {
  const target = await resolveTabId(tabId);
  return chrome.tabs.sendMessage(target, message) as Promise<T>;
}

export async function getSessionId(): Promise<string> {
  const stored = await chrome.storage.session.get(["sessionId"]);
  if (stored.sessionId) return stored.sessionId as string;
  const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.session.set({ sessionId });
  return sessionId;
}

// ---- B-3 Tier 1: form registry + toolbar badge (local only) ----

interface RegistryEntry {
  tabId: number;
  href: string;
  forms: FormSummary[];
  at: number;
}

async function recordFormRegistry(
  forms: FormSummary[],
  href: string,
  tabId: number,
): Promise<void> {
  const entry: RegistryEntry = { tabId, href, forms, at: Date.now() };
  await chrome.storage.session.set({ [`formRegistry:${tabId}`]: entry });
  await updateBadge();
}

async function getFormRegistry(): Promise<RegistryEntry[]> {
  const all = await chrome.storage.session.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith("formRegistry:"))
    .map(([, v]) => v as RegistryEntry)
    .filter((e) => e && Date.now() - e.at < 5 * 60_000);
  return entries.sort((a, b) => b.at - a.at);
}

async function updateBadge(): Promise<void> {
  const entries = await getFormRegistry();
  const count = entries.reduce((n, e) => n + e.forms.length, 0);
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  // Literals mirror contracts/design/tokens.json (chrome.action cannot resolve CSS vars).
  await chrome.action.setBadgeBackgroundColor({
    color: count > 0 ? "#2878F0" : "#64748B",
  });
}

export async function handleMessage(
  message: ExtensionMessage,
  opts: { fromQueue?: boolean } = {},
): Promise<unknown> {
  const sessionId =
    ("sessionId" in message && message.sessionId) || (await getSessionId());
  log.debug("handle message", { type: message.type, sessionId });

  try {
    switch (message.type) {
      case "TRANSCRIBE": {
        const base = await getCoreUrl();
        const form = new FormData();
        form.append("audio", message.blob, "speech.webm");
        const res = await fetchWithTimeout(`${base}/stt/transcribe`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(`stt -> ${res.status}`);
        const data = (await res.json()) as { transcript?: string; text?: string };
        return { transcript: data.transcript ?? data.text ?? "" };
      }

      case "PARSE": {
        const context =
          message.context ??
          (
            await sendMessageToTab<{
              ok: boolean;
              context: FormSnapshot;
            }>(message.tabId, { type: "GET_CONTEXT", sessionId })
          ).context;
        const result = await corePost<ParseResponse>("/api/v1/parse", {
          sessionId,
          transcript: message.transcript,
          context,
        });
        log.info("parse ok", {
          sessionId,
          commandCount: result.commands.length,
          needsClarification: result.needsClarification,
        });
        return result;
      }

      case "CLARIFY": {
        const context =
          message.context ??
          (
            await sendMessageToTab<{
              ok: boolean;
              context: FormSnapshot;
            }>(message.tabId, { type: "GET_CONTEXT", sessionId })
          ).context;
        const result = await corePost<ParseResponse>("/api/v1/clarify", {
          sessionId,
          clarificationText: message.clarificationText,
          context,
        });
        return result;
      }

      case "EXECUTE": {
        const result = await sendMessageToTab<{
          ok: boolean;
          result: {
            status: string;
            executed: Command[];
            candidates?: unknown;
            error?: string;
          };
        }>(message.tabId, {
          type: "EXECUTE",
          sessionId,
          commands: message.commands,
          context: message.context,
        });
        return result;
      }

      case "GET_CONTEXT":
        return sendMessageToTab(message.tabId, {
          type: "GET_CONTEXT",
          sessionId,
        });

      case "NAV_NEXT":
      case "NAV_PREV":
      case "NAV_READ":
        return sendMessageToTab(message.tabId, {
          type: message.type,
          sessionId,
        });

      case "SET_CORE_URL": {
        const url = (message as { coreUrl: string }).coreUrl;
        await setCoreUrl(url);
        return { ok: true, coreUrl: await getCoreUrl() };
      }

      case "GET_STATE": {
        const coreUrl = await getCoreUrl();
        return { sessionId, coreUrl, queueSize: queue.length };
      }

      case "FORM_REGISTRY": {
        // Fallback path; primary path handles this with sender.tab in onMessage.
        return { ok: true };
      }

      case "GET_FORM_REGISTRY":
        // Return per-tab entries. Consumers must choose the active tab before
        // painting/acting; mixing rectangles from other tabs is unsafe.
        return { forms: await getFormRegistry() };

      case "OPEN_SIDE_PANEL": {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.id !== undefined) {
          await chrome.sidePanel.open({ tabId: tab.id });
        }
        return { ok: true };
      }

      case "OPEN_OPTIONS": {
        await chrome.runtime.openOptionsPage();
        return { ok: true };
      }

      default: {
        const never: never = message;
        throw new Error(`unknown message type: ${JSON.stringify(never)}`);
      }
    }
  } catch (err) {
    const localOnly =
      message.type === "GET_CONTEXT" ||
      message.type === "EXECUTE" ||
      message.type === "NAV_NEXT" ||
      message.type === "NAV_PREV" ||
      message.type === "NAV_READ" ||
      message.type === "SET_CORE_URL" ||
      message.type === "GET_STATE";
    if (!opts.fromQueue && !localOnly && isCoreDown(err)) {
      enqueue(message);
      return { queued: true, queueSize: queue.length };
    }
    log.error("bridge error", {
      type: message.type,
      sessionId,
      errorType: err instanceof Error ? err.name : typeof err,
    });
    throw err;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = (message as { type?: string })?.type;
  // Voice/orchestration messages are handled in voice.ts (own listener).
  const voiceTypes = new Set([
    "TAP_TO_TALK",
    "AUDIO_BLOB",
    "CONFIRM_PILL_RESULT",
    "LISTENING_STARTED",
    "LISTENING_ERROR",
    "OFFSCREEN_START",
    "OFFSCREEN_STOP",
    "ZEN_EXECUTE",
  ]);
  if (voiceTypes.has(type ?? "")) return false;

  // Form registry (B-3) must record the *sender's* tab, not "active".
  if (type === "FORM_REGISTRY" && sender.tab?.id !== undefined) {
    void recordFormRegistry(
      message.forms as FormSummary[],
      (message.href as string) ?? sender.tab.url ?? "",
      sender.tab.id,
    )
      .then(() => sendResponse({ ok: true }))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    return true;
  }
  void handleMessage(message as ExtensionMessage)
    .then((result) => sendResponse({ ok: true, ...((result as object) ?? {}) }))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  return true;
});

// Retry queue when connectivity may be back
chrome.runtime.onStartup.addListener(() => void flushQueue());
chrome.alarms?.create?.("voiceform-flush", { periodInMinutes: 1 });
chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === "voiceform-flush") void flushQueue();
});

// Context menu (permission declared in manifest) + first-run surfaces (B-1/B-5)
chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: "voiceform-capture",
    title: "VoiceForm: capture page form",
    contexts: ["page"],
  });
  // Never request mic on install (B-1a) — open setup/onboarding with value-first copy.
  if (details.reason === "install") {
    void chrome.runtime.openOptionsPage();
  }
});

// B-2: clicking the toolbar icon opens the Side Panel workspace
try {
  void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
} catch {
    /* sidePanel API missing in older Chromium — popup still opens */
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "voiceform-capture") return;
  void (async () => {
    const sessionId = await getSessionId();
    const context = await sendMessageToTab<{ ok: boolean; context: FormSnapshot }>(
      tab?.id,
      { type: "GET_CONTEXT", sessionId },
    );
    log.info("context captured from menu", {
      sessionId,
      nodeCount: context.context?.nodes?.length ?? 0,
    });
  })();
});

log.info("background service worker started");
