// ==========================================================================
// 2D Engineering Drafting Board - Parametric CAD Core Engine
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
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

  // Selection & snapping
  let selectedEntity = null; // { type: 'line'|'circle'|'vertex', index: number }
  let hoveredSnapTarget = null; // { x, y, type: 'endpoint'|'midpoint'|'center' }
  
  let shiftPressed = false;

  // --- Theme/UI Boot ---
  const svg = document.getElementById("sketch-canvas-svg");

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
    let dxf = "  0\nSECTION\n  2\nENTITIES\n";
    const n = sketchVertices.length;
    const limit = isSketchClosed ? n : n - 1;
    
    // Draw boundary lines
    for (let i = 0; i < limit; i++) {
      const p1 = sketchVertices[i];
      const p2 = sketchVertices[(i + 1) % n];
      dxf += "  0\nLINE\n  8\nPROFILE_OUTLINE\n";
      dxf += ` 10\n${p1.x}\n 20\n${p1.y}\n 30\n0.0\n`;
      dxf += ` 11\n${p2.x}\n 21\n${p2.y}\n 31\n0.0\n`;
    }

    // Draw circle holes
    sketchCircles.forEach(c => {
      dxf += "  0\nCIRCLE\n  8\nHoles\n";
      dxf += ` 10\n${c.cx}\n 20\n${c.cy}\n 30\n0.0\n 40\n${c.r}\n`;
    });

    dxf += "  0\nENDSEC\n  0\nEOF\n";
    
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

  // --- SVG Viewport Rendering ---
  function drawSketchCanvas(drawCursorLine = false) {
    if (!svg) return;
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
    
    // Draw Grid Lines (10px increments)
    for (let x = 20; x < 500; x += 20) {
      const lineX = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineX.setAttribute("x1", x);
      lineX.setAttribute("y1", 0);
      lineX.setAttribute("x2", x);
      lineX.setAttribute("y2", 500);
      lineX.setAttribute("class", x % 100 === 0 ? "sk-grid-major" : "sk-grid-minor");
      svg.appendChild(lineX);
    }
    for (let y = 20; y < 500; y += 20) {
      const lineY = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineY.setAttribute("x1", 0);
      lineY.setAttribute("y1", y);
      lineY.setAttribute("x2", 500);
      lineY.setAttribute("y2", y);
      lineY.setAttribute("class", y % 100 === 0 ? "sk-grid-major" : "sk-grid-minor");
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
      container.innerHTML = `
        <div class="inspector-fields">
          <div class="inspector-title">Circle Entity (Hole)</div>
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
    svg.addEventListener("mousedown", (e) => {
      const pos = getMousePos(svg, e);
      
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
    
    svg.addEventListener("mousemove", (e) => {
      const pos = getMousePos(svg, e);
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
      else if (editorMode === "measure" && isMeasuring) {
        mousePos = finalSnapped;
        drawSketchCanvas();
      }
    });
    
    svg.addEventListener("mouseup", (e) => {
      const pos = getMousePos(svg, e);
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
  }

  // --- CAD Editor Toolbar Switcher ---
  window.setEditorMode = (mode) => {
    editorMode = mode;
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    
    if (mode === "draw") document.getElementById("tool-draw-btn").classList.add("active");
    else if (mode === "circle") document.getElementById("tool-circle-btn").classList.add("active");
    else if (mode === "fillet") document.getElementById("tool-fillet-btn").classList.add("active");
    else if (mode === "offset") document.getElementById("tool-offset-btn").classList.add("active");
    else if (mode === "dimension") document.getElementById("tool-dimension-btn").classList.add("active");
    else if (mode === "measure") document.getElementById("tool-measure-btn").classList.add("active");
    
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
  showEntityInspector();
  drawSketchCanvas();
  initSketcherEvents();
});
