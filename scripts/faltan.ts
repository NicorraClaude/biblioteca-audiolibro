// Cuánto falta para tener el catálogo completo (texto + audio en las 4 combinaciones
// idioma × voz). Se usa en el resumen de las corridas para ver el avance de un vistazo.
import { readFileSync } from "node:fs";

type Book = { contentLayer: number; summary?: string | null };

function falta(raw: string | null | undefined): boolean {
  try {
    const s = JSON.parse(raw ?? "{}");
    const hayTexto = s.es?.sinopsis?.text || s.en?.sinopsis?.text || s.es?.resumen?.text || s.en?.resumen?.text;
    if (!hayTexto) return true;
    for (const lang of ["es", "en"]) {
      for (const tier of ["sinopsis", "resumen"]) {
        const e = s?.[lang]?.[tier];
        if (!e?.text) continue;
        for (const v of ["onyx", "nova"]) if (!e.audio?.[v]) return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

const libros: Book[] = JSON.parse(readFileSync("prisma/seed-data.json", "utf8"));
const capa1 = libros.filter((b) => b.contentLayer === 1);
const pendientes = capa1.filter((b) => falta(b.summary)).length;
const listos = capa1.length - pendientes;
const pct = capa1.length ? Math.round((listos / capa1.length) * 100) : 0;

console.log(`Completos: ${listos} de ${capa1.length} (${pct}%) · faltan ${pendientes}`);
