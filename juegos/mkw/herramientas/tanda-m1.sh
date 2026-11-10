#!/bin/bash
# M1 y M2 del paso 6 (bitácora §182): la memoria de la Wii más barata en wasm, sobre la v0.9.3.
#   M1 = los rangos del traductor y los psq resueltos con la tabla de páginas (antes caían siempre a la función fría)
#   M2 = el camino rápido de Memory::Read*/Write* metido en el código del juego (lo raro queda aparte)
#   VUELTA64 = dar vuelta 8 bytes con una mezcla SIMD en vez de ~22 operaciones de enteros
# Todo vive en la copia terceros/Wiicompiled-motor-m1 (parches/motor-paso6-v093.diff, cabecera runtime/include/mkw_motor.h):
# solo cambian cabeceras del runtime, así que usa la traducción de terceros/Wiicompiled-motor (enlaces generated/ y
# build/ en la copia). Cada arreglo se apaga con MKW_CFLAGS_EXTRA="-DMKW_MOTOR_<NOMBRE>=0" (M1_SIN=… abajo).
# Cada fase toma build/medicion.lock (herramientas/candado.sh) y lo suelta al terminar; entre fases, candado_hueco (§180).
# Uso:  bash herramientas/tanda-m1.sh <fase> [<fase> …]
#   compilar = el programa de Node (build/web-m1$M1_NOMBRE/node), con MKW_CFLAGS_EXTRA si se da
#   probar   = prueba-arranque y una corrida entera que tiene que llegar a la carrera
#   medir    = el tramo fijo en Node, v0.9.3 (build/web-motor/node) contra M1, intercalados (6 vueltas)
#   navegador = el programa del navegador (build/web-m1$M1_NOMBRE/navegador) para la sala y la gama baja
#   equivalencia = la sala con M1 en una pestaña y la v0.9.3 en la otra (prueba-sincro --build-b: la misma huella)
#   chrome   = el tramo fijo en Chrome, este PC y la gama baja simulada, 3 vueltas alternadas
cd "$(dirname "$0")/.."
YO="paso6-M1${M1_NOMBRE} (local_cbaf17f0)"   # con el nombre de la variante: si no, otra tanda mía «ya tenía» el candado
WCM1=${M1_WC:-terceros/Wiicompiled-motor-m1}   # M1_WC = otra copia con más cosas encima (p. ej. Wiicompiled-motor-fma)
BASE=${M1_BASE:-build/web-motor}               # contra qué se compara (M1_BASE=build/web-m1 = sobre M1 ya adoptado)
SAL=build/web-m1${M1_NOMBRE}
DATOS=build/web/datos/m1
mkdir -p "$DATOS"

QUIEN="$YO"; source herramientas/candado.sh
# al tomar el turno se borra el pedido de hueco propio: si queda, la otra sesión lo espera hasta 15 min sin necesidad
tomar() {   # si ya es mío (retenido entre fases), solo anoto la fase; si no, saco número en la fila (§180)
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi   # 6 h: la fila de tres sesiones pasó de 90 min
  grep -qF "local_cbaf17f0" "$HUECO" 2>/dev/null && rm -f "$HUECO"; return 0
}
soltar() { candado_soltar; }
trap soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

compilar() {
  tomar "compilar m1${M1_NOMBRE}"
  paso "el programa de Node con la copia m1 → $SAL/node (MKW_CFLAGS_EXTRA=${MKW_CFLAGS_EXTRA:-nada})"
  MKW_WIICOMPILED=$WCM1 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 5400 \
    python herramientas/compilar-web.py --carpeta $SAL > $DATOS/compilar${M1_NOMBRE}.log 2>&1
  echo "compilar: salida $?"; tail -2 $DATOS/compilar${M1_NOMBRE}.log
}

navegador() {
  tomar "compilar navegador m1${M1_NOMBRE}"
  paso "el programa del navegador con la copia m1 → $SAL/navegador"
  MKW_WIICOMPILED=$WCM1 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 5400 \
    python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/navegador${M1_NOMBRE}.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/navegador${M1_NOMBRE}.log
  # las semillas de pipelines y bloques y las imágenes, como en build/web-motor/navegador (si no, la página espera)
  for f in pipelines.bin bloques.json; do cp -f build/web-motor/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d build/web-motor/navegador/imagenes ] && cp -rf build/web-motor/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
}

probar() {
  tomar "probar m1${M1_NOMBRE}"
  paso "prueba-arranque con $SAL/node, y una corrida entera que tiene que llegar a la carrera"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs
  MKW_BUILD_NODE=$SAL/node timeout 900 node herramientas/medir-node-estable.mjs --corridas 1 --etiqueta m1${M1_NOMBRE}-prueba || exit 1
}

medir() {
  tomar "medir m1${M1_NOMBRE}"
  paso "tramo fijo en Node: $BASE contra M1${M1_NOMBRE}, intercalados (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 12 --etiqueta m1${M1_NOMBRE} \
    --intercalar antes=$BASE/node,despues=$SAL/node
}

equivalencia() {
  tomar "equivalencia m1${M1_NOMBRE}"
  paso "la sala con un programa en cada consola: A = M1, B = la v0.9.3 (la huella toda la carrera)"
  MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8174     --datos=$DATOS/sincro-equivalencia${M1_NOMBRE} --build-b=$BASE/navegador
}

# el tramo fijo de §163 en Chrome (12 CPU, semilla fija, sin tope); $3 = el lastre de la gama baja o nada
tramo_chrome() {
  MKW_BUILD="$1" timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 --ventana     --piloto-espera 600 --nucleos 8 --puerto 8175 --etiqueta "$2"     --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$CHROME_EXTRA$3"
}
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"   # la de §170.2
# los anillos de subida de paso7 (§181) van prendidos desde 5aa3fca; la base build/web-m1 es de antes: los dos sin ellos
# (la base no conoce la marca y no hace nada). M1_CHROME_EXTRA="" = con lo que traiga cada programa.
CHROME_EXTRA=${M1_CHROME_EXTRA-&anillo=0}

chrome() {
  tomar "chrome m1${M1_NOMBRE}"
  for vuelta in 1 2 3; do   # alternadas: la gama baja varía ±12 % de una corrida a otra (§170.2)
    paso "Chrome, este PC y la gama baja simulada, vuelta $vuelta (v0.9.3 y M1)"
    tramo_chrome $BASE/navegador m1${M1_NOMBRE}-pc-base-$vuelta ""
    tramo_chrome $SAL/navegador m1-pc-m1${M1_NOMBRE}-$vuelta ""
    tramo_chrome $SAL/navegador m1-baja-m1${M1_NOMBRE}-$vuelta "$GAMA_BAJA"
    tramo_chrome $BASE/navegador m1${M1_NOMBRE}-baja-base-$vuelta "$GAMA_BAJA"
  done
}

[ $# -eq 0 ] && { sed -n 2,16p "$0"; exit 1; }
n_fase=0
for fase in "$@"; do
  n_fase=$((n_fase+1))
  case "$fase" in
    compilar) compilar ;;
    navegador) navegador ;;
    probar) probar ;;
    medir) medir ;;
    equivalencia) equivalencia ;;
    chrome) chrome ;;
    *) sed -n 2,16p "$0"; exit 1 ;;
  esac
  # entre fases (§180): sigo con el candado salvo que otra sesión pida un hueco o yo lleve más de 45 min con fila
  if [ $n_fase -lt $# ]; then candado_hueco "sigue"; fi
done
