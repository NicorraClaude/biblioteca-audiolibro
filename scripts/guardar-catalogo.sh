#!/usr/bin/env bash
# Guarda el catálogo (snapshot + commit + push) de forma SEGURA, desde el script.
#
# POR QUÉ EXISTE. Los workflows hacían esto inline:
#     git commit ... || echo
#     git pull --rebase --autostash || true
#     git push || echo "nada para pushear"
# y eso produjo tres desastres distintos:
#   1. El push fallaba y el paso igual quedaba en verde → 5 h de generación perdidas.
#   2. Cuando el rebase chocaba (otro motor commiteó mientras este trabajaba), git
#      dejaba prisma/seed-data.json CON MARCAS DE CONFLICTO en el directorio.
#   3. `vercel deploy` sube el DIRECTORIO DE TRABAJO, no el commit: subía ese archivo
#      roto y el build moría con "SyntaxError ... in JSON". Deploy fallido y mail de
#      error, con el commit sano en GitHub — un síntoma que no señala su causa.
#
# Acá el merge NUNCA es textual: se usa scripts/merge-seed.mjs, que hace unión por
# slug quedándose con el valor más rico de cada campo. Y antes de commitear se valida
# que el JSON parsee, así una corrupción no puede llegar ni al repo ni al deploy.
set -uo pipefail

SEED="prisma/seed-data.json"
INTENTOS="${INTENTOS:-4}"
MENSAJE="${1:-Catálogo actualizado (auto)}"

if [ -z "${GITHUB_ACTIONS:-}" ]; then
  echo "(local: solo snapshot, no commiteo)"
  npx tsx scripts/export-seed.ts
  exit 0
fi

git config user.name "biblioteca-bot"
git config user.email "bot@biblioteca.local"

valido() { node -e "JSON.parse(require('fs').readFileSync('$1','utf8'))" 2>/dev/null; }

for intento in $(seq 1 "$INTENTOS"); do
  echo ""
  echo "── Guardando catálogo · intento $intento/$INTENTOS"

  # 1) Volcar la base de este job a un archivo aparte.
  npx tsx scripts/export-seed.ts >/dev/null || { echo "✗ export-seed falló"; exit 1; }
  cp "$SEED" /tmp/seed-mio.json
  if ! valido /tmp/seed-mio.json; then
    echo "✗ El snapshot generado no es JSON válido. No commiteo nada."
    exit 1
  fi

  # 2) Traer lo último publicado y fusionar por contenido, nunca por texto.
  git fetch origin main --quiet
  git checkout -B main origin/main --quiet
  cp "$SEED" /tmp/seed-origin.json
  node scripts/merge-seed.mjs /tmp/seed-origin.json /tmp/seed-mio.json "$SEED" || { echo "✗ merge falló"; exit 1; }

  if ! valido "$SEED"; then
    echo "✗ El resultado del merge no es JSON válido. Abandono sin tocar el repo."
    git checkout -- "$SEED" 2>/dev/null || true
    exit 1
  fi

  if git diff --quiet -- "$SEED"; then
    echo "✓ El catálogo publicado ya tiene todo esto. Nada para guardar."
    exit 0
  fi

  git add "$SEED"
  git commit -m "$MENSAJE" --quiet

  if git push origin main --quiet 2>/dev/null; then
    echo "✅ Catálogo guardado y publicado."
    # El chequeo va DESPUÉS de guardar, nunca antes: si la home se pasó de peso,
    # queremos igual conservar el contenido generado y que la corrida quede en rojo
    # con un mensaje claro, en vez de perder el trabajo o recibir un error críptico
    # de Vercel dos minutos más tarde.
    npx tsx scripts/chequear-peso-home.ts || exit 1
    exit 0
  fi
  echo "   ⚠️  Alguien commiteó en el medio. Reintento sobre la versión nueva."
done

# Que la corrida se ponga en ROJO: el error de fondo de las veces anteriores fue
# exactamente esto pasando en silencio.
echo "✗ No pude guardar el catálogo después de $INTENTOS intentos."
exit 1
