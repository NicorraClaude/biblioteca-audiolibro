// Muestras de voz GRATIS (edge-tts) por género, diferenciadas por voz + velocidad
// + tono (pitch). Para comparar contra la versión premium (OpenAI).
import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { r2Put } from "../src/lib/r2";

const PY = path.join(process.cwd(), ".venv-tts", "bin", "python");
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

// Voces es-AR + velocidad (más rápida que antes) + tono por género.
const SAMPLES = [
  { genre: "infantil", slug: "alicia-en-el-pais-de-las-maravillas", voice: "es-AR-ElenaNeural", rate: "+8%", pitch: "+12Hz" },
  { genre: "drama", slug: "anna-karenina", voice: "es-AR-TomasNeural", rate: "+2%", pitch: "+0Hz" },
  { genre: "suspenso", slug: "dracula", voice: "es-AR-TomasNeural", rate: "+0%", pitch: "-12Hz" },
];

async function edge(text: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "edge-"));
  const txt = path.join(dir, "in.txt");
  const out = path.join(dir, "out.mp3");
  await writeFile(txt, text, "utf8");
  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn(PY, ["-m", "edge_tts", "--voice", voice, "--file", txt, "--rate", rate, "--pitch", pitch, "--write-media", out], { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      p.stderr.on("data", (d) => (err += d.toString()));
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`edge ${c}: ${err.slice(-200)}`))));
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  for (const s of SAMPLES) {
    const text = sinopsis(s.slug);
    if (!text) { console.log(`✗ ${s.slug}: sin sinopsis`); continue; }
    console.log(`🎙️  ${s.genre} (${s.voice}, ${s.rate}, pitch ${s.pitch})...`);
    const buf = await edge(text, s.voice, s.rate, s.pitch);
    const url = await r2Put(`muestras/${s.genre}-edge-${s.slug}.mp3`, buf, "audio/mpeg");
    console.log(`   ✓ ${s.genre} (GRATIS): ${url}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
