#!/bin/bash
# §276b: las fotos del cartel de la carga en este PC (ventana de PC y del tamaño de un teléfono), con el candado.
# Uso:  bash herramientas/tanda-276b.sh
cd "$(dirname "$0")/.." || exit 1
QUIEN="arranque-276 (local_arranque276)"
source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-final-w30/navegador}
candado_tomar "fotos-cartel-276b" || exit 1
trap candado_soltar EXIT
node herramientas/foto-cartel.mjs --etiqueta pc; r1=$?
node herramientas/foto-cartel.mjs --telefono --etiqueta telefono; r2=$?
exit $((r1 + r2))
