// Traducción ON-DEMAND a CUALQUIER idioma, CACHEADA para todos. Al traducir,
// registra el idioma en un "manifiesto" para que aparezca como banderita en la
// ficha para todos los usuarios (la biblioteca se enriquece con el uso).
import type { NextRequest } from "next/server";
import { getCached, setCached } from "@/lib/blob-cache";
import { stripGutenbergBoilerplate, chunkText } from "@/lib/tts/text";
import { langCode, nameFor } from "@/lib/languages";

export const maxDuration = 300;
const CONCURRENCY = 8;

async function translateChunk(text: string, idioma: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: `Sos un traductor literario. Traducí el texto al ${idioma} respetando el sentido, el tono y el estilo. Devolvé SOLO la traducción, sin notas.` },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

async function addToManifest(id: string, code: string, name: string) {
  const path = `traducciones/${id}-manifest.json`;
  let list: { code: string; name: string }[] = [];
  try { list = JSON.parse((await getCached(path)) ?? "[]"); } catch { /* vacío */ }
  if (!list.some((l) => l.code === code)) {
    list.push({ code, name });
    await setCached(path, JSON.stringify(list), "application/json");
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "id inválido" }, { status: 400 });

  const rawLang = req.nextUrl.searchParams.get("lang") ?? "es";
  const code = langCode(rawLang);
  const idioma = nameFor(code, req.nextUrl.searchParams.get("name") ?? rawLang);
  const cachePath = `traducciones/${id}-${code}.txt`;

  const wantsDownload = req.nextUrl.searchParams.get("download") === "1";
  const cached = await getCached(cachePath);
  if (cached) {
    if (wantsDownload) return downloadResponse(cached, id, code);
    return Response.json({ text: cached, code, name: idioma, cached: true });
  }

  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "sin OPENAI_API_KEY" }, { status: 500 });
  const src = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, {
    headers: { "User-Agent": "BibliotecaAbierta/1.0" },
  });
  if (!src.ok) return Response.json({ error: "no se pudo abrir el libro" }, { status: 502 });

  const text = stripGutenbergBoilerplate(await src.text()).replace(/_/g, "");
  const chunks = chunkText(text);
  const out: string[] = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((c, k) => translateChunk(c, idioma).catch(() => chunks[i + k])));
    results.forEach((r, k) => (out[i + k] = r));
  }
  const translated = out.join("\n\n");
  const url = await setCached(cachePath, translated);
  await addToManifest(id, code, idioma);
  if (wantsDownload) return downloadResponse(translated, id, code);
  return Response.json({ text: translated, url, code, name: idioma, cached: false });
}

function downloadResponse(text: string, id: string, code: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}-${code}.txt"`,
    },
  });
}
