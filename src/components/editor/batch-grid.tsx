import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PhotoSession } from "@/components/editor/use-photo-session";
import { cn } from "@/lib/utils";

export function BatchGrid({ session }: { session: PhotoSession }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-auto"
      onClick={() => setSelectedId(null)}
    >
      <div className="flex flex-wrap content-start gap-6 p-5 sm:p-8">
        {session.batchItems.map((item) => {
          const selected = selectedId === item.id;
          const label =
            item.status === "processing"
              ? "Memproses"
              : item.status === "error"
                ? (item.error ?? "Gagal")
                : `${item.outW} × ${item.outH}`;
          return (
            <article
              key={item.id}
              className="w-[min(100%,17.5rem)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
                <p className="min-w-0 truncate text-sm text-muted" title={item.name}>
                  {item.name}
                </p>
                <p className="shrink-0 text-sm tabular-nums text-subtle">{label}</p>
              </div>
              <button
                type="button"
                className={cn(
                  "group relative block w-full overflow-hidden rounded-[4px] studio-check text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)]",
                  selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
                )}
                onClick={() =>
                  setSelectedId((id) => (id === item.id ? null : item.id))
                }
              >
                <img
                  src={item.thumbUrl}
                  alt={item.name}
                  className="aspect-square w-full object-contain"
                />
                {item.status === "processing" ? (
                  <span className="absolute inset-0 bg-bg/40" />
                ) : null}
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center gap-2 bg-bg/55 transition-opacity duration-[var(--motion-quick)]",
                    selected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] bg-surface px-3 text-sm font-medium text-fg shadow-[var(--shadow-border)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      session.openEdit(item.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") session.openEdit(item.id);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-fg shadow-[var(--shadow-border)]"
                    aria-label="Hapus"
                    onClick={(e) => {
                      e.stopPropagation();
                      session.removeBatchItem(item.id);
                      setSelectedId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") session.removeBatchItem(item.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </span>
                </span>
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
