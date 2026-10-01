import { PanelTitle, Row } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Slider } from "@/components/ui/slider";
import { hexEqual, OUTLINE_SWATCHES } from "@/lib/image/pixels";
import { cn } from "@/lib/utils";

export function OutlinePanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Outline"
        hint="Tebal dan warna garis luar untuk foto yang sedang diedit."
      />
      <Row label="Ukuran outline" value={`${session.outlineWidth}px`}>
        <Slider
          min={0}
          max={48}
          step={1}
          value={[session.outlineWidth]}
          onValueChange={([v]) => session.setOutlineWidth(v ?? 0)}
          aria-label="Ukuran outline"
        />
      </Row>
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">Warna outline</p>
        <div className="flex flex-wrap items-center gap-2">
          {OUTLINE_SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              title={swatch.label}
              aria-label={swatch.label}
              onClick={() => session.setOutlineColor(swatch.value)}
              className={cn(
                "size-9 rounded-full shadow-[var(--shadow-border)]",
                hexEqual(session.outlineColor, swatch.value) &&
                  "ring-2 ring-accent ring-offset-2 ring-offset-surface",
              )}
              style={{ backgroundColor: swatch.value }}
            />
          ))}
          <label className="relative size-9 overflow-hidden rounded-full shadow-[var(--shadow-border)]">
            <span className="sr-only">Warna kustom</span>
            <input
              type="color"
              value={session.outlineColor}
              onChange={(e) => session.setOutlineColor(e.target.value)}
              className="absolute inset-[-25%] size-[150%] cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
