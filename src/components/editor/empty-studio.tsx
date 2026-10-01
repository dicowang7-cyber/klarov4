import { ImagePlus, Scissors, SlidersHorizontal, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SAMPLE_PHOTOS } from "@/lib/samples";

type EmptyStudioProps = {
  onPickFile: () => void;
  onSample: (src: string, label: string) => void;
};

const FEATURES = [
  {
    icon: Scissors,
    title: "Hapus BG",
    body: "Cutout di perangkat, tanpa unggah ke server.",
  },
  {
    icon: SunMedium,
    title: "Bayangan studio",
    body: "Jatuh, lantai, atau halo dari bentuk subjek.",
  },
  {
    icon: SlidersHorizontal,
    title: "Warna & PNG",
    body: "Koreksi cahaya, gradasi latar, unduh transparan.",
  },
];

export function EmptyStudio({ onPickFile, onSample }: EmptyStudioProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
      <div className="stagger-in space-y-3">
        <p className="text-sm font-medium tracking-[0.18em] text-muted uppercase">
          Klaro studio
        </p>
        <h1 className="text-4xl leading-tight font-semibold tracking-[-0.03em] text-balance text-fg sm:text-5xl">
          Rapikan foto produk
          <span className="text-muted"> sekaligus.</span>
        </h1>
        <p className="max-w-lg text-pretty text-base leading-relaxed text-muted">
          Hapus background, beri bayangan studio, atur warna dan ukuran — batch
          banyak foto di perangkatmu.
        </p>
      </div>

      <div className="stagger-in mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" onClick={onPickFile} className="min-h-12">
          <ImagePlus />
          Tambah gambar
        </Button>
        <p className="text-sm text-subtle">PNG, JPG, atau WEBP · maks 20MB</p>
      </div>

      <div className="stagger-in mt-8 grid gap-2 sm:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="rounded-[var(--radius-md)] bg-surface px-4 py-4 shadow-[var(--shadow-border)]"
            >
              <Icon className="size-4 text-muted" />
              <p className="mt-3 text-sm font-medium text-fg">{feature.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {feature.body}
              </p>
            </div>
          );
        })}
      </div>

      <div className="stagger-in mt-10">
        <p className="mb-3 text-sm font-medium text-muted">Atau coba contoh</p>
        <div className="grid grid-cols-3 gap-3">
          {SAMPLE_PHOTOS.map((sample) => (
            <button
              key={sample.src}
              type="button"
              onClick={() => onSample(sample.src, sample.label)}
              className="group overflow-hidden rounded-[var(--radius-md)] bg-surface text-left shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
            >
              <img
                src={sample.src}
                alt={sample.label}
                className="aspect-portrait w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
              />
              <span className="flex items-baseline justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm font-medium text-fg">
                  {sample.label}
                </span>
                <span className="hidden text-xs text-subtle sm:inline">
                  {sample.caption}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
