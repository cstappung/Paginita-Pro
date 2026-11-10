#!/bin/bash
# El cierre del plan de rendimiento (bitácora §261): el programa final para publicar con todo lo adoptado y su planilla.
#
# Resumen: hasta hoy el programa para publicar era build/web-e6-w29-clip (H6 + W29 + el arreglo de §248) SIN W30. Esta
# tanda arma el nuevo, build/web-final-w30, desde la copia del motor que trae W30 (terceros/Wiicompiled-motor-w30 = H6 +
# parches/motor-w30.diff, MKW_MOTOR_W30=7 por omisión) con la aurora de siempre (terceros/aurora-main-viejo-motor, con
# lo de G15/G16), --final (ThinLTO, --fija de H6, --memoria-fija 768 de W29) y PGO con un perfil NUEVO (W30 cambia el
# código: pgo_final.py ve otra huella y vuelve a correr las 3 carreras de herramientas/pgo/). Después lo prueba entero.
# Como cambiar la placa de un tablero: se arma, se le pasa el protocolo completo de ensayos y se compara contra la vieja.
#
# Fases (en el orden que se pidan, todas bajo el candado de medición, herramientas/candado.sh):
#   compilar = el final con PGO → build/web-final-w30/navegador, las semillas de web-e6-w29-clip, comprimir
#   todo     = correr-todo.mjs con el final (la planilla entera, ~25 min)
#   igual    = prueba-sincro --directa con el final en las dos pestañas (las huellas iguales, 12 karts)
#   chrome   = el tramo fijo de §163, gama baja (revisión de límites + el lastre del plan) y este PC, 2 pares
#              intercalados con el orden alternado (CIERRE_VUELTAS="3 4" = más pares, zona gris)
#   doce     = la sala llena desde la página (herramientas/prueba-doce-sitio.mjs: 12 Chrome con perfiles nuevos, las
#              rondas 0-5; pedido del dueño 2026-11-09)
#   r2       = subir-r2.mjs en modo revisar (solo la lista, sin red: NO sube nada)
# Uso:  bash herramientas/tanda-cierre.sh compilar todo igual chrome doce r2
# Resultados: build/web/datos/cierre-final/ (con nombres del juego en los registros: nunca a git).
cd "$(dirname "$0")/.." || exit 1
QUIEN="${QUIEN:-cierre-final (local_f1a1)}"
source herramientas/candado.sh
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
DATOS=build/web/datos/cierre-final; mkdir -p $DATOS
FIN=${CIERRE_BUILD:-build/web-final-w30}; BASE=${CIERRE_BASE:-build/web-e6-w29-clip}
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"   # el aparato de gama media/baja del plan (§155)
EXTRA="&anillo=0&dibujarSiempre=1&n8=0"                        # como §257: la misma cantidad de dibujos en los dos
tomar() {   # si ya lo tengo (otra fase de esta misma tanda), solo cambio la etiqueta
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

compilar() {
  tomar "cierre compilar"
  paso "el final con W30 y PGO nuevo → $FIN/navegador"
  MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 21600 \
    python herramientas/compilar-web.py --modo navegador --final --carpeta $FIN > $DATOS/compilar.log 2>&1
  local s=$?; echo "salida $s"; grep -E "^PGO|^--final|error:" $DATOS/compilar.log | cut -c1-160 | head -12
  tail -2 $DATOS/compilar.log; [ $s = 0 ] || exit 1
  # las semillas (pipelines y bloques) y las imágenes: las del final de hoy (misma aurora, mismos archivos del disco)
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $FIN/navegador/; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $FIN/navegador/
  node herramientas/comprimir-build.mjs $FIN/navegador > $DATOS/comprimir.log 2>&1; echo "comprimir $?"
  ls -la $FIN/navegador/ | grep -E 'mkw|bin|json'
}
todo() {
  tomar "cierre correr-todo"
  paso "la planilla entera con $FIN"
  MKW_BUILD=$FIN/navegador timeout 7200 node herramientas/correr-todo.mjs > $DATOS/todo.txt 2>&1
  echo "salida $?"; tail -25 $DATOS/todo.txt
}
igual() {
  tomar "cierre igual"
  paso "prueba-sincro --directa: el final en las dos pestañas"
  MKW_BUILD=$FIN/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8179 \
    --datos=$DATOS/sincro > $DATOS/sincro.txt 2>&1
  echo "salida $?"; tail -20 $DATOS/sincro.txt
}
tramo() {   # $1 programa, $2 etiqueta, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8179 --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$3$EXTRA" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}
chrome() {
  tomar "cierre chrome"
  for v in ${CIERRE_VUELTAS:-1 2}; do   # regla del dueño (2026-11-02): 2 pares; más solo en la zona gris (−2 a +8 %)
    # CIERRE_SIN_BAJA=1 (el dueño, 2026-11-09: «no pruebes con los que ya sabemos que no llegan a 60 de lógica»): solo
    # este PC, sin la gama baja simulada
    if [ "${CIERRE_SIN_BAJA:-0}" = 1 ]; then
      paso "vuelta $v: este PC, hoy y final"
      if [ $((v % 2)) = 1 ]; then tramo $FIN cierre-pc-final-$v "" ""; tramo $BASE cierre-pc-hoy-$v "" ""
      else tramo $BASE cierre-pc-hoy-$v "" ""; tramo $FIN cierre-pc-final-$v "" ""; fi
      candado_hueco "sigue"; tomar "cierre chrome"; continue
    fi
    paso "vuelta $v: la gama baja (con la revisión de límites) y este PC, hoy y final"
    if [ $((v % 2)) = 1 ]; then
      tramo $BASE cierre-baja-hoy-$v "$GAMA_BAJA" "$LIMITES"; tramo $FIN cierre-baja-final-$v "$GAMA_BAJA" "$LIMITES"
      tramo $FIN cierre-pc-final-$v "" ""; tramo $BASE cierre-pc-hoy-$v "" ""
    else
      tramo $FIN cierre-baja-final-$v "$GAMA_BAJA" "$LIMITES"; tramo $BASE cierre-baja-hoy-$v "$GAMA_BAJA" "$LIMITES"
      tramo $BASE cierre-pc-hoy-$v "" ""; tramo $FIN cierre-pc-final-$v "" ""
    fi
    candado_hueco "sigue"; tomar "cierre chrome"
  done
}
doce() {
  tomar "cierre doce"
  paso "12 jugadores desde la página con $FIN"
  MKW_BUILD=$FIN/navegador timeout 10800 node herramientas/prueba-doce-sitio.mjs ${DOCE_ARGS:-} > $DATOS/doce.txt 2>&1
  echo "salida $?"; tail -40 $DATOS/doce.txt
}
r2() {
  paso "subir-r2 en modo revisar (sin red, no sube nada)"
  MKW_BUILD=$FIN/navegador timeout 1800 node herramientas/subir-r2.mjs > $DATOS/r2.txt 2>&1
  echo "salida $?"; tail -25 $DATOS/r2.txt
}

for f in "$@"; do $f; done
echo; echo "=== $(date '+%H:%M:%S') fin de la tanda: $*"
