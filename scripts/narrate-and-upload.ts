// Pipeline COMPLETO de un audiolibro (Fase "libros completos"):
//   narra el libro ENTERO con voz gratis (edge-tts) → sube el mp3 a R2 (queda
//   escuchable en la ficha) → y, si corresponde, arma el video y lo sube a YouTube.
//
// El audio vive en R2 SIEMPRE, no solo en YouTube: la cuota de YouTube son 6
// subidas por día, y el catálogo no puede quedar mudo esperando ese turno.
// YouTube es el canal de alcance; R2 es lo que hace sonar el sitio.
//
// Necesita: venv .venv-tts (edge-tts) + R2 configurado. YouTube es OPCIONAL.
//
// Uso:
//   npx tsx scripts/narrate-and-upload.ts <slug> [voz]
//   SKIP_YOUTUBE=1 npx tsx scripts/narrate-and-upload.ts <slug>   # solo narrar → R2
//   YT_PRIVACY=public npx tsx scripts/narrate-and-upload.ts the-great-gatsby nova
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma, fetchRetry, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import {
  stripGutenbergBoilerplate,
  splitFrontMatterAndBody,
  chunkText,
} from "../src/lib/tts/text";
import { makeVideo } from "./lib/video";
import { buildVideoMetadata, uploadVideo } from "./lib/youtube";
import { r2Put, isR2Configured } from "../src/lib/r2";
import type { Language } from "../src/lib/types";
import type { TTSVoiceId } from "../src/lib/tts/types";

const SLUG = process.argv[2];
const VOICE = (process.argv[3] ?? "nova") as TTSVoiceId;
// Sin credenciales de YouTube (o con SKIP_YOUTUBE=1) narra igual y deja el mp3 en R2.
const SKIP_YOUTUBE = process.env.SKIP_YOUTUBE === "1" || !process.env.GOOGLE_REFRESH_TOKEN;
const PRIVACY = (process.env.YT_PRIVACY ?? "unlisted") as "private" | "unlisted" | "public";
const SITE_URL = process.env.SITE_URL ?? "https://biblioteca-audiolibros.vercel.app";
const SPEED = Number(process.env.TTS_SPEED ?? 1.05);

async function main() {
  if (!SLUG) throw new Error("Pasá el slug. Ej: npx tsx scripts/narrate-and-upload.ts the-great-gatsby nova");
  const book = await prisma.book.findUnique({ where: { slug: SLUG } });
  if (!book?.gutenbergId) throw new Error(`"${SLUG}" no existe o no es de Gutenberg.`);
  const language = book.language as Language;

  console.log(`\n📖 Audiolibro COMPLETO → YouTube: "${book.title}" (voz ${VOICE}, ${language})`);

  // 1) Texto completo desde Gutenberg, arrancando en el Cap. 1
  const id = book.gutenbergId;
  const res = await fetchRetry(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, { tries: 4, timeoutMs: 60000 });
  if (!res || !res.ok) throw new Error("No pude bajar el texto.");
  const { body } = splitFrontMatterAndBody(stripGutenbergBoilerplate(await res.text()));
  // Guard de tamaño: los clásicos gigantes (Quijote, Shakespeare) tardan horas
  // y dan archivos enormes. Por encima del tope, se saltean (salida limpia).
  const MAX_BOOK_CHARS = Number(process.env.TTS_MAX_BOOK_CHARS ?? 600000);
  if (body.length > MAX_BOOK_CHARS) {
    console.log(
      `   ⏭️  "${book.title}" es muy largo (${body.length.toLocaleString("es-AR")} chars > ${MAX_BOOK_CHARS}). Salteado.`,
    );
    await prisma.$disconnect();
    process.exit(2); // 2 = salteado (no cuenta como subida en el batch)
  }
  const chunks = chunkText(body);
  const mins = Math.round(body.length / 900);
  console.log(`   ${body.length.toLocaleString("es-AR")} caracteres · ~${mins} min de audio · ${chunks.length} fragmentos · GRATIS (edge-tts)`);

  const work = await mkdtemp(path.join(tmpdir(), "audiobook-"));
  const audioPath = path.join(work, "audio.mp3");
  const videoPath = path.join(work, "video.mp4");
  try {
    // 2) Narrar completo (gratis)
    const tts = new EdgeTTSProvider({ language });
    const buffers: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      process.stdout.write(`   narrando ${i + 1}/${chunks.length}\r`);
      buffers.push(await tts.generate(chunks[i], { voice: VOICE, speed: SPEED }));
      await sleep(100);
    }
    const audioBuf = Buffer.concat(buffers);
    await writeFile(audioPath, audioBuf);
    console.log(`\n   ✓ Audio completo narrado (${(audioBuf.length / 1024 / 1024).toFixed(1)} MB).`);

    // 3) El mp3 va a R2 SIEMPRE: así la ficha suena aunque YouTube no tenga turno.
    console.log(`   ☁️  Subiendo mp3 a R2...`);
    const audioUrl = await r2Put(`audiolibro/${SLUG}-${VOICE}.mp3`, audioBuf, "audio/mpeg");
    console.log(`   ✓ ${audioUrl}`);

    // 4) YouTube (opcional): si no hay credenciales o la cuota falla, el audio ya
    //    quedó publicado igual. No se pierde la narración por un problema de YouTube.
    let videoId: string | null = null;
    if (SKIP_YOUTUBE) {
      console.log(`   ⏭️  YouTube salteado (SKIP_YOUTUBE o sin credenciales).`);
    } else {
      try {
        console.log(`   🎬 Armando video...`);
        await makeVideo({ coverUrl: book.coverImageUrl, audioPath, outPath: videoPath });
        const categories: string[] = JSON.parse(book.categories ?? "[]");
        const meta = buildVideoMetadata({
          title: book.title, author: book.author, language, voiceName: VOICE === "onyx" ? "voz masculina" : "voz femenina",
          categories, sourceName: book.sourceName, siteUrl: SITE_URL,
        });
        console.log(`   ⬆️  Subiendo a YouTube (${PRIVACY})...`);
        videoId = await uploadVideo({ videoPath, ...meta, language, privacyStatus: PRIVACY });
      } catch (e) {
        console.error(`   ✗ YouTube falló (${(e as Error).message}). El audio ya está en R2; se reintenta otro día.`);
      }
    }

    // 5) Guardar: el audioUrl de R2 y, si hubo, el videoId.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let versions: any[] = JSON.parse(book.audioVersions ?? "[]");
    versions = versions.filter((v) => v.voiceId !== VOICE);
    versions.unshift({
      voiceId: VOICE,
      voiceName: VOICE === "onyx" ? "Onyx · voz masculina" : "Nova · voz femenina",
      youtubeVideoId: videoId,
      youtubePublic: videoId ? PRIVACY === "public" : false,
      audioUrl,
      durationSeconds: mins * 60,
      status: "ready",
    });
    await prisma.book.update({ where: { slug: SLUG }, data: { audioVersions: JSON.stringify(versions) } });

    console.log(
      `\n✅ Audiolibro completo escuchable en la ficha.` +
        (videoId ? `\n   YouTube: https://www.youtube.com/watch?v=${videoId}` : `\n   (sin video todavía; el audio ya funciona)`) +
        `\n   Snapshot: npx tsx scripts/export-seed.ts\n`,
    );
  } finally {
    await rm(work, { recursive: true, force: true }); // limpiamos los archivos pesados
  }
}

main()
  .catch((e) => {
    console.error("\n✗", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
