import Image from "next/image";
import type { Book } from "@/lib/types";
import { gradientFor, initials } from "@/lib/presentation";

// Portada del libro: usa la imagen real si existe; si no, un placeholder
// elegante con degradado e iniciales (nunca guardamos portadas con copyright).
export function Cover({
  book,
  priority = false,
  sizes = "(max-width: 768px) 45vw, 200px",
}: {
  book: Book;
  priority?: boolean;
  sizes?: string;
}) {
  if (book.coverImageUrl) {
    return (
      <Image
        src={book.coverImageUrl}
        alt={`Portada de ${book.title}`}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradientFor(
        book.slug,
      )} p-3 text-center`}
    >
      <span className="text-3xl font-black text-white/90 drop-shadow-sm">
        {initials(book)}
      </span>
      <span className="mt-2 line-clamp-3 text-xs font-medium text-white/90">
        {book.title}
      </span>
    </div>
  );
}
