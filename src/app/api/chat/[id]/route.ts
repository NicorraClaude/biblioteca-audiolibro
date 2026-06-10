// "Charlá con el libro": el usuario puede pedir búsquedas, dudas, recomendaciones,
// relaciones/comparaciones con otros libros o entre elementos de la obra, opiniones, etc.
import type { NextRequest } from "next/server";
import { chat } from "@/lib/openai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "sin OPENAI_API_KEY" }, { status: 500 });
  const body = await req.json().catch(() => null);
  const messages: { role: "user" | "assistant"; content: string }[] = body?.messages ?? [];
  const ctx = body?.context ?? {};
  if (!messages.length) return Response.json({ error: "sin mensajes" }, { status: 400 });

  const system = `Sos un compañero de lectura experto y cálido que conversa sobre el libro "${ctx.title ?? ""}" de ${ctx.author ?? "autor desconocido"}.
El usuario puede pedirte: búsquedas dentro del libro, resolver dudas, recomendaciones de otros libros parecidos, relaciones o comparaciones (con otras obras o entre personajes/temas del propio libro), opiniones, análisis, contexto histórico, etc.
Respondé en el idioma del usuario, claro y conversacional. Si te preguntan algo que no se puede saber del libro, decílo con honestidad. No inventes citas textuales.

Contexto del libro:
${ctx.description ? `Descripción: ${ctx.description}\n` : ""}${ctx.sinopsis ? `Sinopsis: ${ctx.sinopsis}\n` : ""}${ctx.resumen ? `Resumen: ${String(ctx.resumen).slice(0, 6000)}\n` : ""}`.trim();

  const reply = await chat(
    [{ role: "system", content: system }, ...messages.slice(-12)],
    { temperature: 0.7 },
  );
  return Response.json({ reply });
}
