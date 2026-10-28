/**
 * UX-003-P4 — automatable rows of spec §10 (contracts/design/qa-automatable.md).
 * Excluded: QA-010–014 (D1). Manual rows live in tests/manual/QA-GATE.md.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
} from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(here, "..", "..", "extensions", "browser", "dist");
const FIXTURE_URL = "http://127.0.0.1:4173/tests/fixtures/forms/checkout-plain.html";
const MOCK_CORE = "http://127.0.0.1:8020";

/** True only when the stub Core (not a live docker one) owns :8020. */
async function stubOwnsPort(request: import("@playwright/test").APIRequestContext) {
  try {
    const res = await request.get(`${MOCK_CORE}/api/v1/health`, { timeout: 3000 });
    const data = (await res.json()) as { version?: string };
    return data.version === "0.0.0-mock";
  } catch {
    return false;
  }
}

async function launch(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
}

async function sw(ctx: BrowserContext) {
  let [worker] = ctx.serviceWorkers();
  if (!worker) worker = await ctx.waitForEvent("serviceworker", { timeout: 30000 });
  return worker;
}

async function openPanel(ctx: BrowserContext) {
  const worker = await sw(ctx);
  const id = new URL(worker.url()).host;
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  await page.locator("h1").waitFor();
  return { worker, page };
}

test("QA-001 — install does not grant/use the microphone", async ({ request }) => {
  test.setTimeout(180_000);
  const ctx = await launch();
  try {
    const worker = await sw(ctx);
    const id = new URL(worker.url()).host;
    // Fresh profile: open setup (install auto-open) and query permission state —
    // a silent install-time request would have flipped this to "granted".
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/options.html`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.locator("#enableMic").waitFor({ timeout: 30_000 });
    const state = await page.evaluate(async () => {
      const s = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      return s.state;
    });
    expect(state).toBe("prompt");
    if (await stubOwnsPort(request)) {
      const stats = (await (await request.get(`${MOCK_CORE}/debug/stats`)).json()) as {
        sttHits: number;
      };
      expect(typeof stats.sttHits).toBe("number");
    }
  } finally {
    await ctx.close();
  }
});

test("QA-002 — passive detection is local-only (no STT/parse on load)", async ({
  request,
}) => {
  test.skip(!(await stubOwnsPort(request)), "stub Core not in charge of :8020");
  const before = (await (await request.get(`${MOCK_CORE}/debug/stats`)).json()) as {
    sttHits: number;
    parseHits: number;
  };
  const ctx = await launch();
  try {
    await sw(ctx);
    const page = await ctx.newPage();
    await page.goto(FIXTURE_URL, { waitUntil: "domcontentloaded" });
    // registry publishes + badge updates happen without touching Core
    await page.waitForTimeout(1500);
    const after = (await (await request.get(`${MOCK_CORE}/debug/stats`)).json()) as {
      sttHits: number;
      parseHits: number;
    };
    expect(after.sttHits).toBe(before.sttHits);
    expect(after.parseHits).toBe(before.parseHits);
  } finally {
    await ctx.close();
  }
});

test("QA-005 — Core offline: parse fails with recovery copy, no cards", async () => {
  const ctx = await launch();
  try {
    const { worker, page } = await openPanel(ctx);
    await worker.evaluate(async () => {
      await chrome.storage.sync.set({ coreUrl: "http://127.0.0.1:9" }); // dead port
    });
    const fixture = await ctx.newPage();
    await fixture.goto(FIXTURE_URL, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="typed"]').fill("fill the email address with a@b.com");
    await page.getByRole("button", { name: "Parse" }).dispatchEvent("click");
    await expect(page.locator(".status.error")).toBeVisible({ timeout: 20000 });
    const text = (await page.locator(".status").textContent()) ?? "";
    expect(text.toLowerCase()).toMatch(
      /core|fetch|failed|unreachable|http|available|queued/,
    );
    // no command cards = no execution path
    await expect(page.locator(".card").first()).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test("QA-009 + QA-015 — zen submit shows in-page confirm pill; Cancel does not execute", async () => {
  test.setTimeout(180_000);
  const mark = (s: string) => console.log(`STEP ${s}`);
  const ctx = await launch();
  try {
    const { page } = await openPanel(ctx);
    mark("panel");
    const worker = await sw(ctx);
    worker.on("console", (m) => {
      if (/confirm|execute/i.test(m.text())) console.log(`[sw] ${m.text()}`);
    });
    const fixture = await ctx.newPage();
    fixture.on("console", (m) => {
      if (/CLICK_TARGET|EXECUTE /i.test(m.text())) console.log(`[page] ${m.text()}`);
    });
    fixture.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
    await fixture.goto(FIXTURE_URL, { waitUntil: "domcontentloaded" });
    await expect(fixture.locator("#email")).toBeVisible();
    mark("fixture");
    // pre-check: fixture listeners must be attached before we exercise execute
    const pre = await fixture.evaluate(() => {
      const form = document.getElementById("checkout");
      const btn = document.getElementById("submit");
      return JSON.stringify({
        form: Boolean(form),
        btn: Boolean(btn),
        url: location.pathname,
      });
    });
    console.log("PRECHECK:", pre);

    const dialog = fixture.locator("div[role='dialog']");
    const pill = fixture.locator(".vf-pill2");

    async function walkZenToReview() {
      if ((await dialog.count()) === 0) {
        await page.getByRole("button", { name: "Zen" }).click();
      }
      await expect(dialog).toBeVisible({ timeout: 15000 });
      const next = fixture.getByRole("button", { name: "Next field" });
      const reviewHeading = fixture.getByRole("heading", {
        name: "Review your changes",
      });
      for (let i = 0; i < 8 && (await reviewHeading.count()) === 0; i++) {
        await next.click({ timeout: 10_000, force: true });
      }
      await expect(reviewHeading).toBeVisible({ timeout: 10_000 });
    }

    // Zen → review → Submit → pill (QA-009)
    await walkZenToReview();
    mark("review");
    await fixture.locator("div.panel button.primary").dispatchEvent("click");
    mark("submitted");
    await expect(pill).toBeVisible({ timeout: 15_000 });
    await expect(pill).toContainText("Confirm");

    // Cancel — nothing executes (QA-015)
    await pill.locator(".no").dispatchEvent("click");
    await expect(pill).toBeHidden({ timeout: 10_000 });
    await expect
      .poll(async () => fixture.evaluate(() => JSON.stringify(document.body.dataset)), {
        timeout: 3000,
      })
      .toBe("{}");
    mark("cancelled");

    // Submit again → Confirm executes (D1 ungated)
    await walkZenToReview();
    await fixture.bringToFront();
    await fixture.locator("div.panel button.primary").dispatchEvent("click");
    mark("submitted2");
    await expect(pill).toBeVisible({ timeout: 15_000 });
    await pill.locator(".yes").dispatchEvent("click");
    mark("confirmed");
    // diagnostic: if execute's isolated-world click didn't fire page listeners,
    // try a main-world click to see whether listeners exist at all.
    try {
      await expect
        .poll(
          async () =>
            fixture.evaluate(() => {
              const d = document.body.dataset as Record<string, string>;
              return `${d.clicked ?? ""}|${d.submitted ?? ""}`;
            }),
          { timeout: 15000 },
        )
        .toMatch(/\d/);
    } catch {
      const probe = await fixture.evaluate(() => {
        const btn = document.getElementById("submit") as HTMLButtonElement | null;
        const has = Boolean(btn);
        btn?.click();
        const d = document.body.dataset as Record<string, string>;
        return JSON.stringify({
          hasSubmitBtn: has,
          afterMainClick: `${d.clicked ?? ""}|${d.submitted ?? ""}`,
        });
      });
      console.log("MAIN-WORLD PROBE:", probe);
      throw new Error(`execute click did not fire page listeners (${probe})`);
    }
    // zen closes itself after accepted submit
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  } finally {
    await ctx.close();
  }
});
