#!/usr/bin/env bash
# G15 (§255): «Imagen» en Gráficos (60 / 30 parejas / con imagen intermedia / Automático), aplicada sin reiniciar.
# El juego (n8_nativo.cpp) cambia de modo solo en el borde limpio de un par de cuadros (aplicarPedido); la página
# (mkw.mjs window.mkwImagen) lo pide en cualquier momento. La lógica sigue siempre en 60.
#   compilar = el programa con el n8_nativo.cpp nuevo (build/web-g15; semillas de build/web-w19)
#   sala     = la sala con A en 30 parejas y B con imagen intermedia: huellas iguales toda la carrera
#   ciclo    = la sala con B cambiando de imagen cada 3 s (60 → 30 → intermedia …, unos 20 cambios): huellas iguales
#   ciclo1   = un jugador cambiando cada 3 s en el tramo fijo: cuántos cambios, ningún cuadro negro (la foto de cada cambio)
#   medir    = lo que ve un jugador en línea (medir-enlinea, 60 s) en cada modo: refrescos justos/repetidos/saltados
# Uso: bash herramientas/tanda-g15.sh compilar sala ciclo medir   → build/web/datos/g15/
cd "$(dirname "$0")/.."
QUIEN="e7-g15 (local_cb5459c6)"; source herramientas/candado.sh
BASE=build/web-w19; SAL=${G15_SAL:-build/web-g15}; DATOS=build/web/datos/g15; mkdir -p $DATOS
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  compilar)
    candado_tomar "g15 compilar" 21600 || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 \
      python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar.log 2>&1
    sal=$?; echo "compilar: salida $sal"; tail -2 $DATOS/compilar.log
    [ $sal = 0 ] || { grep -m3 "error" $DATOS/compilar.log; exit 1; }
    for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
    [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
    node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
    candado_soltar ;;
  sala)
    candado_tomar "g15 sala" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8184 \
      --extra-a="&n8=1" --extra-b="&n8=2" > $DATOS/sala-1-2.txt 2>&1
    echo "== sala A 30 parejas, B intermedia: salida $?"; grep -E "✓|✗|puntos" $DATOS/sala-1-2.txt | tail -16 | cut -c1-220
    candado_soltar ;;
  ciclo)
    candado_tomar "g15 ciclo" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8184 \
      --extra-b="&imagenCiclo=3" > $DATOS/sala-ciclo.txt 2>&1
    echo "== sala con B cambiando cada 3 s: salida $?"; grep -E "✓|✗|puntos" $DATOS/sala-ciclo.txt | tail -16 | cut -c1-220
    cp -f build/web/datos/sincro/registro.txt $DATOS/sala-ciclo-registro.txt; grep -c "\[n8\] imagen:" $DATOS/sala-ciclo-registro.txt | sed 's/^/cambios anotados en el registro: /'
    candado_soltar ;;
  ciclo1)
    candado_tomar "g15 ciclo1" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-imagen.mjs --puerto 8184 > $DATOS/ciclo1.txt 2>&1
    echo "== un jugador cambiando: salida $?"; grep -E "✓|✗" $DATOS/ciclo1.txt | cut -c1-220
    candado_soltar ;;
  medir)
    candado_tomar "g15 medir" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node herramientas/medir-enlinea.mjs "&n8=0" "&n8=1" "&n8=2" > $DATOS/enlinea.txt 2>&1
    echo "== medir-enlinea: salida $?"; grep -E "variante|1 % bajo" $DATOS/enlinea.txt | cut -c1-300
    candado_soltar ;;
esac; done
