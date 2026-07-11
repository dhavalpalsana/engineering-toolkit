// ==========================================================================
// Explicit 2D CAD DXF Database Test Suite (Phase 1)
// Verification of parsing accuracy, R2007 formatting, and round-trip fidelity
// ==========================================================================

const { DxfDatabase } = require("./dxf.js");

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

runTest("DXF Database Layer Creation", () => {
  const db = new DxfDatabase();
  db.addLayer("Hidden", 1, "DASHED");
  
  assert(db.layers["Hidden"] !== undefined, "Hidden layer was not created");
  assert(db.layers["Hidden"].color === 1, "Layer color mismatch");
  assert(db.layers["Hidden"].linetype === "DASHED", "Layer linetype mismatch");
});

runTest("ASCII DXF Parsing (Line and Circle)", () => {
  const db = new DxfDatabase();
  const mockDxf = `
  0
SECTION
  2
TABLES
  0
TABLE
  2
LAYER
  70
2
  0
LAYER
  2
Hidden
  62
1
  6
DASHED
  0
ENDTAB
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
LINE
  8
Hidden
 10
10.0
 20
20.0
 11
100.0
 21
200.0
  0
CIRCLE
  8
0
 10
50.0
 20
50.0
 40
15.0
  0
ENDSEC
  0
EOF
`;

  db.parse(mockDxf);

  // Assertions
  assert(db.layers["Hidden"] !== undefined, "Failed to parse layers");
  assert(db.layers["Hidden"].color === 1, "Incorrect layer color");
  assert(db.entities.length === 2, `Expected 2 entities, got ${db.entities.length}`);
  
  const line = db.entities[0];
  assert(line.type === "LINE", "First entity should be a LINE");
  assert(line.x1 === 10 && line.y1 === 20 && line.x2 === 100 && line.y2 === 200, "LINE coordinates parsed incorrectly");
  assert(line.layer === "Hidden", "LINE layer parsed incorrectly");

  const circle = db.entities[1];
  assert(circle.type === "CIRCLE", "Second entity should be a CIRCLE");
  assert(circle.cx === 50 && circle.cy === 50 && circle.r === 15, "CIRCLE properties parsed incorrectly");
});

runTest("DXF Serialization Round-trip Fidelity", () => {
  const db1 = new DxfDatabase();
  db1.addLayer("Dimensions", 3, "CONTINUOUS");
  db1.entities.push({
    type: "LINE",
    layer: "Dimensions",
    x1: 5.5, y1: 12.0, x2: 50.0, y2: 88.5
  });
  db1.entities.push({
    type: "CIRCLE",
    layer: "0",
    cx: 120, cy: 150, r: 25
  });

  // Export to string
  const dxfStr = db1.export();

  // Parse back in second database instance
  const db2 = new DxfDatabase();
  db2.parse(dxfStr);

  // Assertions for layer preservation
  assert(db2.layers["Dimensions"] !== undefined, "Export/Import failed to preserve layers");
  assert(db2.layers["Dimensions"].color === 3, "Layer color altered during export");

  // Assertions for entity coordinates
  assert(db2.entities.length === 2, "Export/Import lost entities");
  
  const line = db2.entities[0];
  assert(line.x1 === 5.5 && line.y1 === 12.0 && line.x2 === 50.0 && line.y2 === 88.5, "LINE coordinates corrupted during round-trip");
  
  const circle = db2.entities[1];
  assert(circle.cx === 120 && circle.cy === 150 && circle.r === 25, "CIRCLE properties corrupted during round-trip");
});

console.log("All DXF Database and File Pipeline unit tests passed successfully!");
