import type { Book } from "@/lib/types";
import { BookCard } from "@/components/BookCard";
import { FilaScroll } from "@/components/FilaScroll";

// Fila horizontal de libros con scroll (para novedades y colecciones).
// Cada tarjeta mantiene el ancho de la grilla del catálogo para no romper la escala.
export function BookRow({
  title,
  subtitle,
  emoji,
  books,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  books: Book[];
}) {
  if (books.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
            {emoji && <span className="mr-2">{emoji}</span>}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      <FilaScroll id={title} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-4 pb-2">
          {books.map((b) => (
            <li key={b.id} className="w-[140px] shrink-0 sm:w-[160px]">
              <BookCard book={b} />
            </li>
          ))}
        </ul>
      </FilaScroll>
    </section>
  );
}
