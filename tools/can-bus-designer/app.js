// State Management
let stations = [];
/** @type {{ id: string, name: string }[]} */
let buses = [{ id: 'bus-1', name: 'CAN Network' }];
let activeBusId = 'bus-1';
/** Standards pack id: iso11898-2 | j1939 | cia */
let standardsPackId = 'iso11898-2';

let networkConfig = {
  baudRate: 250, // kbps
  samplePoint: 80, // %
  propDelay: 5.0, // ns/m
  loopDelay: 150, // ns
  controllerMargin: 50, // ns
  enableCanFD: false,
  dataBaudRate: 2000, // kbps
  dataSamplePoint: 75 // %
};

// CANopen (CiA 301) profile state — linked to harness devices by device id
let canopenConfig = {
  syncPeriodMs: 10,
  defaultHeartbeatMs: 500,
  syncProducer: true,
  pdoPerNode: 2,
  pdoDlc: 8,
  pdoCycleMs: 10
};

// Length Unit Conversion Management
let currentUnit = 'm';
const UNIT_FACTORS = {
  m: 1.0,
  mm: 1000.0,
  cm: 100.0,
  in: 39.3700787,
  ft: 3.2808399
};

function fromMeters(m) {
  return m * UNIT_FACTORS[currentUnit];
}

function toMeters(val) {
  return val / UNIT_FACTORS[currentUnit];
}

function formatLength(m, showUnit = true) {
  const val = fromMeters(m);
  let decimals = 1;
  if (currentUnit === 'm') decimals = 2;
  else if (currentUnit === 'mm') decimals = 0;
  else if (currentUnit === 'cm') decimals = 1;
  
  const formatted = val.toFixed(decimals);
  return showUnit ? `${formatted} ${currentUnit}` : formatted;
}

// Speed compliance limits
const STANDARD_STUB_LIMITS = {
  1000: 0.3,
  800: 0.3,
  500: 1.0,
  250: 1.5,
  125: 3.0,
  50: 6.0,
  20: 15.0,
  10: 30.0
};

const STANDARD_CUMULATIVE_LIMITS = {
  1000: 3.0,
  800: 3.0,
  500: 10.0,
  250: 15.0,
  125: 30.0,
  50: 60.0,
  20: 150.0,
  10: 300.0
};

const DATA_STUB_LIMITS = {
  1000: 0.3,
  2000: 0.2,
  4000: 0.1,
  5000: 0.08,
  8000: 0.04
};

const DATA_CUMULATIVE_LIMITS = {
  1000: 3.0,
  2000: 1.5,
  4000: 0.8,
  5000: 0.5,
  8000: 0.2
};

/**
 * Stations = junctions on a trunk graph (tree per bus).
 * - parentId + distanceFromParent: trunk edge to parent (null parent = root of a chain/bus)
 * - Multiple children of one parent = Y-split / branched trunk
 * - busId: which CAN network (gateway = separate bus)
 * - termination (Ω) at the junction
 * - devices[]: ECUs on stubs off the junction
 */
function ensureStationDefaults(st) {
  if (!st || typeof st !== 'object') return st;
  if (st.termination == null || st.termination === '') st.termination = 0;
  else st.termination = Number(st.termination) || 0;
  if ('type' in st) delete st.type;
  if (!Array.isArray(st.devices)) st.devices = [];
  if (!st.busId) st.busId = activeBusId || 'bus-1';
  if (st.distanceFromParent == null && st.distanceFromPrev != null) {
    st.distanceFromParent = Number(st.distanceFromPrev) || 0;
  }
  if (st.distanceFromParent == null) st.distanceFromParent = 0;
  // Keep legacy field in sync for older UI paths
  st.distanceFromPrev = st.distanceFromParent;
  // Manual canvas nudge (px in layout space); lines stay connected via layout
  if (!st.layoutOffset || typeof st.layoutOffset !== 'object') {
    st.layoutOffset = { dx: 0, dy: 0 };
  } else {
    st.layoutOffset.dx = Number(st.layoutOffset.dx) || 0;
    st.layoutOffset.dy = Number(st.layoutOffset.dy) || 0;
  }
  st.devices.forEach(d => {
    if (!d.layoutOffset || typeof d.layoutOffset !== 'object') {
      d.layoutOffset = { dx: 0, dy: 0 };
    } else {
      d.layoutOffset.dx = Number(d.layoutOffset.dx) || 0;
      d.layoutOffset.dy = Number(d.layoutOffset.dy) || 0;
    }
  });
  return st;
}

/** Map browser client coords → coordinates inside #zoom-container (accounts for pan/zoom). */
function clientToZoomLocal(clientX, clientY) {
  if (!harnessSvg || !zoomContainer) return { x: 0, y: 0 };
  try {
    const pt = harnessSvg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = zoomContainer.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  } catch (_) {
    return { x: 0, y: 0 };
  }
}

function startBoxDrag(kind, stationId, deviceId, e) {
  if (e.button != null && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  hideCanvasAddMenu();

  const st = stations.find(s => s.id === stationId);
  if (!st) return;
  ensureStationDefaults(st);

  let startOffset = { dx: 0, dy: 0 };
  if (kind === 'station') {
    startOffset = { ...st.layoutOffset };
  } else if (kind === 'device') {
    const dev = (st.devices || []).find(d => d.id === deviceId);
    if (!dev) return;
    if (!dev.layoutOffset) dev.layoutOffset = { dx: 0, dy: 0 };
    startOffset = { ...dev.layoutOffset };
  }

  boxDrag = {
    active: true,
    kind,
    stationId,
    deviceId: deviceId || null,
    startLocal: clientToZoomLocal(e.clientX, e.clientY),
    startOffset,
    moved: false
  };

  viewState.panning = false;
  harnessSvg.style.cursor = 'grabbing';
  window.addEventListener('mousemove', onBoxDragMove);
  window.addEventListener('mouseup', onBoxDragEnd);
}

function onBoxDragMove(e) {
  if (!boxDrag.active) return;
  const cur = clientToZoomLocal(e.clientX, e.clientY);
  const ddx = cur.x - boxDrag.startLocal.x;
  const ddy = cur.y - boxDrag.startLocal.y;
  if (Math.hypot(ddx, ddy) > 3) boxDrag.moved = true;

  const st = stations.find(s => s.id === boxDrag.stationId);
  if (!st) return;
  ensureStationDefaults(st);

  const nx = boxDrag.startOffset.dx + ddx;
  const ny = boxDrag.startOffset.dy + ddy;

  if (boxDrag.kind === 'station') {
    st.layoutOffset = { dx: nx, dy: ny };
  } else if (boxDrag.kind === 'device') {
    const dev = (st.devices || []).find(d => d.id === boxDrag.deviceId);
    if (dev) dev.layoutOffset = { dx: nx, dy: ny };
  }

  // Re-draw topology only (faster than full UI rebuild)
  const diagnostics = runDiagnostics();
  drawTopologySVG(diagnostics);
  harnessSvg.style.cursor = 'grabbing';
}

function onBoxDragEnd(e) {
  if (!boxDrag.active) return;
  const wasMoved = boxDrag.moved;
  const sid = boxDrag.stationId;
  const did = boxDrag.deviceId;
  const kind = boxDrag.kind;

  boxDrag.active = false;
  window.removeEventListener('mousemove', onBoxDragMove);
  window.removeEventListener('mouseup', onBoxDragEnd);
  harnessSvg.style.cursor = 'default';

  // Keep moved=true briefly so the subsequent click event does not re-fire focus
  if (wasMoved) {
    setTimeout(() => { boxDrag.moved = false; }, 50);
  } else {
    boxDrag.moved = false;
    if (kind === 'station') focusListItem({ stationId: sid });
    else if (kind === 'device') focusListItem({ stationId: sid, deviceId: did });
  }

  // Full render to sync list highlights / stats
  render();
}

function ensureBuses() {
  if (!Array.isArray(buses) || buses.length === 0) {
    buses = [{ id: 'bus-1', name: 'CAN Network' }];
  }
  if (!buses.some(b => b.id === activeBusId)) {
    activeBusId = buses[0].id;
  }
}

/** Migrate legacy linear lists → tree (parent chain) when parentId missing. */
function migrateLinearParentsInPlace() {
  ensureBuses();
  const byBus = new Map();
  stations.forEach((st) => {
    ensureStationDefaults(st);
    if (!byBus.has(st.busId)) byBus.set(st.busId, []);
    byBus.get(st.busId).push(st);
  });
  byBus.forEach((list) => {
    // Preserve array order within each bus for stations still lacking parentId
    let prev = null;
    list.forEach((st, i) => {
      if (st.parentId === undefined) {
        if (i === 0 || !prev) {
          st.parentId = null;
          st.distanceFromParent = 0;
        } else {
          st.parentId = prev.id;
          st.distanceFromParent = Number(st.distanceFromPrev) || Number(st.distanceFromParent) || 0.001;
        }
      }
      if (st.parentId === st.id) st.parentId = null;
      st.distanceFromPrev = st.distanceFromParent;
      prev = st;
    });
  });
}

function normalizeStationsInPlace() {
  ensureBuses();
  migrateLinearParentsInPlace();
  stations.forEach(ensureStationDefaults);
  // Validate parents exist; orphan → root
  const ids = new Set(stations.map(s => s.id));
  stations.forEach(st => {
    if (st.parentId && !ids.has(st.parentId)) {
      st.parentId = null;
      st.distanceFromParent = 0;
      st.distanceFromPrev = 0;
    }
  });
}

// Prefer shared physics module (js/physics.js); fall back if not loaded
const _phys = (typeof window !== 'undefined' && window.CanPhysics) ? window.CanPhysics : null;
const parallelResistance = _phys
  ? _phys.parallelResistance.bind(_phys)
  : function parallelResistance(ohmsList) {
      const vals = (ohmsList || []).map(Number).filter(r => r > 0 && Number.isFinite(r));
      if (vals.length === 0) return Infinity;
      return 1 / vals.reduce((s, r) => s + 1 / r, 0);
    };
const computeArbitrationTiming = _phys
  ? _phys.computeArbitrationTiming.bind(_phys)
  : function computeArbitrationTiming(opts) {
      const baud = Math.max(1, Number(opts.baudKbps) || 250);
      const sp = Math.min(95, Math.max(50, Number(opts.samplePointPct) || 80));
      const L = Math.max(0, Number(opts.trunkLengthM) || 0);
      const tau = Math.max(0.1, Number(opts.propDelayNsPerM) || 5);
      const loop = Math.max(0, Number(opts.loopDelayNs) || 0);
      const margin = Math.max(0, Number(opts.marginNs) || 0);
      const bitTimeNs = 1e6 / baud;
      const budgetNs = (sp / 100) * bitTimeNs;
      const propNs = 2 * (L * tau + loop) + margin;
      return { bitTimeNs, budgetNs, propNs, marginNs: margin, ok: propNs < budgetNs, tight: propNs >= budgetNs * 0.8 && propNs < budgetNs };
    };
const maxTrunkLengthM = (baudKbps) =>
  _phys ? _phys.maxTrunkLengthM(baudKbps, standardsPackId) : ({ 1000: 40, 800: 50, 500: 100, 250: 250, 125: 500, 50: 1000, 20: 2500, 10: 5000 }[baudKbps] || 40);

function getActivePack() {
  return _phys && _phys.getStandardsPack
    ? _phys.getStandardsPack(standardsPackId)
    : { id: 'iso11898-2', name: 'ISO 11898-2', hard: {}, guidelines: {}, starWarnAt: 2, starFailAt: 3, minNodeSpacingM: 0.1 };
}

function stationsOnBus(busId) {
  const id = busId || activeBusId;
  return stations.filter(s => (s.busId || 'bus-1') === id);
}

function trunkEdges(busId) {
  const list = stationsOnBus(busId);
  if (_phys && _phys.trunkEdgesFromStations) return _phys.trunkEdgesFromStations(list);
  return list.filter(s => s.parentId).map(s => ({
    from: s.parentId,
    to: s.id,
    length: Number(s.distanceFromParent != null ? s.distanceFromParent : s.distanceFromPrev) || 0,
    busId: s.busId
  }));
}

function electricalLengthM(busId) {
  const list = stationsOnBus(busId);
  const edges = trunkEdges(busId);
  if (_phys && _phys.longestPathLengthM) {
    return _phys.longestPathLengthM(list.map(s => s.id), edges);
  }
  return edges.reduce((s, e) => s + e.length, 0);
}

function cableLengthM(busId) {
  const edges = trunkEdges(busId);
  if (_phys && _phys.totalTrunkCableM) return _phys.totalTrunkCableM(edges);
  return edges.reduce((s, e) => s + e.length, 0);
}

function leafIds(busId) {
  const list = stationsOnBus(busId);
  const edges = trunkEdges(busId);
  if (_phys && _phys.leafStationIds) return _phys.leafStationIds(list.map(s => s.id), edges);
  if (list.length <= 1) return list.map(s => s.id);
  return [list[0].id, list[list.length - 1].id];
}

function childStations(parentId) {
  return stations.filter(s => s.parentId === parentId);
}

/** All termination resistors (station-level + device-level for legacy/onboard ECU terms). */
function collectTerminations() {
  const list = [];
  stations.forEach(s => {
    ensureStationDefaults(s);
    if (s.termination > 0) {
      list.push({ ohms: s.termination, stationId: s.id, source: 'station' });
    }
    (s.devices || []).forEach(d => {
      if ((d.termination || 0) > 0) {
        list.push({ ohms: d.termination, stationId: s.id, deviceId: d.id, source: 'device' });
      }
    });
  });
  return list;
}

function stationIsTerminated(s) {
  if (!s) return false;
  if ((s.termination || 0) > 0) return true;
  return (s.devices || []).some(d => (d.termination || 0) > 0);
}

function maxStubLimitMeters() {
  readConfigInputs();
  if (_phys && _phys.maxStubLimitM) {
    return _phys.maxStubLimitM(networkConfig.baudRate, {
      canFd: networkConfig.enableCanFD,
      dataBaudKbps: networkConfig.dataBaudRate,
      packId: standardsPackId
    });
  }
  if (networkConfig.enableCanFD) {
    return DATA_STUB_LIMITS[networkConfig.dataBaudRate] ?? STANDARD_STUB_LIMITS[networkConfig.baudRate] ?? 0.3;
  }
  return STANDARD_STUB_LIMITS[networkConfig.baudRate] ?? 0.3;
}

function maxCumStubLimitMeters() {
  readConfigInputs();
  if (_phys && _phys.maxCumStubLimitM) {
    return _phys.maxCumStubLimitM(networkConfig.baudRate, {
      canFd: networkConfig.enableCanFD,
      dataBaudKbps: networkConfig.dataBaudRate,
      packId: standardsPackId
    });
  }
  return STANDARD_CUMULATIVE_LIMITS[networkConfig.baudRate] ?? 15;
}

function stubGuidanceText() {
  const maxM = maxStubLimitMeters();
  const pack = getActivePack();
  const br = networkConfig.enableCanFD
    ? `CAN FD data ${networkConfig.dataBaudRate} kbps`
    : `${networkConfig.baudRate} kbps`;
  return `${pack.shortName || pack.name}: max stub ≈ ${formatLength(maxM)} at ${br}.`;
}

// Dragging State (legacy spacing drag + box free-move)
let dragInfo = {
  active: false,
  stationId: null,
  initialMouseX: 0,
  initialCumPos: 0,
  scale: 1,
  graphWidth: 1,
  minPos: 0,
  maxPos: 0,
  trunkLen: 0,
  paddingLeft: 60
};

/** Free-move of station/device boxes on canvas (keeps lines connected via re-render). */
let boxDrag = {
  active: false,
  kind: null, // 'station' | 'device'
  stationId: null,
  deviceId: null,
  startLocal: null, // {x,y} in zoom-container coords
  startOffset: null, // {dx,dy}
  moved: false
};

// Zoom and Pan View State
let viewState = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
  panning: false,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0
};

// Preset Definitions
const PRESETS = {
  'ideal-250': {
    baudRate: 250,
    samplePoint: 80,
    propDelay: 5.0,
    loopDelay: 150,
    stations: [
      {
        id: 's1',
        name: 'Front ECU',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'Engine ECU', stubLength: 0.1, termination: 120 }
        ]
      },
      {
        id: 's2',
        name: 'Cabin Splice',
        distanceFromPrev: 12.0,
        devices: [
          { id: 'd2', name: 'ABS Module', stubLength: 0.15, termination: 0 },
          { id: 'd3', name: 'HVAC Control', stubLength: 0.25, termination: 0 }
        ]
      },
      {
        id: 's3',
        name: 'Mid Splice',
        distanceFromPrev: 15.0,
        devices: [
          { id: 'd4', name: 'Transmission', stubLength: 0.1, termination: 0 }
        ]
      },
      {
        id: 's4',
        name: 'Rear Hub',
        distanceFromPrev: 8.0,
        devices: [
          { id: 'd5', name: 'Cabin Gateway', stubLength: 0.2, termination: 120 }
        ]
      }
    ]
  },
  'canfd-5mbps': {
    baudRate: 500,
    samplePoint: 80,
    propDelay: 5.0,
    loopDelay: 150,
    enableCanFD: true,
    dataBaudRate: 5000,
    dataSamplePoint: 75,
    stations: [
      {
        id: 's1',
        name: 'Controller',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'ECU 1', stubLength: 0.05, termination: 120 }
        ]
      },
      {
        id: 's2',
        name: 'Splice B',
        distanceFromPrev: 2.5,
        devices: [
          { id: 'd2', name: 'Sensor A', stubLength: 0.05, termination: 0 }
        ]
      },
      {
        id: 's3',
        name: 'Splice C',
        distanceFromPrev: 3.5,
        devices: [
          { id: 'd3', name: 'Sensor B', stubLength: 0.12, termination: 0 } // Exceeds 0.08m for 5Mbps data rate
        ]
      },
      {
        id: 's4',
        name: 'Gateway',
        distanceFromPrev: 4.0,
        devices: [
          { id: 'd4', name: 'ECU 2', stubLength: 0.05, termination: 120 }
        ]
      }
    ]
  },
  'highspeed-err': {
    baudRate: 1000,
    samplePoint: 75,
    propDelay: 5.0,
    loopDelay: 180,
    stations: [
      {
        id: 's1',
        name: 'Engine Bay',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'Powertrain', stubLength: 0.1, termination: 120 }
        ]
      },
      {
        id: 's2',
        name: 'Cabin Star',
        distanceFromPrev: 18.0,
        devices: [
          { id: 'd2', name: 'Steering Node', stubLength: 1.2, termination: 0 }, // Stub too long for 1Mbps
          { id: 'd3', name: 'Gateway Node', stubLength: 0.1, termination: 0 }
        ]
      },
      {
        id: 's3',
        name: 'Trunk Hub',
        distanceFromPrev: 27.0,
        devices: [
          { id: 'd4', name: 'Suspension', stubLength: 0.1, termination: 120 } // Trunk total length is 45m (exceeds 40m)
        ]
      }
    ]
  },
  'term-err-mid': {
    baudRate: 500,
    samplePoint: 80,
    propDelay: 5.2,
    loopDelay: 150,
    stations: [
      {
        id: 's1',
        name: 'Sensor 1 (End)',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'Sensor A', stubLength: 0.15, termination: 0 } // Unterminated end node
        ]
      },
      {
        id: 's2',
        name: 'Junction A',
        distanceFromPrev: 8.0,
        devices: [
          { id: 'd2', name: 'ECU Alpha', stubLength: 0.1, termination: 120 } // Mid-bus termination
        ]
      },
      {
        id: 's3',
        name: 'Junction B',
        distanceFromPrev: 7.0,
        devices: [
          { id: 'd3', name: 'ECU Beta', stubLength: 0.1, termination: 120 } // Mid-bus termination
        ]
      },
      {
        id: 's4',
        name: 'Sensor 2 (End)',
        distanceFromPrev: 10.0,
        devices: [
          { id: 'd4', name: 'Sensor B', stubLength: 0.2, termination: 0 } // Unterminated end node
        ]
      }
    ]
  },
  'multiterm-err': {
    baudRate: 500,
    samplePoint: 80,
    propDelay: 5.0,
    loopDelay: 150,
    stations: [
      {
        id: 's1',
        name: 'Station A',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'Node A', stubLength: 0.1, termination: 120 }
        ]
      },
      {
        id: 's2',
        name: 'Station B',
        distanceFromPrev: 10.0,
        devices: [
          { id: 'd2', name: 'Node B', stubLength: 0.1, termination: 120 }
        ]
      },
      {
        id: 's3',
        name: 'Station C',
        distanceFromPrev: 10.0,
        devices: [
          { id: 'd3', name: 'Node C', stubLength: 0.1, termination: 120 }
        ]
      },
      {
        id: 's4',
        name: 'Station D',
        distanceFromPrev: 10.0,
        devices: [
          { id: 'd4', name: 'Node D', stubLength: 0.1, termination: 120 } // 4 Terminations! Req = 30 ohms
        ]
      }
    ]
  },
  'long-stubs': {
    baudRate: 250,
    samplePoint: 80,
    propDelay: 5.0,
    loopDelay: 150,
    stations: [
      {
        id: 's1',
        name: 'Engine Splice',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'Engine ECU', stubLength: 0.5, termination: 120 }
        ]
      },
      {
        id: 's2',
        name: 'Cabin Star Splice',
        distanceFromPrev: 15.0,
        devices: [
          { id: 'd2', name: 'Instrument Cluster', stubLength: 0.2, termination: 0 },
          { id: 'd3', name: 'Telematic Unit', stubLength: 2.8, termination: 0 }, // Star branch too long (max 1.5m)
          { id: 'd4', name: 'Body Controller', stubLength: 0.8, termination: 0 }
        ]
      },
      {
        id: 's3',
        name: 'Rear Splice',
        distanceFromPrev: 25.0,
        devices: [
          { id: 'd5', name: 'Tailgate ECU', stubLength: 0.1, termination: 120 }
        ]
      }
    ]
  },
  'empty': {
    baudRate: 250,
    samplePoint: 80,
    propDelay: 5.0,
    loopDelay: 150,
    stations: [
      {
        id: 's1',
        name: 'Station 1',
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd1', name: 'Node 1', stubLength: 0.1, termination: 120 }
        ]
      }
    ]
  }
};

// DOM Elements
const selectPreset = document.getElementById('select-preset');
const inputBaud = document.getElementById('input-baud');
const inputSamplePoint = document.getElementById('input-sample-point');
const inputPropDelay = document.getElementById('input-prop-delay');
const inputLoopDelay = document.getElementById('input-loop-delay');
const btnAddStation = document.getElementById('btn-add-station');
const stationListContainer = document.getElementById('station-list-container');
const complianceBanner = document.getElementById('compliance-banner');
const bannerIcon = document.getElementById('banner-icon');
const bannerText = document.getElementById('banner-text');

// CAN FD DOM elements
const inputCanFD = document.getElementById('input-canfd');
const groupDataBaud = document.getElementById('group-data-baud');
const groupDataSP = document.getElementById('group-data-sp');
const inputDataBaud = document.getElementById('input-data-baud');
const inputDataSP = document.getElementById('input-data-sp');

// Unit DOM Elements
const selectUnit = document.getElementById('select-unit');

// Scope Visualization Mode
let scopeMode = 'scope';

// Visualizations DOM
const harnessSvg = document.getElementById('harness-svg');
const zoomContainer = document.getElementById('zoom-container');
const canvasContainer = document.getElementById('canvas-container');
const inlineEditor = document.getElementById('inline-editor');
const waveformCanvas = document.getElementById('waveform-canvas');
const ctxWaveform = waveformCanvas.getContext('2d');

// Diagnostic Stats DOM
const valResistance = document.getElementById('val-resistance');
const valTrunkLen = document.getElementById('val-trunk-len');
const valPropTime = document.getElementById('val-prop-time');
const valTimeBudget = document.getElementById('val-time-budget');
const checklistBody = document.getElementById('checklist-body');
const riskBadge = document.getElementById('risk-badge');
const riskGaugeFill = document.getElementById('risk-gauge-fill');

// Header Actions
const btnShare = document.getElementById('btn-share');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const fileImport = document.getElementById('file-import');

// Initialize App
function init() {
  bindEvents();

  loadURLOrPreset();
  resizeWaveformCanvas();
  initCanvasInteractions();

  window.addEventListener('resize', () => {
    render();
    resizeWaveformCanvas();
  });
}

function bindEvents() {
  selectPreset.addEventListener('change', (e) => {
    applyPreset(e.target.value);
  });

  // Parameter bindings
  const params = [inputBaud, inputSamplePoint, inputPropDelay, inputLoopDelay, inputDataBaud, inputDataSP];
  params.forEach(param => {
    param.addEventListener('input', () => {
      readConfigInputs();
      render();
    });
  });

  inputCanFD.addEventListener('change', (e) => {
    networkConfig.enableCanFD = e.target.checked;
    const displayVal = networkConfig.enableCanFD ? 'block' : 'none';
    groupDataBaud.style.display = displayVal;
    groupDataSP.style.display = displayVal;
    render();
  });

  selectUnit.addEventListener('change', (e) => {
    currentUnit = e.target.value;
    render();
  });

  // Add Station — extends main chain on active bus (append to a leaf root path)
  btnAddStation.addEventListener('click', () => {
    ensureBuses();
    const onBus = stationsOnBus(activeBusId);
    // Prefer attaching to a leaf of the active bus; else new root
    const leaves = leafIds(activeBusId).map(id => stations.find(s => s.id === id)).filter(Boolean);
    const parent = leaves.length ? leaves[leaves.length - 1] : (onBus[onBus.length - 1] || null);
    const newStation = {
      id: 's_' + Date.now().toString(),
      name: `Station ${stations.length + 1}`,
      parentId: parent ? parent.id : null,
      distanceFromParent: parent ? 5.0 : 0,
      distanceFromPrev: parent ? 5.0 : 0,
      busId: activeBusId,
      termination: 0,
      devices: [
        { id: 'd_' + Date.now().toString(), name: `Device ${stations.length + 1}`, stubLength: 0.1, termination: 0 }
      ]
    };
    stations.push(newStation);
    try { if (window.ETAnalytics) window.ETAnalytics.trackEngaged('can-bus-designer'); } catch (_) {}
    render();
  });

  document.getElementById('select-standards-pack')?.addEventListener('change', (e) => {
    standardsPackId = e.target.value || 'iso11898-2';
    refreshStandardsPackUi();
    render();
  });

  document.getElementById('select-active-bus')?.addEventListener('change', (e) => {
    activeBusId = e.target.value || activeBusId;
    render();
  });

  document.getElementById('btn-add-bus')?.addEventListener('click', () => {
    const n = buses.length + 1;
    const id = 'bus-' + n + '-' + Date.now().toString(36);
    const name = prompt('Name for the new CAN bus (e.g. Body CAN, Powertrain CAN):', `CAN Network ${n}`);
    if (name === null) return;
    buses.push({ id, name: (name || `CAN Network ${n}`).trim() });
    activeBusId = id;
    // Seed a root station with termination for the new bus
    stations.push({
      id: 's_' + Date.now().toString(36),
      name: `${name || 'Bus'} Root`,
      parentId: null,
      distanceFromParent: 0,
      distanceFromPrev: 0,
      busId: id,
      termination: 120,
      devices: [{ id: 'd_' + Date.now().toString(36), name: 'Gateway A', stubLength: 0.1, termination: 0 }]
    });
    if (window.showToast) window.showToast('New bus added — design each side of a gateway as a separate bus.');
    render();
  });

  document.getElementById('btn-delete-bus')?.addEventListener('click', () => {
    deleteActiveBus();
  });

  document.getElementById('btn-topology-wizard')?.addEventListener('click', openTopologyWizard);
  document.getElementById('btn-export-harness-svg')?.addEventListener('click', exportHarnessSvg);
  document.getElementById('btn-export-pin-table')?.addEventListener('click', exportPinTableCsv);

  // Export & Import
  btnExport.addEventListener('click', exportStateJSON);
  btnImport.addEventListener('click', () => fileImport.click());
  fileImport.addEventListener('change', importStateJSON);
  btnShare.addEventListener('click', shareState);

  // Scope and Eye Diagram Toggles
  document.getElementById('scope-btn-scope').addEventListener('click', () => setScopeMode('scope'));
  document.getElementById('scope-btn-eye').addEventListener('click', () => setScopeMode('eye'));

  // Bit timing / DBC / BOM
  const inputCanClock = document.getElementById('input-can-clock');
  const inputSjw = document.getElementById('input-sjw');
  [inputCanClock, inputSjw].forEach(el => {
    if (el) el.addEventListener('input', () => updateBitTimingResults());
  });
  document.getElementById('btn-parse-dbc')?.addEventListener('click', parseDbcSnippet);
  document.getElementById('btn-clear-dbc')?.addEventListener('click', () => {
    const ta = document.getElementById('dbc-import-text');
    const out = document.getElementById('dbc-parse-results');
    if (ta) ta.value = '';
    if (out) out.innerHTML = '';
  });
  document.getElementById('btn-export-bom')?.addEventListener('click', exportHarnessBomCsv);

  // Config mode tabs (Harness / Advanced / CANopen)
  document.querySelectorAll('.config-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode');
      setConfigMode(mode);
    });
  });

  // CANopen controls
  ['canopen-sync-period', 'canopen-heartbeat', 'canopen-pdo-per-node', 'canopen-pdo-dlc', 'canopen-pdo-cycle'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      readCanopenInputs();
      updateCanopenUi();
    });
  });
  document.getElementById('canopen-sync-producer')?.addEventListener('change', () => {
    readCanopenInputs();
    updateCanopenUi();
  });
  document.getElementById('btn-canopen-auto-ids')?.addEventListener('click', autoAssignCanopenNodeIds);
  document.getElementById('btn-canopen-export')?.addEventListener('click', exportCanopenNodeMapCsv);
  ['canopen-cob-node', 'canopen-cob-object'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateCobIdCalculator);
    document.getElementById(id)?.addEventListener('change', updateCobIdCalculator);
  });
  renderCanopenCheatsheet();
  updateCobIdCalculator();
}

function setConfigMode(mode) {
  document.querySelectorAll('.config-mode-tab').forEach(t => {
    const on = t.getAttribute('data-mode') === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-mode-panel]').forEach(p => {
    p.classList.toggle('hidden', p.getAttribute('data-mode-panel') !== mode);
  });
  if (mode === 'advanced') updateBitTimingResults();
  if (mode === 'canopen') updateCanopenUi();
  try { if (window.lucide) lucide.createIcons(); } catch (_) { /* ignore */ }
}

function initCanvasInteractions() {
  // Zoom & Pan Toolbar Controls
  const btnZoomIn = document.getElementById('zoom-in');
  const btnZoomOut = document.getElementById('zoom-out');
  const btnZoomReset = document.getElementById('zoom-reset');

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      viewState.zoom = Math.min(4.0, viewState.zoom * 1.25);
      applyViewTransform();
    });
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      viewState.zoom = Math.max(0.2, viewState.zoom / 1.25);
      applyViewTransform();
    });
  }
  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => {
      viewState.zoom = 1.0;
      viewState.panX = 0;
      viewState.panY = 0;
      applyViewTransform();
    });
  }

  // Wheel Zoom Event
  harnessSvg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = harnessSvg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.1;
    let newZoom = viewState.zoom;
    if (e.deltaY < 0) {
      newZoom *= zoomFactor;
    } else {
      newZoom /= zoomFactor;
    }
    newZoom = Math.max(0.25, Math.min(4.0, newZoom));

    // Pan adjust so it zooms into coordinates
    viewState.panX = mouseX - (mouseX - viewState.panX) * (newZoom / viewState.zoom);
    viewState.panY = mouseY - (mouseY - viewState.panY) * (newZoom / viewState.zoom);
    viewState.zoom = newZoom;

    applyViewTransform();
  });

  // Pan Mouse Events (dragging on empty grid only — not while moving boxes)
  harnessSvg.addEventListener('mousedown', (e) => {
    if (boxDrag.active) return;
    if (e.target.closest && e.target.closest('.draggable-box, .svg-interactive-btn')) return;
    if (e.target.classList.contains('svg-background-grid') || e.target === harnessSvg) {
      viewState.panning = true;
      viewState.startX = e.clientX;
      viewState.startY = e.clientY;
      viewState.startPanX = viewState.panX;
      viewState.startPanY = viewState.panY;
      harnessSvg.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (boxDrag.active) return;
    if (viewState.panning) {
      const dx = e.clientX - viewState.startX;
      const dy = e.clientY - viewState.startY;
      viewState.panX = viewState.startPanX + dx;
      viewState.panY = viewState.startPanY + dy;
      applyViewTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (viewState.panning) {
      viewState.panning = false;
      harnessSvg.style.cursor = 'default';
    }
  });

  // Canvas Double Click to Add Station
  harnessSvg.addEventListener('dblclick', (e) => {
    // Only insert if double clicked empty canvas background
    if (e.target.classList.contains('svg-background-grid') || e.target === harnessSvg) {
      const rect = harnessSvg.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      
      // Calculate local mouse X position after pan and zoom factors
      const localX = (clientX - viewState.panX) / viewState.zoom;
      const cumPos = getPhysicalPositionFromX(localX);

      if (cumPos >= 0) {
        addStationAtPosition(cumPos);
      }
    }
  });
}

function applyViewTransform() {
  zoomContainer.setAttribute('transform', `translate(${viewState.panX}, ${viewState.panY}) scale(${viewState.zoom})`);
}

function resizeWaveformCanvas() {
  const rect = waveformCanvas.parentElement.getBoundingClientRect();
  waveformCanvas.width = rect.width;
  waveformCanvas.height = 80;
  drawWaveform();
}

function readConfigInputs() {
  networkConfig.baudRate = parseInt(inputBaud.value) || 250;
  networkConfig.samplePoint = parseInt(inputSamplePoint.value) || 80;
  networkConfig.propDelay = parseFloat(inputPropDelay.value) || 5.0;
  networkConfig.loopDelay = parseInt(inputLoopDelay.value) || 150;
  networkConfig.enableCanFD = inputCanFD.checked;
  networkConfig.dataBaudRate = parseInt(inputDataBaud.value) || 2000;
  networkConfig.dataSamplePoint = parseInt(inputDataSP.value) || 75;
}

function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  networkConfig.baudRate = preset.baudRate;
  networkConfig.samplePoint = preset.samplePoint;
  networkConfig.propDelay = preset.propDelay;
  networkConfig.loopDelay = preset.loopDelay;
  networkConfig.enableCanFD = preset.enableCanFD || false;
  networkConfig.dataBaudRate = preset.dataBaudRate || 2000;
  networkConfig.dataSamplePoint = preset.dataSamplePoint || 75;

  // Deep clone stations
  stations = JSON.parse(JSON.stringify(preset.stations));
  buses = [{ id: 'bus-1', name: 'CAN Network' }];
  activeBusId = 'bus-1';
  // Prefer station-level termination: if a station has no term but devices do,
  // lift the largest device terminator onto the station (once) for end-of-bus clarity.
  stations.forEach(st => {
    st.busId = 'bus-1';
    st.parentId = undefined; // force linear migrate
    st.termination = Number(st.termination) || 0;
    if (!st.termination && Array.isArray(st.devices)) {
      const devTerms = st.devices.map(d => Number(d.termination) || 0).filter(t => t > 0);
      if (devTerms.length) {
        st.termination = Math.max(...devTerms);
        if (devTerms.length === 1) {
          st.devices.forEach(d => { if ((d.termination || 0) > 0) d.termination = 0; });
        }
      }
    }
  });
  normalizeStationsInPlace();

  // Update inputs
  inputBaud.value = networkConfig.baudRate;
  inputSamplePoint.value = networkConfig.samplePoint;
  inputPropDelay.value = networkConfig.propDelay;
  inputLoopDelay.value = networkConfig.loopDelay;
  inputCanFD.checked = networkConfig.enableCanFD;
  inputDataBaud.value = networkConfig.dataBaudRate;
  inputDataSP.value = networkConfig.dataSamplePoint;

  const displayVal = networkConfig.enableCanFD ? 'block' : 'none';
  groupDataBaud.style.display = displayVal;
  groupDataSP.style.display = displayVal;

  render();
}

/** Cumulative trunk distance along ordered UI walk of the active bus (for linear spine drawing). */
function getCumulativePositions() {
  const ordered = orderedStationsForUi(activeBusId);
  let positions = [];
  let current = 0;
  ordered.forEach(({ station }, i) => {
    if (i === 0 || !station.parentId) current = 0;
    else current = (positions[positions.length - 1] || 0); // reset not right for tree
    // Better: distance from root along unique path
    positions.push(distanceFromRoot(station.id));
  });
  // Fallback linear if empty
  if (!positions.length) {
    let c = 0;
    stationsOnBus(activeBusId).forEach((st, i) => {
      if (i > 0) c += Number(st.distanceFromParent || st.distanceFromPrev) || 0;
      positions.push(c);
    });
  }
  return positions;
}

function distanceFromRoot(stationId) {
  const byId = new Map(stations.map(s => [s.id, s]));
  let d = 0;
  let guard = 0;
  let s = byId.get(stationId);
  while (s && s.parentId && byId.has(s.parentId) && guard++ < 64) {
    d += Number(s.distanceFromParent != null ? s.distanceFromParent : s.distanceFromPrev) || 0;
    s = byId.get(s.parentId);
  }
  return d;
}

/**
 * Screen-space layout for stations (px-like units).
 * - Enforces a minimum horizontal gap so short trunk segments don't stack boxes.
 * - Each Y-branch gets its own vertical lane tall enough for device fans.
 */
function computeBranchLayout(busId) {
  const MIN_EDGE_PX = 170;   // min screen length of a trunk segment
  const PX_PER_M = 28;       // soft physical scale (capped by MIN_EDGE_PX)
  const LANE_PX = 190;       // vertical room per branch lane (devices sit below trunk)

  const list = stationsOnBus(busId);
  const pos = new Map();
  if (!list.length) return pos;

  const children = new Map();
  list.forEach(s => {
    const p = s.parentId || '__root__';
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(s);
  });

  // Extra horizontal pad when a station has many ECU boxes under it
  function stationDevicePad(st) {
    const n = (st.devices || []).length;
    if (n <= 1) return 0;
    // half-width of device row beyond a single box
    const pitch = 96;
    return Math.max(0, ((Math.min(n, 5) - 1) * pitch) / 2 - 40);
  }

  /**
   * Place subtree of st. parentX = screen x of parent junction (null for roots).
   * preferredLane = lane index to try for the primary child chain.
   * Returns { minLane, maxLane } used by this subtree.
   */
  function walk(st, parentX, preferredLane) {
    const edgeM = st.parentId
      ? Math.max(0, Number(st.distanceFromParent != null ? st.distanceFromParent : st.distanceFromPrev) || 0)
      : 0;
    const edgePx = st.parentId ? Math.max(MIN_EDGE_PX, edgeM * PX_PER_M) : 0;
    // Push apart if parent or child fans many devices
    const parent = st.parentId ? list.find(s => s.id === st.parentId) : null;
    const fanPad = (parent ? stationDevicePad(parent) : 0) + stationDevicePad(st);
    const x = (parentX == null ? 0 : parentX) + edgePx + fanPad * 0.35;
    const lane = preferredLane;
    pos.set(st.id, { x, y: lane * LANE_PX, station: st, lane });

    const kids = children.get(st.id) || [];
    if (!kids.length) return { minLane: lane, maxLane: lane };

    let minL = lane;
    let maxL = lane;
    let nextLane = lane;
    kids.forEach((k, i) => {
      // First child continues on same lane (main spine); further kids open new lanes
      const childLane = i === 0 ? lane : (maxL + 1);
      const sub = walk(k, x, childLane);
      minL = Math.min(minL, sub.minLane);
      maxL = Math.max(maxL, sub.maxLane);
      nextLane = maxL + 1;
    });
    // Re-center parent lane between children? keep parent on first child's lane for stable spine
    return { minLane: minL, maxLane: maxL };
  }

  let nextRootLane = 0;
  (children.get('__root__') || []).forEach((root) => {
    const sub = walk(root, null, nextRootLane);
    nextRootLane = sub.maxLane + 1;
  });

  return pos;
}

/** Place ECU boxes under a station without overlapping each other. */
function layoutDevicesUnderStation(devCount, stationX, spliceY) {
  const boxW = 80;
  const boxH = 44;
  const gapX = 16;
  const gapY = 18;
  const pitchX = boxW + gapX;
  const pitchY = boxH + gapY;
  // Cap columns so a single station doesn't span the whole canvas
  const maxPerRow = Math.min(5, Math.max(1, devCount));
  const positions = [];
  for (let i = 0; i < devCount; i++) {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    const inRow = Math.min(maxPerRow, devCount - row * maxPerRow);
    const rowWidth = inRow * pitchX - gapX;
    const startX = stationX - rowWidth / 2 + boxW / 2;
    positions.push({
      x: startX + col * pitchX,
      y: spliceY + 48 + row * pitchY,
      boxW,
      boxH
    });
  }
  return positions;
}

function getPhysicalPositionFromX(localX) {
  if (stations.length === 0) return 0;
  
  const cumPositions = getCumulativePositions();
  const screenX = dragInfo.screenX || [60];
  
  if (localX <= screenX[0]) return 0.0;
  
  const lastIndex = screenX.length - 1;
  if (localX >= screenX[lastIndex]) {
    const lastCum = cumPositions[lastIndex];
    return lastCum + (localX - screenX[lastIndex]) / (dragInfo.scale || 10);
  }
  
  for (let i = 1; i < screenX.length; i++) {
    if (localX >= screenX[i-1] && localX <= screenX[i]) {
      const x1 = screenX[i-1];
      const x2 = screenX[i];
      const p1 = cumPositions[i-1];
      const p2 = cumPositions[i];
      const t = (localX - x1) / (x2 - x1);
      return p1 + t * (p2 - p1);
    }
  }
  return 0.0;
}

function render() {
  renderStationCards();
  const diagnostics = runDiagnostics();
  updateStats(diagnostics);
  updateChecklist(diagnostics);
  updateBanner(diagnostics);
  drawTopologySVG(diagnostics);
  drawWaveform(diagnostics.riskPercentage);
  updateBitTimingResults();
  updateCanopenUi();
  try {
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (e) {
    console.warn("Lucide icons load failure: ", e);
  }
}

// ── CANopen (CiA 301) ────────────────────────────────────────
function getAllDevices() {
  const list = [];
  stations.forEach((st, si) => {
    (st.devices || []).forEach((dev, di) => {
      list.push({ station: st, stationIndex: si, device: dev, deviceIndex: di });
    });
  });
  return list;
}

function readCanopenInputs() {
  canopenConfig.syncPeriodMs = parseInt(document.getElementById('canopen-sync-period')?.value, 10) || 10;
  canopenConfig.defaultHeartbeatMs = parseInt(document.getElementById('canopen-heartbeat')?.value, 10) || 0;
  canopenConfig.syncProducer = !!document.getElementById('canopen-sync-producer')?.checked;
  canopenConfig.pdoPerNode = parseInt(document.getElementById('canopen-pdo-per-node')?.value, 10) || 0;
  canopenConfig.pdoDlc = Math.min(8, Math.max(0, parseInt(document.getElementById('canopen-pdo-dlc')?.value, 10) || 0));
  canopenConfig.pdoCycleMs = parseInt(document.getElementById('canopen-pdo-cycle')?.value, 10) || 10;
}

function syncCanopenInputsFromState() {
  const sp = document.getElementById('canopen-sync-period');
  const hb = document.getElementById('canopen-heartbeat');
  const prod = document.getElementById('canopen-sync-producer');
  const pdoN = document.getElementById('canopen-pdo-per-node');
  const pdoD = document.getElementById('canopen-pdo-dlc');
  const pdoC = document.getElementById('canopen-pdo-cycle');
  if (sp) sp.value = canopenConfig.syncPeriodMs;
  if (hb) hb.value = canopenConfig.defaultHeartbeatMs;
  if (prod) prod.checked = !!canopenConfig.syncProducer;
  if (pdoN) pdoN.value = canopenConfig.pdoPerNode;
  if (pdoD) pdoD.value = canopenConfig.pdoDlc;
  if (pdoC) pdoC.value = canopenConfig.pdoCycleMs;
}

/** Pre-defined connection set (CiA 301) — base + nodeId unless global */
function canopenCobId(objectKey, nodeId) {
  const n = Math.min(127, Math.max(0, parseInt(nodeId, 10) || 0));
  const table = {
    nmt: { id: 0x000, bits: 11, note: 'NMT (global, node-independent)' },
    sync: { id: 0x080, bits: 11, note: 'SYNC (global)' },
    timestamp: { id: 0x100, bits: 11, note: 'TIME stamp (global)' },
    emcy: { id: 0x080 + n, bits: 11, note: 'EMCY = 0x080 + Node-ID' },
    tpdo1: { id: 0x180 + n, bits: 11, note: 'TPDO1 = 0x180 + Node-ID' },
    rpdo1: { id: 0x200 + n, bits: 11, note: 'RPDO1 = 0x200 + Node-ID' },
    tpdo2: { id: 0x280 + n, bits: 11, note: 'TPDO2 = 0x280 + Node-ID' },
    rpdo2: { id: 0x300 + n, bits: 11, note: 'RPDO2 = 0x300 + Node-ID' },
    tpdo3: { id: 0x380 + n, bits: 11, note: 'TPDO3 = 0x380 + Node-ID' },
    rpdo3: { id: 0x400 + n, bits: 11, note: 'RPDO3 = 0x400 + Node-ID' },
    tpdo4: { id: 0x480 + n, bits: 11, note: 'TPDO4 = 0x480 + Node-ID' },
    rpdo4: { id: 0x500 + n, bits: 11, note: 'RPDO4 = 0x500 + Node-ID' },
    sdotx: { id: 0x580 + n, bits: 11, note: 'SDO TX (server→client) = 0x580 + Node-ID' },
    sdorx: { id: 0x600 + n, bits: 11, note: 'SDO RX (client→server) = 0x600 + Node-ID' },
    heartbeat: { id: 0x700 + n, bits: 11, note: 'HEARTBEAT / Node Guarding = 0x700 + Node-ID' }
  };
  return table[objectKey] || table.heartbeat;
}

function formatCobId(id) {
  return `0x${id.toString(16).toUpperCase().padStart(3, '0')} (${id})`;
}

function updateCobIdCalculator() {
  const el = document.getElementById('canopen-cob-result');
  if (!el) return;
  const nodeId = parseInt(document.getElementById('canopen-cob-node')?.value, 10) || 1;
  const obj = document.getElementById('canopen-cob-object')?.value || 'tpdo1';
  const cob = canopenCobId(obj, nodeId);
  el.innerHTML = `
    <div><strong>COB-ID</strong> ${formatCobId(cob.id)}</div>
    <div>${cob.note}</div>
    <div style="margin-top:4px;color:var(--text-muted)">Node-ID ${nodeId} · ${cob.bits}-bit identifier</div>
  `;
}

function renderCanopenCheatsheet() {
  const el = document.getElementById('canopen-cheatsheet');
  if (!el) return;
  const n = 'N';
  const rows = [
    ['NMT', '0x000'],
    ['SYNC', '0x080'],
    ['EMCY', `0x080+${n}`],
    ['TIME', '0x100'],
    ['TPDO1…4', `0x180/280/380/480+${n}`],
    ['RPDO1…4', `0x200/300/400/500+${n}`],
    ['SDO TX/RX', `0x580/600+${n}`],
    ['HEARTBEAT', `0x700+${n}`]
  ];
  el.innerHTML = rows.map(([a, b]) =>
    `<div class="cs-row"><span>${a}</span><span>${b}</span></div>`
  ).join('');
}

function ensureDeviceCanopenDefaults(dev, suggestedId) {
  if (dev.nodeId == null || dev.nodeId === '') {
    dev.nodeId = suggestedId;
  }
  if (dev.heartbeatMs == null) {
    dev.heartbeatMs = canopenConfig.defaultHeartbeatMs;
  }
}

function autoAssignCanopenNodeIds() {
  let next = 1;
  const used = new Set();
  getAllDevices().forEach(({ device }) => {
    while (used.has(next) && next <= 127) next++;
    device.nodeId = Math.min(127, next);
    used.add(device.nodeId);
    if (device.heartbeatMs == null) device.heartbeatMs = canopenConfig.defaultHeartbeatMs;
    next++;
  });
  updateCanopenUi();
  if (window.showToast) window.showToast('CANopen Node-IDs auto-assigned (1…n).');
}

function updateCanopenUi() {
  readCanopenInputs();
  const listEl = document.getElementById('canopen-node-list');
  if (!listEl) return;

  const devices = getAllDevices();
  if (devices.length === 0) {
    listEl.innerHTML = `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">No devices on the harness yet. Add stations/devices under Harness.</div>`;
  } else {
    // Ensure defaults without clobbering user IDs
    let suggest = 1;
    const used = new Set(devices.map(d => parseInt(d.device.nodeId, 10)).filter(n => n >= 1 && n <= 127));
    devices.forEach(({ device }) => {
      if (device.nodeId == null || device.nodeId === '') {
        while (used.has(suggest) && suggest <= 127) suggest++;
        ensureDeviceCanopenDefaults(device, Math.min(127, suggest));
        used.add(device.nodeId);
        suggest++;
      } else {
        ensureDeviceCanopenDefaults(device, device.nodeId);
      }
    });

    listEl.innerHTML = devices.map(({ station, device }, idx) => {
      const nid = parseInt(device.nodeId, 10) || 1;
      const hb = device.heartbeatMs != null ? device.heartbeatMs : canopenConfig.defaultHeartbeatMs;
      const tpdo1 = formatCobId(canopenCobId('tpdo1', nid).id);
      return `
        <div class="canopen-node-row" data-dev-id="${device.id}">
          <div>
            <div class="node-name" title="${device.name}">${device.name || 'Device'}</div>
            <div class="node-meta">${station.name || 'Station'} · TPDO1 ${tpdo1}</div>
          </div>
          <input type="number" class="canopen-node-id" min="1" max="127" value="${nid}" data-dev-id="${device.id}" title="Node-ID" />
          <input type="number" class="canopen-hb-ms" min="0" max="60000" step="10" value="${hb}" data-dev-id="${device.id}" title="Heartbeat ms (0=off)" />
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.canopen-node-id').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-dev-id');
        const val = Math.min(127, Math.max(1, parseInt(e.target.value, 10) || 1));
        e.target.value = val;
        setDeviceField(id, 'nodeId', val);
        updateCanopenUi();
      });
    });
    listEl.querySelectorAll('.canopen-hb-ms').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-dev-id');
        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
        setDeviceField(id, 'heartbeatMs', val);
        updateCanopenBusLoad();
      });
    });
  }

  updateCobIdCalculator();
  updateCanopenBusLoad();
}

function setDeviceField(devId, key, value) {
  for (const st of stations) {
    const dev = (st.devices || []).find(d => d.id === devId);
    if (dev) {
      dev[key] = value;
      return;
    }
  }
}

/**
 * Classic CAN frame bit length approx (no stuffing):
 * SOF(1)+ID(11)+RTR(1)+IDE(1)+r0(1)+DLC(4)+data(8*DLC)+CRC(15)+CRC_del(1)+ACK(2)+EOF(7)+IFS(3)
 * ≈ 47 + 8*DLC
 */
function classicCanFrameBits(dlc) {
  return 47 + 8 * Math.min(8, Math.max(0, dlc));
}

function updateCanopenBusLoad() {
  const el = document.getElementById('canopen-busload-results');
  if (!el) return;
  const bitrate = (networkConfig.baudRate || 250) * 1000; // bit/s
  const devices = getAllDevices();
  const n = devices.length;

  let bps = 0; // bits per second offered

  // Heartbeats: 1-byte typically (DLC=1) at each node's period
  devices.forEach(({ device }) => {
    const hb = device.heartbeatMs != null ? device.heartbeatMs : canopenConfig.defaultHeartbeatMs;
    if (hb > 0) {
      bps += classicCanFrameBits(1) * (1000 / hb);
    }
  });

  // SYNC (DLC=0 or 1) if producer present
  if (canopenConfig.syncProducer && canopenConfig.syncPeriodMs > 0) {
    bps += classicCanFrameBits(0) * (1000 / canopenConfig.syncPeriodMs);
  }

  // PDO traffic
  if (n > 0 && canopenConfig.pdoPerNode > 0 && canopenConfig.pdoCycleMs > 0) {
    const framesPerSec = n * canopenConfig.pdoPerNode * (1000 / canopenConfig.pdoCycleMs);
    bps += framesPerSec * classicCanFrameBits(canopenConfig.pdoDlc);
  }

  const loadPct = bitrate > 0 ? (bps / bitrate) * 100 : 0;
  const over = loadPct > 70;
  el.innerHTML = `
    <div><strong>Nodes:</strong> ${n} · <strong>Baud:</strong> ${networkConfig.baudRate} kbps</div>
    <div><strong>Offered traffic:</strong> ${(bps / 1000).toFixed(1)} kbit/s</div>
    <div style="margin-top:4px;font-weight:700;color:${over ? 'var(--error,#ef4444)' : 'var(--text-primary)'}">
      Est. bus load ≈ ${loadPct.toFixed(1)}% ${over ? '(high — target &lt; 70% for real-time)' : ''}
    </div>
    <div class="canopen-load-bar ${over ? 'over' : ''}"><span style="width:${Math.min(100, loadPct)}%"></span></div>
    <div style="margin-top:6px;color:var(--text-muted);font-size:11px;">Excludes bit stuffing, SDO, EMCY, and retransmits. Use as a planning check only.</div>
  `;
}

function exportCanopenNodeMapCsv() {
  const rows = [['Station', 'Device', 'NodeID', 'Heartbeat_ms', 'EMCY', 'TPDO1', 'RPDO1', 'SDO_TX', 'SDO_RX', 'HEARTBEAT']];
  getAllDevices().forEach(({ station, device }) => {
    const n = parseInt(device.nodeId, 10) || 1;
    const hb = device.heartbeatMs != null ? device.heartbeatMs : canopenConfig.defaultHeartbeatMs;
    const hex = (key) => '0x' + canopenCobId(key, n).id.toString(16).toUpperCase();
    rows.push([
      station.name || '',
      device.name || '',
      n,
      hb,
      hex('emcy'),
      hex('tpdo1'),
      hex('rpdo1'),
      hex('sdotx'),
      hex('sdorx'),
      hex('heartbeat')
    ]);
  });
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canopen-node-map-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (window.showToast) window.showToast('CANopen node map CSV exported.');
}

// ── Bit Timing (nominal arbitration phase) ───────────────────
function solveCanBitTiming(baudKbps, samplePointPct, clockMHz, sjwMax) {
  const bitrate = baudKbps * 1000;
  const clockHz = clockMHz * 1e6;
  if (!bitrate || !clockHz) return { error: "Invalid baud rate or clock." };

  const targetSp = Math.min(95, Math.max(50, samplePointPct)) / 100;
  let best = null;

  for (let nTq = 8; nTq <= 25; nTq++) {
    const brpExact = clockHz / (bitrate * nTq);
    const brp = Math.round(brpExact);
    if (brp < 1 || brp > 1024) continue;
    if (Math.abs(brpExact - brp) / brp > 0.001) continue; // require near-integer BRP

    // SYNC_SEG = 1; TSEG1 + TSEG2 = nTq - 1
    // sample point ≈ (1 + TSEG1) / nTq
    let tseg1 = Math.round(targetSp * nTq) - 1;
    tseg1 = Math.max(1, Math.min(nTq - 2, tseg1));
    let tseg2 = nTq - 1 - tseg1;
    if (tseg2 < 1) {
      tseg2 = 1;
      tseg1 = nTq - 2;
    }
    const sp = (1 + tseg1) / nTq;
    const sjw = Math.min(sjwMax || 4, tseg2, 4);
    const tqNs = (brp / clockHz) * 1e9;
    const bitNs = tqNs * nTq;
    const errPpm = Math.abs(1e6 * ((clockHz / (brp * nTq)) - bitrate) / bitrate);
    const spErr = Math.abs(sp - targetSp);
    const score = errPpm * 10 + spErr * 1000;

    if (!best || score < best.score) {
      best = {
        brp, nTq, tseg1, tseg2, sjw, tqNs, bitNs, sp, errPpm, score,
        bitrateAchieved: clockHz / (brp * nTq)
      };
    }
  }

  if (!best) return { error: "No integer BRP solution for this clock/baud. Try another clock (e.g. 40/80 MHz)." };
  return best;
}

function updateBitTimingResults() {
  const el = document.getElementById('bit-timing-results');
  if (!el) return;
  const clock = parseFloat(document.getElementById('input-can-clock')?.value) || 40;
  const sjwMax = parseInt(document.getElementById('input-sjw')?.value) || 4;
  const baud = networkConfig.baudRate;
  const sp = networkConfig.samplePoint;
  const sol = solveCanBitTiming(baud, sp, clock, sjwMax);

  if (sol.error) {
    el.innerHTML = `<span style="color:var(--color-error,#ef4444)">${sol.error}</span>`;
    return;
  }

  let html = `
    <div><strong>Nominal ${baud} kbps</strong> @ ${clock} MHz clock</div>
    <div>BRP=${sol.brp} · NTQ=${sol.nTq} · TSEG1=${sol.tseg1} · TSEG2=${sol.tseg2} · SJW=${sol.sjw}</div>
    <div>tq=${sol.tqNs.toFixed(2)} ns · t_bit=${sol.bitNs.toFixed(1)} ns</div>
    <div>Sample point=${(sol.sp * 100).toFixed(1)}% (target ${sp}%) · rate err=${sol.errPpm.toFixed(1)} ppm</div>
  `;

  if (networkConfig.enableCanFD) {
    const dataSol = solveCanBitTiming(networkConfig.dataBaudRate, networkConfig.dataSamplePoint, clock, sjwMax);
    if (!dataSol.error) {
      html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color)">
        <strong>Data phase ${networkConfig.dataBaudRate} kbps</strong><br>
        BRP=${dataSol.brp} · NTQ=${dataSol.nTq} · TSEG1=${dataSol.tseg1} · TSEG2=${dataSol.tseg2} · SJW=${dataSol.sjw}<br>
        tq=${dataSol.tqNs.toFixed(2)} ns · SP=${(dataSol.sp * 100).toFixed(1)}%
      </div>`;
    } else {
      html += `<div style="margin-top:8px;color:var(--color-error,#ef4444)">Data phase: ${dataSol.error}</div>`;
    }
  }

  el.innerHTML = html;
}

// ── DBC snippet parser (BU_ / BO_ / SG_ / VAL_ subset) ────────
let lastDbcImport = { nodes: [], messages: [] };

function parseDbcSnippet() {
  const ta = document.getElementById('dbc-import-text');
  const out = document.getElementById('dbc-parse-results');
  if (!ta || !out) return;
  const text = ta.value || '';
  const messages = [];
  const nodes = new Set();
  let current = null;

  // BU_: Node1 Node2 ...
  text.split(/\r?\n/).forEach(line => {
    const bu = line.match(/^\s*BU_\s*:\s*(.*)$/);
    if (bu && bu[1]) {
      bu[1].trim().split(/\s+/).filter(Boolean).forEach(n => nodes.add(n));
    }
  });

  text.split(/\r?\n/).forEach(line => {
    const bo = line.match(/^\s*BO_\s+(\d+)\s+(\w+)\s*:\s*(\d+)\s+(\S+)/);
    if (bo) {
      current = {
        id: parseInt(bo[1], 10),
        name: bo[2],
        dlc: parseInt(bo[3], 10),
        transmitter: bo[4],
        signals: []
      };
      messages.push(current);
      return;
    }
    const sg = line.match(/^\s*SG_\s+(\w+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^\]]*)\]\s*"([^"]*)"/);
    if (sg && current) {
      current.signals.push({
        name: sg[1],
        start: parseInt(sg[2], 10),
        length: parseInt(sg[3], 10),
        endian: sg[4] === '1' ? 'Intel' : 'Motorola',
        sign: sg[5] === '-' ? 'signed' : 'unsigned',
        scale: sg[6],
        offset: sg[7],
        unit: sg[9]
      });
    }
  });

  if (messages.length === 0) {
    out.innerHTML = `<span style="color:var(--text-muted)">No <code>BO_</code> messages found. Paste a DBC fragment with BO_/SG_ lines.</span>`;
    return;
  }

  out.innerHTML = messages.map(m => {
    const idHex = '0x' + m.id.toString(16).toUpperCase();
    const sigs = m.signals.length
      ? `<ul style="margin:4px 0 0 16px;padding:0">${m.signals.map(s =>
          `<li><code>${s.name}</code> ${s.start}|${s.length} ${s.endian} ×${s.scale}+${s.offset} ${s.unit ? '[' + s.unit + ']' : ''}</li>`
        ).join('')}</ul>`
      : `<div style="color:var(--text-muted);margin-top:4px">No signals parsed</div>`;
    return `<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border-color)">
      <strong>${m.name}</strong> · ID ${m.id} (${idHex}) · DLC ${m.dlc} · TX ${m.transmitter}
      ${sigs}
    </div>`;
  }).join('');

  lastDbcImport = { nodes: [...nodes], messages };
  // Signal matrix: messages × nodes (Tx only for transmitters; Rx unknown without SG_ multiplexing)
  const nodeList = [...nodes];
  if (nodeList.length === 0) {
    messages.forEach(m => { if (m.transmitter && m.transmitter !== 'Vector__XXX') nodeList.push(m.transmitter); });
  }
  const uniqueNodes = [...new Set(nodeList)];
  let matrixHtml = '';
  if (uniqueNodes.length && messages.length) {
    matrixHtml = `<div style="margin-top:12px;overflow:auto;"><div style="font-weight:700;font-size:12px;margin-bottom:6px;">Signal matrix (Tx)</div>
      <table style="border-collapse:collapse;font-size:11px;width:100%;">
        <thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border-color)">Message</th>
        ${uniqueNodes.map(n => `<th style="padding:4px;border-bottom:1px solid var(--border-color)">${n}</th>`).join('')}
        </tr></thead><tbody>
        ${messages.map(m => `<tr>
          <td style="padding:4px;border-bottom:1px solid var(--border-color)">${m.name}</td>
          ${uniqueNodes.map(n => `<td style="text-align:center;padding:4px;border-bottom:1px solid var(--border-color)">${m.transmitter === n ? 'Tx' : ''}</td>`).join('')}
        </tr>`).join('')}
        </tbody></table></div>`;
  }
  out.innerHTML = (out.innerHTML || '') + matrixHtml +
    (uniqueNodes.length
      ? `<div style="margin-top:8px;"><button type="button" class="btn btn-primary" id="btn-dbc-apply-nodes" style="font-size:11px;padding:4px 10px;">Suggest devices from BU_ (${uniqueNodes.length})</button></div>`
      : '');
  document.getElementById('btn-dbc-apply-nodes')?.addEventListener('click', () => {
    if (!stations.length) {
      stations.push({
        id: 's_dbc',
        name: 'DBC Nodes',
        distanceFromPrev: 0,
        termination: 0,
        devices: []
      });
    }
    const st = stations[stations.length - 1];
    uniqueNodes.forEach(n => {
      if (!(st.devices || []).some(d => d.name === n)) {
        st.devices.push({ id: 'd_' + Math.random().toString(36).slice(2, 8), name: n, stubLength: 0.1, termination: 0 });
      }
    });
    render();
    if (window.showToast) window.showToast('Added DBC nodes as devices on last station');
  });

  if (window.showToast) window.showToast(`Parsed ${messages.length} DBC message(s)${uniqueNodes.length ? ', ' + uniqueNodes.length + ' node(s)' : ''}.`);
}

// ── Topology wizard + harness exports ────────────────────────
function openTopologyWizard() {
  const choice = prompt(
    'New harness wizard:\n' +
    '1 = Multi-drop daisy-chain (linear backbone)\n' +
    '2 = Backbone + stub splices\n' +
    '3 = Y-split branched trunk\n' +
    '4 = Empty\n\nEnter 1–4:',
    '1'
  );
  if (!choice) return;
  buses = [{ id: 'bus-1', name: 'CAN Network' }];
  activeBusId = 'bus-1';
  if (choice === '4') {
    stations = [];
    render();
    return;
  }
  if (choice === '3') {
    // Branched trunk: main A—J—B with branch J—C
    stations = [
      { id: 's1', name: 'End A', parentId: null, distanceFromParent: 0, termination: 120, busId: 'bus-1', devices: [{ id: 'd1', name: 'ECU A', stubLength: 0.1, termination: 0 }] },
      { id: 's2', name: 'Y-Junction', parentId: 's1', distanceFromParent: 5, termination: 0, busId: 'bus-1', devices: [] },
      { id: 's3', name: 'End B', parentId: 's2', distanceFromParent: 6, termination: 120, busId: 'bus-1', devices: [{ id: 'd2', name: 'ECU B', stubLength: 0.1, termination: 0 }] },
      { id: 's4', name: 'Branch C', parentId: 's2', distanceFromParent: 3, termination: 0, busId: 'bus-1', devices: [{ id: 'd3', name: 'Door Module', stubLength: 0.15, termination: 0 }] }
    ];
  } else if (choice === '2') {
    stations = [
      { id: 's1', name: 'End A', distanceFromPrev: 0, termination: 120, busId: 'bus-1', devices: [{ id: 'd1', name: 'ECU A', stubLength: 0.1, termination: 0 }] },
      { id: 's2', name: 'Harness Splitter', distanceFromPrev: 5, termination: 0, busId: 'bus-1', devices: [{ id: 'd2', name: 'Sensor', stubLength: 0.15, termination: 0 }] },
      { id: 's3', name: 'Multi-drop', distanceFromPrev: 4, termination: 0, busId: 'bus-1', devices: [
        { id: 'd3', name: 'Module B', stubLength: 0.2, termination: 0 },
        { id: 'd4', name: 'Module C', stubLength: 0.2, termination: 0 }
      ]},
      { id: 's4', name: 'End B', distanceFromPrev: 6, termination: 120, busId: 'bus-1', devices: [{ id: 'd5', name: 'ECU B', stubLength: 0.1, termination: 0 }] }
    ];
  } else {
    stations = [
      { id: 's1', name: 'Node 1', distanceFromPrev: 0, termination: 120, busId: 'bus-1', devices: [{ id: 'd1', name: 'ECU 1', stubLength: 0.05, termination: 0 }] },
      { id: 's2', name: 'Node 2', distanceFromPrev: 3, termination: 0, busId: 'bus-1', devices: [{ id: 'd2', name: 'ECU 2', stubLength: 0.05, termination: 0 }] },
      { id: 's3', name: 'Node 3', distanceFromPrev: 3, termination: 0, busId: 'bus-1', devices: [{ id: 'd3', name: 'ECU 3', stubLength: 0.05, termination: 0 }] },
      { id: 's4', name: 'Node 4', distanceFromPrev: 3, termination: 120, busId: 'bus-1', devices: [{ id: 'd4', name: 'ECU 4', stubLength: 0.05, termination: 0 }] }
    ];
  }
  stations.forEach(s => { if (s.parentId === undefined) s.parentId = undefined; });
  normalizeStationsInPlace();
  try { if (window.ETAnalytics) window.ETAnalytics.trackEngaged('can-bus-designer'); } catch (_) {}
  render();
  if (window.showToast) window.showToast('Wizard topology applied — use + Branch for more Y-splits');
}

function exportHarnessSvg() {
  if (!harnessSvg) return;
  const clone = harnessSvg.cloneNode(true);
  // Inline a white background for print
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'can-harness-topology.svg';
  a.click();
  URL.revokeObjectURL(url);
  if (window.showToast) window.showToast('Harness SVG downloaded');
}

function exportPinTableCsv() {
  const rows = [['Station', 'Station_Term_ohm', 'Device', 'Stub_m', 'Device_Term_ohm', 'Position_m']];
  let pos = 0;
  stations.forEach((st) => {
    ensureStationDefaults(st);
    pos += st.distanceFromPrev || 0;
    (st.devices || []).forEach(dev => {
      rows.push([
        st.name,
        String(st.termination || 0),
        dev.name,
        (dev.stubLength || 0).toFixed(3),
        String(dev.termination || 0),
        pos.toFixed(3)
      ]);
    });
    if (!(st.devices || []).length) {
      rows.push([st.name, String(st.termination || 0), '', '', '', pos.toFixed(3)]);
    }
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'can-harness-pin-table.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Harness BOM CSV ──────────────────────────────────────────
function buildHarnessBomRows() {
  const rows = [['Item', 'Type', 'Name', 'Qty', 'Length_m', 'Notes']];
  let trunkLen = 0;
  stations.forEach((st, i) => {
    if (i > 0) {
      const seg = st.distanceFromPrev || 0;
      trunkLen += seg;
      rows.push([
        `TRUNK-${i}`,
        'Trunk Cable',
        `${stations[i - 1].name} → ${st.name}`,
        '1',
        seg.toFixed(3),
        `Segment spacing (${currentUnit})`
      ]);
    }
    (st.devices || []).forEach((dev, di) => {
      rows.push([
        `DEV-${i + 1}-${di + 1}`,
        'Device / ECU',
        dev.name || 'Device',
        '1',
        (dev.stubLength || 0).toFixed(3),
        `Stub at station "${st.name}"${dev.termination ? '; terminator ' + dev.termination + 'Ω' : ''}`
      ]);
      if (dev.termination && dev.termination > 0) {
        rows.push([
          `TERM-${i + 1}-${di + 1}`,
          'Terminator',
          `${dev.termination} Ω @ ${dev.name}`,
          '1',
          '',
          'End/mid-bus termination resistor'
        ]);
      }
    });
  });
  rows.push(['SUMMARY', 'Trunk Total', 'Bus length', '1', trunkLen.toFixed(3), `${networkConfig.baudRate} kbps design`]);
  rows.push(['SUMMARY', 'Node Count', 'Devices', String(stations.reduce((n, s) => n + (s.devices || []).length, 0)), '', '']);
  return rows;
}

function exportHarnessBomCsv() {
  const rows = buildHarnessBomRows();
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `can-harness-bom-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (window.showToast) window.showToast('Harness BOM CSV exported.');
}

function orderedStationsForUi(busId) {
  const list = stationsOnBus(busId);
  const byParent = new Map();
  list.forEach(s => {
    const p = s.parentId || '__root__';
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(s);
  });
  const out = [];
  const walk = (pid, depth) => {
    (byParent.get(pid) || []).forEach(s => {
      out.push({ station: s, depth });
      walk(s.id, depth + 1);
    });
  };
  walk('__root__', 0);
  // Orphans already re-rooted in normalize
  return out;
}

// Render inputs list (Station hierarchy / tree)
function renderStationCards() {
  stationListContainer.innerHTML = '';
  normalizeStationsInPlace();
  refreshBusSelect();
  refreshStandardsPackUi();

  const busStations = stationsOnBus(activeBusId);
  if (busStations.length === 0) {
    stationListContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: var(--r-md)">
        No stations on this bus. Click <strong>Add Station</strong> or use the Wizard.
      </div>
    `;
    return;
  }

  const ordered = orderedStationsForUi(activeBusId);
  ordered.forEach(({ station, depth }, index) => {
    const isRoot = !station.parentId;
    const parent = station.parentId ? stations.find(s => s.id === station.parentId) : null;

    // Trunk edge length from parent
    if (!isRoot) {
      const connector = document.createElement('div');
      connector.className = 'station-connector';
      connector.style.marginLeft = `${Math.min(depth, 4) * 12}px`;
      connector.innerHTML = `
        <div class="connector-line"></div>
        <div class="connector-input-wrapper">
          <i data-lucide="git-branch" style="width: 13px; height: 13px; color: var(--text-muted);"></i>
          <span class="connector-label">${parent ? 'From ' + parent.name : 'Trunk'}:</span>
          <input type="number" class="station-dist-input" value="${fromMeters(station.distanceFromParent || 0).toFixed(currentUnit === 'mm' ? 0 : 1)}" data-action="edit-station-dist" min="0.001" step="any" title="Trunk cable length from parent junction (${currentUnit})">
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${currentUnit}</span>
        </div>
        <div class="connector-line"></div>
      `;
      connector.querySelector('[data-action="edit-station-dist"]').addEventListener('change', (e) => {
        const len = Math.max(0.001, toMeters(parseFloat(e.target.value) || 0));
        station.distanceFromParent = len;
        station.distanceFromPrev = len;
        render();
      });
      stationListContainer.appendChild(connector);
    }

    const card = document.createElement('div');
    card.className = 'station-card';
    card.dataset.id = station.id;
    card.style.marginLeft = `${Math.min(depth, 4) * 12}px`;

    ensureStationDefaults(station);
    const stubMax = maxStubLimitMeters();
    const stTerm = station.termination || 0;

    card.innerHTML = `
      <div class="station-header">
        <div class="station-title-group" style="cursor: grab;">
          <i data-lucide="grip-vertical" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: -4px;"></i>
          <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--accent);"></i>
          <input type="text" class="station-name-input" value="${station.name}" data-action="edit-station-name" title="Station name">
          ${isRoot ? `<span class="start-badge">Root</span>` : `<span class="start-badge" style="opacity:0.85;">Branch</span>`}
          ${stTerm > 0 ? `<span class="term-badge" title="Bus terminator at this station">${stTerm}&nbsp;Ω</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <button type="button" class="btn" data-action="add-branch" title="Add trunk branch (Y-split) from this junction" style="padding:2px 8px;font-size:10px;height:28px;">+ Branch</button>
          <button class="btn-delete" data-action="delete-station" title="Delete this station (children re-attach to parent)" style="margin-left: 4px;">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </div>
      <div class="station-term-row" style="display:flex;align-items:center;gap:8px;padding:0 10px 8px;flex-wrap:wrap;">
        <label style="font-size:11px;color:var(--text-muted);white-space:nowrap;" title="Optional 120 Ω bus terminator at this junction (typical at each physical end)">Termination</label>
        <select class="device-input" data-action="edit-station-term" title="Bus terminator at this station (not a device)" style="max-width:120px;">
          <option value="0" ${stTerm === 0 ? 'selected' : ''}>None</option>
          <option value="120" ${stTerm === 120 ? 'selected' : ''}>120 Ω</option>
          <option value="custom" ${stTerm !== 0 && stTerm !== 120 ? 'selected' : ''}>Custom…</option>
        </select>
        <input type="number" class="device-input station-term-custom" data-action="edit-station-term-val" value="${stTerm || 120}" min="1" max="1000" style="display:${stTerm !== 0 && stTerm !== 120 ? 'block' : 'none'};max-width:80px;" title="Custom termination (Ω)">
      </div>
      
      <div class="station-devices-container">
        <!-- Render Devices list inside this station -->
        <div id="device-list-${station.id}" style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Populated inside loop -->
        </div>
        <button class="btn-add-device" data-action="add-device">
          <i data-lucide="plus-circle" style="width: 12px; height: 12px;"></i> Add Device
        </button>
      </div>
    `;

    card.querySelector('[data-action="edit-station-term"]')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const customInput = card.querySelector('.station-term-custom');
      if (val === 'custom') {
        if (customInput) customInput.style.display = 'block';
        station.termination = Math.max(1, parseInt(customInput?.value, 10) || 120);
      } else {
        if (customInput) customInput.style.display = 'none';
        station.termination = parseInt(val, 10) || 0;
      }
      render();
    });
    card.querySelector('[data-action="edit-station-term-val"]')?.addEventListener('change', (e) => {
      station.termination = Math.max(1, parseInt(e.target.value, 10) || 120);
      render();
    });

    // Drag-and-drop for Stations (only active when dragging the grab handle)
    const titleGroup = card.querySelector('.station-title-group');
    titleGroup.addEventListener('mousedown', () => {
      card.setAttribute('draggable', 'true');
    });
    titleGroup.addEventListener('mouseup', () => {
      card.removeAttribute('draggable');
    });

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/station-id', station.id);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.removeAttribute('draggable');
      card.classList.remove('dragging');
    });

    card.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/station-id')) {
        e.preventDefault();
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      const sourceId = e.dataTransfer.getData('text/station-id');
      if (sourceId && sourceId !== station.id) {
        e.preventDefault();
        card.classList.remove('drag-over');
        const sourceIndex = stations.findIndex(s => s.id === sourceId);
        const targetIndex = stations.findIndex(s => s.id === station.id);
        if (sourceIndex > -1 && targetIndex > -1) {
          const [movedStation] = stations.splice(sourceIndex, 1);
          stations.splice(targetIndex, 0, movedStation);
          stations[0].distanceFromPrev = 0;
          render();
        }
      }
    });

    // Populate devices
    const deviceListDiv = card.querySelector(`#device-list-${station.id}`);
    station.devices.forEach((device) => {
      const devRow = document.createElement('div');
      devRow.className = 'device-row';
      devRow.dataset.deviceId = device.id;

      devRow.innerHTML = `
        <div class="device-row-top">
          <div class="device-name-group" style="display: flex; align-items: center; gap: 4px; cursor: grab; flex: 1; min-width: 0;">
            <i data-lucide="grip-vertical" style="width: 12px; height: 12px; color: var(--text-muted); flex-shrink: 0;"></i>
            <input type="text" class="device-input" value="${device.name}" data-action="edit-device-name" title="Device name" style="flex: 1; min-width: 0;">
          </div>
          <button class="btn-delete" data-action="delete-device" title="Remove this device from star splice">
            <i data-lucide="trash" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
        <div class="device-row-bottom">
          <div class="device-field">
            <span class="device-field-label">Stub</span>
            <input type="number" class="device-input" value="${fromMeters(device.stubLength).toFixed(currentUnit === 'm' ? 2 : currentUnit === 'mm' ? 0 : 1)}" data-action="edit-device-stub" min="0" step="any" title="Stub length from station/splice (${currentUnit})">
            <span class="device-field-unit">${currentUnit}</span>
          </div>
          <div class="device-field">
            <span class="device-field-label">Term</span>
            <select class="device-input" data-action="edit-device-term" title="Device termination">
              <option value="0" ${device.termination === 0 ? 'selected' : ''}>None</option>
              <option value="120" ${device.termination === 120 ? 'selected' : ''}>120 Ω</option>
              <option value="custom" ${device.termination !== 0 && device.termination !== 120 ? 'selected' : ''}>Custom...</option>
            </select>
            <input type="number" class="device-input custom-term-input" value="${device.termination}" data-action="edit-device-term-val" min="1" max="1000" style="display: ${device.termination !== 0 && device.termination !== 120 ? 'block' : 'none'};" title="Custom resistance in Ohms">
          </div>
        </div>
      `;

      // Drag-and-drop for Devices inside this row
      const devGrip = devRow.querySelector('.device-name-group');
      devGrip.addEventListener('mousedown', () => {
        devRow.setAttribute('draggable', 'true');
      });
      devGrip.addEventListener('mouseup', () => {
        devRow.removeAttribute('draggable');
      });

      devRow.addEventListener('dragstart', (e) => {
        e.stopPropagation(); // Stop parent station card from dragging
        e.dataTransfer.setData('text/device-id', device.id);
        e.dataTransfer.setData('text/source-station-id', station.id);
        devRow.classList.add('dragging');
      });

      devRow.addEventListener('dragend', () => {
        devRow.removeAttribute('draggable');
        devRow.classList.remove('dragging');
      });

      devRow.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('text/device-id')) {
          e.preventDefault();
          e.stopPropagation();
          devRow.classList.add('drag-over');
        }
      });

      devRow.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        devRow.classList.remove('drag-over');
      });

      // Bind device events
      devRow.querySelectorAll('.device-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const action = e.target.dataset.action;
          let val = e.target.value;

          if (action === 'edit-device-name') {
            device.name = val;
          } else if (action === 'edit-device-stub') {
            device.stubLength = toMeters(Math.max(0, parseFloat(val) || 0));
          } else if (action === 'edit-device-term') {
            const customInput = devRow.querySelector('.custom-term-input');
            if (val === 'custom') {
              customInput.style.display = 'block';
              device.termination = parseInt(customInput.value) || 120;
            } else {
              customInput.style.display = 'none';
              device.termination = parseInt(val);
            }
          } else if (action === 'edit-device-term-val') {
            device.termination = Math.max(1, parseInt(val) || 120);
          }

          render();
        });
      });

      // Delete device event
      devRow.querySelector('[data-action="delete-device"]').addEventListener('click', () => {
        station.devices = station.devices.filter(d => d.id !== device.id);
        render();
      });

      deviceListDiv.appendChild(devRow);
    });

    // Drag-and-drop targets for device lists inside stations
    const devContainer = card.querySelector(`.station-devices-container`);
    devContainer.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/device-id')) {
        e.preventDefault();
        e.stopPropagation();
        devContainer.classList.add('drag-over');
      }
    });

    devContainer.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      devContainer.classList.remove('drag-over');
    });

    devContainer.addEventListener('drop', (e) => {
      const deviceId = e.dataTransfer.getData('text/device-id');
      const sourceStationId = e.dataTransfer.getData('text/source-station-id');
      if (deviceId && sourceStationId) {
        e.preventDefault();
        e.stopPropagation();
        devContainer.classList.remove('drag-over');

        const sourceStation = stations.find(s => s.id === sourceStationId);
        const targetStation = station;

        if (sourceStation && targetStation) {
          const deviceIndex = sourceStation.devices.findIndex(d => d.id === deviceId);
          if (deviceIndex > -1) {
            const [movedDevice] = sourceStation.devices.splice(deviceIndex, 1);
            
            // Check if dropped on a specific device row inside container
            const targetRow = e.target.closest('.device-row');
            if (targetRow && targetRow.dataset.deviceId) {
              targetRow.classList.remove('drag-over');
              const targetDevIndex = targetStation.devices.findIndex(d => d.id === targetRow.dataset.deviceId);
              if (targetDevIndex > -1) {
                targetStation.devices.splice(targetDevIndex, 0, movedDevice);
              } else {
                targetStation.devices.push(movedDevice);
              }
            } else {
              targetStation.devices.push(movedDevice);
            }
            render();
          }
        }
      }
    });

    // Add device event
    card.querySelector('[data-action="add-device"]').addEventListener('click', () => {
      station.devices.push({
        id: 'd_' + Date.now().toString() + '_' + Math.floor(Math.random() * 1000),
        name: `Node ${station.devices.length + 1}`,
        stubLength: 0.1,
        termination: 0
      });
      render();
    });

    // Edit station name
    card.querySelector('[data-action="edit-station-name"]').addEventListener('change', (e) => {
      station.name = e.target.value;
      render();
    });

    // Add trunk branch (Y-split)
    card.querySelector('[data-action="add-branch"]')?.addEventListener('click', () => {
      const id = 's_' + Date.now().toString(36);
      stations.push({
        id,
        name: `Branch ${childStations(station.id).length + 1}`,
        parentId: station.id,
        distanceFromParent: 2.0,
        distanceFromPrev: 2.0,
        busId: station.busId || activeBusId,
        termination: 0,
        devices: [{ id: 'd_' + Date.now().toString(36), name: 'Node', stubLength: 0.1, termination: 0 }]
      });
      try { if (window.ETAnalytics) window.ETAnalytics.trackEngaged('can-bus-designer'); } catch (_) {}
      render();
    });

    // Delete Station — reparent children to this station's parent
    card.querySelector('[data-action="delete-station"]').addEventListener('click', () => {
      const kids = childStations(station.id);
      kids.forEach(ch => {
        ch.parentId = station.parentId || null;
        if (!ch.parentId) {
          ch.distanceFromParent = 0;
          ch.distanceFromPrev = 0;
        }
      });
      stations = stations.filter(s => s.id !== station.id);
      normalizeStationsInPlace();
      render();
    });

    stationListContainer.appendChild(card);
  });
}

function refreshStandardsPackUi() {
  const sel = document.getElementById('select-standards-pack');
  const desc = document.getElementById('standards-pack-desc');
  if (sel && sel.value !== standardsPackId) sel.value = standardsPackId;
  if (desc) {
    const pack = getActivePack();
    desc.textContent = pack.description || '';
  }
}

function refreshBusSelect() {
  ensureBuses();
  const sel = document.getElementById('select-active-bus');
  if (!sel) return;
  sel.innerHTML = buses.map(b =>
    `<option value="${b.id}" ${b.id === activeBusId ? 'selected' : ''}>${b.name}</option>`
  ).join('');
  const delBtn = document.getElementById('btn-delete-bus');
  if (delBtn) {
    delBtn.disabled = buses.length <= 1;
    delBtn.title = buses.length <= 1
      ? 'Cannot delete the last remaining bus'
      : 'Delete the active bus and all its stations';
    delBtn.style.opacity = buses.length <= 1 ? '0.45' : '1';
    delBtn.style.cursor = buses.length <= 1 ? 'not-allowed' : 'pointer';
  }
}

/** Scroll station (and optional device) into view in the config list and highlight it. */
function focusListItem({ stationId, deviceId } = {}) {
  if (!stationListContainer || !stationId) return;
  // Switch active bus if the station lives on another bus
  const st = stations.find(s => s.id === stationId);
  if (st && st.busId && st.busId !== activeBusId) {
    activeBusId = st.busId;
    renderStationCards();
  }

  stationListContainer.querySelectorAll('.station-card.list-focus, .device-row.list-focus').forEach(el => {
    el.classList.remove('list-focus');
  });

  const card = stationListContainer.querySelector(`.station-card[data-id="${stationId}"]`);
  if (!card) return;
  card.classList.add('list-focus');

  let scrollTarget = card;
  if (deviceId) {
    const row = card.querySelector(`.device-row[data-device-id="${deviceId}"]`);
    if (row) {
      row.classList.add('list-focus');
      scrollTarget = row;
    }
  }

  // Center in the scrollable panel-body if possible
  const panelBody = card.closest('.panel-body') || stationListContainer;
  if (panelBody && panelBody.scrollHeight > panelBody.clientHeight) {
    const panelRect = panelBody.getBoundingClientRect();
    const targetRect = scrollTarget.getBoundingClientRect();
    const delta = (targetRect.top + targetRect.height / 2) - (panelRect.top + panelRect.height / 2);
    panelBody.scrollBy({ top: delta, behavior: 'smooth' });
  } else {
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function hideCanvasAddMenu() {
  document.getElementById('canvas-add-menu')?.remove();
}

/**
 * Floating chooser when clicking + on the canvas: Device | Trunk station | Branch.
 */
function showCanvasAddMenu(station, clientX, clientY) {
  hideCanvasAddMenu();
  const menu = document.createElement('div');
  menu.id = 'canvas-add-menu';
  menu.className = 'canvas-add-menu';
  menu.innerHTML = `
    <div class="canvas-add-menu-title">Add at “${escapeHtml(station.name)}”</div>
    <button type="button" data-add="device">Device (ECU stub)</button>
    <button type="button" data-add="station">Trunk station (chain)</button>
    <button type="button" data-add="branch">Branch (Y-split)</button>
    <button type="button" data-add="cancel" class="canvas-add-cancel">Cancel</button>
  `;
  document.body.appendChild(menu);

  // Position near click, keep on-screen
  const pad = 8;
  const rect = menu.getBoundingClientRect();
  let left = clientX + 6;
  let top = clientY + 6;
  if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
  if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const close = () => {
    hideCanvasAddMenu();
    document.removeEventListener('mousedown', onOutside, true);
  };
  const onOutside = (ev) => {
    if (!menu.contains(ev.target)) close();
  };
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

  menu.querySelectorAll('button[data-add]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const kind = btn.getAttribute('data-add');
      close();
      if (kind === 'cancel') return;
      addFromCanvas(station, kind);
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addFromCanvas(station, kind) {
  if (!station) return;
  if (kind === 'device') {
    station.devices = station.devices || [];
    const id = 'd_' + Date.now().toString(36);
    station.devices.push({
      id,
      name: `Node ${station.devices.length + 1}`,
      stubLength: 0.1,
      termination: 0
    });
    render();
    focusListItem({ stationId: station.id, deviceId: id });
    return;
  }
  if (kind === 'station' || kind === 'branch') {
    // Both create a child trunk station; "station" vs "branch" is the same graph op (Y if siblings exist)
    const id = 's_' + Date.now().toString(36);
    const n = childStations(station.id).length + 1;
    stations.push({
      id,
      name: kind === 'branch' ? `Branch ${n}` : `Station ${stations.length + 1}`,
      parentId: station.id,
      distanceFromParent: 2.0,
      distanceFromPrev: 2.0,
      busId: station.busId || activeBusId,
      termination: 0,
      devices: [{
        id: 'd_' + Date.now().toString(36),
        name: 'Node',
        stubLength: 0.1,
        termination: 0
      }]
    });
    try { if (window.ETAnalytics) window.ETAnalytics.trackEngaged('can-bus-designer'); } catch (_) {}
    render();
    focusListItem({ stationId: id });
    if (window.showToast) {
      window.showToast(kind === 'branch'
        ? 'Trunk branch added — set length and termination as needed'
        : 'Trunk station added on this junction');
    }
  }
}

/** Remove the active bus and every station on it. Keeps at least one bus. */
function deleteActiveBus() {
  ensureBuses();
  if (buses.length <= 1) {
    if (window.showToast) window.showToast('Cannot delete the only bus. Clear stations instead if needed.', false);
    return;
  }
  const bus = buses.find(b => b.id === activeBusId) || buses[0];
  const nOnBus = stationsOnBus(bus.id).length;
  const ok = confirm(
    `Delete bus "${bus.name}"?\n\n` +
    `This removes the bus and ${nOnBus} station(s) on it. This cannot be undone from this dialog.`
  );
  if (!ok) return;

  stations = stations.filter(s => (s.busId || 'bus-1') !== bus.id);
  buses = buses.filter(b => b.id !== bus.id);
  activeBusId = buses[0].id;
  normalizeStationsInPlace();
  if (window.showToast) window.showToast(`Deleted bus "${bus.name}"`);
  render();
}

// Core Physics and Rule Checker
function runDiagnostics() {
  readConfigInputs();
  normalizeStationsInPlace();

  const pack = getActivePack();
  const packLabel = pack.shortName || pack.name || 'Standards';

  const diagnostics = {
    errors: [],
    warnings: [],
    guidelines: [],
    eqResistance: 0,
    totalBusLength: 0,
    cableLength: 0,
    roundTripPropTime: 0,
    timeBudget: 0,
    riskPercentage: 0,
    stationStatuses: {},
    deviceStatuses: {},
    standardsPackId,
    standardsPackName: pack.name || packLabel
  };

  if (stations.length === 0) {
    diagnostics.checklists = [];
    return diagnostics;
  }

  stations.forEach(s => {
    diagnostics.stationStatuses[s.id] = 'pass';
    (s.devices || []).forEach(d => {
      diagnostics.deviceStatuses[d.id] = 'pass';
    });
  });

  const pushHard = (msg) => diagnostics.errors.push(msg);
  const pushWarn = (msg) => diagnostics.warnings.push(msg);
  const pushGuide = (msg) => diagnostics.guidelines.push(msg);

  const hard = pack.hard || {};
  const guides = pack.guidelines || {};

  // Aggregate across all buses; timing/length use worst-case bus
  let worstElectricalLen = 0;
  let totalCable = 0;
  buses.forEach(bus => {
    const eLen = electricalLengthM(bus.id);
    const cLen = cableLengthM(bus.id);
    if (eLen > worstElectricalLen) worstElectricalLen = eLen;
    totalCable += cLen;
  });
  // Single-bus designs: also cover stations without bus list mismatch
  if (worstElectricalLen === 0 && stations.length) {
    worstElectricalLen = electricalLengthM(activeBusId);
    totalCable = cableLengthM(activeBusId);
  }

  diagnostics.totalBusLength = worstElectricalLen; // electrical diameter (timing)
  diagnostics.cableLength = totalCable;

  // 1. Trunk length (hard) — electrical diameter vs pack table
  const maxAllowedTrunk = maxTrunkLengthM(networkConfig.baudRate);
  let trunkStatus = 'pass';
  if (hard.trunkLength) {
    if (worstElectricalLen > maxAllowedTrunk) {
      pushHard(`[${packLabel}] Electrical trunk span (${worstElectricalLen.toFixed(1)} m) exceeds max ${maxAllowedTrunk} m at ${networkConfig.baudRate} kbps.`);
      trunkStatus = 'fail';
    } else if (worstElectricalLen > maxAllowedTrunk * 0.8) {
      pushWarn(`[${packLabel}] Trunk span (${worstElectricalLen.toFixed(1)} m) is nearing the ${maxAllowedTrunk} m limit at ${networkConfig.baudRate} kbps.`);
      trunkStatus = 'warn';
    }
  }

  // 2. Termination Req (hard)
  const terms = collectTerminations();
  const termResistors = terms.map(t => t.ohms);
  const terminatedCount = terms.length;
  const eqRaw = parallelResistance(termResistors);
  const eqResistance = eqRaw === Infinity ? Infinity : Math.round(eqRaw);
  diagnostics.eqResistance = eqResistance;

  let resistanceStatus = 'pass';
  if (hard.terminationCount) {
    if (terminatedCount === 0) {
      pushHard(`[${packLabel}] No termination resistors. Add 120 Ω at the two electrical ends of each bus.`);
      resistanceStatus = 'fail';
    } else if (terminatedCount === 1) {
      pushHard(`[${packLabel}] Only one terminator (${termResistors[0]} Ω). Need exactly two 120 Ω (ideal Req ≈ 60 Ω) per bus.`);
      resistanceStatus = 'fail';
    } else if (terminatedCount > 2 && buses.length === 1) {
      pushHard(`[${packLabel}] Over-terminated (${terminatedCount} resistors, Req ≈ ${eqResistance} Ω). Classic single bus expects two terminators.`);
      resistanceStatus = 'fail';
    } else if (terminatedCount === 2 && (eqResistance < 50 || eqResistance > 65)) {
      pushWarn(`[${packLabel}] Equivalent resistance ${eqResistance} Ω is outside the typical 50–65 Ω band.`);
      resistanceStatus = 'warn';
    } else if (buses.length > 1) {
      // Multi-bus: expect ~2 terminators per bus
      const perBus = {};
      terms.forEach(t => {
        const st = stations.find(s => s.id === t.stationId);
        const bid = (st && st.busId) || 'bus-1';
        perBus[bid] = (perBus[bid] || 0) + 1;
      });
      Object.keys(perBus).forEach(bid => {
        if (perBus[bid] !== 2) {
          pushHard(`[${packLabel}] Bus "${(buses.find(b => b.id === bid) || {}).name || bid}" has ${perBus[bid]} terminator(s); expect 2.`);
          resistanceStatus = 'fail';
        }
      });
      buses.forEach(b => {
        if (!perBus[b.id]) {
          pushHard(`[${packLabel}] Bus "${b.name}" has no terminators.`);
          resistanceStatus = 'fail';
        }
      });
    }
  }

  // 3. Placement at electrical ends / leaves (hard)
  let placementStatus = 'pass';
  if (hard.terminationPlacement) {
    buses.forEach(bus => {
      const leaves = leafIds(bus.id);
      const busStations = stationsOnBus(bus.id);
      if (!busStations.length) return;
      const leafSet = new Set(leaves);
      const termLeaves = busStations.filter(s => stationIsTerminated(s) && leafSet.has(s.id));
      const termAny = busStations.filter(s => stationIsTerminated(s));
      const nTerm = termAny.length;
      // Count device+station terms only on this bus
      let busTermCount = 0;
      busStations.forEach(s => {
        if ((s.termination || 0) > 0) busTermCount++;
        (s.devices || []).forEach(d => { if ((d.termination || 0) > 0) busTermCount++; });
      });

      if (busTermCount === 2) {
        const bothOnLeaves = termAny.every(s => leafSet.has(s.id));
        if (!bothOnLeaves || termLeaves.length < 2) {
          pushHard(`[${packLabel}] Terminators on "${bus.name}" must sit at electrical ends (leaf junctions of the trunk tree).`);
          placementStatus = 'fail';
          termAny.forEach(s => {
            if (!leafSet.has(s.id)) diagnostics.stationStatuses[s.id] = 'fail';
          });
        }
      } else if (busTermCount !== 2) {
        placementStatus = 'fail';
      }
    });
  }

  // 4. Individual stubs (hard) + cumulative (guideline)
  const maxIndividualStub = maxStubLimitMeters();
  const maxCumulativeStub = maxCumStubLimitMeters();
  let anyStubTooLong = false;
  let totalStubLength = 0;

  stations.forEach(station => {
    (station.devices || []).forEach(device => {
      totalStubLength += device.stubLength || 0;
      if (hard.individualStub && device.stubLength > maxIndividualStub) {
        pushHard(`[${packLabel}] Device "${device.name}" stub (${device.stubLength.toFixed(2)} m) exceeds max ${maxIndividualStub} m.`);
        diagnostics.deviceStatuses[device.id] = 'fail';
        diagnostics.stationStatuses[station.id] = 'fail';
        anyStubTooLong = true;
      } else if (device.stubLength > maxIndividualStub * 0.7) {
        pushWarn(`[${packLabel}] Device "${device.name}" stub (${device.stubLength.toFixed(2)} m) nearing limit ${maxIndividualStub} m.`);
        if (diagnostics.deviceStatuses[device.id] !== 'fail') diagnostics.deviceStatuses[device.id] = 'warn';
      }
    });
  });

  let cumulativeStubStatus = 'pass';
  if (guides.cumulativeStub) {
    if (totalStubLength > maxCumulativeStub) {
      pushGuide(`[${packLabel}] Cumulative stub length ${totalStubLength.toFixed(2)} m exceeds design guideline ${maxCumulativeStub} m.`);
      cumulativeStubStatus = 'guideline';
    } else if (totalStubLength > maxCumulativeStub * 0.8) {
      pushGuide(`[${packLabel}] Cumulative stubs ${totalStubLength.toFixed(2)} m nearing guideline ${maxCumulativeStub} m.`);
      cumulativeStubStatus = 'guideline';
    }
  }

  // 5. Star / multi-drop junctions — design guidelines (device drops + trunk branches)
  let starTopologyDetected = false;
  let criticalStarTopology = false;
  const starWarnAt = pack.starWarnAt != null ? pack.starWarnAt : 2;
  const starFailAt = pack.starFailAt != null ? pack.starFailAt : 3;

  if (guides.starTopology) {
    stations.forEach(station => {
      const devCount = (station.devices || []).length;
      const branchCount = childStations(station.id).length;
      // Trunk degree ≈ children + (parent ? 1 : 0)
      const trunkDegree = branchCount + (station.parentId ? 1 : 0);
      const multiDrop = devCount >= starWarnAt || trunkDegree >= 3;

      if (devCount >= starWarnAt || trunkDegree >= 3) {
        starTopologyDetected = true;
        if (diagnostics.stationStatuses[station.id] === 'pass') {
          diagnostics.stationStatuses[station.id] = 'warn';
        }
      }
      if (devCount >= starFailAt || trunkDegree >= 4) {
        criticalStarTopology = true;
        pushGuide(`[${packLabel}] Dense junction at "${station.name}" (${devCount} device drop(s), ${trunkDegree} trunk leg(s)). Prefer short drops or active hubs — design guideline.`);
        if (diagnostics.stationStatuses[station.id] !== 'fail') {
          diagnostics.stationStatuses[station.id] = 'warn';
        }
      } else if (devCount >= starWarnAt) {
        pushGuide(`[${packLabel}] Multi-drop at "${station.name}" (${devCount} devices). Keep stubs short — design guideline.`);
      } else if (trunkDegree >= 3) {
        pushGuide(`[${packLabel}] Trunk branch (Y-split) at "${station.name}" (${trunkDegree} trunk legs). Valid topology; keep branch stubs short — design guideline.`);
      }
    });
  }

  // 6. Node spacing along trunk edges — guideline
  let spacingStatus = 'pass';
  const minSpace = pack.minNodeSpacingM != null ? pack.minNodeSpacingM : 0.1;
  if (guides.nodeSpacing) {
    const edges = [];
    buses.forEach(b => edges.push(...trunkEdges(b.id)));
    const close = edges.filter(e => e.length > 0 && e.length < minSpace);
    if (close.length) {
      pushGuide(`[${packLabel}] ${close.length} trunk segment(s) shorter than ${minSpace} m — local capacitive clustering risk (design guideline).`);
      spacingStatus = 'guideline';
    }
  }

  // 7. Arbitration timing (hard) using electrical diameter
  let timingStatus = 'pass';
  if (hard.arbitrationTiming) {
    const timing = computeArbitrationTiming({
      baudKbps: networkConfig.baudRate,
      samplePointPct: networkConfig.samplePoint,
      trunkLengthM: worstElectricalLen,
      propDelayNsPerM: networkConfig.propDelay,
      loopDelayNs: networkConfig.loopDelay,
      marginNs: networkConfig.controllerMargin != null ? networkConfig.controllerMargin : 50
    });
    diagnostics.roundTripPropTime = Math.round(timing.propNs);
    diagnostics.timeBudget = Math.round(timing.budgetNs);
    if (!timing.ok) {
      pushHard(`[${packLabel}] Arbitration timing: round-trip ${Math.round(timing.propNs)} ns exceeds sample budget ${Math.round(timing.budgetNs)} ns.`);
      timingStatus = 'fail';
    } else if (timing.tight) {
      pushWarn(`[${packLabel}] Tight timing margin (${Math.round(timing.propNs)} / ${Math.round(timing.budgetNs)} ns).`);
      timingStatus = 'warn';
    }
  } else {
    const timing = computeArbitrationTiming({
      baudKbps: networkConfig.baudRate,
      samplePointPct: networkConfig.samplePoint,
      trunkLengthM: worstElectricalLen,
      propDelayNsPerM: networkConfig.propDelay,
      loopDelayNs: networkConfig.loopDelay,
      marginNs: networkConfig.controllerMargin != null ? networkConfig.controllerMargin : 50
    });
    diagnostics.roundTripPropTime = Math.round(timing.propNs);
    diagnostics.timeBudget = Math.round(timing.budgetNs);
  }

  if (terminatedCount > 2 && buses.length === 1) {
    terms.forEach(t => {
      diagnostics.stationStatuses[t.stationId] = 'fail';
      if (t.deviceId) diagnostics.deviceStatuses[t.deviceId] = 'fail';
    });
  }

  // Risk score: hard fails weigh more than guidelines
  let risk = 0;
  if (eqResistance === Infinity) risk += 40;
  else if (eqResistance < 45) risk += 30;
  else if (eqResistance > 80) risk += 25;
  else if (eqResistance < 55 || eqResistance > 70) risk += 10;
  if (placementStatus === 'fail') risk += 15;
  if (anyStubTooLong) risk += 15;
  if (cumulativeStubStatus === 'guideline') risk += 5;
  if (criticalStarTopology) risk += 6;
  else if (starTopologyDetected) risk += 3;
  if (spacingStatus === 'guideline') risk += 3;
  if (timingStatus === 'fail') risk += 10;
  else if (timingStatus === 'warn') risk += 5;
  diagnostics.riskPercentage = Math.min(risk, 100);

  const sev = (hardKey, status) => {
    // Map checklist severity: hard checks use fail/warn/pass; guidelines use guideline/pass
    if (hard[hardKey]) return status;
    return status === 'fail' ? 'guideline' : status;
  };

  diagnostics.checklists = [
    {
      id: 'res',
      category: 'hard',
      title: 'Bus equivalent impedance',
      desc: `Req: ${eqResistance === Infinity ? '∞' : eqResistance + ' Ω'} (ideal 60 Ω). Pack: ${packLabel}.`,
      status: resistanceStatus
    },
    {
      id: 'term_placement',
      category: 'hard',
      title: 'Termination at electrical ends',
      desc: terminatedCount === 2 && placementStatus === 'pass'
        ? `Terminators on trunk leaves (${packLabel}).`
        : `${terminatedCount} terminator(s). Leaves terminated per bus — see messages.`,
      status: placementStatus
    },
    {
      id: 'trunk_len',
      category: 'hard',
      title: 'Trunk electrical span',
      desc: `Longest path: ${formatLength(worstElectricalLen)} · Cable total: ${formatLength(totalCable)} · Max (${packLabel}): ${formatLength(maxAllowedTrunk)}.`,
      status: trunkStatus
    },
    {
      id: 'stubs',
      category: 'hard',
      title: 'Individual stub lengths',
      desc: anyStubTooLong
        ? `One or more stubs exceed ${formatLength(maxIndividualStub)} (${packLabel}).`
        : `All stubs ≤ ${formatLength(maxIndividualStub)} (${packLabel}${networkConfig.enableCanFD ? ', FD data' : ''}).`,
      status: anyStubTooLong ? 'fail' : 'pass'
    },
    {
      id: 'timing',
      category: 'hard',
      title: 'Arbitration propagation margin',
      desc: `Round trip: ${diagnostics.roundTripPropTime} ns · Budget: ${diagnostics.timeBudget} ns (${packLabel}).`,
      status: timingStatus
    },
    {
      id: 'cum_stubs',
      category: 'guideline',
      title: 'Cumulative stub length',
      desc: `Sum: ${formatLength(totalStubLength)} · Guideline max: ${formatLength(maxCumulativeStub)} (${packLabel}).`,
      status: cumulativeStubStatus === 'pass' ? 'pass' : 'guideline'
    },
    {
      id: 'star_splice',
      category: 'guideline',
      title: 'Branches & multi-drop junctions',
      desc: criticalStarTopology
        ? 'Dense junctions present (design guideline).'
        : starTopologyDetected
          ? 'Y-splits or multi-drops present — keep drops short (guideline).'
          : 'Simple trunk topology.',
      status: criticalStarTopology || starTopologyDetected ? 'guideline' : 'pass'
    },
    {
      id: 'spacing',
      category: 'guideline',
      title: 'Minimum trunk segment length',
      desc: spacingStatus === 'guideline'
        ? `Some segments < ${minSpace} m (clustering guideline).`
        : `Trunk segments ≥ ${minSpace} m (${packLabel} guideline).`,
      status: spacingStatus === 'pass' ? 'pass' : 'guideline'
    }
  ];

  return diagnostics;
}

// Render values on screen
function updateStats(diagnostics) {
  valResistance.textContent = diagnostics.eqResistance === Infinity ? '∞ Ω' : `${diagnostics.eqResistance} Ω`;
  valTrunkLen.textContent = formatLength(diagnostics.totalBusLength);
  valPropTime.textContent = `${diagnostics.roundTripPropTime} ns`;
  valTimeBudget.textContent = `${diagnostics.timeBudget} ns`;

  // Colors based on impedance
  if (diagnostics.eqResistance === Infinity || diagnostics.eqResistance < 45 || diagnostics.eqResistance > 85) {
    valResistance.style.color = 'var(--error)';
  } else if (diagnostics.eqResistance < 55 || diagnostics.eqResistance > 68) {
    valResistance.style.color = 'var(--warning)';
  } else {
    valResistance.style.color = 'var(--success)';
  }

  // Timing check colors
  if (diagnostics.roundTripPropTime >= diagnostics.timeBudget) {
    valPropTime.style.color = 'var(--error)';
  } else if (diagnostics.roundTripPropTime >= diagnostics.timeBudget * 0.8) {
    valPropTime.style.color = 'var(--warning)';
  } else {
    valPropTime.style.color = 'var(--success)';
  }

  // Update signal integrity gauge
  const risk = diagnostics.riskPercentage;
  riskGaugeFill.style.width = `${risk}%`;
  
  if (risk < 25) {
    riskBadge.textContent = 'LOW';
    riskBadge.className = 'risk-level-badge risk-low';
    riskGaugeFill.style.backgroundColor = 'var(--success)';
  } else if (risk < 65) {
    riskBadge.textContent = 'MODERATE';
    riskBadge.className = 'risk-level-badge risk-medium';
    riskGaugeFill.style.backgroundColor = 'var(--warning)';
  } else {
    riskBadge.textContent = 'CRITICAL';
    riskBadge.className = 'risk-level-badge risk-high';
    riskGaugeFill.style.backgroundColor = 'var(--error)';
  }
}

function updateChecklist(diagnostics) {
  checklistBody.innerHTML = '';
  if (!diagnostics.checklists || !diagnostics.checklists.length) return;

  const hard = diagnostics.checklists.filter(c => c.category !== 'guideline');
  const guide = diagnostics.checklists.filter(c => c.category === 'guideline');

  const renderGroup = (title, items, groupClass) => {
    if (!items.length) return;
    const hdr = document.createElement('div');
    hdr.className = 'checklist-group-label ' + groupClass;
    hdr.textContent = title;
    checklistBody.appendChild(hdr);
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'checklist-item checklist-' + (item.category || 'hard');

      let iconClass = 'pass';
      let iconName = 'check-circle-2';
      if (item.status === 'warn') {
        iconClass = 'warn';
        iconName = 'alert-circle';
      } else if (item.status === 'fail') {
        iconClass = 'fail';
        iconName = 'x-circle';
      } else if (item.status === 'guideline') {
        iconClass = 'guideline';
        iconName = 'info';
      }

      el.innerHTML = `
        <div class="checklist-icon ${iconClass}">
          <i data-lucide="${iconName}" style="width: 16px; height: 16px;"></i>
        </div>
        <div class="checklist-content">
          <div class="checklist-title">${item.title}
            <span class="checklist-cat-tag">${item.category === 'guideline' ? 'Guideline' : 'Must-have'}</span>
          </div>
          <div class="checklist-desc" title="${String(item.desc || '').replace(/"/g, '&quot;')}">${item.desc}</div>
        </div>
      `;
      checklistBody.appendChild(el);
    });
  };

  renderGroup('Must-have (compliance)', hard, 'hard');
  renderGroup('Design guidelines', guide, 'guideline');
}

function updateBanner(diagnostics) {
  if (diagnostics.errors.length > 0) {
    complianceBanner.className = 'banner banner-error';
    bannerIcon.setAttribute('data-lucide', 'x-circle');
    bannerText.textContent = `${diagnostics.errors.length} Critical Compliance Violation(s) detected. Check network layout.`;
  } else if (diagnostics.warnings.length > 0) {
    complianceBanner.className = 'banner banner-warning';
    bannerIcon.setAttribute('data-lucide', 'alert-triangle');
    bannerText.textContent = `Harness compliant but contains ${diagnostics.warnings.length} warning(s). Reflections possible.`;
  } else {
    complianceBanner.className = 'banner banner-success';
    bannerIcon.setAttribute('data-lucide', 'check-circle');
    bannerText.textContent = 'Harness configuration meets all ISO 11898 standard constraints.';
  }
}

// Interactive SVG topology rendering
function drawTopologySVG(diagnostics) {
  // Clear dynamic elements inside zoom container
  zoomContainer.innerHTML = '';

  const busStations = stationsOnBus(activeBusId);
  if (busStations.length === 0) return;

  const width = canvasContainer.clientWidth || 800;
  const height = canvasContainer.clientHeight || 280;

  // Reapply view zoom transform
  applyViewTransform();

  const paddingLeft = 70;
  const paddingTop = 50;
  const layout = computeBranchLayout(activeBusId);
  let maxLayoutX = 0;
  let minLayoutY = 0;
  let maxLayoutY = 0;
  layout.forEach(p => {
    maxLayoutX = Math.max(maxLayoutX, p.x);
    minLayoutY = Math.min(minLayoutY, p.y);
    maxLayoutY = Math.max(maxLayoutY, p.y);
  });
  // Reserve vertical space under the lowest lane for multi-row device fans
  let maxDevices = 1;
  busStations.forEach(s => { maxDevices = Math.max(maxDevices, (s.devices || []).length); });
  const deviceRows = Math.max(1, Math.ceil(maxDevices / 5));
  const deviceFanH = 48 + deviceRows * 62;
  const contentW = maxLayoutX + paddingLeft + 160;
  const contentH = (maxLayoutY - minLayoutY) + paddingTop + 90 + deviceFanH + 40;
  // Expand viewBox so dense graphs aren't clipped (user can pan/zoom)
  const vbW = Math.max(width, contentW);
  const vbH = Math.max(height, contentH);
  harnessSvg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  dragInfo.scale = 1;
  dragInfo.trunkLen = electricalLengthM(activeBusId);
  dragInfo.paddingLeft = paddingLeft;
  dragInfo.screenX = [paddingLeft, paddingLeft + maxLayoutX];

  function getStationXY(st) {
    const p = layout.get(st.id) || { x: 0, y: 0 };
    const off = (st && st.layoutOffset) || { dx: 0, dy: 0 };
    return {
      x: paddingLeft + (Number(p.x) || 0) + (Number(off.dx) || 0),
      y: (Number(p.y) || 0) - minLayoutY + (Number(off.dy) || 0)
    };
  }

  const canH_Y = paddingTop;
  const canL_Y = paddingTop + 25;
  const laneBase = (canH_Y + canL_Y) / 2;

  // Draw trunk edges as dual bus lines (supports Y-splits)
  const edges = trunkEdges(activeBusId);
  edges.forEach(e => {
    const a = busStations.find(s => s.id === e.from);
    const b = busStations.find(s => s.id === e.to);
    if (!a || !b) return;
    const pa = getStationXY(a);
    const pb = getStationXY(b);
    const yOff = (pa.y + pb.y) / 2;
    [['#10b981', -6], ['#3b82f6', 6]].forEach(([color, dy]) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pa.x);
      line.setAttribute('y1', laneBase + yOff + dy);
      line.setAttribute('x2', pb.x);
      line.setAttribute('y2', laneBase + yOff + dy);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '3.5');
      line.setAttribute('stroke-linecap', 'round');
      zoomContainer.appendChild(line);
    });
    // Length label
    const midX = (pa.x + pb.x) / 2;
    const midY = laneBase + yOff - 14;
    const distText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    distText.setAttribute('x', midX);
    distText.setAttribute('y', midY);
    distText.setAttribute('text-anchor', 'middle');
    distText.setAttribute('class', 'svg-dimension-text');
    distText.textContent = formatLength(e.length);
    zoomContainer.appendChild(distText);
  });

  const startX = paddingLeft;
  // Bus labels
  drawLabelSVG('CAN H', startX - 50, canH_Y + 4, '#10b981', 'right', '10px');
  drawLabelSVG('CAN L', startX - 50, canL_Y + 4, '#3b82f6', 'right', '10px');
  const busMeta = buses.find(b => b.id === activeBusId);
  drawLabelSVG(busMeta ? busMeta.name : 'Bus', startX - 50, canH_Y - 14, 'var(--text-muted)', 'right', '9px');

  // 3. Draw Stations and Star junctions (active bus tree layout)
  busStations.forEach((station) => {
    const xy = getStationXY(station);
    const x = xy.x;
    const yLane = xy.y;
    const canH_Y_local = canH_Y + yLane;
    const canL_Y_local = canL_Y + yLane;
    const stationStatus = diagnostics.stationStatuses[station.id] || 'pass';

    // Splice dot color
    const dotColor = station.devices.length >= 3 
      ? 'var(--error)' 
      : station.devices.length >= 2 
        ? 'var(--warning)' 
        : 'var(--text-muted)';

    // Splice point visual at main bus
    const tapH = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tapH.setAttribute('cx', x);
    tapH.setAttribute('cy', canH_Y_local);
    tapH.setAttribute('r', '4');
    tapH.setAttribute('fill', '#10b981');
    zoomContainer.appendChild(tapH);

    const tapL = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tapL.setAttribute('cx', x);
    tapL.setAttribute('cy', canL_Y_local);
    tapL.setAttribute('r', '4');
    tapL.setAttribute('fill', '#3b82f6');
    zoomContainer.appendChild(tapL);

    // Station handle — drag to reposition (trunk lines stay connected)
    const dragHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dragHandle.setAttribute('cx', x);
    dragHandle.setAttribute('cy', (canH_Y_local + canL_Y_local)/2);
    dragHandle.setAttribute('r', '8');
    dragHandle.setAttribute('fill', !station.parentId ? 'var(--text-muted)' : 'var(--accent)');
    dragHandle.setAttribute('stroke', 'var(--bg-secondary)');
    dragHandle.setAttribute('stroke-width', '1.5');
    dragHandle.setAttribute('class', 'draggable-box');
    dragHandle.setAttribute('title', 'Drag to move station · click to show in list');
    dragHandle.style.cursor = 'grab';
    dragHandle.addEventListener('mousedown', (e) => startBoxDrag('station', station.id, null, e));
    zoomContainer.appendChild(dragHandle);

    // Draw Splice point (Junction box / drop connection)
    const spliceY = canL_Y_local + 25;
    const trunkToSplice = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    trunkToSplice.setAttribute('x1', x);
    trunkToSplice.setAttribute('y1', canL_Y_local);
    trunkToSplice.setAttribute('x2', x);
    trunkToSplice.setAttribute('y2', spliceY);
    trunkToSplice.setAttribute('stroke', 'var(--text-muted)');
    trunkToSplice.setAttribute('stroke-width', '2');
    zoomContainer.appendChild(trunkToSplice);

    const spliceDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    spliceDot.setAttribute('cx', x);
    spliceDot.setAttribute('cy', spliceY);
    spliceDot.setAttribute('r', station.devices.length >= 2 ? '6' : '3');
    spliceDot.setAttribute('fill', dotColor);
    zoomContainer.appendChild(spliceDot);

    // "+" on canvas → choose Device / Trunk station / Branch
    const addX = x + 15;
    const addY = spliceY;
    const addGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    addGroup.setAttribute('class', 'svg-interactive-btn');
    addGroup.setAttribute('style', 'cursor: pointer;');
    addGroup.setAttribute('title', 'Add device, trunk station, or branch');

    const plusCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    plusCircle.setAttribute('cx', addX);
    plusCircle.setAttribute('cy', addY);
    plusCircle.setAttribute('r', '8');
    plusCircle.setAttribute('fill', 'var(--accent)');
    plusCircle.setAttribute('stroke', 'var(--bg-secondary)');
    plusCircle.setAttribute('stroke-width', '1.5');
    addGroup.appendChild(plusCircle);

    const plusL1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    plusL1.setAttribute('x1', addX - 4);
    plusL1.setAttribute('y1', addY);
    plusL1.setAttribute('x2', addX + 4);
    plusL1.setAttribute('y2', addY);
    plusL1.setAttribute('stroke', '#ffffff');
    plusL1.setAttribute('stroke-width', '1.5');
    addGroup.appendChild(plusL1);

    const plusL2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    plusL2.setAttribute('x1', addX);
    plusL2.setAttribute('y1', addY - 4);
    plusL2.setAttribute('x2', addX);
    plusL2.setAttribute('y2', addY + 4);
    plusL2.setAttribute('stroke', '#ffffff');
    plusL2.setAttribute('stroke-width', '1.5');
    addGroup.appendChild(plusL2);

    addGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      showCanvasAddMenu(station, e.clientX, e.clientY);
    });
    zoomContainer.appendChild(addGroup);

    // Click station geometry → center in list (handle uses drag; click-without-move focuses)
    const focusStation = (e) => {
      e.stopPropagation();
      if (boxDrag.active || boxDrag.moved) return;
      focusListItem({ stationId: station.id });
    };
    spliceDot.style.cursor = 'pointer';
    spliceDot.addEventListener('click', focusStation);
    tapH.style.cursor = 'pointer';
    tapL.style.cursor = 'pointer';
    tapH.addEventListener('click', focusStation);
    tapL.addEventListener('click', focusStation);
    // Allow dragging from splice area too
    spliceDot.addEventListener('mousedown', (e) => startBoxDrag('station', station.id, null, e));

    // Termination badge on diagram (if station has bus terminator)
    ensureStationDefaults(station);
    if ((station.termination || 0) > 0) {
      const termLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      termLabel.setAttribute('x', x);
      termLabel.setAttribute('y', canH_Y_local - 26);
      termLabel.setAttribute('text-anchor', 'middle');
      termLabel.setAttribute('fill', '#fb923c'); // match device-node termination mark
      termLabel.setAttribute('font-size', '9px');
      termLabel.setAttribute('font-weight', '800');
      termLabel.textContent = `${station.termination}Ω`;
      termLabel.setAttribute('title', 'Bus terminator at this station');
      zoomContainer.appendChild(termLabel);
    }

    // Label station above the trunk line (Double-click to rename)
    const labelStationName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelStationName.setAttribute('x', x);
    labelStationName.setAttribute('y', canH_Y_local - 14);
    labelStationName.setAttribute('text-anchor', 'middle');
    labelStationName.setAttribute('fill', 'var(--text-primary)');
    labelStationName.setAttribute('font-size', '9px');
    labelStationName.setAttribute('font-weight', '700');
    labelStationName.textContent = truncateText(station.name, 12);
    labelStationName.setAttribute('style', 'cursor: pointer;');
    labelStationName.setAttribute('title', 'Click to show in list · double-click to rename');
    labelStationName.addEventListener('click', (e) => {
      e.stopPropagation();
      focusListItem({ stationId: station.id });
    });
    labelStationName.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      showInlineEditor(e.target, station.name, (newName) => {
        station.name = newName;
        render();
      }, false);
    });
    zoomContainer.appendChild(labelStationName);

    // 4. Draw Device Boxes (Star branches)
    const devCount = station.devices.length;
    const maxIndividualStub = maxStubLimitMeters();
    const deviceLayouts = layoutDevicesUnderStation(devCount, x, spliceY);

    station.devices.forEach((device, devIndex) => {
      const deviceStatus = diagnostics.deviceStatuses[device.id] || 'pass';
      let themeColor = 'var(--success)';
      if (deviceStatus === 'warn') themeColor = 'var(--warning)';
      else if (deviceStatus === 'fail') themeColor = 'var(--error)';

      const slot = deviceLayouts[devIndex] || { x, y: spliceY + 48, boxW: 80, boxH: 44 };
      const dOff = (device.layoutOffset) || { dx: 0, dy: 0 };
      const targetX = slot.x + (Number(dOff.dx) || 0);
      const targetY = slot.y + (Number(dOff.dy) || 0);
      const boxW = slot.boxW || 80;
      const boxH = slot.boxH || 44;

      // Draw drop branch lines from splice dot to device box
      const deviceBranchLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      deviceBranchLine.setAttribute('x1', x);
      deviceBranchLine.setAttribute('y1', spliceY);
      deviceBranchLine.setAttribute('x2', targetX);
      deviceBranchLine.setAttribute('y2', targetY);
      deviceBranchLine.setAttribute('stroke', 'var(--text-muted)');
      deviceBranchLine.setAttribute('stroke-width', '1.5');
      zoomContainer.appendChild(deviceBranchLine);

      const boxX = targetX - boxW / 2;
      const boxY = targetY;

      // Draw device rect
      const nodeBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      nodeBox.setAttribute('x', boxX);
      nodeBox.setAttribute('y', boxY);
      nodeBox.setAttribute('width', boxW);
      nodeBox.setAttribute('height', boxH);
      nodeBox.setAttribute('rx', '8');
      nodeBox.setAttribute('fill', 'var(--bg-secondary)');
      nodeBox.setAttribute('stroke', themeColor);
      nodeBox.setAttribute('stroke-width', '2');
      nodeBox.setAttribute('style', 'cursor: grab; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05));');
      nodeBox.setAttribute('class', 'draggable-box');
      nodeBox.setAttribute('title', 'Drag to move · click to show in list');
      
      // Click device → center in list; drag to reposition (stub line stays attached)
      const focusDevice = (e) => {
        e.stopPropagation();
        if (boxDrag.active || boxDrag.moved) return;
        focusListItem({ stationId: station.id, deviceId: device.id });
      };
      nodeBox.addEventListener('click', focusDevice);
      nodeBox.addEventListener('mousedown', (e) => startBoxDrag('device', station.id, device.id, e));
      zoomContainer.appendChild(nodeBox);

      // Terminations inside device boxes
      if (device.termination > 0) {
        const termText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        termText.setAttribute('x', boxX + boxW - 5);
        termText.setAttribute('y', boxY + 11);
        termText.setAttribute('fill', '#fb923c');
        termText.setAttribute('font-size', '8px');
        termText.setAttribute('font-weight', '700');
        termText.setAttribute('text-anchor', 'end');
        termText.textContent = `${device.termination}Ω`;
        zoomContainer.appendChild(termText);
      }

      // Device Name (Double-click to rename)
      const labelDevName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelDevName.setAttribute('x', targetX);
      labelDevName.setAttribute('y', boxY + 18);
      labelDevName.setAttribute('text-anchor', 'middle');
      labelDevName.setAttribute('fill', 'var(--text-primary)');
      labelDevName.setAttribute('font-size', '9px');
      labelDevName.setAttribute('font-weight', '700');
      labelDevName.textContent = truncateText(device.name, 12);
      labelDevName.setAttribute('style', 'cursor: pointer;');
      labelDevName.setAttribute('title', 'Click to show in list · double-click to rename');
      labelDevName.addEventListener('click', focusDevice);
      labelDevName.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showInlineEditor(e.target, device.name, (newName) => {
          device.name = newName;
          render();
        }, false);
      });
      zoomContainer.appendChild(labelDevName);

      // Device Stub Length (Double-click to edit)
      const labelDevStub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelDevStub.setAttribute('x', targetX);
      labelDevStub.setAttribute('y', boxY + 32);
      labelDevStub.setAttribute('text-anchor', 'middle');
      labelDevStub.setAttribute('fill', device.stubLength > maxIndividualStub ? 'var(--error)' : 'var(--text-muted)');
      labelDevStub.setAttribute('font-size', '8.5px');
      labelDevStub.setAttribute('font-weight', device.stubLength > maxIndividualStub ? '700' : '500');
      labelDevStub.textContent = `Stub: ${formatLength(device.stubLength)}`;
      labelDevStub.setAttribute('style', 'cursor: pointer;');
      labelDevStub.setAttribute('title', 'Click to show in list · double-click to edit stub length');
      labelDevStub.addEventListener('click', focusDevice);
      labelDevStub.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showInlineEditor(e.target, device.stubLength, (newVal) => {
          device.stubLength = toMeters(Math.max(0, newVal));
          render();
        });
      });

      zoomContainer.appendChild(labelDevStub);
    });
  });
}

function drawLabelSVG(text, x, y, color, anchor, size) {
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', x);
  txt.setAttribute('y', y);
  txt.setAttribute('fill', color);
  txt.setAttribute('font-size', size || '9px');
  txt.setAttribute('font-weight', '700');
  txt.setAttribute('text-anchor', anchor === 'right' ? 'end' : anchor === 'center' ? 'middle' : 'start');
  txt.textContent = text;
  zoomContainer.appendChild(txt);
}

function truncateText(str, n) {
  return (str.length > n) ? str.substr(0, n - 1) + '...' : str;
}

// Inline input editor overlays on SVG elements
function showInlineEditor(svgTextElement, currentVal, onSave, isNumeric = false) {
  const rect = svgTextElement.getBoundingClientRect();
  const containerRect = canvasContainer.getBoundingClientRect();

  inlineEditor.style.left = `${rect.left - containerRect.left + (rect.width - 110)/2}px`;
  inlineEditor.style.top = `${rect.top - containerRect.top - 2}px`;
  inlineEditor.style.display = 'block';

  if (isNumeric) {
    const valInUnit = fromMeters(currentVal);
    inlineEditor.value = valInUnit.toFixed(currentUnit === 'm' ? 2 : currentUnit === 'mm' ? 0 : 1);
  } else {
    inlineEditor.value = currentVal;
  }
  
  inlineEditor.focus();
  inlineEditor.select();

  function handleSave() {
    const val = inlineEditor.value.trim();
    if (val !== '') {
      if (isNumeric) {
        const newVal = parseFloat(val);
        if (!isNaN(newVal)) onSave(newVal);
      } else {
        onSave(val);
      }
    }
    closeEditor();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      closeEditor();
    }
  }

  function closeEditor() {
    inlineEditor.style.display = 'none';
    inlineEditor.removeEventListener('keydown', handleKeyDown);
    inlineEditor.removeEventListener('blur', handleSave);
  }

  inlineEditor.addEventListener('keydown', handleKeyDown);
  setTimeout(() => {
    inlineEditor.addEventListener('blur', handleSave);
  }, 100);
}

// ── SVG Interactive Drag & Drop Handler ──
function handleSvgMouseDown(e) {
  const handle = e.target.closest('.draggable-station');
  if (!handle) return;

  const stationId = handle.dataset.stationId;
  const stationIndex = stations.findIndex(s => s.id === stationId);
  if (stationIndex <= 0) return; 

  const cumPositions = getCumulativePositions();
  
  dragInfo.active = true;
  dragInfo.stationId = stationId;
  dragInfo.initialMouseX = e.clientX;
  dragInfo.initialCumPos = cumPositions[stationIndex];
  
  const prevCum = cumPositions[stationIndex - 1];
  const nextCum = stationIndex < stations.length - 1 ? cumPositions[stationIndex + 1] : Infinity;
  
  dragInfo.minCumPos = prevCum + 0.001; 
  dragInfo.maxCumPos = nextCum - 0.001; 
}

function handleSvgMouseMove(e) {
  if (!dragInfo.active) return;

  const mouseDeltaX = e.clientX - dragInfo.initialMouseX;
  
  // Divide deltaX by zoom scale so movement maps 1:1 visually when zoomed in/out
  const physicalDelta = mouseDeltaX / (viewState.zoom * dragInfo.scale);
  
  let newCumPos = dragInfo.initialCumPos + physicalDelta;
  newCumPos = Math.max(dragInfo.minCumPos, Math.min(dragInfo.maxCumPos, newCumPos));

  const stationIndex = stations.findIndex(s => s.id === dragInfo.stationId);
  const targetStation = stations[stationIndex];
  
  const cumPositions = getCumulativePositions();
  const prevCum = cumPositions[stationIndex - 1];

  targetStation.distanceFromPrev = Math.max(0.001, parseFloat((newCumPos - prevCum).toFixed(3)));

  if (stationIndex < stations.length - 1) {
    const nextStation = stations[stationIndex + 1];
    const originalNextCum = cumPositions[stationIndex + 1];
    nextStation.distanceFromPrev = Math.max(0.001, parseFloat((originalNextCum - newCumPos).toFixed(3)));
  }

  render();
}

function handleSvgMouseUp() {
  if (dragInfo.active) {
    dragInfo.active = false;
    dragInfo.stationId = null;
    render(); 
  }
}

// Add station at click coordinate
function addStationAtPosition(cumPos) {
  const cumPositions = getCumulativePositions();
  let insertIndex = stations.length;
  
  for (let i = 0; i < cumPositions.length; i++) {
    if (cumPos < cumPositions[i]) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === 0) {
    if (stations.length > 0) {
      const origFirst = stations[0];
      const newStation = {
        id: 's_' + Date.now().toString(),
        name: `Station ${stations.length + 1}`,
        distanceFromPrev: 0.0,
        devices: [
          { id: 'd_' + Date.now().toString(), name: 'Node 1', stubLength: 0.1, termination: 0 }
        ]
      };
      origFirst.distanceFromPrev = Math.max(0.001, cumPos);
      stations.unshift(newStation);
    }
  } else if (insertIndex === stations.length) {
    const lastCum = cumPositions[cumPositions.length - 1] || 0;
    const newStation = {
      id: 's_' + Date.now().toString(),
      name: `Station ${stations.length + 1}`,
      distanceFromPrev: Math.max(0.001, cumPos - lastCum),
      devices: [
        { id: 'd_' + Date.now().toString(), name: 'Node 1', stubLength: 0.1, termination: 0 }
      ]
    };
    stations.push(newStation);
  } else {
    const prevCum = cumPositions[insertIndex - 1];
    const currCum = cumPositions[insertIndex];
    
    const newStation = {
      id: 's_' + Date.now().toString(),
      name: `Station ${stations.length + 1}`,
      distanceFromPrev: Math.max(0.001, cumPos - prevCum),
      devices: [
        { id: 'd_' + Date.now().toString(), name: 'Node 1', stubLength: 0.1, termination: 0 }
      ]
    };
    
    stations[insertIndex].distanceFromPrev = Math.max(0.001, currCum - cumPos);
    stations.splice(insertIndex, 0, newStation);
  }

  render();
}

// Toggle Scope / Eye Diagram View Mode
function setScopeMode(mode) {
  scopeMode = mode;
  document.getElementById('scope-btn-scope').classList.toggle('active', mode === 'scope');
  document.getElementById('scope-btn-eye').classList.toggle('active', mode === 'eye');
  
  const titleText = document.getElementById('waveform-title-text');
  if (mode === 'scope') {
    titleText.textContent = 'Estimated Ringing / Reflections';
  } else {
    titleText.textContent = 'Eye Diagram at Receiving Nodes';
  }
  
  render(); // Re-render to trigger waveform update
}

// Physically Simulate and Draw CAN Signals with Ringing & Reflection Errors on Canvas
function drawWaveform(riskPercent = 0) {
  const w = waveformCanvas.width;
  const h = waveformCanvas.height;

  // Clear canvas
  ctxWaveform.fillStyle = '#090d16';
  ctxWaveform.fillRect(0, 0, w, h);

  // Grid lines
  ctxWaveform.strokeStyle = '#1e293b';
  ctxWaveform.lineWidth = 1;
  ctxWaveform.beginPath();
  for (let x = 0; x < w; x += 40) {
    ctxWaveform.moveTo(x, 0);
    ctxWaveform.lineTo(x, h);
  }
  for (let y = 0; y < h; y += 20) {
    ctxWaveform.moveTo(0, y);
    ctxWaveform.lineTo(w, y);
  }
  ctxWaveform.stroke();

  // 1. Physical network parameters (qualitative SI visualization — not a full EM solver)
  let totalTrunkLength = 0;
  let maxStubLength = 0;
  let reflectionsWeight = 0;

  stations.forEach((s, i) => {
    if (i > 0) totalTrunkLength += s.distanceFromPrev || 0;
    (s.devices || []).forEach(d => {
      const stub = d.stubLength || 0;
      maxStubLength = Math.max(maxStubLength, stub);
      // Unt terminated / weakly terminated drops contribute to reflection weight
      const localTerm = (d.termination || 0) > 0 ? d.termination : 0;
      reflectionsWeight += stub * (1 - Math.min(1, localTerm / 120));
    });
  });

  // Prefer shared termination model (station + device)
  const totalTerminations = (typeof collectTerminations === 'function')
    ? collectTerminations().length
    : 0;

  // Visualize at the critical (faster) bit time: data phase when FD is on
  const isFD = networkConfig.enableCanFD;
  const baud = isFD ? networkConfig.dataBaudRate : networkConfig.baudRate;
  const bitTime = 1e6 / Math.max(1, baud); // ns
  const samplePointPercent = isFD ? networkConfig.dataSamplePoint : networkConfig.samplePoint;
  const samplePointTime = bitTime * (samplePointPercent / 100);

  // 2. Generate a bit pattern sequence
  // Fixed sequence with short and long pulses to highlight ISI
  const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1];
  const numBits = bits.length;

  const points = [];
  const samplesPerBit = 60;
  const totalSamples = numBits * samplesPerBit;

  // Propagation speed from configured τ (ns/m): v = 1/τ m/ns
  const tauCable = Math.max(0.1, networkConfig.propDelay || 5);
  const v_prop = 1 / tauCable; // m/ns  (5 ns/m → 0.2 m/ns ≈ 0.67c)

  // Transition rise time constant from trunk length + termination mismatch
  const termMismatchPenalty = Math.abs(totalTerminations - 2) * 15;
  const tau = 10 + 0.25 * totalTrunkLength + termMismatchPenalty; // ns

  // Ringing frequency and damping
  // Lower resonant frequency for longer stubs: f = v_prop / (4 * L_stub)
  const longestStubMeters = maxStubLength;
  const ringFreq = longestStubMeters > 0 ? (2 * Math.PI * (v_prop / (4 * longestStubMeters))) : 0;
  const ringDamping = longestStubMeters > 0 ? (0.01 + 0.005 / longestStubMeters + (1 / (totalTrunkLength + 5))) : 0.05;
  const ringAmp = reflectionsWeight * 0.45; // Amplitude coefficient

  let v_smooth = bits[0] === 1 ? 0.0 : 2.0;

  // Compute the continuous voltage waveform
  for (let i = 0; i < totalSamples; i++) {
    const t_ns = i * (bitTime / samplesPerBit); // Time in nanoseconds
    const bitIdx = Math.floor(t_ns / bitTime);
    const targetBit = bits[Math.min(numBits - 1, bitIdx)];
    
    // Ideal driver voltage (0V recessive differential, 2.0V dominant differential)
    const v_ideal = targetBit === 1 ? 0.0 : 2.0;

    // Apply low-pass rise/fall time dispersion
    const dt = bitTime / samplesPerBit;
    v_smooth += (v_ideal - v_smooth) * (1 - Math.exp(-dt / tau));

    // Calculate sum of reflections from all past bit transition edges
    let v_reflections = 0;
    for (let k = 1; k < numBits; k++) {
      const edgeTime = k * bitTime;
      if (t_ns > edgeTime) {
        const t_elapsed = t_ns - edgeTime;
        const prevBit = bits[k - 1];
        const currBit = bits[k];
        if (prevBit !== currBit) {
          const edgeDirection = prevBit === 1 ? 1 : -1; // 1 for rising, -1 for falling edge
          
          // Add ringing term
          if (longestStubMeters > 0) {
            // Round-trip delay in stub
            const delay_ns = (2 * longestStubMeters) / v_prop;
            if (t_elapsed > delay_ns) {
              const t_ring = t_elapsed - delay_ns;
              v_reflections += edgeDirection * ringAmp * Math.exp(-ringDamping * t_ring) * Math.sin(ringFreq * t_ring);
            }
          }
        }
      }
    }

    points.push({
      time: t_ns,
      voltage: Math.max(-0.5, Math.min(3.5, v_smooth + v_reflections))
    });
  }

  // Visual voltage coordinates mapping
  const mapY = (v) => {
    const baseRecessive = h - 20; // Recessive base position near bottom
    const baseDominant = 20; // Dominant base position near top
    const scale = (baseRecessive - baseDominant) / 2.0;
    return baseRecessive - v * scale;
  };

  if (scopeMode === 'scope') {
    // --- DRAW CONTINUOUS SCOPE VIEW ---
    ctxWaveform.strokeStyle = riskPercent > 65 ? '#ef4444' : riskPercent > 25 ? '#f59e0b' : '#10b981';
    ctxWaveform.lineWidth = 2.5;
    ctxWaveform.shadowBlur = 4;
    ctxWaveform.shadowColor = ctxWaveform.strokeStyle;
    ctxWaveform.beginPath();

    points.forEach((p, idx) => {
      const x = (p.time / (numBits * bitTime)) * w;
      const y = mapY(p.voltage);
      if (idx === 0) {
        ctxWaveform.moveTo(x, y);
      } else {
        ctxWaveform.lineTo(x, y);
      }
    });

    ctxWaveform.stroke();
    ctxWaveform.shadowBlur = 0;
  } else {
    // --- DRAW EYE DIAGRAM VIEW ---
    const eyePeriod = 2 * bitTime; // 2 bits wide window
    const halfBit = bitTime / 2;

    ctxWaveform.lineWidth = 1.5;
    ctxWaveform.strokeStyle = riskPercent > 65 ? 'rgba(239, 68, 68, 0.25)' : riskPercent > 25 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)';
    
    // Overlay sliced segments
    for (let k = 1; k < numBits - 1; k++) {
      const sliceStartTime = k * bitTime - halfBit;
      const sliceEndTime = sliceStartTime + eyePeriod;
      
      ctxWaveform.beginPath();
      let firstPoint = true;

      points.forEach(p => {
        if (p.time >= sliceStartTime && p.time <= sliceEndTime) {
          const relativeTime = p.time - sliceStartTime;
          const x = (relativeTime / eyePeriod) * w;
          const y = mapY(p.voltage);
          if (firstPoint) {
            ctxWaveform.moveTo(x, y);
            firstPoint = false;
          } else {
            ctxWaveform.lineTo(x, y);
          }
        }
      });
      ctxWaveform.stroke();
    }

    // Draw Transceiver Receiver Threshold Lines (0.5V and 0.9V)
    ctxWaveform.lineWidth = 1;
    ctxWaveform.setLineDash([4, 4]);

    // Recessive Threshold (0.5V)
    ctxWaveform.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctxWaveform.beginPath();
    ctxWaveform.moveTo(0, mapY(0.5));
    ctxWaveform.lineTo(w, mapY(0.5));
    ctxWaveform.stroke();

    // Dominant Threshold (0.9V)
    ctxWaveform.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctxWaveform.beginPath();
    ctxWaveform.moveTo(0, mapY(0.9));
    ctxWaveform.lineTo(w, mapY(0.9));
    ctxWaveform.stroke();
    ctxWaveform.setLineDash([]);

    // Draw text labels for thresholds
    ctxWaveform.fillStyle = '#ef4444';
    ctxWaveform.font = '8px var(--font-mono)';
    ctxWaveform.fillText('Recessive Limit (0.5V)', 6, mapY(0.5) - 3);

    ctxWaveform.fillStyle = '#10b981';
    ctxWaveform.fillText('Dominant Limit (0.9V)', 6, mapY(0.9) - 3);

    // Draw Keep-out Mask Box (Eye Opening Limit)
    const eyeCenterTime = halfBit + samplePointTime;
    const eyeCenterPct = eyeCenterTime / eyePeriod;
    const maskWidth = 24; // Width of sample window
    const maskX = (eyeCenterPct * w) - maskWidth / 2;

    const maskYTop = mapY(0.9);
    const maskYBottom = mapY(0.5);

    ctxWaveform.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctxWaveform.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctxWaveform.lineWidth = 1.5;
    ctxWaveform.strokeRect(maskX, maskYTop, maskWidth, maskYBottom - maskYTop);
    ctxWaveform.fillRect(maskX, maskYTop, maskWidth, maskYBottom - maskYTop);

    // Draw Sampling Point indicator arrow
    ctxWaveform.fillStyle = '#94a3b8';
    ctxWaveform.beginPath();
    ctxWaveform.moveTo(eyeCenterPct * w, h - 2);
    ctxWaveform.lineTo(eyeCenterPct * w - 3, h - 6);
    ctxWaveform.lineTo(eyeCenterPct * w + 3, h - 6);
    ctxWaveform.fill();
    ctxWaveform.fillText('SAMPLE POINT', (eyeCenterPct * w) - 28, h - 10);
  }
}

// State Sharing and Exporting
function shareState() {
  try {
    const configData = {
      baud: networkConfig.baudRate,
      sp: networkConfig.samplePoint,
      prop: networkConfig.propDelay,
      loop: networkConfig.loopDelay,
      fd: networkConfig.enableCanFD,
      dbaud: networkConfig.dataBaudRate,
      dsp: networkConfig.dataSamplePoint,
      unit: currentUnit,
      stations: stations.map(s => ({
        n: s.name,
        d: s.distanceFromPrev,
        devs: s.devices.map(d => ({
          n: d.name,
          s: d.stubLength,
          t: d.termination
        }))
      }))
    };

    const serialized = (window.encodeShareState ? window.encodeShareState(configData) : btoa(unescape(encodeURIComponent(JSON.stringify(configData)))));
    const url = new URL(window.location.href);
    url.searchParams.set('design', serialized);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      alert("Design link copied to clipboard! You can share this URL with other engineers.");
    });
  } catch (err) {
    console.error(err);
    alert("Failed to generate share link.");
  }
}

function loadURLOrPreset() {
  const urlParams = new URLSearchParams(window.location.search);
  const design = urlParams.get('design');

  if (design) {
    try {
      const decoded = (window.decodeShareState ? window.decodeShareState(design) : JSON.parse(decodeURIComponent(escape(atob(design)))));
      networkConfig.baudRate = decoded.baud || 250;
      networkConfig.samplePoint = decoded.sp || 80;
      networkConfig.propDelay = decoded.prop || 5.0;
      networkConfig.loopDelay = decoded.loop || 150;
      networkConfig.enableCanFD = decoded.fd || false;
      networkConfig.dataBaudRate = decoded.dbaud || 2000;
      networkConfig.dataSamplePoint = decoded.dsp || 75;
      currentUnit = decoded.unit || 'm';

      stations = decoded.stations.map((s, si) => ({
        id: 's_' + si,
        name: s.n,
        distanceFromPrev: s.d,
        devices: s.devs.map((d, di) => ({
          id: 'd_' + si + '_' + di,
          name: d.n,
          stubLength: d.s,
          termination: d.t
        }))
      }));

      // Sync form inputs
      inputBaud.value = networkConfig.baudRate;
      inputSamplePoint.value = networkConfig.samplePoint;
      inputPropDelay.value = networkConfig.propDelay;
      inputLoopDelay.value = networkConfig.loopDelay;
      inputCanFD.checked = networkConfig.enableCanFD;
      inputDataBaud.value = networkConfig.dataBaudRate;
      inputDataSP.value = networkConfig.dataSamplePoint;
      selectUnit.value = currentUnit;

      const displayVal = networkConfig.enableCanFD ? 'block' : 'none';
      groupDataBaud.style.display = displayVal;
      groupDataSP.style.display = displayVal;

      render();
      return;
    } catch (e) {
      console.warn("Invalid design parameter in URL, loading default preset.", e);
    }
  }

  applyPreset('ideal-250');
}

function exportStateJSON() {
  readCanopenInputs();
  const fileContent = JSON.stringify({
    version: '3.0',
    type: 'can-bus-harness-design',
    config: networkConfig,
    unit: currentUnit,
    standardsPackId,
    buses,
    activeBusId,
    stations: stations,
    canopen: canopenConfig
  }, null, 2);

  const blob = new Blob([fileContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `can-star-harness-${networkConfig.baudRate}kbps.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importStateJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.type !== 'can-bus-harness-design') {
        alert("Invalid file format. Please upload a valid CAN Bus harness design JSON.");
        return;
      }

      networkConfig = { ...imported.config };
      currentUnit = imported.unit || 'm';
      if (imported.canopen) canopenConfig = { ...canopenConfig, ...imported.canopen };
      standardsPackId = imported.standardsPackId || 'iso11898-2';
      buses = Array.isArray(imported.buses) && imported.buses.length
        ? imported.buses
        : [{ id: 'bus-1', name: 'CAN Network' }];
      activeBusId = imported.activeBusId || buses[0].id;

      if (imported.version === '1.0') {
        stations = imported.nodes.map((n, i) => ({
          id: 's_' + i,
          name: n.name + ' Station',
          distanceFromPrev: i === 0 ? 0.0 : Math.max(0.001, n.position - imported.nodes[i-1].position),
          busId: 'bus-1',
          devices: [
            { id: n.id, name: n.name, stubLength: n.stubLength, termination: n.termination }
          ]
        }));
      } else {
        stations = imported.stations || [];
      }
      normalizeStationsInPlace();

      // Sync form fields
      inputBaud.value = networkConfig.baudRate;
      inputSamplePoint.value = networkConfig.samplePoint;
      inputPropDelay.value = networkConfig.propDelay;
      inputLoopDelay.value = networkConfig.loopDelay;
      inputCanFD.checked = networkConfig.enableCanFD || false;
      inputDataBaud.value = networkConfig.dataBaudRate || 2000;
      inputDataSP.value = networkConfig.dataSamplePoint || 75;
      selectUnit.value = currentUnit;
      syncCanopenInputsFromState();

      const displayVal = networkConfig.enableCanFD ? 'block' : 'none';
      groupDataBaud.style.display = displayVal;
      groupDataSP.style.display = displayVal;

      render();
      alert("Harness configuration imported successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to parse JSON file.");
    }
  };
  reader.readAsText(file);
}



// Run initializer
init();

// Register project manager hooks
window.projectManagerConfig = {
  toolId: "can-bus-designer",
  getInputs: () => ({
    version: '3.0',
    type: 'can-bus-harness-design',
    config: networkConfig,
    unit: currentUnit,
    standardsPackId,
    buses,
    activeBusId,
    stations: stations,
    canopen: canopenConfig
  }),
  setInputs: (data) => {
    if (data.type === 'can-bus-harness-design') {
      networkConfig = { ...data.config };
      currentUnit = data.unit || 'm';
      stations = data.stations || [];
      standardsPackId = data.standardsPackId || 'iso11898-2';
      buses = Array.isArray(data.buses) && data.buses.length ? data.buses : [{ id: 'bus-1', name: 'CAN Network' }];
      activeBusId = data.activeBusId || buses[0].id;
      normalizeStationsInPlace();
      if (data.canopen) canopenConfig = { ...canopenConfig, ...data.canopen };

      // Sync form fields
      inputBaud.value = networkConfig.baudRate;
      inputSamplePoint.value = networkConfig.samplePoint;
      inputPropDelay.value = networkConfig.propDelay;
      inputLoopDelay.value = networkConfig.loopDelay;
      inputCanFD.checked = networkConfig.enableCanFD || false;
      inputDataBaud.value = networkConfig.dataBaudRate || 2000;
      inputDataSP.value = networkConfig.dataSamplePoint || 75;
      selectUnit.value = currentUnit;
      syncCanopenInputsFromState();

      const displayVal = networkConfig.enableCanFD ? 'block' : 'none';
      groupDataBaud.style.display = displayVal;
      groupDataSP.style.display = displayVal;

      render();
    }
  }
};
