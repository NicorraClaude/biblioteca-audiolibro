// Junta los parches de las sesiones paralelas en prisma/seed-data.json, y LOS GUARDA:
// commitea y pushea acá adentro, en vez de dejárselo a un paso del YAML.
//
// POR QUÉ ACÁ Y NO EN EL WORKFLOW: el paso del YAML hacía
//   git commit ... || echo; git pull --rebase || true; git push || echo "nada para pushear"
// o sea que si el push fallaba, el paso igual se declaraba exitoso. Pasó dos veces:
// cinco horas de trabajo de diez sesiones tiradas, con el workflow en verde. Acá el
// fallo es RUIDOSO (exit 1) y encima se reintenta solo.
//
// POR QUÉ RESETEA A origin/main ANTES: actions/checkout deja el repo en el commit que
// disparó la corrida, no en el último. Si otro bot commiteó mientras las sesiones
// generaban (el cron de pedidos lo hace cada 2h), el commit sale de una base vieja y
// el push se rechaza. Aplicar los parches SIEMPRE sobre lo último de origin evita eso,
// y como los parches son declarativos, reintentar es seguro.
//
// Uso:  npx tsx scripts/apply-patches.ts <carpeta-de-parches>
import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Un parche puede traer el resumen (Audio masivo) o el audiolibro completo
// (motor de audiolibros), o los dos. Cada campo se evalúa por separado.
type Patch = { slug: string; summary?: string | null; audioVersions?: string | null };
type Book = { slug: string; summary?: string | null; audioVersions?: string | null; [k: string]: unknown };

const SEED = "prisma/seed-data.json";
const INTENTOS = 4;

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

// Cuánto contenido REAL tiene un summary, para no reemplazar algo rico por algo pobre.
// Mide textos y audios, no el largo del JSON (que engaña).
function riqueza(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const s = JSON.parse(raw);
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
  } catch {
    return 0;
  }
}

async function leerParches(dir: string): Promise<Patch[]> {
  const archivos: string[] = [];
  async function recorrer(d: string) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await recorrer(p);
      else if (e.name.endsWith(".json")) archivos.push(p);
    }
  }
  await recorrer(dir);

  const todos: Patch[] = [];
  for (const f of archivos) {
    try {
      const p = JSON.parse(await readFile(f, "utf8"));
      if (Array.isArray(p)) todos.push(...p);
    } catch {
      console.error(`  ✗ parche ilegible, lo salteo: ${f}`);
    }
  }
  console.log(`📦 ${archivos.length} parche(s) · ${todos.length} entradas`);
  return todos;
}

// Cuántas grabaciones REALES tiene un audioVersions (las "pending" no cuentan).
function riquezaAudio(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const vs = JSON.parse(raw);
    if (!Array.isArray(vs)) return 0;
    return vs.filter((v) => v?.audioUrl || v?.youtubeVideoId).length;
  } catch {
    return 0;
  }
}

// Aplica los parches sobre el snapshot actual del disco. Devuelve cuántos entraron.
async function aplicar(parches: Patch[]): Promise<number> {
  const libros: Book[] = JSON.parse(await readFile(SEED, "utf8"));
  const porSlug = new Map(libros.map((b) => [b.slug, b]));
  let aplicados = 0, ignorados = 0, desconocidos = 0;

  for (const p of parches) {
    const b = porSlug.get(p.slug);
    if (!b) { desconocidos++; continue; }
    let toco = false;
    // Cada campo se compara contra el suyo: un parche que solo trae el audiolibro
    // no debe pisar un resumen que el otro motor generó mientras tanto.
    if (p.summary !== undefined && riqueza(p.summary) > riqueza(b.summary)) {
      b.summary = p.summary;
      toco = true;
    }
    if (p.audioVersions !== undefined && riquezaAudio(p.audioVersions) > riquezaAudio(b.audioVersions)) {
      b.audioVersions = p.audioVersions;
      toco = true;
    }
    if (toco) aplicados++;
    else ignorados++;
  }

  await writeFile(SEED, JSON.stringify(libros, null, 2) + "\n", "utf8");
  console.log(`   ${aplicados} actualizados · ${ignorados} ya estaban igual o mejor · ${desconocidos} sin match`);
  return aplicados;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Pasá la carpeta de parches. Ej: npx tsx scripts/apply-patches.ts parches/");

  const parches = await leerParches(dir);
  if (parches.length === 0) {
    console.log("Nada que aplicar.");
    return;
  }

  const enCI = !!process.env.GITHUB_ACTIONS;
  if (!enCI) {
    // En local solo escribe el archivo: el commit lo decide la persona.
    await aplicar(parches);
    console.log("\n(local: no commiteo ni pusheo, revisá el diff a mano)\n");
    return;
  }

  git("config", "user.name", "biblioteca-bot");
  git("config", "user.email", "bot@biblioteca.local");

  for (let intento = 1; intento <= INTENTOS; intento++) {
    console.log(`\n── Intento ${intento}/${INTENTOS}`);
    // Partir SIEMPRE de lo último publicado, no de la foto con la que arrancó la corrida.
    git("fetch", "origin", "main");
    git("checkout", "-B", "main", "origin/main");

    const aplicados = await aplicar(parches);
    if (aplicados === 0) {
      console.log("✓ El catálogo ya tiene todo esto. No hace falta commitear.");
      return;
    }

    git("add", SEED);
    git("commit", "-m", `Audio masivo: ${aplicados} libros con texto + audio (auto)`);

    let pusheado = false;
    try {
      git("push", "origin", "main");
      pusheado = true;
    } catch {
      // Alguien commiteó entre el fetch y el push. Como los parches son declarativos,
      // volver a aplicarlos sobre la nueva base da el mismo resultado.
      console.error(`   ⚠️  Push rechazado (otro commit entró en el medio). Reintento.`);
    }

    if (pusheado) {
      console.log(`\n✅ Guardado y publicado: ${aplicados} libros.\n`);
      // Fuera del try a propósito: si el chequeo falla no es un push rechazado y no
      // hay que reintentar. Va DESPUÉS de guardar para no perder lo generado; si la
      // home se pasó de peso, la corrida queda en rojo con un mensaje claro en vez
      // del error críptico de Vercel dos minutos más tarde.
      execFileSync("npx", ["tsx", "scripts/chequear-peso-home.ts"], { stdio: "inherit" });
      return;
    }
  }

  // Si llegamos acá, NO se guardó. Que el workflow se ponga en rojo: el error de
  // fondo de las veces anteriores fue exactamente esto pasando en silencio.
  throw new Error(`No pude pushear después de ${INTENTOS} intentos. El trabajo sigue en los artifacts.`);
}

main().catch((e) => { console.error("\n✗", e.message); process.exit(1); });
