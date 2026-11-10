#!/bin/bash
# E4 del plan v4 (bitácora §222): los techos del dibujo por grupo, antes de decidir W15/W16 (el dibujo en nativo) y W18.
#
# Resumen: un programa aparte (MKW_TECHO_COMPILAR=1, web/juego/techo_dibujo_nativo.cpp) sobre la base de E3/E4
# (build/web-e2w10: H6 + M7 + W10 apagado, --final) que esconde UN grupo solo mientras se dibuja: la pista (?techo=1,
# lo de W3), los efectos (?techo=2) o los modelos de unas opciones de dibujo (?techo=4&techoOp=…: los karts y pilotos
# 0x402, los objetos el resto del grupo 1). Lo que suben los cuadros de lógica por segundo del tramo fijo (§163) es lo
# MÁS que podría ganar dibujar ese grupo en nativo. Se mide siempre con ?dibujarSiempre=1: sin eso la compensación de
# lag de RR casi no dibuja en la gama baja (§207.3) y el techo sale chico (lo que le pasó a W3 en §200).
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-e4.sh compilar nombres chrome [gpu]
#   compilar = node y navegador con MKW_TECHO_COMPILAR=1 sobre terceros/Wiicompiled-motor-h6 (--final) → build/web-e4t
#   nombres  = Node, una carrera con el guion de siempre: cuántos modelos hay por opción de dibujo, y que cada modo
#              esconda algo (si no, para)
#   chrome   = el tramo fijo en Chrome, gama baja (con la revisión de límites, W5) y este PC, intercalados: la base
#              contra cada grupo escondido, E4_VUELTAS vueltas (2; si el resultado no es claro, más)
#   gpu      = este PC con el perfil de la tarjeta (?perfilGpu=1): CPU y tarjeta por imagen, base contra cada grupo
# Variables: E4_SAL (build/web-e4t), E4_BASE (build/web-e2w10), E4_WC (terceros/Wiicompiled-motor-h6),
#   E4_GRUPOS (los grupos de la fase chrome; por omisión «pista efectos karts objetos»), E4_VUELTAS (2), E4_DESDE (1)
cd "$(dirname "$0")/.."
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
QUIEN="e4-islas"; source herramientas/candado.sh
BASE=${E4_BASE:-build/web-e2w10}
SAL=${E4_SAL:-build/web-e4t}
WC=${E4_WC:-terceros/Wiicompiled-motor-h6}
DATOS=build/web/datos/e4
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
PUERTO=8183
# las máscaras de opciones de dibujo (bit k = la opción k de la tabla 0x808B6ED0, §222)
OP_KARTS=0x402                    # 10 (karts y pilotos) + 1 (pilotos transparentes)
OP_OBJETOS=${E4_OP_OBJETOS:-0x3BFBFC}   # el grupo 1 sin la 1: 2-9, 11-17, 19-21 (la pista y el cielo nunca entran)

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=$WC MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

extra_de() {   # el parámetro de la página de cada grupo
  case "$1" in
    base) echo "&techo=0" ;; pista) echo "&techo=1" ;; efectos) echo "&techo=2" ;;
    karts) echo "&techo=4&techoOp=$OP_KARTS" ;; objetos) echo "&techo=4&techoOp=$OP_OBJETOS" ;;
    op0) echo "&techo=4&techoOp=0x1" ;;   # la opción 0: 43 modelos del grupo 0 sin dueño conocido (sin la pista ni el cielo)
    todo) echo "&techo=7&techoOp=0xFFFFFF" ;;
    *) echo "grupo desconocido: $1" >&2; exit 2 ;;
  esac
}

compilar() {
  tomar "e4 compilar"
  paso "el programa de Node con el instrumento de los techos → $SAL/node"
  MKW_TECHO_COMPILAR=1 motor timeout 5400 python herramientas/compilar-web.py --final --carpeta $SAL > $DATOS/compilar-node.log 2>&1
  local s=$?; echo "node: salida $s"; tail -2 $DATOS/compilar-node.log; [ $s = 0 ] || exit 1
  paso "el programa del navegador con el instrumento de los techos → $SAL/navegador"
  MKW_TECHO_COMPILAR=1 motor timeout 5400 python herramientas/compilar-web.py --final --modo navegador --carpeta $SAL > $DATOS/compilar-navegador.log 2>&1
  s=$?; echo "navegador: salida $s"; tail -2 $DATOS/compilar-navegador.log; [ $s = 0 ] || exit 1
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $BASE/navegador/mkw.wasm $SAL/navegador/mkw.wasm
}

nombres() {
  tomar "e4 nombres"
  paso "Node, una carrera sin esconder nada: los modelos por opción de dibujo"
  MKW_TECHO=0 timeout 1800 node herramientas/correr-guion.mjs --build $SAL/node --cuadros 6000 --log $DATOS/nombres-0.log 2>&1 | tail -3
  grep '\[techo\]' $DATOS/nombres-0.log | grep -v ModelDirector | tail -4
  grep '\[techo\] modelo' $DATOS/nombres-0.log | sort | uniq -c | head -20
  grep -q 'dibujo de la carrera' $DATOS/nombres-0.log || { echo "✗ no llegó al dibujo de la carrera"; exit 3; }
  paso "Node, la misma carrera con karts + efectos escondidos (MKW_TECHO=6, máscara $OP_KARTS)"
  MKW_TECHO=6 MKW_TECHO_OP=$OP_KARTS timeout 1800 node herramientas/correr-guion.mjs --build $SAL/node --cuadros 6000 --log $DATOS/nombres-6.log 2>&1 | tail -3
  grep 'dibujo de la carrera' $DATOS/nombres-6.log | tail -3
  grep 'dibujo de la carrera' $DATOS/nombres-6.log | grep -qE 'escondidos [1-9]' || { echo "✗ la máscara no escondió nada"; exit 3; }
  echo "✓ la máscara esconde modelos"
}

tramo() {   # $1 etiqueta, $2 extra, $3 banderas de Chrome
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0&dibujarSiempre=1$2" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}

chrome() {
  local grupos=(${E4_GRUPOS:-pista efectos karts objetos op0})
  for v in $(seq ${E4_DESDE:-1} ${E4_VUELTAS:-2}); do
    tomar "e4 chrome $v"
    paso "vuelta $v: gama baja (con la revisión de límites) y este PC; la base contra cada grupo escondido"
    for ap in baja pc; do
      local gb=""; local fl=""; [ $ap = baja ] && { gb="$GAMA_BAJA"; fl="$LIMITES"; }
      # la base entre medio de los grupos (al principio y al final, en orden contrario cada vuelta)
      local orden=(base "${grupos[@]}" base); [ $((v % 2)) = 0 ] && orden=(base $(printf '%s\n' "${grupos[@]}" | tac) base)
      local i=0
      for g in "${orden[@]}"; do
        i=$((i+1)); local etq="e4-$ap-$g-$v"; [ $g = base ] && etq="e4-$ap-base$i-$v"
        tramo $etq "$gb$(extra_de $g)" "$fl"
      done
    done
    [ $v -lt ${E4_VUELTAS:-2} ] && candado_hueco "sigue"
  done
}

gpu() {
  tomar "e4 gpu"
  paso "este PC con el perfil de la tarjeta: la base y cada grupo"
  for g in base ${E4_GRUPOS:-pista efectos karts objetos op0}; do
    tramo e4-pcgpu-$g "$(extra_de $g)&perfilGpu=1" "--disable-dawn-features=timestamp_quantization"
  done
  grep -h "tarjeta\|techo" $DATOS/e4-pcgpu-*.txt | head -12
}

[ $# -eq 0 ] && { sed -n 2,22p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; nombres) nombres ;; chrome) chrome ;; gpu) gpu ;;
    *) sed -n 2,22p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
