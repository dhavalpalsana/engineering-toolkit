// ==========================================================================
// 2D CAD Geometric Constraint Solver Test Suite
// Verification of mathematical convergence and constraint resolution
// ==========================================================================

const { Variable, Constraint, solveConstraints } = require("./solver.js");

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

// Helper to assert value closeness
function assertClose(actual, expected, tolerance = 1e-6) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Expected close to ${expected}, but got ${actual}`);
  }
}

// ── TEST SUITE ──

runTest("Point Coincidence Constraint", () => {
  // P1 is fixed at (10, 20), P2 is free starting at (100, 200)
  const vars = [
    new Variable("x1", 10, false), // P1
    new Variable("y1", 20, false),
    new Variable("x2", 100, true), // P2
    new Variable("y2", 200, true)
  ];
  
  const constraints = [
    new Constraint("coincident", [0, 1, 2, 3])
  ];

  const success = solveConstraints(vars, constraints);
  
  assertClose(success, true);
  assertClose(vars[2].value, 10);
  assertClose(vars[3].value, 20);
});

runTest("Horizontal & Distance Constraints", () => {
  // Line segment P1 -> P2
  // P1 fixed at (50, 50). P2 starts at (150, 100).
  // Constrained to be Horizontal, and length = 120.
  const vars = [
    new Variable("x1", 50, false),
    new Variable("y1", 50, false),
    new Variable("x2", 150, true),
    new Variable("y2", 100, true)
  ];

  const constraints = [
    new Constraint("horizontal", [1, 3]),
    new Constraint("distance", [0, 1, 2, 3], { d: 120 })
  ];

  const success = solveConstraints(vars, constraints);

  assertClose(success, true);
  assertClose(vars[3].value, 50); // Horizontal (y2 = y1)
  assertClose(vars[2].value, 170); // x2 = x1 + 120
});

runTest("Perpendicularity & Line Lengths (SolidWorks-grade test)", () => {
  // Verification Metric: Three-segment structure P1 -> P2 -> P3
  // P1 fixed at (0, 0)
  // Segment 1 (P1 -> P2): Length 120, Horizontal
  // Segment 2 (P2 -> P3): Length 120, Perpendicular to Segment 1
  const vars = [
    new Variable("x1", 0, false),
    new Variable("y1", 0, false),
    new Variable("x2", 100, true),
    new Variable("y2", 10, true),
    new Variable("x3", 110, true),
    new Variable("y3", 110, true)
  ];

  const constraints = [
    new Constraint("horizontal", [1, 3]),
    new Constraint("distance", [0, 1, 2, 3], { d: 120 }),
    new Constraint("distance", [2, 3, 4, 5], { d: 120 }),
    new Constraint("perpendicular", [0, 1, 2, 3, 2, 3, 4, 5])
  ];

  const success = solveConstraints(vars, constraints);

  assertClose(success, true);
  
  // P2 should be at (120, 0)
  assertClose(vars[2].value, 120);
  assertClose(vars[3].value, 0);

  // P3 should be perpendicular, length 120. (Since P1->P2 is horizontal, P2->P3 must be vertical, so x3 = 120, y3 = 120 or -120)
  assertClose(vars[4].value, 120);
  assertClose(Math.abs(vars[5].value), 120);
});

runTest("Circle Tangency Constraint", () => {
  // Line segment P1 -> P2 is horizontal at y = 100 (fixed)
  // Circle center (cx, cy) is free, radius r = 30 (fixed)
  // Center starts at (50, 150), should solve to y = 130 or 70 (tangent to line)
  const vars = [
    new Variable("x1", 0, false),
    new Variable("y1", 100, false),
    new Variable("x2", 200, false),
    new Variable("y2", 100, false),
    
    new Variable("cx", 50, true),
    new Variable("cy", 150, true),
    new Variable("r", 30, false)
  ];

  const constraints = [
    new Constraint("tangent", [0, 1, 2, 3, 4, 5, 6])
  ];

  const success = solveConstraints(vars, constraints);

  assertClose(success, true);
  // Perpendicular distance to y=100 should be 30.
  const solvedCy = vars[5].value;
  const dist = Math.abs(solvedCy - 100);
  assertClose(dist, 30);
});

console.log("All constraints solver unit tests passed successfully!");
