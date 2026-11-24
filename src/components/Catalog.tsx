"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// La portada trae solo los primeros libros (`books`) y los números del catálogo
// entero (`resumen`). El resto se pide a /api/catalogo cuando la persona llega a
// esta sección o toca un filtro: así la portada pesa poco para quien no lo usa.
export function Catalog({
  books: primeros,
  resumen,
}: {
  books: Book[];
  resumen: { total: number; conAudio: number; categorias: [string, number][] };
}) {
  const [todos, setTodos] = useState<Book[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const pedido = useRef(false);
  const caja = useRef<HTMLDivElement>(null);
  const cargar = () => {
    if (pedido.current) return;
    pedido.current = true;
    setFallo(false);
    fetch("/api/catalogo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((lista: Book[]) => setTodos(lista))
      .catch(() => { pedido.current = false; setFallo(true); });
  };
  useEffect(() => {
    const el = caja.current;
    if (!el || !("IntersectionObserver" in window)) { cargar(); return; }
    const ojo = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { cargar(); ojo.disconnect(); } }, { rootMargin: "600px" });
    ojo.observe(el);
    return () => ojo.disconnect();
  }, []);
  const books = todos ?? primeros;
  const completo = todos !== null || primeros.length >= resumen.total;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [language, setLanguage] = useState<"todos" | Language>("todos");
  const [sort, setSort] = useState<SortKey>("az");
  const [onlyAudio, setOnlyAudio] = useState(false);

  // Categorías con conteo, ordenadas por cantidad (las más pobladas primero).
  const categories = resumen.categorias;
  const audioCount = resumen.conAudio;

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
    <div ref={caja} onFocusCapture={cargar} onPointerDownCapture={cargar}>
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
      ) : null}
      {filtered.length > 0 ? (
        completo ? null : (
        <p className="mt-6 text-center text-sm text-ink-soft">
          {fallo ? (
            <button onClick={cargar} className="font-semibold text-accent hover:text-accent-dark">No se cargó el resto. Reintentar</button>
          ) : (
            `Cargando los ${resumen.total} títulos…`
          )}
        </p>
        )
      ) : !completo ? (
        <div className="rounded-2xl border border-dashed border-line py-20 text-center text-ink-soft">
          {fallo ? "No pudimos cargar el catálogo." : "Buscando en toda la biblioteca…"}
          {fallo && (
            <>
              <br />
              <button onClick={cargar} className="mt-2 font-semibold text-accent hover:text-accent-dark">Reintentar</button>
            </>
          )}
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
