// Colecciones curadas: pequeñas selecciones temáticas para el home.
// Cada colección define qué categorías incluir y cuántos títulos mostrar.
// La priorización es por descargas (los más populares primero).
import type { Book } from "@/lib/types";

export type Coleccion = {
  slug: string;
  title: string;
  subtitle: string;
  emoji: string;
  match: (b: Book) => boolean;
  limit: number;
};

export const COLECCIONES: Coleccion[] = [
  {
    slug: "clasicos-para-empezar",
    title: "Clásicos para empezar",
    subtitle: "Diez puertas de entrada a la gran literatura",
    emoji: "📖",
    match: (b) => b.categories.includes("Clásicos"),
    limit: 10,
  },
  {
    slug: "cuentos-para-dormir",
    title: "Cuentos para dormir",
    subtitle: "Historias breves para leer o escuchar antes de apagar la luz",
    emoji: "🌙",
    match: (b) => b.categories.includes("Infantil") || b.categories.includes("Cuentos") || b.categories.includes("Fábulas"),
    limit: 12,
  },
  {
    slug: "terror-victoriano",
    title: "Terror victoriano",
    subtitle: "Fantasmas, dobles y noches sin dormir",
    emoji: "🕯️",
    match: (b) => b.categories.includes("Terror") || b.categories.includes("Misterio"),
    limit: 10,
  },
  {
    slug: "aventura-clasica",
    title: "Aventura clásica",
    subtitle: "Mares, mapas y expediciones inolvidables",
    emoji: "🗺️",
    match: (b) => b.categories.includes("Aventura"),
    limit: 10,
  },
];

export function pickForColeccion(books: Book[], c: Coleccion): Book[] {
  return books
    .filter(c.match)
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, c.limit);
}
