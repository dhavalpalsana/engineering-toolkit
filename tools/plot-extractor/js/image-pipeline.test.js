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
});
