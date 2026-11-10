#!/bin/bash
# W29 (plan de rendimiento, bitácora §239): la memoria del wasm de tamaño fijo, piloto chico.
#
# Resumen: dos programas iguales salvo la memoria. base = crece desde 320 MB (como hoy); fija = 1024 MB que no crecen
# (compilar-web.py --memoria-fija). Se prueba que la fija arranca y corre igual, y se miden intercalados en el tramo
# fijo de §163 con la revisión de límites de Android (gama baja simulada) y en este PC como control.
# Uso:  bash herramientas/tanda-w29.sh compilar igual medir
#   compilar = build/web-w29-base y build/web-w29-fija (navegador; sin --final ni PGO; semillas de build/web-w19)
#   igual    = prueba-navegador con la fija y prueba-fantasma-igual base contra fija
#   medir    = pares base/fija intercalados: gama baja con límites y este PC (W29_PARES, por omisión 2)
cd "$(dirname "$0")/.."
QUIEN="w29 (local_cb5459c6 hija)"; source herramientas/candado.sh
FIJA_MB=${W29_MB:-1024}
DATOS=build/web/datos/w29; mkdir -p $DATOS
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=3.5"   # la del encargo (calibrada contra el Oppo, ≈1,7 de lastre en el tramo fijo, ver commit d076ff8)
tomar() { candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; }
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

compilar() {
  tomar "w29 compilar"
  for v in base fija; do
    extra=""; [ $v = fija ] && extra="--memoria-fija $FIJA_MB"
    paso "navegador → build/web-w29-$v $extra"
    motor timeout 5400 python herramientas/compilar-web.py --modo navegador $extra --carpeta build/web-w29-$v > $DATOS/compilar-$v.log 2>&1
    echo "$v: salida $?"; tail -2 $DATOS/compilar-$v.log
    for f in pipelines.bin bloques.json; do cp -f build/web-w19/navegador/$f build/web-w29-$v/navegador/ 2>/dev/null; done
    [ -d build/web-w19/navegador/imagenes ] && cp -rf build/web-w19/navegador/imagenes build/web-w29-$v/navegador/
    node herramientas/comprimir-build.mjs build/web-w29-$v/navegador > /dev/null 2>&1 || true
  done
  ls -la build/web-w29-*/navegador/mkw.wasm
}

igual() {
  tomar "w29 igual"
  paso "prueba-navegador con la fija"
  MKW_BUILD=build/web-w29-fija/navegador timeout 1500 node web/navegador/prueba-navegador.mjs 1800 > $DATOS/prueba-navegador-fija.txt 2>&1
  tail -6 $DATOS/prueba-navegador-fija.txt
  paso "fantasma igual: base contra fija"
  MKW_BUILD=build/web-w29-base/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=build/web-w29-fija/navegador > $DATOS/fantasma-igual.txt 2>&1
  tail -6 $DATOS/fantasma-igual.txt
}

tramo() {   # $1 etiqueta, $2 programa, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_VENTANA=-1880,549 MKW_BUILD=$2/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8177 --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$3" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}

medir() {
  tomar "w29 medir"
  for p in $(seq 1 ${W29_PARES:-2}); do
    paso "par $p"
    if [ $((p % 2)) = 1 ]; then A=base; B=fija; else A=fija; B=base; fi
    tramo baja-$A-$p build/web-w29-$A "$GAMA_BAJA" "$LIMITES"; tramo baja-$B-$p build/web-w29-$B "$GAMA_BAJA" "$LIMITES"
    tramo pc-$A-$p build/web-w29-$A "" ""; tramo pc-$B-$p build/web-w29-$B "" ""
    candado_hueco
  done
}

for f in "$@"; do $f; done
