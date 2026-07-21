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
  const INPUT_IDS = [
    "homePrice",
    "downPaymentPct",
    "closingCostPct",
    "annualRatePct",
    "loanTermYears",
    "propertyTaxAnnualPct",
    "homeInsuranceAnnual",
    "hoaMonthly",
    "maintenanceAnnualPct",
    "pmiAnnualPct",
    "appreciationPct",
    "sellingCostPct",
    "rentMonthly",
    "rentGrowthPct",
    "renterInsuranceAnnual",
    "securityDepositMonths",
    "investReturnPct",
    "marginalTaxPct",
    "horizonYears"
  ];

  const $ = (id) => document.getElementById(id);

  let activePreset = "default";
  let lastResult = null;

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

  function getInputs() {
    const raw = {};
    INPUT_IDS.forEach((id) => {
      const el = $(id);
      if (!el) return;
      raw[id] = parseFloat(el.value);
    });
    raw.useTaxShield = !!($("useTaxShield") && $("useTaxShield").checked);
    return raw;
  }

  function setInputs(data, opts = {}) {
    if (!data || typeof data !== "object") return;
    const merged = Physics.mergeInputs(data);
    INPUT_IDS.forEach((id) => {
      const el = $(id);
      if (!el || merged[id] == null) return;
      el.value = merged[id];
    });
    if ($("useTaxShield")) {
      $("useTaxShield").checked = merged.useTaxShield !== false;
    }
    if (opts.presetId) activePreset = opts.presetId;
    updateHorizonLabel();
    if (!opts.silent) recalculate();
  }

  function updateHorizonLabel() {
    const y = parseInt(($("horizonYears") || {}).value, 10) || 10;
    const lab = $("horizon-label");
    if (lab) lab.textContent = y + (y === 1 ? " year" : " years");
    const m = $("metric-horizon");
    if (m) m.textContent = y + " yr";
  }

  /** Decimal-safe step for number inputs (avoids 0.1 + 0.2 float noise). */
  function stepNumberInput(input, direction) {
    if (!input || input.disabled) return;
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

  /** Wrap form number fields with compact up/down buttons. */
  function enhanceNumberSteppers() {
    const chevronUp =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
    const chevronDown =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

    document.querySelectorAll(".form-grid label.field input[type='number']").forEach((input) => {
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

      // Click / hold-to-repeat (mousedown handles both single step and repeat)
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
    });
  }

  function applyPreset(id) {
    const p = Physics.PRESETS[id] || Physics.PRESETS.default;
    activePreset = id;
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === id);
    });
    setInputs(p, { presetId: id });
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

    const pad = { t: 16, r: 16, b: 28, l: 56 };
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

    // Grid
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

    // X labels
    const xTicks = Math.min(6, Math.round(xMax - xMin) || 1);
    for (let i = 0; i <= xTicks; i++) {
      const xv = xMin + ((xMax - xMin) * i) / xTicks;
      const xx = xOf(xv);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(Math.round(xv)), xx, pad.t + h + 8);
    }

    // Zero line
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.45)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, yOf(0));
      ctx.lineTo(pad.l + w, yOf(0));
      ctx.stroke();
      ctx.setLineDash([]);
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
      // Points
      ctx.fillStyle = s.color;
      s.points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(xOf(p.x), yOf(p.y), 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function renderVerdict(result) {
    const bar = $("verdict-bar");
    const badge = $("verdict-badge");
    const title = $("verdict-title");
    const sub = $("verdict-sub");
    const f = result.final;
    const years = result.inputs.horizonYears;

    bar.classList.remove("win-buy", "win-rent", "win-tie");
    if (f.winner === "buy") {
      bar.classList.add("win-buy");
      badge.textContent = "Buy ahead";
      title.textContent = `Buying builds ${money(f.advantage)} more wealth in ${years} years`;
    } else if (f.winner === "rent") {
      bar.classList.add("win-rent");
      badge.textContent = "Rent ahead";
      title.textContent = `Renting builds ${money(-f.advantage)} more wealth in ${years} years`;
    } else {
      bar.classList.add("win-tie");
      badge.textContent = "Roughly even";
      title.textContent = `Rent and buy end within ${money(Math.abs(f.advantage))} after ${years} years`;
    }

    const be =
      f.breakEvenYear != null
        ? `Break-even for owning (after sale costs): year ${f.breakEvenYear}.`
        : "Owning does not catch renting within this horizon (after sale costs).";

    sub.textContent =
      `Same starting cash (${money(result.downPayment + result.closingCosts)} down + closing). ` +
      `Buy monthly cash ~${money(f.ownerMonthlyY1)} yr‑1 avg · Rent ~${money(f.renterMonthlyY1)}. ` +
      be;

    $("metric-buy-nw").textContent = moneyCompact(f.ownerNetWorth);
    $("metric-rent-nw").textContent = moneyCompact(f.renterNetWorth);
    $("metric-be").textContent = f.breakEvenYear != null ? `Year ${f.breakEvenYear}` : "Beyond horizon";
    $("metric-horizon").textContent = years + " yr";
  }

  function renderLoanReadout(result) {
    const el = $("loan-readout");
    if (!el) return;
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
    const items = [
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
      if (ind.found === false && ind.rentMonthly === 0) {
        box.innerHTML =
          "With these assumptions, <strong>buying still wins even at $0 rent</strong> over the horizon (after sale costs). Opportunity cost of the down payment isn’t enough to offset equity growth.";
      } else {
        box.innerHTML =
          `Indifference rent: if monthly rent were about <strong>${money(ind.rentMonthly, 0)}</strong>, ` +
          `buy and rent end roughly even at year ${result.inputs.horizonYears} ` +
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
      { height: 280 }
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
      { height: 220 }
    );
  }

  function recalculate() {
    const inputs = getInputs();
    const result = Physics.simulate(inputs);
    lastResult = result;
    renderVerdict(result);
    renderLoanReadout(result);
    renderBreakdown(result);
    renderSensitivity(result);
    renderYearly(result);
    renderCharts(result);
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
    const blob = new Blob([JSON.stringify({ toolId: TOOL_ID, inputs: payload, result: lastResult && lastResult.final }, null, 2)], {
      type: "application/json"
    });
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
    setInputs: (data) => setInputs(data || {})
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderPresets();
    enhanceNumberSteppers();

    // Defaults
    setInputs(Physics.DEFAULTS, { silent: true, presetId: "default" });

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
          activePreset = "custom";
          document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
        }
      } catch (err) {
        console.warn("Failed to load design from URL", err);
      }
    }

    INPUT_IDS.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        activePreset = "custom";
        document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
        if (id === "horizonYears") updateHorizonLabel();
        recalculate();
      });
    });
    if ($("useTaxShield")) {
      $("useTaxShield").addEventListener("change", recalculate);
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

    recalculate();

    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  });
})();
