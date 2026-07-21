/**
 * Simplified skeleton: morphological thinning of color-matched region → polyline.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.skeleton = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function detect(ctx) {
    const img = ctx.imageData;
    if (!img || !ctx.sampleRgb) return { series: [], error: "Need image and sample color" };
    const w = img.width, h = img.height, data = img.data;
    const sample = ctx.sampleRgb;
    const tol = ctx.tolerance != null ? ctx.tolerance : 40;
    const mask = ctx.mask;
    const bin = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask && mask.data[y * w + x] <= 127) continue;
        const i = (y * w + x) * 4;
        const dr = data[i] - sample[0], dg = data[i + 1] - sample[1], db = data[i + 2] - sample[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= tol) bin[y * w + x] = 1;
      }
    }

    // Zhang-Suen-like single-pass local thinning iterations (bounded)
    function neighbors(x, y) {
      const n = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          n.push(nx >= 0 && ny >= 0 && nx < w && ny < h ? bin[ny * w + nx] : 0);
        }
      }
      return n; // 8-neighbors: order not strict for simplified thin
    }

    for (let iter = 0; iter < 12; iter++) {
      const toClear = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!bin[y * w + x]) continue;
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              sum += bin[(y + dy) * w + (x + dx)];
            }
          }
          // Endpoint or thin: remove if too many neighbors (boundary)
          if (sum >= 3 && sum <= 6) toClear.push(y * w + x);
        }
      }
      if (!toClear.length) break;
      for (const i of toClear) bin[i] = 0;
    }

    // Column median of remaining
    const pts = [];
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let y = 0; y < h; y++) {
        if (bin[y * w + x]) { s += y; n++; }
      }
      if (n) pts.push({ px: x, py: Math.round(s / n), role: "skeleton" });
    }
    if (pts.length < 2) return { series: [], error: "Skeleton too thin / empty" };
    const step = Math.max(1, Math.ceil(pts.length / 400));
    const out = [];
    for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
    return { series: [{ points: out, meta: { detector: "skeleton" } }] };
  }

  return { id: "skeleton", name: "Skeleton", detect };
});
