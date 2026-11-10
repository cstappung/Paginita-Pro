#!/bin/bash
# N8 de la etapa 3 del plan v4 (bitácora §219): simular a 60, dibujar a 30 y mostrar 60 con la interpolación de aurora.
#
# Resumen: el programa de N8 (build/web-n8) es el de la base de E3 (build/web-e2w10: H6 + M7 + la marca de W10 apagada, --final, §220) con web/juego/n8_nativo.cpp
# (con la carrera andando el juego salta uno de cada dos EGG::SceneManager::draw y su copia a la pantalla) y la aurora
# de §219 (la imagen de entre medio en el cuadro dibujado y la de verdad un refresco después). Todo apagado: la página
# lo prende con ?n8=1 (solo dibujar a 30) o ?n8=2 (con la interpolación). Esta tanda lo compila, comprueba que la
# carrera es la misma y lo mide intercalado contra el mismo programa sin N8.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-n8.sh compilar probar igual chrome vista
#   compilar = node y navegador → $SAL (las semillas e imágenes de la base)
#   probar   = prueba-arranque en Node (13 puntos)
#   igual    = los fantasmas cuadro por cuadro con N8 (A ?n8=2 y ?n8=1, B la base) y la sala (A = N8 con ?n8=2, B = la
#              base: la huella toda la carrera)
#   chrome   = el tramo fijo (§163, sin tope, ?dibujarSiempre=1) en este PC y en la gama baja con la revisión de
#              límites (W5): n8 = 0, 1 y 2 en el mismo programa, intercalados (N8_VUELTAS="1 2" = las vueltas)
#   vista    = la carrera a tiempo real (sin tope), 40 s: lo que se ve (imágenes por segundo, refrescos por imagen) y la
#              lógica por segundo, en este PC, en un «aparato que simula 60 pero no dibuja 60» (lastre 2) y en la gama
#              media del plan; n8 = 0 y 2 (y 1)
#   foto     = la foto del mismo cuadro con y sin N8 (prueba-foto-igual: lo que cambia la imagen inventada)
# Variables: N8_SAL (build/web-n8), N8_BASE (build/web-e2w10, §220), N8_WC (terceros/Wiicompiled-motor-h6), N8_ARGS (--final),
#   N8_VUELTAS, N8_EXTRA (más parámetros de la página)
cd "$(dirname "$0")/.."
QUIEN="e3-n8 (local_e3n8)"; source herramientas/candado.sh
BASE=${N8_BASE:-build/web-e2w10}
SAL=${N8_SAL:-build/web-n8}
WC=${N8_WC:-terceros/Wiicompiled-motor-h6}
ARGS=${N8_ARGS:---final}
ETQ=$(basename $SAL | sed 's/^web-//')
DATOS=build/web/datos/e3/$ETQ
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
GAMA_MEDIA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=$WC MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

# (el detector de tanda-h6.sh: con el primer «error:» del registro mata solo ESE proceso y la tanda para con ✗)
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }
compilar_vigilado() {   # $1 = el registro; el resto = la orden
  local log=$1; shift
  motor timeout 7200 "$@" > "$log" 2>&1 &
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
  return 0
}
compilar() {
  tomar "$ETQ compilar"
  # (N8_SOLO_NAVEGADOR=1 = solo el del navegador: lo de N8 en aurora no llega al de Node)
  if [ "${N8_SOLO_NAVEGADOR:-0}" != 1 ]; then
    paso "el programa de Node → $SAL/node"
    compilar_vigilado $DATOS/compilar-node.log python herramientas/compilar-web.py $ARGS --carpeta $SAL
    echo "node: bien"; tail -2 $DATOS/compilar-node.log
  fi
  paso "el programa del navegador → $SAL/navegador"
  compilar_vigilado $DATOS/compilar-navegador.log python herramientas/compilar-web.py $ARGS --modo navegador --carpeta $SAL
  echo "navegador: bien"; tail -2 $DATOS/compilar-navegador.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $BASE/navegador/mkw.wasm $SAL/navegador/mkw.wasm
}

hay_programa() {
  for m in "$@"; do
    local w=$(ls $SAL/$m/*.wasm 2>/dev/null | head -1)
    [ -z "$w" ] && falla "no hay programa en $SAL/$m (¿falló compilar?)"
    local l=$DATOS/compilar-$m.log
    [ -f $l ] && { [ ! -f $l.bien ] || [ $l -nt $l.bien ]; } && falla "el último compilar de $SAL/$m no terminó bien ($l)"
  done
  [ -f $BASE/navegador/mkw.wasm ] || falla "no hay base en $BASE/navegador"
}
sin_mal() { local t; t=$(cat); echo "$t"; local m=$(echo "$t" | grep -oE '[0-9]+ mal' | tail -1 | grep -oE '^[0-9]+'); [ "${m:-0}" -gt 0 ] && falla "$1: $m mal"; return 0; }

probar() {
  tomar "$ETQ probar"
  paso "prueba-arranque con $SAL/node"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4 | sin_mal "prueba-arranque"
}

igual() {
  tomar "$ETQ igual"
  for m in 2 1; do
    paso "los fantasmas, cuadro por cuadro: A = $ETQ con ?n8=$m, B = la base"
    MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
      --extra-a="&n8=$m" --puerto 8188 2>&1 | tail -12
  done
  paso "la sala: A = $ETQ con ?n8=2, B = la base (la huella toda la carrera)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8188 \
    --datos=$DATOS/sincro --build-b=$BASE/navegador --extra-a="&n8=2" 2>&1 | tail -22
}

# el tramo fijo: $1 etiqueta, $2 lastre, $3 banderas de Chrome, $4 parámetros de N8
tramo() {
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8188 --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0&dibujarSiempre=1$2$4$N8_EXTRA" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
  grep -o '\[n8\][^"]*' build/web/datos/medir-sitio/$1-pc.log 2>/dev/null | head -1
}

chrome() {
  tomar "$ETQ chrome"
  for v in ${N8_VUELTAS:-1 2}; do   # regla del dueño (2026-11-02): 2 pares; más solo en la zona gris (−2 a +8 %)
    local orden="0 1 2"; [ $((v % 2)) = 0 ] && orden="2 1 0"
    paso "vuelta $v: la gama baja (con la revisión de límites) y este PC, n8 = $orden"
    for m in $orden; do tramo $ETQ-baja-n$m-$v "$GAMA_BAJA" "$LIMITES" "&n8=$m"; done
    for m in $orden; do tramo $ETQ-pc-n$m-$v "" "" "&n8=$m"; done
  done
}

# a tiempo real: $1 etiqueta, $2 lastre, $3 banderas de Chrome, $4 parámetros de N8
vivo() {
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 40 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8188 --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&anillo=0$2$4$N8_EXTRA" \
    > $DATOS/$1.txt 2>&1
  echo "$1:"; grep -E 'pantalla [0-9]+ Hz|CPU por cuadro|fps en la carrera|últimos 10 s' $DATOS/$1.txt | head -4
  grep -o '\[n8\][^"]*' build/web/datos/medir-sitio/$1-pc.log 2>/dev/null | head -1
}

vista() {
  tomar "$ETQ vista"
  for v in ${N8_VUELTAS:-1 2}; do
    local orden="0 2 1"; [ $((v % 2)) = 0 ] && orden="1 2 0"
    paso "vuelta $v: a tiempo real, este PC, el aparato «simula 60, no dibuja 60» (lastre 2) y la gama media; n8 = $orden"
    for m in $orden; do vivo $ETQ-vivo-pc-n$m-$v "" "" "&n8=$m"; done
    for m in $orden; do vivo $ETQ-vivo-l2-n$m-$v "&lastre=2" "" "&n8=$m"; done
    for m in $orden; do vivo $ETQ-vivo-media-n$m-$v "$GAMA_MEDIA" "$LIMITES" "&n8=$m"; done
  done
}

foto() {
  tomar "$ETQ foto"
  paso "la foto del mismo cuadro: A = $ETQ con ?n8=2, B = la base"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-foto-igual.mjs --build-b=$BASE/navegador \
    --extra-a="&n8=2" --cuadros ${N8_CUADROS:-600,1500,1501,2101} --puerto 8188 2>&1 | tail -24
}

# una mirada rápida (no es medida): el aparato de lastre 2 a tiempo real con ?n8=2 y el informe [n8] del registro
ver() {
  tomar "$ETQ ver"
  paso "mirada: lastre 2 a tiempo real, n8 = 2 y 0"
  vivo $ETQ-ver-l2-n2 "&lastre=2" "" "&n8=2"; vivo $ETQ-ver-l2-n0 "&lastre=2" "" "&n8=0"
  vivo $ETQ-ver-l3-n2 "&lastre=3" "" "&n8=2"; vivo $ETQ-ver-l3-n1 "&lastre=3" "" "&n8=1"; vivo $ETQ-ver-l3-n0 "&lastre=3" "" "&n8=0"
  grep -h 'interp\|\[n8\]' build/web/datos/medir-sitio/$ETQ-ver-l2-n2-pc.log | head -8
}

[ $# -eq 0 ] && { sed -n 2,24p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    probar) hay_programa node ;; igual|chrome|vista|foto|ver) hay_programa navegador ;;
  esac
  case "$fase" in
    compilar) compilar ;; probar) probar ;; igual) igual ;; chrome) chrome ;; vista) vista ;; foto) foto ;; ver) ver ;;
    *) sed -n 2,24p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
