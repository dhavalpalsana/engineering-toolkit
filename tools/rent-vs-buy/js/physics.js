/**
 * True Rent vs Buy model (US homes) — pure engine (browser + Node).
 *
 * Apples-to-apples wealth comparison:
 * - Same starting liquid wealth at the decision point.
 * - Modes: "buy" (should I buy today?) and "own" (keep house vs sell & rent).
 * - Down / closing can be entered as % or $ (canonical dollars after merge).
 * - Optional liquid asset buckets (cash / stocks / bonds) with per-bucket returns
 *   and draw order for funding a purchase.
 * - Ownership costs include P&I, tax, insurance, HOA, maintenance, PMI, optional tax shield.
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

  const DEFAULT_BUCKETS = [
    { id: "cash", label: "Cash / HYSA", balance: 0, returnPct: 4.0, useForDown: true, order: 1 },
    { id: "stocks", label: "Brokerage stocks", balance: 0, returnPct: 8.0, useForDown: true, order: 2 },
    { id: "bonds", label: "Bonds", balance: 0, returnPct: 4.5, useForDown: false, order: 3 }
  ];

  const DEFAULTS = {
    scenarioMode: "buy", // "buy" | "own"
    homePrice: 450000,
    downPaymentPct: 20,
    downPaymentAmount: null, // if set, overrides pct when resolving
    closingCostPct: 2.5,
    closingCostAmount: null,
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
    sellingCostAmount: null,
    rentMonthly: 2200,
    rentGrowthPct: 3.0,
    renterInsuranceAnnual: 240,
    securityDepositMonths: 1,
    investReturnPct: 7.0,
    marginalTaxPct: 24,
    useTaxShield: true,
    extraMortgageMonthly: 0,
    horizonYears: 10,
    inflationPct: 2.5,
    showRealDollars: false, // when true, deflate wealth/cash series by inflationPct
    // Own mode (already own — keep vs sell & rent)
    purchasePrice: 350000,
    yearsOwned: 5,
    currentLoanBalance: 280000,
    remainingTermYears: 25,
    capitalGainsTaxPct: 0, // simple gain tax; 0 = ignore
    primaryResidenceExclusion: 250000, // applied before gains tax if tax > 0
    // Asset funding
    useAssetBuckets: false,
    assetBuckets: DEFAULT_BUCKETS.map((b) => ({ ...b }))
  };

  const PRESETS = {
    default: {
      label: "US default",
      description: "Typical starter single-family assumptions",
      ...DEFAULTS,
      assetBuckets: DEFAULT_BUCKETS.map((b) => ({ ...b }))
    },
    coastal: {
      label: "High-cost coastal",
      description: "Higher price, rent, tax, and HOA",
      homePrice: 900000,
      downPaymentPct: 20,
      downPaymentAmount: null,
      closingCostPct: 2.5,
      closingCostAmount: null,
      loanTermYears: 30,
      annualRatePct: 6.75,
      propertyTaxAnnualPct: 1.2,
      homeInsuranceAnnual: 3200,
      hoaMonthly: 350,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0.55,
      appreciationPct: 3.5,
      sellingCostPct: 6.0,
      sellingCostAmount: null,
      rentMonthly: 3800,
      rentGrowthPct: 3.5,
      renterInsuranceAnnual: 300,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 32,
      useTaxShield: true,
      horizonYears: 10,
      scenarioMode: "buy",
      useAssetBuckets: false,
      assetBuckets: DEFAULT_BUCKETS.map((b) => ({ ...b }))
    },
    midwest: {
      label: "Midwest starter",
      description: "Lower price / tax / rent",
      homePrice: 275000,
      downPaymentPct: 20,
      downPaymentAmount: null,
      closingCostPct: 2.5,
      closingCostAmount: null,
      loanTermYears: 30,
      annualRatePct: 6.5,
      propertyTaxAnnualPct: 1.4,
      homeInsuranceAnnual: 1400,
      hoaMonthly: 0,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0.55,
      appreciationPct: 2.5,
      sellingCostPct: 6.0,
      sellingCostAmount: null,
      rentMonthly: 1450,
      rentGrowthPct: 2.5,
      renterInsuranceAnnual: 200,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 22,
      useTaxShield: true,
      horizonYears: 10,
      scenarioMode: "buy",
      useAssetBuckets: false,
      assetBuckets: DEFAULT_BUCKETS.map((b) => ({ ...b }))
    },
    fha: {
      label: "Low down (FHA-ish)",
      description: "3.5% down with PMI — not official FHA underwriting",
      homePrice: 400000,
      downPaymentPct: 3.5,
      downPaymentAmount: null,
      closingCostPct: 2.5,
      closingCostAmount: null,
      loanTermYears: 30,
      annualRatePct: 6.75,
      propertyTaxAnnualPct: 1.1,
      homeInsuranceAnnual: 1700,
      hoaMonthly: 0,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0.85,
      appreciationPct: 3.0,
      sellingCostPct: 6.0,
      sellingCostAmount: null,
      rentMonthly: 2000,
      rentGrowthPct: 3.0,
      renterInsuranceAnnual: 220,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 22,
      useTaxShield: true,
      horizonYears: 10,
      scenarioMode: "buy",
      useAssetBuckets: false,
      assetBuckets: DEFAULT_BUCKETS.map((b) => ({ ...b }))
    },
    alreadyOwn: {
      label: "Already own",
      description: "Keep house vs sell & rent (illustrative mid-ownership)",
      scenarioMode: "own",
      homePrice: 520000,
      purchasePrice: 380000,
      yearsOwned: 6,
      currentLoanBalance: 290000,
      remainingTermYears: 24,
      annualRatePct: 3.75,
      propertyTaxAnnualPct: 1.1,
      homeInsuranceAnnual: 2000,
      hoaMonthly: 0,
      maintenanceAnnualPct: 1.0,
      pmiAnnualPct: 0,
      appreciationPct: 3.0,
      sellingCostPct: 6.0,
      sellingCostAmount: null,
      rentMonthly: 2600,
      rentGrowthPct: 3.0,
      renterInsuranceAnnual: 280,
      securityDepositMonths: 1,
      investReturnPct: 7.0,
      marginalTaxPct: 24,
      useTaxShield: true,
      capitalGainsTaxPct: 0,
      primaryResidenceExclusion: 250000,
      horizonYears: 10,
      downPaymentPct: 20,
      downPaymentAmount: null,
      closingCostPct: 0,
      closingCostAmount: null,
      loanTermYears: 30,
      useAssetBuckets: false,
      assetBuckets: DEFAULT_BUCKETS.map((b) => ({ ...b }))
    }
  };

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function cloneBuckets(list) {
    const src = Array.isArray(list) && list.length ? list : DEFAULT_BUCKETS;
    return src.map((b, i) => {
      const d = DEFAULT_BUCKETS[i] || DEFAULT_BUCKETS[0];
      return {
        id: String(b.id != null ? b.id : d.id),
        label: String(b.label != null ? b.label : d.label),
        balance: Math.max(0, num(b.balance, 0)),
        returnPct: num(b.returnPct, d.returnPct),
        useForDown: b.useForDown === true || b.useForDown === "true" || b.useForDown === 1,
        order: Math.round(num(b.order, d.order != null ? d.order : i + 1))
      };
    });
  }

  /**
   * Resolve a field that can be entered as percent of base or as dollars.
   * Prefer explicit amount when amountMode is "amount" or when amount is set and pct is not preferred.
   * amountMode: "pct" | "amount" | null (auto: amount if non-null number provided as preferredAmount)
   */
  function resolveMoneyPair(base, pct, amount, amountMode, defaultPct) {
    const p = num(pct, defaultPct);
    const a = amount == null || amount === "" ? null : num(amount, NaN);
    const mode = amountMode === "amount" || amountMode === "pct" ? amountMode : null;

    let dollars;
    let percent;
    if (mode === "amount" && Number.isFinite(a)) {
      dollars = Math.max(0, a);
      percent = base > 0 ? (dollars / base) * 100 : 0;
    } else if (mode === "pct" || !Number.isFinite(a)) {
      percent = clamp(p, 0, mode === "pct" ? 1e6 : 100);
      if (mode !== "pct") percent = clamp(p, 0, 100);
      dollars = base * (percent / 100);
    } else {
      // auto: finite amount provided without mode → treat as amount override
      dollars = Math.max(0, a);
      percent = base > 0 ? (dollars / base) * 100 : 0;
    }
    return { dollars, percent };
  }

  function mergeInputs(raw) {
    const out = { ...DEFAULTS, ...(raw || {}) };
    out.scenarioMode = out.scenarioMode === "own" ? "own" : "buy";
    out.homePrice = Math.max(0, num(out.homePrice, DEFAULTS.homePrice));

    const downMode = out.downPaymentMode === "amount" || out.downPaymentMode === "pct" ? out.downPaymentMode : null;
    const closeMode = out.closingCostMode === "amount" || out.closingCostMode === "pct" ? out.closingCostMode : null;
    const sellMode = out.sellingCostMode === "amount" || out.sellingCostMode === "pct" ? out.sellingCostMode : null;

    const down = resolveMoneyPair(
      out.homePrice,
      out.downPaymentPct,
      out.downPaymentAmount,
      downMode,
      DEFAULTS.downPaymentPct
    );
    // Down payment percent is always 0–100 of price
    if (downMode === "pct" || (downMode == null && (out.downPaymentAmount == null || out.downPaymentAmount === ""))) {
      out.downPaymentPct = clamp(num(out.downPaymentPct, DEFAULTS.downPaymentPct), 0, 100);
      out.downPaymentAmount = out.homePrice * (out.downPaymentPct / 100);
    } else {
      out.downPaymentAmount = Math.max(0, down.dollars);
      out.downPaymentPct = out.homePrice > 0 ? clamp((out.downPaymentAmount / out.homePrice) * 100, 0, 100) : 0;
      // Cap amount to home price
      if (out.downPaymentAmount > out.homePrice) {
        out.downPaymentAmount = out.homePrice;
        out.downPaymentPct = 100;
      }
    }
    out.downPaymentMode = downMode || "pct";

    const close = resolveMoneyPair(
      out.homePrice,
      out.closingCostPct,
      out.closingCostAmount,
      closeMode,
      DEFAULTS.closingCostPct
    );
    if (closeMode === "amount") {
      out.closingCostAmount = Math.max(0, close.dollars);
      out.closingCostPct = out.homePrice > 0 ? (out.closingCostAmount / out.homePrice) * 100 : 0;
    } else {
      out.closingCostPct = Math.max(0, num(out.closingCostPct, DEFAULTS.closingCostPct));
      out.closingCostAmount = out.homePrice * (out.closingCostPct / 100);
    }
    out.closingCostMode = closeMode || "pct";

    const sell = resolveMoneyPair(
      out.homePrice,
      out.sellingCostPct,
      out.sellingCostAmount,
      sellMode,
      DEFAULTS.sellingCostPct
    );
    if (sellMode === "amount") {
      out.sellingCostAmount = Math.max(0, sell.dollars);
      out.sellingCostPct = out.homePrice > 0 ? (out.sellingCostAmount / out.homePrice) * 100 : 0;
    } else {
      out.sellingCostPct = Math.max(0, num(out.sellingCostPct, DEFAULTS.sellingCostPct));
      out.sellingCostAmount = out.homePrice * (out.sellingCostPct / 100);
    }
    out.sellingCostMode = sellMode || "pct";

    out.loanTermYears = clamp(Math.round(num(out.loanTermYears, DEFAULTS.loanTermYears)), 1, 40);
    out.annualRatePct = Math.max(0, num(out.annualRatePct, DEFAULTS.annualRatePct));
    out.propertyTaxAnnualPct = Math.max(0, num(out.propertyTaxAnnualPct, DEFAULTS.propertyTaxAnnualPct));
    out.homeInsuranceAnnual = Math.max(0, num(out.homeInsuranceAnnual, DEFAULTS.homeInsuranceAnnual));
    out.hoaMonthly = Math.max(0, num(out.hoaMonthly, DEFAULTS.hoaMonthly));
    out.maintenanceAnnualPct = Math.max(0, num(out.maintenanceAnnualPct, DEFAULTS.maintenanceAnnualPct));
    out.pmiAnnualPct = Math.max(0, num(out.pmiAnnualPct, DEFAULTS.pmiAnnualPct));
    out.pmiCancelLtv = clamp(num(out.pmiCancelLtv, DEFAULTS.pmiCancelLtv), 0.5, 1);
    out.appreciationPct = num(out.appreciationPct, DEFAULTS.appreciationPct);
    out.rentMonthly = Math.max(0, num(out.rentMonthly, DEFAULTS.rentMonthly));
    out.rentGrowthPct = num(out.rentGrowthPct, DEFAULTS.rentGrowthPct);
    out.renterInsuranceAnnual = Math.max(0, num(out.renterInsuranceAnnual, DEFAULTS.renterInsuranceAnnual));
    out.securityDepositMonths = Math.max(0, num(out.securityDepositMonths, DEFAULTS.securityDepositMonths));
    out.investReturnPct = num(out.investReturnPct, DEFAULTS.investReturnPct);
    out.marginalTaxPct = clamp(num(out.marginalTaxPct, DEFAULTS.marginalTaxPct), 0, 60);
    out.useTaxShield = out.useTaxShield === true || out.useTaxShield === "true" || out.useTaxShield === 1;
    out.extraMortgageMonthly = Math.max(0, num(out.extraMortgageMonthly, DEFAULTS.extraMortgageMonthly));
    out.horizonYears = clamp(Math.round(num(out.horizonYears, DEFAULTS.horizonYears)), 1, 40);
    out.inflationPct = Math.max(0, num(out.inflationPct, DEFAULTS.inflationPct));
    out.showRealDollars =
      out.showRealDollars === true || out.showRealDollars === "true" || out.showRealDollars === 1;

    out.purchasePrice = Math.max(0, num(out.purchasePrice, DEFAULTS.purchasePrice));
    out.yearsOwned = Math.max(0, num(out.yearsOwned, DEFAULTS.yearsOwned));
    out.currentLoanBalance = Math.max(0, num(out.currentLoanBalance, DEFAULTS.currentLoanBalance));
    out.remainingTermYears = clamp(Math.round(num(out.remainingTermYears, DEFAULTS.remainingTermYears)), 1, 40);
    out.capitalGainsTaxPct = Math.max(0, num(out.capitalGainsTaxPct, DEFAULTS.capitalGainsTaxPct));
    out.primaryResidenceExclusion = Math.max(0, num(out.primaryResidenceExclusion, DEFAULTS.primaryResidenceExclusion));

    out.useAssetBuckets = out.useAssetBuckets === true || out.useAssetBuckets === "true" || out.useAssetBuckets === 1;
    out.assetBuckets = cloneBuckets(out.assetBuckets);

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
    return (P * (i * f)) / (f - 1);
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
   * Fund `needed` dollars from buckets marked useForDown, by order.
   * Returns { remainingBuckets, withdrawn, shortfall }.
   */
  function withdrawForPurchase(buckets, needed) {
    const remaining = buckets.map((b) => ({ ...b }));
    let left = Math.max(0, needed);
    let withdrawn = 0;
    const ordered = remaining
      .map((b, idx) => ({ b, idx }))
      .filter((x) => x.b.useForDown)
      .sort((a, b) => a.b.order - b.b.order || a.idx - b.idx);

    for (const { b } of ordered) {
      if (left <= 0) break;
      const take = Math.min(b.balance, left);
      b.balance -= take;
      left -= take;
      withdrawn += take;
    }
    return { remainingBuckets: remaining, withdrawn, shortfall: left };
  }

  function sumBalances(buckets) {
    return buckets.reduce((s, b) => s + Math.max(0, b.balance), 0);
  }

  function growBuckets(buckets) {
    for (const b of buckets) {
      const r = (b.returnPct / 100) / 12;
      b.balance *= 1 + r;
    }
  }

  function cloneBucketState(buckets) {
    return buckets.map((b) => ({ ...b }));
  }

  /**
   * Deflate nominal dollar series into today's dollars using constant inflation.
   * Both paths use the same deflator per year, so winner / break-even year are unchanged.
   */
  function applyRealDollars(result) {
    const inp = result.inputs || {};
    if (!inp.showRealDollars || !(inp.inflationPct > 0)) {
      result.display = { mode: "nominal", inflationPct: inp.inflationPct || 0 };
      return result;
    }
    const r = inp.inflationPct / 100;
    const d = (v, years) => {
      if (!Number.isFinite(v)) return v;
      return v / Math.pow(1 + r, years);
    };
    const H = inp.horizonYears || 1;

    result.yearly = (result.yearly || []).map((y) => {
      const t = y.year;
      return {
        ...y,
        homeValue: d(y.homeValue, t),
        loanBalance: d(y.loanBalance, t),
        equity: d(y.equity, t),
        equityAfterSell: d(y.equityAfterSell, t),
        ownerLiquid: d(y.ownerLiquid, t),
        ownerNetWorthMark: d(y.ownerNetWorthMark, t),
        ownerNetWorthIfSold: d(y.ownerNetWorthIfSold, t),
        loanBalanceExtra: d(y.loanBalanceExtra, t),
        ownerNetWorthMarkExtra: d(y.ownerNetWorthMarkExtra, t),
        ownerNetWorthIfSoldExtra: d(y.ownerNetWorthIfSoldExtra, t),
        renterPortfolio: d(y.renterPortfolio, t),
        renterDeposit: d(y.renterDeposit, t),
        renterNetWorth: d(y.renterNetWorth, t),
        advantageIfSold: d(y.advantageIfSold, t),
        advantageIfSoldExtra: d(y.advantageIfSoldExtra, t),
        advantageMark: d(y.advantageMark, t),
        yearOwnerCash: d(y.yearOwnerCash, t),
        yearOwnerExtraCash: d(y.yearOwnerExtraCash, t),
        yearRenterCash: d(y.yearRenterCash, t),
        yearInterest: d(y.yearInterest, t),
        yearPrincipal: d(y.yearPrincipal, t),
        yearTax: d(y.yearTax, t),
        yearInsurance: d(y.yearInsurance, t),
        yearHoa: d(y.yearHoa, t),
        yearMaint: d(y.yearMaint, t),
        yearPmi: d(y.yearPmi, t),
        yearTaxShield: d(y.yearTaxShield, t),
        yearRent: d(y.yearRent, t),
        rentMonthly: d(y.rentMonthly, t),
        payment: d(y.payment, t),
        pmiMonthly: d(y.pmiMonthly, t)
      };
    });

    const f = result.final;
    if (f) {
      f.homeValue = d(f.homeValue, H);
      f.loanBalance = d(f.loanBalance, H);
      f.sellCost = d(f.sellCost, H);
      f.netSaleProceeds = d(f.netSaleProceeds, H);
      f.ownerLiquid = d(f.ownerLiquid, H);
      f.ownerNetWorth = d(f.ownerNetWorth, H);
      f.renterPortfolio = d(f.renterPortfolio, H);
      f.renterDeposit = d(f.renterDeposit, H);
      f.renterNetWorth = d(f.renterNetWorth, H);
      f.advantage = d(f.advantage, H);
      // Year-1 cash ~ mid-year-1
      f.ownerMonthlyY1 = d(f.ownerMonthlyY1 * 12, 1) / 12;
      f.renterMonthlyY1 = d(f.renterMonthlyY1 * 12, 1) / 12;
      f.cumOwnerCash = d(f.cumOwnerCash, H / 2);
      f.cumRenterCash = d(f.cumRenterCash, H / 2);
    }
    if (result.finalExtra) {
      const fx = result.finalExtra;
      fx.homeValue = d(fx.homeValue, H);
      fx.loanBalance = d(fx.loanBalance, H);
      fx.sellCost = d(fx.sellCost, H);
      fx.ownerLiquid = d(fx.ownerLiquid, H);
      fx.ownerNetWorth = d(fx.ownerNetWorth, H);
      fx.advantage = d(fx.advantage, H);
      fx.advantageVsKeep = d(fx.advantageVsKeep, H);
      fx.cumOwnerCash = d(fx.cumOwnerCash, H / 2);
    }

    // Breakdown is multi-year cumulative — leave nominal; flag for UI
    result.display = { mode: "real", inflationPct: inp.inflationPct, breakdownNominal: true };
    return result;
  }

  /**
   * Run full horizon simulation.
   * @param {object} rawInputs
   * @returns {object} summary + yearly series + breakdown
   */
  function simulate(rawInputs) {
    const inp = mergeInputs(rawInputs);
    const result = inp.scenarioMode === "own" ? simulateOwn(inp) : simulateBuy(inp);
    return applyRealDollars(result);
  }

  function simulateBuy(inp) {
    const months = inp.horizonYears * 12;
    const downPayment = inp.downPaymentAmount;
    const closingCosts = inp.closingCostAmount;
    const loanAmount = Math.max(0, inp.homePrice - downPayment);
    const monthlyRate = (inp.annualRatePct / 100) / 12;
    const investM = (inp.investReturnPct / 100) / 12;
    const appM = (inp.appreciationPct / 100) / 12;
    const rentGrowthM = (inp.rentGrowthPct / 100) / 12;
    const taxRate = inp.useTaxShield ? inp.marginalTaxPct / 100 : 0;
    const payment = monthlyMortgagePayment(loanAmount, inp.annualRatePct, inp.loanTermYears);
    const securityDeposit = inp.rentMonthly * inp.securityDepositMonths;
    const needed = downPayment + closingCosts;

    // Liquid allocation
    let ownerBuckets;
    let renterBuckets;
    let ownerSurplus = 0; // grows at investReturnPct
    let renterSurplus = 0;
    let funding;

    if (inp.useAssetBuckets && sumBalances(inp.assetBuckets) > 0) {
      const full = cloneBucketState(inp.assetBuckets);
      funding = withdrawForPurchase(full, needed);
      ownerBuckets = funding.remainingBuckets;
      renterBuckets = cloneBucketState(inp.assetBuckets);
      // Apples-to-apples: shortfall is cash both parties "had"
      if (funding.shortfall > 0) {
        renterSurplus += funding.shortfall;
        // Owner spent shortfall on the house (not kept as liquid)
      }
      // If buckets had more than needed, renter keeps full; owner keeps residual only.
      // Extra liquid beyond house cost stays with both as residual buckets already.
    } else {
      // Classic: starting wealth = down + closing at single invest rate
      ownerBuckets = [];
      renterBuckets = [];
      ownerSurplus = 0;
      renterSurplus = needed;
      funding = { withdrawn: needed, shortfall: 0, remainingBuckets: [] };
    }

    let balance = loanAmount;
    let homeValue = inp.homePrice;
    let rent = inp.rentMonthly;
    let renterDeposit = securityDeposit;

    const extraM = inp.extraMortgageMonthly || 0;
    let balanceExtra = loanAmount;
    let keepExtraBuckets = inp.useAssetBuckets && sumBalances(inp.assetBuckets) > 0 ? cloneBucketState(funding.remainingBuckets) : [];
    let keepExtraSurplus = 0;
    let cumOwnerExtraCash = needed;
    let yearOwnerExtraCash = 0;
    let payoffMonthExtra = null;
    let cumInterestExtra = 0;
    let cumPrincipalExtra = 0;

    let cumOwnerCash = needed;
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
      homeValue *= 1 + appM;
      growBuckets(ownerBuckets);
      growBuckets(renterBuckets);
      growBuckets(keepExtraBuckets);
      ownerSurplus *= 1 + investM;
      renterSurplus *= 1 + investM;
      keepExtraSurplus *= 1 + investM;
      rent *= 1 + rentGrowthM;

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

      let interestExtra = 0;
      let principalExtra = 0;
      let pAndIExtra = 0;
      if (balanceExtra > 0.01) {
        const amortExtra = amortizationMonth(balanceExtra, payment, monthlyRate);
        interestExtra = amortExtra.interest;
        const baseP = amortExtra.principal;
        const remBal = amortExtra.balance;
        const addExtraP = Math.min(remBal, extraM);
        principalExtra = baseP + addExtraP;
        balanceExtra = Math.max(0, remBal - addExtraP);
        pAndIExtra = interestExtra + principalExtra;
        if (balanceExtra <= 0.01 && payoffMonthExtra == null) {
          payoffMonthExtra = m;
        }
      }

      const ltv = homeValue > 0 ? balance / homeValue : 0;
      let pmi = 0;
      if (loanAmount > 0 && ltv > inp.pmiCancelLtv && inp.downPaymentPct < 20) {
        pmi = (loanAmount * (inp.pmiAnnualPct / 100)) / 12;
        pmiMonths += 1;
      }

      const ltvExtra = homeValue > 0 ? balanceExtra / homeValue : 0;
      let pmiExtra = 0;
      if (loanAmount > 0 && ltvExtra > inp.pmiCancelLtv && inp.downPaymentPct < 20) {
        pmiExtra = (loanAmount * (inp.pmiAnnualPct / 100)) / 12;
      }

      const grossOwner = pAndI + propTax + insurance + hoa + maint + pmi;
      const taxShield = (interest + propTax) * taxRate;
      const netOwner = Math.max(0, grossOwner - taxShield);

      const grossOwnerExtra = pAndIExtra + propTax + insurance + hoa + maint + pmiExtra;
      const taxShieldExtra = (interestExtra + propTax) * taxRate;
      const netOwnerExtra = Math.max(0, grossOwnerExtra - taxShieldExtra);

      const renterIns = inp.renterInsuranceAnnual / 12;
      const netRenter = rent + renterIns;

      cumOwnerCash += netOwner;
      cumOwnerExtraCash += netOwnerExtra;
      cumRenterCash += netRenter;
      yearOwnerCash += netOwner;
      yearOwnerExtraCash += netOwnerExtra;
      yearRenterCash += netRenter;

      keepExtraSurplus += (netOwner - netOwnerExtra);

      cumInterest += interest;
      cumPrincipal += principal;
      cumInterestExtra += interestExtra;
      cumPrincipalExtra += principalExtra;
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

      const delta = netOwner - netRenter;
      if (delta > 0) {
        renterSurplus += delta;
      } else if (delta < 0) {
        ownerSurplus += -delta;
      }

      const deltaExtra = netOwnerExtra - netRenter;
      if (deltaExtra > 0) {
        keepExtraSurplus -= deltaExtra;
      } else if (deltaExtra < 0) {
        keepExtraSurplus += -deltaExtra;
      }

      const ownerLiquid = sumBalances(ownerBuckets) + ownerSurplus;
      const ownerExtraLiquid = sumBalances(keepExtraBuckets) + keepExtraSurplus;
      const renterPortfolio = sumBalances(renterBuckets) + renterSurplus;
      const equityMark = homeValue - balance;
      const ownerNW = equityMark + ownerLiquid;
      const ownerExtraNW = (homeValue - balanceExtra) + ownerExtraLiquid;
      const renterNW = renterPortfolio + renterDeposit;

      if (breakEvenMonth == null && ownerNW >= renterNW) {
        breakEvenMonth = m;
      }

      if (m % 12 === 0) {
        const year = m / 12;
        // Terminal realism: selling costs as % of then-current value
        const sellCostY = homeValue * (inp.sellingCostPct / 100);
        const ownerIfSold = homeValue - sellCostY - balance + ownerLiquid;
        const ownerExtraIfSold = homeValue - sellCostY - balanceExtra + ownerExtraLiquid;
        yearly.push({
          year,
          homeValue,
          loanBalance: balance,
          loanBalanceExtra: balanceExtra,
          equity: equityMark,
          equityAfterSell: homeValue - sellCostY - balance,
          ownerLiquid,
          ownerNetWorthMark: ownerNW,
          ownerNetWorthIfSold: ownerIfSold,
          ownerNetWorthMarkExtra: ownerExtraNW,
          ownerNetWorthIfSoldExtra: ownerExtraIfSold,
          renterPortfolio,
          renterDeposit,
          renterNetWorth: renterNW,
          advantageIfSold: ownerIfSold - renterNW,
          advantageIfSoldExtra: ownerExtraIfSold - renterNW,
          advantageMark: ownerNW - renterNW,
          yearOwnerCash,
          yearOwnerExtraCash,
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
        yearOwnerCash = yearRenterCash = yearOwnerExtraCash = 0;
        yearInterest = yearPrincipal = yearTax = yearIns = yearHoa = yearMaint = yearPmi = yearShield = yearRent = 0;
      }
    }

    const sellCost = homeValue * (inp.sellingCostPct / 100);
    const netSaleProceeds = homeValue - sellCost - balance;
    const ownerLiquid = sumBalances(ownerBuckets) + ownerSurplus;
    const ownerExtraLiquidFinal = sumBalances(keepExtraBuckets) + keepExtraSurplus;
    const renterPortfolio = sumBalances(renterBuckets) + renterSurplus;
    const ownerFinal = netSaleProceeds + ownerLiquid;
    const ownerExtraFinal = homeValue - sellCost - balanceExtra + ownerExtraLiquidFinal;
    const renterFinal = renterPortfolio + renterDeposit;
    const advantage = ownerFinal - renterFinal;
    const advantageExtra = ownerExtraFinal - renterFinal;

    let breakEvenYear = null;
    for (const y of yearly) {
      if (y.ownerNetWorthIfSold >= y.renterNetWorth) {
        breakEvenYear = y.year;
        break;
      }
    }

    const y1 = yearly[0];
    const ownerMonthlyY1 = y1 ? y1.yearOwnerCash / 12 : payment;
    const renterMonthlyY1 = y1 ? y1.yearRenterCash / 12 : inp.rentMonthly;

    const totalLiquidAtStart =
      inp.useAssetBuckets && sumBalances(inp.assetBuckets) > 0
        ? sumBalances(inp.assetBuckets) + (funding.shortfall || 0)
        : needed;

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
      securityDeposit,
      assetWithdrawn: funding.withdrawn || 0,
      assetShortfall: funding.shortfall || 0,
      interestExtra: cumInterestExtra,
      principalExtra: cumPrincipalExtra,
      interestSaved: Math.max(0, cumInterest - cumInterestExtra)
    };

    return {
      inputs: inp,
      scenarioMode: "buy",
      loanAmount,
      downPayment,
      closingCosts,
      monthlyPayment: payment,
      months,
      pmiMonths,
      totalLiquidAtStart,
      funding: {
        withdrawn: funding.withdrawn || 0,
        shortfall: funding.shortfall || 0,
        useAssetBuckets: !!inp.useAssetBuckets
      },
      hasExtraPayment: extraM > 0,
      extraPaymentMonthly: extraM,
      finalExtra: {
        homeValue,
        loanBalance: balanceExtra,
        sellCost,
        ownerLiquid: ownerExtraLiquidFinal,
        ownerNetWorth: ownerExtraFinal,
        advantage: advantageExtra,
        advantageVsKeep: ownerExtraFinal - ownerFinal,
        payoffYear: payoffMonthExtra != null ? Math.ceil(payoffMonthExtra / 12) : null,
        payoffMonth: payoffMonthExtra,
        cumOwnerCash: cumOwnerExtraCash,
        interestPaid: cumInterestExtra,
        interestSaved: Math.max(0, cumInterest - cumInterestExtra)
      },
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
   * Already own: keep house vs sell now and rent for horizon.
   * Decision wealth at t=0 is identical: equity opportunity + liquid buckets.
   */
  function simulateOwn(inp) {
    const months = inp.horizonYears * 12;
    const homeValue0 = inp.homePrice; // current value
    const loan0 = Math.min(inp.currentLoanBalance, homeValue0);
    const monthlyRate = (inp.annualRatePct / 100) / 12;
    const investM = (inp.investReturnPct / 100) / 12;
    const appM = (inp.appreciationPct / 100) / 12;
    const rentGrowthM = (inp.rentGrowthPct / 100) / 12;
    const taxRate = inp.useTaxShield ? inp.marginalTaxPct / 100 : 0;
    const termYears = inp.remainingTermYears;
    const payment = monthlyMortgagePayment(loan0, inp.annualRatePct, termYears);
    const securityDeposit = inp.rentMonthly * inp.securityDepositMonths;

    const sellCost0 = homeValue0 * (inp.sellingCostPct / 100);
    const grossEquity = homeValue0 - loan0 - sellCost0;
    // Simple capital gains: (sale price - basis - sell costs) after exclusion
    const rawGain = Math.max(0, homeValue0 - sellCost0 - inp.purchasePrice);
    const taxableGain = Math.max(0, rawGain - inp.primaryResidenceExclusion);
    const gainsTax = taxableGain * (inp.capitalGainsTaxPct / 100);
    const netSaleProceeds0 = Math.max(0, grossEquity - gainsTax);

    const liquidBuckets0 = inp.useAssetBuckets
      ? cloneBucketState(inp.assetBuckets)
      : [];
    const liquidSum0 = sumBalances(liquidBuckets0);

    // Keep path: residual liquid buckets only; house continues
    let keepBuckets = cloneBucketState(liquidBuckets0);
    let keepSurplus = 0;
    // Sell path: sale proceeds + liquid buckets + invest; pay rent
    let sellBuckets = cloneBucketState(liquidBuckets0);
    let sellSurplus = netSaleProceeds0;
    // If no buckets, classic invest rate only on proceeds
    if (!inp.useAssetBuckets || liquidSum0 === 0) {
      keepBuckets = [];
      sellBuckets = [];
      keepSurplus = 0;
      sellSurplus = netSaleProceeds0;
    }

    let balance = loan0;
    let homeValue = homeValue0;
    let rent = inp.rentMonthly;
    let renterDeposit = securityDeposit;

    const extraM = inp.extraMortgageMonthly || 0;
    let balanceExtra = loan0;
    let keepExtraBuckets = cloneBucketState(keepBuckets);
    let keepExtraSurplus = 0;
    let cumOwnerExtraCash = 0;
    let yearOwnerExtraCash = 0;
    let payoffMonthExtra = null;
    let cumInterestExtra = 0;
    let cumPrincipalExtra = 0;

    let cumOwnerCash = 0;
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

    for (let m = 1; m <= months; m++) {
      homeValue *= 1 + appM;
      growBuckets(keepBuckets);
      growBuckets(sellBuckets);
      growBuckets(keepExtraBuckets);
      keepSurplus *= 1 + investM;
      sellSurplus *= 1 + investM;
      keepExtraSurplus *= 1 + investM;
      rent *= 1 + rentGrowthM;

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

      let interestExtra = 0;
      let principalExtra = 0;
      let pAndIExtra = 0;
      if (balanceExtra > 0.01) {
        const amortExtra = amortizationMonth(balanceExtra, payment, monthlyRate);
        interestExtra = amortExtra.interest;
        const baseP = amortExtra.principal;
        const remBal = amortExtra.balance;
        const addExtraP = Math.min(remBal, extraM);
        principalExtra = baseP + addExtraP;
        balanceExtra = Math.max(0, remBal - addExtraP);
        pAndIExtra = interestExtra + principalExtra;
        if (balanceExtra <= 0.01 && payoffMonthExtra == null) {
          payoffMonthExtra = m;
        }
      }

      const ltv = homeValue > 0 ? balance / homeValue : 0;
      let pmi = 0;
      // Own mode: PMI if still underwater LTV and rate configured
      if (loan0 > 0 && ltv > inp.pmiCancelLtv && inp.pmiAnnualPct > 0) {
        pmi = (loan0 * (inp.pmiAnnualPct / 100)) / 12;
        pmiMonths += 1;
      }

      const ltvExtra = homeValue > 0 ? balanceExtra / homeValue : 0;
      let pmiExtra = 0;
      if (loan0 > 0 && ltvExtra > inp.pmiCancelLtv && inp.pmiAnnualPct > 0) {
        pmiExtra = (loan0 * (inp.pmiAnnualPct / 100)) / 12;
      }

      const grossOwner = pAndI + propTax + insurance + hoa + maint + pmi;
      const taxShield = (interest + propTax) * taxRate;
      const netOwner = Math.max(0, grossOwner - taxShield);

      const grossOwnerExtra = pAndIExtra + propTax + insurance + hoa + maint + pmiExtra;
      const taxShieldExtra = (interestExtra + propTax) * taxRate;
      const netOwnerExtra = Math.max(0, grossOwnerExtra - taxShieldExtra);

      const renterIns = inp.renterInsuranceAnnual / 12;
      const netRenter = rent + renterIns;

      cumOwnerCash += netOwner;
      cumOwnerExtraCash += netOwnerExtra;
      cumRenterCash += netRenter;
      yearOwnerCash += netOwner;
      yearOwnerExtraCash += netOwnerExtra;
      yearRenterCash += netRenter;

      keepExtraSurplus += (netOwner - netOwnerExtra);

      cumInterest += interest;
      cumPrincipal += principal;
      cumInterestExtra += interestExtra;
      cumPrincipalExtra += principalExtra;
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

      // Keep = "owner", Sell&rent = "renter"
      const delta = netOwner - netRenter;
      if (delta > 0) {
        sellSurplus += delta;
      } else if (delta < 0) {
        keepSurplus += -delta;
      }

      const deltaExtra = netOwnerExtra - netRenter;
      if (deltaExtra > 0) {
        keepExtraSurplus -= deltaExtra;
      } else if (deltaExtra < 0) {
        keepExtraSurplus += -deltaExtra;
      }

      const ownerLiquid = sumBalances(keepBuckets) + keepSurplus;
      const ownerExtraLiquid = sumBalances(keepExtraBuckets) + keepExtraSurplus;
      const renterPortfolio = sumBalances(sellBuckets) + sellSurplus;
      const equityMark = homeValue - balance;
      const ownerNW = equityMark + ownerLiquid;
      const ownerExtraNW = (homeValue - balanceExtra) + ownerExtraLiquid;
      const renterNW = renterPortfolio + renterDeposit;

      if (m % 12 === 0) {
        const year = m / 12;
        const sellCostY = homeValue * (inp.sellingCostPct / 100);
        const ownerIfSold = homeValue - sellCostY - balance + ownerLiquid;
        const ownerExtraIfSold = homeValue - sellCostY - balanceExtra + ownerExtraLiquid;
        yearly.push({
          year,
          homeValue,
          loanBalance: balance,
          loanBalanceExtra: balanceExtra,
          equity: equityMark,
          equityAfterSell: homeValue - sellCostY - balance,
          ownerLiquid,
          ownerNetWorthMark: ownerNW,
          ownerNetWorthIfSold: ownerIfSold,
          ownerNetWorthMarkExtra: ownerExtraNW,
          ownerNetWorthIfSoldExtra: ownerExtraIfSold,
          renterPortfolio,
          renterDeposit,
          renterNetWorth: renterNW,
          advantageIfSold: ownerIfSold - renterNW,
          advantageIfSoldExtra: ownerExtraIfSold - renterNW,
          advantageMark: ownerNW - renterNW,
          yearOwnerCash,
          yearOwnerExtraCash,
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
        yearOwnerCash = yearRenterCash = yearOwnerExtraCash = 0;
        yearInterest = yearPrincipal = yearTax = yearIns = yearHoa = yearMaint = yearPmi = yearShield = yearRent = 0;
      }
    }

    const sellCost = homeValue * (inp.sellingCostPct / 100);
    const netSaleProceeds = homeValue - sellCost - balance;
    const ownerLiquid = sumBalances(keepBuckets) + keepSurplus;
    const ownerExtraLiquidFinal = sumBalances(keepExtraBuckets) + keepExtraSurplus;
    const renterPortfolio = sumBalances(sellBuckets) + sellSurplus;
    const ownerFinal = netSaleProceeds + ownerLiquid;
    const ownerExtraFinal = homeValue - sellCost - balanceExtra + ownerExtraLiquidFinal;
    const renterFinal = renterPortfolio + renterDeposit;
    const advantage = ownerFinal - renterFinal; // keep − sell&rent
    const advantageExtra = ownerExtraFinal - renterFinal;

    let breakEvenYear = null;
    for (const y of yearly) {
      if (y.ownerNetWorthIfSold >= y.renterNetWorth) {
        breakEvenYear = y.year;
        break;
      }
    }

    const y1 = yearly[0];
    const ownerMonthlyY1 = y1 ? y1.yearOwnerCash / 12 : payment;
    const renterMonthlyY1 = y1 ? y1.yearRenterCash / 12 : inp.rentMonthly;

    const breakdown = {
      downPayment: 0,
      closingCosts: 0,
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
      securityDeposit,
      saleProceedsToday: netSaleProceeds0,
      gainsTaxToday: gainsTax,
      sellCostToday: sellCost0,
      currentEquityNet: grossEquity,
      interestExtra: cumInterestExtra,
      principalExtra: cumPrincipalExtra,
      interestSaved: Math.max(0, cumInterest - cumInterestExtra)
    };

    return {
      inputs: inp,
      scenarioMode: "own",
      loanAmount: loan0,
      downPayment: 0,
      closingCosts: 0,
      monthlyPayment: payment,
      months,
      pmiMonths,
      totalLiquidAtStart: liquidSum0 + netSaleProceeds0,
      hasExtraPayment: extraM > 0,
      extraPaymentMonthly: extraM,
      ownSnapshot: {
        currentValue: homeValue0,
        loanBalance: loan0,
        sellCostToday: sellCost0,
        netSaleProceeds: netSaleProceeds0,
        gainsTax,
        rawGain,
        taxableGain,
        yearsOwned: inp.yearsOwned,
        purchasePrice: inp.purchasePrice
      },
      finalExtra: {
        homeValue,
        loanBalance: balanceExtra,
        sellCost,
        ownerLiquid: ownerExtraLiquidFinal,
        ownerNetWorth: ownerExtraFinal,
        advantage: advantageExtra,
        advantageVsKeep: ownerExtraFinal - ownerFinal,
        payoffYear: payoffMonthExtra != null ? Math.ceil(payoffMonthExtra / 12) : null,
        payoffMonth: payoffMonthExtra,
        cumOwnerCash: cumOwnerExtraCash,
        interestPaid: cumInterestExtra,
        interestSaved: Math.max(0, cumInterest - cumInterestExtra)
      },
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
        // Map winners: keep house ~ "buy", sell&rent ~ "rent"
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
   * Binary search: rent that makes owner/keep advantage ≈ 0 at horizon (if sold).
   */
  function indifferentRent(rawInputs) {
    const base = mergeInputs(rawInputs);
    let lo = 0;
    let hi = Math.max(base.rentMonthly * 4, base.homePrice * 0.01, 500);
    for (let i = 0; i < 12; i++) {
      if (simulate({ ...base, rentMonthly: hi }).final.advantage > 0) break;
      hi *= 1.5;
    }
    if (simulate({ ...base, rentMonthly: hi }).final.advantage <= 0) {
      return { rentMonthly: hi, advantage: simulate({ ...base, rentMonthly: hi }).final.advantage, found: false };
    }
    if (simulate({ ...base, rentMonthly: 0 }).final.advantage >= 0) {
      return { rentMonthly: 0, advantage: simulate({ ...base, rentMonthly: 0 }).final.advantage, found: false };
    }
    let mid = base.rentMonthly;
    for (let i = 0; i < 48; i++) {
      mid = (lo + hi) / 2;
      const adv = simulate({ ...base, rentMonthly: mid }).final.advantage;
      if (adv > 0) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    const advantage = simulate({ ...base, rentMonthly: mid }).final.advantage;
    return { rentMonthly: mid, advantage, found: true };
  }

  /**
   * Largest sensitivity swing (high − low advantage) for story summary.
   */
  function topSensitivityLever(rawInputs) {
    const sens = sensitivityAround(rawInputs);
    let best = null;
    for (const row of sens.rows) {
      const swing = Math.abs(row.highAdvantage - row.lowAdvantage);
      if (!best || swing > best.swing) {
        best = { ...row, swing };
      }
    }
    return best;
  }

  /**
   * 2D Rent vs Home Price Decision Matrix (Heatmap).
   * Generates a 2D grid of scenarios varying Home Price (X-axis) from minRatio to maxRatio
   * and Monthly Rent (Y-axis) from minRatio to maxRatio.
   */
  function heatmapGrid(rawInputs, options) {
    const inp = mergeInputs(rawInputs);
    const opts = options || {};
    const priceSteps = Math.max(3, Math.min(15, opts.priceSteps || 7));
    const rentSteps = Math.max(3, Math.min(15, opts.rentSteps || 7));
    const minRatio = Math.max(0.2, opts.minRatio || 0.5);
    const maxRatio = Math.min(3.0, opts.maxRatio || 1.5);

    const basePrice = inp.homePrice;
    const baseRent = inp.rentMonthly;

    const priceRatios = [];
    for (let i = 0; i < priceSteps; i++) {
      priceRatios.push(minRatio + ((maxRatio - minRatio) * i) / (priceSteps - 1));
    }

    const rentRatios = [];
    for (let j = 0; j < rentSteps; j++) {
      rentRatios.push(minRatio + ((maxRatio - minRatio) * j) / (rentSteps - 1));
    }

    let maxAdvantage = -Infinity;
    let minAdvantage = Infinity;
    const matrix = [];

    for (let rIdx = 0; rIdx < rentSteps; rIdx++) {
      const rRatio = rentRatios[rIdx];
      const rentVal = baseRent * rRatio;
      const row = [];
      for (let pIdx = 0; pIdx < priceSteps; pIdx++) {
        const pRatio = priceRatios[pIdx];
        const priceVal = basePrice * pRatio;

        const scenarioInputs = {
          ...inp,
          homePrice: priceVal,
          rentMonthly: rentVal
        };

        const res = simulate(scenarioInputs);
        const adv = res.final.advantage;
        if (adv > maxAdvantage) maxAdvantage = adv;
        if (adv < minAdvantage) minAdvantage = adv;

        row.push({
          priceIndex: pIdx,
          rentIndex: rIdx,
          priceRatio: pRatio,
          rentRatio: rRatio,
          homePrice: priceVal,
          rentMonthly: rentVal,
          ownerNetWorth: res.final.ownerNetWorth,
          renterNetWorth: res.final.renterNetWorth,
          advantage: adv,
          winner: res.final.winner
        });
      }
      matrix.push(row);
    }

    const baselinePriceIdx = priceRatios.reduce(
      (closest, r, idx) => (Math.abs(r - 1.0) < Math.abs(priceRatios[closest] - 1.0) ? idx : closest),
      0
    );
    const baselineRentIdx = rentRatios.reduce(
      (closest, r, idx) => (Math.abs(r - 1.0) < Math.abs(rentRatios[closest] - 1.0) ? idx : closest),
      0
    );

    return {
      priceSteps,
      rentSteps,
      basePrice,
      baseRent,
      priceRatios,
      rentRatios,
      prices: priceRatios.map((r) => basePrice * r),
      rents: rentRatios.map((r) => baseRent * r),
      matrix,
      maxAdvantage,
      minAdvantage,
      baselineCoords: { priceIndex: baselinePriceIdx, rentIndex: baselineRentIdx }
    };
  }

  return {
    DEFAULTS,
    PRESETS,
    DEFAULT_BUCKETS,
    mergeInputs,
    monthlyMortgagePayment,
    withdrawForPurchase,
    resolveMoneyPair,
    applyRealDollars,
    simulate,
    sensitivity,
    sensitivityAround,
    topSensitivityLever,
    indifferentRent,
    heatmapGrid
  };
});
