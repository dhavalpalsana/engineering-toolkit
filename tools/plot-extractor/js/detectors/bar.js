/**
 * Bar top detector: for each x-band, find topmost matching color run.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.bar = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function colorDist(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function detect(ctx) {
    const img = ctx.imageData;
    if (!img || !ctx.sampleRgb) return { series: [], error: "Need image and sample color" };
    const w = img.width, h = img.height, data = img.data;
    const sample = ctx.sampleRgb;
    const tol = ctx.tolerance != null ? ctx.tolerance : 40;
    const mask = ctx.mask;
    const band = Math.max(2, ctx.bandWidth || Math.floor(w / 40));

    const points = [];
    for (let x0 = 0; x0 < w; x0 += band) {
      let topY = h, found = false, sumX = 0, n = 0;
      for (let x = x0; x < Math.min(w, x0 + band); x++) {
        for (let y = 0; y < h; y++) {
          if (mask && mask.data[y * w + x] <= 127) continue;
          const i = (y * w + x) * 4;
          if (colorDist(data[i], data[i + 1], data[i + 2], sample[0], sample[1], sample[2]) <= tol
            && data[i + 3] > 20) {
            if (y < topY) topY = y;
            sumX += x; n++;
            found = true;
            break; // topmost in this column
          }
        }
      }
      if (found && n > 0) {
        points.push({
          px: Math.round(sumX / n),
          py: topY,
          role: "bar",
          label: "Bar " + (points.length + 1)
        });
      }
    }
    // Merge nearby bars
    const merged = [];
    for (const p of points) {
      const prev = merged[merged.length - 1];
      if (prev && Math.abs(prev.px - p.px) < band * 0.6) {
        if (p.py < prev.py) { prev.py = p.py; prev.px = p.px; }
      } else merged.push(p);
    }
    merged.forEach((p, i) => { p.label = "Bar " + (i + 1); });
    if (!merged.length) return { series: [], error: "No bars found" };
    return { series: [{ points: merged, meta: { detector: "bar", count: merged.length } }] };
  }

  return { id: "bar", name: "Bar tops (auto)", detect };
});
