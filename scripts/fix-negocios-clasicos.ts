// Arregla el desastre: (1) quita la categoría "Negocios y emprendimientos" a los
// libros que se ingestaron por error (IDs de Gutenberg mal atados a otros
// títulos), y (2) busca los IDs REALES de la lista de clásicos de negocios
// vía Gutendex, los ingesta con la categoría correcta.
import { prisma, sleep, fetchRetry } from "./db";
import { slugify } from "../src/lib/text";

const CATEGORIA = "Negocios y emprendimientos";

// IDs que YA sabemos que quedaron BIEN categorizados (verificados):
const IDS_OK = new Set<number>([4507, 21291, 8581, 935, 148, 17976, 3300, 30107]);

// Títulos a BUSCAR en Gutendex (título + autor si ayuda a desambiguar).
const A_BUSCAR: { q: string; must: string[] }[] = [
  { q: "Science of Getting Rich Wattles", must: ["science of getting rich"] },
  { q: "Master Key System Haanel", must: ["master key"] },
  { q: "Way to Wealth Franklin", must: ["way to wealth"] },
  { q: "My Life and Work Henry Ford", must: ["my life and work"] },
  { q: "How to Live on 24 Hours a Day Bennett", must: ["24 hours"] },
  { q: "Acres of Diamonds Conwell", must: ["acres of diamonds"] },
  { q: "The Prince Machiavelli", must: ["prince"] },
  { q: "Optimist's Good Morning Perin", must: ["optimist"] },
  { q: "How to Get On in the World Marden", must: ["how to get on"] },
  { q: "Autobiography of a Business Man", must: ["autobiography"] },
  { q: "Poor Richard's Almanac Franklin", must: ["poor richard"] },
];

async function limpiarMalCategorizados() {
  console.log("\n🧹 Quitando categoría 'Negocios' de los mal categorizados...\n");
  const rows = await prisma.book.findMany({ where: { categories: { contains: CATEGORIA } } });
  let quitados = 0;
  for (const b of rows) {
    if (b.gutenbergId && IDS_OK.has(b.gutenbergId)) continue; // este SÍ es de negocios
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cats: string[] = []; try { cats = JSON.parse(b.categories ?? "[]"); } catch { continue; }
    if (!cats.includes(CATEGORIA)) continue;
    const nuevas = cats.filter((c) => c !== CATEGORIA);
    await prisma.book.update({ where: { id: b.id }, data: { categories: JSON.stringify(nuevas) } });
    console.log(`  · quitado de "${b.title.slice(0, 55)}" (id ${b.gutenbergId})`);
    quitados++;
  }
  console.log(`\n✅ Quitados ${quitados}.`);
}

async function buscarYIngestar() {
  console.log("\n🔎 Buscando IDs correctos vía Gutendex...\n");
  let ok = 0, fail = 0;
  for (const item of A_BUSCAR) {
    try {
      const res = await fetchRetry(`https://gutendex.com/books/?search=${encodeURIComponent(item.q)}&copyright=false`, { tries: 3, timeoutMs: 20000 });
      if (!res || !res.ok) { console.log(`  ✗ ${item.q}: sin respuesta Gutendex`); fail++; continue; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;
      const match = (data.results ?? []).find((b: {title:string}) => item.must.every((w) => b.title.toLowerCase().includes(w)));
      if (!match) { console.log(`  ✗ ${item.q}: sin match`); fail++; continue; }
      // Ingestar como si fuera de la lista original
      const id: number = match.id;
      const title: string = (match.title ?? "").split(/[;\n]/)[0].trim();
      const author: string = match.authors?.[0]?.name ?? "Anónimo";
      const language = match.languages?.includes("es") ? "es" : match.languages?.includes("en") ? "en" : null;
      if (!language) { console.log(`  ✗ ${item.q}: idioma no soportado`); fail++; continue; }
      const slug = slugify(title);
      // Traer cats actuales si existía
      const existing = await prisma.book.findUnique({ where: { gutenbergId: id } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cats: string[] = []; try { cats = JSON.parse(existing?.categories ?? "[]"); } catch { /* */ }
      if (!cats.includes(CATEGORIA)) cats.push(CATEGORIA);
      const description = language === "es"
        ? `${title}, de ${author}. Un clásico de negocios y desarrollo personal, en dominio público. Audiolibro y e-book gratis.`
        : `${title}, by ${author}. A classic of business and personal development, in the public domain. Free audiobook and e-book.`;
      const audioVersions = JSON.stringify([
        { voiceId: "onyx", voiceName: "Onyx · voz masculina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
        { voiceId: "nova", voiceName: "Nova · voz femenina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
      ]);
      await prisma.book.upsert({
        where: { gutenbergId: id },
        create: {
          slug, title, author, language,
          contentLayer: 1, contentType: "full_audiobook", status: "published", licenseStatus: "public_domain",
          categories: JSON.stringify(cats), description, coverImageUrl: null,
          sourceName: "Project Gutenberg", sourceUrl: `https://www.gutenberg.org/ebooks/${id}`,
          gutenbergId: id, copyright: false, audioVersions,
          downloadCount: match.download_count ?? 0, publishedAt: new Date(),
        },
        update: { title, author, categories: JSON.stringify(cats) },
      });
      console.log(`  ✓ ${id} · "${title.slice(0, 50)}" (${author.slice(0, 30)}) [${language}]`);
      ok++;
      await sleep(400);
    } catch (e) {
      console.log(`  ✗ ${item.q}: ${(e as Error).message}`);
      fail++;
    }
  }
  console.log(`\n✅ Encontrados: ${ok} · fallidos: ${fail}`);
}

async function main() {
  await limpiarMalCategorizados();
  await buscarYIngestar();
  const total = await prisma.book.count({ where: { categories: { contains: CATEGORIA } } });
  console.log(`\n📊 Total libros en "${CATEGORIA}": ${total}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
