// Caché compartida en Vercel Blob para resultados de IA generados bajo demanda.
// El primer usuario que pide algo lo genera; queda guardado para TODOS los demás.
// Patrón base de las "opciones custom de IA" de la plataforma.
import { list, put } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// Devuelve el contenido cacheado (texto) o null si no existe.
export async function getCached(pathname: string): Promise<string | null> {
  if (!TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, token: TOKEN });
    const hit = blobs.find((b) => b.pathname === pathname);
    if (!hit) return null;
    const res = await fetch(hit.url, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// Guarda el contenido en la caché (público) y devuelve su URL.
export async function setCached(
  pathname: string,
  content: string,
  contentType = "text/plain; charset=utf-8",
): Promise<string | null> {
  if (!TOKEN) return null;
  try {
    const { url } = await put(pathname, content, {
      access: "public",
      contentType,
      token: TOKEN,
      allowOverwrite: true,
    });
    return url;
  } catch {
    return null;
  }
}
