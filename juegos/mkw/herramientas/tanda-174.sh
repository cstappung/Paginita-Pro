#!/bin/bash
# La tanda de §174 (C2 y D8 del paso 5 del plan de rendimiento), con el candado tomado por quien la llama.
#   compilar: el programa del navegador con aurora de C2 (pipelines con etiqueta) y el THP sin copia (D8)
#   motor:    lo mismo con la v0.9.3 (C2 también en terceros/aurora-main-viejo-motor) en build/web-motor-c2: que compile
#   pruebas:  las 6 que fallaban en correr-todo (§175: la partida base limpia, tactil y precarga), con su planilla
#   sano:     prueba-navegador (22 puntos) con lo nuevo
#   semilla:  tres carreras enteras con la lista de pipelines de cada una (ya con etiquetas) → pipelines-c2.bin
#   medir:    por los menús, 13.2, este PC y la gama baja: A = todo como antes, B = solo D8, C = D8 + C2;
#             y la carga con la CPU ×4 (medir-sitio --arranque): A contra C
# Uso:  bash herramientas/tanda-174.sh [fases…]   (sin nada: todas)   → build/web/datos/tanda-174.log lo guarda quien llama
cd "$(dirname "$0")/.."
FASES="${*:-compilar motor pruebas sano semilla medir}"
M="node herramientas/medir-carrera-entera.mjs"
BASE="&bloques=bloques-d9.json"
A="$BASE&pipelines=pipelines-c3.bin&pipelinesPista=0&videosCabeza=0&thpDirecto=0"
B="$BASE&pipelines=pipelines-c3.bin&pipelinesPista=0"
C="$BASE&pipelines=pipelines-c2.bin"
for f in $FASES; do
  echo "=== $f $(date '+%H:%M:%S')"
  case $f in
    compilar)
      python herramientas/compilar-web.py --modo navegador || { echo "FALLÓ LA COMPILACIÓN"; exit 1; }
      git -C terceros/Wiicompiled diff -- aurora-main > parches/aurora-web.diff ;;
    motor)
      MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor         python herramientas/compilar-web.py --modo navegador --carpeta build/web-motor-c2 2>&1 | tail -5
      ls -l build/web-motor-c2/navegador/mkw.wasm || echo "FALLÓ LA COMPILACIÓN DE LA v0.9.3" ;;
    pruebas)
      node herramientas/partida-base.mjs
      node herramientas/comprimir-build.mjs | tail -2
      node herramientas/correr-todo.mjs --solo partidas,menus,invitados,tactil,precarga,doce | tail -40
      for x in "&cajaGrande=0" "&precargaLiviana=0" "&paqueteCarrera=0"; do
        echo "--- precarga con $x"; node web/navegador/prueba-precarga.mjs "--extra=$x" | grep -E "^·|✗"
      done ;;
    pruebas2)
      node herramientas/correr-todo.mjs --solo precarga,doce | tail -20 ;;
    sano)
      node web/navegador/prueba-navegador.mjs 1800 --puerto 8175 | tail -30 ;;
    semilla)
      $M --etiqueta tc2s --pistas 0.0,13.2,30.2 --pipelines --extra "$BASE&pipelines=pipelines-c3.bin" | grep -E "^pista|^  largada"
      node herramientas/juntar-pipelines.mjs build/web/navegador/pipelines-tc2s-0.0.bin build/web/navegador/pipelines-tc2s-13.2.bin \
        build/web/navegador/pipelines-tc2s-30.2.bin build/web/navegador/pipelines-c3.bin --salida build/web/navegador/pipelines-c2.bin ;;
    medir)
      for x in A B C; do
        $M --menu vs --etiqueta t174-$x --pistas 13.2 --extra "${!x}" | grep -E "^pista|^  largada|^  paquete"
        candado_hueco "tanda-174 (sigue)"
      done
      for x in A B C; do
        $M --menu vs --baja --etiqueta t174-baja-$x --pistas 13.2 --extra "${!x}" | grep -E "^pista|^  largada|^  paquete"
        candado_hueco "tanda-174 (sigue)"
      done
      for x in A C; do
        node herramientas/medir-sitio.mjs --perfil cpu4 --arranque --etiqueta t174-carga-$x --extra "${!x}" 2>&1 | tail -25
        candado_hueco "tanda-174 (sigue)"
      done ;;
  esac
done
echo TANDA-174-LISTA
