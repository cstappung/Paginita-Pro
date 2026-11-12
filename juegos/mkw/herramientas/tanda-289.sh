#!/bin/bash
# §291: el juego en Opera GX contra Chrome, la misma carrera, intercalados y con el candado.
#
# Resumen: el dueño juega en Opera GX y ahí va mucho peor que en Chrome (con los limitadores de GX apagados). Esta tanda
# mide con herramientas/medir-sala.mjs (--n 1 = Single Player; --n 1 --sala1 = la sala de UN humano con la malla y el
# lockstep) el programa publicado (build/web-final-v22) en los dos navegadores, uno detrás del otro (Chrome, Opera,
# Chrome, Opera…): así la carga de fondo del PC les toca igual a los dos. Cada corrida abre su navegador con un perfil
# nuevo en %TEMP% (nunca el del dueño), sin sonido y en el monitor de 144 Hz.
# Fases:
#   base     Single Player y sala de 1, 1280×720, PAREJAS pares (por omisión 2)
#   personaje la pantalla de personaje de la sala de 1, la de sin sala y la carrera (medir-personaje.mjs)
#   cruce    la sala de 2 con una consola en Chrome y otra en Opera GX (y los controles Chrome+Chrome, Opera+Opera)
#   duenio   como lo tiene el dueño: lienzo 3775×2014 (dpr 1,75), un mando conectado; la sala de 1 con la foto de los
#            mandos arreglada y con «siempre» (= v22, antes de §291), en los dos navegadores
# Uso:  bash herramientas/tanda-289.sh base duenio      → build/web/datos/tanda-289/<fecha>/*.out (+ medir-sala/t289-*.json)
set -u
cd "$(dirname "$0")/.."
QUIEN="opera-gx §291 (local_e197fd59)"; source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-final-v22/navegador}
OUT=build/web/datos/tanda-289/$(date +%Y%m%d-%H%M); mkdir -p "$OUT"
PAREJAS=${PAREJAS:-2}
candado_tomar "tanda-289 $*"
trap candado_soltar EXIT
# una corrida: $1 etiqueta, $2 navegador, el resto = opciones de medir-sala
corre() { local e=$1 nav=$2; shift 2
  echo "== $e ($nav) $*"
  MKW_NAVEGADOR=$nav node herramientas/medir-sala.mjs --ventana --n ${CN:-1} --segundos 30 --asentar 10 --etiqueta "t289-$e" "$@" > "$OUT/$e.out" 2>&1
  grep -E '^N=|§291|✗' "$OUT/$e.out" | cut -c1-400; }
for fase in "$@"; do
  case $fase in
    base) for k in $(seq 1 "$PAREJAS"); do
            for nav in chrome opera-gx; do corre "sp-$nav-$k" $nav; done
            for nav in chrome opera-gx; do corre "sala-$nav-$k" $nav --sala1; done
            candado_hueco; done ;;
    duenio) for k in 1 2; do
              for nav in chrome opera-gx; do
                corre "d-sala-$nav-$k" $nav --sala1 --mando-falso --dpr 1.75 --vista 2157x1151
                corre "d-salaviejo-$nav-$k" $nav --sala1 --mando-falso --dpr 1.75 --vista 2157x1151 --extra "&mandosVentanas=siempre"
              done; candado_hueco; done ;;
    # la pantalla de personaje de la sala (donde el dueño ve «juego 17-35 ms») y la carrera, con medir-personaje.mjs
    personaje) for k in 1 2; do for nav in chrome opera-gx; do echo "== personaje-$nav-$k"
                 MKW_NAVEGADOR=$nav node herramientas/medir-personaje.mjs --ventana --lugares sala-personaje,personaje,carrera > "$OUT/personaje-$nav-$k.out" 2>&1
                 grep -E '^(personaje|sala-personaje|carrera)|fps|imágenes' "$OUT/personaje-$nav-$k.out" | cut -c1-300; done; candado_hueco; done ;;
    # el cruce (crossplay): la sala de 2, una consola en cada navegador (y los dos controles: los dos iguales); la otra
    # dibuja entero (960×540, sin saltarse el dibujo), como un jugador de verdad; se mide la «propia» (la primera)
    cruce) for k in 1 2; do for par in chrome:opera-gx opera-gx:chrome chrome:chrome opera-gx:opera-gx; do
             a=${par%%:*}; b=${par#*:}
             CN=2 corre "cruce-$a-con-$b-$k" $a --navegador-otras $b --vista-otras 960x540 --extra-otras ""; done; candado_hueco; done ;;
    *) echo "fase desconocida: $fase" ;;
  esac
done
echo "listo: $OUT"
