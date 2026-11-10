#!/bin/bash
# ¿Qué programa rompe prueba-sala? (bitácora §203): prueba-sala --rapida, una vez con cada programa que se le pase,
# en orden. Sirve para saber desde qué programa (o desde qué cambio de la página) falla un punto. Toma
# build/medicion.lock (herramientas/candado.sh).
# Uso:  bash herramientas/tanda-sala-programas.sh build/web-m1 build/web/navegador …   (la carpeta del programa o su navegador/)
cd "$(dirname "$0")/.."
QUIEN="e0-sala (local_f84b9b29)"; source herramientas/candado.sh
DATOS=build/web/datos/sala-programas
mkdir -p $DATOS
trap candado_soltar EXIT
[ $# -eq 0 ] && { sed -n 2,5p "$0"; exit 1; }
candado_tomar "sala programas" ${CANDADO_ESPERA:-21600} || exit 1
for b in "$@"; do
  nav=$b; [ -d "$b/navegador" ] && nav=$b/navegador
  et=$(echo "$b" | tr '/' '_')
  echo; echo "=== $(date '+%H:%M:%S') prueba-sala --rapida con $nav"
  MKW_BUILD=$nav timeout 3600 node web/navegador/prueba-sala.mjs --rapida --puerto=8187 > $DATOS/$et.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗|TypeError" $DATOS/$et.txt | tail -6
done
