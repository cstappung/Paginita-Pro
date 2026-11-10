#!/bin/bash
# La 4.ª parte de U2 (§169): la pista elegida solo vale en las secciones de menús (enMenus; con la pantalla de arriba no se veía). Por los
# menús: 13.2 (VS, este PC y la gama baja) y 0.0 (VS y GP: la pista por omisión, no se pide antes de la ficha).
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
S="&bloques=bloques-d9.json&pipelines=pipelines-c3.bin"
$M --menu vs --etiqueta tu2d-vs-con --pistas 13.2,0.0 --extra "$S"
$M --menu gp --etiqueta tu2d-gp-con --pistas 0.0 --extra "$S"
$M --menu vs --baja --etiqueta tu2d-baja-con --pistas 13.2 --extra "$S"
echo TANDA-U2D-LISTA
