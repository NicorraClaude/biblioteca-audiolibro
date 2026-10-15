import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSlugs, getBookBySlug, getPublicBooks, isPublishable } from "@/lib/books";
import { Cover } from "@/components/Cover";
import { AudioSection } from "@/components/AudioSection";
import { BookContent } from "@/components/BookContent";
import { EnviarKindle } from "@/components/EnviarKindle";
import { ChatLibro } from "@/components/ChatLibro";
import { ResumenMedida } from "@/components/ResumenMedida";
import { Reviews } from "@/components/Reviews";
import { LANGUAGE_FLAG, LAYER_INFO } from "@/lib/presentation";
import { withAffiliateTag } from "@/lib/affiliates";
import { SITE, MARCA, autores, breadcrumb, faqFicha, slugificar, tituloFicha, videoJsonLd } from "@/lib/seo";

// Solo se generan las fichas públicas (dominio público). Cualquier otro slug
// —incluidos los libros con copyright ocultos— da 404 limpio, sin intentar
// renderizar en runtime (el sitio es estático, no hay base de datos en el server).
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getPublicSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return { title: "Libro no encontrado" };
  // La descripción arranca con la promesa (gratis, en audio, sin registro) y sigue
  // con la sinopsis: es lo que se lee en el resultado de Google y define el clic.
  const sinopsis = (book.summary?.es?.sinopsis?.text ?? book.summary?.[book.language]?.sinopsis?.text ?? book.description)
    .replace(/\s+/g, " ");
  const gancho = book.contentLayer === 1
    ? `Escuchá ${book.title}, de ${book.author}, completo y gratis en español. Audio y texto, sin registro. `
    : `Resumen y análisis en audio de ${book.title}, de ${book.author}, gratis y en español. `;
  const desc = (gancho + sinopsis).slice(0, 300);
  const url = `${SITE}/libro/${book.slug}`;
  const titulo = tituloFicha(book);
  return {
    title: titulo,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: desc,
      url,
      siteName: MARCA,
      type: "book",
      locale: book.language === "es" ? "es_AR" : "en_US",
    },
    twitter: { card: "summary_large_image", title: titulo, description: desc },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book || !isPublishable(book)) notFound();

  const info = LAYER_INFO[book.contentLayer];
  const aiCtx = {
    title: book.title,
    author: book.author,
    slug: book.slug,
    description: book.description,
    sinopsis: book.summary?.es?.sinopsis?.text ?? book.summary?.en?.sinopsis?.text,
    resumen: book.summary?.es?.resumen?.text ?? book.summary?.en?.resumen?.text,
  };
  // JSON-LD rico: Audiobook con abstract=sinopsis + AudioObject cuando ya
  // tenemos audio, para que Google entienda que es un audiolibro reproducible.
  const sin = book.summary?.[book.language]?.sinopsis ?? book.summary?.es?.sinopsis ?? book.summary?.en?.sinopsis;
  const sinAudio = sin?.audio?.onyx ?? sin?.audio?.nova ?? sin?.audioUrl;
  const audioVersion = book.audioVersions.find((v) => (v.youtubeVideoId && v.youtubePublic) || (v.audioUrl && v.status === "ready"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": book.contentLayer === 1 ? "Audiobook" : "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    inLanguage: book.language,
    description: book.description,
    abstract: sin?.text ?? undefined,
    image: book.coverImageUrl ?? `https://biblioteca-audiolibros.vercel.app/libro/${book.slug}/opengraph-image`,
    url: `https://biblioteca-audiolibros.vercel.app/libro/${book.slug}`,
    isAccessibleForFree: true,
    isFamilyFriendly: book.categories.includes("Infantil") ? true : undefined,
    genre: book.categories,
    publisher: { "@type": "Organization", name: "Biblioteca Abierta" },
  };
  if (audioVersion?.audioUrl) {
    jsonLd.associatedMedia = {
      "@type": "AudioObject",
      contentUrl: audioVersion.audioUrl,
      encodingFormat: "audio/mpeg",
      duration: audioVersion.durationSeconds ? `PT${audioVersion.durationSeconds}S` : undefined,
    };
  } else if (audioVersion?.youtubeVideoId && audioVersion.youtubePublic) {
    jsonLd.associatedMedia = {
      "@type": "VideoObject",
      contentUrl: `https://www.youtube.com/watch?v=${audioVersion.youtubeVideoId}`,
      embedUrl: `https://www.youtube.com/embed/${audioVersion.youtubeVideoId}`,
    };
  } else if (sinAudio) {
    jsonLd.associatedMedia = { "@type": "AudioObject", contentUrl: sinAudio, encodingFormat: "audio/mpeg", name: "Sinopsis" };
  }

  // ¿Tiene página propia el autor? (solo los que tienen dos o más obras).
  const tieneAutor = (await autores(await getPublicBooks())).some((a) => a.slug === slugificar(book.author));

  // Migas, preguntas frecuentes y, si hay video, su ficha de VideoObject: los tres
  // pueden salir desplegados en Google y son tráfico que la página sola no trae.
  const primeraCat = (book.categories ?? [])[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLdExtra: Record<string, any>[] = [
    breadcrumb([
      { nombre: "Inicio", url: SITE },
      ...(primeraCat ? [{ nombre: primeraCat, url: `${SITE}/categoria/${slugificar(primeraCat)}` }] : []),
      { nombre: book.title, url: `${SITE}/libro/${book.slug}` },
    ]),
    faqFicha(book),
  ];
  const videoCompleto = book.audioVersions.find((v) => v.youtubeVideoId && v.youtubePublic);
  const videoResumen = book.summary?.es?.resumen?.youtubeVideoId;
  if (videoCompleto?.youtubeVideoId) {
    jsonLdExtra.push(videoJsonLd({
      videoId: videoCompleto.youtubeVideoId,
      nombre: `${book.title} — Audiolibro completo en español`,
      descripcion: sin?.text ?? book.description,
      fecha: book.publishedAt,
      duracionSegundos: videoCompleto.durationSeconds,
    }));
  }
  if (videoResumen) {
    jsonLdExtra.push(videoJsonLd({
      videoId: videoResumen,
      nombre: `${book.title} — Resumen en español`,
      descripcion: sin?.text ?? book.description,
      fecha: book.publishedAt,
    }));
  }

  return (
    <article>
      <script
        type="application/ld+json"
         
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, ...jsonLdExtra]) }}
      />

      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Volver
      </Link>

      <div className="grid gap-8 md:grid-cols-[300px_1fr] lg:gap-12">
        {/* Tapa */}
        <div className="mx-auto w-44 sm:w-56 md:mx-0 md:w-full">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-3xl shadow-[0_24px_60px_-20px_rgba(33,28,24,0.55)] ring-1 ring-black/5">
            <Cover book={book} variant="detail" />
          </div>
        </div>

        {/* Info + acción */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-dark uppercase">
              {info.short}
            </span>
            {/* Idiomas REALES de la ficha. Capa 1 se traduce on-demand a cualquier
                idioma; Capa 2 muestra solo los que efectivamente generamos. */}
            {(() => {
              const langs = (["es", "en"] as const).filter(
                (l) => book.summary?.[l]?.sinopsis || book.summary?.[l]?.resumen,
              );
              const shown = book.contentLayer === 1 ? (["es", "en"] as const) : langs;
              if (shown.length === 0) return null;
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-ink-soft ring-1 ring-line">
                  {shown.map((l) => (
                    <span key={l} title={l === "es" ? "Español" : "Inglés"}>
                      {LANGUAGE_FLAG[l]}
                    </span>
                  ))}
                  <span className="ml-1 uppercase">
                    {shown.length > 1
                      ? `Disponible en ${shown.length} idiomas`
                      : shown[0] === "es"
                        ? "En español"
                        : "En inglés"}
                  </span>
                </span>
              );
            })()}
          </div>

          <h1 className="font-display text-3xl leading-tight font-semibold text-balance text-ink sm:text-5xl">
            {book.title}
          </h1>
          {/* Autor y categorías son ENLACES: así se navega entre obras parecidas y
              así descubre Google las fichas, siguiendo esos enlaces. */}
          <p className="mt-2 text-lg text-ink-soft">
            {tieneAutor ? (
              <Link href={`/autor/${slugificar(book.author)}`} className="transition hover:text-ink hover:underline">
                {book.author}
              </Link>
            ) : (
              book.author
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {book.categories.map((c) => (
              <Link
                key={c}
                href={`/categoria/${slugificar(c)}`}
                className="rounded-full bg-surface px-3 py-1 text-xs text-ink-soft ring-1 ring-line transition hover:bg-black/5 hover:text-ink"
              >
                {c}
              </Link>
            ))}
          </div>

          <p className="mt-6 max-w-2xl leading-relaxed text-ink/80">{book.description}</p>

          <div className="mt-7 space-y-4">
            {book.contentLayer === 1 && (
              <>
                <BookContent book={book} />
                <ChatLibro id={book.gutenbergId ?? book.id} ctx={aiCtx} />
                <ResumenMedida id={book.gutenbergId ?? book.id} ctx={aiCtx} />
                {book.gutenbergId && (
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`/descargar/${book.gutenbergId}?n=${book.slug}`}
                      className="inline-flex items-center gap-2 rounded-full bg-mint px-5 py-3 font-semibold text-white shadow-lg shadow-mint/25 transition hover:brightness-95 active:scale-95"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Descargar e-book
                    </a>
                    <EnviarKindle downloadUrl={`/descargar/${book.gutenbergId}?n=${book.slug}`} />
                  </div>
                )}
              </>
            )}

            {book.contentLayer === 2 && (
              <>
                {/* Obra propia: reseña editorial + análisis original (texto y audio). */}
                <BookContent book={book} />
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <h2 className="font-display text-lg font-semibold text-amber-900">Dónde conseguirlo</h2>
                <p className="mt-1 text-sm text-amber-800/90">
                  Libro con derechos vigentes. Comprándolo desde acá, apoyás la
                  biblioteca sin costo extra.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {book.affiliateLinks.map((a) => (
                    <a
                      key={a.store}
                      href={withAffiliateTag(a.store, a.url)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-95"
                    >
                      Ver en {a.store} ↗
                    </a>
                  ))}
                </div>
                </div>
              </>
            )}

            {book.contentLayer === 3 && <AudioSection book={book} />}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Reviews id={book.gutenbergId ?? book.id} />
      </div>
    </article>
  );
}
