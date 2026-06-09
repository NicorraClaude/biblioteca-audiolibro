// Utilidades de texto. Normaliza para búsqueda "sin acentos" y case-insensitive.
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // saca tildes/diacríticos combinados
    .trim();
}

// Convierte un título en slug URL-friendly: "El Quijote, Vol. 1" → "el-quijote-vol-1"
export function slugify(input: string): string {
  return normalize(input)
    .replace(/[^a-z0-9]+/g, "-") // todo lo no alfanumérico → guion
    .replace(/^-+|-+$/g, "") // saca guiones de los bordes
    .slice(0, 80);
}
