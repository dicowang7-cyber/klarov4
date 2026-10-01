import { useRef } from "react";
import { Download, Home, ImagePlus, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BatchGrid } from "@/components/editor/batch-grid";
import { EmptyStudio } from "@/components/editor/empty-studio";
import { ModelDialog } from "@/components/editor/model-dialog";
import { Stage } from "@/components/editor/stage";
import { StudioPanel } from "@/components/editor/studio-panel";
import { ToolRail } from "@/components/editor/tool-rail";
import { usePhotoSession } from "@/components/editor/use-photo-session";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Tip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function statusHint(session: ReturnType<typeof usePhotoSession>) {
  if (session.view === "batch") {
    return "Klik foto untuk edit atau hapus. Hapus BG memproses semua gambar.";
  }
  if (session.activeTool === "retouch") {
    return session.hasMask
      ? "Sapuan siap. Tekan Hapus objek."
      : "Sapu objek atau watermark, lalu terapkan.";
  }
  if (session.activeTool === "cutout") {
    if (!session.hasCutout) return "Hapus background dulu untuk memotong cutout.";
    return session.cutoutMode === "guide"
      ? "Gambar garis pada bagian cutout yang ingin dibuang."
      : "Hapus atau pulihkan tepi secara manual.";
  }
  if (session.activeTool === "outline") {
    return "Atur ukuran dan warna outline. Batch akan mengikuti hasil ini.";
  }
  if (session.activeTool === "shadow") {
    return "Pilih preset bayangan. Berlaku untuk seluruh batch.";
  }
  if (session.activeTool === "color") {
    return "Koreksi kecerahan, kontras, saturasi, dan kehangatan batch.";
  }
  if (session.activeTool === "position") {
    return session.positionMode === "custom"
      ? "Seret subjek, atur padding, atau kunci ke tengah."
      : "Asli menjaga letak foto. Tengah menempatkan subjek di kanvas.";
  }
  if (session.activeTool === "resize" || session.activeTool === "template") {
    return "Ukuran ini diterapkan ke semua foto di batch.";
  }
  return "Pilih tool di kiri untuk mengatur batch.";
}

export function PhotoEditor() {
  const session = usePhotoSession();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | File[] | null | undefined) {
    const files = list ? [...list] : [];
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (files.length > 0) toast.error("Pilih berkas gambar.");
      return;
    }
    await session.addBatchFiles(images);
  }

  async function handleSample(src: string, label: string) {
    try {
      await session.addFromUrl(src, label);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat contoh.",
      );
    }
  }

  function openPicker() {
    fileRef.current?.click();
  }

  function onHome() {
    if (session.view === "edit") session.closeEdit();
  }

  const showStudio = session.hasImage;
  const showPanel = showStudio;

  return (
    <TooltipProvider>
      <div
        className="relative flex h-dvh flex-col bg-bg text-fg"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) =>
            f.type.startsWith("image/"),
          );
          if (files.length) void handleFiles(files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg"
          multiple
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          suppressHydrationWarning
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />

        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:h-14 sm:px-4">
          <div className="flex min-w-0 items-center gap-1">
            <Tip label="Beranda">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onHome}
                aria-label="Beranda"
              >
                <Home />
              </Button>
            </Tip>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            {showStudio ? (
              <>
                <Tip label="Undo">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!session.canUndo || session.processing}
                    onClick={session.undo}
                    aria-label="Undo"
                  >
                    <Undo2 />
                  </Button>
                </Tip>
                <Tip label="Redo">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!session.canRedo || session.processing}
                    onClick={session.redo}
                    aria-label="Redo"
                  >
                    <Redo2 />
                  </Button>
                </Tip>
                <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openPicker}
                  disabled={session.processing}
                >
                  <ImagePlus />
                  <span className="hidden sm:inline">Tambah gambar</span>
                </Button>
              </>
            ) : (
              <span className="text-sm font-semibold tracking-[-0.02em]">
                Klaro
              </span>
            )}
          </div>

          {showStudio ? (
            <div className="flex min-w-0 items-center gap-2">
              <p className="hidden truncate text-sm tabular-nums text-muted sm:block">
                {session.batchItems.length} foto
              </p>
              <div className="grid grid-cols-2 rounded-[var(--radius-sm)] bg-surface-2 p-0.5">
                {(["png", "jpg"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => session.setExportFormat(format)}
                    className={
                      session.exportFormat === format
                        ? "h-8 rounded-[6px] bg-surface px-2.5 text-xs font-medium uppercase text-fg shadow-[var(--shadow-border)]"
                        : "h-8 rounded-[6px] px-2.5 text-xs font-medium uppercase text-muted"
                    }
                  >
                    {format}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={() => void session.exportCurrent()}
                disabled={session.processing}
              >
                <Download />
                {session.view === "edit" || session.batchItems.length === 1
                  ? "Unduh"
                  : "Unduh ZIP"}
              </Button>
            </div>
          ) : null}
        </header>

        {!showStudio ? (
          <EmptyStudio onPickFile={openPicker} onSample={handleSample} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <ToolRail
              session={session}
              view={session.view}
              onRemoveBg={() => session.setBgDialogOpen(true)}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {session.view === "edit" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
                  <Stage session={session} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="hidden text-sm text-muted sm:block">
                      {statusHint(session)}
                    </p>
                    {session.compareAvailable && (
                      <button
                        type="button"
                        className="h-11 rounded-[var(--radius-sm)] bg-surface-2 px-3 text-sm font-medium"
                        onPointerDown={() => session.setShowOriginal(true)}
                        onPointerUp={() => session.setShowOriginal(false)}
                        onPointerLeave={() => session.setShowOriginal(false)}
                      >
                        Tahan untuk asli
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <BatchGrid session={session} />
              )}
            </div>

            {showPanel ? (
              <aside className="min-h-0 max-h-[42vh] shrink-0 overflow-y-auto border-t border-border bg-surface px-4 py-4 lg:max-h-none lg:w-[20.5rem] lg:border-t-0 lg:border-l lg:px-5 lg:py-5">
                <StudioPanel
                  session={session}
                  onRemoveBg={() => session.setBgDialogOpen(true)}
                />
              </aside>
            ) : null}
          </div>
        )}

        {session.processing && session.progress && session.view !== "edit" ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-end bg-bg/40 p-4 sm:items-center sm:justify-center">
            <div className="pointer-events-auto w-full max-w-sm rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
              <p className="text-lg font-semibold text-fg">
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
        ) : null}

        <ModelDialog
          open={session.bgDialogOpen}
          selected={session.model}
          busy={session.processing}
          onClose={() => session.setBgDialogOpen(false)}
          onSelect={(model) => void session.processAllBackgrounds(model)}
        />
      </div>
    </TooltipProvider>
  );
}
