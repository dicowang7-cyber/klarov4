/**
 * Photoroom-style matte cleanup: polarity, main-subject selection,
 * hole fill, guided filter, and color decontamination.
 * Operates on float masks in [0, 1] (1 = keep / foreground).
 */

export function sigmoid(v: number) {
  if (v >= 0) {
    const z = Math.exp(-v);
    return 1 / (1 + z);
  }
  const z = Math.exp(v);
  return z / (1 + z);
}

/** Convert raw model output to a 0–1 probability map. Never min-max stretches. */
export function toProbMask(
  values: ArrayLike<number>,
  width: number,
  height: number,
): Float32Array {
  const count = width * height;
  let offset = 0;
  if (values.length >= count * 2) {
    const planes = Math.floor(values.length / count);
    offset = planes === 2 ? count : 0;
  }
  const mask = new Float32Array(count);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = Number(values[offset + i] ?? 0);
    mask[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const looksLikeLogits = min < -0.04 || max > 1.04;
  if (looksLikeLogits) {
    for (let i = 0; i < count; i++) mask[i] = sigmoid(mask[i]!);
  } else {
    for (let i = 0; i < count; i++) {
      const v = mask[i]!;
      mask[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  return mask;
}

export function maskStats(mask: Float32Array) {
  let sum = 0;
  let sum2 = 0;
  let hi = 0;
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]!;
    sum += v;
    sum2 += v * v;
    if (v > 0.5) hi++;
  }
  const n = mask.length || 1;
  const mean = sum / n;
  const variance = Math.max(0, sum2 / n - mean * mean);
  return { mean, std: Math.sqrt(variance), coverage: hi / n };
}

export function maskLooksUseful(mask: Float32Array) {
  const { std, coverage } = maskStats(mask);
  return std > 0.045 && coverage > 0.012 && coverage < 0.985;
}

/**
 * RMBG/U2Net emit foreground. Invert only when the border is clearly "hot"
 * and the interior is not — a product that fills the frame must not flip.
 */
export function ensureSubjectPolarity(
  mask: Float32Array,
  width: number,
  height: number,
) {
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.035));
  let borderSum = 0;
  let borderN = 0;
  let centerSum = 0;
  let centerN = 0;
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const onBorderY = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      const v = mask[row + x]!;
      const onBorder = onBorderY || x < band || x >= width - band;
      if (onBorder) {
        borderSum += v;
        borderN++;
      }
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        centerSum += v;
        centerN++;
      }
    }
  }
  const border = borderSum / Math.max(1, borderN);
  const center = centerSum / Math.max(1, centerN);
  if (border > 0.55 && center < 0.45 && border - center > 0.12) {
    for (let i = 0; i < mask.length; i++) mask[i] = 1 - mask[i]!;
  }
  return mask;
}

type Component = {
  id: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sumX: number;
  sumY: number;
  border: number;
  sides: number;
};

function labelComponents(
  binary: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; comps: Component[] } {
  const labels = new Int32Array(binary.length);
  const comps: Component[] = [];
  let next = 1;
  const stack = new Int32Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    if (!binary[i] || labels[i]) continue;
    let sp = 0;
    stack[sp++] = i;
    labels[i] = next;
    const comp: Component = {
      id: next,
      area: 0,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
      sumX: 0,
      sumY: 0,
      border: 0,
      sides: 0,
    };
    let touchL = false;
    let touchR = false;
    let touchT = false;
    let touchB = false;
    while (sp) {
      const s = stack[--sp]!;
      const x = s % width;
      const y = (s - x) / width;
      comp.area++;
      comp.sumX += x;
      comp.sumY += y;
      if (x < comp.minX) comp.minX = x;
      if (y < comp.minY) comp.minY = y;
      if (x > comp.maxX) comp.maxX = x;
      if (y > comp.maxY) comp.maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        comp.border++;
        if (x === 0) touchL = true;
        if (x === width - 1) touchR = true;
        if (y === 0) touchT = true;
        if (y === height - 1) touchB = true;
      }
      const neighbors = [s - 1, s + 1, s - width, s + width];
      for (const ns of neighbors) {
        if (ns < 0 || ns >= binary.length) continue;
        if (!binary[ns] || labels[ns]) continue;
        const nx = ns % width;
        if (Math.abs(nx - x) + Math.abs((ns - nx) / width - y) !== 1) continue;
        labels[ns] = next;
        stack[sp++] = ns;
      }
    }
    comp.sides =
      (touchL ? 1 : 0) + (touchR ? 1 : 0) + (touchT ? 1 : 0) + (touchB ? 1 : 0);
    comps.push(comp);
    next++;
  }
  return { labels, comps };
}

function dilateBinary(
  binary: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return binary;
  const tmp = new Uint8Array(binary.length);
  const out = new Uint8Array(binary.length);
  const r = radius;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let m = 0;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) if (binary[row + xx]) m = 1;
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let m = 0;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(height - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) if (tmp[yy * width + x]) m = 1;
      out[y * width + x] = m;
    }
  }
  return out;
}

/**
 * Keep the main product (and nearby sibling parts) instead of every
 * salient blob. Border strips and tiny specks are dropped.
 */
export function keepPrimarySubject(
  mask: Float32Array,
  width: number,
  height: number,
  threshold = 0.42,
) {
  const binary = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) binary[i] = mask[i]! >= threshold ? 1 : 0;
  const { labels, comps } = labelComponents(binary, width, height);
  if (comps.length === 0) return mask;

  const imgArea = width * height;
  const minArea = Math.max(24, Math.round(imgArea * 0.0012));
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const diag = Math.hypot(cx, cy) || 1;

  const scored = comps.map((c) => {
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    const fill = c.area / Math.max(1, bw * bh);
    const isFrame = bw > width * 0.9 && bh > height * 0.9 && fill < 0.38;
    const centroidX = c.sumX / c.area;
    const centroidY = c.sumY / c.area;
    const centrality = 1 - Math.hypot(centroidX - cx, centroidY - cy) / diag;
    const borderRatio = c.border / c.area;
    let score =
      c.area *
      (0.38 + 0.62 * Math.max(0, centrality)) *
      (1 - 0.7 * Math.min(1, borderRatio * 5));
    if (c.sides >= 3) score *= 0.12;
    else if (
      c.sides === 2 &&
      ((c.minX === 0 && c.maxX === width - 1) ||
        (c.minY === 0 && c.maxY === height - 1))
    ) {
      score *= 0.2;
    }
    if (isFrame) score *= 0.04;
    if (c.area < minArea) score = 0;
    return { c, score, isFrame };
  });

  scored.sort((a, b) => b.score - a.score);
  const primary = scored[0];
  if (!primary || primary.score <= 0) return mask;

  const keep = new Uint8Array(comps.length + 1);
  keep[primary.c.id] = 1;
  const areaGate = Math.max(minArea, primary.c.area * 0.12);
  const scoreGate = primary.score * 0.18;
  for (const item of scored) {
    if (item.c.id === primary.c.id) continue;
    if (item.score >= scoreGate && item.c.area >= areaGate && !item.isFrame) {
      keep[item.c.id] = 1;
    }
  }

  const kept = new Uint8Array(mask.length);
  let keptPixels = 0;
  for (let i = 0; i < mask.length; i++) {
    const id = labels[i]!;
    if (id && keep[id]) {
      kept[i] = 1;
      keptPixels++;
    }
  }
  if (keptPixels < imgArea * 0.008) return mask;

  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.006));
  const dilated = dilateBinary(kept, width, height, radius);
  for (let i = 0; i < mask.length; i++) {
    if (!dilated[i]) mask[i] = 0;
  }
  return mask;
}

export function fillMaskHoles(
  mask: Float32Array,
  width: number,
  height: number,
  threshold = 0.42,
) {
  const open = new Uint8Array(mask.length);
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  const maybe = (i: number) => {
    if (i < 0 || i >= open.length || seen[i] || !open[i]) return;
    seen[i] = 1;
    stack.push(i);
  };
  let subject = 0;
  for (let i = 0; i < mask.length; i++) {
    const isOpen = mask[i]! < threshold;
    open[i] = isOpen ? 1 : 0;
    if (!isOpen) subject++;
  }
  for (let x = 0; x < width; x++) {
    maybe(x);
    maybe((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    maybe(y * width);
    maybe(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) maybe(i - 1);
    if (x + 1 < width) maybe(i + 1);
    maybe(i - width);
    maybe(i + width);
  }

  // Only close specks / compression holes — keep mug handles, rings, scissors.
  const maxHole = Math.max(48, Math.round(Math.max(subject, 1) * 0.045));
  const holeId = new Int32Array(mask.length);
  let hid = 0;
  const sizes: number[] = [0];
  for (let i = 0; i < mask.length; i++) {
    if (!open[i] || seen[i] || holeId[i]) continue;
    hid++;
    sizes[hid] = 0;
    const q = [i];
    holeId[i] = hid;
    while (q.length) {
      const s = q.pop()!;
      sizes[hid]!++;
      const x = s % width;
      const y = (s - x) / width;
      const nbs = [s - 1, s + 1, s - width, s + width];
      for (const ns of nbs) {
        if (ns < 0 || ns >= mask.length || holeId[ns] || !open[ns] || seen[ns]) {
          continue;
        }
        const nx = ns % width;
        const ny = (ns - nx) / width;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        holeId[ns] = hid;
        q.push(ns);
      }
    }
  }
  for (let i = 0; i < mask.length; i++) {
    const id = holeId[i]!;
    if (id && (sizes[id] ?? 0) <= maxHole) mask[i] = Math.max(mask[i]!, 1);
  }
  return mask;
}

function boxBlur(
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const r = Math.max(1, radius);
  const span = r * 2 + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let run = 0;
    for (let x = -r; x <= r; x++) {
      const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
      run += src[row + cx]!;
    }
    for (let x = 0; x < width; x++) {
      tmp[row + x] = run / span;
      const leave = x - r < 0 ? 0 : x - r >= width ? width - 1 : x - r;
      const enter =
        x + r + 1 < 0 ? 0 : x + r + 1 >= width ? width - 1 : x + r + 1;
      run += src[row + enter]! - src[row + leave]!;
    }
  }
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = -r; y <= r; y++) {
      const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
      run += tmp[cy * width + x]!;
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = run / span;
      const leave = y - r < 0 ? 0 : y - r >= height ? height - 1 : y - r;
      const enter =
        y + r + 1 < 0 ? 0 : y + r + 1 >= height ? height - 1 : y + r + 1;
      run += tmp[enter * width + x]! - tmp[leave * width + x]!;
    }
  }
  return out;
}

/** Fast guided filter (He et al.) so edges follow the photo instead of the low-res mask. */
export function guidedFilter(
  guide: Float32Array,
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
  eps = 1e-4,
) {
  const meanI = boxBlur(guide, width, height, radius);
  const meanP = boxBlur(src, width, height, radius);
  const n = width * height;
  const corrI = new Float32Array(n);
  const corrIp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    corrI[i] = guide[i]! * guide[i]!;
    corrIp[i] = guide[i]! * src[i]!;
  }
  const meanII = boxBlur(corrI, width, height, radius);
  const meanIP = boxBlur(corrIp, width, height, radius);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = Math.max(0, meanII[i]! - meanI[i]! * meanI[i]!);
    const cov = meanIP[i]! - meanI[i]! * meanP[i]!;
    a[i] = cov / (varI + eps);
    b[i] = meanP[i]! - a[i]! * meanI[i]!;
  }
  const meanA = boxBlur(a, width, height, radius);
  const meanB = boxBlur(b, width, height, radius);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const q = meanA[i]! * guide[i]! + meanB[i]!;
    out[i] = q < 0 ? 0 : q > 1 ? 1 : q;
  }
  return out;
}

export function lumaGuide(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] =
      (0.2126 * data[p]! + 0.7152 * data[p + 1]! + 0.0722 * data[p + 2]!) / 255;
  }
  return out;
}

export function sampleMask(
  mask: Float32Array,
  maskW: number,
  maskH: number,
  x: number,
  y: number,
  destW: number,
  destH: number,
) {
  const sx = ((x + 0.5) * maskW) / destW - 0.5;
  const sy = ((y + 0.5) * maskH) / destH - 0.5;
  const x0 = Math.max(0, Math.floor(sx));
  const y0 = Math.max(0, Math.floor(sy));
  const x1 = Math.min(maskW - 1, x0 + 1);
  const y1 = Math.min(maskH - 1, y0 + 1);
  const fx = sx - x0;
  const fy = sy - y0;
  const a00 = mask[y0 * maskW + x0] ?? 0;
  const a10 = mask[y0 * maskW + x1] ?? 0;
  const a01 = mask[y1 * maskW + x0] ?? 0;
  const a11 = mask[y1 * maskW + x1] ?? 0;
  return (
    a00 * (1 - fx) * (1 - fy) +
    a10 * fx * (1 - fy) +
    a01 * (1 - fx) * fy +
    a11 * fx * fy
  );
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

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function estimateBackground(
  data: Uint8ClampedArray,
  alpha: Float32Array,
  width: number,
  height: number,
): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  for (let y = 0; y < height; y++) {
    const onY = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alpha[i]! > 0.12 && !onY && x >= band && x < width - band) continue;
      if (alpha[i]! > 0.2) continue;
      const p = i * 4;
      rs.push(data[p]!);
      gs.push(data[p + 1]!);
      bs.push(data[p + 2]!);
    }
  }
  if (rs.length < 8) {
    for (let x = 0; x < width; x++) {
      const top = x * 4;
      const bot = ((height - 1) * width + x) * 4;
      rs.push(data[top]!, data[bot]!);
      gs.push(data[top + 1]!, data[bot + 1]!);
      bs.push(data[top + 2]!, data[bot + 2]!);
    }
  }
  return [median(rs), median(gs), median(bs)];
}

export function hardenMatte(mask: Float32Array) {
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i]!;
    if (a < 0.04) mask[i] = 0;
    else if (a > 0.96) mask[i] = 1;
    else {
      const t = (a - 0.04) / 0.92;
      const s = t * t * (3 - 2 * t);
      mask[i] = 0.04 + s * 0.92;
    }
  }
  return mask;
}

export function applyMatte(
  source: ImageData,
  mask: Float32Array,
  maskW: number,
  maskH: number,
): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const { width, height, data } = out;
  const alpha = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      alpha[y * width + x] = sampleMask(mask, maskW, maskH, x, y, width, height);
    }
  }

  const [br, bg, bb] = estimateBackground(data, alpha, width, height);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    let a = alpha[i]!;
    if (a < 0) a = 0;
    if (a > 1) a = 1;
    const r = data[p]!;
    const g = data[p + 1]!;
    const b = data[p + 2]!;
    const distBg = colorDist(r, g, b, br, bg, bb);
    if (a < 0.55 && distBg < 16) {
      a *= Math.max(0, (distBg - 4) / 12);
    }
    if (a > 0.02 && a < 0.97) {
      const inv = 1 - a;
      const t = Math.max(a, 0.08);
      data[p] = Math.max(0, Math.min(255, (r - br * inv) / t));
      data[p + 1] = Math.max(0, Math.min(255, (g - bg * inv) / t));
      data[p + 2] = Math.max(0, Math.min(255, (b - bb * inv) / t));
    }
    data[p + 3] = Math.round(a * 255);
  }
  return out;
}

export function refineModelMask(
  mask: Float32Array,
  width: number,
  height: number,
  guideLuma: Float32Array,
  quality: "fast" | "quality",
) {
  ensureSubjectPolarity(mask, width, height);
  if (!maskLooksUseful(mask)) return mask;
  keepPrimarySubject(mask, width, height);
  fillMaskHoles(mask, width, height);
  const radius = quality === "fast" ? 2 : 4;
  const filtered = guidedFilter(
    guideLuma,
    mask,
    width,
    height,
    radius,
    1e-4,
  );
  hardenMatte(filtered);
  return filtered;
}
