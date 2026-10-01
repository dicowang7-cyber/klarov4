import { BoxSelect, Move, Square } from "lucide-react";
import { CheckRow, PanelTitle, Row, Segmented } from "@/components/editor/panel-bits";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { Slider } from "@/components/ui/slider";
import type { PositionMode } from "@/lib/image/layout";

export function PositionPanel({ session }: { session: PhotoSession }) {
  return (
    <div className="flex flex-col gap-6">
      <PanelTitle
        title="Posisi"
        hint="Atur letak subjek di dalam kanvas. Padding menjaga jarak dari tepi."
      />
      <Segmented<PositionMode>
        value={session.positionMode}
        onChange={session.setPositionMode}
        options={[
          {
            id: "original",
            label: "Asli",
            icon: <Square className="size-4" />,
          },
          {
            id: "center",
            label: "Tengah",
            icon: <BoxSelect className="size-4" />,
          },
          {
            id: "custom",
            label: "Kustom",
            icon: <Move className="size-4" />,
          },
        ]}
      />
      <Row label="Padding" value={`${Math.round(session.paddingPct)}%`}>
        <Slider
          min={0}
          max={40}
          step={1}
          value={[session.paddingPct]}
          onValueChange={([v]) => session.setPaddingPct(v ?? 0)}
          aria-label="Padding"
        />
      </Row>
      <CheckRow
        checked={session.ignoreCroppedSides}
        onChange={session.setIgnoreCroppedSides}
        label="Abaikan padding di sisi terpotong"
      />
      {session.positionMode === "custom" ? (
        <p className="text-sm leading-relaxed text-muted">
          Seret subjek di kanvas, atau geser dengan tombol panah. Shift untuk
          langkah lebih besar.
        </p>
      ) : null}
    </div>
  );
}
