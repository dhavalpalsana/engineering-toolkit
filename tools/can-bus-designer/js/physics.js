/**
 * CAN physical-layer helpers (pure, browser + Node).
 * Used by the harness designer diagnostics and unit tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CanPhysics = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Parallel equivalent resistance (Ω). Empty → Infinity. */
  function parallelResistance(ohmsList) {
    const vals = (ohmsList || []).map(Number).filter((r) => r > 0 && Number.isFinite(r));
    if (vals.length === 0) return Infinity;
    const sumInv = vals.reduce((s, r) => s + 1 / r, 0);
    return 1 / sumInv;
  }

  /**
   * Arbitration-phase timing (ISO 11898 simplified).
   * t_bit_ns = 1e6 / baud_kbps
   * t_budget_ns = (SP%/100) * t_bit
   * t_prop_ns = 2 * (L * τ + t_loop) + margin
   */
  function computeArbitrationTiming({
    baudKbps,
    samplePointPct,
    trunkLengthM,
    propDelayNsPerM,
    loopDelayNs,
    marginNs = 50
  }) {
    const baud = Math.max(1, Number(baudKbps) || 250);
    const sp = Math.min(95, Math.max(50, Number(samplePointPct) || 80));
    const L = Math.max(0, Number(trunkLengthM) || 0);
    const tau = Math.max(0.1, Number(propDelayNsPerM) || 5);
    const loop = Math.max(0, Number(loopDelayNs) || 0);
    const margin = Math.max(0, Number(marginNs) || 0);

    const bitTimeNs = 1e6 / baud;
    const budgetNs = (sp / 100) * bitTimeNs;
    const propNs = 2 * (L * tau + loop) + margin;
    return {
      bitTimeNs,
      budgetNs,
      propNs,
      marginNs: margin,
      ok: propNs < budgetNs,
      tight: propNs >= budgetNs * 0.8 && propNs < budgetNs
    };
  }

  function maxTrunkLengthM(baudKbps) {
    const table = {
      1000: 40,
      800: 50,
      500: 100,
      250: 250,
      125: 500,
      50: 1000,
      20: 2500,
      10: 5000
    };
    return table[baudKbps] || 40;
  }

  /** Classic CAN recommended max stub (m) by nominal kbps. */
  const STANDARD_STUB_LIMITS = {
    1000: 0.3,
    800: 0.3,
    500: 1.0,
    250: 1.5,
    125: 3.0,
    50: 6.0,
    20: 15.0,
    10: 30.0
  };

  const STANDARD_CUMULATIVE_LIMITS = {
    1000: 3.0,
    800: 3.0,
    500: 10.0,
    250: 15.0,
    125: 30.0,
    50: 60.0,
    20: 150.0,
    10: 300.0
  };

  /** CAN FD data-phase stub guidance (m) by data kbps. */
  const DATA_STUB_LIMITS = {
    1000: 0.3,
    2000: 0.2,
    4000: 0.1,
    5000: 0.08,
    8000: 0.04
  };

  const DATA_CUMULATIVE_LIMITS = {
    1000: 3.0,
    2000: 1.5,
    4000: 0.8,
    5000: 0.5,
    8000: 0.2
  };

  function maxStubLimitM(baudKbps, { canFd = false, dataBaudKbps = 2000 } = {}) {
    if (canFd) return DATA_STUB_LIMITS[dataBaudKbps] ?? STANDARD_STUB_LIMITS[baudKbps] ?? 0.3;
    return STANDARD_STUB_LIMITS[baudKbps] ?? 0.3;
  }

  /**
   * Cumulative trunk length from station spacing.
   * First station distanceFromPrev is ignored (forced 0).
   */
  function trunkLengthFromStations(stations) {
    if (!stations || !stations.length) return 0;
    let sum = 0;
    for (let i = 1; i < stations.length; i++) {
      sum += Math.max(0, Number(stations[i].distanceFromPrev) || 0);
    }
    return sum;
  }

  return {
    parallelResistance,
    computeArbitrationTiming,
    maxTrunkLengthM,
    maxStubLimitM,
    trunkLengthFromStations,
    STANDARD_STUB_LIMITS,
    STANDARD_CUMULATIVE_LIMITS,
    DATA_STUB_LIMITS,
    DATA_CUMULATIVE_LIMITS
  };
});
