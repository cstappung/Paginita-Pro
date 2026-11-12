#!/bin/bash
# El candado de medición compartido entre sesiones (build/medicion.lock), bitácora §176 y §180.
#
# Resumen: varias sesiones miden en este PC por turnos; quien mide escribe build/medicion.lock y lo borra al terminar.
# Este archivo junta lo que cada tanda hacía a su manera, para que todas lo hagan igual:
#   candado_tomar ETIQUETA   saca número en la FILA (build/medicion.fila/) y espera su turno: toma el candado solo
#                            cuando está libre y su número es el más viejo de la fila (noclobber: si dos llegan juntas,
#                            una sola gana)
#   candado_soltar           lo borra solo si es mío (lleva mi QUIEN)
#   candado_hueco            en un punto limpio de la tanda: cede el turno si otra sesión pidió un turno corto
#                            (build/medicion.hueco) o si hay otras en la fila y yo ya llevo 45 min; espera a que la otra
#                            termine y vuelve a sacar número (§180)
#   esperar_pid PID          espera a que termine un proceso hijo POR SU NÚMERO DE GIT BASH ($! y kill -0)
# Por qué la fila (§180, el dueño: «que ninguna de las sesiones se trabe y se estorbe»): con tres sesiones, quien
# miraba primero ganaba, y una podía tomar tanda tras tanda mientras las otras esperaban una hora. Con la fila, quien
# suelta y vuelve a pedir queda detrás de las que ya esperaban: los turnos se alternan solos.
# Un número en la fila que nadie renueva en 3 min es de una sesión que ya no espera: no cuenta.
# Trampa (§176): el número de proceso de Windows (tasklist) NO es el de Git Bash. Nunca tasklist: el número que dio $!
# con kill -0, o un archivo «terminé» que escribe la etapa.
# Como un interruptor de transferencia con enclavamiento: nunca quedan dos fuentes conectadas a la carga, y quien pide
# la barra saca número y espera su turno.
#
# Uso:  QUIEN="paso5 (local_…)"; source herramientas/candado.sh; candado_tomar "tanda-X"; …; candado_hueco; …; candado_soltar
#       Pedir un turno corto a quien lo tiene:  echo "paso6 (local_…): diagnóstico 5 min" > build/medicion.hueco
#       Ver la fila:  ls build/medicion.fila/ ; cat build/medicion.lock
#       Dar prioridad a una sesión (lo decide el dueño):  echo "red-estado" > build/medicion.prioridad  (borrar = sin prioridad)
#       Con prioridad, esa sesión pasa delante de la fila y las demás la esperan mientras tenga número vivo; el candado
#       tomado no se le quita a nadie (la corrida en curso termina)
CANDADO=build/medicion.lock
HUECO=build/medicion.hueco
FILA=build/medicion.fila
PRIORIDAD=build/medicion.prioridad   # (2026-11-10, el dueño: «el modelo nuevo tiene prioridad en el lock»)
TURNO_MAX=${TURNO_MAX:-2700}   # 45 min: con otras en la fila, candado_hueco cede pasado esto
: "${QUIEN:?QUIEN sin poner (p. ej. QUIEN=\"paso5 (local_57287be5)\")}"
_mio() { local m; m=$(echo "$QUIEN" | grep -o 'local_[0-9a-f]*' | head -1); [ -n "$m" ] && echo "$m" || echo "$QUIEN" | tr -c 'A-Za-z0-9_' '_'; }

# los números vivos de la fila (renovados hace menos de 3 min), del más viejo al más nuevo
_fila_viva() { find "$FILA" -maxdepth 1 -type f -mmin -3 2>/dev/null | xargs -r -n1 basename | sort; }

candado_tomar() {   # $1 = qué se mide; $2 = segundos como mucho (3 h)
  local t0=$(date +%s) max=${2:-10800} mio=$(_mio)
  mkdir -p "$FILA"
  local num="${CANDADO_NUM:-$(date +%s%N)-$mio}"   # el número: la hora con nanosegundos ordena la llegada (CANDADO_NUM = seguir con un número mío que ya estaba en la fila, p. ej. al rehacer la lista de una tanda que esperaba)
  echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$FILA/$num"
  while :; do
    touch "$FILA/$num"                        # «sigo esperando»
    local primero=$(_fila_viva | head -1) hueco_mio=0
    [ -n "$(find "$HUECO" -mmin -15 -size +0 2>/dev/null)" ] && grep -qF "$mio" "$HUECO" && hueco_mio=1
    # la prioridad del dueño (build/medicion.prioridad = un texto que aparece en el QUIEN de esa sesión): si yo la tengo,
    # paso delante de la fila; si la tiene otra y está esperando en la fila, la espero aunque mi número sea más viejo
    local prio=$(head -1 "$PRIORIDAD" 2>/dev/null | tr -d '\r')
    if [ -n "$prio" ]; then
      if echo "$QUIEN" | grep -qF -- "$prio"; then primero="$num"
      elif [ -n "$(_fila_viva | while read f; do grep -lF -- "$prio" "$FILA/$f" 2>/dev/null; done | head -1)" ]; then primero="(espero a $prio)"
      fi
    fi
    # el turno es mío si: soy el primero de la fila (o el turno corto pedido es mío: se adelanta a la fila), no hay un
    # hueco pedido por OTRA sesión (de menos de 15 min) y el candado está libre
    if { [ "$primero" = "$num" ] || [ $hueco_mio = 1 ]; } \
       && ! { [ -n "$(find "$HUECO" -mmin -15 -size +0 2>/dev/null)" ] && ! grep -qF "$mio" "$HUECO"; } \
       && ( set -o noclobber; echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO" ) 2>/dev/null; then
      rm -f "$FILA/$num"
      grep -qF "$mio" "$HUECO" 2>/dev/null && rm -f "$HUECO"   # mi pedido de hueco, ya atendido
      CANDADO_DESDE=$(date +%s)
      echo "[candado] tomado $(date '+%H:%M:%S'): $1"
      return 0
    fi
    if [ $(( $(date +%s) - t0 )) -gt "$max" ]; then
      rm -f "$FILA/$num"
      echo "[candado] sin turno en $max s: $(cat "$CANDADO" 2>/dev/null)"; return 1
    fi
    sleep 10
  done
}

candado_soltar() {
  grep -qF "$QUIEN" "$CANDADO" 2>/dev/null && rm -f "$CANDADO" && echo "[candado] suelto $(date '+%H:%M:%S')"
  return 0
}

candado_hueco() {   # en un punto limpio de la tanda; $1 = etiqueta con que lo retomo
  local mio=$(_mio) otros=0 largo=0
  otros=$(_fila_viva | grep -vF -- "-$mio" | wc -l)
  [ -n "$CANDADO_DESDE" ] && [ $(( $(date +%s) - CANDADO_DESDE )) -gt "$TURNO_MAX" ] && largo=1
  if [ -e "$HUECO" ] && ! grep -qF "$mio" "$HUECO"; then
    echo "[candado] hueco pedido: $(cat "$HUECO")"
  elif [ "$otros" -gt 0 ] && [ $largo = 1 ]; then
    echo "[candado] llevo más de $((TURNO_MAX / 60)) min y hay $otros en la fila: cedo el turno"
  else
    return 0
  fi
  candado_soltar
  candado_tomar "${1:-sigue}"   # saco número nuevo: quedo detrás de las que esperaban
}

esperar_pid() {   # $1 = número de Git Bash ($!) de un proceso hijo
  while kill -0 "$1" 2>/dev/null; do sleep 5; done
}
