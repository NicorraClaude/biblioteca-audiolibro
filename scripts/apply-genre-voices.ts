// Genera AUDIO con tono por género para SINOPSIS y RESUMEN (ES/EN × onyx/nova).
// Idempotente: marca `audioGenre` en cada entrada y saltea lo hecho. Se puede
// correr por tandas (REQ_LIMIT) sin repetir. Prioriza libros a los que les falta
// algo. Con MODE=sinopsis|resumen|both se puede acotar (default: both).
//
// Uso:  REQ_LIMIT=30 npx tsx scripts/apply-genre-voices.ts
import "dotenv/config";
import { put } from "@vercel/blob";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import { styleFor } from "../src/lib/voice-style";
import type { Language } from "../src/lib/types";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const LIMIT = Number(process.env.REQ_LIMIT ?? 30);
const MODE = (process.env.MODE ?? "both") as "sinopsis" | "resumen" | "both";
const KIND: ("sinopsis" | "resumen")[] = MODE === "both" ? ["sinopsis", "resumen"] : [MODE];
const VOICES = ["onyx", "nova"] as const;

async function narrate(text: string, lang: Language, voice: "onyx" | "nova", speed: number, pitch: string): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed, pitch }));
  return Buffer.concat(bufs);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lacksAny(s: any): boolean {
  for (const kind of KIND) {
    for (const lang of ["es", "en"] as Language[]) {
      const e = s?.[lang]?.[kind];
      if (!e?.text) continue;
      if (!e.audioGenre) return true;
      for (const v of VOICES) if (!e.audio?.[v]) return true;
    }
  }
  return false;
}

async function main() {
  if (!TOKEN) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");
  const all = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });

  const pend = all
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => ({ b, s: (() => { try { return JSON.parse(b.summary ?? "{}"); } catch { return {}; } })() as any }))
    .filter(({ s }) => lacksAny(s))
    .slice(0, LIMIT);

  const totalPend = all.filter((b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s: any; try { s = JSON.parse(b.summary ?? "{}"); } catch { s = {}; }
    return lacksAny(s);
  }).length;

  console.log(`\n🎚️  Audio por género · MODE=${MODE} · faltan ${totalPend} · esta tanda ${pend.length}\n`);

  let done = 0, uploaded = 0;
  for (const { b, s } of pend) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cats: string[] = []; try { cats = JSON.parse(b.categories ?? "[]"); } catch { /* */ }
    const st = styleFor(cats);
    console.log(`\n→ ${b.slug} [${st.genre}]`);

    let changed = false;
    for (const kind of KIND) {
      for (const lang of ["es", "en"] as Language[]) {
        const e = s[lang]?.[kind];
        if (!e?.text) continue;
        e.audio = e.audio ?? {};
        const already = e.audioGenre === st.genre && VOICES.every((v) => e.audio[v]);
        if (already) continue;
        for (const voice of VOICES) {
          if (e.audio[voice] && e.audioGenre === st.genre) continue;
          const t0 = Date.now();
          try {
            const audio = await narrate(e.text, lang, voice, st.speed, st.pitch);
            const { url } = await put(`${kind}/${b.slug}-${lang}-${voice}.mp3`, audio, {
              access: "public", contentType: "audio/mpeg", token: TOKEN, allowOverwrite: true,
            });
            e.audio[voice] = url;
            changed = true;
            uploaded++;
            const secs = Math.round((Date.now() - t0) / 1000);
            console.log(`   ✓ ${kind} ${lang}/${voice} (${(audio.length / 1024 / 1024).toFixed(1)} MB, ${secs}s)`);
            await sleep(60);
          } catch (err) {
            console.error(`   ✗ ${kind} ${lang}/${voice}: ${(err as Error).message}`);
          }
        }
        e.audioGenre = st.genre;
      }
    }
    if (changed) {
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(s) } });
    }
    done++;
    console.log(`   (${done}/${pend.length} libros · ${uploaded} audios totales)`);
  }
  console.log(`\n✅ Tanda lista: ${done} libros · ${uploaded} audios subidos.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
