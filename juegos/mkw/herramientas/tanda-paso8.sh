#!/bin/bash
# Paso 8 (N3/P10/H5, bitácora §186–§189): las tandas de la prueba de la puerta A, con el candado de medición.
# Uso: bash herramientas/tanda-paso8.sh <fase> [<fase> …]
#   espiga     una corrida corta del juego en el Worker (sin ventana): ¿arranca, dibuja, llega a la carrera?
#   huellas    la misma carrera con tope en el Worker y en la página: la huella cuadro por cuadro (§163, 1-3000)
#   pc         el tramo fijo sin tope, este PC: Worker contra página, intercalados, 3 pares
#   baja       lo mismo con la gama baja simulada (lastre 3.5, §155/§162)
#   compartida el programa con memoria compartida (-pthread, build/web-compartida) y, de referencia, el mismo sin ella
#              (build/web-paso8), de las mismas fuentes (las de web-m1: Wiicompiled-motor-m1 + aurora-main-viejo-motor)
#   espiga-c   el de memoria compartida en el Worker, con la página aislada (?aislar=dip)
#   pc-c       el tramo fijo: memoria compartida en el Worker contra el de referencia en la página y en el Worker
#   pruebas    las pruebas de Playwright de la página de siempre que tocan lo cambiado (sonido, controles)
# Cada fase toma y suelta el candado; entre fases, candado_hueco.
cd "$(dirname "$0")/.."
QUIEN="paso8 (local_1064410d)"
source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-m1/navegador}
LOG=build/web/datos/trabajador; mkdir -p $LOG
for fase in "$@"; do
  candado_tomar "paso8 $fase" || exit 1
  case $fase in
    espiga)  node herramientas/medir-trabajador.mjs --sin-ventana --sin-calentar --hilos trabajador --con-tope --huellas 1-600 --segundos 240 --etiqueta espiga > $LOG/espiga.txt 2>&1 & esperar_pid $! ;;
    huellas) node herramientas/medir-trabajador.mjs --con-tope --huellas 1-3000 --segundos 360 --repetir 2 --extra "&reloj=fijo" --etiqueta huellas > $LOG/huellas.txt 2>&1 & esperar_pid $! ;;
    pc)      node herramientas/medir-trabajador.mjs --repetir 3 --etiqueta pc > $LOG/pc.txt 2>&1 & esperar_pid $! ;;
    baja)    node herramientas/medir-trabajador.mjs --repetir ${PARES:-3} --lastre 3.5 --extra "&lastreAyuda=3" --segundos 600 --etiqueta baja > $LOG/baja.txt 2>&1 & esperar_pid $! ;;
    compartida)
      for par in "web-paso8:" "web-compartida:-pthread"; do
        c=${par%%:*}; f=${par#*:}
        MKW_WIICOMPILED=terceros/Wiicompiled-motor-m1 MKW_AURORA=terceros/aurora-main-viejo-motor MKW_CFLAGS_TODO="$f" MKW_LDFLAGS_EXTRA="$f"           timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta build/$c > $LOG/compilar-$c.log 2>&1 & esperar_pid $!
        cp -f build/web-m1/navegador/{pipelines.bin,bloques.json} build/$c/navegador/ 2>/dev/null
        cp -rf build/web-m1/navegador/imagenes build/$c/navegador/ 2>/dev/null
        tail -2 $LOG/compilar-$c.log
      done ;;
    espiga-c) MKW_BUILD=build/web-compartida/navegador node herramientas/medir-trabajador.mjs --sin-ventana --sin-calentar --hilos trabajador --con-tope --huellas 1-600 --segundos 240 --extra "&aislar=dip" --etiqueta espiga-c > $LOG/espiga-c.txt 2>&1 & esperar_pid $! ;;
    pc-c)    for b in web-paso8 web-compartida; do MKW_BUILD=build/$b/navegador node herramientas/medir-trabajador.mjs --repetir 2 --extra "&aislar=dip" --etiqueta pc-$b > $LOG/pc-$b.txt 2>&1 & esperar_pid $!; done ;;
    pruebas) { node banco/correr.mjs sonido-worklet sonido controles trabajador; node web/navegador/prueba-navegador.mjs 1800; } > $LOG/pruebas.txt 2>&1 & esperar_pid $! ;;
  esac
  echo "[paso8] $fase terminó $(date '+%H:%M:%S')"
  candado_soltar
done
