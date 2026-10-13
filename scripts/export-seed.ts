// Exporta TODOS los libros de la base local a prisma/seed-data.json (versionado).
// Ese JSON es la fuente que reconstruye la base idéntica en el build de Vercel,
// sin depender de red ni de la base local. Correr tras cada ingesta importante.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { guardarTexto } from "./lib/textos";

async function main() {
  const rows = await prisma.book.findMany({ orderBy: { gutenbergId: "asc" } });
  // Quitamos campos que se regeneran solos (id, timestamps).
  const data = rows.map((b) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...rest } = b;
    // Los textos (sinopsis y resumen) van a prisma/textos/<slug>.json: son el 95%
    // del peso y hacían que este archivo chocara con el límite de GitHub.
    guardarTexto(b.slug, b.summary);
    return {
      ...rest,
      summary: null,
      publishedAt: b.publishedAt ? b.publishedAt.toISOString() : null,
    };
  });
  const out = path.join(process.cwd(), "prisma", "seed-data.json");
  await writeFile(out, JSON.stringify(data, null, 1), "utf8");
  console.log(`✅ Exportados ${data.length} libros (índice en prisma/seed-data.json, textos en prisma/textos/)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
