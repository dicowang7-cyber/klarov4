export function createMask(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

export function maskCoverage(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 16) n++;
  return n;
}

export function clearMask(mask: Uint8Array) {
  mask.fill(0);
}

export function cloneMask(mask: Uint8Array): Uint8Array {
  return new Uint8Array(mask);
}

export function paintMask(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  hardness: number,
  value = 255,
) {
  const r = Math.max(1, radius);
  const r2 = r * r;
  const inner = r * Math.max(0, Math.min(0.96, hardness));
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width - 1, Math.ceil(cx + r));
  const y1 = Math.min(height - 1, Math.ceil(cy + r));
  const add = value >= 128;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      let t = 1;
      if (d > inner) {
        const u = (d - inner) / Math.max(0.0001, r - inner);
        t = 1 - u * u * (3 - 2 * u);
      }
      const i = y * width + x;
      if (add) {
        mask[i] = Math.max(mask[i], Math.round(value * t));
      } else {
        mask[i] = Math.round(mask[i] * (1 - t));
      }
    }
  }
}

export function maskBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold = 16,
): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x] <= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return new Uint8Array(mask);
  const out = new Uint8Array(mask.length);
  const tmp = new Uint8Array(mask.length);
  const r = radius;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let m = 0;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) m = Math.max(m, mask[row + xx]);
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let m = 0;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(height - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) m = Math.max(m, tmp[yy * width + x]);
      out[y * width + x] = m;
    }
  }
  return out;
}

export function redOverlayFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  alpha = 140,
): ImageData {
  const out = new ImageData(width, height);
  const data = out.data;
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const m = mask[i];
    if (m === 0) continue;
    data[p] = 196;
    data[p + 1] = 52;
    data[p + 2] = 42;
    data[p + 3] = Math.round((m / 255) * alpha);
  }
  return out;
}
