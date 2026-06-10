#!/usr/bin/env bash
# Trabajo nocturno: narra libros COMPLETOS (gratis) y los sube a YouTube (ocultos),
# hasta agotar la cuota diaria de YouTube (~6 subidas) o la lista de candidatos.
# Los gigantes se saltean solos (guard de tamaño en narrate-and-upload).
#
# Uso:  bash scripts/narrate-batch.sh [maxSubidas]
set -uo pipefail
cd "$(dirname "$0")/.."

MAX="${1:-6}"
echo "🌙 [$(date +%H:%M:%S)] Batch nocturno — hasta $MAX audiolibros completos."

SLUGS=$(npx tsx scripts/list-narratable.ts 25)
done_count=0

for slug in $SLUGS; do
  if [ "$done_count" -ge "$MAX" ]; then
    echo "🛑 Alcanzado el máximo de $MAX subidas. Freno."
    break
  fi
  echo ""
  echo "▶️  [$(date +%H:%M:%S)] $slug"
  YT_PRIVACY=unlisted npx tsx scripts/narrate-and-upload.ts "$slug" nova
  code=$?
  if [ "$code" -eq 0 ]; then
    # Subida OK: guardamos el snapshot (por si se corta).
    npx tsx scripts/export-seed.ts >/dev/null 2>&1
    done_count=$((done_count + 1))
    echo "   ✓ subido ($done_count/$MAX)"
  elif [ "$code" -eq 2 ]; then
    echo "   ⏭️  salteado (muy largo). Sigo con el próximo."
    continue
  else
    echo "   ✗ falló (code $code) — probablemente cuota de YouTube agotada. Freno el batch."
    break
  fi
done

echo ""
echo "🏁 [$(date +%H:%M:%S)] Batch terminado. Audiolibros completos subidos: $done_count"
