#!/usr/bin/env bash
# V8 (§249): ¿en qué se va el lado CPU del dibujo? Un perfil de CPU de la carrera en el tramo fijo §163 (12 CPU, semilla
# fija, sin tope) con la revisión de límites de Android, en este PC y con el lastre de la gama baja, repartido con
# herramientas/reparto-dibujo.mjs (la lógica contra el dibujo, y el dibujo por partes).
# Uso: bash herramientas/tanda-v8.sh [programa]   → build/web/datos/medir-sitio/v8-*.cpuprofile y -reparto-dibujo.json
cd "$(dirname "$0")/.."
QUIEN="e7-v8 (local_cb5459c6)"; source herramientas/candado.sh
PROG=${1:-build/web-w26}; DATOS=build/web/datos/medir-sitio
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
candado_tomar "v8 perfil" 21600 || exit 1; trap candado_soltar EXIT
for x in "pc:" "baja:&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"; do n=${x%%:*}; e=${x#*:}
  MKW_BUILD=$PROG/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 --ventana \
    --piloto-espera 600 --nucleos 8 --puerto 8183 --etiqueta v8-$n --perfilar --chrome "$LIMITES" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$e" > $DATOS/v8-$n.txt 2>&1
  echo "== $n: salida $?"; grep -E "tramo|lógica/s|cuadros de lógica" $DATOS/v8-$n.txt | head -3 | cut -c1-250
  f=$(ls -t $DATOS/v8-$n-*.cpuprofile 2>/dev/null | head -1)
  [ -n "$f" ] && node herramientas/reparto-dibujo.mjs "$f" --top 40
done
