#!/bin/bash
# W5 de la etapa 0 del plan v4 (bitácora §194): la simulación del teléfono paga la revisión de límites de Android.
#
# Resumen: Chrome en Android no tiene «páginas de guarda» para wasm y revisa los límites de la memoria en cada acceso;
# este PC no lo paga. La bandera de V8 --wasm-enforce-bounds-checks hace que este PC lo pague como un teléfono. Aquí se
# mide la escalera de los escalones de teléfono (gama media y gama baja simuladas, el tramo fijo de §163) con y sin la
# bandera, 3 vueltas alternadas, y este PC como control; y el tramo fijo en Node con y sin la bandera.
# Cada fase toma build/medicion.lock (herramientas/candado.sh) y lo suelta al terminar.
# Uso:  bash herramientas/tanda-w5.sh chrome node
#   chrome = el tramo fijo en Chrome: por vuelta, media sin/con, baja con/sin y este PC sin/con (orden alternado)
#   node   = el tramo fijo en Node (medir-node-estable --fijo), 3 pares sin/con la bandera
# Variables: W5_BUILD = el programa (por omisión build/web-m1, la base del paso 6), W5_VUELTAS = 3
cd "$(dirname "$0")/.."
QUIEN="e0-w5 (local_f84b9b29)"; source herramientas/candado.sh
BUILD=${W5_BUILD:-build/web-m1}
VUELTAS=${W5_VUELTAS:-3}
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_MEDIA="&lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6"    # la de §163
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"    # la de §163 y §170.2
mkdir -p build/web/datos/w5

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

# el tramo fijo de §163 en Chrome; $1 = etiqueta, $2 = el lastre del escalón (o nada), $3 = banderas de Chrome (o nada)
tramo() {
  local chrome=()
  [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$BUILD/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8176 --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$2" \
    > build/web/datos/w5/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' build/web/datos/w5/$1.txt | head -1)"
}

chrome() {
  tomar "w5 chrome"
  for v in $(seq 1 $VUELTAS); do
    paso "vuelta $v: gama media, gama baja y este PC, sin y con la revisión de límites"
    if [ $((v % 2)) = 1 ]; then
      tramo w5-media-sin-$v "$GAMA_MEDIA" ""; tramo w5-media-con-$v "$GAMA_MEDIA" "$LIMITES"
      tramo w5-baja-con-$v "$GAMA_BAJA" "$LIMITES"; tramo w5-baja-sin-$v "$GAMA_BAJA" ""
      tramo w5-pc-sin-$v "" ""; tramo w5-pc-con-$v "" "$LIMITES"
    else
      tramo w5-media-con-$v "$GAMA_MEDIA" "$LIMITES"; tramo w5-media-sin-$v "$GAMA_MEDIA" ""
      tramo w5-baja-sin-$v "$GAMA_BAJA" ""; tramo w5-baja-con-$v "$GAMA_BAJA" "$LIMITES"
      tramo w5-pc-con-$v "" "$LIMITES"; tramo w5-pc-sin-$v "" ""
    fi
  done
}

node_() {
  tomar "w5 node"
  for v in $(seq 1 $VUELTAS); do
    paso "vuelta $v: Node, sin y con la revisión de límites"
    MKW_BUILD_NODE=$BUILD/node timeout 1200 node herramientas/medir-node-estable.mjs --fijo --corridas 1 --tope-min 15 \
      --etiqueta w5-node-sin-$v > build/web/datos/w5/w5-node-sin-$v.txt 2>&1
    MKW_BUILD_NODE=$BUILD/node timeout 1200 node herramientas/medir-node-estable.mjs --fijo --corridas 1 --tope-min 15 \
      --v8 "--wasm-enforce-bounds-checks" --etiqueta w5-node-con-$v > build/web/datos/w5/w5-node-con-$v.txt 2>&1
    tail -3 build/web/datos/w5/w5-node-sin-$v.txt; tail -3 build/web/datos/w5/w5-node-con-$v.txt
  done
}

[ $# -eq 0 ] && { sed -n 2,14p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    chrome) chrome ;;
    node) node_ ;;
    *) sed -n 2,14p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
