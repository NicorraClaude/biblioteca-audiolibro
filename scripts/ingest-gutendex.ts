// Motor de ingesta masiva — Project Gutenberg vía Gutendex (https://gutendex.com).
// Trae libros de DOMINIO PÚBLICO (en+es) ordenados por popularidad y los carga
// en la base. Idempotente (upsert por gutenbergId) → pensado para correr en cron.
//
// REGLA DURA INNEGOCIABLE: si copyright !== false, el libro se DESCARTA.
// Nunca se ingiere texto con copyright.
//
// Uso:
//   npx tsx scripts/ingest-gutendex.ts            # 100 libros (por defecto)
//   npx tsx scripts/ingest-gutendex.ts 250        # 250 libros
//   INGEST_NO_TEXT=1 npx tsx scripts/ingest-gutendex.ts   # sin bajar textos
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { prisma, sleep, fetchRetry } from "./db";
import { slugify } from "../src/lib/text";
import { mapCategories } from "../src/lib/categories";

const TARGET = Number(process.argv[2] ?? process.env.INGEST_TARGET ?? 100);
const DOWNLOAD_TEXT = process.env.INGEST_NO_TEXT !== "1";
const TEXT_DIR = path.join(process.cwd(), "content", "texts");

const gutenbergCover = (id: number) =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
const gutenbergPage = (id: number) => `https://www.gutenberg.org/ebooks/${id}`;

const pendingAudio = () =>
  JSON.stringify([
    { voiceId: "onyx", voiceName: "Onyx · voz masculina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
    { voiceId: "nova", voiceName: "Nova · voz femenina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
  ]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickLanguage(langs: string[]): "es" | "en" | null {
  if (langs.includes("es")) return "es";
  if (langs.includes("en")) return "en";
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDescription(b: any): string {
  const raw: string | undefined = (b.summaries && b.summaries[0]) || undefined;
  if (raw) {
    const clean = raw
      .replace(/\(This is an automatically generated summary\.\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length > 40) {
      return clean.length > 320 ? clean.slice(0, 317).trimEnd() + "…" : clean;
    }
  }
  const author = b.authors?.[0]?.name ?? "autor desconocido";
  return `Obra de dominio público de ${author}. Audiolibro y e-book gratis para escuchar y descargar.`;
}

// Descarga el texto plano del libro (para el futuro pipeline TTS). Resiliente:
// si Gutenberg bloquea o falla, no aborta la ingesta (el cron lo reintenta).
async function downloadText(
  id: number,
  formats: Record<string, string>,
): Promise<string | null> {
  const filePath = path.join(TEXT_DIR, `pg${id}.txt`);
  try {
    await access(filePath);
    return filePath; // ya existe → idempotente
  } catch {
    /* no existe, lo bajamos */
  }
  const txtUrl =
    Object.entries(formats).find(
      ([k]) => k.startsWith("text/plain") && !k.includes("zip"),
    )?.[1] || `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  const res = await fetchRetry(txtUrl, { tries: 3, timeoutMs: 45000 });
  if (!res || !res.ok) return null;
  const text = await res.text();
  if (text.length < 500) return null; // probablemente una página de error
  await writeFile(filePath, text, "utf8");
  return filePath;
}

async function ensureUniqueSlug(base: string, gutenbergId: number): Promise<string> {
  const existing = await prisma.book.findUnique({ where: { slug: base } });
  if (!existing || existing.gutenbergId === gutenbergId) return base;
  return `${base}-${gutenbergId}`;
}

async function main() {
  console.log(
    `\n📚 Ingesta Gutendex — objetivo: ${TARGET} libros (en+es, dominio público).` +
      `${DOWNLOAD_TEXT ? " Bajando textos." : " SIN bajar textos."}\n`,
  );
  if (DOWNLOAD_TEXT) await mkdir(TEXT_DIR, { recursive: true });

  let url: string | null =
    "https://gutendex.com/books/?languages=en,es&copyright=false&sort=popular";
  let processed = 0;
  let created = 0;
  let updated = 0;
  let discarded = 0;
  let textsOk = 0;
  let page = 0;

  while (url && processed < TARGET) {
    page++;
    const res = await fetchRetry(url, { tries: 5 });
    if (!res || !res.ok) {
      console.error(`✗ Falló la página ${page} (${url}). Corto acá.`);
      break;
    }
    const data = await res.json();
    const results: unknown[] = data.results ?? [];

    for (const item of results) {
      if (processed >= TARGET) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = item as any;

      // ---- REGLA DURA: copyright debe ser exactamente false ----
      if (b.copyright !== false) {
        discarded++;
        continue;
      }
      const language = pickLanguage(b.languages ?? []);
      if (!language) {
        discarded++;
        continue;
      }

      const id: number = b.id;
      const title: string = (b.title ?? "Sin título").trim();
      const author: string = b.authors?.[0]?.name ?? "Anónimo";
      const formats: Record<string, string> = b.formats ?? {};
      const cover = formats["image/jpeg"] ?? gutenbergCover(id);
      const epub = formats["application/epub+zip"] ?? null;
      const categories = mapCategories(b.subjects ?? [], b.bookshelves ?? []);
      const description = buildDescription(b);
      const slug = await ensureUniqueSlug(slugify(title), id);

      // Texto plano (opcional, resiliente)
      let textPath: string | null = null;
      if (DOWNLOAD_TEXT) {
        textPath = await downloadText(id, formats);
        if (textPath) textsOk++;
        await sleep(400); // gentileza con Gutenberg
      }

      const common = {
        slug,
        title,
        author,
        language,
        contentLayer: 1,
        contentType: "full_audiobook",
        status: "published",
        licenseStatus: "public_domain",
        categories: JSON.stringify(categories),
        description,
        coverImageUrl: cover,
        sourceName: "Project Gutenberg",
        sourceUrl: gutenbergPage(id),
        copyright: false,
        ebookEpubUrl: epub,
        ebookPdfUrl: null,
        audioVersions: pendingAudio(),
        downloadCount: b.download_count ?? 0,
        publishedAt: new Date(),
      };

      const result = await prisma.book.upsert({
        where: { gutenbergId: id },
        create: {
          ...common,
          gutenbergId: id,
          textDownloaded: !!textPath,
          textPath,
        },
        update: {
          // Refrescamos metadatos pero respetamos el slug y el texto ya bajado.
          title,
          author,
          language,
          categories: JSON.stringify(categories),
          description,
          coverImageUrl: cover,
          ebookEpubUrl: epub,
          downloadCount: b.download_count ?? 0,
          ...(textPath ? { textDownloaded: true, textPath } : {}),
        },
      });
      // upsert no nos dice si creó o actualizó; lo deducimos por createdAt≈updatedAt
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
      else updated++;
      processed++;

      if (processed % 10 === 0) {
        console.log(
          `  ${processed}/${TARGET} · "${title.slice(0, 40)}" [${language}] {${categories.join(", ")}}`,
        );
      }
    }

    url = data.next ?? null;
    await sleep(500); // gentileza con Gutendex entre páginas
  }

  const total = await prisma.book.count({ where: { contentLayer: 1 } });
  console.log(
    `\n✅ Ingesta lista.` +
      `\n   Procesados: ${processed} (nuevos ${created}, actualizados ${updated})` +
      `\n   Descartados (copyright/idioma): ${discarded}` +
      `\n   Textos bajados esta corrida: ${textsOk}` +
      `\n   Total libros Capa 1 en la base: ${total}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
