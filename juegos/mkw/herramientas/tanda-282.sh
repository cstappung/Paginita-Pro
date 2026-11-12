#!/bin/bash
# §282 — Las llamadas indirectas con contrato: el traductor sabe qué registros de la Wii puede tocar cada `bctrl`.
#
# Resumen: la copia terceros/Wiicompiled-motor-ind (rama motor-ind = la copia «-403s» de §277 + parches/motor-ind.diff)
# trae el interruptor MKW_IND del traductor (translator/src/Translator.Core/Analysis/IndirectCallPolicy.cs):
#   0       = como siempre: cada llamada indirecta es una «cerca completa» (lee y escribe todo el estado)
#   techo   = la cota optimista, SOLO PARA MEDIR: toda indirecta cumple la regla de la Wii (EABI) sin probarlo
#   cerca   = solo se saca la cerca; la llamada puede escribir cualquier registro
#   prueba  = el contrato demostrado: la unión de los contratos de todos los destinos posibles (lo que vale)
# Cada modo es otra traducción en la misma carpeta generated/ de la copia: se traduce, se compila y recién después se
# traduce el siguiente.
# Uso:  IND=techo ETQ=techo bash herramientas/tanda-282.sh traducir contar compilar node
#       ETQ=techo bash herramientas/tanda-282.sh medir-node chrome fantasma sincro
#   traductor = compila el traductor de la copia y corre sus pruebas (sin candado: es chico)
#   traducir  = la traducción con MKW_IND=$IND (candado: ocupa todo el procesador ~20 min)
#   contar    = cuántas lecturas/escrituras de ctx-> quedaron en el C++ (contra la copia -403s)
#   compilar  = el programa del navegador build/web-282-$ETQ (candado)
#   base      = el programa de comparación de HOY, de la copia -403s sin cambios: build/web-282-base (candado)
#   node      = el programa de Node build/web-282-$ETQ/node (candado)
#   medir-node= el filtro rápido de §166, intercalado contra build/web-282-base/node
#   chrome    = el tramo fijo de §163 en este PC a toda potencia, A/B intercalados (I282_VUELTAS="1 2" = 2 pares)
#   fantasma  = prueba-fantasma-igual: el publicado (build/web-final-w30) contra build/web-282-$ETQ, cuadro por cuadro
#   sincro    = prueba-sincro --directa: build/web-282-$ETQ contra el publicado (--build-b), las huellas toda la carrera
cd "$(dirname "$0")/.."
QUIEN="trad-ind (local_cb5459c6-282)"; source herramientas/candado.sh
WCI=terceros/Wiicompiled-motor-ind
WCS=terceros/Wiicompiled-motor-w30-403s
ETQ=${ETQ:-techo}
IND=${IND:-$ETQ}
FINAL=build/web-final-w30/navegador   # el publicado: las semillas, las imágenes y la vara de la igualdad
DATOS=build/web/datos/ind-282
mkdir -p "$DATOS"
EXTRA="&anillo=0&dibujarSiempre=1&n8=0${I282_EXTRA}"   # como §277: los dos dibujan cada cuadro, sin N8
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
export DOTNET_ROLL_FORWARD=Major DOTNET_CLI_TELEMETRY_OPTOUT=1

tomar() { candado_soltar > /dev/null; candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; }
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }

# compila de fondo y mira el registro cada 2 s: con el primer «error:» corta SOLO ese proceso (su número)
compilar_vigilado() {   # $1 = registro, $2 = copia; el resto = la orden
  local log=$1 wc=$2; shift 2
  MKW_WIICOMPILED=$wc MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 "$@" > "$log" 2>&1 &
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
  grep -q "build stopped\|FAILED" "$log" && falla "el registro dice que falló ($log)" "$log"   # sale con 0 aunque falle
  return 0
}
semillas() {   # $1 = carpeta del navegador
  for f in pipelines.bin bloques.json; do cp -f $FINAL/$f $1/; done
  cp -rf $FINAL/imagenes $1/
  node herramientas/comprimir-build.mjs $1 > /dev/null 2>&1 || true
  ls -la --time-style=+%H:%M $1/mkw.wasm
}

traductor() {
  paso "el traductor de $WCI y sus pruebas"
  timeout 900 dotnet build -c Release -v q $WCI/translator/src/Translator.Cli/Translator.Cli.csproj \
    > $DATOS/traductor.log 2>&1 || { tail -20 $DATOS/traductor.log; exit 1; }
  timeout 2400 dotnet test -c Release -v q $WCI/translator/tests/Translator.Tests/Translator.Tests.csproj \
    > $DATOS/traductor-pruebas.log 2>&1
  echo "pruebas del traductor: salida $?"; grep -E "Passed!|Failed!|Correctas|Con error|error" $DATOS/traductor-pruebas.log | tail -6
}

traducir() {
  tomar "282 traducir $IND"
  paso "traducir con MKW_IND=$IND en $WCI"
  local payload="$(pwd -W 2>/dev/null || pwd)/build/rr_wfc_payload-n15.bin"
  MKW_IND=$IND MKW_WIICOMPILED="$(echo "$WCI" | tr / '\\')" MKW_RR_PAYLOAD="$payload" timeout 3600 powershell -NoProfile \
    -ExecutionPolicy Bypass -File herramientas/traducir.ps1 > $DATOS/traducir-$ETQ.log 2>&1
  local r=$?
  echo "traducir: salida $r"; tail -3 $DATOS/traducir-$ETQ.log
  grep -h "\[282\]" $DATOS/traducir-$ETQ.log | head -20
  candado_soltar > /dev/null
  [ $r -ne 0 ] && falla "la traducción falló ($DATOS/traducir-$ETQ.log)"
  echo "$IND" > $WCI/generated/.mkw-ind
}

contar() {   # el C++ generado: lecturas y escrituras del estado de la consola
  paso "lo que quedó en el C++ (el cuerpo de las funciones del juego y de RR)"
  for c in $WCS $WCI; do
    local base="$c/generated/build_shards" rr="$c/build/mods/retro_rewind_full_cpp/cpp"
    local lee=$(cat $base/*/*.cpp $rr/*.cpp 2>/dev/null | grep -oE '= ctx->(gpr|fpr)\[[0-9]+\]' | wc -l)
    local esc=$(cat $base/*/*.cpp $rr/*.cpp 2>/dev/null | grep -oE 'ctx->(gpr|fpr)\[[0-9]+\] = ' | wc -l)
    local esp=$(cat $base/*/*.cpp $rr/*.cpp 2>/dev/null | grep -oE '= ctx->(cr|ctr|xer|lr);' | wc -l)
    echo "$c ($(cat $c/generated/.mkw-ind 2>/dev/null || echo 0)): lecturas gpr/fpr $lee · escrituras $esc · lecturas cr/ctr/xer/lr $esp"
  done | tee -a $DATOS/contar.txt
}

compilar_uno() {   # $1 = copia, $2 = carpeta
  tomar "282 compilar $(basename $2)"
  paso "$1 → $2/navegador"
  compilar_vigilado $DATOS/compilar-$(basename $2).log $1 python herramientas/compilar-web.py --fija --modo navegador --carpeta $2
  semillas $2/navegador
  candado_soltar > /dev/null
}
node_uno() {
  tomar "282 node $(basename $2)"
  paso "$1 → $2/node"
  compilar_vigilado $DATOS/compilar-$(basename $2)-node.log $1 python herramientas/compilar-web.py --fija --carpeta $2
  ls -la --time-style=+%H:%M $2/node/*.wasm | head -1
  candado_soltar > /dev/null
}

medir_node() {
  tomar "282 medir-node $ETQ"
  paso "Node (filtro), el tramo fijo, intercalados: base contra $ETQ"
  timeout 10800 node herramientas/medir-node-estable.mjs --fijo --corridas ${I282_CORRIDAS:-4} --tope-min 15 \
    --etiqueta ind282-$ETQ --intercalar "base=build/web-282-base/node,$ETQ=build/web-282-$ETQ/node" 2>&1 | tail -12
  candado_soltar > /dev/null
}

tramo() {   # $1 programa, $2 etiqueta
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8182 --etiqueta "$2" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$EXTRA" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}
chrome() {
  local base=build/web-282-base
  for vuelta in ${I282_VUELTAS:-1 2}; do
    tomar "282 chrome $ETQ $vuelta"
    paso "vuelta $vuelta: $ETQ contra base (este PC a toda potencia)"
    if [ $((vuelta % 2)) = 1 ]; then
      tramo build/web-282-$ETQ 282-$ETQ-$vuelta; tramo $base 282-base-$ETQ-$vuelta
    else
      tramo $base 282-base-$ETQ-$vuelta; tramo build/web-282-$ETQ 282-$ETQ-$vuelta
    fi
    candado_soltar > /dev/null
  done
}

fantasma() {
  tomar "282 fantasma $ETQ"
  paso "el fantasma del experto: A = el publicado, B = $ETQ; las fichas de cada cuadro"
  MKW_BUILD=$FINAL timeout 1500 node web/navegador/prueba-fantasma-igual.mjs \
    --build-b=build/web-282-$ETQ/navegador --puerto 8182 --crudas 100000 2>&1 | tee $DATOS/fantasma-$ETQ.txt | tail -14
  candado_soltar > /dev/null
}
sincro() {
  tomar "282 sincro $ETQ"
  paso "la sala: A = $ETQ, B = el publicado ($FINAL), la huella toda la carrera (12 karts)"
  MKW_BUILD=build/web-282-$ETQ/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8182 \
    --build-b=$FINAL --datos=$DATOS/sincro-$ETQ 2>&1 | tee $DATOS/sincro-$ETQ.txt | tail -22
  candado_soltar > /dev/null
}

[ $# -eq 0 ] && { sed -n 2,26p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    traductor) traductor ;; traducir) traducir ;; contar) contar ;;
    compilar) compilar_uno $WCI build/web-282-$ETQ ;; node) node_uno $WCI build/web-282-$ETQ ;;
    base) compilar_uno $WCS build/web-282-base; node_uno $WCS build/web-282-base ;;
    medir-node) medir_node ;; chrome) chrome ;; fantasma) fantasma ;; sincro) sincro ;;
    *) sed -n 2,26p "$0"; exit 1 ;;
  esac
done
exit 0
