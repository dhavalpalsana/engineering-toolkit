const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const P = require("./plot-math.js");

describe("parseTimeToSeconds", () => {
  it("plain seconds", () => assert.equal(P.parseTimeToSeconds("10").seconds, 10));
  it("5min", () => assert.equal(P.parseTimeToSeconds("5min").seconds, 300));
  it("1:30", () => assert.equal(P.parseTimeToSeconds("1:30").seconds, 90));
  it("ISO absolute", () => {
    const r = P.parseTimeToSeconds("2020-01-01T00:00:00.000Z");
    assert.equal(r.absolute, true);
    assert.equal(r.seconds, Date.parse("2020-01-01T00:00:00.000Z") / 1000);
  });
});

describe("scale transforms", () => {
  it("log mid 1..100 → 10", () => {
    const lin = P.toLinearSpace(10, "log");
    assert.ok(Math.abs(lin - 1) < 1e-12);
    assert.ok(Math.abs(P.fromLinearSpace(1, "log") - 10) < 1e-12);
  });
  it("ln mid e^0..e^2", () => {
    assert.ok(Math.abs(P.fromLinearSpace(1, "ln") - Math.E) < 1e-12);
  });
  it("reciprocal", () => {
    assert.ok(Math.abs(P.toLinearSpace(2, "reciprocal") - 0.5) < 1e-12);
    assert.ok(Math.abs(P.fromLinearSpace(0.5, "reciprocal") - 2) < 1e-12);
  });
});

describe("pixelToMath with ln/reciprocal", () => {
  const cal = {
    x1: { px: 0, py: 100 }, x2: { px: 100, py: 100 },
    y1: { px: 0, py: 100 }, y2: { px: 0, py: 0 }
  };
  it("linear mid", () => {
    const m = P.pixelToMath({ px: 50, py: 50, cal, scaleX: "linear", scaleY: "linear", x1Val: 0, x2Val: 10, y1Val: 0, y2Val: 20 });
    assert.ok(Math.abs(m.x - 5) < 1e-9);
    assert.ok(Math.abs(m.y - 10) < 1e-9);
  });
  it("log X", () => {
    const m = P.pixelToMath({ px: 50, py: 100, cal, scaleX: "log", scaleY: "linear", x1Val: 1, x2Val: 100, y1Val: 0, y2Val: 1 });
    assert.ok(Math.abs(m.x - 10) < 1e-9);
  });
});
