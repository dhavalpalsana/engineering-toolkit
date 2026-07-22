/**
 * Shared helpers for CI scripts: load TOOLS_DATA and resolve tool paths.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} root repo root
 * @returns {Array<{id:string,name:string,path:string,status:string,physicsVersion?:number}>}
 */
export function loadToolsData(root) {
  const file = path.join(root, "js", "tools-data.js");
  const code = fs.readFileSync(file, "utf8");
  // tools-data.js is a browser script: `const TOOLS_DATA = [...]`
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${code}\n; return typeof TOOLS_DATA !== "undefined" ? TOOLS_DATA : [];`);
  const data = fn();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Failed to load TOOLS_DATA from js/tools-data.js");
  }
  return data;
}

/** Tools that ship a live page (active + beta). */
export function liveTools(registry) {
  return registry.filter((t) => t.status === "active" || t.status === "beta");
}

/**
 * Absolute filesystem path for a tool's index.html from registry path.
 * Registry paths are clean URLs: "./tools/wire-gauge/" (or legacy ".../index.html").
 */
export function toolIndexPath(root, tool) {
  let rel = String(tool.path || "").replace(/^\.\//, "");
  if (rel.endsWith("/index.html")) {
    // already file path
  } else if (rel.endsWith(".html")) {
    // other html file as-is
  } else {
    rel = rel.replace(/\/?$/, "/") + "index.html";
  }
  return path.join(root, rel);
}

/** Public URL path for a tool (always ends with /). */
export function toolPublicPath(tool) {
  let rel = String(tool.path || "").replace(/^\.\//, "");
  if (rel.endsWith("/index.html")) rel = rel.slice(0, -"index.html".length);
  else if (rel.endsWith(".html")) rel = rel.replace(/[^/]+\.html$/, "");
  if (!rel.endsWith("/")) rel += "/";
  return "/" + rel.replace(/^\//, "");
}

export function toolDirOnDisk(root, toolId) {
  return path.join(root, "tools", toolId);
}

export function listToolDirs(root) {
  const base = path.join(root, "tools");
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function readText(file) {
  return fs.readFileSync(file, "utf8");
}

export function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
