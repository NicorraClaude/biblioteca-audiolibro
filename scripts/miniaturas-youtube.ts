// Pone la miniatura propia a los videos del canal.
//
// POR QUÉ. YouTube arma la miniatura tomando un cuadro del video, y nuestros
// videos son una imagen fija: las 800 portadas del canal salían casi idénticas y
// sin un título legible. La miniatura es lo que define el clic, o sea las horas de
// reproducción, que es lo que mide YouTube para monetizar.
//
// La imagen la genera el propio sitio (/libro/<slug>/miniatura), así que acá solo
// se baja y se manda. Cada envío cuesta 50 unidades de cuota, por eso va de a
// tandas y lleva registro en R2 de lo ya hecho.
//
// Uso:  REQ_LIMIT=60 npx tsx scripts/miniaturas-youtube.ts
import "dotenv/config";
import { prisma } from "./db";
import { youtubeClient } from "./lib/youtube";
import { r2GetText, r2Put } from "../src/lib/r2";
import { Readable } from "node:stream";

const LIMIT = Number(process.env.REQ_LIMIT ?? 40);
// YouTube corta las miniaturas mucho antes que la cuota: a las ~60 seguidas
// responde "too many thumbnails recently" y rechaza todo por un rato. Una pausa
// corta entre envíos estira bastante esa cantidad.
const PAUSA_MS = Number(process.env.YT_MINIATURAS_PAUSA_MS ?? 1500);
const MAX_MS = Number(process.env.YT_MINIATURAS_MIN ?? 0) * 60_000;
const INICIO = Date.now();
const SITE = process.env.SITE_URL ?? "https://biblioteca-audiolibros.vercel.app";
const REGISTRO = "youtube/miniaturas.json";

type Pendiente = { slug: string; videoId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function videosDe(book: any): string[] {
  const ids: string[] = [];
  try {
    const s = JSON.parse(book.summary ?? "{}");
    const r = s.es?.resumen?.youtubeVideoId;
    if (r) ids.push(r);
  } catch { /* sin resumen */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const v of JSON.parse(book.audioVersions ?? "[]") as any[]) if (v.youtubeVideoId) ids.push(v.youtubeVideoId);
  } catch { /* sin audios */ }
  return ids;
}

async function main() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) throw new Error("Falta GOOGLE_REFRESH_TOKEN");
  const hechos: Record<string, string> = JSON.parse((await r2GetText(REGISTRO)) ?? "{}");

  const libros = await prisma.book.findMany({ where: { status: "published" } });
  const pendientes: Pendiente[] = [];
  for (const b of libros) for (const videoId of videosDe(b)) if (!hechos[videoId]) pendientes.push({ slug: b.slug, videoId });

  console.log(`\n🖼  Miniaturas pendientes: ${pendientes.length} · esta tanda: ${Math.min(LIMIT, pendientes.length)}\n`);
  const yt = youtubeClient();
  let listas = 0;
  const errores: string[] = [];

  for (const p of pendientes.slice(0, LIMIT)) {
    if (MAX_MS && Date.now() - INICIO > MAX_MS) { console.log(`\n⏱  Tope de ${MAX_MS / 60_000} min alcanzado.`); break; }
    try {
      const res = await fetch(`${SITE}/libro/${p.slug}/miniatura`);
      if (!res.ok) throw new Error(`la imagen devolvió HTTP ${res.status}`);
      const png = Buffer.from(await res.arrayBuffer());
      // YouTube acepta hasta 2 MB; las nuestras pesan ~100 KB.
      await yt.thumbnails.set({ videoId: p.videoId, media: { mimeType: "image/png", body: Readable.from(png) } });
      hechos[p.videoId] = p.slug;
      listas++;
      console.log(`  ✓ ${p.slug} → ${p.videoId}`);
      // El registro se guarda cada diez: si el job muere, no se repite todo.
      if (listas % 10 === 0) await r2Put(REGISTRO, JSON.stringify(hechos, null, 1), "application/json");
      await new Promise((r) => setTimeout(r, PAUSA_MS));
    } catch (e) {
      const msg = (e as Error).message;
      errores.push(`${p.slug}: ${msg}`);
      console.error(`  ✗ ${p.slug}: ${msg.slice(0, 160)}`);
      // Dos techos distintos, los dos significan "basta por hoy": la cuota diaria
      // y el límite de miniaturas seguidas. Sin esto, el 22/10 se gastaron 148
      // intentos fallidos en fila contra un servicio que ya había dicho que no.
      if (/quota|rateLimitExceeded|dailyLimitExceeded/i.test(msg)) { console.log("  ⏸  Cuota agotada, corto acá."); break; }
      if (/too many thumbnails/i.test(msg)) { console.log("  ⏸  YouTube no acepta más miniaturas por ahora. Sigo mañana."); break; }
    }
  }

  await r2Put(REGISTRO, JSON.stringify(hechos, null, 1), "application/json");
  if (errores.length) console.error(`\n⚠️  ${errores.length} fallaron.`);
  // Si había trabajo y no entró ninguna, es un fallo de verdad (credenciales, el
  // sitio caído, el canal sin permiso de miniaturas): que la corrida quede en rojo.
  // Que no entre ninguna es un fallo real (credenciales, sitio caído), salvo que
  // YouTube nos haya frenado: eso es un techo, no un error.
  const freno = errores.some((e) => /too many thumbnails|quota/i.test(e));
  if (pendientes.length > 0 && listas === 0 && !freno) { console.error("\n✗ Había miniaturas para poner y no entró ninguna."); process.exit(1); }
  console.log(`\n✅ ${listas} miniaturas puestas · quedan ${pendientes.length - listas}.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
