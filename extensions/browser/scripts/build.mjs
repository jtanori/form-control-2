import * as esbuild from "esbuild";
import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(root, "..");
const dist = join(pkgRoot, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const alias = {
  "@shared": join(pkgRoot, "..", "shared"),
};

const common = {
  bundle: true,
  sourcemap: true,
  target: "chrome114",
  logLevel: "info",
  alias,
};

// Content script must be a single classic script (no ES modules in content_scripts).
await esbuild.build({
  ...common,
  entryPoints: [join(pkgRoot, "src/content/index.ts")],
  outfile: join(dist, "content.js"),
  format: "iife",
});

// Background service worker (MV3 "type": "module").
await esbuild.build({
  ...common,
  entryPoints: [join(pkgRoot, "src/background/index.ts")],
  outfile: join(dist, "background.js"),
  format: "esm",
});

// Popup (React).
await esbuild.build({
  ...common,
  entryPoints: [join(pkgRoot, "src/popup/main.tsx")],
  outfile: join(dist, "popup.js"),
  format: "iife",
  jsx: "automatic",
  loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' },
});

// Static assets.
await cp(join(pkgRoot, "manifest.json"), join(dist, "manifest.json"));
await cp(join(pkgRoot, "src/popup/popup.html"), join(dist, "popup.html"));
await cp(join(pkgRoot, "src/popup/popup.css"), join(dist, "popup.css"));

// Minimal placeholder icons (solid PNG generated as base64 1x1 scaled by browser).
const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
await writeFile(join(dist, "icon48.png"), png1x1);
await writeFile(join(dist, "icon128.png"), png1x1);

const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
console.log(
  `built extension v${manifest.version} -> dist/ (${["content.js", "background.js", "popup.js", "popup.html"].join(", ")})`,
);
