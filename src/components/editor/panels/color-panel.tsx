import { PanelTitle, Row } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

export function ColorPanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Warna"
        hint="Koreksi cahaya untuk seluruh batch. Tidak mengubah file asli."
      />
      <Row label="Kecerahan" value={signed(session.brightness)}>
        <Slider
          min={-80}
          max={80}
          step={1}
          value={[session.brightness]}
          onValueChange={([v]) => session.setBrightness(v ?? 0)}
          aria-label="Kecerahan"
        />
      </Row>
      <Row label="Kontras" value={signed(session.contrast)}>
        <Slider
          min={-80}
          max={80}
          step={1}
          value={[session.contrast]}
          onValueChange={([v]) => session.setContrast(v ?? 0)}
          aria-label="Kontras"
        />
      </Row>
      <Row label="Saturasi" value={signed(session.saturation)}>
        <Slider
          min={-80}
          max={80}
          step={1}
          value={[session.saturation]}
          onValueChange={([v]) => session.setSaturation(v ?? 0)}
          aria-label="Saturasi"
        />
      </Row>
      <Row label="Kehangatan" value={signed(session.warmth)}>
        <Slider
          min={-80}
          max={80}
          step={1}
          value={[session.warmth]}
          onValueChange={([v]) => session.setWarmth(v ?? 0)}
          aria-label="Kehangatan"
        />
      </Row>
      <Button
        variant="outline"
        onClick={() => {
          session.setBrightness(0);
          session.setContrast(0);
          session.setSaturation(0);
          session.setWarmth(0);
        }}
      >
        Reset warna
      </Button>
    </div>
  );
}
