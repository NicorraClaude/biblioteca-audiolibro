// Fusiona dos snapshots de seed-data.json SIN descartar nada.
// Unión por slug; por campo se queda con el valor más "rico".
import fs from 'fs';

const A = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); // base (origin) — define el orden
const B = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); // local
const OUT = process.argv[4];

// Campos de CONTENIDO: gana el más largo / no nulo (contenido caro e irrecuperable).
const RICH = new Set([
  'summary', 'librivoxUrl', 'coverImageUrl', 'affiliateLinks', 'audioVersions',
  'ebookPdfUrl', 'ebookEpubUrl', 'textPath', 'description', 'licenseRecord', 'categories',
]);
// Campos numéricos: gana el mayor.
const MAXN = new Set(['downloadCount', 'viewsCached']);

const empty = (v) => v === null || v === undefined || v === '' || v === '[]' || v === '{}';

function pick(field, a, b) {
  if (empty(a)) return b;
  if (empty(b)) return a;
  if (MAXN.has(field)) return Math.max(Number(a) || 0, Number(b) || 0);
  if (RICH.has(field)) return String(b).length > String(a).length ? b : a;
  return b; // resto: gana el working local (es la edición más reciente)
}

function mergeBook(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = pick(k, a[k], b[k]);
  return out;
}

const bm = new Map(B.map((x) => [x.slug, x]));
const am = new Map(A.map((x) => [x.slug, x]));
const merged = A.map((a) => mergeBook(a, bm.get(a.slug)));
const extras = B.filter((b) => !am.has(b.slug));
merged.push(...extras);

fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');
console.log(`base=${A.length} local=${B.length} → merged=${merged.length} (nuevos de local: ${extras.length})`);
console.log('  ' + extras.map((e) => e.slug).join('\n  '));

// Uso:
//   git show origin/main:prisma/seed-data.json > /tmp/seed-origin.json
//   cp prisma/seed-data.json /tmp/seed-local.json
//   node scripts/merge-seed.mjs /tmp/seed-origin.json /tmp/seed-local.json prisma/seed-data.json
//
// POR QUÉ EXISTE: el merge de texto de git sobre seed-data.json PIERDE libros y
// campos en silencio (comprobado: se comió un libro entero y dos portadas). El
// `summary` es contenido caro e irrecuperable. Este script hace unión por slug y
// se queda con el valor más rico de cada campo, así ningún lado se descarta.
