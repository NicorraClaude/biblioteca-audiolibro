// Helpers mínimos para hablar con OpenAI desde las rutas (chat + TTS).
type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: Msg[], opts: { model?: string; temperature?: number; json?: boolean } = {}): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI chat ${res.status}: ${await res.text()}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

// TTS con OpenAI (gpt-4o-mini-tts). Voces: onyx (♂) / nova (♀). Trocea por
// límite de caracteres y concatena los mp3 (suficiente para reproducir en navegador).
export async function tts(text: string, voice: "onyx" | "nova"): Promise<Buffer> {
  const CHUNK = 3800;
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > CHUNK) {
    let cut = rest.lastIndexOf(". ", CHUNK);
    if (cut < CHUNK * 0.5) cut = CHUNK;
    parts.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) parts.push(rest);

  const buffers: Buffer[] = [];
  for (const part of parts) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: part, response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}
