#!/bin/bash
# W24 del plan de rendimiento v4 (bitácora §227): el teléfono solo dibuja y un PC de la sala calcula por él.
#
# Resumen: antes de construir, medir lo que viaja por la red. El instrumento de W10 (build/web-e2w10i, MKW_W10_COMPILAR=1
# con la marca de páginas) junta en cada cuadro de la carrera la caja de lo que cambió; con ?w10=7 la manda a un Worker
# que la pega y ahora además mide cuánto se achica (w10-dibujo.js + w24-caja.mjs): la caja cruda, la resta contra lo
# que el otro lado ya tiene + el código de ceros, y deflate (CompressionStream). «[w24]» en el registro de medir-sitio.
# Cada fase toma build/medicion.lock (herramientas/candado.sh, QUIEN=w24); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w24.sh caja compilar dos
#   caja  = la carrera directa de 12 CPU (pista 0.0, semilla 1234), w10=7, 20 s: este PC y la gama baja (límites de
#           Android); también en las pistas 13.2, 30.2 y 50.2 (la puerta 1 de §227: varias pistas)
#   compilar = el instrumento de W24 → build/web-w24 (MKW_W10_COMPILAR=1, --fija, el motor de terceros/Wiicompiled-motor-w24:
#           la rama e2-w10 + g_mkwW24Solo y el registro de los sueños del hilo principal; parches/motor-w24.diff)
#   dos   = la parte B con el bucle propio (prueba-w10-dos --extra "&bucle=1"): A calcula y dibuja, B solo pega y dibuja;
#           la foto de B igual a la de A en los cuadros 900 y 1500; después el tramo con B dibujando
cd "$(dirname "$0")/.."
QUIEN="w24 (local_e24)"; source herramientas/candado.sh
PROG=${W24_PROG:-build/web-e2w10i}
DATOS=build/web/datos/w24
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
PUERTO=8187

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

# $1 etiqueta, $2 extra, $3 banderas de Chrome, $4 segundos, $5 pista
tramo() {
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$PROG/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos ${4:-20} \
    --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=${5:-0.0}&semilla=1234&soloCpu=1&cpu=maximo&tramo=600-2400&anillo=0&cortina=0&n8=0$2" \
    > $DATOS/$1.txt 2>&1
  echo "$1: salida $?"
  grep -h "\[w24\]\|\[w10\] modo" build/web/datos/medir-sitio/$1-pc.log 2>/dev/null | tail -3
}

caja() {
  tomar "w24 caja"
  paso "la caja y su compresión, este PC (pista 0.0 y 13.2)"
  tramo w24-caja-pc "&w10=7" "" 30 0.0
  tramo w24-caja-pc-132 "&w10=7" "" 30 13.2
  tramo w24-caja-pc-302 "&w10=7" "" 30 30.2
  tramo w24-caja-pc-502 "&w10=7" "" 30 50.2
  candado_hueco "sigue"
  paso "la caja y su compresión, gama baja (límites)"
  tramo w24-caja-baja "$GAMA_BAJA&w10=7" "$LIMITES" 60 0.0
}

compilar() {
  tomar "w24 compilar"
  paso "el instrumento de W24 → build/web-w24/navegador"
  MKW_W10_COMPILAR=1 MKW_WIICOMPILED=terceros/Wiicompiled-motor-w24 MKW_AURORA=terceros/aurora-main-viejo-motor     timeout 7200 python herramientas/compilar-web.py --modo navegador --fija --carpeta build/web-w24 > $DATOS/compilar.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar.log
  for f in pipelines.bin bloques.json; do cp -f build/web-e2w10i/navegador/$f build/web-w24/navegador/ 2>/dev/null; done
  [ -d build/web-e2w10i/navegador/imagenes ] && cp -rf build/web-e2w10i/navegador/imagenes build/web-w24/navegador/
  node herramientas/comprimir-build.mjs build/web-w24/navegador > /dev/null 2>&1 || true
}

dos() {
  tomar "w24 dos"
  paso "la parte B con el bucle propio: la foto igual (cuadros 900 y 1500)"
  MKW_BUILD=build/web-w24/navegador timeout 2400 node web/navegador/prueba-w10-dos.mjs --alto 900,1500 --ventana     --puerto $PUERTO --extra "&bucle=1" > $DATOS/dos-bucle.txt 2>&1
  echo "salida $?"; grep -vE "audio|AUDIO" $DATOS/dos-bucle.txt | tail -40
}

for f in "$@"; do
  case $f in
    caja) caja ;; compilar) compilar ;; dos) dos ;;
    *) echo "fase desconocida: $f"; exit 2 ;;
  esac
done
