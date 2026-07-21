/**
 * tools-data.js — Single source of truth for all tools in the registry.
 * Add, remove, or update tools here. registry.js reads this array.
 *
 * Statuses: "active" | "beta" | "coming-soon"
 */
const TOOLS_DATA = [
  {
    id: "fishbone-diagram",
    name: "Ishikawa Fishbone Diagram Creator",
    description: "Visualize cause-and-effect relationships with interactive diagrams, templates, dynamic layouts, and SVG/PNG exports.",
    tags: ["management", "quality", "root-cause", "ishikawa", "lean", "six-sigma", "engineering"],
    icon: "fishbone",
    path: "./tools/fishbone-diagram/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-03T12:00:00Z"
  },
  {
    id: "wire-gauge",
    name: "Dynamic Cable Thermal & Loss Solver",
    description: "Evaluate multi-segment thermodynamic conditions and electrodynamic voltage drops for series electrical cables.",
    tags: ["electrical", "awg", "nec", "power", "cable", "thermal", "thermodynamics"],
    icon: "zap",
    path: "./tools/wire-gauge/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-04T12:00:00Z"
  },
  {
    id: "unit-converter",
    name: "Engineering Unit Converter",
    description: "Convert between 23 categories of engineering units: pressure, torque, temperature, energy, power, density, velocity, volume flow, viscosity, thermal conductivity, and more. Live search, instant bidirectional conversion, and copy-to-clipboard.",
    tags: ["general", "conversion", "units", "pressure", "temperature", "torque", "energy"],
    icon: "refresh-cw",
    path: "./tools/unit-converter/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-05T12:00:00Z"
  },
  {
    id: "busbar-sizing",
    name: "Busbar Capacity Calculator",
    description: "Full physics-based busbar design: thermal current capacity (CDA method), AC skin effect, multi-bar derating, IEC 60865-1 short-circuit rating, mechanical deflection, and voltage drop. Copper and aluminium.",
    tags: ["electrical", "busbar", "copper", "aluminium", "switchgear", "short-circuit", "IEC", "thermal"],
    icon: "busbar",
    path: "./tools/busbar-sizing/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-06T12:00:00Z"
  },
  {
    id: "can-bus-designer",
    name: "CAN Bus Harness Designer & Analyzer",
    description: "Design and verify CAN wire harnesses: model nodes, spacing, stubs, and terminations. Performs speed-based physical layer compliance checks and estimates signal integrity / reflection risks.",
    tags: ["electrical", "automotive", "can", "signal-integrity", "physics", "harness"],
    icon: "network",
    path: "./tools/can-bus-designer/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-07T12:00:00Z"
  },
  {
    id: "mosfet-power-loss",
    name: "MOSFET Power Loss Calculator & Comparator",
    description: "Physics-based semiconductor power loss modeler. Calculate and compare conduction, switching, gate charge, dead-time, and Coss losses side-by-side for multiple devices.",
    tags: ["electrical", "semiconductor", "power-electronics", "mosfet", "thermal", "efficiency"],
    icon: "mosfet",
    path: "./tools/mosfet-power-loss/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-14T16:00:00Z"
  },
  {
    id: "plot-extractor",
    name: "Plot Data Extractor",
    description: "Full plot digitizer: XY/bar/histogram/polar/ternary/pie/map, time & multi-scale axes, image prep, mask + autotrace suite, measurements, multi-series, regression, CSV.",
    tags: ["general", "math", "curve-fitting", "plot", "digitizer", "data-extraction", "time-series", "bar-chart", "autotrace", "polar"],
    icon: "line-chart",
    path: "./tools/plot-extractor/index.html",
    status: "active",
    physicsVersion: 3,
    releaseDate: "2026-07-08T21:10:00Z"
  },
  {
    id: "code-scanner",
    name: "Barcode & 2D Code Scanner",
    description: "Scan and decode 1D/2D codes (QR, Barcode, DataMatrix, Aztec) from a live camera feed, local image files, or directly pasted from your clipboard.",
    tags: ["general", "barcode", "qr", "scanner", "utility", "datamatrix"],
    icon: "scan",
    path: "./tools/code-scanner/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-08T23:40:00Z"
  },
  {
    id: "timezone-converter",
    name: "Visual Timezone & Julian Date Converter",
    description: "Interactive timezone planner with scrolling day/night visual timelines, linking UTC, local zones, and precise Julian / Modified Julian date conversions.",
    tags: ["general", "time", "timezone", "utc", "julian-date", "planner", "astronomy"],
    icon: "clock",
    path: "./tools/timezone-converter/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-08T23:50:00Z"
  },
  {
    id: "drafting-board",
    name: "2D Engineering Drafting Board",
    description: "Draw parts, blueprints, and layouts with vector snapping, dimension annotations, and distance meters. Saves drawings to your cloud account to load into solvers.",
    tags: ["mechanical", "civil", "cad", "drafting", "vector", "blueprint"],
    icon: "ruler",
    path: "./tools/drafting-board/index.html",
    status: "beta",
    physicsVersion: 1,
    releaseDate: "2026-07-10T11:30:00Z"
  },
  {
    id: "mcc-feeder-designer",
    name: "MCC Feeder & Motor Starter Designer",
    description: "Design Single Line Diagrams of Motor Control Centers. Drag & drop DOL starters, VFDs, soft starters, and cables, with real-time automatic sizing and compliance checks.",
    tags: ["electrical", "mcc", "motor", "vfd", "dol", "cable", "sizing", "schematic"],
    icon: "grid-3x3",
    path: "./tools/mcc-feeder-designer/index.html",
    status: "beta",
    physicsVersion: 1,
    releaseDate: "2026-07-10T14:00:00Z"
  },
  {
    id: "beam-calculator",
    name: "Structural Beam Solver & Designer",
    description: "Analyze simply supported or cantilever beams with custom materials, cross-sections, and loads. Solves for reactions, shear, bending moment, deflection, and stress, with live 2D interactive diagrams.",
    tags: ["mechanical", "civil", "structural", "beam", "mechanics", "fea"],
    icon: "activity",
    path: "./tools/beam-calculator/index.html",
    status: "beta",
    physicsVersion: 1,
    releaseDate: "2026-07-09T22:00:00Z"
  },
  {
    id: "heatsink-simulator",
    name: "3D Heat Sink Simulator",
    description: "Design and simulate parametric finned heat sinks in 3D. Define thermal interfaces (TIM), custom materials, heat sources, and run real-time local steady-state or transient simulations.",
    tags: ["mechanical", "thermal", "heatsink", "simulation", "heat-transfer", "cfd"],
    icon: "thermometer",
    path: "./tools/heatsink-simulator/index.html",
    status: "active",
    physicsVersion: 1,
    releaseDate: "2026-07-09T03:00:00Z"
  },
  {
    id: "bolt-torque",
    name: "Bolt Torque & Tension Calculator",
    description: "Determine target bolt torque, preload tension, and friction coefficient adjustments for mechanical design.",
    tags: ["mechanical", "bolt", "torque", "thread", "fastener"],
    icon: "wrench",
    path: "./tools/bolt-torque/index.html",
    status: "coming-soon",
    physicsVersion: 1,
    releaseDate: "2026-07-02T12:00:00Z"
  },
  {
    id: "pressure-drop",
    name: "Pipe Pressure Drop & Flow Calculator",
    description: "Calculate fluid flow rate, velocity, Reynolds number, and friction pressure drops using the Darcy-Weisbach equation.",
    tags: ["fluids", "hydraulics", "pipe", "flow", "pressure"],
    icon: "droplet",
    path: "./tools/pressure-drop/index.html",
    status: "coming-soon",
    physicsVersion: 1,
    releaseDate: "2026-07-01T12:00:00Z"
  },
  {
    id: "risk-management",
    name: "Risk Management Dashboard",
    description: "Capture, score and visualise project risks. Heat‑map, category view, top‑5 risks and weekly trends.",
    tags: ["management", "risk", "analytics", "heatmap"],
    icon: "shield-alert",
    path: "./tools/risk-management/index.html",
    status: "beta",
    physicsVersion: 1,
    releaseDate: "2026-07-14T12:00:00Z"
  }

];
