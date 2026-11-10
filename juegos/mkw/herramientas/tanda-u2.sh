#!/bin/bash
# La tanda de U2 (§169): la carrera por los menús del juego (el piloto de la página), sin el paquete, con el paquete
# pero sin pedir la pista al elegirla (?pistaTemprana=0) y con todo; VS en dos pistas, Grand Prix en la copa 0 y la
# gama baja (CPU ×4, 20 Mbit/s, 50 ms) en VS. Perfil nuevo, las semillas nuevas (§168, §172).
# Resultados en build/web/datos/carrera-entera/<etiqueta>/.
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
S="&bloques=bloques-d9.json&pipelines=pipelines-c3.bin"
for P in 0.0 13.2; do
  $M --menu vs --etiqueta tu2-vs-sin --pistas $P --extra "$S&paqueteCarrera=0"
  $M --menu vs --etiqueta tu2-vs-ficha --pistas $P --extra "$S&pistaTemprana=0"
  $M --menu vs --etiqueta tu2-vs-con --pistas $P --extra "$S"
done
$M --menu gp --etiqueta tu2-gp-ficha --pistas 0.0 --extra "$S&pistaTemprana=0"
$M --menu gp --etiqueta tu2-gp-con --pistas 0.0 --extra "$S"
$M --menu vs --baja --etiqueta tu2-baja-sin --pistas 13.2 --extra "$S&paqueteCarrera=0"
$M --menu vs --baja --etiqueta tu2-baja-ficha --pistas 13.2 --extra "$S&pistaTemprana=0"
$M --menu vs --baja --etiqueta tu2-baja-con --pistas 13.2 --extra "$S"
echo TANDA-U2-LISTA
