#!/usr/bin/env node
/**
 * Structural / contract checks for Engineering Toolkit.
 * Fast, no browser. Run: npm run check
 *
 * Validates:
 *  - tools-data.js registry vs tools/ on disk
 *  - physicsVersion, paths, live HTML files
 *  - shared script includes & order
 *  - ToolExports / projectManagerConfig contracts
 *  - no banned leftovers (units.js, img src="#")
 *  - node --check syntax on JS sources
 *  - unit tests (node --test + legacy drafting runners)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fileExists,
  listToolDirs,
  liveTools,
  loadToolsData,
  readText,
  toolDirOnDisk,
  toolIndexPath
} from "./lib/tools-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REQUIRED_SCRIPTS = [
  "tools-data.js",
  "tool-shell.js",
  "tool-exports.js",
  "project-manager.js"
];

// Tools that intentionally skip cloud PM / export chrome
const NO_EXPORT_REGISTER = new Set(["unit-converter"]);
const NO_PM_CONFIG = new Set(["unit-converter"]); // still may load PM for auth only

// Standard packaging: tools/<id>/{index.html, app.js, style.css}
// style.css may be deferred for a few tools that still embed CSS in HTML (warn only).
const PACKAGING_CSS_WARN_OK = new Set(["fishbone-diagram", "wire-gauge"]);

let failures = 0;
let warnings = 0;

function fail(msg) {
  failures += 1;
  console.error(`  ✗ ${msg}`);
}

function warn(msg) {
  warnings += 1;
  console.warn(`  ⚠ ${msg}`);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function section(title) {
  console.log(`\n▸ ${title}`);
}

function scriptOrderOk(html, scripts) {
  // scripts: ordered basenames that must appear in order when present
  let last = -1;
  for (const name of scripts) {
    const idx = html.indexOf(name);
    if (idx === -1) return { ok: false, missing: name };
    if (idx < last) return { ok: false, order: name };
    last = idx;
  }
  return { ok: true };
}

function collectJsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      collectJsFiles(p, acc);
    } else if (ent.name.endsWith(".js") && !ent.name.endsWith(".min.js")) {
      acc.push(p);
    }
  }
  return acc;
}

// ── 1. Registry integrity ──────────────────────────────────────
section("Registry (tools-data.js)");

let registry;
try {
  registry = loadToolsData(ROOT);
  ok(`Loaded ${registry.length} tools from registry`);
} catch (e) {
  fail(e.message);
  process.exit(1);
}

const live = liveTools(registry);
const comingSoon = registry.filter((t) => t.status === "coming-soon");
ok(`${live.length} live (active/beta), ${comingSoon.length} coming-soon`);

const diskDirs = listToolDirs(ROOT);
const regIds = new Set(registry.map((t) => t.id));

for (const tool of live) {
  const idx = toolIndexPath(ROOT, tool);
  if (!fileExists(idx)) {
    fail(`Live tool "${tool.id}" missing file: ${path.relative(ROOT, idx)}`);
  }
  if (tool.physicsVersion == null || Number.isNaN(Number(tool.physicsVersion))) {
    fail(`Live tool "${tool.id}" missing physicsVersion`);
  }
  if (!tool.path || !String(tool.path).includes(`/tools/${tool.id}/`)) {
    warn(`Tool "${tool.id}" path looks unusual: ${tool.path}`);
  }
}

for (const dir of diskDirs) {
  const indexHtml = path.join(ROOT, "tools", dir, "index.html");
  if (fileExists(indexHtml) && !regIds.has(dir)) {
    warn(`Disk tool "${dir}" has index.html but is not in tools-data.js`);
  }
}

for (const id of regIds) {
  if (!diskDirs.includes(id) && live.some((t) => t.id === id)) {
    fail(`Registry live tool "${id}" has no tools/${id}/ directory`);
  }
}

if (fileExists(path.join(ROOT, "js", "units.js"))) {
  fail("js/units.js should not exist (feature removed)");
} else {
  ok("No js/units.js leftover");
}

if (!fileExists(path.join(ROOT, "js", "tool-exports.js"))) {
  fail("js/tool-exports.js missing");
} else {
  ok("js/tool-exports.js present");
}

// ── 2. Per-tool HTML contracts ─────────────────────────────────
section("Tool page contracts");

for (const tool of live) {
  const idx = toolIndexPath(ROOT, tool);
  if (!fileExists(idx)) continue;
  const html = readText(idx);
  const rel = path.relative(ROOT, idx);
  const label = tool.id;
  const dir = toolDirOnDisk(ROOT, label);

  // Packaging scaffold: index.html + app.js + style.css
  const appJsPath = path.join(dir, "app.js");
  const stylePath = path.join(dir, "style.css");
  if (!fileExists(appJsPath)) {
    fail(`${label}: missing app.js (standard package is index.html + app.js + style.css)`);
  }
  if (!fileExists(stylePath)) {
    if (PACKAGING_CSS_WARN_OK.has(label)) {
      warn(`${label}: missing style.css (CSS still embedded in HTML — migrate when touching the tool)`);
    } else {
      fail(`${label}: missing style.css (standard package is index.html + app.js + style.css)`);
    }
  }

  // Theme stack
  for (const sheet of ["theme.css", "header.css", "tool-shell.css"]) {
    if (!html.includes(sheet)) {
      fail(`${label}: missing stylesheet "${sheet}" in ${rel}`);
    }
  }
  if (fileExists(stylePath) && !html.includes("style.css") && !html.includes("./style.css")) {
    // allow href="style.css"
    if (!/href=["'][^"']*style\.css["']/.test(html)) {
      warn(`${label}: style.css exists but is not linked from index.html`);
    }
  }

  // Required shared scripts
  for (const script of REQUIRED_SCRIPTS) {
    if (!html.includes(script)) {
      if (label === "unit-converter" && script === "tool-exports.js") {
        // optional for unit-converter (no cloud export menu)
        continue;
      }
      fail(`${label}: missing script include "${script}" in ${rel}`);
    }
  }

  const order = scriptOrderOk(html, [
    "tools-data.js",
    "tool-shell.js",
    "tool-exports.js",
    "project-manager.js"
  ]);
  if (!order.ok) {
    if (order.missing) {
      // already reported missing
    } else if (order.order) {
      fail(`${label}: script order wrong around "${order.order}" (expected tools-data → tool-shell → tool-exports → project-manager)`);
    }
  }

  // Ban broken placeholder images
  if (/<img[^>]+src=["']#["']/i.test(html)) {
    fail(`${label}: contains <img src="#"> (broken-image placeholder)`);
  }

  // Auth button host for PM injection
  if (!html.includes('id="auth-btn"') && !html.includes("id='auth-btn'")) {
    warn(`${label}: no #auth-btn (Project Manager cannot inject Save/Open)`);
  }

  // ToolExports.register for tools that export
  if (!NO_EXPORT_REGISTER.has(label)) {
    const appJs = path.join(toolDirOnDisk(ROOT, label), "app.js");
    const sources = [html];
    if (fileExists(appJs)) sources.push(readText(appJs));
    const joined = sources.join("\n");
    if (!joined.includes("ToolExports.register")) {
      fail(`${label}: no ToolExports.register (export menu not wired)`);
    }
  }

  // projectManagerConfig for tools that save projects
  if (!NO_PM_CONFIG.has(label)) {
    const appJs = path.join(dir, "app.js");
    const sources = [html];
    if (fileExists(appJs)) sources.push(readText(appJs));
    const joined = sources.join("\n");
    if (!joined.includes("projectManagerConfig")) {
      fail(`${label}: no projectManagerConfig`);
    } else if (!joined.includes(`toolId: "${label}"`) && !joined.includes(`toolId: '${label}'`)) {
      if (!new RegExp(`toolId:\\s*["']${label}["']`).test(joined)) {
        fail(`${label}: projectManagerConfig.toolId does not match folder id`);
      }
    }
  }

  // Physics golden modules: if tools/<id>/js/*.js pure engines exist (non-test), expect a sibling *.test.js
  const jsDir = path.join(dir, "js");
  if (fs.existsSync(jsDir)) {
    for (const ent of fs.readdirSync(jsDir, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith(".js") || ent.name.endsWith(".test.js")) continue;
      const base = ent.name.replace(/\.js$/, "");
      const testPath = path.join(jsDir, `${base}.test.js`);
      // drafting solver/dxf use non-node:test runners still named *.test.js
      if (!fileExists(testPath)) {
        // allow db.js, renderer.js etc. without tests
        const src = readText(path.join(jsDir, ent.name));
        const looksPure =
          src.includes("module.exports") ||
          /root\.\w+\s*=\s*factory/.test(src) ||
          src.includes("physicsVersion");
        if (looksPure && /Physics|Fea|Scoring|Convert|solve|runCalc/.test(src + ent.name)) {
          warn(`${label}: pure module js/${ent.name} has no ${base}.test.js golden tests`);
        }
      }
    }
  }
}

// ── 2b. Site version file ─────────────────────────────────────
section("Versioning");
const versionPath = path.join(ROOT, "version.json");
if (!fileExists(versionPath)) {
  fail("version.json missing at repo root");
} else {
  try {
    const v = JSON.parse(readText(versionPath));
    if (v.version == null || String(v.version).trim() === "") {
      fail("version.json missing non-empty \"version\" field");
    } else {
      ok(`version.json → ${v.version}`);
    }
  } catch (e) {
    fail(`version.json invalid JSON: ${e.message}`);
  }
}

// Code-scanner specific: File/Paste default, no camera on load
section("Code-scanner camera policy");
{
  const htmlPath = path.join(ROOT, "tools", "code-scanner", "index.html");
  const appPath = path.join(ROOT, "tools", "code-scanner", "app.js");
  if (fileExists(htmlPath) && fileExists(appPath)) {
    const html = readText(htmlPath);
    const app = readText(appPath);

    const fileDefault =
      html.includes('class="tab-btn active" data-tab="file-tab"') ||
      html.includes('data-tab="file-tab" class="tab-btn active"');
    const cameraDefault =
      html.includes('class="tab-btn active" data-tab="camera-tab"') ||
      html.includes('data-tab="camera-tab" class="tab-btn active"');

    if (fileDefault && !cameraDefault) ok("code-scanner: File/Paste is default tab");
    else if (cameraDefault) fail("code-scanner: Live Camera is still the default tab");
    else fail("code-scanner: could not determine default tab");

    if (app.includes("initCameras()")) {
      fail("code-scanner: initCameras() still called (would probe camera on load)");
    } else {
      ok("code-scanner: no initCameras() on load");
    }

    if (/^\s*Html5Qrcode\.getCameras/m.test(app)) {
      fail("code-scanner: top-level Html5Qrcode.getCameras call");
    } else {
      ok("code-scanner: getCameras only on demand");
    }

    if (/src=["']#["']/.test(html)) fail('code-scanner: img src="#" still present');
    else ok('code-scanner: no broken img src="#"');
  }
}

// ── 3. Syntax check ────────────────────────────────────────────
section("JavaScript syntax (node --check)");

const jsFiles = [
  ...collectJsFiles(path.join(ROOT, "js")),
  ...collectJsFiles(path.join(ROOT, "tools"))
].filter((f) => !f.includes("node_modules"));

let syntaxFails = 0;
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) {
    syntaxFails += 1;
    fail(`syntax ${path.relative(ROOT, f)}: ${(r.stderr || r.stdout || "").trim()}`);
  }
}
if (syntaxFails === 0) ok(`${jsFiles.length} JS files parse cleanly`);

// ── 4. Unit tests ──────────────────────────────────────────────
section("Unit tests");

const nodeTestFiles = [];
function findTests(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") findTests(p);
    else if (ent.name.endsWith(".test.js")) nodeTestFiles.push(p);
  }
}
findTests(path.join(ROOT, "tools"));
findTests(path.join(ROOT, "js"));
findTests(path.join(ROOT, "scripts"));

// Prefer node --test for files that use node:test; run others as plain scripts
const nodeTestRunner = [];
const legacyRunners = [];
for (const f of nodeTestFiles) {
  const src = readText(f);
  if (src.includes("node:test") || src.includes("node:assert")) {
    nodeTestRunner.push(f);
  } else {
    legacyRunners.push(f);
  }
}

if (nodeTestRunner.length) {
  const r = spawnSync(process.execPath, ["--test", ...nodeTestRunner], {
    cwd: ROOT,
    encoding: "utf8"
  });
  if (r.status !== 0) {
    fail(`node --test failed:\n${r.stdout}\n${r.stderr}`);
  } else {
    ok(`node --test: ${nodeTestRunner.length} file(s) passed`);
  }
}

for (const f of legacyRunners) {
  const r = spawnSync(process.execPath, [f], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    fail(`legacy test ${path.relative(ROOT, f)} failed:\n${r.stdout}\n${r.stderr}`);
  } else {
    ok(`legacy test ${path.relative(ROOT, f)}`);
  }
}

// ── Summary ────────────────────────────────────────────────────
console.log("\n" + "─".repeat(48));
if (failures === 0) {
  console.log(`check-site: PASS (${warnings} warning(s))`);
  process.exit(0);
} else {
  console.error(`check-site: FAIL — ${failures} error(s), ${warnings} warning(s)`);
  process.exit(1);
}
