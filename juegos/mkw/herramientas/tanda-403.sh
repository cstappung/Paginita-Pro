#!/bin/bash
# El PR #403 de WiiCompiled («port perf fixes from forks», e9fa260c), pieza por pieza (bitácora §277).
#
# Resumen: la copia terceros/Wiicompiled-motor-w30-403 (rama motor-w30-403 = W30 + parches/motor-w30-403.diff) trae las
# piezas del PR con un interruptor, MKW_MOTOR_PR403 (runtime/include/mkw_motor.h; bits 1 NI, 2 tabla hash de las
# indirectas, 4 DVD en bloque, 8 XF en lotes, 16 arreglos de las listas por la página, 32 cubetas de las copias del EFB).
# La pieza del traductor (escribir solo los registros sucios) es otra traducción, en la copia
# terceros/Wiicompiled-motor-w30-403s (su propia carpeta generated/). Así cada programa sale de la MISMA fuente y lo único
# distinto es el interruptor: base = todo apagado = el W30 de hoy.
# Compilar y traducir van SIN el candado (no miden nada; la orquestadora: «el candado solo para medir»); chrome, igual y
# fantasma toman build/medicion.lock (herramientas/candado.sh) y entre variantes, candado_hueco.
# Uso:  bash herramientas/tanda-403.sh compilar chrome igual fantasma
#   compilar = el programa del navegador de cada variante (build/web-403-<nombre>), --fija como W30, con las semillas
#   traducir = la traducción en la copia «s» (el traductor del PR)
#   chrome   = el tramo fijo de §163 en este PC a toda potencia, la base contra cada variante, intercalados (el dueño
#              2026-11-10: «solo haz las pruebas a full potencia y con el oppo»: nada de aparatos simulados; el
#              teléfono va aparte, herramientas/tramo-telefono.mjs) (V403_VUELTAS="1 2" = 2 pares, la regla del dueño)
#   igual    = prueba-sincro --directa: la variante en una pestaña y el programa publicado en la otra (--build-b), las
#              huellas toda la carrera
#   fantasma = el fantasma del experto cuadro por cuadro: la base contra cada variante
#   node     = el programa de Node de cada variante (build/web-403-<nombre>/node; sin candado)
#   medir-node = el filtro rápido (§166): el tramo fijo en Node con --fijo (prioridad alta, 4 núcleos: ±1,5 %), todas
#              las variantes intercaladas en la misma tanda (V403_CORRIDAS vueltas, 4 por omisión). En este PC a toda
#              potencia el tramo de Chrome varía ±10 % entre corridas (otras sesiones usan el procesador): no ve un 2 %
# Variables: V403 = las variantes «nombre:bits[:copia]» (por omisión «base:0 hash:2 hle:60 todo:62»), V403_MEDIR = las
#   que se miden contra base (por omisión todas menos base), V403_EXTRA = más parámetros de la página
cd "$(dirname "$0")/.."
QUIEN="port-403 (local_403a403)"; source herramientas/candado.sh
WC=terceros/Wiicompiled-motor-w30-403
VARIANTES=${V403:-"base:0 hash:2 hle:60 todo:62"}
FINAL=build/web-final-w30/navegador   # el publicado: de ahí las semillas de pipelines y bloques y las imágenes
DATOS=build/web/datos/pr403
mkdir -p "$DATOS"
EXTRA="&anillo=0&dibujarSiempre=1&n8=0${V403_EXTRA}"   # como W30: los dos dibujan cada cuadro, sin N8
export MKW_VENTANA=${MKW_VENTANA:--1880,549}

# cada paso suelta y vuelve a sacar número (nunca retiene el candado entre variantes): candado_hueco no mira la prioridad
# del dueño (build/medicion.prioridad) y así la sesión con prioridad pasa delante apenas termina el par en curso
tomar() {
  candado_soltar > /dev/null
  candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }
nombre() { echo "${1%%:*}"; }
bits() { local r=${1#*:}; echo "${r%%:*}"; }
copia() { local r=${1#*:}; [[ "$r" == *:* ]] && echo "${r#*:}" || echo "$WC"; }
carpeta() { echo "build/web-403-$(nombre $1)"; }

# compila de fondo y mira el registro cada 2 s: con el primer «error:» corta SOLO ese proceso (su número)
compilar_vigilado() {   # $1 = registro, $2 = bits, $3 = copia; el resto = la orden
  local log=$1 b=$2 wc=$3; shift 3
  MKW_WIICOMPILED=$wc MKW_AURORA=terceros/aurora-main-viejo-motor MKW_CFLAGS_EXTRA="-DMKW_MOTOR_PR403=$b" \
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
  return 0
}
compilar() {
  for v in $VARIANTES; do
    local n=$(nombre $v) b=$(bits $v) wc=$(copia $v) d=$(carpeta $v)
    paso "$n (MKW_MOTOR_PR403=$b, $wc) → $d/navegador"
    compilar_vigilado $DATOS/compilar-$n.log $b $wc python herramientas/compilar-web.py --fija --modo navegador --carpeta $d
    for f in pipelines.bin bloques.json; do cp -f $FINAL/$f $d/navegador/; done
    cp -rf $FINAL/imagenes $d/navegador/
    node herramientas/comprimir-build.mjs $d/navegador > /dev/null 2>&1 || true
    ls -la $d/navegador/mkw.wasm
  done
}

traducir() {   # la copia «s»: el traductor con la pieza de los registros sucios y su propia carpeta generated/
  local wcs=${V403_WCS:-terceros/Wiicompiled-motor-w30-403s}
  paso "el traductor de $wcs y su traducción"
  DOTNET_ROLL_FORWARD=Major DOTNET_CLI_TELEMETRY_OPTOUT=1 timeout 900 dotnet build -c Release -v q \
    $wcs/translator/src/Translator.Cli/Translator.Cli.csproj > $DATOS/traductor.log 2>&1 || { tail -20 $DATOS/traductor.log; exit 1; }
  # las pruebas del traductor: las del PR (DirtyRegisterWriteback) y las de los registros de siempre
  DOTNET_ROLL_FORWARD=Major DOTNET_CLI_TELEMETRY_OPTOUT=1 timeout 1800 dotnet test -c Release -v q \
    --filter "FullyQualifiedName~DirtyRegisterWriteback|FullyQualifiedName~RegisterResidency" \
    $wcs/translator/tests/Translator.Tests/Translator.Tests.csproj > $DATOS/traductor-pruebas.log 2>&1
  echo "pruebas del traductor: salida $?"; grep -E "Passed!|Failed!|Correctas|Con error|error" $DATOS/traductor-pruebas.log | tail -4
  local payload="$(pwd -W 2>/dev/null || pwd)/build/rr_wfc_payload-n15.bin"
  MKW_WIICOMPILED="$(echo "$wcs" | tr / '\\')" MKW_RR_PAYLOAD="$payload" timeout 2400 powershell -NoProfile \
    -ExecutionPolicy Bypass -File herramientas/traducir.ps1 > $DATOS/traducir.log 2>&1
  echo "traducir: salida $?"; tail -3 $DATOS/traducir.log
  for c in $WC $wcs; do   # cuántas escrituras de vuelta de registros quedaron en el C++ generado
    echo "$c: $(cat $c/generated/build_shards/*/*.cpp | grep -cE 'ctx->gpr\[[0-9]+\] = r[0-9]+;') escrituras ctx->gpr[n] = rN"
  done
}

node_compilar() {
  for v in $VARIANTES; do
    local n=$(nombre $v) b=$(bits $v) wc=$(copia $v) d=$(carpeta $v)
    paso "$n (MKW_MOTOR_PR403=$b, $wc) → $d/node"
    compilar_vigilado $DATOS/compilar-$n-node.log $b $wc python herramientas/compilar-web.py --fija --carpeta $d
    ls -la $d/node/*.wasm | head -1
  done
}
medir_node() {
  local lados=""
  for v in $VARIANTES; do lados="$lados,$(nombre $v)=$(carpeta $v)/node"; done
  tomar "403 medir-node"
  paso "Node (filtro), el tramo fijo, intercalados: ${lados#,}"
  timeout 10800 node herramientas/medir-node-estable.mjs --fijo --corridas ${V403_CORRIDAS:-4} --tope-min 15     --etiqueta pr403 --intercalar "${lados#,}" 2>&1 | tail -25
  candado_soltar
}

tramo() {   # $1 programa, $2 etiqueta, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8179 --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$3$EXTRA" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}
medibles() { for v in $VARIANTES; do [ "$(nombre $v)" != base ] && echo $v; done; }
chrome() {
  local base=build/web-403-base med=${V403_MEDIR:-$(medibles | xargs -n1 sh -c 'echo ${0%%:*}' | xargs)}
  for vuelta in ${V403_VUELTAS:-1 2}; do
    for n in $med; do
      tomar "403 chrome $n $vuelta"
      paso "vuelta $vuelta: $n contra base (este PC)"
      if [ $((vuelta % 2)) = 1 ]; then
        tramo build/web-403-$n 403-pc-$n-$vuelta "" ""; tramo $base 403-pc-base-$n-$vuelta "" ""
      else
        tramo $base 403-pc-base-$n-$vuelta "" ""; tramo build/web-403-$n 403-pc-$n-$vuelta "" ""
      fi
    done
  done
}

igual() {
  for n in ${V403_IGUAL:-todo}; do
    tomar "403 igual $n"
    paso "la justicia: A = $n, B = el publicado ($FINAL), la huella toda la carrera (12 karts)"
    MKW_BUILD=build/web-403-$n/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8179 \
      --build-b=$FINAL --datos=$DATOS/sincro-$n 2>&1 | tail -22
    candado_hueco "sigue"
  done
}

fantasma() {
  for n in ${V403_IGUAL:-todo}; do
    tomar "403 fantasma $n"
    paso "el fantasma del experto: A = base, B = $n; las fichas de cada cuadro"
    MKW_BUILD=build/web-403-base/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs \
      --build-b=build/web-403-$n/navegador --puerto 8179 --crudas 100000 2>&1 | tail -14
    candado_hueco "sigue"
  done
}

[ $# -eq 0 ] && { sed -n 2,23p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    compilar) compilar ;; traducir) traducir ;; node) node_compilar ;; medir-node) medir_node ;; chrome) chrome ;; igual) igual ;; fantasma) fantasma ;;
    *) sed -n 2,23p "$0"; exit 1 ;;
  esac
done
exit 0
