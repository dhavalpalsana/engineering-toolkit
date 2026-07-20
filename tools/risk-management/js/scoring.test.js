/**
 * Golden tests for risk scoring matrix.
 * Run: node --test tools/risk-management/js/scoring.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const S = require("./scoring.js");

describe("computeScore", () => {
  it("5×5 = 25", () => assert.equal(S.computeScore(5, 5), 25));
  it("3×4 = 12", () => assert.equal(S.computeScore(3, 4), 12));
  it("1×1 = 1", () => assert.equal(S.computeScore(1, 1), 1));
  it("missing → 0", () => assert.equal(S.computeScore(null, 3), 0));
  it("string digits", () => assert.equal(S.computeScore("4", "3"), 12));
});

describe("determineLevel thresholds (5×5 matrix)", () => {
  it("score 1–5 → LOW", () => {
    assert.equal(S.determineLevel(1).level, "LOW");
    assert.equal(S.determineLevel(5).level, "LOW");
  });
  it("score 6–11 → MEDIUM", () => {
    assert.equal(S.determineLevel(6).level, "MEDIUM");
    assert.equal(S.determineLevel(11).level, "MEDIUM");
  });
  it("score 12–15 → HIGH", () => {
    assert.equal(S.determineLevel(12).level, "HIGH");
    assert.equal(S.determineLevel(15).level, "HIGH");
  });
  it("score ≥16 → CRITICAL", () => {
    assert.equal(S.determineLevel(16).level, "CRITICAL");
    assert.equal(S.determineLevel(25).level, "CRITICAL");
  });
});

describe("residual + effectiveScore", () => {
  const risk = { severity: 5, probability: 5, residualSeverity: 2, residualProbability: 2 };
  it("inherent 25, residual 4", () => {
    assert.equal(S.computeScore(risk.severity, risk.probability), 25);
    assert.equal(S.residualScore(risk), 4);
  });
  it("effective residual mode uses residual", () => {
    assert.equal(S.effectiveScore(risk, "residual"), 4);
    assert.equal(S.effectiveScore(risk, "inherent"), 25);
  });
  it("no residual falls back to inherent", () => {
    assert.equal(S.effectiveScore({ severity: 4, probability: 3 }, "residual"), 12);
  });
});

describe("parseJiraKey", () => {
  it("extracts PROJ-123", () => {
    assert.equal(S.parseJiraKey("https://jira.example.com/browse/PROJ-123"), "PROJ-123");
  });
  it("null on empty", () => assert.equal(S.parseJiraKey(""), null));
});
