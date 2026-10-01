import { blendSrcOver, parseHex, type RGB } from "@/lib/image/color";

function distanceToSubject(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const inf = 1e5;
  const dist = new Float32Array(width * height);
  for (let i = 0, p = 3; i < dist.length; i++, p += 4) {
    dist[i] = data[p] > 128 ? 0 : inf;
  }

  const diag = Math.SQRT2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) d = Math.min(d, dist[i - width] + 1);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - width - 1] + diag);
      if (x + 1 < width && y > 0) d = Math.min(d, dist[i - width + 1] + diag);
      dist[i] = d;
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = dist[i];
      if (x + 1 < width) d = Math.min(d, dist[i + 1] + 1);
      if (y + 1 < height) d = Math.min(d, dist[i + width] + 1);
      if (x + 1 < width && y + 1 < height)
        d = Math.min(d, dist[i + width + 1] + diag);
      if (x > 0 && y + 1 < height) d = Math.min(d, dist[i + width - 1] + diag);
      dist[i] = d;
    }
  }

  return dist;
}

function blurAlphaChannel(data: ImageData, radius: number) {
  if (radius <= 0) return;
  const { width, height } = data;
  const src = data.data;
  const tmp = new Uint8ClampedArray(width * height);
  const passes = 2;

  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      let run = 0;
      const row = y * width;
      for (let x = -radius; x <= radius; x++) {
        const cx = Math.min(width - 1, Math.max(0, x));
        run += src[(row + cx) * 4 + 3];
      }
      const span = radius * 2 + 1;
      for (let x = 0; x < width; x++) {
        tmp[row + x] = Math.round(run / span);
        const leave = Math.min(width - 1, Math.max(0, x - radius));
        const enter = Math.min(width - 1, Math.max(0, x + radius + 1));
        run += src[(row + enter) * 4 + 3] - src[(row + leave) * 4 + 3];
      }
    }

    for (let x = 0; x < width; x++) {
      let run = 0;
      for (let y = -radius; y <= radius; y++) {
        const cy = Math.min(height - 1, Math.max(0, y));
        run += tmp[cy * width + x];
      }
      const span = radius * 2 + 1;
      for (let y = 0; y < height; y++) {
        src[(y * width + x) * 4 + 3] = Math.round(run / span);
        const leave = Math.min(height - 1, Math.max(0, y - radius));
        const enter = Math.min(height - 1, Math.max(0, y + radius + 1));
        run += tmp[enter * width + x] - tmp[leave * width + x];
      }
    }
  }
}

export function refineCutout(source: ImageData): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const data = out.data;
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (alpha < 22) data[i] = 0;
    else if (alpha > 236) data[i] = 255;
  }
  blurAlphaChannel(out, 1);
  return out;
}

export function paintBrush(
  working: ImageData,
  base: ImageData,
  cx: number,
  cy: number,
  radius: number,
  hardness: number,
  mode: "erase" | "restore",
) {
  const { width, height, data } = working;
  const baseData = base.data;
  const r = Math.max(1, radius);
  const r2 = r * r;
  const inner = r * Math.max(0, Math.min(0.96, hardness));
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width - 1, Math.ceil(cx + r));
  const y1 = Math.min(height - 1, Math.ceil(cy + r));

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
      const p = (y * width + x) * 4;
      if (mode === "erase") {
        data[p + 3] = Math.round(data[p + 3] * (1 - t));
      } else {
        const target = baseData[p + 3];
        data[p] = baseData[p];
        data[p + 1] = baseData[p + 1];
        data[p + 2] = baseData[p + 2];
        data[p + 3] = Math.round(data[p + 3] + (target - data[p + 3]) * t);
      }
    }
  }
}

export type ComposeOptions = {
  brightness: number;
  outlineWidth: number;
  outlineColor: string;
  fillColor: string | null;
  skipOutline?: boolean;
};

export function composeSubject(
  source: ImageData,
  options: ComposeOptions,
): ImageData {
  const { width, height, data: src } = source;
  const out = new ImageData(width, height);
  const dst = out.data;
  const shift = Math.round(options.brightness * 2.55);

  if (options.fillColor) {
    const [fr, fg, fb] = parseHex(options.fillColor);
    for (let i = 0; i < dst.length; i += 4) {
      dst[i] = fr;
      dst[i + 1] = fg;
      dst[i + 2] = fb;
      dst[i + 3] = 255;
    }
  }

  const radius = options.skipOutline ? 0 : Math.max(0, options.outlineWidth);
  if (radius > 0) {
    const dist = distanceToSubject(src, width, height);
    const [or, og, ob] = parseHex(options.outlineColor);
    for (let i = 0, p = 0; i < dist.length; i++, p += 4) {
      const d = dist[i];
      if (d <= 0 || d > radius + 1) continue;
      const coverage = Math.min(1, Math.max(0, radius + 0.65 - d));
      if (coverage <= 0) continue;
      blendSrcOver(dst, p, or, og, ob, Math.round(255 * coverage));
    }
  }

  for (let p = 0; p < src.length; p += 4) {
    const a = src[p + 3];
    if (a === 0) continue;
    blendSrcOver(
      dst,
      p,
      src[p] + shift,
      src[p + 1] + shift,
      src[p + 2] + shift,
      a,
    );
  }

  return out;
}

export const OUTLINE_SWATCHES: { label: string; value: string }[] = [
  { label: "Putih", value: "#ffffff" },
  { label: "Hitam", value: "#111113" },
  { label: "Perak", value: "#d4d4d8" },
  { label: "Tinta", value: "#3f3f46" },
];

export const FILL_SWATCHES: { label: string; value: string | null }[] = [
  { label: "Transparan", value: null },
  { label: "Putih", value: "#ffffff" },
  { label: "Abu", value: "#f4f4f5" },
  { label: "Krem", value: "#f3eee6" },
  { label: "Hitam", value: "#111113" },
];

export type GradientPreset = {
  id: string;
  label: string;
  from: string;
  to: string;
  angle: number;
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "studio",
    label: "Studio",
    from: "#ffffff",
    to: "#e4e4ea",
    angle: 180,
  },
  {
    id: "cream",
    label: "Krem",
    from: "#f7f1e8",
    to: "#e4d5c0",
    angle: 165,
  },
  {
    id: "charcoal",
    label: "Arang",
    from: "#2c2c32",
    to: "#111113",
    angle: 180,
  },
  {
    id: "mist",
    label: "Kabut",
    from: "#e8eef4",
    to: "#c5d0db",
    angle: 150,
  },
];

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function hexEqual(a: string, b: string) {
  return parseHex(a).join() === parseHex(b).join();
}

export type { RGB };
