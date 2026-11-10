#!/bin/bash
# E4c del plan v4 (ítem W25, docs/evaluacion-chicas.md, bitácora §227): las mejoras chicas, medidas JUNTAS.
#
# Resumen: varias mejoras de +1 a +6 % se descartaron porque el ruido de la medida (±5 % en la gama baja) las tapaba.
# Aquí se juntan en un paquete (MKW_CHICAS=c2,c3,c4,c7 de compilar-web.py; c5/c6 son del traductor y van aparte) y se
# compara el paquete contra una base compilada de las MISMAS fuentes sin ninguna chica: así la única diferencia entre los
# dos programas son las chicas. Todo con el candado común (QUIEN=e4c).
# Uso:  bash herramientas/tanda-e4c.sh portar compilar igual medir [sacar] [pgo] [medir-pgo]
#   portar    = pone C2 (texturas BC1) en la aurora del motor (herramientas/e4c/portar-c2.py; si ya está, nada)
#   compilar  = la base (build/web-e4c-base) y el paquete (build/web-e4c-paq), Node y navegador, los dos con --final
#   igual     = las pruebas de igualdad, sin recortar: arranque 13/13 del paquete, la sala con un programa en cada
#               consola (huellas toda la carrera), los fantasmas cuadro por cuadro, la foto igual (con C2 apagado:
#               &texturasBc=0) y C2 aparte con ?texturasBc=verifica (prueba-texturas-bc.mjs)
#   medir     = el tramo fijo (§163) en Chrome, intercalados: la gama baja con la revisión de límites de Android y este
#               PC, &n8=0; E4C_VUELTAS="1 2" (2 pares; en la zona gris −2 a +8 % se suman hasta 6)
#   sacar     = (paso 3, opcional) el paquete sin C2 (&texturasBc=0, en el mismo programa) contra el paquete
#   pgo/igual-pgo/medir-pgo = (paso 4) el perfil sobre la base (el paquete no se adoptó, §228), su igualdad y sus pares
#   foto      = la foto igual con &enganche=0 (?fotoCuadro solo frena sin el enganche al monitor)
# Variables: E4C_WC (terceros/Wiicompiled-motor-h6, rama e2-w10), E4C_CHICAS (c2,c3,c4,c7), E4C_VUELTAS, E4C_EXTRA.
cd "$(dirname "$0")/.."
QUIEN="e4c (local_e4c)"; source herramientas/candado.sh
WC=${E4C_WC:-terceros/Wiicompiled-motor-h6}
CHICAS=${E4C_CHICAS:-c2,c3,c4,c7}
BASE=build/web-e4c-base
PAQ=build/web-e4c-paq
DATOS=build/web/datos/e4c
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }

# el detector de §215: con el primer «error:» se mata ESE compilar (por su número) y la tanda para
compilar_vigilado() {   # $1 = registro, $2 = chicas ("" = la base), el resto = la orden
  local log=$1 ch=$2; shift 2
  MKW_WIICOMPILED=$WC MKW_AURORA=terceros/aurora-main-viejo-motor MKW_CHICAS="$ch" timeout 10800 "$@" > "$log" 2>&1 &
  local pid=$!
  while kill -0 $pid 2>/dev/null; do
    if grep -q 'error:' "$log" 2>/dev/null; then
      local wp=$(cat /proc/$pid/winpid 2>/dev/null)
      [ -n "$wp" ] && taskkill //PID $wp //T //F > /dev/null 2>&1
      kill $pid 2>/dev/null; wait $pid 2>/dev/null
      falla "no compiló ($log)" "$log"
    fi
    sleep 2
  done
  wait $pid; local r=$?
  [ $r -ne 0 ] && falla "compilar-web.py salió con $r ($log)" "$log"
  touch "$log.bien"
}
un_programa() {   # $1 = carpeta, $2 = chicas
  local e=$(basename $1)
  paso "$e: Node (chicas: ${2:-ninguna})"
  compilar_vigilado $DATOS/compilar-$e-node.log "$2" python herramientas/compilar-web.py --final --carpeta $1
  tail -1 $DATOS/compilar-$e-node.log
  paso "$e: navegador"
  compilar_vigilado $DATOS/compilar-$e-navegador.log "$2" python herramientas/compilar-web.py --final --modo navegador --carpeta $1
  tail -1 $DATOS/compilar-$e-navegador.log
  # las semillas y las imágenes de la base de la etapa (no son del programa: el juego las lee igual)
  for f in pipelines.bin bloques.json; do cp -f build/web-e2w10/navegador/$f $1/navegador/ 2>/dev/null; done
  [ -d build/web-e2w10/navegador/imagenes ] && cp -rf build/web-e2w10/navegador/imagenes $1/navegador/
}
compilar() {
  tomar "e4c compilar"
  un_programa $BASE ""
  un_programa $PAQ "$CHICAS"
  ls -la $BASE/navegador/mkw.wasm $PAQ/navegador/mkw.wasm
}

sin_mal() { local t; t=$(cat); echo "$t"; local m=$(echo "$t" | grep -oE '[0-9]+ mal' | tail -1 | grep -oE '^[0-9]+'); [ "${m:-0}" -gt 0 ] && falla "$1: $m mal"; return 0; }

igual() {
  for d in $BASE $PAQ; do [ -f $d/navegador/mkw.wasm ] && [ -f $d/node/mkw.wasm ] || falla "falta $d (¿compilar?)"; done
  tomar "e4c igual"
  paso "prueba-arranque con el paquete (Node)"
  MKW_BUILD_NODE=$PAQ/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4 | sin_mal "prueba-arranque"
  paso "la sala: A = el paquete, B = la base (la huella toda la carrera)"
  MKW_BUILD=$PAQ/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
    --datos=$DATOS/sincro --build-b=$BASE/navegador 2>&1 | tail -20
  candado_hueco "sigue"; tomar "e4c igual fantasmas"
  paso "los fantasmas, cuadro por cuadro: A = el paquete, B = la base"
  MKW_BUILD=$PAQ/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
    --puerto 8178 2>&1 | tail -12
  paso "la foto igual, con C2 apagado en el paquete (&texturasBc=0)"
  MKW_BUILD=$PAQ/navegador MKW_BUILD_B=$BASE/navegador timeout 1800 node web/navegador/prueba-foto-igual.mjs \
    --extra-a='&cortina=0&texturasBc=0' --extra-b='&cortina=0' --cuadros 600,1500,2400 --puerto 8178 2>&1 | tail -12
  paso "C2 aparte: cada BC1 contra la RGBA8 de siempre (?texturasBc=verifica)"
  MKW_BUILD=$PAQ/navegador timeout 1500 node web/navegador/prueba-texturas-bc.mjs --puerto 8178 2>&1 | tail -12
}

tramo() {   # $1 programa, $2 etiqueta, $3 lastre, $4 banderas de Chrome, $5 más parámetros
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8178 --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&n8=0$3$5$E4C_EXTRA" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}
medir() {   # $1 = programa nuevo, $2 = su etiqueta, $3 = parámetros del nuevo (sacar)
  local NUEVO=${1:-$PAQ} E=${2:-paq} X=$3 VIEJO=${4:-$BASE} XV=$5
  tomar "e4c medir $E"
  for v in ${E4C_VUELTAS:-1 2}; do   # regla del dueño (2026-11-02): 2 pares; más solo en la zona gris
    paso "vuelta $v: la gama baja (con la revisión de límites) y este PC, base y $E"
    if [ $((v % 2)) = 1 ]; then
      tramo $VIEJO $E-baja-base-$v "$GAMA_BAJA" "$LIMITES" "$XV"; tramo $NUEVO $E-baja-nuevo-$v "$GAMA_BAJA" "$LIMITES" "$X"
      tramo $NUEVO $E-pc-nuevo-$v "" "" "$X"; tramo $VIEJO $E-pc-base-$v "" "" "$XV"
    else
      tramo $NUEVO $E-baja-nuevo-$v "$GAMA_BAJA" "$LIMITES" "$X"; tramo $VIEJO $E-baja-base-$v "$GAMA_BAJA" "$LIMITES" "$XV"
      tramo $VIEJO $E-pc-base-$v "" "" "$XV"; tramo $NUEVO $E-pc-nuevo-$v "" "" "$X"
    fi
    candado_hueco "sigue"; tomar "e4c medir $E"
  done
}

# Paso 4 (C1, PGO): el paquete del paso 2 no se adoptó (§228), así que el perfil va sobre la BASE. Como tanda-w4.sh
# (§198), pero con el motor de la etapa (E4C_WC) y con --final en los tres programas: el que cuenta, el perfil y el que
# lo usa tienen la misma forma (la huella de cada función tiene que calzar). El perfil lleva nombres del juego: fuera
# del repositorio (la carpeta temporal), nunca a git.
PGO=build/web-e4c-pgo
PROF=${E4C_PROF:-C:/Users/zilon/AppData/Local/Temp/mkw-pgo-e4c}
pgo() {
  mkdir -p "$PROF"; tomar "e4c pgo"
  paso "el programa de Node que cuenta las ramas → build/web-e4c-pgo-gen/node"
  # sin --final (sin la ventana fija ni ThinLTO, como W4): con --final el programa que cuenta se cae al escribir el perfil
  # («memory access out of bounds» al escribir el perfil, §228.1; sin --final también, pero ya con los contadores escritos). El perfil marca cada función por la
  # forma de su código fuente, no por cómo se enlaza: sirve para el programa --final
  # (si ya está armado de una corrida anterior, no se rearma: borrar $DATOS/pgo-gen.log.bien para forzarlo)
  [ -f $DATOS/pgo-gen.log.bien ] && [ -f build/web-e4c-pgo-gen/node/mkw.wasm ] || \
  MKW_LTO= MKW_CFLAGS_EXTRA="-fprofile-instr-generate" MKW_LDFLAGS_EXTRA="-fprofile-instr-generate" compilar_vigilado \
    $DATOS/pgo-gen.log "" python herramientas/compilar-web.py --carpeta build/web-e4c-pgo-gen
  rm -f $PROF/*.profraw
  for g in a b c; do
    paso "perfil $g (build/web/datos/w4/guion-$g.txt)"
    timeout 3600 node herramientas/correr-guion.mjs --build build/web-e4c-pgo-gen/node --guion build/web/datos/w4/guion-$g.txt \
      --cuadros 6600 --log $DATOS/perfil-$g.log --perfil $PROF/perfil-$g.profraw | tail -3
    node herramientas/profraw-v11.mjs $PROF/perfil-$g.profraw $PROF/v11-$g.profraw || falla "profraw-v11 $g"
  done
  herramientas/emsdk/upstream/bin/llvm-profdata.exe merge -o $PROF/mkw.profdata $PROF/v11-*.profraw || falla "merge"
  herramientas/emsdk/upstream/bin/llvm-profdata.exe show $PROF/mkw.profdata | tail -3
  candado_hueco "sigue"; tomar "e4c pgo usar"
  local f="-fprofile-instr-use=$PROF/mkw.profdata -Wno-profile-instr-unprofiled -Wno-profile-instr-out-of-date -mllvm -hot-cold-split=true"
  paso "node y navegador con el perfil → $PGO"
  MKW_CFLAGS_EXTRA="$f" compilar_vigilado $DATOS/pgo-usar-node.log "" python herramientas/compilar-web.py --final --carpeta $PGO
  MKW_CFLAGS_EXTRA="$f" compilar_vigilado $DATOS/pgo-usar-navegador.log "" python herramientas/compilar-web.py --final --modo navegador --carpeta $PGO
  for f2 in pipelines.bin bloques.json; do cp -f build/web-e2w10/navegador/$f2 $PGO/navegador/ 2>/dev/null; done
  [ -d build/web-e2w10/navegador/imagenes ] && cp -rf build/web-e2w10/navegador/imagenes $PGO/navegador/
  ls -la $BASE/navegador/mkw.wasm $PGO/navegador/mkw.wasm
}
igual_pgo() {
  tomar "e4c igual pgo"
  paso "prueba-arranque con PGO (Node)"
  MKW_BUILD_NODE=$PGO/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4 | sin_mal "prueba-arranque"
  paso "la sala: A = PGO, B = la base"
  MKW_BUILD=$PGO/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
    --datos=$DATOS/sincro-pgo --build-b=$BASE/navegador 2>&1 | tail -20
  candado_hueco "sigue"; tomar "e4c igual pgo"
  paso "los fantasmas: A = PGO, B = la base"
  MKW_BUILD=$PGO/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
    --puerto 8178 2>&1 | tail -12
  paso "la foto igual: A = PGO, B = la base (&enganche=0)"
  MKW_BUILD=$PGO/navegador MKW_BUILD_B=$BASE/navegador timeout 1800 node web/navegador/prueba-foto-igual.mjs \
    --extra-a='&cortina=0&enganche=0' --extra-b='&cortina=0&enganche=0' --cuadros 600,1500,2400 --puerto 8178 2>&1 | tail -14
}

# §228.2: el programa final con el PGO que ya hace compilar-web.py --final solo (herramientas/pgo_final.py), en
# build/web-e4c-final, y su igualdad contra el final sin PGO (la base de E4c, compilada con las mismas fuentes)
FINAL=build/web-e4c-final
final() {
  tomar "e4c final"
  paso "el final con PGO (Node): compilar-web.py --final arma o reusa el perfil solo"
  compilar_vigilado $DATOS/final-node.log "" python herramientas/compilar-web.py --final --carpeta $FINAL
  grep -E "^PGO|con PGO" $DATOS/final-node.log | cut -c1-160
  paso "el final con PGO (navegador): el perfil se reusa (el programa que cuenta no cambió)"
  compilar_vigilado $DATOS/final-navegador.log "" python herramientas/compilar-web.py --final --modo navegador --carpeta $FINAL
  grep -E "^PGO|con PGO" $DATOS/final-navegador.log | cut -c1-160
  for x in pipelines.bin bloques.json; do cp -f build/web-e2w10/navegador/$x $FINAL/navegador/ 2>/dev/null; done
  [ -d build/web-e2w10/navegador/imagenes ] && cp -rf build/web-e2w10/navegador/imagenes $FINAL/navegador/
  ls -la $BASE/navegador/mkw.wasm $FINAL/navegador/mkw.wasm $FINAL/navegador/mkw.wasm.br 2>/dev/null
}
igual_final() {
  tomar "e4c igual final"
  paso "prueba-arranque con el final (Node)"
  MKW_BUILD_NODE=$FINAL/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4 | sin_mal "prueba-arranque"
  paso "la sala: A = el final con PGO, B = el final sin PGO"
  MKW_BUILD=$FINAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178     --datos=$DATOS/sincro-final --build-b=$BASE/navegador 2>&1 | tail -20
  candado_hueco "sigue"; tomar "e4c igual final"
  paso "los fantasmas: A = el final con PGO, B = sin PGO"
  MKW_BUILD=$FINAL/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador     --puerto 8178 2>&1 | tail -12
}

[ $# -eq 0 ] && { sed -n 2,18p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    portar) python -I herramientas/e4c/portar-c2.py || exit 1 ;;
    compilar) compilar ;;
    igual) igual ;;
    medir) medir ;;
    sacar) medir $PAQ sin-c2 "&texturasBc=0" $PAQ "" ;;
    # la foto igual otra vez con &enganche=0: ?fotoCuadro solo frena en la espera por reloj (mkwEsperaReloj); con el
    # enganche al monitor (lo de siempre) la espera es mkwEsperaHasta y el juego no se queda quieto (falló igual en E2)
    foto) tomar "e4c foto"
      paso "la foto igual, con &enganche=0 y C2 apagado en el paquete"
      MKW_BUILD=$PAQ/navegador MKW_BUILD_B=$BASE/navegador timeout 1800 node web/navegador/prueba-foto-igual.mjs \
        --extra-a='&cortina=0&enganche=0&texturasBc=0' --extra-b='&cortina=0&enganche=0' --cuadros 600,1500,2400 \
        --puerto 8178 2>&1 | tail -14 ;;
    pgo) pgo ;;
    igual-pgo) igual_pgo ;;
    medir-pgo) medir $PGO pgo "" $BASE "" ;;
    final) final ;;
    igual-final) igual_final ;;
    *) sed -n 2,18p "$0"; exit 1 ;;
  esac
  candado_hueco "sigue"
done
exit 0
