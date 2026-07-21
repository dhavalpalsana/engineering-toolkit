/**
 * Centroid of all mask-included matching pixels (single blob).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.centroid = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function detect(ctx) {
    const img = ctx.imageData;
    if (!img) return { series: [], error: "Need image" };
    const w = img.width, h = img.height, data = img.data;
    const mask = ctx.mask;
    const sample = ctx.sampleRgb;
    const tol = ctx.tolerance != null ? ctx.tolerance : 50;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask && mask.data[y * w + x] <= 127) continue;
        const i = (y * w + x) * 4;
        if (sample) {
          const dr = data[i] - sample[0], dg = data[i + 1] - sample[1], db = data[i + 2] - sample[2];
          if (Math.sqrt(dr * dr + dg * dg + db * db) > tol) continue;
        } else if (data[i + 3] < 20) continue;
        sx += x; sy += y; n++;
      }
    }
    if (n < 1) return { series: [], error: "No pixels for centroid" };
    return {
      series: [{
        points: [{ px: Math.round(sx / n), py: Math.round(sy / n), role: "centroid", label: "Centroid" }],
        meta: { detector: "centroid", n }
      }]
    };
  }

  return { id: "centroid", name: "Centroid", detect };
});
