const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const M = require("./mask.js");

describe("PlotMask", () => {
  it("box add and erase", () => {
    const m = M.create(20, 20, 0);
    M.box(m, 2, 2, 8, 8, "add");
    assert.equal(M.getPixel(m, 5, 5), 255);
    assert.equal(M.getPixel(m, 0, 0), 0);
    M.box(m, 4, 4, 6, 6, "erase");
    assert.equal(M.getPixel(m, 5, 5), 0);
  });
  it("brush", () => {
    const m = M.create(30, 30, 0);
    M.brush(m, 15, 15, 3, "add");
    assert.equal(M.getPixel(m, 15, 15), 255);
  });
  it("base64 round-trip", () => {
    const m = M.create(4, 4, 0);
    M.setPixel(m, 1, 1, 1);
    const b64 = M.toBase64(m);
    const m2 = M.fromBase64(4, 4, b64);
    assert.equal(M.getPixel(m2, 1, 1), 255);
  });
});
