#!/bin/bash
# W19 de la etapa 0 del plan v4 (bitácora §195): el índice del memo de las llamadas indirectas (KartPad 20ad85d).
#
# Resumen: el memo que recuerda adónde fue cada llamada indirecta (bctrl) elegía su casillero con los bits BAJOS del
# hash de Fibonacci, que son los que peor se reparten; ahora con los ALTOS (terceros/Wiicompiled-motor,
# runtime/include/guest_abi/dispatch.h, interruptor MKW_MOTOR_MEMO_ALTO). Esta tanda compila el programa con el arreglo
# (build/web-w19: la base nueva de la etapa 0, M1 + los anillos + W19), lo prueba contra la base de antes
# (build/web-m1: la misma copia del motor sin W19) y mide los dos intercalados.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w19.sh compilar probar igual medir chrome
#   compilar = node y navegador → build/web-w19 (con las semillas e imágenes de build/web-m1/navegador)
#   probar   = prueba-arranque en Node
#   igual    = la sala con un programa en cada consola (huellas 75/75) y los fantasmas cuadro por cuadro
#   medir    = el tramo fijo en Node, base contra W19, intercalados (6 vueltas, --fijo)
#   chrome   = el tramo fijo en Chrome: este PC (sin bandera) y la gama baja con la revisión de límites (W5), 3 vueltas
cd "$(dirname "$0")/.."
QUIEN="e0-w19 (local_f84b9b29)"; source herramientas/candado.sh
BASE=${W19_BASE:-build/web-m1}
SAL=${W19_SAL:-build/web-w19}
DATOS=build/web/datos/w19
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

compilar() {
  tomar "w19 compilar"
  paso "el programa de Node → $SAL/node"
  motor timeout 5400 python herramientas/compilar-web.py --carpeta $SAL > $DATOS/compilar-node.log 2>&1
  echo "node: salida $?"; tail -2 $DATOS/compilar-node.log
  paso "el programa del navegador → $SAL/navegador"
  motor timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar-navegador.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar-navegador.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $BASE/navegador/mkw.wasm $SAL/navegador/mkw.wasm
}

probar() {
  tomar "w19 probar"
  paso "prueba-arranque con $SAL/node"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4
}

igual() {
  tomar "w19 igual"
  paso "la sala: A = W19, B = la base (la huella toda la carrera)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8177 \
    --datos=$DATOS/sincro --build-b=$BASE/navegador 2>&1 | tail -20
  paso "los fantasmas, cuadro por cuadro: A = W19, B = la base"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
    --puerto 8177 2>&1 | tail -12
}

medir() {
  tomar "w19 medir"
  paso "el tramo fijo en Node: $BASE contra $SAL, intercalados (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 15 --etiqueta w19 \
    --intercalar antes=$BASE/node,despues=$SAL/node 2>&1 | tail -15
}

tramo() {   # $1 programa, $2 etiqueta, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8177 --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$3" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}

chrome() {
  tomar "w19 chrome"
  for v in 1 2 3; do
    paso "vuelta $v: este PC y la gama baja (con la revisión de límites), base y W19"
    if [ $((v % 2)) = 1 ]; then
      tramo $BASE w19-pc-base-$v "" ""; tramo $SAL w19-pc-w19-$v "" ""
      tramo $SAL w19-baja-w19-$v "$GAMA_BAJA" "$LIMITES"; tramo $BASE w19-baja-base-$v "$GAMA_BAJA" "$LIMITES"
    else
      tramo $SAL w19-pc-w19-$v "" ""; tramo $BASE w19-pc-base-$v "" ""
      tramo $BASE w19-baja-base-$v "$GAMA_BAJA" "$LIMITES"; tramo $SAL w19-baja-w19-$v "$GAMA_BAJA" "$LIMITES"
    fi
  done
}

[ $# -eq 0 ] && { sed -n 2,16p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; probar) probar ;; igual) igual ;; medir) medir ;; chrome) chrome ;;
    *) sed -n 2,16p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
