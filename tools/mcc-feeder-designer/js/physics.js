/**
 * MCC Feeder & Starter Sizing Calculations (pure UMD, browser + Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MccPhysics = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const physicsVersion = 1;

  // Standard Copper Ampacity table (Reference: IEC 60364-5-52, Multicore copper in conduit / tray at 30C)
  const COPPER_AMPACITIES = [
    { size: 1.5, ampacity: 17.5 },
    { size: 2.5, ampacity: 24 },
    { size: 4, ampacity: 32 },
    { size: 6, ampacity: 41 },
    { size: 10, ampacity: 57 },
    { size: 16, ampacity: 76 },
    { size: 25, ampacity: 96 },
    { size: 35, ampacity: 119 },
    { size: 50, ampacity: 144 },
    { size: 70, ampacity: 184 },
    { size: 95, ampacity: 223 },
    { size: 120, ampacity: 259 },
    { size: 150, ampacity: 299 },
    { size: 185, ampacity: 341 },
    { size: 240, ampacity: 403 },
    { size: 300, ampacity: 464 }
  ];

  // Standard Aluminum Ampacity table
  const ALUMINUM_AMPACITIES = [
    { size: 2.5, ampacity: 18.5 },
    { size: 4, ampacity: 25 },
    { size: 6, ampacity: 32 },
    { size: 10, ampacity: 44 },
    { size: 16, ampacity: 59 },
    { size: 25, ampacity: 75 },
    { size: 35, ampacity: 93 },
    { size: 50, ampacity: 112 },
    { size: 70, ampacity: 143 },
    { size: 95, ampacity: 174 },
    { size: 120, ampacity: 202 },
    { size: 150, ampacity: 233 },
    { size: 185, ampacity: 266 },
    { size: 240, ampacity: 315 },
    { size: 300, ampacity: 363 }
  ];

  // NEC Table 310.16 Ampacities (Copper, 75C termination rating)
  const NEC_COPPER_AMPACITIES = [
    { size: "14 AWG", ampacity: 15, area: 2.08 },
    { size: "12 AWG", ampacity: 20, area: 3.31 },
    { size: "10 AWG", ampacity: 30, area: 5.26 },
    { size: "8 AWG", ampacity: 50, area: 8.37 },
    { size: "6 AWG", ampacity: 65, area: 13.3 },
    { size: "4 AWG", ampacity: 85, area: 21.15 },
    { size: "3 AWG", ampacity: 100, area: 26.67 },
    { size: "2 AWG", ampacity: 115, area: 33.62 },
    { size: "1 AWG", ampacity: 130, area: 42.41 },
    { size: "1/0 AWG", ampacity: 150, area: 53.49 },
    { size: "2/0 AWG", ampacity: 175, area: 67.43 },
    { size: "3/0 AWG", ampacity: 200, area: 85.01 },
    { size: "4/0 AWG", ampacity: 230, area: 107.2 },
    { size: "250 kcmil", ampacity: 255, area: 126.7 },
    { size: "300 kcmil", ampacity: 285, area: 152.0 },
    { size: "350 kcmil", ampacity: 310, area: 177.3 },
    { size: "400 kcmil", ampacity: 335, area: 202.7 },
    { size: "500 kcmil", ampacity: 380, area: 253.4 }
  ];

  // NEC Table 310.16 Ampacities (Aluminum, 75C termination rating)
  const NEC_ALUMINUM_AMPACITIES = [
    { size: "12 AWG", ampacity: 15, area: 3.31 },
    { size: "10 AWG", ampacity: 25, area: 5.26 },
    { size: "8 AWG", ampacity: 40, area: 8.37 },
    { size: "6 AWG", ampacity: 50, area: 13.3 },
    { size: "4 AWG", ampacity: 65, area: 21.15 },
    { size: "3 AWG", ampacity: 75, area: 26.67 },
    { size: "2 AWG", ampacity: 90, area: 33.62 },
    { size: "1 AWG", ampacity: 100, area: 42.41 },
    { size: "1/0 AWG", ampacity: 120, area: 53.49 },
    { size: "2/0 AWG", ampacity: 135, area: 67.43 },
    { size: "3/0 AWG", ampacity: 155, area: 85.01 },
    { size: "4/0 AWG", ampacity: 180, area: 107.2 },
    { size: "250 kcmil", ampacity: 205, area: 126.7 },
    { size: "300 kcmil", ampacity: 230, area: 152.0 },
    { size: "350 kcmil", ampacity: 250, area: 177.3 },
    { size: "400 kcmil", ampacity: 270, area: 202.7 },
    { size: "500 kcmil", ampacity: 310, area: 253.4 }
  ];

  // Standard Breaker Frame/Trip ratings
  const BREAKER_RATINGS = [15, 20, 25, 30, 40, 50, 63, 80, 100, 125, 160, 200, 225, 250, 315, 400, 500, 630, 800];

  // Standard VFD Output Current ratings (Typical 400V Class)
  const VFD_RATINGS = [
    { rating: 4, power: 1.5 },
    { rating: 7.5, power: 3.0 },
    { rating: 12, power: 5.5 },
    { rating: 17, power: 7.5 },
    { rating: 25, power: 11.0 },
    { rating: 32, power: 15.0 },
    { rating: 38, power: 18.5 },
    { rating: 45, power: 22.0 },
    { rating: 60, power: 30.0 },
    { rating: 75, power: 37.0 },
    { rating: 90, power: 45.0 },
    { rating: 110, power: 55.0 },
    { rating: 145, power: 75.0 },
    { rating: 180, power: 90.0 },
    { rating: 220, power: 110.0 },
    { rating: 250, power: 132.0 },
    { rating: 305, power: 160.0 }
  ];

  // Standard Contactor Sizing (Typical AC-3 current ratings)
  const CONTACTOR_RATINGS = [9, 12, 18, 25, 32, 40, 50, 65, 80, 95, 115, 150, 185, 225, 265, 330, 400, 500];

  // Standard Soft Starter ratings
  const SOFTSTARTER_RATINGS = [18, 30, 45, 60, 72, 85, 105, 145, 170, 210, 250, 300];

  /**
   * Look up NEC Table 430.250 Full-Load Current for 3-Phase AC Induction Motors.
   */
  function getNECMotorFLA(hp, voltage = 460) {
    const hpTable = {
      0.5: 1.1, 0.75: 1.6, 1: 2.1, 1.5: 3.0, 2: 3.4, 3: 4.8, 5: 7.6,
      7.5: 11.0, 10: 14.0, 15: 21.0, 20: 27.0, 25: 34.0, 30: 40.0,
      40: 52.0, 50: 65.0, 60: 77.0, 75: 96.0, 100: 124.0, 125: 156.0,
      150: 180.0, 200: 240.0
    };

    const numHp = Number(hp) || 1;
    const numV = Number(voltage) || 460;

    let baseFLA = 2.1;
    const hps = Object.keys(hpTable).map(Number).sort((a, b) => a - b);
    if (hpTable[numHp]) {
      baseFLA = hpTable[numHp];
    } else {
      let closest = hps[0];
      for (const h of hps) {
        if (Math.abs(h - numHp) < Math.abs(closest - numHp)) {
          closest = h;
        }
      }
      baseFLA = hpTable[closest] * (numHp / closest);
    }
    return baseFLA * (460 / numV);
  }

  /**
   * Calculate Full Load Amperes (FLA) for a motor under NEC or IEC standards.
   */
  function calculateMotorFLA({
    power = 15,
    unit = 'kW',
    efficiency = 90,
    pf = 0.85,
    standard = 'IEC',
    voltage = 400
  }) {
    const eff = (Number(efficiency) || 90) / 100;
    const powerFactor = Number(pf) || 0.85;
    const V = Number(voltage) || 400;

    if (standard === 'NEC') {
      let hp = Number(power) || 1;
      if (unit === 'kW') {
        hp = hp / 0.7457;
      }
      return getNECMotorFLA(hp, V);
    } else {
      let powerkW = Number(power) || 1;
      if (unit === 'HP') {
        powerkW = powerkW * 0.7457;
      }
      return (powerkW * 1000) / (Math.sqrt(3) * V * eff * powerFactor);
    }
  }

  /**
   * Breaker selection based on minimum continuous ampacity requirement.
   */
  function selectBreakerSize(amps) {
    const req = Number(amps) || 0;
    for (const b of BREAKER_RATINGS) {
      if (b >= req) return b;
    }
    return BREAKER_RATINGS[BREAKER_RATINGS.length - 1];
  }

  /**
   * Contactor size selection.
   */
  function selectContactorSize(amps) {
    const req = Number(amps) || 0;
    for (const c of CONTACTOR_RATINGS) {
      if (c >= req) return c;
    }
    return CONTACTOR_RATINGS[CONTACTOR_RATINGS.length - 1];
  }

  /**
   * Soft starter size selection.
   */
  function selectSoftStarterSize(amps) {
    const req = Number(amps) || 0;
    for (const s of SOFTSTARTER_RATINGS) {
      if (s >= req) return s;
    }
    return SOFTSTARTER_RATINGS[SOFTSTARTER_RATINGS.length - 1];
  }

  /**
   * VFD size selection.
   */
  function selectVfdSize(amps) {
    const req = Number(amps) || 0;
    for (const v of VFD_RATINGS) {
      if (v.rating >= req) return v.rating;
    }
    return VFD_RATINGS[VFD_RATINGS.length - 1].rating;
  }

  /**
   * VFD power loss estimation (W).
   */
  function calculateVfdLoss(vfdAmps, loadAmps, voltage = 400, pf = 0.85) {
    const kw = (Math.sqrt(3) * Number(voltage) * Number(loadAmps) * Number(pf)) / 1000;
    return kw * 1000 * 0.025 + 50;
  }

  /**
   * Temperature & grouping derating factor calculation.
   */
  function calculateDeratingFactor({
    ambientTemp = 30,
    insulation = 'XLPE',
    groupingFactor = 1.0
  }) {
    const maxTemp = insulation === 'XLPE' ? 90 : 70;
    let tempFactor = 1.0;
    if (Number(ambientTemp) > 30) {
      tempFactor = Math.sqrt((maxTemp - Number(ambientTemp)) / (maxTemp - 30));
      if (isNaN(tempFactor) || tempFactor < 0.1) tempFactor = 0.1;
    }
    return tempFactor * (Number(groupingFactor) || 1.0);
  }

  /**
   * 3-Phase voltage drop calculation.
   */
  function calculateVoltageDrop3Phase({
    loadCurrent,
    lengthM,
    wireAreaMm2,
    material = 'Cu',
    parallelRuns = 1,
    voltage = 400,
    pf = 0.85
  }) {
    const I = Number(loadCurrent) || 0;
    const L = Number(lengthM) || 0;
    const A = Math.max(0.1, Number(wireAreaMm2) || 1.5);
    const N = Math.max(1, Number(parallelRuns) || 1);
    const V = Math.max(1, Number(voltage) || 400);
    const cosPhi = Math.min(1, Math.max(0.1, Number(pf) || 0.85));
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);

    // Resistivity at ~75°C operating temp (Ohm·mm²/m)
    const rho = material === 'Cu' ? 0.0225 : 0.036;
    const R = ((rho * L) / A) / N;
    const X = (0.00008 * L) / N;

    const vdVolt = Math.sqrt(3) * I * (R * cosPhi + X * sinPhi);
    const vdPct = (vdVolt / V) * 100;

    return {
      R,
      X,
      vdVolt,
      vdPct
    };
  }

  /**
   * Heuristic estimation of cable Outer Diameter (OD) in mm based on size label.
   */
  function estimateCableOdMm(sizeLabel) {
    if (!sizeLabel) return 12;
    const s = String(sizeLabel);
    if (s.includes('AWG') || s.includes('kcmil')) {
      const match = s.match(/\d+(\/\d+)?/);
      if (!match) return 15;
      const num = parseInt(match[0], 10);
      if (s.includes('kcmil')) return 32 + num * 0.03;
      if (s.includes('/0')) return 22 + num * 2;
      return Math.max(8, 26 - num * 1.1);
    }
    const val = parseFloat(s);
    if (isNaN(val)) return 14;
    return Math.max(8, Math.round(5.5 * Math.pow(val, 0.42)));
  }

  return {
    physicsVersion,
    COPPER_AMPACITIES,
    ALUMINUM_AMPACITIES,
    NEC_COPPER_AMPACITIES,
    NEC_ALUMINUM_AMPACITIES,
    BREAKER_RATINGS,
    VFD_RATINGS,
    CONTACTOR_RATINGS,
    SOFTSTARTER_RATINGS,
    getNECMotorFLA,
    calculateMotorFLA,
    selectBreakerSize,
    selectContactorSize,
    selectSoftStarterSize,
    selectVfdSize,
    calculateVfdLoss,
    calculateDeratingFactor,
    calculateVoltageDrop3Phase,
    estimateCableOdMm
  };
});
