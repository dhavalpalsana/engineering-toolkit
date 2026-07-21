/**
 * Simple Sobel edge sampling along mask — returns polyline of strong edges.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.edge = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function grayAt(data, w, h, x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function detect(ctx) {
    const img = ctx.imageData;
    if (!img) return { series: [], error: "Need image" };
    const w = img.width, h = img.height, data = img.data;
    const mask = ctx.mask;
    const thr = ctx.edgeThreshold != null ? ctx.edgeThreshold : 40;
    const maxPoints = ctx.maxPoints || 400;

    const pts = [];
    for (let x = 1; x < w - 1; x++) {
      let bestY = -1, bestG = thr;
      for (let y = 1; y < h - 1; y++) {
        if (mask && mask.data[y * w + x] <= 127) continue;
        const gx =
          -grayAt(data, w, h, x - 1, y - 1) + grayAt(data, w, h, x + 1, y - 1) +
          -2 * grayAt(data, w, h, x - 1, y) + 2 * grayAt(data, w, h, x + 1, y) +
          -grayAt(data, w, h, x - 1, y + 1) + grayAt(data, w, h, x + 1, y + 1);
        const gy =
          -grayAt(data, w, h, x - 1, y - 1) - 2 * grayAt(data, w, h, x, y - 1) - grayAt(data, w, h, x + 1, y - 1) +
          grayAt(data, w, h, x - 1, y + 1) + 2 * grayAt(data, w, h, x, y + 1) + grayAt(data, w, h, x + 1, y + 1);
        const g = Math.hypot(gx, gy);
        if (g > bestG) { bestG = g; bestY = y; }
      }
      if (bestY >= 0) pts.push({ px: x, py: bestY, role: "edge" });
    }
    if (pts.length < 2) return { series: [], error: "No strong edges" };
    const step = Math.max(1, Math.ceil(pts.length / maxPoints));
    const out = [];
    for (let i = 0; i < pts.length; i += step) {
      out.push({ px: pts[i].px, py: pts[i].py, role: "edge" });
    }
    return { series: [{ points: out, meta: { detector: "edge" } }] };
  }

  return { id: "edge", name: "Edge (Sobel)", detect };
});
