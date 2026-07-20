/**
 * Golden unit conversion tests (NIST-style factors).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const U = require("./convert.js");

describe("temperature", () => {
  it("0 °C = 32 °F", () => {
    assert.ok(Math.abs(U.convertTemperature(0, "C", "F") - 32) < 1e-9);
  });
  it("100 °C = 212 °F", () => {
    assert.ok(Math.abs(U.convertTemperature(100, "C", "F") - 212) < 1e-9);
  });
  it("0 °C = 273.15 K", () => {
    assert.ok(Math.abs(U.convertTemperature(0, "C", "K") - 273.15) < 1e-9);
  });
  it("32 °F = 0 °C", () => {
    assert.ok(Math.abs(U.convertTemperature(32, "F", "C")) < 1e-9);
  });
  it("convertValue temperature path", () => {
    const cat = { isTemperature: true };
    const C = U.TEMP_UNITS.C;
    const F = U.TEMP_UNITS.F;
    assert.ok(Math.abs(U.convertValue(25, C, F, cat) - 77) < 1e-9);
  });
});

describe("pressure", () => {
  it("1 bar = 100000 Pa", () => {
    assert.ok(Math.abs(U.convertByGolden("pressure", 1, "bar", "Pa") - 1e5) < 1e-6);
  });
  it("1 atm = 101325 Pa", () => {
    assert.equal(U.convertByGolden("pressure", 1, "atm", "Pa"), 101325);
  });
  it("14.5038 psi ≈ 1 bar", () => {
    const bar = U.convertByGolden("pressure", 14.5037738, "psi", "bar");
    assert.ok(Math.abs(bar - 1) < 1e-4);
  });
});

describe("length", () => {
  it("1 in = 25.4 mm", () => {
    const mm = U.convertByGolden("length", 1, "in", "mm");
    assert.ok(Math.abs(mm - 25.4) < 1e-9);
  });
  it("1 ft = 0.3048 m", () => {
    assert.equal(U.convertByGolden("length", 1, "ft", "m"), 0.3048);
  });
});

describe("torque", () => {
  it("1 lbf·ft ≈ 1.355818 N·m", () => {
    const nm = U.convertByGolden("torque", 1, "lbf·ft", "N·m");
    assert.ok(Math.abs(nm - 1.355818) < 1e-6);
  });
});
