import { parseHex } from "@/lib/image/color";

export type ShadowStyle = "drop" | "contact" | "glow";

export type ShadowOptions = {
  enabled: boolean;
  style: ShadowStyle;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
};

export const DEFAULT_SHADOW: ShadowOptions = {
  enabled: false,
  style: "drop",
  opacity: 42,
  blur: 26,
  offsetX: 0,
  offsetY: 18,
  color: "#111113",
};

export const SHADOW_PRESETS: {
  id: string;
  label: string;
  hint: string;
  value: ShadowOptions;
}[] = [
  {
    id: "off",
    label: "Tanpa",
    hint: "Datar",
    value: { ...DEFAULT_SHADOW, enabled: false },
  },
  {
    id: "soft",
    label: "Lembut",
    hint: "Studio",
    value: {
      enabled: true,
      style: "drop",
      opacity: 38,
      blur: 32,
      offsetX: 0,
      offsetY: 16,
      color: "#111113",
    },
  },
  {
    id: "hard",
    label: "Tajam",
    hint: "Katalog",
    value: {
      enabled: true,
      style: "drop",
      opacity: 55,
      blur: 10,
      offsetX: 8,
      offsetY: 12,
      color: "#111113",
    },
  },
  {
    id: "floor",
    label: "Lantai",
    hint: "Kontak",
    value: {
      enabled: true,
      style: "contact",
      opacity: 48,
      blur: 18,
      offsetX: 0,
      offsetY: 4,
      color: "#111113",
    },
  },
  {
    id: "halo",
    label: "Halo",
    hint: "Glow",
    value: {
      enabled: true,
      style: "glow",
      opacity: 55,
      blur: 28,
      offsetX: 0,
      offsetY: 0,
      color: "#ffffff",
    },
  },
];

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  shadow: ShadowOptions,
) {
  if (!shadow.enabled || shadow.opacity <= 0) return;
  const [r, g, b] = parseHex(shadow.color);
  const alpha = Math.max(0, Math.min(1, shadow.opacity / 100));
  ctx.save();
  if (shadow.style === "contact") {
    const cx = dx + dw / 2 + shadow.offsetX;
    const cy = dy + dh * 0.93 + shadow.offsetY;
    const rx = Math.max(10, dw * 0.36);
    const ry = Math.max(5, dh * 0.07 + shadow.blur * 0.12);
    ctx.filter = `blur(${Math.max(0, shadow.blur)}px)`;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowColor = `rgba(${r},${g},${b},${alpha})`;
    ctx.shadowBlur = Math.max(0, shadow.blur);
    ctx.shadowOffsetX = shadow.style === "glow" ? 0 : shadow.offsetX;
    ctx.shadowOffsetY = shadow.style === "glow" ? 0 : shadow.offsetY;
    ctx.drawImage(image, 0, 0, image.width, image.height, dx, dy, dw, dh);
  }
  ctx.restore();
}
