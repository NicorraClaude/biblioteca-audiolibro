// Sube a YouTube los AUDIOLIBROS COMPLETOS en español (Capa 1, dominio público).
// Son videos de varias horas: tapa fija + audio entero. Es el contenido con más
// tiempo de reproducción del canal y el que YouTube más recomienda.
//
// Reglas (las mismas que los resúmenes, por algo):
//   · Solo español. El canal es hispanohablante.
//   · Solo dominio público (Capa 1). Nunca un libro con copyright.
//   · Solo narración propia (voces onyx/nova). Las grabaciones de LibriVox son de
//     otras personas: quedan en la ficha, no se re-publican en nuestro canal.
//   · Registro durable en R2 ANTES de seguir: un video subido y no anotado es un
//     duplicado mañana. Y además se consulta el canal por título.
//
// Uso:  REQ_LIMIT=2 npx tsx scripts/upload-audiolibros-youtube.ts
//       YT_SIMULAR=1 ... (muestra qué subiría, sin subir)
import "dotenv/config";
import { prisma, sleep } from "./db";
import { makeVideo } from "./lib/video";
import { uploadVideo, titulosPublicados, normalizarTitulo, asegurarPlaylist, agregarAPlaylist } from "./lib/youtube";
import { tituloEspanol } from "./lib/titulo-es";
import { r2GetText, r2Put } from "../src/lib/r2";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

const LIMIT = Number(process.env.REQ_LIMIT ?? 2);
const MAX_MS = Number(process.env.YT_LIBROS_MIN ?? 0) * 60_000;
const INICIO = Date.now();
const SIMULAR = process.env.YT_SIMULAR === "1";
const SOLO_SLUGS = (process.env.SOLO_SLUGS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SITE = "https://biblioteca-audiolibros.vercel.app";
const REGISTRO = "youtube/subidos.json";
const PLAYLIST = {
  titulo: "Audiolibros completos en español",
  descripcion: "Libros enteros narrados en español, gratis y sin registro. Obras de dominio público. También en texto y audio en " + SITE,
};

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
});

async function downloadFromR2(key: string, dest: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as Readable) chunks.push(Buffer.from(chunk));
  await writeFile(dest, Buffer.concat(chunks));
}

function keyFromUrl(url: string): string {
  const pub = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  return url.startsWith(pub) ? url.slice(pub.length + 1) : url;
}

// La versión narrada por nosotros, en español, que todavía no tiene video.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function versionParaSubir(book: any): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let a: any[]; try { a = JSON.parse(book.audioVersions ?? "[]"); } catch { return null; }
  return a.find((v) =>
    v.status === "ready" && v.audioUrl?.startsWith("http") &&
    (v.language ?? book.language) === "es" &&
    ["onyx", "nova"].includes(v.voiceId) && !v.youtubeVideoId) ?? null;
}

function horas(seg: number | null | undefined): string {
  if (!seg) return "";
  const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function metadata(book: any, es: { titulo: string; autor: string }, dur: number | null) {
  const d = horas(dur);
  const original = es.titulo !== book.title ? ` (título original: ${book.title})` : "";
  const title = `${es.titulo} — Audiolibro completo en español · ${es.autor}`.slice(0, 100);
  const description = [
    `${es.titulo}, de ${es.autor}${original}. Audiolibro completo${d ? `, ${d}` : ""}.`,
    ``,
    `Obra de dominio público, narrada con voz sintética. Gratis, sin registro y sin cortes.`,
    ``,
    `📖 El texto completo, el resumen y más audiolibros: ${SITE}/libro/${book.slug}`,
    ``,
    `Si te gusta escuchar mientras hacés otra cosa, dejá el video de fondo: se sigue reproduciendo.`,
    ``,
    `#audiolibro #audiolibrocompleto #audiolibrosenespañol #clasicos #literatura`,
  ].join("\n");
  const tags = ["audiolibro", "audiolibro completo", "audiolibro en español", "literatura", "clásicos", es.titulo, book.title, es.autor].slice(0, 15);
  return { title, description, tags };
}

async function main() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) throw new Error("Falta GOOGLE_REFRESH_TOKEN");
  if (!process.env.R2_BUCKET) throw new Error("Falta R2 config.");
  const txt = await r2GetText(REGISTRO);
  if (txt === null) throw new Error(`No encuentro ${REGISTRO} en R2. No subo nada a ciegas.`);
  const registro = JSON.parse(txt) as Record<string, string>;

  const all = await prisma.book.findMany({ where: { status: "published", contentLayer: 1 } });

  // Lo que el registro ya tiene vuelve al catálogo (por si un guardado se perdió).
  let recuperados = 0;
  for (const b of all) {
    const id = registro[`${b.slug}:completo`];
    const v = versionParaSubir(b);
    if (!id || !v) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a: any[] = JSON.parse(b.audioVersions ?? "[]");
    const i = a.findIndex((x) => x.voiceId === v.voiceId && x.audioUrl === v.audioUrl);
    if (i < 0) continue;
    a[i] = { ...a[i], youtubeVideoId: id, youtubePublic: true };
    b.audioVersions = JSON.stringify(a);
    await prisma.book.update({ where: { id: b.id }, data: { audioVersions: b.audioVersions } });
    recuperados++;
  }
  if (recuperados) console.log(`↺ ${recuperados} videoId(s) recuperados del registro de R2.`);

  // Orden: los más populares primero (descargas de Gutenberg) y, entre ellos, los
  // que ya tienen el resumen en YouTube: así el canal ofrece las dos piezas juntas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conResumen = (b: any) => { try { return JSON.parse(b.summary ?? "{}").es?.resumen?.youtubeVideoId ? 1 : 0; } catch { return 0; } };
  const esTomo = (b: { title: string }) => /\b(vol\.?|volume|tomo)\s*\d/i.test(b.title);
  const listos = all.filter((b) => !esTomo(b) && versionParaSubir(b));
  listos.sort((a, b) => conResumen(b) - conResumen(a) || (b.downloadCount ?? 0) - (a.downloadCount ?? 0));
  const elegibles = SOLO_SLUGS.length ? listos.filter((b) => SOLO_SLUGS.includes(b.slug)) : listos;
  const pend = elegibles.slice(0, LIMIT);
  console.log(`\n📚 Audiolibros completos a subir: ${pend.length} (de ${listos.length} pendientes)\n`);

  const enCanal = SIMULAR ? new Map<string, string>() : await titulosPublicados();
  let done = 0, cuotaAgotada = false;
  const errores: string[] = [];

  for (const book of pend) {
    if (MAX_MS && Date.now() - INICIO > MAX_MS) { console.log(`\n⏱  Tope de ${MAX_MS / 60_000} min alcanzado.`); break; }
    const v = versionParaSubir(book);
    if (!v) continue;
    const es = await tituloEspanol(book);
    const meta = metadata(book, es, v.durationSeconds);
    console.log(`\n→ ${book.slug} [${v.voiceId}] ${horas(v.durationSeconds)}`);
    if (SIMULAR) { console.log(`  [simulación] ${meta.title}\n${meta.description.split("\n").map((l) => "    | " + l).join("\n")}`); done++; continue; }

    const ya = enCanal.get(normalizarTitulo(meta.title));
    if (ya) { console.log(`  ⏭️  ya está en el canal (${ya}): lo anoto y sigo.`); registro[`${book.slug}:completo`] = ya; await r2Put(REGISTRO, JSON.stringify(registro, null, 1), "application/json"); continue; }

    const dir = await mkdtemp(path.join(tmpdir(), "ytlib-"));
    const audioPath = path.join(dir, "audio.mp3");
    const videoPath = path.join(dir, "video.mp4");
    try {
      console.log("  · descargando audio de R2...");
      await downloadFromR2(keyFromUrl(v.audioUrl), audioPath);
      console.log("  · armando mp4 (tapa + audio largo)...");
      await makeVideo({ coverUrl: book.coverImageUrl, slug: book.slug, audioPath, outPath: videoPath, largo: true, duracionSegundos: v.durationSeconds });
      console.log(`  · subiendo (${((await stat(videoPath)).size / 1024 / 1024).toFixed(0)} MB)...`);
      const videoId = await uploadVideo({ videoPath, title: meta.title, description: meta.description, tags: meta.tags, language: "es", privacyStatus: "public" });
      console.log(`  ✓ videoId: ${videoId} → https://youtu.be/${videoId}`);

      registro[`${book.slug}:completo`] = videoId;
      try {
        await r2Put(REGISTRO, JSON.stringify(registro, null, 1), "application/json");
      } catch (e) {
        console.error(`  ✗ Subido pero NO pude anotarlo en R2 (${(e as Error).message}). Corto para no duplicar.`);
        process.exit(1);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a: any[] = JSON.parse(book.audioVersions ?? "[]");
      const i = a.findIndex((x) => x.voiceId === v.voiceId && x.audioUrl === v.audioUrl);
      if (i >= 0) a[i] = { ...a[i], youtubeVideoId: videoId, youtubePublic: true };
      await prisma.book.update({ where: { id: book.id }, data: { audioVersions: JSON.stringify(a) } });
      done++;
      enCanal.set(normalizarTitulo(meta.title), videoId);
      try { await agregarAPlaylist(await asegurarPlaylist(PLAYLIST.titulo, PLAYLIST.descripcion), videoId); console.log("  ✓ agregado a la lista de audiolibros completos"); }
      catch (e) { console.error(`  ⚠️  no pude agregarlo a la lista: ${(e as Error).message}`); }
      await sleep(300);
    } catch (e) {
      const msg = (e as Error).message;
      if (/quota|uploadLimitExceeded|rateLimitExceeded|dailyLimitExceeded/i.test(msg)) {
        cuotaAgotada = true;
        console.log("  ⏸  YouTube: cuota diaria agotada. Corto acá.");
      } else { errores.push(`${book.slug}: ${msg}`); console.error(`  ✗ ${msg}`); }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    if (cuotaAgotada) break;
  }
  if (errores.length) { console.error(`\n⚠️  ${errores.length} fallaron:`); for (const e of errores) console.error(`   · ${e}`); }
  if (pend.length > 0 && done === 0 && !cuotaAgotada && !errores.length) { console.error("\n✗ Había para subir y no entró ninguno."); process.exit(1); }
  console.log(`\n✅ Subidos ${done} audiolibros completos${cuotaAgotada ? " · techo de cuota" : ""}.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
