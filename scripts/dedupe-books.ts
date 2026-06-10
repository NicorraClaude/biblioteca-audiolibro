// Quita libros DUPLICADOS (mismo título exacto + mismo autor; distintas ediciones
// de Gutenberg). Conserva el mejor de cada grupo (resumen > audio propio > más
// descargas). Los tomos distintos (Vol 1, Vol 2…) tienen título distinto → NO se tocan.
//
// Uso:  npx tsx scripts/dedupe-books.ts
import { prisma } from "./db";
import { normalize } from "../src/lib/text";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function score(b: any): number {
  let s = b.downloadCount ?? 0;
  if (b.summary) s += 1_000_000; // tiene resumen → conservar sí o sí
  try {
    const v = JSON.parse(b.audioVersions ?? "[]");
    if (v.some((x: { youtubeVideoId?: string; audioUrl?: string }) => x.youtubeVideoId || x.audioUrl))
      s += 500_000; // tiene audio propio
  } catch {
    /* ignore */
  }
  return s;
}

async function main() {
  const all = await prisma.book.findMany({ where: { contentLayer: 1 } });
  const groups = new Map<string, typeof all>();
  for (const b of all) {
    // Título COMPLETO (no recortado) + autor → los tomos quedan separados.
    const key = `${normalize(b.title)}|${normalize(b.author.split(",")[0])}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  const toDelete: string[] = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => score(b) - score(a));
    const keep = arr[0];
    for (const b of arr.slice(1)) toDelete.push(b.id);
    console.log(
      `"${keep.title.slice(0, 36)}" → conservo id ${keep.gutenbergId}, borro ${arr.length - 1}`,
    );
  }

  if (toDelete.length) {
    await prisma.book.deleteMany({ where: { id: { in: toDelete } } });
  }
  const total = await prisma.book.count({ where: { contentLayer: 1 } });
  console.log(`\n✅ Borrados ${toDelete.length} duplicados. Quedan ${total} libros Capa 1.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
