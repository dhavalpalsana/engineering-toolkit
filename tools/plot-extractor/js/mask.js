/**
 * Binary mask layer for autotrace (0 = exclude, 255 = include).
 * Browser + Node (UMD).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlotMask = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(width, height, fill) {
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    const data = new Uint8Array(w * h);
    if (fill) data.fill(fill === true ? 255 : fill);
    return { width: w, height: h, data };
  }

  function clone(mask) {
    return { width: mask.width, height: mask.height, data: new Uint8Array(mask.data) };
  }

  function idx(mask, x, y) {
    return y * mask.width + x;
  }

  function inBounds(mask, x, y) {
    return x >= 0 && y >= 0 && x < mask.width && y < mask.height;
  }

  function setPixel(mask, x, y, value) {
    x = x | 0; y = y | 0;
    if (!inBounds(mask, x, y)) return;
    mask.data[idx(mask, x, y)] = value ? 255 : 0;
  }

  function getPixel(mask, x, y) {
    x = x | 0; y = y | 0;
    if (!inBounds(mask, x, y)) return 0;
    return mask.data[idx(mask, x, y)];
  }

  /** Fill axis-aligned box. mode: 'add' | 'erase' */
  function box(mask, x0, y0, x1, y1, mode) {
    const left = Math.max(0, Math.min(mask.width - 1, Math.floor(Math.min(x0, x1))));
    const right = Math.max(0, Math.min(mask.width - 1, Math.floor(Math.max(x0, x1))));
    const top = Math.max(0, Math.min(mask.height - 1, Math.floor(Math.min(y0, y1))));
    const bottom = Math.max(0, Math.min(mask.height - 1, Math.floor(Math.max(y0, y1))));
    const v = mode === "erase" ? 0 : 255;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        mask.data[idx(mask, x, y)] = v;
      }
    }
  }

  /** Circular brush. */
  function brush(mask, cx, cy, radius, mode) {
    const r = Math.max(1, radius | 0);
    const v = mode === "erase" ? 0 : 255;
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!inBounds(mask, x, y)) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) mask.data[idx(mask, x, y)] = v;
      }
    }
  }

  function clear(mask, includeAll) {
    mask.data.fill(includeAll ? 255 : 0);
  }

  function isIncluded(mask, x, y) {
    if (!mask) return true;
    return getPixel(mask, x, y) > 127;
  }

  /** Serialize to compact base64 of raw bytes (for project save). */
  function toBase64(mask) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(mask.data).toString("base64");
    }
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < mask.data.length; i += chunk) {
      s += String.fromCharCode.apply(null, mask.data.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  function fromBase64(width, height, b64) {
    const mask = create(width, height, 0);
    let bytes;
    if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(b64, "base64");
    } else {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    }
    mask.data.set(bytes.subarray(0, mask.data.length));
    return mask;
  }

  return {
    create, clone, setPixel, getPixel, box, brush, clear, isIncluded, toBase64, fromBase64, inBounds
  };
});
