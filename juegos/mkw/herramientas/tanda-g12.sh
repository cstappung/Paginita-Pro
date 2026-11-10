#!/usr/bin/env bash
# G12 (§253): las texturas más chicas — aurora salta los niveles de detalle más grandes al subir cada textura con mips
# (?texturasMenos=1 la mitad, =2 un cuarto; 0 = completas, lo de omisión). Solo toca el dibujo.
#   compilar = el programa con la aurora de G12 (build/web-g12; semillas de build/web-w19)
#   fotos    = la Contrarreloj contra el experto con 1 y 2 contra 0 (prueba-foto-igual: cuánto cambia la imagen)
#   memoria  = 4 pistas en una pestaña con 0 y con 2 (medir-memoria-pistas: la tarjeta, las texturas)
#   medir    = el tramo fijo §163 con la tarjeta (?perfilGpu=1), 0 contra 2, en este PC y en la gama baja, 2 pares
#   igual    = la sala con 0 y 2 (huellas), la sala con dos programas (g11 contra g12), el fantasma igual
# Uso: bash herramientas/tanda-g12.sh compilar fotos memoria medir igual   → build/web/datos/g12/
cd "$(dirname "$0")/.."
QUIEN="e7-g12 (local_cb5459c6)"; source herramientas/candado.sh
BASE=build/web-w19; ANTES=${G12_ANTES:-build/web-g11}; SAL=${G12_SAL:-build/web-g12}; DATOS=build/web/datos/g12; mkdir -p $DATOS
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
TRAMO="&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&perfilGpu=1"
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  compilar)
    candado_tomar "g12 compilar" 21600 || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 \
      python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar.log 2>&1
    sal=$?; echo "compilar: salida $sal"; tail -2 $DATOS/compilar.log
    [ $sal = 0 ] || { grep -m3 "error" $DATOS/compilar.log; exit 1; }
    for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
    [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
    node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
    candado_soltar ;;
  fotos)
    candado_tomar "g12 fotos" 21600 || exit 1
    for k in 1 2; do
      MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-foto-igual.mjs --ventana --puerto 8183 \
        --extra-b="&texturasMenos=$k" > $DATOS/fotos-$k.txt 2>&1
      echo "== texturas $k: salida $?"; grep -E "✓|✗" $DATOS/fotos-$k.txt | cut -c1-220
      mkdir -p $DATOS/fotos-$k; cp -f build/web/datos/foto-igual/*-600.png build/web/datos/foto-igual/*-1500.png $DATOS/fotos-$k/ 2>/dev/null
      candado_hueco
    done
    candado_soltar ;;
  memoria)
    candado_tomar "g12 memoria" 21600 || exit 1
    for k in 0 2; do
      MKW_BUILD=$SAL/navegador timeout 2400 node herramientas/medir-memoria-pistas.mjs --pistas 0.0,1.1,2.2,3.3 \
        --extra "&texturasMenos=$k" --etiqueta g12-k$k > $DATOS/memoria-k$k.txt 2>&1
      echo "== memoria texturas $k: salida $?"; tail -12 $DATOS/memoria-k$k.txt | cut -c1-250
    done
    candado_soltar ;;
  medir)
    candado_tomar "g12 medir" 21600 || exit 1
    for par in 1 2; do for x in "pc:" "baja:$BAJA"; do for k in 0 2; do n=${x%%:*}; e=${x#*:}
      MKW_BUILD=$SAL/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 --ventana \
        --piloto-espera 600 --nucleos 8 --puerto 8183 --etiqueta g12-$n-k$k-p$par --chrome "$LIMITES --disable-dawn-features=timestamp_quantization" \
        --extra "$TRAMO$e&texturasMenos=$k" > $DATOS/medir-$n-k$k-p$par.txt 2>&1
      echo "== $n texturas $k par $par: salida $?"; grep -E "tramo|tarjeta en el tramo" $DATOS/medir-$n-k$k-p$par.txt | head -3 | cut -c1-300
    done; done; candado_hueco; done
    candado_soltar ;;
  igual)
    candado_tomar "g12 igual" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8183 \
      --extra-b="&texturasMenos=2" > $DATOS/igual-sala-k2.txt 2>&1
    echo "== sala 0 contra 2: salida $?"; grep -E "✓|✗|puntos" $DATOS/igual-sala-k2.txt | tail -6 | cut -c1-200
    MKW_BUILD=$ANTES/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8183 \
      --build-b=$SAL/navegador > $DATOS/igual-sala-dos.txt 2>&1
    echo "== sala antes contra g12: salida $?"; grep -E "✓|✗|puntos" $DATOS/igual-sala-dos.txt | tail -6 | cut -c1-200
    MKW_BUILD=$ANTES/navegador timeout 2400 node web/navegador/prueba-fantasma-igual.mjs --ventana --build-b=$SAL/navegador \
      --extra-b="&texturasMenos=2" > $DATOS/igual-fantasma.txt 2>&1
    echo "== fantasma (g12 con 2): salida $?"; grep -E "✓|✗" $DATOS/igual-fantasma.txt | tail -6 | cut -c1-200
    MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-navegador.mjs 1800 --puerto 8183 --datos $DATOS/nav > $DATOS/igual-navegador.txt 2>&1
    echo "== arranque: salida $?"; grep -E "✗|puntos|de 2" $DATOS/igual-navegador.txt | tail -4 | cut -c1-200
    candado_soltar ;;
esac; done
