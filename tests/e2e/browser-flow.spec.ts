/**
 * INTE-001 — transcript → parsed commands → confirm → filled checkout form,
 * through the real MV3 extension against a stubbed Core.
 *
 * Session id is attached on failure for INFR-002 log correlation.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(here, "..", "..", "extensions", "browser", "dist");
const FIXTURE_URL = "http://127.0.0.1:4173/tests/fixtures/form-checkout.html";
const MOCK_CORE = "http://127.0.0.1:8020";

const TRANSCRIPT =
  "fill the email address with test@example.com and click submit billing";

let sessionId = "e2e-pending";

async function launchExtensionContext(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext("", {
    // Extensions require the full Chromium build + a persistent profile.
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  return context;
}

async function extensionServiceWorker(context: BrowserContext) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 30_000 });
  return sw;
}

async function extensionId(sw: Awaited<ReturnType<typeof extensionServiceWorker>>) {
  const url = new URL(sw.url());
  if (url.protocol !== "chrome-extension:") {
    throw new Error(`unexpected service worker url: ${sw.url()}`);
  }
  return url.host;
}

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    testInfo.annotations.push({
      type: "sessionId",
      description: sessionId,
    });
    await testInfo.attach(`sessionId=${sessionId}`, {
      body: `correlate core/ext logs with sessionId=${sessionId}\n`,
      contentType: "text/plain",
    });
  }
});

test("voiceform extension: parse → confirm → fills checkout form", async ({}, testInfo) => {
  test.setTimeout(120_000);
  sessionId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  testInfo.annotations.push({ type: "sessionId", description: sessionId });

  const context = await launchExtensionContext();
  const mark = (s: string) => console.log(`STEP ${s}`);
  try {
    mark("launch");
    const sw = await extensionServiceWorker(context);
    const id = await extensionId(sw);
    mark(`sw ${id}`);

    // Point the bridge at the stub Core (host_permissions already allow :8020).
    await sw.evaluate(async (coreUrl) => {
      await chrome.storage.sync.set({ coreUrl });
    }, MOCK_CORE);
    mark("storage");

    // Real page under test.
    const page = await context.newPage();
    await page.goto(FIXTURE_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible();
    mark("fixture");

    // Workspace as a tab (B-2 spike #1: E2E surface = sidepanel.html — same
    // React tree the docked panel uses; popup is demoted to a launcher).
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/sidepanel.html`, {
      timeout: 15_000,
    });
    mark("sidepanel loaded");
    await expect(popup.locator("h1")).toHaveText("VoiceForm", { timeout: 10_000 });
    mark("h1");

    // Typed-command path (STT stub exists; typing is deterministic for CI).
    await popup.locator('input[name="typed"]').fill(TRANSCRIPT, { timeout: 10_000 });
    mark("filled");
    // dispatchEvent: FormList's 4s poll can keep the node "unstable" for
    // Playwright actionability; the React handler is what matters.
    await popup.getByRole("button", { name: "Parse" }).dispatchEvent("click");
    mark("parse clicked");

    // (3) Confirmation UI before anything executes — cards + Confirm/Cancel.
    await expect(popup.locator(".card").first()).toBeVisible({ timeout: 20_000 });
    mark("cards");
    await expect(popup.locator(".cmd-title").first()).toContainText("fill");
    await expect(popup.locator(".cmd-title").nth(1)).toContainText("click");
    const confirm = popup.getByRole("button", { name: "Confirm" });
    await expect(confirm).toBeVisible();

    // Nothing may execute before Confirm.
    await expect(page.locator("#email")).toHaveValue("");
    await expect(page.locator("body")).not.toHaveAttribute("data-clicked", /.+/);

    await confirm.click({ force: true, timeout: 15_000 });

    // (1) email filled
    await expect(page.locator("#email")).toHaveValue("test@example.com", {
      timeout: 20_000,
    });
    // (2) submit button clicked (click listener sets the flag)
    await expect(page.locator("body")).toHaveAttribute("data-clicked", /.+/, {
      timeout: 20_000,
    });
    // form submit handler ran (preventDefault → data-submitted)
    await expect(page.locator("body")).toHaveAttribute("data-submitted", /.+/, {
      timeout: 20_000,
    });

    await expect(popup.locator(".status")).toContainText("Executed", {
      timeout: 15_000,
    });

    await testInfo.attach("flow-ok", {
      body: `sessionId=${sessionId} transcript="${TRANSCRIPT}"\n`,
      contentType: "text/plain",
    });
  } finally {
    await context.close();
  }
});

test("stt endpoint answers the transcript stub (G1 plumbing)", async ({ request }) => {
  // If a live Docker Core occupies :8020, webServer reuses it (by design) —
  // whisper won't decode fake bytes. Only assert against the stub server.
  const health = await request.get(`${MOCK_CORE}/api/v1/health`);
  const body = (await health.json().catch(() => ({}))) as { version?: string };
  test.skip(
    body.version !== "0.0.0-mock",
    `port 8020 is a live core (v${body.version}) — stub not in charge`,
  );
  const resp = await request.post(`${MOCK_CORE}/stt/transcribe`, {
    multipart: { audio: { name: "speech.webm", mimeType: "audio/webm", buffer: Buffer.from("fake") } },
  });
  expect(resp.status()).toBe(200);
  const stt = await resp.json();
  expect(stt).toMatchObject({
    transcript: expect.any(String),
    language: "en",
    confidence: expect.any(Number),
    duration_sec: expect.any(Number),
  });
  expect(stt.transcript.length).toBeGreaterThan(0);
});
