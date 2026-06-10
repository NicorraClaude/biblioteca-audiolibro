// Narra (edge-tts, gratis) el audio de cada SINOPSIS y lo sube a Vercel Blob.
// Guarda la URL del Blob en summary[lang].sinopsis.audioUrl. Idempotente.
//
// Necesita BLOB_READ_WRITE_TOKEN en .env.
// Uso:  npx tsx scripts/sinopsis-audio-all.ts
import "dotenv/config";
import { put } from "@vercel/blob";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import type { Language } from "../src/lib/types";

async function narrate(text: string, lang: Language): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const buffers: Buffer[] = [];
  for (const chunk of chunkText(text)) {
    buffers.push(await tts.generate(chunk, { voice: "nova", speed: 1.04 }));
  }
  return Buffer.concat(buffers);
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");

  const books = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });
  let done = 0;
  let uploaded = 0;
  console.log(`\n🔊 Audio de sinopsis → Blob para ${books.length} libros.\n`);

  for (const b of books) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let summary: any;
    try { summary = JSON.parse(b.summary ?? "{}"); } catch { continue; }
    let changed = false;

    for (const lang of ["es", "en"] as Language[]) {
      const s = summary[lang]?.sinopsis;
      if (!s?.text || s.audioUrl) continue; // sin texto, o ya tiene audio
      try {
        const audio = await narrate(s.text, lang);
        const { url } = await put(`sinopsis/${b.slug}-${lang}.mp3`, audio, {
          access: "public",
          contentType: "audio/mpeg",
          token,
          allowOverwrite: true,
        });
        summary[lang].sinopsis.audioUrl = url;
        changed = true;
        uploaded++;
        await sleep(120);
      } catch (e) {
        console.error(`  ✗ ${b.slug} ${lang}: ${(e as Error).message}`);
      }
    }

    if (changed) {
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(summary) } });
      done++;
      if (done % 10 === 0) console.log(`  ${done} libros · ${uploaded} audios subidos`);
    }
  }
  console.log(`\n✅ Listo. ${uploaded} audios de sinopsis en Blob (${done} libros).\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
