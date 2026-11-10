#!/bin/bash
# H6 de la etapa 2 del plan v4 (bitácora §211): la RAM de la Wii en un lugar fijo de la memoria de wasm.
#
# Resumen: hoy cada lectura de la memoria de la Wii busca su página en una tabla (una carga) y recién con eso sabe dónde
# leer (otra carga que depende de la primera). Con MKW_MOTOR_FIJA (la copia terceros/Wiicompiled-motor-h6, rama e2-h6,
# parches/motor-h6.diff) la MEM1, el módulo de Kamek y la MEM2 viven desde 1 MiB de la memoria de wasm en el mismo orden
# que en la Wii: la dirección es una cuenta (una resta, una comparación y un «y»), sin tabla. Esta tanda compila el
# programa (build/web-h6, compilar-web.py --fija), lo prueba contra la base de la etapa (build/web-w19) y los mide
# intercalados: Node con y sin la revisión de límites de Android (W5), y Chrome en la gama baja y en este PC.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-h6.sh compilar probar igual medir chrome memoria
#   compilar = node y navegador → $SAL (con las semillas e imágenes de la base)
#   probar   = prueba-arranque en Node (13 puntos)
#   igual    = la sala con un programa en cada consola (huellas 75/75) y los fantasmas cuadro por cuadro
#   medir    = el tramo fijo en Node, base contra H6, intercalados: 6 vueltas sin y 6 con --wasm-enforce-bounds-checks
#   chrome   = el tramo fijo en Chrome: este PC (sin bandera) y la gama baja con la revisión de límites (W5), 2 vueltas
#              (H6_VUELTAS="4 5 6 7" = otras, con otras etiquetas)
#   memoria  = la memoria del proceso de Chrome con una pestaña, base y H6 (medir-memoria.mjs --una)
# Variables: H6_SAL (build/web-h6), H6_BASE (build/web-w19), H6_WC (terceros/Wiicompiled-motor-h6), H6_CFLAGS (extra),
#   H6_ARGS (más opciones de compilar-web.py, p. ej. --frio …), H6_FIJA=0 (sin --fija), H6_EXTRA (más parámetros de la
#   página en el tramo de Chrome, p. ej. "&dibujarSiempre=1"), MKW_LTO (los grupos con ThinLTO, M7 §213)
cd "$(dirname "$0")/.."
QUIEN="e2-motor (local_e2e2)"; source herramientas/candado.sh
BASE=${H6_BASE:-build/web-w19}
SAL=${H6_SAL:-build/web-h6}
WC=${H6_WC:-terceros/Wiicompiled-motor-h6}
FIJA=--fija; [ "${H6_FIJA:-1}" = 0 ] && FIJA=   # H6_FIJA=0 = sin la ventana fija (copias viejas del motor, W14 §217)
ETQ=$(basename $SAL | sed 's/^web-//')
DATOS=build/web/datos/e2/$ETQ
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
motor() { MKW_WIICOMPILED=$WC MKW_AURORA=terceros/aurora-main-viejo-motor MKW_CFLAGS_EXTRA="$H6_CFLAGS" "$@"; }

# El detector (pedido del dueño, 2026-11-02: «agrega detector automatico para que sea instantanea la deteccion»):
# compilar_vigilado corre compilar-web.py de fondo y mira su registro cada 2 s; con el primer «error:» mata solo ESE
# proceso (su número de Windows, nunca por nombre) y la tanda entera para con ✗ y las primeras líneas del error. Las
# fases siguientes no corren con un programa que no existe (antes medían en el vacío: «1 bien, 12 mal»).
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
  touch "$log.bien"   # la marca: este compilar terminó bien (el .wasm puede quedar viejo si no cambió nada)
  return 0
}
compilar() {
  tomar "$ETQ compilar"
  paso "el programa de Node → $SAL/node"
  compilar_vigilado $DATOS/compilar-node.log python herramientas/compilar-web.py $FIJA $H6_ARGS --carpeta $SAL
  echo "node: bien"; tail -2 $DATOS/compilar-node.log
  paso "el programa del navegador → $SAL/navegador"
  compilar_vigilado $DATOS/compilar-navegador.log python herramientas/compilar-web.py $FIJA $H6_ARGS --modo navegador --carpeta $SAL
  echo "navegador: bien"; tail -2 $DATOS/compilar-navegador.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $BASE/navegador/mkw.wasm $SAL/navegador/mkw.wasm
}

# antes de probar o medir: los dos programas tienen que existir y su último compilar tiene que haber terminado bien
hay_programa() {   # $@ = qué programas pide la fase (node, navegador)
  for m in "$@"; do
    local w=$(ls $SAL/$m/*.wasm 2>/dev/null | head -1)
    [ -z "$w" ] && falla "no hay programa en $SAL/$m (¿falló compilar?)"
    local l=$DATOS/compilar-$m.log
    [ -f $l ] && { [ ! -f $l.bien ] || [ $l -nt $l.bien ]; } && falla "el último compilar de $SAL/$m no terminó bien ($l)"
  done
  [ -f $BASE/navegador/mkw.wasm ] || falla "no hay base en $BASE/navegador"
}
# una prueba con «N bien, M mal»: M > 0 para la tanda (lo que sigue mediría un programa roto)
sin_mal() { local t; t=$(cat); echo "$t"; local m=$(echo "$t" | grep -oE '[0-9]+ mal' | tail -1 | grep -oE '^[0-9]+'); [ "${m:-0}" -gt 0 ] && falla "$1: $m mal"; return 0; }

probar() {
  tomar "$ETQ probar"
  paso "prueba-arranque con $SAL/node"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4 | sin_mal "prueba-arranque"
}

igual() {
  tomar "$ETQ igual"
  paso "la sala: A = $ETQ, B = la base (la huella toda la carrera)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
    --datos=$DATOS/sincro --build-b=$BASE/navegador 2>&1 | tail -20
  paso "los fantasmas, cuadro por cuadro: A = $ETQ, B = la base"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
    --puerto 8178 2>&1 | tail -12
}

medir() {
  tomar "$ETQ medir"
  paso "el tramo fijo en Node, sin la revisión de límites: $BASE contra $SAL (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 15 --etiqueta $ETQ-pc \
    --intercalar antes=$BASE/node,despues=$SAL/node 2>&1 | tail -15
  candado_hueco "sigue"; tomar "$ETQ medir limites"
  paso "el tramo fijo en Node, con la revisión de límites de Android (W5) (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 15 --etiqueta $ETQ-limites \
    --v8 "--wasm-enforce-bounds-checks" --intercalar antes=$BASE/node,despues=$SAL/node 2>&1 | tail -15
}

tramo() {   # $1 programa, $2 etiqueta, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8178 --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$3$H6_EXTRA" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}

chrome() {
  tomar "$ETQ chrome"
  for v in ${H6_VUELTAS:-1 2}; do   # regla del dueño (2026-11-02): 2 pares; más solo en la zona gris (−2 a +8 %)
    paso "vuelta $v: este PC y la gama baja (con la revisión de límites), base y $ETQ"
    if [ $((v % 2)) = 1 ]; then
      tramo $BASE $ETQ-pc-base-$v "" ""; tramo $SAL $ETQ-pc-nuevo-$v "" ""
      tramo $SAL $ETQ-baja-nuevo-$v "$GAMA_BAJA" "$LIMITES"; tramo $BASE $ETQ-baja-base-$v "$GAMA_BAJA" "$LIMITES"
    else
      tramo $SAL $ETQ-pc-nuevo-$v "" ""; tramo $BASE $ETQ-pc-base-$v "" ""
      tramo $BASE $ETQ-baja-base-$v "$GAMA_BAJA" "$LIMITES"; tramo $SAL $ETQ-baja-nuevo-$v "$GAMA_BAJA" "$LIMITES"
    fi
  done
}

memoria() {
  tomar "$ETQ memoria"
  for b in $BASE $SAL; do
    paso "la memoria de Chrome con $b"
    MKW_BUILD=$b/navegador timeout 1200 node herramientas/medir-memoria.mjs --una --segundos 30 --puerto 8178 \
      > $DATOS/memoria-$(basename $b).txt 2>&1
    tail -8 $DATOS/memoria-$(basename $b).txt
  done
}

[ $# -eq 0 ] && { sed -n 2,19p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    probar|medir) hay_programa node ;; igual|chrome|memoria) hay_programa navegador ;;
  esac
  case "$fase" in
    compilar) compilar ;; probar) probar ;; igual) igual ;; medir) medir ;; chrome) chrome ;; memoria) memoria ;;
    *) sed -n 2,19p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
