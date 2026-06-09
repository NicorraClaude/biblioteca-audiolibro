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

npx tsx scripts/ingest-gutenberg.ts "$TARGET_EN"
INGEST_SOURCE=es npx tsx scripts/ingest-gutenberg.ts "$TARGET_ES"

echo "🎙️  Match LibriVox a los nuevos..."
npx tsx scripts/match-librivox.ts

echo "💾 Snapshot..."
npx tsx scripts/export-seed.ts

# Si está en CI (sin Vercel CLI logueado), frenamos acá: el commit del JSON
# dispara el deploy por la integración de git.
if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
  echo "✅ Listo (sin deploy: lo hace la integración de git)."
  exit 0
fi

echo "🏗️  Build + deploy..."
npm run build
vercel --prod --yes
echo "✅ [$(date +%H:%M:%S)] Catálogo crecido y publicado."
