export type ColorGrade = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export const DEFAULT_GRADE: ColorGrade = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
};

export function isIdentityGrade(grade: ColorGrade) {
  return (
    grade.brightness === 0 &&
    grade.contrast === 0 &&
    grade.saturation === 0 &&
    grade.warmth === 0
  );
}

export function applyColorGrade(
  source: ImageData,
  grade: ColorGrade,
): ImageData {
  if (isIdentityGrade(grade)) return source;
  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const data = out.data;
  const lift = grade.brightness * 2.55;
  const contrast = (100 + grade.contrast) / 100;
  const sat = (100 + grade.saturation) / 100;
  const warm = grade.warmth * 0.85;

  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 0) continue;
    let r = data[p] + lift;
    let g = data[p + 1] + lift;
    let b = data[p + 2] + lift;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + (r - luma) * sat + warm;
    g = luma + (g - luma) * sat;
    b = luma + (b - luma) * sat - warm;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
  }
  return out;
}
