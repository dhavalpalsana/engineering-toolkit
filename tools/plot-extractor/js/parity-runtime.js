/**
 * Parity-full runtime: image prep, mask, detectors, measures, projection modes.
 * Initialized from app.js with accessors into closed-over state.
 */
(function (root) {
  "use strict";

  function init(api) {
    if (!api) return;
    const PIP = root.PlotImagePipeline;
    const Mask = root.PlotMask;
    const Reg = root.PlotDetectorRegistry;
    const Proj = root.PlotProjection;

    let workingImageData = null;
    let mask = null;
    let maskVisible = true;
    let sampleRgb = [13, 148, 136];
    let samplingColor = false;
    let cropRect = null; // {x0,y0,x1,y1} image px
    let cropDragging = false;
    let maskDragging = false;
    let measurePts = [];
    let measures = []; // {type, points, value, label}

    const $ = (id) => document.getElementById(id);

    function chartKind() {
      const el = $("chart-kind");
      return el ? el.value : "continuous";
    }

    function ensureMask() {
      const wh = api.getImageSize();
      if (!wh.w || !wh.h) return null;
      if (!mask || mask.width !== wh.w || mask.height !== wh.h) {
        mask = Mask ? Mask.create(wh.w, wh.h, 0) : null;
      }
      return mask;
    }

    function captureImageData() {
      const img = api.getPlotImageEl();
      if (!img || !img.naturalWidth) return null;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0);
      workingImageData = cx.getImageData(0, 0, c.width, c.height);
      return workingImageData;
    }

    function pushImageToDom(imageData) {
      if (!PIP || !imageData) return;
      const c = document.createElement("canvas");
      c.width = imageData.width;
      c.height = imageData.height;
      c.getContext("2d").putImageData(
        imageData instanceof ImageData
          ? imageData
          : new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height),
        0,
        0
      );
      const dataUrl = c.toDataURL("image/png");
      api.replaceImage(dataUrl, imageData.width, imageData.height);
      workingImageData = imageData;
      mask = Mask ? Mask.create(imageData.width, imageData.height, 0) : null;
      api.afterImageEdit();
    }

    function mapAllPoints(mapFn) {
      const series = api.getSeries();
      series.forEach((s) => {
        s.points = s.points.map((p) => {
          const np = mapFn(p.px, p.py);
          return { ...p, px: np.px, py: np.py };
        });
      });
      api.setSeries(series);
      const cal = api.getCal();
      ["x1", "x2", "y1", "y2"].forEach((k) => {
        if (cal[k]) {
          const np = mapFn(cal[k].px, cal[k].py);
          cal[k] = { px: np.px, py: np.py };
        }
      });
      api.setCal(cal);
    }

    // ── Image buttons ──────────────────────────────────────────
    function onRotate90() {
      const id = captureImageData();
      if (!id || !PIP) return;
      api.pushHistory();
      const out = PIP.rotate90(id, 1);
      const w0 = id.width, h0 = id.height;
      mapAllPoints((px, py) => PIP.mapPointAfterRotate90CW(px, py, w0, h0));
      pushImageToDom(out);
    }

    function onFlipH() {
      const id = captureImageData();
      if (!id || !PIP) return;
      api.pushHistory();
      const out = PIP.flipH(id);
      mapAllPoints((px, py) => PIP.mapPointAfterFlipH(px, py, id.width));
      pushImageToDom(out);
    }

    function onFlipV() {
      const id = captureImageData();
      if (!id || !PIP) return;
      api.pushHistory();
      const out = PIP.flipV(id);
      mapAllPoints((px, py) => PIP.mapPointAfterFlipV(px, py, id.height));
      pushImageToDom(out);
    }

    function onFilter(fn) {
      const id = captureImageData();
      if (!id || !PIP) return;
      api.pushHistory();
      pushImageToDom(fn(id));
    }

    function onScale() {
      const id = captureImageData();
      if (!id || !PIP) return;
      const s = parseFloat(($("img-scale") || {}).value) || 1;
      api.pushHistory();
      const out = PIP.scaleNearest(id, s);
      mapAllPoints((px, py) => ({ px: px * s, py: py * s }));
      pushImageToDom(out);
    }

    function applyCrop() {
      if (!cropRect || !PIP) return;
      const id = captureImageData();
      if (!id) return;
      api.pushHistory();
      const { image, offset } = PIP.crop(id, cropRect.x0, cropRect.y0, cropRect.x1, cropRect.y1);
      mapAllPoints((px, py) => PIP.mapPointAfterCrop(px, py, offset));
      cropRect = null;
      const btn = $("btn-img-crop-apply");
      if (btn) btn.disabled = true;
      pushImageToDom(image);
    }

    // ── Mask ───────────────────────────────────────────────────
    function drawMaskOverlay(ctx, imgScale) {
      if (!maskVisible || !mask) return;
      ctx.save();
      ctx.fillStyle = "rgba(13, 148, 136, 0.28)";
      for (let y = 0; y < mask.height; y += 2) {
        for (let x = 0; x < mask.width; x += 2) {
          if (mask.data[y * mask.width + x] > 127) {
            ctx.fillRect(x * imgScale, y * imgScale, 2 * imgScale, 2 * imgScale);
          }
        }
      }
      ctx.restore();
    }

    function handleMaskPointer(pos, isDown, isMove) {
      const tool = ($("mask-tool") || {}).value || "off";
      if (tool === "off") return false;
      const m = ensureMask();
      if (!m || !Mask) return false;
      const brush = parseInt(($("mask-brush") || {}).value, 10) || 12;
      if (tool === "box" || tool === "box-erase") {
        if (isDown) {
          maskDragging = true;
          cropRect = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, mask: true };
          return true;
        }
        if (isMove && maskDragging && cropRect && cropRect.mask) {
          cropRect.x1 = pos.x;
          cropRect.y1 = pos.y;
          api.renderAll();
          return true;
        }
        return maskDragging;
      }
      if (tool === "pencil" || tool === "erase") {
        if (isDown || (isMove && maskDragging)) {
          maskDragging = true;
          Mask.brush(m, pos.x, pos.y, brush, tool === "erase" ? "erase" : "add");
          api.renderAll();
          return true;
        }
      }
      return false;
    }

    function endMaskPointer() {
      const tool = ($("mask-tool") || {}).value || "off";
      if ((tool === "box" || tool === "box-erase") && cropRect && cropRect.mask && Mask) {
        const m = ensureMask();
        Mask.box(m, cropRect.x0, cropRect.y0, cropRect.x1, cropRect.y1, tool === "box-erase" ? "erase" : "add");
        cropRect = null;
        api.renderAll();
      }
      maskDragging = false;
    }

    // ── Detectors ──────────────────────────────────────────────
    function runDetector() {
      if (!Reg) {
        alert("Detector registry not loaded");
        return;
      }
      const id = captureImageData();
      if (!id) {
        alert("Load an image first");
        return;
      }
      const detId = ($("detector-id") || {}).value || "curve";
      const tol = parseInt(($("detector-tol") || {}).value, 10) || 40;
      const result = Reg.run(detId, {
        imageData: id,
        mask: ensureMask(),
        sampleRgb,
        tolerance: tol,
        maxPoints: 500
      });
      if (result.error) {
        alert(result.error);
        return;
      }
      if (!result.series || !result.series[0] || !result.series[0].points.length) {
        alert("No points detected");
        return;
      }
      if (!confirm("Accept " + result.series[0].points.length + " autotrace points into the active series?")) {
        return;
      }
      api.pushHistory();
      const series = api.getSeries();
      const activeId = api.getActiveSeriesId();
      const s = series.find((x) => x.id === activeId) || series[0];
      if (s) {
        s.points = result.series[0].points.map((p) => ({ ...p }));
        if (chartKind() === "discrete" || chartKind() === "histogram" || detId === "bar" || detId === "histogram") {
          api.setChartKind && api.setChartKind(detId === "histogram" ? "histogram" : "discrete");
        }
      }
      api.setSeries(series);
      api.afterImageEdit();
    }

    // ── Measures ───────────────────────────────────────────────
    function measureMode() {
      return ($("measure-mode") || {}).value || "off";
    }

    function handleMeasureClick(pos) {
      const mode = measureMode();
      if (mode === "off" || chartKind() === "measure" && mode === "off") {
        if (chartKind() !== "measure") return false;
      }
      if (mode === "off") return false;
      if (!Proj) return false;

      const math = api.toMathCoords(pos.x, pos.y);
      measurePts.push({ px: pos.x, py: pos.y, x: math.x, y: math.y });

      const el = $("measure-results");
      if (mode === "distance" && measurePts.length >= 2) {
        const a = measurePts[measurePts.length - 2];
        const b = measurePts[measurePts.length - 1];
        const d = Proj.distanceXY(a, b);
        measures.push({ type: "distance", points: [a, b], value: d, label: "d=" + d.toPrecision(6) });
        measurePts = [];
        if (el) el.textContent = measures[measures.length - 1].label;
        api.renderAll();
        return true;
      }
      if (mode === "angle" && measurePts.length >= 3) {
        const [a, b, c] = measurePts.slice(-3);
        const ang = Proj.angleABC(a, b, c);
        measures.push({ type: "angle", points: [a, b, c], value: ang, label: "∠=" + ang.toFixed(2) + "°" });
        measurePts = [];
        if (el) el.textContent = measures[measures.length - 1].label;
        api.renderAll();
        return true;
      }
      if (mode === "area") {
        if (el) el.textContent = "Polygon: " + measurePts.length + " pts (press Enter to close)";
        api.renderAll();
        return true;
      }
      if (el) el.textContent = "Points: " + measurePts.length;
      api.renderAll();
      return true;
    }

    function closeAreaPolygon() {
      if (measureMode() !== "area" || measurePts.length < 3 || !Proj) return;
      const area = Proj.polygonArea(measurePts);
      measures.push({
        type: "area",
        points: measurePts.slice(),
        value: area,
        label: "A=" + area.toPrecision(6)
      });
      measurePts = [];
      const el = $("measure-results");
      if (el) el.textContent = measures[measures.length - 1].label;
      api.renderAll();
    }

    function drawMeasures(ctx, imgScale) {
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.fillStyle = "#f59e0b";
      ctx.lineWidth = 2;
      measures.forEach((m) => {
        const pts = m.points;
        if (!pts.length) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].px * imgScale, pts[0].py * imgScale);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].px * imgScale, pts[i].py * imgScale);
        }
        if (m.type === "area") ctx.closePath();
        ctx.stroke();
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.px * imgScale, p.py * imgScale, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      // in-progress
      if (measurePts.length) {
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(measurePts[0].px * imgScale, measurePts[0].py * imgScale);
        for (let i = 1; i < measurePts.length; i++) {
          ctx.lineTo(measurePts[i].px * imgScale, measurePts[i].py * imgScale);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // crop rect
      if (cropRect && !cropRect.mask) {
        ctx.strokeStyle = "#3b82f6";
        ctx.strokeRect(
          Math.min(cropRect.x0, cropRect.x1) * imgScale,
          Math.min(cropRect.y0, cropRect.y1) * imgScale,
          Math.abs(cropRect.x1 - cropRect.x0) * imgScale,
          Math.abs(cropRect.y1 - cropRect.y0) * imgScale
        );
      }
      if (cropRect && cropRect.mask) {
        ctx.strokeStyle = "#14b8a6";
        ctx.strokeRect(
          Math.min(cropRect.x0, cropRect.x1) * imgScale,
          Math.min(cropRect.y0, cropRect.y1) * imgScale,
          Math.abs(cropRect.x1 - cropRect.x0) * imgScale,
          Math.abs(cropRect.y1 - cropRect.y0) * imgScale
        );
      }
      ctx.restore();
    }

    function updateParityUI() {
      const kind = chartKind();
      const polar = $("polar-options");
      const map = $("map-options");
      if (polar) polar.style.display = kind === "polar" ? "flex" : "none";
      if (map) map.style.display = kind === "map" ? "flex" : "none";
      const discrete = kind === "discrete" || kind === "histogram";
      // scale helpers for reciprocal/ln already in select
      api.onChartKindChanged && api.onChartKindChanged(kind, discrete);
    }

    function getExtraState() {
      return {
        schemaVersion: 3,
        sampleRgb,
        mask: mask && Mask ? { width: mask.width, height: mask.height, data: Mask.toBase64(mask) } : null,
        measures,
        mapProjection: ($("map-projection") || {}).value || "linear",
        polarRmax: ($("polar-rmax") || {}).value,
        polarTheta0: ($("polar-theta0") || {}).value
      };
    }

    function setExtraState(st) {
      if (!st) return;
      if (st.sampleRgb) sampleRgb = st.sampleRgb;
      if (st.measures) measures = st.measures;
      if (st.mapProjection && $("map-projection")) $("map-projection").value = st.mapProjection;
      if (st.polarRmax && $("polar-rmax")) $("polar-rmax").value = st.polarRmax;
      if (st.polarTheta0 && $("polar-theta0")) $("polar-theta0").value = st.polarTheta0;
      if (st.mask && Mask && st.mask.data) {
        mask = Mask.fromBase64(st.mask.width, st.mask.height, st.mask.data);
      }
      const sw = $("sample-color-swatch");
      if (sw) sw.style.background = "rgb(" + sampleRgb.join(",") + ")";
    }

    // Wire DOM
    function wire() {
      const bind = (id, fn) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      };
      bind("btn-img-rotate90", onRotate90);
      bind("btn-img-flip-h", onFlipH);
      bind("btn-img-flip-v", onFlipV);
      bind("btn-img-gray", () => onFilter((id) => PIP.grayscale(id)));
      bind("btn-img-blur", () => onFilter((id) => PIP.blur(id)));
      bind("btn-img-contrast", () => onFilter((id) => PIP.contrast(id, 40)));
      bind("btn-img-threshold", () => onFilter((id) => PIP.threshold(id, 128)));
      bind("btn-img-scale", onScale);
      bind("btn-img-crop-apply", applyCrop);
      bind("btn-mask-clear", () => {
        const m = ensureMask();
        if (m && Mask) { Mask.clear(m, false); api.renderAll(); }
      });
      bind("btn-mask-fill", () => {
        const m = ensureMask();
        if (m && Mask) { Mask.clear(m, true); api.renderAll(); }
      });
      bind("btn-mask-toggle", () => { maskVisible = !maskVisible; api.renderAll(); });
      bind("btn-run-detector", runDetector);
      bind("btn-sample-color", () => {
        samplingColor = true;
        alert("Click a pixel on the plot to sample its color for autotrace.");
      });
      bind("btn-measure-clear", () => {
        measures = [];
        measurePts = [];
        const el = $("measure-results");
        if (el) el.textContent = "";
        api.renderAll();
      });
      const ck = $("chart-kind");
      if (ck) ck.addEventListener("change", updateParityUI);
      window.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && measureMode() === "area") {
          e.preventDefault();
          closeAreaPolygon();
        }
      });
      updateParityUI();
    }

    wire();

    return {
      drawOverlay(ctx, imgScale) {
        drawMaskOverlay(ctx, imgScale);
        drawMeasures(ctx, imgScale);
      },
      onPointerDown(pos, evt) {
        if (samplingColor) {
          const id = captureImageData();
          if (id) {
            const i = (Math.round(pos.y) * id.width + Math.round(pos.x)) * 4;
            sampleRgb = [id.data[i], id.data[i + 1], id.data[i + 2]];
            const sw = $("sample-color-swatch");
            if (sw) sw.style.background = "rgb(" + sampleRgb.join(",") + ")";
          }
          samplingColor = false;
          return true;
        }
        if (evt && evt.shiftKey) {
          cropDragging = true;
          cropRect = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
          const btn = $("btn-img-crop-apply");
          if (btn) btn.disabled = false;
          return true;
        }
        if (handleMaskPointer(pos, true, false)) return true;
        if (handleMeasureClick(pos)) return true;
        return false;
      },
      onPointerMove(pos, evt) {
        if (cropDragging && cropRect && !cropRect.mask) {
          cropRect.x1 = pos.x;
          cropRect.y1 = pos.y;
          api.renderAll();
          return true;
        }
        if (handleMaskPointer(pos, false, true)) return true;
        return false;
      },
      onPointerUp() {
        if (cropDragging) cropDragging = false;
        endMaskPointer();
      },
      getExtraState,
      setExtraState,
      updateParityUI,
      isDiscreteKind() {
        const k = chartKind();
        return k === "discrete" || k === "histogram";
      },
      chartKind
    };
  }

  root.PlotParityRuntime = { init };
})(typeof window !== "undefined" ? window : globalThis);
