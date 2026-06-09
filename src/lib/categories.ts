// Mapea los "subjects" y "bookshelves" caóticos de Project Gutenberg a un set
// curado de categorías en español, para que los filtros queden limpios.
// Si no matchea nada, cae en "Clásicos" (todo Gutenberg es dominio público clásico).

type Rule = { category: string; match: RegExp };

// El orden importa: la primera regla que matchea, gana (las más específicas arriba).
const RULES: Rule[] = [
  { category: "Infantil", match: /juvenile|children|fairy tales?|nursery/i },
  { category: "Fábulas", match: /fable|aesop/i },
  { category: "Terror", match: /horror|gothic|ghost|vampire|monster/i },
  { category: "Misterio", match: /detective|mystery|crime|thriller/i },
  { category: "Ciencia ficción", match: /science fiction|sci-?fi|dystopia/i },
  { category: "Fantasía", match: /fantasy|imaginary|mythology|legends?/i },
  { category: "Aventura", match: /adventure|pirates?|sea stories|western/i },
  { category: "Romance", match: /love stories|romance|courtship/i },
  { category: "Poesía", match: /poetry|poems?|verse/i },
  { category: "Teatro", match: /drama|plays?|theater|tragedy|comedy/i },
  { category: "Cuentos", match: /short stories|tales/i },
  { category: "Historia", match: /history|biograph|war|historical/i },
  { category: "Filosofía", match: /philosophy|ethics|religion|psychology/i },
  { category: "Ensayo", match: /essays?|criticism|politics|economics/i },
];

export function mapCategories(
  subjects: string[],
  bookshelves: string[] = [],
): string[] {
  const haystack = [...subjects, ...bookshelves].join(" | ");
  const found = new Set<string>();
  for (const rule of RULES) {
    if (rule.match.test(haystack)) found.add(rule.category);
    if (found.size >= 3) break; // máximo 3 categorías por libro
  }
  if (found.size === 0) found.add("Clásicos");
  return Array.from(found);
}
