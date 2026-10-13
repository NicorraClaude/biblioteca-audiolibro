// Los TEXTOS del catálogo (sinopsis y resumen, en español e inglés) viven en un
// archivo por libro: prisma/textos/<slug>.json. En prisma/seed-data.json queda
// todo lo demás (título, autor, audios, videos, categorías…) con summary en null.
//
// POR QUÉ. Los textos eran el 95% del peso: seed-data.json llegó a 51,8 MB con 824
// libros y GitHub no acepta archivos de más de 100 MB. A 12 libros por día, el
// sistema entero se frenaba en dos meses. Además cada corrida reescribía esos 50 MB
// enteros, así que el historial del repo crecía sin control (750 MB en dos meses).
//
// Partido así: el índice queda chico y las corridas tocan solo los pocos libros que
// cambiaron. seed-data.json SIGUE EXISTIENDO porque ocho workflows lo nombran y no
// tengo permiso para editar esos YAML.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

export const DIR_TEXTOS = path.join(process.cwd(), "prisma", "textos");

export function rutaTexto(slug: string): string {
  return path.join(DIR_TEXTOS, `${slug}.json`);
}

export function leerTexto(slug: string): string | null {
  const f = rutaTexto(slug);
  if (!existsSync(f)) return null;
  const txt = readFileSync(f, "utf8").trim();
  if (!txt) return null;
  // Se guarda como JSON del summary; se devuelve como string, que es como lo
  // manejan la base y el resto de los scripts.
  return txt;
}

export function guardarTexto(slug: string, summary: string | null | undefined): void {
  mkdirSync(DIR_TEXTOS, { recursive: true });
  const f = rutaTexto(slug);
  if (!summary || summary === "{}" || summary === "null") {
    if (existsSync(f)) rmSync(f);
    return;
  }
  // Se valida antes de escribir: un texto corrupto acá rompe el build del sitio.
  JSON.parse(summary);
  writeFileSync(f, summary.endsWith("\n") ? summary : summary + "\n", "utf8");
}

export function slugsConTexto(): string[] {
  if (!existsSync(DIR_TEXTOS)) return [];
  return readdirSync(DIR_TEXTOS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

// Devuelve los libros del snapshot con su summary ya cargado desde los archivos.
// Es lo que usan el seed del build y cualquier script que necesite los textos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function conTextos<T extends Record<string, unknown>>(libros: T[]): T[] {
  for (const b of libros) {
    const r = b as Record<string, unknown>;
    if (!r.summary) r.summary = leerTexto(String(r.slug));
  }
  return libros;
}

export function leerCatalogo(): // eslint-disable-next-line @typescript-eslint/no-explicit-any
Array<Record<string, any>> {
  const f = path.join(process.cwd(), "prisma", "seed-data.json");
  return conTextos(JSON.parse(readFileSync(f, "utf8")));
}
