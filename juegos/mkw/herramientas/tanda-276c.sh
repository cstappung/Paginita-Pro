#!/bin/bash
# §276b: las fotos del cartel de la carga en el teléfono de verdad (Oppo, marco seguro, 1.ª visita en incógnito), con el candado.
# Uso:  bash herramientas/tanda-276c.sh
cd "$(dirname "$0")/.." || exit 1
QUIEN="arranque-276 (local_arranque276)"
source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-final-w30/navegador}
candado_tomar "fotos-cartel-oppo" || exit 1
trap candado_soltar EXIT
node herramientas/foto-cartel-telefono.mjs --etiqueta oppo
