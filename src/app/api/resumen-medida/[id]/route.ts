// Resúmenes A MEDIDA: el usuario describe lo que quiere (texto libre) y/o elige
// presets (edad, duración, forma, personajes). Genera TEXTO y AUDIO, y los cachea
// para todos (mismo pedido = misma respuesta instantánea).
import type { NextRequest } from "next/server";
import { getCached, setCached } from "@/lib/blob-cache";
import { chat, tts } from "@/lib/openai";

export const maxDuration = 300;

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const DURATION_WORDS: Record<string, string> = {
  corto: "muy breve, unas 150 palabras",
  medio: "de unas 400 palabras",
  largo: "extenso y detallado, unas 1000 palabras",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "sin OPENAI_API_KEY" }, { status: 500 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "body inválido" }, { status: 400 });

  const { free = "", age, duration, format, characters, lang = "es", voice = "onyx", audio = true } = body;
  const ctx = body.context ?? {};
  const key = hashKey(JSON.stringify({ id, free, age, duration, format, characters, lang }));
  const textPath = `resumenes-medida/${id}-${key}.txt`;
  const audioPath = `resumenes-medida/${id}-${key}-${voice}.mp3`;

  // ¿Ya está cacheado?
  const cachedText = await getCached(textPath);
  let text = cachedText ?? "";
  if (!cachedText) {
    const specs: string[] = [];
    if (age) specs.push(`Adaptalo para un público de ${age}.`);
    if (duration && DURATION_WORDS[duration]) specs.push(`Que sea ${DURATION_WORDS[duration]}.`);
    if (format === "bullets") specs.push("Devolvélo en viñetas (bullets) claras.");
    if (format === "corrido") specs.push("Devolvélo en texto corrido, bien hilado.");
    if (characters) specs.push("Enfocate especialmente en los personajes y sus arcos.");
    if (free) specs.push(`Pedido específico del lector: ${free}`);
    const idioma = lang === "en" ? "inglés" : "español";

    text = await chat([
      { role: "system", content: `Sos un divulgador literario. Hacés resúmenes fieles, sin opiniones inventadas ni spoilers gratuitos, en ${idioma}.` },
      { role: "user", content: `Hacé un resumen del libro "${ctx.title ?? ""}" de ${ctx.author ?? ""}.\n${specs.join("\n")}\n\nContexto disponible:\n${ctx.sinopsis ?? ""}\n${String(ctx.resumen ?? "").slice(0, 6000)}\n${ctx.description ?? ""}` },
    ], { temperature: 0.6 });
    await setCached(textPath, text);
  }

  let audioUrl: string | null = null;
  // Audio: generamos si se pidió y no existe.
  if (audio) {
    const existing = await blobUrl(audioPath);
    if (existing) audioUrl = existing;
    else {
      try {
        const buf = await tts(text.replace(/[*#_>-]/g, "").slice(0, 12000), voice === "nova" ? "nova" : "onyx");
        audioUrl = await setCachedBinary(audioPath, buf);
      } catch {
        audioUrl = null;
      }
    }
  }

  return Response.json({ text, audioUrl });
}

// Helpers R2 para binarios (audio).
import { r2Put, r2Exists, r2PublicUrl, isR2Configured } from "@/lib/r2";

async function blobUrl(pathname: string): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    return (await r2Exists(pathname)) ? r2PublicUrl(pathname) : null;
  } catch {
    return null;
  }
}

async function setCachedBinary(pathname: string, buf: Buffer): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    return await r2Put(pathname, buf, "audio/mpeg");
  } catch {
    return null;
  }
}
