import { CheckRow, PanelTitle } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Input } from "@/components/ui/input";

export function ResizePanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Ubah ukuran"
        hint="Lebar dan tinggi kanvas diterapkan ke semua foto di batch."
      />

      <section className="space-y-3">
        <h3 className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">
          Kustom
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className="text-xs text-muted">Lebar</span>
            <Input
              type="number"
              min={64}
              max={4096}
              value={session.canvasWidth}
              onChange={(e) =>
                session.setCanvasSize(
                  Number(e.target.value),
                  session.canvasHeight,
                  "width",
                )
              }
              aria-label="Lebar kanvas"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted">Tinggi</span>
            <Input
              type="number"
              min={64}
              max={4096}
              value={session.canvasHeight}
              onChange={(e) =>
                session.setCanvasSize(
                  session.canvasWidth,
                  Number(e.target.value),
                  "height",
                )
              }
              aria-label="Tinggi kanvas"
            />
          </label>
        </div>
        <CheckRow
          checked={session.lockAspect}
          onChange={session.setLockAspect}
          label="Kunci rasio"
        />
      </section>
    </div>
  );
}
