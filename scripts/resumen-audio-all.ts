// Genera el AUDIO de los RESÚMENES (largos, ~20-30 min) en ES/EN × onyx/nova.
// Con edge-tts (gratis) y tono POR GÉNERO (misma tabla que la sinopsis).
// Sube al Blob y marca summary[lang].resumen.audio.{onyx,nova}. Idempotente.
//
// Uso:  REQ_LIMIT=40 npx tsx scripts/resumen-audio-all.ts
import "dotenv/config";
import { put } from "@vercel/blob";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import { styleFor } from "../src/lib/voice-style";
import type { Language } from "../src/lib/types";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const LIMIT = Number(process.env.REQ_LIMIT ?? 30);
const VOICES = ["onyx", "nova"] as const;

async function narrate(text: string, lang: Language, voice: "onyx" | "nova", speed: number, pitch: string): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed, pitch }));
  return Buffer.concat(bufs);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lacksAudio(summary: any): boolean {
  for (const lang of ["es", "en"] as Language[]) {
    const r = summary?.[lang]?.resumen;
    if (!r?.text) continue;
    for (const v of VOICES) if (!r.audio?.[v]) return true;
  }
  return false;
}

async function main() {
  if (!TOKEN) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");
  const all = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });

  const pend = all
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => ({ b, s: (() => { try { return JSON.parse(b.summary ?? "{}"); } catch { return {}; } })() as any }))
    .filter(({ s }) => lacksAudio(s))
    .slice(0, LIMIT);

  const totalPend = all.filter((b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s: any; try { s = JSON.parse(b.summary ?? "{}"); } catch { s = {}; }
    return lacksAudio(s);
  }).length;

  console.log(`\n🎙️  Audio de RESÚMENES (largos) · faltan ${totalPend} · esta tanda ${pend.length}\n`);

  let done = 0, uploaded = 0;
  for (const { b, s } of pend) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cats: string[] = []; try { cats = JSON.parse(b.categories ?? "[]"); } catch { /* */ }
    const st = styleFor(cats);
    console.log(`\n→ ${b.slug} [${st.genre}]`);

    let changed = false;
    for (const lang of ["es", "en"] as Language[]) {
      const r = s[lang]?.resumen;
      if (!r?.text) continue;
      r.audio = r.audio ?? {};
      for (const voice of VOICES) {
        if (r.audio[voice]) continue;
        const t0 = Date.now();
        try {
          const audio = await narrate(r.text, lang, voice, st.speed, st.pitch);
          const { url } = await put(`resumen/${b.slug}-${lang}-${voice}.mp3`, audio, {
            access: "public", contentType: "audio/mpeg", token: TOKEN, allowOverwrite: true,
          });
          r.audio[voice] = url;
          changed = true;
          uploaded++;
          const secs = Math.round((Date.now() - t0) / 1000);
          console.log(`   ✓ ${lang}/${voice} (${(audio.length / 1024 / 1024).toFixed(1)} MB, ${secs}s)`);
          await sleep(100);
        } catch (e) {
          console.error(`   ✗ ${lang}/${voice}: ${(e as Error).message}`);
        }
      }
    }
    if (changed) {
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(s) } });
      done++;
    }
    console.log(`   (${done}/${pend.length} libros · ${uploaded} audios totales)`);
  }
  console.log(`\n✅ Tanda lista: ${done} libros · ${uploaded} audios subidos.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
