// Genera MUESTRAS de voz actuada por género (OpenAI gpt-4o-mini-tts con
// instrucciones de tono) y las sube a Blob. Para evaluar si los tonos quedan bien.
import "dotenv/config";
import { put } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seed: any[] = require("../prisma/seed-data.json");

function sinopsis(slug: string): string {
  const b = seed.find((x) => x.slug === slug);
  try {
    const s = JSON.parse(b?.summary ?? "{}");
    return (s.es?.sinopsis?.text ?? s.en?.sinopsis?.text ?? "").slice(0, 650);
  } catch {
    return "";
  }
}

const SAMPLES = [
  {
    genre: "infantil",
    slug: "alicia-en-el-pais-de-las-maravillas",
    voice: "nova",
    instructions:
      "Leé en español rioplatense con tono cálido, alegre y juguetón, animado y con asombro, como contándole un cuento a un niño. Ritmo vivo y expresivo.",
  },
  {
    genre: "drama",
    slug: "anna-karenina",
    voice: "onyx",
    instructions:
      "Leé en español con tono dramático, íntimo y emotivo. Pausado, con peso y melancolía, como un narrador de novela clásica. Que se sienta la carga emocional.",
  },
  {
    genre: "suspenso",
    slug: "dracula",
    voice: "onyx",
    instructions:
      "Leé en español con tono de suspenso, oscuro y tenso. Grave, lento, con intriga y una sensación inquietante, creando atmósfera de terror contenido.",
  },
];

async function tts(input: string, voice: string, instructions: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input, instructions, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!TOKEN) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  for (const s of SAMPLES) {
    const text = sinopsis(s.slug);
    if (!text) { console.log(`✗ ${s.slug}: sin sinopsis`); continue; }
    console.log(`🎙️  ${s.genre} (${s.slug}, voz ${s.voice})...`);
    const buf = await tts(text, s.voice, s.instructions);
    const { url } = await put(`muestras/${s.genre}-${s.slug}.mp3`, buf, {
      access: "public", contentType: "audio/mpeg", token: TOKEN, allowOverwrite: true,
    });
    console.log(`   ✓ ${s.genre}: ${url}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
