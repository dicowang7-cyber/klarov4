import { useEffect, useRef, useState } from "react";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { cn } from "@/lib/utils";

type StageProps = {
  session: PhotoSession;
};

type Cursor = { x: number; y: number } | null;

function fitRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
) {
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    width,
    height,
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
    scale,
  };
}

export function Stage({ session }: StageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [fit, setFit] = useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    scale: 1,
  });
  const [cursor, setCursor] = useState<Cursor>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const size = session.imageSize;
  const source = session.sourceSize;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setBox({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!size || box.w === 0) return;
    setFit(fitRect(box.w, box.h, size.width, size.height));
  }, [box.h, box.w, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const frame = session.getPreview(true);
    ctx.clearRect(0, 0, size.width, size.height);
    if (frame) ctx.putImageData(frame, 0, 0);
  }, [
    session,
    session.revision,
    session.showOriginal,
    session.brightness,
    session.outlineWidth,
    session.outlineColor,
    session.fillColor,
    session.positionMode,
    session.paddingPct,
    session.ignoreCroppedSides,
    session.offsetX,
    session.offsetY,
    session.canvasWidth,
    session.canvasHeight,
    session.presetId,
    session.contrast,
    session.saturation,
    session.warmth,
    session.shadow,
    session.gradient,
    size,
  ]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !source) return;
    if (canvas.width !== source.width) canvas.width = source.width;
    if (canvas.height !== source.height) canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, source.width, source.height);
    const overlay = session.getMaskOverlay();
    if (overlay) ctx.putImageData(overlay, 0, 0);
  }, [session, session.maskRevision, session.hasMask, source]);

  function toOutputPoint(event: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas || !size) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * size.width;
    const y = ((event.clientY - rect.top) / rect.height) * size.height;
    return { x, y };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (session.processing || session.showOriginal) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pt = toOutputPoint(event);
    if (!pt) return;
    session.beginStroke(pt.x, pt.y);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const pt = toOutputPoint(event);
    if (!pt) return;
    setCursor({ x: event.clientX, y: event.clientY });
    if (event.buttons === 1 && !session.showOriginal) {
      session.moveStroke(pt.x, pt.y);
    }
  }

  const layout = session.getLayout();
  const displayScale = size && fit.width > 0 ? fit.width / size.width : 1;
  const brushCss =
    session.brushSize * (layout?.scale ?? 1) * (displayScale || 1);
  const overlayStyle =
    layout && source && fit.width > 0
      ? {
          width: source.width * layout.scale * displayScale,
          height: source.height * layout.scale * displayScale,
          left: fit.left + layout.dx * displayScale,
          top: fit.top + layout.dy * displayScale,
        }
      : null;

  const paintCursor =
    session.isPanTool ? (cursor ? "grabbing" : "grab") : session.showOriginal ? "default" : "none";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative min-h-[42vh] flex-1 overflow-hidden rounded-[var(--radius-lg)] lg:min-h-0",
        session.fillColor || session.gradient ? "bg-surface-2" : "studio-check",      )}
    >
      {size && fit.width > 0 && (
        <canvas
          ref={canvasRef}
          className="absolute touch-none"
          style={{
            width: fit.width,
            height: fit.height,
            left: fit.left,
            top: fit.top,
            cursor: paintCursor,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => session.endStroke()}
          onPointerCancel={() => session.endStroke()}
          onPointerLeave={() => {
            session.endStroke();
            setCursor(null);
          }}
        />
      )}

      {overlayStyle && !session.showOriginal && (
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute z-[1]"
          style={{
            ...overlayStyle,
            opacity: session.hasMask ? 1 : 0,
          }}
        />
      )}

      {cursor &&
        !session.showOriginal &&
        !session.processing &&
        session.isPaintTool && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 rounded-full border border-fg/70 mix-blend-difference"
            style={{
              width: brushCss,
              height: brushCss,
              left:
                cursor.x -
                (wrapRef.current?.getBoundingClientRect().left ?? 0) -
                brushCss / 2,
              top:
                cursor.y -
                (wrapRef.current?.getBoundingClientRect().top ?? 0) -
                brushCss / 2,
            }}
          />
        )}

      {session.processing && session.progress && (
        <div className="absolute inset-0 z-20 flex items-end bg-fg/25 p-4 sm:items-center sm:justify-center sm:p-8">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="font-display text-lg text-fg">
              {session.progress.label}
            </p>
            <p className="mt-1 text-sm text-muted">
              Model lokal dari folder model, tanpa unduhan.
            </p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)]"
                style={{ width: `${session.progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm tabular-nums text-subtle">
              {session.progress.percent}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
