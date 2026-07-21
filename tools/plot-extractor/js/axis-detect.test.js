/**
 * Golden tests for auto axis geometry detection.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const A = require("./axis-detect.js");

/** Synthetic plot: white field, dark L-shaped axes. */
function makeAxisImage(w, h, left, bottom, right, top) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = 245;
    data[i + 3] = 255;
  }
  function ink(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 20;
  }
  // axes thickness 2
  for (let x = left; x <= right; x++) {
    ink(x, bottom);
    ink(x, bottom - 1);
  }
  for (let y = top; y <= bottom; y++) {
    ink(left, y);
    ink(left + 1, y);
  }
  // top and right frame
  for (let x = left; x <= right; x++) {
    ink(x, top);
  }
  for (let y = top; y <= bottom; y++) {
    ink(right, y);
  }
  // a fake curve so content exists
  for (let x = left + 10; x < right - 10; x++) {
    const yy = bottom - 20 - Math.floor(15 * Math.sin(x / 8));
    ink(x, yy);
  }
  return { width: w, height: h, data };
}

describe("detectAxes", () => {
  it("finds L-frame near expected corners", () => {
    const left = 40, bottom = 160, right = 200, top = 30;
    const img = makeAxisImage(240, 180, left, bottom, right, top);
    const r = A.detectAxes(img);
    assert.equal(r.ok, true, r.error);
    assert.ok(Math.abs(r.box.left - left) <= 4, "left " + r.box.left);
    assert.ok(Math.abs(r.box.bottom - bottom) <= 4, "bottom " + r.box.bottom);
    assert.ok(Math.abs(r.box.right - right) <= 6, "right " + r.box.right);
    assert.ok(Math.abs(r.box.top - top) <= 6, "top " + r.box.top);
    assert.ok(r.calibrationPoints.x1.px < r.calibrationPoints.x2.px);
    assert.ok(r.calibrationPoints.y2.py < r.calibrationPoints.y1.py);
  });

  it("rejects empty image gracefully", () => {
    const r = A.detectAxes(null);
    assert.equal(r.ok, false);
  });
});
