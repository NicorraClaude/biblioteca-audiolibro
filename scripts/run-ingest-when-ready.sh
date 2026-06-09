#!/usr/bin/env bash
# Espera a que Gutendex responda (nos rate-limitea), y cuando vuelve dispara la
# ingesta de 100 libros + el match de LibriVox. Pensado para correr en background.
set -u
cd "$(dirname "$0")/.."
PING='https://gutendex.com/books/?languages=en&copyright=false&page=1'

echo "[$(date +%H:%M:%S)] Esperando que Gutendex se recupere..."
for i in $(seq 1 40); do
  code=$(curl -sL -m 12 -A "BibliotecaAbierta/1.0" -o /tmp/gx_ping.json -w "%{http_code}" "$PING" 2>/dev/null)
  if [ "$code" = "200" ] && grep -q '"results"' /tmp/gx_ping.json 2>/dev/null; then
    echo "[$(date +%H:%M:%S)] ✅ Gutendex respondió (intento $i). Arrancando ingesta."
    INGEST_NO_TEXT=1 npx tsx scripts/ingest-gutendex.ts 100
    echo "[$(date +%H:%M:%S)] --- match LibriVox ---"
    npx tsx scripts/match-librivox.ts
    echo "[$(date +%H:%M:%S)] 🏁 Listo."
    exit 0
  fi
  echo "[$(date +%H:%M:%S)] intento $i: Gutendex aún caído (code=$code). Reintento en 45s."
  sleep 45
done
echo "[$(date +%H:%M:%S)] ✗ Gutendex no se recuperó en ~30 min. Reintentar más tarde."
exit 1
