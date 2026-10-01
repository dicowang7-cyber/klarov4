import { edgeCutout } from "@/lib/image/edge-cutout";
import {
  applyMatte,
  lumaGuide,
  maskLooksUseful,
  refineModelMask,
  toProbMask,
} from "@/lib/image/matte";

export type BgModel = "fast" | "quality";

export const MODEL_OPTIONS: {
  id: BgModel;
  label: string;
  file: string;
  hint: string;
}[] = [
  {
    id: "quality",
    label: "Studio",
    file: "rmbg-quant.onnx",
    hint: "RMBG 1.4 — deteksi produk utama, tepi halus",
  },
  {
    id: "fast",
    label: "Cepat",
    file: "u2netp.onnx",
    hint: "Lebih ringan, cocok untuk batch banyak foto",
  },
];

type ModelSpec = {
  local: string;
  remote: readonly string[];
  size: number;
  minBytes: number;
};

export const MODEL_SPECS: Record<BgModel, ModelSpec> = {
  quality: {
    local: "/model/rmbg-quant.onnx",
    remote: [
      "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx",
    ],
    size: 1024,
    minBytes: 1_000_000,
  },
  fast: {
    local: "/model/u2netp.onnx",
    remote: [
      "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
      "https://huggingface.co/skillsafe-ai/u2netp/resolve/main/u2netp.onnx",
    ],
    size: 320,
    minBytes: 200_000,
  },
};

export const MODEL_PATHS: Record<BgModel, string> = {
  fast: MODEL_SPECS.fast.local,
  quality: MODEL_SPECS.quality.local,
};

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const CACHE_NAME = "klaro-bg-models-v1";

type OrtTensor = { data: ArrayLike<number>; dims: readonly number[] };

type InferenceSession = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
};

type OrtModule = {
  env: {
    wasm: {
      wasmPaths: string;
      numThreads: number;
      simd: boolean;
      proxy: boolean;
    };
  };
  InferenceSession: {
    create: (
      path: string | ArrayBufferLike | Uint8Array,
      options: { executionProviders: string[]; graphOptimizationLevel: string },
    ) => Promise<InferenceSession>;
  };
  Tensor: new (
    type: string,
    data: Float32Array,
    dims: number[],
  ) => unknown;
};

let ortPromise: Promise<OrtModule> | null = null;
const sessions = new Map<string, Promise<InferenceSession>>();
const buffers = new Map<string, ArrayBuffer>();

async function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web").then((mod) => {
      const ort = mod as unknown as OrtModule;
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      ort.env.wasm.proxy = false;
      return ort;
    });
  }
  return ortPromise;
}

async function fetchArrayBuffer(
  url: string,
  minBytes: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const total = Number(res.headers.get("content-length") ?? "0");
    if (!res.body || !onProgress) {
      const buf = await res.arrayBuffer();
      return buf.byteLength >= minBytes ? buf : null;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(loaded, total > 0 ? total : loaded);
      }
    }
    const out = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out.byteLength >= minBytes ? out.buffer : null;
  } catch {
    return null;
  }
}

async function cachePut(url: string, buf: ArrayBuffer) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      url,
      new Response(buf, {
        headers: { "content-type": "application/octet-stream" },
      }),
    );
  } catch {
    /* private mode / unsupported */
  }
}

async function cacheGet(url: string, minBytes: number): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit) return null;
    const buf = await hit.arrayBuffer();
    return buf.byteLength >= minBytes ? buf : null;
  } catch {
    return null;
  }
}

async function resolveModelBuffer(
  spec: ModelSpec,
  onProgress: (percent: number, label: string) => void,
): Promise<ArrayBuffer> {
  const cachedMem = buffers.get(spec.local);
  if (cachedMem && cachedMem.byteLength >= spec.minBytes) return cachedMem;

  onProgress(8, "Menyiapkan model");
  const local = await fetchArrayBuffer(spec.local, spec.minBytes);
  if (local) {
    buffers.set(spec.local, local);
    return local;
  }

  const urls = [spec.local, ...spec.remote];
  for (const url of spec.remote) {
    const hit = await cacheGet(url, spec.minBytes);
    if (hit) {
      buffers.set(spec.local, hit);
      return hit;
    }
  }

  for (const url of urls.slice(1)) {
    onProgress(12, "Mengunduh model AI");
    const buf = await fetchArrayBuffer(url, spec.minBytes, (loaded, total) => {
      const frac = total > 0 ? loaded / total : 0.5;
      onProgress(12 + Math.round(frac * 16), "Mengunduh model AI");
    });
    if (buf) {
      buffers.set(spec.local, buf);
      void cachePut(url, buf);
      return buf;
    }
  }
  throw new Error("Model background tidak tersedia.");
}

async function createSession(
  ort: OrtModule,
  buffer: ArrayBuffer,
): Promise<InferenceSession> {
  const data = new Uint8Array(buffer);
  try {
    return await ort.InferenceSession.create(data, {
      executionProviders: ["webgpu", "wasm"],
      graphOptimizationLevel: "all",
    });
  } catch {
    return ort.InferenceSession.create(data, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  }
}

async function getSession(
  key: string,
  buffer: ArrayBuffer,
): Promise<InferenceSession> {
  const cached = sessions.get(key);
  if (cached) return cached;
  const pending = (async () => {
    const ort = await loadOrt();
    return createSession(ort, buffer);
  })();
  sessions.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    sessions.delete(key);
    throw error;
  }
}

function resizeImageData(source: ImageData, width: number, height: number) {
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
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function tensorFromImage(
  ort: OrtModule,
  image: ImageData,
  layout: "nchw" | "nhwc",
) {
  const { width, height, data } = image;
  const pixelCount = width * height;
  const floats = new Float32Array(pixelCount * 3);
  if (layout === "nchw") {
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      floats[i] = (data[p]! / 255 - MEAN[0]!) / STD[0]!;
      floats[pixelCount + i] = (data[p + 1]! / 255 - MEAN[1]!) / STD[1]!;
      floats[pixelCount * 2 + i] = (data[p + 2]! / 255 - MEAN[2]!) / STD[2]!;
    }
  } else {
    for (let i = 0, p = 0, o = 0; i < pixelCount; i++, p += 4, o += 3) {
      floats[o] = (data[p]! / 255 - MEAN[0]!) / STD[0]!;
      floats[o + 1] = (data[p + 1]! / 255 - MEAN[1]!) / STD[1]!;
      floats[o + 2] = (data[p + 2]! / 255 - MEAN[2]!) / STD[2]!;
    }
  }
  const dims =
    layout === "nchw" ? [1, 3, height, width] : [1, height, width, 3];
  return new ort.Tensor("float32", floats, dims);
}

function pickOutput(session: InferenceSession, result: Record<string, OrtTensor>) {
  const preferred = ["output", "1959", "mask", "alpha"];
  for (const name of preferred) {
    if (result[name]) return result[name]!;
  }
  const first = session.outputNames[0];
  if (first && result[first]) return result[first]!;
  const any = Object.values(result)[0];
  if (!any) throw new Error("Model tidak mengembalikan mask.");
  return any;
}

async function runOnnx(
  source: ImageData,
  model: BgModel,
  onProgress: (percent: number, label: string) => void,
): Promise<ImageData> {
  const spec = MODEL_SPECS[model];
  const buffer = await resolveModelBuffer(spec, onProgress);
  onProgress(30, "Menyiapkan model");
  const ort = await loadOrt();
  const session = await getSession(spec.local, buffer);
  onProgress(44, "Mendeteksi produk");

  const inputName = session.inputNames[0] ?? "input";
  const size = spec.size;
  const resized = resizeImageData(source, size, size);
  const tensor = tensorFromImage(ort, resized, "nchw");
  onProgress(58, "Memotong background");
  const result = await session.run({ [inputName]: tensor });
  const output = pickOutput(session, result);
  const dims = output.dims ?? [];
  const maskH = dims.length >= 2 ? Number(dims[dims.length - 2]) || size : size;
  const maskW = dims.length >= 1 ? Number(dims[dims.length - 1]) || size : size;
  onProgress(78, "Memilih produk utama");
  let mask = toProbMask(output.data, maskW, maskH);
  if (!maskLooksUseful(mask)) {
    throw new Error("Mask model tidak yakin.");
  }
  const guide = lumaGuide(resized.data, maskW, maskH);
  mask = refineModelMask(mask, maskW, maskH, guide, model === "fast" ? "fast" : "quality");
  onProgress(92, "Merapikan tepi");
  return applyMatte(source, mask, maskW, maskH);
}

export async function removeImageBackground(
  source: ImageData,
  model: BgModel,
  onProgress: (percent: number, label: string) => void,
): Promise<ImageData> {
  if (typeof window === "undefined") {
    throw new Error("Hapus background hanya tersedia di browser.");
  }
  const order: BgModel[] = model === "fast" ? ["fast", "quality"] : ["quality", "fast"];
  for (const id of order) {
    try {
      return await runOnnx(source, id, onProgress);
    } catch (error) {
      console.warn(`Model ${id} gagal, mencoba cadangan.`, error);
    }
  }
  onProgress(10, "Memotong background");
  const cut = edgeCutout(
    source,
    model === "fast" ? "fast" : "quality",
    (percent) => {
      onProgress(Math.max(10, percent), "Memotong background");
    },
  );
  onProgress(100, "Selesai");
  return cut;
}
