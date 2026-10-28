/**
 * Offscreen document (spike #2) — USER_MEDIA capture for page-tap flows.
 * Invisible infrastructure: never shown; SW creates one instance.
 * Permission was already granted from Options/Side Panel (B-1a) — getUserMedia
 * here resolves silently while the grant holds.
 */

import { createLogger } from "@shared/logger";

const log = createLogger("ext.offscreen");

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let maxTimer: number | null = null;

const MAX_MS = 12_000;

async function start(): Promise<void> {
  if (recorder && recorder.state === "recording") return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    log.error("offscreen getUserMedia failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    void chrome.runtime.sendMessage({
      type: "LISTENING_ERROR",
      error: err instanceof Error ? err.message : "mic unavailable",
    });
    return;
  }
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    if (maxTimer !== null) window.clearTimeout(maxTimer);
    maxTimer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    const blob = new Blob(chunks, { type: "audio/webm" });
    log.info("offscreen capture finished", { bytes: blob.size });
    void chrome.runtime.sendMessage({ type: "AUDIO_BLOB", blob });
  };
  recorder.start();
  maxTimer = window.setTimeout(() => {
    if (recorder?.state === "recording") recorder.stop();
  }, MAX_MS);
  log.info("offscreen recording started");
  void chrome.runtime.sendMessage({ type: "LISTENING_STARTED" });
}

function stop(): void {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  else {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only the SW orchestrates; ignore page/content echoes.
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "OFFSCREEN_START") {
    void start().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "OFFSCREEN_STOP") {
    stop();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

log.info("offscreen document ready");
