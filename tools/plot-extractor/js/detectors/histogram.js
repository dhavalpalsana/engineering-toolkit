/**
 * Histogram detector: treat vertical bars of a sample color as bins.
 * Reuses bar logic with denser bands.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./bar.js"));
  } else {
    root.PlotDetectors = root.PlotDetectors || {};
    root.PlotDetectors.histogram = factory(root.PlotDetectors.bar);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (barDet) {
  "use strict";

  function detect(ctx) {
    const r = barDet.detect({
      ...ctx,
      bandWidth: ctx.bandWidth || Math.max(2, Math.floor((ctx.imageData && ctx.imageData.width) / 60))
    });
    if (r.error) return r;
    r.series.forEach((s) => {
      s.meta = { ...(s.meta || {}), detector: "histogram" };
      s.points.forEach((p, i) => {
        p.role = "histogram";
        p.label = p.label || ("Bin " + (i + 1));
      });
    });
    return r;
  }

  return { id: "histogram", name: "Histogram bins", detect };
});
