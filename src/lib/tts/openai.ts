// Proveedor de voz OpenAI (gpt-4o-mini-tts). Es el TTS por defecto del spec.
// Necesita la variable de entorno OPENAI_API_KEY.
import type { TTSProvider, TTSOptions } from "./types";

export class OpenAITTSProvider implements TTSProvider {
  readonly id = "openai";
  private apiKey: string;
  private model: string;

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    // gpt-4o-mini-tts: el TTS bueno y barato. Configurable por si cambia.
    this.model = opts.model ?? process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
  }

  async generate(input: string, opts: TTSOptions): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error(
        "Falta OPENAI_API_KEY. Cargá la API key de OpenAI antes de generar audio.",
      );
    }
    const call = async (withSpeed: boolean): Promise<Response> =>
      fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input,
          voice: opts.voice,
          response_format: "mp3",
          ...(withSpeed && opts.speed ? { speed: opts.speed } : {}),
          ...(opts.instructions ? { instructions: opts.instructions } : {}),
        }),
      });

    let res = await call(true);
    // Algunos modelos (gpt-4o-mini-tts) controlan el ritmo por "instructions"
    // y rechazan "speed" con 400. Reintentamos sin speed.
    if (!res.ok && res.status === 400 && opts.speed) {
      res = await call(false);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenAI TTS ${res.status}: ${detail.slice(0, 300)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
