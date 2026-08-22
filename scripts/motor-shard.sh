#!/usr/bin/env bash
# UNA SESIÓN del reparto paralelo. Procesa su pedazo del catálogo de a un libro,
# contra reloj, y va acumulando su parche.
#
# Trabaja de a uno a propósito: cada libro son ~25 min (sinopsis + resumen × 2
# idiomas × 2 voces) y el job de GitHub muere a las 6 horas. Si se lanzara un lote
# grande de una y el job se pasara, GitHub lo mata y se pierde TODO lo generado,
# porque el parche recién se sube al final. Yendo de a uno, cada libro terminado
# ya quedó guardado en el parche.
#
# Variables: SHARD, SHARDS, PATCH_OUT, MOTOR_MIN.
set -uo pipefail

MOTOR_MIN="${MOTOR_MIN:-290}"
PATCH_OUT="${PATCH_OUT:-parche.json}"
SHARD="${SHARD:-0}"
SHARDS="${SHARDS:-1}"

echo "▶ Sesión $((SHARD + 1)) de $SHARDS · hasta $MOTOR_MIN min · parche: $PATCH_OUT"
echo "[]" > "$PATCH_OUT"

limite=$(( MOTOR_MIN * 60 ))
hechos=0
fallos=0

while [ "$SECONDS" -lt "$limite" ]; do
  salida="$(REQ_LIMIT=1 SHARD="$SHARD" SHARDS="$SHARDS" PATCH_OUT="$PATCH_OUT" \
    npx tsx scripts/fill-summaries.ts 2>&1)" || true
  echo "$salida" | grep -vE '^\s*$' | tail -4

  if echo "$salida" | grep -q "a generar ahora: 0"; then
    echo "✓ Esta sesión terminó su parte."
    break
  fi

  # Desatendido: si algo se rompe (API caída, credencial vencida), el bucle giraría
  # horas sin producir. A los 3 intentos seguidos sin resultado, corta y conserva
  # el parche con lo que ya había generado.
  if ! echo "$salida" | grep -q "✓ listo"; then
    fallos=$(( fallos + 1 ))
    echo "   ⚠️  intento sin resultado ($fallos/3)"
    [ "$fallos" -ge 3 ] && { echo "✗ Tres fallos seguidos: corto y guardo lo hecho."; break; }
    continue
  fi

  fallos=0
  hechos=$(( hechos + 1 ))
  echo "   ── $hechos libro(s) · $((SECONDS / 60))/$MOTOR_MIN min"
done

# ── SEGUNDA FASE: traducir al español y narrar ──
# Va acá y no solo en el motor de audiolibros porque ESTE workflow ya recibe
# OPENAI_API_KEY: así arranca hoy, sin que haya que volver a subir un YAML a mano.
# Solo corre si sobró tiempo después de los resúmenes, que son la prioridad.
traducidos=0
if [ "$SECONDS" -lt "$limite" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
  echo ""
  echo "═══ Traducir y narrar en español ═══"
  for slug in $(SHARD="$SHARD" SHARDS="$SHARDS" npx tsx scripts/list-traducibles.ts 100); do
    [ "$SECONDS" -ge "$limite" ] && break
    echo ""
    echo "▶ $slug → español  ($((SECONDS / 60))/$MOTOR_MIN min)"
    npx tsx scripts/traducir-y-narrar.ts "$slug" es nova
    c=$?
    if [ "$c" -eq 0 ]; then traducidos=$(( traducidos + 1 ))
    elif [ "$c" -ne 2 ]; then
      fallos=$(( fallos + 1 ))
      [ "$fallos" -ge 3 ] && { echo "✗ Tres fallos seguidos: corto."; break; }
    fi
  done
fi

echo "✓ Sesión $((SHARD + 1)): $hechos libro(s) · $traducidos narrado(s) en español."
