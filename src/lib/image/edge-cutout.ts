import { cloneImageData } from "@/lib/image/io";
import {
  applyMatte,
  fillMaskHoles,
  keepPrimarySubject,
} from "@/lib/image/matte";

function medianChannel(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
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

function borderColor(data: ImageData, frame: number) {
  const { width, height, data: px } = data;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const band = Math.max(1, frame);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= band && y >= band && x < width - band && y < height - band) {
        continue;
      }
      const p = (y * width + x) * 4;
      rs.push(px[p]!);
      gs.push(px[p + 1]!);
      bs.push(px[p + 2]!);
    }
  }
  return [medianChannel(rs), medianChannel(gs), medianChannel(bs)] as const;
}

function downsample(source: ImageData, maxEdge: number): ImageData {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  if (scale >= 0.999) return cloneImageData(source);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const src = document.createElement("canvas");
  src.width = source.width;
  src.height = source.height;
  src.getContext("2d")!.putImageData(source, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = width;
  dst.height = height;
  const ctx = dst.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Local studio cutout used when the ONNX files are still placeholders.
 * Floods from the border using the dominant edge color — strong on product
 * photos with a plain backdrop — then keeps the main central subject.
 */
export function edgeCutout(
  source: ImageData,
  quality: "fast" | "quality",
  onProgress?: (percent: number) => void,
): ImageData {
  onProgress?.(8);
  const maxEdge = quality === "fast" ? 480 : 960;
  const work = downsample(source, maxEdge);
  const { width, height, data } = work;
  const [br, bg, bb] = borderColor(work, quality === "fast" ? 6 : 10);
  const threshold = quality === "fast" ? 42 : 28;
  const floodGate = threshold * 1.35;

  onProgress?.(28);
  const bgMask = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];

  const maybeSeed = (x: number, y: number) => {
    const i = y * width + x;
    const p = i * 4;
    const dist = colorDist(data[p]!, data[p + 1]!, data[p + 2]!, br, bg, bb);
    if (dist > floodGate) return;
    if (seen[i]) return;
    seen[i] = 1;
    bgMask[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    maybeSeed(x, 0);
    maybeSeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    maybeSeed(0, y);
    maybeSeed(width - 1, y);
  }

  onProgress?.(48);
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    const neighbors = [i - 1, i + 1, i - width, i + width];
    for (const ni of neighbors) {
      if (ni < 0 || ni >= bgMask.length) continue;
      if (seen[ni]) continue;
      const nx = ni % width;
      const ny = (ni - nx) / width;
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      const p = ni * 4;
      const dist = colorDist(data[p]!, data[p + 1]!, data[p + 2]!, br, bg, bb);
      if (dist > threshold) continue;
      seen[ni] = 1;
      bgMask[ni] = 1;
      queue.push(ni);
    }
  }

  onProgress?.(72);
  const alpha = new Float32Array(width * height);
  const feather = quality === "fast" ? 1.6 : 2.6;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!bgMask[i]) {
        alpha[i] = 1;
        continue;
      }
      let nearest = 99;
      const r = Math.ceil(feather + 1);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          if (bgMask[yy * width + xx]) continue;
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
      }
      alpha[i] = nearest >= 99 ? 0 : Math.max(0, 1 - nearest / (feather + 0.35));
    }
  }

  onProgress?.(86);
  keepPrimarySubject(alpha, width, height, 0.35);
  fillMaskHoles(alpha, width, height, 0.35);
  onProgress?.(94);
  const out = applyMatte(source, alpha, width, height);
  onProgress?.(100);
  return out;
}
