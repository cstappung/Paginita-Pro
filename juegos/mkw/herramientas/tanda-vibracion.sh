#!/bin/bash
# La vibración del teléfono por eventos (bitácora §272), con el juego y con el candado de medición.
#
# Resumen: corre web/navegador/prueba-vibracion.mjs (un Pixel 7 emulado, dos carreras: VS con 11 CPU y la
# Contrarreloj con sus 3 champiñones) contra el programa que se publica, tomando el candado de medición compartido
# (herramientas/candado.sh: espera su turno en la fila, como un interruptor de transferencia con enclavamiento).
# Uso:  bash herramientas/tanda-vibracion.sh [nueva] [vieja] [-- banderas de la prueba]
#       nueva = ?vibracionEventos (lo de ahora), vieja = §167 (para comparar cuánto vibraba antes)
cd "$(dirname "$0")/.." || exit 1
QUIEN="vibracion-272 (local_vibra)"
source herramientas/candado.sh
export MKW_BUILD="${MKW_BUILD:-build/web-final-w30/navegador}"
fases=(); extra=()
while [ $# -gt 0 ]; do if [ "$1" = "--" ]; then shift; extra=("$@"); break; fi; fases+=("$1"); shift; done
[ ${#fases[@]} -eq 0 ] && fases=(nueva)
candado_tomar "vibracion-272" 21600 || exit 1
trap candado_soltar EXIT
for f in "${fases[@]}"; do
  case "$f" in
    nueva) node web/navegador/prueba-vibracion.mjs "${extra[@]}" ;;
    vieja) node web/navegador/prueba-vibracion.mjs --vieja "${extra[@]}" ;;
  esac
  candado_hueco
done
