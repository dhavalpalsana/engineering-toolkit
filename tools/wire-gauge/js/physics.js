/**
 * Cable thermal / electrical pure helpers (browser + Node).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WirePhysics = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MATERIALS = {
    copper: { name: "Copper (Cu)", rho20: 1.72e-8, tempCoeff: 0.00393 },
    aluminum: { name: "Aluminum (Al)", rho20: 2.82e-8, tempCoeff: 0.00403 }
  };

  function resistivityAtTemp(material, tempC) {
    const m = typeof material === "string" ? MATERIALS[material] : material;
    return m.rho20 * (1 + m.tempCoeff * (tempC - 20));
  }

  function resistancePerMeter(rho, area_mm2) {
    const area_m2 = area_mm2 * 1e-6;
    return rho / area_m2;
  }

  /**
   * Radial thermal iteration for a single segment.
   * wire: { d_cond_mm, area_mm2, d_outer_mm, x_mohm_per_m }
   */
  function solveSegmentThermal({
    wire,
    length_m,
    current,
    ambTempC,
    material,
    kIns,
    h_install,
    customThickness_mm = null,
    path_multiplier = 1,
    phase = "dc",
    powerFactor = 1
  }) {
    const mat = typeof material === "string" ? MATERIALS[material] : material;
    const d_cond_m = wire.d_cond_mm * 1e-3;
    const area_m2 = wire.area_mm2 * 1e-6;
    const d_outer_m =
      customThickness_mm != null
        ? d_cond_m + 2 * (customThickness_mm * 1e-3)
        : wire.d_outer_mm * 1e-3;

    const R_ins = Math.log(d_outer_m / d_cond_m) / (2 * Math.PI * kIns);
    const R_conv = 1 / (h_install * Math.PI * d_outer_m);
    const total_thermal_r = R_ins + R_conv;

    let curr_temp = ambTempC;
    let r_per_m = 0;
    for (let iter = 1; iter <= 10; iter++) {
      const rho = resistivityAtTemp(mat, curr_temp);
      r_per_m = rho / area_m2;
      const p_loss_m = current * current * r_per_m;
      const rise = p_loss_m * total_thermal_r;
      const nxt = ambTempC + rise;
      if (Math.abs(nxt - curr_temp) < 0.001) {
        curr_temp = nxt;
        break;
      }
      curr_temp = nxt;
    }

    const seg_R_total = r_per_m * length_m * path_multiplier;
    const x_per_m = (wire.x_mohm_per_m || 0) / 1000.0;
    const seg_X_total = x_per_m * length_m * path_multiplier;

    let v_drop = 0;
    if (phase === "dc") {
      v_drop = current * seg_R_total;
    } else {
      const theta = Math.acos(Math.min(1, Math.max(-1, powerFactor)));
      const sin_t = Math.sin(theta);
      if (phase === "single") {
        v_drop =
          2 *
          current *
          ((seg_R_total / 2) * powerFactor + (seg_X_total / 2) * sin_t);
      } else {
        v_drop =
          Math.sqrt(3) *
          current *
          (seg_R_total * powerFactor + seg_X_total * sin_t);
      }
    }

    return {
      tempC: curr_temp,
      riseK: curr_temp - ambTempC,
      r_per_m,
      seg_R_total,
      seg_X_total,
      v_drop,
      total_thermal_r
    };
  }

  return {
    MATERIALS,
    resistivityAtTemp,
    resistancePerMeter,
    solveSegmentThermal
  };
});
