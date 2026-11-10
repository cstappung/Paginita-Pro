#!/bin/bash
# W4 de la etapa 0 del plan v4 (bitácora §198): el piloto de PGO (compilar guiado por un perfil).
#
# Resumen: primero se compila un programa que cuenta cuántas veces pasa por cada rama del código
# (-fprofile-instr-generate); se lo corre en 3 carreras de pistas que el tramo fijo NO usa (el guion de botones lleva a
# otras copas del Grand Prix); los 3 perfiles se juntan (llvm-profdata merge) y el programa de verdad se compila con ese
# perfil (-fprofile-instr-use) y con -mllvm -hot-cold-split=true (los pedazos fríos fuera de las funciones calientes):
# el compilador sabe qué es caliente y qué no. Se compara contra la base de la etapa 0 (build/web-w19) en el tramo fijo
# de Luigi Circuit (la pista que el perfil no vio), en Node, en Chrome en este PC y en la gama baja con la revisión de
# límites (W5), intercalados; y la carrera tiene que salir igual (la sala con un programa en cada pestaña, los fantasmas).
# Se hace con el wasm mismo y no con el programa de Windows (como decía el plan): el perfil de clang 22 para x86 no
# calza con el código de clang 24 para wasm (las funciones se reconocen por una huella de su forma, y cambia con el
# tamaño de los punteros); el de wasm calza exacto.
# El perfil lleva nombres de funciones del juego: queda fuera del repositorio (build/ y la carpeta temporal), nunca a git.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w4.sh gen perfilar usar probar igual medir chrome
#   gen      = el programa de Node que cuenta → build/web-pgo-gen/node
#   perfilar = 3 corridas con los guiones build/web/datos/w4/guion-{a,b,c}.txt → mkw.profdata
#   usar     = node y navegador con el perfil → build/web-pgo (semillas de build/web-w19)
#   probar, igual, medir, chrome = como tanda-w19.sh, contra build/web-w19
cd "$(dirname "$0")/.."
QUIEN="e0-w4 (local_f84b9b29)"; source herramientas/candado.sh
BASE=${W4_BASE:-build/web-w19}
SAL=${W4_SAL:-build/web-pgo}
DATOS=build/web/datos/w4
# sin espacios (MKW_CFLAGS_EXTRA se parte por los espacios) y fuera del repositorio
PROF=${W4_PROF:-C:/Users/zilon/AppData/Local/Temp/mkw-pgo}
PROFDATA=$PROF/mkw.profdata
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
mkdir -p "$DATOS" "$PROF"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

gen() {
  tomar "w4 gen"
  paso "el programa de Node que cuenta las ramas → build/web-pgo-gen/node"
  MKW_CFLAGS_EXTRA="-fprofile-instr-generate" MKW_LDFLAGS_EXTRA="-fprofile-instr-generate" \
    motor timeout 7200 python herramientas/compilar-web.py --carpeta build/web-pgo-gen > $DATOS/gen.log 2>&1
  echo "salida $?"; tail -2 $DATOS/gen.log
}

perfilar() {
  tomar "w4 perfilar"
  rm -f $PROF/*.profraw
  for g in a b c; do
    paso "perfil $g (build/web/datos/w4/guion-$g.txt)"
    timeout 3600 node herramientas/correr-guion.mjs --build build/web-pgo-gen/node --guion $DATOS/guion-$g.txt \
      --cuadros 6600 --log $DATOS/perfil-$g.log --perfil $PROF/perfil-$g.profraw | tail -4
  done
  ls -la $PROF/
  paso "juntar los perfiles → $PROFDATA"
  # la cabecera que escribe el runtime de emscripten es del formato 10 y las fichas del 11: arreglarla (profraw-v11.mjs)
  rm -f $PROF/v11-*.profraw
  for g in a b c; do node herramientas/profraw-v11.mjs $PROF/perfil-$g.profraw $PROF/v11-$g.profraw; done
  herramientas/emsdk/upstream/bin/llvm-profdata.exe merge -o $PROFDATA $PROF/v11-*.profraw
  herramientas/emsdk/upstream/bin/llvm-profdata.exe show $PROFDATA | tail -4
}

usar() {
  tomar "w4 usar"
  local f="-fprofile-instr-use=$PROFDATA -Wno-profile-instr-unprofiled -Wno-profile-instr-out-of-date -mllvm -hot-cold-split=true"
  paso "node con el perfil → $SAL/node"
  MKW_CFLAGS_EXTRA="$f" motor timeout 7200 python herramientas/compilar-web.py --carpeta $SAL > $DATOS/usar-node.log 2>&1
  echo "node: salida $?"; tail -2 $DATOS/usar-node.log
  paso "navegador con el perfil → $SAL/navegador"
  MKW_CFLAGS_EXTRA="$f" motor timeout 7200 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/usar-navegador.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/usar-navegador.log
  for x in pipelines.bin bloques.json; do cp -f $BASE/navegador/$x $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $BASE/node/mkw.wasm $SAL/node/mkw.wasm $BASE/navegador/mkw.wasm $SAL/navegador/mkw.wasm
}

probar() {
  tomar "w4 probar"
  paso "prueba-arranque con $SAL/node"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4
}

igual() {
  tomar "w4 igual"
  paso "la sala: A = PGO, B = la base (la huella toda la carrera)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8179 \
    --datos=$DATOS/sincro --build-b=$BASE/navegador 2>&1 | tail -20
  paso "los fantasmas, cuadro por cuadro: A = PGO, B = la base"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
    --puerto 8179 2>&1 | tail -12
}

medir() {
  tomar "w4 medir"
  paso "el tramo fijo en Node: $BASE contra $SAL, intercalados (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 15 --etiqueta w4 \
    --intercalar antes=$BASE/node,despues=$SAL/node 2>&1 | tail -15
}

tramo() {   # $1 programa, $2 etiqueta, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto ${W4_PUERTO:-8188} --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$3" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}

chrome() {
  tomar "w4 chrome"
  # W4_VUELTAS = qué vueltas (§198: con la gama baja en la zona gris se sumaron la 4, la 5 y la 6)
  for v in ${W4_VUELTAS:-1 2 3}; do
    paso "vuelta $v: este PC y la gama baja (con la revisión de límites), base y PGO"
    if [ $((v % 2)) = 1 ]; then
      tramo $BASE w4-pc-base-$v "" ""; tramo $SAL w4-pc-pgo-$v "" ""
      tramo $SAL w4-baja-pgo-$v "$GAMA_BAJA" "$LIMITES"; tramo $BASE w4-baja-base-$v "$GAMA_BAJA" "$LIMITES"
    else
      tramo $SAL w4-pc-pgo-$v "" ""; tramo $BASE w4-pc-base-$v "" ""
      tramo $BASE w4-baja-base-$v "$GAMA_BAJA" "$LIMITES"; tramo $SAL w4-baja-pgo-$v "$GAMA_BAJA" "$LIMITES"
    fi
  done
}

[ $# -eq 0 ] && { sed -n 2,22p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    gen) gen ;; perfilar) perfilar ;; usar) usar ;; probar) probar ;; igual) igual ;; medir) medir ;; chrome) chrome ;;
    *) sed -n 2,22p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
