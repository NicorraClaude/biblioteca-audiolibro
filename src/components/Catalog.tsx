"use client";

import { useMemo, useState } from "react";
import type { Book, Language } from "@/lib/types";
import { BookCard } from "@/components/BookCard";
import { normalize } from "@/lib/text";
import { hasPlayableAudio } from "@/lib/presentation";

type SortKey = "az" | "za";

// Emoji por categoría (para dar identidad a los chips y hacer más navegable).
const CATEGORY_EMOJI: Record<string, string> = {
  Historia: "🏛️",
  Romance: "💌",
  Fantasía: "🐉",
  Clásicos: "📖",
  Aventura: "🗺️",
  Misterio: "🕵️",
  Filosofía: "🧠",
  Cuentos: "📜",
  Infantil: "🧸",
  Ensayo: "✍️",
  Poesía: "🌿",
  Terror: "🕯️",
  Teatro: "🎭",
  "Ciencia ficción": "🚀",
  Fábulas: "🐿️",
  "Desarrollo personal": "🌱",
  "Realismo mágico": "✨",
  "Negocios y emprendimientos": "💼",
  Startups: "🚀",
  Liderazgo: "🎯",
  "Finanzas personales": "💰",
  Productividad: "⚡",
  Ventas: "🤝",
  Biografía: "👤",
};

export function Catalog({ books }: { books: Book[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [language, setLanguage] = useState<"todos" | Language>("todos");
  const [sort, setSort] = useState<SortKey>("az");
  const [onlyAudio, setOnlyAudio] = useState(false);

  // Categorías con conteo, ordenadas por cantidad (las más pobladas primero).
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    books.forEach((b) => b.categories.forEach((c) => count.set(c, (count.get(c) ?? 0) + 1)));
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]);
  }, [books]);

  const audioCount = useMemo(() => books.filter(hasPlayableAudio).length, [books]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const result = books.filter((b) => {
      if (category !== "todas" && !b.categories.includes(category)) return false;
      if (language !== "todos" && b.language !== language) return false;
      if (onlyAudio && !hasPlayableAudio(b)) return false;
      if (q && !normalize(`${b.title} ${b.author}`).includes(q)) return false;
      return true;
    });
    result.sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, "es");
      return sort === "az" ? cmp : -cmp;
    });
    return result;
  }, [books, query, category, language, sort, onlyAudio]);

  return (
    <div>
      {/* Búsqueda */}
      <div className="relative mb-5">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o autor…"
          className="w-full rounded-full border border-line bg-surface py-4 pr-5 pl-13 text-ink shadow-sm outline-none transition placeholder:text-ink-soft/70 focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
      </div>

      {/* Filtros rápidos */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Toggle active={onlyAudio} onClick={() => setOnlyAudio((v) => !v)}>
          🎧 Con audio
          <span className="ml-1 text-xs opacity-60">{audioCount}</span>
        </Toggle>
        <Chip active={language === "todos"} onClick={() => setLanguage("todos")}>
          Todos
        </Chip>
        <Chip active={language === "es"} onClick={() => setLanguage("es")}>
          🇪🇸 Español
        </Chip>
        <Chip active={language === "en"} onClick={() => setLanguage("en")}>
          🇬🇧 Inglés
        </Chip>
        <button
          onClick={() => setSort((s) => (s === "az" ? "za" : "az"))}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          {sort === "az" ? "A → Z" : "Z → A"}
        </button>
      </div>

      {/* Categorías (chips scrollables) con emoji y conteo */}
      <div className="mb-7 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Chip active={category === "todas"} onClick={() => setCategory("todas")}>
          Todas
        </Chip>
        {categories.map(([c, n]) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            <span className="mr-1">{CATEGORY_EMOJI[c] ?? "📚"}</span>
            {c}
            <span className="ml-1.5 text-xs opacity-60">{n}</span>
          </Chip>
        ))}
      </div>

      {/* Grilla */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line py-20 text-center text-ink-soft">
          No encontramos títulos con esos filtros.
          <br />
          <button
            onClick={() => {
              setQuery("");
              setCategory("todas");
              setLanguage("todos");
              setOnlyAudio(false);
            }}
            className="mt-2 font-semibold text-accent hover:text-accent-dark"
          >
            Ver todo el catálogo
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition active:scale-95 ${
        active
          ? "bg-ink text-paper shadow-sm"
          : "bg-surface text-ink-soft ring-1 ring-line hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
        active
          ? "bg-accent text-white shadow-sm shadow-accent/30"
          : "bg-surface text-ink-soft ring-1 ring-line hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
