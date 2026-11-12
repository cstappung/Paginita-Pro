#!/bin/bash
# La tanda de la sala con el teléfono REAL (bitácora §281 parte 2), con el candado de medición de siempre.
#
# Resumen: corre herramientas/sala-telefono-mixta.mjs en los casos pedidos, uno detrás de otro, con candado_hueco entre
# caso y caso (cede el turno si otra sesión lo pidió o si hay fila y ya van 45 min):
#   sp            el control: el Single Player en el teléfono (la misma pista, semilla y gráficos que la sala)
#   sp-pc         el control en este PC
#   lockstep-N    la sala con N PC + el teléfono, con el lockstep
#   estado-N      la sala con N PC + el teléfono, con «Cada uno su kart» (?red=estado)
# El teléfono va siempre por el marco seguro (telefono-seguro.mjs). Todo a build/web/datos/sala-telefono/<fecha-hora>/.
# Uso:  bash herramientas/tanda-sala-telefono.sh sp sp-pc lockstep-2 estado-2 …   (todos: «todos»)
#       PISTA=c.f = la pista (por omisión 0.0)   CONTAR=1 = contar a quién le inventa la autoridad
#       CABLE=1 = el teléfono por el repetidor TURN de este PC a través del cable (cuando no está en la red del PC)
#       BUILD=build/web-final-v21/navegador  SEGUNDOS=40 TRAZA=12 PERFIL=15  EXTRA="&…"  EXTRA_PC="&…" (solo los PC)  DATOS=carpeta
cd "$(dirname "$0")/.." || exit 1
QUIEN="sim-sala-mixta (local_5a1a0281)"; source herramientas/candado.sh
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
export TELEFONO_ADB=${TELEFONO_ADB:-platform-tools-latest-windows/platform-tools/adb.exe}
export MKW_BUILD=${BUILD:-build/web-final-v21/navegador}
DATOS=${DATOS:-build/web/datos/sala-telefono/$(date '+%Y-%m-%d-%H-%M')}
mkdir -p "$DATOS"
# CONTAR=1 = el lockstep contado (herramientas/lockstep-contado.mjs: a quién le inventa botones la autoridad), servido en
# lugar del de siempre solo en esta tanda
[ -n "$CONTAR" ] && export MKW_SUSTITUIR="/lockstep.mjs=$(node herramientas/lockstep-contado.mjs)"
CASOS="$*"; [ "$CASOS" = "todos" ] || [ -z "$CASOS" ] && CASOS="sp-pc sp lockstep-2 estado-2 lockstep-3 estado-3 lockstep-4 estado-4"
candado_tomar "sala-telefono $CASOS"
for c in $CASOS; do
  case $c in
    sp|sp-pc) args=(--solo "$c") ;;
    lockstep-*|estado-*) args=(--solo sala --modo "${c%-*}" --pcs "${c##*-}") ;;
    *) echo "caso desconocido: $c"; continue ;;
  esac
  echo "== $c $(date '+%H:%M:%S') ($MKW_BUILD)"
  node herramientas/sala-telefono-mixta.mjs "${args[@]}" --etiqueta "$c" --datos "$DATOS" --segundos "${SEGUNDOS:-40}" \
    --traza "${TRAZA:-12}" --perfil "${PERFIL:-15}" ${EXTRA:+--extra "$EXTRA"} ${EXTRA_PC:+--extra-pc "$EXTRA_PC"} ${CABLE:+--cable} ${PISTA:+--pista "$PISTA"} > "$DATOS/$c.out" 2>&1
  echo "   salió $? $(date '+%H:%M:%S')"; grep -E '^(  (PC|teléfono)|✗|listo)' "$DATOS/$c.out" | cut -c1-240
  candado_hueco
done
candado_soltar
