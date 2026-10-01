import { Scissors } from "lucide-react";
import { PanelTitle } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Button } from "@/components/ui/button";
import { FILL_SWATCHES, GRADIENT_PRESETS } from "@/lib/image/pixels";
import { cn } from "@/lib/utils";

export function BackgroundPanel({
  session,
  onRemoveBg,
}: {
  session: PhotoSession;
  onRemoveBg: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Latar Belakang"
        hint="Warna atau gradasi untuk seluruh batch. Hapus BG memproses semua foto."
      />
      <Button onClick={onRemoveBg} disabled={session.processing}>
        <Scissors />
        Hapus background
      </Button>
      <section className="space-y-3">
        <h3 className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">
          Warna
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {FILL_SWATCHES.map((swatch) => (
            <button
              key={swatch.label}
              type="button"
              title={swatch.label}
              aria-label={swatch.label}
              onClick={() => session.setFillColor(swatch.value)}
              className={cn(
                "size-9 overflow-hidden rounded-full shadow-[var(--shadow-border)]",
                !session.gradient &&
                  session.fillColor === swatch.value &&
                  "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                !swatch.value && "studio-check",
              )}
              style={
                swatch.value ? { backgroundColor: swatch.value } : undefined
              }
            />
          ))}
          <label className="relative size-9 overflow-hidden rounded-full shadow-[var(--shadow-border)]">
            <span className="sr-only">Latar kustom</span>
            <input
              type="color"
              value={session.fillColor ?? "#ffffff"}
              onChange={(e) => session.setFillColor(e.target.value)}
              className="absolute inset-[-25%] size-[150%] cursor-pointer"
            />
          </label>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">
          Gradasi
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {GRADIENT_PRESETS.map((preset) => {
            const active =
              session.gradient?.from === preset.from &&
              session.gradient?.to === preset.to;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  session.setGradient({
                    from: preset.from,
                    to: preset.to,
                    angle: preset.angle,
                  })
                }
                className={cn(
                  "overflow-hidden rounded-[var(--radius-sm)] px-3 py-2.5 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)]",
                  active && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                )}
                style={{
                  backgroundImage: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})`,
                }}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    preset.id === "charcoal" ? "text-fg" : "text-bg",
                  )}
                >
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
