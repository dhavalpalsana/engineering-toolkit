/**
 * Graph-type projections: XY, polar, ternary, pie, map (linear + mercator).
 * Browser + Node (UMD).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./plot-math.js"));
  else root.PlotProjection = factory(root.PlotMath);
})(typeof globalThis !== "undefined" ? globalThis : this, function (PlotMath) {
  "use strict";

  const PM = PlotMath || {};

  function deg2rad(d) { return (d * Math.PI) / 180; }
  function rad2deg(r) { return (r * 180) / Math.PI; }

  /** Mercator: lat/lon degrees → web mercator meters (EPSG:3857-ish). */
  function lonLatToMercator(lon, lat) {
    const x = (lon * 20037508.34) / 180;
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return { x, y };
  }

  function mercatorToLonLat(x, y) {
    const lon = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
    return { lon, lat };
  }

  /**
   * XY (cartesian) using PlotMath scales.
   * cal: {x1,x2,y1,y2}, scales: {x,y}, values: {x1Val,x2Val,y1Val,y2Val}
   */
  function xyPixelToData(px, py, ctx) {
    return PM.pixelToMath({
      px, py,
      cal: ctx.cal,
      scaleX: ctx.scales.x,
      scaleY: ctx.scales.y,
      x1Val: ctx.values.x1Val,
      x2Val: ctx.values.x2Val,
      y1Val: ctx.values.y1Val,
      y2Val: ctx.values.y2Val
    });
  }

  function xyDataToPixel(data, ctx) {
    return PM.mathToPixel({
      x: data.x, y: data.y,
      cal: ctx.cal,
      scaleX: ctx.scales.x,
      scaleY: ctx.scales.y,
      x1Val: ctx.values.x1Val,
      x2Val: ctx.values.x2Val,
      y1Val: ctx.values.y1Val,
      y2Val: ctx.values.y2Val
    });
  }

  /**
   * Polar: cal.origin {px,py}, cal.rMax {px,py} (point at max radius on 0° ray),
   * values: { rMax, theta0Deg } — theta measured CCW from +x image (right).
   */
  function polarPixelToData(px, py, ctx) {
    const o = ctx.cal.origin || ctx.cal.x1;
    const rMaxPt = ctx.cal.rMax || ctx.cal.x2;
    const dx0 = rMaxPt.px - o.px;
    const dy0 = rMaxPt.py - o.py;
    const rMaxPx = Math.hypot(dx0, dy0) || 1;
    const rMax = Number(ctx.values.rMax) || 1;
    const theta0 = deg2rad(Number(ctx.values.theta0Deg) || 0);
    const dx = px - o.px;
    const dy = -(py - o.py); // image y down → math y up
    const rPx = Math.hypot(dx, dy);
    let th = Math.atan2(dy, dx) - theta0;
    while (th < 0) th += Math.PI * 2;
    while (th >= Math.PI * 2) th -= Math.PI * 2;
    const r = (rPx / rMaxPx) * rMax;
    return {
      r,
      theta: rad2deg(th),
      thetaRad: th,
      x: r * Math.cos(th + theta0),
      y: r * Math.sin(th + theta0)
    };
  }

  function polarDataToPixel(data, ctx) {
    const o = ctx.cal.origin || ctx.cal.x1;
    const rMaxPt = ctx.cal.rMax || ctx.cal.x2;
    const rMaxPx = Math.hypot(rMaxPt.px - o.px, rMaxPt.py - o.py) || 1;
    const rMax = Number(ctx.values.rMax) || 1;
    const theta0 = deg2rad(Number(ctx.values.theta0Deg) || 0);
    const r = data.r != null ? data.r : Math.hypot(data.x || 0, data.y || 0);
    const th = data.thetaRad != null
      ? data.thetaRad
      : deg2rad(data.theta != null ? data.theta : 0);
    const ang = th + theta0;
    const rPx = (r / rMax) * rMaxPx;
    return {
      px: o.px + rPx * Math.cos(ang),
      py: o.py - rPx * Math.sin(ang)
    };
  }

  /**
   * Ternary: vertices A,B,C in pixel space; data a,b,c with a+b+c=1.
   */
  function ternaryPixelToData(px, py, ctx) {
    const A = ctx.cal.A || ctx.cal.x1;
    const B = ctx.cal.B || ctx.cal.x2;
    const C = ctx.cal.C || ctx.cal.y2;
    // Barycentric
    const v0x = B.px - A.px, v0y = B.py - A.py;
    const v1x = C.px - A.px, v1y = C.py - A.py;
    const v2x = px - A.px, v2y = py - A.py;
    const den = v0x * v1y - v1x * v0y;
    if (Math.abs(den) < 1e-12) return { a: NaN, b: NaN, c: NaN };
    const b = (v2x * v1y - v1x * v2y) / den;
    const c = (v0x * v2y - v2x * v0y) / den;
    const a = 1 - b - c;
    return { a, b, c, x: b, y: c };
  }

  function ternaryDataToPixel(data, ctx) {
    const A = ctx.cal.A || ctx.cal.x1;
    const B = ctx.cal.B || ctx.cal.x2;
    const C = ctx.cal.C || ctx.cal.y2;
    let a = data.a, b = data.b, c = data.c;
    const sum = a + b + c;
    if (sum && Math.abs(sum - 1) > 1e-6) {
      a /= sum; b /= sum; c /= sum;
    }
    return {
      px: a * A.px + b * B.px + c * C.px,
      py: a * A.py + b * B.py + c * C.py
    };
  }

  /**
   * Pie: center + radius point; angle from startDeg CCW → fraction 0..1 of circle.
   * Point on arc: returns theta and optional value if values.total set.
   */
  function piePixelToData(px, py, ctx) {
    const o = ctx.cal.origin || ctx.cal.x1;
    const rim = ctx.cal.rim || ctx.cal.x2;
    const start = deg2rad(Number(ctx.values.startDeg) || 0);
    const dx = px - o.px;
    const dy = -(py - o.py);
    let th = Math.atan2(dy, dx) - start;
    while (th < 0) th += Math.PI * 2;
    while (th >= Math.PI * 2) th -= Math.PI * 2;
    const frac = th / (Math.PI * 2);
    const total = Number(ctx.values.total) || 100;
    return {
      theta: rad2deg(th),
      fraction: frac,
      percent: frac * 100,
      value: frac * total,
      r: Math.hypot(dx, dy) / (Math.hypot(rim.px - o.px, rim.py - o.py) || 1)
    };
  }

  /**
   * Map linear: control points map pixel ↔ lon/lat via affine from 2 points on each axis
   * using same cal as XY with scales lat/lon.
   */
  function mapPixelToData(px, py, ctx) {
    const d = xyPixelToData(px, py, {
      cal: ctx.cal,
      scales: { x: ctx.scales.x || "lon", y: ctx.scales.y || "lat" },
      values: ctx.values
    });
    const lon = d.x, lat = d.y;
    if (ctx.mapProjection === "mercator") {
      const m = lonLatToMercator(lon, lat);
      return { lon, lat, x: m.x, y: m.y };
    }
    return { lon, lat, x: lon, y: lat };
  }

  function mapDataToPixel(data, ctx) {
    let lon = data.lon != null ? data.lon : data.x;
    let lat = data.lat != null ? data.lat : data.y;
    if (ctx.mapProjection === "mercator" && data.x != null && data.lon == null) {
      const ll = mercatorToLonLat(data.x, data.y);
      lon = ll.lon; lat = ll.lat;
    }
    return xyDataToPixel({ x: lon, y: lat }, {
      cal: ctx.cal,
      scales: { x: ctx.scales.x || "lon", y: ctx.scales.y || "lat" },
      values: ctx.values
    });
  }

  function pixelToData(kind, px, py, ctx) {
    switch (kind) {
      case "polar": return polarPixelToData(px, py, ctx);
      case "ternary": return ternaryPixelToData(px, py, ctx);
      case "pie": return piePixelToData(px, py, ctx);
      case "map": return mapPixelToData(px, py, ctx);
      case "bar":
      case "histogram":
      case "discrete":
      case "continuous":
      case "xy":
      case "measure":
      default:
        return xyPixelToData(px, py, ctx);
    }
  }

  function dataToPixel(kind, data, ctx) {
    switch (kind) {
      case "polar": return polarDataToPixel(data, ctx);
      case "ternary": return ternaryDataToPixel(data, ctx);
      case "map": return mapDataToPixel(data, ctx);
      default:
        return xyDataToPixel(data, ctx);
    }
  }

  /** Distance between two data points (XY plane). */
  function distanceXY(a, b) {
    return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
  }

  /** Angle at B for points A-B-C in degrees. */
  function angleABC(a, b, c) {
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (d < 1e-15) return NaN;
    let cos = (v1x * v2x + v1y * v2y) / d;
    cos = Math.max(-1, Math.min(1, cos));
    return rad2deg(Math.acos(cos));
  }

  /** Polygon area (shoelace) for points [{x,y},...]. */
  function polygonArea(pts) {
    if (!pts || pts.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(s) / 2;
  }

  return {
    lonLatToMercator,
    mercatorToLonLat,
    xyPixelToData,
    xyDataToPixel,
    polarPixelToData,
    polarDataToPixel,
    ternaryPixelToData,
    ternaryDataToPixel,
    piePixelToData,
    mapPixelToData,
    mapDataToPixel,
    pixelToData,
    dataToPixel,
    distanceXY,
    angleABC,
    polygonArea,
    deg2rad,
    rad2deg
  };
});
