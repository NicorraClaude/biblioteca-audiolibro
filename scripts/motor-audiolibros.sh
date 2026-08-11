#!/usr/bin/env bash
# UNA SESIÓN del motor de AUDIOLIBROS COMPLETOS.
#
# Narra libros enteros de dominio público (Capa 1) y deja el mp3 en R2, para que se
# puedan escuchar en la ficha sin depender de YouTube. La subida a YouTube va por su
# propio carril (6 por día de cuota) y no bloquea esto: acá se narra con
# SKIP_YOUTUBE=1 y después el motor diario los sube por orden de demanda.
#
# Un libro completo son ~5 h de audio y ~40 min de generación, así que en la ventana
# del job entran pocos: por eso el reparto en sesiones paralelas.
#
# Variables: SHARD, SHARDS, PATCH_OUT, MOTOR_MIN.
set -uo pipefail

MOTOR_MIN="${MOTOR_MIN:-290}"
PATCH_OUT="${PATCH_OUT:-parche-audio.json}"
SHARD="${SHARD:-0}"
SHARDS="${SHARDS:-1}"
VOZ="${VOZ:-nova}"

export PATCH_OUT
export SKIP_YOUTUBE=1

echo "▶ Audiolibros · sesión $((SHARD + 1)) de $SHARDS · hasta $MOTOR_MIN min · voz $VOZ"
echo "[]" > "$PATCH_OUT"

# La lista se pide UNA vez: es el reparto de esta sesión. Pedirla de nuevo en cada
# vuelta no serviría, porque los cambios viven en la base local del job y el orden
# es el mismo.
SLUGS="$(SHARD="$SHARD" SHARDS="$SHARDS" npx tsx scripts/list-narratable.ts 200)"
if [ -z "$SLUGS" ]; then
  echo "✓ Esta sesión no tiene libros pendientes."
  exit 0
fi

limite=$(( MOTOR_MIN * 60 ))
hechos=0
saltados=0
fallos=0

for slug in $SLUGS; do
  if [ "$SECONDS" -ge "$limite" ]; then
    echo "⏱  Se acabó el presupuesto de tiempo."
    break
  fi

  echo ""
  echo "▶ $slug  ($((SECONDS / 60))/$MOTOR_MIN min)"
  npx tsx scripts/narrate-and-upload.ts "$slug" "$VOZ"
  code=$?

  if [ "$code" -eq 0 ]; then
    hechos=$(( hechos + 1 )); fallos=0
    echo "   ✓ $hechos narrado(s)"
  elif [ "$code" -eq 2 ]; then
    # Salida 2 = el libro es gigante y se saltea a propósito (Quijote, Shakespeare
    # completo): tardaría horas y daría un archivo enorme. No es un fallo.
    saltados=$(( saltados + 1 )); fallos=0
    echo "   ⏭️  salteado por tamaño"
  else
    fallos=$(( fallos + 1 ))
    echo "   ✗ falló ($fallos/3)"
    [ "$fallos" -ge 3 ] && { echo "✗ Tres fallos seguidos: corto y conservo el parche."; break; }
  fi
done

echo ""
echo "✓ Sesión $((SHARD + 1)): $hechos narrado(s) · $saltados salteado(s) por tamaño."
