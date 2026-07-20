/**
 * Busbar capacity pure engine (CDA / IEC 60865-style).
 * Pure inputs object — no DOM. Browser + Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BusbarPhysics = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAT = {
    Cu: {
      name: "Copper HC",
      rho20: 1.7241e-8,
      alpha: 0.00393,
      density: 8890,
      E: 117e9,
      sigma_y: 250e6,
      k_th: 141,
      mu_r: 1.0
    },
    Al: {
      name: "Aluminium 1350-H19",
      rho20: 2.8264e-8,
      alpha: 0.00403,
      density: 2700,
      E: 70e9,
      sigma_y: 165e6,
      k_th: 86,
      mu_r: 1.0
    }
  };

  const MU0 = 4 * Math.PI * 1e-7;
  const SIGMA_SB = 5.67e-8;
  const KAPPA = 1.8;
  const K_N = { 1: 1.0, 2: 1.8, 3: 2.5, 4: 3.2 };

  function skinFactor(T_m, rho, f) {
    const mu = MU0;
    const delta = Math.sqrt(rho / (Math.PI * f * mu));
    const u = T_m / 2 / delta;
    if (u < 0.05) return { ks: 1.0, delta_mm: delta * 1000 };
    const two_u = 2 * u;
    const s = Math.sinh(two_u);
    const si = Math.sin(two_u);
    const c = Math.cosh(two_u);
    const co = Math.cos(two_u);
    const denom = c - co;
    const ks = denom < 1e-12 ? 1.0 : (u * (s + si)) / denom;
    return { ks: Math.max(1.0, ks), delta_mm: delta * 1000 };
  }

  /**
   * @param {object} inp SI-friendly UI fields:
   * W_mm, T_mm, L, N, span, mat, eps, orient, acdc, f, Tamb, dT, V_sys, Isc_kA, tf, d_mm, cooling, vel
   */
  function runCalc(inp) {
    const W_mm = Number(inp.W_mm);
    const T_mm = Number(inp.T_mm);
    const L = Number(inp.L);
    const N = parseInt(inp.N, 10);
    const span = Number(inp.span);
    const mat = inp.mat || "Cu";
    const eps = Number(inp.eps);
    const orient = inp.orient || "vertical";
    const acdc = inp.acdc || "DC";
    const f = Number(inp.f) || 50;
    const Tamb = Number(inp.Tamb);
    const dT = Number(inp.dT);
    const V_sys = Number(inp.V_sys);
    const Isc_kA = Number(inp.Isc_kA);
    const tf = Number(inp.tf);
    const d_mm = Number(inp.d_mm);
    const cooling = inp.cooling || "natural";
    const vel = Number(inp.vel) || 0;

    const M = MAT[mat] || MAT.Cu;
    const W_m = W_mm * 1e-3;
    const T_m = T_mm * 1e-3;
    const A_m2 = W_m * T_m;
    const A_mm2 = W_mm * T_mm;
    const d_m = d_mm * 1e-3;
    const T_op = Tamb + dT;

    const rho_T = M.rho20 * (1 + M.alpha * (T_op - 20));
    const R_dc = rho_T / A_m2;
    const weight_pm = M.density * A_m2;

    let ks = 1.0;
    let delta_mm = 999;
    if (acdc === "AC") {
      const sk = skinFactor(T_m, rho_T, f);
      ks = sk.ks;
      delta_mm = sk.delta_mm;
    }
    const R_ac = R_dc * ks;

    const P = 2 * (W_m + T_m);
    const T_bar_K = T_op + 273.15;
    const T_amb_K = Tamb + 273.15;

    let Q_conv;
    let h_forced = 0;
    if (cooling === "forced") {
      if (vel <= 5.0) h_forced = 5.6 + 3.8 * vel;
      else h_forced = 7.2 * Math.pow(vel, 0.78);
      Q_conv = h_forced * P * dT;
    } else {
      const cv_factor = orient === "vertical" ? 1.71 : 1.21;
      Q_conv = cv_factor * Math.pow(P, 0.75) * Math.pow(dT, 1.25);
    }

    const Q_rad = SIGMA_SB * eps * P * (Math.pow(T_bar_K, 4) - Math.pow(T_amb_K, 4));
    const Q_total = Q_conv + Q_rad;
    const I_single = Math.sqrt(Q_total / R_ac);

    const kN = K_N[N] || 1.0;
    const I_total = I_single * kN;

    const Isc_A = Isc_kA * 1e3;
    const I_withstand = (A_mm2 * M.k_th) / Math.sqrt(tf);
    const sc_margin = (I_withstand / Isc_A - 1) * 100;
    const i_peak = KAPPA * Math.sqrt(2) * Isc_A;
    const Fem_pm = (2e-7 * Math.pow(i_peak, 2)) / d_m;

    const w_em = Fem_pm;
    let I_2nd;
    let c_fiber;
    if (orient === "vertical") {
      I_2nd = (W_m * Math.pow(T_m, 3)) / 12;
      c_fiber = T_m / 2;
    } else {
      I_2nd = (T_m * Math.pow(W_m, 3)) / 12;
      c_fiber = W_m / 2;
    }

    const EI = M.E * I_2nd;
    const delta_max = (5 * w_em * Math.pow(span, 4)) / (384 * EI);
    const delta_mm_defl = delta_max * 1000;
    const M_bend = (w_em * Math.pow(span, 2)) / 8;
    const sigma_bend = (M_bend * c_fiber) / I_2nd;
    const sigma_bend_MPa = sigma_bend / 1e6;
    const stress_ratio = sigma_bend / M.sigma_y;

    const dV_total = I_total * R_ac * L;
    const dV_mpm = I_total * R_ac * 1000;
    const dV_pct = (dV_total / V_sys) * 100;

    return {
      W_mm,
      T_mm,
      L,
      N,
      span,
      mat,
      eps,
      orient,
      acdc,
      f,
      Tamb,
      dT,
      V_sys,
      Isc_kA,
      tf,
      d_mm,
      cooling,
      vel,
      h_forced,
      M,
      A_mm2,
      weight_pm,
      R_dc,
      ks,
      delta_mm,
      R_ac,
      Q_conv,
      Q_rad,
      Q_total,
      I_single,
      kN,
      I_total,
      I_withstand,
      sc_margin,
      i_peak,
      Fem_pm,
      w_em,
      delta_mm_defl,
      sigma_bend_MPa,
      stress_ratio,
      dV_total,
      dV_mpm,
      dV_pct,
      T_op,
      rho_T
    };
  }

  return { MAT, MU0, SIGMA_SB, KAPPA, K_N, skinFactor, runCalc };
});
