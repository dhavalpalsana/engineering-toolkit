const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const I = require("./image-pipeline.js");

function solid(w, h, r, g, b) {
  const img = I.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  return img;
}

describe("image pipeline", () => {
  it("crop size", () => {
    const src = solid(10, 10, 255, 0, 0);
    const { image, offset } = I.crop(src, 2, 2, 7, 7);
    assert.equal(image.width, 5);
    assert.equal(image.height, 5);
    assert.equal(offset.x, 2);
  });
  it("flipH maps corner", () => {
    const src = solid(4, 2, 0, 0, 0);
    src.data[0] = 11; // (0,0) R
    const out = I.flipH(src);
    assert.equal(out.data[(0 * 4 + 3) * 4], 11);
  });
  it("rotate90 changes dims", () => {
    const src = solid(3, 5, 1, 2, 3);
    const out = I.rotate90(src, 1);
    assert.equal(out.width, 5);
    assert.equal(out.height, 3);
  });
  it("grayscale", () => {
    const src = solid(2, 2, 255, 0, 0);
    const g = I.grayscale(src);
    assert.ok(g.data[0] > 50 && g.data[0] === g.data[1]);
  });

  it("fillBackground composites transparent onto white", () => {
    const src = I.createImageData(2, 1);
    // pixel 0: red semi-transparent
    src.data[0] = 255; src.data[1] = 0; src.data[2] = 0; src.data[3] = 128;
    // pixel 1: fully transparent
    src.data[4] = 0; src.data[5] = 0; src.data[6] = 0; src.data[7] = 0;
    const out = I.fillBackground(src, { r: 255, g: 255, b: 255 }, { mode: "transparent" });
    assert.equal(out.data[3], 255);
    assert.equal(out.data[7], 255);
    // fully transparent → pure white
    assert.equal(out.data[4], 255);
    assert.equal(out.data[5], 255);
    assert.equal(out.data[6], 255);
  });
});
