import {
  LayoutTemplate,
  Lasso,
  Move,
  Scaling,
  Scissors,
  SlidersHorizontal,
  Square,
  SunMedium,
  WandSparkles,
} from "lucide-react";
import type {
  PhotoSession,
  StudioTool,
  ViewMode,
} from "@/components/editor/use-photo-session";
import { cn } from "@/lib/utils";

const BATCH_TOOLS: {
  id: StudioTool;
  label: string;
  icon: typeof Scissors;
}[] = [
  { id: "template", label: "Templat", icon: LayoutTemplate },
  { id: "resize", label: "Ubah ukuran", icon: Scaling },
  { id: "position", label: "Posisi", icon: Move },
  { id: "background", label: "Latar", icon: Square },
  { id: "shadow", label: "Bayangan", icon: SunMedium },
  { id: "color", label: "Warna", icon: SlidersHorizontal },
];

const EDIT_TOOLS: {
  id: StudioTool;
  label: string;
  icon: typeof Scissors;
}[] = [
  { id: "cutout", label: "Hapus", icon: Lasso },
  { id: "retouch", label: "Retouch", icon: WandSparkles },
  { id: "outline", label: "Outline", icon: Square },
  { id: "color", label: "Warna", icon: SlidersHorizontal },
];

type ToolRailProps = {
  session: PhotoSession;
  view: ViewMode;
  onRemoveBg: () => void;
};

export function ToolRail({ session, view, onRemoveBg }: ToolRailProps) {
  const tools = view === "edit" ? EDIT_TOOLS : BATCH_TOOLS;

  return (
    <aside className="flex shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border bg-surface px-1.5 py-2 lg:w-[5.5rem] lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:px-1.5 lg:py-3">
      <RailButton
        label="Hapus BG"
        active={false}
        tone="accent"
        disabled={session.processing}
        onClick={onRemoveBg}
      >
        <Scissors className="size-4" />
      </RailButton>
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <RailButton
            key={tool.id}
            label={tool.label}
            active={session.activeTool === tool.id}
            disabled={session.processing}
            onClick={() => session.setActiveTool(tool.id)}
          >
            <Icon className="size-4" />
          </RailButton>
        );
      })}
    </aside>
  );
}

function RailButton({
  label,
  active,
  tone = "default",
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  tone?: "default" | "accent" | "muted";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex min-h-12 min-w-[4.4rem] flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[10px] leading-tight font-medium tracking-wide transition-[background-color,color] duration-[var(--motion-quick)] disabled:opacity-40 lg:min-h-[3.6rem] lg:min-w-0 lg:w-full",
        tone === "accent" && "bg-accent text-accent-fg hover:bg-accent/90",
        tone === "default" &&
          (active
            ? "bg-surface-2 text-fg"
            : "text-muted hover:bg-surface-2/80 hover:text-fg"),
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
