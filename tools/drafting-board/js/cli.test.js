// ==========================================================================
// Explicit 2D CAD Command CLI Test Suite (Phase 3)
// Verification of Cartesian and polar coordinates parsing calculations
// ==========================================================================

const { parseCoordinateInput, processCommandText } = require("./cli.js");

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// ── TEST SUITE ──

runTest("Absolute Cartesian Coordinate Parsing", () => {
  const result = parseCoordinateInput("100.5,200", null);
  assert(result !== null, "Failed to parse absolute coordinate");
  assert(result.x === 101 && result.y === 200, `Expected (101, 200), got (${result.x}, ${result.y})`);
});

runTest("Relative Cartesian Offset Parsing", () => {
  const lastPt = { x: 50, y: 120 };
  const result = parseCoordinateInput("@10,-30", lastPt);
  assert(result !== null, "Failed to parse relative coordinate");
  assert(result.x === 60 && result.y === 90, `Expected (60, 90), got (${result.x}, ${result.y})`);
});

runTest("Relative Polar Offset Parsing (Polar Angle Math)", () => {
  const lastPt = { x: 10, y: 20 };
  // 100 distance at 30 degrees angle
  // X = 10 + 100 * cos(30 deg) = 10 + 100 * 0.866 = 96.6 -> 97
  // Y = 20 + 100 * sin(30 deg) = 20 + 100 * 0.500 = 70 -> 70
  const result = parseCoordinateInput("@100<30", lastPt);
  assert(result !== null, "Failed to parse polar coordinate");
  assert(result.x === 97 && result.y === 70, `Expected (97, 70), got (${result.x}, ${result.y})`);
});

runTest("Polar Angle Bounds and Negatives", () => {
  const lastPt = { x: 100, y: 100 };
  // 50 distance at -90 degrees (straight down)
  // X = 100, Y = 100 - 50 = 50
  const result = parseCoordinateInput("@50<-90", lastPt);
  assert(result !== null, "Failed to parse negative angle polar coordinate");
  assert(result.x === 100 && result.y === 50, `Expected (100, 50), got (${result.x}, ${result.y})`);
});

console.log("All Command CLI and Polar Parser unit tests passed successfully!");
