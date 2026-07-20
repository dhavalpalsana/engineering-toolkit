/**
 * Golden tests for heatsink channel / thermal helpers.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const H = require("./physics.js");

describe("hydraulicDiameter", () => {
  it("square 2×2 mm → 2 mm", () => {
    assert.ok(Math.abs(H.hydraulicDiameter(0.002, 0.002) - 0.002) < 1e-15);
  });
  it("wide channel 10×1 mm", () => {
    // 2*0.01*0.001/(0.011) = 0.001818...
    const dh = H.hydraulicDiameter(0.01, 0.001);
    assert.ok(Math.abs(dh - (2 * 0.01 * 0.001) / 0.011) < 1e-15);
  });
});

describe("pressureDropDarcy", () => {
  it("matches hand calc", () => {
    // f=0.04, L=0.1, Dh=0.002, rho=1.2, v=5
    // 0.04 * (0.1/0.002) * (1.2*25/2) = 0.04 * 50 * 15 = 30 Pa
    const dp = H.pressureDropDarcy({ f: 0.04, L: 0.1, Dh: 0.002, rho: 1.2, v: 5 });
    assert.ok(Math.abs(dp - 30) < 1e-9);
  });
});

describe("airDensityFilm", () => {
  it("~1.18 at ~25°C film", () => {
    const rho = H.airDensityFilm(25);
    assert.ok(Math.abs(rho - 353 / 298.15) < 1e-12);
  });
});

describe("deltaTFromRth", () => {
  it("10 W · 2 K/W = 20 K", () => {
    assert.equal(H.deltaTFromRth(10, 2), 20);
  });
});
