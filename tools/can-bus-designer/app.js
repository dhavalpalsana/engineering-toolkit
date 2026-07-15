// State Management
let stations = [];
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

// Dragging State
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

  // Add Station
  btnAddStation.addEventListener('click', () => {
    const newStation = {
      id: 's_' + Date.now().toString(),
      name: `Station ${stations.length + 1}`,
      distanceFromPrev: 5.0, // Default distance
      devices: [
        { id: 'd_' + Date.now().toString(), name: `Device ${stations.length + 1}`, stubLength: 0.1, termination: 0 }
      ]
    };
    stations.push(newStation);
    render();
  });

  // Export & Import
  btnExport.addEventListener('click', exportStateJSON);
  btnImport.addEventListener('click', () => fileImport.click());
  fileImport.addEventListener('change', importStateJSON);
  btnShare.addEventListener('click', shareState);

  // Scope and Eye Diagram Toggles
  document.getElementById('scope-btn-scope').addEventListener('click', () => setScopeMode('scope'));
  document.getElementById('scope-btn-eye').addEventListener('click', () => setScopeMode('eye'));
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

  // Pan Mouse Events (dragging on grid)
  harnessSvg.addEventListener('mousedown', (e) => {
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

function getCumulativePositions() {
  let positions = [];
  let current = 0;
  for (let i = 0; i < stations.length; i++) {
    current += stations[i].distanceFromPrev;
    positions.push(current);
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
  try {
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (e) {
    console.warn("Lucide icons load failure: ", e);
  }
}

// Render inputs list (Station hierarchy)
function renderStationCards() {
  stationListContainer.innerHTML = '';
  
  if (stations.length === 0) {
    stationListContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: var(--r-md)">
        No stations configured. Click 'Add Station' or double-click canvas background to start building.
      </div>
    `;
    return;
  }

  stations.forEach((station, index) => {
    const isFirst = index === 0;

    // Render connection line and spacing input in-between stations
    if (!isFirst) {
      const connector = document.createElement('div');
      connector.className = 'station-connector';
      connector.innerHTML = `
        <div class="connector-line"></div>
        <div class="connector-input-wrapper">
          <i data-lucide="route" style="width: 13px; height: 13px; color: var(--text-muted);"></i>
          <span class="connector-label">Spacing:</span>
          <input type="number" class="station-dist-input" value="${fromMeters(station.distanceFromPrev).toFixed(currentUnit === 'mm' ? 0 : 1)}" data-action="edit-station-dist" min="0.001" step="any" title="Distance from previous node in ${currentUnit}">
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${currentUnit}</span>
        </div>
        <div class="connector-line"></div>
      `;

      // Bind spacing edit event
      connector.querySelector('[data-action="edit-station-dist"]').addEventListener('change', (e) => {
        station.distanceFromPrev = Math.max(0.001, toMeters(parseFloat(e.target.value) || 0));
        render();
      });

      stationListContainer.appendChild(connector);
    }

    const card = document.createElement('div');
    card.className = 'station-card';
    card.dataset.id = station.id;

    card.innerHTML = `
      <div class="station-header">
        <div class="station-title-group" style="cursor: grab;">
          <i data-lucide="grip-vertical" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: -4px;"></i>
          <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--accent);"></i>
          <input type="text" class="station-name-input" value="${station.name}" data-action="edit-station-name" title="Station name">
          ${isFirst ? `<span class="start-badge">Start</span>` : ''}
        </div>
        
        <button class="btn-delete" data-action="delete-station" title="Delete this entire station & connected devices" style="margin-left: 8px;">
          <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
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
        <div style="display: flex; align-items: center; gap: 4px; cursor: grab;">
          <i data-lucide="grip-vertical" style="width: 12px; height: 12px; color: var(--text-muted); margin-right: -4px;"></i>
          <input type="text" class="device-input" value="${device.name}" data-action="edit-device-name" title="Device name">
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <input type="number" class="device-input" value="${fromMeters(device.stubLength).toFixed(currentUnit === 'm' ? 2 : currentUnit === 'mm' ? 0 : 1)}" data-action="edit-device-stub" min="0" step="any" title="Physical stub length from splice in ${currentUnit}">
          <span style="font-size: 11px; color: var(--text-muted);">${currentUnit}</span>
        </div>
        <div>
          <select class="device-input" data-action="edit-device-term" title="Device termination">
            <option value="0" ${device.termination === 0 ? 'selected' : ''}>None</option>
            <option value="120" ${device.termination === 120 ? 'selected' : ''}>120 Ω</option>
            <option value="custom" ${device.termination !== 0 && device.termination !== 120 ? 'selected' : ''}>Custom...</option>
          </select>
          <input type="number" class="device-input custom-term-input" value="${device.termination}" data-action="edit-device-term-val" min="1" max="1000" style="display: ${device.termination !== 0 && device.termination !== 120 ? 'block' : 'none'}; margin-top: 4px;" title="Custom resistance in Ohms">
        </div>
        <div style="display: flex; align-items: center; justify-content: center;">
          <button class="btn-delete" data-action="delete-device" title="Remove this device from star splice">
            <i data-lucide="trash" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      `;

      // Drag-and-drop for Devices inside this row
      const devGrip = devRow.querySelector('div:first-child');
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

    // Delete Station
    card.querySelector('[data-action="delete-station"]').addEventListener('click', () => {
      stations = stations.filter(s => s.id !== station.id);
      if (stations.length > 0) {
        stations[0].distanceFromPrev = 0.0;
      }
      render();
    });

    stationListContainer.appendChild(card);
  });
}

// Core Physics and Rule Checker
function runDiagnostics() {
  const diagnostics = {
    errors: [],
    warnings: [],
    eqResistance: 0,
    totalBusLength: 0,
    roundTripPropTime: 0,
    timeBudget: 0,
    riskPercentage: 0,
    stationStatuses: {}, 
    deviceStatuses: {} 
  };

  if (stations.length === 0) return diagnostics;

  // Initial pass to clear statuses
  stations.forEach(s => {
    diagnostics.stationStatuses[s.id] = 'pass';
    s.devices.forEach(d => {
      diagnostics.deviceStatuses[d.id] = 'pass';
    });
  });

  // 1. Trunk Length limits based on Baud Rate
  const cumPositions = getCumulativePositions();
  const totalLength = cumPositions[cumPositions.length - 1] || 0;
  diagnostics.totalBusLength = totalLength;

  const standardBusLimits = {
    1000: 40,
    800: 50,
    500: 100,
    250: 250,
    125: 500,
    50: 1000,
    20: 2500,
    10: 5000
  };

  const maxAllowedTrunk = standardBusLimits[networkConfig.baudRate] || 40;
  let trunkStatus = 'pass';
  if (totalLength > maxAllowedTrunk) {
    diagnostics.errors.push(`Total bus trunk length (${totalLength.toFixed(1)}m) exceeds maximum recommended length of ${maxAllowedTrunk}m for ${networkConfig.baudRate} kbps.`);
    trunkStatus = 'fail';
  } else if (totalLength > maxAllowedTrunk * 0.8) {
    diagnostics.warnings.push(`Total bus trunk length (${totalLength.toFixed(1)}m) is nearing the maximum limit (${maxAllowedTrunk}m) for ${networkConfig.baudRate} kbps.`);
    trunkStatus = 'warn';
  }

  // 2. Equivalent Termination Resistance Check
  let termResistors = [];
  let terminatedDevicesCount = 0;
  
  stations.forEach(s => {
    s.devices.forEach(d => {
      if (d.termination > 0) {
        termResistors.push(d.termination);
        terminatedDevicesCount++;
      }
    });
  });

  let eqResistance = 0;
  if (termResistors.length > 0) {
    const sumInverse = termResistors.reduce((sum, r) => sum + (1 / r), 0);
    eqResistance = Math.round(1 / sumInverse);
  } else {
    eqResistance = Infinity;
  }
  diagnostics.eqResistance = eqResistance;

  let resistanceStatus = 'pass';
  if (terminatedDevicesCount === 0) {
    diagnostics.errors.push("Zero termination resistors detected. High signal reflections will occur. Add exactly two 120 Ω resistors at physical ends.");
    resistanceStatus = 'fail';
  } else if (terminatedDevicesCount === 1) {
    diagnostics.errors.push(`Only one termination resistor detected (${termResistors[0]} Ω). At least two 120 Ω parallel termination resistors (ideal Req: 60 Ω) are required.`);
    resistanceStatus = 'fail';
  } else if (terminatedDevicesCount > 2) {
    diagnostics.errors.push(`Over-terminated bus. ${terminatedDevicesCount} terminations detected, reducing equivalent resistance to ${eqResistance} Ω (Nominal: 60 Ω). This will overload transceiver drivers.`);
    resistanceStatus = 'fail';
  } else {
    if (eqResistance < 50 || eqResistance > 65) {
      diagnostics.warnings.push(`Termination resistance (${eqResistance} Ω) is outside the standard 50-65 Ω compliant range. Check resistor values.`);
      resistanceStatus = 'warn';
    }
  }

  // 3. Termination Resistor Placement Check
  let placementStatus = 'pass';
  if (terminatedDevicesCount === 2) {
    const firstStation = stations[0];
    const lastStation = stations[stations.length - 1];

    const isFirstTerminated = firstStation.devices.some(d => d.termination > 0);
    const isLastTerminated = lastStation.devices.some(d => d.termination > 0);

    if (!isFirstTerminated || !isLastTerminated) {
      diagnostics.errors.push("Improper termination placement. Termination resistors must be located at the extreme physical ends of the bus line (first & last stations) to avoid unterminated branches.");
      placementStatus = 'fail';
      
      if (!isFirstTerminated) diagnostics.stationStatuses[firstStation.id] = 'fail';
      if (!isLastTerminated) diagnostics.stationStatuses[lastStation.id] = 'fail';
    }
  } else if (terminatedDevicesCount > 0) {
    placementStatus = 'fail';
  }

  // 4. Individual and Cumulative Stub Lengths
  let maxIndividualStub = STANDARD_STUB_LIMITS[networkConfig.baudRate] || 0.3;
  let maxCumulativeStub = STANDARD_CUMULATIVE_LIMITS[networkConfig.baudRate] || 3.0;

  if (networkConfig.enableCanFD) {
    maxIndividualStub = DATA_STUB_LIMITS[networkConfig.dataBaudRate] || 0.1;
    maxCumulativeStub = DATA_CUMULATIVE_LIMITS[networkConfig.dataBaudRate] || 0.5;
  }

  let anyStubTooLong = false;
  let totalStubLength = 0;
  
  stations.forEach(station => {
    station.devices.forEach(device => {
      totalStubLength += device.stubLength;

      if (device.stubLength > maxIndividualStub) {
        diagnostics.errors.push(`Device "${device.name}" stub length (${device.stubLength.toFixed(2)}m) exceeds maximum allowed ${maxIndividualStub}m for the selected bitrate.`);
        diagnostics.deviceStatuses[device.id] = 'fail';
        diagnostics.stationStatuses[station.id] = 'fail';
        anyStubTooLong = true;
      } else if (device.stubLength > maxIndividualStub * 0.7) {
        diagnostics.warnings.push(`Device "${device.name}" stub length (${device.stubLength.toFixed(2)}m) is nearing the limit (${maxIndividualStub}m).`);
        diagnostics.deviceStatuses[device.id] = 'warn';
        if (diagnostics.stationStatuses[station.id] !== 'fail') {
          diagnostics.stationStatuses[station.id] = 'warn';
        }
      }
    });
  });

  let cumulativeStubStatus = 'pass';
  if (totalStubLength > maxCumulativeStub) {
    diagnostics.errors.push(`Cumulative stub length (${totalStubLength.toFixed(2)}m) exceeds standard maximum of ${maxCumulativeStub}m for the current configuration.`);
    cumulativeStubStatus = 'fail';
  } else if (totalStubLength > maxCumulativeStub * 0.8) {
    diagnostics.warnings.push(`Cumulative stub length (${totalStubLength.toFixed(2)}m) is nearing the limit of ${maxCumulativeStub}m.`);
    cumulativeStubStatus = 'warn';
  }

  // 5. Star Topology (Multiple Devices per Station) Checks
  let starTopologyDetected = false;
  let criticalStarTopology = false;

  stations.forEach(station => {
    const devCount = station.devices.length;
    if (devCount >= 2) {
      starTopologyDetected = true;
      if (diagnostics.stationStatuses[station.id] === 'pass') {
        diagnostics.stationStatuses[station.id] = 'warn';
      }
      
      if (devCount >= 3) {
        criticalStarTopology = true;
        diagnostics.stationStatuses[station.id] = 'fail';
        diagnostics.errors.push(`Critical star splice: ${devCount} devices connected at "${station.name}". Concentrated capacitive loading will degrade signals; recommend star couplers or an active hub.`);
      } else {
        diagnostics.warnings.push(`Star splice detected at "${station.name}" (${devCount} drop devices). Keep drop segments as short as possible.`);
      }
    }
  });

  // 6. Node Spacing Check
  let spacingStatus = 'pass';
  let tooCloseStations = [];
  for (let i = 1; i < stations.length; i++) {
    const dist = stations[i].distanceFromPrev;
    if (dist < 0.1) {
      tooCloseStations.push(`"${stations[i-1].name}" & "${stations[i].name}"`);
    }
  }

  if (tooCloseStations.length > 0) {
    diagnostics.warnings.push(`Local capacitive clustering: Station spacing is under 0.1m between ${tooCloseStations.join(', ')}. Standard recommends spacing nodes > 0.1m to avoid localized impedance drops.`);
    spacingStatus = 'warn';
  }

  // 7. Round-Trip Signal Propagation Time Budget Check
  const bitTime = 1000000 / networkConfig.baudRate; // ns
  const sampleTime = (networkConfig.samplePoint / 100) * bitTime; // ns
  
  const propTime = 2 * (totalLength * networkConfig.propDelay + networkConfig.loopDelay) + networkConfig.controllerMargin;
  
  diagnostics.roundTripPropTime = Math.round(propTime);
  diagnostics.timeBudget = Math.round(sampleTime);

  let timingStatus = 'pass';
  if (propTime >= sampleTime) {
    diagnostics.errors.push(`Arbitration timing violation! Round-trip propagation time (${Math.round(propTime)} ns) exceeds the sample point budget (${Math.round(sampleTime)} ns). CAN controllers will register bit errors during arbitration.`);
    timingStatus = 'fail';
  } else if (propTime >= sampleTime * 0.8) {
    diagnostics.warnings.push(`Tight timing margin. Round-trip propagation time (${Math.round(propTime)} ns) takes up ${Math.round(propTime/sampleTime*100)}% of the sample point budget (${Math.round(sampleTime)} ns).`);
    timingStatus = 'warn';
  }

  // Highlight over-termination errors on specific devices
  if (terminatedDevicesCount > 2) {
    stations.forEach(s => {
      s.devices.forEach(d => {
        if (d.termination > 0) {
          diagnostics.deviceStatuses[d.id] = 'fail';
          diagnostics.stationStatuses[s.id] = 'fail';
        }
      });
    });
  }

  // Calculate overall Signal Integrity Risk score (0 - 100)
  let risk = 0;
  
  // Impedance risk (Max 40 pts)
  if (eqResistance === Infinity) risk += 40;
  else if (eqResistance < 45) risk += 30;
  else if (eqResistance > 80) risk += 25;
  else if (eqResistance < 55 || eqResistance > 70) risk += 10;

  // Placement risk (Max 15 pts)
  if (placementStatus === 'fail') risk += 15;

  // Stub lengths risk (Max 25 pts)
  if (anyStubTooLong) risk += 15;
  if (cumulativeStubStatus === 'fail') risk += 10;
  else if (cumulativeStubStatus === 'warn') risk += 5;

  // Star topology risk (Max 10 pts)
  if (criticalStarTopology) risk += 10;
  else if (starTopologyDetected) risk += 5;

  // Spacing risk (Max 5 pts)
  if (spacingStatus === 'warn') risk += 5;

  // Timing risk (Max 10 pts)
  if (timingStatus === 'fail') risk += 10;
  else if (timingStatus === 'warn') risk += 5;

  diagnostics.riskPercentage = Math.min(risk, 100);

  // Grouped status objects for compliance checklist rendering
  diagnostics.checklists = [
    {
      id: 'res',
      title: 'Bus Equivalent Impedance',
      desc: `Measured Req: ${eqResistance === Infinity ? '∞' : eqResistance + ' Ω'} (Ideal: 60 Ω).`,
      status: resistanceStatus
    },
    {
      id: 'term_placement',
      title: 'Termination Resistor Placement',
      desc: terminatedDevicesCount === 2 && placementStatus === 'pass' 
        ? 'Terminators correctly placed on the absolute ends of the network.'
        : `Detected ${terminatedDevicesCount} terminators. End nodes terminated: First = ${stations[0]?.devices.some(d=>d.termination>0) ? 'Yes' : 'No'}, Last = ${stations[stations.length-1]?.devices.some(d=>d.termination>0) ? 'Yes' : 'No'}.`,
      status: placementStatus
    },
    {
      id: 'trunk_len',
      title: 'Trunk Physical Length',
      desc: `Total length: ${formatLength(totalLength)} (Max allowed for ${networkConfig.baudRate} kbps: ${formatLength(maxAllowedTrunk)}).`,
      status: trunkStatus
    },
    {
      id: 'stubs',
      title: 'Individual Stub Lengths',
      desc: anyStubTooLong 
        ? `One or more stubs exceed the speed-specific limit of ${formatLength(maxIndividualStub)}.`
        : `All stubs are under the limit of ${formatLength(maxIndividualStub)} for ${networkConfig.enableCanFD ? 'CAN FD Data Phase' : networkConfig.baudRate + ' kbps'}.`,
      status: anyStubTooLong ? 'fail' : 'pass'
    },
    {
      id: 'star_splice',
      title: 'Star Splicing & Clusters',
      desc: criticalStarTopology 
        ? 'Critical star junctions detected. Avoid branching multiple devices from the same splice point.'
        : starTopologyDetected 
          ? 'Star splices present. Keep branches as short as possible.'
          : 'Strict daisy-chain configuration. No star junctions present.',
      status: criticalStarTopology ? 'fail' : starTopologyDetected ? 'warn' : 'pass'
    },
    {
      id: 'cum_stubs',
      title: 'Cumulative Stub Length',
      desc: `Sum of all stubs: ${formatLength(totalStubLength)} (Max allowed: ${formatLength(maxCumulativeStub)}).`,
      status: cumulativeStubStatus
    },
    {
      id: 'spacing',
      title: 'Minimum Node Spacing',
      desc: spacingStatus === 'warn'
        ? 'Some stations are clustered closer than 0.1m, increasing local capacitive loads.'
        : 'All adjacent stations are spaced at least 0.1m apart along the trunk.',
      status: spacingStatus
    },
    {
      id: 'timing',
      title: 'Arbitration Propagation Margin',
      desc: `Round trip: ${diagnostics.roundTripPropTime} ns. Available budget to sample point: ${diagnostics.timeBudget} ns.`,
      status: timingStatus
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

  diagnostics.checklists.forEach(item => {
    const el = document.createElement('div');
    el.className = 'checklist-item';

    let iconClass = 'pass';
    let iconName = 'check-circle-2';
    if (item.status === 'warn') {
      iconClass = 'warn';
      iconName = 'alert-circle';
    } else if (item.status === 'fail') {
      iconClass = 'fail';
      iconName = 'x-circle';
    }

    el.innerHTML = `
      <div class="checklist-icon ${iconClass}">
        <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
      </div>
      <div class="checklist-content">
        <div class="checklist-title">${item.title}</div>
        <div class="checklist-desc">${item.desc}</div>
      </div>
    `;

    checklistBody.appendChild(el);
  });
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

  if (stations.length === 0) return;

  const width = canvasContainer.clientWidth || 800;
  const height = canvasContainer.clientHeight || 280;
  harnessSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Reapply view zoom transform
  applyViewTransform();

  const paddingLeft = 60;
  const paddingRight = 60;
  const graphWidth = width - paddingLeft - paddingRight;

  const cumPositions = getCumulativePositions();
  const maxPos = cumPositions[cumPositions.length - 1] || 0;
  const trunkLen = maxPos;

  // Calculate visual spacing with a dynamic minimum gap constraint to prevent star-layout overlap
  const segmentBaseGaps = [];
  let totalBaseGap = 0;
  for (let i = 1; i < stations.length; i++) {
    const N1 = stations[i-1].devices.length;
    const N2 = stations[i].devices.length;
    const rightSpread = N1 > 1 ? ((N1 - 1) * 85) / 2 : 0;
    const leftSpread = N2 > 1 ? ((N2 - 1) * 85) / 2 : 0;
    // Box width is 80px, we want at least a 35px safety margin
    const gap = Math.max(135, rightSpread + leftSpread + 115);
    segmentBaseGaps.push(gap);
    totalBaseGap += gap;
  }

  const minWidth = paddingLeft + paddingRight + totalBaseGap;
  const svgWidth = Math.max(width, minWidth);
  const adjustedGraphWidth = svgWidth - paddingLeft - paddingRight;

  let alpha = 0;
  if (trunkLen > 0 && adjustedGraphWidth > totalBaseGap) {
    alpha = (adjustedGraphWidth - totalBaseGap) / trunkLen;
  }

  const screenX = [paddingLeft];
  let currentX = paddingLeft;
  for (let i = 1; i < stations.length; i++) {
    const d = stations[i].distanceFromPrev;
    const baseGap = segmentBaseGaps[i-1];
    const segW = baseGap + alpha * d;
    currentX += segW;
    screenX.push(currentX);
  }

  dragInfo.screenX = screenX;
  dragInfo.scale = adjustedGraphWidth / (trunkLen || 1);
  dragInfo.graphWidth = adjustedGraphWidth;
  dragInfo.trunkLen = trunkLen;
  dragInfo.paddingLeft = paddingLeft;

  // Proportional visual positioning helper with overlap protection
  function getX(cumPos) {
    if (stations.length === 0) return paddingLeft;
    if (stations.length === 1) return paddingLeft + adjustedGraphWidth / 2;
    
    for (let i = 0; i < cumPositions.length; i++) {
      if (Math.abs(cumPos - cumPositions[i]) < 0.0001) {
        return screenX[i];
      }
    }
    
    for (let i = 1; i < cumPositions.length; i++) {
      if (cumPos >= cumPositions[i-1] && cumPos <= cumPositions[i]) {
        const p1 = cumPositions[i-1];
        const p2 = cumPositions[i];
        const x1 = screenX[i-1];
        const x2 = screenX[i];
        const t = (cumPos - p1) / (p2 - p1);
        return x1 + t * (x2 - x1);
      }
    }
    
    const lastCum = cumPositions[cumPositions.length - 1];
    const lastX = screenX[screenX.length - 1];
    if (cumPos < 0) {
      return screenX[0] + cumPos * dragInfo.scale;
    } else {
      return lastX + (cumPos - lastCum) * dragInfo.scale;
    }
  }

  const canH_Y = 70;
  const canL_Y = 95;

  const startX = getX(0);
  const endX = getX(maxPos);

  // 1. Draw Dual Bus Lines (CAN High & CAN Low)
  const pathH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  pathH.setAttribute('x1', startX);
  pathH.setAttribute('y1', canH_Y);
  pathH.setAttribute('x2', endX);
  pathH.setAttribute('y2', canH_Y);
  pathH.setAttribute('stroke', '#10b981');
  pathH.setAttribute('stroke-width', '4');
  pathH.setAttribute('stroke-linecap', 'round');
  pathH.setAttribute('class', 'svg-doubleclick-zone');
  pathH.setAttribute('title', 'Double-click empty canvas to insert station');
  zoomContainer.appendChild(pathH);

  const pathL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  pathL.setAttribute('x1', startX);
  pathL.setAttribute('y1', canL_Y);
  pathL.setAttribute('x2', endX);
  pathL.setAttribute('y2', canL_Y);
  pathL.setAttribute('stroke', '#3b82f6');
  pathL.setAttribute('stroke-width', '4');
  pathL.setAttribute('stroke-linecap', 'round');
  pathL.setAttribute('class', 'svg-doubleclick-zone');
  pathL.setAttribute('title', 'Double-click empty canvas to insert station');
  zoomContainer.appendChild(pathL);

  // Draw Bus Labels
  drawLabelSVG('CAN H', startX - 45, canH_Y + 4, '#10b981', 'right', '10px');
  drawLabelSVG('CAN L', startX - 45, canL_Y + 4, '#3b82f6', 'right', '10px');

  // 2. Draw Dimension Lines (Distance from last node) between adjacent stations
  for (let i = 1; i < stations.length; i++) {
    const xPrev = getX(cumPositions[i-1]);
    const xCurr = getX(cumPositions[i]);
    const dimY = 35; // Position above trunk

    // Dimension line
    const dimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    dimLine.setAttribute('x1', xPrev + 5);
    dimLine.setAttribute('y1', dimY);
    dimLine.setAttribute('x2', xCurr - 5);
    dimLine.setAttribute('y2', dimY);
    dimLine.setAttribute('stroke', 'var(--text-muted)');
    dimLine.setAttribute('stroke-width', '1');
    dimLine.setAttribute('stroke-dasharray', '3, 3');
    zoomContainer.appendChild(dimLine);

    // Dimension start arrow/tick
    const tickStart = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tickStart.setAttribute('x1', xPrev);
    tickStart.setAttribute('y1', dimY - 4);
    tickStart.setAttribute('x2', xPrev);
    tickStart.setAttribute('y2', dimY + 4);
    tickStart.setAttribute('stroke', 'var(--text-muted)');
    tickStart.setAttribute('stroke-width', '1');
    zoomContainer.appendChild(tickStart);

    // Dimension end arrow/tick
    const tickEnd = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tickEnd.setAttribute('x1', xCurr);
    tickEnd.setAttribute('y1', dimY - 4);
    tickEnd.setAttribute('x2', xCurr);
    tickEnd.setAttribute('y2', dimY + 4);
    tickEnd.setAttribute('stroke', 'var(--text-muted)');
    tickEnd.setAttribute('stroke-width', '1');
    zoomContainer.appendChild(tickEnd);

    // Distance Text (Double-click to edit)
    const distText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    distText.setAttribute('x', (xPrev + xCurr) / 2);
    distText.setAttribute('y', dimY - 4);
    distText.setAttribute('text-anchor', 'middle');
    distText.setAttribute('class', 'svg-dimension-text');
    distText.setAttribute('style', 'cursor: pointer;');
    distText.textContent = formatLength(stations[i].distanceFromPrev);
    distText.setAttribute('title', 'Double-click value to edit spacing');
    
    // Add double-click handler
    distText.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      showInlineEditor(e.target, stations[i].distanceFromPrev, (newVal) => {
        stations[i].distanceFromPrev = Math.max(0.001, toMeters(newVal));
        render();
      }, true);
    });
    
    zoomContainer.appendChild(distText);
  }

  // 3. Draw Stations and Star junctions
  stations.forEach((station, index) => {
    const x = getX(cumPositions[index]);
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
    tapH.setAttribute('cy', canH_Y);
    tapH.setAttribute('r', '4');
    tapH.setAttribute('fill', '#10b981');
    zoomContainer.appendChild(tapH);

    const tapL = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tapL.setAttribute('cx', x);
    tapL.setAttribute('cy', canL_Y);
    tapL.setAttribute('r', '4');
    tapL.setAttribute('fill', '#3b82f6');
    zoomContainer.appendChild(tapL);

    // Draggable station handle at the trunk
    const dragHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dragHandle.setAttribute('cx', x);
    dragHandle.setAttribute('cy', (canH_Y + canL_Y)/2);
    dragHandle.setAttribute('r', '7');
    dragHandle.setAttribute('fill', index === 0 ? 'var(--text-muted)' : 'var(--accent)');
    dragHandle.setAttribute('stroke', 'var(--bg-secondary)');
    dragHandle.setAttribute('stroke-width', '1.5');
    if (index > 0) {
      dragHandle.setAttribute('class', 'draggable-station');
      dragHandle.dataset.stationId = station.id;
      dragHandle.setAttribute('title', 'Drag horizontally to space station');
    }
    zoomContainer.appendChild(dragHandle);

    // Draw Splice point (Junction box / drop connection)
    const spliceY = canL_Y + 25;
    const trunkToSplice = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    trunkToSplice.setAttribute('x1', x);
    trunkToSplice.setAttribute('y1', canL_Y);
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

    // Draw a small "+" button group next to splice dot to add Devices directly on canvas
    const addX = x + 15;
    const addY = spliceY;
    const addGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    addGroup.setAttribute('class', 'svg-interactive-btn');
    addGroup.setAttribute('style', 'cursor: pointer;');
    addGroup.setAttribute('title', 'Click to add device branch');

    const plusCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    plusCircle.setAttribute('cx', addX);
    plusCircle.setAttribute('cy', addY);
    plusCircle.setAttribute('r', '7');
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
      station.devices.push({
        id: 'd_' + Date.now().toString(),
        name: `Node ${station.devices.length + 1}`,
        stubLength: 0.1,
        termination: 0
      });
      render();
    });
    zoomContainer.appendChild(addGroup);

    // Label station above the trunk line (Double-click to rename)
    const labelStationName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelStationName.setAttribute('x', x);
    labelStationName.setAttribute('y', canH_Y - 14);
    labelStationName.setAttribute('text-anchor', 'middle');
    labelStationName.setAttribute('fill', 'var(--text-primary)');
    labelStationName.setAttribute('font-size', '9px');
    labelStationName.setAttribute('font-weight', '700');
    labelStationName.textContent = truncateText(station.name, 12);
    labelStationName.setAttribute('style', 'cursor: pointer;');
    labelStationName.setAttribute('title', 'Double-click to rename station');
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
    const maxIndividualStub = networkConfig.enableCanFD
      ? (DATA_STUB_LIMITS[networkConfig.dataBaudRate] || 0.1)
      : (STANDARD_STUB_LIMITS[networkConfig.baudRate] || 0.3);
    
    station.devices.forEach((device, devIndex) => {
      const deviceStatus = diagnostics.deviceStatuses[device.id] || 'pass';
      let themeColor = 'var(--success)';
      if (deviceStatus === 'warn') themeColor = 'var(--warning)';
      else if (deviceStatus === 'fail') themeColor = 'var(--error)';

      // Calculate spatial branching angles or offsets
      let targetX = x;
      let targetY = spliceY + 45;

      if (devCount === 1) {
        // Standard single drop straight down
        targetX = x;
        targetY = spliceY + 45 + Math.min(device.stubLength * 20, 60);
      } else {
        // Star layout branching (spread horizontally)
        const spreadW = 85;
        const totalSpread = (devCount - 1) * spreadW;
        targetX = x - (totalSpread / 2) + (devIndex * spreadW);
        targetY = spliceY + 45 + Math.min(device.stubLength * 15, 60);
      }

      // Draw drop branch lines from splice dot to device box
      const deviceBranchLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      deviceBranchLine.setAttribute('x1', x);
      deviceBranchLine.setAttribute('y1', spliceY);
      deviceBranchLine.setAttribute('x2', targetX);
      deviceBranchLine.setAttribute('y2', targetY);
      deviceBranchLine.setAttribute('stroke', 'var(--text-muted)');
      deviceBranchLine.setAttribute('stroke-width', '1.5');
      zoomContainer.appendChild(deviceBranchLine);

      // Device box size
      const boxW = 80;
      const boxH = 44;
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
      nodeBox.setAttribute('style', 'cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05));');
      
      // Select station card in HTML list upon click on device
      nodeBox.addEventListener('click', () => {
        const targetCard = stationListContainer.querySelector(`[data-id="${station.id}"]`);
        if (targetCard) {
          stationListContainer.querySelectorAll('.station-card').forEach(c => c.style.borderColor = '');
          targetCard.style.borderColor = 'var(--accent)';
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
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
      labelDevName.setAttribute('title', 'Double-click to rename node');
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
      labelDevStub.setAttribute('title', 'Double-click value to edit stub length');
      
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

  // 1. Calculate physical network parameters dynamically from stations data
  let totalTrunkLength = 0;
  let maxStubLength = 0;
  let unterminatedStubsCount = 0;
  let reflectionsWeight = 0;
  let totalTerminations = 0;

  stations.forEach(s => {
    totalTrunkLength += s.distanceFromPrev;
    s.devices.forEach(d => {
      if (d.termination === 120) {
        totalTerminations++;
      } else {
        unterminatedStubsCount++;
        maxStubLength = Math.max(maxStubLength, d.stubLength);
        // Reflection weight is proportional to stub length and mismatch factor
        reflectionsWeight += d.stubLength * (1 - (d.termination || 0) / 120);
      }
    });
  });

  // Calculate transceiver sample point based on configuration (nominal or data phase)
  const isFD = networkConfig.enableCanFD;
  const baud = isFD ? networkConfig.dataBaudRate : networkConfig.baudRate;
  const bitTime = 1000000 / baud; // Bit time in nanoseconds
  const samplePointPercent = isFD ? networkConfig.dataSamplePoint : networkConfig.samplePoint;
  const samplePointTime = bitTime * (samplePointPercent / 100);

  // 2. Generate a bit pattern sequence
  // We use a fixed sequence that contains both short and long pulses to highlight inter-symbol interference (ISI)
  const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1];
  const numBits = bits.length;

  // Let the canvas width 'w' map to the time window of all bits in 'scope' mode.
  // In 'eye' mode, we will fold the bits into 2x bit period.
  const points = [];
  const samplesPerBit = 60;
  const totalSamples = numBits * samplesPerBit;

  // Physical constants
  const v_prop = 0.2; // Propagation speed: 0.2 meters per nanosecond (approx 2/3 speed of light)
  
  // Calculate transition rise time (tau) based on trunk length and termination mismatch
  const termMismatchPenalty = Math.abs(totalTerminations - 2) * 15;
  const tau = 10 + 0.25 * totalTrunkLength + termMismatchPenalty; // Rise-time constant in nanoseconds

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
  const fileContent = JSON.stringify({
    version: '2.0',
    type: 'can-bus-harness-design',
    config: networkConfig,
    unit: currentUnit,
    stations: stations
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
      
      if (imported.version === '1.0') {
        stations = imported.nodes.map((n, i) => ({
          id: 's_' + i,
          name: n.name + ' Station',
          distanceFromPrev: i === 0 ? 0.0 : Math.max(0.001, n.position - imported.nodes[i-1].position),
          devices: [
            { id: n.id, name: n.name, stubLength: n.stubLength, termination: n.termination }
          ]
        }));
      } else {
        stations = imported.stations;
      }

      // Sync form fields
      inputBaud.value = networkConfig.baudRate;
      inputSamplePoint.value = networkConfig.samplePoint;
      inputPropDelay.value = networkConfig.propDelay;
      inputLoopDelay.value = networkConfig.loopDelay;
      inputCanFD.checked = networkConfig.enableCanFD || false;
      inputDataBaud.value = networkConfig.dataBaudRate || 2000;
      inputDataSP.value = networkConfig.dataSamplePoint || 75;
      selectUnit.value = currentUnit;

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
    version: '2.0',
    type: 'can-bus-harness-design',
    config: networkConfig,
    unit: currentUnit,
    stations: stations
  }),
  setInputs: (data) => {
    if (data.type === 'can-bus-harness-design') {
      networkConfig = { ...data.config };
      currentUnit = data.unit || 'm';
      stations = data.stations;

      // Sync form fields
      inputBaud.value = networkConfig.baudRate;
      inputSamplePoint.value = networkConfig.samplePoint;
      inputPropDelay.value = networkConfig.propDelay;
      inputLoopDelay.value = networkConfig.loopDelay;
      inputCanFD.checked = networkConfig.enableCanFD || false;
      inputDataBaud.value = networkConfig.dataBaudRate || 2000;
      inputDataSP.value = networkConfig.dataSamplePoint || 75;
      selectUnit.value = currentUnit;

      const displayVal = networkConfig.enableCanFD ? 'block' : 'none';
      groupDataBaud.style.display = displayVal;
      groupDataSP.style.display = displayVal;

      render();
    }
  }
};
