// Catálogo de voces para el narrado TTS.
// Arrancamos con 2 voces multilingües (OpenAI TTS); preparado para escalar a 4
// (una masculina y una femenina dedicada por idioma).
import type { Language } from "@/lib/types";

export type Voice = {
  id: string;
  name: string;
  gender: "M" | "F";
  // Idiomas para los que esta voz es preferida. null = multilingüe (sirve para todos).
  languages: Language[] | null;
};

export const VOICES: Voice[] = [
  { id: "onyx", name: "Onyx · voz masculina", gender: "M", languages: null },
  { id: "nova", name: "Nova · voz femenina", gender: "F", languages: null },
  // Escalado futuro (descomentar al activar 4 voces):
  // { id: "echo",  name: "Echo · masculina (EN)",  gender: "M", languages: ["en"] },
  // { id: "shimmer", name: "Shimmer · femenina (ES)", gender: "F", languages: ["es"] },
];

export function voicesForLanguage(lang: Language): Voice[] {
  return VOICES.filter((v) => v.languages === null || v.languages.includes(lang));
}
