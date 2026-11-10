#!/bin/bash
# La 2.ª parte de la tanda de U2 (§169): 0.0 por los menús otra vez, ya sin la ficha por omisión del arranque
# (carreraEnCamino) y con la pista quieta 1 s antes de pedirla; la 1.ª tanda la pidió a los 3,8 s de abrir la página.
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
S="&bloques=bloques-d9.json&pipelines=pipelines-c3.bin"
$M --menu vs --etiqueta tu2b-vs-sin --pistas 0.0 --extra "$S&paqueteCarrera=0"
$M --menu vs --etiqueta tu2b-vs-ficha --pistas 0.0 --extra "$S&pistaTemprana=0"
$M --menu vs --etiqueta tu2b-vs-con --pistas 0.0 --extra "$S"
$M --menu vs --etiqueta tu2b-vs-con --pistas 13.2 --extra "$S"
$M --menu vs --baja --etiqueta tu2b-baja-con --pistas 13.2 --extra "$S"
$M --etiqueta tu2b-directa --pistas 0.0 --extra "$S"
echo TANDA-U2B-LISTA
