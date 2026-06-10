import Link from "next/link";
import { notFound } from "next/navigation";
import { getCached } from "@/lib/blob-cache";
import { nameFor, flagFor } from "@/lib/languages";

export const dynamic = "force-dynamic";

// Lector de la TRADUCCIÓN completa (generada con IA, guardada en Blob).
export default async function LeerTraduccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lang: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id, lang } = await params;
  const { t } = await searchParams;
  if (!/^\d+$/.test(id) || !/^[a-z0-9-]+$/.test(lang)) notFound();

  const text = await getCached(`traducciones/${id}-${lang}.txt`);
  if (!text) {
    return (
      <div className="py-16 text-center text-ink-soft">
        Esta traducción todavía no está disponible. Generala desde la ficha del libro.
      </div>
    );
  }

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={`/api/traducir/${id}?lang=${lang}&download=1`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:text-ink"
          >
            ⬇ Descargar
          </a>
          {t && (
            <div className="truncate text-right">
              <p className="truncate font-display font-semibold text-ink">{t}</p>
              <p className="truncate text-xs text-ink-soft">{flagFor(lang)} {nameFor(lang)} · traducción IA</p>
            </div>
          )}
        </div>
      </div>

      <article className="mx-auto max-w-[42rem] font-display text-[1.18rem] leading-[1.85] text-ink/90">
        {t && (
          <h1 className="mb-3 text-center font-display text-3xl font-semibold text-balance text-ink sm:text-4xl">{t}</h1>
        )}
        <p className="mb-10 text-center text-sm text-ink-soft">
          {flagFor(lang)} Traducción al {nameFor(lang)} generada con IA
        </p>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-5">{p}</p>
        ))}
        <p className="mt-12 border-t border-line pt-6 text-center text-sm text-ink-soft">Fin · Traducción de obra de dominio público</p>
      </article>
    </div>
  );
}
