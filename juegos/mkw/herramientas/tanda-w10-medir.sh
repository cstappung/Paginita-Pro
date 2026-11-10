#!/usr/bin/env bash
# W10 parte B (§240): ¿cuánto gana el par? El tramo fijo §163 (12 CPU, semilla fija, sin tope) en w10-dos.html:
#   base = solo A (el juego de siempre en un Worker, dibuja él mismo; programa $BASE)
#   par  = A sin dibujo ni presentar (modo 9) + B dibujando con las cajas (programa $SAL)
# en la gama baja simulada de la etapa 7 (lastre 3.5, ayuda 3, ladrón 64, tarjeta 6, revisión de límites de Android),
# en el «Oppo» (lastre 1.7) y en este PC, intercalados (base, par, par, base…) con el candado.
# Uso: bash herramientas/tanda-w10-medir.sh [vueltas]   → build/web/datos/w10/medir-<aparato>-<cual>-<vuelta>.txt
cd "$(dirname "$0")/.."
QUIEN="e7-w10b (local_cb5459c6)"; source herramientas/candado.sh
BASE=${W10_BASE:-build/web-w19}; SAL=${W10_SAL:-build/web-w10d}; DATOS=build/web/datos/w10
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"; OPPO="&lastre=1.7&lastreAyuda=1.5&ladron=32&lastreGpu=3"
VUELTAS=${1:-2}
candado_tomar "w10b medir" 21600 || exit 1; trap candado_soltar EXIT
uno() {   # $1 aparato, $2 cual, $3 vuelta
  local extra="" ch=(); case $1 in baja) extra=$BAJA; ch=(--chrome "$LIMITES");; oppo) extra=$OPPO; ch=(--chrome "$LIMITES");; esac
  local prog=$SAL sa=(); [ $2 = base ] && { prog=$BASE; sa=(--solo-a); }
  MKW_VENTANA=-1880,549 MKW_BUILD=$prog/navegador timeout 2400 node web/navegador/prueba-w10-dos.mjs --solo-medir "${sa[@]}" --ventana \
    --extra "$extra" "${ch[@]}" > $DATOS/medir-$1-$2-$3.txt 2>&1
  echo "$1 $2 v$3: $(grep -E 'A: ' $DATOS/medir-$1-$2-$3.txt | head -1)"
}
for v in $(seq 1 $VUELTAS); do
  for ap in baja oppo pc; do
    if [ $((v % 2)) = 1 ]; then uno $ap base $v; uno $ap par $v; else uno $ap par $v; uno $ap base $v; fi
  done
  candado_hueco "sigue"
done
