import { PanelTitle, Row, Segmented } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SHADOW_PRESETS, type ShadowStyle } from "@/lib/image/shadow";
import { cn } from "@/lib/utils";

export function ShadowPanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Bayangan"
        hint="Bayangan studio dari bentuk subjek. Berlaku untuk seluruh batch."
      />
      <div className="grid grid-cols-2 gap-2">
        {SHADOW_PRESETS.map((preset) => {
          const active =
            session.shadow.enabled === preset.value.enabled &&
            session.shadow.style === preset.value.style &&
            session.shadow.blur === preset.value.blur &&
            session.shadow.offsetY === preset.value.offsetY &&
            session.shadow.opacity === preset.value.opacity;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => session.applyShadowPreset(preset.value)}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-[background-color,color] duration-[var(--motion-quick)]",
                active
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-2 text-fg hover:bg-border/80",
              )}
            >
              <span className="block text-sm font-medium">{preset.label}</span>
              <span
                className={cn(
                  "block text-xs",
                  active ? "text-accent-fg/70" : "text-subtle",
                )}
              >
                {preset.hint}
              </span>
            </button>
          );
        })}
      </div>

      {session.shadow.enabled ? (
        <>
          <Segmented<ShadowStyle>
            value={session.shadow.style}
            onChange={session.setShadowStyle}
            options={[
              { id: "drop", label: "Jatuh" },
              { id: "contact", label: "Lantai" },
              { id: "glow", label: "Halo" },
            ]}
          />
          <Row label="Opasitas" value={`${session.shadow.opacity}%`}>
            <Slider
              min={5}
              max={90}
              step={1}
              value={[session.shadow.opacity]}
              onValueChange={([v]) => session.setShadowOpacity(v ?? 42)}
              aria-label="Opasitas bayangan"
            />
          </Row>
          <Row label="Blur" value={`${session.shadow.blur}px`}>
            <Slider
              min={0}
              max={64}
              step={1}
              value={[session.shadow.blur]}
              onValueChange={([v]) => session.setShadowBlur(v ?? 26)}
              aria-label="Blur bayangan"
            />
          </Row>
          {session.shadow.style !== "glow" ? (
            <>
              <Row label="Geser X" value={`${session.shadow.offsetX}px`}>
                <Slider
                  min={-40}
                  max={40}
                  step={1}
                  value={[session.shadow.offsetX]}
                  onValueChange={([v]) => session.setShadowOffsetX(v ?? 0)}
                  aria-label="Geser bayangan horizontal"
                />
              </Row>
              <Row label="Geser Y" value={`${session.shadow.offsetY}px`}>
                <Slider
                  min={-20}
                  max={60}
                  step={1}
                  value={[session.shadow.offsetY]}
                  onValueChange={([v]) => session.setShadowOffsetY(v ?? 18)}
                  aria-label="Geser bayangan vertikal"
                />
              </Row>
            </>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium text-fg">Warna</p>
            <div className="flex items-center gap-2">
              {["#111113", "#3f3f46", "#ffffff"].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => session.setShadowColor(color)}
                  className={cn(
                    "size-9 rounded-full shadow-[var(--shadow-border)]",
                    session.shadow.color === color &&
                      "ring-2 ring-accent ring-offset-2 ring-offset-surface",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label className="relative size-9 overflow-hidden rounded-full shadow-[var(--shadow-border)]">
                <span className="sr-only">Warna kustom</span>
                <input
                  type="color"
                  value={session.shadow.color}
                  onChange={(e) => session.setShadowColor(e.target.value)}
                  className="absolute inset-[-25%] size-[150%] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </>
      ) : (
        <Button onClick={() => session.setShadowEnabled(true)}>
          Aktifkan bayangan
        </Button>
      )}
    </div>
  );
}
