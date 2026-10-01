import { dilateMask } from "@/lib/image/mask";

function yieldNow() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Telea-style fast inpainting. Fills masked RGB from surrounding known pixels
 * while preserving alpha. Best for watermarks and small objects.
 */
export async function inpaintTelea(
  source: ImageData,
  mask: Uint8Array,
  onProgress?: (percent: number) => void,
): Promise<ImageData> {
  const { width: w, height: h, data: src } = source;
  const out = new ImageData(new Uint8ClampedArray(src), w, h);
  const dst = out.data;
  const dilated = dilateMask(mask, w, h, 2);

  const hole = new Uint8Array(w * h);
  let remaining = 0;
  for (let i = 0; i < hole.length; i++) {
    if (dilated[i] > 96) {
      hole[i] = 1;
      remaining++;
    }
  }
  if (remaining === 0) return out;

  const known = new Uint8Array(w * h);
  for (let i = 0; i < hole.length; i++) known[i] = hole[i] ? 0 : 1;

  const radius = 5;
  const total = remaining;
  let processed = 0;
  let lastYield = performance.now();

  const offsets: { x: number; y: number; dist: number }[] = [];
  for (let yy = -radius; yy <= radius; yy++) {
    for (let xx = -radius; xx <= radius; xx++) {
      if (xx === 0 && yy === 0) continue;
      const dist = Math.hypot(xx, yy);
      if (dist <= radius + 0.01) offsets.push({ x: xx, y: yy, dist });
    }
  }

  const isBoundary = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0 && known[i - 1]) return true;
    if (x + 1 < w && known[i + 1]) return true;
    if (y > 0 && known[i - w]) return true;
    if (y + 1 < h && known[i + w]) return true;
    return false;
  };

  let frontier: number[] = [];
  for (let i = 0; i < hole.length; i++) {
    if (hole[i] && isBoundary(i)) frontier.push(i);
  }

  const next: number[] = [];
  const queued = new Uint8Array(w * h);

  while (remaining > 0 && frontier.length > 0) {
    next.length = 0;
    queued.fill(0);

    for (const i of frontier) {
      if (!hole[i]) continue;
      const x = i % w;
      const y = (i - x) / w;

      let wr = 0;
      let wg = 0;
      let wb = 0;
      let wsum = 0;

      for (const off of offsets) {
        const nx = x + off.x;
        const ny = y + off.y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!known[ni]) continue;
        const np = ni * 4;
        const dirx = -off.x / off.dist;
        const diry = -off.y / off.dist;
        const directional = Math.max(0.08, dirx * -off.x + diry * -off.y);
        const weight = (directional / (off.dist * off.dist)) * (dst[np + 3] / 255 || 1);
        wr += dst[np] * weight;
        wg += dst[np + 1] * weight;
        wb += dst[np + 2] * weight;
        wsum += weight;
      }

      const p = i * 4;
      if (wsum > 0) {
        dst[p] = Math.round(wr / wsum);
        dst[p + 1] = Math.round(wg / wsum);
        dst[p + 2] = Math.round(wb / wsum);
      }
      hole[i] = 0;
      known[i] = 1;
      remaining--;
      processed++;

      const neighbors = [i - 1, i + 1, i - w, i + w];
      for (const ni of neighbors) {
        if (ni < 0 || ni >= hole.length) continue;
        if (!hole[ni] || queued[ni]) continue;
        queued[ni] = 1;
        next.push(ni);
      }
    }

    frontier = next.filter((i) => hole[i]);
    onProgress?.(Math.min(99, Math.round((processed / total) * 100)));

    if (performance.now() - lastYield > 24) {
      lastYield = performance.now();
      await yieldNow();
    }
  }

  if (remaining > 0) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    for (let i = 0, p = 0; i < known.length; i++, p += 4) {
      if (!known[i] || dst[p + 3] < 8) continue;
      sr += dst[p];
      sg += dst[p + 1];
      sb += dst[p + 2];
      n++;
      if (n > 4000) break;
    }
    const fr = n ? sr / n : 180;
    const fg = n ? sg / n : 180;
    const fb = n ? sb / n : 180;
    for (let i = 0; i < hole.length; i++) {
      if (!hole[i]) continue;
      const p = i * 4;
      dst[p] = fr;
      dst[p + 1] = fg;
      dst[p + 2] = fb;
    }
  }

  onProgress?.(100);
  return out;
}

export function copyRgbKeepAlpha(target: ImageData, source: ImageData) {
  const t = target.data;
  const s = source.data;
  const n = Math.min(t.length, s.length);
  for (let p = 0; p < n; p += 4) {
    t[p] = s[p];
    t[p + 1] = s[p + 1];
    t[p + 2] = s[p + 2];
  }
}

export function copyPatch(
  dest: ImageData,
  src: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(dest.width, x + w, x + src.width);
  const y1 = Math.min(dest.height, y + h, y + src.height);
  for (let yy = y0; yy < y1; yy++) {
    const destOffset = (yy * dest.width + x0) * 4;
    const srcOffset = ((yy - y) * src.width + (x0 - x)) * 4;
    dest.data.set(
      src.data.subarray(srcOffset, srcOffset + (x1 - x0) * 4),
      destOffset,
    );
  }
}

export function extractPatch(
  source: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
): ImageData {
  const patch = new ImageData(w, h);
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(source.width, x + w);
  const y1 = Math.min(source.height, y + h);
  for (let yy = y0; yy < y1; yy++) {
    const si = (yy * source.width + x0) * 4;
    const di = ((yy - y) * w + (x0 - x)) * 4;
    patch.data.set(source.data.subarray(si, si + (x1 - x0) * 4), di);
  }
  return patch;
}
