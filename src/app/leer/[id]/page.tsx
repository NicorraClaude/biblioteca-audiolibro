import Link from "next/link";
import { notFound } from "next/navigation";
import { stripGutenbergBoilerplate } from "@/lib/tts/text";

export const dynamic = "force-dynamic";

// Lector online: muestra el e-book de dominio público DENTRO de nuestra web,
// sin descargar y sin mandar a nadie afuera.
export default async function LeerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; a?: string }>;
}) {
  const { id } = await params;
  const { t, a } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const res = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, {
    headers: { "User-Agent": "BibliotecaAbierta/1.0" },
    // cache del lado servidor por un día
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    return (
      <div className="py-16 text-center text-ink-soft">
        No pudimos abrir el libro ahora. Probá de nuevo en un rato.
      </div>
    );
  }
  const text = stripGutenbergBoilerplate(await res.text())
    .replace(/\[(?:illustration|footnote|sidenote)[^\]]*\]/gi, "")
    .replace(/_/g, "");
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </Link>
        {t && (
          <div className="truncate text-right">
            <p className="truncate font-display font-semibold text-ink">{t}</p>
            {a && <p className="truncate text-xs text-ink-soft">{a}</p>}
          </div>
        )}
      </div>

      <article className="mx-auto max-w-[42rem] font-display text-[1.18rem] leading-[1.85] text-ink/90">
        {t && (
          <h1 className="mb-10 text-center font-display text-3xl font-semibold text-balance text-ink sm:text-4xl">
            {t}
          </h1>
        )}
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-5">
            {p}
          </p>
        ))}
        <p className="mt-12 border-t border-line pt-6 text-center text-sm text-ink-soft">
          Fin · Obra de dominio público
        </p>
      </article>
    </div>
  );
}
