#!/bin/bash
# La tanda de §170 (N15a: WiiCompiled v0.9.3 con nuestra aurora), por fases. Cada fase toma build/medicion.lock y lo
# suelta al terminar; entre una fase y la siguiente, candado_hueco (§180: cede si otra pide un hueco o pasados 45 min)
# (el orquestador, 31-10 01:00; antes, por un rato, lo guardaba toda la tanda).
# Uso:  bash herramientas/tanda-170.sh <fase> [<fase> …]
#   fases: correcto, nativo, nodo, chrome, eval, traduccion, equivalencia; todo = todas; resto = todas menos correcto
#   correcto = paridad, prueba-arranque, la RAM nueva contra la nueva y contra la vieja, prueba-navegador, prueba-sincro
#   nativo   = compilar el programa de Windows v0.9.3 (solo para medir; nunca a git)
#   nodo     = el tramo fijo en Node, base vieja contra v0.9.3, intercalados, cada una con su programa de Windows al
#              lado (--nativo-tambien v3,v093-v3: las dos razones wasm/nativo en la misma tanda)
#   chrome   = la base vieja del navegador (compilarla si falta) y el tramo fijo en Chrome: este PC y la gama baja simulada
#   eval     = lo del original que se evalúa aparte: el sonido (#360) y la interpolación (aurora#6) en la gama baja
#   traduccion   = #358: traducir dos veces (determinista) y el tiempo del traductor viejo (tanda-170-traduccion.sh)
#   equivalencia = la sala con el programa viejo en una consola y el nuevo en la otra (prueba-sincro --build-b)
#   pruebas  = todas las pruebas con su planilla (correr-todo.mjs) con el programa v0.9.3
#   reprueba = las que fallaron en «pruebas», con la v0.9.3 y con la base vieja (mismo web/, mismas imágenes y .br):
#              si fallan igual en las dos, no es la v0.9.3
# Todo con tope de tiempo (nada trabado) y en sus propias carpetas/puertos (8171-8179), sin tocar build/web.
cd "$(dirname "$0")/.."
YO="paso6-N15 (local_cbaf17f0)"
DATOS=build/web/datos/n15
mkdir -p "$DATOS"
NUEVO_NODE=build/web-motor/node
VIEJO_NODE=build/web-motor-base/node
NUEVO_NAV=build/web-motor/navegador
VIEJO_NAV=build/web-motor-base/navegador

# el candado común (§176, herramientas/candado.sh): noclobber, soltarlo solo si es mío; al tomar el turno se borra mi
# pedido de hueco (build/medicion.hueco con mi local_…), si no la otra sesión lo espera hasta 15 min sin necesidad
QUIEN="$YO"; source herramientas/candado.sh
tomar() {   # si ya es mío, solo anota la fase; si no, lo espera (tope 90 min)
  if grep -qF "local_cbaf17f0" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" 5400 || exit 1; fi
  grep -qF "local_cbaf17f0" "$HUECO" 2>/dev/null && rm -f "$HUECO"; return 0
}
soltar() { candado_soltar; }
trap soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

# el tramo fijo de §163 en Chrome (la carrera directa de 12 CPU con semilla fija, sin tope); $1 = carpeta del programa,
# $2 = etiqueta, $3 = lastre extra («» = este PC; la gama baja simulada de §163 = lastre 7, ayuda 5, ladrón 64, tarjeta 15)
tramo_chrome() {
  MKW_BUILD="$1" timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 --ventana \
    --piloto-espera 600 --nucleos 8 --puerto 8172 --etiqueta "$2" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400$3"
}
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"

correcto() {
  tomar correcto
  paso "paridad con las cabeceras v0.9.3 (los 22 de siempre)"
  MKW_WIICOMPILED='terceros\Wiicompiled-motor' timeout 900 powershell -NoProfile -ExecutionPolicy Bypass -File banco/pruebas/paridad/construir.ps1 -Motor
  timeout 600 node banco/pruebas/paridad/prueba-node.mjs --motor
  paso "prueba-arranque (Node, v0.9.3)"
  MKW_BUILD_NODE=$NUEVO_NODE timeout 900 node web/node/prueba-arranque.mjs
  paso "la RAM de la Wii: v0.9.3 contra v0.9.3 (determinista) y contra la base vieja"
  timeout 3000 node herramientas/comparar-volcado.mjs --antes $NUEVO_NODE --despues $NUEVO_NODE --tope-min 15
  timeout 2000 node herramientas/comparar-volcado.mjs --antes $VIEJO_NODE --despues $NUEVO_NODE --sin-repetir --tope-min 15
  paso "prueba-navegador (v0.9.3)"
  MKW_BUILD=$NUEVO_NAV timeout 1200 node web/navegador/prueba-navegador.mjs 1800 --puerto 8171 --datos $DATOS/navegador
  paso "prueba-sincro --directa (la huella ampliada de la sala, v0.9.3)"
  MKW_BUILD=$NUEVO_NAV timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8173 --datos=$DATOS/sincro
}

nodo() {
  tomar nodo
  local nat=""
  [ -f build/nativo-v093-v3/mkw-nativo.exe ] && [ -f build/nativo-v3/mkw-nativo.exe ] && nat="--nativo-tambien v3,v093-v3"
  paso "tramo fijo en Node: base vieja contra v0.9.3, intercalados (6 vueltas) ${nat}"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 12 --etiqueta n15-nodo \
    --intercalar antes=$VIEJO_NODE,despues=$NUEVO_NODE $nat
}

nativo() {
  tomar nativo
  paso "el programa de Windows v0.9.3 (solo para medir; nunca a git)"
  MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 3600 \
    python herramientas/compilar-nativo.py --carpeta build/nativo-v093-v3 --gen build/web-motor/node/gen > build/nativo-v093-v3.log 2>&1
  tail -3 build/nativo-v093-v3.log
}

chrome() {
  if [ ! -f $VIEJO_NAV/mkw.wasm ]; then
    tomar "compilando $VIEJO_NAV"
    paso "la base vieja del navegador, con el mismo web/ de hoy"
    timeout 3600 python herramientas/compilar-web.py --modo navegador --carpeta build/web-motor-base > build/web-motor-base-nav.log 2>&1
    tail -2 build/web-motor-base-nav.log
    cp build/web-motor/navegador/pipelines.bin build/web-motor/navegador/bloques.json $VIEJO_NAV/ 2>/dev/null
  fi
  tomar chrome
  for vuelta in 1 2; do
    paso "Chrome, este PC, vuelta $vuelta (vieja y nueva)"
    tramo_chrome $VIEJO_NAV n15-pc-viejo-$vuelta ""
    tramo_chrome $NUEVO_NAV n15-pc-nuevo-$vuelta ""
    paso "Chrome, gama baja simulada, vuelta $vuelta (nueva y vieja: el orden al revés)"
    tramo_chrome $NUEVO_NAV n15-baja-nuevo-$vuelta "$GAMA_BAJA"
    tramo_chrome $VIEJO_NAV n15-baja-viejo-$vuelta "$GAMA_BAJA"
  done
}

eval_() {
  tomar eval
  paso "#360: el sonido (banco sonido-worklet; la «poca demora» va en prueba-navegador de la fase correcto)"
  timeout 600 node banco/correr.mjs sonido-worklet
  paso "aurora#6 / N8: la interpolación (fluidez=120) contra nada, gama baja simulada, v0.9.3"
  for vuelta in 1 2; do
    tramo_chrome $NUEVO_NAV n15-fluidez0-$vuelta "$GAMA_BAJA"
    tramo_chrome $NUEVO_NAV n15-fluidez120-$vuelta "$GAMA_BAJA&fluidez=120"
  done
}

traduccion() {
  tomar traduccion
  paso "#358: traducir dos veces la v0.9.3 y tomar el tiempo del traductor viejo"
  MKW_CANDADO_TOMADO=1 bash herramientas/tanda-170-traduccion.sh
}

equivalencia() {
  tomar equivalencia
  paso "la sala con un programa en cada consola: A = v0.9.3, B = la base vieja (la huella toda la carrera)"
  MKW_BUILD=$NUEVO_NAV timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8173     --datos=$DATOS/sincro-equivalencia --build-b=$VIEJO_NAV
}

pruebas() {
  tomar pruebas
  paso "correr-todo con el programa v0.9.3 ($NUEVO_NAV)"
  MKW_BUILD=$NUEVO_NAV timeout 5400 node herramientas/correr-todo.mjs
}

# las dos carpetas del navegador con lo mismo que build/web/navegador al lado del programa: las imágenes de la página
# (el menú de inicio, las pistas…) y el programa comprimido (la precarga lo necesita en la caché HTTP)
preparar() {
  for d in $NUEVO_NAV $VIEJO_NAV; do
    [ -d $d/imagenes ] || cp -r build/web/navegador/imagenes $d/
    [ -f $d/mkw.wasm.br ] || timeout 1800 node herramientas/comprimir-build.mjs $d
  done
}
REPRUEBA=partidas,tactil,menus,inicio,caida,doce,invitados,musica,precarga,relevo
reprueba() {
  tomar reprueba
  paso "preparar las dos carpetas (imágenes y .br)"
  preparar
  paso "las que fallaron, con la v0.9.3"
  MKW_BUILD=$NUEVO_NAV timeout 5400 node herramientas/correr-todo.mjs --solo $REPRUEBA
  paso "las mismas, con la base vieja"
  MKW_BUILD=$VIEJO_NAV timeout 5400 node herramientas/correr-todo.mjs --solo $REPRUEBA
}

[ $# -eq 0 ] && { sed -n 2,19p "$0"; exit 1; }
n_fase=0
for fase in "$@"; do
  n_fase=$((n_fase+1))
  case "$fase" in
    correcto) correcto ;;
    nativo) nativo ;;
    nodo) nodo ;;
    chrome) chrome ;;
    eval) eval_ ;;
    traduccion) traduccion ;;
    equivalencia) equivalencia ;;
    pruebas) pruebas ;;
    reprueba) reprueba ;;
    todo) correcto; nativo; nodo; chrome; eval_; traduccion; equivalencia ;;
    resto) nativo; nodo; chrome; eval_; traduccion; equivalencia ;;
    *) sed -n 2,19p "$0"; exit 1 ;;
  esac
  if [ $n_fase -lt $# ]; then candado_hueco "sigue"; fi   # §180: sigo salvo que otra pida un hueco o yo lleve 45 min con fila
done
