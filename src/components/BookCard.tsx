import Link from "next/link";
import type { Book } from "@/lib/types";
import { Cover } from "@/components/Cover";
import { LANGUAGE_FLAG, getPlayableTrack } from "@/lib/presentation";
import { PlayButton } from "@/components/player/Player";

// Tarjeta de un libro — diseño app: tapa diseñada, hover con elevación,
// info clara debajo.
export function BookCard({ book }: { book: Book }) {
  const track = getPlayableTrack(book);
  return (
    <Link
      href={`/libro/${book.slug}`}
      className="group flex flex-col"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl shadow-[0_8px_24px_-12px_rgba(33,28,24,0.4)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_40px_-16px_rgba(33,28,24,0.5)]">
        <Cover book={book} />
        <div className="absolute top-2.5 right-2.5 text-sm drop-shadow" title="Idioma">
          {LANGUAGE_FLAG[book.language]}
        </div>
        {track && (
          <PlayButton
            track={track}
            ariaLabel={`Reproducir ${book.title}`}
            className="absolute right-2.5 bottom-2.5 grid h-9 w-9 place-items-center rounded-full bg-white text-accent shadow-lg transition hover:scale-110 group-hover:scale-110"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-px" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </PlayButton>
        )}
      </div>
      <div className="px-0.5 pt-2.5">
        <h3 className="font-display text-[15px] leading-snug font-semibold text-ink line-clamp-1">
          {book.title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-soft line-clamp-1">{book.author}</p>
      </div>
    </Link>
  );
}
