// Caché compartida en la nube para resultados de IA generados bajo demanda.
// Usa Cloudflare R2 si está configurado (recomendado, 10GB gratis + egress
// gratis); si no, cae a Vercel Blob (legacy). El primer usuario que pide algo
// lo genera; queda guardado para TODOS los demás.
import { r2Put, r2GetText, isR2Configured } from "@/lib/r2";
import { list, put } from "@vercel/blob";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// Devuelve el contenido cacheado (texto) o null si no existe.
export async function getCached(pathname: string): Promise<string | null> {
  if (isR2Configured()) {
    try { return await r2GetText(pathname); } catch { return null; }
  }
  if (!BLOB_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, token: BLOB_TOKEN });
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
  if (isR2Configured()) {
    try { return await r2Put(pathname, content, contentType); } catch { return null; }
  }
  if (!BLOB_TOKEN) return null;
  try {
    const { url } = await put(pathname, content, {
      access: "public", contentType, token: BLOB_TOKEN, allowOverwrite: true,
    });
    return url;
  } catch {
    return null;
  }
}
