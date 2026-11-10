#!/bin/bash
# W32 (plan de rendimiento, bitácora §258): la IA de las CPU piensa uno de cada dos cuadros (la física sigue a 60).
#
# Resumen: un solo programa aparte (build/web-w32, con MKW_IA30_COMPILAR=1: web/juego/ia30_nativo.cpp) que corre igual
# que el de siempre con ?ia30=0 y con la IA cada dos cuadros con ?ia30=1; así lo único distinto entre las dos mediciones
# es el interruptor. Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w32.sh compilar perfil niveles comparar ganar sincro video
#   compilar = build/web-w32 (navegador, la línea de hoy: terceros/Wiicompiled-motor; semillas de build/web-w19)
#   perfil   = medir-sitio --perfilar en el tramo fijo (12 CPU, máximo) con ?ia30=0 y ?ia30=1 → herramientas/peso-ia.mjs
#   niveles  = medir-cpu-niveles en los 6 niveles a 150cc, 4 pistas, 2 semillas: base (ia30=0), ia30 (ia30=1) y base2
#              (ia30=0 otra vez: lo que cambia solo por el azar) → comparar
#   comparar = herramientas/comparar-ia30.mjs base contra base2 (el ruido) y contra ia30
#   ganar    = el tramo fijo, ia30=0 contra ia30=1 intercalados: gama baja (lastre 3,5 y la revisión de límites de
#              Android) y este PC (W32_PARES, por omisión 2)
#   sincro   = prueba-sincro --directa con ?ia30=1 en las dos pestañas (huellas iguales toda la carrera)
#   video    = herramientas/video-ia30.mjs (la misma carrera con y sin, lado a lado, para el dueño)
cd "$(dirname "$0")/.."
QUIEN="w32-ia30 (local_w32)"; source herramientas/candado.sh
SAL=${W32_SAL:-build/web-w32}
BASE=build/web-w19
DATOS=build/web/datos/w32; mkdir -p $DATOS
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=3.5"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
tomar() { candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; }
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
NIVELES=c150:facil,c150:normal,c150:dificil,c150:maximo,c150:intenso,c150:imposible

compilar() {
  tomar "w32 compilar"
  paso "navegador → $SAL"
  MKW_IA30_COMPILAR=1 MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 \
    python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar.log 2>&1
  local s=$?; echo "compilar: salida $s"; tail -2 $DATOS/compilar.log
  [ $s = 0 ] || { grep -m5 "error" $DATOS/compilar.log; exit 1; }
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $SAL/navegador/mkw.wasm
  candado_soltar
}

tramo() {   # $1 etiqueta, $2 parámetros extra, $3 banderas de Chrome, $4 más opciones de medir-sitio
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8179 --etiqueta "$1" "${chrome[@]}" $4 \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$2" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}

perfil() {
  tomar "w32 perfil"
  for ia in 0 1; do
    paso "perfil con ia30=$ia"
    tramo perfil-ia$ia "&ia30=$ia" "" "--perfilar"
    local arch; arch=$(ls -t build/web/datos/medir-sitio/perfil-ia$ia*.cpuprofile 2>/dev/null | head -1)
    [ -n "$arch" ] && node herramientas/peso-ia.mjs "$arch" | tee $DATOS/peso-ia$ia.txt
  done
  candado_soltar
}

niveles() {
  for v in base ia30 base2; do
    tomar "w32 niveles $v"
    local ia=0; [ $v = ia30 ] && ia=1
    paso "niveles $v (ia30=$ia)"
    MKW_BUILD=$SAL/navegador timeout 10800 node herramientas/medir-cpu-niveles.mjs --puerto 8179 --pestanas ${W32_PESTANAS:-3} \
      --combos $NIVELES --pistas 0.0,13.2,20.2,30.2 --semillas 11,22 --etiqueta w32-$v --traza --extra "&ia30=$ia" \
      > $DATOS/niveles-$v.txt 2>&1
    echo "salida $?"; grep -E "^\[|carreras por" $DATOS/niveles-$v.txt | tail -3
    candado_soltar   # (entre los tres juegos, la fila: otra sesión puede medir)
  done
}

comparar() {
  node herramientas/comparar-ia30.mjs build/web/datos/cpu-niveles-w32-base build/web/datos/cpu-niveles-w32-base2 build/web/datos/cpu-niveles-w32-ia30 \
    | tee $DATOS/comparar.txt
}

ganar() {
  tomar "w32 ganar"
  for p in $(seq 1 ${W32_PARES:-2}); do
    paso "par $p"
    if [ $((p % 2)) = 1 ]; then A=0; B=1; else A=1; B=0; fi
    tramo baja-ia$A-$p "&ia30=$A$GAMA_BAJA" "$LIMITES"; tramo baja-ia$B-$p "&ia30=$B$GAMA_BAJA" "$LIMITES"
    tramo pc-ia$A-$p "&ia30=$A" ""; tramo pc-ia$B-$p "&ia30=$B" ""
    candado_hueco
  done
  candado_soltar
}

sincro() {
  tomar "w32 sincro"
  paso "prueba-sincro --directa con ia30=1"
  MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8179 --extra="&ia30=1" > $DATOS/sincro.txt 2>&1
  echo "salida $?"; grep -E "✓|✗|puntos" $DATOS/sincro.txt | tail -16 | cut -c1-220
  candado_soltar
}

video() {
  tomar "w32 video"
  paso "video lado a lado"
  MKW_BUILD=$SAL/navegador timeout 1200 node herramientas/video-ia30.mjs --puerto 8179 > $DATOS/video.txt 2>&1
  echo "salida $?"; tail -4 $DATOS/video.txt
  candado_soltar
}

for f in "$@"; do $f; done
