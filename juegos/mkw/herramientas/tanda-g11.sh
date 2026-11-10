#!/usr/bin/env bash
# G11 (§252): los gráficos opcionales — quitar el brillo (bloom), la profundidad de campo, las sombras por volumen y el
# mapa de luz (máscara ?quitarEfectos=1|2|4|8, sumables; 0 = todo, lo de omisión). Solo toca el dibujo.
#   compilar = el programa con graficos_nativo.cpp (build/web-g11; semillas de build/web-w19)
#   fotos    = la Contrarreloj contra el experto con cada bit contra 0 (prueba-foto-igual: cuánto cambia la imagen)
#   medir    = el tramo fijo §163 con la tarjeta (?perfilGpu=1), 0 contra 15, en este PC y en la gama baja, 2 pares
#   igual    = la sala con 0 y 15 (huellas), la sala con dos programas (w26 contra g11), el fantasma igual
# Uso: bash herramientas/tanda-g11.sh compilar fotos medir igual   → build/web/datos/g11/
cd "$(dirname "$0")/.."
QUIEN="e7-g11 (local_cb5459c6)"; source herramientas/candado.sh
BASE=build/web-w19; SAL=${G11_SAL:-build/web-g11}; DATOS=build/web/datos/g11; mkdir -p $DATOS
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
TRAMO="&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&perfilGpu=1"
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  compilar)
    candado_tomar "g11 compilar" 21600 || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 \
      python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar.log 2>&1
    sal=$?; echo "compilar: salida $sal"; tail -2 $DATOS/compilar.log
    [ $sal = 0 ] || { grep -m3 "error" $DATOS/compilar.log; exit 1; }
    for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
    [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
    node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
    candado_soltar ;;
  fotos)
    candado_tomar "g11 fotos" 21600 || exit 1
    for m in ${G11_MASCARAS:-1 2 4 8 15}; do
      MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-foto-igual.mjs --ventana --puerto 8183 \
        --extra-b="&quitarEfectos=$m" > $DATOS/fotos-$m.txt 2>&1
      echo "== quitar $m: salida $?"; grep -E "✓|✗" $DATOS/fotos-$m.txt | cut -c1-220
      mkdir -p $DATOS/fotos-$m; cp -f build/web/datos/foto-igual/*.png $DATOS/fotos-$m/ 2>/dev/null
      candado_hueco
    done
    candado_soltar ;;
  medir)
    candado_tomar "g11 medir" 21600 || exit 1
    for par in 1 2; do for x in "pc:" "baja:$BAJA"; do for m in 0 15; do n=${x%%:*}; e=${x#*:}
      MKW_BUILD=$SAL/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 --ventana \
        --piloto-espera 600 --nucleos 8 --puerto 8183 --etiqueta g11-$n-q$m-p$par --chrome "$LIMITES --disable-dawn-features=timestamp_quantization" \
        --extra "$TRAMO$e&quitarEfectos=$m" > $DATOS/medir-$n-q$m-p$par.txt 2>&1
      echo "== $n quitar $m par $par: salida $?"; grep -E "tramo|tarjeta en el tramo" $DATOS/medir-$n-q$m-p$par.txt | head -3 | cut -c1-300
    done; done; candado_hueco; done
    candado_soltar ;;
  igual)
    candado_tomar "g11 igual" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8183 \
      --extra-b="&quitarEfectos=15" > $DATOS/igual-sala-q15.txt 2>&1
    echo "== sala 0 contra 15: salida $?"; grep -E "✓|✗|puntos" $DATOS/igual-sala-q15.txt | tail -6 | cut -c1-200
    MKW_BUILD=build/web-w26/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8183 \
      --build-b=$SAL/navegador > $DATOS/igual-sala-dos.txt 2>&1
    echo "== sala w26 contra g11: salida $?"; grep -E "✓|✗|puntos" $DATOS/igual-sala-dos.txt | tail -6 | cut -c1-200
    MKW_BUILD=build/web-w26/navegador timeout 2400 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
      > $DATOS/igual-fantasma.txt 2>&1
    echo "== fantasma: salida $?"; grep -E "✓|✗" $DATOS/igual-fantasma.txt | tail -6 | cut -c1-200
    MKW_BUILD=build/web-w26/navegador timeout 2400 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
      --extra-b="&quitarEfectos=15" > $DATOS/igual-fantasma-q15.txt 2>&1
    echo "== fantasma con 15: salida $?"; grep -E "✓|✗" $DATOS/igual-fantasma-q15.txt | tail -4 | cut -c1-200
    MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-navegador.mjs 1800 --puerto 8183 --datos $DATOS/nav > $DATOS/igual-navegador.txt 2>&1
    echo "== arranque: salida $?"; grep -E "✗|puntos|de 2" $DATOS/igual-navegador.txt | tail -4 | cut -c1-200
    candado_soltar ;;
esac; done
