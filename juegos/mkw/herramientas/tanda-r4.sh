#!/bin/bash
# R4 (plan v4, etapa E5; bitácora §230): el lockstep sin basura por cuadro, probado con el juego.
#
# Resumen: con el candado de medición (QUIEN=e5), corre las pruebas de la sala con el juego (el programa de la base de
# E4c) contra el lockstep nuevo (web/navegador/lockstep.mjs) y, para la basura, contra el viejo (el de git, servido en su
# lugar con MKW_SUSTITUIR: la carpeta no se toca). Fases:
#   gc        prueba-sincro --directa con --traza-gc=40 (40 s de carrera con la traza del recolector de Chrome), nuevo y
#             viejo intercalados, 2 pares; cada corrida exige también las huellas iguales de la sala
#   relevo    prueba-relevo --trabas=8 --extra=&arbitro=1 (8 trabas de 1,5 s: cuánto les cuesta a los demás)
#   telefono  3 carreras de prueba-sincro --directa con B «como teléfono» (ventana de teléfono acostado 915×412,
#             ?comoTelefono=1 y el lastre de la gama media): la huella ampliada igual toda la carrera
# Uso:  bash herramientas/tanda-r4.sh gc relevo telefono
# Deja build/web/datos/r4/<etiqueta>.txt (y la carpeta de datos de cada prueba al lado).
cd "$(dirname "$0")/.."
QUIEN="e5 (local_e5)"; source herramientas/candado.sh
export MKW_BUILD=${R4_BUILD:-build/web-e4c-base/navegador}
DATOS=build/web/datos/r4
mkdir -p "$DATOS"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
VIEJO=${R4_VIEJO:-$DATOS/lockstep-viejo.mjs}
git show HEAD:web/navegador/lockstep.mjs > "$VIEJO"           # el lockstep de antes de R4
GAMA_MEDIA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
paso() { echo "== $(date '+%H:%M') $*"; }
resumen() { echo "$1: $(grep -E '^[0-9]+ bien' $DATOS/$1.txt | tail -1) $(grep -o 'basura (§230).*' $DATOS/$1.txt | cut -c1-400)"; grep -E '✗' $DATOS/$1.txt | head -5; }

sincro() {    # $1 etiqueta, $2 «viejo» o «nuevo», resto: argumentos de prueba-sincro
  local et=$1 cual=$2; shift 2
  local sust=""; [ "$cual" = viejo ] && sust="/lockstep.mjs=$(cygpath -w "$PWD/$VIEJO" 2>/dev/null || echo "$PWD/$VIEJO")"
  MKW_SUSTITUIR="$sust" timeout 1200 node web/navegador/prueba-sincro.mjs --directa --puerto=8181 --datos=$DATOS/d-$et "$@" \
    > $DATOS/$et.txt 2>&1
  resumen $et
}

for fase in "$@"; do case $fase in
  gc)
    tomar "e5 r4 gc"
    for v in 1 2; do
      paso "par $v: la basura en 40 s de carrera, el lockstep nuevo y el viejo"
      if [ $((v % 2)) = 1 ]; then sincro gc-nuevo-$v nuevo --traza-gc=40; sincro gc-viejo-$v viejo --traza-gc=40
      else sincro gc-viejo-$v viejo --traza-gc=40; sincro gc-nuevo-$v nuevo --traza-gc=40; fi
      candado_hueco
    done ;;
  relevo)
    tomar "e5 r4 relevo"
    paso "8 trabas de 1,5 s con el árbitro"
    timeout 2400 node web/navegador/prueba-relevo.mjs --trabas=8 --extra=\&arbitro=1 --puerto=8182 > $DATOS/relevo-arbitro.txt 2>&1
    resumen relevo-arbitro
    grep -iE "trab|esper" $DATOS/relevo-arbitro.txt | grep -E "✓|✗" | cut -c1-400
    candado_hueco ;;
  telefono)
    tomar "e5 r4 telefono"
    i=0
    for pista in 0.0 13.2 30.2; do
      i=$((i + 1)); paso "carrera $i ($pista): A un Chrome normal, B como teléfono de gama media"
      sincro tel-$i nuevo --pistas=$pista --semilla=$((1000 + i)) --vista-b=915x412 "--extra-b=&comoTelefono=1$GAMA_MEDIA"
    done
    candado_hueco ;;
  *) echo "fase desconocida: $fase"; exit 1 ;;
esac; done
candado_soltar
