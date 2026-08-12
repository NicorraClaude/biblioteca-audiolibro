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

// Gradientes profundos y premium para las tapas diseñadas (texto blanco encima).
const COVER_GRADIENTS = [
  ["#2b2d42", "#545b78"], // pizarra
  ["#7b341e", "#c05621"], // terracota
  ["#1a4731", "#2f855a"], // bosque
  ["#322659", "#6b46c1"], // ciruela
  ["#1a365d", "#2b6cb0"], // océano
  ["#702459", "#b83280"], // baya
  ["#5f370e", "#b7791f"], // bronce
  ["#234e52", "#319795"], // teal
  ["#3c1518", "#8c2f39"], // vino
  ["#1d3557", "#457b9d"], // acero
];

function hash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

// Devuelve los dos colores del degradado de la tapa, estables por slug.
export function coverColors(slug: string): [string, string] {
  return COVER_GRADIENTS[hash(slug) % COVER_GRADIENTS.length] as [string, string];
}

// ¿El libro tiene audio PROPIO reproducible YA? (YouTube público de nuestro
// canal o mp3 IA). No contamos LibriVox: el audio lo servimos nosotros.
export function hasPlayableAudio(book: Book): boolean {
  return !!getPlayableTrack(book);
}

export type PlayableTrack = {
  title: string;
  author: string;
  slug: string;
  kind: "youtube" | "audio";
  src: string;
  cover?: string | null;
};

// Saca del libro lo que las TARJETAS no usan, antes de mandarlo al navegador.
//
// POR QUÉ: la home es un componente de servidor que le pasa la lista completa a
// componentes de cliente (Catalog, BookRow). Todo lo que va en esa lista viaja
// serializado al navegador dentro del HTML. Los `summary` son análisis de 8.000
// palabras: con 614 libros suman 15,6 MB de los 16 que pesaba la página, y las
// tarjetas ni los miran. Vercel corta las páginas de más de 19 MB, así que el
// catálogo dejó de deployarse justo cuando empezó a crecer en serio.
//
// El resumen se sigue sirviendo entero en la ficha de cada libro, que es donde se lee.
export function paraTarjeta(book: Book): Book {
  return { ...book, summary: null };
}

// Devuelve cómo reproducir el audio PROPIO de un libro (mp3 o YouTube público),
// o null si todavía no tiene. Prioriza el mp3: es el único que sigue sonando con
// el teléfono bloqueado (YouTube bloquea el segundo plano fuera de Premium).
export function getPlayableTrack(book: Book): PlayableTrack | null {
  const mp3 = book.audioVersions.find((v) => v.audioUrl && v.status === "ready");
  if (mp3?.audioUrl) {
    return { title: book.title, author: book.author, slug: book.slug, kind: "audio", src: mp3.audioUrl, cover: book.coverImageUrl };
  }
  const yt = book.audioVersions.find((v) => v.youtubeVideoId && v.youtubePublic);
  if (yt?.youtubeVideoId) {
    return { title: book.title, author: book.author, slug: book.slug, kind: "youtube", src: yt.youtubeVideoId, cover: book.coverImageUrl };
  }
  // Fallback: la SINOPSIS en audio (toda la biblioteca la tiene). Así cada libro
  // es reproducible desde la tarjeta y la biblioteca "suena" desde el día uno.
  const sin = book.summary?.es?.sinopsis ?? book.summary?.en?.sinopsis;
  const sinAudio = sin?.audio?.onyx ?? sin?.audio?.nova ?? sin?.audioUrl ?? null;
  if (sinAudio) {
    return { title: `Sinopsis · ${book.title}`, author: book.author, slug: book.slug, kind: "audio", src: sinAudio, cover: book.coverImageUrl };
  }
  return null;
}
