#!/usr/bin/env node
/**
 * Portable unit-test runner (Node 18/20/22+).
 * Discovers *.test.js without relying on node --test glob support (Node 20 CI).
 *
 * Run: node scripts/run-tests.mjs
 *      npm test
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function findTests(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      findTests(p, acc);
    } else if (ent.name.endsWith(".test.js")) {
      acc.push(p);
    }
  }
  return acc;
}

const files = [
  ...findTests(path.join(ROOT, "js")),
  ...findTests(path.join(ROOT, "tools")),
  ...findTests(path.join(ROOT, "scripts"))
].sort();

if (files.length === 0) {
  console.error("run-tests: no *.test.js files found");
  process.exit(1);
}

const nodeTest = [];
const legacy = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (src.includes("node:test") || src.includes("node:assert")) {
    nodeTest.push(f);
  } else {
    legacy.push(f);
  }
}

let failed = 0;

if (nodeTest.length) {
  console.log(`▸ node --test (${nodeTest.length} file(s))`);
  const r = spawnSync(process.execPath, ["--test", ...nodeTest], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (r.status !== 0) failed += 1;
}

for (const f of legacy) {
  const rel = path.relative(ROOT, f);
  console.log(`▸ legacy ${rel}`);
  const r = spawnSync(process.execPath, [f], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (r.status !== 0) {
    console.error(`FAIL ${rel}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`\nrun-tests: FAIL (${failed} group(s))`);
  process.exit(1);
}
console.log(`\nrun-tests: PASS (${files.length} file(s))`);
