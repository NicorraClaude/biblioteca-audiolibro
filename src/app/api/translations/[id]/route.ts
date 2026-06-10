// Lista las traducciones YA disponibles de un libro (las que algún usuario pidió).
// La ficha la consulta para mostrar las banderitas a todos.
import type { NextRequest } from "next/server";
import { getCached } from "@/lib/blob-cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ langs: [] });
  let langs: { code: string; name: string }[] = [];
  try {
    langs = JSON.parse((await getCached(`traducciones/${id}-manifest.json`)) ?? "[]");
  } catch {
    langs = [];
  }
  return Response.json({ langs });
}
