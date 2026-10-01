import { parseHex } from "@/lib/image/color";
import {
  detectCroppedSides,
  subjectBounds,
  type Bounds,
} from "@/lib/image/cutout";
import { drawShadow, type ShadowOptions } from "@/lib/image/shadow";

export type PositionMode = "original" | "center" | "custom";

export type LayoutOptions = {
  canvasWidth: number;
  canvasHeight: number;
  mode: PositionMode;
  paddingPct: number;
  ignoreCroppedSides: boolean;
  offsetX: number;
  offsetY: number;
};

export type Layout = {
  dx: number;
  dy: number;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type GradientFill = {
  from: string;
  to: string;
  angle: number;
};

export type OutputLook = {
  fillColor: string | null;
  gradient: GradientFill | null;
  shadow: ShadowOptions;
};

const scratch = {
  src: null as HTMLCanvasElement | null,
  dst: null as HTMLCanvasElement | null,
};

function canvas(kind: "src" | "dst", w: number, h: number) {
  const existing = scratch[kind];
  const el = existing ?? document.createElement("canvas");
  if (!existing) scratch[kind] = el;
  if (el.width !== w) el.width = w;
  if (el.height !== h) el.height = h;
  const ctx = el.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  return { el, ctx };
}

export function computeLayout(
  sourceW: number,
  sourceH: number,
  bounds: Bounds | null,
  options: LayoutOptions,
): Layout {
  const canvasW = Math.max(1, Math.round(options.canvasWidth));
  const canvasH = Math.max(1, Math.round(options.canvasHeight));
  const pad = Math.max(0, Math.min(40, options.paddingPct)) / 100;
  const cropped = detectCroppedSides(bounds, sourceW, sourceH);
  const ignore = options.ignoreCroppedSides;

  const padX = canvasW * pad;
  const padY = canvasH * pad;
  const left = ignore && cropped.left ? 0 : padX;
  const top = ignore && cropped.top ? 0 : padY;
  const right = ignore && cropped.right ? canvasW : canvasW - padX;
  const bottom = ignore && cropped.bottom ? canvasH : canvasH - padY;
  const availW = Math.max(1, right - left);
  const availH = Math.max(1, bottom - top);

  const bbox = bounds ?? { x: 0, y: 0, w: sourceW, h: sourceH };

  let scale: number;
  let dx: number;
  let dy: number;

  if (options.mode === "original") {
    scale = Math.min(availW / sourceW, availH / sourceH);
    dx = left + (availW - sourceW * scale) / 2;
    dy = top + (availH - sourceH * scale) / 2;
    if (ignore) {
      if (cropped.left && !cropped.right) dx = left;
      if (cropped.right && !cropped.left) dx = right - sourceW * scale;
      if (cropped.top && !cropped.bottom) dy = top;
      if (cropped.bottom && !cropped.top) dy = bottom - sourceH * scale;
    }
  } else {
    scale = Math.min(availW / Math.max(1, bbox.w), availH / Math.max(1, bbox.h));
    dx = left + (availW - bbox.w * scale) / 2 - bbox.x * scale;
    dy = top + (availH - bbox.h * scale) / 2 - bbox.y * scale;
  }

  if (options.mode === "custom") {
    dx += options.offsetX;
    dy += options.offsetY;
  }

  return { dx, dy, scale, canvasWidth: canvasW, canvasHeight: canvasH };
}

export function isIdentityLayout(
  layout: Layout,
  sourceW: number,
  sourceH: number,
) {
  return (
    layout.canvasWidth === sourceW &&
    layout.canvasHeight === sourceH &&
    Math.abs(layout.scale - 1) < 0.0008 &&
    Math.abs(layout.dx) < 0.5 &&
    Math.abs(layout.dy) < 0.5
  );
}

function paintFill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: OutputLook,
) {
  if (look.gradient) {
    const rad = (look.gradient.angle * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const len = Math.hypot(w, h) / 2;
    const x0 = cx - Math.cos(rad) * len;
    const y0 = cy - Math.sin(rad) * len;
    const x1 = cx + Math.cos(rad) * len;
    const y1 = cy + Math.sin(rad) * len;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, look.gradient.from);
    g.addColorStop(1, look.gradient.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (look.fillColor) {
    const [r, g, b] = parseHex(look.fillColor);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
  }
}

export function renderOutput(
  subject: ImageData,
  layout: Layout,
  look: OutputLook,
  skipShadow = false,
): ImageData {
  const { canvasWidth: w, canvasHeight: h, dx, dy, scale } = layout;
  const src = canvas("src", subject.width, subject.height);
  src.ctx.putImageData(subject, 0, 0);
  const dst = canvas("dst", w, h);
  dst.ctx.setTransform(1, 0, 0, 1, 0, 0);
  dst.ctx.clearRect(0, 0, w, h);
  paintFill(dst.ctx, w, h, look);

  const dw = subject.width * scale;
  const dh = subject.height * scale;
  if (!skipShadow) {
    drawShadow(dst.ctx, src.el, dx, dy, dw, dh, look.shadow);
  }
  dst.ctx.imageSmoothingEnabled = true;
  dst.ctx.imageSmoothingQuality = "high";
  dst.ctx.drawImage(
    src.el,
    0,
    0,
    subject.width,
    subject.height,
    dx,
    dy,
    dw,
    dh,
  );
  return dst.ctx.getImageData(0, 0, w, h);
}

export function renderLayout(
  subject: ImageData,
  layout: Layout,
  fillColor: string | null,
): ImageData {
  return renderOutput(subject, layout, {
    fillColor,
    gradient: null,
    shadow: {
      enabled: false,
      style: "drop",
      opacity: 0,
      blur: 0,
      offsetX: 0,
      offsetY: 0,
      color: "#111113",
    },
  });
}

export function drawOverlay(
  dest: ImageData,
  overlay: ImageData,
  layout: Layout,
) {
  const src = canvas("src", overlay.width, overlay.height);
  src.ctx.putImageData(overlay, 0, 0);
  const dst = canvas("dst", dest.width, dest.height);
  dst.ctx.putImageData(dest, 0, 0);
  dst.ctx.imageSmoothingEnabled = true;
  dst.ctx.drawImage(
    src.el,
    0,
    0,
    overlay.width,
    overlay.height,
    layout.dx,
    layout.dy,
    overlay.width * layout.scale,
    overlay.height * layout.scale,
  );
  return dst.ctx.getImageData(0, 0, dest.width, dest.height);
}

export function canvasToSource(
  layout: Layout,
  x: number,
  y: number,
): { x: number; y: number } | null {
  if (layout.scale === 0) return null;
  return {
    x: (x - layout.dx) / layout.scale,
    y: (y - layout.dy) / layout.scale,
  };
}

export function layoutFromImage(
  image: ImageData,
  options: LayoutOptions,
): Layout {
  const bounds = subjectBounds(image);
  return computeLayout(image.width, image.height, bounds, options);
}
