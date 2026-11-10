#!/bin/bash
# §246: la planilla entera (correr-todo.mjs) sobre el programa final nuevo (build/web-e6-w29, W29 adoptada en §244),
# bajo el candado de medición (herramientas/candado.sh), por turnos con las otras sesiones.
# Uso:  bash herramientas/tanda-246.sh [argumentos de correr-todo, p. ej. --solo sala,sincro]
cd "$(dirname "$0")/.."
QUIEN="cierre-246 (sesion de cierre de items)"; source herramientas/candado.sh
candado_tomar "246 correr-todo" ${CANDADO_ESPERA:-21600} || exit 1
trap candado_soltar EXIT
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
MKW_BUILD=${MKW_BUILD:-build/web-e6-w29/navegador} node herramientas/correr-todo.mjs "$@"
