#!/bin/bash
# W8, la sala (bitácora §203): prueba-sala --rapida falló en M22 (lo que A volvió a elegir) con ?soltarPipelines=1.
# Para saber si es el soltar o la prueba, se corre dos veces cada una, intercaladas: la base (build/web-w19, sin
# nada) y build/web-w8 con ?soltarPipelines=1. Toma build/medicion.lock (herramientas/candado.sh).
# Uso:  bash herramientas/tanda-w8c.sh sala
cd "$(dirname "$0")/.."
QUIEN="e0-w8c (local_f84b9b29)"; source herramientas/candado.sh
DATOS=build/web/datos/w8
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
sala1() {   # $1 programa, $2 etiqueta, $3 extra
  paso "prueba-sala --rapida: $2"
  MKW_BUILD=$1/navegador timeout 3600 node web/navegador/prueba-sala.mjs --rapida --puerto=8187 "--extra=$3" \
    > $DATOS/sala-$2.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗|TypeError" $DATOS/sala-$2.txt | tail -6
}
sala() {
  candado_tomar "w8c sala" ${CANDADO_ESPERA:-21600} || exit 1
  sala1 build/web-w19 base-1 ""
  sala1 build/web-w8 soltar-1 "&soltarPipelines=1"
  sala1 build/web-w8 soltar-2 "&soltarPipelines=1"
  sala1 build/web-w19 base-2 ""
}
[ "$1" = sala ] && sala || sed -n 2,5p "$0"
