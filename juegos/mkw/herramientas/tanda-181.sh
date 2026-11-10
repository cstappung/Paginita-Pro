#!/bin/bash
# Tanda del paso 7 (G3/H12/N14, bitácora §181): compilar y medir con el candado común (herramientas/candado.sh).
# Uso: bash herramientas/tanda-181.sh <fase> [<fase> …]
#   compilar  aurora con los anillos, enlazado aparte en build/web-anillo/navegador (los objetos, los de siempre)
#   medir     la carrera de 12 CPU, tramo fijo (§163), anillo apagado y prendido intercalados, en este PC y en la gama
#             baja simulada (la de la escalera de §163); con el perfil de la tarjeta (KB subidos por imagen)
#   verificar una carrera con ?anillo=verifica (cada acierto comparado con su huella: las diferencias tienen que ser 0)
# Cada fase toma el candado y lo suelta al terminar; dentro de una fase larga, candado_hueco entre vueltas.
cd "$(dirname "$0")/.."
QUIEN="paso7 (local_7a7a7a7a)"; source herramientas/candado.sh
export MKW_VENTANA="${MKW_VENTANA:--1880,549}"
DATOS=build/web/datos/anillo; mkdir -p "$DATOS"
SAL=${SAL:-build/web-anillo/navegador}
VUELTAS=${VUELTAS:-2}
# la gama baja simulada = la de §163: Chrome en 8 núcleos y este lastre
BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"

fase_compilar() {
  candado_tomar "paso7 compilar aurora (anillos)" || exit 1
  python herramientas/compilar-web.py --modo navegador --salida "$SAL" > "$DATOS/compilar.log" 2>&1 &
  esperar_pid $!; local r=$?
  # las semillas y las imágenes que la página espera junto al programa (las mismas del programa de siempre)
  for f in pipelines.bin bloques.json pipelines-c2.bin bloques-d9.json; do
    [ -f build/web/navegador/$f ] && cp -f build/web/navegador/$f "$SAL/"; done
  [ -d build/web/navegador/imagenes ] && cp -rf build/web/navegador/imagenes "$SAL/"
  candado_soltar
  tail -3 "$DATOS/compilar.log"; return $r
}

# una medición del tramo fijo: $1 etiqueta, $2 opciones de medir-sitio, $3 lo que se agrega a la dirección
medir_una() {
  MKW_BUILD="$SAL" node herramientas/medir-sitio.mjs --perfil pc $2 --etiqueta "$1" --sola --piloto --piloto-espera 600 \
    --chrome "--disable-dawn-features=timestamp_quantization" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&perfilGpu=1$3" \
    > "$DATOS/$1.log" 2>&1 &
  esperar_pid $!
  grep -E "tramo|KB|kb|subid|techo" "$DATOS/$1.log" | tail -6
  grep -E "anillo:|staging: frame" "build/web/datos/medir-sitio/$1-pc.log" 2>/dev/null | tail -2
}

fase_medir() {
  candado_tomar "paso7 medir anillos (tramo fijo, pc y gama baja)" || exit 1
  for v in $(seq 1 "$VUELTAS"); do
    medir_una "a181-pc-sin-$v" "" "&anillo=0"
    medir_una "a181-pc-con-$v" "" "&anillo=1"
    medir_una "a181-baja-sin-$v" "--nucleos 8" "&anillo=0$BAJA"
    medir_una "a181-baja-con-$v" "--nucleos 8" "&anillo=1$BAJA"
    candado_hueco "paso7 medir anillos (vuelta $((v + 1)))"   # entre vueltas: el turno corto o ceder si llevo mucho
  done
  candado_soltar
}

fase_verificar() {
  candado_tomar "paso7 verificar anillos" || exit 1
  medir_una "a181-verifica" "" "&anillo=verifica"
  candado_soltar
}

# ---- N14: las funciones calientes (web/juego/caliente_nativo.cpp) ----
NODO=build/web-caliente/node
# el programa de Node con las reescrituras (MKW_CALIENTE elige al correr: 0 traducida, 1 nueva, 2 comprobar)
fase_compilar_caliente() {
  candado_tomar "paso7 compilar N14 (Node)" || exit 1
  MKW_CALIENTE_COMPILAR=1 python herramientas/compilar-web.py --modo node --salida "$NODO" > "$DATOS/compilar-caliente.log" 2>&1 &
  esperar_pid $!; local r=$?
  candado_soltar
  tail -3 "$DATOS/compilar-caliente.log"; return $r
}
# el comprobador: una carrera entera (el guion de §165/§170 hasta el tramo) con las dos versiones en cada llamada
fase_comprobar() {
  candado_tomar "paso7 comprobador N14" || exit 1
  MKW_CALIENTE=2 MKW_CALIENTE_MAXCOMPLETAS=${COMPLETAS:-150} MKW_BUILD_NODE="$NODO" \
    node herramientas/medir-node-estable.mjs --corridas 1 --etiqueta caliente-comprobar --tope-min 30 \
    > "$DATOS/comprobar.log" 2>&1 &
  esperar_pid $!
  candado_soltar
  grep -E "\[caliente\]|corrida" "$DATOS/comprobar.log" | tail -12
}
# la medida: el mismo programa con la traducida y con la nueva, intercalados en la misma tanda (--fijo)
fase_medir_caliente() {
  candado_tomar "paso7 medir N14 (Node, intercalado)" || exit 1
  node herramientas/medir-node-estable.mjs --fijo --corridas ${CORRIDAS:-6} --etiqueta caliente-${ETIQ:-1} \
    --intercalar "traducida=$NODO@MKW_CALIENTE=0,nueva=$NODO@MKW_CALIENTE=1${SOLO:+;MKW_CALIENTE_SOLO=$SOLO}" \
    > "$DATOS/medir-caliente-${ETIQ:-1}.log" 2>&1 &
  esperar_pid $!
  candado_soltar
  grep -E "vuelta|mediana|razón|razon" "$DATOS/medir-caliente-${ETIQ:-1}.log" | tail -10
}

for f in "$@"; do "fase_$f" || exit 1; done
