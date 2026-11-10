#!/bin/bash
# La tanda de §172 (C3) y la del paquete de carrera con las skins (§169): perfil nuevo, las mismas 3 pistas.
#  1) antes: la semilla de pipelines de siempre; graba la lista de cada carrera (aurora marca «urgentes» los que armó de golpe)
#  2) junta la semilla nueva (la vieja + las 3 listas, urgentes primero) → pipelines-c3.bin
#  3) después: la semilla nueva (?pipelines=pipelines-c3.bin)
#  4) la gama baja (CPU ×4, 20 Mbit/s, 50 ms) en 13.2, antes y después
# Resultados en build/web/datos/carrera-entera/<etiqueta>/.
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
B="&bloques=bloques-d9.json"
$M --etiqueta t172-antes --pipelines --extra "$B"
node herramientas/juntar-pipelines.mjs build/web/navegador/pipelines.bin build/web/navegador/pipelines-t172-antes-*.bin --salida build/web/navegador/pipelines-c3.bin
$M --etiqueta t172-despues --extra "$B&pipelines=pipelines-c3.bin"
$M --etiqueta t172-baja-antes --baja --pistas 13.2 --extra "$B"
$M --etiqueta t172-baja-despues --baja --pistas 13.2 --extra "$B&pipelines=pipelines-c3.bin"
echo TANDA-172-LISTA
