/** Build extensions/browser/dist if missing (idempotent, cheap when fresh). */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distManifest = join(here, "..", "..", "extensions", "browser", "dist", "manifest.json");

if (existsSync(distManifest) && !process.env.FORCE_EXT_BUILD) {
  console.log("[e2e] extension dist present, skipping build");
  process.exit(0);
}

console.log("[e2e] building browser extension…");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  cwd: join(here, "..", "..", "extensions", "browser"),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
