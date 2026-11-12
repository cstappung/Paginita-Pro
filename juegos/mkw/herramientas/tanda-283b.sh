#!/bin/bash
# §283 parte 2: «20 parejas» (N8 modo 3) en el Oppo. Compila el programa de prueba con el modo nuevo (cambia el .wasm:
# web/juego/n8_nativo.cpp) y lo mide contra «30 parejas» en pares intercalados.
#
# Resumen: compilar (con el candado, ocupa todo el procesador) → build/web-283 (el final de hoy, W30 + PR #403, sin PGO:
# el antes y el después van en el MISMO programa, así que el PGO no cambia la comparación); las semillas de pipelines y
# bloques del final v21 (la misma aurora y el mismo disco); comprimir. Después la tanda de §283 con ?n8=1 contra ?n8=3.
# Uso:  bash herramientas/tanda-283b.sh compilar medir
cd "$(dirname "$0")/.." || exit 1
QUIEN="picos-283 (local_283180d3)"; source herramientas/candado.sh
FIN=build/web-283; DATOS=build/web/datos/picos-283; mkdir -p $DATOS
for fase in "$@"; do case $fase in
  compilar)
    candado_tomar "picos-283 compilar web-283 (20 parejas)" || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30-403s MKW_AURORA=terceros/aurora-main-viejo-motor timeout 10800 \
      python ${COMPILAR:-herramientas/compilar-web.py} --modo navegador --final --sin-pgo --carpeta $FIN > $DATOS/compilar-283.log 2>&1
    s=$?; echo "compilar: salida $s"; tail -3 $DATOS/compilar-283.log
    candado_soltar
    [ $s = 0 ] || exit 1
    for f in pipelines.bin bloques.json; do cp -f build/web-final-v21/navegador/$f $FIN/navegador/; done
    [ -d build/web-final-v21/navegador/imagenes ] && cp -rf build/web-final-v21/navegador/imagenes $FIN/navegador/
    node herramientas/comprimir-build.mjs $FIN/navegador > $DATOS/comprimir-283.log 2>&1; echo "comprimir $?"
    ;;
  medir)
    PISTA=8.3 BUILD=$FIN/navegador DATOS=$DATOS/${T9:-t9-20p} bash herramientas/tanda-283.sh \
      "sp@p30a=&n8=1" "sp@p20a=&n8=3" "sp@p30b=&n8=1" "sp@p20b=&n8=3" "estado-2@p30:tel=&n8=1" "estado-2@p20:tel=&n8=3"
    ;;
esac; done
