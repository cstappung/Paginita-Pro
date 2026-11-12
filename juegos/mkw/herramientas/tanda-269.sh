#!/bin/bash
# La tanda de §269 (los 3 bugs del multijugador de la v2.0), con el candado de medición de siempre (herramientas/candado.sh).
#
# Resumen: corre, contra el programa publicado (build/web-final-w30), las pruebas que muestran cada bug y su arreglo.
#   copa       la copa de la sala con los karts de los humanos manejados por la CPU (prueba-sincro --copa: sí llegan a la
#              vuelta 3) y la traza del disco: ¿qué se lee en la última vuelta y qué fue a la red con la carrera andando?
#              ¿qué escalón («no llega a 60») anotó cada pestaña?
#   sincro     prueba-sincro --directa (13+ puntos; ahora con el punto §269: los dos karts se mueven con SU mando)
#   sala       prueba-sala --rapida (dos pestañas, la copa con puntos)
#   experiencia  prueba-experiencia (el sitio de verdad con dos cuentas; ahora con los puntos §269 del foco y el mando)
#   vuelta     prueba-vuelta-final (un jugador, perfil nuevo: la última vuelta de un humano, qué se lee y qué va a la red;
#              vuelta-baja = lo mismo con la gama baja: CPU ×4 y 20 Mbit/s)
#   carrera    medir-carrera-entera (un jugador, 12 CPU, perfil nuevo, gama baja y este PC: 0 pedidos en carrera)
# Uso:  bash herramientas/tanda-269.sh copa sincro sala experiencia carrera
# Todo va a build/web/datos/t269/<fase>.out (nombres de archivos del juego: nunca a git).
cd "$(dirname "$0")/.." || exit 1
QUIEN="bugs-multi (local_cb5459c6)"; source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-final-w30/navegador}
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
OUT=build/web/datos/t269; mkdir -p "$OUT"
candado_tomar "t269 $*"
for fase in "$@"; do
  echo "== $fase $(date '+%H:%M:%S')"
  case "$fase" in
    copa) node web/navegador/prueba-sincro.mjs --directa --copa --minutos=24 --puerto=8171 --datos=build/web/datos/t269/copa \
            "--extra=&trazaDisco=1" > "$OUT/copa.out" 2>&1 ;;
    sincro) node web/navegador/prueba-sincro.mjs --directa --puerto=8172 --datos=build/web/datos/t269/sincro > "$OUT/sincro.out" 2>&1 ;;
    sincro-red) node web/navegador/prueba-sincro.mjs --directa --puerto=8174 --datos=build/web/datos/t269/sincro-red "--extra=&redMala=${RED:-60,15,1}" > "$OUT/sincro-red.out" 2>&1 ;;
    lejos) node web/navegador/prueba-sincro.mjs --directa --k-en-cuenta ${ANTES:+--extra=&tardeVivo=0} --puerto=8175 --datos=build/web/datos/t269/lejos "--extra-b=&redMala=${RED:-250,20,0,ida}${EXTRA_LEJOS:-}" > "$OUT/lejos${ETQ:-}.out" 2>&1 ;;
    medir) node herramientas/medir-sala.mjs --n ${NS:-1,2,3,7,10,12} --etiqueta ${ETQ:-t269} ${BAJA:+--baja} ${CARGA:+--carga} ${PAGINA:+--pagina "$PAGINA"} ${MS_EXTRA:+--extra "$MS_EXTRA"} > "$OUT/medir${ETQ:+-$ETQ}.out" 2>&1 ;;
    # barrido: la misma medida con distintos interruptores (§269b). BARRIDO="etq=extra|etq2=extra2|…", NS (por omisión 2),
    # BAJA=1 = la gama baja; cada una a $OUT/barrido-<etq>.out
    barrido) IFS='|' read -ra CASOS <<< "$BARRIDO"
             # (cada caso puede llevar su N y el control: «etq@1=…» Single Player, «etq@2c=…» 2 carreras sueltas, «etq@2=…» la
             # sala de 2: así el antes y el después van intercalados en UNA vuelta del candado, con la misma carga del PC)
             for caso in "${CASOS[@]}"; do e="${caso%%=*}"; x="${caso#*=}"; n=${NS:-2}; c=${CARGA:-}
               if [[ "$e" == *@* ]]; then sp="${e#*@}"; e="${e%%@*}"; n="${sp%c}"; [[ "$sp" == *c ]] && c=1 || c=; fi
               echo "   · $e (N=$n${c:+, control}): $x"
               node herramientas/medir-sala.mjs --n $n --etiqueta b-$e ${PERFIL:+--perfil} ${BAJA:+--baja} ${c:+--carga} ${x:+--extra "$x"} > "$OUT/barrido-$e.out" 2>&1
               grep -A26 '^N=' "$OUT/barrido-$e.out" | cut -c1-260; done ;;
    # el celular del dueño por el cable, siempre por el marco seguro (herramientas/telefono-seguro.mjs): Single Player y la
    # sala PC + celular (copa de 2); TEL_ARGS = más opciones (--solo sp|sala, --pistas …)
    telefono) TELEFONO_ADB=${TELEFONO_ADB:-platform-tools-latest-windows/platform-tools/adb.exe} node herramientas/prueba-sala-telefono.mjs $TEL_ARGS > "$OUT/telefono${ETQ:-}.out" 2>&1 ;;
    # el programa W30 con los nombres de las funciones (sin --final: --profiling-funcs), solo para el perfil de §269b
    # (qué función cuesta de más en la sala); nunca se publica
    compilar-nombres) MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor              python herramientas/compilar-web.py --modo navegador --carpeta build/web-269n > "$OUT/compilar-nombres.out" 2>&1
             cp -n build/web-final-w30/navegador/pipelines.bin build/web-final-w30/navegador/bloques.json build/web-269n/navegador/ 2>/dev/null ;;
    # §269b: el programa con la animación de los pilotos con su propio azar (semillas_nativo.cpp, bit 64), para probarlo
    compilar-azar) MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor              python herramientas/compilar-web.py --modo navegador --carpeta build/web-269e > "$OUT/compilar-azar.out" 2>&1
             cp -n build/web-final-w30/navegador/pipelines.bin build/web-final-w30/navegador/bloques.json build/web-269e/navegador/ 2>/dev/null ;;
    # §269b: el programa de depuración del azar (MKW_DEPURAR_LS=1: quién mueve azar1/azar2 en cada cuadro,
    # depurar_lockstep.cpp; con ?depura=desde-hasta&depuraAzar=2); solo para comparar el PC con el teléfono, nunca se publica
    compilar-depura) MKW_DEPURAR_LS=1 MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor              python herramientas/compilar-web.py --modo navegador --carpeta build/web-269d > "$OUT/compilar-depura.out" 2>&1
             cp -n build/web-final-w30/navegador/pipelines.bin build/web-final-w30/navegador/bloques.json build/web-269d/navegador/ 2>/dev/null ;;
    # la carrera directa de dos con más parámetros (SINCRO_EXTRA): las huellas iguales con un cambio del dibujo (§269b)
    sincro-x) node web/navegador/prueba-sincro.mjs --directa ${SINCRO_ARGS:-} --puerto=8173 --datos=build/web/datos/t269/sincro-x${ETQ:-} "--extra=${SINCRO_EXTRA}" > "$OUT/sincro-x${ETQ:-}.out" 2>&1 ;;
    buscar-clip) node herramientas/buscar-clip.mjs ${CLIP_ARGS:-} > "$OUT/buscar-clip${ETQ:-}.out" 2>&1 ;;
    sala) node web/navegador/prueba-sala.mjs --rapida > "$OUT/sala.out" 2>&1 ;;
    # §269b: la sala de dos con el arreglo del azar de la animación apagado (63) y prendido (lo de siempre), seguidas
    sala-ab) node web/navegador/prueba-sala.mjs --rapida "--extra=&arreglos=63" > "$OUT/sala-63.out" 2>&1
             node web/navegador/prueba-sala.mjs --rapida > "$OUT/sala-127.out" 2>&1 ;;
    experiencia) node herramientas/prueba-experiencia.mjs > "$OUT/experiencia.out" 2>&1 ;;
    vuelta) node herramientas/prueba-vuelta-final.mjs --pista 0.0 ${VUELTA_EXTRA:+--extra "$VUELTA_EXTRA"} > "$OUT/vuelta.out" 2>&1
            node herramientas/prueba-vuelta-final.mjs --pista 13.2 --vuelta 1 ${VUELTA_EXTRA:+--extra "$VUELTA_EXTRA"} >> "$OUT/vuelta.out" 2>&1 ;;
    vuelta-sala) node herramientas/prueba-vuelta-final.mjs --sala --pista 0.0 ${VUELTA_EXTRA:+--extra "$VUELTA_EXTRA"} > "$OUT/vuelta-sala.out" 2>&1 ;;
    sala-copa) node herramientas/prueba-vuelta-sala.mjs > "$OUT/sala-copa.out" 2>&1 ;;
    sala-copa-red) node herramientas/prueba-vuelta-sala.mjs --red-b 50,20 --puerto 8180 > "$OUT/sala-copa-red.out" 2>&1 ;;
    vuelta-132) node herramientas/prueba-vuelta-final.mjs --pista 13.2 --vuelta 1 > "$OUT/vuelta-132.out" 2>&1 ;;
    vuelta-baja) node herramientas/prueba-vuelta-final.mjs --pista 0.0 --baja > "$OUT/vuelta-baja.out" 2>&1 ;;
    caja) node web/navegador/prueba-caja-negra.mjs > "$OUT/caja.out" 2>&1 ;;
    tactil) node web/navegador/prueba-tactil.mjs > "$OUT/tactil.out" 2>&1 ;;
    doce) node web/navegador/prueba-doce.mjs --n ${N:-12} > "$OUT/doce-${N:-12}.out" 2>&1 ;;
    uno) node web/navegador/prueba-directa.mjs > "$OUT/uno.out" 2>&1 ;;
    memoria) node herramientas/medir-memoria-pistas.mjs --pistas 0.0,1.1,2.2,3.3,4.0,5.1,6.2,7.3 --segundos 20 --etiqueta t269${ETQ} ${MEM_EXTRA:+--extra "$MEM_EXTRA"} > "$OUT/memoria${ETQ}.out" 2>&1 ;;
    carrera) node herramientas/medir-carrera-entera.mjs --etiqueta t269 --pistas 13.2 > "$OUT/carrera.out" 2>&1
             node herramientas/medir-carrera-entera.mjs --etiqueta t269-baja --baja --pistas 13.2 > "$OUT/carrera-baja.out" 2>&1 ;;
    *) echo "fase desconocida: $fase" ;;
  esac
  echo "   salió $? $(date '+%H:%M:%S')"; tail -3 "$OUT/$fase.out" 2>/dev/null
  candado_hueco
done
candado_soltar
