// Devuelve el texto plano del libro (limpio), para mostrarlo en la pestaña LIBRO
// sin que la ficha tenga que cargarlo siempre. Se pide bajo demanda.
import type { NextRequest } from "next/server";
import { stripGutenbergBoilerplate } from "@/lib/tts/text";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("Solicitud inválida", { status: 400 });

  const res = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, {
    headers: { "User-Agent": "BibliotecaAbierta/1.0" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return new Response("No disponible", { status: 502 });

  const text = stripGutenbergBoilerplate(await res.text())
    .replace(/\[(?:illustration|footnote|sidenote)[^\]]*\]/gi, "") // notas
    .replace(/_/g, "") // marcas de cursiva
    .replace(/\n[ \t]+\n/g, "\n\n");
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
