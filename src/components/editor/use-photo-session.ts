import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  applyAlpha,
  cloneImageData,
  downloadBlob,
  extractAlpha,
  imageDataToJpegBlob,
  imageDataToPngBlob,
  imageDataToThumbUrl,
  imageFromSource,
  toJpgFileName,
  toPngFileName,
  uniqueFileName,
} from "@/lib/image/io";
import { composeSubject, paintBrush } from "@/lib/image/pixels";
import { removeImageBackground, type BgModel } from "@/lib/image/remove-bg";
import {
  canvasToSource,
  computeLayout,
  renderOutput,
  type GradientFill,
  type Layout,
  type PositionMode,
} from "@/lib/image/layout";
import {
  clearMask,
  cloneMask,
  createMask,
  maskBounds,
  maskCoverage,
  paintMask,
  redOverlayFromMask,
} from "@/lib/image/mask";
import {
  copyPatch,
  copyRgbKeepAlpha,
  extractPatch,
  inpaintTelea,
} from "@/lib/image/inpainting";
import {
  eraseMaskedAlpha,
  growGuidedCutout,
  subjectBounds,
} from "@/lib/image/cutout";
import { clampCanvas, findPreset } from "@/lib/image/presets";
import { makeZip } from "@/lib/image/zip";
import { applyColorGrade, type ColorGrade } from "@/lib/image/grade";
import {
  DEFAULT_SHADOW,
  type ShadowOptions,
  type ShadowStyle,
} from "@/lib/image/shadow";

export type BrushTool = "erase" | "restore";
export type ViewMode = "home" | "batch" | "edit";
export type BatchTool =
  | "template"
  | "resize"
  | "position"
  | "background"
  | "shadow"
  | "color";
export type EditTool = "cutout" | "retouch" | "outline" | "color";
export type StudioTool = BatchTool | EditTool;
export type CutoutMode = "guide" | "manual";
export type BatchStatus = "ready" | "processing" | "done" | "error";
export type ExportFormat = "png" | "jpg";

export type BatchItem = {
  id: string;
  name: string;
  thumbUrl: string;
  status: BatchStatus;
  outW: number;
  outH: number;
  naturalWidth: number;
  naturalHeight: number;
  hasCutout: boolean;
  error?: string;
};

type ItemBuffer = {
  original: ImageData;
  retouched: ImageData;
  base: ImageData;
  working: ImageData;
  mask: Uint8Array;
  undo: HistoryOp[];
  redo: HistoryOp[];
  hasCutout: boolean;
  brightness: number;
  outlineWidth: number;
  outlineColor: string;
  naturalWidth: number;
  naturalHeight: number;
};

type Progress = { percent: number; label: string };

type HistoryOp =
  | { kind: "alpha"; alpha: Uint8Array }
  | {
      kind: "patch";
      x: number;
      y: number;
      w: number;
      h: number;
      working: ImageData;
      base: ImageData;
      retouched: ImageData;
    };

const MAX_UNDO = 16;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePhotoSession() {
  const buffersRef = useRef<Map<string, ItemBuffer>>(new Map());
  const originalRef = useRef<ImageData | null>(null);
  const retouchedRef = useRef<ImageData | null>(null);
  const baseRef = useRef<ImageData | null>(null);
  const workingRef = useRef<ImageData | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const undoRef = useRef<HistoryOp[]>([]);
  const redoRef = useRef<HistoryOp[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const paintingRef = useRef(false);
  const panningRef = useRef(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const layoutKeyRef = useRef("");
  const boundsRef = useRef<ReturnType<typeof subjectBounds>>(null);
  const boundsKeyRef = useRef("");
  const batchBusyRef = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const itemsRef = useRef<BatchItem[]>([]);
  const thumbTimerRef = useRef<number | null>(null);

  const [fileName, setFileName] = useState("foto");
  const [revision, setRevision] = useState(0);
  const [maskRevision, setMaskRevision] = useState(0);
  const [hasCutout, setHasCutout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [view, setView] = useState<ViewMode>("home");
  const [activeTool, setActiveToolState] = useState<StudioTool>("template");
  const [brushTool, setBrushTool] = useState<BrushTool>("erase");
  const [cutoutMode, setCutoutMode] = useState<CutoutMode>("guide");
  const [brushSize, setBrushSize] = useState(36);
  const [brushHardness, setBrushHardness] = useState(0.55);
  const [guideTolerance, setGuideTolerance] = useState(62);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [outlineWidth, setOutlineWidth] = useState(0);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [gradient, setGradient] = useState<GradientFill | null>(null);
  const [shadow, setShadow] = useState<ShadowOptions>(DEFAULT_SHADOW);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [model, setModel] = useState<BgModel>("quality");
  const [showOriginal, setShowOriginal] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [compareAvailable, setCompareAvailable] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [positionMode, setPositionMode] = useState<PositionMode>("original");
  const [paddingPct, setPaddingPct] = useState(0);
  const [ignoreCroppedSides, setIgnoreCroppedSides] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [canvasHeight, setCanvasHeight] = useState(1000);
  const [presetId, setPresetId] = useState("original");
  const [lockAspect, setLockAspect] = useState(true);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bgDialogOpen, setBgDialogOpen] = useState(false);

  itemsRef.current = batchItems;
  editingIdRef.current = editingId;

  const layoutSnapshot = {
    canvasWidth,
    canvasHeight,
    presetId,
    positionMode,
    paddingPct,
    ignoreCroppedSides,
    offsetX,
    offsetY,
    fillColor,
    gradient,
    shadow,
    brightness,
    contrast,
    saturation,
    warmth,
  };
  const layoutSnapshotRef = useRef(layoutSnapshot);
  layoutSnapshotRef.current = layoutSnapshot;

  const bump = useCallback(() => {
    setRevision((n) => n + 1);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const bumpMask = useCallback(() => {
    const coverage = maskRef.current ? maskCoverage(maskRef.current) : 0;
    setHasMask(coverage > 0);
    setMaskRevision((n) => n + 1);
  }, []);

  const bumpSoon = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      bump();
    });
  }, [bump]);

  const layoutOptionsFor = useCallback(
    (sourceW: number, sourceH: number) => {
      const snap = layoutSnapshotRef.current;
      return {
        canvasWidth: snap.presetId === "original" ? sourceW : snap.canvasWidth,
        canvasHeight: snap.presetId === "original" ? sourceH : snap.canvasHeight,
        mode: snap.positionMode,
        paddingPct: snap.paddingPct,
        ignoreCroppedSides: snap.ignoreCroppedSides,
        offsetX: snap.offsetX,
        offsetY: snap.offsetY,
      };
    },
    [],
  );

  const composeFrom = useCallback(
    (
      working: ImageData,
      itemOutlineWidth: number,
      itemOutlineColor: string,
      live = false,
    ) => {
      const snap = layoutSnapshotRef.current;
      const opts = layoutOptionsFor(working.width, working.height);
      const bounds = subjectBounds(working);
      const layout = computeLayout(
        working.width,
        working.height,
        bounds,
        opts,
      );
      if (workingRef.current === working) {
        layoutRef.current = layout;
      }
      const grade: ColorGrade = {
        brightness: snap.brightness,
        contrast: snap.contrast,
        saturation: snap.saturation,
        warmth: snap.warmth,
      };
      const graded = applyColorGrade(working, grade);
      const composed = composeSubject(graded, {
        brightness: 0,
        outlineWidth: itemOutlineWidth,
        outlineColor: itemOutlineColor,
        fillColor: null,
        skipOutline: live && paintingRef.current,
      });
      return renderOutput(
        composed,
        layout,
        {
          fillColor: snap.fillColor,
          gradient: snap.gradient,
          shadow: snap.shadow,
        },
        live && paintingRef.current,
      );
    },
    [layoutOptionsFor],
  );

  const composeOutput = useCallback(
    (working: ImageData, live = false) =>
      composeFrom(working, outlineWidth, outlineColor, live),
    [composeFrom, outlineColor, outlineWidth],
  );

  const getLayout = useCallback((): Layout | null => {
    const working = workingRef.current;
    if (!working) return null;
    const opts = layoutOptionsFor(working.width, working.height);
    const boundsKey = `${working.width}x${working.height}:${revision}`;
    if (boundsKeyRef.current !== boundsKey) {
      boundsRef.current = subjectBounds(working);
      boundsKeyRef.current = boundsKey;
    }
    const key = `${boundsKey}:${opts.canvasWidth}x${opts.canvasHeight}:${opts.mode}:${opts.paddingPct}:${opts.ignoreCroppedSides}:${opts.offsetX}:${opts.offsetY}`;
    if (layoutRef.current && layoutKeyRef.current === key) {
      return layoutRef.current;
    }
    const layout = computeLayout(
      working.width,
      working.height,
      boundsRef.current,
      opts,
    );
    layoutRef.current = layout;
    layoutKeyRef.current = key;
    return layout;
  }, [layoutOptionsFor, revision]);

  const patchItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const thumbForBuffer = useCallback(
    (buf: ItemBuffer) => {
      const composed = composeFrom(
        buf.working,
        buf.outlineWidth,
        buf.outlineColor,
        false,
      );
      return {
        thumbUrl: imageDataToThumbUrl(composed),
        outW: composed.width,
        outH: composed.height,
      };
    },
    [composeFrom],
  );

  const refreshItemThumb = useCallback(
    (id: string) => {
      const buf = buffersRef.current.get(id);
      if (!buf) return;
      const thumb = thumbForBuffer(buf);
      patchItem(id, {
        ...thumb,
        hasCutout: buf.hasCutout,
      });
    },
    [patchItem, thumbForBuffer],
  );

  const refreshAllThumbs = useCallback(() => {
    setBatchItems((prev) =>
      prev.map((item) => {
        const buf = buffersRef.current.get(item.id);
        if (!buf) return item;
        const thumb = thumbForBuffer(buf);
        return {
          ...item,
          ...thumb,
          hasCutout: buf.hasCutout,
        };
      }),
    );
  }, [thumbForBuffer]);

  const scheduleThumbRefresh = useCallback(() => {
    if (thumbTimerRef.current != null) {
      window.clearTimeout(thumbTimerRef.current);
    }
    thumbTimerRef.current = window.setTimeout(() => {
      thumbTimerRef.current = null;
      refreshAllThumbs();
    }, 70);
  }, [refreshAllThumbs]);

  useEffect(() => {
    if (batchItems.length === 0) return;
    scheduleThumbRefresh();
  }, [
    batchItems.length,
    canvasHeight,
    canvasWidth,
    fillColor,
    gradient,
    ignoreCroppedSides,
    offsetX,
    offsetY,
    paddingPct,
    positionMode,
    presetId,
    brightness,
    contrast,
    saturation,
    warmth,
    shadow,
    scheduleThumbRefresh,
  ]);

  const persistActiveEdits = useCallback(() => {
    const id = editingIdRef.current;
    if (!id) return;
    const buf = buffersRef.current.get(id);
    if (!buf || !workingRef.current) return;
    buf.working = workingRef.current;
    if (baseRef.current) buf.base = baseRef.current;
    if (retouchedRef.current) buf.retouched = retouchedRef.current;
    if (maskRef.current) buf.mask = maskRef.current;
    buf.undo = undoRef.current;
    buf.redo = redoRef.current;
    buf.hasCutout = hasCutout;
    buf.brightness = brightness;
    buf.outlineWidth = outlineWidth;
    buf.outlineColor = outlineColor;
    refreshItemThumb(id);
  }, [
    brightness,
    hasCutout,
    outlineColor,
    outlineWidth,
    refreshItemThumb,
  ]);

  const bumpAndSync = useCallback(() => {
    persistActiveEdits();
    bump();
  }, [bump, persistActiveEdits]);

  const loadItemIntoEditor = useCallback(
    (id: string) => {
      const buf = buffersRef.current.get(id);
      if (!buf) return false;
      originalRef.current = buf.original;
      retouchedRef.current = buf.retouched;
      baseRef.current = buf.base;
      workingRef.current = buf.working;
      maskRef.current = buf.mask;
      undoRef.current = buf.undo;
      redoRef.current = buf.redo;
      lastPointRef.current = null;
      setHasCutout(buf.hasCutout);
      setCompareAvailable(buf.hasCutout);
      setShowOriginal(false);
      setOutlineWidth(buf.outlineWidth);
      setOutlineColor(buf.outlineColor);      setBrushTool("erase");
      setCutoutMode("guide");
      setHasMask(maskCoverage(buf.mask) > 0);
      setCanUndo(buf.undo.length > 0);
      setCanRedo(buf.redo.length > 0);
      setEditingId(id);
      setView("edit");
      setActiveToolState("cutout");
      bump();
      bumpMask();
      return true;
    },
    [bump, bumpMask],
  );

  const addBatchFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        toast.error("Pilih berkas gambar.");
        return;
      }
      setProcessing(true);
      setProgress({ percent: 4, label: "Membuka foto" });
      try {
        const next: BatchItem[] = [];
        for (let i = 0; i < images.length; i++) {
          const file = images[i]!;
          setProgress({
            percent: Math.round(((i + 0.2) / images.length) * 100),
            label: `Membuka ${i + 1}/${images.length}`,
          });
          const loaded = await imageFromSource(file);
          const id = uid();
          const working = loaded.data;
          const buf: ItemBuffer = {
            original: cloneImageData(working),
            retouched: cloneImageData(working),
            base: cloneImageData(working),
            working,
            mask: createMask(working.width, working.height),
            undo: [],
            redo: [],
            hasCutout: false,
            brightness: 0,
            outlineWidth: 0,
            outlineColor: "#ffffff",
            naturalWidth: loaded.naturalWidth,
            naturalHeight: loaded.naturalHeight,
          };
          buffersRef.current.set(id, buf);
          const thumb = thumbForBuffer(buf);
          next.push({
            id,
            name: file.name,
            status: "ready",
            hasCutout: false,
            naturalWidth: loaded.naturalWidth,
            naturalHeight: loaded.naturalHeight,
            ...thumb,
          });
        }
        setBatchItems((prev) => [...prev, ...next]);
        setView("batch");
        if (activeTool !== "template" && activeTool !== "resize" && activeTool !== "position" && activeTool !== "background") {
          setActiveToolState("template");
        }
        toast.success(
          next.length === 1
            ? "Foto ditambahkan."
            : `${next.length} foto ditambahkan.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal membuka foto.",
        );
      } finally {
        setProcessing(false);
        setProgress(null);
      }
    },
    [activeTool, thumbForBuffer],
  );

  const addFromUrl = useCallback(
    async (src: string, label: string) => {
      const res = await fetch(src);
      if (!res.ok) throw new Error("Gagal memuat contoh.");
      const blob = await res.blob();
      const file = new File([blob], `${label}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      await addBatchFiles([file]);
    },
    [addBatchFiles],
  );

  const removeBatchItem = useCallback(
    (id: string) => {
      buffersRef.current.delete(id);
      setBatchItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (next.length === 0) {
          setView("home");
          setEditingId(null);
        } else if (editingIdRef.current === id) {
          setEditingId(null);
          setView("batch");
        }
        return next;
      });
      if (editingIdRef.current === id) {
        originalRef.current = null;
        workingRef.current = null;
        baseRef.current = null;
        retouchedRef.current = null;
        maskRef.current = null;
      }
    },
    [],
  );

  const clearBatch = useCallback(() => {
    buffersRef.current.clear();
    setBatchItems([]);
    setEditingId(null);
    setView("home");
    originalRef.current = null;
    workingRef.current = null;
    baseRef.current = null;
    retouchedRef.current = null;
    maskRef.current = null;
    undoRef.current = [];
    redoRef.current = [];
    setHasCutout(false);
    setHasMask(false);
    bump();
  }, [bump]);

  const clearSession = useCallback(() => {
    persistActiveEdits();
    if (view === "edit") {
      setEditingId(null);
      setView("batch");
      setActiveToolState("template");
      return;
    }
    clearBatch();
  }, [clearBatch, persistActiveEdits, view]);

  const openEdit = useCallback(
    (id: string) => {
      persistActiveEdits();
      const item = itemsRef.current.find((it) => it.id === id);
      if (item) setFileName(item.name.replace(/\.[^.]+$/, "") || "foto");
      loadItemIntoEditor(id);
    },
    [loadItemIntoEditor, persistActiveEdits],
  );

  const closeEdit = useCallback(() => {
    persistActiveEdits();
    setEditingId(null);
    setShowOriginal(false);
    setView("batch");
    setActiveToolState("template");
    if (maskRef.current) {
      clearMask(maskRef.current);
      bumpMask();
    }
  }, [bumpMask, persistActiveEdits]);

  const setActiveTool = useCallback(
    (tool: StudioTool) => {
      if (tool !== "retouch" && maskRef.current) {
        clearMask(maskRef.current);
        bumpMask();
      }
      setActiveToolState(tool);
      if (tool === "cutout") setBrushTool("erase");
    },
    [bumpMask],
  );

  const applyPreset = useCallback((id: string) => {
    const preset = findPreset(id);
    setPresetId(id);
    if (preset.width == null) {
      const first = itemsRef.current[0];
      const buf = first ? buffersRef.current.get(first.id) : null;
      if (buf) {
        setCanvasWidth(buf.working.width);
        setCanvasHeight(buf.working.height);
      }
    } else {
      setCanvasWidth(preset.width);
      setCanvasHeight(preset.height ?? preset.width);
    }
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  const setCanvasSize = useCallback(
    (nextW: number, nextH: number, from: "width" | "height" | "both") => {
      let w = clampCanvas(nextW);
      let h = clampCanvas(nextH);
      if (lockAspect && from !== "both") {
        const aspect = canvasWidth / Math.max(1, canvasHeight);
        if (from === "width") h = clampCanvas(w / aspect);
        else w = clampCanvas(h * aspect);
      }
      setCanvasWidth(w);
      setCanvasHeight(h);
      setPresetId("custom");
    },
    [canvasHeight, canvasWidth, lockAspect],
  );

  const pushAlphaUndo = useCallback(() => {
    const working = workingRef.current;
    if (!working) return;
    undoRef.current.push({ kind: "alpha", alpha: extractAlpha(working) });
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const pushPatchUndo = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const working = workingRef.current;
      const base = baseRef.current;
      const retouched = retouchedRef.current;
      if (!working || !base || !retouched) return;
      const pad = 8;
      const px = Math.max(0, x - pad);
      const py = Math.max(0, y - pad);
      const pw = Math.min(working.width - px, w + pad * 2);
      const ph = Math.min(working.height - py, h + pad * 2);
      undoRef.current.push({
        kind: "patch",
        x: px,
        y: py,
        w: pw,
        h: ph,
        working: extractPatch(working, px, py, pw, ph),
        base: extractPatch(base, px, py, pw, ph),
        retouched: extractPatch(retouched, px, py, pw, ph),
      });
      if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
      redoRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    },
    [],
  );

  const snapshotFull = useCallback(() => {
    const working = workingRef.current;
    const base = baseRef.current;
    const retouched = retouchedRef.current;
    if (!working || !base || !retouched) return null;
    return {
      kind: "patch" as const,
      x: 0,
      y: 0,
      w: working.width,
      h: working.height,
      working: cloneImageData(working),
      base: cloneImageData(base),
      retouched: cloneImageData(retouched),
    };
  }, []);

  const applyOp = useCallback((op: HistoryOp, into: "undo" | "redo") => {
    const working = workingRef.current;
    const base = baseRef.current;
    const retouched = retouchedRef.current;
    if (!working || !base || !retouched) return;
    if (op.kind === "alpha") {
      const current = extractAlpha(working);
      applyAlpha(working, op.alpha);
      const inverse: HistoryOp = { kind: "alpha", alpha: current };
      if (into === "undo") redoRef.current.push(inverse);
      else undoRef.current.push(inverse);
    } else {
      const inverse: HistoryOp = {
        kind: "patch",
        x: op.x,
        y: op.y,
        w: op.w,
        h: op.h,
        working: extractPatch(working, op.x, op.y, op.w, op.h),
        base: extractPatch(base, op.x, op.y, op.w, op.h),
        retouched: extractPatch(retouched, op.x, op.y, op.w, op.h),
      };
      copyPatch(working, op.working, op.x, op.y, op.w, op.h);
      copyPatch(base, op.base, op.x, op.y, op.w, op.h);
      copyPatch(retouched, op.retouched, op.x, op.y, op.w, op.h);
      if (into === "undo") redoRef.current.push(inverse);
      else undoRef.current.push(inverse);
    }
  }, []);

  const undo = useCallback(() => {
    if (view !== "edit") return;
    const op = undoRef.current.pop();
    if (!op) return;
    applyOp(op, "undo");
    bumpAndSync();
  }, [applyOp, bumpAndSync, view]);

  const redo = useCallback(() => {
    if (view !== "edit") return;
    const op = redoRef.current.pop();
    if (!op) return;
    applyOp(op, "redo");
    bumpAndSync();
  }, [applyOp, bumpAndSync, view]);

  const processAllBackgrounds = useCallback(
    async (nextModel: BgModel) => {
      if (batchBusyRef.current) return;
      const ids = itemsRef.current.map((item) => item.id);
      if (ids.length === 0) {
        toast.error("Tambah foto dulu.");
        return;
      }
      persistActiveEdits();
      batchBusyRef.current = true;
      setModel(nextModel);
      setProcessing(true);
      setBgDialogOpen(false);
      try {
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i]!;
          patchItem(id, { status: "processing", error: undefined });
          setProgress({
            percent: Math.round((i / ids.length) * 100),
            label: `Batch ${i + 1}/${ids.length}`,
          });
          try {
            const buf = buffersRef.current.get(id);
            if (!buf) continue;
            const cutout = await removeImageBackground(
              buf.retouched,
              nextModel,
              (percent, label) => {
                const overall = Math.round(
                  ((i + percent / 100) / ids.length) * 100,
                );
                setProgress({
                  percent: overall,
                  label: `${label} · ${i + 1}/${ids.length}`,
                });
              },
            );
            buf.working = cutout;
            buf.base = cloneImageData(cutout);
            buf.hasCutout = true;
            buf.undo = [];
            buf.redo = [];
            if (editingIdRef.current === id) {
              workingRef.current = cutout;
              baseRef.current = buf.base;
              undoRef.current = [];
              redoRef.current = [];
              setHasCutout(true);
              setCompareAvailable(true);
              setCanUndo(false);
              setCanRedo(false);
            }
            const thumb = thumbForBuffer(buf);
            patchItem(id, {
              status: "done",
              hasCutout: true,
              ...thumb,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Gagal memproses.";
            patchItem(id, { status: "error", error: message });
          }
        }
        bump();
        toast.success("Background dihapus. Batch sudah diperbarui.");
      } finally {
        batchBusyRef.current = false;
        setProcessing(false);
        setProgress(null);
      }
    },
    [bump, patchItem, persistActiveEdits, thumbForBuffer],
  );

  const paintAt = useCallback(
    (x: number, y: number) => {
      const working = workingRef.current;
      const base = baseRef.current;
      const mask = maskRef.current;
      if (!working) return;
      if (activeTool === "retouch" && mask) {
        paintMask(
          mask,
          working.width,
          working.height,
          x,
          y,
          brushSize / 2,
          brushHardness,
          255,
        );
        return;
      }
      if (activeTool === "cutout" && cutoutMode === "guide" && mask) {
        paintMask(
          mask,
          working.width,
          working.height,
          x,
          y,
          brushSize / 2,
          0.9,
          255,
        );
        return;
      }
      if (!base) return;
      paintBrush(
        working,
        base,
        x,
        y,
        brushSize / 2,
        brushHardness,
        brushTool,
      );
    },
    [activeTool, brushHardness, brushSize, brushTool, cutoutMode],
  );

  const isPaintTool =
    view === "edit" && (activeTool === "retouch" || activeTool === "cutout");

  const isPanTool =
    view === "edit" &&
    activeTool === "position" &&
    positionMode === "custom";

  const beginStroke = useCallback(
    (canvasX: number, canvasY: number) => {
      const working = workingRef.current;
      if (!working || processing || view !== "edit") return;
      const layout = getLayout();
      if (!layout) return;
      const src = canvasToSource(layout, canvasX, canvasY);
      if (!src) return;

      if (isPanTool) {
        panningRef.current = true;
        panStartRef.current = {
          x: canvasX,
          y: canvasY,
          ox: offsetX,
          oy: offsetY,
        };
        return;
      }
      if (activeTool !== "retouch" && activeTool !== "cutout") return;
      if (activeTool === "cutout" && !hasCutout) return;

      paintingRef.current = true;
      if (activeTool === "cutout" && cutoutMode === "manual") {
        pushAlphaUndo();
      }
      paintAt(src.x, src.y);
      lastPointRef.current = src;
      if (
        activeTool === "retouch" ||
        (activeTool === "cutout" && cutoutMode === "guide")
      ) {
        bumpMask();
      } else {
        bump();
      }
    },
    [
      activeTool,
      bump,
      bumpMask,
      cutoutMode,
      getLayout,
      hasCutout,
      isPanTool,
      offsetX,
      offsetY,
      paintAt,
      processing,
      pushAlphaUndo,
      view,
    ],
  );

  const moveStroke = useCallback(
    (canvasX: number, canvasY: number) => {
      if (panningRef.current && panStartRef.current) {
        const start = panStartRef.current;
        setOffsetX(start.ox + (canvasX - start.x));
        setOffsetY(start.oy + (canvasY - start.y));
        return;
      }
      const working = workingRef.current;
      const last = lastPointRef.current;
      const layout = layoutRef.current ?? getLayout();
      if (!paintingRef.current || !working || !last || !layout) return;
      const src = canvasToSource(layout, canvasX, canvasY);
      if (!src) return;
      const dx = src.x - last.x;
      const dy = src.y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, brushSize * 0.22);
      const steps = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        paintAt(last.x + dx * t, last.y + dy * t);
      }
      lastPointRef.current = src;
      if (
        activeTool === "retouch" ||
        (activeTool === "cutout" && cutoutMode === "guide")
      ) {
        bumpMask();
      } else {
        bumpSoon();
      }
    },
    [activeTool, brushSize, bumpMask, bumpSoon, cutoutMode, getLayout, paintAt],
  );

  const applyGuidedCutout = useCallback(() => {
    const working = workingRef.current;
    const mask = maskRef.current;
    if (!working || !mask || !hasCutout) return;
    if (maskCoverage(mask) < 8) {
      clearMask(mask);
      bumpMask();
      return;
    }
    const grown = growGuidedCutout(working, cloneMask(mask), guideTolerance);
    pushAlphaUndo();
    eraseMaskedAlpha(working, grown, 1);
    clearMask(mask);
    bumpMask();
    bumpAndSync();
  }, [
    bumpAndSync,
    bumpMask,
    guideTolerance,
    hasCutout,
    pushAlphaUndo,
  ]);

  const endStroke = useCallback(() => {
    const wasPainting = paintingRef.current;
    const wasPanning = panningRef.current;
    paintingRef.current = false;
    panningRef.current = false;
    lastPointRef.current = null;
    panStartRef.current = null;
    if (wasPainting && activeTool === "cutout" && cutoutMode === "guide") {
      applyGuidedCutout();
      return;
    }
    if (wasPainting || wasPanning) bumpAndSync();
  }, [activeTool, applyGuidedCutout, bumpAndSync, cutoutMode]);

  const clearRetouchMask = useCallback(() => {
    if (!maskRef.current) return;
    clearMask(maskRef.current);
    bumpMask();
  }, [bumpMask]);

  const applyRetouch = useCallback(async () => {
    const retouched = retouchedRef.current;
    const working = workingRef.current;
    const base = baseRef.current;
    const mask = maskRef.current;
    if (!retouched || !working || !base || !mask || processing) return;
    if (maskCoverage(mask) < 8) {
      toast.error("Sapu dulu objek atau watermark yang ingin dihapus.");
      return;
    }
    const bounds = maskBounds(mask, working.width, working.height, 8);
    setProcessing(true);
    setProgress({ percent: 6, label: "Menghapus objek" });
    try {
      if (bounds) pushPatchUndo(bounds.x, bounds.y, bounds.w, bounds.h);
      else {
        const full = snapshotFull();
        if (full) {
          undoRef.current.push(full);
          redoRef.current = [];
        }
      }
      const filled = await inpaintTelea(retouched, mask, (percent) => {
        setProgress({ percent: Math.max(6, percent), label: "Mengisi area" });
      });
      retouchedRef.current = filled;
      copyRgbKeepAlpha(working, filled);
      copyRgbKeepAlpha(base, filled);
      const id = editingIdRef.current;
      if (id) {
        const buf = buffersRef.current.get(id);
        if (buf) buf.retouched = filled;
      }
      clearMask(mask);
      bumpMask();
      bumpAndSync();
      toast.success("Objek dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal meretouch foto.",
      );
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [bumpAndSync, bumpMask, processing, pushPatchUndo, snapshotFull]);

  const getPreview = useCallback(
    (live = false) => {
      if (showOriginal) return originalRef.current;
      const working = workingRef.current;
      if (!working) return null;
      return composeOutput(working, live);
    },
    [composeOutput, showOriginal],
  );

  const getMaskOverlay = useCallback(() => {
    const mask = maskRef.current;
    const working = workingRef.current;
    if (!mask || !working || !hasMask) return null;
    return redOverlayFromMask(mask, working.width, working.height);
  }, [hasMask]);

  const exportCurrent = useCallback(async () => {
    persistActiveEdits();
    const targets =
      view === "edit" && editingIdRef.current
        ? itemsRef.current.filter((item) => item.id === editingIdRef.current)
        : itemsRef.current;
    if (targets.length === 0) {
      toast.error("Tidak ada foto untuk diunduh.");
      return;
    }
    const used = new Map<string, number>();
    if (targets.length === 1) {
      const item = targets[0]!;
      const buf = buffersRef.current.get(item.id);
      if (!buf) return;
      const composed = composeFrom(
        buf.working,
        buf.outlineWidth,
        buf.outlineColor,
        false,
      );
      const usePng = exportFormat === "png";
      const blob = usePng
        ? await imageDataToPngBlob(composed)
        : await imageDataToJpegBlob(composed);
      downloadBlob(
        blob,
        uniqueFileName(
          usePng ? toPngFileName(item.name) : toJpgFileName(item.name),
          used,
        ),
      );
      toast.success(usePng ? "PNG disimpan." : "JPG disimpan.");
      return;
    }
    const files = [];
    for (const item of targets) {
      const buf = buffersRef.current.get(item.id);
      if (!buf) continue;
      const composed = composeFrom(
        buf.working,
        buf.outlineWidth,
        buf.outlineColor,
        false,
      );
      const usePng = exportFormat === "png";
      const blob = usePng
        ? await imageDataToPngBlob(composed)
        : await imageDataToJpegBlob(composed);
      files.push({
        name: uniqueFileName(
          usePng ? toPngFileName(item.name) : toJpgFileName(item.name),
          used,
        ),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    if (files.length === 0) return;
    const zip = makeZip(files);
    downloadBlob(zip, "klaro-batch.zip");
    toast.success("ZIP batch disimpan.");
  }, [composeFrom, exportFormat, persistActiveEdits, view]);

  const setItemOutlineWidth = useCallback(
    (value: number) => {
      setOutlineWidth(value);
      const id = editingIdRef.current;
      if (!id) return;
      const buf = buffersRef.current.get(id);
      if (buf) buf.outlineWidth = value;
    },
    [],
  );

  const setItemOutlineColor = useCallback((value: string) => {
    setOutlineColor(value);
    const id = editingIdRef.current;
    if (!id) return;
    const buf = buffersRef.current.get(id);
    if (buf) buf.outlineColor = value;
  }, []);

  const setItemBrightness = useCallback((value: number) => {
    setBrightness(value);
    const id = editingIdRef.current;
    if (!id) return;
    const buf = buffersRef.current.get(id);
    if (buf) buf.brightness = value;
  }, []);

  useEffect(() => {
    if (view !== "edit" || !editingId) return;
    const t = window.setTimeout(() => refreshItemThumb(editingId), 50);
    return () => window.clearTimeout(t);
  }, [
    brightness,
    contrast,
    saturation,
    warmth,
    editingId,
    outlineColor,
    outlineWidth,
    refreshItemThumb,
    shadow,
    fillColor,
    gradient,
    view,
  ]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void exportCurrent();
      }
      if (event.code === "Space" && view === "edit" && compareAvailable) {
        event.preventDefault();
        setShowOriginal(true);
      }
      if (event.key === "Escape" && view === "edit") {
        event.preventDefault();
        closeEdit();
      }
      if (event.key === "[") setBrushSize((n) => Math.max(6, n - 4));
      if (event.key === "]") setBrushSize((n) => Math.min(160, n + 4));
      if (event.key.toLowerCase() === "e") setBrushTool("erase");
      if (event.key.toLowerCase() === "r") setBrushTool("restore");
      if (isPanTool && !event.metaKey && !event.ctrlKey) {
        const step = event.shiftKey ? 10 : 2;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setOffsetX((n) => n - step);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setOffsetX((n) => n + step);
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setOffsetY((n) => n - step);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOffsetY((n) => n + step);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setShowOriginal(false);
    }
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [closeEdit, compareAvailable, exportCurrent, isPanTool, redo, undo, view]);

  const sourceSize = workingRef.current
    ? { width: workingRef.current.width, height: workingRef.current.height }
    : null;
  const outputSize = sourceSize
    ? {
        width:
          presetId === "original" ? sourceSize.width : canvasWidth,
        height:
          presetId === "original" ? sourceSize.height : canvasHeight,
      }
    : null;

  const hasImage = batchItems.length > 0;

  return {
    fileName,
    revision,
    maskRevision,
    hasImage,
    hasCutout,
    processing,
    progress,
    view,
    activeTool,
    setActiveTool,
    brushTool,
    setBrushTool,
    cutoutMode,
    setCutoutMode,
    brushSize,
    setBrushSize,
    brushHardness,
    setBrushHardness,
    guideTolerance,
    setGuideTolerance,
    brightness,
    setBrightness: setItemBrightness,
    contrast,
    setContrast,
    saturation,
    setSaturation,
    warmth,
    setWarmth,
    outlineWidth,
    setOutlineWidth: setItemOutlineWidth,
    outlineColor,
    setOutlineColor: setItemOutlineColor,
    fillColor,
    setFillColor: (value: string | null) => {
      setFillColor(value);
      setGradient(null);
    },
    gradient,
    setGradient: (value: GradientFill | null) => {
      setGradient(value);
      if (value) setFillColor(null);
    },
    shadow,
    setShadowEnabled: (enabled: boolean) =>
      setShadow((prev) => ({ ...prev, enabled })),
    setShadowStyle: (style: ShadowStyle) =>
      setShadow((prev) => ({ ...prev, enabled: true, style })),
    setShadowOpacity: (opacity: number) =>
      setShadow((prev) => ({ ...prev, opacity })),
    setShadowBlur: (blur: number) => setShadow((prev) => ({ ...prev, blur })),
    setShadowOffsetX: (offsetX: number) =>
      setShadow((prev) => ({ ...prev, offsetX })),
    setShadowOffsetY: (offsetY: number) =>
      setShadow((prev) => ({ ...prev, offsetY })),
    setShadowColor: (color: string) =>
      setShadow((prev) => ({ ...prev, color })),
    applyShadowPreset: (value: ShadowOptions) => setShadow(value),
    exportFormat,
    setExportFormat,
    model,
    setModel,
    showOriginal,
    setShowOriginal,
    canUndo,
    canRedo,
    compareAvailable,
    hasMask,
    positionMode,
    setPositionMode: (mode: PositionMode) => {
      setPositionMode(mode);
      if (mode !== "custom") {
        setOffsetX(0);
        setOffsetY(0);
      }
    },
    paddingPct,
    setPaddingPct,
    ignoreCroppedSides,
    setIgnoreCroppedSides,
    offsetX,
    offsetY,
    canvasWidth,
    canvasHeight,
    presetId,
    applyPreset,
    setCanvasSize,
    lockAspect,
    setLockAspect,
    batchItems,
    editingId,
    bgDialogOpen,
    setBgDialogOpen,
    addBatchFiles,
    addFromUrl,
    removeBatchItem,
    clearBatch,
    openEdit,
    closeEdit,
    processAllBackgrounds,
    loadFromSource: addFromUrl,
    clearSession,
    beginStroke,
    moveStroke,
    endStroke,
    undo,
    redo,
    getPreview,
    getMaskOverlay,
    getLayout,
    exportPng: exportCurrent,
    exportCurrent,
    resetAdjustments: () => {
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      setWarmth(0);
      setOutlineWidth(0);
      setOutlineColor("#ffffff");
      setShadow(DEFAULT_SHADOW);
    },
    applyRetouch,
    clearRetouchMask,
    isPanTool,
    isPaintTool,
    imageSize: outputSize,
    sourceSize,
  };
}

export type PhotoSession = ReturnType<typeof usePhotoSession>;
