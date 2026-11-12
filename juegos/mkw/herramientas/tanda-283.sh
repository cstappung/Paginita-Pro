#!/bin/bash
# La tanda de los picos (bitácora §283): el PC y el Oppo real, imagen por imagen, con el candado de medición.
#
# Resumen: corre herramientas/sala-telefono-mixta.mjs (la herramienta de §281 parte 2: el registrador por refresco, la
# clasificación de cada pico por causa, la traza y el perfil del teléfono) en los casos pedidos, uno detrás de otro, con
# candado_hueco entre caso y caso. Cada caso puede llevar una variante: «caso@etiqueta=&param=valor…» (lo de después del
# «=» va a la URL de todas las páginas; con «caso@etiqueta:tel=&…» solo a la del teléfono). Así el antes y el después
# van intercalados en la misma tanda (la carga de fondo del PC cambia con la hora, §166).
#   sp            el Single Player en el teléfono          sp-pc         el Single Player en este PC
#   lockstep-N    la sala con N PC + el teléfono (lockstep) estado-N     la sala con N PC + el teléfono («Cada uno su kart»)
# Uso:  bash herramientas/tanda-283.sh "sp-pc@fin=&ritmoJuego=fin" sp-pc "sp@fin=&ritmoJuego=fin" sp …
#       CABLE=1 (por omisión: el teléfono no está en la red del PC)  PISTA=0.0  SEGUNDOS=60  TRAZA=12  PERFIL=15
#       BUILD=build/web-final-v21/navegador  DATOS=carpeta  EXTRA="&…" (a todos los casos)  NUM_FILA=<número de build/medicion.fila> = seguir con mi lugar
cd "$(dirname "$0")/.." || exit 1
QUIEN="picos-283 (local_283180d3)"; source herramientas/candado.sh
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
export TELEFONO_ADB=${TELEFONO_ADB:-platform-tools-latest-windows/platform-tools/adb.exe}
export MKW_BUILD=${BUILD:-build/web-final-v21/navegador}
CABLE=${CABLE-1}
DATOS=${DATOS:-build/web/datos/picos-283/$(date '+%Y-%m-%d-%H-%M')}
mkdir -p "$DATOS"
CANDADO_NUM=$NUM_FILA candado_tomar "picos-283 $*"   # (NUM_FILA = mi número que ya esperaba en la fila; solo esta vez)
for c in "$@"; do
  base=${c%%@*}; var=""; extra="$EXTRA"; extraTel=""
  if [ "$c" != "$base" ]; then
    resto=${c#*@}; var=${resto%%=*}; params=${resto#*=}
    if [[ "$var" == *:tel ]]; then var=${var%:tel}; extraTel="$params"; else extra="$extra$params"; fi
  fi
  etq=$base${var:+-$var}
  case $base in
    sp|sp-pc) args=(--solo "$base") ;;
    lockstep-*|estado-*) args=(--solo sala --modo "${base%-*}" --pcs "${base##*-}") ;;
    *) echo "caso desconocido: $c"; continue ;;
  esac
  echo "== $etq $(date '+%H:%M:%S') ($MKW_BUILD) extra=[$extra] tel=[$extraTel]"
  node herramientas/sala-telefono-mixta.mjs "${args[@]}" --etiqueta "$etq" --datos "$DATOS" --segundos "${SEGUNDOS:-60}" \
    --traza "${TRAZA:-12}" --perfil "${PERFIL:-15}" ${extra:+--extra "$extra"} ${extraTel:+--extra-tel "$extraTel"} \
    ${CABLE:+--cable} ${PISTA:+--pista "$PISTA"} > "$DATOS/$etq.out" 2>&1
  echo "   salió $? $(date '+%H:%M:%S')"; grep -E '^(  (PC|teléfono)|✗|listo)' "$DATOS/$etq.out" | cut -c1-240
  candado_hueco
done
candado_soltar
node herramientas/resumen-283.mjs "$DATOS" > "$DATOS/resumen.md" 2>&1; cat "$DATOS/resumen.md"
