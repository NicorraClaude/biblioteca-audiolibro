#!/usr/bin/env bash
# MOTOR DE LA BIBLIOTECA — toda la lógica de la producción diaria vive ACÁ, no en
# el YAML del workflow. Motivo concreto: pushear archivos en .github/workflows/
# exige el scope "workflow" que el token de Nico no tiene, así que cada cambio en
# el YAML hay que hacerlo a mano por la web. Un script en scripts/ se pushea
# normal → de acá en más el pipeline se cambia sin que Nico toque nada.
#
# Orden de prioridades (el primero que tenga trabajo, lo hace):
#   0. Pedidos de título de los usuarios (lo que pidió gente real, va primero)
#   1. Fichas modernas de negocios (las 38 curadas)      → build-modernos.ts
#   2. Sinopsis + resumen + AUDIO del catálogo de capa 1  → fill-summaries.ts
#   3. Subida a YouTube de lo que tenga audio y no video  → upload-resumenes-youtube.ts
#
# El audio SIEMPRE queda en R2 y escuchable en la ficha, tenga o no video: la
# cuota de YouTube (6/día) no puede dejar el catálogo mudo.
set -uo pipefail

PEDIDOS="${PEDIDOS:-10}"
MODERNOS="${MODERNOS:-5}"
BIBLIOTECA="${BIBLIOTECA:-3}"
YOUTUBE="${YOUTUBE:-6}"

echo "▶ Motor: pedidos=$PEDIDOS · modernos=$MODERNOS · biblioteca=$BIBLIOTECA · youtube=$YOUTUBE"

# Cada etapa es independiente: que una falle no debe tirar abajo las otras ni
# impedir que el catálogo se snapshotee y deploye con lo que sí salió bien.
run_step() {
  local nombre="$1"; shift
  echo ""
  echo "═══ $nombre ═══"
  if "$@"; then
    echo "✓ $nombre ok"
  else
    echo "✗ $nombre falló (código $?) — sigo con lo demás"
  fi
}

# Va PRIMERO: es lo único que pidió una persona de verdad y está esperando.
# (Su cron propio, process-requests.yml, venía fallando cada 2h desde la migración
#  a R2 porque el YAML solo le pasaba BLOB_READ_WRITE_TOKEN. Acá los secrets están
#  bien, así que los pedidos se atienden igual aunque aquel siga roto.)
if [ "$PEDIDOS" != "0" ]; then
  REQ_LIMIT="$PEDIDOS" run_step "Pedidos de títulos" npx tsx scripts/process-requests.ts
fi

if [ "$MODERNOS" != "0" ]; then
  REQ_LIMIT="$MODERNOS" run_step "Fichas modernas" npx tsx scripts/build-modernos.ts
fi

if [ "$BIBLIOTECA" != "0" ]; then
  REQ_LIMIT="$BIBLIOTECA" run_step "Catálogo: texto + audio" npx tsx scripts/fill-summaries.ts
fi

if [ "$YOUTUBE" != "0" ]; then
  REQ_LIMIT="$YOUTUBE" run_step "Subida a YouTube" npx tsx scripts/upload-resumenes-youtube.ts
fi

echo ""
echo "▶ Motor terminado."
