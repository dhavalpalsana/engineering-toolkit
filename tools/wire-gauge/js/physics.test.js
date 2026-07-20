/**
 * Golden tests for cable resistivity and thermal iteration.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const W = require("./physics.js");

describe("resistivityAtTemp", () => {
  it("Cu @ 20°C = rho20", () => {
    assert.equal(W.resistivityAtTemp("copper", 20), 1.72e-8);
  });
  it("Cu @ 70°C increases by alpha·ΔT", () => {
    const rho = W.resistivityAtTemp("copper", 70);
    const expected = 1.72e-8 * (1 + 0.00393 * 50);
    assert.ok(Math.abs(rho - expected) / expected < 1e-12);
  });
  it("Al higher than Cu at same temp", () => {
    assert.ok(W.resistivityAtTemp("aluminum", 20) > W.resistivityAtTemp("copper", 20));
  });
});

describe("resistancePerMeter", () => {
  it("1 mm² Cu @ 20°C ≈ 17.2 mΩ/m", () => {
    const r = W.resistancePerMeter(1.72e-8, 1);
    assert.ok(Math.abs(r - 0.0172) < 1e-12);
  });
});

describe("solveSegmentThermal DC", () => {
  // AWG 10-ish: 5.26 mm², ~2.6 mm diam conductor, PVC k≈0.2
  const wire = {
    d_cond_mm: 2.588,
    area_mm2: 5.26,
    d_outer_mm: 4.5,
    x_mohm_per_m: 0
  };

  it("zero current → ambient temperature", () => {
    const r = W.solveSegmentThermal({
      wire,
      length_m: 10,
      current: 0,
      ambTempC: 30,
      material: "copper",
      kIns: 0.2,
      h_install: 10,
      path_multiplier: 2,
      phase: "dc"
    });
    assert.ok(Math.abs(r.tempC - 30) < 0.01);
    assert.equal(r.v_drop, 0);
  });

  it("DC voltage drop = I · R_loop for round trip", () => {
    const r = W.solveSegmentThermal({
      wire,
      length_m: 100,
      current: 20,
      ambTempC: 25,
      material: "copper",
      kIns: 0.2,
      h_install: 12,
      path_multiplier: 2,
      phase: "dc"
    });
    assert.ok(r.tempC > 25);
    assert.ok(Math.abs(r.v_drop - 20 * r.seg_R_total) < 1e-9);
    assert.ok(r.seg_R_total > 0);
  });
});
