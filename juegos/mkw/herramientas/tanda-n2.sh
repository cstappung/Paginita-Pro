#!/bin/bash
# N2 de la etapa 0 del plan v4 (bitácora §201): la escalera de aparatos otra vez, con la base de la etapa 0 y con lo
# que el teléfono paga de verdad (W5: la revisión de límites de Android).
#
# Resumen: los mismos escalones de §163/§164 (este PC, PC típico, portátil, gama media, gama baja), el tramo fijo con la
# tarjeta medida por sus marcas de tiempo (perfilGpu=1, sin el redondeo de Chrome), 2 corridas cada uno, con
# build/web-w19 (M1 + los anillos + W19). Los dos teléfonos (gama media y baja) van con
# --js-flags=--wasm-enforce-bounds-checks (Chrome de Android no tiene las páginas de guarda); los PC sin la bandera.
# Toma build/medicion.lock (herramientas/candado.sh). Resultados en build/web/datos/escalera/ (n2-*).
# Uso:  bash herramientas/tanda-n2.sh escalera
# §241: N2_BUILD = otro programa, N2_PREFIJO = otro nombre de las etiquetas (n2 por omisión), N2_OPPO=1 = un sexto
# escalón, el teléfono del dueño (lastre 1,7 con la revisión de límites: lo que midió el Oppo por USB, docs/telefono-seguro.md)
cd "$(dirname "$0")/.."
QUIEN=${N2_QUIEN:-"e0-n2 (local_f84b9b29)"}; source herramientas/candado.sh
BUILD=${N2_BUILD:-build/web-w19}
DATOS=build/web/datos/escalera
mkdir -p "$DATOS"
PUERTO=8185
SIN_REDONDEO="--disable-dawn-features=timestamp_quantization"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

tramo() {   # $1 etiqueta, $2 lastre, $3 núcleos (vacío = todos), $4 banderas de Chrome
  local nucleos=(); [ -n "$3" ] && nucleos=(--nucleos "$3")
  MKW_BUILD=$BUILD/navegador timeout 1200 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 "${nucleos[@]}" --puerto $PUERTO --etiqueta "$1" --chrome "$4" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0&perfilGpu=1$2" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
  grep -o 'tarjeta en el tramo (§164).*' $DATOS/$1.txt | head -1
}

escalera() {
  tomar "n2 escalera"
  for v in 1 2; do
    paso "vuelta $v: los cinco escalones"
    local e=${N2_PREFIJO:-n2}
    tramo $e-pc-$v "" "" "$SIN_REDONDEO"
    tramo $e-tipico-$v "&lastre=2.2" 8 "$SIN_REDONDEO"
    tramo $e-portatil-$v "&lastre=3&ladron=64" 4 "$SIN_REDONDEO"
    [ "$N2_OPPO" = 1 ] && tramo $e-oppo-$v "&lastre=1.7" 8 "$SIN_REDONDEO $LIMITES"
    tramo $e-media-$v "&lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6" 8 "$SIN_REDONDEO $LIMITES"
    tramo $e-baja-$v "&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15" 8 "$SIN_REDONDEO $LIMITES"
    candado_hueco "sigue"; tomar "n2 escalera"
  done
}

[ $# -eq 0 ] && { sed -n 2,10p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    escalera) escalera ;;
    *) sed -n 2,10p "$0"; exit 1 ;;
  esac
done
