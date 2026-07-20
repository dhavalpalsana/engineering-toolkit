/**
 * Heatsink airflow / channel pure helpers (browser + Node).
 * Matches formulas used in the voxel solver's duct network.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HeatsinkPhysics = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** Hydraulic diameter of rectangular channel (m). */
  function hydraulicDiameter(width_m, height_m) {
    const w = Number(width_m);
    const h = Number(height_m);
    if (w <= 0 || h <= 0) return 0;
    return (2 * w * h) / (w + h);
  }

  /**
   * Darcy–Weisbach pressure drop (Pa).
   * Δp = f · (L/Dh) · (ρ v² / 2)
   */
  function pressureDropDarcy({ f, L, Dh, rho, v }) {
    if (!(Dh > 0)) return Infinity;
    return f * (L / Dh) * ((rho * v * v) / 2);
  }

  /** Film air density approximation used in solver: ρ = 353 / (T_film + 273.15) */
  function airDensityFilm(T_film_C) {
    return 353.0 / (Number(T_film_C) + 273.15);
  }

  /** Steady 1D conduction ΔT = q · Rth */
  function deltaTFromRth(power_W, Rth_K_per_W) {
    return Number(power_W) * Number(Rth_K_per_W);
  }

  return {
    hydraulicDiameter,
    pressureDropDarcy,
    airDensityFilm,
    deltaTFromRth
  };
});
