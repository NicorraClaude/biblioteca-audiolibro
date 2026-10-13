// Título y autor como se conocen en español. Los clásicos están cargados con su
// título original ("Pride and Prejudice") y el canal es en español: nadie busca eso.
// Se resuelve una vez con el modelo y queda guardado en summary.es (tituloEs/autorEs),
// así el resumen y el audiolibro completo usan exactamente el mismo nombre.
import { prisma } from "../db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tituloEspanol(book: any): Promise<{ titulo: string; autor: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any; try { s = JSON.parse(book.summary ?? "{}"); } catch { s = {}; }
  if (s.es?.tituloEs) return { titulo: s.es.tituloEs, autor: s.es.autorEs ?? book.author };
  const tal = { titulo: book.title, autor: book.author };
  if (book.language === "es" || book.contentLayer === 2 || !process.env.OPENAI_API_KEY) return tal;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini", temperature: 0, max_tokens: 80,
      messages: [
        { role: "system", content: "Respondés SOLO dos líneas: el título y el autor. Sin comillas ni explicaciones." },
        { role: "user", content:
          `¿Con qué título se publica en español "${book.title}" de ${book.author}? ` +
          `Si tiene un título establecido en español, devolvé ese. Si no, una traducción fiel y breve. ` +
          `Sin subtítulos de catálogo, sin "Volumen"/"Tomo" salvo que sea parte del nombre. ` +
          `Segunda línea: el nombre del autor como se escribe habitualmente en español (ej. Homero, Fiódor Dostoievski; ` +
          `si no cambia, igual al original).` },
      ],
    }),
  });
  if (!res.ok) return tal;
  const limpiar = (x: string) => (x ?? "").trim().replace(/^(t[ií]tulo|autor)\s*:\s*/i, "").replace(/^["“«']+|["”»'.]+$/g, "");
  const [t, a] = String((await res.json()).choices?.[0]?.message?.content ?? "").split("\n").map(limpiar).filter(Boolean);
  if (!t || t.length > 90) return tal;
  const autor = a && a.length <= 60 ? a : book.author;
  s.es = { ...(s.es ?? {}), tituloEs: t, autorEs: autor };
  book.summary = JSON.stringify(s);
  await prisma.book.update({ where: { id: book.id }, data: { summary: book.summary } });
  return { titulo: t, autor };
}

