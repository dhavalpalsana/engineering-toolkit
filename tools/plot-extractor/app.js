/**
 * Plot Data Extractor — App Logic
 * Precision axes calibration, logarithmic scaling, magnifier loupe, curve fitting,
 * multi-series management, clipboard paste, and Firebase Project Manager synchronization.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Select DOM Elements
  const dropzone = document.getElementById("image-dropzone");
  const fileInput = document.getElementById("file-upload-input");
  const canvasContainer = document.getElementById("canvas-container-root");
  const canvasWrapper = document.getElementById("plot-canvas-wrapper");
  const plotImg = document.getElementById("plot-image");
  const canvas = document.getElementById("interaction-canvas");
  const ctx = canvas.getContext("2d");
  
  const modeBtnCalibrate = document.getElementById("mode-btn-calibrate");
  
  const inputCalX1 = document.getElementById("cal-x1");
  const inputCalX2 = document.getElementById("cal-x2");
  const inputCalY1 = document.getElementById("cal-y1");
  const inputCalY2 = document.getElementById("cal-y2");
  
  const selectScaleX = document.getElementById("scale-x");
  const selectScaleY = document.getElementById("scale-y");
  
  const seriesContainer = document.getElementById("series-list-container");
  const btnAddSeries = document.getElementById("btn-add-series");
  const btnClearPoints = document.getElementById("btn-clear-points");
  
  const pointsTableBody = document.getElementById("points-table-body");
  const selectFitType = document.getElementById("fit-type");
  const fitStatsBox = document.getElementById("fit-stats-box");
  const valR2 = document.getElementById("val-r2");
  const valFormula = document.getElementById("val-formula");
  
  const btnCopyCSV = document.getElementById("btn-copy-csv");
  const btnDownloadCSV = document.getElementById("btn-download-csv");
  const btnDownloadCombinedCSV = document.getElementById("btn-download-combined-csv");
  const btnExportTable = document.getElementById("btn-export-table");
  
  const btnResetZoom = document.getElementById("btn-reset-zoom");
  const btnRemoveImage = document.getElementById("btn-remove-image");
  const imageActions = document.getElementById("image-actions");
  
  const helperText = document.getElementById("helper-text");
  
  // Lookup Table Modal Elements
  const lookupModal = document.getElementById("lookup-modal");
  const btnCloseLookup = document.getElementById("btn-close-lookup");
  const inputLookupStart = document.getElementById("lookup-start");
  const inputLookupEnd = document.getElementById("lookup-end");
  const inputLookupStep = document.getElementById("lookup-step");
  const inputLookupDecimals = document.getElementById("lookup-decimals");
  const btnCalculateLookup = document.getElementById("btn-calculate-lookup");
  const lookupResultsContainer = document.getElementById("lookup-results-container");
  const lookupResultsBody = document.getElementById("lookup-results-body");
  const btnDownloadPlot = document.getElementById("btn-download-plot");
  const zoomSlider = document.getElementById("zoom-slider");
  const zoomLabel = document.getElementById("zoom-label");
  
  // Application State Variables
  let currentMode = "calibrate"; // "calibrate" or "digitize"
  let imageLoaded = false;
  let imgWidth = 0;
  let imgHeight = 0;
  let imgScale = 1.0;
  let compressedImgData = null; // Stored as base64 string for saving
  let zoomFactor = 1.0;
  
  // Calibration Handles (in image pixel space)
  let calibrationPoints = {
    x1: { px: 0, py: 0 },
    x2: { px: 0, py: 0 },
    y1: { px: 0, py: 0 },
    y2: { px: 0, py: 0 }
  };
  
  // Data Series List
  let seriesList = [
    {
      id: "series-1",
      name: "Series 1",
      color: "#0d9488",
      points: [], // array of { px, py }
      fitType: "none"
    }
  ];
  let activeSeriesId = "series-1";
  
  let isDragging = false;
  let dragTarget = null; // "x1", "x2", "y1", "y2", or point object
  let dragSeriesId = null;
  let hoverInfo = null; // { x, y, label }
  let selectedDataPoint = null;
  let isPanning = false;
  let startX = 0, startY = 0;
  let startScrollLeft = 0, startScrollTop = 0;
  let mouseOnCanvas = false;
  let lastMousePos = { x: 0, y: 0 };
  
  // Magnifier Loupe Settings
  const loupeRadius = 45;
  const loupeZoom = 3.5;
  
  // Initialize lucide icons
  lucide.createIcons();
  
  // ── Drag & Drop, Select Image Handlers ───────────────────────
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });
  
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  });
  
  // Clipboard screenshot paste handler (Ctrl+V)
  window.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        handleImageFile(file);
        break;
      }
    }
  });
  
  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      loadImage(event.target.result);
    };
    reader.readAsDataURL(file);
  }
  
  function loadImage(dataUrl) {
    const img = new Image();
    img.onload = function() {
      // Compress image to a max dimension of 1000px to prevent Firestore size overflow
      const maxDim = 1000;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      
      const compCanvas = document.createElement("canvas");
      compCanvas.width = w;
      compCanvas.height = h;
      const compCtx = compCanvas.getContext("2d");
      compCtx.drawImage(img, 0, 0, w, h);
      
      compressedImgData = compCanvas.toDataURL("image/jpeg", 0.85);
      plotImg.src = compressedImgData;
      
      imgWidth = w;
      imgHeight = h;
      imageLoaded = true;
      
      // Initial handle position resets
      calibrationPoints.x1 = { px: Math.round(w * 0.15), py: Math.round(h * 0.85) };
      calibrationPoints.x2 = { px: Math.round(w * 0.85), py: Math.round(h * 0.85) };
      calibrationPoints.y1 = { px: Math.round(w * 0.15), py: Math.round(h * 0.85) };
      calibrationPoints.y2 = { px: Math.round(w * 0.15), py: Math.round(h * 0.15) };
      
      // Update UI
      dropzone.style.display = "none";
      canvasWrapper.style.display = "block";
      imageActions.style.display = "flex";
      
      resizeCanvas();
      updateHelperBanner();
      renderAll();
    };
    img.src = dataUrl;
  }
  
  function resizeCanvas() {
    if (!imageLoaded) return;
    let displayWidth = plotImg.clientWidth;
    if (plotImg.style.width) {
      displayWidth = parseFloat(plotImg.style.width);
    }
    const displayHeight = displayWidth * (imgHeight / imgWidth);
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    imgScale = displayWidth / imgWidth;
  }
  
  window.addEventListener("resize", () => {
    resizeCanvas();
    renderAll();
  });
  
  plotImg.addEventListener("load", () => {
    resizeCanvas();
    renderAll();
  });
  
  btnRemoveImage.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the current plot?")) {
      clearImage();
    }
  });
  
  function clearImage() {
    imageLoaded = false;
    compressedImgData = null;
    zoomFactor = 1.0;
    zoomSlider.value = 1.0;
    zoomLabel.textContent = "100%";
    plotImg.style.width = "";
    plotImg.style.maxWidth = "100%";
    plotImg.style.maxHeight = "80vh";
    dropzone.style.display = "flex";
    canvasWrapper.style.display = "none";
    imageActions.style.display = "none";
    plotImg.src = "";
    seriesList.forEach(s => {
      s.points = [];
      s.fitType = "none";
    });
    updateHelperBanner();
    renderAll();
  }
  
  // ── Mode Toggles ─────────────────────────────────────────────
  modeBtnCalibrate.addEventListener("click", () => {
    if (currentMode === "calibrate") {
      currentMode = "pan";
      modeBtnCalibrate.classList.remove("active");
    } else {
      currentMode = "calibrate";
      modeBtnCalibrate.classList.add("active");
    }
    selectedDataPoint = null;
    updateSeriesUI();
    updateHelperBanner();
    renderAll();
  });
  
  function updateHelperBanner() {
    if (!imageLoaded) {
      helperText.textContent = "Start by dragging or pasting a plot image to begin.";
      return;
    }
    if (currentMode === "calibrate") {
      helperText.textContent = "Drag calibration points (X1, X2, Y1, Y2) to known axis lines and input their values in the sidebar.";
    } else if (currentMode === "digitize") {
      const activeSeries = seriesList.find(s => s.id === activeSeriesId);
      const name = activeSeries ? activeSeries.name : "active series";
      helperText.textContent = `Digitizing "${name}": Click canvas to add points. Drag points to adjust. Double-click to delete.`;
    } else if (currentMode === "pan") {
      helperText.textContent = "Pan Mode: Click and drag anywhere on the canvas to pan. Click Calibrate or a series pencil to edit.";
    }
  }
  
  // ── Math Calculations: Image Pixel Space ⇄ Calibrated Math Space ────
  function toMathCoords(px, py) {
    const scaleX = selectScaleX.value;
    const scaleY = selectScaleY.value;
    
    const x1Val = parseFloat(inputCalX1.value) || 0;
    const x2Val = parseFloat(inputCalX2.value) || 10;
    const y1Val = parseFloat(inputCalY1.value) || 0;
    const y2Val = parseFloat(inputCalY2.value) || 10;
    
    const cal = calibrationPoints;
    let x, y;
    
    // X scale conversion
    if (scaleX === "log") {
      const logX1 = Math.log10(x1Val);
      const logX2 = Math.log10(x2Val);
      const frac = (px - cal.x1.px) / (cal.x2.px - cal.x1.px);
      x = Math.pow(10, logX1 + frac * (logX2 - logX1));
    } else {
      const frac = (px - cal.x1.px) / (cal.x2.px - cal.x1.px);
      x = x1Val + frac * (x2Val - x1Val);
    }
    
    // Y scale conversion
    if (scaleY === "log") {
      const logY1 = Math.log10(y1Val);
      const logY2 = Math.log10(y2Val);
      const frac = (py - cal.y1.py) / (cal.y2.py - cal.y1.py);
      y = Math.pow(10, logY1 + frac * (logY2 - logY1));
    } else {
      const frac = (py - cal.y1.py) / (cal.y2.py - cal.y1.py);
      y = y1Val + frac * (y2Val - y1Val);
    }
    
    return { x, y };
  }
  
  function toPixelCoords(x, y) {
    const scaleX = selectScaleX.value;
    const scaleY = selectScaleY.value;
    
    const x1Val = parseFloat(inputCalX1.value) || 0;
    const x2Val = parseFloat(inputCalX2.value) || 10;
    const y1Val = parseFloat(inputCalY1.value) || 0;
    const y2Val = parseFloat(inputCalY2.value) || 10;
    
    const cal = calibrationPoints;
    let px, py;
    
    // X math to pixel
    if (scaleX === "log") {
      const logX = Math.log10(x);
      const logX1 = Math.log10(x1Val);
      const logX2 = Math.log10(x2Val);
      const frac = (logX - logX1) / (logX2 - logX1);
      px = cal.x1.px + frac * (cal.x2.px - cal.x1.px);
    } else {
      const frac = (x - x1Val) / (x2Val - x1Val);
      px = cal.x1.px + frac * (cal.x2.px - cal.x1.px);
    }
    
    // Y math to pixel
    if (scaleY === "log") {
      const logY = Math.log10(y);
      const logY1 = Math.log10(y1Val);
      const logY2 = Math.log10(y2Val);
      const frac = (logY - logY1) / (logY2 - logY1);
      py = cal.y1.py + frac * (cal.y2.py - cal.y1.py);
    } else {
      const frac = (y - y1Val) / (y2Val - y1Val);
      py = cal.y1.py + frac * (cal.y2.py - cal.y1.py);
    }
    
    return { px, py };
  }
  
  // ── Drag & Click Canvas Handlers ─────────────────────────────
  
  function getMouseCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / imgScale;
    const y = (e.clientY - rect.top) / imgScale;
    return { x: Math.max(0, Math.min(imgWidth, x)), y: Math.max(0, Math.min(imgHeight, y)) };
  }
  
  canvas.addEventListener("mousedown", (e) => {
    if (!imageLoaded) return;
    
    if (currentMode === "pan") {
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = canvasContainer.scrollLeft;
      startScrollTop = canvasContainer.scrollTop;
      canvas.style.cursor = "grabbing";
      return;
    }
    
    const pos = getMouseCoordinates(e);
    const clickThreshold = 10 / imgScale; // 10 display pixels
    
    if (currentMode === "calibrate") {
      selectedDataPoint = null;
      // Check if clicked close to calibration handles
      for (let key in calibrationPoints) {
        const pt = calibrationPoints[key];
        const dist = Math.hypot(pos.x - pt.px, pos.y - pt.py);
        if (dist < clickThreshold) {
          isDragging = true;
          dragTarget = key;
          canvas.style.cursor = "grabbing";
          return;
        }
      }
    } else if (currentMode === "digitize") {
      // Check if clicked close to active series point to edit/drag it
      const activeSeries = seriesList.find(s => s.id === activeSeriesId);
      if (activeSeries) {
        for (let i = 0; i < activeSeries.points.length; i++) {
          const pt = activeSeries.points[i];
          const dist = Math.hypot(pos.x - pt.px, pos.y - pt.py);
          if (dist < clickThreshold) {
            isDragging = true;
            dragTarget = pt;
            dragSeriesId = activeSeries.id;
            selectedDataPoint = pt; // Store selection for arrow keys
            canvas.style.cursor = "grabbing";
            renderAll();
            updatePointsTable();
            return;
          }
        }
      }
      
      // If clicked empty space, add a new point
      const activeSeriesObj = seriesList.find(s => s.id === activeSeriesId);
      if (activeSeriesObj) {
        const newPt = { px: Math.round(pos.x), py: Math.round(pos.y) };
        activeSeriesObj.points.push(newPt);
        activeSeriesObj.points.sort((a, b) => a.px - b.px);
        selectedDataPoint = newPt; // Select newly added point
        triggerProjectChange();
        renderAll();
        updatePointsTable();
      }
    }
  });
  
  canvas.addEventListener("mousemove", (e) => {
    if (!imageLoaded) return;
    
    if (isPanning) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      canvasContainer.scrollLeft = startScrollLeft - dx;
      canvasContainer.scrollTop = startScrollTop - dy;
      return;
    }
    
    const pos = getMouseCoordinates(e);
    lastMousePos = pos;
    mouseOnCanvas = true;
    
    if (isDragging) {
      if (currentMode === "calibrate") {
        calibrationPoints[dragTarget] = { px: Math.round(pos.x), py: Math.round(pos.y) };
        hoverInfo = { x: pos.x, y: pos.y, label: dragTarget.toUpperCase() };
      } else if (dragTarget) {
        dragTarget.px = Math.round(pos.x);
        dragTarget.py = Math.round(pos.y);
        
        // Re-sort current active series points since we adjusted X
        const activeSeries = seriesList.find(s => s.id === dragSeriesId);
        if (activeSeries) activeSeries.points.sort((a, b) => a.px - b.px);
        
        const mathCoords = toMathCoords(pos.x, pos.y);
        hoverInfo = {
          x: pos.x,
          y: pos.y,
          label: `(${mathCoords.x.toFixed(2)}, ${mathCoords.y.toFixed(2)})`
        };
      }
      triggerProjectChange();
      renderAll();
    } else {
      // Setup dynamic cursor hover hints
      const clickThreshold = 8 / imgScale;
      let found = false;
      
      if (currentMode === "calibrate") {
        for (let key in calibrationPoints) {
          const pt = calibrationPoints[key];
          if (Math.hypot(pos.x - pt.px, pos.y - pt.py) < clickThreshold) {
            canvas.style.cursor = "grab";
            hoverInfo = { x: pt.px, y: pt.py, label: key.toUpperCase() };
            found = true;
            break;
          }
        }
      } else {
        const activeSeries = seriesList.find(s => s.id === activeSeriesId);
        if (activeSeries) {
          for (let pt of activeSeries.points) {
            if (Math.hypot(pos.x - pt.px, pos.y - pt.py) < clickThreshold) {
              canvas.style.cursor = "grab";
              const mathCoords = toMathCoords(pt.px, pt.py);
              hoverInfo = {
                x: pt.px,
                y: pt.py,
                label: `(${mathCoords.x.toFixed(2)}, ${mathCoords.y.toFixed(2)})`
              };
              found = true;
              break;
            }
          }
        }
      }
      
      if (!found) {
        canvas.style.cursor = currentMode === "pan" ? "grab" : "crosshair";
        hoverInfo = null;
      }
      renderAll();
    }
  });
  
  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    isPanning = false;
    dragTarget = null;
    dragSeriesId = null;
    canvas.style.cursor = currentMode === "pan" ? "grab" : "crosshair";
    renderAll();
  });
  
  canvas.addEventListener("mouseleave", () => {
    mouseOnCanvas = false;
    isDragging = false;
    isPanning = false;
    dragTarget = null;
    renderAll();
  });
  
  // Double-click removes a point
  canvas.addEventListener("dblclick", (e) => {
    if (!imageLoaded || currentMode !== "digitize") return;
    const pos = getMouseCoordinates(e);
    const clickThreshold = 10 / imgScale;
    
    const activeSeries = seriesList.find(s => s.id === activeSeriesId);
    if (activeSeries) {
      for (let i = 0; i < activeSeries.points.length; i++) {
        const pt = activeSeries.points[i];
        if (Math.hypot(pos.x - pt.px, pos.y - pt.py) < clickThreshold) {
          if (pt === selectedDataPoint) selectedDataPoint = null;
          activeSeries.points.splice(i, 1);
          triggerProjectChange();
          renderAll();
          return;
        }
      }
    }
  });
  
  // ── Render Cycle: Overlay Drawing ───────────────────────────
  function renderAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateCanvasLegend();
    if (!imageLoaded) return;
    
    // Draw regression curve if selected
    drawRegressionCurve();
    
    // Draw all data series lines & points
    seriesList.forEach(series => {
      const isActive = series.id === activeSeriesId;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.strokeStyle = series.color;
      ctx.fillStyle = series.color;
      
      // Draw path connections
      if (series.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(series.points[0].px * imgScale, series.points[0].py * imgScale);
        for (let i = 1; i < series.points.length; i++) {
          ctx.lineTo(series.points[i].px * imgScale, series.points[i].py * imgScale);
        }
        ctx.stroke();
      }
      
      // Draw points
      series.points.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.px * imgScale, pt.py * imgScale, isActive ? 5 : 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "var(--bg-secondary)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Highlight active selected data point for keyboard nudging
        if (currentMode === "digitize" && isActive && pt === selectedDataPoint) {
          ctx.beginPath();
          ctx.arc(pt.px * imgScale, pt.py * imgScale, 9, 0, 2 * Math.PI);
          ctx.strokeStyle = "var(--accent-primary)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });
    
    // Draw calibration points unconditionally (softer style when locked)
    {
      const isCalMode = currentMode === "calibrate";
      ctx.lineWidth = isCalMode ? 2 : 1.2;
      
      // Feature 1: Draw extended calibration alignment guidelines across the full canvas
      if (isCalMode) {
        ctx.strokeStyle = "rgba(225, 29, 72, 0.25)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        
        // Vertical guidelines for X1 and X2
        ctx.beginPath();
        ctx.moveTo(calibrationPoints.x1.px * imgScale, 0);
        ctx.lineTo(calibrationPoints.x1.px * imgScale, canvas.height);
        ctx.moveTo(calibrationPoints.x2.px * imgScale, 0);
        ctx.lineTo(calibrationPoints.x2.px * imgScale, canvas.height);
        ctx.stroke();
        
        // Horizontal guidelines for Y1 and Y2
        ctx.beginPath();
        ctx.moveTo(0, calibrationPoints.y1.py * imgScale);
        ctx.lineTo(canvas.width, calibrationPoints.y1.py * imgScale);
        ctx.moveTo(0, calibrationPoints.y2.py * imgScale);
        ctx.lineTo(canvas.width, calibrationPoints.y2.py * imgScale);
        ctx.stroke();
        
        ctx.setLineDash([]);
      }
      
      for (let key in calibrationPoints) {
        const pt = calibrationPoints[key];
        const screenX = pt.px * imgScale;
        const screenY = pt.py * imgScale;
        
        ctx.strokeStyle = isCalMode ? "#e11d48" : "rgba(225, 29, 72, 0.4)";
        ctx.fillStyle = isCalMode ? "#ffe4e6" : "rgba(255, 228, 230, 0.2)";
        
        // Draw crosshair indicator lines
        ctx.beginPath();
        ctx.moveTo(screenX - (isCalMode ? 12 : 8), screenY);
        ctx.lineTo(screenX + (isCalMode ? 12 : 8), screenY);
        ctx.moveTo(screenX, screenY - (isCalMode ? 12 : 8));
        ctx.lineTo(screenX, screenY + (isCalMode ? 12 : 8));
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, isCalMode ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Label text background
        ctx.fillStyle = isCalMode ? "rgba(15, 23, 42, 0.85)" : "rgba(15, 23, 42, 0.45)";
        ctx.font = isCalMode ? "bold 10px var(--font-sans)" : "normal 9px var(--font-sans)";
        const labelText = key.toUpperCase();
        const textW = ctx.measureText(labelText).width;
        
        ctx.fillRect(screenX + 6, screenY - 16, textW + 6, 13);
        ctx.fillStyle = isCalMode ? "#ffffff" : "rgba(255, 255, 255, 0.75)";
        ctx.fillText(labelText, screenX + 9, screenY - 6);
      }
    }
    
    // Feature 3: Draw coordinate hover tooltip bubble above hovered point
    if (currentMode === "digitize" && hoverInfo && mouseOnCanvas) {
      const screenX = hoverInfo.x * imgScale;
      const screenY = hoverInfo.y * imgScale;
      
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.font = "bold 10px var(--font-sans)";
      const labelText = hoverInfo.label;
      const textW = ctx.measureText(labelText).width;
      
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(screenX - textW/2 - 6, screenY - 28, textW + 12, 17, 4);
      } else {
        ctx.rect(screenX - textW/2 - 6, screenY - 28, textW + 12, 17);
      }
      ctx.fill();
      
      ctx.fillStyle = "#ffffff";
      ctx.fillText(labelText, screenX - textW/2, screenY - 16);
      
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.moveTo(screenX - 4, screenY - 11);
      ctx.lineTo(screenX + 4, screenY - 11);
      ctx.lineTo(screenX, screenY - 7);
      ctx.fill();
    }
    
    // Draw magnifier loupe on hover or drag
    if (mouseOnCanvas) {
      drawLoupe();
    }
    
    // Render the coordinate table in the sidebar
    populatePointsTable();
    calculateRegression();
  }
  
  // ── Precision Loupe Render ──────────────────────────────────
  function drawLoupe() {
    const mouseScreenX = lastMousePos.x * imgScale;
    const mouseScreenY = lastMousePos.y * imgScale;
    
    // Draw circular magnifier offset to top-right of cursor to prevent finger/mouse occlusion
    const loupeX = mouseScreenX + 60;
    const loupeY = mouseScreenY - 60;
    
    ctx.save();
    
    // Clip path for circular magnifier
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, 2 * Math.PI);
    ctx.clip();
    
    // Draw the zoomed part of the plot image
    ctx.drawImage(
      plotImg,
      lastMousePos.x - loupeRadius / loupeZoom,
      lastMousePos.y - loupeRadius / loupeZoom,
      (loupeRadius * 2) / loupeZoom,
      (loupeRadius * 2) / loupeZoom,
      loupeX - loupeRadius,
      loupeY - loupeRadius,
      loupeRadius * 2,
      loupeRadius * 2
    );
    
    ctx.restore();
    
    // Border for magnifier
    ctx.strokeStyle = "var(--accent-primary)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Hairlines inside magnifier
    ctx.strokeStyle = "rgba(13, 148, 136, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(loupeX - loupeRadius, loupeY);
    ctx.lineTo(loupeX + loupeRadius, loupeY);
    ctx.moveTo(loupeX, loupeY - loupeRadius);
    ctx.lineTo(loupeX, loupeY + loupeRadius);
    ctx.stroke();
    
    // Center point indicator in magnifier
    ctx.fillStyle = "var(--accent-primary)";
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, 2, 0, 2 * Math.PI);
    ctx.fill();
    
    // Floating tooltip near magnifier
    if (hoverInfo) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.font = "bold 9px var(--font-sans)";
      const labelW = ctx.measureText(hoverInfo.label).width;
      ctx.fillRect(loupeX - labelW/2 - 6, loupeY + loupeRadius + 4, labelW + 12, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(hoverInfo.label, loupeX - labelW/2, loupeY + loupeRadius + 15);
    }
  }
  
  // ── Table Builder ────────────────────────────────────────────
  function populatePointsTable() {
    const activeSeries = seriesList.find(s => s.id === activeSeriesId);
    if (document.activeElement && document.activeElement.classList.contains("coord-cell")) {
      return;
    }
    if (!activeSeries || activeSeries.points.length === 0) {
      pointsTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); font-family: var(--font-sans); padding: 20px 0;">No points digitized yet. Click inside plot in Digitize mode.</td>
        </tr>
      `;
      return;
    }
    
    pointsTableBody.innerHTML = activeSeries.points.map((pt, i) => {
      const math = toMathCoords(pt.px, pt.py);
      const isPtSelected = selectedDataPoint === pt;
      const rowStyle = isPtSelected ? `background: var(--accent-primary-glow); font-weight: 600;` : ``;
      return `
        <tr style="${rowStyle}">
          <td contenteditable="true" class="coord-cell" data-index="${i}" data-coord="x" title="Double click to edit">${math.x.toFixed(4)}</td>
          <td contenteditable="true" class="coord-cell" data-index="${i}" data-coord="y" title="Double click to edit">${math.y.toFixed(4)}</td>
          <td style="text-align: center;">
            <button class="btn-icon danger remove-pt-btn" data-index="${i}" title="Delete point">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </td>
        </tr>
      `;
    }).join("");
    
    // Bind table delete buttons
    pointsTableBody.querySelectorAll(".remove-pt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index);
        const activeSeriesObj = seriesList.find(s => s.id === activeSeriesId);
        if (activeSeriesObj) {
          const pt = activeSeriesObj.points[index];
          if (pt === selectedDataPoint) selectedDataPoint = null;
          activeSeriesObj.points.splice(index, 1);
          triggerProjectChange();
          renderAll();
        }
      });
    });

    // Bind coord-cell manual edits
    pointsTableBody.querySelectorAll(".coord-cell").forEach(cell => {
      // Highlight matching canvas point on table focus
      cell.addEventListener("focus", () => {
        const index = parseInt(cell.dataset.index);
        if (activeSeries.points[index]) {
          selectedDataPoint = activeSeries.points[index];
          renderAll();
        }
      });

      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          cell.blur();
        }
      });
      
      cell.addEventListener("blur", () => {
        const index = parseInt(cell.dataset.index);
        const coord = cell.dataset.coord;
        const newVal = parseFloat(cell.textContent.trim());
        const pt = activeSeries.points[index];
        if (pt) {
          const math = toMathCoords(pt.px, pt.py);
          if (!isNaN(newVal)) {
            if (coord === "x") {
              const pixelPt = toPixelCoords(newVal, math.y);
              pt.px = Math.round(pixelPt.px);
            } else {
              const pixelPt = toPixelCoords(math.x, newVal);
              pt.py = Math.round(pixelPt.py);
            }
            activeSeries.points.sort((a, b) => a.px - b.px);
            triggerProjectChange();
            renderAll();
          } else {
            // Revert cell text to original on invalid input
            cell.textContent = coord === "x" ? math.x.toFixed(4) : math.y.toFixed(4);
          }
        }
      });
    });
  }
  
  // ── Curve Fitting Regression Math Engine ───────────────────────
  
  function getRegressionData() {
    const activeSeries = seriesList.find(s => s.id === activeSeriesId);
    if (!activeSeries || activeSeries.points.length < 2) return null;
    
    // Map to math space
    return activeSeries.points.map(pt => toMathCoords(pt.px, pt.py));
  }
  
  function calculateRegression() {
    const data = getRegressionData();
    const type = selectFitType.value;
    
    if (!data || type === "none") {
      fitStatsBox.style.display = "none";
      return;
    }
    
    const results = fitModel(data, type);
    if (!results) {
      fitStatsBox.style.display = "none";
      return;
    }
    
    fitStatsBox.style.display = "flex";
    valR2.textContent = `R² = ${results.r2.toFixed(4)}`;
    valFormula.textContent = results.formula;
  }
  
  function fitModel(data, type) {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, sumYY = 0;
    
    // Filter invalid log math cases
    let filteredData = [...data];
    if (type === "logarithmic" || type === "power") {
      filteredData = filteredData.filter(pt => pt.x > 0);
    }
    if (type === "exponential" || type === "power") {
      filteredData = filteredData.filter(pt => pt.y > 0);
    }
    
    const count = filteredData.length;
    if (count < 2) return null;
    
    // Ordinary Least Squares fits
    if (type === "linear") {
      filteredData.forEach(pt => {
        sumX += pt.x;
        sumY += pt.y;
        sumXX += pt.x * pt.x;
        sumXY += pt.x * pt.y;
        sumYY += pt.y * pt.y;
      });
      const slope = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / count;
      
      const r2 = calculateR2(filteredData, x => slope * x + intercept);
      return {
        formula: `y = ${slope.toFixed(4)}x ${intercept >= 0 ? "+" : "-"} ${Math.abs(intercept).toFixed(4)}`,
        r2,
        predict: x => slope * x + intercept
      };
    }
    
    if (type === "poly2") {
      if (count < 3) return null;
      // Solve linear system for ax^2 + bx + c
      let X4 = 0, X3 = 0, X2 = 0, X1 = 0;
      let YX2 = 0, YX1 = 0, Y = 0;
      filteredData.forEach(pt => {
        const x2 = pt.x * pt.x;
        X4 += x2 * x2;
        X3 += x2 * pt.x;
        X2 += x2;
        X1 += pt.x;
        Y += pt.y;
        YX2 += pt.y * x2;
        YX1 += pt.y * pt.x;
      });
      
      const coeffs = solveSystem3x3([
        [X4, X3, X2, YX2],
        [X3, X2, X1, YX1],
        [X2, X1, count, Y]
      ]);
      if (!coeffs) return null;
      const [a, b, c] = coeffs;
      const predict = x => a * x * x + b * x + c;
      const r2 = calculateR2(filteredData, predict);
      return {
        formula: `y = ${a.toFixed(4)}x² ${b >= 0 ? "+" : "-"} ${Math.abs(b).toFixed(4)}x ${c >= 0 ? "+" : "-"} ${Math.abs(c).toFixed(4)}`,
        r2,
        predict
      };
    }
    
    if (type === "poly3") {
      if (count < 4) return null;
      // Polynomial Order 3
      let X6 = 0, X5 = 0, X4 = 0, X3 = 0, X2 = 0, X1 = 0;
      let YX3 = 0, YX2 = 0, YX1 = 0, Y = 0;
      filteredData.forEach(pt => {
        const x = pt.x;
        const x2 = x * x;
        const x3 = x2 * x;
        X6 += x3 * x3;
        X5 += x3 * x2;
        X4 += x2 * x2;
        X3 += x3;
        X2 += x2;
        X1 += x;
        Y += pt.y;
        YX3 += pt.y * x3;
        YX2 += pt.y * x2;
        YX1 += pt.y * x;
      });
      
      const coeffs = solveSystem4x4([
        [X6, X5, X4, X3, YX3],
        [X5, X4, X3, X2, YX2],
        [X4, X3, X2, X1, YX1],
        [X3, X2, X1, count, Y]
      ]);
      if (!coeffs) return null;
      const [a, b, c, d] = coeffs;
      const predict = x => a * x * x * x + b * x * x + c * x + d;
      const r2 = calculateR2(filteredData, predict);
      return {
        formula: `y = ${a.toFixed(4)}x³ ${b >= 0 ? "+" : "-"} ${Math.abs(b).toFixed(4)}x² ${c >= 0 ? "+" : "-"} ${Math.abs(c).toFixed(4)}x ${d >= 0 ? "+" : "-"} ${Math.abs(d).toFixed(4)}`,
        r2,
        predict
      };
    }
    
    if (type === "exponential") {
      // y = a * e^(b * x) -> ln(y) = ln(a) + b * x
      filteredData.forEach(pt => {
        const lny = Math.log(pt.y);
        sumX += pt.x;
        sumY += lny;
        sumXX += pt.x * pt.x;
        sumXY += pt.x * lny;
      });
      const b = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
      const a = Math.exp((sumY - b * sumX) / count);
      const predict = x => a * Math.exp(b * x);
      const r2 = calculateR2(filteredData, predict);
      return {
        formula: `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`,
        r2,
        predict
      };
    }
    
    if (type === "logarithmic") {
      // y = a * ln(x) + b
      filteredData.forEach(pt => {
        const lnx = Math.log(pt.x);
        sumX += lnx;
        sumY += pt.y;
        sumXX += lnx * lnx;
        sumXY += lnx * pt.y;
      });
      const a = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
      const b = (sumY - a * sumX) / count;
      const predict = x => a * Math.log(x) + b;
      const r2 = calculateR2(filteredData, predict);
      return {
        formula: `y = ${a.toFixed(4)} * ln(x) ${b >= 0 ? "+" : "-"} ${Math.abs(b).toFixed(4)}`,
        r2,
        predict
      };
    }
    
    if (type === "power") {
      // y = a * x^b -> ln(y) = ln(a) + b * ln(x)
      filteredData.forEach(pt => {
        const lnx = Math.log(pt.x);
        const lny = Math.log(pt.y);
        sumX += lnx;
        sumY += lny;
        sumXX += lnx * lnx;
        sumXY += lnx * lny;
      });
      const b = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
      const a = Math.exp((sumY - b * sumX) / count);
      const predict = x => a * Math.pow(x, b);
      const r2 = calculateR2(filteredData, predict);
      return {
        formula: `y = ${a.toFixed(4)} * x^(${b.toFixed(4)})`,
        r2,
        predict
      };
    }
    
    return null;
  }
  
  function calculateR2(data, predictFn) {
    const meanY = data.reduce((acc, pt) => acc + pt.y, 0) / data.length;
    let ssTot = 0;
    let ssRes = 0;
    data.forEach(pt => {
      const pred = predictFn(pt.x);
      ssTot += (pt.y - meanY) * (pt.y - meanY);
      ssRes += (pt.y - pred) * (pt.y - pred);
    });
    return ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
  }
  
  // Matrix solvers for polynomial fitting
  function solveSystem3x3(m) {
    const d = m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
    if (Math.abs(d) < 1e-10) return null;
    const d1 = m[0][3]*(m[1][1]*m[2][2] - m[1][2]*m[2][1]) - m[0][1]*(m[1][3]*m[2][2] - m[1][2]*m[2][3]) + m[0][2]*(m[1][3]*m[2][1] - m[1][1]*m[2][3]);
    const d2 = m[0][0]*(m[1][3]*m[2][2] - m[1][2]*m[2][3]) - m[0][3]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][3] - m[1][3]*m[2][0]);
    const d3 = m[0][0]*(m[1][1]*m[2][3] - m[1][3]*m[2][1]) - m[0][1]*(m[1][0]*m[2][3] - m[1][3]*m[2][0]) + m[0][3]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
    return [d1 / d, d2 / d, d3 / d];
  }
  
  function solveSystem4x4(matrix) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(matrix[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(matrix[k][i]) > maxEl) {
          maxEl = Math.abs(matrix[k][i]);
          maxRow = k;
        }
      }
      for (let k = i; k < n + 1; k++) {
        const tmp = matrix[maxRow][k];
        matrix[maxRow][k] = matrix[i][k];
        matrix[i][k] = tmp;
      }
      if (Math.abs(matrix[i][i]) < 1e-10) return null;
      for (let k = i + 1; k < n; k++) {
        const c = -matrix[k][i] / matrix[i][i];
        for (let j = i; j < n + 1; j++) {
          if (i === j) {
            matrix[k][j] = 0;
          } else {
            matrix[k][j] += c * matrix[i][j];
          }
        }
      }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = matrix[i][n] / matrix[i][i];
      for (let k = i - 1; k >= 0; k--) {
        matrix[k][n] -= matrix[k][i] * x[i];
      }
    }
    return x;
  }
  
  function drawRegressionCurve() {
    seriesList.forEach(series => {
      const type = series.fitType || "none";
      if (type === "none" || series.points.length < 2) return;
      
      const mathData = series.points.map(pt => toMathCoords(pt.px, pt.py));
      const fit = fitModel(mathData, type);
      if (!fit) return;
      
      const minPx = series.points[0].px;
      const maxPx = series.points[series.points.length - 1].px;
      
      ctx.strokeStyle = series.color;
      ctx.lineWidth = series.id === activeSeriesId ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]); // Dashed line for regression curve
      
      ctx.beginPath();
      let first = true;
      
      for (let px = minPx; px <= maxPx; px += 2) {
        const mathPt = toMathCoords(px, 0);
        const predY = fit.predict(mathPt.x);
        if (isNaN(predY) || !isFinite(predY)) continue;
        const pixelPt = toPixelCoords(mathPt.x, predY);
        
        if (first) {
          ctx.moveTo(pixelPt.px * imgScale, pixelPt.py * imgScale);
          first = false;
        } else {
          ctx.lineTo(pixelPt.px * imgScale, pixelPt.py * imgScale);
        }
      }
      ctx.stroke();
    });
    ctx.setLineDash([]); // Reset dashed lines
  }
  
  // ── Multi-Series Management ─────────────────────────────────
  
  function updateSeriesUI() {
    seriesContainer.innerHTML = seriesList.map(series => {
      const isActive = series.id === activeSeriesId;
      const isDigitizing = isActive && currentMode === "digitize";
      return `
        <div class="series-item" style="border-color: ${isDigitizing ? "var(--accent-primary)" : "var(--border-color)"}">
          <div class="color-picker-wrapper">
            <div class="series-color" style="background-color: ${series.color}"></div>
            <input type="color" class="color-picker-input series-color-input" data-id="${series.id}" value="${series.color}" />
          </div>
          <input type="text" class="series-name-input" data-id="${series.id}" value="${escapeHtml(series.name)}" style="flex: 1; min-width: 50px; font-size: 13px; font-weight: 600; background: transparent; border: none; color: var(--text-primary); outline: none; border-bottom: 1px dashed transparent; padding: 2px 4px; box-sizing: border-box;" onfocus="this.style.borderBottomColor='var(--accent-primary)'" onblur="this.style.borderBottomColor='transparent'" />
          <div class="flex gap-1" style="align-items: center;">
            <button class="hdr-btn ${isDigitizing ? "hdr-btn-accent" : ""} series-activate-btn" data-id="${series.id}" style="height: 28px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Edit and digitize points for this series">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="btn-icon danger series-delete-btn" data-id="${series.id}" title="Delete Series" ${seriesList.length === 1 ? "disabled style='opacity:0.3; pointer-events:none;'" : ""}>
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join("");
    
    // Bind color pickers
    seriesContainer.querySelectorAll(".series-color-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const id = input.dataset.id;
        const series = seriesList.find(s => s.id === id);
        if (series) {
          series.color = e.target.value;
          triggerProjectChange();
          renderAll();
          updateSeriesUI();
        }
      });
    });

    // Bind name inputs
    seriesContainer.querySelectorAll(".series-name-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const id = input.dataset.id;
        const series = seriesList.find(s => s.id === id);
        if (series) {
          series.name = e.target.value;
          triggerProjectChange();
        }
      });
      input.addEventListener("click", (e) => {
        e.stopPropagation(); // Avoid activating series when just clicking field to edit
      });
    });
    
    // Bind activation clicks
    seriesContainer.querySelectorAll(".series-activate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (activeSeriesId === id && currentMode === "digitize") {
          // Toggle off to pan mode
          currentMode = "pan";
        } else {
          activeSeriesId = id;
          currentMode = "digitize";
          modeBtnCalibrate.classList.remove("active");
          
          // Sync Curve Fitting dropdown with newly selected series fit type
          const activeSeries = seriesList.find(s => s.id === activeSeriesId);
          if (activeSeries) {
            selectFitType.value = activeSeries.fitType || "none";
          }
        }
        
        triggerProjectChange();
        renderAll();
        updateSeriesUI();
        updateHelperBanner();
      });
    });
    
    // Bind deletion clicks
    seriesContainer.querySelectorAll(".series-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (seriesList.length > 1) {
          seriesList = seriesList.filter(s => s.id !== id);
          if (activeSeriesId === id) {
            activeSeriesId = seriesList[0].id;
          }
          triggerProjectChange();
          renderAll();
          updateSeriesUI();
        }
      });
    });
    updateCanvasLegend();
  }
  
  function updateCanvasLegend() {
    const legend = document.getElementById("canvas-legend");
    if (!legend) return;
    if (!imageLoaded) {
      legend.style.display = "none";
      return;
    }
    legend.style.display = "flex";
    legend.style.flexDirection = "column";
    
    let html = `<div style="font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.25); padding-bottom: 4px; margin-bottom: 4px; display:flex; align-items:center; gap:4px; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#fff;"><svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-primary);"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Series Legend</div>`;
    
    seriesList.forEach(series => {
      const isActive = series.id === activeSeriesId;
      const isDigitizing = isActive && currentMode === "digitize";
      const fitText = series.fitType && series.fitType !== "none" ? ` [${series.fitType.toUpperCase()}]` : "";
      
      html += `
        <div style="display: flex; align-items: center; gap: 8px; opacity: ${isActive ? 1.0 : 0.55}; font-weight: ${isActive ? 700 : 400}; line-height:1.4; color:#fff;">
          <div style="width: 7px; height: 7px; border-radius: 50%; background: ${series.color}; border: 1.5px solid #fff; flex-shrink:0;"></div>
          <span style="white-space:nowrap; font-size:10px;">${escapeHtml(series.name)}: <strong>${series.points.length}</strong> pts${fitText}</span>
          ${isDigitizing ? '<span style="color:#f43f5e; font-size:8px; font-weight:700; margin-left:auto; display:flex; align-items:center; gap:2px; animation: pulse 1.2s infinite;"><span style="width:4px; height:4px; border-radius:50%; background:#f43f5e;"></span>REC</span>' : ''}
        </div>
      `;
    });
    legend.innerHTML = html;
  }
  
  btnAddSeries.addEventListener("click", () => {
    const id = "series-" + Date.now();
    const count = seriesList.length + 1;
    // Generate distinct color palette
    const colors = ["#0d9488", "#2563eb", "#ea580c", "#16a34a", "#db2777", "#ca8a04"];
    const col = colors[count % colors.length];
    
    seriesList.push({
      id,
      name: `Series ${count}`,
      color: col,
      points: [],
      fitType: "none"
    });
    activeSeriesId = id;
    
    // Sync Curve Fitting dropdown with newly selected series fit type
    selectFitType.value = "none";
    
    triggerProjectChange();
    renderAll();
    updateSeriesUI();
  });
  
  btnClearPoints.addEventListener("click", () => {
    const activeSeriesObj = seriesList.find(s => s.id === activeSeriesId);
    if (activeSeriesObj && activeSeriesObj.points.length > 0) {
      if (confirm(`Are you sure you want to clear all points in "${activeSeriesObj.name}"?`)) {
        activeSeriesObj.points = [];
        triggerProjectChange();
        renderAll();
      }
    }
  });
  
  updateSeriesUI();
  
  // Re-run fitting calculations on fitting parameters change
  selectFitType.addEventListener("change", () => {
    const activeSeries = seriesList.find(s => s.id === activeSeriesId);
    if (activeSeries) {
      activeSeries.fitType = selectFitType.value;
      triggerProjectChange();
    }
    renderAll();
  });
  selectScaleX.addEventListener("change", renderAll);
  selectScaleY.addEventListener("change", renderAll);
  inputCalX1.addEventListener("input", renderAll);
  inputCalX2.addEventListener("input", renderAll);
  inputCalY1.addEventListener("input", renderAll);
  inputCalY2.addEventListener("input", renderAll);
  
  // ── CSV Exporters & Copy table ───────────────────────────────
  
  function getCSVContent() {
    const activeSeries = seriesList.find(s => s.id === activeSeriesId);
    if (!activeSeries || activeSeries.points.length === 0) return "";
    
    let csv = "X Coordinate,Y Coordinate\n";
    activeSeries.points.forEach(pt => {
      const math = toMathCoords(pt.px, pt.py);
      csv += `${math.x},${math.y}\n`;
    });
    return csv;
  }
  
  btnCopyCSV.addEventListener("click", () => {
    const csv = getCSVContent();
    if (!csv) {
      alert("No data points to copy.");
      return;
    }
    navigator.clipboard.writeText(csv)
      .then(() => alert("Data points copied to clipboard as CSV."))
      .catch(err => alert("Copy failed: " + err));
  });
  
  btnDownloadCSV.addEventListener("click", () => {
    const csv = getCSVContent();
    if (!csv) {
      alert("No data points to export.");
      return;
    }
    const activeSeriesObj = seriesList.find(s => s.id === activeSeriesId);
    const fileName = activeSeriesObj ? activeSeriesObj.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "active-series";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}-digitized-data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  
  btnDownloadCombinedCSV.addEventListener("click", () => {
    let hasPoints = false;
    let csv = "Series Name,X Coordinate,Y Coordinate\n";
    seriesList.forEach(series => {
      if (series.points.length > 0) {
        hasPoints = true;
        series.points.forEach(pt => {
          const math = toMathCoords(pt.px, pt.py);
          csv += `"${series.name.replace(/"/g, '""')}",${math.x},${math.y}\n`;
        });
      }
    });
    
    if (!hasPoints) {
      alert("No data points in any series to export.");
      return;
    }
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "combined-digitized-data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  
  // ── Lookup Interpolator Table Generator Modal ─────────────────
  btnExportTable.addEventListener("click", () => {
    const data = getRegressionData();
    const type = selectFitType.value;
    if (!data || data.length < 2 || type === "none") {
      alert("Please digitize at least 2 points and select a Curve Fitting regression model first.");
      return;
    }
    
    // Prefill modal values based on range
    const activeSeriesObj = seriesList.find(s => s.id === activeSeriesId);
    const pts = activeSeriesObj.points;
    const minMath = toMathCoords(pts[0].px, 0).x;
    const maxMath = toMathCoords(pts[pts.length - 1].px, 0).x;
    
    inputLookupStart.value = minMath.toFixed(2);
    inputLookupEnd.value = maxMath.toFixed(2);
    inputLookupStep.value = ((maxMath - minMath) / 10).toFixed(2);
    
    lookupResultsContainer.style.display = "none";
    lookupModal.style.display = "flex";
    setTimeout(() => lookupModal.classList.remove("pm-fade-out"), 50);
  });
  
  function closeLookupModal() {
    lookupModal.classList.add("pm-fade-out");
    setTimeout(() => lookupModal.style.display = "none", 200);
  }
  
  btnCloseLookup.addEventListener("click", closeLookupModal);
  lookupModal.addEventListener("click", (e) => {
    if (e.target === lookupModal) closeLookupModal();
  });
  
  btnCalculateLookup.addEventListener("click", () => {
    const data = getRegressionData();
    const type = selectFitType.value;
    const fit = fitModel(data, type);
    if (!fit) return;
    
    const start = parseFloat(inputLookupStart.value) || 0;
    const end = parseFloat(inputLookupEnd.value) || 10;
    const step = parseFloat(inputLookupStep.value) || 1;
    const decimals = parseInt(inputLookupDecimals.value) || 4;
    
    if (step <= 0) {
      alert("Step interval size must be positive.");
      return;
    }
    
    let tableHtml = "";
    let csvCopyText = "X,Interpolated Y\n";
    
    for (let x = start; x <= end + (step * 0.001); x += step) {
      const y = fit.predict(x);
      if (isNaN(y) || !isFinite(y)) continue;
      
      tableHtml += `
        <tr>
          <td>${x.toFixed(decimals)}</td>
          <td>${y.toFixed(decimals)}</td>
        </tr>
      `;
      csvCopyText += `${x.toFixed(decimals)},${y.toFixed(decimals)}\n`;
    }
    
    lookupResultsBody.innerHTML = tableHtml;
    lookupResultsContainer.style.display = "block";
    
    // Auto-copy lookup results to clipboard
    navigator.clipboard.writeText(csvCopyText)
      .then(() => alert("Lookup table successfully copied to clipboard as CSV."))
      .catch(() => alert("Successfully calculated lookup table."));
  });
  
  // ── Import / Export JSON Config File ──────────────────────────
  
  window.exportJSON = function() {
    const configData = getPlotExtractorState();
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plot-extractor-${activeSeriesId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const importInput = document.getElementById("import-file-input");
  window.importJSON = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const state = JSON.parse(evt.target.result);
        setPlotExtractorState(state);
        triggerProjectChange();
      } catch (err) {
        alert("Invalid project JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  
  // Bind standard buttons in DOM
  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  if (btnExport) btnExport.addEventListener("click", window.exportJSON);
  if (btnImport) btnImport.addEventListener("click", () => importInput.click());
  if (importInput) importInput.addEventListener("change", window.importJSON);
  
  // ── Firebase Project Manager Sync Hooks ───────────────────────
  
  function getPlotExtractorState() {
    return {
      compressedImgData,
      imgWidth,
      imgHeight,
      calibrationPoints,
      seriesList,
      activeSeriesId,
      scaleX: selectScaleX.value,
      scaleY: selectScaleY.value,
      x1Val: parseFloat(inputCalX1.value) || 0,
      x2Val: parseFloat(inputCalX2.value) || 10,
      y1Val: parseFloat(inputCalY1.value) || 0,
      y2Val: parseFloat(inputCalY2.value) || 10,
      fitType: selectFitType.value
    };
  }
  
  function setPlotExtractorState(state) {
    if (!state) return;
    
    if (state.compressedImgData) {
      compressedImgData = state.compressedImgData;
      plotImg.src = compressedImgData;
      imgWidth = state.imgWidth || 1000;
      imgHeight = state.imgHeight || 1000;
      imageLoaded = true;
      dropzone.style.display = "none";
      canvasWrapper.style.display = "block";
      imageActions.style.display = "flex";
    } else {
      clearImage();
    }
    
    if (state.calibrationPoints) {
      calibrationPoints = state.calibrationPoints;
    }
    if (state.seriesList) {
      seriesList = state.seriesList;
    }
    if (state.activeSeriesId) {
      activeSeriesId = state.activeSeriesId;
    }
    
    if (state.scaleX) selectScaleX.value = state.scaleX;
    if (state.scaleY) selectScaleY.value = state.scaleY;
    if (state.x1Val !== undefined) inputCalX1.value = state.x1Val;
    if (state.x2Val !== undefined) inputCalX2.value = state.x2Val;
    if (state.y1Val !== undefined) inputCalY1.value = state.y1Val;
    if (state.y2Val !== undefined) inputCalY2.value = state.y2Val;
    if (state.fitType !== undefined) selectFitType.value = state.fitType;
    
    updateSeriesUI();
    updateHelperBanner();
    
    // Trigger delay refresh to allow image component dimension loading
    setTimeout(() => {
      resizeCanvas();
      renderAll();
    }, 150);
  }
  
  // Custom event trigger to hook dirty warnings and periodic auto-saves
  function triggerProjectChange() {
    document.dispatchEvent(new Event("input"));
  }
  
  // Register with project manager
  window.projectManagerConfig = {
    toolId: "plot-extractor",
    getInputs: getPlotExtractorState,
    setInputs: setPlotExtractorState
  };
  
  // Escaping helper
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }
  
  // Zoom Control Implementation
  zoomSlider.addEventListener("input", (e) => {
    setZoom(parseFloat(e.target.value));
  });
  
  // Wheel zoom via Ctrl + Scroll Wheel
  canvas.addEventListener("wheel", (e) => {
    if (!imageLoaded) return;
    if (e.ctrlKey) {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const nextZoom = Math.max(0.5, Math.min(3.0, zoomFactor + direction * 0.1));
      setZoom(nextZoom);
    }
  }, { passive: false });
  
  function setZoom(factor) {
    zoomFactor = factor;
    zoomSlider.value = factor;
    zoomLabel.textContent = `${Math.round(factor * 100)}%`;
    
    if (Math.abs(factor - 1.0) < 0.01) {
      plotImg.style.width = "";
      plotImg.style.maxWidth = "100%";
      plotImg.style.maxHeight = "80vh";
    } else {
      plotImg.style.width = (imgWidth * factor) + "px";
      plotImg.style.maxWidth = "none";
      plotImg.style.maxHeight = "none";
    }
    
    resizeCanvas();
    renderAll();
  }
  
  btnResetZoom.addEventListener("click", () => {
    setZoom(1.0);
  });

  // Download Plot image with points and curves overlay
  function exportImageWithCurves() {
    if (!imageLoaded) return;
    
    const offCanvas = document.createElement("canvas");
    offCanvas.width = imgWidth;
    offCanvas.height = imgHeight;
    const offCtx = offCanvas.getContext("2d");
    
    // Draw base plot image
    offCtx.drawImage(plotImg, 0, 0, imgWidth, imgHeight);
    
    // Draw all data series and fits
    seriesList.forEach(series => {
      // Connect points with lines
      if (series.points.length > 1) {
        offCtx.strokeStyle = series.color;
        offCtx.lineWidth = 3;
        offCtx.beginPath();
        offCtx.moveTo(series.points[0].px, series.points[0].py);
        for (let i = 1; i < series.points.length; i++) {
          offCtx.lineTo(series.points[i].px, series.points[i].py);
        }
        offCtx.stroke();
      }
      
      // Draw fitted regression curve
      const type = series.fitType || "none";
      if (type !== "none" && series.points.length >= 2) {
        const mathData = series.points.map(pt => toMathCoords(pt.px, pt.py));
        const fit = fitModel(mathData, type);
        if (fit) {
          const minPx = series.points[0].px;
          const maxPx = series.points[series.points.length - 1].px;
          
          offCtx.strokeStyle = series.color;
          offCtx.lineWidth = 4;
          offCtx.setLineDash([10, 10]);
          offCtx.beginPath();
          let first = true;
          for (let px = minPx; px <= maxPx; px += 2) {
            const mathPt = toMathCoords(px, 0);
            const predY = fit.predict(mathPt.x);
            if (isNaN(predY) || !isFinite(predY)) continue;
            const pixelPt = toPixelCoords(mathPt.x, predY);
            
            if (first) {
              offCtx.moveTo(pixelPt.px, pixelPt.py);
              first = false;
            } else {
              offCtx.lineTo(pixelPt.px, pixelPt.py);
            }
          }
          offCtx.stroke();
          offCtx.setLineDash([]);
        }
      }
      
      // Draw points
      series.points.forEach(pt => {
        offCtx.beginPath();
        offCtx.arc(pt.px, pt.py, 6, 0, 2 * Math.PI);
        offCtx.fillStyle = series.color;
        offCtx.fill();
        offCtx.strokeStyle = "#ffffff";
        offCtx.lineWidth = 2;
        offCtx.stroke();
      });
    });
    
    // Download trigger
    const link = document.createElement("a");
    link.download = "digitized-plot-export.png";
    link.href = offCanvas.toDataURL("image/png");
    link.click();
  }
  
  btnDownloadPlot.addEventListener("click", exportImageWithCurves);

  // Keyboard Arrow Nudging Listener
  window.addEventListener("keydown", (e) => {
    // Avoid interfering if editing input text fields
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT" || document.activeElement.getAttribute("contenteditable") === "true") {
      return;
    }
    
    let dx = 0, dy = 0;
    if (e.key === "ArrowUp") dy = -1;
    else if (e.key === "ArrowDown") dy = 1;
    else if (e.key === "ArrowLeft") dx = -1;
    else if (e.key === "ArrowRight") dx = 1;
    else return;
    
    e.preventDefault();
    
    if (currentMode === "calibrate") {
      const target = nudgeTarget.value;
      if (calibrationPoints[target]) {
        calibrationPoints[target].px = Math.max(0, Math.min(imgWidth, calibrationPoints[target].px + dx));
        calibrationPoints[target].py = Math.max(0, Math.min(imgHeight, calibrationPoints[target].py + dy));
        
        lastMousePos = { x: calibrationPoints[target].px, y: calibrationPoints[target].py };
        mouseOnCanvas = true;
        hoverInfo = {
          x: lastMousePos.x,
          y: lastMousePos.y,
          label: target.toUpperCase()
        };
        
        triggerProjectChange();
        renderAll();
      }
    } else if (currentMode === "digitize" && selectedDataPoint) {
      selectedDataPoint.px = Math.max(0, Math.min(imgWidth, selectedDataPoint.px + dx));
      selectedDataPoint.py = Math.max(0, Math.min(imgHeight, selectedDataPoint.py + dy));
      
      const activeSeries = seriesList.find(s => s.id === activeSeriesId);
      if (activeSeries) activeSeries.points.sort((a, b) => a.px - b.px);
      
      const mathCoords = toMathCoords(selectedDataPoint.px, selectedDataPoint.py);
      lastMousePos = { x: selectedDataPoint.px, y: selectedDataPoint.py };
      mouseOnCanvas = true;
      hoverInfo = {
        x: lastMousePos.x,
        y: lastMousePos.y,
        label: `(${mathCoords.x.toFixed(2)}, ${mathCoords.y.toFixed(2)})`
      };
      
      triggerProjectChange();
      renderAll();
      populatePointsTable();
    }
  });

  // Advanced Position Fine-Tuning D-Pad
  const btnToggleAdvanced = document.getElementById("btn-toggle-advanced");
  const advancedTuningPanel = document.getElementById("advanced-tuning-panel");
  const nudgeTarget = document.getElementById("nudge-target");
  
  btnToggleAdvanced.addEventListener("click", () => {
    const isHidden = advancedTuningPanel.style.display === "none";
    advancedTuningPanel.style.display = isHidden ? "block" : "none";
    btnToggleAdvanced.style.color = isHidden ? "var(--text-primary)" : "var(--accent-primary)";
  });
  
  function nudgePoint(dx, dy) {
    if (!imageLoaded) return;
    const target = nudgeTarget.value;
    if (calibrationPoints[target]) {
      calibrationPoints[target].px = Math.max(0, Math.min(imgWidth, calibrationPoints[target].px + dx));
      calibrationPoints[target].py = Math.max(0, Math.min(imgHeight, calibrationPoints[target].py + dy));
      
      lastMousePos = { x: calibrationPoints[target].px, y: calibrationPoints[target].py };
      mouseOnCanvas = true;
      hoverInfo = {
        x: lastMousePos.x,
        y: lastMousePos.y,
        label: target.toUpperCase()
      };
      
      triggerProjectChange();
      renderAll();
    }
  }
  
  document.getElementById("btn-nudge-up").addEventListener("click", (e) => { e.preventDefault(); nudgePoint(0, -1); });
  document.getElementById("btn-nudge-down").addEventListener("click", (e) => { e.preventDefault(); nudgePoint(0, 1); });
  document.getElementById("btn-nudge-left").addEventListener("click", (e) => { e.preventDefault(); nudgePoint(-1, 0); });
  document.getElementById("btn-nudge-right").addEventListener("click", (e) => { e.preventDefault(); nudgePoint(1, 0); });

  // Save Status Badge Handler
  const saveStatusBadge = document.getElementById("save-status-badge");
  let saveBadgeTimeout = null;
  document.addEventListener("input", () => {
    if (saveStatusBadge) {
      if (saveBadgeTimeout) clearTimeout(saveBadgeTimeout);
      saveStatusBadge.style.opacity = "1";
      saveStatusBadge.innerHTML = '<span style="width:5px; height:5px; border-radius:50%; background:#f59e0b; display:inline-block; animation: pulse 1s infinite;"></span> Saving...';
      
      saveBadgeTimeout = setTimeout(() => {
        saveStatusBadge.innerHTML = '<span style="width:5px; height:5px; border-radius:50%; background:#10b981; display:inline-block;"></span> Synced';
        saveBadgeTimeout = setTimeout(() => {
          saveStatusBadge.style.opacity = "0";
        }, 1500);
      }, 850);
    }
  });
});
