// Asegura el audio de cada SINOPSIS en los 2 idiomas (ES/EN) y las 2 voces
// (♂ onyx, ♀ nova). Narra lo que falte (edge-tts, gratis) y lo sube a Blob.
// La nova ya existe (se migra del audioUrl viejo); genera la onyx. Idempotente.
//
// Uso:  npx tsx scripts/sinopsis-voices-all.ts
import "dotenv/config";
import { put } from "@vercel/blob";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import type { Language } from "../src/lib/types";

const VOICES = ["onyx", "nova"] as const;

async function narrate(text: string, lang: Language, voice: "onyx" | "nova"): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed: 1.04 }));
  return Buffer.concat(bufs);
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");
  const books = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });

  let done = 0, uploaded = 0;
  console.log(`\n🔊 Sinopsis en 2 voces × 2 idiomas para ${books.length} libros.\n`);

  for (const b of books) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let summary: any;
    try { summary = JSON.parse(b.summary ?? "{}"); } catch { continue; }
    let changed = false;

    for (const lang of ["es", "en"] as Language[]) {
      const s = summary[lang]?.sinopsis;
      if (!s?.text) continue;
      s.audio = s.audio ?? {};
      if (s.audioUrl && !s.audio.nova) { s.audio.nova = s.audioUrl; changed = true; } // migra

      for (const voice of VOICES) {
        if (s.audio[voice]) continue; // ya está
        try {
          const audio = await narrate(s.text, lang, voice);
          const { url } = await put(`sinopsis/${b.slug}-${lang}-${voice}.mp3`, audio, {
            access: "public", contentType: "audio/mpeg", token, allowOverwrite: true,
          });
          s.audio[voice] = url;
          changed = true;
          uploaded++;
          await sleep(100);
        } catch (e) {
          console.error(`  ✗ ${b.slug} ${lang} ${voice}: ${(e as Error).message}`);
        }
      }
    }

    if (changed) {
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(summary) } });
      done++;
      if (done % 10 === 0) console.log(`  ${done} libros · ${uploaded} audios nuevos`);
    }
  }
  console.log(`\n✅ Listo. ${uploaded} audios nuevos en Blob (${done} libros).\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
