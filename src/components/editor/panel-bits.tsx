import { cn } from "@/lib/utils";

export function PanelTitle({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-fg">{title}</h2>
      {hint ? <p className="text-sm leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-fg">{label}</p>
        {value ? (
          <p className="text-xs tabular-nums text-subtle">{value}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-medium transition-[background-color,color,box-shadow] duration-[var(--motion-quick)]",
              active
                ? "bg-surface text-fg shadow-[var(--shadow-border)]"
                : "text-muted hover:text-fg",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-start gap-3 text-left"
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] transition-[background-color,box-shadow] duration-[var(--motion-quick)]",
          checked
            ? "bg-accent text-accent-fg"
            : "bg-surface shadow-[var(--shadow-border)]",
        )}
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path
              d="M2.2 6.2 4.7 8.7 9.8 3.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="text-sm leading-snug text-fg">{label}</span>
    </button>
  );
}
