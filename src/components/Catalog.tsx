"use client";

import { useMemo, useState } from "react";
import type { Book, Language } from "@/lib/types";
import { BookCard } from "@/components/BookCard";
import { normalize } from "@/lib/text";
import { LANGUAGE_LABEL, hasPlayableAudio } from "@/lib/presentation";

type SortKey = "az" | "za";

export function Catalog({ books }: { books: Book[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("todas");
  const [language, setLanguage] = useState<"todos" | Language>("todos");
  const [sort, setSort] = useState<SortKey>("az");
  const [onlyAudio, setOnlyAudio] = useState(false);

  const audioCount = useMemo(
    () => books.filter(hasPlayableAudio).length,
    [books],
  );

  // Lista de categorías única, ordenada.
  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.categories.forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [books]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const result = books.filter((b) => {
      if (category !== "todas" && !b.categories.includes(category)) return false;
      if (language !== "todos" && b.language !== language) return false;
      if (onlyAudio && !hasPlayableAudio(b)) return false;
      if (q) {
        const haystack = normalize(`${b.title} ${b.author}`);
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    result.sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, "es");
      return sort === "az" ? cmp : -cmp;
    });
    return result;
  }, [books, query, category, language, sort, onlyAudio]);

  const hasFilters =
    query !== "" || category !== "todas" || language !== "todos" || onlyAudio;

  return (
    <div>
      {/* Buscador */}
      <div className="relative mb-4">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-stone-400">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o autor…"
          className="w-full rounded-xl border border-stone-200 bg-white py-3 pr-4 pl-11 text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select
          label="Categoría"
          value={category}
          onChange={setCategory}
          options={[
            { value: "todas", label: "Todas las categorías" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          label="Idioma"
          value={language}
          onChange={(v) => setLanguage(v as "todos" | Language)}
          options={[
            { value: "todos", label: "Todos los idiomas" },
            { value: "es", label: LANGUAGE_LABEL.es },
            { value: "en", label: LANGUAGE_LABEL.en },
          ]}
        />
        <Select
          label="Orden"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={[
            { value: "az", label: "A → Z" },
            { value: "za", label: "Z → A" },
          ]}
        />
        <button
          onClick={() => setOnlyAudio((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium shadow-sm transition ${
            onlyAudio
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          🎧 Solo con audio
          <span className="text-xs text-stone-400">({audioCount})</span>
        </button>
        {hasFilters && (
          <button
            onClick={() => {
              setQuery("");
              setCategory("todas");
              setLanguage("todos");
              setOnlyAudio(false);
            }}
            className="ml-1 text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-sm text-stone-500">
          {filtered.length}{" "}
          {filtered.length === 1 ? "título" : "títulos"}
        </span>
      </div>

      {/* Grilla */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-stone-300 py-16 text-center text-stone-500">
          No encontramos títulos con esos filtros.
          <br />
          <button
            onClick={() => {
              setQuery("");
              setCategory("todas");
              setLanguage("todos");
              setOnlyAudio(false);
            }}
            className="mt-2 font-medium text-amber-700 hover:text-amber-900"
          >
            Ver todo el catálogo
          </button>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm shadow-sm">
      <span className="text-stone-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-stone-800 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
