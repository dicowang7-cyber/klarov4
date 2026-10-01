export type Bounds = { x: number; y: number; w: number; h: number };

export function subjectBounds(
  image: ImageData,
  threshold = 18,
): Bounds | null {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export type CroppedSides = {
  left: boolean;
  top: boolean;
  right: boolean;
  bottom: boolean;
};

export function detectCroppedSides(
  bounds: Bounds | null,
  sourceW: number,
  sourceH: number,
  slack = 3,
): CroppedSides {
  if (!bounds) {
    return { left: true, top: true, right: true, bottom: true };
  }
  return {
    left: bounds.x <= slack,
    top: bounds.y <= slack,
    right: bounds.x + bounds.w >= sourceW - slack,
    bottom: bounds.y + bounds.h >= sourceH - slack,
  };
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDist(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

function sobelLuma(data: Uint8ClampedArray, width: number, height: number) {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (yy: number, xx: number) => (yy * width + xx) * 4;
      const l = (yy: number, xx: number) => {
        const p = idx(yy, xx);
        return luminance(data[p], data[p + 1], data[p + 2]);
      };
      const gx =
        -l(y - 1, x - 1) +
        l(y - 1, x + 1) -
        2 * l(y, x - 1) +
        2 * l(y, x + 1) -
        l(y + 1, x - 1) +
        l(y + 1, x + 1);
      const gy =
        -l(y - 1, x - 1) -
        2 * l(y - 1, x) -
        l(y - 1, x + 1) +
        l(y + 1, x - 1) +
        2 * l(y + 1, x) +
        l(y + 1, x + 1);
      mag[y * width + x] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

/**
 * Grow a scribble into an object on the cutout using color + edge stopping.
 * Returns a 0–255 mask of pixels to remove.
 */
export function growGuidedCutout(
  image: ImageData,
  scribble: Uint8Array,
  tolerance = 58,
): Uint8Array {
  const { width: w, height: h, data } = image;
  const out = new Uint8Array(w * h);
  const edges = sobelLuma(data, w, h);

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  const seeds: number[] = [];
  for (let i = 0, p = 0; i < scribble.length; i++, p += 4) {
    if (scribble[i] < 40) continue;
    if (data[p + 3] < 24) continue;
    sr += data[p];
    sg += data[p + 1];
    sb += data[p + 2];
    n++;
    seeds.push(i);
    out[i] = 255;
  }
  if (n === 0) return out;

  const mr = sr / n;
  const mg = sg / n;
  const mb = sb / n;
  const maxDist = 18 + (tolerance / 100) * 150;
  const edgeStop = 48 + (1 - tolerance / 100) * 90;

  const seen = new Uint8Array(w * h);
  const queue = seeds.slice();
  for (const s of seeds) seen[s] = 1;

  while (queue.length) {
    const i = queue.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni]) continue;
        seen[ni] = 1;
        const np = ni * 4;
        if (data[np + 3] < 24) continue;
        if (edges[ni] > edgeStop && scribble[ni] < 40) continue;
        const dist = colorDist(data[np], data[np + 1], data[np + 2], mr, mg, mb);
        const parent = colorDist(
          data[np],
          data[np + 1],
          data[np + 2],
          data[i * 4],
          data[i * 4 + 1],
          data[i * 4 + 2],
        );
        if (dist > maxDist && parent > maxDist * 0.55) continue;
        out[ni] = 255;
        queue.push(ni);
      }
    }
  }

  // Close small holes inside the selection.
  const closed = new Uint8Array(out);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (closed[i]) continue;
      if (data[i * 4 + 3] < 24) continue;
      let c = 0;
      if (out[i - 1]) c++;
      if (out[i + 1]) c++;
      if (out[i - w]) c++;
      if (out[i + w]) c++;
      if (c >= 3) closed[i] = 255;
    }
  }
  return closed;
}

export function eraseMaskedAlpha(
  image: ImageData,
  mask: Uint8Array,
  feather = 1,
) {
  const { width, height, data } = image;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const m = mask[i];
      if (m === 0) continue;
      const p = i * 4;
      let t = m / 255;
      if (feather > 0) {
        let minM = m;
        const x0 = Math.max(0, x - feather);
        const x1 = Math.min(width - 1, x + feather);
        const y0 = Math.max(0, y - feather);
        const y1 = Math.min(height - 1, y + feather);
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            minM = Math.min(minM, mask[yy * width + xx]);
          }
        }
        t = (m / 255) * (0.65 + 0.35 * (minM / 255));
      }
      data[p + 3] = Math.round(data[p + 3] * (1 - t));
    }
  }
}
