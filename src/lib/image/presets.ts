export type SizePreset = {
  id: string;
  label: string;
  hint: string;
  group: string;
  width: number | null;
  height: number | null;
};

export const SIZE_PRESETS: SizePreset[] = [
  {
    id: "original",
    label: "Asli",
    hint: "Ukuran foto",
    group: "Dasar",
    width: null,
    height: null,
  },
  {
    id: "square",
    label: "1:1",
    hint: "1080 × 1080",
    group: "Rasio",
    width: 1080,
    height: 1080,
  },
  {
    id: "portrait",
    label: "4:5",
    hint: "1080 × 1350",
    group: "Rasio",
    width: 1080,
    height: 1350,
  },
  {
    id: "story",
    label: "9:16",
    hint: "1080 × 1920",
    group: "Rasio",
    width: 1080,
    height: 1920,
  },
  {
    id: "landscape",
    label: "16:9",
    hint: "1920 × 1080",
    group: "Rasio",
    width: 1920,
    height: 1080,
  },
  {
    id: "photo",
    label: "4:3",
    hint: "1600 × 1200",
    group: "Rasio",
    width: 1600,
    height: 1200,
  },
  {
    id: "ig-feed",
    label: "IG Feed",
    hint: "1080 × 1350",
    group: "Sosial",
    width: 1080,
    height: 1350,
  },
  {
    id: "ig-square",
    label: "IG Square",
    hint: "1080 × 1080",
    group: "Sosial",
    width: 1080,
    height: 1080,
  },
  {
    id: "ig-story",
    label: "IG Story",
    hint: "1080 × 1920",
    group: "Sosial",
    width: 1080,
    height: 1920,
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "1080 × 1920",
    group: "Sosial",
    width: 1080,
    height: 1920,
  },
  {
    id: "marketplace",
    label: "Shopee / Tokped",
    hint: "1000 × 1000",
    group: "Toko",
    width: 1000,
    height: 1000,
  },
  {
    id: "amazon",
    label: "Amazon",
    hint: "2000 × 2000",
    group: "Toko",
    width: 2000,
    height: 2000,
  },
];

export const PRESET_GROUPS = ["Dasar", "Rasio", "Sosial", "Toko"] as const;

export function findPreset(id: string): SizePreset {
  return SIZE_PRESETS.find((p) => p.id === id) ?? SIZE_PRESETS[0]!;
}

export const MIN_CANVAS = 64;
export const MAX_CANVAS = 4096;

export function clampCanvas(n: number) {
  if (!Number.isFinite(n)) return MIN_CANVAS;
  return Math.min(MAX_CANVAS, Math.max(MIN_CANVAS, Math.round(n)));
}
