// Estilo de voz según el GÉNERO del libro (a partir de sus categorías).
// Ajusta velocidad + tono (pitch) para edge-tts y deja instrucciones para la
// versión premium (OpenAI). Las voces (onyx/nova) las sigue eligiendo el usuario;
// esto le pone el "clima" del género encima.

export type Genre = "infantil" | "terror" | "drama" | "aventura" | "scifi" | "neutral";

// Prioridad: el primer género que matchee gana (de más específico a más general).
const CATEGORY_TO_GENRE: [string[], Genre][] = [
  [["Infantil", "Cuentos", "Fábulas"], "infantil"],
  [["Terror", "Misterio"], "terror"],
  [["Romance"], "drama"],
  [["Aventura"], "aventura"],
  [["Ciencia ficción", "Fantasía", "Realismo mágico"], "scifi"],
];

export function genreOf(categories: string[]): Genre {
  for (const [cats, genre] of CATEGORY_TO_GENRE) {
    if (categories.some((c) => cats.includes(c))) return genre;
  }
  return "neutral";
}

type Style = { speed: number; pitch: string; instructions: string };

// Velocidades suaves (el usuario igual puede acelerar con el control 0.8x–2x).
const STYLES: Record<Genre, Style> = {
  infantil: { speed: 1.08, pitch: "+12Hz", instructions: "Tono cálido, alegre y juguetón, animado y con asombro, como contándole un cuento a un niño." },
  terror: { speed: 1.0, pitch: "-12Hz", instructions: "Tono de suspenso, oscuro y tenso, grave y pausado, creando atmósfera inquietante." },
  drama: { speed: 1.02, pitch: "+0Hz", instructions: "Tono dramático, íntimo y emotivo, pausado, con peso emocional." },
  aventura: { speed: 1.06, pitch: "+2Hz", instructions: "Tono enérgico y vivo, con ritmo, transmitiendo movimiento y emoción." },
  scifi: { speed: 1.03, pitch: "-4Hz", instructions: "Tono claro y envolvente, con un dejo de misterio y asombro." },
  neutral: { speed: 1.04, pitch: "+0Hz", instructions: "Tono de narrador claro, cálido y natural." },
};

export function styleFor(categories: string[]): Style & { genre: Genre } {
  const genre = genreOf(categories);
  return { genre, ...STYLES[genre] };
}
