/**
 * True Rent vs Buy Calculator — UI
 */
(function () {
  "use strict";

  const Physics = window.RentVsBuyPhysics;
  if (!Physics) {
    console.error("RentVsBuyPhysics not loaded");
    return;
  }

  const TOOL_ID = "rent-vs-buy";

  /** Scalar inputs shared or buy-mode primary */
  const SCALAR_IDS = [
    "homePrice",
    "downPaymentPct",
    "downPaymentAmount",
    "closingCostPct",
    "closingCostAmount",
    "annualRatePct",
    "loanTermYears",
    "propertyTaxAnnualPct",
    "homeInsuranceAnnual",
    "hoaMonthly",
    "maintenanceAnnualPct",
    "pmiAnnualPct",
    "appreciationPct",
    "sellingCostPct",
    "sellingCostAmount",
    "rentMonthly",
    "rentGrowthPct",
    "renterInsuranceAnnual",
    "securityDepositMonths",
    "investReturnPct",
    "marginalTaxPct",
    "horizonYears",
    "inflationPct",
    "purchasePrice",
    "yearsOwned",
    "currentLoanBalance",
    "remainingTermYears",
    "capitalGainsTaxPct",
    "primaryResidenceExclusion"
  ];

  const DUAL_FIELDS = [
    {
      key: "downPayment",
      pctId: "downPaymentPct",
      amountId: "downPaymentAmount",
      modeKey: "downPaymentMode",
      baseId: "homePrice",
      hintId: "downPayment-hint",
      pctMax: 100
    },
    {
      key: "closingCost",
      pctId: "closingCostPct",
      amountId: "closingCostAmount",
      modeKey: "closingCostMode",
      baseId: "homePrice",
      hintId: "closingCost-hint"
    },
    {
      key: "sellingCost",
      pctId: "sellingCostPct",
      amountId: "sellingCostAmount",
      modeKey: "sellingCostMode",
      baseId: "homePrice",
      hintId: "sellingCost-hint"
    }
  ];

  const $ = (id) => document.getElementById(id);

  let activePreset = "default";
  let lastResult = null;
  let scenarioMode = "buy";
  const dualModes = {
    downPayment: "pct",
    closingCost: "pct",
    sellingCost: "pct"
  };

  function money(n, digits = 0) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function moneyCompact(n) {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(2) + "M";
    if (abs >= 1e4) return sign + "$" + (abs / 1e3).toFixed(1) + "k";
    return money(n, 0);
  }

  function parseNum(el) {
    if (!el) return NaN;
    return parseFloat(el.value);
  }

  function getBucketsFromUI() {
    const rows = document.querySelectorAll("#buckets-tbody tr[data-bucket-id]");
    const buckets = [];
    rows.forEach((tr, i) => {
      const id = tr.dataset.bucketId;
      const label = tr.querySelector("[data-f=label]")?.value || id;
      const balance = parseFloat(tr.querySelector("[data-f=balance]")?.value) || 0;
      const returnPct = parseFloat(tr.querySelector("[data-f=returnPct]")?.value);
      const useForDown = !!tr.querySelector("[data-f=useForDown]")?.checked;
      const order = parseInt(tr.querySelector("[data-f=order]")?.value, 10) || i + 1;
      buckets.push({
        id,
        label,
        balance: Math.max(0, balance),
        returnPct: Number.isFinite(returnPct) ? returnPct : 7,
        useForDown,
        order
      });
    });
    return buckets.length ? buckets : Physics.DEFAULT_BUCKETS.map((b) => ({ ...b }));
  }

  function renderBuckets(buckets) {
    const tbody = $("buckets-tbody");
    if (!tbody) return;
    const list = buckets && buckets.length ? buckets : Physics.DEFAULT_BUCKETS;
    tbody.innerHTML = list
      .map(
        (b, i) =>
          `<tr data-bucket-id="${escapeAttr(b.id)}">` +
          `<td><input type="text" data-f="label" value="${escapeAttr(b.label)}" class="bucket-input text" /></td>` +
          `<td><input type="number" data-f="balance" value="${b.balance}" min="0" step="1000" inputmode="decimal" class="bucket-input" /></td>` +
          `<td><input type="number" data-f="returnPct" value="${b.returnPct}" step="0.1" inputmode="decimal" class="bucket-input" /></td>` +
          `<td class="td-check"><input type="checkbox" data-f="useForDown" ${b.useForDown ? "checked" : ""} title="Use for down + closing" /></td>` +
          `<td><input type="number" data-f="order" value="${b.order != null ? b.order : i + 1}" min="1" step="1" class="bucket-input order" /></td>` +
          `</tr>`
      )
      .join("");

    tbody.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        activePreset = "custom";
        document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
        updateFundingReadout();
        recalculate();
      });
      inp.addEventListener("change", () => {
        updateFundingReadout();
        recalculate();
      });
    });
  }

  function escapeAttr(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function getInputs() {
    const raw = {
      scenarioMode,
      downPaymentMode: dualModes.downPayment,
      closingCostMode: dualModes.closingCost,
      sellingCostMode: dualModes.sellingCost,
      useTaxShield: !!($("useTaxShield") && $("useTaxShield").checked),
      showRealDollars: !!($("showRealDollars") && $("showRealDollars").checked),
      useAssetBuckets: !!($("useAssetBuckets") && $("useAssetBuckets").checked),
      assetBuckets: getBucketsFromUI()
    };

    if (scenarioMode === "own") {
      raw.homePrice = parseNum($("ownHomePrice"));
      raw.purchasePrice = parseNum($("purchasePrice"));
      raw.yearsOwned = parseNum($("yearsOwned"));
      raw.currentLoanBalance = parseNum($("currentLoanBalance"));
      raw.annualRatePct = parseNum($("ownAnnualRatePct"));
      raw.remainingTermYears = parseNum($("remainingTermYears"));
      raw.propertyTaxAnnualPct = parseNum($("ownPropertyTaxAnnualPct"));
      raw.homeInsuranceAnnual = parseNum($("ownHomeInsuranceAnnual"));
      raw.hoaMonthly = parseNum($("ownHoaMonthly"));
      raw.maintenanceAnnualPct = parseNum($("ownMaintenanceAnnualPct"));
      raw.pmiAnnualPct = parseNum($("ownPmiAnnualPct"));
      raw.appreciationPct = parseNum($("ownAppreciationPct"));
      raw.sellingCostPct = parseNum($("ownSellingCostPct"));
      raw.sellingCostMode = "pct";
      raw.capitalGainsTaxPct = parseNum($("capitalGainsTaxPct"));
      raw.primaryResidenceExclusion = parseNum($("primaryResidenceExclusion"));
      // Keep buy-mode fields for round-trip export
      raw.downPaymentPct = parseNum($("downPaymentPct"));
      raw.downPaymentAmount = parseNum($("downPaymentAmount"));
      raw.closingCostPct = parseNum($("closingCostPct"));
      raw.loanTermYears = parseNum($("loanTermYears"));
    } else {
      raw.homePrice = parseNum($("homePrice"));
      raw.downPaymentPct = parseNum($("downPaymentPct"));
      raw.downPaymentAmount = parseNum($("downPaymentAmount"));
      raw.closingCostPct = parseNum($("closingCostPct"));
      raw.closingCostAmount = parseNum($("closingCostAmount"));
      raw.annualRatePct = parseNum($("annualRatePct"));
      raw.loanTermYears = parseNum($("loanTermYears"));
      raw.propertyTaxAnnualPct = parseNum($("propertyTaxAnnualPct"));
      raw.homeInsuranceAnnual = parseNum($("homeInsuranceAnnual"));
      raw.hoaMonthly = parseNum($("hoaMonthly"));
      raw.maintenanceAnnualPct = parseNum($("maintenanceAnnualPct"));
      raw.pmiAnnualPct = parseNum($("pmiAnnualPct"));
      raw.appreciationPct = parseNum($("appreciationPct"));
      raw.sellingCostPct = parseNum($("sellingCostPct"));
      raw.sellingCostAmount = parseNum($("sellingCostAmount"));
      raw.purchasePrice = parseNum($("purchasePrice"));
      raw.yearsOwned = parseNum($("yearsOwned"));
      raw.currentLoanBalance = parseNum($("currentLoanBalance"));
      raw.remainingTermYears = parseNum($("remainingTermYears"));
      raw.capitalGainsTaxPct = parseNum($("capitalGainsTaxPct"));
      raw.primaryResidenceExclusion = parseNum($("primaryResidenceExclusion"));
    }

    raw.rentMonthly = parseNum($("rentMonthly"));
    raw.rentGrowthPct = parseNum($("rentGrowthPct"));
    raw.renterInsuranceAnnual = parseNum($("renterInsuranceAnnual"));
    raw.securityDepositMonths = parseNum($("securityDepositMonths"));
    raw.investReturnPct = parseNum($("investReturnPct"));
    raw.marginalTaxPct = parseNum($("marginalTaxPct"));
    raw.horizonYears = parseNum($("horizonYears"));
    raw.inflationPct = parseNum($("inflationPct"));

    return raw;
  }

  function computeBuyNeeded() {
    const price = parseNum($("homePrice")) || 0;
    const dp =
      dualModes.downPayment === "amount"
        ? parseNum($("downPaymentAmount"))
        : price * ((parseNum($("downPaymentPct")) || 0) / 100);
    const cl =
      dualModes.closingCost === "amount"
        ? parseNum($("closingCostAmount"))
        : price * ((parseNum($("closingCostPct")) || 0) / 100);
    return {
      price,
      down: Number.isFinite(dp) ? Math.max(0, dp) : 0,
      closing: Number.isFinite(cl) ? Math.max(0, cl) : 0,
      needed: (Number.isFinite(dp) ? Math.max(0, dp) : 0) + (Number.isFinite(cl) ? Math.max(0, cl) : 0)
    };
  }

  /** Prefill buckets with a realistic mix when enabling empty table. */
  function prefillBucketsIfEmpty() {
    const buckets = getBucketsFromUI();
    const total = buckets.reduce((s, b) => s + (b.balance || 0), 0);
    if (total > 0) return false;

    const { needed, price } = computeBuyNeeded();
    const cashTarget = Math.round(needed > 0 ? needed : price * 0.2 + price * 0.025);
    const stocksExtra = Math.round(Math.max(25000, price * 0.1));
    const bondsExtra = Math.round(Math.max(10000, price * 0.05));

    const next = buckets.map((b) => {
      if (b.id === "cash") return { ...b, balance: cashTarget, useForDown: true, order: 1, returnPct: b.returnPct || 4 };
      if (b.id === "stocks") return { ...b, balance: stocksExtra, useForDown: true, order: 2, returnPct: b.returnPct || 8 };
      if (b.id === "bonds") return { ...b, balance: bondsExtra, useForDown: false, order: 3, returnPct: b.returnPct || 4.5 };
      return b;
    });
    renderBuckets(next);
    return true;
  }

  function setDualMode(key, mode, syncValues) {
    dualModes[key] = mode === "amount" ? "amount" : "pct";
    const field = document.querySelector(`.dual-field[data-dual="${key}"]`);
    if (!field) return;
    const cfg = DUAL_FIELDS.find((d) => d.key === key);
    if (!cfg) return;

    field.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.dualMode === dualModes[key]);
    });

    const pctEl = $(cfg.pctId);
    const amtEl = $(cfg.amountId);
    if (pctEl) pctEl.hidden = dualModes[key] !== "pct";
    if (amtEl) amtEl.hidden = dualModes[key] !== "amount";

    // Re-wrap visible input in stepper if needed
    if (syncValues) syncDualDerived(key);
    updateDualHints();
  }

  function syncDualDerived(key) {
    const cfg = DUAL_FIELDS.find((d) => d.key === key);
    if (!cfg) return;
    const base = parseNum($(cfg.baseId)) || 0;
    const pctEl = $(cfg.pctId);
    const amtEl = $(cfg.amountId);
    if (!pctEl || !amtEl) return;

    if (dualModes[key] === "pct") {
      const pct = parseNum(pctEl);
      if (Number.isFinite(pct)) {
        amtEl.value = String(Math.round(base * (pct / 100) * 100) / 100);
      }
    } else {
      const amt = parseNum(amtEl);
      if (Number.isFinite(amt) && base > 0) {
        let pct = (amt / base) * 100;
        if (cfg.pctMax != null) pct = Math.min(cfg.pctMax, pct);
        pctEl.value = String(Math.round(pct * 1000) / 1000);
      }
    }
  }

  function updateDualHints() {
    DUAL_FIELDS.forEach((cfg) => {
      const hint = $(cfg.hintId);
      if (!hint) return;
      const base = parseNum($(cfg.baseId)) || 0;
      const pct = parseNum($(cfg.pctId));
      const amt = parseNum($(cfg.amountId));
      if (dualModes[cfg.key] === "pct" && Number.isFinite(pct)) {
        const dollars = base * (pct / 100);
        hint.textContent = `≈ ${money(dollars, 0)}` + (cfg.key === "downPayment" && base > 0
          ? ` · loan ${money(Math.max(0, base - dollars), 0)} · LTV ${((Math.max(0, base - dollars) / base) * 100).toFixed(1)}%`
          : "");
      } else if (Number.isFinite(amt) && base > 0) {
        const p = (amt / base) * 100;
        hint.textContent = `≈ ${p.toFixed(2)}% of price` + (cfg.key === "downPayment"
          ? ` · loan ${money(Math.max(0, base - amt), 0)} · LTV ${((Math.max(0, base - amt) / base) * 100).toFixed(1)}%`
          : "");
      } else {
        hint.textContent = "";
      }
    });
  }

  function setInputs(data, opts = {}) {
    if (!data || typeof data !== "object") return;
    const merged = Physics.mergeInputs(data);

    if (data.scenarioMode === "own" || merged.scenarioMode === "own") {
      scenarioMode = "own";
    } else if (data.scenarioMode === "buy" || opts.forceMode === "buy") {
      scenarioMode = "buy";
    } else if (opts.presetId === "alreadyOwn") {
      scenarioMode = "own";
    }

    if (data.downPaymentMode) dualModes.downPayment = data.downPaymentMode;
    if (data.closingCostMode) dualModes.closingCost = data.closingCostMode;
    if (data.sellingCostMode) dualModes.sellingCost = data.sellingCostMode;

    // Buy-mode fields
    if ($("homePrice")) $("homePrice").value = merged.homePrice;
    if ($("downPaymentPct")) $("downPaymentPct").value = roundNice(merged.downPaymentPct, 3);
    if ($("downPaymentAmount")) $("downPaymentAmount").value = roundNice(merged.downPaymentAmount, 2);
    if ($("closingCostPct")) $("closingCostPct").value = roundNice(merged.closingCostPct, 3);
    if ($("closingCostAmount")) $("closingCostAmount").value = roundNice(merged.closingCostAmount, 2);
    if ($("annualRatePct")) $("annualRatePct").value = merged.annualRatePct;
    if ($("loanTermYears")) $("loanTermYears").value = merged.loanTermYears;
    if ($("propertyTaxAnnualPct")) $("propertyTaxAnnualPct").value = merged.propertyTaxAnnualPct;
    if ($("homeInsuranceAnnual")) $("homeInsuranceAnnual").value = merged.homeInsuranceAnnual;
    if ($("hoaMonthly")) $("hoaMonthly").value = merged.hoaMonthly;
    if ($("maintenanceAnnualPct")) $("maintenanceAnnualPct").value = merged.maintenanceAnnualPct;
    if ($("pmiAnnualPct")) $("pmiAnnualPct").value = merged.pmiAnnualPct;
    if ($("appreciationPct")) $("appreciationPct").value = merged.appreciationPct;
    if ($("sellingCostPct")) $("sellingCostPct").value = roundNice(merged.sellingCostPct, 3);
    if ($("sellingCostAmount")) $("sellingCostAmount").value = roundNice(merged.sellingCostAmount, 2);

    // Own-mode fields
    if ($("ownHomePrice")) $("ownHomePrice").value = merged.homePrice;
    if ($("purchasePrice")) $("purchasePrice").value = merged.purchasePrice;
    if ($("yearsOwned")) $("yearsOwned").value = merged.yearsOwned;
    if ($("currentLoanBalance")) $("currentLoanBalance").value = merged.currentLoanBalance;
    if ($("ownAnnualRatePct")) $("ownAnnualRatePct").value = merged.annualRatePct;
    if ($("remainingTermYears")) $("remainingTermYears").value = merged.remainingTermYears;
    if ($("ownPropertyTaxAnnualPct")) $("ownPropertyTaxAnnualPct").value = merged.propertyTaxAnnualPct;
    if ($("ownHomeInsuranceAnnual")) $("ownHomeInsuranceAnnual").value = merged.homeInsuranceAnnual;
    if ($("ownHoaMonthly")) $("ownHoaMonthly").value = merged.hoaMonthly;
    if ($("ownMaintenanceAnnualPct")) $("ownMaintenanceAnnualPct").value = merged.maintenanceAnnualPct;
    if ($("ownPmiAnnualPct")) $("ownPmiAnnualPct").value = merged.pmiAnnualPct;
    if ($("ownAppreciationPct")) $("ownAppreciationPct").value = merged.appreciationPct;
    if ($("ownSellingCostPct")) $("ownSellingCostPct").value = merged.sellingCostPct;
    if ($("capitalGainsTaxPct")) $("capitalGainsTaxPct").value = merged.capitalGainsTaxPct;
    if ($("primaryResidenceExclusion")) $("primaryResidenceExclusion").value = merged.primaryResidenceExclusion;

    // Shared
    if ($("rentMonthly")) $("rentMonthly").value = merged.rentMonthly;
    if ($("rentGrowthPct")) $("rentGrowthPct").value = merged.rentGrowthPct;
    if ($("renterInsuranceAnnual")) $("renterInsuranceAnnual").value = merged.renterInsuranceAnnual;
    if ($("securityDepositMonths")) $("securityDepositMonths").value = merged.securityDepositMonths;
    if ($("investReturnPct")) $("investReturnPct").value = merged.investReturnPct;
    if ($("marginalTaxPct")) $("marginalTaxPct").value = merged.marginalTaxPct;
    if ($("horizonYears")) $("horizonYears").value = merged.horizonYears;
    if ($("useTaxShield")) $("useTaxShield").checked = merged.useTaxShield !== false;
    if ($("showRealDollars")) $("showRealDollars").checked = !!merged.showRealDollars;
    if ($("inflationPct")) $("inflationPct").value = merged.inflationPct;
    if ($("useAssetBuckets")) $("useAssetBuckets").checked = !!merged.useAssetBuckets;

    renderBuckets(merged.assetBuckets);
    DUAL_FIELDS.forEach((d) => setDualMode(d.key, dualModes[d.key], false));
    updateDualHints();
    updateBucketsPanelVisibility();
    updateInflationUI();
    updateAssetsBadge();
    // Open advanced sections when relevant state is loaded
    if (merged.useAssetBuckets && $("assets-advanced")) $("assets-advanced").open = true;
    if ((merged.capitalGainsTaxPct > 0 || merged.scenarioMode === "own") && $("own-tax-advanced")) {
      if (merged.capitalGainsTaxPct > 0) $("own-tax-advanced").open = true;
    }
    applyModeUI();

    if (opts.presetId) activePreset = opts.presetId;
    updateHorizonLabel();
    if (!opts.silent) recalculate();
  }

  function roundNice(n, d) {
    if (!Number.isFinite(n)) return "";
    const f = Math.pow(10, d);
    return String(Math.round(n * f) / f);
  }

  function updateHorizonLabel() {
    const y = parseInt(($("horizonYears") || {}).value, 10) || 10;
    const lab = $("horizon-label");
    if (lab) lab.textContent = y + (y === 1 ? " year" : " years");
    const m = $("metric-horizon");
    if (m) m.textContent = y + " yr";
  }

  function updateBucketsPanelVisibility() {
    const on = !!($("useAssetBuckets") && $("useAssetBuckets").checked);
    const panel = $("buckets-panel");
    const offHint = $("buckets-off-hint");
    if (panel) panel.hidden = !on;
    if (offHint) offHint.hidden = on;
    const intro = $("buckets-intro");
    if (intro) {
      intro.innerHTML =
        scenarioMode === "own"
          ? "In <strong>already own</strong> mode, buckets are liquid wealth on <em>both</em> paths. Selling adds net sale proceeds on top; keeping leaves equity in the house."
          : "In <strong>buy</strong> mode, checked sources fund down + closing in draw order; leftovers stay invested at each source’s return. The renter keeps all balances invested.";
    }
    updateAssetsBadge();
  }

  function updateAssetsBadge() {
    const badge = $("assets-badge");
    if (!badge) return;
    const on = !!($("useAssetBuckets") && $("useAssetBuckets").checked);
    if (!on) {
      badge.textContent = "optional";
      badge.classList.remove("on", "warn");
      return;
    }
    const total = getBucketsFromUI().reduce((s, b) => s + (b.balance || 0), 0);
    badge.textContent = total > 0 ? "on" : "empty";
    badge.classList.toggle("on", total > 0);
    badge.classList.toggle("warn", total === 0);
  }

  function updateInflationUI() {
    const on = !!($("showRealDollars") && $("showRealDollars").checked);
    const field = $("inflation-field");
    if (field) field.classList.toggle("dimmed", !on);
    const hint = $("real-dollars-hint");
    if (hint) {
      hint.textContent = on
        ? "On: wealth, cash charts, and terminal net worth are shown in today’s dollars (constant inflation). Winner & break-even year are unchanged."
        : "Off: nominal future dollars. On: wealth & cash charts deflated at your inflation rate (winner unchanged).";
    }
  }

  function updateFundingReadout() {
    const el = $("funding-readout");
    if (!el) return;
    el.classList.remove("has-shortfall", "fully-funded", "empty-buckets");
    if (!($("useAssetBuckets") && $("useAssetBuckets").checked)) {
      el.innerHTML = "";
      return;
    }
    if (scenarioMode === "own") {
      const total = getBucketsFromUI().reduce((s, b) => s + (b.balance || 0), 0);
      el.innerHTML =
        total > 0
          ? `Liquid on both paths: <strong>${money(total, 0)}</strong>. Sale proceeds seed the sell&amp;rent path on top.`
          : `<span class="fund-warn">Buckets are empty.</span> Add cash/stocks/bonds, or both paths start with sale proceeds only (sell) vs house equity (keep).`;
      if (total === 0) el.classList.add("empty-buckets");
      return;
    }
    const { needed } = computeBuyNeeded();
    const buckets = getBucketsFromUI();
    const total = buckets.reduce((s, b) => s + b.balance, 0);
    if (total <= 0) {
      el.innerHTML =
        `<span class="fund-warn">Buckets are empty — add balances or turn this off.</span> ` +
        `Need <strong>${money(needed, 0)}</strong> for down + closing.`;
      el.classList.add("empty-buckets");
      return;
    }
    const funding = Physics.withdrawForPurchase(buckets, needed);
    const usable = buckets.filter((b) => b.useForDown).reduce((s, b) => s + b.balance, 0);
    if (funding.shortfall > 0) {
      el.classList.add("has-shortfall");
      el.innerHTML =
        `<span class="fund-warn">Shortfall ${money(funding.shortfall, 0)}</span> — ` +
        `need <strong>${money(needed, 0)}</strong> (down + closing), ` +
        `only <strong>${money(funding.withdrawn, 0)}</strong> from checked sources ` +
        `(${money(usable, 0)} marked “use”). ` +
        `Shortfall is treated as extra cash both sides had. Total liquid <strong>${money(total, 0)}</strong>.`;
    } else {
      el.classList.add("fully-funded");
      el.innerHTML =
        `<span class="fund-ok">Fully funded</span> — ` +
        `need <strong>${money(needed, 0)}</strong> from buckets · ` +
        `withdrawn <strong>${money(funding.withdrawn, 0)}</strong> · ` +
        `leftover invested <strong>${money(total - funding.withdrawn, 0)}</strong> · ` +
        `total liquid <strong>${money(total, 0)}</strong>.`;
    }
  }

  function applyModeUI() {
    const isOwn = scenarioMode === "own";
    document.querySelectorAll("[data-mode-panel]").forEach((el) => {
      const show = el.dataset.modePanel === scenarioMode;
      el.hidden = !show;
    });
    document.querySelectorAll("#mode-control .seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === scenarioMode);
    });

    const rentTitle = $("rent-card-title");
    const rentSub = $("rent-card-sub");
    if (rentTitle) rentTitle.textContent = isOwn ? "Rent after sale" : "Rent";
    if (rentSub) {
      rentSub.textContent = isOwn
        ? "Comparable rent if you sell and become a renter"
        : "Lease cost path over the horizon";
    }

    $("metric-buy-label").textContent = isOwn ? "Keep NW" : "Buy net worth";
    $("metric-rent-label").textContent = isOwn ? "Sell+rent NW" : "Rent net worth";

    const wTitle = $("chart-wealth-title");
    const wSub = $("chart-wealth-sub");
    if (wTitle) wTitle.textContent = isOwn ? "Net worth: keep vs sell & rent" : "Net worth over time";
    if (wSub) {
      wSub.textContent = isOwn
        ? "Keep = equity after future sale + liquid · Sell = proceeds invested + deposit − rent path"
        : "Buy = equity after sale costs + liquid portfolio · Rent = invested capital + deposit";
    }
    if ($("leg-buy")) $("leg-buy").innerHTML = isOwn ? "<i></i> Keep (if sold later)" : "<i></i> Buy (if sold)";
    if ($("leg-rent")) $("leg-rent").innerHTML = isOwn ? "<i></i> Sell &amp; rent" : "<i></i> Rent (portfolio)";
    if ($("leg-cash-buy")) $("leg-cash-buy").innerHTML = isOwn ? "<i></i> Keep cash" : "<i></i> Buy cash";
    if ($("leg-cash-rent")) $("leg-cash-rent").innerHTML = isOwn ? "<i></i> Rent cash" : "<i></i> Rent cash";
    if ($("th-owner-nw")) $("th-owner-nw").textContent = isOwn ? "Keep NW (sold)" : "Buy NW (sold)";
    if ($("th-renter-nw")) $("th-renter-nw").textContent = isOwn ? "Sell+rent NW" : "Rent NW";
    if ($("th-owner-cash")) $("th-owner-cash").textContent = isOwn ? "Keep cash/yr" : "Buy cash/yr";
    if ($("th-renter-cash")) $("th-renter-cash").textContent = isOwn ? "Rent cash/yr" : "Rent cash/yr";
    if ($("breakdown-title")) {
      $("breakdown-title").textContent = isOwn ? "Costs if you keep owning" : "What ownership really costs";
    }

    updateBucketsPanelVisibility();
  }

  function setScenarioMode(mode) {
    scenarioMode = mode === "own" ? "own" : "buy";
    activePreset = "custom";
    document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    // Sync mirrored price/rate fields when switching
    if (scenarioMode === "own") {
      if ($("ownHomePrice") && $("homePrice")) $("ownHomePrice").value = $("homePrice").value;
      if ($("ownAnnualRatePct") && $("annualRatePct")) $("ownAnnualRatePct").value = $("annualRatePct").value;
      if ($("ownPropertyTaxAnnualPct") && $("propertyTaxAnnualPct")) {
        $("ownPropertyTaxAnnualPct").value = $("propertyTaxAnnualPct").value;
      }
      if ($("ownHomeInsuranceAnnual") && $("homeInsuranceAnnual")) {
        $("ownHomeInsuranceAnnual").value = $("homeInsuranceAnnual").value;
      }
      if ($("ownHoaMonthly") && $("hoaMonthly")) $("ownHoaMonthly").value = $("hoaMonthly").value;
      if ($("ownMaintenanceAnnualPct") && $("maintenanceAnnualPct")) {
        $("ownMaintenanceAnnualPct").value = $("maintenanceAnnualPct").value;
      }
      if ($("ownPmiAnnualPct") && $("pmiAnnualPct")) $("ownPmiAnnualPct").value = $("pmiAnnualPct").value;
      if ($("ownAppreciationPct") && $("appreciationPct")) {
        $("ownAppreciationPct").value = $("appreciationPct").value;
      }
      if ($("ownSellingCostPct") && $("sellingCostPct")) {
        $("ownSellingCostPct").value = $("sellingCostPct").value;
      }
    } else {
      if ($("homePrice") && $("ownHomePrice")) $("homePrice").value = $("ownHomePrice").value;
      if ($("annualRatePct") && $("ownAnnualRatePct")) $("annualRatePct").value = $("ownAnnualRatePct").value;
    }
    applyModeUI();
    updateDualHints();
    updateFundingReadout();
    recalculate();
  }

  /** Decimal-safe step for number inputs */
  function stepNumberInput(input, direction) {
    if (!input || input.disabled || input.hidden) return;
    const stepAttr = input.getAttribute("step");
    const step = stepAttr && stepAttr !== "any" ? Math.abs(parseFloat(stepAttr)) : 1;
    const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
    const max = input.max !== "" ? parseFloat(input.max) : Infinity;
    const cur = parseFloat(input.value);
    const base = Number.isFinite(cur) ? cur : 0;
    const raw = base + direction * (Number.isFinite(step) && step > 0 ? step : 1);
    const decimals = (() => {
      const s = String(stepAttr || "1");
      const i = s.indexOf(".");
      return i >= 0 ? s.length - i - 1 : 0;
    })();
    let next = Number(raw.toFixed(Math.min(6, decimals || 0)));
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function enhanceNumberSteppers(root) {
    const scope = root || document;
    const chevronUp =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
    const chevronDown =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

    scope.querySelectorAll(".form-grid label.field input[type='number'], .form-grid .dual-field input[type='number']").forEach((input) => {
      if (input.closest(".stepper")) return;
      if (input.hidden) return;
      wrapStepper(input, chevronUp, chevronDown);
    });
  }

  function wrapStepper(input, chevronUp, chevronDown) {
    if (input.closest(".stepper")) return;
    const wrap = document.createElement("div");
    wrap.className = "stepper";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btns = document.createElement("div");
    btns.className = "stepper-btns";
    btns.innerHTML =
      `<button type="button" class="stepper-btn step-up" tabindex="-1" aria-label="Increase value">${chevronUp}</button>` +
      `<button type="button" class="stepper-btn step-down" tabindex="-1" aria-label="Decrease value">${chevronDown}</button>`;
    wrap.appendChild(btns);

    let holdTimer = null;
    let holdInterval = null;
    const startHold = (dir) => {
      stepNumberInput(input, dir);
      holdTimer = setTimeout(() => {
        holdInterval = setInterval(() => stepNumberInput(input, dir), 60);
      }, 350);
    };
    const stopHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      if (holdInterval) clearInterval(holdInterval);
      holdTimer = holdInterval = null;
    };
    btns.querySelectorAll(".stepper-btn").forEach((btn) => {
      const dir = btn.classList.contains("step-up") ? 1 : -1;
      btn.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startHold(dir);
      });
      btn.addEventListener("mouseup", stopHold);
      btn.addEventListener("mouseleave", stopHold);
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          stepNumberInput(input, dir);
        }
      });
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        startHold(dir);
      }, { passive: false });
      btn.addEventListener("touchend", stopHold);
      btn.addEventListener("touchcancel", stopHold);
    });
  }

  function refreshDualSteppers() {
    const chevronUp =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
    const chevronDown =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

    DUAL_FIELDS.forEach((cfg) => {
      const activeId = dualModes[cfg.key] === "amount" ? cfg.amountId : cfg.pctId;
      const inactiveId = dualModes[cfg.key] === "amount" ? cfg.pctId : cfg.amountId;
      const active = $(activeId);
      const inactive = $(inactiveId);
      if (inactive) {
        const st = inactive.closest(".stepper");
        if (st) {
          st.parentNode.insertBefore(inactive, st);
          st.remove();
        }
        inactive.hidden = true;
      }
      if (active) {
        active.hidden = false;
        if (!active.closest(".stepper")) wrapStepper(active, chevronUp, chevronDown);
      }
    });
  }

  function applyPreset(id) {
    const p = Physics.PRESETS[id] || Physics.PRESETS.default;
    activePreset = id;
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === id);
    });
    if (p.scenarioMode === "own" || id === "alreadyOwn") {
      scenarioMode = "own";
    } else {
      scenarioMode = "buy";
    }
    setInputs(p, { presetId: id });
    refreshDualSteppers();
  }

  function renderPresets() {
    const host = $("presets");
    if (!host) return;
    host.innerHTML = "";
    Object.entries(Physics.PRESETS).forEach(([id, p]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn" + (id === activePreset ? " active" : "");
      btn.dataset.preset = id;
      btn.textContent = p.label || id;
      btn.title = p.description || "";
      btn.addEventListener("click", () => applyPreset(id));
      host.appendChild(btn);
    });
  }

  function drawLineChart(canvas, series, opts = {}) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 640;
    const cssH = opts.height || 280;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const hasMarkers = Array.isArray(opts.markers) && opts.markers.length > 0;
    const pad = { t: hasMarkers ? 22 : 16, r: 16, b: 28, l: 56 };
    const w = cssW - pad.l - pad.r;
    const h = cssH - pad.t - pad.b;

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-primary").trim() || "#f8fafc";
    ctx.fillRect(0, 0, cssW, cssH);

    const allY = [];
    series.forEach((s) => s.points.forEach((p) => allY.push(p.y)));
    let yMin = Math.min(0, ...allY);
    let yMax = Math.max(...allY, 1);
    const padY = (yMax - yMin) * 0.08 || 1;
    yMin -= padY;
    yMax += padY;

    const xs = series[0] ? series[0].points.map((p) => p.x) : [0, 1];
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs, xMin + 1);

    const xOf = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * w;
    const yOf = (y) => pad.t + h - ((y - yMin) / (yMax - yMin)) * h;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1;
    const ticks = 4;
    ctx.font = "11px JetBrains Mono, ui-monospace, monospace";
    ctx.fillStyle = "#64748b";
    for (let i = 0; i <= ticks; i++) {
      const yv = yMin + ((yMax - yMin) * i) / ticks;
      const yy = yOf(yv);
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + w, yy);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(moneyCompact(yv), pad.l - 8, yy);
    }

    const xTicks = Math.min(6, Math.round(xMax - xMin) || 1);
    for (let i = 0; i <= xTicks; i++) {
      const xv = xMin + ((xMax - xMin) * i) / xTicks;
      const xx = xOf(xv);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(Math.round(xv)), xx, pad.t + h + 8);
    }

    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.45)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, yOf(0));
      ctx.lineTo(pad.l + w, yOf(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vertical markers (e.g. loan term) — behind series
    if (hasMarkers) {
      (opts.markers || []).forEach((m) => {
        if (!m || !Number.isFinite(m.x)) return;
        // Draw if marker falls on the plotted x-range (inclusive)
        if (m.x < xMin - 0.001 || m.x > xMax + 0.001) return;
        const xx = xOf(m.x);
        ctx.strokeStyle = m.color || "rgba(100, 116, 139, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash(m.dash || [5, 4]);
        ctx.beginPath();
        ctx.moveTo(xx, pad.t);
        ctx.lineTo(xx, pad.t + h);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = m.label || "Loan end";
        ctx.font = "600 10px Plus Jakarta Sans, system-ui, sans-serif";
        ctx.fillStyle = m.color || "#64748b";
        // Keep label inside plot: prefer left of line unless near left edge
        const nearRight = xx > pad.l + w * 0.72;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.textBaseline = "top";
        const tx = nearRight ? xx - 5 : xx + 5;
        ctx.fillText(label, tx, pad.t + 2);
      });
    }

    series.forEach((s) => {
      if (!s.points.length) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const xx = xOf(p.x);
        const yy = yOf(p.y);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      });
      ctx.stroke();
      ctx.fillStyle = s.color;
      s.points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(xOf(p.x), yOf(p.y), 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  /** Loan-term year for chart marker; null if no loan or not meaningful. */
  function loanTermMarker(result) {
    if (!result || !(result.loanAmount > 0)) return null;
    const isOwn = result.scenarioMode === "own";
    const term = isOwn
      ? Number(result.inputs.remainingTermYears)
      : Number(result.inputs.loanTermYears);
    if (!Number.isFinite(term) || term <= 0) return null;
    const horizon = result.inputs.horizonYears || 0;
    const onChart = term >= 1 && term <= horizon;
    return {
      x: term,
      onChart,
      label: isOwn ? `Loan end · Y${Math.round(term)}` : `Loan paid · Y${Math.round(term)}`,
      shortLabel: isOwn ? "Loan end" : "Loan paid",
      color: "rgba(100, 116, 139, 0.9)"
    };
  }

  function updateLoanLegend(marker) {
    ["leg-loan-wealth", "leg-loan-cash"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (!marker) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      const text = el.querySelector(".leg-text");
      if (text) {
        text.textContent = marker.onChart
          ? marker.shortLabel + ` (Y${Math.round(marker.x)})`
          : marker.shortLabel + ` (Y${Math.round(marker.x)}, beyond horizon)`;
      }
    });
  }

  function renderVerdict(result) {
    const bar = $("verdict-bar");
    const badge = $("verdict-badge");
    const title = $("verdict-title");
    const sub = $("verdict-sub");
    const f = result.final;
    const years = result.inputs.horizonYears;
    const isOwn = result.scenarioMode === "own";

    bar.classList.remove("win-buy", "win-rent", "win-tie");
    if (f.winner === "buy") {
      bar.classList.add("win-buy");
      badge.textContent = isOwn ? "Keep ahead" : "Buy ahead";
      title.textContent = isOwn
        ? `Keeping builds ${money(f.advantage)} more wealth in ${years} years`
        : `Buying builds ${money(f.advantage)} more wealth in ${years} years`;
    } else if (f.winner === "rent") {
      bar.classList.add("win-rent");
      badge.textContent = isOwn ? "Sell & rent ahead" : "Rent ahead";
      title.textContent = isOwn
        ? `Selling & renting builds ${money(-f.advantage)} more wealth in ${years} years`
        : `Renting builds ${money(-f.advantage)} more wealth in ${years} years`;
    } else {
      bar.classList.add("win-tie");
      badge.textContent = "Roughly even";
      title.textContent = isOwn
        ? `Keep and sell&rent end within ${money(Math.abs(f.advantage))} after ${years} years`
        : `Rent and buy end within ${money(Math.abs(f.advantage))} after ${years} years`;
    }

    const be =
      f.breakEvenYear != null
        ? isOwn
          ? `Keeping catches sell&rent (after future sale costs): year ${f.breakEvenYear}.`
          : `Break-even for owning (after sale costs): year ${f.breakEvenYear}.`
        : isOwn
          ? "Keeping does not catch sell&rent within this horizon."
          : "Owning does not catch renting within this horizon (after sale costs).";

    if (isOwn && result.ownSnapshot) {
      const s = result.ownSnapshot;
      sub.textContent =
        `If you sold today: ~${money(s.netSaleProceeds)} net after ${money(s.sellCostToday)} costs` +
        (s.gainsTax > 0 ? ` & ${money(s.gainsTax)} gains tax` : "") +
        `. Keep monthly cash ~${money(f.ownerMonthlyY1)} · Rent ~${money(f.renterMonthlyY1)}. ` +
        be;
    } else {
      const startNote =
        result.funding && result.funding.useAssetBuckets
          ? `Starting liquid modeled with asset buckets (withdrawn ${money(result.funding.withdrawn)} toward house). `
          : `Same starting cash (${money(result.downPayment + result.closingCosts)} down + closing). `;
      sub.textContent =
        startNote +
        `Buy monthly cash ~${money(f.ownerMonthlyY1)} yr‑1 avg · Rent ~${money(f.renterMonthlyY1)}. ` +
        be;
    }

    $("metric-buy-nw").textContent = moneyCompact(f.ownerNetWorth);
    $("metric-rent-nw").textContent = moneyCompact(f.renterNetWorth);
    $("metric-be").textContent = f.breakEvenYear != null ? `Year ${f.breakEvenYear}` : "Beyond horizon";
    $("metric-horizon").textContent = years + " yr";

    renderVerdictStory(result);
    renderDisplayNote(result);
  }

  function renderDisplayNote(result) {
    const note = $("verdict-display-note");
    if (!note) return;
    if (result.display && result.display.mode === "real") {
      note.hidden = false;
      note.textContent =
        `Figures below are in today’s dollars @ ${result.display.inflationPct}% inflation` +
        (result.display.breakdownNominal ? " (ownership cost breakdown stays nominal)." : ".");
    } else {
      note.hidden = true;
      note.textContent = "";
    }
  }

  function renderVerdictStory(result) {
    const host = $("verdict-story");
    if (!host) return;
    const f = result.final;
    const years = result.inputs.horizonYears;
    const isOwn = result.scenarioMode === "own";
    const bullets = [];

    if (isOwn && result.ownSnapshot) {
      const s = result.ownSnapshot;
      bullets.push(
        `If you sell today you unlock about <strong>${money(s.netSaleProceeds)}</strong> after selling costs` +
          (s.gainsTax > 0 ? ` and ~${money(s.gainsTax)} gains tax` : "") +
          "."
      );
    } else {
      const putIn = result.downPayment + result.closingCosts;
      if (result.funding && result.funding.useAssetBuckets) {
        bullets.push(
          `Buying uses <strong>${money(result.funding.withdrawn)}</strong> from your liquid buckets` +
            (result.funding.shortfall > 0
              ? ` plus <strong>${money(result.funding.shortfall)}</strong> other cash`
              : "") +
            ` toward the house (down + closing ≈ ${money(putIn)}).`
        );
      } else {
        bullets.push(
          `You put <strong>${money(putIn)}</strong> into the house at purchase (down + closing); the rent path invests that same cash instead.`
        );
      }
    }

    if (f.breakEvenYear != null) {
      bullets.push(
        isOwn
          ? `Keeping catches sell&amp;rent around <strong>year ${f.breakEvenYear}</strong> (after a future sale).`
          : `Owning breaks even with renting around <strong>year ${f.breakEvenYear}</strong> (after sale costs).`
      );
    } else {
      bullets.push(
        isOwn
          ? `Within <strong>${years} years</strong>, keeping does not catch sell&amp;rent on net worth after a future sale.`
          : `Within <strong>${years} years</strong>, buying does not catch renting on net worth after sale costs.`
      );
    }

    const cashGap = f.ownerMonthlyY1 - f.renterMonthlyY1;
    if (Math.abs(cashGap) >= 25) {
      bullets.push(
        cashGap > 0
          ? `Year‑1 housing cash is about <strong>${money(Math.abs(cashGap))}/mo higher</strong> if you ${isOwn ? "keep" : "buy"} than if you rent.`
          : `Year‑1 housing cash is about <strong>${money(Math.abs(cashGap))}/mo lower</strong> if you ${isOwn ? "keep" : "buy"} than if you rent.`
      );
    } else {
      bullets.push(
        `Year‑1 monthly housing cash is similar either way (~${money(f.ownerMonthlyY1)} vs ~${money(f.renterMonthlyY1)}).`
      );
    }

    try {
      const lever = Physics.topSensitivityLever(result.inputs);
      if (lever && lever.swing > 1000) {
        bullets.push(
          `Biggest lever nearby: <strong>${lever.label}</strong> (advantage swings ~${moneyCompact(lever.swing)} between low and high).`
        );
      }
    } catch (_) {
      /* sensitivity optional for story */
    }

    host.innerHTML = bullets.map((b) => `<li>${b}</li>`).join("");
  }

  function renderOwnSnapshot(result) {
    const el = $("own-snapshot");
    if (!el) return;
    if (result.scenarioMode !== "own" || !result.ownSnapshot) {
      el.innerHTML = "";
      return;
    }
    const s = result.ownSnapshot;
    el.innerHTML =
      `<div class="snap-item"><span>Bought</span><strong>${money(s.purchasePrice)} · ${s.yearsOwned} yr ago</strong></div>` +
      `<div class="snap-item"><span>Equity now (pre-sale)</span><strong>${money(s.currentValue - s.loanBalance)}</strong></div>` +
      `<div class="snap-item"><span>Net if sell today</span><strong>${money(s.netSaleProceeds)}</strong></div>` +
      (s.gainsTax > 0
        ? `<div class="snap-item"><span>Est. gains tax</span><strong>${money(s.gainsTax)}</strong></div>`
        : "");
  }

  function renderLoanReadout(result) {
    const el = $("loan-readout");
    if (!el) return;
    if (result.scenarioMode === "own") {
      el.innerHTML =
        `Remaining loan <strong>${money(result.loanAmount)}</strong> · ` +
        `P&amp;I <strong>${money(result.monthlyPayment, 0)}/mo</strong>` +
        (result.pmiMonths
          ? ` · PMI active ~${Math.ceil(result.pmiMonths / 12)} yr`
          : " · No PMI modeled") +
        ` · Tax shield ${result.inputs.useTaxShield ? "on" : "off"}`;
      return;
    }
    el.innerHTML =
      `Loan <strong>${money(result.loanAmount)}</strong> · ` +
      `P&amp;I <strong>${money(result.monthlyPayment, 0)}/mo</strong>` +
      (result.pmiMonths
        ? ` · PMI active ~${Math.ceil(result.pmiMonths / 12)} yr`
        : " · No PMI") +
      ` · Tax shield ${result.inputs.useTaxShield ? "on" : "off"}`;
  }

  function renderBreakdown(result) {
    const host = $("breakdown-grid");
    if (!host) return;
    const b = result.breakdown;
    const isOwn = result.scenarioMode === "own";
    const items = isOwn
      ? [
          { label: "Net proceeds if sold today", value: b.saleProceedsToday, highlight: true },
          { label: "Selling costs (today)", value: b.sellCostToday },
          { label: "Gains tax (today)", value: b.gainsTaxToday },
          { label: "Interest paid (keep)", value: b.interest },
          { label: "Principal paid (keep)", value: b.principal, muted: true },
          { label: "Property tax", value: b.propertyTax },
          { label: "Home insurance", value: b.insurance },
          { label: "HOA", value: b.hoa },
          { label: "Maintenance", value: b.maintenance },
          { label: "PMI", value: b.pmi },
          { label: "Tax shield saved", value: -b.taxShield, highlight: true },
          { label: "Selling costs (exit keep)", value: b.sellingCosts },
          { label: "Rent paid (if sold)", value: b.rent },
          { label: "Renter insurance", value: b.renterInsurance },
          { label: "Security deposit", value: b.securityDeposit, muted: true }
        ]
      : [
          { label: "Down payment", value: b.downPayment, highlight: true },
          { label: "Closing costs", value: b.closingCosts },
          { label: "Interest paid", value: b.interest },
          { label: "Principal paid", value: b.principal, muted: true },
          { label: "Property tax", value: b.propertyTax },
          { label: "Home insurance", value: b.insurance },
          { label: "HOA", value: b.hoa },
          { label: "Maintenance", value: b.maintenance },
          { label: "PMI", value: b.pmi },
          { label: "Tax shield saved", value: -b.taxShield, highlight: true },
          { label: "Selling costs (exit)", value: b.sellingCosts },
          { label: "Rent paid", value: b.rent },
          { label: "Renter insurance", value: b.renterInsurance },
          { label: "Security deposit", value: b.securityDeposit, muted: true }
        ];
    host.innerHTML = items
      .map(
        (it) =>
          `<div class="break-item${it.highlight ? " highlight" : ""}${it.muted ? " muted" : ""}">` +
          `<span class="bl">${it.label}</span>` +
          `<span class="bv">${money(it.value, 0)}</span></div>`
      )
      .join("");
  }

  function renderSensitivity(result) {
    const sens = Physics.sensitivityAround(result.inputs);
    const tbody = document.querySelector("#sensitivity-table tbody");
    if (!tbody) return;
    tbody.innerHTML = sens.rows
      .map((row) => {
        const lowCls = row.lowAdvantage >= 0 ? "pos" : "neg";
        const highCls = row.highAdvantage >= 0 ? "pos" : "neg";
        const baseCls = row.baseAdvantage >= 0 ? "pos" : "neg";
        const fmtVal = (k, v) =>
          k === "rentMonthly" ? money(v, 0) : Number(v).toFixed(1) + (k === "rentMonthly" ? "" : "%");
        return (
          `<tr>` +
          `<td>${row.label}</td>` +
          `<td class="${lowCls}">${moneyCompact(row.lowAdvantage)} <span style="opacity:.65;font-size:10px">(${fmtVal(row.key, row.low)})</span></td>` +
          `<td class="${baseCls}">${moneyCompact(row.baseAdvantage)}</td>` +
          `<td class="${highCls}">${moneyCompact(row.highAdvantage)} <span style="opacity:.65;font-size:10px">(${fmtVal(row.key, row.high)})</span></td>` +
          `</tr>`
        );
      })
      .join("");

    const ind = Physics.indifferentRent(result.inputs);
    const box = $("indifferent-box");
    if (box) {
      const isOwn = result.scenarioMode === "own";
      if (ind.found === false && ind.rentMonthly === 0) {
        box.innerHTML = isOwn
          ? "With these assumptions, <strong>keeping still wins even at $0 rent</strong> over the horizon."
          : "With these assumptions, <strong>buying still wins even at $0 rent</strong> over the horizon (after sale costs). Opportunity cost of the down payment isn’t enough to offset equity growth.";
      } else {
        box.innerHTML =
          `Indifference rent: if monthly rent were about <strong>${money(ind.rentMonthly, 0)}</strong>, ` +
          `${isOwn ? "keep and sell&rent" : "buy and rent"} end roughly even at year ${result.inputs.horizonYears} ` +
          `(model residual ${money(ind.advantage, 0)}). ` +
          `Your rent is <strong>${money(result.inputs.rentMonthly, 0)}</strong>.`;
      }
    }
  }

  function renderYearly(result) {
    const tbody = document.querySelector("#yearly-table tbody");
    if (!tbody) return;
    tbody.innerHTML = result.yearly
      .map((y) => {
        const advCls = y.advantageIfSold >= 0 ? "pos" : "neg";
        return (
          `<tr>` +
          `<td>Y${y.year}</td>` +
          `<td>${money(y.homeValue, 0)}</td>` +
          `<td>${money(y.loanBalance, 0)}</td>` +
          `<td>${money(y.ownerNetWorthIfSold, 0)}</td>` +
          `<td>${money(y.renterNetWorth, 0)}</td>` +
          `<td class="${advCls}">${money(y.advantageIfSold, 0)}</td>` +
          `<td>${money(y.yearOwnerCash, 0)}</td>` +
          `<td>${money(y.yearRenterCash, 0)}</td>` +
          `</tr>`
        );
      })
      .join("");
  }

  function renderCharts(result) {
    const buyColor = getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim() || "#0d9488";
    const rentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent-secondary").trim() || "#2563eb";

    const marker = loanTermMarker(result);
    updateLoanLegend(marker);
    const markers = marker && marker.onChart
      ? [{ x: marker.x, label: marker.label, color: marker.color, dash: [5, 4] }]
      : [];

    drawLineChart(
      $("chart-wealth"),
      [
        {
          color: buyColor,
          points: result.yearly.map((y) => ({ x: y.year, y: y.ownerNetWorthIfSold }))
        },
        {
          color: rentColor,
          points: result.yearly.map((y) => ({ x: y.year, y: y.renterNetWorth }))
        }
      ],
      { height: 280, markers }
    );

    drawLineChart(
      $("chart-cash"),
      [
        {
          color: buyColor,
          points: result.yearly.map((y) => ({ x: y.year, y: y.yearOwnerCash }))
        },
        {
          color: rentColor,
          points: result.yearly.map((y) => ({ x: y.year, y: y.yearRenterCash }))
        }
      ],
      { height: 220, markers }
    );
  }

  function recalculate() {
    const inputs = getInputs();
    const result = Physics.simulate(inputs);
    lastResult = result;
    renderVerdict(result);
    renderOwnSnapshot(result);
    renderLoanReadout(result);
    renderBreakdown(result);
    renderSensitivity(result);
    renderYearly(result);
    renderCharts(result);
    updateFundingReadout();
    updateDualHints();
  }

  function exportCSV() {
    if (!lastResult) recalculate();
    const rows = [
      [
        "year",
        "home_value",
        "loan_balance",
        "owner_nw_if_sold",
        "renter_nw",
        "advantage",
        "owner_cash_year",
        "renter_cash_year",
        "interest_year",
        "principal_year",
        "tax_year",
        "pmi_year",
        "tax_shield_year"
      ]
    ];
    lastResult.yearly.forEach((y) => {
      rows.push([
        y.year,
        y.homeValue.toFixed(2),
        y.loanBalance.toFixed(2),
        y.ownerNetWorthIfSold.toFixed(2),
        y.renterNetWorth.toFixed(2),
        y.advantageIfSold.toFixed(2),
        y.yearOwnerCash.toFixed(2),
        y.yearRenterCash.toFixed(2),
        y.yearInterest.toFixed(2),
        y.yearPrincipal.toFixed(2),
        y.yearTax.toFixed(2),
        y.yearPmi.toFixed(2),
        y.yearTaxShield.toFixed(2)
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-vs-buy-ledger-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const payload = getInputs();
    const blob = new Blob(
      [JSON.stringify({ toolId: TOOL_ID, inputs: payload, result: lastResult && lastResult.final }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-vs-buy-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const inputs = data.inputs || data.payload || data;
        setInputs(inputs);
        refreshDualSteppers();
        activePreset = "custom";
        document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
      } catch (err) {
        alert("Invalid JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  window.shareLink = function shareLink() {
    const inputs = getInputs();
    let design;
    if (window.encodeToolShare) {
      design = window.encodeToolShare(TOOL_ID, inputs);
    } else if (window.ToolExports && window.ToolExports.encodeShare) {
      design = window.ToolExports.encodeShare(TOOL_ID, inputs);
    } else {
      design = btoa(unescape(encodeURIComponent(JSON.stringify(inputs))));
    }
    const url = new URL(window.location.href);
    url.searchParams.set("design", design);
    const link = url.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        () => {
          if (window.showToast) window.showToast("Share link copied", true);
          else alert("Share link copied to clipboard");
        },
        () => prompt("Copy this link:", link)
      );
    } else {
      prompt("Copy this link:", link);
    }
  };

  window.exportJSON = exportJSON;
  window.importJSON = function (e) {
    const f = e && e.target && e.target.files && e.target.files[0];
    importJSON(f);
    if (e && e.target) e.target.value = "";
  };

  window.projectManagerConfig = {
    toolId: "rent-vs-buy",
    getInputs: () => getInputs(),
    setInputs: (data) => {
      setInputs(data || {});
      refreshDualSteppers();
    }
  };

  function onAnyInput() {
    activePreset = "custom";
    document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    updateHorizonLabel();
    // Keep dual fields in sync when home price changes
    DUAL_FIELDS.forEach((d) => syncDualDerived(d.key));
    updateDualHints();
    updateFundingReadout();
    recalculate();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderPresets();
    renderBuckets(Physics.DEFAULT_BUCKETS);
    enhanceNumberSteppers();

    // Dual mode toggles
    document.querySelectorAll(".dual-field").forEach((field) => {
      const key = field.dataset.dual;
      field.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          // Capture current as source of truth before switch
          syncDualDerived(key);
          setDualMode(key, btn.dataset.dualMode, true);
          refreshDualSteppers();
          onAnyInput();
        });
      });
    });

    // Mode control
    document.querySelectorAll("#mode-control .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => setScenarioMode(btn.dataset.mode));
    });

    setInputs(Physics.DEFAULTS, { silent: true, presetId: "default" });
    refreshDualSteppers();

    // URL design
    const params = new URLSearchParams(window.location.search);
    const design = params.get("design");
    if (design) {
      try {
        let decoded = null;
        if (window.decodeToolShare) {
          const res = window.decodeToolShare(design, TOOL_ID);
          if (res.ok) {
            if (res.warning && window.ToolExports) window.ToolExports.showPhysicsWarning(res.warning);
            decoded = res.payload;
          }
        } else {
          decoded = JSON.parse(decodeURIComponent(escape(atob(design))));
        }
        if (decoded) {
          setInputs(decoded, { silent: true });
          refreshDualSteppers();
          activePreset = "custom";
          document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
        }
      } catch (err) {
        console.warn("Failed to load design from URL", err);
      }
    }

    // Wire inputs
    const wireIds = [
      ...SCALAR_IDS,
      "ownHomePrice",
      "ownAnnualRatePct",
      "ownPropertyTaxAnnualPct",
      "ownHomeInsuranceAnnual",
      "ownHoaMonthly",
      "ownMaintenanceAnnualPct",
      "ownPmiAnnualPct",
      "ownAppreciationPct",
      "ownSellingCostPct"
    ];
    wireIds.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", onAnyInput);
    });
    if ($("useTaxShield")) $("useTaxShield").addEventListener("change", onAnyInput);
    if ($("showRealDollars")) {
      $("showRealDollars").addEventListener("change", () => {
        updateInflationUI();
        onAnyInput();
      });
    }
    if ($("useAssetBuckets")) {
      $("useAssetBuckets").addEventListener("change", () => {
        if ($("useAssetBuckets").checked) {
          if ($("assets-advanced")) $("assets-advanced").open = true;
          prefillBucketsIfEmpty();
        }
        updateBucketsPanelVisibility();
        onAnyInput();
      });
    }

    $("btn-export-csv")?.addEventListener("click", exportCSV);
    $("btn-export-json")?.addEventListener("click", exportJSON);
    $("btn-import-json")?.addEventListener("click", () => $("import-file-input")?.click());
    $("import-file-input")?.addEventListener("change", window.importJSON);

    window.addEventListener("resize", () => {
      if (lastResult) renderCharts(lastResult);
    });

    if (window.ToolExports) {
      window.ToolExports.register({
        json: () => exportJSON(),
        import: () => $("import-file-input")?.click(),
        csv: () => exportCSV(),
        hide: ["#btn-export-json", "#btn-import-json"]
      });
      window.ToolExports.mount();
    }

    if (window.ToolShell && typeof window.ToolShell.syncHeaderIcon === "function") {
      const meta = (window.toolsRegistry || []).find((t) => t.id === TOOL_ID);
      window.ToolShell.syncHeaderIcon(meta || TOOL_ID);
    }

    applyModeUI();
    recalculate();

    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  });
})();
