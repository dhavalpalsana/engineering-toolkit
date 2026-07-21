/**
 * Detector registry — browser loads individual scripts first; Node requires them.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./curve.js"),
      require("./cluster.js"),
      require("./bar.js"),
      require("./edge.js"),
      require("./centroid.js"),
      require("./skeleton.js"),
      require("./histogram.js")
    );
  } else {
    root.PlotDetectorRegistry = factory(
      root.PlotDetectors && root.PlotDetectors.curve,
      root.PlotDetectors && root.PlotDetectors.cluster,
      root.PlotDetectors && root.PlotDetectors.bar,
      root.PlotDetectors && root.PlotDetectors.edge,
      root.PlotDetectors && root.PlotDetectors.centroid,
      root.PlotDetectors && root.PlotDetectors.skeleton,
      root.PlotDetectors && root.PlotDetectors.histogram
    );
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (curve, cluster, bar, edge, centroid, skeleton, histogram) {
  "use strict";

  const list = [curve, cluster, bar, edge, centroid, skeleton, histogram].filter(Boolean);
  const byId = {};
  list.forEach((d) => { byId[d.id] = d; });

  function get(id) { return byId[id] || null; }
  function all() { return list.slice(); }
  function run(id, ctx) {
    const d = get(id);
    if (!d) return { series: [], error: "Unknown detector: " + id };
    return d.detect(ctx);
  }

  return { get, all, run, byId };
});
