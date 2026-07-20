/**
 * Unit conversion pure helpers (browser + Node).
 * Linear: value * (from.factor / to.factor) where factor is multiplier to SI base.
 * Temperature: via toBase/fromBase (°C base).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.UnitConvert = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TEMP_UNITS = {
    C: { symbol: "°C", toBase: (v) => v, fromBase: (v) => v },
    F: { symbol: "°F", toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
    K: { symbol: "K", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    R: { symbol: "°R", toBase: (v) => (v - 491.67) * 5 / 9, fromBase: (v) => (v + 273.15) * 9 / 5 }
  };

  /** Golden linear factors (to SI base) used in tests + shared with UI where helpful. */
  const LINEAR_GOLDEN = {
    // pressure → Pa
    pressure: {
      Pa: 1,
      kPa: 1e3,
      MPa: 1e6,
      bar: 1e5,
      psi: 6894.757,
      atm: 101325
    },
    // length → m
    length: {
      m: 1,
      mm: 1e-3,
      cm: 1e-2,
      km: 1e3,
      in: 0.0254,
      ft: 0.3048
    },
    // torque → N·m
    torque: {
      "N·m": 1,
      "N.m": 1,
      "lbf·ft": 1.355818,
      "lbf·in": 0.112985
    }
  };

  function convertLinear(value, fromFactor, toFactor) {
    return value * (fromFactor / toFactor);
  }

  function convertValue(value, fromUnit, toUnit, cat) {
    if (cat && cat.isTemperature) {
      return toUnit.fromBase(fromUnit.toBase(value));
    }
    return value * (fromUnit.factor / toUnit.factor);
  }

  function convertTemperature(value, fromKey, toKey) {
    const f = TEMP_UNITS[fromKey];
    const t = TEMP_UNITS[toKey];
    if (!f || !t) throw new Error("Unknown temperature unit");
    return t.fromBase(f.toBase(value));
  }

  function convertByGolden(category, value, fromSym, toSym) {
    const table = LINEAR_GOLDEN[category];
    if (!table) throw new Error("Unknown category " + category);
    const ff = table[fromSym];
    const tf = table[toSym];
    if (ff == null || tf == null) throw new Error("Unknown symbols");
    return convertLinear(value, ff, tf);
  }

  return {
    TEMP_UNITS,
    LINEAR_GOLDEN,
    convertLinear,
    convertValue,
    convertTemperature,
    convertByGolden
  };
});
