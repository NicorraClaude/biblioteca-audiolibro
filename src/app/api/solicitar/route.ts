// "Si no encontraste el título que buscás, lo buscamos por vos." Captura el
// pedido (mail + título) y lo deja en una cola para ingestarlo completo
// (libro + sinopsis + resumen, ES e EN, voces Onyx y Nova).
import type { NextRequest } from "next/server";
import { getCached, setCached } from "@/lib/blob-cache";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").slice(0, 120).trim();
  const title = String(body?.title ?? "").slice(0, 200).trim();
  if (!title) {
    return Response.json({ error: "falta el título" }, { status: 400 });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "mail inválido" }, { status: 400 });
  }
  const queue = JSON.parse((await getCached("solicitudes.json")) ?? "[]");
  queue.push({ email, title, at: new Date().toISOString(), status: "pendiente" });
  await setCached("solicitudes.json", JSON.stringify(queue), "application/json");
  return Response.json({ ok: true });
}
