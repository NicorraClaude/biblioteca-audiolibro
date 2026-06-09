import type { ContentLayer } from "@/lib/types";
import { LAYER_INFO } from "@/lib/presentation";

// Badge que indica la capa legal del contenido.
export function LayerBadge({
  layer,
  blocked = false,
}: {
  layer: ContentLayer;
  blocked?: boolean;
}) {
  const info = LAYER_INFO[layer];
  if (blocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-300 ring-inset">
        🔒 Bloqueado
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${info.badgeClass}`}
    >
      {info.short}
    </span>
  );
}
