#!/bin/bash
# W8 (modo 2) y W9 con la foto de la Contrarreloj (bitácora §203 y §205).
#
# Resumen: tanda-w8b.sh midió que ?soltarPipelines=2 (soltar los pipelines de las otras pistas y vaciar la memoria de
# sombreadores) deja plana la memoria del proceso de la tarjeta en 8 pistas (−168 MB contra +1142 MB). Falta su costo:
# los sombreadores que se vuelven a compilar. Esta tanda repite las 8 pistas en una pestaña con el mismo programa
# (build/web-w8b) sin soltar y con el modo 2, intercaladas, y cuenta por pista los pipelines armados en el momento y los
# dibujos saltados (medir-memoria-pistas.mjs, «costo»); y la sala con el modo 2. W9: la foto del mismo cuadro de la
# Contrarreloj contra el experto (prueba-foto-igual.mjs: la carrera directa de 12 CPU no se repite igual), primero el
# control y después B con ?huesosFilas=1. Toma build/medicion.lock (herramientas/candado.sh).
# Uso:  bash herramientas/tanda-w8d.sh costo sala foto
cd "$(dirname "$0")/.."
QUIEN="e0-w8d (local_f84b9b29)"; source herramientas/candado.sh
B=build/web-w8b
DATOS=build/web/datos/w8
PUERTO=8186
tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
pistas() {   # $1 etiqueta, $2 extra
  paso "8 pistas en una pestaña: $1"
  MKW_BUILD=$B/navegador timeout 3600 node herramientas/medir-memoria-pistas.mjs --puerto $PUERTO --etiqueta $1 \
    --extra "&piscina=0$2" 2>&1 | tee $DATOS/$1.txt | grep -E "^pista|costo:|^de la|✗"
}
costo() {
  tomar "w8d costo"
  pistas w8d-guardar-1 ""
  pistas w8d-modo2-1 "&soltarPipelines=2"
  pistas w8d-modo2-2 "&soltarPipelines=2"
  pistas w8d-guardar-2 ""
}
sala() {
  tomar "w8d sala"
  paso "prueba-sala --rapida con ?soltarPipelines=2"
  MKW_BUILD=$B/navegador timeout 3600 node web/navegador/prueba-sala.mjs --rapida --puerto=8187 "--extra=&soltarPipelines=2" \
    > $DATOS/sala-modo2.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗|TypeError" $DATOS/sala-modo2.txt | tail -6
}
foto() {
  tomar "w8d foto"
  paso "W9: el control (A y B iguales, sin nada), la Contrarreloj"
  MKW_BUILD=$B/navegador timeout 1800 node web/navegador/prueba-foto-igual.mjs --puerto $PUERTO > $DATOS/foto-control.txt 2>&1
  echo "salida $?"; grep -E "✓|✗|bien, " $DATOS/foto-control.txt
  paso "W9: B con las matrices de los huesos por filas (?huesosFilas=1)"
  MKW_BUILD=$B/navegador timeout 1800 node web/navegador/prueba-foto-igual.mjs --puerto $PUERTO "--extra-b=&huesosFilas=1" \
    > $DATOS/foto-huesos.txt 2>&1
  echo "salida $?"; grep -E "  [AB]:|✓|✗|bien, " $DATOS/foto-huesos.txt
}
[ $# -eq 0 ] && { sed -n 2,11p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in costo) costo ;; sala) sala ;; foto) foto ;; *) sed -n 2,11p "$0"; exit 1 ;; esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
