// Sube los audios de RESÚMENES (modernos + clásicos) a YouTube como videos
// (tapa + audio). Cada video queda PÚBLICO desde el vamos (auditoría aprobada)
// con descripción rica, tags y link de compra (Amazon afiliado) cuando aplica.
// Guarda el videoId en el summary del libro para que la web use el embed.
// Idempotente. Prioriza los que ya tienen audio en R2 y no tienen videoId aún.
//
// Uso:   REQ_LIMIT=3 npx tsx scripts/upload-resumenes-youtube.ts
import "dotenv/config";
import { prisma, sleep } from "./db";
import { makeVideo } from "./lib/video";
import { uploadVideo } from "./lib/youtube";
import { r2GetText } from "../src/lib/r2";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import type { Language } from "../src/lib/types";

const LIMIT = Number(process.env.REQ_LIMIT ?? 3);
const SITE = "https://biblioteca-audiolibros.vercel.app";
// Para subidas puntuales que tienen que saltear la cola: re-subir un video que salió
// mal, o empujar un título concreto. Sin esto hay que esperar el turno por orden de
// capa, y con 60+ libros en cola eso son semanas.
const SOLO_SLUGS = (process.env.SOLO_SLUGS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
});

// Baja un mp3 de R2 al disco local (para pasárselo a ffmpeg).
async function downloadFromR2(key: string, dest: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  const chunks: Buffer[] = [];
  const stream = res.Body as Readable;
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  await writeFile(dest, Buffer.concat(chunks));
}

// Extrae la key de R2 de una URL pública.
function keyFromUrl(url: string): string {
  const pub = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  return url.startsWith(pub) ? url.slice(pub.length + 1) : url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickAudioToUpload(book: any): { lang: Language; url: string; voice: "onyx" | "nova" } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any; try { s = JSON.parse(book.summary ?? "{}"); } catch { return null; }
  for (const lang of ["es", "en"] as Language[]) {
    const r = s[lang]?.resumen;
    if (!r?.text || !r.audio) continue;
    if (r.youtubeVideoId) continue; // ya subido
    const audio = r.audio.onyx ?? r.audio.nova;
    if (!audio) continue;
    return { lang, url: audio, voice: r.audio.onyx ? "onyx" : "nova" };
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMetadata(book: any, lang: Language) {
  const isEs = lang === "es";
  const voiceLabel = "voz Onyx";
  const title = `${book.title} — Resumen · ${book.author}`.slice(0, 100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cats: string[] = []; try { cats = JSON.parse(book.categories ?? "[]"); } catch { /* */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let affs: {store:string,url:string}[] = []; try { affs = JSON.parse(book.affiliateLinks ?? "[]"); } catch { /* */ }
  // La descripción NO lleva link directo a la tienda: manda a la ficha, y la ficha
  // arma el link de afiliado al renderizar (withAffiliateTag). Así el día que el tag
  // de Associates esté cargado, TODOS los videos ya subidos empiezan a cobrar sin
  // tener que editar una sola descripción — editarlas por API exige el scope
  // `youtube` completo, que mandaría la app a verificación de Google otra vez.
  const hasStore = affs.length > 0;
  const disclaimer = isEs
    ? "Este es un análisis original de las ideas centrales de la obra, con nuestras palabras. NO reproduce el texto del libro. Para la experiencia completa, comprá la edición original."
    : "This is an original analysis of the book's central ideas, in our own words. It does NOT reproduce the book's text. For the full experience, get the original edition.";
  const description = [
    `${book.title}, de ${book.author}.`,
    ``,
    `Análisis extenso (~40 min) de las ideas centrales de este best-seller, narrado con IA.`,
    ``,
    `📖 Análisis completo en texto y audio, y más libros: ${SITE}/libro/${book.slug}`,
    ...(hasStore
      ? [
          ``,
          `🛒 En esa misma página está el link para conseguir el libro original.`,
          `(Comprándolo desde ahí apoyás la biblioteca, sin costo extra para vos.)`,
        ]
      : []),
    ``,
    disclaimer,
    ``,
    `#audiolibro #resumenlibros #desarrollopersonal #${cats.map(c=>c.replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()).slice(0,3).join(' #')}`,
  ].join("\n");
  const tags = ["resumen", "libro", "audiolibro", book.author, ...cats].slice(0, 15);
  return { title, description, tags, voiceLabel };
}

async function main() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) throw new Error("Falta GOOGLE_REFRESH_TOKEN (correr scripts/youtube-auth.ts)");
  if (!process.env.R2_BUCKET) throw new Error("Falta R2 config.");

  // Traer todos los libros con audio de resumen (contentLayer 1 o 2), que no tengan videoId ya.
  const all = await prisma.book.findMany({
    where: { AND: [{ status: "published" }, { OR: [{ contentLayer: 1 }, { contentLayer: 2 }] }] },
    orderBy: [{ contentLayer: "asc" }, { downloadCount: "desc" }],
  });
  const listos = all.filter((b) => !!pickAudioToUpload(b));
  const elegibles = SOLO_SLUGS.length ? listos.filter((b) => SOLO_SLUGS.includes(b.slug)) : listos;
  const pend = elegibles.slice(0, LIMIT);
  const filtro = SOLO_SLUGS.length ? ` · filtrando ${SOLO_SLUGS.length} slug(s)` : "";
  console.log(`\n📺 A subir a YouTube: ${pend.length} (de ${listos.length} pendientes${filtro})\n`);
  if (SOLO_SLUGS.length) {
    const faltantes = SOLO_SLUGS.filter((s) => !elegibles.some((b) => b.slug === s));
    if (faltantes.length) console.log(`   ⚠️  sin audio pendiente (los salteo): ${faltantes.join(", ")}\n`);
  }

  let done = 0;
  for (const book of pend) {
    const pick = pickAudioToUpload(book);
    if (!pick) continue;
    console.log(`\n→ ${book.slug} [${pick.lang}/${pick.voice}]`);
    const dir = await mkdtemp(path.join(tmpdir(), "ytup-"));
    const audioPath = path.join(dir, "audio.mp3");
    const videoPath = path.join(dir, "video.mp4");
    try {
      const key = keyFromUrl(pick.url);
      console.log("  · descargando audio de R2...");
      await downloadFromR2(key, audioPath);
      console.log("  · armando mp4 (tapa + audio)...");
      await makeVideo({ coverUrl: book.coverImageUrl, slug: book.slug, audioPath, outPath: videoPath });
      const meta = buildMetadata(book, pick.lang);
      console.log(`  · subiendo a YouTube ("${meta.title.slice(0, 50)}")...`);
      const videoId = await uploadVideo({
        videoPath, title: meta.title, description: meta.description, tags: meta.tags,
        language: pick.lang, privacyStatus: "public",
      });
      console.log(`  ✓ videoId: ${videoId} → https://youtu.be/${videoId}`);

      // Marcar en el summary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = JSON.parse(book.summary ?? "{}");
      s[pick.lang].resumen.youtubeVideoId = videoId;
      s[pick.lang].resumen.youtubePublic = true;
      await prisma.book.update({ where: { id: book.id }, data: { summary: JSON.stringify(s) } });
      done++;
      await sleep(300);
    } catch (e) {
      console.error(`  ✗ ${(e as Error).message}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    console.log(`  (${done}/${pend.length})`);
  }
  console.log(`\n✅ Subidos ${done} videos a YouTube.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
