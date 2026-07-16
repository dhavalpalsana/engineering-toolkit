/**
 * app.js — MCC Feeder & Motor Starter Designer Engine
 * Handles interactive SVG canvas, dragging, connection wiring,
 * engineering sizing math, URL sharing, and project manager integration.
 */

// ==========================================================================
// 1. Data Models & Constants
// ==========================================================================

let systemGlobals = {
  standard: "IEC",
  voltage: 400,          // V (3-Phase)
  frequency: 50,         // Hz
  pfTarget: 0.85
};

let nodes = [];
let wires = [];

let selectedElementId = null; // Can be a node ID or a wire ID
let selectedElementType = null; // 'node' | 'wire'

// SVG Canvas Zoom & Pan
let zoomLevel = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Drag and Drop Node State
let draggedNodeId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let hasMovedDuringDrag = false;

// Wiring State
let activeWireStartNode = null;
let activeWireTerminalType = null; // 'output' (currently we only draw from output to input)

// Standard Copper Ampacity table (Reference: IEC 60364-5-52, Multicore copper in conduit / tray at 30C)
const COPPER_AMPACITIES = [
  { size: 1.5, ampacity: 17.5 },
  { size: 2.5, ampacity: 24 },
  { size: 4, ampacity: 32 },
  { size: 6, ampacity: 41 },
  { size: 10, ampacity: 57 },
  { size: 16, ampacity: 76 },
  { size: 25, ampacity: 96 },
  { size: 35, ampacity: 119 },
  { size: 50, ampacity: 144 },
  { size: 70, ampacity: 184 },
  { size: 95, ampacity: 223 },
  { size: 120, ampacity: 259 },
  { size: 150, ampacity: 299 },
  { size: 185, ampacity: 341 },
  { size: 240, ampacity: 403 },
  { size: 300, ampacity: 464 }
];

// Standard Aluminum Ampacity table
const ALUMINUM_AMPACITIES = [
  { size: 2.5, ampacity: 18.5 },
  { size: 4, ampacity: 25 },
  { size: 6, ampacity: 32 },
  { size: 10, ampacity: 44 },
  { size: 16, ampacity: 59 },
  { size: 25, ampacity: 75 },
  { size: 35, ampacity: 93 },
  { size: 50, ampacity: 112 },
  { size: 70, ampacity: 143 },
  { size: 95, ampacity: 174 },
  { size: 120, ampacity: 202 },
  { size: 150, ampacity: 233 },
  { size: 185, ampacity: 266 },
  { size: 240, ampacity: 315 },
  { size: 300, ampacity: 363 }
];

// NEC Table 310.16 Ampacities (Copper, 75C termination rating)
const NEC_COPPER_AMPACITIES = [
  { size: "14 AWG", ampacity: 15, area: 2.08 },
  { size: "12 AWG", ampacity: 20, area: 3.31 },
  { size: "10 AWG", ampacity: 30, area: 5.26 },
  { size: "8 AWG", ampacity: 50, area: 8.37 },
  { size: "6 AWG", ampacity: 65, area: 13.3 },
  { size: "4 AWG", ampacity: 85, area: 21.15 },
  { size: "3 AWG", ampacity: 100, area: 26.67 },
  { size: "2 AWG", ampacity: 115, area: 33.62 },
  { size: "1 AWG", ampacity: 130, area: 42.41 },
  { size: "1/0 AWG", ampacity: 150, area: 53.49 },
  { size: "2/0 AWG", ampacity: 175, area: 67.43 },
  { size: "3/0 AWG", ampacity: 200, area: 85.01 },
  { size: "4/0 AWG", ampacity: 230, area: 107.2 },
  { size: "250 kcmil", ampacity: 255, area: 126.7 },
  { size: "300 kcmil", ampacity: 285, area: 152.0 },
  { size: "350 kcmil", ampacity: 310, area: 177.3 },
  { size: "400 kcmil", ampacity: 335, area: 202.7 },
  { size: "500 kcmil", ampacity: 380, area: 253.4 }
];

// NEC Table 310.16 Ampacities (Aluminum, 75C termination rating)
const NEC_ALUMINUM_AMPACITIES = [
  { size: "12 AWG", ampacity: 15, area: 3.31 },
  { size: "10 AWG", ampacity: 25, area: 5.26 },
  { size: "8 AWG", ampacity: 40, area: 8.37 },
  { size: "6 AWG", ampacity: 50, area: 13.3 },
  { size: "4 AWG", ampacity: 65, area: 21.15 },
  { size: "3 AWG", ampacity: 75, area: 26.67 },
  { size: "2 AWG", ampacity: 90, area: 33.62 },
  { size: "1 AWG", ampacity: 100, area: 42.41 },
  { size: "1/0 AWG", ampacity: 120, area: 53.49 },
  { size: "2/0 AWG", ampacity: 135, area: 67.43 },
  { size: "3/0 AWG", ampacity: 155, area: 85.01 },
  { size: "4/0 AWG", ampacity: 180, area: 107.2 },
  { size: "250 kcmil", ampacity: 205, area: 126.7 },
  { size: "300 kcmil", ampacity: 230, area: 152.0 },
  { size: "350 kcmil", ampacity: 250, area: 177.3 },
  { size: "400 kcmil", ampacity: 270, area: 202.7 },
  { size: "500 kcmil", ampacity: 310, area: 253.4 }
];

// Standard Breaker Frame/Trip ratings
const BREAKER_RATINGS = [15, 20, 25, 30, 40, 50, 63, 80, 100, 125, 160, 200, 225, 250, 315, 400, 500, 630, 800];

// Standard VFD Output Current ratings (Typical 400V Class)
const VFD_RATINGS = [
  { rating: 4, power: 1.5 },
  { rating: 7.5, power: 3.0 },
  { rating: 12, power: 5.5 },
  { rating: 17, power: 7.5 },
  { rating: 25, power: 11.0 },
  { rating: 32, power: 15.0 },
  { rating: 38, power: 18.5 },
  { rating: 45, power: 22.0 },
  { rating: 60, power: 30.0 },
  { rating: 75, power: 37.0 },
  { rating: 90, power: 45.0 },
  { rating: 110, power: 55.0 },
  { rating: 145, power: 75.0 },
  { rating: 180, power: 90.0 },
  { rating: 220, power: 110.0 },
  { rating: 250, power: 132.0 },
  { rating: 305, power: 160.0 }
];

// Standard Contactor Sizing (Typical AC-3 current ratings)
const CONTACTOR_RATINGS = [9, 12, 18, 25, 32, 40, 50, 65, 80, 95, 115, 150, 185, 225, 265, 330, 400, 500];

// Standard Soft Starter ratings
const SOFTSTARTER_RATINGS = [18, 30, 45, 60, 72, 85, 105, 145, 170, 210, 250, 300];

// Default configurations for node types
const NODE_DEFAULTS = {
  source: {
    name: "Power Grid Feed",
    params: { scc: 25 } // Short circuit capacity (kA)
  },
  busbar: {
    name: "Main MCC Busbar",
    params: { material: "Cu", rating: 800 } // Amps
  },
  breaker: {
    name: "Feeder MCCB",
    params: { autoSize: true, selectedRating: 32 }
  },
  dol: {
    name: "DOL Starter Pack",
    params: { contactorRating: 18, overloadMin: 9, overloadMax: 13, setting: 11.5 }
  },
  vfd: {
    name: "VFD Drive",
    params: { duty: "heavy", autoSize: true, ratedCurrent: 25, freqMax: 50 }
  },
  softstarter: {
    name: "Soft Starter Unit",
    params: { autoSize: true, currentLimit: 3.5, ratedCurrent: 30 } // Current limit as multiplier of FLA
  },
  motor: {
    name: "Conveyor Motor",
    params: { power: 11, unit: "kW", efficiency: 89, pf: 0.82 }
  }
};

// ==========================================================================
// 2. Initialization & SVG Setups
// ==========================================================================

// Register with Global Project Manager (for auth saving/loading)
window.projectManagerConfig = {
  toolId: "mcc-feeder-designer",
  getInputs: () => ({
    systemGlobals,
    nodes,
    wires
  }),
  setInputs: (data) => {
    if (data) {
      systemGlobals = data.systemGlobals || systemGlobals;
      nodes = data.nodes || [];
      wires = data.wires || [];
      
      // Sync UI globals input elements
      const volEl = document.getElementById("sys-voltage");
      const frqEl = document.getElementById("sys-freq");
      const pfEl = document.getElementById("sys-pf-target");
      if (volEl) volEl.value = systemGlobals.voltage;
      if (frqEl) frqEl.value = systemGlobals.frequency;
      if (pfEl) pfEl.value = systemGlobals.pfTarget;
      
      deselectAll();
      renderCanvas();
      updateStatus("Project loaded successfully.");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initSVGCanvas();
  setupEventListeners();
  loadInitialState();
  
  // Trigger Lucide icons replacing
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});

const svg = document.getElementById("schematic-canvas");
const viewport = document.getElementById("svg-viewport");
const contentGroup = document.getElementById("canvas-content-group");
const wiresLayer = document.getElementById("wires-layer");
const nodesLayer = document.getElementById("nodes-layer");
const dragWireLine = document.getElementById("drag-wire-line");

function initSVGCanvas() {
  // Center grid at start
  const rect = viewport.getBoundingClientRect();
  panX = rect.width / 2 - 250;
  panY = 80;
  updateTransform();
}

function updateTransform() {
  contentGroup.setAttribute("transform", `translate(${panX}, ${panY}) scale(${zoomLevel})`);
}

function setupEventListeners() {
  // SVG Workspace panning and dragging
  viewport.addEventListener("mousedown", onCanvasMouseDown);
  window.addEventListener("mousemove", onCanvasMouseMove);
  window.addEventListener("mouseup", onCanvasMouseUp);
  
  // Zoom on scroll
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    zoomCanvas(zoomFactor);
  }, { passive: false });

  // Keybindings for Delete
  window.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      // Don't trigger deletion if user is typing inside an input/select
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT") {
        return;
      }
      deleteSelectedElement();
    }
  });
}

function updateGlobals() {
  systemGlobals.voltage = parseFloat(document.getElementById("sys-voltage").value) || 400;
  systemGlobals.frequency = parseFloat(document.getElementById("sys-freq").value) || 50;
  systemGlobals.pfTarget = parseFloat(document.getElementById("sys-pf-target").value) || 0.85;
  
  recalculateSystem();
  renderCanvas();
  if (selectedElementId) {
    showInspector(selectedElementId, selectedElementType);
  }
  updateStatus("System configurations updated.");
}

function updateStatus(text) {
  const statusEl = document.getElementById("canvas-status");
  if (statusEl) {
    statusEl.textContent = "Status: " + text;
  }
}

// ==========================================================================
// 3. Canvas Node/Wire Insertion
// ==========================================================================

function addNodeToCanvas(type) {
  const id = "node_" + Math.random().toString(36).substr(2, 9);
  
  // Position the node roughly in the visible center of the canvas viewport
  const rect = viewport.getBoundingClientRect();
  
  // Calculate relative coords accounting for pan & zoom
  const targetX = Math.round(((rect.width / 2) - panX) / zoomLevel / 20) * 20;
  const targetY = Math.round(((rect.height / 2) - panY) / zoomLevel / 20) * 20;

  const newNode = {
    id: id,
    type: type,
    x: targetX,
    y: targetY,
    name: NODE_DEFAULTS[type].name + " " + (nodes.filter(n => n.type === type).length + 1),
    params: JSON.parse(JSON.stringify(NODE_DEFAULTS[type].params))
  };

  nodes.push(newNode);
  
  recalculateSystem();
  renderCanvas();
  selectElement(id, 'node');
  
  updateStatus(`Added ${type.toUpperCase()} component.`);
}

function clearCanvas() {
  if (confirm("Are you sure you want to clear the entire schematic canvas?")) {
    nodes = [];
    wires = [];
    deselectAll();
    renderCanvas();
    updateStatus("Workspace cleared.");
  }
}

// ==========================================================================
// 4. Drag & Drop & Pan Input Handlers
// ==========================================================================

function getSVGCoords(e) {
  const rect = svg.getBoundingClientRect();
  const clientX = e.clientX - rect.left;
  const clientY = e.clientY - rect.top;
  // Convert window coords to scaled/panned canvas space
  const x = (clientX - panX) / zoomLevel;
  const y = (clientY - panY) / zoomLevel;
  return { x, y };
}

function onCanvasMouseDown(e) {
  const target = e.target;
  
  // Case C: Clicked a Terminal Dot (Start drawing a wire) - MUST check first to avoid node-group shadow
  const terminalEl = target.closest(".terminal-dot");
  if (terminalEl) {
    e.stopPropagation();
    const nodeId = terminalEl.getAttribute("data-node-id");
    const terminalType = terminalEl.getAttribute("data-type");
    
    if (terminalType === "output") {
      activeWireStartNode = nodeId;
      activeWireTerminalType = terminalType;
      
      const nodeData = nodes.find(n => n.id === nodeId);
      const startPt = getTerminalPosition(nodeData, "output");
      
      dragWireLine.setAttribute("x1", startPt.x);
      dragWireLine.setAttribute("y1", startPt.y);
      dragWireLine.setAttribute("x2", startPt.x);
      dragWireLine.setAttribute("y2", startPt.y);
      dragWireLine.setAttribute("visibility", "visible");
    }
    return;
  }
  
  // Case A: Clicked on a Node group or its children
  const nodeEl = target.closest(".node-group");
  if (nodeEl) {
    e.stopPropagation();
    const nodeId = nodeEl.getAttribute("data-node-id");
    draggedNodeId = nodeId;
    hasMovedDuringDrag = false;
    
    const nodeData = nodes.find(n => n.id === nodeId);
    const coords = getSVGCoords(e);
    
    dragOffsetX = coords.x - nodeData.x;
    dragOffsetY = coords.y - nodeData.y;
    
    selectElement(nodeId, 'node');
    return;
  }
  
  // Case B: Clicked on a Wire
  const wireEl = target.closest(".wire-path");
  if (wireEl) {
    e.stopPropagation();
    const wireId = wireEl.getAttribute("data-wire-id");
    selectElement(wireId, 'wire');
    return;
  }
  
  // Case D: Dragged background - perform Pan
  if (target.id === "canvas-bg" || target.id === "schematic-canvas" || target.closest("#canvas-bg")) {
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    deselectAll();
  }
}

function onCanvasMouseMove(e) {
  // Handle Panning
  if (isPanning) {
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateTransform();
    return;
  }

  // Handle Dragging Node
  if (draggedNodeId) {
    hasMovedDuringDrag = true;
    const coords = getSVGCoords(e);
    const nodeData = nodes.find(n => n.id === draggedNodeId);
    
    // Snap to 20px grid
    let newX = Math.round((coords.x - dragOffsetX) / 20) * 20;
    let newY = Math.round((coords.y - dragOffsetY) / 20) * 20;
    
    nodeData.x = newX;
    nodeData.y = newY;
    
    renderCanvas();
    return;
  }

  // Handle Drawing Wire Line Preview
  if (activeWireStartNode) {
    const coords = getSVGCoords(e);
    dragWireLine.setAttribute("x2", coords.x);
    dragWireLine.setAttribute("y2", coords.y);
  }
}

function onCanvasMouseUp(e) {
  // End panning
  if (isPanning) {
    isPanning = false;
    return;
  }

  // End dragging node
  if (draggedNodeId) {
    if (hasMovedDuringDrag) {
      recalculateSystem();
      renderCanvas();
      if (selectedElementId === draggedNodeId) {
        showInspector(draggedNodeId, 'node');
      }
    }
    draggedNodeId = null;
    return;
  }

  // End drawing wire
  if (activeWireStartNode) {
    const target = e.target;
    const terminalEl = target.closest(".terminal-dot");
    
    if (terminalEl) {
      const destNodeId = terminalEl.getAttribute("data-node-id");
      const terminalType = terminalEl.getAttribute("data-type");
      
      // If released on the same node's output terminal, we treat it as click-to-click.
      // Do not clear the active state or hide the preview line.
      if (destNodeId === activeWireStartNode && terminalType === "output") {
        updateStatus("Drawing cable... Click an input terminal to connect.");
        return;
      }
      
      // Connection attempt to input terminal
      if (terminalType === "input" && destNodeId !== activeWireStartNode) {
        const alreadyConnected = wires.some(w => w.fromNode === activeWireStartNode && w.toNode === destNodeId);
        
        if (!alreadyConnected) {
          const wireId = "wire_" + Math.random().toString(36).substr(2, 9);
          
          wires.push({
            id: wireId,
            fromNode: activeWireStartNode,
            toNode: destNodeId,
            params: {
              length: 30, // meters default
              material: "Cu", // Copper default
              insulation: "XLPE",
              routing: "Tray",
              ambientTemp: 30,
              groupingFactor: 1.0,
              selectedSize: "Auto" // Auto-select size
            }
          });
          
          recalculateSystem();
          renderCanvas();
          selectElement(wireId, 'wire');
          updateStatus("Connected components with a cable.");
        } else {
          updateStatus("Connection already exists.");
        }
        
        dragWireLine.setAttribute("visibility", "hidden");
        activeWireStartNode = null;
      } else {
        updateStatus("Invalid connection. Must connect output to input.");
        dragWireLine.setAttribute("visibility", "hidden");
        activeWireStartNode = null;
      }
    } else {
      // Released on empty canvas
      dragWireLine.setAttribute("visibility", "hidden");
      activeWireStartNode = null;
      updateStatus("Cable routing cancelled.");
    }
  }
}

function getTerminalPosition(node, type) {
  // Node standard box: width=80, height=50, centered at (x, y)
  // Except busbar: width=120, height=12
  const w = node.type === "busbar" ? 120 : 80;
  const h = node.type === "busbar" ? 12 : 50;
  
  if (type === "input") {
    return { x: node.x, y: node.y - h / 2 };
  } else {
    return { x: node.x, y: node.y + h / 2 };
  }
}

// ==========================================================================
// 5. Canvas Zoom Controls
// ==========================================================================

function zoomCanvas(factor) {
  zoomLevel = Math.max(0.3, Math.min(3.0, zoomLevel * factor));
  updateTransform();
}

function resetZoom() {
  zoomLevel = 1.0;
  initSVGCanvas();
  updateTransform();
}

// ==========================================================================
// 6. Selection & Selection UI Update
// ==========================================================================

function selectElement(id, type) {
  deselectAll();
  selectedElementId = id;
  selectedElementType = type;
  
  if (type === 'node') {
    const el = document.querySelector(`.node-group[data-node-id="${id}"]`);
    if (el) el.classList.add("selected");
  } else if (type === 'wire') {
    const el = document.querySelector(`.wire-path[data-wire-id="${id}"]`);
    if (el) el.classList.add("wire-path-selected");
  }
  
  showInspector(id, type);
}

function deselectAll() {
  selectedElementId = null;
  selectedElementType = null;
  
  document.querySelectorAll(".node-group").forEach(el => el.classList.remove("selected"));
  document.querySelectorAll(".wire-path").forEach(el => el.classList.remove("wire-path-selected"));
  
  hideInspector();
}

function deleteSelectedElement() {
  if (!selectedElementId) return;
  
  if (selectedElementType === 'node') {
    // Delete the node
    nodes = nodes.filter(n => n.id !== selectedElementId);
    // Delete any wires connected to this node
    wires = wires.filter(w => w.fromNode !== selectedElementId && w.toNode !== selectedElementId);
    updateStatus("Deleted component and connected wires.");
  } else if (selectedElementType === 'wire') {
    // Delete the wire
    wires = wires.filter(w => w.id !== selectedElementId);
    updateStatus("Deleted feeder cable.");
  }
  
  deselectAll();
  recalculateSystem();
  renderCanvas();
}

// ==========================================================================
// 7. Inspector Rendering & Forms
// ==========================================================================

function hideInspector() {
  document.getElementById("inspector-empty-state").classList.remove("hidden");
  document.getElementById("inspector-panel-details").classList.add("hidden");
}

function showInspector(id, type) {
  document.getElementById("inspector-empty-state").classList.add("hidden");
  document.getElementById("inspector-panel-details").classList.remove("hidden");
  
  const titleEl = document.getElementById("ins-element-title");
  const badgeEl = document.getElementById("ins-element-badge");
  const fieldsContainer = document.getElementById("ins-form-fields");
  const resultsContainer = document.getElementById("ins-results-content");
  
  fieldsContainer.innerHTML = "";
  resultsContainer.innerHTML = "";
  
  if (type === 'node') {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    
    titleEl.textContent = node.name;
    badgeEl.textContent = node.type.toUpperCase();
    
    // Core parameters form
    let formHTML = `
      <div class="form-group">
        <label>Label Name</label>
        <input type="text" value="${node.name}" oninput="updateNodeName('${node.id}', this.value)">
      </div>
    `;
    
    if (node.type === "motor") {
      formHTML += `
        <div class="form-group">
          <label>Power Rating</label>
          <div style="display:flex; gap:8px;">
            <input type="number" step="0.1" value="${node.params.power}" onchange="updateNodeParam('${node.id}', 'power', this.value)" style="flex:1;">
            <select onchange="updateNodeParam('${node.id}', 'unit', this.value)" style="width:70px;">
              <option value="kW" ${node.params.unit === 'kW' ? 'selected' : ''}>kW</option>
              <option value="HP" ${node.params.unit === 'HP' ? 'selected' : ''}>HP</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Efficiency (%)</label>
          <input type="number" min="50" max="99" value="${node.params.efficiency}" onchange="updateNodeParam('${node.id}', 'efficiency', this.value)">
        </div>
        <div class="form-group">
          <label>Power Factor (cos φ)</label>
          <input type="number" min="0.5" max="1" step="0.01" value="${node.params.pf}" onchange="updateNodeParam('${node.id}', 'pf', this.value)">
        </div>
      `;
      
      // Calculations display
      const fla = calculateMotorFLA(node);
      const activeKw = node.params.unit === 'kW' ? node.params.power : node.params.power * 0.746;
      
      let resHTML = `
        <div class="result-row">
          <span class="result-label">Full Load Current (FLA):</span>
          <span class="result-val">${fla.toFixed(2)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Active Power (kW):</span>
          <span class="result-val">${activeKw.toFixed(1)} kW</span>
        </div>
        <div class="result-row">
          <span class="result-label">Apparent Power (kVA):</span>
          <span class="result-val">${(activeKw / (node.params.pf * (node.params.efficiency/100))).toFixed(1)} kVA</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;
      
    } else if (node.type === "vfd") {
      formHTML += `
        <div class="form-group">
          <label>Duty Rating</label>
          <select onchange="updateNodeParam('${node.id}', 'duty', this.value)">
            <option value="normal" ${node.params.duty === 'normal' ? 'selected' : ''}>Normal Duty (Pumps/Fans)</option>
            <option value="heavy" ${node.params.duty === 'heavy' ? 'selected' : ''}>Heavy Duty (Conveyor/Crusher)</option>
          </select>
        </div>
        <div class="form-group">
          <label>VFD Output Current Selection</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="vfd-autosize-sel" onchange="toggleNodeAutosize('${node.id}', this.value)" style="width:100px;">
              <option value="auto" ${node.params.autoSize ? 'selected' : ''}>Auto-Size</option>
              <option value="manual" ${!node.params.autoSize ? 'selected' : ''}>Manual</option>
            </select>
            <input type="number" value="${node.params.ratedCurrent}" ${node.params.autoSize ? 'disabled' : ''} onchange="updateNodeParam('${node.id}', 'ratedCurrent', this.value)" style="flex:1;">
            <span>A</span>
          </div>
        </div>
      `;
      
      // Calculate drive load requirement
      const stats = getConnectedBranchStats(node.id);
      const reqCurrent = stats.totalFLA;
      const vfdSize = node.params.autoSize ? selectVfdSize(reqCurrent) : node.params.ratedCurrent;
      
      const thermalLoss = calculateVfdLoss(vfdSize, reqCurrent);
      
      let statusClass = "status-ok";
      let statusText = "Compliant";
      if (vfdSize < reqCurrent) {
        statusClass = "status-fail";
        statusText = "Undersized VFD";
      }
      
      let resHTML = `
        <div class="result-row">
          <span class="result-label">Branch Motor Load (FLA):</span>
          <span class="result-val">${reqCurrent.toFixed(2)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Recommended VFD Current:</span>
          <span class="result-val">${(reqCurrent * 1.0).toFixed(1)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Assigned VFD Capacity:</span>
          <span class="result-val">${vfdSize} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Estimated Heat Loss (W):</span>
          <span class="result-val">${thermalLoss.toFixed(0)} W</span>
        </div>
        <div class="result-row">
          <span class="result-label">VFD Sizing Status:</span>
          <span class="result-val ${statusClass}">${statusText}</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;
      
    } else if (node.type === "dol") {
      // Direct-On-Line Contactor & Overload selection
      const stats = getConnectedBranchStats(node.id);
      const reqCurrent = stats.totalFLA;
      const contactorRating = selectContactorSize(reqCurrent);
      
      let resHTML = `
        <div class="result-row">
          <span class="result-label">Contactor AC-3 Rating:</span>
          <span class="result-val">${contactorRating} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Overload Relay Range:</span>
          <span class="result-val">${(reqCurrent * 0.9).toFixed(1)} - ${(reqCurrent * 1.15).toFixed(1)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Thermal Overload Setting:</span>
          <span class="result-val">${reqCurrent.toFixed(2)} A</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;
      
    } else if (node.type === "softstarter") {
      formHTML += `
        <div class="form-group">
          <label>Starting Current Limit</label>
          <input type="number" step="0.5" min="1.5" max="5.0" value="${node.params.currentLimit}" onchange="updateNodeParam('${node.id}', 'currentLimit', this.value)">
          <span class="section-desc">Times motor full load current (FLA)</span>
        </div>
        <div class="form-group">
          <label>Soft Starter Sizing</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="ss-autosize-sel" onchange="toggleNodeAutosize('${node.id}', this.value)" style="width:100px;">
              <option value="auto" ${node.params.autoSize ? 'selected' : ''}>Auto-Size</option>
              <option value="manual" ${!node.params.autoSize ? 'selected' : ''}>Manual</option>
            </select>
            <input type="number" value="${node.params.ratedCurrent}" ${node.params.autoSize ? 'disabled' : ''} onchange="updateNodeParam('${node.id}', 'ratedCurrent', this.value)" style="flex:1;">
            <span>A</span>
          </div>
        </div>
      `;
      
      const stats = getConnectedBranchStats(node.id);
      const reqCurrent = stats.totalFLA;
      const ssSize = node.params.autoSize ? selectSoftStarterSize(reqCurrent) : node.params.ratedCurrent;
      
      let statusClass = "status-ok";
      let statusText = "Compliant";
      if (ssSize < reqCurrent) {
        statusClass = "status-fail";
        statusText = "Undersized Starter";
      }

      let resHTML = `
        <div class="result-row">
          <span class="result-label">Branch Motor Load (FLA):</span>
          <span class="result-val">${reqCurrent.toFixed(2)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Assigned SS Capacity:</span>
          <span class="result-val">${ssSize} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Peak Inrush Current:</span>
          <span class="result-val">${(reqCurrent * node.params.currentLimit).toFixed(1)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Status:</span>
          <span class="result-val ${statusClass}">${statusText}</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;

    } else if (node.type === "breaker") {
      formHTML += `
        <div class="form-group">
          <label>Breaker Trip Capacity Selection</label>
          <div style="display:flex; gap:8px;">
            <select id="cb-autosize-sel" onchange="toggleNodeAutosize('${node.id}', this.value)" style="width:100px;">
              <option value="auto" ${node.params.autoSize ? 'selected' : ''}>Auto-Size</option>
              <option value="manual" ${!node.params.autoSize ? 'selected' : ''}>Manual</option>
            </select>
            <select onchange="updateNodeParam('${node.id}', 'selectedRating', this.value)" ${node.params.autoSize ? 'disabled' : ''} style="flex:1;">
              ${BREAKER_RATINGS.map(r => `<option value="${r}" ${node.params.selectedRating === r ? 'selected' : ''}>${r} A</option>`).join('')}
            </select>
          </div>
        </div>
      `;
      
      const stats = getConnectedBranchStats(node.id);
      const reqCurrent = stats.totalFLA;
      // Breaker sized at 1.25x load
      const minBreakerRating = reqCurrent * 1.25;
      const autoBreakerRating = selectBreakerSize(minBreakerRating);
      const finalBreakerRating = node.params.autoSize ? autoBreakerRating : node.params.selectedRating;
      
      let statusClass = "status-ok";
      let statusText = "Compliant";
      if (finalBreakerRating < reqCurrent) {
        statusClass = "status-fail";
        statusText = "Overloaded (Rating < Load)";
      } else if (finalBreakerRating < minBreakerRating) {
        statusClass = "status-warning";
        statusText = "Marginal (Less than 1.25x FLA)";
      }

      let resHTML = `
        <div class="result-row">
          <span class="result-label">Branch Motor Load (FLA):</span>
          <span class="result-val">${reqCurrent.toFixed(2)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Continuous Current Req:</span>
          <span class="result-val">${minBreakerRating.toFixed(1)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Assigned Breaker Rating:</span>
          <span class="result-val">${finalBreakerRating} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Magnetic Trip (Short Circuit):</span>
          <span class="result-val">${(finalBreakerRating * 10).toFixed(0)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Breaker Status:</span>
          <span class="result-val ${statusClass}">${statusText}</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;
      
    } else if (node.type === "busbar") {
      formHTML += `
        <div class="form-group">
          <label>Conductor Material</label>
          <select onchange="updateNodeParam('${node.id}', 'material', this.value)">
            <option value="Cu" ${node.params.material === 'Cu' ? 'selected' : ''}>Copper (Cu)</option>
            <option value="Al" ${node.params.material === 'Al' ? 'selected' : ''}>Aluminum (Al)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Main Busbar Capacity (A)</label>
          <input type="number" step="100" value="${node.params.rating}" onchange="updateNodeParam('${node.id}', 'rating', this.value)">
        </div>
      `;
      
      const stats = getConnectedBranchStats(node.id);
      const totalLoad = stats.totalFLA;
      
      let statusClass = "status-ok";
      let statusText = "Compliant";
      if (node.params.rating < totalLoad) {
        statusClass = "status-fail";
        statusText = "Busbar Overloaded!";
      }

      let resHTML = `
        <div class="result-row">
          <span class="result-label">Total Connected FLA:</span>
          <span class="result-val">${totalLoad.toFixed(1)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Rated Busbar Ampacity:</span>
          <span class="result-val">${node.params.rating} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Diversity / Load Factor:</span>
          <span class="result-val">100%</span>
        </div>
        <div class="result-row">
          <span class="result-label">Thermal Margin:</span>
          <span class="result-val">${(node.params.rating - totalLoad).toFixed(1)} A</span>
        </div>
        <div class="result-row">
          <span class="result-label">Busbar Status:</span>
          <span class="result-val ${statusClass}">${statusText}</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;
      
    } else if (node.type === "source") {
      formHTML += `
        <div class="form-group">
          <label>Short Circuit Capacity (kA)</label>
          <input type="number" step="1" value="${node.params.scc}" onchange="updateNodeParam('${node.id}', 'scc', this.value)">
        </div>
      `;
      
      const stats = getConnectedBranchStats(node.id);
      let resHTML = `
        <div class="result-row">
          <span class="result-label">Available Fault Level:</span>
          <span class="result-val">${node.params.scc} kA</span>
        </div>
        <div class="result-row">
          <span class="result-label">Total Downstream Motors:</span>
          <span class="result-val">${stats.motorCount}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Total Cumulative FLA:</span>
          <span class="result-val">${stats.totalFLA.toFixed(1)} A</span>
        </div>
      `;
      resultsContainer.innerHTML = resHTML;
    }
    
    fieldsContainer.innerHTML = formHTML;
    
  } else if (type === 'wire') {
    const wire = wires.find(w => w.id === id);
    if (!wire) return;
    
    titleEl.textContent = "Feeder Cable";
    badgeEl.textContent = "CABLE";
    
    const isNEC = systemGlobals.standard === "NEC";
    const list = isNEC
      ? (wire.params.material === "Cu" ? NEC_COPPER_AMPACITIES : NEC_ALUMINUM_AMPACITIES)
      : (wire.params.material === "Cu" ? COPPER_AMPACITIES : ALUMINUM_AMPACITIES);
    const parallelRuns = wire.params.parallelRuns || 1;
    
    // Core parameters form
    let formHTML = `
      <div class="form-group">
        <label>Conductor Material</label>
        <select onchange="updateWireParam('${wire.id}', 'material', this.value)">
          <option value="Cu" ${wire.params.material === 'Cu' ? 'selected' : ''}>Copper (Cu)</option>
          <option value="Al" ${wire.params.material === 'Al' ? 'selected' : ''}>Aluminum (Al)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Parallel Runs</label>
        <select onchange="updateWireParam('${wire.id}', 'parallelRuns', parseInt(this.value))">
          <option value="1" ${parallelRuns === 1 ? 'selected' : ''}>1 Conductor/Phase</option>
          <option value="2" ${parallelRuns === 2 ? 'selected' : ''}>2 Parallel Runs</option>
          <option value="3" ${parallelRuns === 3 ? 'selected' : ''}>3 Parallel Runs</option>
          <option value="4" ${parallelRuns === 4 ? 'selected' : ''}>4 Parallel Runs</option>
        </select>
      </div>
      <div class="form-group">
        <label>Insulation Type</label>
        <select onchange="updateWireParam('${wire.id}', 'insulation', this.value)">
          <option value="XLPE" ${wire.params.insulation === 'XLPE' ? 'selected' : ''}>XLPE (90°C Rated)</option>
          <option value="PVC" ${wire.params.insulation === 'PVC' ? 'selected' : ''}>PVC (70°C Rated)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Cable Routing Installation</label>
        <select onchange="updateWireParam('${wire.id}', 'routing', this.value)">
          <option value="Tray" ${wire.params.routing === 'Tray' ? 'selected' : ''}>Perforated Cable Tray</option>
          <option value="Conduit" ${wire.params.routing === 'Conduit' ? 'selected' : ''}>Conduit in Wall/Ground</option>
          <option value="Air" ${wire.params.routing === 'Air' ? 'selected' : ''}>Free Air / Bracket</option>
        </select>
      </div>
      <div class="form-group">
        <label>Cable Length (meters)</label>
        <input type="number" min="1" max="1000" value="${wire.params.length}" onchange="updateWireParam('${wire.id}', 'length', this.value)">
      </div>
      <div class="form-group">
        <label>Ambient Temperature (°C)</label>
        <input type="number" min="10" max="60" value="${wire.params.ambientTemp}" onchange="updateWireParam('${wire.id}', 'ambientTemp', this.value)">
      </div>
      <div class="form-group">
        <label>Grouping Derating Factor</label>
        <input type="number" step="0.05" min="0.1" max="1.0" value="${wire.params.groupingFactor}" onchange="updateWireParam('${wire.id}', 'groupingFactor', this.value)">
      </div>
      <div class="form-group">
        <label>Conductor Area Sizing</label>
        <div style="display:flex; gap:8px;">
          <select id="wire-sizing-mode" onchange="toggleWireAutosize('${wire.id}', this.value)" style="width:100px;">
            <option value="Auto" ${wire.params.selectedSize === 'Auto' ? 'selected' : ''}>Auto-Size</option>
            <option value="Manual" ${wire.params.selectedSize !== 'Auto' ? 'selected' : ''}>Manual</option>
          </select>
          <select id="wire-manual-size" onchange="updateWireParam('${wire.id}', 'selectedSize', this.value)" ${wire.params.selectedSize === 'Auto' ? 'disabled' : ''} style="flex:1;">
            ${list.map(a => {
              const selected = wire.params.selectedSize === "Auto" 
                ? false 
                : (isNEC ? wire.params.selectedSize === a.size : parseFloat(wire.params.selectedSize) === a.size);
              return `<option value="${a.size}" ${selected ? 'selected' : ''}>${a.size}${isNEC ? '' : ' mm²'}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    `;
    
    fieldsContainer.innerHTML = formHTML;
    
    // Run wire sizing and voltage drop calculation
    const calc = calculateWireSizing(wire);
    
    let sizeStatusClass = "status-ok";
    if (calc.sizingError) {
      sizeStatusClass = "status-fail";
    }
    
    let vdStatusClass = "status-ok";
    if (calc.vdPct > 3.0) {
      vdStatusClass = "status-fail";
    } else if (calc.vdPct > 2.0) {
      vdStatusClass = "status-warning";
    }

    let resHTML = `
      <div class="result-row">
        <span class="result-label">Continuous Load Current:</span>
        <span class="result-val">${calc.loadCurrent.toFixed(2)} A</span>
      </div>
      <div class="result-row">
        <span class="result-label">Continuous Design Req (1.25x):</span>
        <span class="result-val">${(calc.loadCurrent * 1.25).toFixed(2)} A</span>
      </div>
      <div class="result-row">
        <span class="result-label">Derating multiplier (Temp/Group):</span>
        <span class="result-val">${calc.deratingFactor.toFixed(2)}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Min Raw Capacity Req (per conductor):</span>
        <span class="result-val">${(calc.minBaseAmpacity / calc.parallelRuns).toFixed(1)} A</span>
      </div>
      <div class="result-row">
        <span class="result-label">Recommended Cable Size:</span>
        <span class="result-val ${sizeStatusClass}">${calc.resolvedSize}${isNEC ? '' : ' mm²'}${calc.parallelRuns > 1 ? ' (' + calc.parallelRuns + 'x parallel)' : ''}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Selected Size Ampacity (base):</span>
        <span class="result-val">${calc.baseAmpacity} A</span>
      </div>
      <div class="result-row">
        <span class="result-label">Total Bundle Ampacity (derated):</span>
        <span class="result-val">${calc.deratedAmpacity.toFixed(1)} A</span>
      </div>
      <div class="result-row">
        <span class="result-label">Voltage Drop:</span>
        <span class="result-val">${calc.vdVolt.toFixed(2)} V</span>
      </div>
      <div class="result-row">
        <span class="result-label">Voltage Drop Percentage:</span>
        <span class="result-val ${vdStatusClass}">${calc.vdPct.toFixed(2)} %</span>
      </div>
    `;
    resultsContainer.innerHTML = resHTML;
  }
}

function updateNodeName(nodeId, newName) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    node.name = newName;
    
    // Update node label inside SVG
    const textEl = document.querySelector(`.node-group[data-node-id="${nodeId}"] text.node-label`);
    if (textEl) {
      textEl.textContent = newName;
    }
  }
}

function updateNodeParam(nodeId, paramKey, val) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    // Convert numeric strings to numbers
    const numVal = parseFloat(val);
    node.params[paramKey] = isNaN(numVal) ? val : numVal;
    
    recalculateSystem();
    renderCanvas();
    showInspector(nodeId, 'node');
  }
}

function toggleNodeAutosize(nodeId, val) {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    node.params.autoSize = (val === "auto");
    
    recalculateSystem();
    renderCanvas();
    showInspector(nodeId, 'node');
  }
}

function updateWireParam(wireId, paramKey, val) {
  const wire = wires.find(w => w.id === wireId);
  if (wire) {
    // Convert numeric strings to numbers
    const numVal = parseFloat(val);
    wire.params[paramKey] = isNaN(numVal) ? val : numVal;
    
    recalculateSystem();
    renderCanvas();
    showInspector(wireId, 'wire');
  }
}

function toggleWireAutosize(wireId, val) {
  const wire = wires.find(w => w.id === wireId);
  if (wire) {
    if (val === "Auto") {
      wire.params.selectedSize = "Auto";
    } else {
      wire.params.selectedSize = "4"; // Default fallback manual size
    }
    
    recalculateSystem();
    renderCanvas();
    showInspector(wireId, 'wire');
  }
}

// ==========================================================================
// 8. Engineering Calculations & Solvers
// ==========================================================================

function getNECMotorFLA(hp, voltage) {
  // Table values for 460V, 3-Phase induction motors:
  const hpTable = {
    0.5: 1.1, 0.75: 1.6, 1: 2.1, 1.5: 3.0, 2: 3.4, 3: 4.8, 5: 7.6,
    7.5: 11.0, 10: 14.0, 15: 21.0, 20: 27.0, 25: 34.0, 30: 40.0,
    40: 52.0, 50: 65.0, 60: 77.0, 75: 96.0, 100: 124.0, 125: 156.0,
    150: 180.0, 200: 240.0
  };
  
  // Find closest match or linear scaling
  let baseFLA = 2.1; // default for 1 HP
  const hps = Object.keys(hpTable).map(Number).sort((a,b)=>a-b);
  if (hpTable[hp]) {
    baseFLA = hpTable[hp];
  } else {
    // Find closest match
    let closest = hps[0];
    for (const h of hps) {
      if (Math.abs(h - hp) < Math.abs(closest - hp)) {
        closest = h;
      }
    }
    baseFLA = hpTable[closest] * (hp / closest); // scaling
  }
  // Scale by voltage (inverse ratio relative to 460V)
  return baseFLA * (460 / voltage);
}

function calculateMotorFLA(motor) {
  const eff = motor.params.efficiency / 100;
  const pf = motor.params.pf;
  const V = systemGlobals.voltage;
  
  if (systemGlobals.standard === "NEC") {
    let hp = motor.params.power;
    if (motor.params.unit === "kW") {
      hp = hp / 0.7457; // convert kW to HP for NEC lookup
    }
    return getNECMotorFLA(hp, V);
  } else {
    // IEC standard
    let powerkW = motor.params.power;
    if (motor.params.unit === "HP") {
      powerkW = powerkW * 0.7457; // HP to kW
    }
    return (powerkW * 1000) / (Math.sqrt(3) * V * eff * pf);
  }
}

// Find downstream statistics (motors, total FLA) for a node
function getConnectedBranchStats(startNodeId) {
  let visited = new Set();
  let queue = [startNodeId];
  let totalFLA = 0;
  let motorCount = 0;
  
  while (queue.length > 0) {
    const currId = queue.shift();
    if (visited.has(currId)) continue;
    visited.add(currId);
    
    const node = nodes.find(n => n.id === currId);
    if (!node) continue;
    
    if (node.type === "motor") {
      totalFLA += calculateMotorFLA(node);
      motorCount++;
    }
    
    // Find all outgoing wires from this node
    const downstreamWires = wires.filter(w => w.fromNode === currId);
    for (const w of downstreamWires) {
      if (!visited.has(w.toNode)) {
        queue.push(w.toNode);
      }
    }
  }
  
  return {
    totalFLA,
    motorCount
  };
}

// Standard sizing lookups
function selectVfdSize(amps) {
  for (const v of VFD_RATINGS) {
    if (v.rating >= amps) return v.rating;
  }
  return VFD_RATINGS[VFD_RATINGS.length - 1].rating; // fallback to max
}

function calculateVfdLoss(vfdAmps, loadAmps) {
  // Approximate VFD losses as 2.5% of running load capacity plus static losses
  const pf = systemGlobals.pfTarget;
  const v = systemGlobals.voltage;
  const kw = (Math.sqrt(3) * v * loadAmps * pf) / 1000;
  return kw * 1000 * 0.025 + 50; // W
}

function selectContactorSize(amps) {
  for (const c of CONTACTOR_RATINGS) {
    if (c >= amps) return c;
  }
  return CONTACTOR_RATINGS[CONTACTOR_RATINGS.length - 1];
}

function selectSoftStarterSize(amps) {
  for (const s of SOFTSTARTER_RATINGS) {
    if (s >= amps) return s;
  }
  return SOFTSTARTER_RATINGS[SOFTSTARTER_RATINGS.length - 1];
}

function selectBreakerSize(amps) {
  for (const b of BREAKER_RATINGS) {
    if (b >= amps) return b;
  }
  return BREAKER_RATINGS[BREAKER_RATINGS.length - 1];
}

function calculateWireSizing(wire) {
  // 1. Get downstream motor load
  const stats = getConnectedBranchStats(wire.toNode);
  const loadCurrent = stats.totalFLA;
  
  // 2. Continuous load sizing multiplier (1.25x load)
  const reqCurrent = loadCurrent * 1.25;
  const parallelRuns = wire.params.parallelRuns || 1;
  
  // 3. Compute derating factors
  // Temperature derating: ambient temp reference is 30C
  // XLPE max temp is 90C. PVC max temp is 70C
  const maxTemp = wire.params.insulation === "XLPE" ? 90 : 70;
  let tempFactor = 1.0;
  if (wire.params.ambientTemp > 30) {
    tempFactor = Math.sqrt((maxTemp - wire.params.ambientTemp) / (maxTemp - 30));
    if (isNaN(tempFactor) || tempFactor < 0.1) tempFactor = 0.1;
  }
  
  const grouping = wire.params.groupingFactor || 1.0;
  const deratingFactor = tempFactor * grouping;
  
  // Required ampacity per conductor under standard conditions
  const minBaseAmpacityPerConductor = (reqCurrent / parallelRuns) / deratingFactor;
  
  // 4. Select conductor size list based on standard
  const isNEC = systemGlobals.standard === "NEC";
  const list = isNEC
    ? (wire.params.material === "Cu" ? NEC_COPPER_AMPACITIES : NEC_ALUMINUM_AMPACITIES)
    : (wire.params.material === "Cu" ? COPPER_AMPACITIES : ALUMINUM_AMPACITIES);
    
  let resolvedSize = isNEC ? list[0].size : list[0].size;
  let baseAmpacity = list[0].ampacity;
  let wireArea = isNEC ? list[0].area : list[0].size;
  let sizingError = false;
  
  if (wire.params.selectedSize === "Auto") {
    let found = false;
    for (const item of list) {
      if (item.ampacity >= minBaseAmpacityPerConductor) {
        resolvedSize = item.size;
        baseAmpacity = item.ampacity;
        wireArea = isNEC ? item.area : item.size;
        found = true;
        break;
      }
    }
    
    if (!found) {
      const largest = list[list.length - 1];
      resolvedSize = largest.size;
      baseAmpacity = largest.ampacity;
      wireArea = isNEC ? largest.area : largest.size;
      sizingError = true;
    }
  } else {
    // Manual size selection
    const manualVal = wire.params.selectedSize;
    let item = null;
    if (isNEC) {
      item = list.find(x => x.size === manualVal);
    } else {
      item = list.find(x => x.size === parseFloat(manualVal));
    }
    if (item) {
      resolvedSize = item.size;
      baseAmpacity = item.ampacity;
      wireArea = isNEC ? item.area : item.size;
    } else {
      resolvedSize = list[0].size;
      baseAmpacity = list[0].ampacity;
      wireArea = isNEC ? list[0].area : list[0].size;
    }
  }
  
  const deratedAmpacity = baseAmpacity * deratingFactor * parallelRuns;
  if (deratedAmpacity < reqCurrent) {
    sizingError = true;
  }
  
  // 5. Voltage Drop Calculations
  // Resistivity at standard operating temperature (~75°C)
  // Cu = 0.0225 ohm.mm2/m, Al = 0.036 ohm.mm2/m
  const rho = wire.params.material === "Cu" ? 0.0225 : 0.036;
  const R = ((rho * wire.params.length) / wireArea) / parallelRuns; // Ohm per phase
  
  // Approximate reactance per phase for multicore cables (typically 0.08 ohm/km = 0.00008 ohm/m)
  const X = (0.00008 * wire.params.length) / parallelRuns; // Ohm per phase
  
  // Use average motor power factor (approx 0.85 if no motor is connected, otherwise search for motor)
  let pf = 0.85;
  const destNode = nodes.find(n => n.id === wire.toNode);
  if (destNode && destNode.type === "motor") {
    pf = destNode.params.pf;
  }
  const sinPhi = Math.sqrt(1 - pf * pf);
  
  // 3-Phase voltage drop formula
  const vdVolt = Math.sqrt(3) * loadCurrent * (R * pf + X * sinPhi);
  const vdPct = (vdVolt / systemGlobals.voltage) * 100;
  
  return {
    loadCurrent,
    deratingFactor,
    minBaseAmpacity: minBaseAmpacityPerConductor * parallelRuns,
    resolvedSize,
    baseAmpacity,
    deratedAmpacity,
    vdVolt,
    vdPct,
    sizingError,
    parallelRuns,
    wireArea
  };
}

// Full check over all wires/cables in system to identify compliance violations
function recalculateSystem() {
  wires.forEach(w => {
    const calc = calculateWireSizing(w);
    w.calculated = calc;
  });
  
  nodes.forEach(n => {
    if (n.type === "breaker") {
      const stats = getConnectedBranchStats(n.id);
      if (n.params.autoSize) {
        n.params.selectedRating = selectBreakerSize(stats.totalFLA * 1.25);
      }
    } else if (n.type === "vfd") {
      const stats = getConnectedBranchStats(n.id);
      if (n.params.autoSize) {
        n.params.ratedCurrent = selectVfdSize(stats.totalFLA);
      }
    } else if (n.type === "softstarter") {
      const stats = getConnectedBranchStats(n.id);
      if (n.params.autoSize) {
        n.params.ratedCurrent = selectSoftStarterSize(stats.totalFLA);
      }
    }
  });
}

// ==========================================================================
// 9. Schematic Rendering (SVGs Drawing Generator)
// ==========================================================================

function renderCanvas() {
  // Clear previous drawings
  wiresLayer.innerHTML = "";
  nodesLayer.innerHTML = "";
  
  // 1. Draw Wires / Cables
  wires.forEach(w => {
    const fromNode = nodes.find(n => n.id === w.fromNode);
    const toNode = nodes.find(n => n.id === w.toNode);
    
    if (fromNode && toNode) {
      const startPt = getTerminalPosition(fromNode, "output");
      const endPt = getTerminalPosition(toNode, "input");
      
      // Calculate Orthogonal Routing Path (to keep drawings looking neat and blocky)
      // Path goes: Start -> Down a bit -> Horizontally -> Down to end
      const midY = startPt.y + (endPt.y - startPt.y) / 2;
      const pathData = `M ${startPt.x} ${startPt.y} L ${startPt.x} ${midY} L ${endPt.x} ${midY} L ${endPt.x} ${endPt.y}`;
      
      const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathEl.setAttribute("d", pathData);
      
      let isViolating = (w.calculated && (w.calculated.vdPct > 3.0 || w.calculated.sizingError));
      
      let className = "wire-path";
      if (isViolating) className += " violating";
      if (w.id === selectedElementId) className += " wire-path-selected";
      
      pathEl.setAttribute("class", className);
      pathEl.setAttribute("data-wire-id", w.id);
      
      // Click selection
      pathEl.addEventListener("click", (e) => {
        e.stopPropagation();
        selectElement(w.id, 'wire');
      });
      
      wiresLayer.appendChild(pathEl);
      
      // Draw a cable label marker at the horizontal segment
      const midX = startPt.x + (endPt.x - startPt.x) / 2;
      const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textEl.setAttribute("x", midX);
      textEl.setAttribute("y", midY - 6);
      textEl.setAttribute("font-size", "7");
      textEl.setAttribute("fill", isViolating ? "var(--color-error)" : "var(--text-muted)");
      textEl.setAttribute("font-family", "var(--font-mono)");
      textEl.setAttribute("text-anchor", "middle");
      
      const isNEC = systemGlobals.standard === "NEC";
      const runsStr = (w.calculated && w.calculated.parallelRuns > 1) ? `${w.calculated.parallelRuns}x ` : "";
      const sizeStr = w.calculated ? runsStr + w.calculated.resolvedSize + (isNEC ? "" : " mm²") : "";
      const lenStr = w.params.length + "m";
      textEl.textContent = `${sizeStr} (${lenStr})`;
      
      wiresLayer.appendChild(textEl);
    }
  });
  
  // 2. Draw Component Nodes
  nodes.forEach(n => {
    const nodeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodeG.setAttribute("class", "node-group" + (n.id === selectedElementId ? " selected" : ""));
    nodeG.setAttribute("data-node-id", n.id);
    nodeG.setAttribute("transform", `translate(${n.x}, ${n.y})`);
    
    // Core Dimensions
    const w = n.type === "busbar" ? 120 : 80;
    const h = n.type === "busbar" ? 12 : 50;
    
    // Main boundary box
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", -w / 2);
    rect.setAttribute("y", -h / 2);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("class", "node-rect");
    nodeG.appendChild(rect);
    
    // Specific symbol drawing inside the box
    drawNodeSymbol(nodeG, n, w, h);
    
    // Draw Name text
    const textName = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textName.setAttribute("x", 0);
    textName.setAttribute("y", n.type === "busbar" ? 4 : h / 2 - 16);
    textName.setAttribute("class", "node-label");
    textName.textContent = n.name;
    nodeG.appendChild(textName);
    
    // Draw Sublabel details (current sizing)
    const textSub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textSub.setAttribute("x", 0);
    textSub.setAttribute("y", h / 2 - 6);
    textSub.setAttribute("class", "node-sublabel");
    
    let subStr = "";
    if (n.type === "motor") {
      subStr = `${n.params.power} ${n.params.unit}`;
    } else if (n.type === "vfd") {
      subStr = `${n.params.ratedCurrent}A VFD`;
    } else if (n.type === "softstarter") {
      subStr = `${n.params.ratedCurrent}A SoftS`;
    } else if (n.type === "breaker") {
      subStr = `${n.params.selectedRating}A MCCB`;
    } else if (n.type === "busbar") {
      subStr = `${n.params.rating}A ${n.params.material}`;
    }
    
    textSub.textContent = subStr;
    nodeG.appendChild(textSub);
    
    // Draw Terminal Dots
    // Inputs (Blue dot at top)
    if (n.type !== "source") {
      const dotIn = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dotIn.setAttribute("cx", 0);
      dotIn.setAttribute("cy", -h / 2);
      dotIn.setAttribute("r", "4");
      dotIn.setAttribute("class", "terminal-dot input");
      dotIn.setAttribute("data-node-id", n.id);
      dotIn.setAttribute("data-type", "input");
      nodeG.appendChild(dotIn);
    }
    
    // Outputs (Green dot at bottom)
    if (n.type !== "motor") {
      const dotOut = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dotOut.setAttribute("cx", 0);
      dotOut.setAttribute("cy", h / 2);
      dotOut.setAttribute("r", "4");
      dotOut.setAttribute("class", "terminal-dot output");
      dotOut.setAttribute("data-node-id", n.id);
      dotOut.setAttribute("data-type", "output");
      nodeG.appendChild(dotOut);
    }
    
    nodesLayer.appendChild(nodeG);
  });
}

function drawNodeSymbol(group, node, width, height) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "node-symbol-path");
  
  if (node.type === "source") {
    // Circle with sine wave
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", 0);
    circle.setAttribute("cy", -5);
    circle.setAttribute("r", 10);
    circle.setAttribute("class", "node-symbol-path");
    group.appendChild(circle);
    
    path.setAttribute("d", "M -6 -5 Q -3 -10 0 -5 T 6 -5");
    group.appendChild(path);
    
  } else if (node.type === "breaker") {
    // Switch breaker contact symbol
    path.setAttribute("d", "M 0 -15 L 0 -5 L -8 5 M 0 5 L 0 15");
    group.appendChild(path);
    
  } else if (node.type === "vfd") {
    // Diagonal divided box rectifier/inverter symbols
    path.setAttribute("d", `M ${-width/2} ${-height/2} L ${width/2} ${height/2-18}`); // diagonal
    group.appendChild(path);
    
    const text1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text1.setAttribute("x", -15);
    text1.setAttribute("y", -8);
    text1.setAttribute("font-size", "8");
    text1.setAttribute("fill", "var(--text-primary)");
    text1.textContent = "~";
    group.appendChild(text1);

    const text2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text2.setAttribute("x", 10);
    text2.setAttribute("y", 2);
    text2.setAttribute("font-size", "8");
    text2.setAttribute("fill", "var(--text-primary)");
    text2.textContent = "=";
    group.appendChild(text2);
    
  } else if (node.type === "softstarter") {
    // Thyristor back to back diode symbol representation or "SS"
    path.setAttribute("d", "M -15 -10 L 15 -10 L 0 10 Z");
    path.setAttribute("fill", "none");
    group.appendChild(path);
    
  } else if (node.type === "dol") {
    // Contactor square box + overload representation
    path.setAttribute("d", "M -10 -15 H 10 V -5 H -10 Z M -10 -5 H 10 V 5 H -10 Z");
    group.appendChild(path);
    
  } else if (node.type === "motor") {
    // Circle with "M" inside
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", 0);
    circle.setAttribute("cy", -6);
    circle.setAttribute("r", 12);
    circle.setAttribute("class", "node-symbol-path");
    group.appendChild(circle);
    
    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", 0);
    txt.setAttribute("y", -2);
    txt.setAttribute("font-size", "11");
    txt.setAttribute("font-weight", "bold");
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("fill", "var(--text-primary)");
    txt.textContent = "M 3~";
    group.appendChild(txt);
  }
}

// ==========================================================================
// 10. File Actions: Import, Export, Share Link
// ==========================================================================

function exportJSON() {
  const data = {
    version: "1.0",
    systemGlobals,
    nodes,
    wires
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `mcc-schematic-design-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  updateStatus("Exported schematic JSON.");
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.nodes && data.wires) {
        systemGlobals = data.systemGlobals || systemGlobals;
        nodes = data.nodes;
        wires = data.wires;
        
        // Sync inputs UI
        document.getElementById("sys-voltage").value = systemGlobals.voltage;
        document.getElementById("sys-freq").value = systemGlobals.frequency;
        document.getElementById("sys-pf-target").value = systemGlobals.pfTarget;
        
        deselectAll();
        recalculateSystem();
        renderCanvas();
        updateStatus("Imported schematic design file.");
      } else {
        alert("Invalid file format: missing nodes or wires configuration.");
      }
    } catch (err) {
      alert("Error parsing JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function shareLink() {
  const state = {
    systemGlobals,
    nodes,
    wires
  };
  
  // Serialize state to base64
  const serialized = (window.encodeShareState ? window.encodeShareState(state) : btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
  const url = new URL(window.location.href);
  url.hash = `design=${serialized}`;
  
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert("Shareable design URL copied to clipboard!");
    updateStatus("Sharing link copied.");
  }).catch(err => {
    alert("Could not copy link: " + err);
  });
}

function loadInitialState() {
  // Check URL hash for shared design
  const hash = window.location.hash;
  if (hash.startsWith("#design=")) {
    try {
      const serialized = hash.substring(8);
      const decoded = (window.decodeShareState ? window.decodeShareState(serialized) : JSON.parse(decodeURIComponent(escape(atob(serialized)))));
      if (decoded.nodes && decoded.wires) {
        systemGlobals = decoded.systemGlobals || systemGlobals;
        nodes = decoded.nodes;
        wires = decoded.wires;
        
        // Sync UI inputs
        const stdEl = document.getElementById("sys-standard");
        if (stdEl) stdEl.value = systemGlobals.standard || "IEC";
        
        document.getElementById("sys-voltage").value = systemGlobals.voltage;
        document.getElementById("sys-freq").value = systemGlobals.frequency;
        document.getElementById("sys-pf-target").value = systemGlobals.pfTarget;
        
        recalculateSystem();
        renderCanvas();
        updateStatus("Loaded shared design schematic.");
        return;
      }
    } catch (e) {
      console.error("Failed to decode shared layout: ", e);
    }
  }
  
  // Insert initial default components (Grid Power Source -> Main Busbar) so the user is not greeted by an empty canvas
  nodes = [
    {
      id: "node_source",
      type: "source",
      x: 250,
      y: 60,
      name: "Utility Grid",
      params: { scc: 35 }
    },
    {
      id: "node_busbar",
      type: "busbar",
      x: 250,
      y: 160,
      name: "MCC Main Busbar",
      params: { material: "Cu", rating: 800 }
    }
  ];
  
  wires = [
    {
      id: "wire_main_feed",
      fromNode: "node_source",
      toNode: "node_busbar",
      params: {
        length: 10,
        material: "Cu",
        insulation: "XLPE",
        routing: "Tray",
        ambientTemp: 30,
        groupingFactor: 1.0,
        selectedSize: "Auto",
        parallelRuns: 1
      }
    }
  ];
  
  recalculateSystem();
  renderCanvas();
}

// ==========================================================================
// 11. Advanced Features: Standards (IEC/NEC) & Thermal Stack Sizing
// ==========================================================================

function onStandardChange() {
  const std = document.getElementById("sys-standard").value;
  systemGlobals.standard = std;
  
  const voltSelect = document.getElementById("sys-voltage");
  voltSelect.innerHTML = "";
  
  if (std === "NEC") {
    // Standard NEC / NEMA 3-Phase voltages
    const options = [
      { val: "460", text: "460 V (3Ø)", sel: true },
      { val: "480", text: "480 V (3Ø)" },
      { val: "208", text: "208 V (3Ø)" },
      { val: "230", text: "230 V (3Ø)" },
      { val: "575", text: "575 V (3Ø)" }
    ];
    options.forEach(opt => {
      const el = document.createElement("option");
      el.value = opt.val;
      el.textContent = opt.text;
      if (opt.sel) el.selected = true;
      voltSelect.appendChild(el);
    });
    
    // Auto-update motor units to HP in NEC mode
    nodes.forEach(n => {
      if (n.type === "motor" && n.params.unit === "kW") {
        n.params.unit = "HP";
        n.params.power = Math.round((n.params.power / 0.7457) * 10) / 10;
      }
    });
    
    systemGlobals.voltage = 460;
  } else {
    // Standard IEC metric voltages
    const options = [
      { val: "400", text: "400 V (3Ø)", sel: true },
      { val: "415", text: "415 V (3Ø)" },
      { val: "230", text: "230 V (3Ø)" },
      { val: "690", text: "690 V (3Ø)" }
    ];
    options.forEach(opt => {
      const el = document.createElement("option");
      el.value = opt.val;
      el.textContent = opt.text;
      if (opt.sel) el.selected = true;
      voltSelect.appendChild(el);
    });
    
    // Auto-update motor units to kW in IEC mode
    nodes.forEach(n => {
      if (n.type === "motor" && n.params.unit === "HP") {
        n.params.unit = "kW";
        n.params.power = Math.round((n.params.power * 0.7457) * 10) / 10;
      }
    });
    
    systemGlobals.voltage = 400;
  }
  
  updateGlobals();
}

function openThermalModal() {
  const modal = document.getElementById("thermal-modal");
  if (modal) {
    modal.classList.remove("hidden");
    recalculateThermal();
  }
}

function closeThermalModal() {
  const modal = document.getElementById("thermal-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

function recalculateThermal() {
  const ambient = parseFloat(document.getElementById("enc-ambient").value) || 35;
  const maxTemp = parseFloat(document.getElementById("enc-max-temp").value) || 45;
  
  let tempRise = maxTemp - ambient;
  if (tempRise < 2) tempRise = 2; // Avoid division by zero
  
  let totalLossWatts = 0;
  let activeControllers = [];
  
  // Calculate individual component losses
  nodes.forEach(n => {
    let loss = 0;
    let label = n.name;
    
    if (n.type === "vfd") {
      const stats = getConnectedBranchStats(n.id);
      const loadAmps = stats.totalFLA;
      const vfdSize = n.params.autoSize ? selectVfdSize(loadAmps) : n.params.ratedCurrent;
      loss = calculateVfdLoss(vfdSize, loadAmps);
      activeControllers.push({ name: label, type: "VFD Drive", loss });
    } else if (n.type === "softstarter") {
      const stats = getConnectedBranchStats(n.id);
      const motorKw = stats.totalFLA * systemGlobals.voltage * Math.sqrt(3) * 0.85 / 1000;
      loss = motorKw * 1000 * 0.01 + 10; 
      activeControllers.push({ name: label, type: "Soft Starter", loss });
    } else if (n.type === "dol") {
      const stats = getConnectedBranchStats(n.id);
      loss = stats.totalFLA > 0 ? 25 : 5;
      activeControllers.push({ name: label, type: "DOL Starter", loss });
    } else if (n.type === "breaker") {
      const stats = getConnectedBranchStats(n.id);
      loss = stats.totalFLA > 0 ? 12 : 2;
      activeControllers.push({ name: label, type: "MCCB Feeder", loss });
    } else if (n.type === "busbar") {
      const stats = getConnectedBranchStats(n.id);
      const totalPowerKw = (Math.sqrt(3) * systemGlobals.voltage * stats.totalFLA * systemGlobals.pfTarget) / 1000;
      loss = totalPowerKw * 1000 * 0.01;
    }
    
    totalLossWatts += loss;
  });
  
  // 1. Calculate Required CFM Ventilation Flow Rate
  // CFM = (3.16 * Watts) / TempRise_F
  const tempRiseF = tempRise * 1.8;
  const cfm = (3.16 * totalLossWatts) / tempRiseF;
  
  // 2. Calculate Air Conditioning requirement in BTU/hr
  const btuHr = totalLossWatts * 3.412;
  const tons = btuHr / 12000;
  
  // Render results panel
  const resultsContainer = document.getElementById("thermal-results-content");
  if (resultsContainer) {
    let coolingType = "Fan Ventilation";
    let coolingColor = "status-ok";
    let coolingAction = "";
    
    if (totalLossWatts > 1500 || cfm > 400) {
      coolingType = "Air Conditioning (AC)";
      coolingColor = "status-warning";
      coolingAction = "Heat load is high. Air Conditioning is recommended to maintain dust-free positive pressure sealing.";
    } else if (totalLossWatts > 4000) {
      coolingType = "High Capacity AC Cooling";
      coolingColor = "status-fail";
      coolingAction = "Critical thermal load! Specialized split air conditioning unit required for enclosure.";
    }
    
    resultsContainer.innerHTML = `
      <div class="result-row">
        <span class="result-label">Total Cabinet Heat Dissipation:</span>
        <span class="result-val">${totalLossWatts.toFixed(0)} W</span>
      </div>
      <div class="result-row">
        <span class="result-label">Allowable Temperature Rise (ΔT):</span>
        <span class="result-val">${tempRise.toFixed(1)} °C (${tempRiseF.toFixed(1)} °F)</span>
      </div>
      <div class="result-row">
        <span class="result-label">Required Enclosure Fan Flow Rate:</span>
        <span class="result-val">${cfm.toFixed(1)} CFM</span>
      </div>
      <div class="result-row">
        <span class="result-label">Required Air Conditioning Load:</span>
        <span class="result-val">${btuHr.toFixed(0)} BTU/hr (${tons.toFixed(2)} Tons)</span>
      </div>
      <div class="result-row" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 8px;">
        <span class="result-label">Recommended Cooling Method:</span>
        <span class="result-val ${coolingColor}" style="font-weight: bold;">${coolingType}</span>
      </div>
      ${coolingAction ? `<p style="font-size:11px; color:var(--text-muted); margin: 6px 0 0 0; line-height: 1.3;">⚠️ ${coolingAction}</p>` : ''}
    `;
  }
  
  // Render physical stacked visual drawers
  const drawersContainer = document.getElementById("cabinet-drawers-container");
  if (drawersContainer) {
    drawersContainer.innerHTML = "";
    
    // Add Main incoming breaker / busbar at the top
    const mainEl = document.createElement("div");
    mainEl.className = "cabinet-drawer drawer-main";
    mainEl.innerHTML = `
      <span class="drawer-label">⚡ MAIN LUGS & BUSBAR</span>
      <span class="drawer-loss">System Bus</span>
    `;
    drawersContainer.appendChild(mainEl);
    
    // Loop through active controllers on canvas and render drawers
    activeControllers.forEach(ctrl => {
      const drawerEl = document.createElement("div");
      
      let hotClass = "";
      if (ctrl.loss > 150) {
        hotClass = "drawer-hot";
      } else if (ctrl.loss > 20) {
        hotClass = "drawer-warm";
      }
      
      drawerEl.className = `cabinet-drawer ${hotClass}`;
      drawerEl.innerHTML = `
        <span class="drawer-label">${ctrl.name}</span>
        <span class="drawer-loss">${ctrl.loss.toFixed(0)} W</span>
      `;
      
      drawersContainer.appendChild(drawerEl);
    });
    
    // Fill remaining empty drawer space up to 6 drawers
    const maxDrawers = 6;
    const currentDrawers = activeControllers.length + 1; // including main
    
    for (let i = currentDrawers; i < maxDrawers; i++) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "cabinet-drawer drawer-empty";
      emptyEl.innerHTML = `
        <span class="drawer-label">— Empty Space Slot —</span>
      `;
      drawersContainer.appendChild(emptyEl);
    }
  }
}

// ==========================================================================
// 12. Panel Schedule, Tray Fill, Bus SC, Templates
// ==========================================================================

function estimateCableOdMm(sizeLabel) {
  // Rough OD estimate (mm) for multi-core power cable by cross-section
  const n = parseFloat(String(sizeLabel).replace(/[^\d.]/g, ""));
  if (!n || isNaN(n)) return 15;
  // Heuristic: OD ≈ 8 + 2.2*sqrt(mm²) for multi-core jacketed
  if (String(sizeLabel).includes("AWG") || String(sizeLabel).includes("kcmil")) {
    return Math.max(8, 6 + Math.sqrt(n) * 1.8);
  }
  return Math.max(8, 7 + Math.sqrt(n) * 2.2);
}

function buildPanelScheduleRows() {
  const rows = [[
    "Tag", "Type", "Name", "Power_kW", "FLA_A", "Protection", "Cable_Size", "Length_m", "Material", "Notes"
  ]];

  nodes.forEach(node => {
    const type = node.type;
    let power = "";
    let fla = "";
    let protection = "";
    let notes = "";

    if (type === "motor") {
      power = node.params.power || "";
      try {
        fla = calculateMotorFLA(node).toFixed(1);
      } catch (_) {
        fla = "";
      }
    } else if (type === "source") {
      notes = `SCC ${node.params.scc || "—"} kA`;
    } else if (type === "busbar") {
      protection = `${node.params.rating || "—"} A bus`;
      notes = node.params.material || "";
    } else if (type === "breaker") {
      protection = `${node.params.selectedRating || "Auto"} A`;
    } else if (type === "dol" || type === "vfd" || type === "softstarter") {
      protection = node.params.ratedCurrent
        ? `${node.params.ratedCurrent} A frame`
        : (node.params.contactorRating ? `AC-3 ${node.params.contactorRating} A` : "");
    }

    // Find outgoing feeder wire (node as from)
    const outWires = wires.filter(w => w.fromNode === node.id);
    if (outWires.length === 0) {
      rows.push([
        node.id.slice(-6),
        type,
        node.name || "",
        power,
        fla,
        protection,
        "",
        "",
        "",
        notes
      ]);
    } else {
      outWires.forEach(w => {
        const to = nodes.find(n => n.id === w.toNode);
        rows.push([
          node.id.slice(-6),
          type,
          node.name || "",
          power,
          fla,
          protection,
          w.params.selectedSize || "Auto",
          w.params.length || "",
          w.params.material || "",
          notes + (to ? ` → ${to.name}` : "")
        ]);
      });
    }
  });

  return rows;
}

function exportPanelScheduleCsv() {
  const rows = buildPanelScheduleRows();
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mcc-panel-schedule-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  updateStatus("Panel schedule CSV exported.");
  if (window.showToast) window.showToast("Panel schedule CSV exported.");
}

function updateTrayFillCalc() {
  const el = document.getElementById("tray-fill-results");
  if (!el) return;
  const width = parseFloat(document.getElementById("tray-width")?.value) || 300;
  const depth = parseFloat(document.getElementById("tray-depth")?.value) || 100;
  const limit = parseFloat(document.getElementById("tray-fill-limit")?.value) || 40;
  const trayArea = width * depth; // mm² usable cross-section (simplified rectangular)

  let cableArea = 0;
  let count = 0;
  wires.forEach(w => {
    const size = w.params.selectedSize || "10";
    const od = estimateCableOdMm(size);
    const area = Math.PI * Math.pow(od / 2, 2);
    const runs = parseInt(w.params.parallelRuns, 10) || 1;
    cableArea += area * runs;
    count += runs;
  });

  const fillPct = trayArea > 0 ? (cableArea / trayArea) * 100 : 0;
  const ok = fillPct <= limit;
  el.innerHTML = `
    <div><strong>Cables in tray model:</strong> ${count} run(s)</div>
    <div><strong>Cable area:</strong> ${cableArea.toFixed(0)} mm²</div>
    <div><strong>Tray usable area:</strong> ${trayArea.toFixed(0)} mm² (${width}×${depth})</div>
    <div style="margin-top:4px;font-weight:700;color:${ok ? "var(--success,#10b981)" : "var(--color-error,#ef4444)"}">
      Fill ${fillPct.toFixed(1)}% ${ok ? "≤" : ">"} limit ${limit}% — ${ok ? "PASS" : "OVERFILL"}
    </div>
    <div style="color:var(--text-muted);margin-top:4px;">Heuristic OD model; verify with manufacturer datasheets and NEC/IEC fill rules.</div>
  `;
}

function updateBusShortCircuit() {
  const el = document.getElementById("bus-sc-results");
  if (!el) return;

  const source = nodes.find(n => n.type === "source");
  const bus = nodes.find(n => n.type === "busbar");
  if (!source) {
    el.innerHTML = "Add a Power Source with SCC (kA) to estimate bus fault level.";
    return;
  }

  const sccKa = parseFloat(source.params.scc) || 25;
  const V = systemGlobals.voltage || 400;
  // Source impedance from 3-phase SC capacity: Isc = SCC, Zs = V/(√3 * Isc)
  const Isc_src = sccKa * 1000; // A
  const Zs = V / (Math.sqrt(3) * Isc_src); // ohm

  // Find wire from source to bus if present
  let Zfeed = 0;
  let feedNote = "direct (no feeder modeled)";
  if (bus) {
    const feed = wires.find(w =>
      (w.fromNode === source.id && w.toNode === bus.id) ||
      (w.toNode === source.id && w.fromNode === bus.id)
    );
    if (feed) {
      const len = parseFloat(feed.params.length) || 10;
      const size = parseFloat(String(feed.params.selectedSize || "120").replace(/[^\d.]/g, "")) || 120;
      // Rough AC resistance ohm/km for Cu ~ 0.018/mm², use simplified
      const r_per_km = Math.max(0.05, 18 / Math.max(size, 1)); // ohm/km rough
      const x_per_km = 0.08; // ohm/km typical tray
      const r = (r_per_km * len) / 1000;
      const x = (x_per_km * len) / 1000;
      Zfeed = Math.sqrt(r * r + x * x);
      feedNote = `${len} m feeder · size ${feed.params.selectedSize || "Auto"}`;
    }
  }

  const Ztot = Zs + Zfeed;
  const Isc_bus = V / (Math.sqrt(3) * Ztot); // A
  const Isc_bus_kA = Isc_bus / 1000;
  const busRating = bus ? (parseFloat(bus.params.rating) || 0) : 0;

  el.innerHTML = `
    <div><strong>Source SCC:</strong> ${sccKa} kA @ ${V} V</div>
    <div><strong>Zs:</strong> ${(Zs * 1000).toFixed(3)} mΩ · <strong>Zfeed:</strong> ${(Zfeed * 1000).toFixed(3)} mΩ (${feedNote})</div>
    <div style="margin-top:6px;font-weight:700;">Isc at bus ≈ <span style="color:var(--accent-primary)">${Isc_bus_kA.toFixed(2)} kA</span></div>
    ${bus ? `<div>Bus rating ${busRating} A — ensure bracing / SC withstand ≥ ${Isc_bus_kA.toFixed(1)} kA (verify with IEC 61439 / manufacturer).</div>` : ""}
    <div style="color:var(--text-muted);margin-top:4px;">First-order estimate only (neglects motor contribution &amp; X/R detail).</div>
  `;
}

function applyMccTemplate() {
  const sel = document.getElementById("mcc-template-select");
  const key = sel ? sel.value : "";
  if (!key) {
    alert("Choose a template first.");
    return;
  }
  if (!confirm("Replace the current canvas with this template?")) return;

  const V = systemGlobals.voltage || 400;
  const mk = (type, x, y, name, params) => ({
    id: "node_" + Math.random().toString(36).substr(2, 9),
    type, x, y,
    name: name || NODE_DEFAULTS[type].name,
    params: Object.assign({}, JSON.parse(JSON.stringify(NODE_DEFAULTS[type].params)), params || {})
  });
  const cable = (from, to, length) => ({
    id: "wire_" + Math.random().toString(36).substr(2, 9),
    fromNode: from.id,
    toNode: to.id,
    params: {
      length: length || 15,
      material: "Cu",
      insulation: "XLPE",
      routing: "Tray",
      ambientTemp: 30,
      groupingFactor: 1.0,
      selectedSize: "Auto",
      parallelRuns: 1
    }
  });

  let src, bus, brk, starter, motor, nodesNew, wiresNew;

  if (key === "single-dol") {
    src = mk("source", 250, 40, "Utility Grid", { scc: 35 });
    bus = mk("busbar", 250, 140, "MCC Main Bus", { rating: 630 });
    brk = mk("breaker", 250, 240, "Feeder MCCB", { autoSize: true, selectedRating: 63 });
    starter = mk("dol", 250, 340, "DOL Starter M1", {});
    motor = mk("motor", 250, 460, "Pump Motor", { power: 15, unit: "kW", efficiency: 90, pf: 0.85 });
    nodesNew = [src, bus, brk, starter, motor];
    wiresNew = [cable(src, bus, 20), cable(bus, brk, 2), cable(brk, starter, 3), cable(starter, motor, 25)];
  } else if (key === "dual-motor") {
    src = mk("source", 320, 40, "Utility Grid", { scc: 40 });
    bus = mk("busbar", 320, 140, "MCC Main Bus", { rating: 800 });
    const brk1 = mk("breaker", 180, 240, "MCCB DOL", { selectedRating: 50 });
    const brk2 = mk("breaker", 460, 240, "MCCB VFD", { selectedRating: 80 });
    const dol = mk("dol", 180, 340, "DOL Pack", {});
    const vfd = mk("vfd", 460, 340, "VFD Drive", { ratedCurrent: 32 });
    const m1 = mk("motor", 180, 460, "Conveyor", { power: 11, unit: "kW" });
    const m2 = mk("motor", 460, 460, "Fan", { power: 18.5, unit: "kW" });
    nodesNew = [src, bus, brk1, brk2, dol, vfd, m1, m2];
    wiresNew = [
      cable(src, bus, 15),
      cable(bus, brk1, 2), cable(brk1, dol, 2), cable(dol, m1, 20),
      cable(bus, brk2, 2), cable(brk2, vfd, 2), cable(vfd, m2, 30)
    ];
  } else {
    // soft-lineup
    src = mk("source", 400, 40, "Utility Grid", { scc: 50 });
    bus = mk("busbar", 400, 140, "MCC Bus", { rating: 1000 });
    nodesNew = [src, bus];
    wiresNew = [cable(src, bus, 12)];
    for (let i = 0; i < 3; i++) {
      const x = 160 + i * 220;
      const b = mk("breaker", x, 240, `MCCB ${i + 1}`, { selectedRating: 63 });
      const s = mk("softstarter", x, 340, `Soft Starter ${i + 1}`, { ratedCurrent: 45 });
      const m = mk("motor", x, 460, `Motor ${i + 1}`, { power: 22, unit: "kW" });
      nodesNew.push(b, s, m);
      wiresNew.push(cable(bus, b, 2), cable(b, s, 2), cable(s, m, 18 + i * 5));
    }
  }

  nodes = nodesNew;
  wires = wiresNew;
  deselectAll();
  recalculateSystem();
  renderCanvas();
  updateTrayFillCalc();
  updateBusShortCircuit();
  updateStatus(`Loaded template: ${key}`);
  if (window.showToast) window.showToast("MCC template loaded.");
  if (sel) sel.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    try {
      updateTrayFillCalc();
      updateBusShortCircuit();
    } catch (_) { /* ignore */ }
  }, 500);
});


// Platform export menu (standard JSON/import; tool-specific formats may already live in body UI)
if (window.ToolExports) {
  window.ToolExports.register({
    json: () => window.exportJSON(),
    import: () => document.getElementById("import-file-input")?.click(),
    csv: () => exportPanelScheduleCsv(),
    hide: ["[data-et-export-ui]"]
  });
  window.ToolExports.mount();
}
