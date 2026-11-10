#!/bin/bash
# §251: la prueba con el juego de la pantalla «Espacio» (borrar por partes), con el candado de medición (otra sesión
# puede estar midiendo en este PC: correr el juego a la vez le ensuciaría los números).
#
# Uso:  bash herramientas/tanda-espacio.sh [--pistas 0.0,13.2]
cd "$(dirname "$0")/.." || exit 1
QUIEN="espacio (local_espacio250)"
source herramientas/candado.sh
candado_tomar "prueba-espacio" || exit 1
trap candado_soltar EXIT
mkdir -p build/web/datos/espacio
node web/navegador/prueba-espacio.mjs "$@" 2>&1 | tee build/web/datos/espacio/prueba-$(date +%Y%m%d-%H%M).txt
exit ${PIPESTATUS[0]}
