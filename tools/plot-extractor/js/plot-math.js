/**
 * Plot digitizer pure helpers — scales, time, discrete labels.
 * Browser + Node (UMD).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlotMath = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const UNIT_TO_SECONDS = {
    ms: 0.001, s: 1, sec: 1, secs: 1,
    min: 60, mins: 60, m: 60,
    h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600
  };

  const SCALE_TYPES = ["linear", "log", "ln", "reciprocal", "time", "lat", "lon"];

  function parseTimeToSeconds(raw, defaultUnit) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const normalized = s.includes("T") ? s : s.replace(" ", "T");
      const ms = Date.parse(normalized);
      if (!Number.isFinite(ms)) return null;
      return { seconds: ms / 1000, absolute: true };
    }
    const clock = s.match(/^(\d+):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/);
    if (clock) {
      const a = parseFloat(clock[1]), b = parseFloat(clock[2]);
      const c = clock[3] != null ? parseFloat(clock[3]) : null;
      if (c != null) return { seconds: a * 3600 + b * 60 + c, absolute: false };
      return { seconds: a * 60 + b, absolute: false };
    }
    const withUnit = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z]+)?$/);
    if (withUnit) {
      const n = parseFloat(withUnit[1]);
      if (!Number.isFinite(n)) return null;
      const u = (withUnit[2] || defaultUnit || "s").toLowerCase();
      const factor = UNIT_TO_SECONDS[u];
      if (factor == null) return null;
      return { seconds: n * factor, absolute: false };
    }
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    const factor = UNIT_TO_SECONDS[(defaultUnit || "s").toLowerCase()] || 1;
    return { seconds: n * factor, absolute: false };
  }

  function formatElapsed(seconds, unit) {
    const factor = UNIT_TO_SECONDS[(unit || "s").toLowerCase()] || 1;
    const v = seconds / factor;
    if (!Number.isFinite(v)) return "—";
    if (v === 0) return "0";
    const abs = Math.abs(v);
    if (abs >= 1000 || abs < 0.001) return v.toExponential(4);
    return parseFloat(v.toPrecision(8)).toString();
  }

  function formatAbsolute(seconds) {
    if (!Number.isFinite(seconds)) return "—";
    try {
      return new Date(seconds * 1000).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
    } catch (_) {
      return String(seconds);
    }
  }

  /** Map data value through axis scale type → normalized linear space for interpolation. */
  function toLinearSpace(value, scaleType) {
    const t = scaleType || "linear";
    const v = Number(value);
    if (!Number.isFinite(v)) return NaN;
    if (t === "log") {
      if (v <= 0) return NaN;
      return Math.log10(v);
    }
    if (t === "ln") {
      if (v <= 0) return NaN;
      return Math.log(v);
    }
    if (t === "reciprocal") {
      if (v === 0) return NaN;
      return 1 / v;
    }
    // linear, time, lat, lon — identity
    return v;
  }

  function fromLinearSpace(lin, scaleType) {
    const t = scaleType || "linear";
    if (!Number.isFinite(lin)) return NaN;
    if (t === "log") return Math.pow(10, lin);
    if (t === "ln") return Math.exp(lin);
    if (t === "reciprocal") {
      if (lin === 0) return NaN;
      return 1 / lin;
    }
    return lin;
  }

  /**
   * Interpolate pixel → data for one axis (fraction along cal points).
   */
  function axisPixelToData(frac, v1, v2, scaleType) {
    const a = toLinearSpace(v1, scaleType);
    const b = toLinearSpace(v2, scaleType);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    return fromLinearSpace(a + frac * (b - a), scaleType);
  }

  function axisDataToFrac(value, v1, v2, scaleType) {
    const a = toLinearSpace(v1, scaleType);
    const b = toLinearSpace(v2, scaleType);
    const x = toLinearSpace(value, scaleType);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(x)) return NaN;
    const den = b - a;
    return den === 0 ? 0 : (x - a) / den;
  }

  function pixelToMath(opts) {
    const cal = opts.cal;
    const scaleX = opts.scaleX || "linear";
    const scaleY = opts.scaleY || "linear";
    const x1Val = Number(opts.x1Val);
    const x2Val = Number(opts.x2Val);
    const y1Val = Number(opts.y1Val);
    const y2Val = Number(opts.y2Val);
    const fracX = (opts.px - cal.x1.px) / (cal.x2.px - cal.x1.px || 1);
    const fracY = (opts.py - cal.y1.py) / (cal.y2.py - cal.y1.py || 1);
    return {
      x: axisPixelToData(fracX, x1Val, x2Val, scaleX === "time" ? "linear" : scaleX),
      y: axisPixelToData(fracY, y1Val, y2Val, scaleY)
    };
  }

  function mathToPixel(opts) {
    const cal = opts.cal;
    const scaleX = opts.scaleX || "linear";
    const scaleY = opts.scaleY || "linear";
    const fracX = axisDataToFrac(opts.x, opts.x1Val, opts.x2Val, scaleX === "time" ? "linear" : scaleX);
    const fracY = axisDataToFrac(opts.y, opts.y1Val, opts.y2Val, scaleY);
    return {
      px: cal.x1.px + fracX * (cal.x2.px - cal.x1.px),
      py: cal.y1.py + fracY * (cal.y2.py - cal.y1.py)
    };
  }

  function defaultBarLabel(index) {
    return "Bar " + (index + 1);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  return {
    UNIT_TO_SECONDS,
    SCALE_TYPES,
    parseTimeToSeconds,
    formatElapsed,
    formatAbsolute,
    toLinearSpace,
    fromLinearSpace,
    axisPixelToData,
    axisDataToFrac,
    pixelToMath,
    mathToPixel,
    defaultBarLabel,
    clamp
  };
});
