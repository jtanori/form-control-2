/**
 * Durable voice window (fixes "Permission dismissed").
 *
 * The action popup closes when Chrome's mic prompt takes focus, which aborts
 * getUserMedia. This dedicated window stays open, so the prompt is choosable:
 * record → TRANSCRIBE → PARSE → Confirm → EXECUTE, all in one place.
 */

import type { Command, ParseResponse } from "@shared/types";
import { createLogger } from "@shared/logger";

const log = createLogger("ext.recorder");

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const recBtn = $<HTMLButtonElement>("rec");
const phaseEl = $("phase");
const transcriptEl = $("transcript");
const statusEl = $("status");
const commandsEl = $("commands");
const actionsEl = $("actions");
const doneActionsEl = $("doneActions");
const clarifyEl = $("clarify");
const questionEl = $("question");
const answerInput = $<HTMLInputElement>("answer");
const permActionsEl = $("permActions");

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let sessionId = "";
let draftCommands: Command[] = [];

async function sendMessage<T = Record<string, unknown>>(
  message: Record<string, unknown>,
): Promise<T & { ok: boolean; error?: string }> {
  return chrome.runtime.sendMessage(message) as Promise<
    T & { ok: boolean; error?: string }
  >;
}

function setPhase(text: string): void {
  phaseEl.textContent = text;
}

function setStatus(text: string, kind: "ok" | "error" | "" = ""): void {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

function show(el: HTMLElement, visible: boolean): void {
  el.hidden = !visible;
}

function micErrorText(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "NotAllowedError" || /Permission dismissed|denied/i.test(msg)) {
    return (
      "Microphone not granted to the VoiceForm extension yet. " +
      "Click “Ask again” and choose Allow — the prompt belongs to this extension, " +
      "not to the website you are on."
    );
  }
  if (name === "NotFoundError") {
    return "No microphone found on this device.";
  }
  if (name === "NotReadableError") {
    return "Microphone is busy in another app.";
  }
  return `Mic error: ${msg}`;
}

async function openMicSettings(): Promise<void> {
  const extUrl = `chrome-extension://${chrome.runtime.id}`;
  const settingsUrl = `chrome://settings/content/siteDetails?site=${encodeURIComponent(extUrl)}`;
  try {
    // Preferred: open Chrome's per-extension site settings (mic toggle lives here).
    await chrome.tabs.create({ url: settingsUrl });
  } catch {
    // chrome:// from an extension page is sometimes blocked — give the user
    // a copyable path instead of failing silently.
    setStatus(`Open this URL in a new tab:\n${settingsUrl}`, "error");
    return;
  }
  setStatus(
    "Find “Microphone” → Allow, then come back and click “Ask again”.",
    "ok",
  );
}

/** Reflect the persisted extension-level mic grant, if the browser exposes it. */
async function showPermissionState(): Promise<void> {
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (status.state === "granted") {
      setPhase("Microphone allowed — listening…");
    } else if (status.state === "denied") {
      setPhase("Microphone blocked for this extension — use “Open mic settings”.");
    }
  } catch {
    /* Permissions API for microphone isn't exposed in all Chromium builds */
  }
}

function renderCommands(parse: ParseResponse): void {
  commandsEl.innerHTML = "";
  for (const cmd of parse.commands) {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("div");
    title.className = "cmd-title";
    const target = cmd.target.label ?? cmd.target.nodeId ?? "?";
    title.textContent = `${cmd.action} · ${target}`;
    if (cmd.confirmRequired) {
      const badge = document.createElement("span");
      badge.className = "badge warn";
      badge.textContent = "confirm";
      title.appendChild(badge);
    }
    card.appendChild(title);
    if (cmd.action === "fill" && cmd.value !== undefined) {
      const val = document.createElement("div");
      val.className = "hint";
      val.textContent = `= ${cmd.value}`;
      card.appendChild(val);
    }
    commandsEl.appendChild(card);
  }
}

async function stopTracks(): Promise<void> {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function startRecording(): Promise<void> {
  show(actionsEl, false);
  show(doneActionsEl, false);
  show(clarifyEl, false);
  show(permActionsEl, false);
  commandsEl.innerHTML = "";
  transcriptEl.textContent = "…";
  setStatus("");
  recBtn.classList.add("on");
  recBtn.title = "Stop";
  setPhase("Allow the microphone if Chrome asks — this window stays open.");
  await showPermissionState();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    recBtn.classList.remove("on");
    setPhase("Microphone not available.");
    setStatus(micErrorText(err), "error");
    show(permActionsEl, true);
    log.warn("getUserMedia failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  show(permActionsEl, false);

  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    void finishRecording(blob);
  };
  recorder.start();
  setPhase("Listening… click ● to stop.");
  log.info("recording started", { sessionId });
  // Auto-stop after 20s so a stuck click can't record forever.
  window.setTimeout(() => {
    if (recorder?.state === "recording") recorder.stop();
  }, 20_000);
}

function stopRecording(): void {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
    setPhase("Transcribing…");
  }
  void stopTracks();
  recBtn.classList.remove("on");
}

async function finishRecording(blob: Blob): Promise<void> {
  setPhase("Transcribing…");
  try {
    const tx = await sendMessage<{ transcript?: string }>({
      type: "TRANSCRIBE",
      blob,
      sessionId,
    });
    if (!tx.ok) throw new Error(tx.error ?? "transcription failed");
    const text = tx.transcript ?? "";
    if (!text) {
      setPhase("Nothing recognized — try again.");
      setStatus("No speech recognized.", "error");
      show(doneActionsEl, true);
      return;
    }
    transcriptEl.textContent = text;
    await runParse(text);
  } catch (err) {
    setPhase("Transcription failed.");
    setStatus(
      err instanceof Error ? err.message : "Transcription failed",
      "error",
    );
    show(doneActionsEl, true);
  }
}

async function runParse(text: string): Promise<void> {
  setPhase("Parsing…");
  const res = await sendMessage<ParseResponse>({
    type: "PARSE",
    sessionId,
    transcript: text,
  });
  if (!res.ok) {
    setPhase("Parse failed.");
    setStatus(res.error ?? "Parse failed", "error");
    show(doneActionsEl, true);
    return;
  }
  const parse = res as unknown as ParseResponse;
  draftCommands = parse.commands;
  if (parse.needsClarification) {
    setPhase("Needs clarification.");
    setStatus(parse.clarificationQuestion ?? "Which one did you mean?");
    questionEl.textContent = parse.clarificationQuestion ?? "Which one did you mean?";
    show(clarifyEl, true);
    show(doneActionsEl, true);
    return;
  }
  if (parse.commands.length === 0) {
    setPhase("No commands matched.");
    setStatus("No commands matched — record again.", "error");
    show(doneActionsEl, true);
    return;
  }
  setPhase(`${parse.commands.length} command(s) ready — confirm to run.`);
  setStatus("Review and Confirm.", "ok");
  renderCommands(parse);
  show(actionsEl, true);
  show(doneActionsEl, true);
}

async function onConfirm(): Promise<void> {
  show(actionsEl, false);
  setPhase("Executing…");
  const res = await sendMessage<{
    result?: { status: string; error?: string; executed?: Command[] };
  }>({
    type: "EXECUTE",
    sessionId,
    commands: draftCommands,
  });
  if (!res.ok) {
    setPhase("Execution failed.");
    setStatus(res.error ?? "Execution failed", "error");
    return;
  }
  const result = res.result;
  if (result?.status === "ambiguity") {
    setPhase("Ambiguous target.");
    setStatus(
      `${result.error ?? "Ambiguous"} — re-record with a more specific label.`,
      "error",
    );
    return;
  }
  if (result?.status === "error") {
    setPhase("Execution error.");
    setStatus(result.error ?? "Execution error", "error");
    return;
  }
  setPhase("Done.");
  setStatus(`Executed ${result?.executed?.length ?? draftCommands.length} command(s).`, "ok");
  log.info("executed", {
    sessionId,
    count: result?.executed?.length ?? draftCommands.length,
  });
}

async function onClarify(): Promise<void> {
  const answer = answerInput.value.trim();
  if (!answer) return;
  setPhase("Resolving…");
  const res = await sendMessage<ParseResponse>({
    type: "CLARIFY",
    sessionId,
    clarificationText: answer,
  });
  if (!res.ok) {
    setStatus(res.error ?? "Clarify failed", "error");
    return;
  }
  show(clarifyEl, false);
  answerInput.value = "";
  const parse = res as unknown as ParseResponse;
  draftCommands = parse.commands;
  if (parse.needsClarification) {
    questionEl.textContent = parse.clarificationQuestion ?? "Still ambiguous…";
    setStatus(parse.clarificationQuestion ?? "Try a more specific answer");
    show(clarifyEl, true);
    return;
  }
  renderCommands(parse);
  setPhase(`${parse.commands.length} command(s) ready — confirm to run.`);
  setStatus("Review and Confirm.", "ok");
  show(actionsEl, true);
}

recBtn.addEventListener("click", () => {
  if (stream && recorder?.state === "recording") stopRecording();
  else void startRecording();
});
$("confirm").addEventListener("click", () => void onConfirm());
$("cancel").addEventListener("click", () => {
  show(actionsEl, false);
  setStatus("Cancelled.", "");
  setPhase("Cancelled — record again when ready.");
});
$("close").addEventListener("click", () => window.close());
$("again").addEventListener("click", () => void startRecording());
$("sendAnswer").addEventListener("click", () => void onClarify());
$("retry").addEventListener("click", () => void startRecording());
$("openSettings").addEventListener("click", () => void openMicSettings());
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void onClarify();
});

void (async () => {
  const stored = await chrome.storage.session.get(["sessionId"]);
  sessionId =
    (stored.sessionId as string) ??
    `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await chrome.storage.session.set({ sessionId });
  $("sid").textContent = sessionId.slice(0, 14) + "…";
  // Auto-start: this window opened from a click, prompt can appear immediately.
  await startRecording();
})();
