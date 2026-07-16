/**
 * Unit tests for share envelope helpers (tool-exports.js).
 * Run: node --test js/tool-exports.test.js
 *
 * CommonJS so it works without "type":"module" (matches other tool tests).
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function loadToolExports() {
  const toolsDataSrc = fs.readFileSync(path.join(ROOT, "js", "tools-data.js"), "utf8");
  const toolExportsSrc = fs.readFileSync(path.join(ROOT, "js", "tool-exports.js"), "utf8");

  const getTools = new Function(`${toolsDataSrc}\n; return TOOLS_DATA;`);
  const TOOLS_DATA = getTools();

  const sandbox = {
    console,
    window: {},
    document: {
      readyState: "complete",
      addEventListener() {},
      head: { appendChild() {} },
      body: { appendChild() {}, insertBefore() {} },
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return {
          style: {},
          classList: { add() {}, remove() {}, contains() { return false; } },
          dataset: {},
          setAttribute() {},
          getAttribute() {
            return null;
          },
          appendChild() {},
          addEventListener() {},
          querySelectorAll() {
            return [];
          },
          querySelector() {
            return null;
          },
          remove() {}
        };
      }
    },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    TOOLS_DATA
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.TOOLS_DATA = TOOLS_DATA;

  sandbox.encodeShareState = function encodeShareState(obj) {
    return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
  };
  sandbox.decodeShareState = function decodeShareState(str) {
    return JSON.parse(Buffer.from(str, "base64").toString("utf8"));
  };
  sandbox.window.encodeShareState = sandbox.encodeShareState;
  sandbox.window.decodeShareState = sandbox.decodeShareState;

  vm.runInNewContext(toolExportsSrc, sandbox);
  return sandbox.window.ToolExports;
}

describe("ToolExports share envelope", () => {
  let TE;

  before(() => {
    TE = loadToolExports();
    assert.ok(TE, "ToolExports loaded");
    assert.equal(typeof TE.encodeToolShare, "function");
    assert.equal(typeof TE.decodeToolShare, "function");
  });

  it("encodes and decodes payload for the same tool", () => {
    const payload = { L: 6, E: 200 };
    const enc = TE.encodeToolShare("beam-calculator", payload);
    const res = TE.decodeToolShare(enc, "beam-calculator");
    assert.equal(res.ok, true);
    assert.deepEqual(res.payload, payload);
    assert.equal(res.warning, null);
  });

  it("accepts legacy plain state without envelope", () => {
    const legacy = Buffer.from(JSON.stringify({ L: 3 }), "utf8").toString("base64");
    const res = TE.decodeToolShare(legacy, "beam-calculator");
    assert.equal(res.ok, true);
    assert.equal(res.legacy, true);
    assert.equal(res.payload.L, 3);
  });

  it("rejects mismatched toolId", () => {
    const enc = TE.encodeToolShare("beam-calculator", { L: 1 });
    const res = TE.decodeToolShare(enc, "wire-gauge");
    assert.equal(res.ok, false);
    assert.match(res.error || "", /beam-calculator/);
  });

  it("getPhysicsVersion returns a number for known tools", () => {
    const v = TE.getPhysicsVersion("beam-calculator");
    assert.equal(typeof v, "number");
    assert.ok(v >= 1);
  });
});
