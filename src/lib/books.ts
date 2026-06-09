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
    publishedAt: row.publishedAt,
    viewsCached: row.viewsCached,
    downloadCount: row.downloadCount,
  };
}

// Regla de integridad de Capa 3: un título licenciado sin licenseRecord
// válido (inexistente o vencido) NO se considera publicable.
export function isPublishable(book: Book): boolean {
  if (book.status === "blocked") return false;
  if (book.contentLayer === 3) {
    const lic = book.licenseRecord;
    if (!lic) return false;
    const expires = new Date(lic.expiresAt);
    if (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now()) {
      return false;
    }
  }
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
