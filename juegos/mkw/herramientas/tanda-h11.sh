#!/bin/bash
# H11 de la etapa 2 del plan v4 (bitácora §214): lo frío del código traducido compilado chico.
#
# Resumen: corre el juego en Node con los 3 guiones de W4 (build/web/datos/w4/guion-{a,b,c}.txt: llegan a las pistas
# 0x1E, 0x10 y 0x0A; el tramo fijo es Luigi Circuit, una pista que el perfil NO ve) con el perfil de V8 prendido;
# h11-caliente.mjs junta los tres y escribe frio.h (cada función traducida que no corrió, con minsize y cold); después
# compila el programa con --fija --frio y lo prueba y mide contra la base como H6 (tanda-h6.sh).
# Uso:  bash herramientas/tanda-h11.sh perfilar cabecera compilar probar igual medir chrome
# Variables: H11_PERFIL_BUILD (build/web-h6b/node: con nombres de funciones), H11_SAL (build/web-h11), H11_BASE (build/web-h6b)
cd "$(dirname "$0")/.."
QUIEN="e2-motor (local_e2e2)"; source herramientas/candado.sh
DATOS=build/web/datos/e2/h11
mkdir -p "$DATOS"
PB=${H11_PERFIL_BUILD:-build/web-h6b/node}
export H6_SAL=${H11_SAL:-build/web-h11} H6_BASE=${H11_BASE:-build/web-h6b}

perfilar() {
  candado_tomar "h11 perfilar" ${CANDADO_ESPERA:-21600} || exit 1
  for g in a b c; do
    rm -rf $DATOS/perfil-$g
    echo "=== $(date '+%H:%M:%S') guion $g con el perfil de V8"
    timeout 3600 node herramientas/correr-guion.mjs --build $PB --guion build/web/datos/w4/guion-$g.txt --cuadros 6000 \
      --log $DATOS/perfil-$g.log --cpuprof $DATOS/perfil-$g | tail -3
  done
  candado_soltar
}

cabecera() {
  node herramientas/h11-caliente.mjs $DATOS/perfil-a/*.cpuprofile $DATOS/perfil-b/*.cpuprofile $DATOS/perfil-c/*.cpuprofile \
    --wc terceros/Wiicompiled-motor-h6
}

[ $# -eq 0 ] && { sed -n 2,10p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    perfilar) perfilar ;; cabecera) cabecera ;;
    compilar|probar|igual|medir|chrome|memoria) H6_ARGS="--frio $DATOS/frio.h" bash herramientas/tanda-h6.sh $fase ;;
    *) sed -n 2,10p "$0"; exit 1 ;;
  esac
done
