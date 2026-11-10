#!/bin/bash
# La 3.ª parte de U2 (§169): la pista elegida solo vale con la pantalla de copas o de pistas arriba (paginaArriba). Por los
# menús: 13.2 (VS, este PC y la gama baja) y 0.0 (VS y GP: la pista por omisión, no se pide antes de la ficha).
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
S="&bloques=bloques-d9.json&pipelines=pipelines-c3.bin"
$M --menu vs --etiqueta tu2c-vs-con --pistas 13.2,0.0 --extra "$S"
$M --menu gp --etiqueta tu2c-gp-con --pistas 0.0 --extra "$S"
$M --menu vs --baja --etiqueta tu2c-baja-con --pistas 13.2 --extra "$S"
echo TANDA-U2C-LISTA
