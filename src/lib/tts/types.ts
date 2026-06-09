// Capa de voz como adaptador intercambiable (spec). Prioridad de uso:
//   LibriVox import → OpenAI TTS (gpt-4o-mini-tts, por defecto) → TTS local → ElevenLabs
// Cada proveedor implementa la misma interfaz, así se puede cambiar sin tocar el resto.

export type TTSVoiceId = "onyx" | "nova";

export type TTSOptions = {
  voice: TTSVoiceId;
  speed?: number; // 1.0 = normal; subimos un poco para que no suene lento
  instructions?: string; // tono/estilo de narración (gpt-4o-mini-tts)
};

export interface TTSProvider {
  readonly id: string;
  // Devuelve el audio (mp3) de un fragmento de texto.
  generate(input: string, opts: TTSOptions): Promise<Buffer>;
}
