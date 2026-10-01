import { PanelTitle, Row } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function RetouchPanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Retouch"
        hint="Sapu objek, teks, atau watermark. Klaro mengisi area itu dari piksel di sekitarnya."
      />
      <Row label="Ukuran kuas" value={`${session.brushSize}px`}>
        <Slider
          min={6}
          max={160}
          step={1}
          value={[session.brushSize]}
          onValueChange={([v]) => session.setBrushSize(v ?? 36)}
          aria-label="Ukuran kuas retouch"
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
          aria-label="Kekerasan kuas retouch"
        />
      </Row>
      <div className="flex flex-col gap-2">
        <Button
          onClick={() => void session.applyRetouch()}
          disabled={session.processing || !session.hasMask}
        >
          Hapus objek
        </Button>
        <Button
          variant="outline"
          onClick={session.clearRetouchMask}
          disabled={!session.hasMask || session.processing}
        >
          Reset sapuan
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-subtle">
        Paling rapi untuk watermark dan objek kecil. Untuk membuang bagian
        subjek setelah cutout, pakai Hapus Cutout.
      </p>
    </div>
  );
}
