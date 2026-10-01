export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export function parseHex(hex: string): RGB {
  const raw = hex.replace("#", "").trim();
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return [28, 27, 25];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function blendSrcOver(
  dst: Uint8ClampedArray,
  offset: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const sa = a / 255;
  if (sa <= 0) return;
  const da = dst[offset + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) {
    dst[offset + 3] = 0;
    return;
  }
  dst[offset] = (r * sa + dst[offset] * da * (1 - sa)) / outA;
  dst[offset + 1] = (g * sa + dst[offset + 1] * da * (1 - sa)) / outA;
  dst[offset + 2] = (b * sa + dst[offset + 2] * da * (1 - sa)) / outA;
  dst[offset + 3] = outA * 255;
}
