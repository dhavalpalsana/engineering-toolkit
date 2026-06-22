/**
 * tools-data.js — Single source of truth for all tools in the registry.
 * Add, remove, or update tools here. registry.js reads this array.
 *
 * Statuses: "active" | "coming-soon"
 */
const TOOLS_DATA = [
  {
    id: "fishbone-diagram",
    name: "Ishikawa Fishbone Diagram Creator",
    description: "Visualize cause-and-effect relationships with interactive diagrams, templates, dynamic layouts, exports, and AI brainstorm assistance.",
    tags: ["management", "quality", "root-cause", "ishikawa", "lean", "six-sigma", "engineering"],
    icon: "fishbone",
    path: "./tools/fishbone-diagram/index.html",
    status: "active"
  },
  {
    id: "wire-gauge",
    name: "Dynamic Cable Thermal & Loss Solver",
    description: "Evaluate multi-segment thermodynamic conditions and electrodynamic voltage drops for series electrical cables.",
    tags: ["electrical", "awg", "nec", "power", "cable", "thermal", "thermodynamics"],
    icon: "zap",
    path: "./tools/wire-gauge/index.html",
    status: "active"
  },
  {
    id: "unit-converter",
    name: "Engineering Unit Converter",
    description: "Convert between 23 categories of engineering units: pressure, torque, temperature, energy, power, density, velocity, volume flow, viscosity, thermal conductivity, and more. Live search, instant bidirectional conversion, and copy-to-clipboard.",
    tags: ["general", "conversion", "units", "pressure", "temperature", "torque", "energy"],
    icon: "refresh-cw",
    path: "./tools/unit-converter/index.html",
    status: "active"
  },
  {
    id: "busbar-sizing",
    name: "Busbar Capacity Calculator",
    description: "Determine current capacity, temperature rise, and mechanical forces for rectangular copper and aluminum busbars.",
    tags: ["electrical", "busbar", "copper", "aluminum", "switchgear"],
    icon: "layers",
    path: "./tools/busbar-sizing/index.html",
    status: "coming-soon"
  },
  {
    id: "bolt-torque",
    name: "Bolt Torque & Tension Calculator",
    description: "Determine target bolt torque, preload tension, and friction coefficient adjustments for mechanical design.",
    tags: ["mechanical", "bolt", "torque", "thread", "fastener"],
    icon: "wrench",
    path: "./tools/bolt-torque/index.html",
    status: "coming-soon"
  },
  {
    id: "pressure-drop",
    name: "Pipe Pressure Drop & Flow Calculator",
    description: "Calculate fluid flow rate, velocity, Reynolds number, and friction pressure drops using the Darcy-Weisbach equation.",
    tags: ["fluids", "hydraulics", "pipe", "flow", "pressure"],
    icon: "droplet",
    path: "./tools/pressure-drop/index.html",
    status: "coming-soon"
  }
];
