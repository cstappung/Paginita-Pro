#!/bin/bash
# W7, W8, W20 y W9 de la etapa 0 del plan v4 (bitácora §202–§205): los arreglos que vienen de leer KartPad.
#
# Resumen: cuatro comprobaciones con el programa de la base de la etapa 0 (build/web-w19), que ya trae, apagados, los
# dos interruptores nuevos de aurora (?piscina=1 de W20 y ?huesosFilas=1 de W9):
#   w7  = ¿sale alguna vez el aviso «sub-copy unsupported» (una carga de matriz XF que aurora se salta)? 5 pistas enteras
#         (de Nintendo y de Retro Rewind) con medir-carrera-entera.mjs, que los cuenta.
#   w8  = la memoria tras 8 pistas distintas en la MISMA pestaña (medir-memoria-pistas.mjs), como hoy.
#   w20 = lo mismo con ?piscina=1 (soltar las texturas de copia de repuesto ociosas, la mitad de KartPad 0cca4d2) y
#         prueba-navegador con la piscina prendida.
#   w9  = la foto del mismo cuadro con y sin ?huesosFilas=1 (el camino de reserva de las Adreno): prueba-foto-igual.mjs,
#         primero el control (las dos iguales, sin nada: tiene que dar 0 %), y prueba-navegador con la reserva prendida.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w7.sh w7 w8 w20 w9
cd "$(dirname "$0")/.."
QUIEN="e0-w7 (local_f84b9b29)"; source herramientas/candado.sh
BUILD=${W7_BUILD:-build/web-w19/navegador}
DATOS=build/web/datos/w7
mkdir -p "$DATOS"
PUERTO=8184

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

w7() {
  tomar "w7 avisos XF"
  paso "W7: 5 pistas enteras (Nintendo y RR), los avisos «sub-copy unsupported»"
  MKW_BUILD=$BUILD timeout 3600 node herramientas/medir-carrera-entera.mjs --pistas 0.0,5.3,13.2,30.2,65.0 \
    --puerto $PUERTO --etiqueta w7 > $DATOS/w7.txt 2>&1
  echo "salida $?"; grep -o "^pista [0-9.]*\|avisos XF «sub-copy» .*" $DATOS/w7.txt
}

w8() {
  tomar "w8 memoria"
  paso "W8: la memoria tras 8 pistas distintas en la misma pestaña (como hoy)"
  MKW_BUILD=$BUILD timeout 3600 node herramientas/medir-memoria-pistas.mjs --puerto $PUERTO --etiqueta w8 --extra "&piscina=0" \
    2>&1 | tee $DATOS/w8.txt | grep -E "^pista|^de la|✗"
}

w20() {
  tomar "w20 piscina"
  paso "W20: lo mismo con la piscina de copias que suelta las ociosas (?piscina=1)"
  MKW_BUILD=$BUILD timeout 3600 node herramientas/medir-memoria-pistas.mjs --puerto $PUERTO --etiqueta w20 --extra "&piscina=1" \
    2>&1 | tee $DATOS/w20.txt | grep -E "^pista|^de la|✗"
  paso "W20: prueba-navegador con la piscina prendida"
  MKW_BUILD=$BUILD timeout 1800 node web/navegador/prueba-navegador.mjs 1800 --puerto $PUERTO --datos $DATOS/nav-w20 \
    --extra "&piscina=1" > $DATOS/nav-w20.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗" $DATOS/nav-w20.txt | tail -6
}

w9() {
  tomar "w9 huesos"
  paso "W9: el control (A y B iguales, sin nada): la foto tiene que salir igual"
  MKW_BUILD=$BUILD timeout 1800 node web/navegador/prueba-foto-igual.mjs --puerto $PUERTO > $DATOS/foto-control.txt 2>&1
  echo "salida $?"; grep -E "✓|✗|bien, " $DATOS/foto-control.txt
  paso "W9: B con las matrices de los huesos por filas (?huesosFilas=1)"
  MKW_BUILD=$BUILD timeout 1800 node web/navegador/prueba-foto-igual.mjs --puerto $PUERTO "--extra-b=&huesosFilas=1" > $DATOS/foto-huesos.txt 2>&1
  echo "salida $?"; grep -E "  [AB]:|✓|✗|bien, " $DATOS/foto-huesos.txt
  paso "W9: prueba-navegador con la reserva prendida"
  MKW_BUILD=$BUILD timeout 1800 node web/navegador/prueba-navegador.mjs 1800 --puerto $PUERTO --datos $DATOS/nav-w9 \
    --extra "&huesosFilas=1" > $DATOS/nav-w9.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗" $DATOS/nav-w9.txt | tail -6
}

[ $# -eq 0 ] && { sed -n 2,15p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    w7) w7 ;; w8) w8 ;; w20) w20 ;; w9) w9 ;;
    *) sed -n 2,15p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
