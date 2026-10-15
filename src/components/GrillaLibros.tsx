import type { Book } from "@/lib/types";
import { BookCard } from "@/components/BookCard";

// Grilla simple de tarjetas, para las páginas de categoría y de autor.
// (La home usa Catalog, que además filtra y busca del lado del navegador.)
export function GrillaLibros({ libros }: { libros: Book[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {libros.map((b) => (
        <BookCard key={b.slug} book={b} />
      ))}
    </div>
  );
}
