#!/bin/bash
# E6 del plan de rendimiento v4 (bitácora §232–): la página liviana y la prueba final (P5, N12, V6, V7).
#
# Resumen: cada fase toma el candado de medición (herramientas/candado.sh, QUIEN=e6) y deja lo medido en
# build/web/datos/e6/. El programa de E6 es el final de E4c (motor terceros/Wiicompiled-motor-h6, aurora
# terceros/aurora-main-viejo-motor, --final con PGO) más P5 del lado del runtime (una sola llamada a la página por
# entrega de sonido, parches/motor-p5.diff) → build/web-e6.
# Fases:
#   compilar  = build/web-e6 (Node y navegador, --final con PGO: el perfil se rehace solo si el programa que cuenta cambió)
#   igual     = prueba-arranque (Node), la sala A = e6 / B = e4c-final (huellas) y los fantasmas iguales
#   gc        = P5: un minuto de carrera con la traza del recolector (prueba-sincro --traza-gc=60), la página nueva contra
#               la de antes (&reciclarSonido=0&informeSonido=8), intercaladas, E6_VUELTAS pares
#   escalera  = los cinco escalones del tramo fijo (§163) con el programa de E6, 2 vueltas (como tanda-n2.sh)
#   escalera-n8 = gama media y baja, con y sin N8, forzando el mismo dibujo de sala en ambos lados (§219)
#   doce      = V7: la sala de 12 (prueba-sala-doce.mjs: 3 juegos de verdad, el último como teléfono de gama media, y
#               9 consolas de mentira con la red de una casa; 3 carreras)
#   hora      = V6: una hora de sala (medir-sesion-larga.mjs --pistas 20) con la memoria y la CPU cada minuto
#   telefono  = V6: una copa entera (4 carreras) con B como teléfono de gama media simulado
# Uso:  bash herramientas/tanda-e6.sh compilar igual gc
cd "$(dirname "$0")/.."
QUIEN="e6 (local_e6final)"; source herramientas/candado.sh
WC=${E6_WC:-terceros/Wiicompiled-motor-h6}
E6=build/web-e6
BASE=build/web-e4c-final
DATOS=build/web/datos/e6
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
SIN_REDONDEO="--disable-dawn-features=timestamp_quantization"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
VUELTAS=${E6_VUELTAS:-1 2}

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }

# el detector de §215: con el primer «error:» se mata ESE compilar (por su número) y la tanda para
compilar_vigilado() {   # $1 = registro, el resto = la orden
  local log=$1; shift
  MKW_WIICOMPILED=$WC MKW_AURORA=terceros/aurora-main-viejo-motor timeout 10800 "$@" > "$log" 2>&1 &
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

compilar() {
  tomar "e6 compilar"
  paso "E6 (Node): --final con PGO"
  compilar_vigilado $DATOS/compilar-node.log python herramientas/compilar-web.py --final --carpeta $E6
  grep -E "^PGO|con PGO" $DATOS/compilar-node.log | cut -c1-160
  paso "E6 (navegador): --final con PGO"
  compilar_vigilado $DATOS/compilar-navegador.log python herramientas/compilar-web.py --final --modo navegador --carpeta $E6
  grep -E "^PGO|con PGO" $DATOS/compilar-navegador.log | cut -c1-160
  for x in pipelines.bin bloques.json; do cp -f $BASE/navegador/$x $E6/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $E6/navegador/
  ls -la $BASE/navegador/mkw.wasm $E6/navegador/mkw.wasm $E6/navegador/mkw.wasm.br 2>/dev/null
}

igual() {
  tomar "e6 igual"
  paso "prueba-arranque (Node)"
  MKW_BUILD_NODE=$E6/node timeout 900 node web/node/prueba-arranque.mjs 2>&1 | tail -4
  paso "la sala: A = E6, B = e4c-final"
  MKW_BUILD=$E6/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
    --datos=$DATOS/sincro-igual --build-b=$BASE/navegador 2>&1 | tail -20
  candado_hueco "sigue"; tomar "e6 igual"
  paso "los fantasmas: A = E6, B = e4c-final"
  MKW_BUILD=$E6/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$BASE/navegador \
    --puerto 8178 2>&1 | tail -12
}

gc() {
  for v in $VUELTAS; do
    for perfil in pc baja; do
    for cual in nuevo viejo; do
      tomar "e6 gc $cual $v"
      local extra=""; [ $cual = viejo ] && extra="&reciclarSonido=0&informeSonido=8"
      [ "$perfil" = baja ] && extra="$extra&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
      local chrome=""; [ "$perfil" = baja ] && chrome="$LIMITES"
      paso "P5 gc $cual (vuelta $v)"
      MKW_CHROME_EXTRA="$chrome" MKW_BUILD=$E6/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
        --datos=$DATOS/gc-$perfil-$cual-$v --traza-gc=60 "--extra=&n8=0$extra" > $DATOS/gc-$perfil-$cual-$v.txt 2>&1
      grep -iE "limpiez|scavenge|mark|gc" $DATOS/gc-$perfil-$cual-$v.txt | tail -6
      candado_hueco "sigue"
    done
    done
  done
}

tramo() {   # $1 etiqueta, $2 lastre, $3 núcleos (vacío = todos), $4 banderas de Chrome, $5 modo N8, $6 extras
  local nucleos=(); [ -n "$3" ] && nucleos=(--nucleos "$3")
  MKW_BUILD=$E6/navegador timeout 1200 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 "${nucleos[@]}" --puerto 8185 --etiqueta "$1" --chrome "$4" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0&perfilGpu=1&n8=${5:-0}$2${6:-}" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
  grep -o 'tarjeta en el tramo (§164).*' $DATOS/$1.txt | head -1
  if [ "${5:-0}" != 0 ]; then grep -F '[n8] tramo' "build/web/datos/medir-sitio/$1-pc.log" | tail -1; fi
}

# V4 permite N8 en gama baja y como alternativa en media. Conserva los 12 karts y el tramo fijo.
escalera_n8() {
  # Sin dibujarSiempre RR puede omitir ya tantos dibujos que no quede ninguno para N8.
  # Repetir el mismo tramo en los dos modos y alternar el orden para reducir el sesgo de la tanda.
  local modos modo fijo='&dibujarSiempre=1'
  for v in $VUELTAS; do
    tomar "e6 escalera N8 $v"
    modos='0 2'; [ "$((v % 2))" -eq 0 ] && modos='2 0'
    for modo in $modos; do
      tramo e6-n8-fijo-media-$modo-$v "&lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6" 8 "$SIN_REDONDEO $LIMITES" "$modo" "$fijo"
      tramo e6-n8-fijo-pc-$modo-$v "" "" "$SIN_REDONDEO" "$modo" "$fijo"
      tramo e6-n8-fijo-baja-$modo-$v "&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15" 8 "$SIN_REDONDEO $LIMITES" "$modo" "$fijo"
      candado_hueco "e6 escalera N8"
    done
    candado_hueco "e6 escalera N8"
  done
}
escalera() {
  for v in $VUELTAS; do
    tomar "e6 escalera $v"
    paso "vuelta $v: los cinco escalones"
    tramo e6-pc-$v "" "" "$SIN_REDONDEO"
    tramo e6-tipico-$v "&lastre=2.2" 8 "$SIN_REDONDEO"
    tramo e6-control-tipico-$v "" "" "$SIN_REDONDEO"
    tramo e6-portatil-$v "&lastre=3&ladron=64" 4 "$SIN_REDONDEO"
    tramo e6-control-portatil-$v "" "" "$SIN_REDONDEO"
    tramo e6-media-$v "&lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6" 8 "$SIN_REDONDEO $LIMITES"
    tramo e6-control-media-$v "" "" "$SIN_REDONDEO"
    tramo e6-baja-$v "&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15" 8 "$SIN_REDONDEO $LIMITES"
    candado_hueco "sigue"
  done
}

doce() {
  tomar "e6 doce"
  paso "V7: la sala de 12 (3 juegos + 9 consolas de mentira), 3 carreras"
  MKW_BUILD=$E6/navegador timeout 5400 node web/navegador/prueba-sala-doce.mjs --carreras 3 --puerto 8166 > $DATOS/doce.txt 2>&1
  grep -E "^[✓✗]|juego [0-9]|consolas de mentira|teléfono|bien," $DATOS/doce.txt | tail -40
}
hora() {
  tomar "e6 hora"
  paso "V6: una hora de sala (20 carreras)"
  MKW_BUILD=$E6/navegador timeout 7200 node herramientas/medir-sesion-larga.mjs --pistas 20 --etiqueta hora --puerto 8174 > $DATOS/hora.txt 2>&1
  tail -30 $DATOS/hora.txt
}
telefono() {
  tomar "e6 telefono"
  paso "V6: una copa entera con el teléfono de gama media simulado"
  MKW_BUILD=$E6/navegador timeout 3600 node herramientas/medir-sesion-larga.mjs --pistas 4 --telefono --etiqueta copa-telefono --puerto 8174 > $DATOS/copa-telefono.txt 2>&1
  tail -30 $DATOS/copa-telefono.txt
}

[ $# -eq 0 ] && { sed -n 2,19p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    compilar) compilar ;;
    igual) igual ;;
    gc) gc ;;
    escalera) escalera ;;
    escalera-n8) escalera_n8 ;;
    doce) doce ;;
    hora) hora ;;
    telefono) telefono ;;
    *) echo "fase desconocida: $fase"; sed -n 2,17p "$0"; exit 1 ;;
  esac
done
