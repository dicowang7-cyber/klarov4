import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureSubjectPolarity,
  fillMaskHoles,
  keepPrimarySubject,
  maskLooksUseful,
  maskStats,
  toProbMask,
} from "./matte.ts";

function ellipse(
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  value = 1,
) {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x - cx) / rx;
      const v = (y - cy) / ry;
      if (u * u + v * v <= 1) m[y * w + x] = value;
    }
  }
  return m;
}

describe("toProbMask", () => {
  it("applies sigmoid to logits instead of min-max stretching", () => {
    const w = 4;
    const h = 1;
    const values = new Float32Array([-8, -4, 4, 8]);
    const mask = toProbMask(values, w, h);
    assert.ok(mask[0]! < 0.02);
    assert.ok(mask[3]! > 0.98);
    assert.ok(mask[1]! < 0.05);
    assert.ok(mask[2]! > 0.95);
  });

  it("keeps an already-normalized 0-1 matte", () => {
    const values = new Float32Array([0, 0.2, 0.8, 1]);
    const mask = toProbMask(values, 4, 1);
    assert.equal(mask[0], 0);
    assert.ok(Math.abs(mask[1]! - 0.2) < 1e-6);
    assert.ok(Math.abs(mask[2]! - 0.8) < 1e-6);
    assert.equal(mask[3], 1);
  });
});

describe("ensureSubjectPolarity", () => {
  it("inverts a mask that lights up the border instead of the subject", () => {
    const w = 32;
    const h = 32;
    const mask = new Float32Array(w * h);
    mask.fill(0.9);
    for (let y = 10; y < 22; y++) {
      for (let x = 10; x < 22; x++) mask[y * w + x] = 0.05;
    }
    ensureSubjectPolarity(mask, w, h);
    assert.ok(mask[0]! < 0.2);
    assert.ok(mask[16 * w + 16]! > 0.8);
  });

  it("does not invert a product that fills the frame and touches corners", () => {
    const w = 32;
    const h = 32;
    const mask = new Float32Array(w * h);
    mask.fill(0.92);
    for (let x = 0; x < w; x++) {
      mask[x] = 0.12;
      mask[(h - 1) * w + x] = 0.12;
    }
    ensureSubjectPolarity(mask, w, h);
    assert.ok(mask[16 * w + 16]! > 0.8);
  });
});

describe("keepPrimarySubject", () => {
  it("keeps the centered product and drops a corner leftover", () => {
    const w = 64;
    const h = 64;
    const mask = ellipse(w, h, 32, 30, 14, 18);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) mask[y * w + x] = 1;
    }
    keepPrimarySubject(mask, w, h);
    assert.ok(mask[30 * w + 32]! > 0.5);
    assert.equal(mask[2 * w + 2], 0);
  });

  it("keeps sibling parts of similar size (pair of objects)", () => {
    const w = 80;
    const h = 48;
    const left = ellipse(w, h, 24, 24, 10, 12);
    const right = ellipse(w, h, 56, 24, 10, 12);
    const mask = new Float32Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = Math.max(left[i]!, right[i]!);
    keepPrimarySubject(mask, w, h);
    assert.ok(mask[24 * w + 24]! > 0.5);
    assert.ok(mask[24 * w + 56]! > 0.5);
  });
});

describe("fillMaskHoles", () => {
  it("fills an interior hole in the subject", () => {
    const w = 40;
    const h = 40;
    const mask = ellipse(w, h, 20, 20, 12, 12);
    for (let y = 18; y <= 22; y++) {
      for (let x = 18; x <= 22; x++) mask[y * w + x] = 0;
    }
    fillMaskHoles(mask, w, h);
    assert.ok(mask[20 * w + 20]! > 0.9);
  });

  it("keeps a large handle hole transparent", () => {
    const w = 48;
    const h = 48;
    const mask = ellipse(w, h, 24, 24, 16, 16);
    for (let y = 16; y <= 32; y++) {
      for (let x = 16; x <= 32; x++) mask[y * w + x] = 0;
    }
    fillMaskHoles(mask, w, h);
    assert.equal(mask[24 * w + 24], 0);
  });
});

describe("maskLooksUseful", () => {
  it("rejects a near-flat mask", () => {
    const mask = new Float32Array(100);
    mask.fill(0.48);
    assert.equal(maskLooksUseful(mask), false);
    const { std } = maskStats(mask);
    assert.ok(std < 0.01);
  });
});
