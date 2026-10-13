// Fusiona los textos de un snapshot propio (carpeta /tmp) con los publicados.
// Mismo criterio que merge-seed.mjs: nunca se descarta contenido, gana el más rico.
//
// Uso:  node scripts/merge-textos.mjs <dir-mio> <dir-destino>
//
// POR QUÉ: los textos pasaron a un archivo por libro (prisma/textos/<slug>.json).
// Cuando una corrida termina, el directorio se resetea a lo publicado y hay que
// volver a aplicar lo propio encima, sin pisar lo que otra corrida generó en el medio.
import fs from "fs";
import path from "path";

const [, , DIR_MIO, DIR_DEST] = process.argv;
if (!DIR_MIO || !DIR_DEST) { console.error("Uso: node scripts/merge-textos.mjs <dir-mio> <dir-destino>"); process.exit(1); }
if (!fs.existsSync(DIR_MIO)) { console.log("(sin textos propios que fusionar)"); process.exit(0); }
fs.mkdirSync(DIR_DEST, { recursive: true });

// Cuánto contenido real tiene un summary: texto + audios + videos.
function riqueza(s) {
  let n = 0;
  for (const lang of ["es", "en"]) {
    for (const tier of ["sinopsis", "resumen"]) {
      const e = s?.[lang]?.[tier];
      if (!e) continue;
      if (e.text) n += String(e.text).length;
      n += Object.keys(e.audio ?? {}).length * 5000;
      if (e.youtubeVideoId) n += 20000;
    }
  }
  return n;
}

// Unión por idioma y por sección, quedándose con lo más rico de cada lado.
function fusionar(a, b) {
  const out = { ...a };
  for (const lang of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const x = a?.[lang], y = b?.[lang];
    if (!x) { out[lang] = y; continue; }
    if (!y) { out[lang] = x; continue; }
    const l = { ...x };
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (k !== "sinopsis" && k !== "resumen") { l[k] = y[k] ?? x[k]; continue; }
      const px = x[k], py = y[k];
      if (!px) { l[k] = py; continue; }
      if (!py) { l[k] = px; continue; }
      l[k] = {
        ...px, ...py,
        text: String(py.text ?? "").length > String(px.text ?? "").length ? py.text : px.text,
        audio: { ...(px.audio ?? {}), ...(py.audio ?? {}) },
        youtubeVideoId: px.youtubeVideoId ?? py.youtubeVideoId,
      };
      if (!l[k].youtubeVideoId) delete l[k].youtubeVideoId;
    }
    out[lang] = l;
  }
  return out;
}

let nuevos = 0, fusionados = 0, iguales = 0;
for (const f of fs.readdirSync(DIR_MIO)) {
  if (!f.endsWith(".json")) continue;
  const mio = JSON.parse(fs.readFileSync(path.join(DIR_MIO, f), "utf8"));
  const destino = path.join(DIR_DEST, f);
  if (!fs.existsSync(destino)) {
    fs.writeFileSync(destino, JSON.stringify(mio) + "\n");
    nuevos++;
    continue;
  }
  const suyo = JSON.parse(fs.readFileSync(destino, "utf8"));
  const res = fusionar(suyo, mio);
  if (riqueza(res) > riqueza(suyo)) { fs.writeFileSync(destino, JSON.stringify(res) + "\n"); fusionados++; }
  else iguales++;
}
console.log(`textos: ${nuevos} nuevos · ${fusionados} enriquecidos · ${iguales} sin cambios`);
