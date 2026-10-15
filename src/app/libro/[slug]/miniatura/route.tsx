// Miniatura del video de YouTube (1280x720).
//
// POR QUÉ. YouTube arma sola una miniatura tomando un cuadro del video, y como
// nuestros videos son una imagen fija, las 800 miniaturas del canal salían
// prácticamente iguales. La miniatura es lo que decide el clic: acá se arma una
// propia, con la tapa, el título grande y legible en chico, y una franja que
// dice de una qué es (audiolibro completo o resumen) y cuánto dura.
import { ImageResponse } from "next/og";
import { coverColors } from "@/lib/presentation";
import { notFound } from "next/navigation";
// Se lee el snapshot directo, sin Prisma: esto corre en runtime y en Vercel la
// función no tiene la base. El índice ya no trae los textos, pero sí todo lo que
// hace falta acá (título, autor, tapa, duración).
const seed: Array<{
  slug: string; title: string; author: string; coverImageUrl: string | null;
  contentLayer: number; language: string; audioVersions: string | null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
}> = require("../../../../../prisma/seed-data.json");

export const size = { width: 1280, height: 720 };
export const contentType = "image/png";

function duracion(audioVersions: string | null): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vs: any[] = JSON.parse(audioVersions ?? "[]");
    // La versión NUESTRA en español (la que se sube a YouTube), no la grabación de
    // LibriVox, que dura distinto y confundía la miniatura.
    const v = vs.find((x) => x.status === "ready" && x.durationSeconds && ["onyx", "nova"].includes(x.voiceId))
      ?? vs.find((x) => x.status === "ready" && x.durationSeconds);
    if (!v) return "";
    const h = Math.floor(v.durationSeconds / 3600);
    const m = Math.round((v.durationSeconds % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  } catch {
    return "";
  }
}

// Títulos largos con menos tamaño, para que siempre entren sin cortarse.
function escala(titulo: string): number {
  if (titulo.length <= 22) return 96;
  if (titulo.length <= 38) return 76;
  if (titulo.length <= 60) return 60;
  return 48;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = seed.find((b) => b.slug === slug);
  if (!book) notFound();

  const esCompleto = book.contentLayer === 1;
  const [from, to] = coverColors(book.slug);
  const dur = duracion(book.audioVersions);
  const titulo = book.title.replace(/\s*[:(].*$/, "").slice(0, 80);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#181310", fontFamily: "sans-serif" }}>
        {/* Tapa a la izquierda */}
        <div style={{
          width: 470, height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(150deg, ${from}, ${to})`,
        }}>
          {book.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverImageUrl} alt="" style={{ maxWidth: "78%", maxHeight: "82%", objectFit: "contain", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }} />
          ) : (
            <div style={{ fontSize: 300, fontWeight: 800, color: "rgba(255,255,255,0.22)" }}>
              {titulo.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Texto a la derecha */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "54px 52px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{
              display: "flex", alignSelf: "flex-start", background: esCompleto ? "#ec5a36" : "#0f9d8f",
              color: "#fff", padding: "10px 24px", borderRadius: 999, fontSize: 30, fontWeight: 800, letterSpacing: 1,
            }}>
              {esCompleto ? "AUDIOLIBRO COMPLETO" : "RESUMEN EN AUDIO"}
            </div>
            <div style={{ marginTop: 28, fontSize: escala(titulo), fontWeight: 800, lineHeight: 1.03, color: "#faf6ec" }}>
              {titulo}
            </div>
            <div style={{ marginTop: 18, fontSize: 36, color: "#d8c4a0" }}>{book.author.slice(0, 44)}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#faf6ec" }}>GRATIS</div>
              <div style={{ fontSize: 30, color: "#a89b7a" }}>{`en español${dur ? ` · ${dur}` : ""}`}</div>
            </div>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 5, color: "#c89b5c" }}>BIBLIOTECA ABIERTA</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
