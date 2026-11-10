#!/bin/bash
# Tanda del paso 15 (E1/E2/N8/G6/G4, bitácora §190): compilar y medir con el candado común (herramientas/candado.sh).
# Uso: bash herramientas/tanda-190.sh <fase> [<fase> …]
#   compilar  el programa del navegador con lo del paso 15 en build/web-g6/navegador (las semillas y las imágenes de
#             siempre al lado); los objetos de aurora se rehacen solo donde cambió
#   energia   node web/navegador/prueba-energia.mjs (E1/E2 con el juego)
#   fotos     G6: la misma carrera directa con y sin ?texturasBc=1, fotos en el mismo cuadro → build/web/datos/g6/
#   medir     G6: el tramo fijo (§163) con y sin ?texturasBc=1 intercalados, en este PC y en la gama baja simulada, con
#             el perfil de la tarjeta (ms por imagen y por pasada)
# Cada fase toma el candado y lo suelta al terminar; dentro de una fase larga, candado_hueco entre vueltas.
cd "$(dirname "$0")/.."
QUIEN="paso7 (local_8351f225)"; source herramientas/candado.sh
export MKW_VENTANA="${MKW_VENTANA:--1880,549}"
DATOS=build/web/datos/g6; mkdir -p "$DATOS"
SAL=${SAL:-build/web-g6/navegador}
VUELTAS=${VUELTAS:-2}
BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"     # la gama baja de §163 (con --nucleos 8)

fase_compilar() {
  candado_tomar "paso15 compilar (build/web-g6)" || exit 1
  python herramientas/compilar-web.py --modo navegador --salida "$SAL" > "$DATOS/compilar.log" 2>&1 &
  esperar_pid $!; local r=$?
  for f in pipelines.bin bloques.json pipelines-c2.bin bloques-d9.json; do
    [ -f build/web/navegador/$f ] && cp -f build/web/navegador/$f "$SAL/"; done
  [ -d build/web/navegador/imagenes ] && cp -rf build/web/navegador/imagenes "$SAL/"
  candado_soltar
  grep -E "error|Error" "$DATOS/compilar.log" | head -20; tail -3 "$DATOS/compilar.log"; return $r
}

fase_energia() {
  candado_tomar "paso15 prueba-energia (E1/E2 con el juego)" || exit 1
  MKW_BUILD="$SAL" timeout 900 node web/navegador/prueba-energia.mjs > "$DATOS/energia.log" 2>&1 &
  esperar_pid $!
  candado_soltar
  tail -14 "$DATOS/energia.log"
}

fase_fotos() {
  candado_tomar "paso15 G6 fotos con y sin BC1" || exit 1
  MKW_BUILD="$SAL" timeout 1200 node web/navegador/prueba-texturas-bc.mjs > "$DATOS/fotos.log" 2>&1 &
  esperar_pid $!
  candado_soltar
  tail -16 "$DATOS/fotos.log"
}

# una medición del tramo fijo: $1 etiqueta, $2 opciones de medir-sitio, $3 lo que se agrega a la dirección
medir_una() {
  MKW_BUILD="$SAL" node herramientas/medir-sitio.mjs --perfil pc $2 --etiqueta "$1" --sola --piloto --piloto-espera 600 \
    --chrome "--disable-dawn-features=timestamp_quantization" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&perfilGpu=1$3" \
    > "$DATOS/$1.log" 2>&1 &
  esperar_pid $!
  grep -E "tramo|tarjeta en el tramo" "$DATOS/$1.log" | tail -3
  grep -E "texturas BC1" "build/web/datos/medir-sitio/$1-pc.log" 2>/dev/null | tail -1
}

fase_medir() {
  candado_tomar "paso15 medir G6 (tramo fijo, pc y gama baja)" || exit 1
  for v in $(seq 1 "$VUELTAS"); do
    medir_una "g6-pc-sin-$v" "" ""
    medir_una "g6-pc-con-$v" "" "&texturasBc=1"
    medir_una "g6-baja-sin-$v" "--nucleos 8" "$BAJA"
    medir_una "g6-baja-con-$v" "--nucleos 8" "&texturasBc=1$BAJA"
    candado_hueco "paso15 medir G6 (vuelta $((v + 1)))"
  done
  candado_soltar
}

# G4 barato: una carrera entera por los menús con perfil nuevo (1.ª visita), en este PC y en la gama baja de §168
# (--baja), con las semillas candidatas (bloques-d9, pipelines-c2); el resumen dice por tramo qué pidió el juego sin
# estar listo: de la cola del precalentado, de la lista esperando (su pista o lo diferido) o nuevo. $PIPES_ETIQUETA =
# el nombre de la vuelta (antes / despues); $PIPES_EXTRA = lo que se agrega a la dirección.
fase_pipes() {
  candado_tomar "paso15 G4 barato: pipelines en la carrera (${PIPES_ETIQUETA:-antes})" || exit 1
  local M="node herramientas/medir-carrera-entera.mjs --menu vs --pistas 13.2"
  local X="&bloques=bloques-d9.json&pipelines=pipelines-c2.bin${PIPES_EXTRA:-}"
  MKW_BUILD="$SAL" $M --etiqueta "g4-${PIPES_ETIQUETA:-antes}" --extra "$X" > "$DATOS/pipes-${PIPES_ETIQUETA:-antes}.log" 2>&1 &
  esperar_pid $!
  candado_hueco "paso15 G4 barato (la gama baja)"
  MKW_BUILD="$SAL" $M --baja --etiqueta "g4-baja-${PIPES_ETIQUETA:-antes}" --extra "$X" > "$DATOS/pipes-baja-${PIPES_ETIQUETA:-antes}.log" 2>&1 &
  esperar_pid $!
  candado_soltar
  grep -hE "^pista|pipelines" "$DATOS/pipes-${PIPES_ETIQUETA:-antes}.log" "$DATOS/pipes-baja-${PIPES_ETIQUETA:-antes}.log" | head -8
}

for f in "$@"; do "fase_$f" || exit 1; done
