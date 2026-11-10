#!/bin/bash
# W2 de la etapa 0 del plan v4 (bitácora §199): la primera isla decompilada, KCLController::IsCollidingImpl (0x807C0884).
#
# Resumen: la consulta de choque contra la pista (KCL) es ~6,6 % de la lógica. La isla es la misma función escrita de
# nuevo sobre la del traductor (herramientas/islas/generar-kcl.py la arma en terceros/islas/, ignorada por git: es código
# derivado del de Nintendo), pero leyendo la pista desde una «sombra» ya dada vuelta (sin cambiar el orden de los bytes
# en cada lectura) y con la pila y el controlador en variables propias. web/juego/isla_kcl_nativo.cpp elige en cada
# llamada: 0 = la traducida, 1 = la isla, 2 = el comprobador (las dos, compara todo lo que sale y mide cada una).
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w2.sh generar compilar comparar medir igual chrome pistas
#   generar  = herramientas/islas/generar-kcl.py → terceros/islas/kcl_807C0884.inc
#   compilar = node y navegador con MKW_ISLA_COMPILAR=1 → build/web-w2 (semillas e imágenes de build/web-w19)
#   comparar = Node, el comprobador (MKW_ISLA=2) toda la carrera: 0 distintas y los ns de cada una
#   medir    = el tramo fijo en Node, isla 0 contra 1 con el mismo programa, intercalados (6 vueltas, --fijo)
#   igual    = la sala (B con ?isla=1, huellas toda la carrera) y los fantasmas cuadro por cuadro (B con ?isla=1)
#   chrome   = el tramo fijo en Chrome, gama baja (con la revisión de límites, W5) y este PC, isla 0 contra 1, 3 vueltas
#   pistas   = el comprobador en Chrome en 3 pistas más (prueba-sincro con ?isla=2 en las dos pestañas)
cd "$(dirname "$0")/.."
QUIEN="e0-w2 (local_f84b9b29)"; source herramientas/candado.sh
BASE=${W2_BASE:-build/web-w19}
SAL=${W2_SAL:-build/web-w2}
DATOS=build/web/datos/w2
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
PUERTO=8180

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

generar() {
  paso "la isla: generar-kcl.py → terceros/islas/kcl_807C0884.inc"
  MKW_WIICOMPILED=terceros/Wiicompiled-motor python -I herramientas/islas/generar-kcl.py 2>&1 | tail -4
}

compilar() {
  tomar "w2 compilar"
  paso "el programa de Node con la isla → $SAL/node"
  MKW_ISLA_COMPILAR=1 motor timeout 5400 python herramientas/compilar-web.py --carpeta $SAL > $DATOS/compilar-node.log 2>&1
  echo "node: salida $?"; tail -2 $DATOS/compilar-node.log
  paso "el programa del navegador con la isla → $SAL/navegador"
  MKW_ISLA_COMPILAR=1 motor timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar-navegador.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar-navegador.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $BASE/navegador/mkw.wasm $SAL/navegador/mkw.wasm
}

comparar() {
  tomar "w2 comparar"
  paso "Node, el comprobador (MKW_ISLA=2) en la carrera del guion-170, 6000 cuadros"
  MKW_ISLA=2 timeout 3600 node herramientas/correr-guion.mjs --build $SAL/node --cuadros 6000 \
    --log $DATOS/comparar.log 2>&1 | tail -8
  grep '\[isla\]' $DATOS/comparar.log | tail -6
  paso "Node, la isla sola (MKW_ISLA=1): arranca y llega"
  MKW_ISLA=1 timeout 3600 node herramientas/correr-guion.mjs --build $SAL/node --cuadros 6000 \
    --log $DATOS/isla1.log 2>&1 | tail -4
}

medir() {
  tomar "w2 medir"
  paso "el tramo fijo en Node: el mismo programa con la traducida (0) y con la isla (1), intercalados (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 15 --etiqueta w2 \
    --intercalar "traducida=$SAL/node@MKW_ISLA=0,isla=$SAL/node@MKW_ISLA=1" 2>&1 | tail -15
}

igual() {
  tomar "w2 igual"
  paso "la sala: A con la traducida, B con la isla (la huella toda la carrera)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=$PUERTO \
    --datos=$DATOS/sincro "--extra-a=&isla=0" "--extra-b=&isla=1" 2>&1 | tail -20
  for cf in "0 0" "13 2"; do
    set -- $cf
    paso "los fantasmas, copa $1 fila $2: A con la traducida, B con la isla"
    MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
      --copa $1 --fila $2 --puerto $PUERTO "--extra-a=&isla=0" "--extra-b=&isla=1" 2>&1 | tail -10
  done
}

tramo() {   # $1 etiqueta, $2 extra, $3 banderas de Chrome
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$2" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}

chrome() {
  tomar "w2 chrome"
  for v in 1 2 3; do
    paso "vuelta $v: la gama baja (con la revisión de límites) y este PC, traducida e isla"
    if [ $((v % 2)) = 1 ]; then
      tramo w2-baja-0-$v "$GAMA_BAJA&isla=0" "$LIMITES"; tramo w2-baja-1-$v "$GAMA_BAJA&isla=1" "$LIMITES"
      tramo w2-pc-0-$v "&isla=0" ""; tramo w2-pc-1-$v "&isla=1" ""
    else
      tramo w2-baja-1-$v "$GAMA_BAJA&isla=1" "$LIMITES"; tramo w2-baja-0-$v "$GAMA_BAJA&isla=0" "$LIMITES"
      tramo w2-pc-1-$v "&isla=1" ""; tramo w2-pc-0-$v "&isla=0" ""
    fi
  done
}

pistas() {
  tomar "w2 pistas"
  for p in 13.2 30.2 50.2; do
    paso "el comprobador en Chrome, pista $p (las dos pestañas con ?isla=2)"
    MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=$PUERTO \
      --datos=$DATOS/sincro-$p --pistas=$p --semilla=1234 "--extra=&isla=2" 2>&1 | grep -E 'isla|✓|✗' | tail -8
  done
}

[ $# -eq 0 ] && { sed -n 2,18p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    generar) generar ;; compilar) compilar ;; comparar) comparar ;; medir) medir ;; igual) igual ;; chrome) chrome ;;
    pistas) pistas ;;
    *) sed -n 2,18p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
