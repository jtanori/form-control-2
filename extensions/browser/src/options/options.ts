/**
 * B-1 / B-1a / B-5 — configuration + onboarding page (full tab, durable).
 * Never requests mic on install; value-first, just-in-time enablement.
 */

import { createLogger } from "@shared/logger";

const log = createLogger("ext.options");
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const enableBtn = $<HTMLButtonElement>("enableMic");
const recheckBtn = $<HTMLButtonElement>("recheck");
const micState = $("micState");
const micDot = $("micDot");
const micOk = $("micOk");
const micDenied = $("micDenied");
const coreDot = $("coreDot");
const learnDot = $("learnDot");
const health = $("health");
const coreInput = $<HTMLInputElement>("coreUrl");
const diag = $("diag");

async function permissionState(): Promise<PermissionState | "unsupported"> {
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return "unsupported";
  }
}

function paintMic(state: PermissionState | "unsupported"): void {
  micDot.className = `vf-dot ${state === "granted" ? "ok" : state === "denied" ? "bad" : ""}`;
  micState.textContent =
    state === "granted" ? "enabled" : state === "denied" ? "blocked" : "not enabled";
  micOk.classList.toggle("show", state === "granted");
  micDenied.classList.toggle("show", state === "denied");
  learnDot.className = `vf-dot ${state === "granted" ? "ok" : ""}`;
}

async function refreshMic(): Promise<void> {
  paintMic(await permissionState());
}

enableBtn.addEventListener("click", async () => {
  enableBtn.disabled = true;
  try {
    // Just-in-time prompt inside this durable tab (spike #1).
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    log.info("mic enabled from options");
  } catch (err) {
    log.warn("mic enable failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  enableBtn.disabled = false;
  await refreshMic();
});

recheckBtn.addEventListener("click", () => void refreshMic());

async function pingCore(): Promise<void> {
  const base = coreInput.value.trim() || "http://localhost:8020";
  health.textContent = "checking…";
  coreDot.className = "vf-dot busy";
  try {
    const res = await fetch(`${base}/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as {
      version?: string;
      sttBackend?: string;
      provider?: string;
    };
    health.textContent = `v${data.version} · ${data.provider} · stt:${data.sttBackend}`;
    coreDot.className = "vf-dot ok";
    learnDot.className = `vf-dot ${(await permissionState()) === "granted" ? "ok" : ""}`;
  } catch {
    health.textContent = `unreachable at ${base} — is Core running?`;
    coreDot.className = "vf-dot bad";
  }
}

coreInput.addEventListener("change", () => {
  void chrome.storage.sync.set({ coreUrl: coreInput.value.trim() });
  void pingCore();
});
$("ping").addEventListener("click", () => void pingCore());

$("openDemo").addEventListener("click", () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
});
$("openPanel").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Open a normal page first so sidePanel.open has a tab context
  const target = tab && !String(tab.url).startsWith("chrome-extension://")
    ? tab
    : await chrome.tabs.create({ url: "about:blank" });
  if (target?.id !== undefined) {
    await chrome.sidePanel.open({ tabId: target.id }).catch(() => undefined);
  }
  window.close();
});

$("copySession").addEventListener("click", async () => {
  const stored = await chrome.storage.session.get(["sessionId"]);
  const sid = (stored.sessionId as string) ?? "(none yet)";
  await navigator.clipboard.writeText(sid).catch(() => undefined);
  diag.textContent = `copied: ${sid.slice(0, 18)}…`;
});

void (async () => {
  const stored = await chrome.storage.sync.get(["coreUrl"]);
  coreInput.value =
    (stored.coreUrl as string) || "http://localhost:8020";
  await refreshMic();
  await pingCore();
  const st = await chrome.storage.session.get(["sessionId"]);
  diag.textContent = ((st.sessionId as string) ?? "(none)").slice(0, 22);
})();
