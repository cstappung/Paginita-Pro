#!/bin/bash
# La tanda de §169 (el paquete de carrera con las voces corregidas), §171 (C5, la caché en grupos de 2 MB), §172 (C3 en
# la sala) y §173 (el informe con la CPU pura y el tramo de la tarjeta). Perfil nuevo; las semillas nuevas (§168, §172).
# Resultados en build/web/datos/carrera-entera/<etiqueta>/, medir-sitio/, sincro-173*/ e informe/.
cd "$(dirname "$0")/.."
M="node herramientas/medir-carrera-entera.mjs"
S="&bloques=bloques-d9.json&pipelines=pipelines-c3.bin"
# §169: sin y con el paquete, intercalados por pista
for P in 0.0 13.2 30.2; do
  $M --etiqueta t173-sin --pistas $P --extra "$S&paqueteCarrera=0"
  $M --etiqueta t173-con --pistas $P --extra "$S"
done
$M --etiqueta t173-baja-sin --baja --pistas 13.2 --extra "$S&paqueteCarrera=0"
$M --etiqueta t173-baja-con --baja --pistas 13.2 --extra "$S"
# §171: la caché de a un bloque (cajaGrande=0) contra los grupos de 2 MB: la carga y la 2.ª visita
for C in 0 8; do
  node herramientas/medir-sitio.mjs --perfil pc --sola --visitas 2 --etiqueta t173-caja$C --extra "$S&cajaGrande=$C"
  node herramientas/medir-sitio.mjs --perfil cpu4 --sola --visitas 2 --etiqueta t173-caja$C --extra "$S&cajaGrande=$C"
done
# §172: la sala (dos pestañas, carrera directa) con la semilla vieja y la nueva
node web/navegador/prueba-sincro.mjs --directa --datos=build/web/datos/sincro-173-viejo --extra="&bloques=bloques-d9.json&pipelines=pipelines-viejo.bin"
node web/navegador/prueba-sincro.mjs --directa --datos=build/web/datos/sincro-173-nuevo --extra="$S"
# §173: el informe trae cpuPuraMs y tramoMs
node web/navegador/prueba-informe.mjs
echo TANDA-173-LISTA
