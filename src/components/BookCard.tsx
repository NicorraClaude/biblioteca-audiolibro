import Link from "next/link";
import type { Book } from "@/lib/types";
import { Cover } from "@/components/Cover";
import { LayerBadge } from "@/components/LayerBadge";
import { LANGUAGE_FLAG, hasPlayableAudio } from "@/lib/presentation";

// Tarjeta de un libro en la grilla del catálogo.
export function BookCard({ book }: { book: Book }) {
  const blocked = book.status === "blocked";
  return (
    <Link
      href={`/libro/${book.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg hover:ring-stone-300"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-stone-100">
        <Cover book={book} />
        <div className="absolute top-2 left-2">
          <LayerBadge layer={book.contentLayer} blocked={blocked} />
        </div>
        <div className="absolute top-2 right-2 text-base" title="Idioma">
          {LANGUAGE_FLAG[book.language]}
        </div>
        {hasPlayableAudio(book) && (
          <div
            className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white"
            title="Con audio para escuchar"
          >
            🎧 Audio
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-stone-900">
          {book.title}
        </h3>
        <p className="mt-1 text-xs text-stone-500">{book.author}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {book.categories.slice(0, 2).map((c) => (
            <span
              key={c}
              className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
