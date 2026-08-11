// Saca la categoría "Negocios y emprendimientos" de los libros que la tienen por
// error, y que no son de negocios ni por asomo.
//
// POR QUÉ EXISTE: la lista curada de clásicos tenía 13 de 19 IDs de Gutenberg
// equivocados. Cada corrida del ingestor le pegaba la categoría al libro que
// realmente vive en ese ID, así que la categoría comercial terminó conteniendo
// "'Murphy': A Message to Dog Lovers", una novela en finlandés, un misterio del
// Padre Brown y un cuento para chicas.
//
// Criterio: si un libro de Gutenberg tiene la categoría pero su ID no está en la
// lista curada corregida, se la sacamos. Los que entraron por el mapeo automático
// de temas (categories.ts) no se tocan: esos no dependen de la lista.
//
// Uso:   npx tsx scripts/limpiar-categoria-negocios.ts           (solo informa)
//        APLICAR=1 npx tsx scripts/limpiar-categoria-negocios.ts (aplica)
import { prisma } from "./db";
import { CLASICOS_NEGOCIOS } from "./data/negocios-clasicos";

const CATEGORIA = "Negocios y emprendimientos";
const APLICAR = process.env.APLICAR === "1";

// Palabras que delatan que el libro SÍ tiene que ver con el nicho. Si aparecen en
// el título, no se toca aunque no esté en la lista: puede haber entrado por el
// mapeo automático con razón.
const DEL_NICHO = /business|money|wealth|rich|success|economy|economic|finance|capital|trade|market|industry|management|leader|negocio|riqueza|dinero|éxito|econom|comercio|empresa/i;

async function main() {
  const curados = new Set(CLASICOS_NEGOCIOS.map((c) => c.id));
  const libros = await prisma.book.findMany({ where: { contentLayer: 1 } });

  const sospechosos: { id: string; slug: string; title: string; cats: string[] }[] = [];
  for (const b of libros) {
    let cats: string[] = [];
    try { cats = JSON.parse(b.categories ?? "[]"); } catch { continue; }
    if (!cats.includes(CATEGORIA)) continue;
    if (b.gutenbergId && curados.has(b.gutenbergId)) continue; // está curado, se queda
    if (DEL_NICHO.test(b.title)) continue; // el título lo justifica
    sospechosos.push({ id: b.id, slug: b.slug, title: b.title, cats });
  }

  console.log(`\n🧹 Con la categoría por error: ${sospechosos.length}\n`);
  for (const s of sospechosos) console.log(`  ✗ ${s.title.slice(0, 58)}`);

  if (!sospechosos.length) return;
  if (!APLICAR) {
    console.log(`\nPara aplicar: APLICAR=1 npx tsx scripts/limpiar-categoria-negocios.ts\n`);
    return;
  }

  for (const s of sospechosos) {
    const nuevas = s.cats.filter((c) => c !== CATEGORIA);
    // Nunca dejar un libro sin categoría: quedaría fuera de todo filtro del sitio.
    if (!nuevas.length) nuevas.push("Clásicos");
    await prisma.book.update({ where: { id: s.id }, data: { categories: JSON.stringify(nuevas) } });
  }
  console.log(`\n✅ Categoría corregida en ${sospechosos.length} libros.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
