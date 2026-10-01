import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODEL_OPTIONS, type BgModel } from "@/lib/image/remove-bg";
import { cn } from "@/lib/utils";

export function ModelDialog({
  open,
  selected,
  busy,
  onSelect,
  onClose,
}: {
  open: boolean;
  selected: BgModel;
  busy?: boolean;
  onSelect: (model: BgModel) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Tutup"
        onClick={onClose}
        disabled={busy}
      />
      <div className="relative w-full max-w-md rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium tracking-[0.16em] text-subtle uppercase">
          Hapus background
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-fg">
          Pilih model
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Semua foto di batch diproses dengan model yang sama. Studio memakai
          RMBG 1.4 untuk memisahkan produk utama dari latar — tanpa unggah.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODEL_OPTIONS.map((option) => {
            const active = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => onSelect(option.id)}
                className={cn(
                  "rounded-[var(--radius-md)] px-4 py-4 text-left transition-[background-color,box-shadow] duration-[var(--motion-quick)]",
                  active
                    ? "bg-accent text-accent-fg"
                    : "bg-surface-2 text-fg hover:bg-border/80",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="size-4" />
                  {option.label}
                </span>
                <span
                  className={cn(
                    "mt-2 block font-mono text-xs",
                    active ? "text-accent-fg/80" : "text-subtle",
                  )}
                >
                  {option.file}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-xs leading-relaxed",
                    active ? "text-accent-fg/75" : "text-muted",
                  )}
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
        </div>
      </div>
    </div>
  );
}
