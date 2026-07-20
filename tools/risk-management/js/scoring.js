/**
 * Risk scoring pure helpers (browser + Node).
 * physicsVersion: keep in sync with tools-data.js risk-management entry.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RiskScoring = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** CRITICAL ≥ 16, HIGH ≥ 12, MEDIUM ≥ 6, else LOW */
  const RISK_THRESHOLDS = { critical: 16, high: 12, medium: 6 };

  function computeScore(severity, probability) {
    const s = parseInt(severity, 10) || 0;
    const p = parseInt(probability, 10) || 0;
    return s * p;
  }

  function determineLevel(score) {
    const n = Number(score) || 0;
    if (n >= RISK_THRESHOLDS.critical) {
      return { level: "CRITICAL", color: "#e11d48", cssClass: "badge-critical" };
    }
    if (n >= RISK_THRESHOLDS.high) {
      return { level: "HIGH", color: "#ef4444", cssClass: "badge-high" };
    }
    if (n >= RISK_THRESHOLDS.medium) {
      return { level: "MEDIUM", color: "#f59e0b", cssClass: "badge-medium" };
    }
    return { level: "LOW", color: "#10b981", cssClass: "badge-low" };
  }

  function getCellLevel(score) {
    const n = Number(score) || 0;
    if (n >= RISK_THRESHOLDS.critical) return "level-critical";
    if (n >= RISK_THRESHOLDS.high) return "level-high";
    if (n >= RISK_THRESHOLDS.medium) return "level-medium";
    return "level-low";
  }

  function hasResidual(r) {
    if (!r) return false;
    const s = parseInt(r.residualSeverity, 10);
    const p = parseInt(r.residualProbability, 10);
    return !!(s && p);
  }

  function residualScore(r) {
    if (!hasResidual(r)) return null;
    return parseInt(r.residualSeverity, 10) * parseInt(r.residualProbability, 10);
  }

  function effectiveScore(r, mode) {
    if (mode === "residual" && hasResidual(r)) return residualScore(r);
    return computeScore(r && r.severity, r && r.probability);
  }

  function parseJiraKey(url) {
    if (!url) return null;
    const m = String(url).match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
    return m ? m[1] : null;
  }

  return {
    RISK_THRESHOLDS,
    computeScore,
    determineLevel,
    getCellLevel,
    hasResidual,
    residualScore,
    effectiveScore,
    parseJiraKey
  };
});
