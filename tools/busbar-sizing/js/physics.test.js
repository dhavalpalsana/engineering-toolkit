/**
 * Golden tests for busbar physics (DC resistance, SC thermal, skin, multi-bar).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const B = require("./physics.js");

const base = {
  W_mm: 100,
  T_mm: 10,
  L: 2,
  N: 1,
  span: 1,
  mat: "Cu",
  eps: 0.4,
  orient: "vertical",
  acdc: "DC",
  f: 50,
  Tamb: 40,
  dT: 50,
  V_sys: 400,
  Isc_kA: 50,
  tf: 1,
  d_mm: 50,
  cooling: "natural",
  vel: 0
};

describe("DC resistance Cu @ T_op", () => {
  it("rho and R_dc match CDA copper constants", () => {
    const r = B.runCalc(base);
    // T_op = 90°C → rho = 1.7241e-8 * (1 + 0.00393*70)
    const rho = 1.7241e-8 * (1 + 0.00393 * 70);
    const A = 0.1 * 0.01;
    assert.ok(Math.abs(r.rho_T - rho) / rho < 1e-12);
    assert.ok(Math.abs(r.R_dc - rho / A) / r.R_dc < 1e-12);
    assert.equal(r.A_mm2, 1000);
  });
});

describe("short-circuit thermal withstand IEC k", () => {
  it("I_withstand = A_mm2 * k_th / sqrt(tf)", () => {
    const r = B.runCalc({ ...base, tf: 1 });
    // 1000 mm² * 141 / 1 = 141000 A
    assert.ok(Math.abs(r.I_withstand - 141000) < 1e-6);
  });
  it("tf = 0.25 s increases withstand by 2×", () => {
    const r = B.runCalc({ ...base, tf: 0.25 });
    assert.ok(Math.abs(r.I_withstand - 141000 * 2) < 1e-3);
  });
});

describe("multi-bar derating K_N", () => {
  it("N=2 → kN=1.8", () => {
    const r = B.runCalc({ ...base, N: 2 });
    assert.equal(r.kN, 1.8);
    assert.ok(Math.abs(r.I_total - r.I_single * 1.8) < 1e-9);
  });
});

describe("skin effect", () => {
  it("DC ks = 1", () => {
    assert.equal(B.runCalc(base).ks, 1);
  });
  it("AC thick bar ks ≥ 1", () => {
    const r = B.runCalc({ ...base, acdc: "AC", f: 50, T_mm: 20 });
    assert.ok(r.ks >= 1);
  });
  it("very thin / low f → ks ≈ 1", () => {
    const sk = B.skinFactor(0.001, 2e-8, 50);
    assert.ok(sk.ks <= 1.01);
  });
});

describe("Al vs Cu resistivity", () => {
  it("Al R_dc higher than Cu same geometry", () => {
    const cu = B.runCalc(base);
    const al = B.runCalc({ ...base, mat: "Al" });
    assert.ok(al.R_dc > cu.R_dc);
    assert.ok(al.I_withstand < cu.I_withstand);
  });
});
