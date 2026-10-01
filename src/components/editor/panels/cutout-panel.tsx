import { PanelTitle, Row, Segmented } from "@/components/editor/panel-bits";
import type { CutoutMode, PhotoSession } from "@/components/editor/use-photo-session";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function CutoutPanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Hapus Cutout"
        hint="Buang bagian subjek dari hasil cutout — bukan mengisi ulang, melainkan membuatnya transparan."
      />

      {!session.hasCutout ? (
        <p className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-3 text-sm leading-relaxed text-muted">
          Hapus background dulu. Setelah subjek terpisah, Guide dan Manual bisa
          memotong bagian yang tidak ingin dipertahankan.
        </p>
      ) : (
        <>
          <Segmented<CutoutMode>
            value={session.cutoutMode}
            onChange={session.setCutoutMode}
            options={[
              { id: "guide", label: "Guide" },
              { id: "manual", label: "Manual" },
            ]}
          />

          {session.cutoutMode === "guide" ? (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Gambar garis pada objek yang ingin dibuang. Klaro menelusuri
                tepi dan warna, lalu menghapusnya dari cutout.
              </p>
              <Row label="Ukuran kuas" value={`${session.brushSize}px`}>
                <Slider
                  min={6}
                  max={160}
                  step={1}
                  value={[session.brushSize]}
                  onValueChange={([v]) => session.setBrushSize(v ?? 36)}
                  aria-label="Ukuran kuas guide"
                />
              </Row>
              <Row label="Kepekaan" value={`${session.guideTolerance}`}>
                <Slider
                  min={20}
                  max={100}
                  step={1}
                  value={[session.guideTolerance]}
                  onValueChange={([v]) => session.setGuideTolerance(v ?? 62)}
                  aria-label="Kepekaan guide"
                />
              </Row>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => session.setBrushTool("erase")}
                  className={cn(
                    "h-11 rounded-[var(--radius-sm)] text-sm font-medium transition-[background-color,color] duration-[var(--motion-quick)]",
                    session.brushTool === "erase"
                      ? "bg-accent text-accent-fg"
                      : "bg-surface-2 text-fg hover:bg-border/80",
                  )}
                >
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={() => session.setBrushTool("restore")}
                  className={cn(
                    "h-11 rounded-[var(--radius-sm)] text-sm font-medium transition-[background-color,color] duration-[var(--motion-quick)]",
                    session.brushTool === "restore"
                      ? "bg-accent text-accent-fg"
                      : "bg-surface-2 text-fg hover:bg-border/80",
                  )}
                >
                  Pulihkan
                </button>
              </div>
              <Row label="Ukuran kuas" value={`${session.brushSize}px`}>
                <Slider
                  min={6}
                  max={160}
                  step={1}
                  value={[session.brushSize]}
                  onValueChange={([v]) => session.setBrushSize(v ?? 36)}
                  aria-label="Ukuran kuas manual"
                />
              </Row>
              <Row
                label="Kekerasan"
                value={`${Math.round(session.brushHardness * 100)}%`}
              >
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[session.brushHardness]}
                  onValueChange={([v]) => session.setBrushHardness(v ?? 0.55)}
                  aria-label="Kekerasan kuas manual"
                />
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );
}
