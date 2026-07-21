const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const curve = require("./curve.js");

function lineImage() {
  const w = 40, h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  // red horizontal line at y=10
  for (let x = 5; x < 35; x++) {
    const i = (10 * w + x) * 4;
    data[i] = 220; data[i + 1] = 30; data[i + 2] = 30; data[i + 3] = 255;
  }
  // fill rest dark
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = data[i + 1] = data[i + 2] = 20;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

describe("curve detector", () => {
  it("finds red line", () => {
    const r = curve.detect({
      imageData: lineImage(),
      sampleRgb: [220, 30, 30],
      tolerance: 50,
      maxPoints: 50
    });
    assert.ok(!r.error, r.error);
    assert.ok(r.series[0].points.length >= 5);
  });
});
