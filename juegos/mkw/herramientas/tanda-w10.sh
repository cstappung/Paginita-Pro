#!/bin/bash
# W10 de la etapa 1 del plan v4 (bitácora §207): el dibujo en otro Worker, primera parte: el techo y el costo de la caja.
#
# Resumen: un programa aparte (MKW_W10_COMPILAR=1, web/juego/w10_nativo.cpp, con -DMKW_SUCIAS: cada escritura marca su
# página) mide, con la carrera andando, lo que ganaría el Worker de la carrera si no dibujara y lo que le cuesta juntar
# y mandar la caja de cada cuadro al Worker del dibujo:
#   ?w10=0  el programa con la marca, dibujando (el costo de la marca sola, contra build/web-w19)
#   ?w10=1  sin dibujo (solo SwitchScnRoot): el techo
#   ?w10=2  sin dibujo + juntar la caja
#   ?w10=3  sin dibujo + juntar + copiarla a un Worker que la pega (el costo completo del lado de la carrera)
#   ?w10=4  + comprobar la marca (la memoria entera contra la sombra): lo que se le escaparía al Worker del dibujo
#   ?w10=5|6|7  = 1|2|3 sin presentar (no corre XfbManager::copyEFB): como el Worker de la carrera de W10. Con 1–3 la
#           imagen vacía se presentaba en cada cuadro y la espera de la presentación marcaba el paso (§207)
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w10.sh compilar comprobar chrome
#   compilar  = el programa del navegador → build/web-w10 (motor + aurora de la base, semillas de build/web-w19)
#   comprobar = una carrera con ?w10=4 en este PC (sin tope): ¿se escapa algo de la marca? (el registro dice «sin marca»)
#   chrome    = el tramo fijo §163: este PC y la gama baja (con la revisión de límites, W5), la base contra los modos
#               0, 5, 6 y 7, intercalados, W10_VUELTAS vueltas (2)
#   sala      = la sala de dos (A con ?w10=7, B normal) en 2 pistas: las huellas iguales
#   fantasma  = la Contrarreloj contra el experto, B con ?w10=7: el fantasma igual cuadro por cuadro
cd "$(dirname "$0")/.."
QUIEN="e1-w10 (local_cb5459c6)"; source herramientas/candado.sh
BASE=${W10_BASE:-build/web-w19}
SAL=${W10_SAL:-build/web-w10}
DATOS=build/web/datos/w10
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
PUERTO=8183
VUELTAS=${W10_VUELTAS:-2}

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
# W10_WC = otra copia del motor (p. ej. terceros/Wiicompiled-motor-h6 en la rama e2-w10, §220) y W10_ARGS = más opciones
# de compilar-web.py (p. ej. --fija)
motor() { MKW_WIICOMPILED=${W10_WC:-terceros/Wiicompiled-motor} MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

compilar() {
  tomar "w10 compilar"
  paso "el programa del navegador con la marca de páginas y el instrumento → $SAL/navegador"
  MKW_W10_COMPILAR=1 motor timeout 7200 python herramientas/compilar-web.py --modo navegador $W10_ARGS --carpeta $SAL \
    > $DATOS/compilar.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
}

# $1 programa, $2 etiqueta, $3 extra, $4 banderas de Chrome, $5 segundos
tramo() {
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$1/navegador timeout 1200 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos ${5:-5} \
    --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta "$2" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$3" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1)"
}

comprobar() {
  tomar "w10 comprobar"
  paso "una carrera con ?w10=4: la marca contra la memoria entera (este PC)"
  tramo $SAL w10-comprobar "&w10=4" "" 20
  grep -h "\[w10\]" build/web/datos/medir-sitio/w10-comprobar-pc.log 2>/dev/null | tail -16
}

chrome() {
  tomar "w10 chrome"
  local variantes=("base:$BASE:" "m0:$SAL:&w10=0" "m5:$SAL:&w10=5" "m6:$SAL:&w10=6" "m7:$SAL:&w10=7")
  for v in $(seq 1 $VUELTAS); do
    local orden=("${variantes[@]}")
    [ $((v % 2)) = 0 ] && orden=("${variantes[4]}" "${variantes[3]}" "${variantes[2]}" "${variantes[1]}" "${variantes[0]}")
    for ap in pc baja; do
      paso "vuelta $v, $ap"
      for x in "${orden[@]}"; do
        IFS=: read -r nom prog ext <<< "$x"
        if [ $ap = pc ]; then tramo $prog w10-pc-$nom-$v "$ext" ""
        else tramo $prog w10-baja-$nom-$v "$GAMA_BAJA$ext" "$LIMITES"; fi
      done
      candado_hueco "sigue"
    done
  done
  paso "el registro de la caja (modos 2 y 3)"
  grep -h "\[w10\]" build/web/datos/medir-sitio/w10-*-m[67]-*.log 2>/dev/null | tail -8
}

# por qué la gama baja va MÁS lenta sin dibujo (§207.3): cada pieza del aparato de mentira por separado, base contra m5
# (L1 = solo medir la CPU pura con la revisión de límites; L7 = el lastre del hilo; G = solo el lastre de la tarjeta;
# AL = el hilo del sonido y el ladrón de caché)
aislar() {
  tomar "w10 aislar"
  local piezas=("L1:&lastre=1" "L7:&lastre=7" "G:&lastre=1&lastreGpu=15" "AL:&lastre=1&lastreAyuda=5&ladron=64")
  for pz in "${piezas[@]}"; do
    IFS=: read -r np ep <<< "$pz"
    paso "aislar $np ($ep)"
    tramo $BASE w10-aislar-$np-base "$ep" "$LIMITES"
    tramo $SAL w10-aislar-$np-m5 "$ep&w10=5" "$LIMITES"
    candado_hueco "sigue"
  done
}

# §207.3: lo mismo que «chrome» pero con ?dibujarSiempre=1 (sin la compensación de lag de RR, como en la sala): con el
# lastre la compensación se salta casi todos los dibujos y la base ya casi no dibujaba. Todo dentro del programa de W10
# (m0 = solo la marca, la base de la comparación; m5 = sin dibujo; m7 = sin dibujo + la caja a un Worker)
siempre() {
  tomar "w10 siempre"
  local variantes=("m0:&w10=0" "m5:&w10=5" "m7:&w10=7")
  for v in $(seq 1 $VUELTAS); do
    local orden=("${variantes[@]}"); [ $((v % 2)) = 0 ] && orden=("${variantes[2]}" "${variantes[1]}" "${variantes[0]}")
    for ap in baja pc; do
      paso "siempre, vuelta $v, $ap"
      for x in "${orden[@]}"; do
        IFS=: read -r nom ext <<< "$x"
        if [ $ap = pc ]; then tramo $SAL w10s-pc-$nom-$v "&dibujarSiempre=1$ext" ""
        else tramo $SAL w10s-baja-$nom-$v "$GAMA_BAJA&dibujarSiempre=1$ext" "$LIMITES"; fi
      done
      candado_hueco "sigue"
    done
  done
}

# la parte B (§207.4): dos Workers, A corre y B dibuja con las cajas: la misma foto en dos cuadros y la medida
dos() {
  tomar "w10 dos"
  paso "la parte B: comprobar (cuadros 900 y 1500) y medir, este PC"
  MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-w10-dos.mjs --alto 900,1500 --medir --ventana \
    > $DATOS/dos-pc.txt 2>&1
  echo "salida $?"; grep -E "✓|✗|A:|B:|esperó|bien, " $DATOS/dos-pc.txt | tail -14
  candado_hueco "sigue"
  paso "la parte B: medir con la gama baja (dibujar siempre, límites)"
  MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-w10-dos.mjs --solo-medir --ventana \
    --extra "$GAMA_BAJA&dibujarSiempre=1" --chrome "$LIMITES" > $DATOS/dos-baja.txt 2>&1
  echo "salida $?"; grep -E "✓|✗|A:|B:|esperó|bien, " $DATOS/dos-baja.txt | tail -8
}

# W11 (§209): saltar cada sistema por vez (1 efectos, 2 gestor de sonido, 4 hilo de sonido; W11_MASCARAS) en B de la
# sala (las huellas contra A, que no salta) y en B de la Contrarreloj (el fantasma cuadro por cuadro); después lo que
# ahorra todo junto (?w11=7) en el tramo fijo, este PC y la gama baja, intercalados
w11() {
  tomar "w11 saltar"
  for m in ${W11_MASCARAS:-1 2 4}; do
    paso "w11=$m: la sala en la pista 0.0 (B salta)"
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8184 \
      --datos=$DATOS/w11-sala-$m --pistas=0.0 --semilla=1234 --extra-b=\&w11=$m > $DATOS/w11-sala-$m.txt 2>&1
    echo "salida $?"; grep -E "huellas|bien, |\[w11\]" $DATOS/w11-sala-$m.txt | tail -3
    grep -h "\[w11\]" $DATOS/w11-sala-$m/*.txt 2>/dev/null | tail -1
    paso "w11=$m: la Contrarreloj copa 0 fila 0 (B salta)"
    MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
      --copa 0 --fila 0 --puerto 8184 --extra-b=\&w11=$m > $DATOS/w11-fantasma-$m.txt 2>&1
    echo "salida $?"; tail -6 $DATOS/w11-fantasma-$m.txt
    candado_hueco "sigue"
  done
  for v in 1 2; do
    for ap in pc baja; do
      paso "w11 tramo, vuelta $v, $ap"
      local ext="&dibujarSiempre=1"; local fl=""; [ $ap = baja ] && { ext="$GAMA_BAJA&dibujarSiempre=1"; fl="$LIMITES"; }
      local orden=("sin:" "con:&w11=7"); [ $v = 2 ] && orden=("con:&w11=7" "sin:")
      for x in "${orden[@]}"; do IFS=: read -r nom e <<< "$x"; tramo $SAL w11-$ap-$nom-$v "$ext$e" "$fl"; done
    done
    candado_hueco "sigue"
  done
}

# N3 (§208): la puerta A que quedó sin cerrar en §189: la gama baja con 5 pares, el juego en el Worker contra la página
# (el arnés de §186, la base de la etapa 0), con la revisión de límites de Android (W5)
puerta() {
  tomar "n3 puerta baja"
  paso "la puerta A, gama baja (lastre 3.5, ayuda 3, límites), 5 pares Worker/página"
  MKW_BUILD=$BASE/navegador timeout 10800 node herramientas/medir-trabajador.mjs --repetir 5 --lastre 3.5 \
    --extra "&lastreAyuda=3" --segundos 600 --etiqueta puerta-baja --chrome "$LIMITES" > $DATOS/puerta-baja.txt 2>&1
  echo "salida $?"; tail -14 $DATOS/puerta-baja.txt
}

# la carrera tiene que ser la misma con el lado de la carrera de W10 (sin dibujo, con la caja a un Worker): la sala de
# dos (A con ?w10=7, B normal) con las huellas iguales, y la Contrarreloj contra el experto, cuadro por cuadro
sala() {
  tomar "w10 sala"
  for p in 0.0 13.2; do
    paso "la sala en la pista $p: A sin dibujo y con la caja (w10=7), B normal"
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8184 \
      --datos=$DATOS/sala-$p --pistas=$p --semilla=1234 --extra-a=\&w10=7 > $DATOS/sala-$p.txt 2>&1
    echo "salida $?"; grep -E "huellas|bien, " $DATOS/sala-$p.txt | tail -3
  done
}
fantasma() {
  tomar "w10 fantasma"
  paso "la Contrarreloj copa 0 fila 0: A normal, B sin dibujo y con la caja"
  MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
    --copa 0 --fila 0 --puerto 8184 --extra-b=\&w10=3 > $DATOS/fantasma-0-0.txt 2>&1
  echo "salida $?"; tail -6 $DATOS/fantasma-0-0.txt
}

# el perfil de CPU de la carrera (este PC) con y sin dibujo: ¿qué se encarece? (medir-sitio --perfilar)
perfil() {
  tomar "w10 perfil"
  for x in "base:$BASE:" "m1:$SAL:&w10=1"; do
    IFS=: read -r nom prog ext <<< "$x"
    paso "perfil de CPU, $nom"
    MKW_BUILD=$prog/navegador timeout 1200 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 8 \
      --ventana --piloto-espera 600 --nucleos 8 --puerto $PUERTO --etiqueta w10-perfil-$nom --perfilar \
      --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$ext" \
      > $DATOS/w10-perfil-$nom.txt 2>&1
    echo "$nom: $(grep -o 'tramo (§163).*' $DATOS/w10-perfil-$nom.txt | head -1)"
  done
}

[ $# -eq 0 ] && { sed -n 2,19p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; comprobar) comprobar ;; chrome) chrome ;; sala) sala ;; fantasma) fantasma ;; perfil) perfil ;; aislar) aislar ;; puerta) puerta ;; w11) w11 ;; siempre) siempre ;; dos) dos ;;
    *) sed -n 2,19p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
