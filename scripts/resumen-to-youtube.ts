// Sube el RESUMEN largo de un libro a YouTube (monetizable). Narra el texto del
// resumen (edge-tts), arma el video (tapa + audio), lo sube y guarda el videoId
// en summary[lang].resumen. El texto del resumen debe existir ya
// (npx tsx scripts/generate-summary.ts <slug> resumen).
//
// Necesita OAuth de YouTube. Gated por la auditoría: hasta aprobarse, "unlisted".
// Uso:  npx tsx scripts/resumen-to-youtube.ts <slug> [es|en]
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import { makeVideo } from "./lib/video";
import { buildVideoMetadata, uploadVideo } from "./lib/youtube";
import type { Language } from "../src/lib/types";

const SLUG = process.argv[2];
const LANGS: Language[] = (process.argv[3]?.split(",") as Language[]) ?? ["es", "en"];
const PRIVACY = (process.env.YT_PRIVACY ?? "unlisted") as "private" | "unlisted" | "public";
const SITE_URL = process.env.SITE_URL ?? "https://biblioteca-audiolibros.vercel.app";

async function main() {
  if (!SLUG) throw new Error("Pasá el slug. Ej: npx tsx scripts/resumen-to-youtube.ts dracula es");
  const book = await prisma.book.findUnique({ where: { slug: SLUG } });
  if (!book?.gutenbergId) throw new Error(`"${SLUG}" no existe o no es Capa 1.`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: any = JSON.parse(book.summary ?? "{}");
  const categories: string[] = JSON.parse(book.categories ?? "[]");

  for (const lang of LANGS) {
    const entry = summary[lang]?.resumen;
    if (!entry?.text) {
      console.log(`   ⏭️  ${lang}: sin texto de resumen (generalo primero). Salteado.`);
      continue;
    }
    if (entry.youtubeVideoId) {
      console.log(`   ⏭️  ${lang}: ya tiene video (${entry.youtubeVideoId}). Salteado.`);
      continue;
    }

    console.log(`\n🎬 Resumen "${book.title}" (${lang}) → YouTube...`);
    const work = await mkdtemp(path.join(tmpdir(), "resumen-"));
    const audioPath = path.join(work, "a.mp3");
    const videoPath = path.join(work, "v.mp4");
    try {
      const tts = new EdgeTTSProvider({ language: lang });
      const bufs: Buffer[] = [];
      const chunks = chunkText(entry.text);
      for (let i = 0; i < chunks.length; i++) {
        process.stdout.write(`   narrando ${i + 1}/${chunks.length}\r`);
        bufs.push(await tts.generate(chunks[i], { voice: "nova", speed: 1.04 }));
        await sleep(80);
      }
      await writeFile(audioPath, Buffer.concat(bufs));
      console.log(`\n   🎬 Video...`);
      await makeVideo({ coverUrl: book.coverImageUrl, audioPath, outPath: videoPath });

      const meta = buildVideoMetadata({
        title: `${book.title} — Resumen completo (${lang === "es" ? "Español" : "English"})`,
        author: book.author, language: lang, voiceName: "voz Nova",
        categories: ["resumen", ...categories], sourceName: book.sourceName, siteUrl: SITE_URL,
      });
      console.log(`   ⬆️  Subiendo (${PRIVACY})...`);
      const videoId = await uploadVideo({ videoPath, ...meta, language: lang, privacyStatus: PRIVACY });

      summary[lang].resumen.youtubeVideoId = videoId;
      summary[lang].resumen.youtubePublic = PRIVACY === "public";
      await prisma.book.update({ where: { slug: SLUG }, data: { summary: JSON.stringify(summary) } });
      console.log(`   ✅ ${lang}: https://youtube.com/watch?v=${videoId}`);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
  console.log(`\n🏁 Listo "${book.title}".\n`);
}

main()
  .catch((e) => { console.error("\n✗", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
