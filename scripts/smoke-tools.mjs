#!/usr/bin/env node
/**
 * Browser smoke tests for Engineering Toolkit.
 * Starts a static file server on the repo root and visits every live tool.
 *
 * Run: npm run smoke
 * Env:
 *   BASE_URL   — if set, skip local server and hit this origin
 *   SMOKE_PORT — local port (default 4173)
 *   HEADED=1   — show browser
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { liveTools, loadToolsData } from "./lib/tools-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = Number(process.env.SMOKE_PORT || 4173);
const EXTERNAL = process.env.BASE_URL || "";
const HEADED = process.env.HEADED === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain"
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      // Prevent path traversal
      const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      let filePath = path.join(root, safe);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function main() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.error("Playwright is not installed. Run: npm install");
    process.exit(1);
  }

  const registry = loadToolsData(ROOT);
  const tools = liveTools(registry);
  console.log(`Smoke: ${tools.length} live tools`);

  let server = null;
  let base = EXTERNAL.replace(/\/$/, "");
  if (!base) {
    server = await startStaticServer(ROOT, PORT);
    base = `http://127.0.0.1:${PORT}`;
    console.log(`Serving ${ROOT} at ${base}`);
  } else {
    console.log(`Using BASE_URL=${base}`);
  }

  /** Lightweight HTTP-only smoke when Chromium system libs are missing (local dev). */
  async function httpOnlySmoke() {
    let failures = 0;
    console.warn("⚠ Playwright browser failed to launch — running HTTP-only smoke.");
    console.warn("  For full UI smoke: npx playwright install --with-deps chromium");

    async function fetchText(url) {
      const res = await fetch(url);
      const text = await res.text();
      return { status: res.status, text };
    }

    const hub = await fetchText(`${base}/index.html`);
    if (hub.status !== 200 || !hub.text.includes("tools-grid")) {
      console.error(`✗ hub HTTP ${hub.status}`);
      failures += 1;
    } else {
      console.log("✓ hub (HTTP)");
    }

    for (const tool of tools) {
      const urlPath = String(tool.path || "").replace(/^\.\//, "/");
      const url = `${base}${urlPath.startsWith("/") ? urlPath : "/" + urlPath}`;
      try {
        const r = await fetchText(url);
        if (r.status !== 200) {
          console.error(`✗ ${tool.id}: HTTP ${r.status}`);
          failures += 1;
          continue;
        }
        if (!r.text.includes("<header") && !r.text.includes("<header>")) {
          console.error(`✗ ${tool.id}: no <header> in HTML`);
          failures += 1;
          continue;
        }
        if (tool.id !== "unit-converter" && !r.text.includes("tool-exports.js")) {
          console.error(`✗ ${tool.id}: tool-exports.js not included`);
          failures += 1;
          continue;
        }
        if (tool.id === "code-scanner") {
          if (!r.text.includes('class="tab-btn active" data-tab="file-tab"')) {
            console.error("✗ code-scanner: File/Paste not default in HTML");
            failures += 1;
            continue;
          }
        }
        console.log(`✓ ${tool.id} (HTTP)`);
      } catch (e) {
        console.error(`✗ ${tool.id}: ${e.message || e}`);
        failures += 1;
      }
    }
    return failures;
  }

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: !HEADED });
  } catch (launchErr) {
    const msg = String(launchErr && launchErr.message ? launchErr.message : launchErr);
    if (/shared libraries|libnspr|cannot open shared object|Browser has been closed/i.test(msg)) {
      const failures = await httpOnlySmoke();
      if (server) await new Promise((r) => server.close(r));
      console.log("─".repeat(48));
      if (failures === 0) {
        console.log("smoke-tools: PASS (HTTP-only fallback)");
        process.exit(0);
      }
      console.error(`smoke-tools: FAIL — ${failures} failure(s)`);
      process.exit(1);
    }
    throw launchErr;
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  let failures = 0;
  const NO_EXPORT = new Set(["unit-converter"]);

  // Hub
  {
    pageErrors.length = 0;
    const res = await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!res || !res.ok()) {
      console.error(`✗ hub HTTP ${res && res.status()}`);
      failures += 1;
    } else {
      const grid = await page.locator("#tools-grid, .tools-grid").count();
      if (grid === 0) {
        console.error("✗ hub: tools grid missing");
        failures += 1;
      } else if (pageErrors.length) {
        console.error(`✗ hub pageerror: ${pageErrors[0]}`);
        failures += 1;
      } else {
        console.log("✓ hub");
      }
    }
  }

  for (const tool of tools) {
    pageErrors.length = 0;
    const urlPath = String(tool.path || "").replace(/^\.\//, "/");
    // path like ./tools/x/index.html → /tools/x/index.html
    const url = `${base}${urlPath.startsWith("/") ? urlPath : "/" + urlPath}`;

    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      if (!res || res.status() >= 400) {
        console.error(`✗ ${tool.id}: HTTP ${res && res.status()} ${url}`);
        failures += 1;
        continue;
      }

      // Allow a short settle for deferred boots (PM, ToolExports mount)
      await page.waitForTimeout(400);

      // Title / header present
      const hasHeader = (await page.locator("header").count()) > 0;
      if (!hasHeader) {
        console.error(`✗ ${tool.id}: no <header>`);
        failures += 1;
        continue;
      }

      // Uncaught exceptions
      const serious = pageErrors.filter(
        (m) =>
          !/ResizeObserver|Non-Error promise rejection|Loading chunk/i.test(m)
      );
      if (serious.length) {
        console.error(`✗ ${tool.id}: pageerror — ${serious[0]}`);
        failures += 1;
        continue;
      }

      // Export menu for tools that register it
      if (!NO_EXPORT.has(tool.id)) {
        // Wait briefly for ToolExports auto-mount
        await page.waitForTimeout(200);
        if ((await page.locator(".et-export-dropdown").count()) === 0) {
          await page.waitForTimeout(500);
        }
        const hasExport = (await page.locator(".et-export-dropdown").count()) > 0;
        if (!hasExport) {
          console.error(`✗ ${tool.id}: Export dropdown not mounted`);
          failures += 1;
          continue;
        }
        // Open menu and ensure at least one item (JSON/import etc.)
        await page.locator(".et-export-trigger").first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(150);
        const items = await page.locator(".et-export-item").count();
        // Close menu
        await page.keyboard.press("Escape").catch(() => {});
        if (items < 1) {
          console.error(`✗ ${tool.id}: Export menu has no items`);
          failures += 1;
          continue;
        }
      }

      // Tool-specific: code-scanner File/Paste default + no auto permission
      if (tool.id === "code-scanner") {
        const fileActive = await page.locator('.tab-btn.active[data-tab="file-tab"]').count();
        const cameraActive = await page.locator('.tab-btn.active[data-tab="camera-tab"]').count();
        if (fileActive !== 1 || cameraActive !== 0) {
          console.error(`✗ code-scanner: expected File/Paste default (file=${fileActive}, cam=${cameraActive})`);
          failures += 1;
          continue;
        }
        // Preview should stay hidden
        const previewVisible = await page.locator("#image-preview-container:not(.hidden)").count();
        if (previewVisible > 0) {
          console.error("✗ code-scanner: image preview visible on empty load");
          failures += 1;
          continue;
        }
      }

      console.log(`✓ ${tool.id}`);
    } catch (e) {
      console.error(`✗ ${tool.id}: ${e.message || e}`);
      failures += 1;
    }
  }

  await browser.close();
  if (server) {
    await new Promise((r) => server.close(r));
  }

  console.log("─".repeat(48));
  if (failures === 0) {
    console.log("smoke-tools: PASS");
    process.exit(0);
  }
  console.error(`smoke-tools: FAIL — ${failures} failure(s)`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
