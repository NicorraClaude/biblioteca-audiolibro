// Preparación del texto para narrar:
//  1) saca el "andamiaje" de Project Gutenberg (header/footer legal),
//  2) separa el prólogo / preliminares del Capítulo 1 (Nico: arrancar en el Cap. 1),
//  3) corta el cuerpo en fragmentos aptos para el TTS (límite ~4000 chars/pedido).

// Quita el encabezado y pie legales de Gutenberg.
export function stripGutenbergBoilerplate(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  const start = text.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i);
  if (start && start.index !== undefined) {
    text = text.slice(start.index + start[0].length);
  }
  const end = text.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (end && end.index !== undefined) {
    text = text.slice(0, end.index);
  }
  return text.trim();
}

// Encabezados de "Capítulo 1" en español e inglés.
const CHAPTER_ONE =
  /^\s*(cap[ií]tulo\s+(primero|i|1|uno)\b|chapter\s+(i|1|one)\b)/im;

// Separa preliminares (prólogo, dedicatoria, prefacio) del cuerpo desde el Cap. 1.
// Si no encuentra un "Capítulo 1" claro, devuelve todo como cuerpo (sin frontMatter).
export function splitFrontMatterAndBody(text: string): {
  frontMatter: string;
  body: string;
} {
  const m = text.match(CHAPTER_ONE);
  if (m && m.index !== undefined && m.index > 200) {
    return {
      frontMatter: text.slice(0, m.index).trim(),
      body: text.slice(m.index).trim(),
    };
  }
  return { frontMatter: "", body: text.trim() };
}

// Corta el texto en fragmentos <= maxLen, respetando párrafos y oraciones.
export function chunkText(text: string, maxLen = 3800): string[] {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length <= maxLen) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    push();
    if (para.length <= maxLen) {
      current = para;
      continue;
    }
    // Párrafo gigante: cortamos por oraciones.
    const sentences = para.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) ?? [para];
    for (const s of sentences) {
      if ((current + s).length <= maxLen) {
        current += s;
      } else {
        push();
        current = s.length <= maxLen ? s : s.slice(0, maxLen);
      }
    }
  }
  push();
  return chunks;
}
