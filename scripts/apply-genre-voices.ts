// Regenera el AUDIO de las sinopsis aplicando el TONO según el género del libro
// (velocidad + pitch por género), en ES e EN y en las 2 voces (onyx/nova).
// Idempotente: marca cada libro con `audioGenre` y saltea los ya hechos, así se
// puede correr por tandas (REQ_LIMIT) sin repetir.
//
// Uso:  REQ_LIMIT=60 npx tsx scripts/apply-genre-voices.ts
import "dotenv/config";
import { put } from "@vercel/blob";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import { styleFor } from "../src/lib/voice-style";
import type { Language } from "../src/lib/types";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const LIMIT = Number(process.env.REQ_LIMIT ?? 60);

async function narrate(text: string, lang: Language, voice: "onyx" | "nova", speed: number, pitch: string): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed, pitch }));
  return Buffer.concat(bufs);
}

function lacksGenreAudio(raw: string | null): boolean {
  try {
    const s = JSON.parse(raw ?? "{}");
    const hasText = s.es?.sinopsis?.text || s.en?.sinopsis?.text;
    const done = s.es?.sinopsis?.audioGenre || s.en?.sinopsis?.audioGenre;
    return !!hasText && !done;
  } catch {
    return false;
  }
}

async function main() {
  if (!TOKEN) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");
  const all = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });
  const pend = all.filter((b) => lacksGenreAudio(b.summary)).slice(0, LIMIT);
  const totalPend = all.filter((b) => lacksGenreAudio(b.summary)).length;
  console.log(`\n🎚️  Aplicando tono por género · faltan ${totalPend} · esta tanda ${pend.length}\n`);

  let done = 0;
  for (const b of pend) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let summary: any;
    try { summary = JSON.parse(b.summary ?? "{}"); } catch { continue; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cats: string[] = []; try { cats = JSON.parse(b.categories ?? "[]"); } catch { /* */ }
    const st = styleFor(cats);

    for (const lang of ["es", "en"] as Language[]) {
      const s = summary[lang]?.sinopsis;
      if (!s?.text) continue;
      s.audio = s.audio ?? {};
      for (const voice of ["onyx", "nova"] as const) {
        try {
          const audio = await narrate(s.text, lang, voice, st.speed, st.pitch);
          const { url } = await put(`sinopsis/${b.slug}-${lang}-${voice}.mp3`, audio, {
            access: "public", contentType: "audio/mpeg", token: TOKEN, allowOverwrite: true,
          });
          s.audio[voice] = url;
          await sleep(80);
        } catch (e) {
          console.error(`  ✗ ${b.slug} ${lang}/${voice}: ${(e as Error).message}`);
        }
      }
      s.audioGenre = st.genre; // marca: este audio ya tiene el tono del género
    }
    await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(summary) } });
    done++;
    console.log(`  ✓ ${b.slug} [${st.genre}] (${done}/${pend.length})`);
  }
  console.log(`\n✅ Tanda lista: ${done} libros con tono de género.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
