const MAX_EDGE = 1800;
const MAX_BYTES = 20 * 1024 * 1024;

export type LoadedImage = {
  data: ImageData;
  naturalWidth: number;
  naturalHeight: number;
};

export function cloneImageData(source: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
}

export function extractAlpha(source: ImageData): Uint8Array {
  const alpha = new Uint8Array(source.width * source.height);
  const data = source.data;
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
    alpha[i] = data[p];
  }
  return alpha;
}

export function applyAlpha(target: ImageData, alpha: Uint8Array) {
  const data = target.data;
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
    data[p] = alpha[i];
  }
}

async function decodeImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  if (img.decode) {
    await img.decode();
    return img;
  }
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
  });
  return img;
}

export function rasterizeImage(
  image: CanvasImageSource & { width: number; height: number },
  maxEdge = MAX_EDGE,
): ImageData {
  const sourceWidth =
    "naturalWidth" in image && image.naturalWidth
      ? (image as HTMLImageElement).naturalWidth
      : image.width;
  const sourceHeight =
    "naturalHeight" in image && image.naturalHeight
      ? (image as HTMLImageElement).naturalHeight
      : image.height;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export async function imageFromSource(
  source: File | Blob | string,
): Promise<LoadedImage> {
  if (source instanceof Blob && source.size > MAX_BYTES) {
    throw new Error("Ukuran foto terlalu besar (maks 20MB).");
  }
  const url =
    typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = await decodeImage(url);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    return {
      data: rasterizeImage(image),
      naturalWidth,
      naturalHeight,
    };
  } catch {
    throw new Error("Gagal memuat gambar.");
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

export async function imageDataFromSource(
  source: File | Blob | string,
): Promise<ImageData> {
  return (await imageFromSource(source)).data;
}

function canvasFromImageData(data: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export async function imageDataToPngBlob(data: ImageData): Promise<Blob> {
  const canvas = canvasFromImageData(data);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Gagal menyimpan PNG.");
  return blob;
}

export async function imageDataToJpegBlob(
  data: ImageData,
  quality = 0.92,
): Promise<Blob> {
  const src = canvasFromImageData(data);
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, data.width, data.height);
  ctx.drawImage(src, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Gagal menyimpan JPG.");
  return blob;
}

export function imageDataToThumbUrl(data: ImageData, maxEdge = 560): string {
  const scale = Math.min(1, maxEdge / Math.max(data.width, data.height));
  const width = Math.max(1, Math.round(data.width * scale));
  const height = Math.max(1, Math.round(data.height * scale));
  const src = canvasFromImageData(data);
  if (scale === 1) return src.toDataURL("image/png");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

export function toJpgFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "gambar";
  return `${base}.jpg`;
}

export function toPngFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "gambar";
  return `${base}.png`;
}

export function uniqueFileName(name: string, used: Map<string, number>) {
  const count = (used.get(name) ?? 0) + 1;
  used.set(name, count);
  if (count === 1) return name;
  return name.replace(/(\.[^.]+)$/, `-${count}$1`);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
