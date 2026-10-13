// Proveedor de voz de RESPALDO: Piper (neuronal, offline, gratis, sin API key).
//
// POR QUÉ EXISTE. El 13/10/2026 Microsoft empezó a rechazar la síntesis de
// edge-tts con 403 ("Invalid response status") desde cualquier IP, versión y voz:
// el catálogo entero se quedaba sin audio nuevo, que es el producto. Piper corre
// dentro del job (no depende de ningún servicio) así que nadie lo puede cortar.
//
// Se instala y se descargan los modelos la PRIMERA vez que hace falta, para no
// tocar los YAML de los workflows (el token no tiene permiso para editarlos).
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import type { TTSProvider, TTSOptions } from "./types";
import type { Language } from "../types";

// onyx = masculina, nova = femenina. En español se prioriza el acento rioplatense:
// la única voz es_AR de Piper es Daniela, así que la masculina usa es_ES (Davefx).
const PIPER_VOICES: Record<Language, Record<"onyx" | "nova", string>> = {
  es: { onyx: "es/es_ES/davefx/medium/es_ES-davefx-medium", nova: "es/es_AR/daniela/high/es_AR-daniela-high" },
  en: { onyx: "en/en_US/ryan/high/en_US-ryan-high", nova: "en/en_US/amy/medium/en_US-amy-medium" },
};

const BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main";
const CACHE = path.join(tmpdir(), "piper-voces");

function correr(cmd: string, args: string[], entrada?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [entrada ? "pipe" : "ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d) => (err += d.toString()));
    if (entrada) { p.stdin!.write(entrada); p.stdin!.end(); }
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} ${code}: ${err.slice(-300)}`))));
  });
}

async function existe(f: string): Promise<boolean> {
  try { await access(f); return true; } catch { return false; }
}

let instalado = false;

export class PiperTTSProvider implements TTSProvider {
  readonly id = "piper";
  private python: string;
  private language: Language;

  constructor(opts: { language: Language; pythonPath?: string }) {
    this.language = opts.language;
    this.python = opts.pythonPath ?? path.join(process.cwd(), ".venv-tts", "bin", "python");
  }

  private async asegurarInstalado(): Promise<void> {
    if (instalado) return;
    try {
      await correr(this.python, ["-c", "import piper"]);
    } catch {
      console.log("   · instalando piper (voz de respaldo)...");
      await correr(this.python, ["-m", "pip", "install", "-q", "piper-tts"]);
    }
    instalado = true;
  }

  // Devuelve el NOMBRE de la voz; los archivos quedan en CACHE, que se le pasa a
  // piper con --data-dir (así lo espera su CLI: -m <nombre> --data-dir <carpeta>).
  private async asegurarModelo(voz: string): Promise<string> {
    const nombre = path.basename(voz);
    await mkdir(CACHE, { recursive: true });
    const onnx = path.join(CACHE, `${nombre}.onnx`);
    const json = path.join(CACHE, `${nombre}.onnx.json`);
    for (const [destino, url] of [[onnx, `${BASE}/${voz}.onnx`], [json, `${BASE}/${voz}.onnx.json`]]) {
      if (await existe(destino)) continue;
      console.log(`   · bajando voz ${nombre}...`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No pude bajar la voz ${nombre}: HTTP ${res.status}`);
      await writeFile(destino, Buffer.from(await res.arrayBuffer()));
    }
    return nombre;
  }

  async generate(input: string, opts: TTSOptions): Promise<Buffer> {
    await this.asegurarInstalado();
    const voz = await this.asegurarModelo(PIPER_VOICES[this.language][opts.voice]);
    const dir = await mkdtemp(path.join(tmpdir(), "piper-"));
    const txt = path.join(dir, "in.txt");
    const wav = path.join(dir, "out.wav");
    const mp3 = path.join(dir, "out.mp3");
    try {
      // Piper no tiene control de velocidad ni de tono en su CLI: el estilo por
      // género (voice-style.ts) se ignora mientras esté de respaldo.
      await writeFile(txt, input, "utf8");
      await correr(this.python, ["-m", "piper", "-m", voz, "--data-dir", CACHE, "--input-file", txt, "-f", wav]);
      // Un limitador suave: Piper entrega picos a 0 dB y al pasar a mp3 eso satura.
      await correr(ffmpegPath as string, [
        "-y", "-i", wav,
        "-af", "alimiter=limit=0.89:level=disabled",
        "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", mp3,
      ]);
      return await readFile(mp3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
