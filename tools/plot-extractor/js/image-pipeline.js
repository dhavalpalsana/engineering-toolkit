/**
 * Image pipeline: crop, rotate, flip, scale, filters on ImageData / canvas.
 * Browser + Node (UMD). Node uses pure buffer ops where ImageData is polyfilled.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlotImagePipeline = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createImageData(w, h, data) {
    if (typeof ImageData !== "undefined") {
      try {
        return data ? new ImageData(new Uint8ClampedArray(data), w, h) : new ImageData(w, h);
      } catch (_) { /* fall through */ }
    }
    return {
      width: w,
      height: h,
      data: data ? new Uint8ClampedArray(data) : new Uint8ClampedArray(w * h * 4)
    };
  }

  function cloneImageData(src) {
    return createImageData(src.width, src.height, src.data);
  }

  /** Crop axis-aligned rect (inclusive min, exclusive max in px). */
  function crop(src, x0, y0, x1, y1) {
    const left = Math.max(0, Math.min(src.width, Math.floor(Math.min(x0, x1))));
    const right = Math.max(0, Math.min(src.width, Math.ceil(Math.max(x0, x1))));
    const top = Math.max(0, Math.min(src.height, Math.floor(Math.min(y0, y1))));
    const bottom = Math.max(0, Math.min(src.height, Math.ceil(Math.max(y0, y1))));
    const w = Math.max(1, right - left);
    const h = Math.max(1, bottom - top);
    const out = createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((top + y) * src.width + (left + x)) * 4;
        const di = (y * w + x) * 4;
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    return { image: out, offset: { x: left, y: top } };
  }

  function flipH(src) {
    const out = createImageData(src.width, src.height);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = (y * src.width + (src.width - 1 - x)) * 4;
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    return out;
  }

  function flipV(src) {
    const out = createImageData(src.width, src.height);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = ((src.height - 1 - y) * src.width + x) * 4;
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    return out;
  }

  /** Rotate 90° clockwise n times (n mod 4). */
  function rotate90(src, turns) {
    let img = src;
    let n = ((turns % 4) + 4) % 4;
    while (n--) {
      const w = img.height, h = img.width;
      const out = createImageData(w, h);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const si = (y * img.width + x) * 4;
          const nx = img.height - 1 - y;
          const ny = x;
          const di = (ny * w + nx) * 4;
          out.data[di] = img.data[si];
          out.data[di + 1] = img.data[si + 1];
          out.data[di + 2] = img.data[si + 2];
          out.data[di + 3] = img.data[si + 3];
        }
      }
      img = out;
    }
    return img;
  }

  /** Nearest-neighbor scale. */
  function scaleNearest(src, scale) {
    const s = Math.max(0.1, Math.min(4, Number(scale) || 1));
    const w = Math.max(1, Math.round(src.width * s));
    const h = Math.max(1, Math.round(src.height * s));
    const out = createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const sy = Math.min(src.height - 1, Math.floor(y / s));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(src.width - 1, Math.floor(x / s));
        const si = (sy * src.width + sx) * 4;
        const di = (y * w + x) * 4;
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    return out;
  }

  function grayscale(src) {
    const out = cloneImageData(src);
    for (let i = 0; i < out.data.length; i += 4) {
      const g = 0.299 * out.data[i] + 0.587 * out.data[i + 1] + 0.114 * out.data[i + 2];
      out.data[i] = out.data[i + 1] = out.data[i + 2] = g;
    }
    return out;
  }

  function contrast(src, amount) {
    // amount: -100..100
    const a = Number(amount) || 0;
    const factor = (259 * (a + 255)) / (255 * (259 - a));
    const out = cloneImageData(src);
    for (let i = 0; i < out.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        out.data[i + c] = Math.max(0, Math.min(255, factor * (out.data[i + c] - 128) + 128));
      }
    }
    return out;
  }

  function threshold(src, t) {
    const thr = t == null ? 128 : t;
    const g = grayscale(src);
    for (let i = 0; i < g.data.length; i += 4) {
      const v = g.data[i] >= thr ? 255 : 0;
      g.data[i] = g.data[i + 1] = g.data[i + 2] = v;
    }
    return g;
  }

  /** Box blur radius 1. */
  function blur(src) {
    const out = cloneImageData(src);
    const w = src.width, h = src.height;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += src.data[((y + dy) * w + (x + dx)) * 4 + c];
            }
          }
          out.data[(y * w + x) * 4 + c] = sum / 9;
        }
      }
    }
    return out;
  }

  /** Map a point after crop offset removal, then optional scale. */
  function mapPointAfterCrop(px, py, offset) {
    return { px: px - offset.x, py: py - offset.y };
  }

  function mapPointAfterFlipH(px, py, width) {
    return { px: width - 1 - px, py };
  }

  function mapPointAfterFlipV(px, py, height) {
    return { px, py: height - 1 - py };
  }

  function mapPointAfterRotate90CW(px, py, srcW, srcH) {
    // (x,y) -> (h-1-y, x) when rotating image 90 CW
    return { px: srcH - 1 - py, py: px };
  }

  return {
    createImageData,
    cloneImageData,
    crop,
    flipH,
    flipV,
    rotate90,
    scaleNearest,
    grayscale,
    contrast,
    threshold,
    blur,
    mapPointAfterCrop,
    mapPointAfterFlipH,
    mapPointAfterFlipV,
    mapPointAfterRotate90CW
  };
});
