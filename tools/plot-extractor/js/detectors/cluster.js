/**
 * Point/cluster detection: connected components of color matches → centroids.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.cluster = factory();
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
    const tol = ctx.tolerance != null ? ctx.tolerance : 35;
    const minSize = ctx.minClusterSize != null ? ctx.minClusterSize : 8;
    const mask = ctx.mask;
    const visited = new Uint8Array(w * h);
    const points = [];

    function ok(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      if (visited[y * w + x]) return false;
      if (mask && mask.data[y * w + x] <= 127) return false;
      const i = (y * w + x) * 4;
      return colorDist(data[i], data[i + 1], data[i + 2], sample[0], sample[1], sample[2]) <= tol
        && data[i + 3] > 20;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!ok(x, y)) continue;
        // BFS
        const q = [[x, y]];
        visited[y * w + x] = 1;
        let sx = 0, sy = 0, n = 0;
        while (q.length) {
          const [cx, cy] = q.pop();
          sx += cx; sy += cy; n++;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = cx + dx, ny = cy + dy;
              if (ok(nx, ny)) {
                visited[ny * w + nx] = 1;
                q.push([nx, ny]);
              }
            }
          }
        }
        if (n >= minSize) {
          points.push({
            px: Math.round(sx / n),
            py: Math.round(sy / n),
            role: "cluster",
            label: "P" + (points.length + 1)
          });
        }
      }
    }
    points.sort((a, b) => a.px - b.px || a.py - b.py);
    if (!points.length) return { series: [], error: "No clusters found" };
    return { series: [{ points, meta: { detector: "cluster", count: points.length } }] };
  }

  return { id: "cluster", name: "Points / cluster", detect };
});
