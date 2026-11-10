#!/bin/bash
# W3 de la etapa 0 del plan v4 (bitácora §200): el techo de dibujar un modelo de la pista en nativo.
#
# Resumen: antes de escribir un dibujo propio, medir lo más que podría ahorrar: lo que cuesta hoy que el juego dibuje el
# modelo de la pista. Un programa aparte (MKW_TECHO_COMPILAR=1, web/juego/techo_dibujo_nativo.cpp) lo esconde antes de
# cada dibujo con MKW_TECHO=1 / ?techo=1 (la imagen queda sin la pista: solo para medir). Si el techo es menos del 2 %
# de la CPU por imagen, W3 se mata sin escribir el dibujo nativo (el umbral de corte del plan).
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w3.sh compilar nombres medir chrome
#   compilar = node y navegador con MKW_TECHO_COMPILAR=1 → build/web-w3 (semillas e imágenes de build/web-w19)
#   nombres  = Node, una carrera: qué modelos carga el juego y si encontró y escondió el de la pista (si no, para)
#   medir    = el tramo fijo en Node, el mismo programa con la pista (0) y sin ella (1), intercalados (6 vueltas)
#   chrome   = el tramo fijo en Chrome: este PC y la gama baja (con la revisión de límites, W5), 0 contra 1, 3 vueltas;
#              y un par en este PC con el perfil de la tarjeta (?perfilGpu=1)
cd "$(dirname "$0")/.."
QUIEN="e0-w3 (local_f84b9b29)"; source herramientas/candado.sh
BASE=${W3_BASE:-build/web-w19}
SAL=${W3_SAL:-build/web-w3}
DATOS=build/web/datos/w3
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
PUERTO=8181

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

compilar() {
  tomar "w3 compilar"
  paso "el programa de Node con el instrumento del techo → $SAL/node"
  MKW_TECHO_COMPILAR=1 motor timeout 5400 python herramientas/compilar-web.py --carpeta $SAL > $DATOS/compilar-node.log 2>&1
  echo "node: salida $?"; tail -2 $DATOS/compilar-node.log
  paso "el programa del navegador con el instrumento del techo → $SAL/navegador"
  MKW_TECHO_COMPILAR=1 motor timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar-navegador.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar-navegador.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
}

nombres() {
  tomar "w3 nombres"
  paso "Node, una carrera con MKW_TECHO=1: los modelos que carga el juego y el de la pista"
  MKW_TECHO=1 timeout 1800 node herramientas/correr-guion.mjs --build $SAL/node --cuadros 3600 \
    --log $DATOS/nombres.log 2>&1 | tail -3
  grep '\[techo\]' $DATOS/nombres.log | sort | uniq -c | head -30
  if ! grep -q '(la pista)' $DATOS/nombres.log; then
    echo "✗ no se encontró el modelo de la pista: no se mide (corregir el nombre en techo_dibujo_nativo.cpp)"; exit 3
  fi
  echo "✓ el modelo de la pista se encontró"
}

medir() {
  tomar "w3 medir"
  paso "el tramo fijo en Node: con la pista (0) y sin ella (1), el mismo programa, intercalados (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 15 --etiqueta w3 \
    --intercalar "con=$SAL/node@MKW_TECHO=0,sin=$SAL/node@MKW_TECHO=1" 2>&1 | tail -15
}

tramo() {   # $1 etiqueta, $2 extra, $3 banderas de Chrome
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$2" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}

chrome() {
  tomar "w3 chrome"
  for v in 1 2 3; do
    paso "vuelta $v: este PC y la gama baja (con la revisión de límites), con la pista y sin ella"
    if [ $((v % 2)) = 1 ]; then
      tramo w3-pc-0-$v "&techo=0" ""; tramo w3-pc-1-$v "&techo=1" ""
      tramo w3-baja-1-$v "$GAMA_BAJA&techo=1" "$LIMITES"; tramo w3-baja-0-$v "$GAMA_BAJA&techo=0" "$LIMITES"
    else
      tramo w3-pc-1-$v "&techo=1" ""; tramo w3-pc-0-$v "&techo=0" ""
      tramo w3-baja-0-$v "$GAMA_BAJA&techo=0" "$LIMITES"; tramo w3-baja-1-$v "$GAMA_BAJA&techo=1" "$LIMITES"
    fi
  done
  paso "este PC con el perfil de la tarjeta: con la pista y sin ella"
  tramo w3-pcgpu-0 "&techo=0&perfilGpu=1" "--disable-dawn-features=timestamp_quantization"
  tramo w3-pcgpu-1 "&techo=1&perfilGpu=1" "--disable-dawn-features=timestamp_quantization"
  grep -h "tarjeta\|techo" $DATOS/w3-pcgpu-*.txt | head -8
}

[ $# -eq 0 ] && { sed -n 2,15p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; nombres) nombres ;; medir) medir ;; chrome) chrome ;;
    *) sed -n 2,15p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
