/**
 * True Rent vs Buy model (US homes) — pure engine (browser + Node).
 *
 * Apples-to-apples wealth comparison:
 * - Same starting liquid wealth (down payment + closing costs available to both).
 * - Owner puts that into the house; renter invests it.
 * - Each month, cash-flow delta (true ownership cost − rent) is invested by the
 *   party who spends less on housing (opportunity cost / surplus reinvestment).
 * - Ownership costs include P&I, tax, insurance, HOA, maintenance, PMI, and an
 *   optional simple tax shield on interest + property tax.
 * - Terminal home sale applies selling costs against equity.
 *
 * Not tax advice or underwriting. Educational model only.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RentVsBuyPhysics = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULTS = {
    homePrice: 450000,
    downPaymentPct: 20,
    closingCostPct: 2.5,
    loanTermYears: 30,
    annualRatePct: 6.5,
    propertyTaxAnnualPct: 1.1,
    homeInsuranceAnnual: 1800,
    hoaMonthly: 0,
    maintenanceAnnualPct: 1.0,
    pmiAnnualPct: 0.55,
    pmiCancelLtv: 0.8,
    appreciationPct: 3.0,
    sellingCostPct: 6.0,
    rentMonthly: 2200,
    rentGrowthPct: 3.0,
    renterInsuranceAnnual: 240,
    securityDepositMonths: 1,
    investReturnPct: 7.0,
    marginalTaxPct: 24,
    useTaxShield: true,
    horizonYears: 10,
    inflationPct: 0
  };

  const PRESETS = {
    default: {
      label: "US default",
      description: "Typical starter single-family assumptions",
      ...DEFAULTS
    },
    coastal: {
      label: "High-cost coastal",
      description: "Higher price, rent, tax, and HOA",
      homePrice: 900000,
      downPaymentPct: 20,
      closingCostPct: 2.5,
      loanTermYears: 30,
      annualRatePct: 6.75,
      propertyTaxAnnualPct: 1.2,
      homeInsuranceAnnual: 3200,
      hoaMonthly: 350,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0.55,
      appreciationPct: 3.5,
      sellingCostPct: 6.0,
      rentMonthly: 3800,
      rentGrowthPct: 3.5,
      renterInsuranceAnnual: 300,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 32,
      useTaxShield: true,
      horizonYears: 10
    },
    midwest: {
      label: "Midwest starter",
      description: "Lower price / tax / rent",
      homePrice: 275000,
      downPaymentPct: 20,
      closingCostPct: 2.5,
      loanTermYears: 30,
      annualRatePct: 6.5,
      propertyTaxAnnualPct: 1.4,
      homeInsuranceAnnual: 1400,
      hoaMonthly: 0,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0.55,
      appreciationPct: 2.5,
      sellingCostPct: 6.0,
      rentMonthly: 1450,
      rentGrowthPct: 2.5,
      renterInsuranceAnnual: 200,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 22,
      useTaxShield: true,
      horizonYears: 10
    },
    fha: {
      label: "Low down (FHA-ish)",
      description: "3.5% down with PMI — not official FHA underwriting",
      homePrice: 400000,
      downPaymentPct: 3.5,
      closingCostPct: 2.5,
      loanTermYears: 30,
      annualRatePct: 6.75,
      propertyTaxAnnualPct: 1.1,
      homeInsuranceAnnual: 1700,
      hoaMonthly: 0,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0.85,
      appreciationPct: 3.0,
      sellingCostPct: 6.0,
      rentMonthly: 2000,
      rentGrowthPct: 3.0,
      renterInsuranceAnnual: 220,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 22,
      useTaxShield: true,
      horizonYears: 10
    }
  };

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function mergeInputs(raw) {
    const out = { ...DEFAULTS, ...(raw || {}) };
    out.homePrice = Math.max(0, num(out.homePrice, DEFAULTS.homePrice));
    out.downPaymentPct = clamp(num(out.downPaymentPct, DEFAULTS.downPaymentPct), 0, 100);
    out.closingCostPct = Math.max(0, num(out.closingCostPct, DEFAULTS.closingCostPct));
    out.loanTermYears = clamp(Math.round(num(out.loanTermYears, DEFAULTS.loanTermYears)), 1, 40);
    out.annualRatePct = Math.max(0, num(out.annualRatePct, DEFAULTS.annualRatePct));
    out.propertyTaxAnnualPct = Math.max(0, num(out.propertyTaxAnnualPct, DEFAULTS.propertyTaxAnnualPct));
    out.homeInsuranceAnnual = Math.max(0, num(out.homeInsuranceAnnual, DEFAULTS.homeInsuranceAnnual));
    out.hoaMonthly = Math.max(0, num(out.hoaMonthly, DEFAULTS.hoaMonthly));
    out.maintenanceAnnualPct = Math.max(0, num(out.maintenanceAnnualPct, DEFAULTS.maintenanceAnnualPct));
    out.pmiAnnualPct = Math.max(0, num(out.pmiAnnualPct, DEFAULTS.pmiAnnualPct));
    out.pmiCancelLtv = clamp(num(out.pmiCancelLtv, DEFAULTS.pmiCancelLtv), 0.5, 1);
    out.appreciationPct = num(out.appreciationPct, DEFAULTS.appreciationPct);
    out.sellingCostPct = Math.max(0, num(out.sellingCostPct, DEFAULTS.sellingCostPct));
    out.rentMonthly = Math.max(0, num(out.rentMonthly, DEFAULTS.rentMonthly));
    out.rentGrowthPct = num(out.rentGrowthPct, DEFAULTS.rentGrowthPct);
    out.renterInsuranceAnnual = Math.max(0, num(out.renterInsuranceAnnual, DEFAULTS.renterInsuranceAnnual));
    out.securityDepositMonths = Math.max(0, num(out.securityDepositMonths, DEFAULTS.securityDepositMonths));
    out.investReturnPct = num(out.investReturnPct, DEFAULTS.investReturnPct);
    out.marginalTaxPct = clamp(num(out.marginalTaxPct, DEFAULTS.marginalTaxPct), 0, 60);
    out.useTaxShield = out.useTaxShield === true || out.useTaxShield === "true" || out.useTaxShield === 1;
    out.horizonYears = clamp(Math.round(num(out.horizonYears, DEFAULTS.horizonYears)), 1, 40);
    out.inflationPct = num(out.inflationPct, DEFAULTS.inflationPct);
    return out;
  }

  /** Standard fixed-rate mortgage payment. */
  function monthlyMortgagePayment(principal, annualRatePct, termYears) {
    const P = Math.max(0, principal);
    const n = Math.max(1, Math.round(termYears * 12));
    const i = (annualRatePct / 100) / 12;
    if (P === 0) return 0;
    if (i === 0) return P / n;
    const f = Math.pow(1 + i, n);
    return P * (i * f) / (f - 1);
  }

  function amortizationMonth(balance, payment, monthlyRate) {
    const interest = balance * monthlyRate;
    let principal = payment - interest;
    if (principal > balance) principal = balance;
    if (principal < 0) principal = 0;
    const newBalance = Math.max(0, balance - principal);
    return { interest, principal, balance: newBalance };
  }

  /**
   * Run full horizon simulation.
   * @param {object} rawInputs
   * @returns {object} summary + yearly series + monthly (optional thin) + breakdown
   */
  function simulate(rawInputs) {
    const inp = mergeInputs(rawInputs);
    const months = inp.horizonYears * 12;
    const downPayment = inp.homePrice * (inp.downPaymentPct / 100);
    const closingCosts = inp.homePrice * (inp.closingCostPct / 100);
    const loanAmount = Math.max(0, inp.homePrice - downPayment);
    const monthlyRate = (inp.annualRatePct / 100) / 12;
    const investM = (inp.investReturnPct / 100) / 12;
    const appM = (inp.appreciationPct / 100) / 12;
    const rentGrowthM = (inp.rentGrowthPct / 100) / 12;
    const taxRate = inp.useTaxShield ? inp.marginalTaxPct / 100 : 0;
    const payment = monthlyMortgagePayment(loanAmount, inp.annualRatePct, inp.loanTermYears);
    const securityDeposit = inp.rentMonthly * inp.securityDepositMonths;

    // Starting liquid wealth allocated differently:
    // Owner: down + closing → house (owner liquid starts at 0)
    // Renter: down + closing → invested portfolio (+ holds deposit as cash)
    let balance = loanAmount;
    let homeValue = inp.homePrice;
    let rent = inp.rentMonthly;
    let ownerLiquid = 0;
    let renterPortfolio = downPayment + closingCosts;
    // Deposit sits as cash (returned at end; not invested by default)
    let renterDeposit = securityDeposit;

    let cumOwnerCash = downPayment + closingCosts;
    let cumRenterCash = securityDeposit;
    let cumInterest = 0;
    let cumPrincipal = 0;
    let cumTax = 0;
    let cumInsurance = 0;
    let cumHoa = 0;
    let cumMaint = 0;
    let cumPmi = 0;
    let cumTaxShield = 0;
    let cumRent = 0;
    let cumRenterIns = 0;
    let pmiMonths = 0;

    const yearly = [];
    let yearOwnerCash = 0;
    let yearRenterCash = 0;
    let yearInterest = 0;
    let yearPrincipal = 0;
    let yearTax = 0;
    let yearIns = 0;
    let yearHoa = 0;
    let yearMaint = 0;
    let yearPmi = 0;
    let yearShield = 0;
    let yearRent = 0;

    let breakEvenMonth = null;

    for (let m = 1; m <= months; m++) {
      // Grow assets at start of month (or end — consistent either way)
      homeValue *= 1 + appM;
      ownerLiquid *= 1 + investM;
      renterPortfolio *= 1 + investM;
      rent *= 1 + rentGrowthM;

      // Ownership costs this month (tax/ins/maint scale with home value for "true" costs)
      const propTax = (homeValue * (inp.propertyTaxAnnualPct / 100)) / 12;
      const insurance = (inp.homeInsuranceAnnual * Math.pow(1 + appM, m - 1)) / 12;
      const hoa = inp.hoaMonthly;
      const maint = (homeValue * (inp.maintenanceAnnualPct / 100)) / 12;

      let interest = 0;
      let principal = 0;
      let pAndI = 0;
      if (balance > 0.01) {
        const amort = amortizationMonth(balance, payment, monthlyRate);
        interest = amort.interest;
        principal = amort.principal;
        balance = amort.balance;
        pAndI = interest + principal;
      }

      const ltv = homeValue > 0 ? balance / homeValue : 0;
      let pmi = 0;
      if (loanAmount > 0 && ltv > inp.pmiCancelLtv && inp.downPaymentPct < 20) {
        // PMI typically quoted on original loan amount
        pmi = (loanAmount * (inp.pmiAnnualPct / 100)) / 12;
        pmiMonths += 1;
      }

      const grossOwner = pAndI + propTax + insurance + hoa + maint + pmi;
      const taxShield = (interest + propTax) * taxRate;
      const netOwner = Math.max(0, grossOwner - taxShield);

      const renterIns = inp.renterInsuranceAnnual / 12;
      const netRenter = rent + renterIns;

      // Cash spent this month
      cumOwnerCash += netOwner;
      cumRenterCash += netRenter;
      yearOwnerCash += netOwner;
      yearRenterCash += netRenter;

      cumInterest += interest;
      cumPrincipal += principal;
      cumTax += propTax;
      cumInsurance += insurance;
      cumHoa += hoa;
      cumMaint += maint;
      cumPmi += pmi;
      cumTaxShield += taxShield;
      cumRent += rent;
      cumRenterIns += renterIns;

      yearInterest += interest;
      yearPrincipal += principal;
      yearTax += propTax;
      yearIns += insurance;
      yearHoa += hoa;
      yearMaint += maint;
      yearPmi += pmi;
      yearShield += taxShield;
      yearRent += rent + renterIns;

      // Surplus reinvestment: whoever spends less invests the delta
      const delta = netOwner - netRenter; // >0 means owning costs more this month
      if (delta > 0) {
        renterPortfolio += delta;
      } else if (delta < 0) {
        ownerLiquid += -delta;
      }

      const equityMark = homeValue - balance;
      // Mark-to-market wealth (sale not forced until horizon)
      const ownerNW = equityMark + ownerLiquid;
      const renterNW = renterPortfolio + renterDeposit;

      if (breakEvenMonth == null && ownerNW >= renterNW) {
        breakEvenMonth = m;
      }

      if (m % 12 === 0) {
        const year = m / 12;
        const sellCost = homeValue * (inp.sellingCostPct / 100);
        const ownerIfSold = homeValue - sellCost - balance + ownerLiquid;
        yearly.push({
          year,
          homeValue,
          loanBalance: balance,
          equity: equityMark,
          equityAfterSell: homeValue - sellCost - balance,
          ownerLiquid,
          ownerNetWorthMark: ownerNW,
          ownerNetWorthIfSold: ownerIfSold,
          renterPortfolio,
          renterDeposit,
          renterNetWorth: renterNW,
          advantageIfSold: ownerIfSold - renterNW,
          advantageMark: ownerNW - renterNW,
          yearOwnerCash,
          yearRenterCash,
          yearInterest,
          yearPrincipal,
          yearTax,
          yearInsurance: yearIns,
          yearHoa,
          yearMaint,
          yearPmi,
          yearTaxShield: yearShield,
          yearRent,
          rentMonthly: rent,
          payment: pAndI,
          pmiMonthly: pmi,
          ltv
        });
        yearOwnerCash = yearRenterCash = 0;
        yearInterest = yearPrincipal = yearTax = yearIns = yearHoa = yearMaint = yearPmi = yearShield = yearRent = 0;
      }
    }

    // Terminal: assume owner sells at horizon
    const sellCost = homeValue * (inp.sellingCostPct / 100);
    const netSaleProceeds = homeValue - sellCost - balance;
    const ownerFinal = netSaleProceeds + ownerLiquid;
    const renterFinal = renterPortfolio + renterDeposit;
    const advantage = ownerFinal - renterFinal;

    // Break-even on "if sold" basis using yearly points
    let breakEvenYear = null;
    for (const y of yearly) {
      if (y.ownerNetWorthIfSold >= y.renterNetWorth) {
        breakEvenYear = y.year;
        break;
      }
    }

    // Year-1 monthly cash snapshot (first year average from series)
    const y1 = yearly[0];
    const ownerMonthlyY1 = y1 ? y1.yearOwnerCash / 12 : payment;
    const renterMonthlyY1 = y1 ? y1.yearRenterCash / 12 : inp.rentMonthly;

    // Cost of ownership breakdown (cumulative through horizon, gross of shield)
    const breakdown = {
      downPayment,
      closingCosts,
      interest: cumInterest,
      principal: cumPrincipal,
      propertyTax: cumTax,
      insurance: cumInsurance,
      hoa: cumHoa,
      maintenance: cumMaint,
      pmi: cumPmi,
      taxShield: cumTaxShield,
      sellingCosts: sellCost,
      rent: cumRent,
      renterInsurance: cumRenterIns,
      securityDeposit
    };

    // Sensitivity helpers use same engine
    return {
      inputs: inp,
      loanAmount,
      downPayment,
      closingCosts,
      monthlyPayment: payment,
      months,
      pmiMonths,
      final: {
        homeValue,
        loanBalance: balance,
        sellCost,
        netSaleProceeds,
        ownerLiquid,
        ownerNetWorth: ownerFinal,
        renterPortfolio,
        renterDeposit,
        renterNetWorth: renterFinal,
        advantage,
        winner: advantage > 100 ? "buy" : advantage < -100 ? "rent" : "tie",
        breakEvenYear,
        breakEvenMonthSold: breakEvenYear != null ? breakEvenYear * 12 : null,
        ownerMonthlyY1,
        renterMonthlyY1,
        cumOwnerCash,
        cumRenterCash
      },
      yearly,
      breakdown
    };
  }

  /**
   * Sensitivity grid: vary one parameter at a time around base.
   */
  function sensitivity(rawInputs, specs) {
    const base = simulate(rawInputs);
    const rows = (specs || defaultSensitivitySpecs()).map((spec) => {
      const lowIn = { ...mergeInputs(rawInputs), [spec.key]: spec.low };
      const highIn = { ...mergeInputs(rawInputs), [spec.key]: spec.high };
      const low = simulate(lowIn);
      const high = simulate(highIn);
      return {
        key: spec.key,
        label: spec.label,
        low: spec.low,
        high: spec.high,
        baseAdvantage: base.final.advantage,
        lowAdvantage: low.final.advantage,
        highAdvantage: high.final.advantage,
        lowWinner: low.final.winner,
        highWinner: high.final.winner
      };
    });
    return { baseAdvantage: base.final.advantage, rows };
  }

  function defaultSensitivitySpecs() {
    return [
      { key: "annualRatePct", label: "Mortgage rate", low: null, high: null, delta: 1 },
      { key: "appreciationPct", label: "Home appreciation", low: null, high: null, delta: 1 },
      { key: "rentGrowthPct", label: "Rent growth", low: null, high: null, delta: 1 },
      { key: "investReturnPct", label: "Investment return", low: null, high: null, delta: 1 },
      { key: "rentMonthly", label: "Monthly rent", low: null, high: null, delta: 200 }
    ];
  }

  function sensitivityAround(rawInputs) {
    const inp = mergeInputs(rawInputs);
    const specs = [
      {
        key: "annualRatePct",
        label: "Mortgage rate ±1%",
        low: Math.max(0, inp.annualRatePct - 1),
        high: inp.annualRatePct + 1
      },
      {
        key: "appreciationPct",
        label: "Appreciation ±1%",
        low: inp.appreciationPct - 1,
        high: inp.appreciationPct + 1
      },
      {
        key: "rentGrowthPct",
        label: "Rent growth ±1%",
        low: inp.rentGrowthPct - 1,
        high: inp.rentGrowthPct + 1
      },
      {
        key: "investReturnPct",
        label: "Invest return ±1%",
        low: Math.max(0, inp.investReturnPct - 1),
        high: inp.investReturnPct + 1
      },
      {
        key: "rentMonthly",
        label: "Rent ±$200",
        low: Math.max(0, inp.rentMonthly - 200),
        high: inp.rentMonthly + 200
      }
    ];
    return sensitivity(inp, specs);
  }

  /**
   * Binary search: rent that makes owner advantage ≈ 0 at horizon (if sold).
   * Higher rent → renting costs more → buy advantage rises.
   */
  function indifferentRent(rawInputs) {
    const base = mergeInputs(rawInputs);
    let lo = 0;
    let hi = Math.max(base.rentMonthly * 4, base.homePrice * 0.01, 500);
    // Expand until buy wins at hi (advantage > 0)
    for (let i = 0; i < 12; i++) {
      if (simulate({ ...base, rentMonthly: hi }).final.advantage > 0) break;
      hi *= 1.5;
    }
    // If buy still never wins, no finite indifferent rent above range
    if (simulate({ ...base, rentMonthly: hi }).final.advantage <= 0) {
      return { rentMonthly: hi, advantage: simulate({ ...base, rentMonthly: hi }).final.advantage, found: false };
    }
    // If rent already wins at lo=0 is false (buy always wins), no positive indifferent rent
    if (simulate({ ...base, rentMonthly: 0 }).final.advantage >= 0) {
      return { rentMonthly: 0, advantage: simulate({ ...base, rentMonthly: 0 }).final.advantage, found: false };
    }
    let mid = base.rentMonthly;
    for (let i = 0; i < 48; i++) {
      mid = (lo + hi) / 2;
      const adv = simulate({ ...base, rentMonthly: mid }).final.advantage;
      if (adv > 0) {
        // Buy wins → lower rent to favor renter
        hi = mid;
      } else {
        // Rent wins → raise rent
        lo = mid;
      }
    }
    const advantage = simulate({ ...base, rentMonthly: mid }).final.advantage;
    return { rentMonthly: mid, advantage, found: true };
  }

  return {
    DEFAULTS,
    PRESETS,
    mergeInputs,
    monthlyMortgagePayment,
    simulate,
    sensitivity,
    sensitivityAround,
    indifferentRent
  };
});
