// Control de costo del TTS (spec). gpt-4o-mini-tts cobra por uso; OpenAI estima
// ~US$0.015 por minuto de audio. Acá estimamos a partir de los caracteres del
// texto (la voz lee ~900 caracteres por minuto). Valores configurables por si
// cambia el precio; lo importante es el TOPE para que una prueba cueste centavos.

export const CHARS_PER_MINUTE = 900; // ritmo de lectura aproximado
export const USD_PER_MINUTE = 0.015; // estimación de OpenAI para gpt-4o-mini-tts

export type CostEstimate = {
  chars: number;
  minutes: number;
  usd: number;
};

export function estimateCost(chars: number): CostEstimate {
  const minutes = chars / CHARS_PER_MINUTE;
  return {
    chars,
    minutes: Math.round(minutes * 10) / 10,
    usd: Math.round(minutes * USD_PER_MINUTE * 1000) / 1000,
  };
}

export function formatEstimate(e: CostEstimate): string {
  return `${e.chars.toLocaleString("es-AR")} caracteres ≈ ${e.minutes} min de audio ≈ US$${e.usd.toFixed(3)} (estimado)`;
}
