#!/bin/bash
# W32, segunda tanda (bitácora §258): la IA de las CPU 1 de cada 2 y 1 de cada 3 cuadros, y el MANEJO de las CPU de cada
# una contra el caso base (pedido del dueño: «al final debiera evaluar el cambio de comportamiento de las cpus vs el caso
# base tambien»).
#
# Resumen: un programa aparte, build/web-w32b (MKW_IA30_COMPILAR=1), con el gancho de web/juego/ia30_nativo.cpp que
# además cuenta, con cualquier modo, las marcas del estado de cada kart CPU cuadro por cuadro (derrapar, el turbo, el
# golpe…) y el cuadro exacto de cada vuelta. ?ia30=0 = el juego tal cual, 2 = uno de cada 2, 3 = uno de cada 3. Como el
# contar está en los tres modos por igual, lo único distinto entre las mediciones es el interruptor.
# Espera a que termine la tanda anterior (tanda-w32.sh, que escribe build/web/datos/w32/tanda-2.out) y después cada fase
# toma build/medicion.lock (herramientas/candado.sh); entre fases y juegos, la fila.
# Uso:  bash herramientas/tanda-w32-tres.sh esperar compilar revisar sincro ganar niveles comparar video
#   esperar  = hasta que tanda-2.out diga que el video de la primera terminó (o 10 h)
#   compilar = build/web-w32b (la línea de hoy: terceros/Wiicompiled-motor; semillas de build/web-w19)
#   revisar  = una carrera corta con ?ia30=3: ¿cuenta las marcas y las vueltas? (si no, el manejo no se puede comparar)
#   sincro   = prueba-sincro --directa con ?ia30=3 (huellas iguales)
#   ganar    = el tramo fijo, 0 / 2 / 3 intercalados (el orden se da vuelta en cada par): gama baja (lastre 3,5 y la
#              revisión de límites de Android) y este PC (W32_PARES, por omisión 2)
#   niveles  = medir-cpu-niveles en los 6 niveles a 150cc, 4 pistas, 2 semillas: base, ia2, ia3 y base2 (el ruido)
#   comparar = herramientas/comparar-ia30.mjs base contra base2 (el ruido), ia2 e ia3 → comparar-tres.txt
#   video    = herramientas/video-ia30.mjs --modos 0,2,3 (las tres lado a lado)
cd "$(dirname "$0")/.."
QUIEN="w32-tres (local_w32)"; source herramientas/candado.sh
SAL=${W32_SAL:-build/web-w32b}
BASE=build/web-w19
DATOS=build/web/datos/w32; mkdir -p $DATOS
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=3.5"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
tomar() { candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; }
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
NIVELES=c150:facil,c150:normal,c150:dificil,c150:maximo,c150:intenso,c150:imposible

esperar() {
  paso "esperando que termine tanda-w32.sh (tanda-2.out)"
  local t=0
  until grep -q "video lado a lado" $DATOS/tanda-2.out 2>/dev/null && tail -1 $DATOS/tanda-2.out | grep -q "suelto\|salida"; do
    sleep 60; t=$((t + 1)); [ $t -gt 600 ] && { echo "(10 h esperando: sigo igual)"; break; }
    # (si la primera murió a medias, su salida no cambia: 4 h quieta = sigo)
    [ $(( $(date +%s) - $(stat -c %Y $DATOS/tanda-2.out) )) -gt 14400 ] && { echo "(tanda-2.out quieta 4 h: sigo)"; break; }
  done
  echo "la primera terminó: $(date '+%H:%M:%S')"
}

compilar() {
  tomar "w32b compilar"
  paso "navegador → $SAL"
  MKW_IA30_COMPILAR=1 MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 \
    python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar-b.log 2>&1
  local s=$?; echo "compilar: salida $s"; tail -2 $DATOS/compilar-b.log
  [ $s = 0 ] || { grep -m5 "error" $DATOS/compilar-b.log; exit 1; }
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $SAL/navegador/mkw.wasm
  candado_soltar
}

revisar() {
  tomar "w32b revisar"
  paso "una carrera con ia30=3: ¿cuenta?"
  MKW_BUILD=$SAL/navegador timeout 1800 node herramientas/medir-cpu-niveles.mjs --puerto 8179 --pestanas 1 \
    --combos c150:maximo --pistas 0.0 --semillas 11 --etiqueta w32b-revisar --extra "&ia30=3" > $DATOS/revisar.txt 2>&1
  echo "salida $?"
  node -e '
    const fs = require("fs"), l = fs.readFileSync("build/web/datos/cpu-niveles-w32b-revisar/carreras.jsonl", "utf8").trim().split("\n").pop();
    const r = JSON.parse(l), b = r.ia30Bits || [], v = r.ia30Vueltas || [];
    console.log("gancho", JSON.stringify(r.ia30Fin), "cuadros de CPU", b[320], "bits activos", b.slice(0, 160).filter(x => x > 0).length);
    console.log("vueltas del 0:", v.slice(0, 9).join(","), " del 11:", v.slice(99, 108).join(","));
    const top = [...Array(160).keys()].filter(k => b[160 + k] > 0).sort((x, y) => b[160 + y] - b[160 + x]).slice(0, 24);
    for (const k of top) console.log(`  ${k >> 5}.${k & 31}: prendido ${(100 * b[160 + k] / b[320]).toFixed(1)} %, se prende ${b[k]} veces`);
    if (!(b[320] > 0) || !(v[1] > 0)) { console.log("NO CUENTA: el manejo no se puede comparar"); process.exit(2); }
  ' > $DATOS/revisar-bits.txt 2>&1
  local s=$?; cat $DATOS/revisar-bits.txt
  [ $s = 0 ] || exit 1
  candado_soltar
}

sincro() {
  tomar "w32b sincro"
  paso "prueba-sincro --directa con ia30=3"
  MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8179 --extra="&ia30=3" > $DATOS/sincro-3.txt 2>&1
  echo "salida $?"; grep -E "✓|✗|puntos" $DATOS/sincro-3.txt | tail -16 | cut -c1-220
  candado_soltar
}

tramo() {   # $1 etiqueta, $2 parámetros extra, $3 banderas de Chrome
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$SAL/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8179 --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$2" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}

ganar() {
  tomar "w32b ganar"
  for p in $(seq 1 ${W32_PARES:-2}); do
    paso "trío $p"
    local orden="0 2 3"; [ $((p % 2)) = 0 ] && orden="3 2 0"
    for m in $orden; do tramo b-baja-ia$m-$p "&ia30=$m$GAMA_BAJA" "$LIMITES"; done
    for m in $orden; do tramo b-pc-ia$m-$p "&ia30=$m" ""; done
    candado_hueco
  done
  candado_soltar
}

niveles() {
  for v in base ia2 ia3 base2; do
    tomar "w32b niveles $v"
    local ia=0; [ $v = ia2 ] && ia=2; [ $v = ia3 ] && ia=3
    paso "niveles $v (ia30=$ia)"
    MKW_BUILD=$SAL/navegador timeout 10800 node herramientas/medir-cpu-niveles.mjs --puerto 8179 --pestanas ${W32_PESTANAS:-3} \
      --combos $NIVELES --pistas 0.0,13.2,20.2,30.2 --semillas 11,22 --etiqueta w32b-$v --traza --extra "&ia30=$ia" \
      > $DATOS/niveles-b-$v.txt 2>&1
    echo "salida $?"; grep -E "^\[|carreras por" $DATOS/niveles-b-$v.txt | tail -3
    candado_soltar
  done
}

comparar() {
  local d=build/web/datos
  node herramientas/comparar-ia30.mjs $d/cpu-niveles-w32b-base $d/cpu-niveles-w32b-base2 $d/cpu-niveles-w32b-ia2 $d/cpu-niveles-w32b-ia3 \
    | tee $DATOS/comparar-tres.txt
}

video() {
  tomar "w32b video"
  paso "video lado a lado: 0, 2 y 3"
  MKW_BUILD=$SAL/navegador timeout 1800 node herramientas/video-ia30.mjs --puerto 8179 --modos 0,2,3 > $DATOS/video-tres.txt 2>&1
  echo "salida $?"; tail -5 $DATOS/video-tres.txt
  candado_soltar
}

for f in "$@"; do $f; done
