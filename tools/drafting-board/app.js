// ==========================================================================
// 2D Engineering Drafting Board - Parametric CAD Core Engine
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const MetricThreads = window.MetricThreads || {};
  const ParallelKeys = window.ParallelKeys || {};

  // --- Drawing State ---
  let sketchVertices = []; // Coordinates array in mm
  let sketchCircles = [];  // Circle entities: [{ cx, cy, r, construction: false }]
  let isSketchClosed = false;
  let gridSnap = 10;       // Snap resolution in mm
  let selectedVertexIndex = -1;
  let mousePos = { x: 0, y: 0 };
  
  // CAD Tools Mode variables
  let editorMode = "draw"; // "draw", "circle", "fillet", "offset", "dimension", "measure"
  let customDimensions = []; // [{ v1: index1, v2: index2 }]
  let selectedVertexA = -1; // Vertex A for custom dimension selection
  let selectedVertexB = -1; // Vertex B for custom dimension selection
  let measureStartPos = null; // Ruler start coordinate
  let measureEndPos = null; // Ruler end coordinate
  let isMeasuring = false;

  // Circles drawing state
  let activeCircleCenter = null;
  let activeCircleRadius = 0;

  // Rect & Poly drawing state
  let polySides = 3;
  let activeRectStart = null;
  let activePolyCenter = null;

  // Selection & snapping
  let selectedEntity = null; // { type: 'line'|'circle'|'vertex', index: number }
  let hoveredSnapTarget = null; // { x, y, type: 'endpoint'|'midpoint'|'center' }
  
  let shiftPressed = false;

  // Sheet layout format config (A4 landscape is default)
  let sheetSize = "A4";
  let sheetWidth = 297;
  let sheetHeight = 210;

  // WebGL Render pipeline states (Phase 2)
  let webglRenderer = null;
  let activeRenderMode = "webgl";

  // Projected orthographic views configuration (Phase 3)
  let showProjectedViews = true;
  let extrusionThickness = 12; // in mm

  // Viewport Zoom & Pan state
  let zoomLevel = 1.0;
  let panOffset = { x: 0, y: 0 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  // --- Theme/UI Boot ---
  const svg = document.getElementById("sketch-canvas-svg");
  const canvasEl = document.getElementById("three-cad-canvas");

  function snapToGrid(x, y, snap) {
    return {
      x: Math.round(x / snap) * snap,
      y: Math.round(y / snap) * snap
    };
  }

  function getMousePos(canvasEl, evt) {
    if (webglRenderer) {
      const rect = webglRenderer.canvas.getBoundingClientRect();
      const mouseX = evt.clientX - rect.left;
      const mouseY = evt.clientY - rect.top;

      // Normalize device coordinates (-1 to 1)
      const ndcX = (mouseX / webglRenderer.width) * 2 - 1;
      const ndcY = -(mouseY / webglRenderer.height) * 2 + 1;

      const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
      vector.unproject(webglRenderer.camera);
      return {
        x: Math.round(vector.x),
        y: Math.round(vector.y)
      };
    }
    return { x: 0, y: 0 };
  }

  // Track shift key for Ortho Lock
  window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") shiftPressed = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") shiftPressed = false;
  });

  // --- State Share / Export Helpers (Required by Header) ---
  window.shareLink = () => {
    const state = {
      vertices: sketchVertices,
      circles: sketchCircles,
      customDimensions,
      isSketchClosed
    };
    const encoded = btoa(JSON.stringify(state));
    const url = `${window.location.origin}${window.location.pathname}?design=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Sharing link copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy share link:", err);
    });
  };

  window.exportJSON = () => {
    const state = {
      vertices: sketchVertices,
      circles: sketchCircles,
      customDimensions,
      isSketchClosed
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drafting_drawing.json";
    a.click();
  };

  window.importJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.vertices) {
          sketchVertices = data.vertices;
          sketchCircles = data.circles || [];
          customDimensions = data.customDimensions || [];
          isSketchClosed = !!data.isSketchClosed;
          drawSketchCanvas();
          updateLiveProperties();
        } else {
          alert("Invalid file format.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  // --- Project Manager Hook Registration (Auth Integration) ---
  window.projectManagerConfig = {
    toolId: "drafting-board",
    getInputs: () => ({
      vertices: sketchVertices,
      circles: sketchCircles,
      customDimensions,
      isSketchClosed
    }),
    setInputs: (data) => {
      if (data && data.vertices) {
        sketchVertices = data.vertices;
        sketchCircles = data.circles || [];
        customDimensions = data.customDimensions || [];
        isSketchClosed = !!data.isSketchClosed;
        drawSketchCanvas();
        updateLiveProperties();
      }
    }
  };

  // Check URL params on boot
  const urlParams = new URLSearchParams(window.location.search);
  const designParam = urlParams.get("design");
  if (designParam) {
    try {
      const decoded = JSON.parse(atob(designParam));
      window.projectManagerConfig.setInputs(decoded);
    } catch (err) {
      console.error("Failed to parse boot URL param:", err);
    }
  }

  // --- UI Control Triggers ---
  window.changeGridSnap = () => {
    gridSnap = parseInt(document.getElementById("grid-snap-select").value) || 10;
    drawSketchCanvas();
  };

  window.clearSketchCanvas = () => {
    sketchVertices = [];
    sketchCircles = [];
    isSketchClosed = false;
    customDimensions = [];
    selectedVertexA = -1;
    selectedVertexB = -1;
    measureStartPos = null;
    measureEndPos = null;
    isMeasuring = false;
    selectedEntity = null;
    showEntityInspector();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.undoSketchPoint = () => {
    if (isSketchClosed) {
      isSketchClosed = false;
    } else {
      sketchVertices.pop();
    }
    customDimensions = customDimensions.filter(d => d.v1 < sketchVertices.length && d.v2 < sketchVertices.length);
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.closeSketchShape = () => {
    if (sketchVertices.length >= 3) {
      isSketchClosed = true;
      drawSketchCanvas();
      updateLiveProperties();
    } else {
      alert("Please place at least 3 nodes before closing the shape.");
    }
  };



  // --- Export DXF & SVG Vector Blueprints ---
  window.exportSVGDrawing = () => {
    if (sketchVertices.length < 2) {
      alert("Please draw a shape first to export.");
      return;
    }
    const svgClone = svg.cloneNode(true);
    svgClone.querySelectorAll(".sk-handle, .sk-handle-selected, .sketcher-toolbar, .sk-snap-indicator, .sk-align-guide").forEach(el => el.remove());
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgClone.style.background = "#0c0f1d";
    
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drafting_profile.svg";
    a.click();
  };

  window.exportDXFDrawing = () => {
    if (sketchVertices.length < 2) {
      alert("Please draw a shape first to export.");
      return;
    }
    
    const db = new DxfDatabase();
    
    // Add layers
    db.addLayer("PROFILE_OUTLINE", 3, "CONTINUOUS");
    db.addLayer("HOLES", 1, "CONTINUOUS");
    db.addLayer("CONSTRUCTION", 2, "DASHED");
    db.addLayer("SHEET_FORMAT", 7, "CONTINUOUS");
    
    // 1. Export boundary outline lines
    const n = sketchVertices.length;
    const limit = isSketchClosed ? n : n - 1;
    for (let i = 0; i < limit; i++) {
      const p1 = sketchVertices[i];
      const p2 = sketchVertices[(i + 1) % n];
      db.entities.push({
        type: "LINE",
        layer: "PROFILE_OUTLINE",
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y
      });
    }

    // 2. Export circle holes
    sketchCircles.forEach(c => {
      db.entities.push({
        type: "CIRCLE",
        layer: c.construction ? "CONSTRUCTION" : "HOLES",
        cx: c.cx, cy: c.cy, r: c.r
      });
    });

    // 3. Export Sheet Format borders & title block on separate layer
    // Outer border
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: 0, y1: 0, x2: sheetWidth, y2: 0 });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: sheetWidth, y1: 0, x2: sheetWidth, y2: sheetHeight });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: sheetWidth, y1: sheetHeight, x2: 0, y2: sheetHeight });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: 0, y1: sheetHeight, x2: 0, y2: 0 });
    
    // Inner border
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: 10, y1: 10, x2: sheetWidth - 10, y2: 10 });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: sheetWidth - 10, y1: 10, x2: sheetWidth - 10, y2: sheetHeight - 10 });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: sheetWidth - 10, y1: sheetHeight - 10, x2: 10, y2: sheetHeight - 10 });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: 10, y1: sheetHeight - 10, x2: 10, y2: 10 });
    
    // Title block lines
    const tx = sheetWidth - 110;
    const ty = sheetHeight - 40;
    const tw = 100;
    const th = 30;
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: tx, y1: ty, x2: tx + tw, y2: ty });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: tx, y1: ty + 10, x2: tx + tw, y2: ty + 10 });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: tx, y1: ty + 20, x2: tx + tw, y2: ty + 20 });
    db.entities.push({ type: "LINE", layer: "SHEET_FORMAT", x1: tx + 60, y1: ty + 10, x2: tx + 60, y2: ty + 30 });

    const dxf = db.export();

    const blob = new Blob([dxf], { type: "application/dxf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drafting_profile.dxf";
    a.click();
  };

  // --- Math/Shoelace Property Solver supporting cutout holes ---
  function calculatePolygonProperties(vertices) {
    const n = vertices.length;
    if (n < 3) return { A: 0, yc: 0, Iz: 0, height: 0 };
    
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
      return { A: 0, yc: 0, Iz: 0, height: 0 };
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
    
    // Subtract circular holes
    let netArea = areaOuter;
    let netMomentSumY = cyOuter * areaOuter;
    let netMomentSumX = cxOuter * areaOuter;
    
    const activeHoles = sketchCircles.filter(c => !c.construction);
    
    activeHoles.forEach(c => {
      const aHole = Math.PI * c.r * c.r;
      netArea -= aHole;
      netMomentSumY -= c.cy * aHole;
      netMomentSumX -= c.cx * aHole;
    });
    
    if (netArea < 0.1) netArea = 0.1;
    
    const ycNet = netMomentSumY / netArea;
    const xcNet = netMomentSumX / netArea;
    
    // Parallel axis translation for outer shape
    const dOuter = ycNet - cyOuter;
    let netIz = IzOuter + areaOuter * dOuter * dOuter;
    
    // Subtract circle moments about the composite neutral axis
    activeHoles.forEach(c => {
      const aHole = Math.PI * c.r * c.r;
      const iHoleOwn = (Math.PI * Math.pow(c.r, 4)) / 4.0;
      const dHole = ycNet - c.cy;
      const iHoleComposite = iHoleOwn + aHole * dHole * dHole;
      netIz -= iHoleComposite;
    });
    
    if (netIz < 0.1) netIz = 0.1;
    const height = ymax - ymin;
    
    return {
      A: netArea / 100.0,      // mm² to cm²
      yc: ycNet,
      Iz: netIz / 10000.0,     // mm⁴ to cm⁴
      height: height           // mm
    };
  }

  function updateLiveProperties() {
    const props = calculatePolygonProperties(sketchVertices);
    
    if (isSketchClosed && props.A > 0) {
      document.getElementById("sk-area").textContent = `${props.A.toFixed(1)} cm²`;
      document.getElementById("sk-inertia").textContent = `${props.Iz.toFixed(1)} cm⁴`;
      document.getElementById("sk-centroid").textContent = `${props.yc.toFixed(1)} mm`;
      document.getElementById("sk-height").textContent = `${props.height.toFixed(1)} mm`;
    } else {
      document.getElementById("sk-area").textContent = "0.0 cm²";
      document.getElementById("sk-inertia").textContent = "0.0 cm⁴";
      document.getElementById("sk-centroid").textContent = "0.0 mm";
      document.getElementById("sk-height").textContent = "0.0 mm";
    }
  }

  // --- Drawing Sheet Format Background Overlay ---
  function drawSheetFormat(svgElement) {
    // 1. Draw Paper background rectangle (white sheet)
    const paper = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    paper.setAttribute("x", 0);
    paper.setAttribute("y", 0);
    paper.setAttribute("width", sheetWidth);
    paper.setAttribute("height", sheetHeight);
    paper.setAttribute("fill", "#ffffff");
    paper.setAttribute("stroke", "var(--border-color)");
    paper.setAttribute("stroke-width", 2);
    svgElement.appendChild(paper);

    // 2. Draw Outer Margin border (10mm indent)
    const border = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    border.setAttribute("x", 10);
    border.setAttribute("y", 10);
    border.setAttribute("width", sheetWidth - 20);
    border.setAttribute("height", sheetHeight - 20);
    border.setAttribute("fill", "none");
    border.setAttribute("stroke", "var(--text-primary)");
    border.setAttribute("stroke-width", 1.5);
    svgElement.appendChild(border);

    // 3. Draw standard zone subdivisions ticks and labels (A-D, 1-4)
    // Horizontal zones (1, 2, 3, 4)
    const zonesX = 4;
    const zoneW = (sheetWidth - 20) / zonesX;
    for (let i = 1; i < zonesX; i++) {
      const x = 10 + i * zoneW;
      const tickTop = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tickTop.setAttribute("x1", x); tickTop.setAttribute("y1", 10);
      tickTop.setAttribute("x2", x); tickTop.setAttribute("y2", 14);
      tickTop.setAttribute("stroke", "var(--text-primary)");
      svgElement.appendChild(tickTop);

      const tickBot = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tickBot.setAttribute("x1", x); tickBot.setAttribute("y1", sheetHeight - 10);
      tickBot.setAttribute("x2", x); tickBot.setAttribute("y2", sheetHeight - 14);
      tickBot.setAttribute("stroke", "var(--text-primary)");
      svgElement.appendChild(tickBot);
    }

    // Vertical zones (A, B, C, D)
    const zonesY = 4;
    const zoneH = (sheetHeight - 20) / zonesY;
    for (let i = 1; i < zonesY; i++) {
      const y = 10 + i * zoneH;
      const tickLeft = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tickLeft.setAttribute("x1", 10); tickLeft.setAttribute("y1", y);
      tickLeft.setAttribute("x2", 14); tickLeft.setAttribute("y2", y);
      tickLeft.setAttribute("stroke", "var(--text-primary)");
      svgElement.appendChild(tickLeft);

      const tickRight = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tickRight.setAttribute("x1", sheetWidth - 10); tickRight.setAttribute("y1", y);
      tickRight.setAttribute("x2", sheetWidth - 14); tickRight.setAttribute("y2", y);
      tickRight.setAttribute("stroke", "var(--text-primary)");
      svgElement.appendChild(tickRight);
    }

    // 4. Draw standard Title Block (bottom-right)
    // Box dimensions: width 100mm, height 30mm
    const tx = sheetWidth - 110;
    const ty = sheetHeight - 40;
    const tw = 100;
    const th = 30;

    const tbOuter = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    tbOuter.setAttribute("x", tx);
    tbOuter.setAttribute("y", ty);
    tbOuter.setAttribute("width", tw);
    tbOuter.setAttribute("height", th);
    tbOuter.setAttribute("fill", "var(--bg-secondary)");
    tbOuter.setAttribute("stroke", "var(--text-primary)");
    tbOuter.setAttribute("stroke-width", 1.5);
    svgElement.appendChild(tbOuter);

    // Divisions inside title block
    const divH1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    divH1.setAttribute("x1", tx); divH1.setAttribute("y1", ty + 10);
    divH1.setAttribute("x2", tx + tw); divH1.setAttribute("y2", ty + 10);
    divH1.setAttribute("stroke", "var(--text-primary)");
    svgElement.appendChild(divH1);

    const divH2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    divH2.setAttribute("x1", tx); divH2.setAttribute("y1", ty + 20);
    divH2.setAttribute("x2", tx + tw); divH2.setAttribute("y2", ty + 20);
    divH2.setAttribute("stroke", "var(--text-primary)");
    svgElement.appendChild(divH2);

    const divV1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    divV1.setAttribute("x1", tx + 60); divV1.setAttribute("y1", ty + 10);
    divV1.setAttribute("x2", tx + 60); divV1.setAttribute("y2", ty + 30);
    divV1.setAttribute("stroke", "var(--text-primary)");
    svgElement.appendChild(divV1);

    // Add Texts
    const addText = (text, x, y, size, weight = "normal", anchor = "start") => {
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", x);
      txt.setAttribute("y", y);
      txt.setAttribute("font-size", size);
      txt.setAttribute("font-family", "var(--font-sans)");
      txt.setAttribute("font-weight", weight);
      txt.setAttribute("text-anchor", anchor);
      txt.setAttribute("fill", "var(--text-primary)");
      txt.textContent = text;
      svgElement.appendChild(txt);
    };

    addText("ENGINEERING TOOLKIT CAD", tx + 5, ty + 7, 5, "bold");
    addText("DWG NO: ET-DRAFT-001", tx + 5, ty + 16, 4);
    addText(`SCALE: 1:1`, tx + 65, ty + 16, 4);
    addText(`SIZE: ${sheetSize}  SHEET 1 OF 1`, tx + 5, ty + 26, 4);
    addText("APPROVED", tx + 65, ty + 26, 4, "bold");
  }

  // --- SVG Viewport Rendering ---
  function drawSketchCanvas(drawCursorLine = false) {
    if (activeRenderMode === "webgl" && webglRenderer) {
      webglRenderer.updateDrawing(sketchVertices, sketchCircles, isSketchClosed, sheetWidth, sheetHeight);
      return;
    }
    if (!svg) return;
    svg.setAttribute("viewBox", `0 0 ${sheetWidth} ${sheetHeight}`);
    svg.innerHTML = `
      <defs>
        <marker id="arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--accent-primary)" />
        </marker>
        <marker id="arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-primary)" />
        </marker>
      </defs>
    `;
    
    const viewportG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    viewportG.setAttribute("transform", `translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`);
    svg.appendChild(viewportG);

    renderToViewport(viewportG, drawCursorLine);
  }

  function renderToViewport(svg, drawCursorLine) {
    
    // --- 1. Draw Paper Sheet Format (Borders, Title block, Subdivisions) ---
    drawSheetFormat(svg);

    // --- 2. Draw Bounded Grid Lines (avoiding title block) ---
    const majorStep = 50;
    const minorStep = 10;
    const margin = 10;

    for (let x = margin + minorStep; x < sheetWidth - margin; x += minorStep) {
      const isInsideTitleBlockX = (x > sheetWidth - 110);
      const lineX = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineX.setAttribute("x1", x);
      lineX.setAttribute("y1", margin);
      lineX.setAttribute("x2", x);
      lineX.setAttribute("y2", isInsideTitleBlockX ? sheetHeight - 40 : sheetHeight - margin);
      lineX.setAttribute("class", x % majorStep === 0 ? "sk-grid-major" : "sk-grid-minor");
      svg.appendChild(lineX);
    }
    
    for (let y = margin + minorStep; y < sheetHeight - margin; y += minorStep) {
      const isInsideTitleBlockY = (y > sheetHeight - 40);
      const lineY = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineY.setAttribute("x1", margin);
      lineY.setAttribute("y1", y);
      lineY.setAttribute("x2", isInsideTitleBlockY ? sheetWidth - 110 : sheetWidth - margin);
      lineY.setAttribute("y2", y);
      lineY.setAttribute("class", y % majorStep === 0 ? "sk-grid-major" : "sk-grid-minor");
      svg.appendChild(lineY);
    }
    
    // Draw Polygon Outline/Shaded Area
    if (sketchVertices.length > 0) {
      if (isSketchClosed) {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        let pointsStr = sketchVertices.map(p => `${p.x},${p.y}`).join(" ");
        poly.setAttribute("points", pointsStr);
        poly.setAttribute("class", "sk-polygon");
        svg.appendChild(poly);
      } else {
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        let pointsStr = sketchVertices.map(p => `${p.x},${p.y}`).join(" ");
        if (drawCursorLine && mousePos) {
          pointsStr += ` ${mousePos.x},${mousePos.y}`;
        }
        polyline.setAttribute("points", pointsStr);
        polyline.setAttribute("class", "sk-polyline");
        svg.appendChild(polyline);
        
        // Alignment guides
        if (drawCursorLine && mousePos && sketchVertices.length > 0) {
          const last = sketchVertices[sketchVertices.length - 1];
          const isH = Math.abs(mousePos.y - last.y) < 15;
          const isV = Math.abs(mousePos.x - last.x) < 15;
          if (isH) {
            const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hLine.setAttribute("x1", 0); hLine.setAttribute("y1", last.y);
            hLine.setAttribute("x2", 500); hLine.setAttribute("y2", last.y);
            hLine.setAttribute("class", "sk-align-guide");
            svg.appendChild(hLine);
          }
          if (isV) {
            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", last.x); vLine.setAttribute("y1", 0);
            vLine.setAttribute("x2", last.x); vLine.setAttribute("y2", 500);
            vLine.setAttribute("class", "sk-align-guide");
            svg.appendChild(vLine);
          }
        }
      }

      // Draw Line Segments for Selection Highlight
      const numVerts = sketchVertices.length;
      const limit = isSketchClosed ? numVerts : numVerts - 1;
      for (let i = 0; i < limit; i++) {
        const p1 = sketchVertices[i];
        const p2 = sketchVertices[(i + 1) % numVerts];
        const lineEl = document.createElementNS("http://www.w3.org/2000/svg", "line");
        lineEl.setAttribute("x1", p1.x);
        lineEl.setAttribute("y1", p1.y);
        lineEl.setAttribute("x2", p2.x);
        lineEl.setAttribute("y2", p2.y);
        
        let className = "sk-line-segment";
        if (selectedEntity && selectedEntity.type === "line" && selectedEntity.index === i) {
          className += " selected";
        }
        lineEl.setAttribute("class", className);
        lineEl.setAttribute("data-line-index", i);
        svg.appendChild(lineEl);
      }
    }

    // Draw Circle Cutouts
    sketchCircles.forEach((c, idx) => {
      const circleEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circleEl.setAttribute("cx", c.cx);
      circleEl.setAttribute("cy", c.cy);
      circleEl.setAttribute("r", c.r);
      
      let className = "sk-circle";
      if (c.construction) className += " sk-construction";
      if (selectedEntity && selectedEntity.type === "circle" && selectedEntity.index === idx) {
        className += " selected";
      }
      circleEl.setAttribute("class", className);
      circleEl.setAttribute("data-circle-index", idx);
      svg.appendChild(circleEl);
    });

    // Draw active circle guide during placement
    if (editorMode === "circle" && activeCircleCenter && mousePos) {
      const cGuide = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const r = Math.hypot(mousePos.x - activeCircleCenter.x, mousePos.y - activeCircleCenter.y);
      cGuide.setAttribute("cx", activeCircleCenter.x);
      cGuide.setAttribute("cy", activeCircleCenter.y);
      cGuide.setAttribute("r", r);
      cGuide.setAttribute("class", "sk-polyline");
      svg.appendChild(cGuide);
    }

    // Draw active rectangle guide during placement
    if (editorMode === "rect" && activeRectStart && mousePos) {
      const rGuide = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const pts = [
        `${activeRectStart.x},${activeRectStart.y}`,
        `${mousePos.x},${activeRectStart.y}`,
        `${mousePos.x},${mousePos.y}`,
        `${activeRectStart.x},${mousePos.y}`
      ].join(" ");
      rGuide.setAttribute("points", pts);
      rGuide.setAttribute("class", "sk-polyline");
      svg.appendChild(rGuide);
    }

    // Draw active polygon guide during placement
    if (editorMode === "poly" && activePolyCenter && mousePos) {
      const pGuide = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const radius = Math.hypot(mousePos.x - activePolyCenter.x, mousePos.y - activePolyCenter.y);
      const angleStep = (2 * Math.PI) / polySides;
      const startAngle = Math.atan2(mousePos.y - activePolyCenter.y, mousePos.x - activePolyCenter.x);
      const pts = [];
      for (let i = 0; i < polySides; i++) {
        const angle = startAngle + i * angleStep;
        pts.push(`${Math.round(activePolyCenter.x + radius * Math.cos(angle))},${Math.round(activePolyCenter.y + radius * Math.sin(angle))}`);
      }
      pGuide.setAttribute("points", pts.join(" "));
      pGuide.setAttribute("class", "sk-polyline");
      svg.appendChild(pGuide);
    }
    
    // Draw Custom Dimensions
    customDimensions.forEach((dim, dimIdx) => {
      const p1 = sketchVertices[dim.v1];
      const p2 = sketchVertices[dim.v2];
      if (!p1 || !p2) return;
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      
      if (len > 0.1) {
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const theta = Math.atan2(dy, dx);
        const normalAngle = theta - Math.PI / 2;
        
        const offsetDist = 32 + (dimIdx * 18); 
        
        const o1x = p1.x + offsetDist * Math.cos(normalAngle);
        const o1y = p1.y + offsetDist * Math.sin(normalAngle);
        const o2x = p2.x + offsetDist * Math.cos(normalAngle);
        const o2y = p2.y + offsetDist * Math.sin(normalAngle);
        const midx = mx + offsetDist * Math.cos(normalAngle);
        const midy = my + offsetDist * Math.cos(normalAngle);
        
        // Extension lines
        const ext1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ext1.setAttribute("x1", p1.x); ext1.setAttribute("y1", p1.y);
        ext1.setAttribute("x2", o1x); ext1.setAttribute("y2", o1y);
        ext1.setAttribute("class", "sk-dim-ext");
        svg.appendChild(ext1);
        
        const ext2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ext2.setAttribute("x1", p2.x); ext2.setAttribute("y1", p2.y);
        ext2.setAttribute("x2", o2x); ext2.setAttribute("y2", o2y);
        ext2.setAttribute("class", "sk-dim-ext");
        svg.appendChild(ext2);
        
        // Dimension line
        const dimLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        dimLine.setAttribute("x1", o1x); dimLine.setAttribute("y1", o1y);
        dimLine.setAttribute("x2", o2x); dimLine.setAttribute("y2", o2y);
        dimLine.setAttribute("class", "sk-dim-line");
        svg.appendChild(dimLine);
        
        // Text background
        const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        txtBg.setAttribute("x", midx - 22); txtBg.setAttribute("y", midy - 8);
        txtBg.setAttribute("width", 44); txtBg.setAttribute("height", 16);
        txtBg.setAttribute("rx", 3);
        txtBg.setAttribute("fill", "var(--bg-secondary)");
        txtBg.setAttribute("stroke", "var(--border-color)");
        txtBg.setAttribute("stroke-width", "0.5");
        svg.appendChild(txtBg);
        
        // Text label
        const dimTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        dimTxt.setAttribute("x", midx); dimTxt.setAttribute("y", midy + 4);
        dimTxt.setAttribute("class", "sk-dim-lbl");
        dimTxt.textContent = `${Math.round(len)}mm`;
        svg.appendChild(dimTxt);
      }
    });

    // --- Draw Tapped Holes & Clearance Fits Leader Annotations (Phase 5) ---
    sketchCircles.forEach((c) => {
      if (c.standardHole) {
        const thread = MetricThreads[c.standardHole];
        if (!thread) return;

        const angle = -Math.PI / 4; // 45 deg up-right
        const sx = c.cx + c.r * Math.cos(angle);
        const sy = c.cy + c.r * Math.sin(angle);
        const ex = sx + 20;
        const ey = sy - 20;
        const shX = ex + 25;

        // Leader line
        const leader = document.createElementNS("http://www.w3.org/2000/svg", "line");
        leader.setAttribute("x1", sx); leader.setAttribute("y1", sy);
        leader.setAttribute("x2", ex); leader.setAttribute("y2", ey);
        leader.setAttribute("stroke", "var(--accent-primary)");
        leader.setAttribute("stroke-width", 0.8);
        leader.setAttribute("marker-start", "url(#arrow-start)");
        svg.appendChild(leader);

        // Horizontal shoulder line
        const shoulder = document.createElementNS("http://www.w3.org/2000/svg", "line");
        shoulder.setAttribute("x1", ex); shoulder.setAttribute("y1", ey);
        shoulder.setAttribute("x2", shX); shoulder.setAttribute("y2", ey);
        shoulder.setAttribute("stroke", "var(--accent-primary)");
        shoulder.setAttribute("stroke-width", 0.8);
        svg.appendChild(shoulder);

        // Text labels above shoulder
        addTextToViewport(svg, `${c.standardHole}x${thread.pitch} TAPPED`, ex + 2, ey - 9, 3.5, "bold", "start");
        addTextToViewport(svg, `TAP DRILL: Ø${thread.tapDrill} mm`, ex + 2, ey - 5, 3.0, "normal", "start");
        addTextToViewport(svg, `TORQUE: ${thread.maxTorque} N-m`, ex + 2, ey - 1, 3.0, "normal", "start");
      }
      else if (c.holeTolerance) {
        const angle = Math.PI / 4; // 45 deg down-right
        const sx = c.cx + c.r * Math.cos(angle);
        const sy = c.cy + c.r * Math.sin(angle);
        const ex = sx + 20;
        const ey = sy + 20;
        const shX = ex + 25;

        // Leader line
        const leader = document.createElementNS("http://www.w3.org/2000/svg", "line");
        leader.setAttribute("x1", sx); leader.setAttribute("y1", sy);
        leader.setAttribute("x2", ex); leader.setAttribute("y2", ey);
        leader.setAttribute("stroke", "var(--accent-primary)");
        leader.setAttribute("stroke-width", 0.8);
        leader.setAttribute("marker-start", "url(#arrow-start)");
        svg.appendChild(leader);

        // Horizontal shoulder line
        const shoulder = document.createElementNS("http://www.w3.org/2000/svg", "line");
        shoulder.setAttribute("x1", ex); shoulder.setAttribute("y1", ey);
        shoulder.setAttribute("x2", shX); shoulder.setAttribute("y2", ey);
        shoulder.setAttribute("stroke", "var(--accent-primary)");
        shoulder.setAttribute("stroke-width", 0.8);
        svg.appendChild(shoulder);

        // Fit label
        addTextToViewport(svg, `Ø${(c.r * 2).toFixed(1)} ${c.holeTolerance}`, ex + 2, ey - 2, 3.5, "bold", "start");
      }
    });

    // Draw measuring ruler
    if (editorMode === "measure" && measureStartPos) {
      const dotStart = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dotStart.setAttribute("cx", measureStartPos.x);
      dotStart.setAttribute("cy", measureStartPos.y);
      dotStart.setAttribute("r", "4");
      dotStart.setAttribute("fill", "#22c55e");
      svg.appendChild(dotStart);
      
      let targetPos = null;
      if (isMeasuring && mousePos) {
        targetPos = mousePos;
      } else if (!isMeasuring && measureEndPos) {
        targetPos = measureEndPos;
        const dotEnd = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotEnd.setAttribute("cx", measureEndPos.x);
        dotEnd.setAttribute("cy", measureEndPos.y);
        dotEnd.setAttribute("r", "4");
        dotEnd.setAttribute("fill", "#22c55e");
        svg.appendChild(dotEnd);
      }
      
      if (targetPos) {
        const dx = targetPos.x - measureStartPos.x;
        const dy = targetPos.y - measureStartPos.y;
        const dist = Math.hypot(dx, dy);
        
        const mLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        mLine.setAttribute("x1", measureStartPos.x); mLine.setAttribute("y1", measureStartPos.y);
        mLine.setAttribute("x2", targetPos.x); mLine.setAttribute("y2", targetPos.y);
        mLine.setAttribute("class", "sk-measure-line");
        svg.appendChild(mLine);
        
        const midX = (measureStartPos.x + targetPos.x) / 2;
        const midY = (measureStartPos.y + targetPos.y) / 2;
        
        const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        txtBg.setAttribute("x", midX - 30); txtBg.setAttribute("y", midY - 9);
        txtBg.setAttribute("width", 60); txtBg.setAttribute("height", 18);
        txtBg.setAttribute("rx", 3);
        txtBg.setAttribute("fill", "var(--bg-secondary)");
        txtBg.setAttribute("stroke", "#22c55e");
        txtBg.setAttribute("stroke-width", "0.8");
        svg.appendChild(txtBg);
        
        const mTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        mTxt.setAttribute("x", midX); mTxt.setAttribute("y", midY + 4);
        mTxt.setAttribute("class", "sk-measure-lbl");
        mTxt.textContent = `${Math.round(dist)} mm`;
        svg.appendChild(mTxt);
      }
    }
    
    // Draw vertex handles
    sketchVertices.forEach((pt, idx) => {
      const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      handle.setAttribute("cx", pt.x);
      handle.setAttribute("cy", pt.y);
      handle.setAttribute("r", "5");
      
      let className = "sk-handle";
      if (selectedEntity && selectedEntity.type === "vertex" && selectedEntity.index === idx) {
        className += " sk-handle-selected";
      }
      handle.setAttribute("class", className);
      handle.setAttribute("data-index", idx);
      svg.appendChild(handle);
    });

    // Draw snap indicator if present
    if (hoveredSnapTarget) {
      const x = hoveredSnapTarget.x;
      const y = hoveredSnapTarget.y;
      if (hoveredSnapTarget.type === "endpoint") {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x - 4);
        rect.setAttribute("y", y - 4);
        rect.setAttribute("width", 8);
        rect.setAttribute("height", 8);
        rect.setAttribute("class", "sk-snap-indicator sk-snap-endpoint");
        svg.appendChild(rect);
      } else if (hoveredSnapTarget.type === "midpoint") {
        const tri = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        tri.setAttribute("points", `${x},${y-5} ${x-5},${y+4} ${x+5},${y+4}`);
        tri.setAttribute("class", "sk-snap-indicator sk-snap-midpoint");
        svg.appendChild(tri);
      } else if (hoveredSnapTarget.type === "center") {
        const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circ.setAttribute("cx", x);
        circ.setAttribute("cy", y);
        circ.setAttribute("r", 5);
        circ.setAttribute("class", "sk-snap-indicator sk-snap-center");
        svg.appendChild(circ);
      }
    }

    // --- 3. Projected Views & Detail View Rendering (Phase 3) ---
    if (showProjectedViews) {
      const bounds = getSketchBounds();
      drawProjectedViews(svg, bounds);
      drawDetailView(svg, bounds);
    }
  }

  // --- Bounding Box Solver ---
  function getSketchBounds() {
    if (sketchVertices.length === 0) {
      return { minX: 10, maxX: 10, minY: 10, maxY: 10, w: 0, h: 0, cx: 10, cy: 10 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    sketchVertices.forEach(v => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });
    sketchCircles.forEach(c => {
      if (c.cx - c.r < minX) minX = c.cx - c.r;
      if (c.cx + c.r > maxX) maxX = c.cx + c.r;
      if (c.cy - c.r < minY) minY = c.cy - c.r;
      if (c.cy + c.r > maxY) maxY = c.cy + c.r;
    });
    return {
      minX,
      maxX,
      minY,
      maxY,
      w: Math.max(1, maxX - minX),
      h: Math.max(1, maxY - minY),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2
    };
  }

  // --- Projected Orthographic Views ---
  function drawProjectedViews(svgElement, bounds) {
    if (sketchVertices.length === 0) return;

    const topY = 22; // fixed Y for top view on sheet
    const th = extrusionThickness;

    // Outer rectangle for Top View
    const topRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    topRect.setAttribute("x", bounds.minX);
    topRect.setAttribute("y", topY);
    topRect.setAttribute("width", bounds.w);
    topRect.setAttribute("height", th);
    topRect.setAttribute("fill", "none");
    topRect.setAttribute("stroke", "var(--text-primary)");
    topRect.setAttribute("stroke-width", 1.5);
    svgElement.appendChild(topRect);

    // Title label
    addTextToViewport(svgElement, "TOP VIEW", bounds.cx, topY - 3, 4, "bold", "middle");

    // Hidden lines for circles in Top View
    sketchCircles.forEach(c => {
      const x1 = c.cx - c.r;
      const x2 = c.cx + c.r;

      const hLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hLine1.setAttribute("x1", x1); hLine1.setAttribute("y1", topY);
      hLine1.setAttribute("x2", x1); hLine1.setAttribute("y2", topY + th);
      hLine1.setAttribute("stroke", "var(--text-primary)");
      hLine1.setAttribute("stroke-dasharray", "1 1");
      svgElement.appendChild(hLine1);

      const hLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hLine2.setAttribute("x1", x2); hLine2.setAttribute("y1", topY);
      hLine2.setAttribute("x2", x2); hLine2.setAttribute("y2", topY + th);
      hLine2.setAttribute("stroke", "var(--text-primary)");
      hLine2.setAttribute("stroke-dasharray", "1 1");
      svgElement.appendChild(hLine2);
    });

    // Vertical projection lines (Front to Top)
    const projLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    projLine1.setAttribute("x1", bounds.minX); projLine1.setAttribute("y1", topY + th);
    projLine1.setAttribute("x2", bounds.minX); projLine1.setAttribute("y2", bounds.minY);
    projLine1.setAttribute("stroke", "rgba(239, 68, 68, 0.4)"); // light red
    projLine1.setAttribute("stroke-dasharray", "1 2");
    svgElement.appendChild(projLine1);

    const projLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    projLine2.setAttribute("x1", bounds.maxX); projLine2.setAttribute("y1", topY + th);
    projLine2.setAttribute("x2", bounds.maxX); projLine2.setAttribute("y2", bounds.minY);
    projLine2.setAttribute("stroke", "rgba(239, 68, 68, 0.4)");
    projLine2.setAttribute("stroke-dasharray", "1 2");
    svgElement.appendChild(projLine2);

    // --- RIGHT VIEW ---
    const rightX = sheetWidth - 60; // fixed X for right view on sheet

    // Outer rectangle for Right View
    const rightRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rightRect.setAttribute("x", rightX);
    rightRect.setAttribute("y", bounds.minY);
    rightRect.setAttribute("width", th);
    rightRect.setAttribute("height", bounds.h);
    rightRect.setAttribute("fill", "none");
    rightRect.setAttribute("stroke", "var(--text-primary)");
    rightRect.setAttribute("stroke-width", 1.5);
    svgElement.appendChild(rightRect);

    // Title label
    addTextToViewport(svgElement, "RIGHT VIEW", rightX + th / 2, bounds.maxY + 8, 4, "bold", "middle");

    // Hidden lines for circles in Right View
    sketchCircles.forEach(c => {
      const y1 = c.cy - c.r;
      const y2 = c.cy + c.r;

      const hLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hLine1.setAttribute("x1", rightX); hLine1.setAttribute("y1", y1);
      hLine1.setAttribute("x2", rightX + th); hLine1.setAttribute("y2", y1);
      hLine1.setAttribute("stroke", "var(--text-primary)");
      hLine1.setAttribute("stroke-dasharray", "1 1");
      svgElement.appendChild(hLine1);

      const hLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hLine2.setAttribute("x1", rightX); hLine2.setAttribute("y1", y2);
      hLine2.setAttribute("x2", rightX + th); hLine2.setAttribute("y2", y2);
      hLine2.setAttribute("stroke", "var(--text-primary)");
      hLine2.setAttribute("stroke-dasharray", "1 1");
      svgElement.appendChild(hLine2);
    });

    // Horizontal projection lines (Front to Right)
    const projLine3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    projLine3.setAttribute("x1", bounds.maxX); projLine3.setAttribute("y1", bounds.minY);
    projLine3.setAttribute("x2", rightX); projLine3.setAttribute("y2", bounds.minY);
    projLine3.setAttribute("stroke", "rgba(239, 68, 68, 0.4)");
    projLine3.setAttribute("stroke-dasharray", "1 2");
    svgElement.appendChild(projLine3);

    const projLine4 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    projLine4.setAttribute("x1", bounds.maxX); projLine4.setAttribute("y1", bounds.maxY);
    projLine4.setAttribute("x2", rightX); projLine4.setAttribute("y2", bounds.maxY);
    projLine4.setAttribute("stroke", "rgba(239, 68, 68, 0.4)");
    projLine4.setAttribute("stroke-dasharray", "1 2");
    svgElement.appendChild(projLine4);
  }

  // --- Detail View Projection ---
  function drawDetailView(svgElement, bounds) {
    if (sketchVertices.length === 0) return;

    const focalCenter = sketchVertices[0];
    const detX = sheetWidth - 60;
    const detY = 60;
    const detR = 18;
    const detScale = 2.5;

    // 1. Circular source callout in Front View
    const srcCirc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    srcCirc.setAttribute("cx", focalCenter.x);
    srcCirc.setAttribute("cy", focalCenter.y);
    srcCirc.setAttribute("r", detR / detScale);
    srcCirc.setAttribute("fill", "none");
    srcCirc.setAttribute("stroke", "var(--accent-primary)");
    srcCirc.setAttribute("stroke-width", 0.8);
    srcCirc.setAttribute("stroke-dasharray", "2 2");
    svgElement.appendChild(srcCirc);

    addTextToViewport(svgElement, "A", focalCenter.x + detR / detScale + 2, focalCenter.y - 2, 4, "bold", "start");

    // 2. Setup Detail Clip Path inside defs
    const clipId = "detail-clip-path";
    const parentSvg = document.getElementById("sketch-canvas-svg");
    let defs = parentSvg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      parentSvg.appendChild(defs);
    }
    
    const oldClip = parentSvg.getElementById(clipId);
    if (oldClip) oldClip.remove();

    const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipCirc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    clipCirc.setAttribute("cx", detX);
    clipCirc.setAttribute("cy", detY);
    clipCirc.setAttribute("r", detR);
    clipPath.appendChild(clipCirc);
    defs.appendChild(clipPath);

    // 3. Create detail container group with clip-path
    const detailG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    detailG.setAttribute("clip-path", `url(#${clipId})`);
    svgElement.appendChild(detailG);

    // Draw white background inside detail circle
    const detBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    detBg.setAttribute("cx", detX);
    detBg.setAttribute("cy", detY);
    detBg.setAttribute("r", detR);
    detBg.setAttribute("fill", "#ffffff");
    detailG.appendChild(detBg);

    // Draw grid inside detail circle
    for (let x = Math.floor((detX - detR) / 10) * 10; x <= detX + detR; x += 10) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x); line.setAttribute("y1", detY - detR);
      line.setAttribute("x2", x); line.setAttribute("y2", detY + detR);
      line.setAttribute("class", "sk-grid-minor");
      detailG.appendChild(line);
    }
    for (let y = Math.floor((detY - detR) / 10) * 10; y <= detY + detR; y += 10) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", detX - detR); line.setAttribute("y1", y);
      line.setAttribute("x2", detX + detR); line.setAttribute("y2", y);
      line.setAttribute("class", "sk-grid-minor");
      detailG.appendChild(line);
    }

    const mapNode = (p) => ({
      x: detX + (p.x - focalCenter.x) * detScale,
      y: detY + (p.y - focalCenter.y) * detScale
    });

    // Draw lines inside detail circle
    const numVerts = sketchVertices.length;
    const limit = isSketchClosed ? numVerts : numVerts - 1;
    for (let i = 0; i < limit; i++) {
      const p1 = mapNode(sketchVertices[i]);
      const p2 = mapNode(sketchVertices[(i + 1) % numVerts]);
      
      const lineEl = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineEl.setAttribute("x1", p1.x);
      lineEl.setAttribute("y1", p1.y);
      lineEl.setAttribute("x2", p2.x);
      lineEl.setAttribute("y2", p2.y);
      lineEl.setAttribute("class", "sk-line-segment");
      detailG.appendChild(lineEl);
    }

    // Draw circles inside detail circle
    sketchCircles.forEach(c => {
      const mappedCenter = mapNode({ x: c.cx, y: c.cy });
      const mappedR = c.r * detScale;

      const circleEl = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circleEl.setAttribute("cx", mappedCenter.x);
      circleEl.setAttribute("cy", mappedCenter.y);
      circleEl.setAttribute("r", mappedR);
      circleEl.setAttribute("class", c.construction ? "sk-circle sk-construction" : "sk-circle");
      detailG.appendChild(circleEl);
    });

    // 4. Outer border circle for Detail View
    const detBorder = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    detBorder.setAttribute("cx", detX);
    detBorder.setAttribute("cy", detY);
    detBorder.setAttribute("r", detR);
    detBorder.setAttribute("fill", "none");
    detBorder.setAttribute("stroke", "var(--text-primary)");
    detBorder.setAttribute("stroke-width", 1.5);
    svgElement.appendChild(detBorder);

    // 5. Labels
    addTextToViewport(svgElement, "DETAIL A", detX, detY + detR + 6, 4.5, "bold", "middle");
    addTextToViewport(svgElement, "SCALE 2.5:1", detX, detY + detR + 11, 3.5, "normal", "middle");
  }

  function addTextToViewport(svgElement, text, x, y, size, weight = "normal", anchor = "start") {
    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", x);
    txt.setAttribute("y", y);
    txt.setAttribute("font-size", size);
    txt.setAttribute("font-family", "var(--font-sans)");
    txt.setAttribute("font-weight", weight);
    txt.setAttribute("text-anchor", anchor);
    txt.setAttribute("fill", "var(--text-primary)");
    txt.textContent = text;
    svgElement.appendChild(txt);
  }

  // --- Snap Engine ---
  function findSnapTarget(pos) {
    let bestTarget = null;
    let minDist = 14;
    
    sketchVertices.forEach((v, idx) => {
      const dist = Math.hypot(pos.x - v.x, pos.y - v.y);
      if (dist < minDist) {
        minDist = dist;
        bestTarget = { x: v.x, y: v.y, type: "endpoint", index: idx };
      }
    });
    
    const n = sketchVertices.length;
    const limit = isSketchClosed ? n : n - 1;
    for (let i = 0; i < limit; i++) {
      const p1 = sketchVertices[i];
      const p2 = sketchVertices[(i + 1) % n];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dist = Math.hypot(pos.x - mx, pos.y - my);
      if (dist < minDist) {
        minDist = dist;
        bestTarget = { x: mx, y: my, type: "midpoint", index: i };
      }
    }
    
    sketchCircles.forEach((c, idx) => {
      const dist = Math.hypot(pos.x - c.cx, pos.y - c.cy);
      if (dist < minDist) {
        minDist = dist;
        bestTarget = { x: c.cx, y: c.cy, type: "center", index: idx };
      }
    });
    
    return bestTarget;
  }

  // --- Fillet Splice Command ---
  function applyFillet(index, radius) {
    const n = sketchVertices.length;
    if (n < 3) return;
    
    const p1 = sketchVertices[(index - 1 + n) % n];
    const p = sketchVertices[index];
    const p2 = sketchVertices[(index + 1) % n];
    
    const v1 = { x: p1.x - p.x, y: p1.y - p.y };
    const v2 = { x: p2.x - p.x, y: p2.y - p.y };
    
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    
    if (len1 < 0.1 || len2 < 0.1) return;
    
    const maxRadius = Math.min(len1, len2) * 0.45;
    const r = Math.min(radius, maxRadius);
    
    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };
    
    const t1 = { x: Math.round(p.x + u1.x * r), y: Math.round(p.y + u1.y * r) };
    const t2 = { x: Math.round(p.x + u2.x * r), y: Math.round(p.y + u2.y * r) };
    
    sketchVertices.splice(index, 1, t1, t2);
    drawSketchCanvas();
    updateLiveProperties();
  }

  // --- Offset Outline Command ---
  window.offsetPolygon = (offsetDist) => {
    if (sketchVertices.length < 3) return;
    const n = sketchVertices.length;
    const newVerts = [];
    for (let i = 0; i < n; i++) {
      const p1 = sketchVertices[(i - 1 + n) % n];
      const p = sketchVertices[i];
      const p2 = sketchVertices[(i + 1) % n];
      
      const v1 = { x: p.x - p1.x, y: p.y - p1.y };
      const v2 = { x: p2.x - p.x, y: p2.y - p.y };
      
      const len1 = Math.hypot(v1.x, v1.y);
      const len2 = Math.hypot(v2.x, v2.y);
      if (len1 < 0.1 || len2 < 0.1) {
        newVerts.push({ x: p.x, y: p.y });
        continue;
      }
      
      const n1 = { x: -v1.y / len1, y: v1.x / len1 };
      const n2 = { x: -v2.y / len2, y: v2.x / len2 };
      
      const bisectorX = n1.x + n2.x;
      const bisectorY = n1.y + n2.y;
      const bisLen = Math.hypot(bisectorX, bisectorY);
      
      if (bisLen < 0.1) {
        newVerts.push({ x: p.x + n1.x * offsetDist, y: p.y + n1.y * offsetDist });
      } else {
        const cosHalfAngle = (n1.x * bisectorX + n1.y * bisectorY) / bisLen;
        const distScale = offsetDist / cosHalfAngle;
        newVerts.push({
          x: Math.round(p.x + (bisectorX / bisLen) * distScale),
          y: Math.round(p.y + (bisectorY / bisLen) * distScale)
        });
      }
    }
    sketchVertices = newVerts;
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.triggerOffsetProfile = () => {
    const val = parseFloat(document.getElementById("global-offset-val").value) || 10;
    offsetPolygon(val);
  };

  // --- Dynamic Sidebar Entity Inspector ---
  function showEntityInspector() {
    const panel = document.getElementById("sidebar-inspector-section");
    const container = document.getElementById("inspector-fields-container");
    if (!panel || !container) return;

    if (!selectedEntity) {
      // Show default Global Offset tools when no entity is selected
      panel.classList.remove("hidden");
      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Global Profile Tools</div>
          <div class="inspector-row">
            <label>Offset Boundary (mm)</label>
            <input type="number" id="global-offset-val" value="10" step="5">
          </div>
          <button class="action-btn primary" onclick="triggerOffsetProfile()" style="width:100%; margin-top:6px; height:32px;">
            Apply Offset Outline
          </button>
        </div>
      `;
      return;
    }

    panel.classList.remove("hidden");
    container.innerHTML = "";

    const idx = selectedEntity.index;

    if (selectedEntity.type === "circle") {
      const c = sketchCircles[idx];
      if (!c) return;
      
      const diam = c.r * 2;
      let keywayInfo = "No standard recommendation";
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
          <div class="inspector-title">Circle Entity (Hole/Shaft)</div>
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
            <label>Standard Tapped Hole</label>
            <select onchange="updateSelectedEntityParam('standardHole', this.value)">
              <option value="">None (Custom)</option>
              <option value="M3" ${c.standardHole === "M3" ? "selected" : ""}>M3 x 0.5</option>
              <option value="M4" ${c.standardHole === "M4" ? "selected" : ""}>M4 x 0.7</option>
              <option value="M5" ${c.standardHole === "M5" ? "selected" : ""}>M5 x 0.8</option>
              <option value="M6" ${c.standardHole === "M6" ? "selected" : ""}>M6 x 1.0</option>
              <option value="M8" ${c.standardHole === "M8" ? "selected" : ""}>M8 x 1.25</option>
              <option value="M10" ${c.standardHole === "M10" ? "selected" : ""}>M10 x 1.5</option>
              <option value="M12" ${c.standardHole === "M12" ? "selected" : ""}>M12 x 1.75</option>
            </select>
          </div>

          <div class="inspector-row">
            <label>ISO Clearance Fit (Hole)</label>
            <select onchange="updateSelectedEntityParam('holeTolerance', this.value)">
              <option value="">None</option>
              <option value="H7" ${c.holeTolerance === "H7" ? "selected" : ""}>H7 (Close Fit)</option>
              <option value="H8" ${c.holeTolerance === "H8" ? "selected" : ""}>H8 (Medium Fit)</option>
              <option value="H11" ${c.holeTolerance === "H11" ? "selected" : ""}>H11 (Free Fit)</option>
            </select>
          </div>

          <div class="inspector-row" style="margin-top: 6px; padding: 6px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 10px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">ISO 773 Keyway Recommendation</div>
            <div style="font-size: 11px; margin-top: 2px; font-family: var(--font-mono);">${keywayInfo}</div>
          </div>

          <div class="inspector-checkbox-row" style="margin-top: 10px;">
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
            <label>Segment Length</label>
            <input type="number" value="${Math.round(len)}" onchange="updateSelectedEntityParam('lineLength', this.value)">
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top: 4px;">
            Connected: Node ${idx} to Node ${(idx+1)%sketchVertices.length}
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
            <label>Coordinate X</label>
            <input type="number" value="${v.x}" onchange="updateSelectedEntityParam('x', this.value)">
          </div>
          <div class="inspector-row">
            <label>Coordinate Y</label>
            <input type="number" value="${v.y}" onchange="updateSelectedEntityParam('y', this.value)">
          </div>
          <button class="inspector-delete-btn" onclick="deleteSelectedEntity()">
            Delete Node
          </button>
        </div>
      `;
    }
  }

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
    } 
    else if (selectedEntity.type === "vertex") {
      const v = sketchVertices[idx];
      if (param === "x") v.x = Math.round(parseFloat(val));
      if (param === "y") v.y = Math.round(parseFloat(val));
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
        }
      }
    }
    
    drawSketchCanvas();
    updateLiveProperties();
    showEntityInspector();
  };

  window.deleteSelectedEntity = () => {
    if (!selectedEntity) return;
    const idx = selectedEntity.index;
    if (selectedEntity.type === "circle") {
      sketchCircles.splice(idx, 1);
    } else {
      // Vertex or Line deletes vertex
      sketchVertices.splice(idx, 1);
      if (sketchVertices.length < 3) isSketchClosed = false;
    }
    selectedEntity = null;
    drawSketchCanvas();
    updateLiveProperties();
    showEntityInspector();
  };

  // --- Mouse & Touch Events Handler ---
  function initSketcherEvents() {
    console.log("Binding WebGL canvas mouse listeners...");
    canvasEl.addEventListener("mousedown", (e) => {
      console.log("mousedown fired on canvas:", e.target);
      
      // Pan handling: middle-click or pan-mode left-click
      if (e.button === 1 || (e.button === 0 && editorMode === "pan")) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        return;
      }

      const pos = getMousePos(canvasEl, e);
      console.log("Relative coordinate position:", pos);
      
      // Determine click targets
      const targetCircleIndex = e.target.getAttribute("data-circle-index");
      const targetLineIndex = e.target.getAttribute("data-line-index");
      const targetVertexIndex = e.target.getAttribute("data-index");

      // ── SMART DIMENSION / SELECT MODE ──
      if (editorMode === "dimension") {
        if (targetVertexIndex !== null) {
          const clickedIdx = parseInt(targetVertexIndex);
          if (selectedVertexA === -1) {
            selectedVertexA = clickedIdx;
            document.getElementById("sketcher-instruction").textContent = "Smart Dim: Click the second vertex.";
          } else {
            selectedVertexB = clickedIdx;
            if (selectedVertexA !== selectedVertexB) {
              const exists = customDimensions.some(d => 
                (d.v1 === selectedVertexA && d.v2 === selectedVertexB) ||
                (d.v1 === selectedVertexB && d.v2 === selectedVertexA)
              );
              if (!exists) {
                customDimensions.push({ v1: selectedVertexA, v2: selectedVertexB });
              }
            }
            selectedVertexA = -1;
            selectedVertexB = -1;
            document.getElementById("sketcher-instruction").textContent = "Smart Dim: Click node, line or circle.";
          }
          selectedEntity = { type: "vertex", index: clickedIdx };
          showEntityInspector();
          drawSketchCanvas();
        } 
        else if (targetCircleIndex !== null) {
          selectedEntity = { type: "circle", index: parseInt(targetCircleIndex) };
          showEntityInspector();
          drawSketchCanvas();
        } 
        else if (targetLineIndex !== null) {
          selectedEntity = { type: "line", index: parseInt(targetLineIndex) };
          showEntityInspector();
          drawSketchCanvas();
        } 
        else {
          selectedEntity = null;
          showEntityInspector();
          drawSketchCanvas();
        }
        return;
      }

      // ── FILLET CORNER MODE ──
      if (editorMode === "fillet") {
        if (targetVertexIndex !== null) {
          const clickedIdx = parseInt(targetVertexIndex);
          const rPrompt = prompt("Enter fillet radius in mm:", "10");
          if (rPrompt !== null) {
            const rad = parseFloat(rPrompt);
            if (!isNaN(rad) && rad > 0) {
              applyFillet(clickedIdx, rad);
            }
          }
        }
        return;
      }

      // ── RULER MEASURE MODE ──
      if (editorMode === "measure") {
        const snapped = snapToGrid(pos.x, pos.y, gridSnap);
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

      // ── CIRCLE DRAWING MODE ──
      if (editorMode === "circle") {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y, gridSnap);
        activeCircleCenter = snapPt;
        return;
      }

      // ── RECTANGLE DRAWING MODE ──
      if (editorMode === "rect") {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y, gridSnap);
        activeRectStart = snapPt;
        return;
      }

      // ── POLYGON DRAWING MODE ──
      if (editorMode === "poly") {
        const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y, gridSnap);
        activePolyCenter = snapPt;
        return;
      }

      // ── POLYLINE DRAWING MODE ──
      if (editorMode === "draw") {
        if (targetVertexIndex !== null) {
          selectedVertexIndex = parseInt(targetVertexIndex);
          selectedEntity = { type: "vertex", index: selectedVertexIndex };
          showEntityInspector();
          return;
        }
        
        if (isSketchClosed) return;
        
        // Ortho Snap assistance
        let snapPt = snapToGrid(pos.x, pos.y, gridSnap);
        if (hoveredSnapTarget) {
          snapPt = hoveredSnapTarget;
        }
        
        if (shiftPressed && sketchVertices.length > 0) {
          const last = sketchVertices[sketchVertices.length - 1];
          const dx = Math.abs(snapPt.x - last.x);
          const dy = Math.abs(snapPt.y - last.y);
          if (dx > dy) {
            snapPt.y = last.y; // horizontal lock
          } else {
            snapPt.x = last.x; // vertical lock
          }
        }
        
        // Loop closure checker
        if (sketchVertices.length >= 3) {
          const start = sketchVertices[0];
          if (Math.hypot(snapPt.x - start.x, snapPt.y - start.y) < 15) {
            isSketchClosed = true;
            drawSketchCanvas();
            updateLiveProperties();
            return;
          }
        }
        
        sketchVertices.push(snapPt);
        drawSketchCanvas();
        updateLiveProperties();
      }
    });
    
    canvasEl.addEventListener("mousemove", (e) => {
      if (isPanning) return;

      const pos = getMousePos(canvasEl, e);
      const rawSnapped = snapToGrid(pos.x, pos.y, gridSnap);
      
      // Update Intelli-Snap tracker
      const snapObj = findSnapTarget(pos);
      hoveredSnapTarget = snapObj;

      let finalSnapped = snapObj ? snapObj : rawSnapped;
      
      // Update CAD Status Coordinate Displays
      document.getElementById("coords-display").textContent = `X: ${finalSnapped.x.toFixed(0)} | Y: ${finalSnapped.y.toFixed(0)} mm`;

      if (editorMode === "draw") {
        if (selectedVertexIndex !== -1) {
          sketchVertices[selectedVertexIndex] = finalSnapped;
          drawSketchCanvas();
          updateLiveProperties();
        } else {
          mousePos = finalSnapped;
          if (!isSketchClosed && sketchVertices.length > 0) {
            drawSketchCanvas(true);
          }
        }
      } 
      else if (editorMode === "circle" && activeCircleCenter) {
        mousePos = finalSnapped;
        drawSketchCanvas();
      }
      else if (editorMode === "rect" && activeRectStart) {
        mousePos = finalSnapped;
        drawSketchCanvas();
      }
      else if (editorMode === "poly" && activePolyCenter) {
        mousePos = finalSnapped;
        drawSketchCanvas();
      }
      else if (editorMode === "measure" && isMeasuring) {
        mousePos = finalSnapped;
        drawSketchCanvas();
      }
    });
    
    canvasEl.addEventListener("mouseup", (e) => {
      if (isPanning) {
        isPanning = false;
        return;
      }

      const pos = getMousePos(canvasEl, e);
      const snapPt = hoveredSnapTarget ? hoveredSnapTarget : snapToGrid(pos.x, pos.y, gridSnap);

      if (editorMode === "circle" && activeCircleCenter) {
        const radius = Math.round(Math.hypot(snapPt.x - activeCircleCenter.x, snapPt.y - activeCircleCenter.y));
        if (radius > 2) {
          sketchCircles.push({
            cx: activeCircleCenter.x,
            cy: activeCircleCenter.y,
            r: radius,
            construction: false
          });
        }
        activeCircleCenter = null;
        drawSketchCanvas();
        updateLiveProperties();
      }
      else if (editorMode === "rect" && activeRectStart) {
        const radiusX = Math.abs(snapPt.x - activeRectStart.x);
        const radiusY = Math.abs(snapPt.y - activeRectStart.y);
        if (radiusX > 2 && radiusY > 2) {
          sketchVertices = [
            { x: activeRectStart.x, y: activeRectStart.y },
            { x: snapPt.x, y: activeRectStart.y },
            { x: snapPt.x, y: snapPt.y },
            { x: activeRectStart.x, y: snapPt.y }
          ];
          isSketchClosed = true;
        }
        activeRectStart = null;
        drawSketchCanvas();
        updateLiveProperties();
      }
      else if (editorMode === "poly" && activePolyCenter) {
        const radius = Math.round(Math.hypot(snapPt.x - activePolyCenter.x, snapPt.y - activePolyCenter.y));
        if (radius > 4) {
          const angleStep = (2 * Math.PI) / polySides;
          const startAngle = Math.atan2(snapPt.y - activePolyCenter.y, snapPt.x - activePolyCenter.x);
          sketchVertices = [];
          for (let i = 0; i < polySides; i++) {
            const angle = startAngle + i * angleStep;
            sketchVertices.push({
              x: Math.round(activePolyCenter.x + radius * Math.cos(angle)),
              y: Math.round(activePolyCenter.y + radius * Math.sin(angle))
            });
          }
          isSketchClosed = true;
        }
        activePolyCenter = null;
        drawSketchCanvas();
        updateLiveProperties();
      }
      
      selectedVertexIndex = -1;
    });

    // ESC to reset tool selection
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        selectedEntity = null;
        activeCircleCenter = null;
        isMeasuring = false;
        showEntityInspector();
        drawSketchCanvas();
      }
    });

    // Command CLI Input Event Listener (Phase 3)
    const cliInput = document.getElementById("command-cli-input");
    if (cliInput) {
      cliInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const val = cliInput.value;
          cliInput.value = "";
          
          const lastPt = sketchVertices.length > 0 ? sketchVertices[sketchVertices.length - 1] : null;

          const addNodeFn = (x, y) => {
            sketchVertices.push({ x, y });
            drawSketchCanvas();
            updateLiveProperties();
          };

          const addCircleFn = (cx, cy, r) => {
            sketchCircles.push({ cx, cy, r, construction: false });
            drawSketchCanvas();
            updateLiveProperties();
          };

          const responseMsg = processCommandText(
            val,
            (mode) => setEditorMode(mode),
            () => editorMode,
            lastPt,
            addNodeFn,
            addCircleFn,
            clearSketchCanvas,
            undoSketchPoint,
            closeSketchShape
          );
          
          const statusText = document.getElementById("cad-status-text");
          if (statusText && responseMsg) {
            statusText.textContent = responseMsg;
          }
        }
      });
    }
  }

  // --- CAD Viewport Scaling Helpers ---
  window.zoomViewport = (factor) => {
    if (webglRenderer) {
      const aspect = webglRenderer.width / webglRenderer.height;
      const width = (webglRenderer.camera.right - webglRenderer.camera.left) / factor;
      
      webglRenderer.camera.left = -width / 2;
      webglRenderer.camera.right = width / 2;
      webglRenderer.camera.top = -width / aspect / 2;
      webglRenderer.camera.bottom = width / aspect / 2;
      webglRenderer.camera.updateProjectionMatrix();
      webglRenderer.render();
    }
  };

  window.resetViewport = () => {
    if (webglRenderer) {
      webglRenderer.resetView(sheetWidth, sheetHeight);
    }
  };

  window.changeSheetSize = () => {
    const select = document.getElementById("sheet-size-select");
    if (!select) return;
    sheetSize = select.value;
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
    drawSketchCanvas();
    updateLiveProperties();
  };


  window.toggleProjectedViews = () => {
    const cb = document.getElementById("toggle-projections-cb");
    if (!cb) return;
    showProjectedViews = cb.checked;
    
    const row = document.getElementById("extrusion-thickness-row");
    if (row) {
      row.style.display = showProjectedViews ? "block" : "none";
    }
    
    drawSketchCanvas();
  };

  window.changeExtrusionThickness = () => {
    const input = document.getElementById("extrusion-thickness-input");
    if (!input) return;
    const val = parseFloat(input.value);
    if (!isNaN(val) && val >= 2 && val <= 100) {
      extrusionThickness = val;
    }
    drawSketchCanvas();
  };

  // --- CAD Editor Toolbar Switcher ---
  window.setEditorMode = (mode) => {
    editorMode = mode;
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".viewport-btn").forEach(btn => btn.classList.remove("active"));
    
    if (mode === "draw") document.getElementById("tool-draw-btn").classList.add("active");
    else if (mode === "circle") document.getElementById("tool-circle-btn").classList.add("active");
    else if (mode === "rect") document.getElementById("tool-rect-btn").classList.add("active");
    else if (mode === "poly") {
      document.getElementById("tool-poly-btn").classList.add("active");
      const input = prompt("Enter number of polygon sides:", polySides);
      const parsed = parseInt(input);
      if (!isNaN(parsed) && parsed >= 3 && parsed <= 20) {
        polySides = parsed;
      }
    }
    else if (mode === "fillet") document.getElementById("tool-fillet-btn").classList.add("active");
    else if (mode === "offset") document.getElementById("tool-offset-btn").classList.add("active");
    else if (mode === "dimension") document.getElementById("tool-dimension-btn").classList.add("active");
    else if (mode === "measure") document.getElementById("tool-measure-btn").classList.add("active");
    else if (mode === "pan") {
      const panBtn = document.getElementById("vp-pan");
      if (panBtn) panBtn.classList.add("active");
    }
    
    selectedVertexA = -1;
    selectedVertexB = -1;
    measureStartPos = null;
    measureEndPos = null;
    isMeasuring = false;
    selectedEntity = null;
    
    const instr = document.getElementById("sketcher-instruction");
    const statusText = document.getElementById("cad-status-text");

    if (mode === "draw") {
      instr.textContent = "Profile Mode: Click the grid to plot vertices. Click start node to close the loop.";
      statusText.textContent = "Status: Drawing Profile";
    } else if (mode === "circle") {
      instr.textContent = "Circle Mode: Click center point, drag outward, and release to place circular cutout.";
      statusText.textContent = "Status: Circle / Hole Creator";
    } else if (mode === "rect") {
      instr.textContent = "Rectangle Mode: Click first corner, drag diagonal, and release to draw a rectangle.";
      statusText.textContent = "Status: Rectangle Creator";
    } else if (mode === "poly") {
      instr.textContent = `Polygon Mode (${polySides}-sided): Click center point, drag outward, and release to place.`;
      statusText.textContent = `Status: Drawing ${polySides}-sided Polygon`;
    } else if (mode === "fillet") {
      instr.textContent = "Fillet Mode: Click any corner node handle on the canvas to round it.";
      statusText.textContent = "Status: Fillet / Round Modifier";
    } else if (mode === "offset") {
      instr.textContent = "Offset Mode: Use the sidebar tool to offset the profile boundary by a thickness.";
      statusText.textContent = "Status: Profile Offsetting";
    } else if (mode === "dimension") {
      instr.textContent = "Smart Dimension: Click any line segment, circle, or click two nodes to create dimensions.";
      statusText.textContent = "Status: Inspection & Dimensioning";
    } else if (mode === "measure") {
      instr.textContent = "Measure Mode: Click any point to start measuring. Click second point to resolve distance.";
      statusText.textContent = "Status: Dynamic Ruler Tool";
    } else if (mode === "pan") {
      instr.textContent = "Pan Mode: Left-click and drag on the canvas to move the viewport.";
      statusText.textContent = "Status: Panning Viewport";
    }
    
    showEntityInspector();
    drawSketchCanvas();
  };

  // Bind subpage theme toggle click event
  const themeToggleBtn = document.getElementById("theme-toggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
    });
  }

  // Populate global offset panel initially and boot canvas
  const webglCanvas = document.getElementById("three-cad-canvas");
  if (webglCanvas && typeof ExplicitCadRenderer !== "undefined") {
    webglRenderer = new ExplicitCadRenderer(webglCanvas);
    webglRenderer.onViewChange = () => {
      drawSketchCanvas();
    };
  }

  showEntityInspector();
  if (webglRenderer) {
    webglRenderer.resetView(sheetWidth, sheetHeight);
  }
  drawSketchCanvas();
  initSketcherEvents();
});
