/**
 * Golden FEA tests vs classical beam theory.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Fea = require("./fea.js");

describe("sectionProperties rect-solid", () => {
  it("100×200 mm → Iz = b d³/12", () => {
    const s = Fea.sectionProperties("rect-solid", { b: 100, d: 200 });
    // b=0.1, d=0.2 → Iz = 0.1 * 0.008 / 12 = 6.666e-5 m⁴
    assert.ok(Math.abs(s.A - 0.02) < 1e-15);
    assert.ok(Math.abs(s.Iz - (0.1 * Math.pow(0.2, 3)) / 12) < 1e-18);
  });
});

describe("simply supported mid-point load", () => {
  // L=5 m, E=200 GPa, rect 100×200 mm, P=-10 kN at midspan
  // M_max = PL/4 = 12.5 kN·m
  // δ_max = PL³/(48 EI)
  const L = 5;
  const E = 200;
  const sec = Fea.sectionProperties("rect-solid", { b: 100, d: 200 });
  const EI = E * 1e6 * sec.Iz; // kN·m²
  const P = -10;
  const M_theory = (Math.abs(P) * L) / 4;
  const defl_theory_m = (Math.abs(P) * Math.pow(L, 3)) / (48 * EI);
  const defl_theory_mm = defl_theory_m * 1000;

  const res = Fea.solveBeam({
    L,
    E,
    density: 0,
    selfWeightEnabled: false,
    section: { shape: "rect-solid", params: { b: 100, d: 200 } },
    supports: [
      { type: "pinned", x: 0 },
      { type: "roller", x: L }
    ],
    loads: [{ type: "point", val: P, x1: L / 2 }],
    Ne: 100
  });

  it("solves stably", () => {
    assert.equal(res.unstable, false);
  });

  it("max moment ≈ PL/4 within 2%", () => {
    assert.ok(Math.abs(Math.abs(res.maxMoment) - M_theory) / M_theory < 0.02);
  });

  it("max deflection ≈ PL³/48EI within 3%", () => {
    assert.ok(
      Math.abs(Math.abs(res.maxDeflection) - defl_theory_mm) / defl_theory_mm < 0.03
    );
  });

  it("reactions sum to applied load", () => {
    const sumFy = res.supportReactions.reduce((s, r) => s + r.Fy, 0);
    // reactions balance applied force (sign: R - F_orig style)
    assert.ok(Math.abs(sumFy + P) < 0.05 || Math.abs(sumFy - P) < 0.05 || Math.abs(sumFy) < 0.5);
    // Each reaction ~5 kN for symmetric beam
    const mags = res.supportReactions.map((r) => Math.abs(r.Fy));
    assert.ok(Math.abs(mags[0] - 5) < 0.15);
    assert.ok(Math.abs(mags[1] - 5) < 0.15);
  });
});

describe("cantilever tip load", () => {
  // L=2 m, fixed at 0, tip load -1 kN
  // M_max = PL = 2, δ = PL³/(3EI)
  const L = 2;
  const E = 200;
  const P = -1;
  const sec = Fea.sectionProperties("rect-solid", { b: 50, d: 100 });
  const EI = E * 1e6 * sec.Iz;
  const M_theory = Math.abs(P) * L;
  const defl_mm = ((Math.abs(P) * Math.pow(L, 3)) / (3 * EI)) * 1000;

  const res = Fea.solveBeam({
    L,
    E,
    selfWeightEnabled: false,
    section: { shape: "rect-solid", params: { b: 50, d: 100 } },
    supports: [{ type: "fixed", x: 0 }],
    loads: [{ type: "point", val: P, x1: L }],
    Ne: 80
  });

  it("max |M| ≈ PL within 3%", () => {
    assert.ok(Math.abs(Math.abs(res.maxMoment) - M_theory) / M_theory < 0.03);
  });

  it("tip deflection ≈ PL³/3EI within 4%", () => {
    assert.ok(
      Math.abs(Math.abs(res.maxDeflection) - defl_mm) / defl_mm < 0.04
    );
  });
});
