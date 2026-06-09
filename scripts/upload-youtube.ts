// Sube a YouTube el narrado de un libro y guarda el videoId para embeberlo en la web.
// Arma el video (tapa + audio), lo sube vía YouTube Data API v3 y actualiza el libro.
//
// Necesita OAuth ya configurado (correr antes scripts/youtube-auth.ts).
//
// Uso:
//   npx tsx scripts/upload-youtube.ts don-quijote-de-la-mancha onyx
//   YT_PRIVACY=public npx tsx scripts/upload-youtube.ts frankenstein nova
import path from "node:path";
import { prisma } from "./db";
import { makeVideo } from "./lib/video";
import { buildVideoMetadata, uploadVideo } from "./lib/youtube";

const SLUG = process.argv[2];
const VOICE = process.argv[3] ?? "onyx";
// Por defecto "unlisted": seguro para probar. Cambiá a "public" cuando quieras.
const PRIVACY = (process.env.YT_PRIVACY ?? "unlisted") as
  | "private"
  | "unlisted"
  | "public";
const SITE_URL = process.env.SITE_URL ?? "https://biblioteca-audiolibros.vercel.app";

async function main() {
  if (!SLUG) throw new Error("Pasá el slug del libro. Ej: npx tsx scripts/upload-youtube.ts don-quijote-de-la-mancha onyx");
  const book = await prisma.book.findUnique({ where: { slug: SLUG } });
  if (!book) throw new Error(`No existe el libro "${SLUG}".`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const versions: any[] = JSON.parse(book.audioVersions ?? "[]");
  const version = versions.find((v) => v.voiceId === VOICE && v.audioUrl);
  if (!version) {
    throw new Error(
      `"${SLUG}" no tiene un narrado ${VOICE} generado. Generalo primero: npx tsx scripts/generate-audiobook.ts ${SLUG} ${VOICE}`,
    );
  }

  const audioPath = path.join(process.cwd(), "public", version.audioUrl);
  const videoPath = path.join(process.cwd(), "content", "videos", `${SLUG}-${VOICE}.mp4`);

  console.log(`🎬 Armando video para "${book.title}" (${VOICE})...`);
  await makeVideo({ coverUrl: book.coverImageUrl, audioPath, outPath: videoPath });

  const categories: string[] = JSON.parse(book.categories ?? "[]");
  const meta = buildVideoMetadata({
    title: book.title,
    author: book.author,
    language: book.language as "es" | "en",
    voiceName: version.voiceName,
    categories,
    sourceName: book.sourceName,
    siteUrl: SITE_URL,
  });

  console.log(`⬆️  Subiendo a YouTube (privacidad: ${PRIVACY})...`);
  const videoId = await uploadVideo({
    videoPath,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
    language: book.language as "es" | "en",
    privacyStatus: PRIVACY,
  });

  // Guardar el videoId en la versión de audio correspondiente.
  // youtubePublic queda en false: hasta pasar la auditoría de Google los videos
  // están privados, así que la web sigue sirviendo el mp3. Tras la auditoría,
  // un paso de "publicar" pone esto en true y se activa el embed de YouTube.
  version.youtubeVideoId = videoId;
  version.youtubePublic = false;
  await prisma.book.update({
    where: { id: book.id },
    data: { audioVersions: JSON.stringify(versions) },
  });

  console.log(
    `\n✅ Subido. videoId: ${videoId}` +
      `\n   https://www.youtube.com/watch?v=${videoId}` +
      `\n   Guardado en el libro. Actualizá el snapshot: npx tsx scripts/export-seed.ts\n`,
  );
}

main()
  .catch((e) => {
    console.error("\n✗", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
