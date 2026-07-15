// ==========================================================================
// 2D Engineering Drafting Board - Rebuilt Core CAD Engine
// High-performance 2D HTML5 Canvas coordinate-based CAD engine.
// Integrated with R-Tree spatial indexing for fast selection and snapping.
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const MetricThreads = window.MetricThreads || {};
  const ParallelKeys = window.ParallelKeys || {};

  // --- Drawing State ---
  let sketchVertices = []; // Coordinates array in mm: [{ x, y }]
  let sketchProfiles = [];  // Finalized profiles: [{ startIndex, count, isClosed }]
  let activeProfileStartIndex = 0; // Index in sketchVertices of active open polyline
  let sketchCircles = [];  // Circle entities: [{ cx, cy, r, construction, standardHole, holeTolerance }]
  let sketchInsertions = []; // Block instances: [{ blockName, x, y, scaleX, scaleY, rotation }]
  let blockDefinitions = {
    "M4_SCREW": {
      basePoint: { x: 0, y: 0 },
      entities: [{ type: "CIRCLE", cx: 0, cy: 0, r: 2, layer: "HOLES" }]
    },
    "M5_SCREW": {
      basePoint: { x: 0, y: 0 },
      entities: [{ type: "CIRCLE", cx: 0, cy: 0, r: 2.5, layer: "HOLES" }]
    },
    "M6_SCREW": {
      basePoint: { x: 0, y: 0 },
      entities: [{ type: "CIRCLE", cx: 0, cy: 0, r: 3, layer: "HOLES" }]
    },
    "TSLOT_2020": {
      basePoint: { x: 0, y: 0 },
      entities: [
        { type: "LINE", x1: -10, y1: -10, x2: 10, y2: -10, layer: "PROFILE_OUTLINE" },
        { type: "LINE", x1: 10, y1: -10, x2: 10, y2: 10, layer: "PROFILE_OUTLINE" },
        { type: "LINE", x1: 10, y1: 10, x2: -10, y2: 10, layer: "PROFILE_OUTLINE" },
        { type: "LINE", x1: -10, y1: 10, x2: -10, y2: -10, layer: "PROFILE_OUTLINE" }
      ]
    }
  };
  let isSketchClosed = false;
  let selectedVertexIndex = -1;
  let mousePos = { x: 0, y: 0 };
  
  // CAD Tools Mode — default Select (Phase A)
  let editorMode = "select"; // "select", "draw", "circle", "rect", "poly", "fillet", "trim", "dimension", "measure", "pan", "insert_block"
  window.editorMode = "select";
  // Dimensions: linear { kind:'linear', v1, v2, d, offset }
  // radial { kind:'radius'|'diameter', circleIndex, d, angle, textDist }
  let customDimensions = [];
  let selectedVertexA = -1;  // For smart dimensioning (two-point)
  let selectedVertexB = -1;
  // Interactive dimension placement draft (CAD-style place step)
  // { phase:'place', kind, v1?, v2?, circleIndex?, offset?, angle?, textDist?, d }
  let dimDraft = null;
  let dimDragIndex = -1; // dragging existing dim offset in select mode
  let measureStartPos = null; // Ruler start coordinate
  let measureEndPos = null;   // Ruler end coordinate
  let isMeasuring = false;
  let lastAnchorPos = null; // last committed point for Δ readout
  let clientCursorPos = { x: 0, y: 0 }; // screen coords for floating prompt
  let spacePanHeld = false;

  // Object snap type filters (OSNAP panel)
  window.snapFilters = {
    endpoint: true,
    midpoint: true,
    center: true,
    intersection: true,
    tangent: true,
    perpendicular: true
  };
  window.crosshairEnabled = true;
  window.darkCanvas = false;

  // Dimension style (Phase C)
  let dimStyle = {
    decimals: 1,
    textHeight: 10.5,
    arrowSize: 3,
    offset: 28,
    color: "#0d9488"
  };

  // Geometric constraints (must be early for undo/autosave snapshots)
  let parametricConstraints = [];

  const AUTOSAVE_KEY = "drafting_board_autosave_v1";
  let pendingAutosaveRestore = null;

  // Shapes drawing states
  let activeCircleCenter = null;
  let activeRectStart = null;
  let activePolyCenter = null;
  let polySides = 6;
  
  // Selection and Snap Hover
  let selectedEntity = null; // { type: 'line'|'circle'|'vertex'|'dimension'|'insertion', index: number }
  let hoveredSnapTarget = null; // { x, y, type, index }
  let shiftPressed = false;
  let lastRawWorldPos = null;

  // Sheet configuration
  let sheetSize = "A4";
  let sheetWidth = 297;
  let sheetHeight = 210;

  // Unified Renderer
  let webglRenderer = null; // represents our 2D canvas context renderer class instance

  // Layer Configuration
  let layers = {
    "FOREGROUND": { color: "#000000", visible: true, frozen: false },
    "BACKGROUND": { color: "#475569", visible: true, frozen: false },
    "HOLES": { color: "#2563eb", visible: true, frozen: false },
    "CONSTRUCTION": { color: "#94a3b8", visible: true, frozen: false }
  };
  let activeLayerName = "FOREGROUND";
  let activeBlockToInsert = null;

  // Status Toggles
  window.orthoLockEnabled = false;
  window.gridVisible = true;
  window.snapEnabled = true;

  // ── Phase B: Undo / Redo ───────────────────────────────────
  const MAX_UNDO = 60;
  let undoStack = [];
  let redoStack = [];
  let suppressUndo = false;

  function captureDrawingSnapshot() {
    return JSON.stringify({
      vertices: sketchVertices,
      profiles: sketchProfiles,
      activeProfileStartIndex,
      circles: sketchCircles,
      insertions: sketchInsertions,
      customDimensions,
      parametricConstraints,
      isSketchClosed,
      activeLayerName,
      dimStyle,
      darkCanvas: window.darkCanvas
    });
  }

  function applyDrawingSnapshot(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    sketchVertices = data.vertices || [];
    sketchProfiles = data.profiles || [];
    activeProfileStartIndex = data.activeProfileStartIndex !== undefined ? data.activeProfileStartIndex : sketchVertices.length;
    sketchCircles = data.circles || [];
    sketchInsertions = data.insertions || [];
    customDimensions = data.customDimensions || [];
    parametricConstraints = data.parametricConstraints || [];
    isSketchClosed = !!data.isSketchClosed;
    if (data.activeLayerName) activeLayerName = data.activeLayerName;
    if (data.dimStyle) dimStyle = { ...dimStyle, ...data.dimStyle };
    if (typeof data.darkCanvas === "boolean") {
      window.darkCanvas = data.darkCanvas;
      document.body.classList.toggle("cad-dark", window.darkCanvas);
      document.getElementById("dark-canvas-toggle")?.classList.toggle("active", window.darkCanvas);
    }
    selectedEntity = null;
    selectedVertexIndex = -1;
    activeGrip = null;
    xform = { tool: null, stage: 0, base: null, seed: null, preview: null };
    rebuildSpatialIndexes();
    showEntityInspector();
    updateLiveProperties();
    updateProfileHealth();
    syncLayerSelect();
    syncDimStyleInputs();
    drawSketchCanvas();
    updateToolPromptUI();
  }

  function pushUndo(label) {
    if (suppressUndo) return;
    undoStack.push({ label: label || "edit", snap: captureDrawingSnapshot() });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }

  window.cadUndo = () => {
    if (undoStack.length === 0) {
      if (window.showToast) window.showToast("Nothing to undo", false);
      return;
    }
    redoStack.push({ label: "redo", snap: captureDrawingSnapshot() });
    const item = undoStack.pop();
    suppressUndo = true;
    applyDrawingSnapshot(item.snap);
    suppressUndo = false;
    if (window.showToast) window.showToast(`Undo: ${item.label || "edit"}`);
  };

  window.cadRedo = () => {
    if (redoStack.length === 0) {
      if (window.showToast) window.showToast("Nothing to redo", false);
      return;
    }
    undoStack.push({ label: "undo", snap: captureDrawingSnapshot() });
    const item = redoStack.pop();
    suppressUndo = true;
    applyDrawingSnapshot(item.snap);
    suppressUndo = false;
    if (window.showToast) window.showToast("Redo");
  };

  // ── Phase B: Grips + transforms ─────────────────────────────
  let activeGrip = null; // { kind: 'vertex'|'circle-center'|'circle-radius'|'insertion', index }
  let xform = { tool: null, stage: 0, base: null, seed: null, preview: null };
  // seed: { type, index, clone of entity data for multi-op }

  function getGripPoints(entity) {
    if (!entity) return [];
    const grips = [];
    if (entity.type === "vertex") {
      const v = sketchVertices[entity.index];
      if (v) grips.push({ kind: "vertex", index: entity.index, x: v.x, y: v.y });
    } else if (entity.type === "line") {
      const a = sketchVertices[entity.index];
      // find partner endpoint of segment
      let b = null;
      for (const prof of sketchProfiles) {
        const limit = prof.isClosed ? prof.count : prof.count - 1;
        for (let i = 0; i < limit; i++) {
          if (prof.startIndex + i === entity.index) {
            b = sketchVertices[prof.startIndex + (i + 1) % prof.count];
            grips.push({ kind: "vertex", index: entity.index, x: a.x, y: a.y });
            grips.push({ kind: "vertex", index: prof.startIndex + (i + 1) % prof.count, x: b.x, y: b.y });
            grips.push({ kind: "mid", index: entity.index, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            return grips;
          }
        }
      }
      // active polyline
      if (a && sketchVertices[entity.index + 1]) {
        b = sketchVertices[entity.index + 1];
        grips.push({ kind: "vertex", index: entity.index, x: a.x, y: a.y });
        grips.push({ kind: "vertex", index: entity.index + 1, x: b.x, y: b.y });
        grips.push({ kind: "mid", index: entity.index, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    } else if (entity.type === "circle") {
      const c = sketchCircles[entity.index];
      if (c) {
        grips.push({ kind: "circle-center", index: entity.index, x: c.cx, y: c.cy });
        grips.push({ kind: "circle-radius", index: entity.index, x: c.cx + c.r, y: c.cy });
      }
    } else if (entity.type === "insertion") {
      const ins = sketchInsertions[entity.index];
      if (ins) grips.push({ kind: "insertion", index: entity.index, x: ins.x, y: ins.y });
    }
    return grips;
  }

  function findGripAt(pos) {
    if (editorMode !== "select" || !selectedEntity) return null;
    const grips = getGripPoints(selectedEntity);
    const tol = 10;
    for (const g of grips) {
      if (Math.hypot(pos.x - g.x, pos.y - g.y) < tol) return g;
    }
    return null;
  }

  function cloneEntityForXform(entity) {
    if (!entity) return null;
    if (entity.type === "circle") {
      const c = sketchCircles[entity.index];
      return c ? { type: "circle", index: entity.index, data: { ...c } } : null;
    }
    if (entity.type === "insertion") {
      const ins = sketchInsertions[entity.index];
      return ins ? { type: "insertion", index: entity.index, data: { ...ins } } : null;
    }
    if (entity.type === "vertex") {
      const v = sketchVertices[entity.index];
      return v ? { type: "vertex", index: entity.index, data: { ...v } } : null;
    }
    if (entity.type === "line") {
      // collect both endpoints of segment
      const idx = entity.index;
      let i2 = idx + 1;
      for (const prof of sketchProfiles) {
        const limit = prof.isClosed ? prof.count : prof.count - 1;
        for (let i = 0; i < limit; i++) {
          if (prof.startIndex + i === idx) {
            i2 = prof.startIndex + (i + 1) % prof.count;
          }
        }
      }
      return {
        type: "line",
        index: idx,
        indices: [idx, i2],
        data: [
          { ...sketchVertices[idx] },
          { ...sketchVertices[i2] }
        ]
      };
    }
    return null;
  }

  function applyXformToSeed(seed, base, dest, tool, extra) {
    if (!seed) return;
    const dx = dest.x - base.x;
    const dy = dest.y - base.y;
    if (tool === "move" || tool === "copy") {
      if (seed.type === "circle") {
        const c = sketchCircles[seed.index];
        if (c) { c.cx = seed.data.cx + dx; c.cy = seed.data.cy + dy; }
      } else if (seed.type === "insertion") {
        const ins = sketchInsertions[seed.index];
        if (ins) { ins.x = seed.data.x + dx; ins.y = seed.data.y + dy; }
      } else if (seed.type === "vertex") {
        sketchVertices[seed.index] = { x: seed.data.x + dx, y: seed.data.y + dy };
      } else if (seed.type === "line" && seed.indices) {
        seed.indices.forEach((vi, i) => {
          sketchVertices[vi] = { x: seed.data[i].x + dx, y: seed.data[i].y + dy };
        });
      }
    } else if (tool === "rotate") {
      const ang = (extra && extra.angle != null) ? extra.angle : Math.atan2(dy, dx);
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const rot = (px, py) => {
        const rx = px - base.x, ry = py - base.y;
        return { x: base.x + rx * cos - ry * sin, y: base.y + rx * sin + ry * cos };
      };
      if (seed.type === "circle") {
        const c = sketchCircles[seed.index];
        if (c) {
          const p = rot(seed.data.cx, seed.data.cy);
          c.cx = p.x; c.cy = p.y;
        }
      } else if (seed.type === "insertion") {
        const ins = sketchInsertions[seed.index];
        if (ins) {
          const p = rot(seed.data.x, seed.data.y);
          ins.x = p.x; ins.y = p.y;
          ins.rotation = (seed.data.rotation || 0) + ang * 180 / Math.PI;
        }
      } else if (seed.type === "vertex") {
        sketchVertices[seed.index] = rot(seed.data.x, seed.data.y);
      } else if (seed.type === "line" && seed.indices) {
        seed.indices.forEach((vi, i) => {
          sketchVertices[vi] = rot(seed.data[i].x, seed.data[i].y);
        });
      }
    } else if (tool === "mirror") {
      // Mirror across line base→dest
      const ax = base.x, ay = base.y, bx = dest.x, by = dest.y;
      const mirrorPt = (px, py) => {
        const dxm = bx - ax, dym = by - ay;
        const len2 = dxm * dxm + dym * dym || 1;
        const t = ((px - ax) * dxm + (py - ay) * dym) / len2;
        const projx = ax + t * dxm, projy = ay + t * dym;
        return { x: 2 * projx - px, y: 2 * projy - py };
      };
      if (seed.type === "circle") {
        const c = sketchCircles[seed.index];
        if (c) {
          const p = mirrorPt(seed.data.cx, seed.data.cy);
          c.cx = p.x; c.cy = p.y;
        }
      } else if (seed.type === "insertion") {
        const ins = sketchInsertions[seed.index];
        if (ins) {
          const p = mirrorPt(seed.data.x, seed.data.y);
          ins.x = p.x; ins.y = p.y;
          ins.scaleX = -(seed.data.scaleX !== undefined ? seed.data.scaleX : 1);
        }
      } else if (seed.type === "vertex") {
        sketchVertices[seed.index] = mirrorPt(seed.data.x, seed.data.y);
      } else if (seed.type === "line" && seed.indices) {
        seed.indices.forEach((vi, i) => {
          sketchVertices[vi] = mirrorPt(seed.data[i].x, seed.data[i].y);
        });
      }
    }
  }

  function finishCopyFromSeed(seed, base, dest) {
    // Create new geometry as copy (don't move original)
    const dx = dest.x - base.x;
    const dy = dest.y - base.y;
    if (seed.type === "circle") {
      sketchCircles.push({
        ...seed.data,
        cx: seed.data.cx + dx,
        cy: seed.data.cy + dy,
        layer: seed.data.layer || activeLayerName
      });
    } else if (seed.type === "insertion") {
      sketchInsertions.push({
        ...seed.data,
        x: seed.data.x + dx,
        y: seed.data.y + dy
      });
    } else if (seed.type === "line" && seed.data) {
      const a = { x: seed.data[0].x + dx, y: seed.data[0].y + dy };
      const b = { x: seed.data[1].x + dx, y: seed.data[1].y + dy };
      const start = sketchVertices.length;
      sketchVertices.push(a, b);
      sketchProfiles.push({ startIndex: start, count: 2, isClosed: false });
      activeProfileStartIndex = sketchVertices.length;
    } else if (seed.type === "vertex") {
      // skip lone vertex copy
    }
  }

  function offsetLineEntity(entity, distance) {
    // Offset selected line segment by distance (left of direction)
    if (!entity || entity.type !== "line") return false;
    const idx = entity.index;
    let i2 = idx + 1;
    for (const prof of sketchProfiles) {
      const limit = prof.isClosed ? prof.count : prof.count - 1;
      for (let i = 0; i < limit; i++) {
        if (prof.startIndex + i === idx) {
          i2 = prof.startIndex + (i + 1) % prof.count;
        }
      }
    }
    const a = sketchVertices[idx];
    const b = sketchVertices[i2];
    if (!a || !b) return false;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * distance;
    const ny = dx / len * distance;
    const start = sketchVertices.length;
    sketchVertices.push(
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny }
    );
    sketchProfiles.push({ startIndex: start, count: 2, isClosed: false });
    activeProfileStartIndex = sketchVertices.length;
    return true;
  }

  function extendLineEntity(entity, clickPos) {
    if (!entity || entity.type !== "line") return false;
    const idx = entity.index;
    let i2 = idx + 1;
    for (const prof of sketchProfiles) {
      const limit = prof.isClosed ? prof.count : prof.count - 1;
      for (let i = 0; i < limit; i++) {
        if (prof.startIndex + i === idx) {
          i2 = prof.startIndex + (i + 1) % prof.count;
        }
      }
    }
    const A = sketchVertices[idx];
    const B = sketchVertices[i2];
    if (!A || !B) return false;

    // Which end is closer to click?
    const dA = Math.hypot(clickPos.x - A.x, clickPos.y - A.y);
    const dB = Math.hypot(clickPos.x - B.x, clickPos.y - B.y);
    const freeIdx = dA < dB ? idx : i2;
    const fixed = dA < dB ? B : A;
    const free = dA < dB ? A : B;
    const dir = { x: free.x - fixed.x, y: free.y - fixed.y };
    const dirLen = Math.hypot(dir.x, dir.y) || 1;
    dir.x /= dirLen; dir.y /= dirLen;

    // Ray from free outward (away from fixed)
    const rayOrigin = free;
    const rayDir = dir;

    // Find nearest intersection with other lines ahead of free end
    let bestT = Infinity;
    let bestPt = null;

    const considerSeg = (C, D) => {
      // ray-segment intersection
      const rx = rayDir.x, ry = rayDir.y;
      const sx = D.x - C.x, sy = D.y - C.y;
      const denom = rx * sy - ry * sx;
      if (Math.abs(denom) < 1e-9) return;
      const qpx = C.x - rayOrigin.x, qpy = C.y - rayOrigin.y;
      const t = (qpx * sy - qpy * sx) / denom;
      const u = (qpx * ry - qpy * rx) / denom;
      if (t > 1e-3 && u >= 0 && u <= 1 && t < bestT) {
        bestT = t;
        bestPt = { x: rayOrigin.x + t * rx, y: rayOrigin.y + t * ry };
      }
    };

    sketchProfiles.forEach(prof => {
      const limit = prof.isClosed ? prof.count : prof.count - 1;
      for (let i = 0; i < limit; i++) {
        const s = prof.startIndex + i;
        if (s === idx) continue;
        const C = sketchVertices[s];
        const D = sketchVertices[prof.startIndex + (i + 1) % prof.count];
        considerSeg(C, D);
      }
    });
    // active polyline segments
    const aStart = activeProfileStartIndex;
    const aCount = sketchVertices.length - aStart;
    for (let i = 0; i < aCount - 1; i++) {
      const s = aStart + i;
      if (s === idx) continue;
      considerSeg(sketchVertices[s], sketchVertices[s + 1]);
    }

    if (!bestPt) {
      // extend by fixed distance if no hit
      bestPt = { x: free.x + dir.x * 20, y: free.y + dir.y * 20 };
    }
    sketchVertices[freeIdx] = { x: Math.round(bestPt.x * 100) / 100, y: Math.round(bestPt.y * 100) / 100 };
    return true;
  }

  // ── Dynamic input (length / angle) ─────────────────────────
  function showDynInput(show) {
    const bar = document.getElementById("dyn-input-bar");
    if (!bar) return;
    bar.classList.toggle("hidden", !show);
    if (show) {
      const field = document.getElementById("dyn-input-field");
      if (field) {
        field.value = "";
        setTimeout(() => field.focus(), 0);
      }
    }
  }

  function parseDynInput(str) {
    // Formats: "50" length, "@50<90" polar, "45d" angle degrees, "50@90"
    const s = String(str || "").trim().replace(/\s+/g, "");
    if (!s) return null;
    // @dist<angle
    let m = s.match(/^@?([-+]?\d*\.?\d+)<([-+]?\d*\.?\d+)$/);
    if (m) return { kind: "polar", dist: parseFloat(m[1]), angleDeg: parseFloat(m[2]) };
    // dist@angle
    m = s.match(/^([-+]?\d*\.?\d+)@([-+]?\d*\.?\d+)$/);
    if (m) return { kind: "polar", dist: parseFloat(m[1]), angleDeg: parseFloat(m[2]) };
    // angle with d
    m = s.match(/^([-+]?\d*\.?\d+)d$/i);
    if (m) return { kind: "angle", angleDeg: parseFloat(m[1]) };
    // plain length
    m = s.match(/^([-+]?\d*\.?\d+)$/);
    if (m) return { kind: "length", dist: parseFloat(m[1]) };
    return null;
  }

  function applyDynInputValue() {
    const field = document.getElementById("dyn-input-field");
    if (!field) return;
    const parsed = parseDynInput(field.value);
    if (!parsed) {
      if (window.showToast) window.showToast("Use length, @len<ang, or angd", false);
      return;
    }

    if (editorMode === "draw") {
      const activeStart = activeProfileStartIndex;
      const activeCount = sketchVertices.length - activeStart;
      if (activeCount < 1) {
        if (window.showToast) window.showToast("Place first point, then type length", false);
        return;
      }
      const last = sketchVertices[sketchVertices.length - 1];
      let ang = 0;
      if (parsed.kind === "polar") ang = parsed.angleDeg * Math.PI / 180;
      else if (parsed.kind === "angle") ang = parsed.angleDeg * Math.PI / 180;
      else if (activeCount >= 2) {
        const prev = sketchVertices[sketchVertices.length - 2];
        ang = Math.atan2(last.y - prev.y, last.x - prev.x);
      } else if (window.orthoLockEnabled || shiftPressed) {
        ang = 0;
      } else if (mousePos) {
        ang = Math.atan2(mousePos.y - last.y, mousePos.x - last.x);
      }
      const dist = parsed.kind === "angle" ? Math.hypot((mousePos?.x || 0) - last.x, (mousePos?.y || 0) - last.y) || 10 : parsed.dist;
      pushUndo("line input");
      const pt = {
        x: Math.round((last.x + dist * Math.cos(ang)) * 100) / 100,
        y: Math.round((last.y + dist * Math.sin(ang)) * 100) / 100
      };
      sketchVertices.push(pt);
      lastAnchorPos = { ...pt };
      field.value = "";
      rebuildSpatialIndexes();
      drawSketchCanvas();
      updateLiveProperties();
      updateToolPromptUI();
      return;
    }

    if (editorMode === "offset" && selectedEntity && selectedEntity.type === "line") {
      const dist = parsed.kind === "length" || parsed.kind === "polar" ? parsed.dist : 5;
      pushUndo("offset");
      offsetLineEntity(selectedEntity, dist);
      rebuildSpatialIndexes();
      drawSketchCanvas();
      updateLiveProperties();
      setEditorMode("select");
      field.value = "";
      return;
    }

    if (editorMode === "rotate" && xform.stage >= 1 && xform.base && xform.seed) {
      if (parsed.kind === "angle" || parsed.kind === "polar") {
        pushUndo("rotate");
        // restore seed then rotate
        restoreSeedGeometry(xform.seed);
        applyXformToSeed(xform.seed, xform.base, xform.base, "rotate", { angle: (parsed.angleDeg || 0) * Math.PI / 180 });
        rebuildSpatialIndexes();
        drawSketchCanvas();
        updateLiveProperties();
        setEditorMode("select");
        field.value = "";
      }
    }
  }

  function restoreSeedGeometry(seed) {
    if (!seed) return;
    if (seed.type === "circle") Object.assign(sketchCircles[seed.index], seed.data);
    else if (seed.type === "insertion") Object.assign(sketchInsertions[seed.index], seed.data);
    else if (seed.type === "vertex") sketchVertices[seed.index] = { ...seed.data };
    else if (seed.type === "line" && seed.indices) {
      seed.indices.forEach((vi, i) => { sketchVertices[vi] = { ...seed.data[i] }; });
    }
  }

  function syncLayerSelect() {
    const sel = document.getElementById("status-layer-select");
    if (!sel) return;
    const names = Object.keys(layers);
    sel.innerHTML = names.map(n =>
      `<option value="${n}" ${n === activeLayerName ? "selected" : ""}>${n}</option>`
    ).join("");
  }

  // --- Canvas setup ---
  const canvasEl = document.getElementById("cad-canvas");

  // --- RBush Spatial Indexing Fallback (Ensures offline compatibility) ---
  if (typeof window.RBush === "undefined") {
    window.RBush = class RBush {
      constructor() {
        this.items = [];
      }
      insert(item) {
        this.items.push(item);
      }
      load(items) {
        this.items = [...items];
      }
      clear() {
        this.items = [];
      }
      search(bbox) {
        return this.items.filter(item => {
          return item.minX <= bbox.maxX && item.maxX >= bbox.minX &&
                 item.minY <= bbox.maxY && item.maxY >= bbox.minY;
        });
      }
    };
  }

  // Active Spatial Indexes
  let entitySpatialIndex = new window.RBush();
  let snapSpatialIndex = new window.RBush();

  // Returns exact world coordinates (grid snapping is disabled)
  function snapToGrid(x, y) {
    return { x: x, y: y };
  }

  // --- Spatial Index Builder ---
  function rebuildSpatialIndexes() {
    entitySpatialIndex.clear();
    snapSpatialIndex.clear();

    const entityItems = [];
    const snapItems = [];

    // 1. Index Vertices
    sketchVertices.forEach((v, idx) => {
      // Entity hit target
      entityItems.push({
        minX: v.x - 8, minY: v.y - 8, maxX: v.x + 8, maxY: v.y + 8,
        type: "vertex", index: idx, x: v.x, y: v.y
      });
      // Snap endpoint
      snapItems.push({
        minX: v.x - 1, minY: v.y - 1, maxX: v.x + 1, maxY: v.y + 1,
        type: "endpoint", index: idx, x: v.x, y: v.y
      });
    });

    // Helper to index segments for a range
    const indexSegments = (start, count, isClosed) => {
      if (count < 2) return;
      const limit = isClosed ? count : count - 1;
      for (let i = 0; i < limit; i++) {
        const idx1 = start + i;
        const idx2 = start + (i + 1) % count;
        const p1 = sketchVertices[idx1];
        const p2 = sketchVertices[idx2];
        if (!p1 || !p2) continue;
        
        const minX = Math.min(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxX = Math.max(p1.x, p2.x);
        const maxY = Math.max(p1.y, p2.y);

        entityItems.push({
          minX: minX - 8, minY: minY - 8, maxX: maxX + 8, maxY: maxY + 8,
          type: "line", index: idx1, p1, p2
        });

        // Midpoint snap target
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        snapItems.push({
          minX: mx - 1, minY: my - 1, maxX: mx + 1, maxY: my + 1,
          type: "midpoint", index: idx1, x: mx, y: my
        });
      }
    };

    // 2. Index Line Segments across all profiles
    sketchProfiles.forEach(prof => {
      indexSegments(prof.startIndex, prof.count, prof.isClosed);
    });

    // Index active open polyline segments
    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;
    indexSegments(activeStart, activeCount, false);

    // 3. Index Circles
    sketchCircles.forEach((c, idx) => {
      // Bounding box of circumference
      entityItems.push({
        minX: c.cx - c.r - 8, minY: c.cy - c.r - 8, maxX: c.cx + c.r + 8, maxY: c.cy + c.r + 8,
        type: "circle", index: idx, cx: c.cx, cy: c.cy, r: c.r
      });

      // Center snap target
      snapItems.push({
        minX: c.cx - 1, minY: c.cy - 1, maxX: c.cx + 1, maxY: c.cy + 1,
        type: "center", index: idx, x: c.cx, y: c.cy
      });
    });

    // 4. Index Block Insertions
    sketchInsertions.forEach((ins, idx) => {
      const def = blockDefinitions[ins.blockName];
      if (!def) return;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const transformPoint = (px, py) => {
        const rad = ((ins.rotation || 0) * Math.PI) / 180;
        let sx = px * (ins.scaleX !== undefined ? ins.scaleX : 1);
        let sy = py * (ins.scaleY !== undefined ? ins.scaleY : 1);
        let rx = sx * Math.cos(rad) - sy * Math.sin(rad);
        let ry = sx * Math.sin(rad) + sy * Math.cos(rad);
        return { x: rx + ins.x, y: ry + ins.y };
      };

      def.entities.forEach(ent => {
        if (ent.type === "LINE") {
          const pt1 = transformPoint(ent.x1, ent.y1);
          const pt2 = transformPoint(ent.x2, ent.y2);
          minX = Math.min(minX, pt1.x, pt2.x);
          minY = Math.min(minY, pt1.y, pt2.y);
          maxX = Math.max(maxX, pt1.x, pt2.x);
          maxY = Math.max(maxY, pt1.y, pt2.y);
        } else if (ent.type === "CIRCLE") {
          const ctr = transformPoint(ent.cx, ent.cy);
          const r = ent.r * Math.abs(ins.scaleX !== undefined ? ins.scaleX : 1);
          minX = Math.min(minX, ctr.x - r);
          minY = Math.min(minY, ctr.y - r);
          maxX = Math.max(maxX, ctr.x + r);
          maxY = Math.max(maxY, ctr.y + r);
        }
      });

      if (minX !== Infinity) {
        entityItems.push({
          minX: minX - 8, minY: minY - 8, maxX: maxX + 8, maxY: maxY + 8,
          type: "insertion", index: idx, ins
        });
      }
    });

    // 5. Index Dimensions (hit near text / leader / extension line)
    customDimensions.forEach((dim, idx) => {
      const nd = normalizeDim(dim, idx);
      const loc = getDimensionLabelPoint(nd, idx);
      if (!loc) return;
      // Generous pad so CAD-style click-to-select on the dimension is reliable
      let minX = loc.x - 30, minY = loc.y - 16, maxX = loc.x + 30, maxY = loc.y + 16;
      if (nd && nd.kind === "linear") {
        const p1 = sketchVertices[nd.v1], p2 = sketchVertices[nd.v2];
        if (p1 && p2) {
          const off = nd.offset != null ? nd.offset : 28;
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const o1x = p1.x + off * nx, o1y = p1.y + off * ny;
          const o2x = p2.x + off * nx, o2y = p2.y + off * ny;
          minX = Math.min(minX, o1x, o2x, p1.x, p2.x) - 8;
          minY = Math.min(minY, o1y, o2y, p1.y, p2.y) - 8;
          maxX = Math.max(maxX, o1x, o2x, p1.x, p2.x) + 8;
          maxY = Math.max(maxY, o1y, o2y, p1.y, p2.y) + 8;
        }
      } else if (nd && (nd.kind === "radius" || nd.kind === "diameter")) {
        const c = sketchCircles[nd.circleIndex];
        if (c) {
          minX = Math.min(minX, c.cx - c.r, loc.x) - 8;
          minY = Math.min(minY, c.cy - c.r, loc.y) - 8;
          maxX = Math.max(maxX, c.cx + c.r, loc.x) + 8;
          maxY = Math.max(maxY, c.cy + c.r, loc.y) + 8;
        }
      }
      entityItems.push({
        minX, minY, maxX, maxY,
        type: "dimension", index: idx
      });
    });

    // 6. Dynamic Intersections, Tangents, and Perpendicular Snaps
    if (window.snapEnabled) {
      // Collect all segments across all profiles for intersections and perpendiculars
      const allSegments = [];
      sketchProfiles.forEach(prof => {
        const lim = prof.isClosed ? prof.count : prof.count - 1;
        for (let i = 0; i < lim; i++) {
          const p1 = sketchVertices[prof.startIndex + i];
          const p2 = sketchVertices[prof.startIndex + (i + 1) % prof.count];
          if (p1 && p2) {
            allSegments.push({ p1, p2, profIdx: prof.startIndex, segIdx: i });
          }
        }
      });

      // Intersections between all segments
      for (let i = 0; i < allSegments.length; i++) {
        for (let j = i + 1; j < allSegments.length; j++) {
          const s1 = allSegments[i];
          const s2 = allSegments[j];
          // Skip if they share a vertex
          if (s1.p1 === s2.p1 || s1.p1 === s2.p2 || s1.p2 === s2.p1 || s1.p2 === s2.p2) continue;

          const denom = (s1.p2.x - s1.p1.x) * (s2.p2.y - s2.p1.y) - (s1.p2.y - s1.p1.y) * (s2.p2.x - s2.p1.x);
          if (Math.abs(denom) > 1e-6) {
            const u = ((s2.p1.x - s1.p1.x) * (s2.p2.y - s2.p1.y) - (s2.p1.y - s1.p1.y) * (s2.p2.x - s2.p1.x)) / denom;
            const v = ((s2.p1.x - s1.p1.x) * (s1.p2.y - s1.p1.y) - (s2.p1.y - s1.p1.y) * (s1.p2.x - s1.p1.x)) / denom;
            if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
              const ix = s1.p1.x + u * (s1.p2.x - s1.p1.x);
              const iy = s1.p1.y + u * (s1.p2.y - s1.p1.y);
              snapItems.push({
                minX: ix - 1, minY: iy - 1, maxX: ix + 1, maxY: iy + 1,
                type: "intersection", index: [s1.segIdx, s2.segIdx], x: Math.round(ix), y: Math.round(iy)
              });
            }
          }
        }
      }

      // Tangent and Perpendicular projections relative to last vertex
      if (sketchVertices.length > 0) {
        const last = sketchVertices[sketchVertices.length - 1];

        // Tangents
        sketchCircles.forEach((c, idx) => {
          const d = Math.hypot(last.x - c.cx, last.y - c.cy);
          if (d > c.r + 1e-3) {
            const a = Math.atan2(last.y - c.cy, last.x - c.cx);
            const theta = Math.acos(c.r / d);
            
            const t1x = c.cx + c.r * Math.cos(a + theta);
            const t1y = c.cy + c.r * Math.sin(a + theta);
            const t2x = c.cx + c.r * Math.cos(a - theta);
            const t2y = c.cy + c.r * Math.sin(a - theta);

            snapItems.push({
              minX: t1x - 1, minY: t1y - 1, maxX: t1x + 1, maxY: t1y + 1,
              type: "tangent", index: idx, x: Math.round(t1x), y: Math.round(t1y)
            });
            snapItems.push({
              minX: t2x - 1, minY: t2y - 1, maxX: t2x + 1, maxY: t2y + 1,
              type: "tangent", index: idx, x: Math.round(t2x), y: Math.round(t2y)
            });
          }
        });

        // Perpendiculars
        allSegments.forEach(s => {
          const dx = s.p2.x - s.p1.x;
          const dy = s.p2.y - s.p1.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 1e-6) {
            const u = ((last.x - s.p1.x) * dx + (last.y - s.p1.y) * dy) / lenSq;
            if (u >= 0 && u <= 1) {
              const px = s.p1.x + u * dx;
              const py = s.p1.y + u * dy;
              snapItems.push({
                minX: px - 1, minY: py - 1, maxX: px + 1, maxY: py + 1,
                type: "perpendicular", index: s.segIdx, x: Math.round(px), y: Math.round(py)
              });
            }
          }
        });
      }
    }

    if (entityItems.length > 0) entitySpatialIndex.load(entityItems);
    if (snapItems.length > 0) snapSpatialIndex.load(snapItems);
  }

  function normalizeDim(dim, idx) {
    if (!dim) return null;
    if (!dim.kind) {
      // Legacy linear dims
      return { ...dim, kind: "linear", offset: dim.offset != null ? dim.offset : (28 + (idx || 0) * 16) };
    }
    return dim;
  }

  function isLinearDim(dim) {
    const nd = normalizeDim(dim);
    return !!(nd && nd.kind === "linear");
  }

  function isRadialDim(dim) {
    const nd = normalizeDim(dim);
    return !!(nd && (nd.kind === "radius" || nd.kind === "diameter"));
  }

  /** Keep dimensions whose geometry still exists after vertex edits. */
  function pruneInvalidDimensions() {
    customDimensions = customDimensions.filter(dim => {
      const nd = normalizeDim(dim);
      if (!nd) return false;
      if (nd.kind === "linear") {
        return nd.v1 != null && nd.v2 != null
          && nd.v1 < sketchVertices.length && nd.v2 < sketchVertices.length
          && sketchVertices[nd.v1] && sketchVertices[nd.v2];
      }
      if (nd.kind === "radius" || nd.kind === "diameter") {
        return nd.circleIndex != null
          && nd.circleIndex < sketchCircles.length
          && !!sketchCircles[nd.circleIndex];
      }
      return false;
    });
  }

  function getDimensionLabelPoint(dim, idx) {
    dim = normalizeDim(dim, idx);
    if (!dim) return null;
    if (dim.kind === "linear") {
      const p1 = sketchVertices[dim.v1];
      const p2 = sketchVertices[dim.v2];
      if (!p1 || !p2) return null;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const theta = Math.atan2(dy, dx);
      const n = theta - Math.PI / 2;
      const off = dim.offset != null ? dim.offset : 28;
      return { x: mx + off * Math.cos(n), y: my + off * Math.sin(n) };
    }
    if (dim.kind === "radius" || dim.kind === "diameter") {
      const c = sketchCircles[dim.circleIndex];
      if (!c) return null;
      const ang = dim.angle != null ? dim.angle : -Math.PI / 4;
      const dist = dim.textDist != null ? dim.textDist : (dim.kind === "diameter" ? c.r * 1.4 : c.r * 1.6);
      return { x: c.cx + dist * Math.cos(ang), y: c.cy + dist * Math.sin(ang) };
    }
    return null;
  }

  function linearOffsetFromMouse(p1, p2, mouse) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    // signed distance from midpoint line along normal
    const nx = -dy / len, ny = dx / len;
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    return (mouse.x - mx) * nx + (mouse.y - my) * ny;
  }

  function startLinearDimPlace(v1, v2) {
    const p1 = sketchVertices[v1], p2 = sketchVertices[v2];
    if (!p1 || !p2) return;
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    dimDraft = {
      phase: "place",
      kind: "linear",
      v1, v2,
      d,
      offset: mousePos ? linearOffsetFromMouse(p1, p2, mousePos) : 28
    };
    updateToolPromptUI();
  }

  function startRadialDimPlace(circleIndex, kind) {
    const c = sketchCircles[circleIndex];
    if (!c) return;
    const ang = mousePos ? Math.atan2(mousePos.y - c.cy, mousePos.x - c.cx) : -Math.PI / 4;
    const textDist = mousePos ? Math.hypot(mousePos.x - c.cx, mousePos.y - c.cy) : c.r * 1.5;
    dimDraft = {
      phase: "place",
      kind: kind || "diameter",
      circleIndex,
      d: kind === "radius" ? c.r : c.r * 2,
      angle: ang,
      textDist: Math.max(textDist, c.r * 1.15)
    };
    updateToolPromptUI();
  }

  function commitDimDraft() {
    if (!dimDraft || dimDraft.phase !== "place") return;
    pushUndo("dimension");
    if (dimDraft.kind === "linear") {
      customDimensions.push({
        kind: "linear",
        v1: dimDraft.v1,
        v2: dimDraft.v2,
        d: dimDraft.d,
        offset: dimDraft.offset
      });
    } else {
      customDimensions.push({
        kind: dimDraft.kind,
        circleIndex: dimDraft.circleIndex,
        d: dimDraft.d,
        angle: dimDraft.angle,
        textDist: dimDraft.textDist
      });
    }
    dimDraft = null;
    selectedVertexA = -1;
    selectedVertexB = -1;
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
    updateToolPromptUI();
    if (window.showToast) window.showToast("Dimension placed — drag in Select to reposition");
  }

  function updateDimDraftFromMouse(pos) {
    if (!dimDraft || dimDraft.phase !== "place") return;
    if (dimDraft.kind === "linear") {
      const p1 = sketchVertices[dimDraft.v1];
      const p2 = sketchVertices[dimDraft.v2];
      if (p1 && p2) dimDraft.offset = linearOffsetFromMouse(p1, p2, pos);
    } else {
      const c = sketchCircles[dimDraft.circleIndex];
      if (c) {
        dimDraft.angle = Math.atan2(pos.y - c.cy, pos.x - c.cx);
        dimDraft.textDist = Math.max(Math.hypot(pos.x - c.cx, pos.y - c.cy), c.r * 1.05);
        dimDraft.d = dimDraft.kind === "radius" ? c.r : c.r * 2;
      }
    }
  }

  // --- Selection Query (Hit Test) ---
  // options: { excludeVertices, excludeDimensions, preferGeometry }
  function findEntityAt(pos, excludeVertices = false, options = {}) {
    const opts = typeof excludeVertices === "object" ? excludeVertices : { excludeVertices, ...options };
    const noVerts = !!opts.excludeVertices;
    const noDims = !!opts.excludeDimensions;
    const preferGeom = !!opts.preferGeometry;

    const queryBox = {
      minX: pos.x - 8, minY: pos.y - 8, maxX: pos.x + 8, maxY: pos.y + 8
    };

    const candidates = entitySpatialIndex.search(queryBox);
    let bestEntity = null;
    let minDist = 8;
    let bestDim = null;
    let minDimDist = 8;

    candidates.forEach(cand => {
      let dist = Infinity;
      if (cand.type === "vertex") {
        if (noVerts) return;
        dist = Math.hypot(pos.x - cand.x, pos.y - cand.y);
      }
      else if (cand.type === "line") {
        dist = getDistanceToSegment(pos, cand.p1, cand.p2);
      }
      else if (cand.type === "circle") {
        const distToCenter = Math.hypot(pos.x - cand.cx, pos.y - cand.cy);
        dist = Math.abs(distToCenter - cand.r);
        if (distToCenter < dist) dist = distToCenter; // also check center click
      }
      else if (cand.type === "insertion") {
        dist = Math.hypot(pos.x - cand.ins.x, pos.y - cand.ins.y);
      }
      else if (cand.type === "dimension") {
        if (noDims) return;
        // Prefer label center; still pick if inside expanded bbox
        const loc = getDimensionLabelPoint(customDimensions[cand.index], cand.index);
        dist = loc ? Math.hypot(pos.x - loc.x, pos.y - loc.y) : 4;
        if (dist < minDimDist) {
          minDimDist = dist;
          bestDim = { type: cand.type, index: cand.index };
        }
        // When not preferring geometry, dimensions compete with geometry
        if (!preferGeom && dist < minDist) {
          minDist = dist;
          bestEntity = { type: cand.type, index: cand.index };
        }
        return;
      }

      if (dist < minDist) {
        minDist = dist;
        bestEntity = { type: cand.type, index: cand.index };
      }
    });

    // Select mode: if nothing geometric is close, fall back to dimension
    if (!bestEntity && bestDim) return bestDim;
    if (preferGeom && bestEntity) return bestEntity;
    if (preferGeom && bestDim) return bestDim;
    return bestEntity;
  }

  function getDistanceToSegment(p, a, b) {
    const A = p.x - a.x;
    const B = p.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = a.x;
      yy = a.y;
    } else if (param > 1) {
      xx = b.x;
      yy = b.y;
    } else {
      xx = a.x + param * C;
      yy = a.y + param * D;
    }
    return Math.hypot(p.x - xx, p.y - yy);
  }

  // --- Snap Query ---
  function findSnapTarget(pos) {
    if (!window.snapEnabled || ["trim", "fillet", "select", "pan"].includes(editorMode)) return null;

    const queryBox = {
      minX: pos.x - 14, minY: pos.y - 14, maxX: pos.x + 14, maxY: pos.y + 14
    };

    const candidates = snapSpatialIndex.search(queryBox);
    let bestTarget = null;
    let minDist = 14;
    const filters = window.snapFilters || {};

    candidates.forEach(cand => {
      const t = cand.type || "endpoint";
      if (filters[t] === false) return;
      const dist = Math.hypot(pos.x - cand.x, pos.y - cand.y);
      // Prefer endpoints slightly over mid/others when equidistant
      const bias = t === "endpoint" ? -0.5 : 0;
      if (dist + bias < minDist) {
        minDist = dist;
        bestTarget = cand;
      }
    });

    return bestTarget;
  }

  function updateToolPromptUI() {
    const prompts = getToolPromptState();
    const instr = document.getElementById("sketcher-instruction");
    const statusText = document.getElementById("cad-status-text");
    const toolName = document.getElementById("status-tool-name");
    const cursorPrompt = document.getElementById("cursor-prompt");

    if (toolName) toolName.textContent = prompts.toolLabel;
    if (statusText) statusText.textContent = prompts.status;
    if (instr) instr.textContent = prompts.banner;
    const layerSelect = document.getElementById("status-layer-select");
    if (layerSelect && layerSelect.value !== activeLayerName) {
      // keep options in sync if layers changed
      if (![...layerSelect.options].some(o => o.value === activeLayerName)) syncLayerSelect();
      layerSelect.value = activeLayerName;
    }

    if (cursorPrompt) {
      if (prompts.cursor && editorMode !== "select" && editorMode !== "pan") {
        cursorPrompt.textContent = prompts.cursor;
        cursorPrompt.classList.add("visible");
        positionCursorPrompt();
      } else {
        cursorPrompt.classList.remove("visible");
      }
    }

    // Canvas cursor class
    const box = document.querySelector(".cad-canvas-container");
    if (box) {
      box.classList.toggle("mode-pan", editorMode === "pan" || spacePanHeld);
      box.classList.toggle("mode-select", editorMode === "select");
    }

    // Dynamic input visibility for draw/offset/rotate
    const showDyn = (editorMode === "draw" && (sketchVertices.length - activeProfileStartIndex) >= 1) ||
      editorMode === "offset" ||
      (editorMode === "rotate" && xform.stage >= 1);
    showDynInput(!!showDyn);

    updateZoomPctDisplay();
  }

  function getToolPromptState() {
    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;
    const snapLabel = hoveredSnapTarget ? ` · ${String(hoveredSnapTarget.type).toUpperCase()}` : "";

    switch (editorMode) {
      case "select":
        return {
          toolLabel: "SELECT",
          status: selectedEntity
            ? `Selected ${selectedEntity.type} · Del to delete · Esc clears`
            : "Click an entity to select · L Line · C Circle · R Rect",
          banner: "Select mode — click geometry to inspect. Esc cancels any tool.",
          cursor: ""
        };
      case "draw":
        if (activeCount === 0) {
          return {
            toolLabel: "LINE",
            status: `Specify first point${snapLabel}`,
            banner: "Line: specify first point (click or snap). Esc → Select.",
            cursor: "Specify first point"
          };
        }
        return {
          toolLabel: "LINE",
          status: `Specify next point${snapLabel} · Enter/Esc finishes`,
          banner: `Line: next point (${activeCount} vertices) · close near start · Esc finish`,
          cursor: "Specify next point"
        };
      case "circle":
        return {
          toolLabel: "CIRCLE",
          status: activeCircleCenter ? `Specify radius${snapLabel}` : `Specify center${snapLabel}`,
          banner: activeCircleCenter
            ? "Circle: drag to set radius, click to place."
            : "Circle: click center point.",
          cursor: activeCircleCenter ? "Specify radius" : "Specify center"
        };
      case "rect":
        return {
          toolLabel: "RECT",
          status: activeRectStart ? `Specify opposite corner${snapLabel}` : `Specify first corner${snapLabel}`,
          banner: activeRectStart
            ? "Rectangle: opposite corner (Shift = square)."
            : "Rectangle: click first corner.",
          cursor: activeRectStart ? "Opposite corner" : "First corner"
        };
      case "poly":
        return {
          toolLabel: "POLY",
          status: activePolyCenter ? `Specify radius (${polySides} sides)` : "Specify center",
          banner: `Polygon (${polySides} sides): center then radius.`,
          cursor: activePolyCenter ? "Specify radius" : "Specify center"
        };
      case "fillet":
        return { toolLabel: "FILLET", status: "Select corner vertex to fillet", banner: "Fillet: click a corner node.", cursor: "Select corner" };
      case "trim":
        return { toolLabel: "TRIM", status: "Select segment to trim", banner: "Trim: click a segment between intersections.", cursor: "Select segment" };
      case "dimension":
        if (dimDraft && dimDraft.phase === "place") {
          return {
            toolLabel: dimDraft.kind === "linear" ? "DIM" : dimDraft.kind === "radius" ? "RADIUS" : "DIAMETER",
            status: "Move to place · click to confirm · Esc cancel",
            banner: "Place dimension — drag mouse to position, click to lock.",
            cursor: "Place dimension"
          };
        }
        if (selectedVertexA !== -1) {
          return {
            toolLabel: "DIM",
            status: "Click second point",
            banner: "Smart Dim: click second vertex/endpoint.",
            cursor: "Second point"
          };
        }
        return {
          toolLabel: "DIM",
          status: "Click line, circle, or first point",
          banner: "Smart Dim: line → linear · circle → Ø (Shift = R) · two points → linear. Then place.",
          cursor: "Select geometry"
        };
      case "dim-diameter":
        return {
          toolLabel: "Ø",
          status: dimDraft ? "Place diameter · click to confirm" : "Click a circle",
          banner: "Diameter: select circle, then place the dimension.",
          cursor: dimDraft ? "Place Ø" : "Select circle"
        };
      case "dim-radius":
        return {
          toolLabel: "R",
          status: dimDraft ? "Place radius · click to confirm" : "Click a circle",
          banner: "Radius: select circle, then place the dimension.",
          cursor: dimDraft ? "Place R" : "Select circle"
        };
      case "measure":
        return {
          toolLabel: "MEASURE",
          status: isMeasuring ? "Specify second point" : "Specify first point",
          banner: "Measure: two points for distance.",
          cursor: isMeasuring ? "Second point" : "First point"
        };
      case "pan":
        return { toolLabel: "PAN", status: "Drag to pan · scroll to zoom", banner: "Pan: drag canvas. Esc → Select.", cursor: "" };
      case "insert_block":
        return {
          toolLabel: "INSERT",
          status: `Place ${activeBlockToInsert || "block"}${snapLabel}`,
          banner: `Insert: click to place ${activeBlockToInsert || "block"} (ghost preview follows cursor).`,
          cursor: "Place block"
        };
      case "move":
        return {
          toolLabel: "MOVE",
          status: xform.stage === 0 ? (selectedEntity ? "Specify base point" : "Select entity") : "Specify destination",
          banner: "Move: select → base point → destination. Esc cancel.",
          cursor: xform.stage === 0 ? "Base point" : "Destination"
        };
      case "copy":
        return {
          toolLabel: "COPY",
          status: xform.stage === 0 ? (selectedEntity ? "Specify base point" : "Select entity") : "Specify destination",
          banner: "Copy: select → base point → destination.",
          cursor: xform.stage === 0 ? "Base point" : "Second point"
        };
      case "rotate":
        return {
          toolLabel: "ROTATE",
          status: xform.stage === 0 ? (selectedEntity ? "Specify base point" : "Select entity") : "Specify angle (click or type 45d)",
          banner: "Rotate: select → base → reference direction. Type 45d in input bar.",
          cursor: xform.stage === 0 ? "Base point" : "Angle"
        };
      case "mirror":
        return {
          toolLabel: "MIRROR",
          status: xform.stage === 0 ? (selectedEntity ? "Specify first axis point" : "Select entity") : "Specify second axis point",
          banner: "Mirror: select → two points defining mirror axis (creates copy).",
          cursor: xform.stage === 0 ? "Axis P1" : "Axis P2"
        };
      case "offset":
        return {
          toolLabel: "OFFSET",
          status: selectedEntity && selectedEntity.type === "line" ? "Click side or type distance" : "Select a line",
          banner: "Offset: select line → click offset side or type distance (mm).",
          cursor: "Offset"
        };
      case "extend":
        return {
          toolLabel: "EXTEND",
          status: "Click near the end of a line to extend",
          banner: "Extend: click near free end; extends to nearest boundary.",
          cursor: "Select end"
        };
      default:
        return { toolLabel: String(editorMode).toUpperCase(), status: "Ready", banner: "", cursor: "" };
    }
  }

  function positionCursorPrompt() {
    const prompt = document.getElementById("cursor-prompt");
    const container = document.querySelector(".cad-canvas-container");
    if (!prompt || !container || !prompt.classList.contains("visible")) return;
    const rect = container.getBoundingClientRect();
    let x = clientCursorPos.x - rect.left;
    let y = clientCursorPos.y - rect.top;
    // Keep inside viewport
    x = Math.min(Math.max(8, x), rect.width - 120);
    y = Math.min(Math.max(8, y), rect.height - 28);
    prompt.style.left = x + "px";
    prompt.style.top = y + "px";
  }

  function updateZoomPctDisplay() {
    const el = document.getElementById("status-zoom-pct");
    if (!el || !webglRenderer) return;
    // Approximate % relative to fit-sheet zoom if available
    const pct = Math.round((webglRenderer.zoomLevel || 1) * 100);
    el.textContent = `${pct}%`;
  }

  function updateDeltaDisplay() {
    const el = document.getElementById("coords-delta");
    if (!el) return;
    if (!lastAnchorPos || !mousePos) {
      el.textContent = "Δ —";
      return;
    }
    const dx = mousePos.x - lastAnchorPos.x;
    const dy = mousePos.y - lastAnchorPos.y;
    const dist = Math.hypot(dx, dy);
    el.textContent = `Δ ${dist.toFixed(2)}  (${dx.toFixed(1)}, ${dy.toFixed(1)})`;
  }

  // --- Dynamic mouse position updates with Snapping and Constraints ---
  function updateMousePosition(pos) {
    lastRawWorldPos = pos;
    const rawSnapped = snapToGrid(pos.x, pos.y);
    const snapObj = findSnapTarget(pos);
    hoveredSnapTarget = snapObj;

    let finalSnapped = snapObj ? snapObj : rawSnapped;

    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;

    // Apply Ortho lock if in draw mode
    if (editorMode === "draw" && activeCount > 0) {
      if (shiftPressed || window.orthoLockEnabled) {
        const last = sketchVertices[sketchVertices.length - 1];
        const dx = Math.abs(finalSnapped.x - last.x);
        const dy = Math.abs(finalSnapped.y - last.y);
        if (dx > dy) {
          finalSnapped = { x: finalSnapped.x, y: last.y };
        } else {
          finalSnapped = { x: last.x, y: finalSnapped.y };
        }
      }
    }

    // Apply Square constraint if in rect mode
    if (editorMode === "rect" && activeRectStart) {
      if (shiftPressed) {
        const w = finalSnapped.x - activeRectStart.x;
        const h = finalSnapped.y - activeRectStart.y;
        const side = Math.max(Math.abs(w), Math.abs(h));
        finalSnapped = {
          x: activeRectStart.x + Math.sign(w) * side,
          y: activeRectStart.y + Math.sign(h) * side
        };
      }
    }

    // Update Coordinate HUD Display
    const coordsEl = document.getElementById("coords-display");
    if (coordsEl) {
      coordsEl.textContent = `X: ${finalSnapped.x.toFixed(2)}  Y: ${finalSnapped.y.toFixed(2)} mm`;
    }

    mousePos = finalSnapped;
    updateDeltaDisplay();

    // Dimension placement preview
    if (dimDraft && dimDraft.phase === "place") {
      updateDimDraftFromMouse(finalSnapped);
    }

    // Drag existing dimension offset
    if (editorMode === "select" && dimDragIndex >= 0 && customDimensions[dimDragIndex]) {
      const dim = normalizeDim(customDimensions[dimDragIndex], dimDragIndex);
      if (dim.kind === "linear") {
        const p1 = sketchVertices[dim.v1], p2 = sketchVertices[dim.v2];
        if (p1 && p2) {
          customDimensions[dimDragIndex] = {
            ...dim,
            offset: linearOffsetFromMouse(p1, p2, finalSnapped)
          };
        }
      } else if (dim.kind === "radius" || dim.kind === "diameter") {
        const c = sketchCircles[dim.circleIndex];
        if (c) {
          customDimensions[dimDragIndex] = {
            ...dim,
            angle: Math.atan2(finalSnapped.y - c.cy, finalSnapped.x - c.cx),
            textDist: Math.max(Math.hypot(finalSnapped.x - c.cx, finalSnapped.y - c.cy), c.r * 1.05),
            d: dim.kind === "radius" ? c.r : c.r * 2
          };
        }
      }
      rebuildSpatialIndexes();
    }

    updateToolPromptUI();

    // Handle grip / vertex dragging
    if (editorMode === "select" && activeGrip) {
      if (layers["FOREGROUND"].frozen) return;
      if (activeGrip.kind === "vertex" || selectedVertexIndex !== -1) {
        const vi = activeGrip.kind === "vertex" ? activeGrip.index : selectedVertexIndex;
        sketchVertices[vi] = { x: finalSnapped.x, y: finalSnapped.y };
        runConstraintSolver(vi);
      } else if (activeGrip.kind === "circle-center") {
        const c = sketchCircles[activeGrip.index];
        if (c) { c.cx = finalSnapped.x; c.cy = finalSnapped.y; }
      } else if (activeGrip.kind === "circle-radius") {
        const c = sketchCircles[activeGrip.index];
        if (c) {
          c.r = Math.max(0.5, Math.hypot(finalSnapped.x - c.cx, finalSnapped.y - c.cy));
          // Keep radial dimensions in sync with live radius
          customDimensions.forEach(dim => {
            if ((dim.kind === "radius" || dim.kind === "diameter") && dim.circleIndex === activeGrip.index) {
              dim.d = dim.kind === "radius" ? c.r : c.r * 2;
            }
          });
        }
      } else if (activeGrip.kind === "insertion") {
        const ins = sketchInsertions[activeGrip.index];
        if (ins) { ins.x = finalSnapped.x; ins.y = finalSnapped.y; }
      }
      rebuildSpatialIndexes();
      updateLiveProperties();
    } else if (editorMode === "draw" && selectedVertexIndex !== -1) {
      if (layers["FOREGROUND"].frozen) return;
      sketchVertices[selectedVertexIndex] = finalSnapped;
      runConstraintSolver(selectedVertexIndex);
      rebuildSpatialIndexes();
      updateLiveProperties();
    }

    // Transform preview: restore seed + apply tentative xform
    if (xform.tool && xform.stage >= 1 && xform.base && xform.seed && ["move", "rotate", "mirror"].includes(xform.tool)) {
      restoreSeedGeometry(xform.seed);
      if (xform.tool === "move") applyXformToSeed(xform.seed, xform.base, finalSnapped, "move");
      else if (xform.tool === "rotate") applyXformToSeed(xform.seed, xform.base, finalSnapped, "rotate");
      else if (xform.tool === "mirror") applyXformToSeed(xform.seed, xform.base, finalSnapped, "mirror");
      rebuildSpatialIndexes();
    }

    drawSketchCanvas(
      editorMode === "draw" || editorMode === "circle" || editorMode === "rect" ||
      editorMode === "poly" || editorMode === "insert_block" ||
      editorMode === "dimension" || editorMode === "dim-diameter" || editorMode === "dim-radius" ||
      dimDraft != null || dimDragIndex >= 0 ||
      ["move", "copy", "rotate", "mirror", "offset"].includes(editorMode)
    );
  }

  function handleTransformClick(pos) {
    const snapPt = hoveredSnapTarget || pos;

    // Stage 0: need selection
    if (!selectedEntity && xform.stage === 0) {
      const hit = findEntityAt(pos, false);
      if (hit) {
        selectedEntity = hit;
        showEntityInspector();
        drawSketchCanvas();
        updateToolPromptUI();
        if (window.showToast) window.showToast("Entity selected — specify base point");
      } else if (window.showToast) {
        window.showToast("Select an entity first", false);
      }
      return;
    }

    if (xform.stage === 0) {
      xform.tool = editorMode;
      xform.base = { x: snapPt.x, y: snapPt.y };
      xform.seed = cloneEntityForXform(selectedEntity);
      xform.stage = 1;
      if (!xform.seed) {
        if (window.showToast) window.showToast("Cannot transform this entity type", false);
        xform = { tool: null, stage: 0, base: null, seed: null, preview: null };
        return;
      }
      pushUndo(editorMode);
      // For copy: keep original; seed still holds original coords
      updateToolPromptUI();
      return;
    }

    // Stage 1: second point completes
    if (xform.stage === 1) {
      const dest = { x: snapPt.x, y: snapPt.y };
      if (editorMode === "copy") {
        // Don't move original — pushUndo already saved; restore if preview moved
        restoreSeedGeometry(xform.seed);
        finishCopyFromSeed(xform.seed, xform.base, dest);
      } else if (editorMode === "move") {
        restoreSeedGeometry(xform.seed);
        applyXformToSeed(xform.seed, xform.base, dest, "move");
      } else if (editorMode === "rotate") {
        restoreSeedGeometry(xform.seed);
        applyXformToSeed(xform.seed, xform.base, dest, "rotate");
      } else if (editorMode === "mirror") {
        restoreSeedGeometry(xform.seed);
        // Mirror creates copy by default (CAD-ish) — keep original + mirrored copy
        const seedCopy = JSON.parse(JSON.stringify(xform.seed));
        // For circle/insertion/line create mirrored copy
        if (seedCopy.type === "circle") {
          const c = { ...seedCopy.data };
          const tmp = { type: "circle", index: sketchCircles.length, data: c };
          // apply mirror math into a temp object
          const ax = xform.base.x, ay = xform.base.y, bx = dest.x, by = dest.y;
          const mirrorPt = (px, py) => {
            const dxm = bx - ax, dym = by - ay;
            const len2 = dxm * dxm + dym * dym || 1;
            const t = ((px - ax) * dxm + (py - ay) * dym) / len2;
            return { x: 2 * (ax + t * dxm) - px, y: 2 * (ay + t * dym) - py };
          };
          const p = mirrorPt(c.cx, c.cy);
          sketchCircles.push({ ...c, cx: p.x, cy: p.y });
        } else if (seedCopy.type === "line") {
          applyXformToSeed(seedCopy, xform.base, dest, "mirror");
          // seedCopy indices still point at original — clone endpoints as new line
          const a = sketchVertices[seedCopy.indices[0]];
          const b = sketchVertices[seedCopy.indices[1]];
          // restore originals first
          restoreSeedGeometry(xform.seed);
          const start = sketchVertices.length;
          // recompute mirrored points from original seed data
          const ax = xform.base.x, ay = xform.base.y, bx = dest.x, by = dest.y;
          const mirrorPt = (px, py) => {
            const dxm = bx - ax, dym = by - ay;
            const len2 = dxm * dxm + dym * dym || 1;
            const t = ((px - ax) * dxm + (py - ay) * dym) / len2;
            return { x: 2 * (ax + t * dxm) - px, y: 2 * (ay + t * dym) - py };
          };
          sketchVertices.push(mirrorPt(seedCopy.data[0].x, seedCopy.data[0].y));
          sketchVertices.push(mirrorPt(seedCopy.data[1].x, seedCopy.data[1].y));
          sketchProfiles.push({ startIndex: start, count: 2, isClosed: false });
          activeProfileStartIndex = sketchVertices.length;
        } else {
          applyXformToSeed(xform.seed, xform.base, dest, "mirror");
        }
      }
      xform = { tool: null, stage: 0, base: null, seed: null, preview: null };
      rebuildSpatialIndexes();
      drawSketchCanvas();
      updateLiveProperties();
      setEditorMode("select");
    }
  }

  // --- Cleanup Unused Vertices in the database ---
  function cleanupUnusedVertices() {
    const usedIndices = new Set();
    
    // Profiles
    sketchProfiles.forEach(prof => {
      for (let i = 0; i < prof.count; i++) {
        usedIndices.add(prof.startIndex + i);
      }
    });
    
    // Custom linear dimensions reference vertices
    customDimensions.forEach(dim => {
      const nd = normalizeDim(dim);
      if (nd && nd.kind === "linear") {
        usedIndices.add(nd.v1);
        usedIndices.add(nd.v2);
      }
    });
    
    // Convert to sorted array
    const sortedUsed = Array.from(usedIndices).sort((a, b) => a - b);
    
    // Map old indices to new indices
    const indexMap = new Map();
    const newVertices = [];
    sortedUsed.forEach((oldIdx, newIdx) => {
      indexMap.set(oldIdx, newIdx);
      newVertices.push(sketchVertices[oldIdx]);
    });
    
    // Update profiles
    sketchProfiles.forEach(prof => {
      prof.startIndex = indexMap.get(prof.startIndex);
    });
    
    // Update custom dimensions (remap linear; keep radial as-is)
    customDimensions = customDimensions.filter(dim => {
      const nd = normalizeDim(dim);
      if (!nd) return false;
      if (nd.kind === "linear") {
        if (indexMap.has(nd.v1) && indexMap.has(nd.v2)) {
          dim.kind = "linear";
          dim.v1 = indexMap.get(nd.v1);
          dim.v2 = indexMap.get(nd.v2);
          return true;
        }
        return false;
      }
      // Radial dims are independent of vertex remapping
      return nd.kind === "radius" || nd.kind === "diameter";
    });
    
    // Update parametric constraints
    parametricConstraints = parametricConstraints.filter(pc => {
      const allExist = pc.targets.every(t => indexMap.has(t));
      if (allExist) {
        pc.targets = pc.targets.map(t => indexMap.get(t));
        return true;
      }
      return false;
    });
    
    sketchVertices = newVertices;
  }

  // --- Keyboard tracking for Ortho Lock ---
  window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
      shiftPressed = true;
      if (lastRawWorldPos) {
        updateMousePosition(lastRawWorldPos);
      } else {
        drawSketchCanvas();
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
      shiftPressed = false;
      if (lastRawWorldPos) {
        updateMousePosition(lastRawWorldPos);
      } else {
        drawSketchCanvas();
      }
    }
  });

  window.projectManagerConfig = {
    toolId: "drafting-board",
    getInputs: () => ({
      vertices: sketchVertices,
      profiles: sketchProfiles,
      activeProfileStartIndex: activeProfileStartIndex,
      circles: sketchCircles,
      insertions: sketchInsertions,
      customDimensions,
      isSketchClosed // keep for legacy parser support
    }),
    setInputs: (data) => {
      if (data && data.vertices) {
        sketchVertices = data.vertices;
        sketchCircles = data.circles || [];
        sketchInsertions = data.insertions || [];
        customDimensions = data.customDimensions || [];
        
        // Backwards compatibility for older single-profile files
        if (data.profiles) {
          sketchProfiles = data.profiles;
          activeProfileStartIndex = data.activeProfileStartIndex !== undefined ? data.activeProfileStartIndex : sketchVertices.length;
        } else {
          const legacyClosed = !!data.isSketchClosed;
          if (legacyClosed && sketchVertices.length >= 3) {
            sketchProfiles = [{ startIndex: 0, count: sketchVertices.length, isClosed: true }];
            activeProfileStartIndex = sketchVertices.length;
          } else {
            sketchProfiles = [];
            activeProfileStartIndex = 0;
          }
        }
        rebuildSpatialIndexes();
        drawSketchCanvas();
        updateLiveProperties();
      }
    }
  };

  // URL boot loading
  const urlParams = new URLSearchParams(window.location.search);
  const designParam = urlParams.get("design");
  if (designParam) {
    try {
      const decoded = (window.decodeShareState ? window.decodeShareState(designParam) : JSON.parse(decodeURIComponent(escape(atob(designParam)))));
      window.projectManagerConfig.setInputs(decoded);
    } catch (err) {
      console.error("Failed to parse URL design param:", err);
    }
  }

  // --- Viewport Settings Toggles ---
  window.toggleSnap = () => {
    window.snapEnabled = !window.snapEnabled;
    document.getElementById("snap-toggle")?.classList.toggle("active", window.snapEnabled);
    rebuildSpatialIndexes();
    if (lastRawWorldPos) {
      updateMousePosition(lastRawWorldPos);
    } else {
      drawSketchCanvas();
    }
  };

  window.toggleSnapFilterPanel = () => {
    const panel = document.getElementById("snap-filter-panel");
    if (!panel) return;
    panel.classList.toggle("hidden");
  };

  window.toggleCrosshair = () => {
    window.crosshairEnabled = !window.crosshairEnabled;
    document.getElementById("crosshair-toggle")?.classList.toggle("active", window.crosshairEnabled);
    drawSketchCanvas();
  };

  // Wire snap filter checkboxes
  document.querySelectorAll("#snap-filter-panel input[data-snap-type]").forEach(cb => {
    cb.addEventListener("change", () => {
      const t = cb.getAttribute("data-snap-type");
      if (t && window.snapFilters) window.snapFilters[t] = cb.checked;
      if (lastRawWorldPos) updateMousePosition(lastRawWorldPos);
      else drawSketchCanvas();
    });
  });

  window.toggleOrtho = () => {
    window.orthoLockEnabled = !window.orthoLockEnabled;
    document.getElementById("ortho-toggle")?.classList.toggle("active", window.orthoLockEnabled);
    if (lastRawWorldPos) {
      updateMousePosition(lastRawWorldPos);
    } else {
      drawSketchCanvas();
    }
  };

  window.toggleGrid = () => {
    window.gridVisible = !window.gridVisible;
    document.getElementById("grid-toggle").classList.toggle("active", window.gridVisible);
    drawSketchCanvas();
  };


  window.changeSheetSize = () => {
    sheetSize = document.getElementById("sheet-size-select").value;
    if (sheetSize === "A4") {
      sheetWidth = 297;
      sheetHeight = 210;
    } else if (sheetSize === "A3") {
      sheetWidth = 420;
      sheetHeight = 297;
    }
    if (webglRenderer) {
      webglRenderer.resetView(sheetWidth, sheetHeight);
    }
  };

  // --- Reset / Clear board ---
  window.clearSketchCanvas = () => {
    if (!confirm("Clear the entire drawing board?")) return;
    pushUndo("clear board");
    sketchVertices = [];
    sketchProfiles = [];
    activeProfileStartIndex = 0;
    sketchCircles = [];
    sketchInsertions = [];
    isSketchClosed = false;
    customDimensions = [];
    selectedVertexA = -1;
    selectedVertexB = -1;
    measureStartPos = null;
    measureEndPos = null;
    isMeasuring = false;
    selectedEntity = null;
    activeGrip = null;
    
    rebuildSpatialIndexes();
    showEntityInspector();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.undoSketchPoint = () => {
    const activeStart = activeProfileStartIndex;
    if (sketchVertices.length > activeStart) {
      sketchVertices.pop();
    } else if (sketchProfiles.length > 0) {
      const lastProf = sketchProfiles.pop();
      activeProfileStartIndex = lastProf.startIndex;
    }
    pruneInvalidDimensions();
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.closeSketchShape = () => {
    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;
    if (activeCount >= 3) {
      pushUndo("close shape");
      sketchProfiles.push({
        startIndex: activeStart,
        count: activeCount,
        isClosed: true
      });
      activeProfileStartIndex = sketchVertices.length;
      rebuildSpatialIndexes();
      drawSketchCanvas();
      updateLiveProperties();
    } else {
      alert("Please place at least 3 nodes before closing the shape.");
    }
  };

  // --- Render Dispatcher ---
  function drawSketchCanvas(drawCursorLine = false) {
    if (webglRenderer) {
      webglRenderer.updateDrawing({
        vertices: sketchVertices,
        profiles: sketchProfiles,
        activeProfileStartIndex: activeProfileStartIndex,
        circles: sketchCircles,
        isClosed: isSketchClosed,
        sheetWidth,
        sheetHeight,
        layers,
        insertions: sketchInsertions,
        blockDefinitions,
        selectedEntity,
        hoveredSnapTarget,
        drawCursorLine,
        mousePos,
        customDimensions,
        dimDraft,
        measureStartPos,
        measureEndPos,
        isMeasuring,
        editorMode,
        polySides,
        activeCircleCenter,
        activeRectStart,
        activePolyCenter,
        orthoLockEnabled: window.orthoLockEnabled || shiftPressed,
        crosshairEnabled: window.crosshairEnabled !== false,
        darkCanvas: !!window.darkCanvas,
        dimStyle,
        constraintIcons: getConstraintIcons(),
        grips: (editorMode === "select" && selectedEntity) ? getGripPoints(selectedEntity) : [],
        insertPreview: (editorMode === "insert_block" && activeBlockToInsert && mousePos)
          ? { blockName: activeBlockToInsert, x: mousePos.x, y: mousePos.y, scaleX: 1, scaleY: 1, rotation: 0 }
          : null
      });
    }
  }

  window.fitView = () => {
    // Single reframe control: extents if geometry exists, else fit sheet
    const hasGeom = sketchVertices.length > 0 || sketchCircles.length > 0 || sketchInsertions.length > 0;
    if (hasGeom) zoomExtents();
    else resetViewport();
  };

  // --- Smart Dimension & Fillet Modifiers ---
  function applyFillet(vertexIdx, radius) {
    const n = sketchVertices.length;
    if (n < 3) return;

    const prevIdx = (vertexIdx - 1 + n) % n;
    const nextIdx = (vertexIdx + 1) % n;

    const p = sketchVertices[vertexIdx];
    const p1 = sketchVertices[prevIdx];
    const p2 = sketchVertices[nextIdx];

    // Direction vectors
    const v1 = { x: p1.x - p.x, y: p1.y - p.y };
    const v2 = { x: p2.x - p.x, y: p2.y - p.y };

    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    if (len1 < 1e-3 || len2 < 1e-3) return;

    // Unit vectors
    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    const theta = Math.acos(u1.x * u2.x + u1.y * u2.y);
    const filletDist = radius / Math.tan(theta / 2);

    if (filletDist > len1 || filletDist > len2) {
      alert("Fillet radius too large for connecting segments.");
      return;
    }

    // Tangent points on segment
    const pt1 = { x: Math.round(p.x + filletDist * u1.x), y: Math.round(p.y + filletDist * u1.y) };
    const pt2 = { x: Math.round(p.x + filletDist * u2.x), y: Math.round(p.y + filletDist * u2.y) };

    // Insert new vertices in outline
    sketchVertices.splice(vertexIdx, 1, pt1, pt2);
    isSketchClosed = true;

    selectedEntity = null;
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
  }



  // --- Real-time Profile Properties Telemetry ---
  function updateLiveProperties() {
    let totalArea = 0;
    let sumAreaY = 0;
    let sumAreaX = 0;
    let listIxx = [];
    let listCentroids = [];
    let listAreas = [];

    // 1. Process Finalized Profiles
    sketchProfiles.forEach(prof => {
      const profVerts = sketchVertices.slice(prof.startIndex, prof.startIndex + prof.count);
      const props = calculatePolygonProperties(profVerts);
      if (props.A > 0.1) {
        listAreas.push(props.A);
        listCentroids.push({ x: props.xc, y: props.yc });
        listIxx.push(props.Iz);
        totalArea += props.A;
        sumAreaY += props.yc * props.A;
        sumAreaX += props.xc * props.A;
      }
    });

    // 2. Process Active Drafting Profile (if closed or enough vertices)
    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;
    if (activeCount >= 3) {
      const activeVerts = sketchVertices.slice(activeStart);
      const props = calculatePolygonProperties(activeVerts);
      if (props.A > 0.1) {
        listAreas.push(props.A);
        listCentroids.push({ x: props.xc, y: props.yc });
        listIxx.push(props.Iz);
        totalArea += props.A;
        sumAreaY += props.yc * props.A;
        sumAreaX += props.xc * props.A;
      }
    }

    // 3. Subtract Circular cutout holes globally
    sketchCircles.forEach(c => {
      if (c.construction) return;
      const holeArea = Math.PI * c.r * c.r;
      totalArea -= holeArea;
      sumAreaY -= c.cy * holeArea;
      sumAreaX -= c.cx * holeArea;
    });

    if (totalArea < 0.1) {
      document.getElementById("sk-area").textContent = "0.0 cm²";
      document.getElementById("sk-inertia").textContent = "0.0 cm⁴";
      document.getElementById("sk-centroid").textContent = "0.0 mm";
      document.getElementById("sk-height").textContent = "0.0 mm";
      updateProfileHealth();
      return;
    }

    const netYc = sumAreaY / totalArea;
    const netXc = sumAreaX / totalArea;

    // Parallel Axis Theorem for centroidal Moment of Inertia Iz
    let netIz = 0;
    listAreas.forEach((area, idx) => {
      const yc = listCentroids[idx].y;
      const Iz = listIxx[idx];
      netIz += Iz + area * Math.pow(yc - netYc, 2);
    });

    sketchCircles.forEach(c => {
      if (c.construction) return;
      const holeArea = Math.PI * c.r * c.r;
      const Ic = (Math.PI * Math.pow(c.r, 4)) / 4.0;
      const Ic_shifted = Ic + holeArea * Math.pow(c.cy - netYc, 2);
      netIz -= Ic_shifted;
    });

    // Bounding height across all coordinates
    let ymin = Infinity;
    let ymax = -Infinity;
    sketchVertices.forEach(v => {
      ymin = Math.min(ymin, v.y);
      ymax = Math.max(ymax, v.y);
    });
    const height = ymin !== Infinity ? ymax - ymin : 0;

    document.getElementById("sk-area").textContent = `${(totalArea / 100).toFixed(1)} cm²`;
    document.getElementById("sk-inertia").textContent = `${(Math.max(0, netIz) / 10000).toFixed(1)} cm⁴`;
    document.getElementById("sk-centroid").textContent = `${netYc.toFixed(1)} mm`;
    document.getElementById("sk-height").textContent = `${height.toFixed(1)} mm`;
    updateProfileHealth();
  }

  function calculatePolygonProperties(vertices) {
    const n = vertices.length;
    if (n < 3) return { A: 0, xc: 0, yc: 0, Iz: 0, height: 0 };
    
    let areaOuter = 0;
    let cxOuter = 0;
    let cyOuter = 0;
    
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      const factor = (p1.x * p2.y - p2.x * p1.y);
      areaOuter += factor;
      cxOuter += (p1.x + p2.x) * factor;
      cyOuter += (p1.y + p2.y) * factor;
    }
    
    areaOuter = areaOuter / 2.0;
    if (Math.abs(areaOuter) < 0.1) {
      return { A: 0, xc: 0, yc: 0, Iz: 0, height: 0 };
    }
    
    cxOuter = cxOuter / (6.0 * areaOuter);
    cyOuter = cyOuter / (6.0 * areaOuter);
    areaOuter = Math.abs(areaOuter);
    
    let Ixx_originOuter = 0;
    let ymin = Infinity;
    let ymax = -Infinity;
    
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      ymin = Math.min(ymin, p1.y);
      ymax = Math.max(ymax, p1.y);
      
      const term1 = p1.y * p1.y + p1.y * p2.y + p2.y * p2.y;
      const term2 = p1.x * p2.y - p2.x * p1.y;
      Ixx_originOuter += term1 * term2;
    }
    Ixx_originOuter = Math.abs(Ixx_originOuter / 12.0);
    let IzOuter = Ixx_originOuter - areaOuter * cyOuter * cyOuter;
    
    return {
      A: areaOuter,
      xc: cxOuter,
      yc: cyOuter,
      Iz: Math.max(0, IzOuter),
      height: Math.max(0, ymax - ymin)
    };
  }

  // --- Interaction / State Machine Mouse Listeners ---
  function initSketcherEvents() {
    canvasEl.addEventListener("mousedown", (e) => {
      // Pan handling: middle/right click, Space, or active Pan mode
      const isPanMode = editorMode === "pan" || e.shiftKey || spacePanHeld;
      if (e.button === 1 || e.button === 2 || (e.button === 0 && isPanMode)) {
        return; // Panning handled inside ExplicitCadRenderer
      }

      const pos = webglRenderer.getMouseWorldPos(e.clientX, e.clientY);

      // Sizer locked layers check
      if (["draw", "circle", "rect", "poly", "fillet", "trim"].includes(editorMode) && layers["FOREGROUND"].frozen) {
        alert("The FOREGROUND layer is frozen.");
        return;
      }

      // ── SELECT MODE (grips + pick + dim drag) ──
      if (editorMode === "select") {
        const grip = findGripAt(pos);
        if (grip && grip.kind !== "mid") {
          activeGrip = grip;
          if (grip.kind === "vertex") selectedVertexIndex = grip.index;
          pushUndo("grip edit");
          updateToolPromptUI();
          return;
        }
        const hit = findEntityAt(pos, false);
        if (hit && hit.type === "dimension") {
          selectedEntity = hit;
          dimDragIndex = hit.index;
          pushUndo("move dimension");
          showEntityInspector();
          updateToolPromptUI();
          drawSketchCanvas();
          return;
        }
        if (hit && hit.type === "vertex") {
          selectedVertexIndex = hit.index;
          selectedEntity = hit;
          activeGrip = { kind: "vertex", index: hit.index };
          dimDragIndex = -1;
        } else {
          selectedVertexIndex = -1;
          selectedEntity = hit;
          activeGrip = null;
          dimDragIndex = -1;
        }
        showEntityInspector();
        updateToolPromptUI();
        drawSketchCanvas();
        return;
      }

      // ── TRANSFORM TOOLS: move / copy / rotate / mirror ──
      if (["move", "copy", "rotate", "mirror"].includes(editorMode)) {
        handleTransformClick(pos);
        return;
      }

      // ── OFFSET ──
      if (editorMode === "offset") {
        if (!selectedEntity || selectedEntity.type !== "line") {
          const hit = findEntityAt(pos, true);
          if (hit && hit.type === "line") {
            selectedEntity = hit;
            showEntityInspector();
            updateToolPromptUI();
            drawSketchCanvas();
            if (window.showToast) window.showToast("Line selected — type offset distance or click side");
          } else if (window.showToast) {
            window.showToast("Select a line first", false);
          }
          return;
        }
        // Second click: side of line determines sign of offset
        const seed = cloneEntityForXform(selectedEntity);
        if (seed && seed.type === "line") {
          const a = seed.data[0], b = seed.data[1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          // signed distance from point to line
          const cross = (pos.x - a.x) * dy - (pos.y - a.y) * dx;
          const sign = cross >= 0 ? 1 : -1;
          const dist = Math.abs(cross) / len || 5;
          pushUndo("offset");
          offsetLineEntity(selectedEntity, sign * Math.max(dist, 0.5));
          rebuildSpatialIndexes();
          drawSketchCanvas();
          updateLiveProperties();
          setEditorMode("select");
        }
        return;
      }

      // ── EXTEND ──
      if (editorMode === "extend") {
        const hit = findEntityAt(pos, true);
        if (hit && hit.type === "line") {
          pushUndo("extend");
          if (extendLineEntity(hit, pos)) {
            rebuildSpatialIndexes();
            drawSketchCanvas();
            updateLiveProperties();
            if (window.showToast) window.showToast("Segment extended");
          }
        }
        return;
      }

      // ── BLOCK INSERTION ──
      if (editorMode === "insert_block" && activeBlockToInsert) {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y);
        sketchInsertions.push({
          blockName: activeBlockToInsert,
          x: snapPt.x, y: snapPt.y,
          scaleX: 1, scaleY: 1, rotation: 0
        });
        activeBlockToInsert = null;
        setEditorMode("select");
        
        rebuildSpatialIndexes();
        drawSketchCanvas();
        updateLiveProperties();
        return;
      }

      // Coordinate click hit check
      const clicked = findEntityAt(pos, editorMode === "trim");

      // ── TRIM GEOMETRY ──
      if (editorMode === "trim") {
        if (!clicked) return;

        if (clicked.type === "circle") {
          sketchCircles.splice(clicked.index, 1);
          rebuildSpatialIndexes();
          drawSketchCanvas();
          updateLiveProperties();
          return;
        }

        if (clicked.type === "line") {
          let targetProfile = null;
          let targetProfileIndex = -1;
          let segmentLocalIndex = -1;

          for (let pIdx = 0; pIdx < sketchProfiles.length; pIdx++) {
            const prof = sketchProfiles[pIdx];
            const limit = prof.isClosed ? prof.count : prof.count - 1;
            for (let i = 0; i < limit; i++) {
              if (prof.startIndex + i === clicked.index) {
                targetProfile = prof;
                targetProfileIndex = pIdx;
                segmentLocalIndex = i;
                break;
              }
            }
            if (targetProfile) break;
          }

          if (targetProfileIndex === -1) return;

          const vIdxStart = targetProfile.startIndex + segmentLocalIndex;
          const vIdxEnd = targetProfile.startIndex + (segmentLocalIndex + 1) % targetProfile.count;
          const A = sketchVertices[vIdxStart];
          const B = sketchVertices[vIdxEnd];

          const intersections = [];
          const dirX = B.x - A.x;
          const dirY = B.y - A.y;
          const lenSq = dirX * dirX + dirY * dirY;
          if (lenSq < 1e-6) return;

          function addT(t, pt) {
            if (t > 1e-4 && t < 1 - 1e-4) {
              intersections.push({ t, pt });
            }
          }

          // Line-line intersection
          sketchProfiles.forEach((prof) => {
            const limit = prof.isClosed ? prof.count : prof.count - 1;
            for (let i = 0; i < limit; i++) {
              const otherIdxStart = prof.startIndex + i;
              const otherIdxEnd = prof.startIndex + (i + 1) % prof.count;
              if (otherIdxStart === vIdxStart) continue;

              const C = sketchVertices[otherIdxStart];
              const D = sketchVertices[otherIdxEnd];

              const denom = (B.x - A.x) * (D.y - C.y) - (B.y - A.y) * (D.x - C.x);
              if (Math.abs(denom) > 1e-8) {
                const t = ((C.x - A.x) * (D.y - C.y) - (C.y - A.y) * (D.x - C.x)) / denom;
                const u = ((C.x - A.x) * (B.y - A.y) - (C.y - A.y) * (B.x - A.x)) / denom;
                if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                  const pt = {
                    x: Math.round(A.x + t * (B.x - A.x)),
                    y: Math.round(A.y + t * (B.y - A.y))
                  };
                  addT(t, pt);
                }
              }
            }
          });

          // Line-circle intersection
          sketchCircles.forEach((c) => {
            const vx = A.x - c.cx;
            const vy = A.y - c.cy;
            const a = lenSq;
            const b = 2 * (vx * dirX + vy * dirY);
            const cc = vx * vx + vy * vy - c.r * c.r;
            const disc = b * b - 4 * a * cc;
            if (disc >= 0) {
              const t1 = (-b - Math.sqrt(disc)) / (2 * a);
              const t2 = (-b + Math.sqrt(disc)) / (2 * a);
              if (t1 >= 0 && t1 <= 1) {
                const pt1 = {
                  x: Math.round(A.x + t1 * dirX),
                  y: Math.round(A.y + t1 * dirY)
                };
                addT(t1, pt1);
              }
              if (t2 >= 0 && t2 <= 1) {
                const pt2 = {
                  x: Math.round(A.x + t2 * dirX),
                  y: Math.round(A.y + t2 * dirY)
                };
                addT(t2, pt2);
              }
            }
          });

          intersections.sort((a, b) => a.t - b.t);

          const tList = [{ t: 0, pt: A }];
          intersections.forEach(inter => {
            if (Math.abs(inter.t - tList[tList.length - 1].t) > 1e-4) {
              tList.push(inter);
            }
          });
          if (Math.abs(1 - tList[tList.length - 1].t) > 1e-4) {
            tList.push({ t: 1, pt: B });
          }

          const projDot = (pos.x - A.x) * dirX + (pos.y - A.y) * dirY;
          const clickT = projDot / lenSq;

          let trimIdx = -1;
          for (let i = 0; i < tList.length - 1; i++) {
            if (clickT >= tList[i].t && clickT <= tList[i+1].t) {
              trimIdx = i;
              break;
            }
          }
          if (trimIdx === -1) {
            let minDist = Infinity;
            for (let i = 0; i < tList.length - 1; i++) {
              const midT = (tList[i].t + tList[i+1].t) / 2;
              const midPt = { x: A.x + midT * dirX, y: A.y + midT * dirY };
              const dist = Math.hypot(pos.x - midPt.x, pos.y - midPt.y);
              if (dist < minDist) {
                minDist = dist;
                trimIdx = i;
              }
            }
          }

          const segmentsToKeep = [];
          const limit = targetProfile.isClosed ? targetProfile.count : targetProfile.count - 1;
          for (let i = 0; i < limit; i++) {
            if (i === segmentLocalIndex) continue;
            const vS = targetProfile.startIndex + i;
            const vE = targetProfile.startIndex + (i + 1) % targetProfile.count;
            segmentsToKeep.push({ p1: sketchVertices[vS], p2: sketchVertices[vE] });
          }

          for (let i = 0; i < tList.length - 1; i++) {
            if (i === trimIdx) continue;
            segmentsToKeep.push({ p1: tList[i].pt, p2: tList[i+1].pt });
          }

          sketchProfiles.splice(targetProfileIndex, 1);

          const newPolylines = [];
          const remainingSegs = [...segmentsToKeep];

          while (remainingSegs.length > 0) {
            const first = remainingSegs.shift();
            const poly = [first.p1, first.p2];
            let grown = true;

            while (grown) {
              grown = false;
              const endPt = poly[poly.length - 1];
              for (let i = 0; i < remainingSegs.length; i++) {
                const s = remainingSegs[i];
                if (Math.hypot(s.p1.x - endPt.x, s.p1.y - endPt.y) < 1e-2) {
                  poly.push(s.p2);
                  remainingSegs.splice(i, 1);
                  grown = true;
                  break;
                } else if (Math.hypot(s.p2.x - endPt.x, s.p2.y - endPt.y) < 1e-2) {
                  poly.push(s.p1);
                  remainingSegs.splice(i, 1);
                  grown = true;
                  break;
                }
              }
            }

            grown = true;
            while (grown) {
              grown = false;
              const startPt = poly[0];
              for (let i = 0; i < remainingSegs.length; i++) {
                const s = remainingSegs[i];
                if (Math.hypot(s.p2.x - startPt.x, s.p2.y - startPt.y) < 1e-2) {
                  poly.unshift(s.p1);
                  remainingSegs.splice(i, 1);
                  grown = true;
                  break;
                } else if (Math.hypot(s.p1.x - startPt.x, s.p1.y - startPt.y) < 1e-2) {
                  poly.unshift(s.p2);
                  remainingSegs.splice(i, 1);
                  grown = true;
                  break;
                }
              }
            }

            let isClosed = false;
            if (poly.length >= 4 && Math.hypot(poly[0].x - poly[poly.length - 1].x, poly[0].y - poly[poly.length - 1].y) < 1e-2) {
              isClosed = true;
              poly.pop();
            }
            newPolylines.push({ vertices: poly, isClosed });
          }

          newPolylines.forEach(p => {
            const sIdx = sketchVertices.length;
            sketchVertices.push(...p.vertices);
            sketchProfiles.push({
              startIndex: sIdx,
              count: p.vertices.length,
              isClosed: p.isClosed
            });
          });

          cleanupUnusedVertices();

          rebuildSpatialIndexes();
          drawSketchCanvas();
          updateLiveProperties();
        }
        return;
      }

      // ── SMART DIMENSION (professional place workflow) ──
      if (editorMode === "dimension" || editorMode === "dim-diameter" || editorMode === "dim-radius") {
        // Place step: second click commits position
        if (dimDraft && dimDraft.phase === "place") {
          updateDimDraftFromMouse(pos);
          commitDimDraft();
          return;
        }

        const snapPt = hoveredSnapTarget || pos;
        // Prefer geometry so existing dimensions don't block picking lines/circles
        const hit = clicked || findEntityAt(pos, { preferGeometry: true, excludeDimensions: true });

        // Explicit radial tools
        if (editorMode === "dim-diameter" || editorMode === "dim-radius") {
          if (hit && hit.type === "circle") {
            startRadialDimPlace(hit.index, editorMode === "dim-radius" ? "radius" : "diameter");
            drawSketchCanvas();
          } else if (window.showToast) {
            window.showToast("Click a circle for radial dimension", false);
          }
          return;
        }

        // Smart Dim: line → linear; circle → diameter (Shift = radius); vertex → two-point
        if (hit && hit.type === "circle") {
          startRadialDimPlace(hit.index, e.shiftKey ? "radius" : "diameter");
          drawSketchCanvas();
          return;
        }
        if (hit && hit.type === "line") {
          const ends = (() => {
            const idx = hit.index;
            let i2 = idx + 1;
            for (const prof of sketchProfiles) {
              const limit = prof.isClosed ? prof.count : prof.count - 1;
              for (let i = 0; i < limit; i++) {
                if (prof.startIndex + i === idx) {
                  i2 = prof.startIndex + (i + 1) % prof.count;
                }
              }
            }
            return [idx, i2];
          })();
          if (sketchVertices[ends[0]] && sketchVertices[ends[1]]) {
            startLinearDimPlace(ends[0], ends[1]);
            drawSketchCanvas();
          }
          return;
        }
        if (hit && hit.type === "vertex") {
          if (selectedVertexA === -1) {
            selectedVertexA = hit.index;
            updateToolPromptUI();
          } else if (selectedVertexA !== hit.index) {
            startLinearDimPlace(selectedVertexA, hit.index);
            selectedVertexA = -1;
            drawSketchCanvas();
          }
          return;
        }
        // Click empty: try snap endpoint as vertex pick
        if (hoveredSnapTarget && hoveredSnapTarget.type === "endpoint" && hoveredSnapTarget.index != null) {
          if (selectedVertexA === -1) {
            selectedVertexA = hoveredSnapTarget.index;
            updateToolPromptUI();
          } else if (selectedVertexA !== hoveredSnapTarget.index) {
            startLinearDimPlace(selectedVertexA, hoveredSnapTarget.index);
            selectedVertexA = -1;
            drawSketchCanvas();
          }
          return;
        }
        if (window.showToast) window.showToast("Click a line, circle, or two points", false);
        return;
      }

      // ── FILLET CORNER ──
      if (editorMode === "fillet") {
        if (clicked && clicked.type === "vertex") {
          const rPrompt = prompt("Enter fillet radius in mm:", "10");
          if (rPrompt !== null) {
            const rad = parseFloat(rPrompt);
            if (!isNaN(rad) && rad > 0) {
              applyFillet(clicked.index, rad);
            }
          }
        }
        return;
      }

      // ── MEASURE RULER ──
      if (editorMode === "measure") {
        const snapped = snapToGrid(pos.x, pos.y);
        if (!isMeasuring) {
          measureStartPos = snapped;
          measureEndPos = null;
          isMeasuring = true;
          document.getElementById("sketcher-instruction").textContent = "Move mouse and click to end measurement.";
        } else {
          measureEndPos = snapped;
          isMeasuring = false;
          const dist = Math.round(Math.hypot(measureEndPos.x - measureStartPos.x, measureEndPos.y - measureStartPos.y));
          document.getElementById("sketcher-instruction").textContent = `Measured Distance: ${dist} mm.`;
        }
        drawSketchCanvas();
        return;
      }

      // ── CIRCLE DRAWING ──
      if (editorMode === "circle") {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y);
        if (!activeCircleCenter) {
          activeCircleCenter = snapPt;
        } else {
          const radius = Math.round(Math.hypot(snapPt.x - activeCircleCenter.x, snapPt.y - activeCircleCenter.y));
          if (radius > 1) {
            pushUndo("circle");
            sketchCircles.push({
              cx: activeCircleCenter.x,
              cy: activeCircleCenter.y,
              r: radius,
              construction: false,
              layer: activeLayerName
            });
          }
          activeCircleCenter = null;
          rebuildSpatialIndexes();
          drawSketchCanvas();
          updateLiveProperties();
        }
        return;
      }

      // ── RECTANGLE DRAWING ──
      if (editorMode === "rect") {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y);
        if (!activeRectStart) {
          activeRectStart = snapPt;
        } else {
          let finalPt = snapPt;
          if (shiftPressed) {
            const w = snapPt.x - activeRectStart.x;
            const h = snapPt.y - activeRectStart.y;
            const side = Math.max(Math.abs(w), Math.abs(h));
            finalPt = {
              x: activeRectStart.x + Math.sign(w) * side,
              y: activeRectStart.y + Math.sign(h) * side
            };
          }
          const startIdx = sketchVertices.length;
          sketchVertices.push(
            { x: activeRectStart.x, y: activeRectStart.y },
            { x: finalPt.x, y: activeRectStart.y },
            { x: finalPt.x, y: finalPt.y },
            { x: activeRectStart.x, y: finalPt.y }
          );
          sketchProfiles.push({
            startIndex: startIdx,
            count: 4,
            isClosed: true
          });
          activeProfileStartIndex = sketchVertices.length;
          activeRectStart = null;
          rebuildSpatialIndexes();
          drawSketchCanvas();
          updateLiveProperties();
        }
        return;
      }

      // ── POLYGON DRAWING ──
      if (editorMode === "poly") {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y);
        if (!activePolyCenter) {
          activePolyCenter = snapPt;
        } else {
          const radius = Math.round(Math.hypot(snapPt.x - activePolyCenter.x, snapPt.y - activePolyCenter.y));
          if (radius > 2) {
            const step = (2 * Math.PI) / polySides;
            const angle = Math.atan2(snapPt.y - activePolyCenter.y, snapPt.x - activePolyCenter.x);
            const startIdx = sketchVertices.length;
            for (let i = 0; i < polySides; i++) {
              const theta = angle + i * step;
              sketchVertices.push({
                x: Math.round(activePolyCenter.x + radius * Math.cos(theta)),
                y: Math.round(activePolyCenter.y + radius * Math.sin(theta))
              });
            }
            sketchProfiles.push({
              startIndex: startIdx,
              count: polySides,
              isClosed: true
            });
            activeProfileStartIndex = sketchVertices.length;
          }
          activePolyCenter = null;
          rebuildSpatialIndexes();
          drawSketchCanvas();
          updateLiveProperties();
        }
        return;
      }

      // ── LINE DRAWING / IDLE SELECT ──
      if (editorMode === "draw") {
        if (clicked && clicked.type === "vertex") {
          // Select corner handle for dragging
          selectedVertexIndex = clicked.index;
          selectedEntity = clicked;
          showEntityInspector();
          return;
        }

        let snapPt = snapToGrid(pos.x, pos.y);
        if (hoveredSnapTarget) snapPt = hoveredSnapTarget;

        const activeStart = activeProfileStartIndex;
        const activeCount = sketchVertices.length - activeStart;

        // Ortho angle lock
        if ((shiftPressed || window.orthoLockEnabled) && activeCount > 0) {
          const last = sketchVertices[sketchVertices.length - 1];
          const dx = Math.abs(snapPt.x - last.x);
          const dy = Math.abs(snapPt.y - last.y);
          if (dx > dy) snapPt.y = last.y;
          else snapPt.x = last.x;
        }

        // Closed loop checker
        if (activeCount >= 3) {
          const start = sketchVertices[activeStart];
          if (Math.hypot(snapPt.x - start.x, snapPt.y - start.y) < 14) {
            sketchProfiles.push({
              startIndex: activeStart,
              count: activeCount,
              isClosed: true
            });
            activeProfileStartIndex = sketchVertices.length;
            rebuildSpatialIndexes();
            drawSketchCanvas();
            updateLiveProperties();
            return;
          }
        }

        if ((sketchVertices.length - activeProfileStartIndex) === 0) pushUndo("line");
        sketchVertices.push(snapPt);
        lastAnchorPos = { x: snapPt.x, y: snapPt.y };
        rebuildSpatialIndexes();
        drawSketchCanvas();
        updateLiveProperties();
        updateToolPromptUI();
      }
    });

    canvasEl.addEventListener("mousemove", (e) => {
      clientCursorPos = { x: e.clientX, y: e.clientY };
      const pos = webglRenderer.getMouseWorldPos(e.clientX, e.clientY);
      updateMousePosition(pos);
      positionCursorPrompt();
    });

    canvasEl.addEventListener("mouseup", (e) => {
      if (editorMode === "select") {
        activeGrip = null;
        dimDragIndex = -1;
      } else {
        selectedVertexIndex = -1;
      }
    });

    // Dynamic input apply
    document.getElementById("dyn-input-apply")?.addEventListener("click", applyDynInputValue);
    document.getElementById("dyn-input-field")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyDynInputValue();
      }
    });
    document.getElementById("status-layer-select")?.addEventListener("change", (e) => {
      activeLayerName = e.target.value || "FOREGROUND";
      updateToolPromptUI();
    });

    // Escape → cancel in-progress command and return to Select
    window.addEventListener("keydown", (e) => {
      // Don't steal keys from inputs
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Space = temporary pan
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spacePanHeld = true;
        window.editorMode = "pan"; // renderer checks this for pan drag
        updateToolPromptUI();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        cadUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        cadRedo();
        return;
      }

      // Command palette / shortcuts help
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openShortcuts();
        return;
      }
      if (e.key === "Escape") {
        const palette = document.getElementById("cmd-palette-overlay");
        if (palette && !palette.classList.contains("hidden")) {
          closeCommandPalette();
          return;
        }
        const sc = document.getElementById("shortcuts-modal");
        if (sc && !sc.classList.contains("hidden")) {
          sc.classList.add("hidden");
          return;
        }
      }

      // Tool shortcuts
      const key = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (key === "v") { setEditorMode("select"); return; }
        if (key === "l") { setEditorMode("draw"); return; }
        if (key === "c") { setEditorMode("circle"); return; }
        if (key === "r") { setEditorMode("rect"); return; }
        if (key === "p") { setEditorMode("poly"); return; }
        if (key === "d") { setEditorMode("dimension"); return; }
        if (key === "m") { setEditorMode("measure"); return; }
        if (key === "f") { setEditorMode("fillet"); return; }
        if (key === "t") { setEditorMode("trim"); return; }
        if (key === "x") { setEditorMode("extend"); return; }
        if (key === "o") { setEditorMode("offset"); return; }
        if (key === "g") { setEditorMode("move"); return; }
        if (key === "y") { setEditorMode("copy"); return; }
        if (key === "q") { setEditorMode("rotate"); return; }
        if (key === "i") { setEditorMode("mirror"); return; }
        if (key === "h") { setEditorMode("pan"); return; }
        // Type digit → focus dynamic input while drawing
        if ((editorMode === "draw" || editorMode === "offset" || editorMode === "rotate") && /[0-9@.\-]/.test(e.key)) {
          const bar = document.getElementById("dyn-input-bar");
          const field = document.getElementById("dyn-input-field");
          if (bar && field && bar.classList.contains("hidden") === false) {
            // already visible
          } else {
            showDynInput(true);
          }
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEntity && editorMode === "select") {
          e.preventDefault();
          deleteSelectedEntity();
        }
        return;
      }

      if (e.key === "Escape") {
        cancelCurrentCommand(true);
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        spacePanHeld = false;
        window.editorMode = editorMode; // restore real mode for renderer
        updateToolPromptUI();
      }
    });

  }

  function cancelCurrentCommand(returnToSelect) {
    if (editorMode === "draw") {
      const activeStart = activeProfileStartIndex;
      const activeCount = sketchVertices.length - activeStart;
      if (activeCount >= 2) {
        sketchProfiles.push({
          startIndex: activeStart,
          count: activeCount,
          isClosed: false
        });
      } else {
        sketchVertices.splice(activeStart);
      }
      activeProfileStartIndex = sketchVertices.length;
    }

    // Restore any in-progress transform preview
    if (xform.seed) restoreSeedGeometry(xform.seed);

    selectedEntity = null;
    selectedVertexIndex = -1;
    activeGrip = null;
    dimDraft = null;
    dimDragIndex = -1;
    selectedVertexA = -1;
    selectedVertexB = -1;
    activeCircleCenter = null;
    activeRectStart = null;
    activePolyCenter = null;
    activeBlockToInsert = null;
    isMeasuring = false;
    measureStartPos = null;
    measureEndPos = null;
    lastAnchorPos = null;
    xform = { tool: null, stage: 0, base: null, seed: null, preview: null };
    showDynInput(false);

    rebuildSpatialIndexes();
    showEntityInspector();
    updateLiveProperties();

    if (returnToSelect) {
      setEditorMode("select");
    } else if (lastRawWorldPos) {
      updateMousePosition(lastRawWorldPos);
    } else {
      drawSketchCanvas();
      updateToolPromptUI();
    }
  }

  function deleteSelectedEntity() {
    if (!selectedEntity) return;
    pushUndo("delete");
    const idx = selectedEntity.index;
    if (selectedEntity.type === "circle") {
      sketchCircles.splice(idx, 1);
      customDimensions = customDimensions.filter(dim => {
        const nd = normalizeDim(dim);
        if (!nd) return false;
        if (nd.kind === "radius" || nd.kind === "diameter") {
          if (nd.circleIndex === idx) return false;
          if (nd.circleIndex > idx) dim.circleIndex = nd.circleIndex - 1;
          return true;
        }
        return true;
      });
    } else if (selectedEntity.type === "insertion") {
      sketchInsertions.splice(idx, 1);
    } else if (selectedEntity.type === "vertex") {
      // Leave complex vertex delete to avoid breaking profiles — soft clear selection only
      if (window.showToast) window.showToast("Delete full segments with Trim, or Clear Board.", false);
      selectedEntity = null;
      rebuildSpatialIndexes();
      drawSketchCanvas();
      return;
    } else if (selectedEntity.type === "dimension") {
      customDimensions.splice(idx, 1);
    } else if (selectedEntity.type === "line") {
      // Delete line segment by converting profile — mark endpoints only soft message
      if (window.showToast) window.showToast("Use Trim to remove segments from polylines.", false);
      selectedEntity = null;
      drawSketchCanvas();
      return;
    }
    selectedEntity = null;
    activeGrip = null;
    rebuildSpatialIndexes();
    showEntityInspector();
    updateLiveProperties();
    drawSketchCanvas();
    updateToolPromptUI();
  }

  // --- Inspector View Controller ---
  function showEntityInspector() {
    const panel = document.getElementById("sidebar-inspector-section");
    const container = document.getElementById("inspector-fields-container");
    if (!panel || !container) return;

    panel.classList.remove("hidden");

    // Sizer Calculator Overlay Checks
    if (window.activeSizerModule) {
      panel.classList.remove("hidden");
      if (window.activeSizerModule === "BUSBAR") {
        container.innerHTML = `
          <div class="inspector-fields">
            <div class="inspector-title">Busbar Sizer</div>
            <div class="inspector-row">
              <label>Target Current (A)</label>
              <input type="number" id="busbar-current" value="800" step="50" onchange="runBusbarSizer()">
            </div>
            <div class="inspector-row">
              <label>Material</label>
              <select id="busbar-material" onchange="runBusbarSizer()" class="form-select" style="width: 100px; height: 32px; font-size: 11px;">
                <option value="copper">Copper</option>
                <option value="aluminum">Aluminum</option>
              </select>
            </div>
            <div class="inspector-row">
              <label>Temp Rise (°C)</label>
              <input type="number" id="busbar-temp" value="30" step="5" onchange="runBusbarSizer()">
            </div>
            <div class="inspector-row" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
              <span>Sized Width:</span>
              <span id="busbar-width-res" style="font-weight: bold; color: var(--accent-primary);">80 mm</span>
            </div>
            <div class="inspector-row">
              <span>Sized Thickness:</span>
              <span id="busbar-thick-res" style="font-weight: bold; color: var(--accent-primary);">12 mm</span>
            </div>
            <button class="action-btn primary" onclick="redraftBusbarGeometry()" style="width: 100%; margin-top: 12px; height: 32px; font-size: 11px;">
              Redraft Busbar Profile
            </button>
          </div>
        `;
        runBusbarSizer();
      }
      else if (window.activeSizerModule === "THERMAL") {
        container.innerHTML = `
          <div class="inspector-fields">
            <div class="inspector-title">Cable Conductor Solver</div>
            <div class="inspector-row">
              <label>Design Current (A)</label>
              <input type="number" id="cable-current" value="120" step="10" onchange="runCableSizer()">
            </div>
            <div class="inspector-row">
              <label>Length (m)</label>
              <input type="number" id="cable-length" value="50" step="5" onchange="runCableSizer()">
            </div>
            <div class="inspector-row">
              <label>Allowable Loss (%)</label>
              <input type="number" id="cable-loss" value="3.0" step="0.5" onchange="runCableSizer()">
            </div>
            <div class="inspector-row" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
              <span>Req. Area:</span>
              <span id="cable-area-res" style="font-weight: bold; color: var(--accent-primary);">35 mm²</span>
            </div>
            <div class="inspector-row">
              <span>Conductor Diameter:</span>
              <span id="cable-diam-res" style="font-weight: bold; color: var(--accent-primary);">6.7 mm</span>
            </div>
            <button class="action-btn primary" onclick="redraftCableGeometry()" style="width: 100%; margin-top: 12px; height: 32px; font-size: 11px;">
              Redraft Conductor Circle
            </button>
          </div>
        `;
        runCableSizer();
      }
      else if (window.activeSizerModule === "BEAM") {
        container.innerHTML = `
          <div class="inspector-fields">
            <div class="inspector-title">Beam Deflection Solver</div>
            <div class="inspector-row">
              <label>Force Load (kN)</label>
              <input type="number" id="beam-load" value="25" step="5" onchange="runBeamSizer()">
            </div>
            <div class="inspector-row">
              <label>Span Length (mm)</label>
              <input type="number" id="beam-length" value="3000" step="200" onchange="runBeamSizer()">
            </div>
            <div class="inspector-row" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
              <span>Max Deflection:</span>
              <span id="beam-deflect-res" style="font-weight: bold; color: #ef4444;">12.4 mm</span>
            </div>
            <button class="action-btn primary" onclick="redraftBeamDeflection()" style="width: 100%; margin-top: 12px; height: 32px; font-size: 11px;">
              Plot Bending Deflection
            </button>
          </div>
        `;
        runBeamSizer();
      }
      return;
    }

    if (!selectedEntity) {
      panel.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const idx = selectedEntity.index;

    if (selectedEntity.type === "circle") {
      const c = sketchCircles[idx];
      if (!c) return;

      const diam = c.r * 2;
      let keywayInfo = "No standard keyway recommendation";
      for (const range in ParallelKeys) {
        const [minD, maxD] = range.split("-").map(Number);
        if (diam >= minD && diam <= maxD) {
          const spec = ParallelKeys[range];
          keywayInfo = `Key: ${spec.width}x${spec.height}mm (Depth: ${spec.keywayShaft}mm)`;
          break;
        }
      }

      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Circle Entity</div>
          <div class="inspector-row">
            <label>Center X (mm)</label>
            <input type="number" value="${c.cx}" onchange="updateSelectedEntityParam('cx', this.value)">
          </div>
          <div class="inspector-row">
            <label>Center Y (mm)</label>
            <input type="number" value="${c.cy}" onchange="updateSelectedEntityParam('cy', this.value)">
          </div>
          <div class="inspector-row">
            <label>Diameter (mm)</label>
            <input type="number" value="${c.r * 2}" onchange="updateSelectedEntityParam('diameter', this.value)">
          </div>
          <div class="inspector-row">
            <label>Standard Tapped</label>
            <select onchange="updateSelectedEntityParam('standardHole', this.value)" class="form-select" style="width: 100px; height: 32px; font-size: 11px;">
              <option value="">None</option>
              <option value="M3" ${c.standardHole === "M3" ? "selected" : ""}>M3</option>
              <option value="M4" ${c.standardHole === "M4" ? "selected" : ""}>M4</option>
              <option value="M5" ${c.standardHole === "M5" ? "selected" : ""}>M5</option>
              <option value="M6" ${c.standardHole === "M6" ? "selected" : ""}>M6</option>
              <option value="M8" ${c.standardHole === "M8" ? "selected" : ""}>M8</option>
              <option value="M10" ${c.standardHole === "M10" ? "selected" : ""}>M10</option>
              <option value="M12" ${c.standardHole === "M12" ? "selected" : ""}>M12</option>
            </select>
          </div>
          <div class="inspector-row">
            <label>Clearance Fit</label>
            <select onchange="updateSelectedEntityParam('holeTolerance', this.value)" class="form-select" style="width: 100px; height: 32px; font-size: 11px;">
              <option value="">None</option>
              <option value="H7" ${c.holeTolerance === "H7" ? "selected" : ""}>H7</option>
              <option value="H8" ${c.holeTolerance === "H8" ? "selected" : ""}>H8</option>
              <option value="H11" ${c.holeTolerance === "H11" ? "selected" : ""}>H11</option>
            </select>
          </div>
          <div style="margin-top: 6px; padding: 6px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 9px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">ISO 773 Shaft Keyway Recommended</div>
            <div style="font-size: 10px; margin-top: 2px; font-family: var(--font-mono); color: var(--text-secondary);">${keywayInfo}</div>
          </div>
          <div class="inspector-checkbox-row">
            <input type="checkbox" id="c-construction" ${c.construction ? 'checked' : ''} onchange="updateSelectedEntityParam('construction', this.checked)">
            <label for="c-construction">Construction Line (No Mass)</label>
          </div>
          <button class="inspector-delete-btn" onclick="deleteSelectedEntity()">
            Delete Circle
          </button>
        </div>
      `;
    }
    else if (selectedEntity.type === "line") {
      const p1 = sketchVertices[idx];
      const p2 = sketchVertices[(idx + 1) % sketchVertices.length];
      if (!p1 || !p2) return;
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Line Segment</div>
          <div class="inspector-row">
            <label>Length (mm)</label>
            <input type="number" value="${Math.round(len)}" onchange="updateSelectedEntityParam('lineLength', this.value)">
          </div>
          <div style="font-size:10px; color:var(--text-muted); margin-top: 4px;">
            Span: Node ${idx} to Node ${(idx+1)%sketchVertices.length}
          </div>
          <button class="inspector-delete-btn" onclick="deleteSelectedEntity()">
            Delete Corner Node
          </button>
        </div>
      `;
    }
    else if (selectedEntity.type === "vertex") {
      const v = sketchVertices[idx];
      if (!v) return;
      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Vertex Handle</div>
          <div class="inspector-row">
            <label>Coord X (mm)</label>
            <input type="number" value="${v.x}" onchange="updateSelectedEntityParam('x', this.value)">
          </div>
          <div class="inspector-row">
            <label>Coord Y (mm)</label>
            <input type="number" value="${v.y}" onchange="updateSelectedEntityParam('y', this.value)">
          </div>
          <button class="inspector-delete-btn" onclick="deleteSelectedEntity()">
            Delete Corner Node
          </button>
        </div>
      `;
    }
    else if (selectedEntity.type === "dimension") {
      const dim = normalizeDim(customDimensions[idx], idx);
      if (!dim) return;
      const isLin = dim.kind === "linear";
      const isRad = dim.kind === "radius" || dim.kind === "diameter";
      const title = isLin
        ? "Linear Dimension"
        : (dim.kind === "diameter" ? "Diameter Dimension" : "Radius Dimension");
      const valueLabel = isLin ? "Distance (mm)" : (dim.kind === "diameter" ? "Diameter (mm)" : "Radius (mm)");
      const placeHint = isLin
        ? "Drag the dimension on canvas to reposition offset."
        : "Drag the dimension on canvas to move leader angle / distance.";
      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">${title}</div>
          <div class="inspector-row">
            <label>${valueLabel}</label>
            <input type="number" step="0.1" value="${Number(dim.d).toFixed(2)}" onchange="updateSelectedEntityParam('dimensionValue', this.value)">
          </div>
          ${isLin ? `
          <div class="inspector-row">
            <label>Offset (mm)</label>
            <input type="number" step="0.5" value="${Number(dim.offset != null ? dim.offset : 28).toFixed(1)}" onchange="updateSelectedEntityParam('dimOffset', this.value)">
          </div>` : ""}
          ${isRad ? `
          <div class="inspector-row">
            <label>Leader angle (°)</label>
            <input type="number" step="1" value="${((dim.angle != null ? dim.angle : -Math.PI / 4) * 180 / Math.PI).toFixed(1)}" onchange="updateSelectedEntityParam('dimAngle', this.value)">
          </div>
          <div class="inspector-row">
            <label>Text distance</label>
            <input type="number" step="0.5" value="${Number(dim.textDist != null ? dim.textDist : 0).toFixed(1)}" onchange="updateSelectedEntityParam('dimTextDist', this.value)">
          </div>` : ""}
          <p style="font-size:10px;color:var(--text-muted);margin:6px 0 4px;line-height:1.35;">${placeHint}</p>
          <button class="inspector-delete-btn" onclick="deleteSelectedEntity()">
            Delete Dimension
          </button>
        </div>
      `;
    }
    else if (selectedEntity.type === "insertion") {
      const ins = sketchInsertions[idx];
      if (!ins) return;
      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Block Instance: ${ins.blockName}</div>
          <div class="inspector-row">
            <label>Position X</label>
            <input type="number" value="${ins.x}" onchange="updateSelectedEntityParam('insX', this.value)">
          </div>
          <div class="inspector-row">
            <label>Position Y</label>
            <input type="number" value="${ins.y}" onchange="updateSelectedEntityParam('insY', this.value)">
          </div>
          <div class="inspector-row">
            <label>Rotation (°)</label>
            <input type="number" value="${ins.rotation}" onchange="updateSelectedEntityParam('insRotation', this.value)">
          </div>
          <button class="inspector-delete-btn" onclick="deleteSelectedEntity()">
            Delete Block
          </button>
        </div>
      `;
    }
  }

  // --- Inspector Modify Parameter Handler ---
  window.updateSelectedEntityParam = (param, val) => {
    if (!selectedEntity) return;
    const idx = selectedEntity.index;

    if (selectedEntity.type === "circle") {
      const c = sketchCircles[idx];
      if (param === "cx") c.cx = Math.round(parseFloat(val));
      if (param === "cy") c.cy = Math.round(parseFloat(val));
      if (param === "diameter") c.r = Math.round(parseFloat(val) / 2);
      if (param === "construction") c.construction = !!val;
      if (param === "standardHole") {
        c.standardHole = val;
        if (val) {
          const d = parseInt(val.substring(1));
          c.r = d / 2;
        }
      }
      if (param === "holeTolerance") {
        c.holeTolerance = val;
      }
      runConstraintSolver();
    }
    else if (selectedEntity.type === "vertex") {
      const v = sketchVertices[idx];
      if (param === "x") v.x = Math.round(parseFloat(val));
      if (param === "y") v.y = Math.round(parseFloat(val));
      runConstraintSolver(idx);
    }
    else if (selectedEntity.type === "line") {
      if (param === "lineLength") {
        const p1 = sketchVertices[idx];
        const p2 = sketchVertices[(idx + 1) % sketchVertices.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const newLen = parseFloat(val);
        if (len > 0.1 && newLen > 0) {
          const ratio = newLen / len;
          p2.x = Math.round(p1.x + dx * ratio);
          p2.y = Math.round(p1.y + dy * ratio);

          // Add to custom dimension constraints
          const nextIdx = (idx + 1) % sketchVertices.length;
          let dim = customDimensions.find(d => isLinearDim(d) && ((d.v1 === idx && d.v2 === nextIdx) || (d.v1 === nextIdx && d.v2 === idx)));
          if (dim) dim.d = newLen;
          else customDimensions.push({ kind: "linear", v1: idx, v2: nextIdx, d: newLen, offset: 28 });
          
          runConstraintSolver(idx);
        }
      }
    }
    else if (selectedEntity.type === "dimension") {
      const dim = customDimensions[idx];
      if (!dim) return;
      const nd = normalizeDim(dim, idx);
      if (param === "dimensionValue") {
        const newVal = parseFloat(val);
        if (isNaN(newVal) || newVal <= 0) return;
        dim.d = newVal;
        if (nd.kind === "linear" && dim.v1 != null) {
          runConstraintSolver(dim.v1);
        } else if (nd.kind === "radius" || nd.kind === "diameter") {
          const c = sketchCircles[dim.circleIndex];
          if (c) {
            c.r = nd.kind === "diameter" ? newVal / 2 : newVal;
            dim.d = nd.kind === "diameter" ? c.r * 2 : c.r;
          }
        }
      } else if (param === "dimOffset" && nd.kind === "linear") {
        dim.kind = "linear";
        dim.offset = parseFloat(val);
      } else if (param === "dimAngle" && (nd.kind === "radius" || nd.kind === "diameter")) {
        dim.angle = parseFloat(val) * Math.PI / 180;
      } else if (param === "dimTextDist" && (nd.kind === "radius" || nd.kind === "diameter")) {
        dim.textDist = Math.max(0.1, parseFloat(val));
      }
    }
    else if (selectedEntity.type === "insertion") {
      const ins = sketchInsertions[idx];
      if (param === "insX") ins.x = Math.round(parseFloat(val));
      if (param === "insY") ins.y = Math.round(parseFloat(val));
      if (param === "insRotation") ins.rotation = Math.round(parseFloat(val));
    }

    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
    showEntityInspector();
  };

  // --- Delete Selected (inspector onclick + Delete key) ---
  window.deleteSelectedEntity = deleteSelectedEntity;

  // --- Inspector view sizers ---
  window.openSizer = (moduleName) => {
    window.activeSizerModule = moduleName;
    selectedEntity = null;
    showEntityInspector();
  };

  window.runBusbarSizer = () => {
    const current = parseFloat(document.getElementById("busbar-current")?.value || "800");
    const tempRise = parseFloat(document.getElementById("busbar-temp")?.value || "30");
    const mat = document.getElementById("busbar-material")?.value || "copper";
    const k = mat === "copper" ? 8.5 : 6.0;
    
    const reqArea = current / (k * Math.sqrt(tempRise));
    const thickness = 12;
    const width = Math.ceil(reqArea / thickness);
    
    const wRes = document.getElementById("busbar-width-res");
    const tRes = document.getElementById("busbar-thick-res");
    if (wRes) wRes.textContent = `${width} mm`;
    if (tRes) tRes.textContent = `${thickness} mm`;
    
    window.sizedBusbarWidth = width;
    window.sizedBusbarThick = thickness;
  };

  window.redraftBusbarGeometry = () => {
    if (layers["FOREGROUND"].frozen) {
      alert("FOREGROUND layer is locked.");
      return;
    }
    const w = window.sizedBusbarWidth || 80;
    const t = window.sizedBusbarThick || 12;
    
    const cx = Math.round(sheetWidth / 2);
    const cy = Math.round(sheetHeight / 2);
    const hw = Math.round(w / 2);
    const ht = Math.round(t / 2);
    
    sketchVertices = [
      { x: cx - hw, y: cy - ht },
      { x: cx + hw, y: cy - ht },
      { x: cx + hw, y: cy + ht },
      { x: cx - hw, y: cy + ht }
    ];
    isSketchClosed = true;
    
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.runCableSizer = () => {
    const current = parseFloat(document.getElementById("cable-current")?.value || "120");
    const length = parseFloat(document.getElementById("cable-length")?.value || "50");
    const loss = parseFloat(document.getElementById("cable-loss")?.value || "3.0");
    
    const area = Math.ceil((current * length) / (50 * loss));
    const diam = parseFloat((Math.sqrt((4 * area) / Math.PI)).toFixed(1));
    
    const areaRes = document.getElementById("cable-area-res");
    const diamRes = document.getElementById("cable-diam-res");
    if (areaRes) areaRes.textContent = `${area} mm²`;
    if (diamRes) diamRes.textContent = `${diam} mm`;
    
    window.sizedCableDiam = diam;
  };

  window.redraftCableGeometry = () => {
    if (layers["FOREGROUND"].frozen) {
      alert("FOREGROUND layer is locked.");
      return;
    }
    const d = window.sizedCableDiam || 6.7;
    const r = parseFloat((d / 2).toFixed(1));
    
    const cx = Math.round(sheetWidth / 2);
    const cy = Math.round(sheetHeight / 2);
    
    sketchCircles.push({
      cx: cx, cy: cy, r: r,
      construction: false
    });
    
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.runBeamSizer = () => {
    const force = parseFloat(document.getElementById("beam-load")?.value || "25");
    const length = parseFloat(document.getElementById("beam-length")?.value || "3000");
    
    const deflection = parseFloat(((force * 1000 * Math.pow(length, 3)) / (48 * 200000 * 1200000)).toFixed(1));
    const deflectRes = document.getElementById("beam-deflect-res");
    if (deflectRes) deflectRes.textContent = `${deflection} mm`;
    
    window.sizedBeamDeflection = deflection;
    window.sizedBeamLength = length;
  };

  window.redraftBeamDeflection = () => {
    if (layers["FOREGROUND"].frozen) {
      alert("FOREGROUND layer is locked.");
      return;
    }
    const dMax = window.sizedBeamDeflection || 12;
    const L = window.sizedBeamLength || 3000;
    
    const scaleX = sheetWidth / L;
    const scaleY = 2.0; 
    
    sketchVertices = [];
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * L;
      let y = 0;
      if (x <= L / 2) {
        y = (dMax * (3 * L * L * x - 4 * x * x * x)) / (L * L * L);
      } else {
        const xRev = L - x;
        y = (dMax * (3 * L * L * xRev - 4 * xRev * xRev * xRev)) / (L * L * L);
      }
      
      sketchVertices.push({
        x: Math.round(x * scaleX),
        y: Math.round(sheetHeight / 2 + y * scaleY)
      });
    }
    isSketchClosed = false;
    
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
  };

  // --- Ribbon Toolbar Tabs switcher ---
  window.switchRibbonTab = (tabName) => {
    document.querySelectorAll(".ribbon-tab-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`tab-${tabName}-btn`);
    if (activeBtn) activeBtn.classList.add("active");

    document.querySelectorAll(".ribbon-panel").forEach(p => p.classList.remove("active"));
    const activePanel = document.getElementById(`panel-${tabName}`);
    if (activePanel) activePanel.classList.add("active");
  };

  function ribbonTabForMode(mode) {
    if (["select", "draw", "circle", "rect", "poly"].includes(mode)) return "draw";
    if (["fillet", "trim", "extend", "offset", "move", "copy", "rotate", "mirror"].includes(mode)) return "modify";
    if (["dimension", "dim-diameter", "dim-radius", "measure"].includes(mode)) return "annotate";
    if (mode === "insert_block") return "insert";
    return null;
  }

  window.setEditorMode = (mode) => {
    if (editorMode === "draw" && mode !== "draw") {
      const activeStart = activeProfileStartIndex;
      const activeCount = sketchVertices.length - activeStart;
      if (activeCount >= 2) {
        sketchProfiles.push({
          startIndex: activeStart,
          count: activeCount,
          isClosed: false
        });
      } else {
        sketchVertices.splice(activeStart);
      }
      activeProfileStartIndex = sketchVertices.length;
    }

    // Leaving a transform tool mid-preview: restore geometry
    if (xform.seed && !["move", "copy", "rotate", "mirror"].includes(mode)) {
      restoreSeedGeometry(xform.seed);
      xform = { tool: null, stage: 0, base: null, seed: null, preview: null };
    }

    editorMode = mode;
    window.editorMode = mode;
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    
    const activeBtn = document.getElementById(`tool-${mode}-btn`);
    if (activeBtn) activeBtn.classList.add("active");

    // Keep ribbon tab in sync with the active tool
    const tab = ribbonTabForMode(mode);
    if (tab) switchRibbonTab(tab);

    selectedVertexA = -1;
    selectedVertexB = -1;
    isMeasuring = false;
    activeGrip = null;
    dimDraft = null;
    dimDragIndex = -1;
    if (mode !== "select") selectedVertexIndex = -1;
    if (mode === "draw") lastAnchorPos = null;
    if (["move", "copy", "rotate", "mirror"].includes(mode)) {
      xform = { tool: mode, stage: 0, base: null, seed: null, preview: null };
    }

    updateToolPromptUI();
    drawSketchCanvas();
    try { if (window.lucide) lucide.createIcons(); } catch (_) { /* ignore */ }
  };

  // Block Library inserts
  window.instantiateBlock = (blockType) => {
    activeBlockToInsert = blockType;
    setEditorMode("insert_block");
    const instr = document.getElementById("sketcher-instruction");
    if (instr) {
      instr.textContent = `Click coordinate to place ${blockType} instance.`;
    }
  };

  // --- Export DXF & SVG blue prints ---
  window.exportSVGDrawing = () => {
    if (sketchVertices.length < 2) {
      alert("Drawing canvas is empty.");
      return;
    }
    
    const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    exportSvg.setAttribute("viewBox", `0 0 ${sheetWidth} ${sheetHeight}`);
    exportSvg.setAttribute("width", sheetWidth);
    exportSvg.setAttribute("height", sheetHeight);
    exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    exportSvg.style.background = "#ffffff";
    
    exportSvg.innerHTML = `
      <defs>
        <marker id="arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#0d9488" />
        </marker>
        <marker id="arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#0d9488" />
        </marker>
      </defs>
    `;

    // Render directly using old svg pipeline context (mock helper)
    const drawGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    exportSvg.appendChild(drawGroup);

    // Outline
    if (isSketchClosed) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      p.setAttribute("points", sketchVertices.map(v => `${v.x},${v.y}`).join(" "));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "#000000");
      p.setAttribute("stroke-width", "2");
      drawGroup.appendChild(p);
    } else {
      const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      pl.setAttribute("points", sketchVertices.map(v => `${v.x},${v.y}`).join(" "));
      pl.setAttribute("fill", "none");
      pl.setAttribute("stroke", "#000000");
      pl.setAttribute("stroke-width", "2");
      drawGroup.appendChild(pl);
    }

    // Circles
    sketchCircles.forEach(c => {
      const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circ.setAttribute("cx", c.cx);
      circ.setAttribute("cy", c.cy);
      circ.setAttribute("r", c.r);
      circ.setAttribute("fill", "none");
      circ.setAttribute("stroke", "#000000");
      circ.setAttribute("stroke-width", "1.5");
      if (c.construction) circ.setAttribute("stroke-dasharray", "4 4");
      drawGroup.appendChild(circ);
    });

    // Save File
    const svgData = new XMLSerializer().serializeToString(exportSvg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cad_drawing.svg";
    a.click();
  };

  window.exportDXFDrawing = () => {
    if (sketchVertices.length < 2) {
      alert("Drawing canvas is empty.");
      return;
    }
    
    const db = new window.DxfDatabase();
    db.addLayer("PROFILE_OUTLINE", 7, "CONTINUOUS");
    db.addLayer("HOLES", 1, "CONTINUOUS");
    db.addLayer("CONSTRUCTION", 2, "DASHED");
    db.addLayer("SHEET_FORMAT", 3, "CONTINUOUS");

    // Profile Lines
    // 1. Export Finalized Profiles
    sketchProfiles.forEach(prof => {
      const numVerts = prof.count;
      if (numVerts >= 2) {
        const limit = prof.isClosed ? numVerts : numVerts - 1;
        for (let i = 0; i < limit; i++) {
          const p1 = sketchVertices[prof.startIndex + i];
          const p2 = sketchVertices[prof.startIndex + (i + 1) % numVerts];
          db.entities.push({
            type: "LINE", layer: "PROFILE_OUTLINE",
            x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y
          });
        }
      }
    });

    // 2. Export Active open polyline segments
    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;
    if (activeCount >= 2) {
      for (let i = 0; i < activeCount - 1; i++) {
        const p1 = sketchVertices[activeStart + i];
        const p2 = sketchVertices[activeStart + i + 1];
        db.entities.push({
          type: "LINE", layer: "PROFILE_OUTLINE",
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y
        });
      }
    }

    // Circles
    sketchCircles.forEach(c => {
      db.entities.push({
        type: "CIRCLE", layer: c.construction ? "CONSTRUCTION" : "HOLES",
        cx: c.cx, cy: c.cy, r: c.r
      });
    });

    // Sheet Format
    if (layers["SHEET_FORMAT"] && layers["SHEET_FORMAT"].visible) {
      db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: 0, y1: 0, x2: sheetWidth, y2: 0 });
      db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: sheetWidth, y1: 0, x2: sheetWidth, y2: sheetHeight });
      db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: sheetWidth, y1: sheetHeight, x2: 0, y2: sheetHeight });
      db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: 0, y1: sheetHeight, x2: 0, y2: 0 });
    }

    // Block definitions
    db.blocks = Object.assign({}, blockDefinitions);
    sketchInsertions.forEach(ins => {
      db.entities.push({
        type: "INSERT", blockName: ins.blockName, layer: "PROFILE_OUTLINE",
        x: ins.x, y: ins.y, scaleX: ins.scaleX || 1, scaleY: ins.scaleY || 1, rotation: ins.rotation || 0
      });
    });

    const dxf = db.export();
    const blob = new Blob([dxf], { type: "application/dxf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cad_drawing.dxf";
    a.click();
  };

  // State share links
  window.shareLink = () => {
    const state = {
      vertices: sketchVertices,
      circles: sketchCircles,
      insertions: sketchInsertions,
      customDimensions,
      isSketchClosed
    };
    const encoded = (window.encodeShareState ? window.encodeShareState(state) : btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
    const url = `${window.location.origin}${window.location.pathname}?design=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Sharing URL copied to clipboard.");
    });
  };

  window.exportJSON = () => {
    const state = {
      vertices: sketchVertices,
      circles: sketchCircles,
      insertions: sketchInsertions,
      customDimensions,
      isSketchClosed
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cad_drawing.json";
    a.click();
  };

  window.importJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (file.name.toLowerCase().endsWith(".dxf")) {
          const db = new window.DxfDatabase();
          db.parse(text);
          
          sketchVertices = [];
          sketchCircles = [];
          sketchInsertions = [];
          customDimensions = [];

          db.entities.forEach(ent => {
            if (ent.type === "LINE") {
              if (sketchVertices.length === 0) {
                sketchVertices.push({ x: ent.x1, y: ent.y1 });
                sketchVertices.push({ x: ent.x2, y: ent.y2 });
              } else {
                const last = sketchVertices[sketchVertices.length - 1];
                if (Math.hypot(last.x - ent.x1, last.y - ent.y1) < 1.0) {
                  sketchVertices.push({ x: ent.x2, y: ent.y2 });
                } else {
                  sketchVertices.push({ x: ent.x1, y: ent.y1 });
                  sketchVertices.push({ x: ent.x2, y: ent.y2 });
                }
              }
            } else if (ent.type === "CIRCLE") {
              sketchCircles.push({ cx: ent.cx, cy: ent.cy, r: ent.r, construction: ent.layer === "CONSTRUCTION" });
            } else if (ent.type === "INSERT") {
              sketchInsertions.push({
                blockName: ent.blockName,
                x: ent.x, y: ent.y,
                scaleX: ent.scaleX || 1, scaleY: ent.scaleY || 1, rotation: ent.rotation || 0
              });
            }
          });

          isSketchClosed = sketchVertices.length >= 3 && 
            Math.hypot(sketchVertices[0].x - sketchVertices[sketchVertices.length-1].x, 
                       sketchVertices[0].y - sketchVertices[sketchVertices.length-1].y) < 10;
        } else {
          const data = JSON.parse(text);
          if (data.vertices) {
            sketchVertices = data.vertices;
            sketchCircles = data.circles || [];
            sketchInsertions = data.insertions || [];
            customDimensions = data.customDimensions || [];
            isSketchClosed = !!data.isSketchClosed;
          }
        }
        rebuildSpatialIndexes();
        drawSketchCanvas();
        updateLiveProperties();
      } catch (err) {
        console.error(err);
        alert("Failed to parse drawing file.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  // --- Layer manager rows builder ---
  function renderLayerManager() {
    const container = document.getElementById("layer-manager-list");
    if (!container) return;
    container.innerHTML = "";

    Object.keys(layers).forEach(layerName => {
      const layer = layers[layerName];
      const row = document.createElement("div");
      row.style = "display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 4px;";

      const name = document.createElement("span");
      name.textContent = layerName.replace("_", " ");
      name.style = "font-weight: 600; color: var(--text-primary);";

      const actions = document.createElement("div");
      actions.style = "display: flex; align-items: center; gap: 8px;";

      // Color dot indicator
      const dot = document.createElement("span");
      dot.style = `width: 8px; height: 8px; border-radius: 50%; background-color: ${layer.color}; display: inline-block;`;

      // Eye Visibility Toggle
      const eyeBtn = document.createElement("button");
      eyeBtn.style = "background: none; border: none; padding: 2px; cursor: pointer; color: " + (layer.visible ? "var(--accent-primary)" : "var(--text-muted)");
      eyeBtn.innerHTML = layer.visible
        ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      eyeBtn.onclick = () => {
        layer.visible = !layer.visible;
        renderLayerManager();
        drawSketchCanvas();
      };

      // Freeze Editing lock toggle
      const lockBtn = document.createElement("button");
      lockBtn.style = "background: none; border: none; padding: 2px; cursor: pointer; color: " + (layer.frozen ? "#ef4444" : "var(--text-muted)");
      lockBtn.innerHTML = layer.frozen
        ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
      lockBtn.onclick = () => {
        layer.frozen = !layer.frozen;
        renderLayerManager();
      };

      actions.appendChild(dot);
      actions.appendChild(eyeBtn);
      actions.appendChild(lockBtn);
      row.appendChild(name);
      row.appendChild(actions);
      container.appendChild(row);
    });
  }

  // --- Parametric constraints builder helper ---
  window.getSelectedEntity = () => selectedEntity;
  window.setSelectedEntity = (val) => {
    selectedEntity = val;
    showEntityInspector();
    drawSketchCanvas();
  };
  window.getVerticesCount = () => sketchVertices.length;
  window.getCirclesCount = () => sketchCircles.length;
  window.getParametricConstraints = () => parametricConstraints;
  window.addParametricConstraint = (c) => {
    pushUndo("constraint");
    parametricConstraints.push(c);
    runConstraintSolver();
    drawSketchCanvas();
    updateProfileHealth();
  };

  function getLineEndpointsFromSelection() {
    if (!selectedEntity || selectedEntity.type !== "line") return null;
    const idx = selectedEntity.index;
    let i2 = idx + 1;
    for (const prof of sketchProfiles) {
      const limit = prof.isClosed ? prof.count : prof.count - 1;
      for (let i = 0; i < limit; i++) {
        if (prof.startIndex + i === idx) {
          i2 = prof.startIndex + (i + 1) % prof.count;
        }
      }
    }
    if (!sketchVertices[idx] || !sketchVertices[i2]) return null;
    return [idx, i2];
  }

  window.addConstraintFromSelection = (type) => {
    const ends = getLineEndpointsFromSelection();
    if (!ends) {
      if (window.showToast) window.showToast("Select a line segment first", false);
      return;
    }
    // Avoid duplicates
    const exists = parametricConstraints.some(c =>
      c.type === type &&
      ((c.targets[0] === ends[0] && c.targets[1] === ends[1]) ||
       (c.targets[0] === ends[1] && c.targets[1] === ends[0]))
    );
    if (exists) {
      if (window.showToast) window.showToast("Constraint already exists", false);
      return;
    }
    window.addParametricConstraint({ type, targets: ends });
    if (window.showToast) window.showToast(`Added ${type} constraint`);
  };

  window.autoDetectConstraints = () => {
    pushUndo("auto constraints");
    let added = 0;
    const tol = 0.5; // mm axis tolerance
    const consider = (i1, i2) => {
      const a = sketchVertices[i1], b = sketchVertices[i2];
      if (!a || !b) return;
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      let type = null;
      if (dy <= tol && dx > tol) type = "horizontal";
      else if (dx <= tol && dy > tol) type = "vertical";
      if (!type) return;
      const exists = parametricConstraints.some(c =>
        c.type === type &&
        ((c.targets[0] === i1 && c.targets[1] === i2) || (c.targets[0] === i2 && c.targets[1] === i1))
      );
      if (!exists) {
        parametricConstraints.push({ type, targets: [i1, i2] });
        added++;
      }
    };
    sketchProfiles.forEach(prof => {
      const limit = prof.isClosed ? prof.count : prof.count - 1;
      for (let i = 0; i < limit; i++) {
        consider(prof.startIndex + i, prof.startIndex + (i + 1) % prof.count);
      }
    });
    const aStart = activeProfileStartIndex;
    const aCount = sketchVertices.length - aStart;
    for (let i = 0; i < aCount - 1; i++) consider(aStart + i, aStart + i + 1);
    if (added) {
      runConstraintSolver();
      drawSketchCanvas();
      updateProfileHealth();
    }
    if (window.showToast) window.showToast(added ? `Added ${added} H/V constraint(s)` : "No near-axis segments found");
  };

  function getConstraintIcons() {
    // Icons mid-segment for H/V and at midpoint for distance dims
    const icons = [];
    parametricConstraints.forEach((pc, idx) => {
      if ((pc.type === "horizontal" || pc.type === "vertical") && pc.targets?.length >= 2) {
        const a = sketchVertices[pc.targets[0]];
        const b = sketchVertices[pc.targets[1]];
        if (a && b) {
          icons.push({
            type: pc.type,
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            index: idx
          });
        }
      }
    });
    return icons;
  }

  function estimateDOF() {
    // Rough: 2 DOF per free vertex + 3 per circle - residual equations from constraints
    const freeVerts = sketchVertices.length;
    const freeCircles = sketchCircles.length;
    let dof = freeVerts * 2 + freeCircles * 3;
    // subtract linear dim constraints (radial dims are annotations unless value-driven)
    dof -= customDimensions.filter(d => isLinearDim(d)).length;
    parametricConstraints.forEach(pc => {
      if (pc.type === "horizontal" || pc.type === "vertical") dof -= 1;
      else if (pc.type === "distance" || pc.type === "perpendicular" || pc.type === "parallel" || pc.type === "tangent") dof -= 1;
      else if (pc.type === "coincident" || pc.type === "concentric") dof -= 2;
    });
    // closed profile rigid body approx: subtract 3 for first closed shape
    const closed = sketchProfiles.filter(p => p.isClosed).length;
    if (closed > 0) dof -= 3;
    return Math.max(0, dof);
  }

  function profilesSelfIntersect(verts) {
    if (verts.length < 4) return false;
    const segs = [];
    for (let i = 0; i < verts.length; i++) {
      segs.push([verts[i], verts[(i + 1) % verts.length]]);
    }
    const orient = (a, b, c) => Math.sign((b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y));
    const onSeg = (a, b, c) =>
      Math.min(a.x, b.x) <= c.x + 1e-6 && c.x <= Math.max(a.x, b.x) + 1e-6 &&
      Math.min(a.y, b.y) <= c.y + 1e-6 && c.y <= Math.max(a.y, b.y) + 1e-6;
    const intersects = (a, b, c, d) => {
      const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
      if (o1 !== o2 && o3 !== o4) return true;
      if (o1 === 0 && onSeg(a, b, c)) return true;
      if (o2 === 0 && onSeg(a, b, d)) return true;
      if (o3 === 0 && onSeg(c, d, a)) return true;
      if (o4 === 0 && onSeg(c, d, b)) return true;
      return false;
    };
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        if (Math.abs(i - j) <= 1 || (i === 0 && j === segs.length - 1)) continue;
        if (intersects(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) return true;
      }
    }
    return false;
  }

  function updateProfileHealth() {
    const closed = sketchProfiles.filter(p => p.isClosed).length;
    const openFinal = sketchProfiles.filter(p => !p.isClosed).length;
    const activeOpen = (sketchVertices.length - activeProfileStartIndex) >= 2 ? 1 : 0;
    const open = openFinal + activeOpen;
    const nV = sketchVertices.length;
    const nC = sketchCircles.length;
    const nConst = parametricConstraints.length + customDimensions.length;
    const dof = estimateDOF();

    let status = "Empty";
    let cls = "health-warn";
    let tips = "Draw a closed profile to compute section properties.";
    if (nV === 0 && nC === 0) {
      status = "Empty";
      cls = "health-warn";
    } else if (closed === 0) {
      status = "Open";
      cls = "health-warn";
      tips = "Close a polyline (click near start or Close) for solid section properties.";
    } else {
      let bad = false;
      sketchProfiles.filter(p => p.isClosed).forEach(prof => {
        const verts = sketchVertices.slice(prof.startIndex, prof.startIndex + prof.count);
        if (profilesSelfIntersect(verts)) bad = true;
      });
      if (bad) {
        status = "Self-intersect";
        cls = "health-bad";
        tips = "A closed profile appears to self-intersect — check crossings.";
      } else if (dof <= 3) {
        status = "Well constrained";
        cls = "health-ok";
        tips = "Profile is closed and constraint DOF is low. Ready for export.";
      } else {
        status = "Under-defined";
        cls = "health-warn";
        tips = `Approx. ${dof} free DOF — add H/V/dims or Auto H/V to stabilize.`;
      }
    }

    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const badge = document.getElementById("health-status");
    if (badge) {
      badge.textContent = status;
      badge.className = `health-badge ${cls}`;
    }
    set("health-closed", String(closed));
    set("health-open", String(open));
    set("health-counts", `${nV} / ${nC}`);
    set("health-constraints", String(nConst));
    set("health-dof", nV || nC ? String(dof) : "—");
    set("health-tips", tips);
  }

  // ── Dark canvas ────────────────────────────────────────────
  window.toggleDarkCanvas = () => {
    window.darkCanvas = !window.darkCanvas;
    document.body.classList.toggle("cad-dark", window.darkCanvas);
    document.getElementById("dark-canvas-toggle")?.classList.toggle("active", window.darkCanvas);
    drawSketchCanvas();
  };

  // ── Dimension style inputs ─────────────────────────────────
  function syncDimStyleInputs() {
    const map = {
      "dim-decimals": "decimals",
      "dim-text-h": "textHeight",
      "dim-arrow": "arrowSize",
      "dim-offset": "offset"
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = dimStyle[key];
    });
  }
  function bindDimStyleInputs() {
    const map = {
      "dim-decimals": "decimals",
      "dim-text-h": "textHeight",
      "dim-arrow": "arrowSize",
      "dim-offset": "offset"
    };
    Object.entries(map).forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener("change", (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) dimStyle[key] = v;
        drawSketchCanvas();
      });
    });
  }

  // ── Autosave + recovery ────────────────────────────────────
  function scheduleAutosave() {
    try {
      const payload = {
        savedAt: Date.now(),
        snapshot: captureDrawingSnapshot()
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    } catch (_) { /* quota */ }
  }

  function checkAutosaveRecovery() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.snapshot) return;
      // Only offer if current board is empty
      if (sketchVertices.length || sketchCircles.length || sketchInsertions.length) return;
      pendingAutosaveRestore = data;
      const banner = document.getElementById("autosave-banner");
      const text = document.getElementById("autosave-banner-text");
      if (text) {
        const age = data.savedAt ? new Date(data.savedAt).toLocaleString() : "unknown time";
        text.textContent = `Autosaved draft found (${age}). Restore it?`;
      }
      banner?.classList.remove("hidden");
    } catch (_) { /* ignore */ }
  }

  function bindAutosaveUI() {
    document.getElementById("autosave-restore-btn")?.addEventListener("click", () => {
      if (!pendingAutosaveRestore) return;
      try {
        applyDrawingSnapshot(pendingAutosaveRestore.snapshot);
        if (window.showToast) window.showToast("Draft restored");
      } catch (e) {
        alert("Failed to restore draft: " + e.message);
      }
      document.getElementById("autosave-banner")?.classList.add("hidden");
      pendingAutosaveRestore = null;
    });
    document.getElementById("autosave-discard-btn")?.addEventListener("click", () => {
      localStorage.removeItem(AUTOSAVE_KEY);
      document.getElementById("autosave-banner")?.classList.add("hidden");
      pendingAutosaveRestore = null;
    });
    setInterval(scheduleAutosave, 15000);
    window.addEventListener("beforeunload", scheduleAutosave);
  }

  // ── Command palette ────────────────────────────────────────
  const COMMANDS = [
    { id: "select", label: "Select", keys: "V", run: () => setEditorMode("select") },
    { id: "line", label: "Line / Polyline", keys: "L", run: () => setEditorMode("draw") },
    { id: "circle", label: "Circle", keys: "C", run: () => setEditorMode("circle") },
    { id: "rect", label: "Rectangle", keys: "R", run: () => setEditorMode("rect") },
    { id: "poly", label: "Polygon", keys: "P", run: () => setEditorMode("poly") },
    { id: "dim", label: "Smart Dimension", keys: "D", run: () => setEditorMode("dimension") },
    { id: "dim-dia", label: "Diameter dimension", keys: "", run: () => setEditorMode("dim-diameter") },
    { id: "dim-rad", label: "Radius dimension", keys: "", run: () => setEditorMode("dim-radius") },
    { id: "measure", label: "Measure", keys: "M", run: () => setEditorMode("measure") },
    { id: "fit", label: "Fit view", keys: "", run: () => fitView() },
    { id: "fillet", label: "Fillet", keys: "F", run: () => setEditorMode("fillet") },
    { id: "trim", label: "Trim", keys: "T", run: () => setEditorMode("trim") },
    { id: "extend", label: "Extend", keys: "X", run: () => setEditorMode("extend") },
    { id: "offset", label: "Offset", keys: "O", run: () => setEditorMode("offset") },
    { id: "move", label: "Move", keys: "G", run: () => setEditorMode("move") },
    { id: "copy", label: "Copy", keys: "Y", run: () => setEditorMode("copy") },
    { id: "rotate", label: "Rotate", keys: "Q", run: () => setEditorMode("rotate") },
    { id: "mirror", label: "Mirror", keys: "I", run: () => setEditorMode("mirror") },
    { id: "pan", label: "Pan", keys: "H", run: () => setEditorMode("pan") },
    { id: "undo", label: "Undo", keys: "Ctrl+Z", run: () => cadUndo() },
    { id: "redo", label: "Redo", keys: "Ctrl+Y", run: () => cadRedo() },
    { id: "close", label: "Close shape", keys: "", run: () => closeSketchShape() },
    { id: "clear", label: "Clear board", keys: "", run: () => clearSketchCanvas() },
    { id: "extents", label: "Zoom extents", keys: "", run: () => zoomExtents() },
    { id: "sheet", label: "Fit sheet", keys: "", run: () => resetViewport() },
    { id: "dark", label: "Toggle dark canvas", keys: "", run: () => toggleDarkCanvas() },
    { id: "snap", label: "Toggle OSNAP", keys: "", run: () => toggleSnap() },
    { id: "ortho", label: "Toggle ORTHO", keys: "", run: () => toggleOrtho() },
    { id: "grid", label: "Toggle GRID", keys: "", run: () => toggleGrid() },
    { id: "cross", label: "Toggle CROSSHAIR", keys: "", run: () => toggleCrosshair() },
    { id: "auto-hv", label: "Auto H/V constraints", keys: "", run: () => autoDetectConstraints() },
    { id: "export-dxf", label: "Export DXF", keys: "", run: () => exportDXFDrawing() },
    { id: "export-svg", label: "Export SVG", keys: "", run: () => exportSVGDrawing() },
    { id: "shortcuts", label: "Show shortcuts", keys: "?", run: () => openShortcuts() }
  ];

  let cmdActiveIndex = 0;
  let cmdFiltered = COMMANDS.slice();

  function openCommandPalette() {
    const overlay = document.getElementById("cmd-palette-overlay");
    const input = document.getElementById("cmd-palette-input");
    if (!overlay || !input) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    input.value = "";
    cmdActiveIndex = 0;
    filterCommands("");
    setTimeout(() => input.focus(), 0);
  }

  function closeCommandPalette() {
    const overlay = document.getElementById("cmd-palette-overlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function filterCommands(q) {
    const query = (q || "").toLowerCase().trim();
    cmdFiltered = COMMANDS.filter(c =>
      !query || c.label.toLowerCase().includes(query) || c.id.includes(query) || (c.keys || "").toLowerCase().includes(query)
    );
    cmdActiveIndex = 0;
    renderCommandList();
  }

  function renderCommandList() {
    const list = document.getElementById("cmd-palette-list");
    if (!list) return;
    list.innerHTML = cmdFiltered.map((c, i) =>
      `<li class="${i === cmdActiveIndex ? "active" : ""}" data-idx="${i}">
        <span>${c.label}</span>
        <span class="cmd-keys">${c.keys || ""}</span>
      </li>`
    ).join("") || `<li style="color:#64748b">No commands</li>`;
    list.querySelectorAll("li[data-idx]").forEach(li => {
      li.addEventListener("mouseenter", () => {
        cmdActiveIndex = parseInt(li.getAttribute("data-idx"), 10);
        renderCommandList();
      });
      li.addEventListener("click", () => runCommandAt(parseInt(li.getAttribute("data-idx"), 10)));
    });
  }

  function runCommandAt(idx) {
    const c = cmdFiltered[idx];
    if (!c) return;
    closeCommandPalette();
    c.run();
  }

  function openShortcuts() {
    const modal = document.getElementById("shortcuts-modal");
    const grid = document.getElementById("shortcuts-grid");
    if (grid) {
      grid.innerHTML = COMMANDS.filter(c => c.keys).map(c =>
        `<div><span>${c.label}</span><kbd>${c.keys}</kbd></div>`
      ).join("");
    }
    modal?.classList.remove("hidden");
  }

  function bindCommandPalette() {
    const input = document.getElementById("cmd-palette-input");
    const overlay = document.getElementById("cmd-palette-overlay");
    input?.addEventListener("input", () => filterCommands(input.value));
    input?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        cmdActiveIndex = Math.min(cmdFiltered.length - 1, cmdActiveIndex + 1);
        renderCommandList();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        cmdActiveIndex = Math.max(0, cmdActiveIndex - 1);
        renderCommandList();
      } else if (e.key === "Enter") {
        e.preventDefault();
        runCommandAt(cmdActiveIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeCommandPalette();
      }
    });
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeCommandPalette();
    });
  }

  function buildVariablesAndConstraints(lockedIdx = -1) {
    let vars = [];
    // Vertices variables
    for (let i = 0; i < sketchVertices.length; i++) {
      const v = sketchVertices[i];
      const isLocked = (i === lockedIdx);
      vars.push(new window.Variable(`v_${i}_x`, v.x, !isLocked));
      vars.push(new window.Variable(`v_${i}_y`, v.y, !isLocked));
    }
    
    // Circle variables
    const circleBase = 2 * sketchVertices.length;
    for (let j = 0; j < sketchCircles.length; j++) {
      const c = sketchCircles[j];
      vars.push(new window.Variable(`c_${j}_cx`, c.cx, true));
      vars.push(new window.Variable(`c_${j}_cy`, c.cy, true));
      vars.push(new window.Variable(`c_${j}_r`, c.r, true));
    }

    let solverConstraints = [];
    
    // Custom linear dimensions -> distance constraints
    customDimensions.forEach(dim => {
      const nd = normalizeDim(dim);
      if (!nd || nd.kind !== "linear") return;
      const p1 = sketchVertices[nd.v1];
      const p2 = sketchVertices[nd.v2];
      if (p1 && p2) {
        const dVal = nd.d !== undefined ? nd.d : Math.hypot(p2.x - p1.x, p2.y - p1.y);
        solverConstraints.push(new window.Constraint("distance", [2 * nd.v1, 2 * nd.v1 + 1, 2 * nd.v2, 2 * nd.v2 + 1], { d: dVal }));
      }
    });

    // Parametric constraints
    parametricConstraints.forEach(pc => {
      switch (pc.type) {
        case "horizontal": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length) {
            solverConstraints.push(new window.Constraint("horizontal", [2 * pc.targets[0] + 1, 2 * pc.targets[1] + 1]));
          }
          break;
        }
        case "vertical": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length) {
            solverConstraints.push(new window.Constraint("vertical", [2 * pc.targets[0], 2 * pc.targets[1]]));
          }
          break;
        }
        case "distance": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length) {
            solverConstraints.push(new window.Constraint("distance", [2 * pc.targets[0], 2 * pc.targets[0] + 1, 2 * pc.targets[1], 2 * pc.targets[1] + 1], { d: pc.d }));
          }
          break;
        }
        case "perpendicular": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length &&
              pc.targets[2] < sketchVertices.length && pc.targets[3] < sketchVertices.length) {
            solverConstraints.push(new window.Constraint("perpendicular", [
              2 * pc.targets[0], 2 * pc.targets[0] + 1,
              2 * pc.targets[1], 2 * pc.targets[1] + 1,
              2 * pc.targets[2], 2 * pc.targets[2] + 1,
              2 * pc.targets[3], 2 * pc.targets[3] + 1
            ]));
          }
          break;
        }
        case "parallel": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length &&
              pc.targets[2] < sketchVertices.length && pc.targets[3] < sketchVertices.length) {
            solverConstraints.push(new window.Constraint("parallel", [
              2 * pc.targets[0], 2 * pc.targets[0] + 1,
              2 * pc.targets[1], 2 * pc.targets[1] + 1,
              2 * pc.targets[2], 2 * pc.targets[2] + 1,
              2 * pc.targets[3], 2 * pc.targets[3] + 1
            ]));
          }
          break;
        }
        case "coincident": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length) {
            solverConstraints.push(new window.Constraint("coincident", [
              2 * pc.targets[0], 2 * pc.targets[0] + 1,
              2 * pc.targets[1], 2 * pc.targets[1] + 1
            ]));
          }
          break;
        }
        case "concentric": {
          if (pc.targets[0] < sketchCircles.length && pc.targets[1] < sketchCircles.length) {
            solverConstraints.push(new window.Constraint("concentric", [
              circleBase + 3 * pc.targets[0], circleBase + 3 * pc.targets[0] + 1,
              circleBase + 3 * pc.targets[1], circleBase + 3 * pc.targets[1] + 1
            ]));
          }
          break;
        }
        case "tangent": {
          if (pc.targets[0] < sketchVertices.length && pc.targets[1] < sketchVertices.length &&
              pc.targets[2] < sketchCircles.length) {
            solverConstraints.push(new window.Constraint("tangent", [
              2 * pc.targets[0], 2 * pc.targets[0] + 1,
              2 * pc.targets[1], 2 * pc.targets[1] + 1,
              circleBase + 3 * pc.targets[2], circleBase + 3 * pc.targets[2] + 1, circleBase + 3 * pc.targets[2] + 2
            ]));
          }
          break;
        }
      }
    });

    return { vars, solverConstraints };
  }

  function applySolvedVariables(vars) {
    for (let i = 0; i < sketchVertices.length; i++) {
      sketchVertices[i].x = Math.round(vars[2 * i].value);
      sketchVertices[i].y = Math.round(vars[2 * i + 1].value);
    }
    const circleBase = 2 * sketchVertices.length;
    for (let j = 0; j < sketchCircles.length; j++) {
      sketchCircles[j].cx = Math.round(vars[circleBase + 3 * j].value);
      sketchCircles[j].cy = Math.round(vars[circleBase + 3 * j + 1].value);
      sketchCircles[j].r = Math.round(vars[circleBase + 3 * j + 2].value);
    }
  }

  function runConstraintSolver(lockedVertexIdx = -1) {
    if (sketchVertices.length === 0 && sketchCircles.length === 0) return;
    const { vars, solverConstraints } = buildVariablesAndConstraints(lockedVertexIdx);
    if (solverConstraints.length === 0) return;

    const success = window.solveConstraints(vars, solverConstraints, 100, 1e-4);
    if (success) {
      applySolvedVariables(vars);
    }
  }

  // --- Viewport Zoom HUD Bindings ---
  window.zoomViewport = (factor) => {
    if (webglRenderer) {
      webglRenderer.zoom(factor);
      updateZoomPctDisplay();
    }
  };

  window.resetViewport = () => {
    if (webglRenderer) {
      webglRenderer.resetView(sheetWidth, sheetHeight);
      updateZoomPctDisplay();
      drawSketchCanvas();
    }
  };

  window.zoomExtents = () => {
    if (!webglRenderer) return;
    // Fit all geometry (vertices + circles + sheet fallback)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expand = (x, y, pad = 0) => {
      minX = Math.min(minX, x - pad);
      minY = Math.min(minY, y - pad);
      maxX = Math.max(maxX, x + pad);
      maxY = Math.max(maxY, y + pad);
    };
    sketchVertices.forEach(v => expand(v.x, v.y));
    sketchCircles.forEach(c => expand(c.cx, c.cy, c.r));
    sketchInsertions.forEach(ins => expand(ins.x, ins.y, 15));

    if (!isFinite(minX) || maxX - minX < 1e-6) {
      webglRenderer.resetView(sheetWidth, sheetHeight);
    } else {
      const margin = 0.12;
      const w = Math.max(10, maxX - minX);
      const h = Math.max(10, maxY - minY);
      webglRenderer.fitWorldRect(minX - w * margin, minY - h * margin, w * (1 + 2 * margin), h * (1 + 2 * margin));
    }
    updateZoomPctDisplay();
    drawSketchCanvas();
  };

  // --- Initialize CAD on Boot ---
  if (canvasEl && typeof ExplicitCadRenderer !== "undefined") {
    webglRenderer = new ExplicitCadRenderer(canvasEl);
    webglRenderer.onViewChange = () => {
      drawSketchCanvas();
      updateZoomPctDisplay();
    };
    window.addEventListener("resize", () => {
      webglRenderer.resize();
      drawSketchCanvas();
      updateZoomPctDisplay();
    });
    
    // Fit drawing sheet
    webglRenderer.resetView(sheetWidth, sheetHeight);
  }

  // Initial draw and bind events
  showEntityInspector();
  renderLayerManager();
  syncLayerSelect();
  syncDimStyleInputs();
  bindDimStyleInputs();
  bindCommandPalette();
  bindAutosaveUI();
  drawSketchCanvas();
  initSketcherEvents();
  updateLiveProperties();
  updateProfileHealth();
  setEditorMode("select");
  updateZoomPctDisplay();
  checkAutosaveRecovery();
  // Seed undo baseline
  pushUndo("baseline");
  undoStack.pop(); // don't keep empty baseline as undoable
});
