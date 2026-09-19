#!/usr/bin/env bash
# Crecimiento automático del catálogo (Fase 5). Una sola orden:
#   1) ingiere más libros de dominio público (Gutenberg directo, regla dura),
#   2) matchea audio de LibriVox a los nuevos,
#   3) actualiza el snapshot versionado,
#   4) reconstruye y publica el sitio.
# Idempotente: si no hay nada nuevo, no rompe nada. Pensado para correr en cron.
#
# Uso:   bash scripts/grow.sh [TARGET_EN] [TARGET_ES]
#   TARGET_EN: total de libros en inglés a asegurar (default 200)
#   TARGET_ES: total de libros en español a asegurar (default 80)
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET_EN="${1:-200}"
TARGET_ES="${2:-80}"

echo "🌱 [$(date +%H:%M:%S)] Creciendo catálogo → EN:$TARGET_EN ES:$TARGET_ES"

# En un entorno limpio (CI) no existe dev.db: la creamos y la sembramos desde el
# snapshot versionado antes de ingerir (así crecemos sobre el catálogo actual).
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts

# Libros NUEVOS por corrida (diaria). El español va primero y pesa el doble: es el
# público. Los argumentos viejos (200 80) que manda el YAML ya no limitan nada: eran
# un "total a asegurar" que se había alcanzado y dejaba entrar ~0 libros por día.
# El ritmo está pensado para lo que el motor alcanza a procesar (sinopsis + resumen
# + audio, ~12 libros por día); más rápido solo acumula fichas sin contenido.
NUEVOS_ES="${NUEVOS_ES:-8}"
NUEVOS_EN="${NUEVOS_EN:-4}"
LOG=/tmp/crecer.txt
INGEST_SOURCE=es INGEST_NUEVOS="$NUEVOS_ES" npx tsx scripts/ingest-gutenberg.ts | tee "$LOG"
INGEST_NUEVOS="$NUEVOS_EN" npx tsx scripts/ingest-gutenberg.ts | tee -a "$LOG"

echo "🧹 Quitando duplicados..."
npx tsx scripts/dedupe-books.ts

echo "🖼️  Portadas reales (Open Library, validadas por título+autor; sin marca Gutenberg)..."
npx tsx scripts/verify-covers.ts

echo "🎙️  Match LibriVox a los nuevos..."
npx tsx scripts/match-librivox.ts

echo "💾 Snapshot..."
npx tsx scripts/export-seed.ts

# Si está en CI (sin Vercel CLI logueado), frenamos acá: el commit del JSON
# dispara el deploy por la integración de git.
if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
  # En la nube se guarda con el mismo mecanismo seguro que el motor. El YAML hacía
  # `git push || echo "nada para pushear"`: si chocaba con otro workflow que
  # commiteó en el medio, lo ingerido se perdía sin que nadie se enterara.
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    {
      echo "# Bitácora de crecimiento — la corrida más nueva arriba"
      echo ""
      echo "## \`$(date -u '+%Y-%m-%d %H:%M UTC')\` · objetivo: $NUEVOS_ES en español + $NUEVOS_EN en inglés"
      echo ""
      grep -E "Ingeridos|Descartados|Total libros" "$LOG" | sed 's/^ */- /'
      echo ""
      [ -f estado-crecer.md ] && awk 'NR>2' estado-crecer.md | awk '/^## `/{n++} n<=29'
    } > /tmp/estado-crecer.md
    mv /tmp/estado-crecer.md estado-crecer.md
    ESTADO_ARCHIVO=estado-crecer.md bash scripts/guardar-catalogo.sh "Crecer catálogo (auto)"
  fi
  echo "✅ Listo (sin deploy: lo hace la integración de git)."
  exit 0
fi

echo "🏗️  Build + deploy..."
npm run build
vercel --prod --yes
echo "✅ [$(date +%H:%M:%S)] Catálogo crecido y publicado."
