import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-sm)] bg-surface-2 px-3 text-sm text-fg tabular-nums outline-none transition-[box-shadow] duration-[var(--motion-quick)] placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--color-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
