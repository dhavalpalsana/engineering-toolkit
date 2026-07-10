// ==========================================================================
// 2D Engineering Drafting Board - Core Engine
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // --- Drawing State ---
  let sketchVertices = []; // Coordinates array in mm
  let isSketchClosed = false;
  let gridSnap = 10; // Snap resolution in mm
  let selectedVertexIndex = -1;
  let mousePos = { x: 0, y: 0 };
  
  // CAD Tools Mode variables
  let editorMode = "draw"; // "draw", "dimension", "measure"
  let customDimensions = []; // [{ v1: index1, v2: index2 }]
  let selectedVertexA = -1; // Vertex A for custom dimension selection
  let selectedVertexB = -1; // Vertex B for custom dimension selection
  let measureStartPos = null; // Ruler start coordinate
  let measureEndPos = null; // Ruler end coordinate
  let isMeasuring = false;

  // --- Initial Canvas Boot ---
  drawSketchCanvas();
  initSketcherEvents();

  // --- Theme/UI Boot ---
  const svg = document.getElementById("sketch-canvas-svg");

  // --- State Share / Export Helpers (Required by Header) ---
  window.shareLink = () => {
    const state = {
      vertices: sketchVertices,
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
      customDimensions,
      isSketchClosed
    }),
    setInputs: (data) => {
      if (data && data.vertices) {
        sketchVertices = data.vertices;
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
    isSketchClosed = false;
    customDimensions = [];
    selectedVertexA = -1;
    selectedVertexB = -1;
    measureStartPos = null;
    measureEndPos = null;
    isMeasuring = false;
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

  // --- Load Shape Presets ---
  window.loadSketchTemplate = (type) => {
    isSketchClosed = true;
    customDimensions = [];
    if (type === "rect") {
      sketchVertices = [
        { x: 150, y: 150 },
        { x: 350, y: 150 },
        { x: 350, y: 350 },
        { x: 150, y: 350 }
      ];
    } else if (type === "ibeam") {
      sketchVertices = [
        { x: 150, y: 380 },
        { x: 350, y: 380 },
        { x: 350, y: 350 },
        { x: 270, y: 350 },
        { x: 270, y: 150 },
        { x: 350, y: 150 },
        { x: 350, y: 120 },
        { x: 150, y: 120 },
        { x: 150, y: 150 },
        { x: 230, y: 150 },
        { x: 230, y: 350 },
        { x: 150, y: 350 }
      ];
    } else if (type === "tbeam") {
      sketchVertices = [
        { x: 150, y: 380 },
        { x: 350, y: 380 },
        { x: 350, y: 340 },
        { x: 270, y: 340 },
        { x: 270, y: 120 },
        { x: 230, y: 120 },
        { x: 230, y: 340 },
        { x: 150, y: 340 }
      ];
    } else if (type === "angle") {
      sketchVertices = [
        { x: 150, y: 350 },
        { x: 350, y: 350 },
        { x: 350, y: 310 },
        { x: 190, y: 310 },
        { x: 190, y: 150 },
        { x: 150, y: 150 }
      ];
    } else if (type === "channel") {
      sketchVertices = [
        { x: 150, y: 350 },
        { x: 350, y: 350 },
        { x: 350, y: 310 },
        { x: 190, y: 310 },
        { x: 190, y: 190 },
        { x: 350, y: 190 },
        { x: 350, y: 150 },
        { x: 150, y: 150 }
      ];
    }
    drawSketchCanvas();
    updateLiveProperties();
  };

  // --- Export DXF & SVG Vector Blueprints ---
  window.exportSVGDrawing = () => {
    if (sketchVertices.length < 2) {
      alert("Please draw a shape first to export.");
      return;
    }
    const svgClone = svg.cloneNode(true);
    // Remove toolbar buttons and control handles from SVG clone for clean print output
    svgClone.querySelectorAll(".sk-handle, .sk-handle-selected, .sketcher-toolbar").forEach(el => el.remove());
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
    for (let i = 0; i < limit; i++) {
      const p1 = sketchVertices[i];
      const p2 = sketchVertices[(i + 1) % n];
      dxf += "  0\nLINE\n  8\n0\n"; // Layer 0
      dxf += ` 10\n${p1.x}\n 20\n${p1.y}\n 30\n0.0\n`;
      dxf += ` 11\n${p2.x}\n 21\n${p2.y}\n 31\n0.0\n`;
    }
    dxf += "  0\nENDSEC\n  0\nEOF\n";
    
    const blob = new Blob([dxf], { type: "application/dxf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drafting_profile.dxf";
    a.click();
  };

  // --- Math/Shoelace Property Solver ---
  function calculatePolygonProperties(vertices) {
    const n = vertices.length;
    if (n < 3) return { A: 0, yc: 0, Iz: 0, Sz: 0, height: 0 };
    
    let area = 0;
    let cx = 0;
    let cy = 0;
    
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      const factor = (p1.x * p2.y - p2.x * p1.y);
      area += factor;
      cx += (p1.x + p2.x) * factor;
      cy += (p1.y + p2.y) * factor;
    }
    
    area = area / 2.0;
    if (Math.abs(area) < 0.1) {
      return { A: 0, yc: 0, Iz: 0, Sz: 0, height: 0 };
    }
    
    cx = cx / (6.0 * area);
    cy = cy / (6.0 * area);
    
    let Ixx_origin = 0;
    let ymin = Infinity;
    let ymax = -Infinity;
    
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      ymin = Math.min(ymin, p1.y);
      ymax = Math.max(ymax, p1.y);
      
      const term1 = p1.y * p1.y + p1.y * p2.y + p2.y * p2.y;
      const term2 = p1.x * p2.y - p2.x * p1.y;
      Ixx_origin += term1 * term2;
    }
    Ixx_origin = Ixx_origin / 12.0;
    
    let Iz_centroid = Ixx_origin * Math.sign(area) - Math.abs(area) * cy * cy;
    const height = ymax - ymin;
    
    return {
      A: Math.max(0.1, Math.abs(area) / 100.0), // mm² to cm²
      yc: cy,
      Iz: Math.max(0.1, Iz_centroid / 10000.0), // mm⁴ to cm⁴
      height: height // mm
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
    
    // Draw Polygon Outline or Polyline
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
        
        // Snapping guide alignment lines
        if (drawCursorLine && mousePos && sketchVertices.length > 0) {
          const last = sketchVertices[sketchVertices.length - 1];
          const isH = Math.abs(mousePos.y - last.y) < 15;
          const isV = Math.abs(mousePos.x - last.x) < 15;
          if (isH) {
            const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hLine.setAttribute("x1", 0);
            hLine.setAttribute("y1", last.y);
            hLine.setAttribute("x2", 500);
            hLine.setAttribute("y2", last.y);
            hLine.setAttribute("class", "sk-align-guide");
            svg.appendChild(hLine);
          }
          if (isV) {
            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", last.x);
            vLine.setAttribute("y1", 0);
            vLine.setAttribute("x2", last.x);
            vLine.setAttribute("y2", 500);
            vLine.setAttribute("class", "sk-align-guide");
            svg.appendChild(vLine);
          }
        }
      }
      
      // Draw Selected Vertex A highlight
      if (editorMode === "dimension" && selectedVertexA !== -1) {
        const pt = sketchVertices[selectedVertexA];
        if (pt) {
          const highlight = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          highlight.setAttribute("cx", pt.x);
          highlight.setAttribute("cy", pt.y);
          highlight.setAttribute("r", "8");
          highlight.setAttribute("class", "sk-handle-selected");
          svg.appendChild(highlight);
        }
      }
      
      // Draw CAD Bounded Custom Dimensions
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
          const midy = my + offsetDist * Math.sin(normalAngle);
          
          // Extension lines
          const ext1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ext1.setAttribute("x1", p1.x);
          ext1.setAttribute("y1", p1.y);
          ext1.setAttribute("x2", o1x);
          ext1.setAttribute("y2", o1y);
          ext1.setAttribute("class", "sk-dim-ext");
          svg.appendChild(ext1);
          
          const ext2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ext2.setAttribute("x1", p2.x);
          ext2.setAttribute("y1", p2.y);
          ext2.setAttribute("x2", o2x);
          ext2.setAttribute("y2", o2y);
          ext2.setAttribute("class", "sk-dim-ext");
          svg.appendChild(ext2);
          
          // Dimension line
          const dimLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          dimLine.setAttribute("x1", o1x);
          dimLine.setAttribute("y1", o1y);
          dimLine.setAttribute("x2", o2x);
          dimLine.setAttribute("y2", o2y);
          dimLine.setAttribute("class", "sk-dim-line");
          svg.appendChild(dimLine);
          
          // Text pill background
          const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          txtBg.setAttribute("x", midx - 22);
          txtBg.setAttribute("y", midy - 8);
          txtBg.setAttribute("width", 44);
          txtBg.setAttribute("height", 16);
          txtBg.setAttribute("rx", 3);
          txtBg.setAttribute("fill", "var(--bg-secondary)");
          txtBg.setAttribute("stroke", "var(--border-color)");
          txtBg.setAttribute("stroke-width", "0.5");
          svg.appendChild(txtBg);
          
          // Text label
          const dimTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          dimTxt.setAttribute("x", midx);
          dimTxt.setAttribute("y", midy + 4);
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
          mLine.setAttribute("x1", measureStartPos.x);
          mLine.setAttribute("y1", measureStartPos.y);
          mLine.setAttribute("x2", targetPos.x);
          mLine.setAttribute("y2", targetPos.y);
          mLine.setAttribute("class", "sk-measure-line");
          svg.appendChild(mLine);
          
          const midX = (measureStartPos.x + targetPos.x) / 2;
          const midY = (measureStartPos.y + targetPos.y) / 2;
          
          const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          txtBg.setAttribute("x", midX - 30);
          txtBg.setAttribute("y", midY - 9);
          txtBg.setAttribute("width", 60);
          txtBg.setAttribute("height", 18);
          txtBg.setAttribute("rx", 3);
          txtBg.setAttribute("fill", "var(--bg-secondary)");
          txtBg.setAttribute("stroke", "#22c55e");
          txtBg.setAttribute("stroke-width", "0.8");
          svg.appendChild(txtBg);
          
          const mTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          mTxt.setAttribute("x", midX);
          mTxt.setAttribute("y", midY + 4);
          mTxt.setAttribute("class", "sk-measure-lbl");
          mTxt.textContent = `${Math.round(dist)} mm`;
          svg.appendChild(mTxt);
        }
      }
      
      // Draw active handles (node dragging)
      sketchVertices.forEach((pt, idx) => {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        handle.setAttribute("cx", pt.x);
        handle.setAttribute("cy", pt.y);
        handle.setAttribute("r", "5");
        handle.setAttribute("class", "sk-handle");
        handle.setAttribute("data-index", idx);
        svg.appendChild(handle);
      });
    }
  }

  // --- Mouse/Touch Event Handling ---
  function getMousePos(svgCanvas, evt) {
    const rect = svgCanvas.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * 500,
      y: ((evt.clientY - rect.top) / rect.height) * 500
    };
  }

  function snapToGrid(x, y, snap) {
    return {
      x: Math.round(x / snap) * snap,
      y: Math.round(y / snap) * snap
    };
  }

  function initSketcherEvents() {
    svg.addEventListener("mousedown", (e) => {
      if (editorMode === "draw") {
        if (e.target.classList.contains("sk-handle")) {
          selectedVertexIndex = parseInt(e.target.getAttribute("data-index"));
          return;
        }
        
        if (isSketchClosed) return;
        
        const pos = getMousePos(svg, e);
        const snapped = snapToGrid(pos.x, pos.y, gridSnap);
        
        // Loop closure checker
        if (sketchVertices.length >= 3) {
          const start = sketchVertices[0];
          if (Math.hypot(snapped.x - start.x, snapped.y - start.y) < 15) {
            isSketchClosed = true;
            drawSketchCanvas();
            updateLiveProperties();
            return;
          }
        }
        
        sketchVertices.push(snapped);
        drawSketchCanvas();
        updateLiveProperties();
      } 
      else if (editorMode === "dimension") {
        const pos = getMousePos(svg, e);
        let clickedIdx = -1;
        for (let i = 0; i < sketchVertices.length; i++) {
          const v = sketchVertices[i];
          if (Math.hypot(pos.x - v.x, pos.y - v.y) < 15) {
            clickedIdx = i;
            break;
          }
        }
        
        if (clickedIdx !== -1) {
          if (selectedVertexA === -1) {
            selectedVertexA = clickedIdx;
            document.getElementById("sketcher-instruction").textContent = "Click the second vertex.";
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
            document.getElementById("sketcher-instruction").textContent = "Add Dimension Mode: Click the first vertex.";
          }
          drawSketchCanvas();
        }
      } 
      else if (editorMode === "measure") {
        const pos = getMousePos(svg, e);
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
          document.getElementById("sketcher-instruction").textContent = `Measured Distance: ${dist} mm. Click grid to measure again.`;
        }
        drawSketchCanvas();
      }
    });
    
    svg.addEventListener("mousemove", (e) => {
      const pos = getMousePos(svg, e);
      const snapped = snapToGrid(pos.x, pos.y, gridSnap);
      
      if (editorMode === "draw") {
        if (selectedVertexIndex !== -1) {
          sketchVertices[selectedVertexIndex] = snapped;
          drawSketchCanvas();
          updateLiveProperties();
        } else {
          mousePos = snapped;
          if (!isSketchClosed && sketchVertices.length > 0) {
            drawSketchCanvas(true);
          }
        }
      } 
      else if (editorMode === "measure") {
        mousePos = snapped;
        if (isMeasuring) {
          drawSketchCanvas();
        }
      }
    });
    
    // Mobile Touch bindings
    svg.addEventListener("touchstart", (e) => {
      if (editorMode === "draw" && e.target.classList.contains("sk-handle")) {
        selectedVertexIndex = parseInt(e.target.getAttribute("data-index"));
        e.preventDefault();
      }
    }, { passive: false });
    
    svg.addEventListener("touchmove", (e) => {
      if (editorMode === "draw" && selectedVertexIndex !== -1 && e.touches.length > 0) {
        const pos = getMousePos(svg, e.touches[0]);
        const snapped = snapToGrid(pos.x, pos.y, gridSnap);
        sketchVertices[selectedVertexIndex] = snapped;
        drawSketchCanvas();
        updateLiveProperties();
        e.preventDefault();
      }
    }, { passive: false });
    
    const onRelease = () => {
      selectedVertexIndex = -1;
    };
    window.addEventListener("mouseup", onRelease);
    window.addEventListener("touchend", onRelease);
    
    // Double click to close outline or edit dimensions
    svg.addEventListener("dblclick", (e) => {
      const pos = getMousePos(svg, e);
      
      let clickedDimIdx = -1;
      customDimensions.forEach((dim, idx) => {
        const p1 = sketchVertices[dim.v1];
        const p2 = sketchVertices[dim.v2];
        if (!p1 || !p2) return;
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.1) return;
        
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        
        const theta = Math.atan2(dy, dx);
        const normalAngle = theta - Math.PI / 2;
        
        const offsetDist = 32 + (idx * 18);
        const midx = mx + offsetDist * Math.cos(normalAngle);
        const midy = my + offsetDist * Math.sin(normalAngle);
        
        const distToLabel = Math.hypot(pos.x - midx, pos.y - midy);
        if (distToLabel < 22) {
          clickedDimIdx = idx;
        }
      });
      
      if (clickedDimIdx !== -1) {
        editCustomDimensionLength(clickedDimIdx);
        return;
      }
      
      if (editorMode === "draw" && !isSketchClosed && sketchVertices.length >= 3) {
        isSketchClosed = true;
        drawSketchCanvas();
        updateLiveProperties();
      }
    });
    
    // Right click menu overrides
    svg.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (editorMode === "draw" && !isSketchClosed) {
        if (sketchVertices.length >= 3) {
          isSketchClosed = true;
        } else {
          sketchVertices = [];
        }
        drawSketchCanvas();
        updateLiveProperties();
      }
    });
    
    // ESC key shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (editorMode === "draw" && !isSketchClosed) {
          if (sketchVertices.length >= 3) {
            isSketchClosed = true;
          } else {
            sketchVertices = [];
          }
        } else {
          setEditorMode("draw");
        }
        drawSketchCanvas();
        updateLiveProperties();
      }
    });
  }

  window.setEditorMode = (mode) => {
    editorMode = mode;
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    if (mode === "draw") document.getElementById("tool-draw-btn").classList.add("active");
    else if (mode === "dimension") document.getElementById("tool-dimension-btn").classList.add("active");
    else if (mode === "measure") document.getElementById("tool-measure-btn").classList.add("active");
    
    selectedVertexA = -1;
    selectedVertexB = -1;
    measureStartPos = null;
    measureEndPos = null;
    isMeasuring = false;
    
    const instr = document.getElementById("sketcher-instruction");
    if (mode === "draw") {
      instr.textContent = "Click on the grid to place vertices. Click the starting node (or 'Close Shape') to close the loop.";
    } else if (mode === "dimension") {
      instr.textContent = "Add Dimension Mode: Click the first vertex of the distance you wish to dimension.";
    } else if (mode === "measure") {
      instr.textContent = "Measure Mode: Click any point on the grid to start measuring.";
    }
    drawSketchCanvas();
  };

  window.editCustomDimensionLength = (idx) => {
    const dim = customDimensions[idx];
    if (!dim) return;
    
    const p1 = sketchVertices[dim.v1];
    const p2 = sketchVertices[dim.v2];
    if (!p1 || !p2) return;
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    
    const promptVal = prompt(`Enter new length for this dimension in mm (current: ${Math.round(len)} mm):`, Math.round(len));
    if (promptVal === null) return;
    
    const newLen = parseFloat(promptVal);
    if (isNaN(newLen) || newLen <= 0) {
      alert("Please enter a valid positive length.");
      return;
    }
    
    const ratio = newLen / len;
    
    const targetX = p1.x + dx * ratio;
    const targetY = p1.y + dy * ratio;
    const shiftX = targetX - p2.x;
    const shiftY = targetY - p2.y;
    
    const startIdx = dim.v2;
    for (let j = startIdx; j < sketchVertices.length; j++) {
      sketchVertices[j].x = Math.round(sketchVertices[j].x + shiftX);
      sketchVertices[j].y = Math.round(sketchVertices[j].y + shiftY);
    }
    
    drawSketchCanvas();
    updateLiveProperties();
  };
});
