/**
 * Auto axis geometry detection (no OCR).
 * Combines dark-ink projections + edge strength to find the plot frame.
 * Browser + Node (UMD).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlotAxisDetect = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function gray(data, w, x, y) {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function smooth1d(arr) {
    const out = new Float64Array(arr.length);
    for (let i = 1; i < arr.length - 1; i++) {
      out[i] = 0.25 * arr[i - 1] + 0.5 * arr[i] + 0.25 * arr[i + 1];
    }
    out[0] = arr[0];
    out[arr.length - 1] = arr[arr.length - 1];
    return out;
  }

  function argmaxRange(arr, lo, hi) {
    lo = Math.max(0, Math.floor(lo));
    hi = Math.min(arr.length - 1, Math.floor(hi));
    let bestI = lo;
    let bestV = -Infinity;
    for (let i = lo; i <= hi; i++) {
      if (arr[i] > bestV) {
        bestV = arr[i];
        bestI = i;
      }
    }
    return { i: bestI, v: bestV };
  }

  function median(arr, lo, hi) {
    const slice = [];
    for (let i = lo; i <= hi; i++) slice.push(arr[i]);
    slice.sort((a, b) => a - b);
    return slice[Math.floor(slice.length / 2)] || 1;
  }

  /**
   * @param {{width,height,data}} imageData
   * @param {{marginFrac?: number, inkThreshold?: number}} opts
   */
  function detectAxes(imageData, opts) {
    opts = opts || {};
    if (!imageData || !imageData.width || !imageData.height || !imageData.data) {
      return { ok: false, error: "No image data" };
    }

    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const marginFrac = opts.marginFrac != null ? opts.marginFrac : 0.02;
    const inkT = opts.inkThreshold != null ? opts.inkThreshold : 140;
    const mx = Math.max(2, Math.floor(w * marginFrac));
    const my = Math.max(2, Math.floor(h * marginFrac));

    const colInk = new Float64Array(w);
    const rowInk = new Float64Array(h);
    const colEdge = new Float64Array(w);
    const rowEdge = new Float64Array(h);

    for (let y = my + 1; y < h - my - 1; y++) {
      for (let x = mx + 1; x < w - mx - 1; x++) {
        const g = gray(data, w, x, y);
        const gx = Math.abs(gray(data, w, x + 1, y) - gray(data, w, x - 1, y));
        const gy = Math.abs(gray(data, w, x, y + 1) - gray(data, w, x, y - 1));
        if (g < inkT) {
          colInk[x] += 1;
          rowInk[y] += 1;
        }
        colEdge[x] += gy;
        rowEdge[y] += gx;
      }
    }

    // Blend ink density (great for solid axes) with edge energy
    const colScore = new Float64Array(w);
    const rowScore = new Float64Array(h);
    for (let x = 0; x < w; x++) colScore[x] = colInk[x] * 3 + colEdge[x] * 0.02;
    for (let y = 0; y < h; y++) rowScore[y] = rowInk[y] * 3 + rowEdge[y] * 0.02;

    const colS = smooth1d(colScore);
    const rowS = smooth1d(rowScore);

    // Long-line bias: for vertical candidates, count how far a dark column runs in y
    function verticalRunScore(x) {
      let run = 0;
      let best = 0;
      for (let y = my; y < h - my; y++) {
        if (gray(data, w, x, y) < inkT) {
          run++;
          if (run > best) best = run;
        } else run = 0;
      }
      return best;
    }
    function horizontalRunScore(y) {
      let run = 0;
      let best = 0;
      for (let x = mx; x < w - mx; x++) {
        if (gray(data, w, x, y) < inkT) {
          run++;
          if (run > best) best = run;
        } else run = 0;
      }
      return best;
    }

    // Re-score left/right with run length
    for (let x = mx; x < w - mx; x++) {
      colS[x] *= 1 + verticalRunScore(x) / h;
    }
    for (let y = my; y < h - my; y++) {
      rowS[y] *= 1 + horizontalRunScore(y) / w;
    }

    let L = argmaxRange(colS, mx, w * 0.42).i;
    let B = argmaxRange(rowS, h * 0.55, h - my - 1).i;
    let R = argmaxRange(colS, w * 0.55, w - mx - 1).i;
    let T = argmaxRange(rowS, my, h * 0.42).i;

    // Local refine
    L = argmaxRange(colS, Math.max(mx, L - 8), Math.min(Math.floor(w * 0.5), L + 8)).i;
    R = argmaxRange(colS, Math.max(Math.floor(w * 0.5), R - 8), Math.min(w - mx - 1, R + 8)).i;
    B = argmaxRange(rowS, Math.max(Math.floor(h * 0.5), B - 8), Math.min(h - my - 1, B + 8)).i;
    T = argmaxRange(rowS, Math.max(my, T - 8), Math.min(Math.floor(h * 0.5), T + 8)).i;

    if (R <= L + 16 || B <= T + 16) {
      return {
        ok: false,
        error: "Could not find a clear plot frame. Try image prep or place markers manually.",
        box: { left: L, right: R, top: T, bottom: B },
        calibrationPoints: null,
        confidence: 0
      };
    }

    const medC = median(colS, mx, w - mx - 1);
    const medR = median(rowS, my, h - my - 1);
    const confL = colS[L] / (medC + 1e-6);
    const confB = rowS[B] / (medR + 1e-6);
    const confR = colS[R] / (medC + 1e-6);
    const confT = rowS[T] / (medR + 1e-6);
    const confidence = Math.min(
      0.99,
      0.2 + 0.15 * Math.min(confL, 10) / 10 + 0.15 * Math.min(confB, 10) / 10 +
        0.1 * Math.min(confR, 10) / 10 + 0.1 * Math.min(confT, 10) / 10
    );

    const inset = Math.max(1, Math.round(Math.min(w, h) * 0.006));
    const calibrationPoints = {
      x1: { px: L + inset, py: B - inset },
      x2: { px: R - inset, py: B - inset },
      y1: { px: L + inset, py: B - inset },
      y2: { px: L + inset, py: T + inset }
    };

    return {
      ok: true,
      box: { left: L, right: R, top: T, bottom: B },
      calibrationPoints,
      confidence,
      diagnostics: {
        scores: { left: confL, right: confR, top: confT, bottom: confB },
        size: { w, h }
      }
    };
  }

  return { detectAxes };
});
