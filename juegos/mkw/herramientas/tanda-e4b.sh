#!/bin/bash
# E4b del plan v4 (bitácora §224–): W22 (el dibujo retenido), W21 (el aislamiento por service worker), W23 (call_ref).
#
# Resumen: cada apuesta empieza con su prueba barata y sigue solo si promete. Esta tanda junta las mediciones, cada fase
# con el candado de medición (herramientas/candado.sh, QUIEN=e4b); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-e4b.sh <fases…>
#   censo       = W22: el tramo fijo (§163) en este PC con ?censoGpu=1 (censo-gpu.mjs): la ráfaga de cada imagen, las
#                 llamadas a WebGPU por método, cuántas se repiten iguales y el ensayo (completo / sin constantes /
#                 render bundles / subidas). Sin lastre: la proporción vale igual en la gama baja (el lastre estira todo
#                 el hilo por igual)
#   censo-baja  = lo mismo en la gama baja simulada (con la revisión de límites de Android): la ráfaga real ahí
#   callref     = W23: la prueba chica de call_ref contra call_indirect (sin el juego), en Node y Chrome (con y sin la
#                 revisión de límites), dos veces
#   aislar      = W21: herramientas/prueba-aislar-sw.mjs (el sitio local con el marco del juego aislado por el service
#                 worker sw-aislar.js) con ?aislar=sw y con ?aislar=sw-corp
#   aislar-medir = W21: el tramo fijo aislado (&aislar=sw) contra sin aislar, en este PC y en la gama baja (un par
#                 de cada uno, intercalados: ¿cuesta o gana algo estar en el proceso propio?)
#   base        = el tramo sin censo en este PC y en la gama baja (para comparar la ráfaga con el trabajo por cuadro)
# Variables: E4B_BUILD (build/web-e2w10), E4B_PUERTO (8186)
cd "$(dirname "$0")/.."
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
QUIEN="e4b (local_cb5459c6)"; source herramientas/candado.sh
BUILD=${E4B_BUILD:-build/web-e2w10}
DATOS=build/web/datos/e4b
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
PUERTO=${E4B_PUERTO:-8186}
TRAMO="&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0&dibujarSiempre=1&n8=0"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

tramo() {   # $1 etiqueta, $2 extra, $3 banderas de Chrome
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$BUILD/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta "$1" "${chrome[@]}" \
    --extra "$TRAMO$2" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
  grep -o 'censo (§224).*' $DATOS/$1.txt | head -1
}

censo() {
  tomar "e4b censo"
  paso "W22: el censo de las llamadas a WebGPU en este PC (dos corridas)"
  tramo e4b-censo-pc-1 "&censoGpu=1"
  tramo e4b-censo-pc-2 "&censoGpu=1"
}
censo_baja() {
  tomar "e4b censo-baja"
  paso "W22: el censo en la gama baja simulada"
  tramo e4b-censo-baja-1 "$GAMA_BAJA&censoGpu=1" "$LIMITES"
}
callref() {
  tomar "e4b callref"
  paso "W23: call_ref contra call_indirect, la prueba chica (dos veces)"
  python -I herramientas/micro-indirectas/generar-callref.py
  for k in 1 2; do timeout 900 node herramientas/micro-indirectas/correr-callref.mjs --chrome --limites > $DATOS/callref-$k.txt 2>&1; cat $DATOS/callref-$k.txt; done
}
aislar() {
  tomar "e4b aislar"
  paso "W21: el marco del juego aislado por un service worker, en el sitio local"
  for m in sw sw-corp; do MKW_BUILD=$BUILD/navegador timeout 900 node herramientas/prueba-aislar-sw.mjs --ventana --modo $m --puerto $PUERTO > $DATOS/aislar-$m.txt 2>&1; echo "-- $m"; cat $DATOS/aislar-$m.txt; done
}
aislar_medir() {
  tomar "e4b aislar-medir"
  paso "W21: el tramo aislado contra sin aislar"
  tramo e4b-ais-pc-base "" ; tramo e4b-ais-pc-sw "&aislar=sw"
  tramo e4b-ais-baja-sw "$GAMA_BAJA&aislar=sw" "$LIMITES" ; tramo e4b-ais-baja-base "$GAMA_BAJA" "$LIMITES"
}
base() {
  tomar "e4b base"
  paso "el tramo sin censo: este PC y la gama baja"
  tramo e4b-base-pc-1 ""
  tramo e4b-base-baja-1 "$GAMA_BAJA" "$LIMITES"
}

[ $# -eq 0 ] && { sed -n 2,16p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    censo) censo ;; censo-baja) censo_baja ;; base) base ;; callref) callref ;; aislar) aislar ;; aislar-medir) aislar_medir ;;
    *) sed -n 2,16p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
