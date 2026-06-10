// Puntajes + reseñas. Al recibir una reseña, la IA detecta si la crítica apunta a
// algo CORREGIBLE (traducción / versión / plataforma / error modificable) y, si es
// así, deja una alerta para tomar medidas. Si solo critican el LIBRO en sí, nada que hacer.
import type { NextRequest } from "next/server";
import { getCached, setCached } from "@/lib/blob-cache";
import { chat } from "@/lib/openai";

type Review = { name: string; rating: number; text: string; at: string; flag?: string };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list: Review[] = JSON.parse((await getCached(`reviews/${id}.json`)) ?? "[]");
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return Response.json({ reviews: list, avg: Math.round(avg * 10) / 10, count: list.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const rating = Math.max(1, Math.min(5, Number(body?.rating) || 0));
  const text = String(body?.text ?? "").slice(0, 1500).trim();
  const name = String(body?.name ?? "Anónimo").slice(0, 60).trim() || "Anónimo";
  if (!rating) return Response.json({ error: "falta puntaje" }, { status: 400 });

  // Clasificación de sentimiento (solo si hay texto y API key).
  let flag: string | undefined;
  if (text && process.env.OPENAI_API_KEY) {
    try {
      const out = await chat([
        { role: "system", content: `Clasificás reseñas de una biblioteca de audiolibros. Determiná si la crítica apunta a algo CORREGIBLE por nosotros (la TRADUCCIÓN, la VERSIÓN/edición, la PLATAFORMA/web/reproductor, o un ERROR puntual modificable) o solo al LIBRO/obra en sí (que no podemos cambiar). Respondé JSON: {"fixable": boolean, "target": "traduccion|version|plataforma|error|libro|ninguno", "issue": "qué arreglar en pocas palabras"}.` },
        { role: "user", content: text },
      ], { json: true, temperature: 0 });
      const cls = JSON.parse(out);
      if (cls.fixable) {
        flag = cls.target;
        const alerts = JSON.parse((await getCached("reviews/_alerts.json")) ?? "[]");
        alerts.push({ bookId: id, target: cls.target, issue: cls.issue, text, at: new Date().toISOString(), rating });
        await setCached("reviews/_alerts.json", JSON.stringify(alerts), "application/json");
      }
    } catch {
      /* si falla la clasificación, igual guardamos la reseña */
    }
  }

  const list: Review[] = JSON.parse((await getCached(`reviews/${id}.json`)) ?? "[]");
  const review: Review = { name, rating, text, at: new Date().toISOString(), flag };
  list.unshift(review);
  await setCached(`reviews/${id}.json`, JSON.stringify(list.slice(0, 500)), "application/json");
  const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
  return Response.json({ ok: true, avg: Math.round(avg * 10) / 10, count: list.length });
}
