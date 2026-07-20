/**
 * Golden tests for MOSFET loss model.
 * Hand checks: conduction I²R·D, switching ½V I (tr+tf) f, Coss ½C V² f.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const M = require("./physics.js");

const cond = { vbus: 400, iload: 10, fsw: 50, vgate: 12, tdead: 100, duty: 50 };
const device = { rdson: 50, qg: 100, tr: 20, tf: 20, qrr: 0, vsd: 0.8, coss: 200 };

describe("calculateLosses golden", () => {
  const L = M.calculateLosses(cond, device);

  it("conduction: I² · (50mΩ) · 0.5 = 2.5 W", () => {
    // 10² * 0.05 * 0.5 = 2.5
    assert.ok(Math.abs(L.p_cond - 2.5) < 1e-9);
  });

  it("switching: 0.5·400·10·(40e-9)·50e3 = 4 W", () => {
    // 0.5 * 400 * 10 * 40e-9 * 50000 = 4
    assert.ok(Math.abs(L.p_sw - 4) < 1e-9);
  });

  it("dead-time: 2·10·0.8·100e-9·50e3 = 0.08 W", () => {
    assert.ok(Math.abs(L.p_dead - 0.08) < 1e-9);
  });

  it("gate: 100nC · 12 V · 50 kHz = 0.06 W", () => {
    // 100e-9 * 12 * 50000 = 0.06
    assert.ok(Math.abs(L.p_gate - 0.06) < 1e-9);
  });

  it("Coss: 0.5 · 200pF · 400² · 50kHz = 0.8 W", () => {
    // 0.5 * 200e-12 * 160000 * 50000 = 0.8
    assert.ok(Math.abs(L.p_coss - 0.8) < 1e-9);
  });

  it("total sums components", () => {
    const sum = L.p_cond + L.p_sw + L.p_dead + L.p_rr + L.p_gate + L.p_coss;
    assert.ok(Math.abs(L.p_total - sum) < 1e-12);
    assert.ok(Math.abs(L.p_total - 7.44) < 1e-9);
  });

  it("zero current → zero conduction/switching", () => {
    const z = M.calculateLosses({ ...cond, iload: 0 }, device);
    assert.equal(z.p_cond, 0);
    assert.equal(z.p_sw, 0);
  });
});
