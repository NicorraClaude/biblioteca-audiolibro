// Tapas reales desde Open Library (gratis, sin API key, SIN marca de Gutenberg).
// REEMPLAZA las tapas de Gutenberg: pone la de Open Library si existe; si no,
// deja coverImageUrl en null y la web usa la tapa DISEÑADA (híbrido).
//
// Uso:  npx tsx scripts/fetch-covers.ts
import { prisma, sleep, fetchRetry } from "./db";

async function main() {
  // Todos los de Capa 1 que todavía no tienen tapa de Open Library.
  const books = (
    await prisma.book.findMany({
      where: { contentLayer: 1 },
      orderBy: { downloadCount: "desc" },
      select: { slug: true, title: true, author: true, coverImageUrl: true },
    })
  ).filter((b) => !b.coverImageUrl?.includes("openlibrary"));

  console.log(`\n🖼️  Tapas reales (Open Library) para ${books.length} libros...\n`);

  let found = 0;
  let designed = 0;
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const q =
      `https://openlibrary.org/search.json?title=${encodeURIComponent(b.title.split(/[:;(]/)[0].trim())}` +
      `&author=${encodeURIComponent(b.author)}&limit=1&fields=cover_i`;
    const res = await fetchRetry(q, { tries: 3, timeoutMs: 20000 });
    await sleep(300);

    let coverId: number | undefined;
    if (res && res.ok) {
      try {
        coverId = (await res.json())?.docs?.[0]?.cover_i;
      } catch {
        /* sigue */
      }
    }

    const coverImageUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null; // null → tapa diseñada (saca la de Gutenberg)

    await prisma.book.update({ where: { slug: b.slug }, data: { coverImageUrl } });
    if (coverImageUrl) found++;
    else designed++;
    if ((i + 1) % 20 === 0)
      console.log(`  ${i + 1}/${books.length} · ${found} reales · ${designed} diseñadas`);
  }

  console.log(`\n✅ Listo. ${found} tapas reales · ${designed} diseñadas (sin Gutenberg en ninguna).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
