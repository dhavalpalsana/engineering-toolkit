const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Proj = require("./projection.js");

describe("mercator", () => {
  it("round-trip lon/lat", () => {
    const m = Proj.lonLatToMercator(0, 0);
    const ll = Proj.mercatorToLonLat(m.x, m.y);
    assert.ok(Math.abs(ll.lon) < 1e-6);
    assert.ok(Math.abs(ll.lat) < 1e-6);
  });
});

describe("polar", () => {
  const ctx = {
    cal: { origin: { px: 100, py: 100 }, rMax: { px: 200, py: 100 } },
    values: { rMax: 10, theta0Deg: 0 }
  };
  it("point on +x axis has theta~0 and r=10", () => {
    const d = Proj.polarPixelToData(200, 100, ctx);
    assert.ok(Math.abs(d.r - 10) < 1e-6);
    assert.ok(Math.abs(d.theta) < 1e-3 || Math.abs(d.theta - 360) < 1e-3);
  });
});

describe("measures", () => {
  it("distance", () => {
    assert.ok(Math.abs(Proj.distanceXY({ x: 0, y: 0 }, { x: 3, y: 4 }) - 5) < 1e-12);
  });
  it("right angle", () => {
    const a = Proj.angleABC({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    // degenerate at same B with A origin - use proper triangle
    const ang = Proj.angleABC({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    assert.ok(Math.abs(ang - 90) < 1e-6);
  });
  it("unit square area", () => {
    const a = Proj.polygonArea([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }
    ]);
    assert.ok(Math.abs(a - 1) < 1e-12);
  });
});

describe("ternary", () => {
  const ctx = {
    cal: {
      A: { px: 50, py: 100 },
      B: { px: 150, py: 100 },
      C: { px: 100, py: 20 }
    }
  };
  it("vertex A → (1,0,0)", () => {
    const d = Proj.ternaryPixelToData(50, 100, ctx);
    assert.ok(Math.abs(d.a - 1) < 1e-6);
    assert.ok(Math.abs(d.b) < 1e-6);
    assert.ok(Math.abs(d.c) < 1e-6);
  });
});
