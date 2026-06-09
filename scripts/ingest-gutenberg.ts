// Ingester DIRECTO de Project Gutenberg (fallback robusto cuando Gutendex no
// responde). Fuente de popularidad: la lista oficial de "más descargados".
// Metadata por libro: el RDF de cada obra (gutenberg.org/ebooks/{id}.rdf).
//
// REGLA DURA INNEGOCIABLE: solo se ingiere si el RDF dice
// <dcterms:rights>Public domain...</dcterms:rights>. Nunca copyright.
//
// Uso:
//   npx tsx scripts/ingest-gutenberg.ts          # 100 libros (en+es)
//   npx tsx scripts/ingest-gutenberg.ts 150
import { prisma, sleep, fetchRetry } from "./db";
import { slugify } from "../src/lib/text";
import { mapCategories } from "../src/lib/categories";

const TARGET = Number(process.argv[2] ?? process.env.INGEST_TARGET ?? 100);

// IDs populares en español (verificados, dominio público) para asegurar catálogo
// bilingüe aunque la lista de "más descargados" sea mayormente en inglés.
const SPANISH_IDS = [
  2000, 61851, 25640, 55514, 52597, 78052, 21143, 27695, 25988, 39647, 15532,
  16110, 51763, 57497,
];

const gutenbergCover = (id: number) =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
const gutenbergPage = (id: number) => `https://www.gutenberg.org/ebooks/${id}`;

const pendingAudio = () =>
  JSON.stringify([
    { voiceId: "onyx", voiceName: "Onyx · voz masculina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
    { voiceId: "nova", voiceName: "Nova · voz femenina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
  ]);

// Decodifica entidades HTML/XML (&amp; &#13; &#xE9; etc.) que vienen en el RDF.
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const grab = (re: RegExp, s: string): string | null => {
  const m = s.match(re);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : null;
};

// "Shelley, Mary Wollstonecraft" → "Mary Wollstonecraft Shelley"
function formatAuthor(raw: string | null): string {
  if (!raw) return "Anónimo";
  const parts = raw.split(",");
  if (parts.length === 2) return `${parts[1].trim()} ${parts[0].trim()}`;
  return raw.trim();
}

// Limpia el título: corta subtítulos tras ";" o salto de línea.
function cleanTitle(raw: string | null): string {
  if (!raw) return "Sin título";
  return raw.split(/[;\n]/)[0].replace(/\s+/g, " ").trim();
}

function descriptionFor(author: string, lang: "es" | "en"): string {
  return lang === "es"
    ? `Obra de dominio público de ${author}. Audiolibro y e-book gratis para escuchar y descargar, sin costo ni restricciones.`
    : `Public-domain work by ${author}. Free audiobook and e-book to listen and download.`;
}

type Parsed = {
  title: string;
  author: string;
  language: "es" | "en";
  subjects: string[];
  isPublicDomain: boolean;
  downloads: number;
  epubUrl: string | null;
};

function parseRdf(rdf: string): Parsed | null {
  const rights = grab(/<dcterms:rights>([\s\S]*?)<\/dcterms:rights>/, rdf) ?? "";
  const langCode = grab(
    /<dcterms:language>[\s\S]*?<rdf:value[^>]*>([a-z-]+)<\/rdf:value>/,
    rdf,
  );
  const language: "es" | "en" | null =
    langCode === "es" ? "es" : langCode === "en" ? "en" : null;
  if (!language) return null;

  const title = cleanTitle(grab(/<dcterms:title>([\s\S]*?)<\/dcterms:title>/, rdf));
  const author = formatAuthor(grab(/<pgterms:name>([\s\S]*?)<\/pgterms:name>/, rdf));
  const downloads = Number(
    grab(/<pgterms:downloads[^>]*>(\d+)<\/pgterms:downloads>/, rdf) ?? "0",
  );
  // Materias: todos los rdf:value que parecen texto (no códigos LCC cortos).
  const subjects = [...rdf.matchAll(/<rdf:value[^>]*>([^<]+)<\/rdf:value>/g)]
    .map((m) => m[1].trim())
    .filter((v) => v.length > 3 && /[a-zA-Z]/.test(v) && v.includes(" ") || v.length > 6);
  // Primer archivo EPUB que exista en el RDF (evita links rotos).
  const epubUrl = grab(
    /rdf:about="(https?:\/\/www\.gutenberg\.org\/[^"]*\.epub[^"]*)"/,
    rdf,
  );

  return {
    title,
    author,
    language,
    subjects,
    isPublicDomain: /public domain/i.test(rights),
    downloads,
    epubUrl,
  };
}

const MODE = process.env.INGEST_SOURCE ?? "top"; // "top" | "es"

async function idsFromPage(url: string): Promise<number[]> {
  const res = await fetchRetry(url, { tries: 4 });
  const ids: number[] = [];
  if (res && res.ok) {
    const html = await res.text();
    for (const m of html.matchAll(/\/ebooks\/(\d+)/g)) {
      const id = Number(m[1]);
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

async function fetchIdList(): Promise<number[]> {
  if (MODE === "es") {
    // Modo español: catálogo de Gutenberg en español + curados conocidos.
    const browse = await idsFromPage(
      "https://www.gutenberg.org/browse/languages/es",
    );
    return [...new Set([...SPANISH_IDS, ...browse])];
  }
  // Modo "top": lista oficial de más descargados (popularidad, mayormente inglés).
  const topIds = await idsFromPage("https://www.gutenberg.org/browse/scores/top");
  return [...new Set([...topIds, ...SPANISH_IDS])];
}

async function ensureUniqueSlug(base: string, gutenbergId: number): Promise<string> {
  const existing = await prisma.book.findUnique({ where: { slug: base } });
  if (!existing || existing.gutenbergId === gutenbergId) return base;
  return `${base}-${gutenbergId}`;
}

async function main() {
  console.log(
    `\n📚 Ingesta directa de Project Gutenberg — objetivo: ${TARGET} libros (en+es, dominio público).\n`,
  );
  const ids = await fetchIdList();
  console.log(`   ${ids.length} candidatos (top descargas + español).`);

  let kept = 0;
  let created = 0;
  let updated = 0;
  let discarded = 0;

  for (const id of ids) {
    if (kept >= TARGET) break;
    const res = await fetchRetry(`https://www.gutenberg.org/ebooks/${id}.rdf`, {
      tries: 3,
      timeoutMs: 25000,
    });
    await sleep(250); // gentileza con Gutenberg
    if (!res || !res.ok) {
      discarded++;
      continue;
    }
    const rdf = await res.text();
    const p = parseRdf(rdf);
    // ---- REGLA DURA: idioma en+es Y dominio público ----
    if (!p || !p.isPublicDomain) {
      discarded++;
      continue;
    }

    const categories = mapCategories(p.subjects);
    const slug = await ensureUniqueSlug(slugify(p.title), id);
    const common = {
      slug,
      title: p.title,
      author: p.author,
      language: p.language,
      contentLayer: 1,
      contentType: "full_audiobook",
      status: "published",
      licenseStatus: "public_domain",
      categories: JSON.stringify(categories),
      description: descriptionFor(p.author, p.language),
      coverImageUrl: gutenbergCover(id),
      sourceName: "Project Gutenberg",
      sourceUrl: gutenbergPage(id),
      copyright: false,
      ebookEpubUrl: p.epubUrl,
      ebookPdfUrl: null,
      audioVersions: pendingAudio(),
      downloadCount: p.downloads,
      publishedAt: new Date(),
    };

    const result = await prisma.book.upsert({
      where: { gutenbergId: id },
      create: { ...common, gutenbergId: id },
      update: {
        title: p.title,
        author: p.author,
        language: p.language,
        categories: JSON.stringify(categories),
        coverImageUrl: gutenbergCover(id),
        ebookEpubUrl: p.epubUrl,
        downloadCount: p.downloads,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
    kept++;
    if (kept % 10 === 0) {
      console.log(
        `  ${kept}/${TARGET} · "${p.title.slice(0, 38)}" [${p.language}] {${categories.join(", ")}}`,
      );
    }
  }

  const total = await prisma.book.count({ where: { contentLayer: 1 } });
  console.log(
    `\n✅ Ingesta lista.` +
      `\n   Ingeridos: ${kept} (nuevos ${created}, actualizados ${updated})` +
      `\n   Descartados (copyright/idioma/no-rdf): ${discarded}` +
      `\n   Total libros Capa 1 en la base: ${total}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
