/**
 * Golden tests for True Rent vs Buy physics.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Physics = require("./physics.js");

describe("RentVsBuyPhysics.monthlyMortgagePayment", () => {
  it("matches standard 30y fixed payment", () => {
    // $360k loan @ 6.5% 30y ≈ $2275.53
    const pmt = Physics.monthlyMortgagePayment(360000, 6.5, 30);
    assert.ok(Math.abs(pmt - 2275.53) < 0.5, `got ${pmt}`);
  });

  it("zero rate is principal / n", () => {
    const pmt = Physics.monthlyMortgagePayment(120000, 0, 10);
    assert.equal(pmt, 1000);
  });
});

describe("RentVsBuyPhysics.simulate", () => {
  it("returns finite wealth for defaults", () => {
    const r = Physics.simulate(Physics.DEFAULTS);
    assert.ok(Number.isFinite(r.final.ownerNetWorth));
    assert.ok(Number.isFinite(r.final.renterNetWorth));
    assert.equal(r.yearly.length, Physics.DEFAULTS.horizonYears);
    assert.ok(r.loanAmount > 0);
    assert.ok(r.monthlyPayment > 0);
  });

  it("100% cash purchase has zero loan and payment", () => {
    const r = Physics.simulate({
      ...Physics.DEFAULTS,
      downPaymentPct: 100,
      homePrice: 300000,
      horizonYears: 5
    });
    assert.equal(r.loanAmount, 0);
    assert.equal(r.monthlyPayment, 0);
    assert.ok(r.final.loanBalance < 1);
  });

  it("higher rent favors buying (advantage increases)", () => {
    const base = Physics.simulate({ ...Physics.DEFAULTS, rentMonthly: 2000 });
    const high = Physics.simulate({ ...Physics.DEFAULTS, rentMonthly: 3500 });
    assert.ok(
      high.final.advantage > base.final.advantage,
      `high ${high.final.advantage} vs base ${base.final.advantage}`
    );
  });

  it("higher investment return favors renting when surplus is invested", () => {
    // With meaningful down payment parked in stocks for renter
    const low = Physics.simulate({
      ...Physics.DEFAULTS,
      investReturnPct: 2,
      appreciationPct: 1,
      rentMonthly: 1800
    });
    const high = Physics.simulate({
      ...Physics.DEFAULTS,
      investReturnPct: 12,
      appreciationPct: 1,
      rentMonthly: 1800
    });
    assert.ok(
      high.final.renterNetWorth > low.final.renterNetWorth,
      "renter portfolio should grow faster at higher return"
    );
  });

  it("PMI applies when down payment < 20%", () => {
    const withPmi = Physics.simulate({
      ...Physics.DEFAULTS,
      downPaymentPct: 5,
      pmiAnnualPct: 0.8,
      horizonYears: 3
    });
    assert.ok(withPmi.breakdown.pmi > 0, "expected PMI cost");
    assert.ok(withPmi.pmiMonths > 0);

    const noPmi = Physics.simulate({
      ...Physics.DEFAULTS,
      downPaymentPct: 20,
      horizonYears: 3
    });
    assert.equal(noPmi.breakdown.pmi, 0);
  });

  it("selling costs reduce owner terminal wealth", () => {
    const low = Physics.simulate({ ...Physics.DEFAULTS, sellingCostPct: 0, horizonYears: 7 });
    const high = Physics.simulate({ ...Physics.DEFAULTS, sellingCostPct: 8, horizonYears: 7 });
    assert.ok(high.final.ownerNetWorth < low.final.ownerNetWorth);
  });

  it("tax shield reduces owner cumulative cash when enabled", () => {
    const off = Physics.simulate({ ...Physics.DEFAULTS, useTaxShield: false, horizonYears: 5 });
    const on = Physics.simulate({ ...Physics.DEFAULTS, useTaxShield: true, marginalTaxPct: 32, horizonYears: 5 });
    assert.ok(on.breakdown.taxShield > 0);
    assert.ok(on.final.cumOwnerCash < off.final.cumOwnerCash);
  });

  it("yearly series tracks rising home value under positive appreciation", () => {
    const r = Physics.simulate({ ...Physics.DEFAULTS, appreciationPct: 4, horizonYears: 5 });
    assert.ok(r.yearly[4].homeValue > r.yearly[0].homeValue);
    assert.ok(r.yearly[4].loanBalance < r.yearly[0].loanBalance);
  });
});

describe("RentVsBuyPhysics.sensitivityAround", () => {
  it("returns five sensitivity rows", () => {
    const s = Physics.sensitivityAround(Physics.DEFAULTS);
    assert.equal(s.rows.length, 5);
    assert.ok(Number.isFinite(s.baseAdvantage));
    s.rows.forEach((row) => {
      assert.ok(Number.isFinite(row.lowAdvantage));
      assert.ok(Number.isFinite(row.highAdvantage));
    });
  });
});

describe("RentVsBuyPhysics.indifferentRent", () => {
  it("finds rent near zero advantage", () => {
    const ind = Physics.indifferentRent({ ...Physics.DEFAULTS, horizonYears: 10 });
    assert.ok(ind.rentMonthly > 0);
    assert.ok(Math.abs(ind.advantage) < 5000, `advantage ${ind.advantage} at rent ${ind.rentMonthly}`);
  });
});

describe("presets", () => {
  it("all presets simulate cleanly", () => {
    for (const [id, preset] of Object.entries(Physics.PRESETS)) {
      const r = Physics.simulate(preset);
      assert.ok(Number.isFinite(r.final.advantage), id);
      assert.ok(["buy", "rent", "tie"].includes(r.final.winner), id);
    }
  });
});

describe("down payment amount vs pct", () => {
  it("amount mode produces equivalent loan to pct", () => {
    const byPct = Physics.simulate({
      ...Physics.DEFAULTS,
      homePrice: 500000,
      downPaymentPct: 20,
      downPaymentMode: "pct"
    });
    const byAmt = Physics.simulate({
      ...Physics.DEFAULTS,
      homePrice: 500000,
      downPaymentAmount: 100000,
      downPaymentMode: "amount"
    });
    assert.equal(byPct.loanAmount, byAmt.loanAmount);
    assert.ok(Math.abs(byPct.downPayment - byAmt.downPayment) < 0.01);
  });

  it("mergeInputs resolves amount from pct by default", () => {
    const m = Physics.mergeInputs({ homePrice: 400000, downPaymentPct: 10 });
    assert.equal(m.downPaymentAmount, 40000);
    assert.equal(m.downPaymentPct, 10);
  });
});

describe("asset buckets", () => {
  it("withdrawForPurchase respects order and useForDown", () => {
    const buckets = [
      { id: "cash", label: "Cash", balance: 30000, returnPct: 4, useForDown: true, order: 1 },
      { id: "stocks", label: "Stocks", balance: 80000, returnPct: 8, useForDown: true, order: 2 },
      { id: "bonds", label: "Bonds", balance: 20000, returnPct: 4, useForDown: false, order: 3 }
    ];
    const r = Physics.withdrawForPurchase(buckets, 50000);
    assert.equal(r.withdrawn, 50000);
    assert.equal(r.shortfall, 0);
    const cash = r.remainingBuckets.find((b) => b.id === "cash");
    const stocks = r.remainingBuckets.find((b) => b.id === "stocks");
    const bonds = r.remainingBuckets.find((b) => b.id === "bonds");
    assert.equal(cash.balance, 0);
    assert.equal(stocks.balance, 60000);
    assert.equal(bonds.balance, 20000);
  });

  it("bucket funding changes renter vs owner split vs classic", () => {
    const classic = Physics.simulate({
      ...Physics.DEFAULTS,
      homePrice: 400000,
      downPaymentPct: 20,
      useAssetBuckets: false,
      horizonYears: 5
    });
    const buckets = Physics.simulate({
      ...Physics.DEFAULTS,
      homePrice: 400000,
      downPaymentPct: 20,
      useAssetBuckets: true,
      horizonYears: 5,
      assetBuckets: [
        { id: "cash", label: "Cash", balance: 50000, returnPct: 3, useForDown: true, order: 1 },
        { id: "stocks", label: "Stocks", balance: 100000, returnPct: 10, useForDown: true, order: 2 },
        { id: "bonds", label: "Bonds", balance: 0, returnPct: 4, useForDown: false, order: 3 }
      ]
    });
    assert.ok(Number.isFinite(buckets.final.advantage));
    // With extra stocks left invested on both sides after funding, NW levels differ from classic
    assert.ok(buckets.final.renterNetWorth !== classic.final.renterNetWorth);
    assert.ok(buckets.funding.withdrawn > 0);
  });
});

describe("real dollars (inflation)", () => {
  it("deflates terminal wealth when showRealDollars is on", () => {
    const nominal = Physics.simulate({
      ...Physics.DEFAULTS,
      showRealDollars: false,
      inflationPct: 3,
      horizonYears: 10
    });
    const real = Physics.simulate({
      ...Physics.DEFAULTS,
      showRealDollars: true,
      inflationPct: 3,
      horizonYears: 10
    });
    assert.equal(real.display.mode, "real");
    assert.ok(real.final.ownerNetWorth < nominal.final.ownerNetWorth);
    assert.ok(real.final.renterNetWorth < nominal.final.renterNetWorth);
    // Same winner (sign of advantage) when both sides deflated equally
    assert.equal(
      Math.sign(real.final.advantage) || 0,
      Math.sign(nominal.final.advantage) || 0
    );
    assert.equal(real.final.breakEvenYear, nominal.final.breakEvenYear);
  });

  it("topSensitivityLever returns a labeled row", () => {
    const lever = Physics.topSensitivityLever(Physics.DEFAULTS);
    assert.ok(lever);
    assert.ok(lever.label);
    assert.ok(lever.swing >= 0);
  });
});

describe("own mode (keep vs sell & rent)", () => {
  it("simulates finite wealth for already-own preset", () => {
    const r = Physics.simulate(Physics.PRESETS.alreadyOwn);
    assert.equal(r.scenarioMode, "own");
    assert.ok(Number.isFinite(r.final.ownerNetWorth));
    assert.ok(Number.isFinite(r.final.renterNetWorth));
    assert.ok(r.ownSnapshot.netSaleProceeds >= 0);
    assert.equal(r.yearly.length, Physics.PRESETS.alreadyOwn.horizonYears);
  });

  it("higher rent makes keep more attractive (advantage rises)", () => {
    const base = {
      scenarioMode: "own",
      homePrice: 500000,
      purchasePrice: 350000,
      currentLoanBalance: 250000,
      remainingTermYears: 25,
      annualRatePct: 4,
      rentMonthly: 2000,
      horizonYears: 8,
      sellingCostPct: 6,
      appreciationPct: 2,
      investReturnPct: 7
    };
    const low = Physics.simulate(base);
    const high = Physics.simulate({ ...base, rentMonthly: 4000 });
    assert.ok(
      high.final.advantage > low.final.advantage,
      `high ${high.final.advantage} vs low ${low.final.advantage}`
    );
  });

  it("capital gains tax reduces sell-path starting proceeds", () => {
    const base = {
      scenarioMode: "own",
      homePrice: 600000,
      purchasePrice: 200000,
      currentLoanBalance: 100000,
      remainingTermYears: 20,
      annualRatePct: 4,
      rentMonthly: 2500,
      horizonYears: 5,
      sellingCostPct: 6,
      primaryResidenceExclusion: 0,
      capitalGainsTaxPct: 0
    };
    const noTax = Physics.simulate(base);
    const taxed = Physics.simulate({ ...base, capitalGainsTaxPct: 15 });
    assert.ok(taxed.ownSnapshot.gainsTax > 0);
    assert.ok(taxed.ownSnapshot.netSaleProceeds < noTax.ownSnapshot.netSaleProceeds);
    // Less proceeds → weaker sell&rent path → keep advantage should rise (or renter NW fall)
    assert.ok(taxed.final.renterNetWorth < noTax.final.renterNetWorth);
  });
});
