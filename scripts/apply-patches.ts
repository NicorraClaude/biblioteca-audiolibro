// Junta los parches de las sesiones paralelas en prisma/seed-data.json.
//
// POR QUÉ EXISTE: varios jobs generan al mismo tiempo, pero NO pueden commitear
// cada uno lo suyo — se pisarían el snapshot y se perdería contenido (ya pasó una
// vez y los resúmenes se recuperaron de milagro desde git). En vez de eso, cada
// sesión escribe un parche con SOLO los libros que ella terminó, y este script los
// aplica todos de una y deja un único commit.
//
// Nunca borra: un parche solo puede AGREGAR o AMPLIAR el summary de un libro. Si el
// snapshot ya tiene algo más completo que el parche, gana el snapshot.
//
// Uso:  npx tsx scripts/apply-patches.ts <carpeta-de-parches>
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Patch = { slug: string; summary: string | null };
type Book = { slug: string; summary?: string | null; [k: string]: unknown };

const SEED = "prisma/seed-data.json";

// Cuenta cuánto contenido REAL tiene un summary, para no reemplazar algo rico por
// algo pobre. Mide textos y audios, no el largo del JSON (que engaña).
function riqueza(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const s = JSON.parse(raw);
    let n = 0;
    for (const lang of ["es", "en"]) {
      for (const tier of ["sinopsis", "resumen"]) {
        const e = s?.[lang]?.[tier];
        if (!e) continue;
        if (e.text) n += String(e.text).length;
        n += Object.keys(e.audio ?? {}).length * 5000; // un audio vale mucho
        if (e.youtubeVideoId) n += 20000;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Pasá la carpeta de parches. Ej: npx tsx scripts/apply-patches.ts parches/");

  const libros: Book[] = JSON.parse(await readFile(SEED, "utf8"));
  const porSlug = new Map(libros.map((b) => [b.slug, b]));

  // Los artifacts de GitHub bajan en subcarpetas, así que se busca en profundidad.
  const archivos: string[] = [];
  async function recorrer(d: string) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await recorrer(p);
      else if (e.name.endsWith(".json")) archivos.push(p);
    }
  }
  await recorrer(dir);

  let aplicados = 0;
  let ignorados = 0;
  let desconocidos = 0;

  for (const f of archivos) {
    let parche: Patch[];
    try {
      parche = JSON.parse(await readFile(f, "utf8"));
    } catch {
      console.error(`  ✗ parche ilegible, lo salteo: ${f}`);
      continue;
    }
    if (!Array.isArray(parche)) continue;
    for (const p of parche) {
      const b = porSlug.get(p.slug);
      if (!b) { desconocidos++; continue; }
      if (riqueza(p.summary) > riqueza(b.summary)) {
        b.summary = p.summary;
        aplicados++;
      } else {
        ignorados++;
      }
    }
  }

  await writeFile(SEED, JSON.stringify(libros, null, 2) + "\n", "utf8");
  console.log(
    `\n📦 ${archivos.length} parche(s) · ${aplicados} libros actualizados · ` +
      `${ignorados} ya estaban igual o mejor · ${desconocidos} sin match en el catálogo.\n`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
