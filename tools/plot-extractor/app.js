/**
 * Plot Data Extractor — App Logic
 * Precision axes calibration, linear/log/time scales, discrete bar mode,
 * magnifier loupe, curve fitting, multi-series, clipboard paste, Project Manager sync.
 */

document.addEventListener("DOMContentLoaded", () => {
  const PM = typeof PlotMath !== "undefined" ? PlotMath : null;

  // Select DOM Elements
  const dropzone = document.getElementById("image-dropzone");
  const fileInput = document.getElementById("file-upload-input");
  const btnLoadExample = document.getElementById("btn-load-example");
  const canvasContainer = document.getElementById("canvas-container-root");
  const canvasWrapper = document.getElementById("plot-canvas-wrapper");
  const plotImg = document.getElementById("plot-image");
  const canvas = document.getElementById("interaction-canvas");
  const ctx = canvas.getContext("2d");
  
  const modeBtnCalibrate = document.getElementById("mode-btn-calibrate");
  const btnDetectAxes = document.getElementById("btn-detect-axes");
  const axisDetectStatus = document.getElementById("axis-detect-status");
  
  const inputCalX1 = document.getElementById("cal-x1");
  const inputCalX2 = document.getElementById("cal-x2");
  const inputCalY1 = document.getElementById("cal-y1");
  const inputCalY2 = document.getElementById("cal-y2");
  const labelCalX1 = document.getElementById("label-cal-x1");
  const labelCalX2 = document.getElementById("label-cal-x2");
  
  const selectScaleX = document.getElementById("scale-x");
  const selectScaleY = document.getElementById("scale-y");
  const selectChartKind = document.getElementById("chart-kind");
  const timeAxisOptions = document.getElementById("time-axis-options");
  const selectTimeUnit = document.getElementById("time-unit");
  const selectTimeExport = document.getElementById("time-export");
  const calHelpText = document.getElementById("cal-help-text");
  const regressionCard = document.getElementById("regression-card");
  const thX = document.getElementById("th-x");
  const thY = document.getElementById("th-y");
  const pointsTableHead = document.getElementById("points-table-head");
  const pointsTableHint = document.getElementById("points-table-hint");
  
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
  const btnToggleLegend = document.getElementById("btn-toggle-legend");
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  
  // Application State Variables
  let currentMode = "calibrate"; // "calibrate" or "digitize"
  let imageLoaded = false;
  let imgWidth = 0;
  let imgHeight = 0;
  let imgScale = 1.0;
  let compressedImgData = null; // Stored as base64 string for saving
  /** Snapshot of image as first loaded (before prep edits). */
  let originalImageBackup = null; // { dataUrl, width, height }
  let zoomFactor = 1.0;
  let legendVisible = true;
  let historyStack = [];
  let historyPointer = -1;
  let activePanel = "setup"; // setup | series | autotrace | image | measure | fit
  /** Until this timestamp, mode badge shows “Points ready” flash. */
  let pointsReadyFlashUntil = 0;
  let pointsReadyFlashTimer = null;
  
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
  
  // Initialize lucide icons (sidebar accordions included)
  if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();

  /**
   * Exclusive accordion: only one sidebar panel open at a time.
   * Opening a panel drives canvas interaction mode.
   */
  function setupExclusiveAccordions() {
    const panels = Array.from(document.querySelectorAll("aside.sidebar-panel details.accordion"));
    panels.forEach((panel) => {
      panel.addEventListener("toggle", () => {
        if (panel.open) {
          panels.forEach((other) => {
            if (other !== panel && other.open) other.open = false;
          });
          activePanel = panel.getAttribute("data-panel") || "setup";
          applyPanelMode(activePanel);
        } else {
          // Keep at least one open (prefer setup)
          const anyOpen = panels.some((p) => p.open);
          if (!anyOpen) {
            const setup = panels.find((p) => p.getAttribute("data-panel") === "setup") || panels[0];
            if (setup) setup.open = true;
          }
        }
        if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
        updateModeBadge();
      });
    });
  }

  function openPanel(name) {
    const panels = document.querySelectorAll("aside.sidebar-panel details.accordion");
    panels.forEach((p) => {
      p.open = p.getAttribute("data-panel") === name;
    });
    activePanel = name;
    applyPanelMode(name);
    updateModeBadge();
  }

  function applyPanelMode(panel) {
    selectedDataPoint = null;
    if (panel === "setup") {
      currentMode = "calibrate";
      if (modeBtnCalibrate) modeBtnCalibrate.classList.add("active");
    } else if (panel === "series") {
      currentMode = "digitize";
      if (modeBtnCalibrate) modeBtnCalibrate.classList.remove("active");
    } else if (panel === "measure") {
      currentMode = "pan"; // measure handled by parity pointer hooks
      if (modeBtnCalibrate) modeBtnCalibrate.classList.remove("active");
      const mm = document.getElementById("measure-mode");
      if (mm && mm.value === "off") mm.value = "distance";
    } else if (panel === "autotrace" || panel === "image" || panel === "fit") {
      currentMode = "pan";
      if (modeBtnCalibrate) modeBtnCalibrate.classList.remove("active");
    }
    updateHelperBanner();
    renderAll();
  }

  function hasDigitizedPoints() {
    return seriesList.some((s) => s.points && s.points.length > 0);
  }

  function flashPointsReady() {
    if (!hasDigitizedPoints()) return;
    pointsReadyFlashUntil = Date.now() + 2400;
    if (pointsReadyFlashTimer) clearTimeout(pointsReadyFlashTimer);
    updateModeBadge();
    pointsReadyFlashTimer = setTimeout(() => {
      pointsReadyFlashTimer = null;
      updateModeBadge();
    }, 2500);
  }

  function pulseModeBadge() {
    const badge = document.getElementById("canvas-mode-badge");
    if (!badge) return;
    badge.classList.remove("mode-pulse");
    // reflow so re-adding restarts animation
    void badge.offsetWidth;
    badge.classList.add("mode-pulse");
    setTimeout(() => badge.classList.remove("mode-pulse"), 900);
  }

  /** Map mode badge key → sidebar panel id. */
  function panelForModeKey(key) {
    switch (key) {
      case "calibrating": return "setup";
      case "digitizing":
      case "points-ready": return "series";
      case "autotrace":
      case "masking": return "autotrace";
      case "image": return "image";
      case "measure": return "measure";
      case "fit": return "fit";
      case "ready":
      default: return imageLoaded ? (hasDigitizedPoints() ? "series" : "setup") : "setup";
    }
  }

  function getModePresentation() {
    const maskTool = (document.getElementById("mask-tool") || {}).value;
    const measureMode = (document.getElementById("measure-mode") || {}).value;

    // Temporary export cue
    if (imageLoaded && hasDigitizedPoints() && Date.now() < pointsReadyFlashUntil) {
      return {
        key: "points-ready",
        label: "Points ready",
        hint: "Data is ready — use the header Export menu for CSV / JSON / image.",
        panel: "series"
      };
    }

    if (!imageLoaded) {
      return { key: "ready", label: "Ready", hint: "Upload or paste a plot image to begin.", panel: "setup" };
    }
    switch (activePanel) {
      case "setup":
        return {
          key: "calibrating",
          label: "Calibrating",
          panel: "setup",
          hint: isTimeScale()
            ? "Drag X1/X2 to time ticks · enter times · set Y1/Y2. Or use Detect axes."
            : "Drag red markers to tick marks, enter values, or use Detect axes."
        };
      case "series":
        return {
          key: "digitizing",
          label: isDiscreteMode() ? "Digitizing bars" : "Digitizing",
          panel: "series",
          hint: isDiscreteMode()
            ? "Click bar tops · edit labels in the table · double-click to delete."
            : "Click the plot to add points · drag to adjust · double-click to delete."
        };
      case "autotrace":
        if (maskTool && maskTool !== "off") {
          return { key: "masking", label: "Painting mask", panel: "autotrace", hint: "Paint include/exclude regions, then sample color and Run." };
        }
        return { key: "autotrace", label: "Autotrace", panel: "autotrace", hint: "Sample a curve color (optional mask), then Run autotrace." };
      case "image":
        return {
          key: "image",
          label: "Image prep",
          panel: "image",
          hint: "Rotate, flip, filter, crop (Shift+drag). Reset markers or reset image below."
        };
      case "measure":
        if (measureMode === "angle") return { key: "measure", label: "Measuring angle", panel: "measure", hint: "Click 3 points (vertex in the middle)." };
        if (measureMode === "area") return { key: "measure", label: "Measuring area", panel: "measure", hint: "Click polygon vertices · Enter to close." };
        return { key: "measure", label: "Measuring distance", panel: "measure", hint: "Click two points to measure distance in data units." };
      case "fit":
        return { key: "fit", label: "Curve fit", panel: "fit", hint: "Choose a model for the active series · export from the header menu." };
      default:
        return { key: "ready", label: "Ready", panel: "setup", hint: helperText ? helperText.textContent : "" };
    }
  }

  function updateModeBadge() {
    const badge = document.getElementById("canvas-mode-badge");
    const label = document.getElementById("canvas-mode-label");
    const title = document.getElementById("workspace-mode-title");
    const pres = getModePresentation();
    if (label) label.textContent = pres.label;
    if (badge) {
      badge.dataset.mode = pres.key;
      badge.dataset.panel = pres.panel || panelForModeKey(pres.key);
      const pulsing = badge.classList.contains("mode-pulse");
      badge.className = "mode-badge mode-" + pres.key + (pulsing ? " mode-pulse" : "");
      badge.title = "Click to open “" + (pres.panel || panelForModeKey(pres.key)) + "” panel";
    }
    if (title) title.textContent = imageLoaded ? "Plot canvas" : "Canvas";
    if (helperText && pres.hint) helperText.textContent = pres.hint;
  }

  setupExclusiveAccordions();

  // Mode badge → open matching panel
  const modeBadgeEl = document.getElementById("canvas-mode-badge");
  if (modeBadgeEl) {
    modeBadgeEl.addEventListener("click", () => {
      const pres = getModePresentation();
      const panel = pres.panel || panelForModeKey(pres.key) || modeBadgeEl.dataset.panel || "setup";
      openPanel(panel);
    });
  }

  function setAxisDetectStatus(msg, isError) {
    if (!axisDetectStatus) return;
    if (!msg) {
      axisDetectStatus.style.display = "none";
      axisDetectStatus.textContent = "";
      return;
    }
    axisDetectStatus.style.display = "block";
    axisDetectStatus.textContent = msg;
    axisDetectStatus.style.color = isError ? "var(--color-error)" : "var(--text-muted)";
  }

  /** Capture current plot pixels for CV helpers. */
  function capturePlotImageData() {
    if (!imageLoaded || !plotImg.naturalWidth) return null;
    const c = document.createElement("canvas");
    c.width = plotImg.naturalWidth || imgWidth;
    c.height = plotImg.naturalHeight || imgHeight;
    const cx = c.getContext("2d");
    try {
      cx.drawImage(plotImg, 0, 0);
      return cx.getImageData(0, 0, c.width, c.height);
    } catch (err) {
      console.warn("capturePlotImageData failed", err);
      return null;
    }
  }

  /**
   * Auto-detect axis frame and place X1/X2/Y1/Y2 markers (geometry only — values stay user-entered).
   */
  function runAutoAxisDetect() {
    if (!imageLoaded) {
      setAxisDetectStatus("Load a plot image first.", true);
      return;
    }
    if (typeof PlotAxisDetect === "undefined" || !PlotAxisDetect.detectAxes) {
      setAxisDetectStatus("Axis detector not loaded.", true);
      return;
    }
    const idata = capturePlotImageData();
    if (!idata) {
      setAxisDetectStatus("Could not read image pixels (try reloading the image).", true);
      return;
    }

    const result = PlotAxisDetect.detectAxes(idata);
    if (!result.ok || !result.calibrationPoints) {
      setAxisDetectStatus(result.error || "Detection failed.", true);
      return;
    }

    // Soft confirm when confidence is low
    const confPct = Math.round((result.confidence || 0) * 100);
    if ((result.confidence || 0) < 0.35) {
      const proceed = confirm(
        "Axis detection confidence is low (" + confPct + "%). Apply markers anyway? You can drag them to fix."
      );
      if (!proceed) {
        setAxisDetectStatus("Detection cancelled — adjust image prep or place markers manually.", false);
        return;
      }
    }

    pushHistory();
    calibrationPoints = {
      x1: { ...result.calibrationPoints.x1 },
      x2: { ...result.calibrationPoints.x2 },
      y1: { ...result.calibrationPoints.y1 },
      y2: { ...result.calibrationPoints.y2 }
    };

    // Stay in setup / calibrate so guides are visible
    openPanel("setup");
    selectedDataPoint = null;

    setAxisDetectStatus(
      "Axes placed (confidence ~" + confPct + "%). Check markers, then enter X1/X2/Y1/Y2 values.",
      false
    );
    triggerProjectChange();
    renderAll();
    updateHelperBanner();
    pulseModeBadge();
  }

  if (btnDetectAxes) {
    btnDetectAxes.addEventListener("click", runAutoAxisDetect);
  }

  
  // ── Drag & Drop, Select Image Handlers ───────────────────────
  if (btnLoadExample) {
    btnLoadExample.addEventListener("click", (e) => {
      e.stopPropagation();
      loadImage("assets/plot-placeholder.jpg");
    });
  }
  
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
      // Remember pristine load for "Reset to original"
      originalImageBackup = {
        dataUrl: compressedImgData,
        width: w,
        height: h
      };
      
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
      
      // Seed undo history at image-load point
      historyStack = [snapshotSeriesList()];
      historyPointer = 0;
      updateUndoRedoButtons();
      
      resizeCanvas();
      openPanel("setup");
      updateHelperBanner();
      renderAll();
    };
    img.src = dataUrl;
  }

  function defaultCalibrationMarkers(w, h) {
    return {
      x1: { px: Math.round(w * 0.15), py: Math.round(h * 0.85) },
      x2: { px: Math.round(w * 0.85), py: Math.round(h * 0.85) },
      y1: { px: Math.round(w * 0.15), py: Math.round(h * 0.85) },
      y2: { px: Math.round(w * 0.15), py: Math.round(h * 0.15) }
    };
  }

  /** Reset X1/X2/Y1/Y2 to default corners of the current image (values unchanged). */
  function resetMarkersOnly() {
    if (!imageLoaded || !imgWidth || !imgHeight) {
      alert("Load a plot image first.");
      return;
    }
    if (!confirm("Reset axis markers to default corners of the current image? Entered X/Y values are kept.")) {
      return;
    }
    pushHistory();
    calibrationPoints = defaultCalibrationMarkers(imgWidth, imgHeight);
    openPanel("setup");
    triggerProjectChange();
    renderAll();
    updateHelperBanner();
    pulseModeBadge();
  }

  /** Restore image as first loaded (undoes prep edits). */
  function resetToOriginalImage() {
    if (!originalImageBackup || !originalImageBackup.dataUrl) {
      alert("No original image stored yet. Load or paste a plot first.");
      return;
    }
    if (!confirm("Reset image to the original upload? Prep edits (rotate, crop, filters) will be undone. Digitized points stay, but may no longer align if the image geometry changed. Markers reset to default corners.")) {
      return;
    }
    pushHistory();
    compressedImgData = originalImageBackup.dataUrl;
    imgWidth = originalImageBackup.width;
    imgHeight = originalImageBackup.height;
    plotImg.src = compressedImgData;
    imageLoaded = true;
    dropzone.style.display = "none";
    canvasWrapper.style.display = "block";
    imageActions.style.display = "flex";
    calibrationPoints = defaultCalibrationMarkers(imgWidth, imgHeight);
    triggerProjectChange();
    setTimeout(() => {
      resizeCanvas();
      renderAll();
      updateHelperBanner();
      pulseModeBadge();
    }, 40);
  }

  const btnImgResetOriginal = document.getElementById("btn-img-reset-original");
  if (btnImgResetOriginal) {
    btnImgResetOriginal.addEventListener("click", resetToOriginalImage);
  }
  const btnImgResetMarkers = document.getElementById("btn-img-reset-markers");
  if (btnImgResetMarkers) {
    btnImgResetMarkers.addEventListener("click", resetMarkersOnly);
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
    originalImageBackup = null;
    zoomFactor = 1.0;
    zoomSlider.value = 1.0;
    zoomLabel.textContent = "100%";
    legendVisible = true;
    if (btnToggleLegend) {
      btnToggleLegend.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg> Toggle Legend';
    }
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
  
  // Calibrate button removed — Setup panel drives calibrate mode.
  if (modeBtnCalibrate) {
    modeBtnCalibrate.addEventListener("click", () => openPanel("setup"));
  }

  // Measure / mask tool changes update mode badge
  ["measure-mode", "mask-tool"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => updateModeBadge());
  });
  
  function isTimeScale() {
    return selectScaleX && selectScaleX.value === "time";
  }

  function isDiscreteMode() {
    if (window.__plotParity && window.__plotParity.isDiscreteKind) {
      return window.__plotParity.isDiscreteKind();
    }
    const k = selectChartKind ? selectChartKind.value : "continuous";
    return k === "discrete" || k === "histogram";
  }

  function getTimeUnit() {
    return (selectTimeUnit && selectTimeUnit.value) || "s";
  }

  /** Parse X calibration field → seconds (time) or numeric (linear/log). */
  function parseCalXValue(raw) {
    if (isTimeScale() && PM) {
      const parsed = PM.parseTimeToSeconds(raw, getTimeUnit());
      if (parsed) return parsed.seconds;
      return 0;
    }
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function getAxisCalValues() {
    return {
      x1Val: parseCalXValue(inputCalX1.value),
      x2Val: parseCalXValue(inputCalX2.value),
      y1Val: parseFloat(inputCalY1.value) || 0,
      y2Val: parseFloat(inputCalY2.value) || 10
    };
  }

  function calUsesAbsoluteTime() {
    if (!isTimeScale() || !PM) return false;
    const a = PM.parseTimeToSeconds(inputCalX1.value, getTimeUnit());
    const b = PM.parseTimeToSeconds(inputCalX2.value, getTimeUnit());
    return !!(a && b && a.absolute && b.absolute);
  }

  function formatXValue(x, forCsv) {
    if (!isTimeScale() || !PM) {
      if (!Number.isFinite(x)) return "—";
      if (forCsv) return String(x);
      return Math.abs(x) >= 1e4 || (Math.abs(x) > 0 && Math.abs(x) < 1e-3)
        ? x.toExponential(4)
        : parseFloat(x.toFixed(4)).toString();
    }
    const exportMode = (selectTimeExport && selectTimeExport.value) || "elapsed";
    if (exportMode === "iso" && calUsesAbsoluteTime()) {
      return PM.formatAbsolute(x);
    }
    if (exportMode === "seconds") {
      return forCsv ? String(x) : parseFloat(x.toFixed(4)).toString();
    }
    const origin = parseCalXValue(inputCalX1.value);
    return PM.formatElapsed(x - origin, getTimeUnit());
  }

  function formatYValue(y) {
    if (!Number.isFinite(y)) return "—";
    return parseFloat(Number(y).toFixed(4)).toString();
  }

  function formatHoverLabel(math) {
    if (isDiscreteMode()) return `y=${formatYValue(math.y)}`;
    return `(${formatXValue(math.x, false)}, ${formatYValue(math.y)})`;
  }

  function updateChartModeUI() {
    const time = isTimeScale();
    const discrete = isDiscreteMode();

    if (timeAxisOptions) timeAxisOptions.style.display = time ? "flex" : "none";
    if (labelCalX1) labelCalX1.textContent = time ? "X1 Time (left/origin)" : "X1 Reference Value";
    if (labelCalX2) labelCalX2.textContent = time ? "X2 Time (right)" : "X2 Reference Value";

    if (calHelpText) {
      if (discrete) {
        calHelpText.innerHTML = "<strong>Bar mode:</strong> Calibrate Y (and optionally X span). Click each bar <em>top</em> to capture its height. Edit category labels in the table.";
      } else if (time) {
        calHelpText.innerHTML = "<strong>Time series:</strong> Place X1/X2 on known time ticks. Values may be relative (<code>0</code>, <code>2min</code>, <code>1:30</code>) or absolute ISO timestamps.";
      } else {
        calHelpText.innerHTML = "<strong>How to calibrate:</strong> Drag the red target markers (X1, X2, Y1, Y2) on the plot image to match gridlines or tick marks, then type the actual values for those points above.";
      }
    }

    if (regressionCard) {
      regressionCard.style.display = discrete ? "none" : "";
      if (discrete && selectFitType) {
        selectFitType.value = "none";
        const active = seriesList.find((s) => s.id === activeSeriesId);
        if (active) active.fitType = "none";
        if (fitStatsBox) fitStatsBox.style.display = "none";
      }
    }

    if (pointsTableHead) {
      if (discrete) {
        pointsTableHead.innerHTML = `
          <th>Category</th>
          <th>Y (value)</th>
          <th style="width: 40px; text-align: center;">Action</th>`;
      } else {
        const xLabel = time ? `Time (${getTimeUnit()})` : "X";
        pointsTableHead.innerHTML = `
          <th>${xLabel}</th>
          <th>Y</th>
          <th style="width: 40px; text-align: center;">Action</th>`;
      }
    }
    if (pointsTableHint) {
      pointsTableHint.textContent = discrete
        ? "Click bar tops on the canvas. Edit category labels in the table. Double-click a marker to delete."
        : "Double-click a point on the canvas to delete it. Drag to fine-tune.";
    }
  }

  function updateHelperBanner() {
    updateModeBadge();
  }
  
  // ── Math Calculations: Image Pixel Space ⇄ Calibrated Math Space ────
  function toMathCoords(px, py) {
    const scaleX = selectScaleX.value;
    const scaleY = selectScaleY.value;
    const { x1Val, x2Val, y1Val, y2Val } = getAxisCalValues();

    if (PM) {
      return PM.pixelToMath({
        px, py,
        cal: calibrationPoints,
        scaleX, scaleY,
        x1Val, x2Val, y1Val, y2Val
      });
    }

    const cal = calibrationPoints;
    const fracX = (px - cal.x1.px) / (cal.x2.px - cal.x1.px || 1);
    const fracY = (py - cal.y1.py) / (cal.y2.py - cal.y1.py || 1);
    return {
      x: x1Val + fracX * (x2Val - x1Val),
      y: y1Val + fracY * (y2Val - y1Val)
    };
  }
  
  function toPixelCoords(x, y) {
    const scaleX = selectScaleX.value;
    const scaleY = selectScaleY.value;
    const { x1Val, x2Val, y1Val, y2Val } = getAxisCalValues();

    if (PM) {
      return PM.mathToPixel({
        x, y,
        cal: calibrationPoints,
        scaleX, scaleY,
        x1Val, x2Val, y1Val, y2Val
      });
    }

    const cal = calibrationPoints;
    const fracX = (x - x1Val) / (x2Val - x1Val || 1);
    const fracY = (y - y1Val) / (y2Val - y1Val || 1);
    return {
      px: cal.x1.px + fracX * (cal.x2.px - cal.x1.px),
      py: cal.y1.py + fracY * (cal.y2.py - cal.y1.py)
    };
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

    const earlyPos = getMouseCoordinates(e);
    if (window.__plotParity && window.__plotParity.onPointerDown(earlyPos, e)) {
      e.preventDefault();
      return;
    }
    
    if (currentMode === "pan") {
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = canvasContainer.scrollLeft;
      startScrollTop = canvasContainer.scrollTop;
      canvas.style.cursor = "grabbing";
      return;
    }
    
    const pos = earlyPos;
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
        pushHistory(); // snapshot before mutation
        const newPt = { px: Math.round(pos.x), py: Math.round(pos.y) };
        if (isDiscreteMode()) {
          const idx = activeSeriesObj.points.length;
          newPt.label = (PM && PM.defaultBarLabel)
            ? PM.defaultBarLabel(idx)
            : ("Bar " + (idx + 1));
        }
        activeSeriesObj.points.push(newPt);
        activeSeriesObj.points.sort((a, b) => a.px - b.px);
        selectedDataPoint = newPt; // Select newly added point
        triggerProjectChange();
        renderAll();
        updatePointsTable();
        flashPointsReady();
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
    if (window.__plotParity && window.__plotParity.onPointerMove(pos, e)) {
      lastMousePos = pos;
      mouseOnCanvas = true;
      return;
    }
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
          label: formatHoverLabel(mathCoords)
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
              const prefix = (isDiscreteMode() && pt.label) ? (pt.label + " ") : "";
              hoverInfo = {
                x: pt.px,
                y: pt.py,
                label: prefix + formatHoverLabel(mathCoords)
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
    if (window.__plotParity && window.__plotParity.onPointerUp) {
      window.__plotParity.onPointerUp();
    }
    const wasDraggingPoint = isDragging && dragTarget && typeof dragTarget === "object";
    isDragging = false;
    isPanning = false;
    if (wasDraggingPoint) {
      pushHistory(); // snapshot after drag completes
    }
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
          pushHistory(); // snapshot before delete
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

    if (window.__plotParity && window.__plotParity.drawOverlay) {
      window.__plotParity.drawOverlay(ctx, imgScale);
    }
    
    // Draw regression curve if selected
    drawRegressionCurve();
    
    // Draw all data series (curve lines or discrete bar stems)
    seriesList.forEach(series => {
      const isActive = series.id === activeSeriesId;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.strokeStyle = series.color;
      ctx.fillStyle = series.color;
      const baselinePy = calibrationPoints.y1.py * imgScale;
      
      if (isDiscreteMode()) {
        // Stems from Y1 baseline to bar top + square marker
        series.points.forEach(pt => {
          const x = pt.px * imgScale;
          const y = pt.py * imgScale;
          ctx.beginPath();
          ctx.moveTo(x, baselinePy);
          ctx.lineTo(x, y);
          ctx.stroke();
          const s = isActive ? 5 : 4;
          ctx.fillRect(x - s, y - s, s * 2, s * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - s, y - s, s * 2, s * 2);
          ctx.strokeStyle = series.color;
          ctx.fillStyle = series.color;
          if (pt.label && isActive) {
            ctx.font = "bold 10px var(--font-sans)";
            ctx.fillStyle = series.color;
            const tw = ctx.measureText(pt.label).width;
            ctx.fillText(pt.label, x - tw / 2, y - 10);
          }
          if (pt === selectedDataPoint) {
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, 2 * Math.PI);
            ctx.strokeStyle = "#f43f5e";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.strokeStyle = series.color;
          }
        });
      } else {
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
      } // end continuous series draw
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
    if (document.activeElement && (
      document.activeElement.classList.contains("coord-cell") ||
      document.activeElement.classList.contains("label-cell")
    )) {
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

    const discrete = isDiscreteMode();
    
    pointsTableBody.innerHTML = activeSeries.points.map((pt, i) => {
      const math = toMathCoords(pt.px, pt.py);
      const isPtSelected = selectedDataPoint === pt;
      const rowStyle = isPtSelected ? `background: var(--accent-primary-glow); font-weight: 600;` : ``;
      if (discrete) {
        const label = pt.label != null ? pt.label : ((PM && PM.defaultBarLabel) ? PM.defaultBarLabel(i) : ("Bar " + (i + 1)));
        return `
        <tr style="${rowStyle}">
          <td contenteditable="true" class="label-cell" data-index="${i}" title="Edit category label">${escapeHtml(label)}</td>
          <td contenteditable="true" class="coord-cell" data-index="${i}" data-coord="y" title="Edit value">${formatYValue(math.y)}</td>
          <td style="text-align: center;">
            <button class="btn-icon danger remove-pt-btn" data-index="${i}" title="Delete point">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </td>
        </tr>`;
      }
      return `
        <tr style="${rowStyle}">
          <td contenteditable="true" class="coord-cell" data-index="${i}" data-coord="x" title="Double click to edit">${formatXValue(math.x, false)}</td>
          <td contenteditable="true" class="coord-cell" data-index="${i}" data-coord="y" title="Double click to edit">${formatYValue(math.y)}</td>
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

    pointsTableBody.querySelectorAll(".label-cell").forEach(cell => {
      cell.addEventListener("focus", () => {
        const index = parseInt(cell.dataset.index, 10);
        if (activeSeries.points[index]) {
          selectedDataPoint = activeSeries.points[index];
          renderAll();
        }
      });
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); cell.blur(); }
      });
      cell.addEventListener("blur", () => {
        const index = parseInt(cell.dataset.index, 10);
        const pt = activeSeries.points[index];
        if (pt) {
          pt.label = cell.textContent.trim() || pt.label || ("Bar " + (index + 1));
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
        const raw = cell.textContent.trim();
        const pt = activeSeries.points[index];
        if (!pt) return;
        const math = toMathCoords(pt.px, pt.py);

        let newVal;
        if (coord === "x" && isTimeScale() && PM) {
          const parsed = PM.parseTimeToSeconds(raw, getTimeUnit());
          if (!parsed) {
            cell.textContent = formatXValue(math.x, false);
            return;
          }
          // Relative entry → absolute seconds = origin + elapsed when cal is relative-style
          if (!parsed.absolute && !calUsesAbsoluteTime()) {
            newVal = parseCalXValue(inputCalX1.value) + parsed.seconds;
          } else {
            newVal = parsed.seconds;
          }
        } else {
          newVal = parseFloat(raw);
        }

        if (!isNaN(newVal) && Number.isFinite(newVal)) {
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
          cell.textContent = coord === "x" ? formatXValue(math.x, false) : formatYValue(math.y);
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
    if (isDiscreteMode()) return;
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
        activeSeriesId = id;
        openPanel("series");
        currentMode = "digitize";
        if (modeBtnCalibrate) modeBtnCalibrate.classList.remove("active");
        const activeSeries = seriesList.find(s => s.id === activeSeriesId);
        if (activeSeries) {
          selectFitType.value = activeSeries.fitType || "none";
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
          pushHistory();
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
    if (!imageLoaded || !legendVisible) {
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
    
    pushHistory();
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
        pushHistory();
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
  function refreshAxesAndTable() {
    updateChartModeUI();
    triggerProjectChange();
    renderAll();
    populatePointsTable();
  }

  selectScaleX.addEventListener("change", refreshAxesAndTable);
  selectScaleY.addEventListener("change", refreshAxesAndTable);
  if (selectChartKind) selectChartKind.addEventListener("change", refreshAxesAndTable);
  if (selectTimeUnit) selectTimeUnit.addEventListener("change", refreshAxesAndTable);
  if (selectTimeExport) selectTimeExport.addEventListener("change", refreshAxesAndTable);
  inputCalX1.addEventListener("input", () => { triggerProjectChange(); renderAll(); populatePointsTable(); });
  inputCalX2.addEventListener("input", () => { triggerProjectChange(); renderAll(); populatePointsTable(); });
  inputCalY1.addEventListener("input", () => { triggerProjectChange(); renderAll(); populatePointsTable(); });
  inputCalY2.addEventListener("input", () => { triggerProjectChange(); renderAll(); populatePointsTable(); });

  // Alias used by click handlers
  function updatePointsTable() {
    populatePointsTable();
  }
  
  // ── CSV Exporters & Copy table ───────────────────────────────
  
  function getCSVContent() {
    const activeSeries = seriesList.find(s => s.id === activeSeriesId);
    if (!activeSeries || activeSeries.points.length === 0) return "";

    if (isDiscreteMode()) {
      let csv = "Category,Y Value\n";
      activeSeries.points.forEach((pt, i) => {
        const math = toMathCoords(pt.px, pt.py);
        const label = (pt.label != null ? pt.label : ("Bar " + (i + 1))).replace(/"/g, '""');
        csv += `"${label}",${math.y}\n`;
      });
      return csv;
    }
    
    const xHeader = isTimeScale() ? "Time" : "X Coordinate";
    let csv = `${xHeader},Y Coordinate\n`;
    activeSeries.points.forEach(pt => {
      const math = toMathCoords(pt.px, pt.py);
      const xOut = formatXValue(math.x, true);
      // Quote time strings that may contain commas
      const xCell = /[,"]/.test(String(xOut)) ? `"${String(xOut).replace(/"/g, '""')}"` : xOut;
      csv += `${xCell},${math.y}\n`;
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
    let csv;
    if (isDiscreteMode()) {
      csv = "Series Name,Category,Y Value\n";
      seriesList.forEach(series => {
        series.points.forEach((pt, i) => {
          hasPoints = true;
          const math = toMathCoords(pt.px, pt.py);
          const label = (pt.label != null ? pt.label : ("Bar " + (i + 1))).replace(/"/g, '""');
          csv += `"${series.name.replace(/"/g, '""')}","${label}",${math.y}\n`;
        });
      });
    } else {
      const xHeader = isTimeScale() ? "Time" : "X Coordinate";
      csv = `Series Name,${xHeader},Y Coordinate\n`;
      seriesList.forEach(series => {
        if (series.points.length > 0) {
          hasPoints = true;
          series.points.forEach(pt => {
            const math = toMathCoords(pt.px, pt.py);
            const xOut = formatXValue(math.x, true);
            const xCell = /[,"]/.test(String(xOut)) ? `"${String(xOut).replace(/"/g, '""')}"` : xOut;
            csv += `"${series.name.replace(/"/g, '""')}",${xCell},${math.y}\n`;
          });
        }
      });
    }
    
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

  window.shareLink = function() {
    try {
      const state = getPlotExtractorState();
      // Omit image data if it's too large (> 10KB) to prevent URI Too Long errors
      if (state.compressedImgData && state.compressedImgData.length > 10000) {
        const stateNoImg = { ...state };
        delete stateNoImg.compressedImgData;
        const serialized = (window.encodeShareState ? window.encodeShareState(stateNoImg) : btoa(unescape(encodeURIComponent(JSON.stringify(stateNoImg)))));
        const url = new URL(window.location.href);
        url.searchParams.set('design', serialized);
        
        navigator.clipboard.writeText(url.toString()).then(() => {
          alert("Design link copied to clipboard! (Note: The background image was omitted as it is too large for a URL; recipient will need to upload/paste their image.)");
        }).catch(() => {
          alert("Failed to write to clipboard automatically. Link is too long.");
        });
      } else {
        const serialized = (window.encodeShareState ? window.encodeShareState(state) : btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
        const url = new URL(window.location.href);
        url.searchParams.set('design', serialized);
        
        navigator.clipboard.writeText(url.toString()).then(() => {
          alert("Design link copied to clipboard!");
        }).catch(() => {
          alert("Failed to write to clipboard.");
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate share link.");
    }
  };
  
  // Bind standard buttons in DOM
  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  if (btnExport) btnExport.addEventListener("click", window.exportJSON);
  if (btnImport) btnImport.addEventListener("click", () => importInput.click());
  if (importInput) importInput.addEventListener("change", window.importJSON);
  
  // ── Firebase Project Manager Sync Hooks ───────────────────────
  
  function getPlotExtractorState() {
    const base = {
      schemaVersion: 3,
      compressedImgData,
      imgWidth,
      imgHeight,
      calibrationPoints,
      seriesList,
      activeSeriesId,
      chartKind: selectChartKind ? selectChartKind.value : "continuous",
      scaleX: selectScaleX.value,
      scaleY: selectScaleY.value,
      timeUnit: selectTimeUnit ? selectTimeUnit.value : "s",
      timeExport: selectTimeExport ? selectTimeExport.value : "elapsed",
      // Keep raw string cal X for time modes (numbers still stringify fine)
      x1Val: inputCalX1.value,
      x2Val: inputCalX2.value,
      y1Val: parseFloat(inputCalY1.value) || 0,
      y2Val: parseFloat(inputCalY2.value) || 10,
      fitType: selectFitType.value
    };
    if (window.__plotParity && window.__plotParity.getExtraState) {
      Object.assign(base, window.__plotParity.getExtraState());
    }
    return base;
  }
  
  function setPlotExtractorState(state) {
    if (!state) return;
    
    if (state.compressedImgData) {
      compressedImgData = state.compressedImgData;
      plotImg.src = compressedImgData;
      imgWidth = state.imgWidth || 1000;
      imgHeight = state.imgHeight || 1000;
      imageLoaded = true;
      if (!originalImageBackup) {
        originalImageBackup = {
          dataUrl: compressedImgData,
          width: imgWidth,
          height: imgHeight
        };
      }
      dropzone.style.display = "none";
      canvasWrapper.style.display = "block";
      imageActions.style.display = "flex";
    } else {
      // Keep existing image if one is already loaded, or show dropzone without clearing points
      if (!imageLoaded) {
        dropzone.style.display = "flex";
        canvasWrapper.style.display = "none";
        imageActions.style.display = "none";
        plotImg.src = "";
      }
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
    
    if (state.chartKind && selectChartKind) selectChartKind.value = state.chartKind;
    if (state.scaleX) selectScaleX.value = state.scaleX;
    if (state.scaleY) selectScaleY.value = state.scaleY;
    if (state.timeUnit && selectTimeUnit) selectTimeUnit.value = state.timeUnit;
    if (state.timeExport && selectTimeExport) selectTimeExport.value = state.timeExport;
    if (state.x1Val !== undefined) inputCalX1.value = state.x1Val;
    if (state.x2Val !== undefined) inputCalX2.value = state.x2Val;
    if (state.y1Val !== undefined) inputCalY1.value = state.y1Val;
    if (state.y2Val !== undefined) inputCalY2.value = state.y2Val;
    if (state.fitType !== undefined) selectFitType.value = state.fitType;
    if (window.__plotParity && window.__plotParity.setExtraState) {
      window.__plotParity.setExtraState(state);
    }
    
    updateSeriesUI();
    updateChartModeUI();
    updateHelperBanner();
    if (window.__plotParity && window.__plotParity.updateParityUI) {
      window.__plotParity.updateParityUI();
    }
    
    // Trigger delay refresh to allow image component dimension loading
    setTimeout(() => {
      resizeCanvas();
      renderAll();
      populatePointsTable();
    }, 150);
  }
  
  // Custom event trigger to hook dirty warnings and periodic auto-saves
  function triggerProjectChange() {
    document.dispatchEvent(new Event("input"));
  }

  // ── Undo / Redo History Stack ──────────────────────────────────
  const MAX_HISTORY = 60;

  function snapshotSeriesList() {
    return JSON.parse(JSON.stringify(seriesList));
  }

  function pushHistory() {
    // Discard any forward history when a new action occurs
    historyStack = historyStack.slice(0, historyPointer + 1);
    historyStack.push(snapshotSeriesList());
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyPointer = historyStack.length - 1;
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    if (btnUndo) btnUndo.disabled = historyPointer <= 0;
    if (btnRedo) btnRedo.disabled = historyPointer >= historyStack.length - 1;
  }

  function applyHistory(snapshot) {
    seriesList = JSON.parse(JSON.stringify(snapshot));
    // Ensure activeSeriesId still exists; if not, fall back to first series
    if (!seriesList.find(s => s.id === activeSeriesId)) {
      activeSeriesId = seriesList[0]?.id;
    }
    selectedDataPoint = null;
    triggerProjectChange();
    renderAll();
    updateSeriesUI();
  }

  function undo() {
    if (historyPointer <= 0) return;
    historyPointer--;
    applyHistory(historyStack[historyPointer]);
    updateUndoRedoButtons();
  }

  function redo() {
    if (historyPointer >= historyStack.length - 1) return;
    historyPointer++;
    applyHistory(historyStack[historyPointer]);
    updateUndoRedoButtons();
  }

  // Bind Undo/Redo toolbar buttons
  if (btnUndo) btnUndo.addEventListener("click", undo);
  if (btnRedo) btnRedo.addEventListener("click", redo);
  
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
  
  // Wheel zoom via Ctrl + Scroll Wheel (zooms toward cursor focus)
  canvas.addEventListener("wheel", (e) => {
    if (!imageLoaded) return;
    if (e.ctrlKey) {
      e.preventDefault();
      
      const container = document.getElementById("canvas-container-root");
      const wrapper = document.getElementById("plot-canvas-wrapper");
      if (!container || !wrapper) return;

      const direction = e.deltaY < 0 ? 1 : -1;
      const nextZoom = Math.max(0.5, Math.min(3.0, zoomFactor + direction * 0.1));
      if (Math.abs(nextZoom - zoomFactor) < 0.01) return;

      // 1. Calculate positions before zoom
      const scrollLeftBefore = container.scrollLeft;
      const scrollTopBefore = container.scrollTop;
      
      const containerRect = container.getBoundingClientRect();
      const mouseXInContainer = e.clientX - containerRect.left;
      const mouseYInContainer = e.clientY - containerRect.top;

      const wrapperLeftBefore = wrapper.offsetLeft;
      const wrapperTopBefore = wrapper.offsetTop;

      const contentX = mouseXInContainer + scrollLeftBefore - wrapperLeftBefore;
      const contentY = mouseYInContainer + scrollTopBefore - wrapperTopBefore;

      const ratio = nextZoom / zoomFactor;

      // 2. Apply zoom
      setZoom(nextZoom);

      // 3. Align scroll position to anchor the point under the cursor
      const wrapperLeftAfter = wrapper.offsetLeft;
      const wrapperTopAfter = wrapper.offsetTop;

      container.scrollLeft = (contentX * ratio) - mouseXInContainer + wrapperLeftAfter;
      container.scrollTop = (contentY * ratio) - mouseYInContainer + wrapperTopAfter;
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
      if (isDiscreteMode()) {
        const baseline = calibrationPoints.y1.py;
        series.points.forEach(pt => {
          offCtx.strokeStyle = series.color;
          offCtx.lineWidth = 3;
          offCtx.beginPath();
          offCtx.moveTo(pt.px, baseline);
          offCtx.lineTo(pt.px, pt.py);
          offCtx.stroke();
          offCtx.fillStyle = series.color;
          offCtx.fillRect(pt.px - 5, pt.py - 5, 10, 10);
        });
        return;
      }
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
    // Undo / Redo shortcuts (before the input-field guard)
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    
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
        label: formatHoverLabel(mathCoords)
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

  // Legend Toggle Click Listener
  if (btnToggleLegend) {
    btnToggleLegend.addEventListener("click", () => {
      legendVisible = !legendVisible;
      updateCanvasLegend();
      
      // Update eye icon state
      if (legendVisible) {
        btnToggleLegend.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg> Toggle Legend';
      } else {
        btnToggleLegend.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg> Toggle Legend';
      }
    });
  }

  function loadURLDesign() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const design = urlParams.get('design');
      if (design) {
        const decoded = (window.decodeShareState ? window.decodeShareState(design) : JSON.parse(decodeURIComponent(escape(atob(design)))));
        setPlotExtractorState(decoded);
      }
    } catch (err) {
      console.error("Failed to load design from URL:", err);
    }
  }

  updateChartModeUI();

  // Parity-full runtime (image prep, mask, detectors, measures, projections)
  if (window.PlotParityRuntime && window.PlotParityRuntime.init) {
    window.__plotParity = window.PlotParityRuntime.init({
      getSeries: () => seriesList,
      setSeries: (s) => { seriesList = s; },
      getActiveSeriesId: () => activeSeriesId,
      getCal: () => calibrationPoints,
      setCal: (c) => { calibrationPoints = c; },
      getPlotImageEl: () => plotImg,
      getImageSize: () => ({ w: imgWidth, h: imgHeight }),
      pushHistory,
      renderAll,
      populatePointsTable,
      triggerProjectChange,
      toMathCoords,
      setChartKind: (k) => {
        if (selectChartKind) selectChartKind.value = k;
        updateChartModeUI();
      },
      onChartKindChanged: (kind, discrete) => {
        updateChartModeUI();
        updateHelperBanner();
        renderAll();
        populatePointsTable();
      },
      replaceImage: (dataUrl, w, h) => {
        // Prep edits — do not overwrite originalImageBackup
        compressedImgData = dataUrl;
        plotImg.src = dataUrl;
        imgWidth = w;
        imgHeight = h;
        imageLoaded = true;
        dropzone.style.display = "none";
        canvasWrapper.style.display = "block";
        imageActions.style.display = "flex";
        setTimeout(() => { resizeCanvas(); renderAll(); updateModeBadge(); }, 50);
      },
      openPanel,
      updateModeBadge,
      afterImageEdit: () => {
        triggerProjectChange();
        updateSeriesUI();
        populatePointsTable();
        flashPointsReady();
        setTimeout(() => { resizeCanvas(); renderAll(); updateModeBadge(); }, 50);
      }
    });
  }

  loadURLDesign();
});

// Header Export ▾ — JSON + CSV + plot image + lookup table
if (window.ToolExports) {
  const click = (id) => () => document.getElementById(id)?.click();
  window.ToolExports.register({
    json: () => window.exportJSON(),
    import: () => document.getElementById("import-file-input")?.click(),
    csv: click("btn-download-csv"),
    image: click("btn-download-plot"),
    extra: [
      { id: "copy-csv", label: "Copy active CSV", run: click("btn-copy-csv") },
      { id: "combined-csv", label: "Save combined CSV", run: click("btn-download-combined-csv") },
      { id: "lookup-table", label: "Generate lookup table", run: click("btn-export-table") }
    ],
    hide: ["[data-et-export-ui]", "#btn-export"]
  });
  window.ToolExports.mount();
}
