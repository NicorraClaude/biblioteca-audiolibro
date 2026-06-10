import type { Book } from "@/lib/types";
import { coverColors } from "@/lib/presentation";

// Tapa SIEMPRE diseñada (tipográfica, identidad propia). No usamos imágenes de
// fuentes externas (Gutenberg/Open Library): la biblioteca es una base ORIGINAL,
// no un repositorio de otros sitios.
export function Cover({
  book,
  variant = "card",
}: {
  book: Book;
  variant?: "card" | "detail";
}) {
  const [from, to] = coverColors(book.slug);

  // Tapa diseñada
  const initial = book.title.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase();
  const detail = variant === "detail";
  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden"
      style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
    >
      <span
        className="pointer-events-none absolute -right-3 -bottom-8 font-display font-black leading-none text-white/10 select-none"
        style={{ fontSize: detail ? "16rem" : "9rem" }}
        aria-hidden
      >
        {initial}
      </span>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-2 w-px bg-white/20" />
      <div className={`relative z-10 flex flex-1 flex-col ${detail ? "p-6" : "p-4"}`}>
        <span
          className={`font-medium tracking-[0.18em] text-white/60 uppercase ${detail ? "text-xs" : "text-[9px]"}`}
        >
          {book.contentLayer === 1 ? "Audiolibro" : book.contentLayer === 2 ? "Reseña" : "Edición"}
        </span>
        <div className="mt-auto">
          <h3
            className={`font-display font-semibold text-balance text-white drop-shadow-sm ${
              detail ? "text-3xl leading-tight" : "line-clamp-4 text-lg leading-[1.15]"
            }`}
          >
            {book.title}
          </h3>
          <p className={`mt-2 text-white/70 ${detail ? "text-sm" : "line-clamp-1 text-xs"}`}>
            {book.author}
          </p>
        </div>
      </div>
    </div>
  );
}
