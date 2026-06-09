// Helpers de presentación: cómo se muestran las capas, idiomas y estados en la UI.
import type { Book, ContentLayer, Language } from "@/lib/types";

export const LAYER_INFO: Record<
  ContentLayer,
  { label: string; short: string; badgeClass: string; description: string }
> = {
  1: {
    label: "Audiolibro completo",
    short: "Dominio público",
    badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    description:
      "Obra de dominio público: audiolibro completo y descarga gratis, sin restricciones.",
  },
  2: {
    label: "Reseña",
    short: "Reseña + dónde conseguirlo",
    badgeClass: "bg-amber-100 text-amber-800 ring-amber-200",
    description:
      "Libro con derechos vigentes: ofrecemos una reseña original y links para conseguirlo. No reproducimos el texto.",
  },
  3: {
    label: "Licenciado",
    short: "Edición licenciada",
    badgeClass: "bg-sky-100 text-sky-800 ring-sky-200",
    description:
      "Título con licencia editorial. Se reproduce solo con un acuerdo válido vigente.",
  },
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  es: "Español",
  en: "Inglés",
};

export const LANGUAGE_FLAG: Record<Language, string> = {
  es: "🇪🇸",
  en: "🇬🇧",
};

// Iniciales para la portada-placeholder (cuando no hay imagen).
export function initials(book: Book): string {
  const words = book.title.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Color de fondo estable para la portada-placeholder, derivado del slug.
const GRADIENTS = [
  "from-rose-400 to-orange-300",
  "from-violet-400 to-indigo-300",
  "from-emerald-400 to-teal-300",
  "from-amber-400 to-yellow-300",
  "from-sky-400 to-cyan-300",
  "from-fuchsia-400 to-pink-300",
];
export function gradientFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// ¿El libro tiene audio reproducible YA? (grabación LibriVox, mp3 propio, o
// video de YouTube público). Los narrados pendientes no cuentan.
export function hasPlayableAudio(book: Book): boolean {
  return book.audioVersions.some(
    (v) =>
      (v.status === "ready" && (v.archiveId || v.audioUrl)) ||
      (v.youtubeVideoId && v.youtubePublic),
  );
}
