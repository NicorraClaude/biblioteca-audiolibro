// Ingesta CURADA de clásicos de negocios (dominio público, Gutenberg).
// Cada libro entra con la categoría "Negocios y emprendimientos" FORZADA
// (para no depender del mapeo automático). Después el pipeline normal
// (sinopsis, resumen, audio) los agarra como cualquier otro Capa 1.
//
// Uso:  npx tsx scripts/ingest-clasicos-negocios.ts
import { prisma, sleep, fetchRetry } from "./db";
import { slugify } from "../src/lib/text";
import { CLASICOS_NEGOCIOS } from "./data/negocios-clasicos";

const CATEGORIA = "Negocios y emprendimientos";

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const grab = (re: RegExp, s: string): string | null => {
  const m = s.match(re);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : null;
};
function formatAuthor(raw: string | null): string {
  if (!raw) return "Anónimo";
  const parts = raw.split(",");
  if (parts.length === 2) return `${parts[1].trim()} ${parts[0].trim()}`;
  return raw.trim();
}
function cleanTitle(raw: string | null): string {
  if (!raw) return "Sin título";
  return raw.split(/[;\n]/)[0].replace(/\s+/g, " ").trim();
}
// "Obama y Oprah" en vez de "Obama, Oprah".
function listar(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

const pendingAudio = () =>
  JSON.stringify([
    { voiceId: "onyx", voiceName: "Onyx · voz masculina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
    { voiceId: "nova", voiceName: "Nova · voz femenina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
  ]);

async function ensureUniqueSlug(base: string, gutenbergId: number): Promise<string> {
  const existing = await prisma.book.findUnique({ where: { slug: base } });
  if (!existing || existing.gutenbergId === gutenbergId) return base;
  return `${base}-${gutenbergId}`;
}

async function main() {
  console.log(`\n📚 Ingesta CURADA "Negocios y emprendimientos" · ${CLASICOS_NEGOCIOS.length} candidatos.\n`);
  let ingest = 0, updated = 0, skipped = 0;

  const seen = new Set<number>();
  for (const { id, note, categorias, recomendadoPor } of CLASICOS_NEGOCIOS) {
    if (seen.has(id)) { skipped++; continue; }
    seen.add(id);

    const res = await fetchRetry(`https://www.gutenberg.org/ebooks/${id}.rdf`, { tries: 3, timeoutMs: 25000 });
    await sleep(250);
    if (!res || !res.ok) { console.log(`  ✗ ${id} (${note}): sin RDF`); skipped++; continue; }
    const rdf = await res.text();

    const rights = grab(/<dcterms:rights>([\s\S]*?)<\/dcterms:rights>/, rdf) ?? "";
    if (!/public domain/i.test(rights)) { console.log(`  ✗ ${id} (${note}): NO dominio público`); skipped++; continue; }

    const langCode = grab(/<dcterms:language>[\s\S]*?<rdf:value[^>]*>([a-z-]+)<\/rdf:value>/, rdf);
    const language: "es" | "en" | null = langCode === "es" ? "es" : langCode === "en" ? "en" : null;
    if (!language) { console.log(`  ✗ ${id}: idioma no soportado (${langCode})`); skipped++; continue; }

    const title = cleanTitle(grab(/<dcterms:title>([\s\S]*?)<\/dcterms:title>/, rdf));
    const author = formatAuthor(grab(/<pgterms:name>([\s\S]*?)<\/pgterms:name>/, rdf));
    const downloads = Number(grab(/<pgterms:downloads[^>]*>(\d+)<\/pgterms:downloads>/, rdf) ?? "0");
    const epubUrl = grab(/rdf:about="(https?:\/\/www\.gutenberg\.org\/[^"]*\.epub[^"]*)"/, rdf);

    const slug = await ensureUniqueSlug(slugify(title), id);
    // El "lo recomienda X" va primero: es el gancho, más fuerte que el título solo.
    const reco = recomendadoPor?.length
      ? language === "es"
        ? `Recomendado por ${listar(recomendadoPor)}. `
        : `Recommended by ${recomendadoPor.join(", ")}. `
      : "";
    const description = language === "es"
      ? `${reco}${title}, de ${author}. Dominio público: audiolibro completo y e-book, gratis.`
      : `${reco}${title}, by ${author}. Public domain: full audiobook and e-book, free.`;

    // Trae las categorías actuales si el libro ya existe (para NO borrarlas) y suma
    // las nuevas. Un mismo título puede entrar por varias listas (un clásico de
    // negocios que además recomienda Obama) y no debe perder ninguna.
    const existing = await prisma.book.findUnique({ where: { gutenbergId: id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cats: string[] = []; try { cats = JSON.parse(existing?.categories ?? "[]"); } catch { /* */ }
    for (const c of categorias?.length ? categorias : [CATEGORIA]) {
      if (!cats.includes(c)) cats.push(c);
    }

    const common = {
      slug, title, author, language,
      contentLayer: 1, contentType: "full_audiobook", status: "published", licenseStatus: "public_domain",
      categories: JSON.stringify(cats), description, coverImageUrl: null,
      sourceName: "Project Gutenberg", sourceUrl: `https://www.gutenberg.org/ebooks/${id}`,
      copyright: false, ebookEpubUrl: epubUrl, ebookPdfUrl: null,
      audioVersions: pendingAudio(), downloadCount: downloads, publishedAt: new Date(),
    };

    const result = await prisma.book.upsert({
      where: { gutenbergId: id },
      create: { ...common, gutenbergId: id },
      update: { title, author, language, categories: JSON.stringify(cats) },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) ingest++;
    else updated++;
    console.log(`  ✓ ${id} · "${title.slice(0, 45)}" [${language}]`);
  }

  const total = await prisma.book.count({ where: { contentLayer: 1 } });
  console.log(`\n✅ Ingesta lista · nuevos ${ingest} · actualizados ${updated} · saltados ${skipped} · total capa 1: ${total}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
