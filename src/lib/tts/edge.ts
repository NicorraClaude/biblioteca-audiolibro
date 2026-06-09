// Proveedor de voz GRATIS: edge-tts (voces neuronales de Microsoft, costo $0,
// sin API key). Calidad muy buena y voces en español rioplatense (es-AR).
// Corre local vía un venv de Python (.venv-tts). Es el TTS por defecto para
// empezar sin gastar; OpenAI queda como premium opcional.
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TTSProvider, TTSOptions } from "./types";
import type { Language } from "../types";

// Mapeo de nuestras voces (onyx=masculina, nova=femenina) a voces de edge-tts
// por idioma. Español = argentino.
const EDGE_VOICES: Record<Language, Record<"onyx" | "nova", string>> = {
  es: { onyx: "es-AR-TomasNeural", nova: "es-AR-ElenaNeural" },
  en: { onyx: "en-US-GuyNeural", nova: "en-US-AriaNeural" },
};

export class EdgeTTSProvider implements TTSProvider {
  readonly id = "edge";
  private python: string;
  private language: Language;

  constructor(opts: { language: Language; pythonPath?: string }) {
    this.language = opts.language;
    this.python =
      opts.pythonPath ??
      path.join(process.cwd(), ".venv-tts", "bin", "python");
  }

  // speed 1.07 → "+7%" ; 0.9 → "-10%"
  private rate(speed?: number): string {
    if (!speed || speed === 1) return "+0%";
    const pct = Math.round((speed - 1) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  }

  async generate(input: string, opts: TTSOptions): Promise<Buffer> {
    const voice = EDGE_VOICES[this.language][opts.voice];
    const dir = await mkdtemp(path.join(tmpdir(), "edge-"));
    const txt = path.join(dir, "in.txt");
    const out = path.join(dir, "out.mp3");
    await writeFile(txt, input, "utf8");
    try {
      await new Promise<void>((resolve, reject) => {
        const p = spawn(
          this.python,
          [
            "-m", "edge_tts",
            "--voice", voice,
            "--file", txt,
            "--rate", this.rate(opts.speed),
            "--write-media", out,
          ],
          { stdio: ["ignore", "ignore", "pipe"] },
        );
        let err = "";
        p.stderr.on("data", (d) => (err += d.toString()));
        p.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(`edge-tts ${code}: ${err.slice(-300)}`)),
        );
      });
      return await readFile(out);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
