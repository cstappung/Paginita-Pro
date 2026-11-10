#!/bin/bash
# La tanda de §168–§169 (D9 y D4/U2): las mismas 3 pistas con perfil nuevo, una configuración detrás de otra, y la gama
# baja (CPU ×4, 20 Mbit/s y 50 ms) en una pista. Resultados en build/web/datos/carrera-entera/<etiqueta>/.
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
$M --etiqueta t168-a-vieja --extra "&paqueteCarrera=0&bloques=bloques-viejo.json"
$M --etiqueta t168-b-semilla --extra "&paqueteCarrera=0&bloques=bloques-d9.json"
$M --etiqueta t168-c-paquete --extra "&bloques=bloques-d9.json"
$M --etiqueta t168-baja-a --baja --pistas 13.2 --extra "&paqueteCarrera=0&bloques=bloques-viejo.json"
$M --etiqueta t168-baja-c --baja --pistas 13.2 --extra "&bloques=bloques-d9.json"
echo TANDA-168-LISTA
