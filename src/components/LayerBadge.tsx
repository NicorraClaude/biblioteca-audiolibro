import type { ContentLayer } from "@/lib/types";

// Etiqueta de capa legal — pill discreta y legible sobre la tapa.
const STYLES: Record<ContentLayer, { label: string; cls: string }> = {
  1: { label: "Gratis completo", cls: "bg-white/90 text-emerald-700" },
  2: { label: "Reseña", cls: "bg-white/90 text-amber-700" },
  3: { label: "Edición", cls: "bg-white/90 text-sky-700" },
};

export function LayerBadge({ layer }: { layer: ContentLayer }) {
  const s = STYLES[layer];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-sm backdrop-blur ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
