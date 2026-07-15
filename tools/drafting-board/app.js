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
  
  // CAD Tools Mode
  let editorMode = "draw"; // "draw", "circle", "rect", "poly", "fillet", "dimension", "measure", "pan", "insert_block"
  window.editorMode = "draw";
  let customDimensions = [];  // [{ v1, v2, d }]
  let selectedVertexA = -1;  // For smart dimensioning
  let selectedVertexB = -1;
  let measureStartPos = null; // Ruler start coordinate
  let measureEndPos = null;   // Ruler end coordinate
  let isMeasuring = false;

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
    "BACKGROUND": { color: "#475569", visible: true, frozen: false }
  };
  let activeBlockToInsert = null;

  // Status Toggles
  window.orthoLockEnabled = false;
  window.gridVisible = true;
  window.snapEnabled = true;

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

    // 5. Index Dimensions
    customDimensions.forEach((dim, idx) => {
      const p1 = sketchVertices[dim.v1];
      const p2 = sketchVertices[dim.v2];
      if (!p1 || !p2) return;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const theta = Math.atan2(dy, dx);
      const normalAngle = theta - Math.PI / 2;
      const offsetDist = 28 + (idx * 16);
      const midx = mx + offsetDist * Math.cos(normalAngle);
      const midy = my + offsetDist * Math.sin(normalAngle);

      entityItems.push({
        minX: midx - 22, minY: midy - 8, maxX: midx + 22, maxY: midy + 8,
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

  // --- Selection Query (Hit Test) ---
  function findEntityAt(pos, excludeVertices = false) {
    const queryBox = {
      minX: pos.x - 8, minY: pos.y - 8, maxX: pos.x + 8, maxY: pos.y + 8
    };

    const candidates = entitySpatialIndex.search(queryBox);
    let bestEntity = null;
    let minDist = 8;

    candidates.forEach(cand => {
      let dist = Infinity;
      if (cand.type === "vertex") {
        if (excludeVertices) return;
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
        dist = 0; // high priority click inside text label box
      }

      if (dist < minDist) {
        minDist = dist;
        bestEntity = { type: cand.type, index: cand.index };
      }
    });

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
    if (!window.snapEnabled || ["trim", "fillet"].includes(editorMode)) return null;

    const queryBox = {
      minX: pos.x - 14, minY: pos.y - 14, maxX: pos.x + 14, maxY: pos.y + 14
    };

    const candidates = snapSpatialIndex.search(queryBox);
    let bestTarget = null;
    let minDist = 14;

    candidates.forEach(cand => {
      const dist = Math.hypot(pos.x - cand.x, pos.y - cand.y);
      if (dist < minDist) {
        minDist = dist;
        bestTarget = cand;
      }
    });

    return bestTarget;
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
    document.getElementById("coords-display").textContent = `X: ${finalSnapped.x.toFixed(0)} | Y: ${finalSnapped.y.toFixed(0)} mm`;

    mousePos = finalSnapped;

    // Handle active vertex dragging
    if (editorMode === "draw" && selectedVertexIndex !== -1) {
      if (layers["FOREGROUND"].frozen) return;
      sketchVertices[selectedVertexIndex] = finalSnapped;
      runConstraintSolver(selectedVertexIndex);
      rebuildSpatialIndexes();
      updateLiveProperties();
    }

    drawSketchCanvas(editorMode === "draw");
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
    
    // Custom dimensions
    customDimensions.forEach(dim => {
      usedIndices.add(dim.v1);
      usedIndices.add(dim.v2);
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
    
    // Update custom dimensions
    customDimensions = customDimensions.filter(dim => {
      if (indexMap.has(dim.v1) && indexMap.has(dim.v2)) {
        dim.v1 = indexMap.get(dim.v1);
        dim.v2 = indexMap.get(dim.v2);
        return true;
      }
      return false;
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
      const decoded = JSON.parse(atob(designParam));
      window.projectManagerConfig.setInputs(decoded);
    } catch (err) {
      console.error("Failed to parse URL design param:", err);
    }
  }

  // --- Viewport Settings Toggles ---
  window.toggleSnap = () => {
    window.snapEnabled = !window.snapEnabled;
    document.getElementById("snap-toggle").classList.toggle("active", window.snapEnabled);
    rebuildSpatialIndexes();
    if (lastRawWorldPos) {
      updateMousePosition(lastRawWorldPos);
    } else {
      drawSketchCanvas();
    }
  };

  window.toggleOrtho = () => {
    window.orthoLockEnabled = !window.orthoLockEnabled;
    document.getElementById("ortho-toggle").classList.toggle("active", window.orthoLockEnabled);
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
    customDimensions = customDimensions.filter(d => d.v1 < sketchVertices.length && d.v2 < sketchVertices.length);
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.closeSketchShape = () => {
    const activeStart = activeProfileStartIndex;
    const activeCount = sketchVertices.length - activeStart;
    if (activeCount >= 3) {
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
        measureStartPos,
        measureEndPos,
        isMeasuring,
        editorMode,
        polySides,
        activeCircleCenter,
        activeRectStart,
        activePolyCenter,
        orthoLockEnabled: window.orthoLockEnabled || shiftPressed
      });
    }
  }

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
      // Pan handling: middle/right click or active Pan mode
      const isPanMode = editorMode === "pan" || e.shiftKey;
      if (e.button === 1 || e.button === 2 || (e.button === 0 && isPanMode)) {
        return; // Panning handled inside ExplicitCadRenderer
      }

      const pos = webglRenderer.getMouseWorldPos(e.clientX, e.clientY);

      // Sizer locked layers check
      if (["draw", "circle", "rect", "poly", "fillet", "trim"].includes(editorMode) && layers["FOREGROUND"].frozen) {
        alert("The FOREGROUND layer is frozen.");
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
        setEditorMode("draw");
        
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

      // ── SMART DIMENSION / SELECTION ──
      if (editorMode === "dimension") {
        if (clicked) {
          if (clicked.type === "vertex") {
            if (selectedVertexA === -1) {
              selectedVertexA = clicked.index;
              document.getElementById("sketcher-instruction").textContent = "Smart Dim: Click second vertex corner.";
            } else {
              selectedVertexB = clicked.index;
              if (selectedVertexA !== selectedVertexB) {
                const exists = customDimensions.some(d => 
                  (d.v1 === selectedVertexA && d.v2 === selectedVertexB) ||
                  (d.v1 === selectedVertexB && d.v2 === selectedVertexA)
                );
                if (!exists) {
                  const p1 = sketchVertices[selectedVertexA];
                  const p2 = sketchVertices[selectedVertexB];
                  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                  customDimensions.push({ v1: selectedVertexA, v2: selectedVertexB, d: Math.round(len) });
                }
              }
              selectedVertexA = -1;
              selectedVertexB = -1;
              document.getElementById("sketcher-instruction").textContent = "Smart Dim: Click node, line, or circle.";
            }
            selectedEntity = clicked;
          } else {
            selectedEntity = clicked;
          }
        } else {
          selectedEntity = null;
        }
        rebuildSpatialIndexes();
        showEntityInspector();
        drawSketchCanvas();
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
            sketchCircles.push({
              cx: activeCircleCenter.x,
              cy: activeCircleCenter.y,
              r: radius,
              construction: false
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

        sketchVertices.push(snapPt);
        rebuildSpatialIndexes();
        drawSketchCanvas();
        updateLiveProperties();
      }
    });

    canvasEl.addEventListener("mousemove", (e) => {
      const pos = webglRenderer.getMouseWorldPos(e.clientX, e.clientY);
      updateMousePosition(pos);
    });

    canvasEl.addEventListener("mouseup", (e) => {
      selectedVertexIndex = -1;
    });

    // Escape cancels actions or ends current drawing
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
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

        selectedEntity = null;
        activeCircleCenter = null;
        activeRectStart = null;
        activePolyCenter = null;
        isMeasuring = false;
        
        rebuildSpatialIndexes();
        showEntityInspector();
        updateLiveProperties();

        if (lastRawWorldPos) {
          updateMousePosition(lastRawWorldPos);
        } else {
          drawSketchCanvas();
        }
      }
    });

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
      const dim = customDimensions[idx];
      if (!dim) return;
      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Smart Dimension</div>
          <div class="inspector-row">
            <label>Value (mm)</label>
            <input type="number" value="${dim.d}" onchange="updateSelectedEntityParam('dimensionValue', this.value)">
          </div>
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
          let dim = customDimensions.find(d => (d.v1 === idx && d.v2 === nextIdx) || (d.v1 === nextIdx && d.v2 === idx));
          if (dim) dim.d = newLen;
          else customDimensions.push({ v1: idx, v2: nextIdx, d: newLen });
          
          runConstraintSolver(idx);
        }
      }
    }
    else if (selectedEntity.type === "dimension") {
      if (param === "dimensionValue") {
        const dim = customDimensions[idx];
        if (dim) {
          dim.d = parseFloat(val);
          runConstraintSolver(dim.v1);
        }
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

  // --- Delete Selected ---
  window.deleteSelectedEntity = () => {
    if (!selectedEntity) return;
    const idx = selectedEntity.index;

    if (selectedEntity.type === "circle") {
      sketchCircles.splice(idx, 1);
    }
    else if (selectedEntity.type === "vertex" || selectedEntity.type === "line") {
      sketchVertices.splice(idx, 1);
      // If polyline gets too short, unclose shape
      if (sketchVertices.length < 3) isSketchClosed = false;
      // Filter out invalid dimensions
      customDimensions = customDimensions.filter(d => d.v1 < sketchVertices.length && d.v2 < sketchVertices.length);
    }
    else if (selectedEntity.type === "dimension") {
      customDimensions.splice(idx, 1);
    }
    else if (selectedEntity.type === "insertion") {
      sketchInsertions.splice(idx, 1);
    }

    selectedEntity = null;
    rebuildSpatialIndexes();
    drawSketchCanvas();
    updateLiveProperties();
    showEntityInspector();
  };

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

    editorMode = mode;
    window.editorMode = mode;
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    
    const activeBtn = document.getElementById(`tool-${mode}-btn`);
    if (activeBtn) activeBtn.classList.add("active");

    // instruction bubble updates
    const instr = document.getElementById("sketcher-instruction");
    const statusText = document.getElementById("cad-status-text");
    if (!instr || !statusText) return;

    if (mode === "draw") {
      instr.textContent = "Line Tool: Click coordinate or snap handle to draw contiguous line segments.";
      statusText.textContent = "Status: Drafting Polyline Outline";
    } else if (mode === "circle") {
      instr.textContent = "Circle Tool: Click to place center, drag diagonal and release to specify radius.";
      statusText.textContent = "Status: Circle/Hole Creator";
    } else if (mode === "rect") {
      instr.textContent = "Rectangle Tool: Click starting corner, drag diagonally, and release to draw.";
      statusText.textContent = "Status: Rectangle Creator";
    } else if (mode === "poly") {
      instr.textContent = `Polygon Tool (${polySides} sides): Click center, drag outward, and release to draw.`;
      statusText.textContent = `Status: Polygon Creator`;
    } else if (mode === "fillet") {
      instr.textContent = "Fillet Tool: Click connecting node handle corner to round it.";
      statusText.textContent = "Status: Fillet Modifier";
    } else if (mode === "trim") {
      instr.textContent = "Trim Tool: Click on intersecting line segments to cut/trim them.";
      statusText.textContent = "Status: Trimming Geometry";
    } else if (mode === "dimension") {
      instr.textContent = "Smart Dim: Click line, circle, or select two vertices to dimension.";
      statusText.textContent = "Status: Dimensioning";
    } else if (mode === "measure") {
      instr.textContent = "Measure Tool: Click start point, hover, and click end point to resolve distance.";
      statusText.textContent = "Status: Ruler Measuring";
    } else if (mode === "pan") {
      instr.textContent = "Pan Viewport: Left-click and drag on canvas. Right/middle-click also pans.";
      statusText.textContent = "Status: Panning Viewport";
    }

    selectedVertexA = -1;
    selectedVertexB = -1;
    isMeasuring = false;
    
    drawSketchCanvas();
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
    const encoded = btoa(JSON.stringify(state));
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
  let parametricConstraints = [];
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
    parametricConstraints.push(c);
    runConstraintSolver();
    drawSketchCanvas();
  };

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
    
    // Custom dimensions -> distance constraints
    customDimensions.forEach(dim => {
      const p1 = sketchVertices[dim.v1];
      const p2 = sketchVertices[dim.v2];
      if (p1 && p2) {
        const dVal = dim.d !== undefined ? dim.d : Math.hypot(p2.x - p1.x, p2.y - p1.y);
        solverConstraints.push(new window.Constraint("distance", [2 * dim.v1, 2 * dim.v1 + 1, 2 * dim.v2, 2 * dim.v2 + 1], { d: dVal }));
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
    }
  };

  window.resetViewport = () => {
    if (webglRenderer) {
      webglRenderer.resetView(sheetWidth, sheetHeight);
    }
  };

  // --- Initialize CAD on Boot ---
  if (canvasEl && typeof ExplicitCadRenderer !== "undefined") {
    webglRenderer = new ExplicitCadRenderer(canvasEl);
    webglRenderer.onViewChange = () => {
      drawSketchCanvas();
    };
    window.addEventListener("resize", () => {
      webglRenderer.resize();
      drawSketchCanvas();
    });
    
    // Fit drawing sheet
    webglRenderer.resetView(sheetWidth, sheetHeight);
  }

  // Initial draw and bind events
  showEntityInspector();
  renderLayerManager();
  drawSketchCanvas();
  initSketcherEvents();
  updateLiveProperties();
});
