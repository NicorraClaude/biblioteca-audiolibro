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
# Presupuesto de reloj para el catálogo. El job de GitHub muere a los 350 min y si
# lo mata NO se guarda nada (el snapshot es el último paso), así que se corta antes.
MOTOR_MIN="${MOTOR_MIN:-290}"

# En las corridas AUTOMÁTICAS el YAML manda su valor por defecto (3), que quedó
# corto: en la ventana del job entran ~12 libros, no 3. Cuando corre solo, el
# límite lo pone el reloj y no un número fijo; cuando lo disparás a mano, se
# respeta lo que hayas puesto en el formulario.
if [ "${GITHUB_EVENT_NAME:-}" = "schedule" ]; then
  BIBLIOTECA="auto"
fi

echo "▶ Motor: pedidos=$PEDIDOS · modernos=$MODERNOS · biblioteca=$BIBLIOTECA · youtube=$YOUTUBE · reloj=${MOTOR_MIN}min"

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

# YouTube va ANTES del catálogo: son solo 6 subidas y no pueden quedar sin hacerse
# porque la generación de audio se comió todo el tiempo del job.
if [ "$YOUTUBE" != "0" ]; then
  REQ_LIMIT="$YOUTUBE" run_step "Subida a YouTube" npx tsx scripts/upload-resumenes-youtube.ts
fi

# El catálogo se lleva TODO el tiempo que sobre, de a un libro por vez.
#
# Antes esto era una sola llamada con REQ_LIMIT fijo (3 libros) y el job se quedaba
# horas ocioso: cada libro son ~25 min (sinopsis + resumen × 2 idiomas × 2 voces),
# así que en una ventana de 5 horas entran ~12, no 3. Pero un número fijo alto es
# peligroso: si se pasa del timeout, GitHub mata el job y se pierde TODO lo generado
# porque nunca llega el paso de snapshot.
#
# Por eso corre contra reloj: procesa de a uno y corta cuando se acaba el
# presupuesto, dejando margen para snapshotear, commitear y deployar lo hecho.
if [ "$BIBLIOTECA" != "0" ]; then
  echo ""
  echo "═══ Catálogo: texto + audio (hasta $MOTOR_MIN min de reloj) ═══"
  limite=$(( MOTOR_MIN * 60 ))
  hechos=0
  fallos=0
  while [ "$SECONDS" -lt "$limite" ]; do
    salida="$(REQ_LIMIT=1 npx tsx scripts/fill-summaries.ts 2>&1)" || true
    echo "$salida" | grep -vE '^\s*$' | tail -4
    if echo "$salida" | grep -q "a generar ahora: 0"; then
      echo "✓ No queda nada pendiente en el catálogo."
      break
    fi
    # Corre desatendido de madrugada: si algo se rompe (API caída, credencial
    # vencida), el bucle giraría horas quemando el job sin producir nada. A los 3
    # intentos seguidos sin un libro terminado, corta y deja lo que ya había.
    if ! echo "$salida" | grep -q "✓ listo"; then
      fallos=$((fallos + 1))
      echo "   ⚠️  intento sin resultado ($fallos/3)"
      if [ "$fallos" -ge 3 ]; then
        echo "✗ Tres intentos seguidos sin generar: corto acá y guardo lo hecho."
        break
      fi
      continue
    fi
    fallos=0
    hechos=$((hechos + 1))
    echo "   ── $hechos libro(s) · $((SECONDS / 60)) de $MOTOR_MIN min usados"
    # Tope duro opcional: BIBLIOTECA actúa como techo de cantidad si se quiere.
    if [ "$BIBLIOTECA" != "auto" ] && [ "$hechos" -ge "$BIBLIOTECA" ]; then
      echo "✓ Alcanzado el tope de $BIBLIOTECA libros."
      break
    fi
  done
  echo "✓ Catálogo: $hechos libro(s) esta corrida."
fi

echo ""
echo "▶ Motor terminado."
