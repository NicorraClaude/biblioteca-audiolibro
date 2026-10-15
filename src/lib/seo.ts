// Piezas comunes de SEO: URLs, títulos pensados para búsquedas reales y los
// bloques de datos estructurados (JSON-LD) que entienden Google y Bing.
//
// CRITERIO. La gente no busca "Carmen" a secas: busca "Carmen audiolibro gratis",
// "resumen de Carmen", "audiolibros de misterio en español". Por eso los títulos
// y las descripciones se arman alrededor de esa intención, y por eso existen las
// páginas de categoría y de autor: son las que pueden rankear por esas consultas,
// y de paso enlazan hacia las fichas (que es como Google las descubre).
import type { Book } from "@/lib/types";

export const SITE = "https://biblioteca-audiolibros.vercel.app";
export const MARCA = "Biblioteca Abierta";

// "Ciencia ficción" → "ciencia-ficcion". Sirve para categorías y autores.
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type Agrupacion = { nombre: string; slug: string; libros: Book[] };

function agrupar(books: Book[], clave: (b: Book) => string[]): Agrupacion[] {
  const mapa = new Map<string, Agrupacion>();
  for (const b of books) {
    for (const nombre of clave(b)) {
      if (!nombre) continue;
      const slug = slugificar(nombre);
      if (!slug) continue;
      const g = mapa.get(slug) ?? { nombre, slug, libros: [] };
      g.libros.push(b);
      mapa.set(slug, g);
    }
  }
  return [...mapa.values()].sort((a, b) => b.libros.length - a.libros.length);
}

// Memorizadas: agrupar 850 libros en cada una de las ~700 páginas generadas
// (y dos o tres veces por página) es trabajo repetido en cada build.
const memo = new Map<string, Agrupacion[]>();

export function categorias(books: Book[]): Agrupacion[] {
  const k = `cat:${books.length}`;
  if (!memo.has(k)) memo.set(k, agrupar(books, (b) => b.categories ?? []));
  return memo.get(k)!;
}

// Autores con al menos dos libros. Con uno solo, la página de autor repite la
// ficha y Google la trata como contenido duplicado y sin valor.
export function autores(books: Book[], minimo = 2): Agrupacion[] {
  const k = `aut:${books.length}:${minimo}`;
  if (!memo.has(k)) memo.set(k, agrupar(books, (b) => (b.author ? [b.author] : [])).filter((a) => a.libros.length >= minimo));
  return memo.get(k)!;
}

// ¿Qué ofrece esta ficha? Define el título y la promesa de la descripción.
export function queOfrece(book: Book): "audiolibro" | "resumen" {
  return book.contentLayer === 1 ? "audiolibro" : "resumen";
}

export function tituloFicha(book: Book): string {
  return queOfrece(book) === "audiolibro"
    ? `${book.title} — Audiolibro completo gratis en español`
    : `${book.title} — Resumen y análisis en audio`;
}

export function breadcrumb(items: { nombre: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.nombre,
      item: it.url,
    })),
  };
}

export function listaDeLibros(libros: Book[], nombre: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nombre,
    numberOfItems: libros.length,
    itemListElement: libros.slice(0, 100).map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/libro/${b.slug}`,
      name: b.title,
    })),
  };
}

// Preguntas frecuentes de la ficha. Son las dudas reales que frenan a alguien que
// llega buscando "gratis" ("¿es legal?", "¿tengo que registrarme?") y además
// Google las puede mostrar desplegadas debajo del resultado.
export function faqFicha(book: Book) {
  const esAudiolibro = queOfrece(book) === "audiolibro";
  const preguntas: [string, string][] = esAudiolibro
    ? [
        [`¿Es gratis escuchar ${book.title}?`,
         `Sí. ${book.title}, de ${book.author}, es una obra de dominio público: se puede escuchar y leer entera, gratis, sin registrarse y sin límite de tiempo.`],
        [`¿Es legal descargar ${book.title}?`,
         `Sí. Los derechos de autor de esta obra ya vencieron, así que pertenece al dominio público y cualquiera puede leerla, escucharla, descargarla y compartirla.`],
        ["¿Hace falta crear una cuenta?",
         "No. No hay registro, ni suscripción, ni datos de tarjeta. Se abre la página y se reproduce."],
        ["¿Quién narra los audiolibros?",
         "La narración es con voz sintética, generada por nosotros. Se puede escuchar en la web o en nuestro canal de YouTube, y sigue sonando con el teléfono bloqueado."],
      ]
    : [
        [`¿Qué incluye el resumen de ${book.title}?`,
         `Una sinopsis corta y un análisis extenso de unos 40 minutos con las ideas centrales de ${book.title}, de ${book.author}, escrito con nuestras palabras y narrado en audio.`],
        ["¿Incluye el texto completo del libro?",
         "No. Este libro tiene derechos de autor vigentes, así que no reproducimos su texto. El análisis es contenido original nuestro; para la obra completa hay que conseguir la edición original."],
        ["¿Hay que pagar o registrarse?",
         "No. El resumen en texto y en audio es gratis y no pide registro."],
      ];
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

// Un video de YouTube bien declarado puede aparecer en la pestaña Videos y con
// miniatura en los resultados, que es tráfico que la ficha sola no consigue.
export function videoJsonLd(opts: {
  videoId: string;
  nombre: string;
  descripcion: string;
  fecha?: string | Date | null;
  duracionSegundos?: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: opts.nombre,
    description: opts.descripcion.slice(0, 300),
    thumbnailUrl: [`https://i.ytimg.com/vi/${opts.videoId}/maxresdefault.jpg`],
    uploadDate: new Date(opts.fecha ?? Date.now()).toISOString(),
    duration: opts.duracionSegundos ? `PT${Math.round(opts.duracionSegundos)}S` : undefined,
    contentUrl: `https://www.youtube.com/watch?v=${opts.videoId}`,
    embedUrl: `https://www.youtube.com/embed/${opts.videoId}`,
    publisher: { "@type": "Organization", name: MARCA, url: SITE },
  };
}
