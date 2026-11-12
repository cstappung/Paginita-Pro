#!/bin/bash
# §280: «decompilar contra traductor», las corridas con el juego (bitácora §280).
#
# Resumen: la opción 1 (una función caliente escrita como C++ común: KColData::checkSphereMovement, 0x807C0884,
# en terceros/decomp-propio/decomp_nativo.cpp, ignorado por git) y la opción 2 (un traductor que junta más funciones chicas: la copia
# terceros/Wiicompiled-motor-eval) se comparan contra la base de §277 (build/web-403-sucios-todo: el traductor de los
# registros sucios + MKW_MOTOR_PR403=62), que es la misma fuente sin el cambio. Cada fase toma el candado de medición
# (herramientas/candado.sh) y lo suelta al terminar, así la fila avanza entre fases.
# Uso:  bash herramientas/tanda-decomp.sh <fases…>
#   compilar   = build/web-decomp (Node y navegador) con MKW_DECOMP_COMPILAR=1 (sin el candado: no mide)
#   igual-node = una carrera de 12 en Node con MKW_DECOMP=2: el comprobador corre las dos versiones en cada llamada y
#                compara registros del ABI, salidas y la memoria entera cada 997 llamadas; imprime cuánto tarda cada una
#   chrome-mismo = el mismo programa en Chrome con ?decomp=0 y =1 (sin diferencias de compilación)
#   eval = la opción 2 en Node: build/web-eval contra la base, intercalados
#   medir-node = el tramo fijo en Node (--fijo), el MISMO programa con MKW_DECOMP=0 y =1, intercalados (DECOMP_VUELTAS)
#   chrome     = el tramo fijo de §163 en Chrome de este PC a toda potencia: base contra web-decomp, A B / B A
#   sincro     = prueba-sincro --directa: web-decomp en una pestaña y el programa publicado en la otra (huellas)
#   fantasma   = prueba-fantasma-igual: la base contra web-decomp, cuadro por cuadro
#   (las mismas fases para la opción 2 con DECOMP_B=build/web-eval: B = ese programa)
# Variables: DECOMP_B (el programa que se prueba; por omisión build/web-decomp), DECOMP_BASE (build/web-403-sucios-todo),
#   DECOMP_VUELTAS (2), DECOMP_DESDE (1: la primera vuelta de Chrome, para sumar pares), DECOMP_ETQ (etiqueta de los archivos; por omisión «decomp»)
cd "$(dirname "$0")/.."
QUIEN="eval-decomp (local_eval280)"; source herramientas/candado.sh
B=${DECOMP_B:-build/web-decomp}
BASE=${DECOMP_BASE:-build/web-403-sucios-todo}
ETQ=${DECOMP_ETQ:-decomp}
FINAL=build/web-final-w30/navegador
DATOS=build/web/datos/decomp
mkdir -p "$DATOS"
EXTRA="&anillo=0&dibujarSiempre=1&n8=0"   # como W30 y §277: los dos dibujan cada cuadro, sin N8
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
tomar() { candado_soltar > /dev/null; candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; }
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

compilar() {
  for modo in node navegador; do
    paso "compilar $B ($modo)"
    local m=(); [ $modo = navegador ] && m=(--modo navegador)
    MKW_DECOMP_COMPILAR=1 MKW_WIICOMPILED=${DECOMP_WC:-terceros/Wiicompiled-motor-w30-403s} MKW_AURORA=terceros/aurora-main-viejo-motor \
      timeout 7200 python herramientas/compilar-web.py --fija "${m[@]}" --carpeta $B > $DATOS/compilar-$ETQ-$modo.log 2>&1 || { tail -20 $DATOS/compilar-$ETQ-$modo.log; exit 1; }
  done
  for f in pipelines.bin bloques.json; do cp -f $FINAL/$f $B/navegador/; done
  cp -rf $FINAL/imagenes $B/navegador/
  node herramientas/comprimir-build.mjs $B/navegador > /dev/null 2>&1 || true
}

igual_node() {
  tomar "$ETQ igual-node"
  paso "Node, una carrera con el comprobador (MKW_DECOMP=2)"
  MKW_DECOMP=2 timeout 3600 node herramientas/correr-guion.mjs --build $B/node \
    --guion build/web/datos/impuesto-perfil/guion-165.txt --cuadros 6000 --log $DATOS/$ETQ-igual-node.log > /dev/null 2>&1
  grep "\[decomp\]" $DATOS/$ETQ-igual-node.log | tail -4
  candado_soltar
}

medir_node() {
  tomar "$ETQ medir-node"
  paso "Node (filtro): el mismo programa, MKW_DECOMP=0 contra =1, intercalados"
  timeout 10800 node herramientas/medir-node-estable.mjs --fijo --corridas ${DECOMP_CORRIDAS:-4} --tope-min 15 --etiqueta $ETQ \
    --intercalar "traducida=$B/node@MKW_DECOMP=0,nueva=$B/node@MKW_DECOMP=1" 2>&1 | tail -14
  candado_soltar
}

tramo() {   # $1 programa, $2 etiqueta
  MKW_BUILD=$1/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8181 --etiqueta "$2" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$EXTRA" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}
chrome() {
  for v in $(seq ${DECOMP_DESDE:-1} ${DECOMP_VUELTAS:-2}); do
    tomar "$ETQ chrome $v"
    paso "vuelta $v: $B contra $BASE (Chrome, este PC)"
    if [ $((v % 2)) = 1 ]; then tramo $B $ETQ-pc-nuevo-$v; tramo $BASE $ETQ-pc-base-$v
    else tramo $BASE $ETQ-pc-base-$v; tramo $B $ETQ-pc-nuevo-$v; fi
    candado_soltar
  done
}

eval_node() {   # la opción 2: el traductor de motor-eval (build/web-eval) contra la base, en Node, intercalados
  tomar "$ETQ eval"
  paso "Node (filtro): la opción 2 (build/web-eval) contra la base ($BASE), intercalados"
  timeout 10800 node herramientas/medir-node-estable.mjs --fijo --corridas ${DECOMP_CORRIDAS:-4} --tope-min 15 --etiqueta $ETQ-eval     --intercalar "base=$BASE/node,eval=build/web-eval/node" 2>&1 | tail -6
  candado_soltar
}

chrome_mismo() {   # el control limpio: el MISMO programa (build/web-decomp) con ?decomp=0 y ?decomp=1, intercalados
  for v in $(seq ${DECOMP_DESDE:-1} ${DECOMP_VUELTAS:-2}); do
    tomar "$ETQ chrome-mismo $v"
    paso "vuelta $v: $B con ?decomp=1 contra ?decomp=0 (Chrome, este PC)"
    if [ $((v % 2)) = 1 ]; then EXTRA="$EXTRA&decomp=1" tramo $B $ETQ-mismo-nueva-$v; EXTRA="$EXTRA&decomp=0" tramo $B $ETQ-mismo-trad-$v
    else EXTRA="$EXTRA&decomp=0" tramo $B $ETQ-mismo-trad-$v; EXTRA="$EXTRA&decomp=1" tramo $B $ETQ-mismo-nueva-$v; fi
    candado_soltar
  done
}

sincro() {
  tomar "$ETQ sincro"
  paso "la misma carrera: A = $B, B = el publicado ($FINAL), las huellas toda la carrera"
  MKW_BUILD=$B/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8181 \
    --build-b=$FINAL --datos=$DATOS/sincro-$ETQ 2>&1 | tail -22
  candado_soltar
}

fantasma() {
  tomar "$ETQ fantasma"
  paso "el fantasma cuadro por cuadro: A = $BASE, B = $B"
  MKW_BUILD=$BASE/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$B/navegador --puerto 8182 2>&1 | tail -14
  candado_soltar
}

for f in "$@"; do
  case $f in
    compilar) compilar ;; igual-node) igual_node ;; medir-node) medir_node ;; chrome) chrome ;;
    sincro) sincro ;; eval) eval_node ;; chrome-mismo) chrome_mismo ;; fantasma) fantasma ;; *) echo "fase desconocida: $f"; exit 1 ;;
  esac
done
