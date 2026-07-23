import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSlugs, getBookBySlug, isPublishable } from "@/lib/books";
import { Cover } from "@/components/Cover";
import { AudioSection } from "@/components/AudioSection";
import { BookContent } from "@/components/BookContent";
import { EnviarKindle } from "@/components/EnviarKindle";
import { ChatLibro } from "@/components/ChatLibro";
import { ResumenMedida } from "@/components/ResumenMedida";
import { Reviews } from "@/components/Reviews";
import { LANGUAGE_LABEL, LAYER_INFO } from "@/lib/presentation";
import { withAffiliateTag } from "@/lib/affiliates";

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
  const desc = (book.summary?.[book.language]?.sinopsis?.text ?? book.description).replace(/\s+/g, " ").slice(0, 200);
  const url = `https://biblioteca-audiolibros.vercel.app/libro/${book.slug}`;
  return {
    title: `${book.title} — ${book.author}`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${book.title} — ${book.author}`,
      description: desc,
      url,
      siteName: "Biblioteca Abierta",
      type: "book",
      locale: book.language === "es" ? "es_AR" : "en_US",
    },
    twitter: { card: "summary_large_image", title: `${book.title} — ${book.author}`, description: desc },
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

  return (
    <article>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
            <span className="text-ink-soft">{LANGUAGE_LABEL[book.language]}</span>
          </div>

          <h1 className="font-display text-3xl leading-tight font-semibold text-balance text-ink sm:text-5xl">
            {book.title}
          </h1>
          <p className="mt-2 text-lg text-ink-soft">{book.author}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {book.categories.map((c) => (
              <span key={c} className="rounded-full bg-surface px-3 py-1 text-xs text-ink-soft ring-1 ring-line">
                {c}
              </span>
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
