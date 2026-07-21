/**
 * Curve autotrace: follow pixels matching a sample color inside the mask.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.curve = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function colorDist(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function isMatch(data, i, sample, tol) {
    return colorDist(data[i], data[i + 1], data[i + 2], sample[0], sample[1], sample[2]) <= tol
      && data[i + 3] > 20;
  }

  function maskOk(mask, x, y, w) {
    if (!mask) return true;
    return mask.data[y * w + x] > 127;
  }

  /**
   * @param {object} ctx
   *  imageData: {width,height,data}
   *  mask: optional PlotMask
   *  sampleRgb: [r,g,b]
   *  tolerance: 0-255 (default 40)
   *  maxPoints: default 500
   */
  function detect(ctx) {
    const img = ctx.imageData;
    if (!img || !ctx.sampleRgb) return { series: [], error: "Need image and sample color" };
    const w = img.width, h = img.height, data = img.data;
    const sample = ctx.sampleRgb;
    const tol = ctx.tolerance != null ? ctx.tolerance : 40;
    const mask = ctx.mask;
    const maxPoints = ctx.maxPoints || 500;

    // Collect matching pixels
    const match = new Uint8Array(w * h);
    let count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!maskOk(mask, x, y, w)) continue;
        const i = (y * w + x) * 4;
        if (isMatch(data, i, sample, tol)) {
          match[y * w + x] = 1;
          count++;
        }
      }
    }
    if (count < 5) return { series: [], error: "No matching pixels — adjust color or tolerance" };

    // Column-wise median y of matches → ordered curve left-to-right
    const pts = [];
    for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let y = 0; y < h; y++) {
        if (match[y * w + x]) { sum += y; n++; }
      }
      if (n > 0) pts.push({ px: x, py: sum / n });
    }
    if (pts.length < 2) return { series: [], error: "Could not form a curve" };

    // Downsample
    const step = Math.max(1, Math.ceil(pts.length / maxPoints));
    const out = [];
    for (let i = 0; i < pts.length; i += step) {
      out.push({ px: Math.round(pts[i].px), py: Math.round(pts[i].py), role: "curve" });
    }
    if (out[out.length - 1] !== pts[pts.length - 1]) {
      const last = pts[pts.length - 1];
      out.push({ px: Math.round(last.px), py: Math.round(last.py), role: "curve" });
    }

    return {
      series: [{ points: out, meta: { detector: "curve", matchedPixels: count } }]
    };
  }

  return { id: "curve", name: "Curve (color follow)", detect };
});
