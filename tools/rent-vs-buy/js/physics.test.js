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
