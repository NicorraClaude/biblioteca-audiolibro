// Acceso a datos de libros. Lee desde Prisma y "hidrata" los campos JSON.
// Esta es la ÚNICA capa que toca la base: si en Fase 2 pasamos a Postgres,
// el resto de la app no se entera.
import { prisma } from "@/lib/prisma";
import type {
  AffiliateLink,
  AudioVersion,
  Book,
  ContentLayer,
  Language,
  LicenseRecord,
  SummaryByLang,
  SummaryEntry,
} from "@/lib/types";

// Parsea un campo JSON guardado como texto, con fallback seguro.
function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Normaliza el resumen: acepta el formato viejo plano {es:{text,audioUrl}} y lo
// convierte al nuevo de dos niveles {es:{short:{...}}}.
// Asegura que cada entrada tenga audio.{onyx,nova}; migra el audioUrl viejo a nova.
function normEntry(e: SummaryEntry | undefined): SummaryEntry | undefined {
  if (!e) return undefined;
  const audio = { ...(e.audio ?? {}) };
  if (e.audioUrl && !audio.nova) audio.nova = e.audioUrl;
  return { ...e, audio };
}

function normalizeSummary(
  raw: Record<string, unknown> | null,
): SummaryByLang | null {
  if (!raw) return null;
  const out: SummaryByLang = {};
  for (const lang of ["es", "en"] as const) {
    const v = raw[lang] as
      | {
          text?: string;
          audioUrl?: string;
          short?: SummaryEntry;
          long?: SummaryEntry;
          sinopsis?: SummaryEntry;
          resumen?: SummaryEntry;
        }
      | undefined;
    if (!v) continue;
    const legacy: SummaryEntry | undefined =
      v.text && v.audioUrl ? { text: v.text, audioUrl: v.audioUrl } : undefined;
    out[lang] = {
      sinopsis: normEntry(v.sinopsis ?? v.short ?? legacy),
      resumen: normEntry(v.resumen ?? v.long),
    };
  }
  return Object.keys(out).length ? out : null;
}

// Convierte el registro crudo de la base al tipo de dominio "Book".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hydrate(row: any): Book {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    language: row.language as Language,
    contentLayer: row.contentLayer as ContentLayer,
    contentType: row.contentType,
    status: row.status,
    licenseStatus: row.licenseStatus,
    categories: parseJSON<string[]>(row.categories, []),
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    gutenbergId: row.gutenbergId,
    copyright: row.copyright,
    librivoxUrl: row.librivoxUrl ?? null,
    licenseRecord: parseJSON<LicenseRecord | null>(row.licenseRecord, null),
    ebookPdfUrl: row.ebookPdfUrl,
    ebookEpubUrl: row.ebookEpubUrl,
    affiliateLinks: parseJSON<AffiliateLink[]>(row.affiliateLinks, []),
    audioVersions: parseJSON<AudioVersion[]>(row.audioVersions, []),
    summary: normalizeSummary(
      parseJSON<Record<string, unknown> | null>(row.summary, null),
    ),
    publishedAt: row.publishedAt,
    viewsCached: row.viewsCached,
    downloadCount: row.downloadCount,
  };
}

// Qué se muestra públicamente. POR AHORA: solo DOMINIO PÚBLICO (Capa 1).
// Los libros con copyright —Capa 2 (reseña+afiliados) y Capa 3 (licenciados)—
// NO se muestran en la web hasta tener todo listo (pedido de Nico, jun-2026).
// Para reactivarlos: permitir Capa 2, y Capa 3 con licenseRecord válido vigente.
export function isPublishable(book: Book): boolean {
  if (book.status === "blocked") return false;
  if (book.contentLayer !== 1) return false; // ocultos los copyright por ahora
  return true;
}

// Catálogo PÚBLICO: solo títulos que hoy podemos entregar de verdad.
// Lo que depende de licencias/acuerdos (Capa 3 sin licencia, o blocked) NO se
// muestra públicamente; queda en el backlog privado (ver getBacklogBooks).
export async function getPublicBooks(): Promise<Book[]> {
  const rows = await prisma.book.findMany({ orderBy: { title: "asc" } });
  return rows.map(hydrate).filter(isPublishable);
}

// Backlog PRIVADO: títulos "nice to have" que dependen de licencias o acuerdos
// y todavía no se pueden resolver. No se exponen al público.
export async function getBacklogBooks(): Promise<Book[]> {
  const rows = await prisma.book.findMany({ orderBy: { title: "asc" } });
  return rows.map(hydrate).filter((b) => !isPublishable(b));
}

// Un libro por su slug (para la ficha). Devuelve null si no existe.
export async function getBookBySlug(slug: string): Promise<Book | null> {
  const row = await prisma.book.findUnique({ where: { slug } });
  return row ? hydrate(row) : null;
}

// Slugs PÚBLICOS (para generar solo las páginas estáticas que sí se muestran).
export async function getPublicSlugs(): Promise<string[]> {
  const books = await getPublicBooks();
  return books.map((b) => b.slug);
}
