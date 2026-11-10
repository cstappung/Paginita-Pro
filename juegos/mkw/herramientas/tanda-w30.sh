#!/bin/bash
# W30, el piloto (bitácora §257): «igual entre nosotros, no igual a la Wii».
#
# Resumen: la traducción imita el procesador de la Wii al último bit (la FMA exacta, el NI del FPSCR en cada paso a
# float, el redondeo del operando C a 25 bits). En la sala todas las consolas corren el mismo .wasm, así que basta con
# que den lo mismo ENTRE ELLAS. La copia terceros/Wiicompiled-motor-w30 (rama motor-w30, sobre la línea H6 de hoy:
# terceros/Wiicompiled-motor-h6 con sus cambios sin guardar; parches/motor-w30.diff) trae el interruptor MKW_MOTOR_W30
# (runtime/include/mkw_motor.h; bits 1 = FMA, 2 = NI, 4 = 25 bits). Esta tanda compila DOS programas desde esa misma
# copia (la base con MKW_MOTOR_W30=0, idéntica a H6, y el nuevo con W30_BITS), así lo único distinto es el interruptor.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w30.sh compilar probar medir chrome igual fantasma
#   compilar = node y navegador de la base ($BASE) y del nuevo ($SAL), con las semillas e imágenes del programa final
#   probar   = prueba-arranque en Node (13 puntos) con el nuevo
#   medir    = Node (solo filtro): el tramo fijo, base contra nuevo, intercalados, 4 vueltas con la revisión de límites
#   chrome   = el tramo fijo en Chrome: este PC y la gama baja con la revisión de límites (W5), 2 pares intercalados
#              (W30_VUELTAS="3 4" = más pares, para la zona gris)
#   igual    = la justicia: prueba-sincro --directa con el nuevo en las dos pestañas (huellas iguales toda la carrera) y
#              prueba-sala --rapida (dos pestañas, la copa de 2)
#   fantasma = el fantasma del experto (grabado en una Wii real), cuadro por cuadro: base (= la Wii) contra el nuevo
# Variables: W30_BITS (7), W30_SAL (build/web-w30), W30_BASE (build/web-w30-base), W30_EXTRA (más parámetros de la página)
cd "$(dirname "$0")/.."
QUIEN="w30-piloto (local_w30p)"; source herramientas/candado.sh
WC=terceros/Wiicompiled-motor-w30
BITS=${W30_BITS:-7}
BASE=${W30_BASE:-build/web-w30-base}
SAL=${W30_SAL:-build/web-w30}
FINAL=build/web-e6-w29-clip/navegador   # de donde salen las semillas de pipelines y bloques y las imágenes
DATOS=build/web/datos/w30
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
# dibujarSiempre (§217): sin la compensación de lag de RR los dos dibujan cada cuadro (si no, el que no es exacto
# podría dibujar otra cantidad de cuadros y no se comparan); n8=0: las mediciones contra la base, sin N8
EXTRA="&anillo=0&dibujarSiempre=1&n8=0${W30_EXTRA}"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }

# compila de fondo y mira el registro cada 2 s: con el primer «error:» corta SOLO ese proceso (su número, nunca por nombre)
compilar_vigilado() {   # $1 = el registro; $2 = los bits; el resto = la orden
  local log=$1 bits=$2; shift 2
  MKW_WIICOMPILED=$WC MKW_AURORA=terceros/aurora-main-viejo-motor MKW_CFLAGS_EXTRA="-DMKW_MOTOR_W30=$bits" \
    timeout 7200 "$@" > "$log" 2>&1 &
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
un_programa() {   # $1 carpeta, $2 bits, $3 nombre
  paso "$3 (MKW_MOTOR_W30=$2): Node → $1/node"
  compilar_vigilado $DATOS/compilar-$3-node.log $2 python herramientas/compilar-web.py --fija --carpeta $1
  paso "$3 (MKW_MOTOR_W30=$2): navegador → $1/navegador"
  compilar_vigilado $DATOS/compilar-$3-navegador.log $2 python herramientas/compilar-web.py --fija --modo navegador --carpeta $1
  for f in pipelines.bin bloques.json; do cp -f $FINAL/$f $1/navegador/ 2>/dev/null; done
  [ -d $FINAL/imagenes ] && cp -rf $FINAL/imagenes $1/navegador/
  node herramientas/comprimir-build.mjs $1/navegador > /dev/null 2>&1 || true
  ls -la $1/navegador/mkw.wasm
}
compilar() {
  tomar "w30 compilar"
  un_programa $BASE 0 base
  candado_hueco "sigue"; tomar "w30 compilar nuevo"
  un_programa $SAL $BITS nuevo
}

hay_programa() {
  for d in $BASE $SAL; do for m in "$@"; do
    [ -n "$(ls $d/$m/*.wasm 2>/dev/null | head -1)" ] || falla "no hay programa en $d/$m (¿falló compilar?)"
  done; done
}
sin_mal() { local t; t=$(cat); echo "$t"; local m=$(echo "$t" | grep -oE '[0-9]+ mal' | tail -1 | grep -oE '^[0-9]+'); [ "${m:-0}" -gt 0 ] && falla "$1: $m mal"; return 0; }

probar() {
  tomar "w30 probar"
  paso "prueba-arranque con $SAL/node"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4 | sin_mal "prueba-arranque"
}

medir() {
  tomar "w30 medir"
  paso "Node (filtro), el tramo fijo con la revisión de límites: $BASE contra $SAL (4 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 4 --tope-min 15 --etiqueta w30-limites \
    --v8 "--wasm-enforce-bounds-checks" --intercalar antes=$BASE/node,despues=$SAL/node 2>&1 | tail -15
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
  tomar "w30 chrome"
  for v in ${W30_VUELTAS:-1 2}; do   # regla del dueño (2026-11-02): 2 pares; más solo en la zona gris (−2 a +8 %)
    paso "vuelta $v: la gama baja (con la revisión de límites) y este PC, base y nuevo"
    if [ $((v % 2)) = 1 ]; then
      tramo $BASE w30-baja-base-$v "$GAMA_BAJA" "$LIMITES"; tramo $SAL w30-baja-nuevo-$v "$GAMA_BAJA" "$LIMITES"
      tramo $SAL w30-pc-nuevo-$v "" ""; tramo $BASE w30-pc-base-$v "" ""
    else
      tramo $SAL w30-baja-nuevo-$v "$GAMA_BAJA" "$LIMITES"; tramo $BASE w30-baja-base-$v "$GAMA_BAJA" "$LIMITES"
      tramo $BASE w30-pc-base-$v "" ""; tramo $SAL w30-pc-nuevo-$v "" ""
    fi
    candado_hueco "sigue"; tomar "w30 chrome"
  done
}

igual() {
  tomar "w30 igual"
  paso "la justicia: el nuevo en las dos pestañas (la huella toda la carrera, 12 karts)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8179 \
    --datos=$DATOS/sincro 2>&1 | tail -22
  paso "la sala con dos pestañas (la copa de 2, --rapida)"
  MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sala.mjs --rapida --puerto=8179 2>&1 | tail -25
}

fantasma() {
  tomar "w30 fantasma"
  paso "el fantasma del experto: A = la base (la Wii al último bit), B = el nuevo; las fichas de cada cuadro"
  MKW_BUILD=$BASE/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
    --puerto 8179 --crudas 100000 2>&1 | tail -14
  node herramientas/w30-fantasma.mjs build/web/datos/fantasma-igual/$(basename $BASE)-contra-$(basename $SAL).json
}

[ $# -eq 0 ] && { sed -n 2,23p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    probar|medir) hay_programa node ;; igual|chrome|fantasma) hay_programa navegador ;;
  esac
  case "$fase" in
    compilar) compilar ;; probar) probar ;; medir) medir ;; chrome) chrome ;; igual) igual ;; fantasma) fantasma ;;
    *) sed -n 2,23p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
