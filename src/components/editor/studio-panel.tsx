import { CutoutPanel } from "@/components/editor/panels/cutout-panel";
import { PositionPanel } from "@/components/editor/panels/position-panel";
import { ResizePanel } from "@/components/editor/panels/resize-panel";
import { RetouchPanel } from "@/components/editor/panels/retouch-panel";
import { BackgroundPanel } from "@/components/editor/panels/background-panel";
import { OutlinePanel } from "@/components/editor/panels/outline-panel";
import { ShadowPanel } from "@/components/editor/panels/shadow-panel";
import { ColorPanel } from "@/components/editor/panels/color-panel";
import { TemplatePanel } from "@/components/editor/panels/template-panel";
import type { PhotoSession } from "@/components/editor/use-photo-session";

export function StudioPanel({
  session,
  onRemoveBg,
}: {
  session: PhotoSession;
  onRemoveBg: () => void;
}) {
  switch (session.activeTool) {
    case "retouch":
      return <RetouchPanel session={session} />;
    case "cutout":
      return <CutoutPanel session={session} />;
    case "outline":
      return <OutlinePanel session={session} />;
    case "position":
      return <PositionPanel session={session} />;
    case "resize":
      return <ResizePanel session={session} />;
    case "background":
      return <BackgroundPanel session={session} onRemoveBg={onRemoveBg} />;
    case "shadow":
      return <ShadowPanel session={session} />;
    case "color":
      return <ColorPanel session={session} />;
    default:
      return <TemplatePanel session={session} />;
  }
}
