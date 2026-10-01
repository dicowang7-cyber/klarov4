import { PanelTitle } from "@/components/editor/panel-bits";

export function SoonPanel({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle title={title} hint={hint} />
      <p className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-3 text-sm leading-relaxed text-muted">
        Fitur Pro ini belum aktif di studio ini.
      </p>
    </div>
  );
}
