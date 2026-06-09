import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSlugs, getBookBySlug, isPublishable } from "@/lib/books";
import { Cover } from "@/components/Cover";
import { LayerBadge } from "@/components/LayerBadge";
import { AudioSection } from "@/components/AudioSection";
import { LANGUAGE_LABEL, LAYER_INFO } from "@/lib/presentation";

// Solo existen las páginas de los libros públicos. Cualquier otro slug (backlog
// privado o inexistente) devuelve 404 limpio, sin tocar la base en runtime.
export const dynamicParams = false;

// Genera una página estática por cada libro público (SSG).
export async function generateStaticParams() {
  const slugs = await getPublicSlugs();
  return slugs.map((slug) => ({ slug }));
}

// SEO: metadata por libro.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return { title: "Libro no encontrado" };
  return {
    title: `${book.title} — ${book.author}`,
    description: book.description.slice(0, 160),
    openGraph: {
      title: `${book.title} — ${book.author}`,
      description: book.description.slice(0, 160),
      images: book.coverImageUrl ? [book.coverImageUrl] : undefined,
    },
  };
}

const librivoxSearch = (title: string) =>
  `https://librivox.org/search?q=${encodeURIComponent(title)}&search_form=get_results`;

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  // No publicamos lo que hoy no se puede entregar (backlog privado): 404.
  if (!book || !isPublishable(book)) notFound();

  const info = LAYER_INFO[book.contentLayer];

  // Datos estructurados para buscadores (SEO).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": book.contentLayer === 1 ? "Audiobook" : "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    inLanguage: book.language,
    description: book.description,
    ...(book.coverImageUrl ? { image: book.coverImageUrl } : {}),
  };

  return (
    <article>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        ← Volver al catálogo
      </Link>

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        {/* Columna izquierda: portada */}
        <div>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-stone-100 shadow-sm ring-1 ring-stone-200">
            <Cover book={book} priority sizes="260px" />
          </div>
        </div>

        {/* Columna derecha: info + acción */}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <LayerBadge layer={book.contentLayer} />
            <span className="text-sm text-stone-500">
              {LANGUAGE_LABEL[book.language]}
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">
            {book.title}
          </h1>
          <p className="mt-1 text-lg text-stone-600">{book.author}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {book.categories.map((c) => (
              <span
                key={c}
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600"
              >
                {c}
              </span>
            ))}
          </div>

          <p className="mt-5 leading-relaxed text-stone-700">
            {book.description}
          </p>

          {/* Nota legal de la capa */}
          <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">
            {info.description}
          </p>

          {/* --- Acción según la capa --- */}
          <div className="mt-6 space-y-4">
            {/* CAPA 1 — audiolibro completo + descarga */}
            {book.contentLayer === 1 && (
              <>
                <AudioSection
                  versions={book.audioVersions}
                  librivoxUrl={book.librivoxUrl ?? librivoxSearch(book.title)}
                />
                <div className="flex flex-wrap gap-3">
                  {book.ebookEpubUrl && (
                    <a
                      href={book.ebookEpubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      ⬇ Descargar e-book (EPUB)
                    </a>
                  )}
                  {book.sourceUrl && (
                    <a
                      href={book.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      Más formatos en {book.sourceName} ↗
                    </a>
                  )}
                </div>
              </>
            )}

            {/* CAPA 2 — reseña + afiliados */}
            {book.contentLayer === 2 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="font-semibold text-amber-900">
                  Dónde conseguirlo
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  Este libro tiene derechos vigentes. Te dejamos los lugares para
                  conseguirlo (links de afiliado: comprando ahí, apoyás la
                  biblioteca sin costo extra).
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {book.affiliateLinks.map((a) => (
                    <a
                      key={a.store}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-amber-700"
                    >
                      Ver en {a.store} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* CAPA 3 — licenciada con acuerdo válido (player licenciado, futuro).
                Las de Capa 3 SIN licencia válida nunca llegan acá: dan 404. */}
            {book.contentLayer === 3 && (
              <AudioSection
                versions={book.audioVersions}
                librivoxUrl={null}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
