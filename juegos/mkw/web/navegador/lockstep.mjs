// La carrera sincronizada (lockstep) de la sala — bitácora §61, §70, §75 y §80.
//
// Resumen: en la sala, cada navegador corre LA MISMA carrera offline (12 karts: los humanos de la sala y CPU) y para que
// salga igual en todos, en cada cuadro todos usan los mismos botones de cada humano. El juego (pad_web.cpp) pide los
// botones de un cuadro con pad(cuadro) y espera la respuesta (96 enteros: 12 mandos × 8; §91, antes 4). Este módulo:
//   - guarda lo que toca este jugador para el cuadro actual + SU retraso y se lo manda a todos (llegan por la malla
//     WebRTC, canal "udp") y responde cuando tiene los de todos para ese cuadro;
//   - §80, el retraso de cada uno: cada jugador elige el suyo (2 a 12 cuadros) y lo ajusta durante la carrera. Los
//     demás le cuentan cada medio segundo con cuánta HOLGURA les llegan sus botones (cuántos cuadros antes de
//     necesitarlos) y si tuvieron que esperarlos: si llegan justos, sube; si sobran 3 cuadros por 2 s, baja. Así quien
//     tiene la conexión lenta paga él solo (su kart responde más tarde) y los demás no lo esperan. Los botones de cada
//     uno los escribe solo él, por eso nadie tiene que ponerse de acuerdo (los paquetes dicen de qué cuadro es cada uno);
//   - cada paquete repite los últimos 16 cuadros (si se pierde uno, el siguiente lo trae); si igual falta alguno,
//     pide que se lo reenvíen (a todos: cualquiera que lo tenga contesta);
//   - §80, el RELEVO: un jugador es la "autoridad" (el primero que sigue en la carrera; si se atrasa él, le pasa el
//     papel a otro). Cuando alguien se atrasa seguido (a la mayoría de los demás le llegan tarde sus botones dos ratos
//     seguidos), la autoridad lo "releva": en SU propio paquete de cada cuadro lleva también el botón de ese jugador —
//     el de verdad si ya le llegó, si no uno inventado (el último que tuvo; si es viejo, solo acelerar y el volante
//     soltándose). Todos, el atrasado incluido, usan para él lo que dice la autoridad. Como todos necesitan igual el
//     paquete de la autoridad (es un jugador más), no hay viajes ni esperas de más, y nadie espera al atrasado: su kart
//     responde tarde o "solo", pero la carrera de los demás sigue a 60. Cuando sus botones vuelven a llegar a tiempo
//     (3 s seguidos), vuelve a lo directo. Como un relé de respaldo: si un lazo se cae, el respaldo sostiene la línea;
//   - si un humano se calla de golpe (o nunca llega, 45 s), queda un hueco: cuadros suyos que ya contaban con sus
//     botones de verdad y que nadie tiene. Ahí sí se espera; si no aparece en el MARGEN (?margen=N s; en la sala,
//     2 s), el "decisor" de ese corte (el primero que sigue que no es él, en el orden de la sala: uno solo, siempre el
//     mismo) lo corta en dos fases: pregunta a todos hasta qué cuadro ya corrieron o tienen sus botones —cada uno, al
//     contestar, se queda quieto ahí hasta saber la decisión— y corta DESPUÉS del máximo. Desde ese cuadro su kart
//     sigue sin nadie (neutro + "conectado = 2": el juego deja de esperarlo en la meta). El corte no cambia nunca. Si
//     una consola ya había corrido más allá (no contestó a tiempo), su copia ya no es la de los demás: se sale de esta
//     carrera ("fuera") y vuelve en la siguiente;
//   - §93, la largada: en los primeros 10 s de cada carrera el margen es más largo (la página: 15 s; si su pestaña
//     sigue contestando, hasta 45 s), porque la primera vez que alguien juega su navegador puede trabarse ahí unos
//     segundos armando gráficos: no es que se fue;
//   - cada 120 cuadros compara una "huella" de la carrera (el avance de los 12 karts) y, §80, otra de los botones que
//     usó en cada cuadro: si no coinciden, la carrera se desincronizó (no debería pasar);
//   - §75, quién corre cada carrera: la sala (sala-carrera.mjs) dice al empezar cada carrera quiénes están fuera
//     (fijarCarrera(k, fuera)): esos van "sin nadie" desde el cuadro 0, en todas las consolas por igual. Quien recargó
//     la página con la carrera andando avisa que se la salta (saltar): el decisor lo corta enseguida.
// Como un sistema de control distribuido con reloj común: nadie avanza un paso hasta tener las entradas de todos; el
// relevo es el respaldo que evita que un solo lazo lento frene a todo el sistema.
//
// Formato de los mensajes (binario, el primer byte 0xA7 los distingue de los de red.mjs, que empiezan con el largo):
//   [0xA7, tipo, carrera, mando, u32 cuadro, …]
//   13 botones: u8 cuántos cuadros, u8 adelanto (§80b: cuántos cuadros por delante del suyo de ahora es el último del
//      paquete; 0xFF = lo reenvía otro) y por cada cuadro: 8 bytes de botones, u16 relevados (un bit por mando), u16
//      inventados, u8 a quién pasa la autoridad desde el cuadro siguiente (0xFF = a nadie), y 8 bytes por cada relevado
//   2 pide · 3 corte (u8 cuántos siguen y u8 el mando más bajo que sigue, según el que corta) · 4 huella (u32 carrera +
//   u32 botones) · 5 propone corte · 6 "hasta aquí llego" (i32) ·
//   7 ping y 8 respuesta (cuadro = número de ping, f64 la hora del ping) · 10 informe (u8 banderas y por cada uno de los 12 mandos:
//   i8 holgura, u8 espera/4 ms, u8 espera más larga/4 ms, u8 ratos malos seguidos, i8 ventaja §80b) · 14 "me salgo de
//   esta carrera".
//   8 bytes de botones: botones u16, stick x/y, stick C x/y (i8), gatillos L/R (u8).
//
// Uso:  const ls = crearLockstep({ yo, humanos: [{ uid, mando }], enviar: (uid, bytes, canal) => …, local: () => [7 números] });
//       Module.mkwLockstep = ls;  malla → ls.alBinario(de, bytes)  (los que empiezan con MARCA)
//       §75: ls.fijarCarrera(k, [mandos fuera]); ls.saltar(mando, k); ls.enCuadro(k, cuadro, fn) (fn en ese cuadro)
//       §110: ls.agregar({ uid, mando }) entre carreras (llegó con la copa andando; hasta que corra, va en `fuera`)
export const MARCA = 0xA7;
export const RETRASO = 3;                  // el de partida si no hay medidas (y el de siempre con ?retraso=fijo)
export const RETRASO_MIN = 2;
// (§269: 12 → 18. Con 2 PCs y una ida y vuelta de más de 200 ms —un repetidor, otra ciudad—, con 12 sus botones le
// llegaban tarde a la autoridad toda la carrera. 300 ms: solo lo sufre quien tiene esa conexión)
export const RETRASO_MAX = 18;
const PING_CADA = 500, MARGEN_MS = 6, MUESTRAS = 3, VENTANA = 16, TIRON_MS = 100, REVISAR_MS = 40;
const REPITE = 16, CADA_HUELLA = 30, ESPERA_PIDE = 7, ESPERA_CORTE = 4000, ESPERA_INICIO = 45000;
// §93 (C4), la LARGADA: los primeros 600 cuadros (10 s) de cada carrera. La primera vez que alguien juega, ahí su
// navegador todavía arma gráficos y lee pedazos del disco, y su pestaña puede quedar trabada varios segundos (medido:
// 5-9 s justo al largar). En ese tramo no se usa el margen corto de la sala: al que se calla se le espera esperaLargada
// (la página: 15 s) y al que se sigue oyendo (sus pings llegan: la pestaña vive, solo espera al disco) hasta esperaInicio
const LARGADA = 600;
const INFORME_CADA = 500;                  // cada cuánto cada consola cuenta cómo le llegan los botones de cada uno
const RELEVO_MIN = 6, SANO = 6;            // ratos: relevado al menos 3 s, y 3 s sin problemas para volver a lo directo
// §99 (crítico de la red, C2): la autoridad pasa el papel si la mayoría la vio mal MALAS_AUTORIDAD ratos en los últimos
// VENTANA_AUTORIDAD ratos (10 s), no 4 seguidos: tirones espaciados (cada 2,5 s) nunca sumaban 4 seguidos y la autoridad
// trabada congelaba a todos en cada tirón
const MALAS_AUTORIDAD = 2, VENTANA_AUTORIDAD = 20;
// §99 (D): el papel pasa solo a quien tiene al menos PASO_MINIMO puntos más que la autoridad (ver puntaje)
const PASO_MINIMO = 200;
// §179 (R7): la subida mínima de la autoridad (kbit/s): con 12 manda ~2–3 Mbit/s
const SUBIDA_MIN = 2000;
// §99 (VR v2): el «ausente» se mira en el primer minuto de cada carrera
const QUIETO_HASTA = 3600;
// §99 (C3), ponerse al día: si voy más de UMBRAL_PRISA cuadros atrás de más de la mitad, pido correr seguido lo que
// falta menos PRISA_DEJA (lo último lo cierra la sincronía de tiempo de los demás, sin pasarme), a lo más PRISA_MAX
const UMBRAL_PRISA = 3, PRISA_DEJA = 2, PRISA_MAX = 120;            // (120 cuadros = 2 s: el tope del runtime, mkw_prisa)
// §102: «sé ponerme al día solo» (bandera 2 del informe) vale si de verdad lo logro: pasados RATOS_PRUEBA ratos atrás,
// tengo que haber corrido al menos GANA_MIN (4 %) más cuadros que los del tiempo en que corrí (sin esperas, frenos ni
// tirones). Una PC justa (15 ms de trabajo por cuadro) pide la ráfaga y no gana nada: a esa la esperan los demás
const RATOS_PRUEBA = 3, GANA_MIN = 0.04;
// §99 (C4), la largada pareja: cuando ya cargó al menos la mitad, al que falta se lo espera a lo más ESPERA_MITAD (y
// larga «fuera»: entra en la siguiente, como quien recarga); en la cuenta regresiva todos con al menos RETRASO_CUENTA
// cuadros de retraso (el turbo de salida pide la misma anticipación a todos); el último en cargar espera media ida y
// vuelta (a lo más LARGADA_MAX_MS) antes del cuadro 0: así los demás, que lo esperan, y él ven la cuenta a la vez
const ESPERA_MITAD = 15000, RETRASO_CUENTA = 6, LARGADA_MAX_MS = 150;
// §99 (C1), el relevo rápido. Un tirón o un corte de uno congelaba a los 12 (lo que dura el tirón, o el margen entero de
// 2 s). Ahora, a los PAUSA_MS de esperarlo, su decisor lo PAUSA con el mismo corte en dos fases (sin esperar su
// respuesta: el callado es él): desde el cuadro decidido su kart va, en todas las consolas, con un botón calculado
// igual en todas a partir del último que se usó (acelerar si iba acelerando y el volante soltándose en APAGA_PAUSA
// cuadros), y nadie lo espera. Cuando vuelve (y se puso al día, C3) pide volver: su decisor fija el cuadro de la vuelta,
// VUELTA_MARGEN cuadros más adelante (a todos les tiene que llegar antes de correrlo), y desde ahí maneja otra vez. Si
// en PAUSA_A_CORTE no volvió, la pausa se vuelve el corte de siempre (para que la meta no lo espere).
const PAUSA_MS = 150, APAGA_PAUSA = 60, VUELTA_MARGEN = 60, PAUSA_A_CORTE = 20000;
// §100: la consola que se fue (opción ido) se corta sin margen si además no llega nada suyo hace IDO_MS
const IDO_MS = 1000;
// §99 (H8): si no llega nada de NADIE hace SORDO_MS, el que se cortó soy yo (no «espero a X»)
const SORDO_MS = 1000;
// §191 (R1): con el árbitro, la autoridad se detiene si no oye a NADIE hace SORDO_MS (la aislada es ella); desde el cuadro
// SOLO_MAX (antes, los demás todavía cargan)
const SOLO_MAX = 60;
// §191 (R1): con el árbitro, el traspaso voluntario del papel rige LEAD_TRASPASO cuadros después del aviso: lo que la
// nueva autoridad ya escribió como «no autoridad» (va hasta su retraso adelante) no trae el registro de los demás, y
// los demás tienen que alcanzar a mandarle lo suyo
const LEAD_TRASPASO = RETRASO_MAX + 4;
// §99 (S1): lo que manda un tercero de los botones de otro solo vale si lo pedí hace poco, si hay un corte en curso de
// ese mando, o si su dueño se calló hace más de CALLADO_MS (ahí otro reparte lo que tenía de él)
const PEDIDO_VALE = 2000, CALLADO_MS = 300;
// §80b, la sincronía de tiempo (prendida; ?sincroTiempo=0 la apaga): me freno si voy más de UMBRAL_SINCRO cuadros por delante de alguien
// que va suelto; a lo más DEUDA_MAX cuadros por rato, uno cada CADA_FRENO cuadros (como mucho un 12 % más lento un
// momento); al que va más de TOPE_SINCRO cuadros atrás no se lo espera (eso es del relevo)
const UMBRAL_SINCRO = 1, TOPE_SINCRO = 20, CADA_FRENO = 8, DEUDA_MAX = 4;
// §269b.19: con el árbitro, el que no es la autoridad se frena por ella solo desde 3 cuadros delante (antes desde 2).
// ?umbralSincro=N = otro umbral (1 = antes)
const LENTA_PROPIA = /[?&]lentaPropia=1(&|$)/.test(globalThis.location?.search || '');   // §269b.20 (abajo)
const UMBRAL_SINCRO_ARB = (() => { const m = /[?&]umbralSincro=(\d+)/.exec(globalThis.location?.search || ''); return m ? Number(m[1]) : 2; })();
// §269: un jugador que se oyó hace menos de esto está vivo aunque sus botones lleguen tarde (inventado(): va su último
// botón de verdad entero). ?tardeVivo=0 = como antes (solo A y el volante soltándose)
const VIVO_MS = 400;
const TARDE_VIVO = !/[?&]tardeVivo=0\b/.test(globalThis.location?.search || '');
// §269b (el dueño, con su celular: «el PC le gana por 2 segundos»; la orquestadora: «con el lockstep la diferencia nunca
// debe pasar de unos cuadros; si el celular no alcanza 60, toda la sala va a su ritmo»): con el árbitro la autoridad no
// se frenaba por nadie (§191) y, si el lento seguía mandando, usaba sus botones atrasados (tardeVivo): medido en el Oppo,
// el PC llegó a ir 685 cuadros (11 s) delante y el teléfono manejaba con sus botones de hace segundos. Ahora la
// AUTORIDAD se frena si va más de UMBRAL_VIVO cuadros delante de un jugador que sigue mandando (algo suyo hace menos de
// 1 s) y que no se pone al día solo: lo que va delante sale de los informes (delanteDe, la red se cancela: un jugador
// LEJOS pero con un aparato que da 60 no la frena), y se frena un cuadro en CADA cuadro hasta alcanzarlo (con
// CADA_FRENO = 8, como los demás, no alcanzaba: un teléfono a 38 cuadros/s necesita que la sala baje de 60 a 38).
// Al callado (más de 1 s sin nada) no: se lo releva como antes. ?esperaVivo=0 = como antes
const ESPERA_VIVO = !/[?&]esperaVivo=0\b/.test(globalThis.location?.search || '');
// §269b.15 (el simulador, «uno-lento»: la autoridad le inventaba al lento el 8–10 % de los botones; su retraso ya estaba en
// el tope, 18, y la autoridad se le iba hasta 23–25 cuadros delante en un tirón suyo antes de que el freno —que decide con
// dos informes, hasta 1 s— se prendiera). La espera fina por el botón de verdad del lento (§269b.8) va desde que ese
// jugador está más de ESPERA_FINA cuadros detrás de mí (descontada media ida y vuelta), sin esperar al freno. Solo con
// el que la sala sigue (se oye, avanza, da al menos frenoPiso). **Apagada por omisión** (medido con el simulador: empeora;
// esperar el botón del lento o del lejano atrasa el registro que ese mismo jugador necesita para seguir corriendo, y la
// vuelta suma una ida y vuelta entera: uno-lejos 8,9 → 38 % de inventados, el lento de uno-lento bajó de 45 a 35 cuadros/s).
// ?esperaFina=N = prenderla desde N cuadros detrás; 0 = solo con el freno prendido (lo de siempre)
const ESPERA_FINA = (() => { const m = /[?&]esperaFina=(\d+)/.exec(globalThis.location?.search || ''); return m ? Number(m[1]) : 0; })();
const UMBRAL_VIVO = 6, DEUDA_VIVO_MAX = 60, VIVO_OIDO_MS = 1000, VIVO_RECIENTE_MS = 5000;
// §269b.12 (la planilla, «sala-doce»: con el teléfono simulado —CPU ×4, ~20 cuadros/s— el freno de §269b llevaba a los
// 11 demás a ~21 cuadros/s toda la carrera; antes de §269b el teléfono quedaba atrás y los PC iban a 60). La sala sigue al
// lento solo si su aparato da al menos FRENO_PISO cuadros de lógica por segundo (medido con lo que me llega de él, en
// ventanas de FRENO_VENTANA_MS): el que da menos FRENO_RINDE_N veces seguidas ya no frena a nadie en esa carrera (queda
// atrás y se sale solo pasados 10 s, §269b.7). ?frenoPiso=0 = seguirlo a cualquier ritmo, como antes
const FRENO_PISO = (() => { const m = /[?&]frenoPiso=(\d+)/.exec(globalThis.location?.search || ''); return m ? Number(m[1]) : 40; })();
const FRENO_VENTANA_MS = 2000, FRENO_RINDE_N = 3;
// §269b.17 (la sesión de los picos, 2 PC + Oppo, 8 corridas: el 1 % bajo de los PC caía de ~92 a 14–51 % en la mitad de las
// corridas, con el freno nuevo y con el viejo). En todas las caídas, la autoridad cambió a mitad de carrera y la nueva
// encontró al teléfono 41–125 cuadros atrás (la anterior ya no lo seguía: «rendido») y se frenó 35–60 cuadros de una vez:
// todos los PC esperándola. Al que va más de FRENO_LEJOS cuadros detrás (descontada media ida y vuelta) el freno no lo
// persigue: se pone al día solo o se sale a los 10 s (§269b.7). ?frenoLejos=0 = perseguirlo a cualquier distancia (antes)
// §269b.18 (abajo): **apagado por omisión** (medido con el Oppo, 4 pares: con él la sala se cayó las 4 veces, sin él 1 de 4);
// ?frenoBase=1 = prenderlo
const FRENO_BASE = /[?&]frenoBase=1(&|$)/.test(globalThis.location?.search || ''), FRENO_BASE_MS = 5000;
const FRENO_LEJOS = (() => { const m = /[?&]frenoLejos=(\d+)/.exec(globalThis.location?.search || ''); return m ? Number(m[1]) : 30; })();
// §269b.7 (la orquestadora: «el PC le gana»; medido en el Oppo con un programa descartado que lo trababa: el teléfono
// entró a la carrera pero se arrastraba, y el PC —la autoridad, con el árbitro nadie la espera— corrió solo y le
// inventó 11.298 cuadros; el teléfono, relevado, seguía corriendo la misma carrera 5.000 cuadros atrás, sin ver nada
// de lo que pasaba). Ahora el que va relevado y más de ATRAS_SALIR cuadros (10 s) detrás de lo que ya tengo de la
// autoridad se sale de esa carrera (vuelve en la siguiente, como al recargar): los demás lo cortan al recibir el aviso.
// ?cortarTarde=0 = como antes
const CORTAR_TARDE = !/[?&]cortarTarde=0\b/.test(globalThis.location?.search || '');
const ATRAS_SALIR = 600;
const NO_ALCANZO_MS = 10000, RETIENE_MS = 2000, VOLVIO_MS = 1000;
const RETENER = !/[?&]retener=0b/.test(globalThis.location?.search || '');   // §269b.8: ?retener=0 = como antes
// §269b.11 (el simulador de sala, «uno-lejos»: al lejano, con picos de lag de +150 ms, la autoridad le inventaba el 10 %
// de los botones: en cada pico sus botones llegaban 2-3 cuadros tarde). Ahora, si a un vivo que manda seguido le falta el
// botón del cuadro que voy a escribir, la autoridad lo espera hasta ESPERA_CORTA_MS en ese cuadro, con un tope de
// ESPERA_CORTA_SEG ms por segundo (un pico cuesta unos 40 ms una vez; después sus botones vuelven a llegar a tiempo).
// Solo si sus botones siguen llegando (el último hace menos de ESPERA_CORTA_FLUYE ms) y el que falta está a no más de
// ESPERA_CORTA_CERCA cuadros del último que tengo: el que se trabó (no manda) no frena a nadie.
// Y solo al que va a la par (los informes: a no más de ESPERA_CORTA_PAR cuadros de mí): si le falta el botón es la red;
// al que va atrás (se trabó y se pone al día) no se lo espera aquí: eso es el freno de §269b. Y solo al que «suele llegar
// tarde por poco»: en los últimos ESPERA_CORTA_HIST ms, al menos ESPERA_CORTA_VECES botones que le inventé me llegaron
// después a menos de ESPERA_CORTA_TARDE ms, y son la mayoría de los que llegaron (el que se trabó manda lo suyo cientos de
// ms tarde: a ese no le sirve esperar).
// APAGADA POR OMISIÓN (§269b.12, el simulador PC + Oppo: con N8 el teléfono manda sus botones de a pares cada 33 ms, el
// segundo de cada par «llega tarde por poco» y esta espera hacía esperar a la autoridad —y a los PC, a su registro— al
// ritmo del teléfono; ganaba poco: uno-lejos 10,5 % → 8,9 %). ?esperaCorta=1 = prendida
const ESPERA_CORTA = /[?&]esperaCorta=1b/.test(globalThis.location?.search || '');
const ESPERA_CORTA_MS = 17, ESPERA_CORTA_SEG = 120, ESPERA_CORTA_CERCA = 4, ESPERA_CORTA_FLUYE = 100, ESPERA_CORTA_PAR = 3,
  ESPERA_CORTA_TARDE = 60, ESPERA_CORTA_HIST = 30000, ESPERA_CORTA_VECES = 3;
const FRENO_VIVO_N = 3, FRENO_VIVO_MUCHA = 12;   // (§269b.13: con más de 12 cuadros de deuda, de a 3; si no, de a 1)        // §269b.8: cuántos cuadros cobra de una vez el freno por el lento (la autoridad baja hasta 1/4)   // §269b.8: cuánto vale un «no alcanzo a ponerme al día»
const ENVEJECE = 6, APAGA = 30;            // el botón inventado: el último por 6 cuadros; después el volante se suelta en 30
const SIN_DATO = 127, NO_SE = 255;
// §101: las esperas de más de esto (ms) se anotan con lo que faltaba (?esperasLog=N para depurar; por omisión 500)
const ESPERAS_LOG = Number(new URLSearchParams(globalThis.location?.search || '').get('esperasLog')) || 500;
// §91: hasta 12 humanos (Mario Kart en línea): los mandos de la sala van de 0 a 11 (pad_web.cpp: 0-3 con puerto, el resto virtuales)
export const MANDOS = 12;
// §236: el árbitro en un servidor (arbitro-servidor.mjs, herramientas/arbitro/servidor.mjs) es un participante más SIN
// kart: su mando es el 12, uno después de los 12 de la carrera. Manda paquetes como cualquiera (los suyos, neutros, y
// el registro de todos: es la autoridad), pero sus botones no van a ningún kart ni a la huella de la carrera, nadie lo
// releva y el papel no se le pasa (solo empieza con él, si la sala lo eligió). Las tablas internas tienen SLOTS casillas
// (la 12 es la suya); en los paquetes y en los informes de siempre siguen siendo 12 (el informe agrega la suya al final)
export const SERVIDOR = MANDOS;
const SLOTS = MANDOS + 1;
const TODOS = Array.from({ length: MANDOS }, (_, m) => m);
const fila = v => Array(SLOTS).fill(v);
const NEUTRO = [0, 0, 0, 0, 0, 0, 0];
// R4 (§230): las tablas de cada mando como ANILLOS de tamaño fijo, no `Map` que crecen toda la carrera (antes unas 216
// mil entradas en 5 min con 12, y un arreglo nuevo por botón recibido: basura que el recolector tenía que limpiar a
// cada rato). Un anillo guarda los últimos ANILLO cuadros: la casilla del cuadro f es f % ANILLO, con su «etiqueta» (qué
// cuadro tiene) para no confundir el f con el f + ANILLO. Como un registro de desplazamiento circular de un osciloscopio:
// la memoria es siempre la misma y se va escribiendo encima de lo más viejo. Cada casilla tiene su arreglo de 7 que se
// reescribe en el lugar (se crea la primera vez que se usa la casilla; los anillos de una carrera vuelven a una reserva
// y los usa la siguiente). 2048 cuadros = 34 s: lo más viejo que se lee es 64 cuadros atrás (el botón inventado, el
// reparto de un corte) y una pausa se vuelve corte a los 20 s (PAUSA_A_CORTE).
const ANILLO = 2048;
class Anillo {
  constructor() { this.tag = new Int32Array(ANILLO).fill(-1); this.val = new Array(ANILLO).fill(null); this.size = 0; this.mayor = -1; }
  reiniciar() { this.tag.fill(-1); this.size = 0; this.mayor = -1; return this; }
  has(f) { return f >= 0 && this.tag[f & (ANILLO - 1)] === f; }
  get(f) { return f >= 0 && this.tag[f & (ANILLO - 1)] === f ? this.val[f & (ANILLO - 1)] : undefined; }
  // ¿cabe el cuadro f? (uno más viejo que lo que el anillo guarda no se escribe: taparía uno nuevo)
  cabe(f) { return f >= 0 && f > this.mayor - ANILLO; }
  // la casilla del cuadro f, lista para escribir los 7 valores (size = cuántos cuadros distintos llegaron en la carrera)
  casilla(f) {
    const k = f & (ANILLO - 1);
    if (this.tag[k] !== f) { this.tag[k] = f; this.size++; if (f > this.mayor) this.mayor = f; }
    return this.val[k] || (this.val[k] = [0, 0, 0, 0, 0, 0, 0]);
  }
  set(f, v) { const c = this.casilla(f); for (let i = 0; i < 7; i++) c[i] = v[i]; return this; }
}
// Lo que agrega la autoridad a su cuadro (masc, sust, sig y los botones de los relevados), también en anillo: cada
// casilla es un objeto que se reusa, con sus 12 arreglos de 7
class AnilloReg {
  constructor() { this.tag = new Int32Array(ANILLO).fill(-1); this.val = new Array(ANILLO).fill(null); }
  reiniciar() { this.tag.fill(-1); return this; }
  get(f) { return f >= 0 && this.tag[f & (ANILLO - 1)] === f ? this.val[f & (ANILLO - 1)] : undefined; }
  // escribe la casilla del cuadro f (los slots se copian: k → arreglo de 7 o null)
  poner(f, masc, sust, sig) {
    const k = f & (ANILLO - 1);
    let x = this.val[k];
    if (!x) x = this.val[k] = { masc: 0, sust: 0, sig: 0xFF, slots: new Array(MANDOS).fill(null), buf: Array.from({ length: MANDOS }, () => [0, 0, 0, 0, 0, 0, 0]) };
    this.tag[k] = f; x.masc = masc; x.sust = sust; x.sig = sig; x.slots.fill(null);
    return x;
  }
  set(f, r) {
    const x = this.poner(f, r.masc, r.sust, r.sig);
    for (let m = 0; m < MANDOS; m++) if (r.slots[m]) { const b = x.buf[m], v = r.slots[m]; for (let i = 0; i < 7; i++) b[i] = v[i]; x.slots[m] = b; }
    return this;
  }
}
// la reserva de anillos: los de la carrera que terminó vuelven aquí y los usa la siguiente (sin crear 2048 arreglos más)
const reservaAnillos = [], reservaRegs = [];
const anilloNuevo = () => (reservaAnillos.pop() || new Anillo()).reiniciar();
const regNuevo = () => (reservaRegs.pop() || new AnilloReg()).reiniciar();
function soltarAnillos(tablas, regs) {
  if (tablas) for (const t of tablas.values()) if (reservaAnillos.length < 4 * MANDOS) reservaAnillos.push(t);
  if (regs) for (const r of regs.values()) if (reservaRegs.length < 4 * MANDOS) reservaRegs.push(r);
}
// el búfer de envío que se reusa (paqueteA): una vista del largo justo de cada paquete, guardada por largo
const cuentaBits = x => { let n = 0; for (let k = 0; k < MANDOS; k++) if ((x >> k) & 1) n++; return n; };
const memEnvio = new ArrayBuffer(8192), dvEnvio = new DataView(memEnvio), vistasEnvio = new Map();
function bufEnvio(n) {
  if (n > memEnvio.byteLength) return new Uint8Array(n);   // (no pasa: 16 cuadros con 12 relevados son ~1,8 KB)
  let v = vistasEnvio.get(n); if (!v) vistasEnvio.set(n, v = new Uint8Array(memEnvio, 0, n));
  v.fill(0);
  return v;
}
const START = 0x1000;                      // pausa: en la carrera de la sala no se pausa (pausaría solo una consola)
const BOTON_A = 0x0100;                    // acelerar (el botón inventado lo mantiene si estaba)

export function crearLockstep({ yo, humanos, enviar, local, huella = null, retraso: retrasoBase = RETRASO, registro = () => {},
  // R5 (§154): cada cuántos cuadros se compara la huella (antes 120; ?huellaCada=120 = como antes)
  huellaCada = Number((globalThis.location?.search || '').match(/[?&]huellaCada=(\d+)/)?.[1]) || CADA_HUELLA,
  ahora = () => performance.now(), esperaCorte = ESPERA_CORTE, esperaInicio = ESPERA_INICIO,
  // §93: el margen de la largada (por omisión el mismo de siempre: lo agranda la página) y cuántos cuadros dura
  esperaLargada = esperaCorte, cuadrosLargada = LARGADA,
  // ?retraso=fijo en la dirección de la página = el camino viejo (siempre 3, sin ajustar), para comparar
  adaptar = !/[?&]retraso=fijo\b/.test(globalThis.location?.search || ''), retrasoMax = RETRASO_MAX, pingCada = PING_CADA,
  tardeVivo = TARDE_VIVO,                  // §269: al vivo que llega tarde, su último botón de verdad entero
  esperaCorta = ESPERA_CORTA,              // §269b.11: la autoridad espera un momento el botón que viene en camino
  frenoBase = FRENO_BASE,                  // §269b.18: el freno resta el desfase de base (sigue al que se va quedando atrás)
  frenoLejos = FRENO_LEJOS,                // §269b.17: el freno no persigue al que va más de esto detrás (cuadros; 0 = a cualquier distancia)
  frenoPiso = FRENO_PISO,                  // §269b.12: el freno sigue al lento solo si da al menos esto (cuadros/s; 0 = a cualquier ritmo)
  esperaFina = ESPERA_FINA,                // §269b.15: la espera fina por el lento desde N cuadros detrás (0 = solo con el freno)
  esperaVivo = ESPERA_VIVO,                // §269b: la autoridad se frena por el lento que sigue mandando (la sala va a su ritmo)
  retener = RETENER,                       // §269b.8: los avisos sobre cuadros ya corridos esperan la decisión de las islas
  noAlcanzoMs = NO_ALCANZO_MS,             // §269b.8: cuánto vale un «no alcanzo a ponerme al día» (0 = como antes)
  cortarTarde = CORTAR_TARDE,              // §269b.7: con el árbitro, el relevado que va más de 10 s atrás se sale de la carrera
  // ?relevo=0 = sin relevo (todos esperan a todos, como antes de §80), para comparar
  relevo = !/[?&]relevo=0\b/.test(globalThis.location?.search || ''),
  // §80b: la sincronía de tiempo (el dueño la prendió, 2026-10-20; ?sincroTiempo=0 = sin ella, como en §80): el que va
  // adelantado se frena un poco para que el que se trabó no quede atrás y su retraso no se vaya subiendo
  sincroTiempo = !/[?&]sincroTiempo=0\b/.test(globalThis.location?.search || ''),
  // §99 (C3): ms => … le pide al runtime que corra seguidos esos ms de cuadros (ponerse al día; null = no se puede)
  prisa = null,
  frenar = null,                           // §269b.16: ms => correr la cuadrícula de retrazados del runtime (mkw_frenar); null = esperar en el cuadro
  // §99 (C4): () => true mientras corre la cuenta regresiva (la página lo lee del juego; sin ella, no hay regla de la
  // cuenta: el banco y las pruebas de siempre)
  enCuenta = null,
  // §250: () => la etapa de la carrera (Raceinfo +0x28: 0 presentación, 1 cuenta, 2 carrera…; la página la lee del
  // juego). Solo para anotar en qué cuadro y a qué hora empezó cada una en esta consola (est.largada); null = no se anota
  etapa = null,
  // §250: (carrera, cuadro) => … cuando esta consola ve el «¡YA!» (la página se lo avisa al servidor de Oracle)
  alYa = null,
  // §250, la LARGADA PAREJA: hasta el «¡YA!» (mientras enCuenta() dice que no empezó la carrera, y a lo más los primeros
  // cuadrosLargada) nadie corre sin los botones de verdad de todos: la autoridad no escribe los de nadie (ni con el
  // árbitro ni con el relevo) y al callado no se lo pausa: se lo espera con el margen de la largada (§93). Así ninguna
  // consola corre la cuenta sola mientras otra está trabada armando la pista, y todas largan a la vez (a lo más su
  // retraso de la cuenta, 6 cuadros, de diferencia). Sin enCuenta (el servidor de Oracle, que no tiene el juego): los
  // primeros cuadrosBarrera cuadros (0 = no hay barrera: el banco de siempre). ?largadaPareja=0 = como antes de §250
  largadaPareja = !/[?&]largadaPareja=0\b/.test(globalThis.location?.search || ''), cuadrosBarrera = 0,
  // §99 (C1), el relevo rápido: al que se calla se lo PAUSA a los PAUSA_MS (no se lo corta a los 2 s); ?relevoRapido=0
  // = como antes
  relevoRapido = !/[?&]relevoRapido=0\b/.test(globalThis.location?.search || ''), pausaACorte = PAUSA_A_CORTE,
  // §177.5 (R3): la traba VIVA (la pestaña contesta los pings pero su juego no avanza: JSPI esperando el disco) también
  // se pausa a los PAUSA_MS, si su ping dice que no está esperando botones de nadie; ?trabaViva=0 = como antes
  trabaViva = !/[?&]trabaViva=0\b/.test(globalThis.location?.search || ''),
  // §179 (R7): () => { margen, subida, telefono } de esta consola: los ms libres por cuadro (16,7 − lo que trabaja), la
  // subida que estima WebRTC (kbit/s) y si es un teléfono. Viajan en el informe y suman al puntaje de la autoridad:
  // nunca un teléfono si hay un PC. null = no se sabe (como antes); ?autoridadCapaz=0 = no se usan
  capacidad = null, autoridadCapaz = !/[?&]autoridadCapaz=0\b/.test(globalThis.location?.search || ''),
  // §180.2: los inventados mientras me relevan no suben mi retraso (?calmaRelevado=0 = como antes)
  calmaRelevado = !/[?&]calmaRelevado=0\b/.test(globalThis.location?.search || ''),
  // §191 (R1), el árbitro (?arbitro=1; por omisión apagado, como el relevo de siempre): la autoridad escribe SIEMPRE los
  // botones de todos en su paquete (los que le llegaron a tiempo; si no, el inventado). Cada uno espera solo a la
  // autoridad y manda lo suyo solo a ella y al suplente (el que la reemplaza si se calla): la traba de uno no frena a
  // los demás. Sin la sincronía de §80b (no hace falta)
  arbitro = /[?&]arbitro=1\b/.test(globalThis.location?.search || ''),
  // §101: lo que esta pestaña estuvo trabada mientras esperaba no se le carga al que faltaba (es un tirón mío);
  // ?trabaPropia=0 = como antes, para comparar
  trabaPropia = !/[?&]trabaPropia=0\b/.test(globalThis.location?.search || ''),
  // §102: «sé ponerme al día» solo si de verdad gano cuadros (RATOS_PRUEBA, GANA_MIN); ?alcance=0 = como en §101
  alcanceReal = !/[?&]alcance=0\b/.test(globalThis.location?.search || ''),
  // §100: uid => true si esa consola se fue (la página: ni en el buzón de la sala ni con su WebRTC sano); null = no se sabe
  ido = null,
  // §100: i => true si el humano i (en el orden de `humanos`, el mismo de los jugadores de la carrera) ya cruzó la meta
  // (la página lo lee del juego: igual en todas las consolas). Desde ahí no cuenta como «quieto»: el juego ya no le pide
  // botones. null = no se sabe (el banco)
  llego = null,
  // §175: (islas) => {} cuando la sala se parte en dos o más (la página lo avisa); ver decidirIsla
  alPartida = null,
  cuadroMs = 1000 / 60, informeCada = INFORME_CADA }) {
  const rtt = new Map();                  // uid → { s: ida y vuelta suavizada (ms, para mostrar), m: las últimas VENTANA medidas,
                                          //         n: los números de ping que contestó }
  let pings = 0;                          // número del último ping (va en el campo "cuadro": la respuesta lo devuelve)
  const oido = new Map();                 // uid → la última vez que llegó algo de él (para saber quién está)
  const avanceDe = new Map();             // §177.5 (R3): mando → la última vez que su dueño mandó un botón nuevo (su juego avanza)
  const esperaDe = new Map();             // §177.5 (R3): uid → 1 si su último ping dice que espera botones de otro, 0 si no
  // §274 (la pausa de la sala de la auto calibración): congelada = esta consola tiene la lógica quieta (la página la
  // congela con congelar(true): el juego no corre cuadros y nadie decide pausas ni cortes por eso); congeladoDe = uid → la
  // última vez que su ping dijo «estoy congelado» (al que avisó así no se lo pausa ni se lo corta por no avanzar)
  let congelada = false, congeladaDesde = 0, congelarEnCuadro = null;
  const congeladoDe = new Map();
  const CONGELADO_VALE = 1500;
  const sigueCongelado = u => ahora() - (congeladoDe.get(u) ?? -Infinity) < CONGELADO_VALE;
  const miMando = humanos.find(h => h.uid === yo)?.mando ?? -1;
  const ISLAS = !/[?&]islas=0\b/.test(globalThis.location?.search || ''), ISLA_MS = 1500;   // (§175)
  const mandos = humanos.map(h => h.mando);
  const duenoDe = new Map(humanos.map(h => [h.mando, h.uid]));
  const mandoDe = new Map(humanos.map(h => [h.uid, h.mando]));
  let carrera = 0, ultimo = -1;           // carrera en curso (cuenta desde 1) y último cuadro pedido
  let miRetraso = retrasoBase, escrito = -1;   // §80: mi retraso de ahora y el último cuadro con mis botones ya escritos
  // tablas: mando → Map(cuadro → [7]) (los botones de cada uno); regs: mando → Map(cuadro → { masc, sust, sig, slots })
  // (lo que la autoridad agrega a su cuadro: a quién releva, cuáles inventó, a quién pasa el papel, los botones de ellos)
  let tablas = new Map(), regs = new Map(), cortes = new Map(), siguiente = null;
  const nuevo = new Map();                // mando → el último cuadro que tengo de él
  let cadena = [];                        // traspasos de la autoridad ya corridos: [[desde el cuadro, mando]]
  const relevados = new Map();            // (si soy la autoridad) mando → { desde, problema } (ms)
  let pasarA = null, traspaso = null;     // a quién voy a pasar la autoridad / a quién ya se la pasé
  let buenas = 0, sustituidosMios = 0, ultimaSubida = -Infinity, numInforme = 0;
  let autoridadLenta = false;
  // (§191, R1: con el árbitro, «holgura de sobra» desde 2 cuadros, no 3: lo mío da dos saltos —a la autoridad y de ella
  // a todos— y con 3 de margen en cada uno el retraso quedaba 3–4 cuadros sobre el de la autoridad)
  const HOLGADO = arbitro ? 2 : 3;              // §191 (R1): soy la autoridad y en el último rato corrí menos del 90 % del tiempo
  const malasAutoridad = [];               // §99: los ratos de los últimos VENTANA_AUTORIDAD (1 = la mayoría me vio mal)
  // §99 (D, autoridad por estabilidad): de cada mando, sus últimos VENTANA_AUTORIDAD ratos: si la mayoría lo vio mal
  // (su paquete llega tarde). La autoridad necesita además no ir atrás (delanteDe): si se traba o le llega todo tarde,
  // inventa los botones de gente sana y los obliga a subir su retraso
  const estab = new Map();
  const preferidas = new Map();            // §99 (D): carrera → el mando que la sala eligió como primera autoridad
  // §99 (VR v2, el «ausente»): de cada mando, la racha más larga de cuadros sin tocar nada (los 7 valores en 0) en el
  // primer minuto de la carrera (cuadros 0..QUIETO_HASTA−1). Son los botones de la carrera: el mismo número en todas las
  // consolas. 30 s seguidos (1800) = ausente, como la regla del juego en línea (0x8053F184): para el VR, cortado
  const quieto = new Map();
  // §99 (C1): mando → [{ desde, vuelve (null = todavía pausado), base (el botón que se usó en desde − 1), t }]
  const pausas = new Map();
  const ultimoUsado = new Map();          // mando → { f, v }: el botón que se usó para él en el último cuadro corrido
  let pidoVuelta = 0;                      // cuándo pedí volver la última vez
  let decisionMia = -Infinity;             // cuándo supe la última pausa o vuelta mía
  const ackDe = new Map();                 // §99 (H5): uid → el último cuadro seguido de MIS botones que ese ya tiene
  const contiguo = new Map();              // §99 (H5): mando → el último cuadro seguido que tengo de él
  const pedidosA = new Map();              // §99 (S1): mando → cuándo pedí sus botones a todos (tipo 2)
  let pausaUltima = -1;                    // §99: cuándo llamó el juego a pad la última vez (los tirones de esta PC)
  let msFrenoPropio = 0;                   // §269b.20: lo que la autoridad se frenó a propósito (freno y espera fina), sumado
  let msParado = 0;                        // §102: el tiempo en que no corrí (esperas, frenos, tirones), sumado
  let alcance = { ratos: 0, ganado: 0, corriendo: 0 };   // §102: lo que gané en los ratos seguidos que fui atrás
  // §80b: cuántos cuadros me tengo que frenar todavía (lo calcula cada informe), cuándo me frené la última vez, y mi
  // ventaja sobre cada mando en el rato anterior (la peor: la más chica)
  let deuda = 0, ultimoFreno = -Infinity;
  const ventajas = fila(SIN_DATO);
  const rachas = fila(0);                 // ratos malos seguidos de cada mando, según yo
  const informes = new Map();             // uid → su último informe { t, hol, esp, max, racha, dud } (también el mío)
  let ven = null;                         // lo que voy midiendo para mi próximo informe
  const bloqueos = new Map();             // mando → { hasta, desde }: corte en curso; no corro pasado `hasta`
  let fuera = null;                       // me salí de esta carrera (mi copia ya no es la de los demás)
  let espera = null;                      // { cuadro, desde, pedido, faltan, resolver }
  const huellas = new Map();              // cuadro → { mia, miaB, de: Map(uid → [huella, botones]) }
  const propuestas = new Map();           // corte propuesto: mando → { de: Map(uid → hasta qué cuadro), desde: ms, mio }
  const planteles = new Map();            // §75: carrera → Set(mandos fuera desde el cuadro 0), lo dice la sala
  const saltos = new Map();               // §75: carrera → Set(mandos que avisaron que se la saltan: se cortan ya)
  const acciones = new Map();             // §75: "carrera:cuadro" → función (en ese cuadro, en todas las consolas)
  const est = { cuadros: 0, esperas: 0, msEsperando: 0, maxEspera: 0, esperasLargas: 0, msLlegada: 0, desincronizado: null, huellasIguales: 0, cortes: [],
    retrasos: {}, retrasoMax: {}, conflictos: 0, esperaDe: {}, relevos: 0, inventados: 0, inventadosViejos: 0, tardeVivo: 0, tardeDe: {}, tardeEdad: {}, recibidosDe: {}, traspasos: 0, salidas: 0,
    hashBotones: 2166136261, relevadosAhora: [], autoridad: null, subidas: 0, bajadas: 0, frenos: 0, msFrenado: 0, adelanto: 0,
    estable: { malas: 0, atras: 0, rtt: null }, prisas: 0, prisaCuadros: 0, pausas: [], vueltas: 0, paquetesBotones: 0, enviosA: {}, arbitro };

  // (R4, §230: anillos, no Map; ver Anillo)
  const tabla = m => { let t = tablas.get(m); if (!t) tablas.set(m, t = anilloNuevo()); return t; };
  const reg = m => { let r = regs.get(m); if (!r) regs.set(m, r = regNuevo()); return r; };
  const cortadoEn = (m, c) => cortes.has(m) && c >= cortes.get(m);
  const vivos = () => humanos.filter(h => !cortes.has(h.mando));
  // §269b.8 (el simulador de sala, «se-va-y-vuelve»: C sin red 8 s; con el árbitro nadie se corta antes de 20 s, así que
  // cada lado PAUSÓ al otro. C, sola, pausó y cortó a A y a B; al volver la red esos avisos les llegaron y, como ya habían
  // corrido más allá, se salieron las tres). Para decidir qué isla sigue, mi isla = los que no corté NI pausé
  const enMiIsla = () => humanos.filter(h => !cortes.has(h.mando) && !pausaAbierta(h.mando));
  // §99 (C1): pausado en el cuadro c (en algún tramo: desde su pausa hasta su vuelta)
  const pausadoEn = (m, c) => { const ps = pausas.get(m); return !!ps && ps.some(x => c >= x.desde && (x.vuelve === null || c < x.vuelve)); };
  const pausaAbierta = m => pausas.get(m)?.find(x => x.vuelve === null) || null;
  // (para la autoridad: cortado, o pausado alguna vez desde ese cuadro; así el papel no vuelve a cambiar al volver)
  const sinAutoridadEn = (m, c) => cortadoEn(m, c) || !!pausas.get(m)?.some(x => c >= x.desde);
  const primerVivoEn = c => humanos.find(h => !sinAutoridadEn(h.mando, c))?.mando;
  // §99 (D): la primera autoridad de la carrera: la que eligió la sala (la más estable de las anteriores) si corre; si
  // no, el primero que sigue. Todas las consolas reciben la misma (fijarCarrera)
  let preferida;
  const inicial = () => preferida !== undefined && mandos.includes(preferida) && !sinAutoridadEn(preferida, 0) ? preferida : primerVivoEn(0);
  const ultimoDe = m => nuevo.get(m) ?? -1;
  // el último cuadro que ya corrí (si estoy esperando el `ultimo`, ese todavía no)
  const ejecutado = () => espera ? ultimo - 1 : ultimo;
  const yoRelevado = () => est.relevadosAhora.includes(yo);
  // (R4, §230: lo que se reusa en cada cuadro)
  const vLocal = [0, 0, 0, 0, 0, 0, 0], datosPad = new Int32Array(8 * MANDOS);
  let mascRelevados = 0;
  let noAlcanzoHasta = -Infinity;           // §269b.8: hasta cuándo vale el último «no alcanzo a ponerme al día»
  const volvioDe = new Map();               // §269b.8: uid → cuándo volvió a oírse después de más de VOLVIO_MS callado
  const retenidos = new Map(), descartados = new Set();   // §269b.8: avisos de pausa/corte sobre cuadros que ya corrí, esperando las islas
  // §269b.8 (el simulador de sala, «parejos»: un 📶 en los tres sin nadie lento): con el árbitro la autoridad escribe
  // los botones de TODOS, así que «relevados» trae siempre a todos menos a ella y el aviso salía en cada carrera. Para
  // avisar vale a quién se le INVENTAN (no le llegaron a tiempo) en más de LENTO_DE de los últimos LENTO_VENTANA cuadros
  // (y 2 s seguidos así, LENTO_RACHA: una ráfaga suelta —un tirón de la red— no es ir lento: en «parejos» salía igual una vez)
  const LENTO_VENTANA = 60, LENTO_DE = 15, LENTO_RACHA = 120;
  const lentoAnillo = new Uint16Array(LENTO_VENTANA), lentoCuenta = new Uint8Array(16), lentoRacha = new Uint16Array(16);
  let lentoPos = 0, lentosMasc = 0;

  function empaca(tipo, mando, cuadro, extra = 0) {
    const b = new Uint8Array(8 + extra);
    b[0] = MARCA; b[1] = tipo; b[2] = carrera & 255; b[3] = mando;
    new DataView(b.buffer).setUint32(4, cuadro >>> 0);
    return b;
  }
  const escribe8 = (d, o, v) => { d.setUint16(o, v[0] & 0xFFFF); for (let k = 1; k < 5; k++) d.setInt8(o + 1 + k, v[k]); d.setUint8(o + 6, v[5]); d.setUint8(o + 7, v[6]); };
  const lee8 = (d, o) => [d.getUint16(o), d.getInt8(o + 2), d.getInt8(o + 3), d.getInt8(o + 4), d.getInt8(o + 5), d.getUint8(o + 6), d.getUint8(o + 7)];
  // (R4: lo mismo, escrito en un arreglo que ya existe: la casilla del anillo)
  const lee8en = (d, o, c) => { c[0] = d.getUint16(o); c[1] = d.getInt8(o + 2); c[2] = d.getInt8(o + 3); c[3] = d.getInt8(o + 4); c[4] = d.getInt8(o + 5); c[5] = d.getUint8(o + 6); c[6] = d.getUint8(o + 7); };
  const bits = x => TODOS.filter(m => (x >> m) & 1);
  // los botones del mando m desde `desde` hasta `hasta` (los que tenga seguidos), con lo que agrega la autoridad
  function paquete(m, desde, hasta) {
    const t = tabla(m), r = reg(m), lista = [];
    for (let c = Math.max(desde, 0); c <= hasta; c++) { const v = t.get(c); if (!v) { if (lista.length) break; continue; } lista.push([v, r.get(c), c]); }
    if (!lista.length) return null;
    const largo = lista.reduce((s, [, x]) => s + 13 + (x ? 8 * bits(x.masc).length : 0), 0);
    const b = empaca(13, m, lista[0][2], 2 + largo), d = new DataView(b.buffer);
    b[8] = lista.length;
    // §80b: el adelanto (lo mío, hasta lo último que escribí: ahí el último cuadro menos el adelanto = mi cuadro de ahora)
    b[9] = m === miMando && lista.at(-1)[2] === escrito && ultimo >= 0 ? Math.min(254, Math.max(0, escrito - ultimo)) : 0xFF;
    let o = 10;
    for (const [v, x] of lista) {
      escribe8(d, o, v); d.setUint16(o + 8, x?.masc ?? 0); d.setUint16(o + 10, x?.sust ?? 0); b[o + 12] = x?.sig ?? 0xFF; o += 13;
      if (x) for (const k of bits(x.masc)) { escribe8(d, o, x.slots[k]); o += 8; }
    }
    return b;
  }
  const aTodos = (bytes, canal = 'udp') => { for (const h of humanos) if (h.uid !== yo) enviar(h.uid, bytes, canal); };
  // §99 (H5): el último cuadro que tengo de m sin huecos desde el principio de la carrera (el acuse que le mando)
  function contiguoDe(m) {
    if (m === undefined || m < 0) return -1;
    let c = contiguo.get(m) ?? -1;
    const t = tabla(m);
    while (t.has(c + 1)) c++;
    contiguo.set(m, c);
    return c;
  }
  // §99 (H5): los botones del mando m que le faltan a ese par (desde lo que me confirmó hasta `hasta`, a lo más REPITE;
  // al menos el último: así sigue llegando el adelanto de §80b). Tipo 15: como el 13, más un acuse (el último cuadro
  // seguido que tengo de SUS botones) y los 5 bytes de la autoridad solo si algún cuadro los trae. Antes se repetían
  // siempre los últimos 16 a todos: ~218 bytes por cuadro a cada uno con 12 pilotos
  // (R4, §230: sin listas intermedias y en un búfer que se reusa: este paquete sale en cada cuadro a cada uno. El
  // envío copia los bytes al mandar —RTCDataChannel.send, la red de mentira de las pruebas—, así que el mismo búfer sirve
  // para el siguiente)
  function paqueteA(uid, m, hasta) {
    const t = tabla(m), r = reg(m);
    const desde = Math.min(hasta, Math.max(hasta - REPITE + 1, (ackDe.get(uid) ?? -1) + 1, 0));
    let c0 = -1, c1 = -1;
    for (let c = desde; c <= hasta; c++) { if (!t.has(c)) { if (c0 >= 0) break; continue; } if (c0 < 0) c0 = c; c1 = c; }
    if (c0 < 0) return null;
    let conReg = false, largo = 0;
    for (let c = c0; c <= c1; c++) if (r.get(c)) { conReg = true; break; }
    for (let c = c0; c <= c1; c++) { const x = conReg ? r.get(c) : null; largo += 8 + (conReg ? 5 + (x ? 8 * cuentaBits(x.masc) : 0) : 0); }
    const b = bufEnvio(16 + largo), d = b.buffer === memEnvio ? dvEnvio : new DataView(b.buffer);
    b[0] = MARCA; b[1] = 15; b[2] = carrera & 255; b[3] = m; d.setUint32(4, c0 >>> 0);
    b[8] = c1 - c0 + 1;
    b[9] = m === miMando && c1 === escrito && ultimo >= 0 ? Math.min(254, Math.max(0, escrito - ultimo)) : 0xFF;
    const suyo = mandoDe.get(uid);
    // (§99, C1: bit 1 = hay una pausa (o su propuesta) para ti en camino: quédate quieto hasta saberla)
    b[10] = (conReg ? 1 : 0) | (suyo !== undefined && (propuestas.has(suyo) || bloqueos.has(suyo) || pausaAbierta(suyo)) ? 2 : 0);
    d.setUint32(12, suyo === undefined ? 0xFFFFFFFF : (contiguoDe(suyo) >>> 0));
    let o = 16;
    for (let c = c0; c <= c1; c++) {
      escribe8(d, o, t.get(c)); o += 8;
      if (conReg) {
        const x = r.get(c);
        d.setUint16(o, x?.masc ?? 0); d.setUint16(o + 2, x?.sust ?? 0); b[o + 4] = x?.sig ?? 0xFF; o += 5;
        if (x) for (let k = 0; k < MANDOS; k++) if ((x.masc >> k) & 1) { escribe8(d, o, x.slots[k]); o += 8; }
      }
    }
    return b;
  }

  // ---- el retraso de partida ----
  // Con las medidas del ping (las últimas VENTANA, 8 s) a cada uno: el "piso" es la más rápida (lo que tarda la red
  // cuando nadie se traba); las que pasan del piso + TIRON_MS (100 ms) son tirones (una pestaña cargando) y no cuentan;
  // de las otras, la que deja 9 de cada 10 por debajo (percentil 90). Si se perdieron respuestas: la mediana + un
  // cuadro. La ida es media ida y vuelta; + un margen; en cuadros, entre el mínimo y el máximo. Desde §80 es solo el
  // punto de partida de MI retraso (en la carrera se ajusta con lo que cuentan los demás, ajustarRetraso) y no se
  // mira al peor de todos sino a la MITAD que mejor llega: si a uno solo le llega tarde lo de todos, la conexión lenta
  // es la de él (ver vista), y que yo agrande mi retraso por él no le sirve a nadie.
  function perdio(r) {
    // los pings de hace más de 2 s (los más nuevos pueden venir en camino) desde el primero que contestó
    const hasta = pings - 4, desde = Math.max(Math.min(...r.n), hasta - VENTANA + 1);
    return hasta - desde + 1 >= 6 && r.n.filter(n => n >= desde && n <= hasta).length < hasta - desde + 1;
  }
  function calcularRetraso() {
    const idas = [];
    for (const h of vivos()) {
      const r = h.uid !== yo && rtt.get(h.uid);
      if (!r) continue;
      const piso = Math.min(...r.m), o = r.m.filter(x => x <= piso + TIRON_MS).sort((a, b) => a - b);
      if (o.length < MUESTRAS) continue;
      const q = f => o[Math.min(o.length - 1, Math.floor(f * o.length))] / 2;
      idas.push(Math.max(q(0.9), perdio(r) ? q(0.5) + cuadroMs : 0));
    }
    idas.sort((a, b) => a - b);
    const ida = idas.length ? idas[Math.ceil(idas.length / 2) - 1] : 0;   // con 1 o 2 el más rápido; con 3 el del medio
    return Math.min(retrasoMax, Math.max(retrasoBase, Math.ceil((ida + MARGEN_MS) / cuadroMs)));
  }
  // cada medio segundo: un ping a cada uno (las medidas sirven para el retraso de partida de la carrera siguiente)
  const unPing = () => {
    const b = empaca(7, miMando & 255, ++pings, 13);
    const dv = new DataView(b.buffer);
    dv.setFloat64(8, ahora());
    dv.setUint32(16, Math.max(0, ejecutado()) >>> 0); b[20] = (espera ? 1 : 0) | (congelada ? 2 : 0);   // (§177.5: el cuadro que corrí y si espero a alguien; §274: bit 2 = congelada)
    aTodos(b, 'udp');
  };
  const latido = pingCada > 0 ? setInterval(unPing, pingCada) : null;

  function ventanaNueva() { ven = { hol: fila(SIN_DATO), esp: fila(0), max: fila(0), ven: fila(SIN_DATO), dud: false, t0: ahora(), c0: est.cuadros, p0: msParado, fp0: msFrenoPropio }; }
  ventanaNueva();

  function nuevaCarrera() {
    carrera++; ultimo = -1; escrito = -1; espera = null; avanceDe.clear(); huellas.clear(); propuestas.clear(); bloqueos.clear();
    congelarEnCuadro = null;   // (§274: una pausa pedida para la carrera de antes no vale para esta)
    cadena = []; relevados.clear(); pasarA = null; traspaso = null; fuera = null; buenas = 0; sustituidosMios = 0;
    ultimaSubida = -Infinity; malasAutoridad.length = 0; rachas.fill(0); informes.clear(); nuevo.clear(); ventanaNueva();
    ackDe.clear(); contiguo.clear(); pedidosA.clear(); pausaUltima = -1; mitadDesde = null; largado = false; noAlcanzoHasta = -Infinity; retenidos.clear(); descartados.clear(); frenoVivoEn = -Infinity; vivoMando = null; ritmoVivo.clear(); rendidos.clear(); autDesde = null; huboOtraAut = false; lejosAvisado.clear(); baseVivo.clear(); est.rendidos = []; invCuadro.fill(-1); for (const h of tardeHist) h.length = 0; lentoCuenta.fill(0); lentoRacha.fill(0); lentoAnillo.fill(0); lentoPos = 0; lentosMasc = 0; est.lentosAhora = arbitro ? [] : undefined; est.yoLento = false;
    alcance = { ratos: 0, ganado: 0, corriendo: 0 }; cubiertoDesde = Infinity; enviadoA.clear();
    barreraAhora = false; est.cuadrosBarrera = 0;
    deuda = 0; ultimoFreno = -Infinity; ventajas.fill(SIN_DATO); est.sumaRetraso = 0; est.cuadrosCarrera = 0;
    estab.clear(); delanteDe.clear(); est.estable = { malas: 0, atras: 0, rtt: null }; quieto.clear();
    pausas.clear(); ultimoUsado.clear(); pidoVuelta = 0; est.pausas = []; est.pausasDe = []; est.salidaPor = null; est.vueltas = 0; preferida = preferidas.get(carrera);
    for (const k of [...preferidas.keys()]) if (k < carrera) preferidas.delete(k);
    est.relevadosAhora = []; mascRelevados = 0; est.hashBotones = 2166136261;
    soltarAnillos(tablas, regs);           // (R4: los de la carrera anterior vuelven a la reserva)
    if (siguiente?.carrera !== carrera && siguiente) soltarAnillos(siguiente.tablas, siguiente.regs);
    tablas = siguiente?.carrera === carrera ? siguiente.tablas : new Map();
    regs = siguiente?.carrera === carrera ? siguiente.regs : new Map();
    cortes = siguiente?.carrera === carrera ? siguiente.cortes : new Map();
    for (const [m, t] of tablas) if (t.mayor > (nuevo.get(m) ?? -1)) nuevo.set(m, t.mayor);
    if (planteles.has(carrera)) {
      // §75: la sala dijo quiénes están fuera de esta carrera (desde el cuadro 0); los demás corren aunque se hayan
      // cortado en la anterior: volvieron
      for (const m of planteles.get(carrera)) if (!cortes.has(m) || cortes.get(m) > 0) cortes.set(m, 0);
    } else {
      // sin plantel (la sala vieja, §61): los que se fueron en la carrera anterior siguen fuera
      for (const c of est.cortes) if (!cortes.has(c.mando)) cortes.set(c.mando, 0);
    }
    for (const k of [...planteles.keys()]) if (k < carrera - 1) planteles.delete(k);
    for (const k of [...saltos.keys()]) if (k < carrera) saltos.delete(k);
    for (const k of [...acciones.keys()]) if (Number(k.split(':')[0]) < carrera) acciones.delete(k);
    siguiente = null;
    miRetraso = adaptar ? calcularRetraso() : retrasoBase;
    est.retrasos[carrera] = miRetraso; est.retrasoMax[carrera] = miRetraso;
    est.autoridad = duenoDe.get(inicial()) ?? null;
    registro(`[lockstep] carrera ${carrera}: ${humanos.length} humanos, yo en el mando ${miMando}, mi retraso de partida ${miRetraso}` +
      `, autoridad ${est.autoridad} — idas y vueltas: ${[...rtt].map(([u, x]) => `${u} ${x.m.map(v => v.toFixed(0)).join('/')} ms${perdio(x) ? ' (perdió alguna)' : ''}`).join('; ') || 'sin medir'}`);
  }

  // ---- §80: la autoridad ----
  // La del cuadro c (ya corrido o el que se está por correr): con los traspasos ya corridos y los cortes. Todas las
  // consolas la calculan igual.
  function autoridadEn(c) {
    let a = inicial();
    for (const [d, m] of cadena) if (d <= c) a = m;
    return a === undefined || sinAutoridadEn(a, c) ? primerVivoEn(c) : a;
  }
  // Recorre los cuadros desde `desde` mirando lo que ya llegó de cada autoridad (sus traspasos). fn(c, a, x) por cada
  // cuadro con el paquete de su autoridad a (x = lo que agregó, o undefined); si fn devuelve false, para. Devuelve el
  // primer cuadro que no se pudo mirar y su autoridad (−1 = falta un paquete de la autoridad: no se sabe).
  function recorrer(desde, hasta, fn) {
    if (arbitro) return recorrerArbitro(desde, hasta, fn);
    let c = Math.max(0, desde), a = autoridadEn(c);
    for (; c < hasta; c++) {
      if (a === undefined || !tabla(a).has(c)) return { c, a: -1 };
      const x = reg(a).get(c);
      if (fn && fn(c, a, x) === false) return { c, a };
      if (x && x.sig < MANDOS) a = x.sig;
      if (sinAutoridadEn(a, c + 1)) a = primerVivoEn(c + 1);
    }
    return { c, a: a ?? -1 };
  }
  // §191 (R1): lo mismo con el árbitro, con el traspaso LEAD_TRASPASO cuadros después del aviso (los avisos ya corridos
  // están en `cadena`; los que encuentra en el camino, en `pend`)
  function recorrerArbitro(desde, hasta, fn) {
    const c0 = Math.max(0, desde), pend = [];
    let c = c0, a = autoridadEn(c);
    for (; c < hasta; c++) {
      if (c > c0) {
        for (const [d, m] of cadena) if (d === c) a = m;
        for (const [d, m] of pend) if (d === c) a = m;
        if (a !== undefined && sinAutoridadEn(a, c)) a = primerVivoEn(c);
      }
      if (a === undefined || !tabla(a).has(c)) return { c, a: -1 };
      const x = reg(a).get(c);
      if (fn && fn(c, a, x) === false) return { c, a };
      if (x && x.sig < MANDOS) pend.push([c + 1 + LEAD_TRASPASO, x.sig]);
    }
    if (c > c0) {
      for (const [d, m] of cadena) if (d === c) a = m;
      for (const [d, m] of pend) if (d === c) a = m;
      if (a !== undefined && sinAutoridadEn(a, c)) a = primerVivoEn(c);
    }
    return { c, a: a ?? -1 };
  }
  // ¿quién va a ser la autoridad en el cuadro f (que todavía no se corre)? Si falta un paquete en el medio, no se sabe
  // (−1): entonces no escribo relevos en ese cuadro (todos ven lo mismo: nada). Sirve para saber si los escribo yo.
  const autoridadPrevista = f => recorrer(Math.max(0, ultimo), f).a;
  // §191 (R1): a quiénes mando lo mío con el árbitro: la autoridad del cuadro f y el suplente (el primero que sigue sin
  // ella: el que toma el papel si se la pausa o se la corta). null = a todos (soy la autoridad, o no sé quién es)
  let cubiertoDesde = Infinity;            // el primer cuadro en que vi lo mío escrito por la autoridad (desde ahí me cubre)
  const enviadoA = new Map();              // uid → hasta qué cuadro le mandé lo mío sin ser autoridad ni suplente
  // (la autoridad del cuadro f con lo que ya tengo de ella: lo que escribo va varios cuadros adelante y ese paquete suyo
  // casi nunca llegó todavía; si falta, la del último que tengo. Y el suplente: el primero que sigue sin ella)
  function autoridadConocida(f) {
    const r = recorrer(Math.max(0, ultimo), f);
    let a = r.a;
    if (a === undefined || a < 0) { a = autoridadEn(Math.max(0, ultimo)); recorrer(Math.max(0, ultimo), r.c, (c, aa) => { a = aa; }); }
    return a !== undefined && a >= 0 && sinAutoridadEn(a, f) ? primerVivoEn(f) : a;
  }
  const suplenteDe = (a, f) => humanos.find(h => h.mando !== a && !sinAutoridadEn(h.mando, f))?.mando;
  const soySuplente = f => { const a = autoridadConocida(f); return a !== undefined && a >= 0 && a !== miMando && suplenteDe(a, f) === miMando; };
  function destinosArbitro(f) {
    const a = autoridadConocida(f);
    if (a === undefined || a < 0 || a === miMando) return null;
    const s = suplenteDe(a, f);
    // (el suplente manda lo suyo a todos: si la autoridad se calla, desde ahí manda él y todos necesitan sus cuadros)
    if (s === miMando) return null;
    // (y el que decide mi pausa o mi corte: me tiene que oír seguido, los pings van cada medio segundo y la pausa es a los
    // PAUSA_MS)
    const dec = mandoDe.get(decisorDe(miMando));
    return new Set([a, s, dec].filter(k => k !== undefined && k !== miMando));
  }
  // El último cuadro hasta el que todo, desde lo que ya corrí, va con el mando m relevado (para saber hasta dónde
  // puedo seguir sin sus botones de verdad mientras se decide su corte)
  function alcanceRelevo(m) {
    let k = ejecutado();
    recorrer(k + 1, k + 1 + 64, (c, a, x) => { if (a === m || !x || !((x.masc >> m) & 1)) return false; k = c; });
    return k;
  }
  // El botón inventado para el mando m en el cuadro f (no llegó a tiempo): el último que tengo de él; si hace más de
  // ENVEJECE cuadros que no llega nada, sin botones nuevos (solo acelerar, si lo tenía apretado) y el volante se suelta
  // de a poco en APAGA cuadros (que no se estrelle por un botón viejo).
  function inventado(m, f) {
    let u = Math.min(ultimoDe(m), f);
    const t = tabla(m);
    while (u >= 0 && !t.has(u) && u > f - 64) u--;
    const vivo = tardeVivo && ahora() - (oido.get(duenoDe.get(m)) ?? -Infinity) < VIVO_MS;
    // (§269: del vivo que va más de 64 cuadros atrás —su PC no da 60 y nadie lo espera—, igual su último de verdad)
    if (!t.has(u) && vivo && ultimoDe(m) >= 0 && ultimoDe(m) <= f && t.has(ultimoDe(m))) u = ultimoDe(m);
    const v = t.get(u);
    if (!v) return NEUTRO;
    const edad = f - u;
    if (edad <= ENVEJECE) return v;
    // §269 (bug 3 del dueño, con 2 PCs: «desde el ¡YA! el kart queda acelerando y no reacciona a botones»): si sus
    // paquetes SIGUEN llegando (lo oí hace menos de VIVO_MS) pero tarde —la ida y vuelta es más larga que su retraso—,
    // no es un callado: va su último botón DE VERDAD entero (con la demora de su conexión, pero manejando), no «solo A»
    // con el volante soltándose, que con todo tarde era para siempre: el kart aceleraba solo y no doblaba.
    // (Solo lo usa la autoridad al escribir el registro: no tiene que ser igual en todas las consolas.) ?tardeVivo=0 = antes
    if (vivo) {
      est.tardeVivo = (est.tardeVivo || 0) + 1;
      const uid = duenoDe.get(m); est.tardeDe[uid] = (est.tardeDe[uid] || 0) + 1; est.tardeEdad[uid] = edad;
      if (est.tardeDe[uid] % 300 === 1) registro(`[lockstep] ⚠ §269: los botones de ${uid} me llegan ${edad} cuadros tarde (más que su retraso): va con su último botón de verdad (${est.tardeDe[uid]} cuadros así en esta carrera)`);
      return v;
    }
    est.inventadosViejos++;
    const k = Math.max(0, 1 - (edad - ENVEJECE) / APAGA);
    return [v[0] & BOTON_A, Math.round(v[1] * k), Math.round(v[2] * k), 0, 0, 0, 0];
  }
  // §99 (C1): el botón del pausado, k cuadros después del comienzo de su pausa: el último que se usó para él, con el
  // acelerador si iba acelerando y el volante soltándose en APAGA_PAUSA cuadros (solo depende de ese botón y de k: el
  // mismo en todas las consolas)
  function congelado(base, k) {
    const f = Math.max(0, 1 - (k + 1) / APAGA_PAUSA);
    return [base[0] & BOTON_A, Math.round(base[1] * f), Math.round(base[2] * f), 0, 0, 0, 0];
  }
  // lo que la autoridad agrega a su cuadro f: los relevados (su botón de verdad si ya llegó, si no uno inventado) y
  // el traspaso, si toca
  // (R4, §230: lo que devuelve es un objeto que se reusa —el anillo de la autoridad lo copia en el momento—)
  const regTmp = { masc: 0, sust: 0, sig: 0xFF, slots: fila(null) };
  function registroPara(f, reserva = false) {
    let masc = 0, sust = 0, sig = 0xFF;
    const slots = regTmp.slots; slots.fill(null);
    const uno = m => {
      if (m === miMando || m >= MANDOS || cortadoEn(m, f)) return;   // (§236: el servidor no tiene kart: nadie lo releva)
      masc |= 1 << m;
      const real = tabla(m).get(f);
      if (real) slots[m] = real;
      else { slots[m] = inventado(m, f); sust |= 1 << m; if (!reserva) { est.inventados++; const i = m * 128 + (f & 127); if (invCuadro[i] !== f) { invCuadro[i] = f; invHora[i] = ahora(); } } }
    };
    // (§191, R1: con el árbitro, todos los que ya mandaron algo en esta carrera; el que todavía carga no: a ese se lo
    // espera como siempre, y sus primeros botones van a todos)
    // (§250: antes del «¡YA!», de nadie: todos corren con los botones de verdad de todos, la largada pareja)
    if (barreraAhora) {}
    else if (arbitro) { for (const m of mandos) if (tabla(m).size > 0) uno(m); }
    else for (const m of relevados.keys()) uno(m);
    if (!reserva && pasarA !== null && !traspaso) {
      sig = pasarA; traspaso = { cuadro: f, a: pasarA }; pasarA = null; est.traspasos++;
      registro(`[lockstep] paso la autoridad a ${duenoDe.get(sig)} desde el cuadro ${f + 1 + (arbitro ? LEAD_TRASPASO : 0)} (me esperaban a mí${autoridadLenta ? ': corro lenta' : ''})`);
    }
    if (!(masc || sig !== 0xFF)) return null;
    regTmp.masc = masc; regTmp.sust = sust; regTmp.sig = sig;
    return regTmp;
  }

  // ---- §80: los informes de cada medio segundo ----
  // Cada consola mide, para cada jugador, la holgura con que le llegan sus botones (cuadros antes de necesitarlos; el
  // peor del rato), cuánto lo esperó (en total y la espera más larga) y cuántos ratos seguidos le fue mal ("malo" =
  // lo esperó medio cuadro o más, o llegaron tarde). Si el rato fue "dudoso" (esperé a alguien, o me estaba
  // poniendo al día), la holgura no dice nada del que manda y solo cuentan las esperas.
  // ¿De quién es el problema? Del jugador m solo si lo ve MÁS DE LA MITAD de los que informan de él: si a uno solo le
  // llega tarde todo, el problema es de la conexión de ESE (recibe tarde de todos), y él se atrasa solo. Y lo que dice
  // un jugador al que la mayoría ve mal, o justo, o que va relevado, no cuenta; ni el de uno que ve mal a TODOS los
  // demás (dos o más): ese "pasa hambre", la conexión mala es la suya (si recibe tarde, ve tarde a todos).
  function hambriento(inf) {
    if (!inf || ahora() - inf.t > 1.5 * informeCada) return false;
    let total = 0, malos = 0;
    for (let k = 0; k < MANDOS; k++) {
      if (inf.racha[k] === NO_SE) continue;
      total++;
      if (inf.racha[k] > 0 || (!inf.dud && inf.hol[k] !== SIN_DATO && inf.hol[k] < 1)) malos++;
    }
    return total >= 2 && malos === total;
  }
  // §99 (D): cuántos cuadros voy delante de cada uno (lo de §80b: mi medida y la suya, la red se cancela), con los
  // relevados también. El que va atrás es el que se traba: su PC no da, o le llega todo tarde y espera. Desde afuera
  // eso no se distingue (ve tarde a los demás, y los demás lo ven tarde a él), pero ir atrás sí se mide
  const delanteDe = new Map();
  function medirDelantes() {
    const t = ahora();
    for (const h of humanos) {
      const m = h.mando;
      if (m === miMando || cortes.has(m) || !tabla(m).size) { delanteDe.delete(h.uid); continue; }
      const inf = informes.get(h.uid);
      // (§191, R1: con el árbitro, solo lo de este rato: una medida vieja —de antes de un traspaso— me frenaba sin motivo)
      if (!inf || t - inf.t > 1.5 * informeCada) { if (arbitro) delanteDe.delete(h.uid); continue; }
      const mia = ventajas[m], suya = inf.ven?.[miMando];
      if (mia === SIN_DATO || suya === undefined || suya === SIN_DATO) { if (arbitro) delanteDe.delete(h.uid); continue; }
      delanteDe.set(h.uid, (mia - suya) / 2);
    }
  }
  // §99 (D): mi ida y vuelta típica (ms): con cada uno la mediana de sus últimas medidas y, de esas, la de la mitad de
  // abajo (con dos, la menor). Quien tiene la red mala la tiene alta con TODOS; los demás, baja con alguno. Es lo que
  // distingue al que recibe tarde (los demás lo ven tarde a él y él a ellos: desde los informes no se sabe quién es)
  function miRtt() {
    const vals = [];
    for (const h of humanos) {
      if (h.uid === yo || cortes.has(h.mando)) continue;
      const x = rtt.get(h.uid);
      if (!x?.m?.length) continue;
      const ms = [...x.m].sort((a, b) => a - b);
      vals.push(ms[Math.floor((ms.length - 1) / 2)]);
    }
    if (!vals.length) return null;
    vals.sort((a, b) => a - b);
    return vals[Math.floor((vals.length - 1) / 2)];
  }
  const rttDe = m => m === miMando ? miRtt() : (informes.get(duenoDe.get(m))?.rtt ?? null);
  // §99 (D): ¿la red de m es claramente peor que la mía? (su ida y vuelta, más del doble y 20 ms más): no le paso el papel
  function peorRed(m) {
    const a = rttDe(miMando), b = rttDe(m);
    return a !== null && b !== null && b > Math.max(2 * a, a + 20);
  }
  // §99 (C3): Mario Kart Wii no se pone al día solo: si un cuadro tarda, el siguiente va igual a su hora y la consola
  // queda atrás para siempre (y relevada: pierde el control de su kart). Si voy atrás de más de la mitad de los que se
  // pueden medir, le pido al runtime que corra seguidos los cuadros que me faltan (dibujándolos todos), una vez cada
  // dos ratos (lo medido tiene hasta 0,75 s: pedir en cada rato pediría dos veces lo mismo). Con la pestaña escondida no
  function pedirPrisa() {
    if (!puedoPrisa() || ultimo < 0) return;
    if (ahora() - ultimaPrisa < 2 * informeCada) return;
    const mitad = atrasDeLaMitad();
    if (!(mitad > UMBRAL_PRISA)) return;
    const n = Math.min(PRISA_MAX, Math.floor(mitad - PRISA_DEJA));
    if (n < 1) return;
    ultimaPrisa = ahora(); est.prisas++; est.prisaCuadros += n;
    // (§101: aquí no se marca alDiaHasta: con una PC justa esto se repite cada segundo mientras voy atrás y nunca
    // pediría volver de una pausa; que voy atrás ya lo dicen mis informes, atrasDeLaMitad)
    registro(`[lockstep] voy ${mitad.toFixed(1)} cuadros atrás de la mayoría: me pongo al día ${n} cuadros`);
    try { prisa(n * cuadroMs); } catch {}
  }
  // ¿puedo ponerme al día yo solo? (el runtime sabe correr cuadros seguidos y la pestaña se ve)
  function puedoPrisa() { return !!prisa && !globalThis.document?.hidden && !fuera && !cortes.has(miMando); }
  // cuántos cuadros voy atrás de más de la mitad de los que se pueden medir (negativo = adelante; 0 = no sé)
  // §191 (R1): cuánto voy delante de la autoridad según el último rato, medido solo por mí: mi cuadro menos el suyo
  // cuando mandó su paquete (lo más chico del rato). Incluye lo que tarda la red (un poco «delante» de más), pero está
  // desde el primer paquete: la medida de dos lados de §80b necesita su informe. 0 = soy la autoridad o no sé
  function delanteAutoridad() {
    const a = autoridadEn(Math.max(0, ultimo));
    return a === undefined || a === miMando || ventajas[a] === SIN_DATO ? 0 : ventajas[a];
  }
  function atrasDeLaMitad() {
    // (§191, R1: con el árbitro, contra la autoridad sola: nadie la frena a ella, así que cada espera chica mía me deja
    // atrás para siempre si no me pongo al día; y de los demás ya no recibo nada: sus medidas quedarían viejas)
    if (arbitro) {
      const a = autoridadEn(Math.max(0, ultimo)), d = a === undefined || a === miMando ? undefined : delanteDe.get(duenoDe.get(a));
      return d === undefined ? -delanteAutoridad() : -d;
    }
    const atras = [...delanteDe.values()].map(d => -d).sort((a, b) => b - a);   // (+ = voy atrás de él), de mayor a menor
    return atras.length ? atras[Math.floor(atras.length / 2)] : 0;
  }
  // §99 (C3): un tirón de esta PC (la pausa entre dos cuadros, sin contar las esperas a los demás ni los frenos): lo
  // que duró, menos un cuadro, son los cuadros que quedé atrás (el juego no los recupera). Se pide ponerse al día en el
  // momento, sin esperar a que lo digan las medidas de los demás (que llegan con hasta 0,75 s de atraso)
  function tironPropio(ms) {
    if (!puedoPrisa()) return;
    const n = Math.min(PRISA_MAX, Math.floor(ms / cuadroMs) - 1);
    if (n < 1) return;
    ultimaPrisa = ahora(); est.prisas++; est.prisaCuadros += n;
    alDiaHasta = ahora() + n * cuadroMs + 200;   // (la ráfaga corre a ~2 veces: gana un cuadro por cada uno que corre)
    registro(`[lockstep] me trabé ${ms.toFixed(0)} ms: me pongo al día ${n} cuadros`);
    try { prisa(n * cuadroMs); } catch {}
  }
  // §99 (D): un rato más en la cuenta de estabilidad: de cada uno, si la mayoría lo vio mal; y de mí, además, si fui
  // atrás de la mayoría (más de un cuadro) o iba relevado
  let ultimaPrisa = -Infinity, largado = false, barreraAhora = false;   // (§250: antes del «¡YA!»)
  let frenoVivo = false, vivoRatos = 0, frenoVivoEn = -Infinity;
  const ritmoVivo = new Map(), rendidos = new Set();   // §269b.12: uid → sus cuadros por segundo; los que ya no frenan
  let autDesde = null, huboOtraAut = false; const lejosAvisado = new Set(), baseVivo = new Map();   // §269b.17: desde cuándo soy la autoridad (null = no lo soy); si otro lo fue en esta carrera
  let cortaDesde = -Infinity, cortaGastado = 0;   // §269b.11: el tope por segundo de la espera corta
  // §269b.11: cuándo inventé el botón de cada uno en cada cuadro (anillo de 128 por mando) y cuánto tarde llegó después
  const invCuadro = new Int32Array(MANDOS * 128).fill(-1), invHora = new Float64Array(MANDOS * 128);
  const tardeHist = Array.from({ length: MANDOS }, () => []);   // [hora, ms tarde] de los últimos que llegaron después
  const sueleCerca = m => {
    const t = ahora(), h = tardeHist[m];
    while (h.length && t - h[0][0] > ESPERA_CORTA_HIST) h.shift();
    let cerca = 0; for (const [, ms] of h) if (ms <= ESPERA_CORTA_TARDE) cerca++;
    return cerca >= ESPERA_CORTA_VECES && cerca * 2 > h.length;
  };
  let vivoMando = null;                     // §269b.8: el lento por el que me estoy frenando (espero sus botones al escribir)
  // (§269b: frenoVivo = la deuda de ahora es de la autoridad por un lento, se paga en cada cuadro)
  let alDiaHasta = -Infinity;              // §99: hasta cuándo dura (más o menos) la ráfaga que pedí para ponerme al día
  function anotarEstabilidad() {
    medirDelantes();
    pedirPrisa();
    for (const h of humanos) {
      if (cortes.has(h.mando)) continue;
      let e = estab.get(h.mando); if (!e) estab.set(h.mando, e = { malas: [] });
      const mal = vista(h.mando).culpa(1) ? 1 : 0;
      e.malas.push(mal);
      if (e.malas.length > VENTANA_AUTORIDAD) e.malas.shift();
      if (h.uid === yo) {
        // (atrás de MÁS DE LA MITAD de los que se pueden medir, por más de un cuadro)
        const ds = [...delanteDe.values()], atras = ds.filter(d => d < -1).length;
        est.estable.malas += mal; est.estable.atras += (!arbitro && yoRelevado()) || (ds.length && 2 * atras > ds.length) ? 1 : 0;
        est.estable.rtt = miRtt();
        // (§179, R7: el margen más chico de la carrera y si es un teléfono, para que la sala elija la primera autoridad)
        { const c = miCapacidad(); if (c.margen !== null) est.estable.margen = Math.min(est.estable.margen ?? 99, Math.round(c.margen)); if (c.telefono !== null) est.estable.tel = c.telefono; }
      }
    }
  }
  // §99 (D): qué tan buena autoridad sería m ahora: −1000 si la mayoría lo ve mal en este rato, −100 por cada rato malo
  // de los últimos 10 s, −300 por cada cuadro que va atrás de mí (más de uno: se traba), algo a favor si va adelante, y
  // un poco a favor de la holgura con que llega lo suyo
  function puntaje(m) {
    const e = estab.get(m), sum = a => a ? a.reduce((x, y) => x + y, 0) : 0, v = vista(m);
    const d = m === miMando ? 0 : (delanteDe.get(duenoDe.get(m)) ?? 0);
    return -1000 * (v.culpa(1) ? 1 : 0) - 100 * sum(e?.malas) - 300 * Math.max(0, d - 1) + 100 * Math.max(0, -d - 1) +
      (v.minHol === SIN_DATO ? 0 : Math.min(v.minHol, 50)) + puntosCapacidad(m);
  }
  // §179 (R7): lo que puede la consola de m. El margen por cuadro: +15 por cada ms libre hasta 10 (la autoridad que
  // trabaja justo se traba y frena a todos), −300 con menos de 2; la subida: −300 con menos de SUBIDA_MIN (con 12 tiene
  // que mandar los botones de todos a todos); un teléfono, −5000 si hay alguien que sabemos que no lo es
  function capacidadDe(m) {
    if (m === miMando) return miCapacidad();
    const inf = informes.get(duenoDe.get(m));
    return inf && ahora() - inf.t < 3 * informeCada ? inf : { margen: null, subida: null, telefono: null };
  }
  function hayPc() { return humanos.some(h => !cortes.has(h.mando) && capacidadDe(h.mando).telefono === false); }
  function puntosCapacidad(m) {
    if (!autoridadCapaz) return 0;
    const c = capacidadDe(m);
    let p = 0;
    if (c.margen !== null) p += c.margen < 2 ? -300 : 15 * Math.min(10, c.margen);
    if (c.subida !== null && c.subida < SUBIDA_MIN) p -= 300;
    if (c.telefono && hayPc()) p -= 5000;
    return p;
  }
  function vista(m) {
    const malos = new Set();
    for (const h of humanos) {
      if (h.mando === m) continue;
      const w = votos(h.mando);
      if (w.culpa(1) || w.justo || est.relevadosAhora.includes(h.uid) || hambriento(informes.get(h.uid))) malos.add(h.uid);
    }
    const v = votos(m, malos);
    return v.con ? v : votos(m);
  }
  // ¿lo que se atrasó m es heredado? Si en su último rato m esperó a otro que la mayoría ve mal (toda la sala esperó a
  // ese), sus botones salieron tarde por eso: no es culpa de m (no sube su retraso, no se lo releva por eso)
  function heredado(m) {
    const inf = informes.get(duenoDe.get(m));
    if (!inf || ahora() - inf.t > 1.5 * informeCada) return false;
    return mandos.some(k => k !== m && inf.esp[k] > 0 && vista(k).culpa(1));
  }
  // (R4, §230: con números: cuántos lo vieron mal 1 y 2 ratos seguidos, sin listas; el texto de «quien» se arma solo
  // si alguien lo lee —el registro—, recorriendo los mismos informes en el mismo momento)
  function votos(m, ignorar = null) {
    const u = duenoDe.get(m), t = ahora(), v = new Votos(m, u, ignorar, t);
    for (const [de, inf] of informes) {
      if (de === u || ignorar?.has(de) || t - inf.t > 1.5 * informeCada || inf.racha[m] === NO_SE) continue;
      v.con++;
      const ra = inf.racha[m];
      if (ra >= 1) v.r1++;
      if (ra >= 2) v.r2++;
      if (ra > v.rmax) v.rmax = ra;
      const justo = !inf.dud && inf.hol[m] !== SIN_DATO && inf.hol[m] < 1;
      if (justo) v.justos++;
      if (inf.racha[m] > 0 || justo) {
        if (inf.hol[m] !== SIN_DATO) v.peorHol = Math.min(v.peorHol, inf.hol[m]);
        v.maxEsp = Math.max(v.maxEsp, inf.max[m]);
        if (inf.t > ultimaSubida) v.nuevo = true;
      } else if (!inf.dud && inf.hol[m] !== SIN_DATO && inf.hol[m] >= HOLGADO) v.holgados++;
      if (!inf.dud && inf.hol[m] !== SIN_DATO) v.minHol = Math.min(v.minHol, inf.hol[m]);
    }
    v.justo = v.con > 0 && 2 * v.justos > v.con;                                       // a la mayoría le llegan justos
    return v;
  }
  class Votos {
    constructor(m, u, ignorar, t) {
      this.m = m; this.u = u; this.ignorar = ignorar; this.t = t;
      this.con = 0; this.r1 = 0; this.r2 = 0; this.rmax = 0; this.peorHol = SIN_DATO; this.maxEsp = 0; this.holgados = 0; this.justos = 0; this.minHol = SIN_DATO; this.nuevo = false; this.justo = false;
    }
    // la mayoría lo vio mal k ratos seguidos (k es 1 o 2; otro k, contando de nuevo)
    culpa(k) {
      if (!(this.con > 0)) return false;
      const n = k <= 0 ? this.con : k === 1 ? this.r1 : k === 2 ? this.r2 : this.contar(k);
      return 2 * n > this.con;
    }
    contar(k) {
      let n = 0;
      for (const [de, inf] of informes) if (!(de === this.u || this.ignorar?.has(de) || this.t - inf.t > 1.5 * informeCada || inf.racha[this.m] === NO_SE) && inf.racha[this.m] >= k) n++;
      return n;
    }
    get quien() {
      const l = [], m = this.m;
      for (const [de, inf] of informes) if (!(de === this.u || this.ignorar?.has(de) || this.t - inf.t > 1.5 * informeCada || inf.racha[m] === NO_SE))
        l.push(`${de} ${inf.racha[m]}${inf.dud ? '?' : ''} (holgura ${inf.hol[m]}, esperó ${inf.esp[m]} ms)`);
      return l;
    }
  }
  function informar() {
    const t = ahora();
    if (ultimo >= 0 && !fuera) {
      const corridos = est.cuadros - ven.c0, debia = (t - ven.t0) / cuadroMs;
      if (corridos > 1.3 * debia + 2) ven.dud = true;          // me estaba poniendo al día
      // (§191, R1: con el árbitro nadie frena a la autoridad, así que si ella corre lenta —su CPU no da 60— todos la
      // esperan y van a su ritmo. Lo sabe ella misma: corrió menos del 90 % de lo que debía; no en la largada)
      // (§269b.20, la sesión de los picos: con el freno que de verdad frena —§269b.16— la autoridad que se frenaba por el
      // teléfono «corría lenta», pasaba el papel, la nueva se frenaba igual y lo devolvía: 24 traspasos en 60 s. Lo frenado
      // a propósito no es correr lenta. ?lentaPropia=1 = contarlo, como antes)
      const debiaSinFreno = LENTA_PROPIA ? debia : debia - (msFrenoPropio - (ven.fp0 ?? msFrenoPropio)) / cuadroMs;
      autoridadLenta = arbitro && ultimo > 180 && autoridadEn(ultimo) === miMando && corridos < 0.9 * debiaSinFreno - 1;
      // si estoy esperando ahora mismo, eso también cuenta en este rato (y el rato es dudoso: mientras espero no
      // corro, y lo que llega o no llega de los demás no dice nada). Esperando la llegada (alguien todavía carga la
      // pista) no se le cuenta la espera a nadie
      if (espera) {
        ven.dud = true;
        if (!espera.llegada) {
          const ya = t - espera.desde - congeladoEn(espera, t), nuevo = ya - espera.contado;
          espera.contado = ya;
          for (const m of espera.faltan) if (m >= 0) { ven.esp[m] += nuevo; ven.max[m] = Math.max(ven.max[m], ya); }
        }
      }
      // §101: si voy atrás de la mayoría (o corre la ráfaga para ponerme al día), lo de los demás me llega con holgura
      // de sobra porque lo necesito más tarde: esa holgura no es de ellos, es mi atraso. El rato es dudoso (si no, los
      // haría bajar su retraso de más y después los esperaría todo el mundo)
      const atrasado = ahora() < alDiaHasta || atrasDeLaMitad() > UMBRAL_PRISA;
      if (atrasado) ven.dud = true;
      // (§191, R1: con el árbitro, si voy delante de la autoridad, esperarla es cosa mía —voy adelantado y me freno—, no
      // de su red: no se la cargo, que si no sube su retraso y lo de todos le llega tarde)
      const autA = arbitro ? autoridadEn(Math.max(0, ultimo)) : undefined;
      if (autA !== undefined && autA !== miMando && ven.ven[autA] !== SIN_DATO && ven.ven[autA] >= 1) { ven.dud = true; ven.esp[autA] = 0; ven.max[autA] = 0; }
      // §102: ¿me pongo al día de verdad? En los ratos seguidos que voy atrás, lo que corrí de más que el tiempo en que
      // corrí (sin lo que estuve parado: esperas, frenos, tirones). Si a los RATOS_PRUEBA no gané GANA_MIN, no digo «sé
      // ponerme al día»: los demás me esperan (si no, me quedaba cada vez más atrás y subía mi retraso hasta 12)
      const corriendo = Math.max(0, t - ven.t0 - (msParado - ven.p0)) / cuadroMs;
      if (atrasado) { alcance.ratos++; alcance.ganado += corridos - corriendo; alcance.corriendo += corriendo; }
      else alcance = { ratos: 0, ganado: 0, corriendo: 0 };
      const alcanzo = !alcanceReal || alcance.ratos < RATOS_PRUEBA || alcance.ganado >= GANA_MIN * alcance.corriendo;
      // (§269b.8, el simulador de sala, «uno-lento»: la prueba de arriba se reinicia cuando dejo de ir atrás, y en cada
      // racha nueva volvía a decir «sé ponerme al día» RATOS_PRUEBA informes; la autoridad me saltaba en su freno y la sala
      // quedaba ~70 cuadros delante. El «no alcanzo» vale NO_ALCANZO_MS desde que se vio)
      if (!alcanzo) noAlcanzoHasta = t + noAlcanzoMs;
      if (!alcanzo) {
        est.sinAlcance = (est.sinAlcance || 0) + 1;
        if (!alcance.avisado) { alcance.avisado = true; registro(`[lockstep] voy atrás y no alcanzo a ponerme al día (gané ${alcance.ganado.toFixed(1)} cuadros en ${alcance.corriendo.toFixed(0)}): que me esperen`); }
      }
      // (§99, D: y al final mi ida y vuelta típica, de a 2 ms; 255 = no sé)
      const retenida = alcanceReal && t < noAlcanzoHasta, yoRtt = miRtt(), puedo = puedoPrisa() && alcanzo && !retenida;
      if (retenida && alcanzo && atrasado && puedoPrisa()) est.prisaRetenida = (est.prisaRetenida || 0) + 1;   // (§269b.8: lo que antes habría dicho)
      const cap = miCapacidad();
      // (§236: con un servidor en la sala, 5 bytes más al final con lo que veo de él; una página vieja no los lee)
      const conServidor = mandos.includes(SERVIDOR);
      const b = empaca(10, miMando & 255, ++numInforme, 5 + 5 * MANDOS + (conServidor ? 5 : 0)),
        inf = { t, hol: [], esp: [], max: [], racha: [], ven: [], dud: ven.dud, prisa: puedo, atras: atrasado, rtt: yoRtt, ...cap };
      b[9 + 5 * MANDOS] = yoRtt === null ? 255 : Math.min(254, Math.round(yoRtt / 2));
      // (§179, R7: el margen en ms enteros, la subida de a 100 kbit/s —255 = no sé— y 1 = teléfono, 2 = lo sé)
      b[10 + 5 * MANDOS] = cap.margen === null ? 255 : Math.max(0, Math.min(254, Math.round(cap.margen)));
      b[11 + 5 * MANDOS] = cap.subida === null ? 255 : Math.max(0, Math.min(254, Math.round(cap.subida / 100)));
      b[12 + 5 * MANDOS] = cap.telefono === null ? 0 : 2 | (cap.telefono ? 1 : 0);
      // las banderas: 1 = rato dudoso; 2 = sé ponerme al día solo (§101; y me sale, §102); 4 = voy atrás / me estoy poniendo al día
      b[8] = (ven.dud ? 1 : 0) | (puedo ? 2 : 0) | (atrasado ? 4 : 0);
      for (let p = 0; p < (conServidor ? SLOTS : MANDOS); p++) {
        const sabe = mandos.includes(p) && p !== miMando && !cortes.has(p) && tabla(p).size > 0;
        const hol = ven.hol[p];
        // malo: lo esperé medio cuadro o más en el rato (menos no le hace perder el cuadro al juego), o sus botones
        // llegaron tarde (holgura negativa: iba relevado) sin que yo esperara a nadie. "Justo" (holgura 0) no es malo:
        // solo le pide a él que suba un cuadro (ajustarRetraso). Que no llegue nada nuevo en el rato tampoco: si no lo
        // esperé, no me hizo falta (quizá él esperaba a otro); si se calló del todo, eso lo ve el corte
        const malo = sabe && (ven.esp[p] >= cuadroMs / 2 || (!ven.dud && hol !== SIN_DATO && hol < 0));
        rachas[p] = !sabe ? 0 : malo ? Math.min(250, rachas[p] + 1) : 0;
        inf.hol[p] = sabe ? Math.max(-128, Math.min(SIN_DATO, hol)) : SIN_DATO;
        inf.esp[p] = Math.min(255, Math.ceil(ven.esp[p] / 4)) * 4; inf.max[p] = Math.min(255, Math.ceil(ven.max[p] / 4)) * 4;
        inf.racha[p] = sabe ? rachas[p] : NO_SE;
        inf.ven[p] = ventajas[p] = sabe ? ven.ven[p] : SIN_DATO;
        const o = p < MANDOS ? 9 + 5 * p : 13 + 5 * MANDOS;   // (§236: la casilla del servidor, al final)
        b[o] = inf.hol[p] & 255; b[o + 1] = inf.esp[p] / 4; b[o + 2] = inf.max[p] / 4; b[o + 3] = inf.racha[p]; b[o + 4] = inf.ven[p] & 255;
      }
      aTodos(b, 'udp');
      informes.set(yo, inf);
    }
    ventanaNueva();
    anotarEstabilidad();
    ajustarRetraso();
    decidirRelevos();
    calcularDeuda();
    repetirCortes();
    revisarPausas();
  }
  // (§191, R1: con el árbitro, al que se calla lo pausa y lo corta la vigilancia de cada 50 ms, como a cualquier
  // relevado: todos los que no son la autoridad van relevados)
  // §80b: ¿cuánto voy adelante de cada uno? Yo mido mi cuadro menos el suyo al mandar: lo que voy adelante MÁS lo que
  // tardó en llegar. Él mide lo mismo de mí: lo que va adelante (= menos lo mío) más lo que tarda en llegar lo mío. La
  // mitad de la diferencia de las dos medidas es lo que voy adelante: lo de la red se cancela (si tarda lo mismo en los
  // dos sentidos). Como medir el desfase entre dos relojes con un pulso de ida y otro de vuelta.
  // Solo me freno por uno que va SUELTO (en su rato no esperó a nadie): si se quedó atrás porque espera lo mío (su
  // conexión trae tarde lo de todos), frenarme no lo acerca —él se atrasa conmigo— y la sala iría más lenta para
  // siempre. Y no por uno relevado, cortado, ni muy atrás (TOPE_SINCRO): eso es cosa del relevo.
  function calcularDeuda() {
    // (§191, R1: con el árbitro, contra la autoridad sola: si voy delante de ella la espero en cada cuadro, a ella la
    // ven «justa» y sube su retraso, y entonces lo de todos le llega tarde y lo inventa. Me freno si voy más de
    // UMBRAL_SINCRO delante; si voy atrás me pongo al día —pedirPrisa—)
    if (arbitro) {
      // §269b: si la autoridad soy yo, me freno por el que sigue mandando y va atrás sin poder ponerse al día (arriba)
      frenoVivo = false;
      const soyAut = esperaVivo && sincroTiempo && ultimo >= 0 && !fuera && !cortes.has(miMando) && autoridadEn(Math.max(0, ultimo)) === miMando;
      // (solo cuenta si tomé la autoridad de otro en esta carrera: la de la largada sigue al lento desde el principio)
      if (!soyAut) { autDesde = null; const a = ultimo >= 0 ? autoridadEn(ultimo) : undefined; if (a !== undefined && a !== miMando) huboOtraAut = true; }
      else if (autDesde === null) {
        autDesde = huboOtraAut ? ahora() : -Infinity;
        // (al tomar la autoridad de otra, el ritmo de cada uno lo mido yo desde cero)
        if (huboOtraAut) { for (const r of ritmoVivo.values()) { r.muestras.length = 0; r.medidas = 0; r.bajas = 0; } lejosAvisado.clear(); baseVivo.clear(); }
      }
      if (soyAut) {
        let peor = 0, quien = null, quienM = null;
        for (const h of humanos) {
          const m = h.mando;
          if (m === miMando || m >= MANDOS || cortes.has(m) || pausaAbierta(m) || oidoHace(m) > VIVO_OIDO_MS) continue;
          // (§269b.8: el que se oye pero su juego no avanza hace más de VIVO_OIDO_MS está trabado, no lento: no me freno por
          // él —toda la sala casi quieta mientras dura—; si después queda muy atrás, se sale él solo, §269b.7)
          if (ahora() - (avanceDe.get(m) ?? -Infinity) > VIVO_OIDO_MS) continue;
          // (§269b.12: ¿cuántos cuadros por segundo da su aparato? Si menos de FRENO_PISO varias veces seguidas, no lo sigo)
          if (frenoPiso > 0) {
            const t = ahora(), r = ritmoVivo.get(h.uid) || ritmoVivo.set(h.uid, { muestras: [], bajas: 0 }).get(h.uid);
            // (§269b.13, el simulador PC + Oppo: se mide solo mientras va atrás de mí —ahí corre a lo que da su aparato—. El
            // que va a la par espera mi registro: mientras me freno por el lento, su ritmo es el mío, y la autoridad daba
            // por «rendidos» a los PC de la sala)
            const atras = (delanteDe.get(h.uid) ?? 0) - (rttDe(m) ?? 0) / 2 / cuadroMs > UMBRAL_VIVO;
            if (!atras) { r.muestras.length = 0; r.bajas = 0; }
            r.muestras.push([t, ultimoDe(m)]);
            while (r.muestras.length > 2 && t - r.muestras[1][0] >= FRENO_VENTANA_MS) r.muestras.shift();
            const [t0, f0] = r.muestras[0];
            if (atras && t - t0 >= FRENO_VENTANA_MS && f0 >= 0) {
              const v = (ultimoDe(m) - f0) * 1000 / (t - t0);
              r.medidas = (r.medidas || 0) + 1; r.ultimaV = v;   // (§269b.17: cuántas ventanas le medí desde que soy la autoridad)
              r.bajas = v < frenoPiso ? r.bajas + 1 : 0;
              if (r.bajas >= FRENO_RINDE_N && !rendidos.has(h.uid)) {
                rendidos.add(h.uid); est.rendidos = [...rendidos];
                registro(`[lockstep] §269b.12: ${h.uid} da ${v.toFixed(1)} cuadros/s (menos de ${frenoPiso}): ya no me freno por él en esta carrera`);
              }
            }
            if (rendidos.has(h.uid)) continue;
          }
          const d0 = delanteDe.get(h.uid), inf = informes.get(h.uid);
          if (d0 === undefined || (inf?.atras && inf.prisa)) continue;   // (§101: el que se pone al día solo, no)
          // (§269b.8: el lejano corre detrás de mí lo que tarda en llegarle mi registro —media ida y vuelta—, aunque su
          // aparato dé 60: eso no es lentitud y no me freno por eso. Con buena red casi no cambia nada)
          const d = d0 - (rttDe(m) ?? 0) / 2 / cuadroMs;
          // (§269b.17: tomé la autoridad de otra consola y este ya va muy atrás —la autoridad de antes pudo haber dejado de
          // seguirlo—. Frenarme 35–60 cuadros de una ponía a esperar a toda la sala. Hasta haberle medido el ritmo yo
          // —una ventana, 2 s— no lo persigo; si esa ventana da menos de frenoPiso, queda rendido de una (va muy atrás y no
          // alcanza); si da más, lo de siempre)
          if (frenoLejos > 0 && autDesde > -Infinity && d > frenoLejos) {
            const r = ritmoVivo.get(h.uid), med = r?.medidas || 0;
            if (med < 1) {
              if (!lejosAvisado.has(h.uid)) { lejosAvisado.add(h.uid); est.frenoLejos = (est.frenoLejos || 0) + 1;
                registro(`[lockstep] §269b.17: tomé la autoridad y ${h.uid} ya va ${d.toFixed(0)} cuadros detrás (más de ${frenoLejos}): no me freno por él hasta medirle el ritmo`); }
              continue;
            }
            if (frenoPiso > 0 && r.ultimaV < frenoPiso && !rendidos.has(h.uid)) {
              rendidos.add(h.uid); est.rendidos = [...rendidos];
              registro(`[lockstep] §269b.17: ${h.uid} va ${d.toFixed(0)} cuadros detrás y da ${r.ultimaV.toFixed(1)} cuadros/s (menos de ${frenoPiso}): ya no me freno por él en esta carrera`);
              continue;
            }
          }
          // (§269b.18, la sesión de los picos, 2 PC + Oppo: el teléfono iba siempre ~12 cuadros detrás aunque daba 59 por
          // segundo —un desfase fijo, no lentitud— y la autoridad se frenaba 5–7 cuadros cada medio segundo toda la carrera:
          // la sala entera a ~48. El freno sigue al que se VA QUEDANDO atrás: a lo que va detrás le resta su desfase de base,
          // el menor de los últimos FRENO_BASE_MS. Al lento de verdad la distancia le sigue creciendo y se lo sigue igual)
          let dEf = d;
          if (frenoBase) {
            const t = ahora(), b = baseVivo.get(h.uid) || baseVivo.set(h.uid, []).get(h.uid);
            b.push([t, d]); while (b.length && t - b[0][0] > FRENO_BASE_MS) b.shift();
            let min = Infinity; for (const [, x] of b) if (x < min) min = x;
            if (t - b[0][0] >= FRENO_BASE_MS / 2 && min > 0) { dEf = d - min; est.baseVivo = Math.max(est.baseVivo || 0, Math.round(min)); }
          }
          if (dEf > peor) { peor = dEf; quien = h.uid; quienM = m; }
        }
        est.adelantoVivo = peor; est.adelantoVivoMax = Math.max(est.adelantoVivoMax || 0, peor);
        // (dos ratos seguidos delante: un rato suelto —la largada, un tirón que el otro ya está corriendo— no frena)
        vivoRatos = peor > UMBRAL_VIVO ? vivoRatos + 1 : 0;
        const antes = deuda;
        // (§269b.8: si ya me frené por un lento hace menos de VIVO_RECIENTE_MS, basta un rato: el que va y viene —lento un
        // rato, al día otro— se me escapaba ~40 cuadros cada vez que volvía a ponerse lento, mientras juntaba los dos ratos)
        const reciente = ahora() - frenoVivoEn < VIVO_RECIENTE_MS;
        deuda = vivoRatos >= 2 || (vivoRatos >= 1 && reciente) ? Math.min(DEUDA_VIVO_MAX, Math.max(0, Math.floor(peor) - UMBRAL_VIVO)) : 0;
        frenoVivo = deuda > 0;
        if (frenoVivo) frenoVivoEn = ahora();
        // (§269b.8: el ajuste fino, con el freno prendido; §269b.15: también desde esperaFina cuadros detrás)
        vivoMando = frenoVivo || (esperaFina > 0 && peor > esperaFina) ? quienM : null;
        if (vivoMando !== null && !frenoVivo) est.finaSinFreno = (est.finaSinFreno || 0) + 1;
        if (deuda && !antes) { est.frenosVivo = (est.frenosVivo || 0) + 1; registro(`[lockstep] §269b: voy ${peor.toFixed(1)} cuadros delante de ${quien} (sigue mandando y no se pone al día): me freno ${deuda}`); }
        return;
      }
      const delante = sincroTiempo && ultimo >= 0 && !fuera && !cortes.has(miMando) ? delanteAutoridad() : 0;
      est.adelanto = Math.max(0, delante);
      const antes = deuda;
      // (§269b.19, la sesión de los picos con el Oppo: un PC que no es la autoridad iba siempre 2 cuadros «delante» de ella
      // —un desfase de la medida: con el árbitro no puede adelantarse a su registro, lo espera— y se frenaba un cuadro cada
      // medio segundo toda la carrera: dos imágenes repetidas por segundo. Con el árbitro el umbral es UMBRAL_SINCRO_ARB)
      deuda = Math.min(DEUDA_MAX, Math.max(0, Math.floor(delante) - UMBRAL_SINCRO_ARB));
      if (deuda && !antes) registro(`[lockstep] voy ${delante.toFixed(1)} cuadros delante de la autoridad: me freno ${deuda}`);
      return;
    }
    if (!sincroTiempo || ultimo < 0 || fuera || cortes.has(miMando) || yoRelevado()) { deuda = 0; return; }
    const t = ahora();
    // §99 (C5): con 12 casi siempre hay alguien un poco atrás; frenarme por el peor frenaba a todos por cualquiera. Me
    // freno solo si voy adelante de MÁS DE LA MITAD de los que se pueden medir, y por lo que voy adelante del de la
    // mitad (si uno solo va atrás, el que se tiene que poner al día es él). Con dos, el otro es «más de la mitad»
    const delantes = [];
    let quien = null;
    for (const h of humanos) {
      const m = h.mando;
      if (m === miMando || cortes.has(m) || !tabla(m).size || est.relevadosAhora.includes(h.uid)) continue;
      const inf = informes.get(h.uid);
      if (!inf || t - inf.t > 1.5 * informeCada) continue;
      // §101: al que va atrás y se pone al día solo (corre seguido lo que le falta) no lo espero: frenarme lo hacía
      // correr detrás de mí, y al que se frena le llegaban tarde los demás y subía su retraso. Al que va atrás y no
      // puede (pestaña escondida, ?alDia=0), sí, como antes. Y no por uno que esperó en su rato (dudoso)
      if (inf.atras ? inf.prisa : inf.dud) continue;
      const mia = ventajas[m], suya = inf.ven?.[miMando];
      if (mia === SIN_DATO || suya === undefined || suya === SIN_DATO) continue;
      const delante = (mia - suya) / 2;
      if (delante > TOPE_SINCRO) continue;
      delantes.push([delante, h.uid]);
    }
    delantes.sort((a, b) => b[0] - a[0]);
    const k = Math.floor(delantes.length / 2);               // el de la mitad (de mayor a menor): adelante de más de la mitad
    const peor = delantes.length ? Math.max(0, delantes[k][0]) : 0;
    quien = delantes.length ? delantes[k][1] : null;
    est.adelanto = peor;
    const antes = deuda;
    deuda = Math.min(DEUDA_MAX, Math.max(0, Math.floor(peor) - UMBRAL_SINCRO));
    if (deuda && !antes) registro(`[lockstep] voy ${peor.toFixed(1)} cuadros delante de ${quien}: me freno ${deuda}`);
  }
  // mi retraso: sube si a la mayoría le llegan justos o tarde (o la autoridad tuvo que inventar los míos): un cuadro
  // si fue un rato suelto, lo que falte (hasta 4) si van dos seguidos; baja de a uno si a la mayoría le sobran 3
  // cuadros por 4 ratos (2 s) seguidos. Si me atrasé por esperar al que todos esperan (heredado), no subo.
  function ajustarRetraso() {
    // §180.2: mientras la autoridad me releva, los botones que pone por mí (inventados) no dicen que lo mío llega tarde:
    // los escribe ella de todas formas. Contarlos subía mi retraso de a 2 por rato durante los 3 s del relevo, hasta 12
    // (banco relevo, caso 1, con el reloj virtual: la autoridad que pasa el papel quedaba en 12). ?calmaRelevado=0 = como antes
    // (§191, R1: con el árbitro siempre «me relevan»: cuentan los inventados, salvo si voy atrás —me trabé y me pongo al
    // día—: ahí llegan tarde porque los escribo tarde, no por la red)
    const atrasado = ahora() < alDiaHasta || atrasDeLaMitad() > UMBRAL_PRISA;
    const sust = arbitro ? (atrasado ? 0 : sustituidosMios) : calmaRelevado && yoRelevado() ? 0 : sustituidosMios; sustituidosMios = 0;
    if (!adaptar || ultimo < 0 || fuera || cortes.has(miMando)) return;
    const v = vista(miMando), antes = miRetraso;
    if (((v.culpa(1) || v.justo) && v.nuevo && !heredado(miMando)) || sust) {
      const falta = !v.culpa(2) && !sust ? 1 :
        Math.max(1, v.peorHol < 1 ? 1 - v.peorHol : 0, v.maxEsp ? Math.ceil(v.maxEsp / cuadroMs) + 1 : 0, sust ? (arbitro ? 1 : 2) : 0);
      miRetraso = Math.min(retrasoMax, miRetraso + Math.min(4, falta));
      buenas = 0; ultimaSubida = ahora();
      if (miRetraso !== antes) { est.subidas++; registro(`[lockstep] subo mi retraso a ${miRetraso} (holgura ${v.peorHol === SIN_DATO ? '—' : v.peorHol}, espera más larga ${v.maxEsp} ms, inventados ${sust})`); }
    } else if (v.con && 2 * v.holgados > v.con && (arbitro || !yoRelevado())) {
      // (§80b: con la sincronía, si a todos les sobran 6 cuadros o más, baja cada 2 ratos y de una vez lo que sobra
      // (deja 3 de holgura): el desfase que lo hizo subir ya se corrigió frenando)
      const mucho = sincroTiempo && v.minHol !== SIN_DATO && v.minHol >= 6;
      if (++buenas >= (mucho ? 2 : 4) && miRetraso > RETRASO_MIN) {
        miRetraso = Math.max(RETRASO_MIN, miRetraso - (mucho ? Math.max(1, v.minHol - 3) : 1)); buenas = 0; est.bajadas++;
        registro(`[lockstep] bajo mi retraso a ${miRetraso} (${v.holgados} de ${v.con} con holgura de sobra, la menor ${v.minHol}${mucho ? ': de una' : ''})`);
      }
    } else buenas = 0;
    est.retrasoMax[carrera] = Math.max(est.retrasoMax[carrera] || 0, miRetraso);
  }
  // (solo la autoridad) a quién relevar: al que la mayoría vio mal dos ratos seguidos; lo suelta tras 3 s relevado y
  // 3 s sin que la mayoría lo vea mal. Y si la mayoría me ve mal a MÍ 4 ratos seguidos (todos necesitan mi paquete: la
  // autoridad atrasada frena a todos), le paso el papel al que mejor llega.
  function decidirRelevos() {
    if (!relevo) { relevados.clear(); return; }
    if (ultimo < 0 || fuera || cortes.has(miMando) || autoridadPrevista(escrito + 1) !== miMando) return;
    const t = ahora();
    // (§191, R1: con el árbitro no hay a quién relevar: escribo a todos siempre; queda el traspaso del papel)
    if (arbitro) relevados.clear();
    else for (const h of humanos) {
      const m = h.mando;
      // (§99, C1: al pausado no se lo releva: su kart ya va con el botón calculado)
      if (m === miMando || cortes.has(m) || !tabla(m).size || pausaAbierta(m)) { relevados.delete(m); continue; }
      const v = vista(m), r = relevados.get(m);
      if (!r) {
        if (v.culpa(2) && !heredado(m)) {
          relevados.set(m, { desde: t, problema: t }); est.relevos++;
          registro(`[lockstep] relevo a ${h.uid} (mando ${m}) desde el cuadro ${escrito + 1}: ratos malos seguidos según cada uno ${v.quien.join(', ')}`);
        }
      } else if (v.culpa(1) || v.justo || v.minHol === SIN_DATO || v.minHol < 1) r.problema = t;   // sin datos: no se sabe si está sano
      else if (t - r.desde >= RELEVO_MIN * informeCada && t - r.problema >= SANO * informeCada) {
        relevados.delete(m); registro(`[lockstep] ${h.uid} vuelve a lo directo desde el cuadro ${escrito + 1}`);
      }
    }
    // el papel se pasa si la mayoría me ve mal MALAS_AUTORIDAD ratos seguidos sin que yo esté esperando al que todos esperan
    malasAutoridad.push((vista(miMando).culpa(1) && !heredado(miMando)) || autoridadLenta ? 1 : 0);
    if (malasAutoridad.length > VENTANA_AUTORIDAD) malasAutoridad.shift();
    // §179 (R7): soy un teléfono y hay un PC: el papel no espera a que me vean mal (sí, a que tenga con qué mandar)
    const telefonoConPc = autoridadCapaz && miCapacidad().telefono && hayPc();
    if (pasarA !== null || traspaso || (!telefonoConPc && malasAutoridad.reduce((a, b) => a + b, 0) < MALAS_AUTORIDAD)) return;
    // §99 (D): a quien mejor manda Y recibe, y solo si es mejor que yo (si no, el papel quedaba en uno que recibe todo
    // tarde: inventaba los botones de los sanos y los obligaba a subir su retraso; medido en prueba-relevo)
    // (con PASO_MINIMO de ventaja: si no, con dos casi iguales el papel iba y volvía)
    let mejor = null, puntos = puntaje(miMando) + PASO_MINIMO;
    for (const h of humanos) {
      const m = h.mando;
      if (m === miMando || m >= MANDOS || cortes.has(m) || relevados.has(m) || !tabla(m).size || peorRed(m)) continue;   // (§236: al servidor no)
      const p = puntaje(m);
      if (p > puntos) { puntos = p; mejor = m; }
    }
    if (mejor !== null) {
      pasarA = mejor;
      if (telefonoConPc) { est.pasoTelefono = (est.pasoTelefono || 0) + 1; registro(`[lockstep] soy un teléfono: paso la autoridad a ${duenoDe.get(mejor)} (puntaje ${puntos})`); }
    } else malasAutoridad.length = 0;          // (nadie mejor: se vuelve a contar desde cero)
  }

  // ---- lo que pide el juego (pad_web.cpp) ----
  async function pad(cuadro) {
    // §73: la página ya pidió la carrera siguiente (fijarCarrera) y el juego todavía corre los últimos cuadros de la
    // vieja: esos van sin esperar a nadie y con todos quietos. La nueva empieza cuando el contador vuelve atrás.
    if (saliendo) {
      if (cuadro < saliendo.ultimo) saliendo = null;
      else { saliendo.ultimo = cuadro; est.cuadrosSaliendo = (est.cuadrosSaliendo || 0) + 1; return quietos(); }
    }
    if (ultimo < 0 || cuadro + 300 < ultimo) nuevaCarrera();    // primer cuadro, o el contador volvió a empezar
    // me salí de esta carrera (mi copia ya no es la de los demás): el juego sigue sin esperar a nadie, todos quietos
    if (!fuera && muyAtras(cuadro)) {
      est.salidasAtras = (est.salidasAtras || 0) + 1;
      salirme(`§269b.7: voy relevado en el cuadro ${cuadro} y la autoridad ya va en el ${tabla(autoridadEn(cuadro)).mayor} (más de ${ATRAS_SALIR} cuadros): vuelvo en la siguiente`);
    }
    if (fuera) { ultimo = cuadro; return quietos(); }
    // §99 (C1): después de un tirón de esta PC, antes de correr otro cuadro, que pasen los mensajes que llegaron
    // mientras estaba trabada (una pausa mía, por ejemplo: si no, podría correr con mis botones más allá de ella)
    if (pausaUltima >= 0 && ahora() - pausaUltima > TIRON_MS) {
      await new Promise(listo => setTimeout(listo, 0));
      if (fuera) { ultimo = cuadro; return quietos(); }
    }
    // §80b: me freno un cuadro (lo espero sin hacer nada) si voy adelantado a uno que va suelto; antes de tomar este
    // cuadro, así para todos sigo en el anterior (lo que ya corrí). El juego no se pone al día: queda un cuadro más atrás
    // (§99, H7: con la pestaña escondida no: el navegador estira la espera a ~1 s y los demás me esperarían)
    // (§269b.16: con frenar cada freno cuenta de verdad: el del lento va como mucho cada 2 cuadros, no dos imágenes
    // repetidas seguidas)
    if (deuda > 0 && est.cuadros - ultimoFreno >= (frenoVivo ? (frenar ? 2 : 1) : CADA_FRENO) && !globalThis.document?.hidden) {
      // (§269b.8: el freno por el lento cobra hasta FRENO_VIVO_N cuadros de una vez: de a uno, la autoridad bajaba a lo más a
      // la mitad, y con un lento a la mitad o menos la distancia no bajaba nunca —el simulador de sala: ~70 cuadros—)
      // (§269b.13, el simulador PC + Oppo: un teléfono a 57 dejaba en los PC un tirón de 50 ms cada vez —3 cuadros de una—;
      // con poca deuda, de a uno: tirones de un cuadro, más parejos)
      const n = frenoVivo ? Math.min(deuda, deuda > FRENO_VIVO_MUCHA ? FRENO_VIVO_N : 1) : 1;
      deuda -= n; ultimoFreno = est.cuadros; est.frenos += n;
      // (§269b.16: con frenar —el runtime corre su cuadrícula de retrazados, mkw_frenar— el freno no detiene este cuadro: el
      // siguiente retrazado llega n cuadros más tarde. Esperar aquí no frenaba: la cuadrícula es absoluta y el juego corría
      // los cuadros siguientes de golpe para volver a ella —564 cuadros frenados en 40 s bajaron la sala solo 46—)
      if (frenar) { const d = cuadroMs * n; frenar(d); est.msFrenado += d; msParado += d; msFrenoPropio += d; est.frenosReloj = (est.frenosReloj || 0) + n; }
      else {
        const t0 = ahora();
        await new Promise(listo => setTimeout(listo, cuadroMs * n));
        { const d = ahora() - t0; est.msFrenado += d; msParado += d; msFrenoPropio += d; }
      }
      if (fuera) { ultimo = cuadro; return quietos(); }
    }
    ultimo = cuadro;
    // §274: la pausa de la sala congela todas las consolas DESPUÉS del mismo cuadro (cada una corre hasta ahí: así nadie
    // queda esperando botones que el otro ya no va a mandar). La página congela la lógica del juego (mkw_congelar)
    if (congelarEnCuadro && cuadro >= congelarEnCuadro.cuadro) { const f = congelarEnCuadro.f; congelarEnCuadro = null; try { f(cuadro); } catch {} }
    // (§285: la espera del paquete, al empezar el cuadro 1 de cada carrera; dura todas las carreras, no se borra al cambiar)
    if (alPrimero && cuadro >= 1 && primeroDe !== carrera) { primeroDe = carrera; try { alPrimero(cuadro, carrera); } catch {} }
    // (§250: ¿sigo antes del «¡YA!»? Lo lee del juego cada cuadro; vale para lo que escribo ahora —va mi retraso
    // adelante: los cuadros de la cuenta y los primeros 6 de la carrera— y para no pausar a nadie mientras espero)
    { let c = false; try { c = enCuenta ? !!enCuenta() : cuadro < cuadrosBarrera; } catch {}
      barreraAhora = largadaPareja && cuadro < cuadrosLargada && c; if (barreraAhora) est.cuadrosBarrera = cuadro + 1; }
    est.cuadros++; est.cuadrosCarrera++; est.sumaRetraso += miRetraso;
    { const t = ahora(); if (pausaUltima >= 0 && t - pausaUltima > TIRON_MS) { est.tirones = (est.tirones || 0) + 1; msParado += t - pausaUltima - cuadroMs; tironPropio(t - pausaUltima); } pausaUltima = t; }
    // lo mío: el estado de ahora vale para cuadro + mi retraso (y para los cuadros intermedios si el retraso subió;
    // si bajó, no escribo nada hasta alcanzar lo ya escrito). Al empezar la carrera, los primeros (hasta mi retraso)
    // van neutros, escritos: nadie tiene que saber mi retraso
    if (miMando >= 0 && !cortes.has(miMando)) {
      // (R4: en un arreglo que se reusa; la tabla copia los 7 valores en su casilla)
      const src = local() || NEUTRO, v = vLocal;
      for (let i = 0; i < 7; i++) v[i] = src[i];
      v[0] &= ~START;
      // (§99, C4: en la cuenta regresiva, al menos RETRASO_CUENTA; al «¡YA!» cada uno baja al suyo: lo ya escrito no
      // se toca)
      const cuenta = !!enCuenta?.();
      const hasta = cuadro + (cuenta ? Math.max(miRetraso, RETRASO_CUENTA) : miRetraso), primero = escrito < 0;
      // §269b.8 (el simulador de sala, «uno-lento»: con el freno por informes la sala quedaba 20–30 cuadros delante del lento
      // y le inventaba un tercio de los botones): si soy la autoridad y me estoy frenando por un lento, antes de escribir
      // el registro hasta `hasta` espero su botón de verdad de ese cuadro, hasta FRENO_VIVO_N cuadros (el ajuste fino: los
      // informes llegan cada medio segundo; esto, en cada cuadro). Si no llega, va su último botón como antes (tardeVivo)
      if (vivoMando !== null && esperaVivo && hasta > escrito && !cortes.has(vivoMando) && autoridadPrevista(hasta) === miMando
          && ahora() - (avanceDe.get(vivoMando) ?? -Infinity) <= VIVO_OIDO_MS && !tabla(vivoMando).has(hasta)) {
        const t0 = ahora();
        while (!tabla(vivoMando).has(hasta) && ahora() - t0 < cuadroMs * FRENO_VIVO_N && !fuera && !cortes.has(vivoMando))
          await new Promise(listo => setTimeout(listo, 1));
        const d = ahora() - t0; est.msEsperaVivo = (est.msEsperaVivo || 0) + d; msParado += d; msFrenoPropio += d;
        // (§269b.16: lo esperado por el lento también corre la cuadrícula: si no, los cuadros siguientes salían de golpe,
        // volvía a irme delante y a esperarlo otra vez)
        if (frenar && d > 1) frenar(d);
        if (tabla(vivoMando).has(hasta)) est.esperasVivoBien = (est.esperasVivoBien || 0) + 1;
      }
      // §269b.11: la espera corta por el botón en camino (a los vivos que mandan seguido y van cerca)
      if (esperaCorta && arbitro && hasta > escrito && autoridadPrevista(hasta) === miMando && !barreraAhora) {
        const t = ahora();
        if (t - cortaDesde >= 1000) { cortaDesde = t; cortaGastado = 0; }
        const falta = () => humanos.filter(h => h.uid !== yo && !cortes.has(h.mando) && !pausaAbierta(h.mando)
          && ahora() - (avanceDe.get(h.mando) ?? -Infinity) <= ESPERA_CORTA_FLUYE
          && Math.abs(delanteDe.get(h.uid) ?? 99) <= ESPERA_CORTA_PAR && h.mando < MANDOS && sueleCerca(h.mando)
          && tabla(h.mando).size > 0 && !tabla(h.mando).has(hasta) && ultimoDe(h.mando) >= hasta - ESPERA_CORTA_CERCA);
        if (cortaGastado < ESPERA_CORTA_SEG && falta().length) {
          const t0 = ahora(), tope = Math.min(ESPERA_CORTA_MS, ESPERA_CORTA_SEG - cortaGastado);
          while (ahora() - t0 < tope && !fuera && falta().length) await new Promise(listo => setTimeout(listo, 1));
          const d = ahora() - t0; cortaGastado += d; msParado += d;
          est.msEsperaCorta = (est.msEsperaCorta || 0) + d; est.esperasCortas = (est.esperasCortas || 0) + 1;
          if (!falta().length) est.esperasCortasBien = (est.esperasCortasBien || 0) + 1;
        }
      }
      for (let f = Math.max(escrito + 1, primero ? 0 : cuadro); f <= hasta; f++) {
        const t = tabla(miMando);
        if (!t.has(f)) { t.set(f, primero && f < hasta ? NEUTRO : v); if (f > ultimoDe(miMando)) nuevo.set(miMando, f); }
        // (§191, R1: con el árbitro, el suplente escribe también el registro —de reserva—: si la autoridad se corta o
        // se pausa, el papel pasa a él justo ahí, y sus cuadros desde ese punto ya llevan los botones de todos)
        const x = autoridadPrevista(f) === miMando ? registroPara(f) : arbitro && soySuplente(f) ? registroPara(f, true) : null;
        if (x) reg(miMando).set(f, x);
        escrito = f;
      }
      // (§191, R1: con el árbitro, lo mío va entero solo a la autoridad y al suplente; a los demás, solo los cuadros que
      // la autoridad todavía no cubre —el principio de la carrera—, que esos me los esperan como siempre, y una vez)
      const dest = arbitro ? destinosArbitro(escrito) : null;
      for (const h of humanos) if (h.uid !== yo) {
        const directo = !dest || dest.has(h.mando), hasta = directo ? escrito : Math.min(escrito, cubiertoDesde - 1);
        if (!directo && hasta <= (enviadoA.get(h.uid) ?? -1)) continue;
        const p = paqueteA(h.uid, miMando, hasta);
        if (p) { enviar(h.uid, p, 'udp'); est.paquetesBotones++; est.enviosA[h.uid] = (est.enviosA[h.uid] || 0) + 1; if (!directo) enviadoA.set(h.uid, hasta); }
      }
    }
    let r = resolver(cuadro);
    // §99 (C4): si soy el último en llegar a la carrera (en mi primer cuadro ya tengo los de todos), los demás me
    // esperan y van a correr el cuadro 0 recién cuando les llegue lo mío: espero lo que tarda en llegarles (media ida y
    // vuelta) y así arrancamos juntos
    if (!largado) {
      largado = true;
      if (!r.faltan && humanos.length > 1) {
        const idas = humanos.filter(h => h.uid !== yo && !cortes.has(h.mando) && rtt.get(h.uid)).map(h => rtt.get(h.uid).s / 2).sort((a, b) => a - b);
        const ms = idas.length ? Math.min(LARGADA_MAX_MS, idas[Math.floor(idas.length / 2)]) : 0;
        if (ms >= 2) { est.largadaMs = ms; await new Promise(listo => setTimeout(listo, ms)); }
      }
    }
    if (r.faltan) {
      const t0 = ahora();
      // ¿espero a alguien que todavía no llegó a la carrera (no mandó nada)? Eso es la "llegada" (cada uno carga a su
      // ritmo), no el costo de sincronizar: se cuenta aparte
      const llegada = mandos.some(m => m !== miMando && !cortes.has(m) && tabla(m).size === 0);
      const e = { cuadro, desde: t0, pedido: 0, faltan: r.faltan, llegada, contado: 0, tic: t0, congelado: 0 };
      await new Promise(resolver => { espera = Object.assign(e, { resolver }); revisar(); });
      // §101: si esta pestaña se trabó mientras esperaba (revisar no corrió), ese rato no lo esperé a nadie: es un tirón
      // mío (los demás siguieron sin mí y quedé atrás). Antes se le cargaba al que faltaba, que subía su retraso de más
      const fin = ahora(), congelado = congeladoEn(e, fin), ms = fin - t0 - congelado;
      pausaUltima = fin;                     // (§99: lo que esperé a otros no es un tirón mío)
      msParado += fin - t0;
      if (congelado > TIRON_MS && !llegada) { est.tirones = (est.tirones || 0) + 1; est.msCongelado = (est.msCongelado || 0) + congelado; tironPropio(congelado); }
      ven.dud = true;
      if (llegada) est.msLlegada += ms;
      else {
        est.esperas++; est.msEsperando += ms; est.maxEspera = Math.max(est.maxEspera, ms);
        if (ms > 50) est.esperasLargas++;      // (V7, §235: las esperas de más de 50 ms, las que se notan)
        ven.dud = true;
        // a quién se esperó: los que faltaban justo antes de poder seguir (para avisar quién frena la sala); en el
        // informe, lo que no se contó ya en los ratos anteriores (informar)
        for (const m of e.faltan) if (m >= 0) {
          const u = duenoDe.get(m); est.esperaDe[u] = (est.esperaDe[u] || 0) + ms;
          ven.esp[m] += ms - e.contado; ven.max[m] = Math.max(ven.max[m], ms);
        }
      }
      if (fuera) return quietos();
      r = resolver(cuadro);
      if (r.faltan) return quietos();        // (no debería pasar: la espera termina cuando está todo)
    }
    // los 12 mandos: conectado, botones, sx, sy, cx, cy, gl, gr (pad_web.cpp los copia al puerto de cada uno, o a su
    // mando virtual, §91). conectado = 2: ese humano se fue (desde su corte): el juego deja de esperarlo para terminar
    // (R4, §230: el mismo Int32Array cada cuadro: pad_web.cpp lo copia a la memoria del juego en el momento)
    const datos = datosPad;
    for (const p of mandos) {
      if (p >= MANDOS) continue;                 // (§236: el servidor no tiene kart)
      const x = r.vals[p];
      datos[p * 8] = x.con;
      for (let k = 0; k < 7; k++) datos[p * 8 + 1 + k] = x.v[k];
    }
    // §99 (C1): lo que se usó para cada uno (la base de una pausa que empieza en el cuadro siguiente)
    // (R4: un arreglo por mando que se reescribe; la base de una pausa es una copia)
    for (const p of mandos) {
      if (p >= MANDOS) continue;
      let u = ultimoUsado.get(p); if (!u) ultimoUsado.set(p, u = { f: cuadro, v: [0, 0, 0, 0, 0, 0, 0] });
      u.f = cuadro;
      for (let k = 0; k < 7; k++) u.v[k] = datos[p * 8 + 1 + k];
      const ps = pausas.get(p);
      if (ps) for (const x of ps) if (!x.base && x.desde - 1 === cuadro) x.base = u.v.slice();
    }
    if (cuadro < QUIETO_HASTA) for (let i = 0; i < humanos.length; i++) {
      const p = humanos[i].mando;
      if (p >= MANDOS) continue;
      let q = quieto.get(p); if (!q) quieto.set(p, q = { racha: 0, max: 0 });
      let nada = datos[p * 8] === 1;
      for (let k = 1; k < 8 && nada; k++) if (datos[p * 8 + k] !== 0) nada = false;
      // (§100: el que ya llegó no está ausente aunque no toque nada: antes, quien llegaba antes del minuto —en una pista
      // corta, o por código en prueba-sala— juntaba 30 s «quieto» esperando a los demás y perdía como cortado)
      if (nada && llego?.(i, p)) nada = false;     // (§110: con el mando: el puesto en la carrera lo sabe la página)
      q.racha = nada ? q.racha + 1 : 0; q.max = Math.max(q.max, q.racha);
    }
    // lo que dejó la autoridad de este cuadro: quiénes iban relevados (para avisar), si inventó los míos y si pasa el papel
    const a = r.autoridad, xa = a !== undefined ? reg(a).get(cuadro) : null;
    est.autoridad = a !== undefined ? duenoDe.get(a) : null;
    // (R4: la lista se arma de nuevo solo si cambió quiénes van relevados)
    { const mr = xa ? xa.masc : 0; if (mr !== mascRelevados) { mascRelevados = mr; est.relevadosAhora = mr ? bits(mr).map(m => duenoDe.get(m)) : []; } }
    if (xa && (xa.sust >> miMando) & 1) sustituidosMios++;
    if (arbitro) {
      const viejo = lentoAnillo[lentoPos], nuevoS = xa ? xa.sust & 0xFFFF : 0;
      for (let m = 0; m < 16; m++) lentoCuenta[m] += ((nuevoS >> m) & 1) - ((viejo >> m) & 1);
      lentoAnillo[lentoPos] = nuevoS; lentoPos = (lentoPos + 1) % LENTO_VENTANA;
      let lm = 0;
      for (let m = 0; m < 16; m++) { lentoRacha[m] = lentoCuenta[m] > LENTO_DE ? Math.min(60000, lentoRacha[m] + 1) : 0; if (lentoRacha[m] >= LENTO_RACHA) lm |= 1 << m; }
      if (lm !== lentosMasc) { lentosMasc = lm; est.lentosAhora = lm ? bits(lm).map(m => duenoDe.get(m)) : []; est.yoLento = !!((lm >> miMando) & 1); }
    }
    { const d = cuadro + 1 + (arbitro ? LEAD_TRASPASO : 0); if (xa && xa.sig < MANDOS && !cadena.some(([k]) => k === d)) cadena.push([d, xa.sig]); }
    for (let i = 0; i < datos.length; i++) est.hashBotones = Math.imul(est.hashBotones ^ datos[i], 16777619) >>> 0;
    if (huella && cuadro % huellaCada === 0 && cuadro > 0) compararHuella(cuadro, huella());
    // §75: lo que hay que hacer en este cuadro (en todas las consolas en el mismo: por ejemplo terminar la carrera)
    const accion = acciones.size ? acciones.get(`${carrera}:${cuadro}`) : undefined;
    if (accion) { acciones.delete(`${carrera}:${cuadro}`); try { accion(); } catch (e) { registro(`[lockstep] acción del cuadro ${cuadro}: ${e?.message || e}`); } }
    if (etapa && (!est.largada || est.largada.carrera !== carrera || est.largada.ya === null)) anotarLargada(cuadro);
    return datos;
  }

  // §250: en qué cuadro de lógica y a qué hora (la del reloj de pared, ms desde 1970: igual en todas las pestañas de un
  // PC; la página le suma el desfase de la sala) corrió esta consola el cuadro 0, el primero de la cuenta y el primero
  // con la carrera andando. El cuadro tiene que ser el mismo en todas (la carrera es la misma); la hora, casi la misma
  const pared = () => (globalThis.performance?.timeOrigin ?? 0) + ahora();
  function anotarLargada(c) {
    let s = null; try { s = etapa(); } catch {}
    if (!est.largada || est.largada.carrera !== carrera) {
      est.largada = { carrera, c0: c, t0: pared(), cuenta: null, ya: null };
      (est.largadas ||= []).push(est.largada); if (est.largadas.length > 8) est.largadas.shift();   // (las de la copa)
    }
    const L = est.largada;
    if (s >= 1 && !L.cuenta) L.cuenta = { c, t: pared() };
    if (s >= 2 && !L.ya) { L.ya = { c, t: pared() }; registro(`[lockstep] largada: cuadro 0 a las ${L.t0.toFixed(0)}, cuenta en el ${L.cuenta?.c}, carrera en el ${c} a las ${L.ya.t.toFixed(0)}`); try { alYa?.(carrera, c); } catch {} }
  }

  // Los botones de cada mando para el cuadro c, o quiénes faltan (mandos; −1 = estoy quieto por un corte en curso).
  // Para cada uno: cortado → neutro y "se fue"; relevado por la autoridad de ese cuadro → lo que dice ella; si no,
  // el suyo. Antes que nada hace falta el paquete de la autoridad de ese cuadro (dice quiénes van relevados).
  // (R4, §230: cuando está todo, devuelve siempre el mismo objeto —se usa en el momento—; solo «faltan» es nuevo, y
  // eso pasa solo cuando hay que esperar)
  const faltan = new Set(), valsR = [], resR = { vals: valsR, autoridad: undefined };
  const valDe = m => valsR[m] || (valsR[m] = { v: NEUTRO, con: 0 });
  function resolver(c) {
    faltan.clear();
    for (const [, b] of bloqueos) if (c > b.hasta) faltan.add(-1);
    const a = autoridadEn(c), xa = a !== undefined && tabla(a).has(c) ? (reg(a).get(c) || null) : undefined;
    // §191 (R1): con el árbitro, la autoridad no espera a nadie... salvo que no le llegue NADA de NINGUNO hace SOLO_MAX
    // cuadros: entonces la aislada es ella (la red se le cortó) y no tiene que seguir sola inventándolos a todos (si no,
    // armaba una carrera propia y cortaba a los demás); espera como siempre, y los demás deciden por ella
    if (arbitro && a === miMando && c > SOLO_MAX) {
      // (§246: ni el que ya tiene su corte decidido, aunque rija unos cuadros más adelante: se sabe que se fue —cerró la
      // página en la cuenta regresiva— y no oírlo no dice que la aislada sea yo. Con dos en la sala no queda nadie que
      // decida por mí y la largada quedaba quieta hasta el margen de 45 s: prueba-desconexion --casos=cuenta-otro)
      const otros = mandos.filter(m => m !== miMando && !cortes.has(m) && !pausadoEn(m, c) && tabla(m).size > 0);
      // (lo que se mira es si se los OYE, no sus cuadros: uno lento que va más de 1 s atrás pero sigue mandando no
      // frena a la autoridad —prueba-sincro --lento con el árbitro—; esa es justamente la idea del árbitro)
      if (otros.length && otros.every(m => oidoHace(m) > SORDO_MS)) for (const m of otros) faltan.add(m);
    }
    for (const m of mandos) {
      // (§236: los botones del servidor solo hacen falta si es la autoridad: su paquete trae el registro de ese cuadro;
      // si no, ni cortado ni pausado le importan a nadie: no tiene kart)
      if (m >= MANDOS && m !== a) continue;
      if (cortadoEn(m, c)) { const y = valDe(m); y.v = NEUTRO; y.con = 2; continue; }
      if (pausadoEn(m, c)) {                                    // §99 (C1): pausado: el botón calculado, igual en todas
        const x = pausas.get(m).find(y => c >= y.desde && (y.vuelve === null || c < y.vuelve));
        const base = x.base || (ultimoUsado.get(m)?.f === x.desde - 1 ? ultimoUsado.get(m).v : null);
        if (!base) { faltan.add(-1); continue; }               // (todavía no corrí el cuadro anterior a la pausa: no pasa)
        { const y = valDe(m); y.v = congelado(base, c - x.desde); y.con = 1; }
        continue;
      }
      if (m !== a) {
        if (xa === undefined) { faltan.add(a); continue; }       // todavía no sé si va relevado
        if (xa && (xa.masc >> m) & 1) { const y = valDe(m); y.v = xa.slots[m]; y.con = 1; continue; }
      }
      const v = tabla(m).get(c);
      if (!v) { faltan.add(m); continue; }
      { const y = valDe(m); y.v = v; y.con = 1; }
    }
    if (faltan.size) return { faltan: [...faltan] };
    resR.autoridad = a;
    return resR;
  }

  // el decisor del corte del mando m: el primero que sigue que no es él, en el orden de la sala. §99 (H3): y que YO oigo
  // (algo suyo llegó hace menos de un margen): si la red se parte y los mandos 0 y 1 quedan del mismo lado, el otro lado
  // también tiene su decisor (antes nadie cortaba y ese lado esperaba para siempre); al volver la red gana la isla más
  // grande. Sin partición, todos oyen a todos y el decisor es el mismo en todas las consolas
  // (§99, C1: y que no esté pausado: se calló)
  const decisorDe = m => vivos().find(h => h.mando !== m && !pausaAbierta(h.mando) && (h.uid === yo || ahora() - (oido.get(h.uid) ?? -Infinity) < esperaCorte))?.uid;

  // §93: cuánto se espera al mando m, que falta en el cuadro c. Si todavía no mandó nada en esta carrera, viene
  // cargando: esperaInicio. En la largada (los primeros cuadrosLargada), esperaLargada; y si además se lo sigue oyendo
  // (algo suyo llegó hace menos de 1 s: la pestaña vive y solo espera al disco), esperaInicio. Después, el margen.
  const enLargada = c => c < cuadrosLargada && esperaLargada > esperaCorte;
  const oidoHace = m => ahora() - (oido.get(duenoDe.get(m)) ?? -Infinity);
  // §179 (R7): lo que puede esta consola (lo da la página; null = no se sabe)
  const miCapacidad = () => {
    let c = null; try { c = capacidad ? capacidad() : null; } catch {}
    const n = x => (typeof x === 'number' && Number.isFinite(x) ? x : null);
    return { margen: n(c?.margen), subida: n(c?.subida), telefono: typeof c?.telefono === 'boolean' ? c.telefono : null };
  };
  // §177.5 (R3): se lo oye pero su juego no avanza hace más de PAUSA_MS y no espera a nadie: trabado vivo
  const trabadoVivo = m => trabaViva && esperaDe.get(duenoDe.get(m)) === 0 && avanceDe.has(m) && ahora() - avanceDe.get(m) > PAUSA_MS;
  // §100: ¿el mando m es de una consola que se fue? (ver la opción ido)
  // (§175: solo quien ESTUVO se puede ir: a una consola que nunca se oyó —todavía carga la página o el juego, como las
  // dos que cargaron últimas en doce— ido() también le dice «no está en el buzón ni tiene WebRTC», y se la cortaba en
  // el cuadro 0; al llegar corría con sus botones y la sala se partía. La que todavía no llegó tiene el margen de carga)
  const seFue = m => !!ido && oido.has(duenoDe.get(m)) && oidoHace(m) > IDO_MS && !!ido(duenoDe.get(m));
  // §99 (C4): desde cuándo cargó al menos la mitad de los que siguen (yo incluido), en esta carrera
  let mitadDesde = null;
  function revisarMitad() {
    if (mitadDesde !== null || ultimo < 0) return;
    const vs = vivos(), llegaron = vs.filter(h => tabla(h.mando).size > 0).length;
    if (vs.length > 1 && 2 * llegaron >= vs.length) mitadDesde = ahora();
  }
  function margenDe(m, c) {
    // §236: el servidor no carga gráficos. Si desaparece justo al largar, usar el margen corto incluso en el cuadro 0.
    if (m === SERVIDOR) return esperaCorte;
    if (!tabla(m).size) {
      // (todavía cargando: el margen de siempre, salvo que ya cargó la mitad: entonces 15 s desde ese momento)
      revisarMitad();
      return mitadDesde === null || !espera ? esperaInicio : Math.max(0, Math.min(esperaInicio, mitadDesde + ESPERA_MITAD - espera.desde));
    }
    if (!enLargada(c)) return esperaCorte;
    return oidoHace(m) < 1000 ? Math.max(esperaLargada, esperaInicio) : esperaLargada;
  }

  // §101: mientras espero, revisar corre cada REVISAR_MS; un hueco más largo que un tirón entre dos vueltas es esta
  // pestaña trabada (lo que pasó del tirón en adelante no es esperar a nadie)
  function congeladoEn(e, t) {
    if (!trabaPropia) return 0;
    const hueco = t - e.tic;
    return e.congelado + (hueco > TIRON_MS ? hueco - REVISAR_MS : 0);
  }
  // ¿ya se puede seguir? Si no: pedir lo que falta y, después de mucho, cortar al que no aparece
  function revisar() {
    const bp = bloqueos.get(miMando);
    if (bp?.propia && ahora() - bp.desde > 2 * esperaCorte) { bloqueos.delete(miMando); registro('[lockstep] no llegó ninguna pausa mía: sigo'); }
    if (!espera) return;
    { const t = ahora(); espera.congelado = congeladoEn(espera, t); espera.tic = t; }
    const { cuadro } = espera;
    const r = resolver(cuadro);
    if (!r.faltan || fuera) { const f = espera.resolver; espera = null; f(); return; }
    // E6 (§237): si el cuadro de la autoridad ya no cabe en mi anillo, ni un reenvío lo puede recuperar.
    // Es mi atraso. Cortar a la autoridad dejaría al grupo sin sus botones actuales.
    const a = autoridadEn(cuadro);
    if (a !== undefined && a !== miMando && r.faltan.includes(a) && !tabla(a).cabe(cuadro)) {
      salirme(`el cuadro ${cuadro} quedó fuera del historial de la autoridad (último ${tabla(a).mayor})`);
      alPartida?.({ motivo: 'historial', cuadro, meSali: true });
      return;
    }
    // (§101: sin lo que estuve trabada yo: al despertar, lo de los demás todavía está en la cola de mensajes y no hay
    // que pausar ni cortar a nadie por eso)
    const t = ahora() - espera.desde - espera.congelado;
    const faltan = r.faltan.filter(m => m >= 0);
    espera.faltan = faltan;
    // §274: congelada (o esperando a uno que avisa que está congelado): no se pide, pausa ni corta a nadie; al volver,
    // congelar(false) corre los relojes lo que duró
    if (congelada || faltan.some(m => sigueCongelado(duenoDe.get(m)))) { if (espera) setTimeout(revisar, REVISAR_MS); return; }
    // §101 (para entender las esperas largas): a los ESPERAS_LOG ms y a los 1500 ms, qué falta y hasta dónde tengo lo de cada uno
    if ((t > ESPERAS_LOG && !espera.dicho) || (t > 1500 && espera.dicho === 1)) {
      espera.dicho = (espera.dicho || 0) + 1;
      const a = autoridadEn(cuadro);
      registro(`[lockstep] espero ${t.toFixed(0)} ms el cuadro ${cuadro}: faltan ${JSON.stringify(r.faltan)}; tengo hasta ` +
        mandos.map(m => `${m}:${ultimoDe(m)}${pausadoEn(m, cuadro) ? 'p' : ''}${cortes.has(m) ? 'x' : ''}`).join(' ') +
        `; autoridad ${a} (${a !== undefined && tabla(a).has(cuadro) ? `llegó, cubre ${(reg(a).get(cuadro)?.masc ?? 0).toString(2)}` : 'falta'}); bloqueos ${JSON.stringify([...bloqueos].map(([m, b]) => [m, b.hasta]))}` +
        `; propuestas ${JSON.stringify([...propuestas.keys()])}; oigo ${humanos.filter(h => h.uid !== yo).map(h => `${h.mando}:${Math.round(oidoHace(h.mando))}`).join(' ')} ms`);
    }
    if (t > ESPERA_PIDE * cuadroMs && ahora() - espera.pedido > ESPERA_PIDE * cuadroMs) {
      espera.pedido = ahora();
      for (const m of faltan) { pedidosA.set(m, ahora()); aTodos(empaca(2, m, cuadro), 'udp'); }
    }
    // §75: al que avisó que se salta esta carrera (recargó la página) no se lo espera: se corta ya. Al que todavía no
    // mandó nada en esta carrera se le espera más (esperaInicio: cada uno carga a su ritmo); al que ya estaba, el margen
    // (§93: más largo en la largada, margenDe)
    // §100: y al que se FUE (cerró la página o perdió internet: ni en el buzón ni con su WebRTC sano, y nada suyo hace
    // IDO_MS) tampoco: el margen es para el que puede volver (antes, el que cerraba al cargar la carrera dejaba a los
    // demás 15 s mirando la pista quieta)
    const salta = saltos.get(carrera);
    for (const m of faltan) {
      if (decisorDe(m) !== yo || propuestas.has(m) || cortes.has(m)) continue;
      if (salta?.has(m) || t > margenDe(m, cuadro) || seFue(m)) proponer(m);
      // §99 (C1): al que ya mandó algo en esta carrera y además está CALLADO (no llega nada suyo hace PAUSA_MS: su
      // pestaña se trabó o se le cortó la red), a los PAUSA_MS se lo pausa (no espera nadie el margen entero). Al que
      // se le pierden paquetes pero se lo sigue oyendo no: se le piden de nuevo (si no, con una red que pierde,
      // pausaríamos a alguien que no se enteraría a tiempo y quedaría fuera de la carrera)
      // (§250: antes del «¡YA!» no: se lo espera con el margen de la largada, así nadie corre la cuenta sin él)
      else if (relevoRapido && !barreraAhora && tabla(m).size > 0 && !pausaAbierta(m) && t > PAUSA_MS && (oidoHace(m) > PAUSA_MS || trabadoVivo(m))) {
        if (oidoHace(m) <= PAUSA_MS) { est.trabasVivas = (est.trabasVivas || 0) + 1; registro(`[lockstep] ${duenoDe.get(m)} contesta pero no avanza hace ${Math.round(ahora() - avanceDe.get(m))} ms: lo pauso (traba viva)`); }
        proponer(m, true);
      }
    }
    revisarPropuestas();
    if (espera) setTimeout(revisar, REVISAR_MS);
  }

  // El corte en dos fases (§80, con los arreglos del crítico): 1) el decisor pregunta a TODOS (también al que se corta)
  // hasta qué cuadro corrieron o tienen sus botones; cada uno, al contestar, reparte lo que tiene de él y se queda
  // quieto ahí hasta saber la decisión (así ningún botón suyo que llegue tarde se usa más allá); 2) corta DESPUÉS del
  // máximo. Nadie corrió ese cuadro todavía: todas lo usan "sin nadie" desde ahí. Hasta dónde llego: lo que tengo de
  // él, lo que ya corrí y, si va relevado, hasta donde la autoridad ya escribió su relevo (ahí no hacen falta los suyos).
  const hastaDonde = m => fuera ? ultimoDe(m) : Math.max(ultimoDe(m), ejecutado(), alcanceRelevo(m));
  function proponer(m, suave = false) {
    const mio = hastaDonde(m);
    propuestas.set(m, { de: new Map(), desde: ahora(), mio, suave });
    bloqueos.set(m, { hasta: mio, desde: ahora() });
    registro(`[lockstep] propongo ${suave ? 'pausar' : 'cortar'} a ${duenoDe.get(m)} (mando ${m}): llego hasta el cuadro ${mio}`);
    aTodos(empaca(5, m, mio), 'tcp');
  }
  function revisarPropuestas() {
    const t = ahora();
    for (const [m, p] of propuestas) {
      // a quién se espera: a todos los que siguen y se oyen (menos al que avisó que se salta esta carrera). Al que se
      // corta, solo si se lo oyó hace poco (medio margen; sus pings llegan cada medio segundo): si se fue de verdad,
      // esperarlo es perder otro margen entero (y si estaba y no contestó, al ver el corte se sale él solo)
      const salta = saltos.get(carrera)?.has(m);
      // (§99, C1: en una pausa no se espera la respuesta del que se pausa —el callado es él— ni la de otro pausado)
      const deben = humanos.filter(h => h.uid !== yo && !cortes.has(h.mando) && !(salta && h.mando === m) && !(p.suave && (h.mando === m || pausaAbierta(h.mando))) &&
        t - (oido.get(h.uid) ?? -Infinity) < (h.mando === m ? esperaCorte / 2 : esperaCorte));
      if (deben.every(h => p.de.has(h.uid)) || t - p.desde > esperaCorte) {
        propuestas.delete(m);
        if (p.suave) pausar(m, Math.max(p.mio, ...p.de.values()) + 1, true);
        else cortar(m, Math.max(p.mio, ...p.de.values()) + 1, true);
      }
    }
  }

  function cortar(m, desde, anunciar) {
    if (cortes.has(m)) {                          // el corte no cambia nunca una vez fijado
      if (cortes.get(m) !== desde) { est.conflictos++; registro(`[lockstep] dos cortes para el mando ${m}: ${cortes.get(m)} y ${desde} (me quedo con el primero)`); }
      bloqueos.delete(m); revisar();
      return;
    }
    cortes.set(m, desde);
    bloqueos.delete(m);
    relevados.delete(m);
    est.cortes.push({ mando: m, desde, carrera });
    registro(`[lockstep] el mando ${m} (${duenoDe.get(m)}) sigue sin nadie desde el cuadro ${desde}`);
    if (anunciar) aTodos(avisoCorte(m, desde), 'tcp');
    // si yo ya corrí ese cuadro (no contesté a tiempo), mi copia de la carrera se separó: me salgo de esta carrera
    if (ultimo >= 0 && ejecutado() >= desde && !fuera) salirme(`el corte de ${duenoDe.get(m)} es en el cuadro ${desde} y yo ya corrí el ${ejecutado()}`);
    revisar();
  }
  // §99 (C1): pausar el mando m desde el cuadro `desde` (una vez fijada, la pausa no cambia)
  function pausar(m, desde, anunciar, de = yo) {
    const abierta = pausaAbierta(m), conocida = pausas.get(m)?.some(x => x.desde === desde);
    // (§269b.8: de dónde vino cada pausa, las primeras de la carrera, para el estado)
    if (!conocida && (est.pausasDe ||= []).length < 12) est.pausasDe.push({ mando: m, desde, de, voy: ultimo, carrera });
    if (m === miMando) decisionMia = ahora();
    if (cortes.has(m) || abierta || conocida) {
      // (los avisos se repiten: uno de una pausa ya conocida, o de una vieja ya cerrada, no es conflicto ni toca nada;
      // una distinta con otra abierta solo puede venir de otro decisor —la red partida—: me quedo con la primera)
      if (abierta && !conocida && desde > abierta.desde) { est.conflictos++; registro(`[lockstep] dos pausas para el mando ${m}: ${abierta.desde} y ${desde} (me quedo con la primera)`); }
      return;
    }
    // (una pausa vieja que no conocía y que es anterior a una cerrada: ya pasó, no se agrega)
    if (pausas.get(m)?.some(x => x.vuelve !== null && desde < x.vuelve)) return;
    // (una pausa que empieza antes de la vuelta de la anterior no puede ser: la anterior ya está cerrada más atrás)
    let ps = pausas.get(m); if (!ps) pausas.set(m, ps = []);
    // (R4: una copia: el arreglo de ultimoUsado se reescribe en cada cuadro)
    ps.push({ desde, vuelve: null, base: ultimoUsado.get(m)?.f === desde - 1 ? ultimoUsado.get(m).v.slice() : null, t: ahora() });
    bloqueos.delete(m);
    relevados.delete(m);
    est.pausas.push({ mando: m, desde, carrera });
    registro(`[lockstep] pauso el mando ${m} (${duenoDe.get(m)}) desde el cuadro ${desde}${m === miMando ? ' (soy yo: mi kart sigue solo hasta que vuelva)' : ''}`);
    if (anunciar) aTodos(avisoPausa(m, desde), 'tcp');
    // si ya corrí ese cuadro (con sus botones de verdad, o yo con los míos), mi copia se separó: me salgo
    if (ultimo >= 0 && ejecutado() >= desde && !fuera) salirme(`la pausa de ${duenoDe.get(m)} es en el cuadro ${desde} y yo ya corrí el ${ejecutado()}`);
    revisar();
  }
  function avisoPausa(m, desde) { const b = avisoCorte(m, desde, 3); b[10] = 1; return b; }
  // (la vuelta dice de qué pausa es: los avisos se repiten y una vieja no se tiene que aplicar a una pausa nueva)
  function avisoVuelta(m, r, desde) { const b = empaca(17, m, r, 4); new DataView(b.buffer).setUint32(8, desde >>> 0); return b; }
  // §99 (C1): el decisor fija la vuelta del pausado m: VUELTA_MARGEN cuadros más allá de lo que ya corrí
  function fijarVuelta(m, r, anunciar, desde = null) {
    const x = desde === null ? pausaAbierta(m) : pausas.get(m)?.find(y => y.desde === desde);
    if (!x) return;
    if (x.vuelve !== null) { if (x.vuelve !== r) { est.conflictos++; registro(`[lockstep] dos vueltas para la pausa ${x.desde} del mando ${m}: ${x.vuelve} y ${r}`); } return; }
    if (r <= x.desde) r = x.desde + 1;
    x.vuelve = r; est.vueltas++;
    if (m === miMando) decisionMia = ahora();
    registro(`[lockstep] ${duenoDe.get(m)} vuelve a manejar desde el cuadro ${r}`);
    if (anunciar) aTodos(avisoVuelta(m, r, x.desde), 'tcp');
    if (ultimo >= 0 && ejecutado() >= r && !fuera) salirme(`la vuelta de ${duenoDe.get(m)} es en el cuadro ${r} y yo ya corrí el ${ejecutado()}`);
    revisar();
  }
  // §99 (C1), en cada informe: si estoy pausado, ya llegué a mi pausa y no voy atrás, pido volver (cada rato hasta
  // que me la den); si soy el decisor de un pausado que no volvió en PAUSA_A_CORTE, lo corto como siempre
  function revisarPausas() {
    if (ultimo < 0 || fuera || congelada) return;   // (§274: congelada, las pausas no se vuelven corte)
    const mia = pausaAbierta(miMando);
    if (mia && !cortes.has(miMando) && ejecutado() >= mia.desde) {
      const mitad = atrasDeLaMitad();
      const d = decisorDe(miMando);
      // (§99: y no mientras corre la ráfaga para ponerme al día: si pido volver todavía atrás, me esperan otra vez)
      if (d && ahora() > alDiaHasta && (mitad <= PRISA_DEJA + 1 || ahora() - mia.t > 3000) && ahora() - pidoVuelta > informeCada) {
        pidoVuelta = ahora();
        enviar(d, empaca(16, miMando & 255, Math.max(0, ejecutado())), 'tcp');
      }
    }
    for (const [m, ps] of pausas) {
      const x = ps.find(y => y.vuelve === null);
      if (!x || m === miMando || cortes.has(m) || decisorDe(m) !== yo) continue;
      if (ahora() - x.t > pausaACorte) cortar(m, Math.max(x.desde, ultimo + VUELTA_MARGEN), true);
    }
  }
  // el aviso de un corte: lleva cuántos siguen en la carrera según el que corta y el mando más bajo de ellos (si la
  // conexión se partió en dos y cada lado cortó al otro, así se sabe qué lado sigue; ver alBinario, tipo 3)
  function avisoCorte(m, desde, extra = 2) {
    const b = empaca(3, m, desde, extra), v = enMiIsla();
    b[8] = v.length; b[9] = v.length ? Math.min(...v.map(h => h.mando)) : 255;
    return b;
  }
  // §80 (lo encontró la sesión del selector): el aviso de un corte va una vez por "tcp", y un corte casi siempre viene
  // de una conexión que se cayó: justo ahí el aviso se pierde y el cortado nunca se entera (sigue con sus botones y se
  // separa). Por eso cada medio segundo se repiten a todos los cortes de esta carrera (10 bytes cada uno). Al que vuelve
  // le llega el suyo: si ya corrió más allá, se sale de la carrera; si no, sigue sin su kart, igual que los demás.
  function repetirCortes() {
    if (ultimo < 0) return;
    for (const [m, desde] of cortes) if (desde > 0 && m !== miMando) aTodos(avisoCorte(m, desde), 'tcp');
    // (§99, C1: y las pausas y vueltas: al que vuelve le llega la suya)
    for (const [m, ps] of pausas) for (const x of ps) {
      aTodos(avisoPausa(m, x.desde), 'tcp');
      if (x.vuelve !== null) aTodos(avisoVuelta(m, x.vuelve, x.desde), 'tcp');
    }
  }
  // me salgo de esta carrera (vuelvo en la siguiente, como al recargar): aviso a todos para que me corten ya
  // §269b.7: voy relevado (la autoridad ya escribe lo mío) y lo que tengo de ella va más de ATRAS_SALIR cuadros delante
  function muyAtras(c) {
    if (!cortarTarde || !arbitro || c < 0) return false;
    const a = autoridadEn(c);
    if (a === undefined || a === miMando || !relevados.has(miMando) && !yoRelevado()) return false;
    const t = tabla(a);
    return t.size > 0 && t.mayor - c > ATRAS_SALIR;
  }
  function salirme(por) {
    fuera = { cuadro: ultimo, por };
    est.salidas++; est.salidaPor = por;   // (§269b.8: el porqué, también en el estado: el simulador de sala no guarda el registro)
    registro(`[lockstep] me salgo de la carrera ${carrera}: ${por}`);
    aTodos(empaca(14, miMando & 255, Math.max(0, ultimo)), 'tcp');
    if (espera) { const f = espera.resolver; espera = null; f(); }
  }

  // R5 (§154): la huella puede venir ampliada ({ h, partes, nombres, valores }: h = la de siempre, que es la que decide;
  // partes = una huella por pieza —cada kart, el azar—, solo para decir QUÉ se separó). El paquete 4 lleva las partes
  // después de los 16 bytes de siempre: una página vieja lee solo los 16 primeros
  function compararHuella(cuadro, hx) {
    let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
    const amp = hx && typeof hx === 'object';
    e.mia = (amp ? hx.h : hx) >>> 0; e.miaB = est.hashBotones;
    if (amp) { e.partes = Uint32Array.from(hx.partes); e.nombres = hx.nombres; e.valores = hx.valores; }
    const np = amp ? e.partes.length : 0;
    const b = empaca(4, miMando & 255, cuadro, 8 + 4 * np), d = new DataView(b.buffer);
    d.setUint32(8, e.mia); d.setUint32(12, e.miaB);
    for (let k = 0; k < np; k++) d.setUint32(16 + 4 * k, e.partes[k]);
    aTodos(b, 'tcp');
    revisarHuella(cuadro);
  }
  function revisarHuella(cuadro) {
    const e = huellas.get(cuadro); if (!e || e.mia === undefined) return;
    for (const [u, [h, hb, ps]] of e.de) {
      e.de.delete(u);
      (e.todas ??= new Map()).set(u, `${h >>> 0}:${hb >>> 0}`);   // (§175: para decidir qué isla sigue)
      // R5: qué partes difieren (si las dos mandaron partes)
      const distintas = ps && e.partes ? [...e.partes].map((x, k) => x !== ps[k] ? (e.nombres?.[k] ?? 'parte' + k) : null).filter(Boolean) : null;
      if (distintas?.length && !est.parteDistinta) {
        // la primera vez: lo que difiere y mis valores de esas partes (el otro anota los suyos), aunque la huella de
        // siempre coincida (entonces solo se avisa: nadie sale por esto)
        est.parteDistinta = { cuadro, carrera, con: u, partes: distintas, volcado: Object.fromEntries(distintas.map(n => [n, e.valores?.[n]])) };
        registro(`[lockstep] huella ampliada distinta con ${u} en el cuadro ${cuadro}: ${distintas.join(', ')} · mío ${JSON.stringify(est.parteDistinta.volcado)}`);
      }
      if (ps && e.partes) est.huellasAmpliadas = (est.huellasAmpliadas || 0) + 1;
      // (§80: con uno que está cortado desde ese cuadro o antes no se compara: si no se enteró del corte —se le cortó
      // la conexión justo cuando se lo mandaron—, su copia se separó a propósito, y al enterarse se sale de la carrera)
      const mu = mandoDe.get(u);
      if (cortes.has(mu) && cortes.get(mu) <= cuadro) {
        est.huellasDeCortados = (est.huellasDeCortados || 0) + 1;
        // §269b.8 (el simulador de sala, «tormenta»; banco relevo caso 27): con más de 20 s sin red, el que quedó solo CORTA
        // a todos los demás (el plazo del callado con el árbitro) y sigue su carrera solo: como las huellas de los cortados
        // no se comparan, nunca se enteraba de que los demás siguen juntos. Si quedé solo (corté o pausé a todos) y dos o
        // más de los que corté mandan la MISMA huella de este cuadro, distinta de la mía, la isla que sigue es la de ellos:
        // me salgo (los que se salieron no mandan huellas: pad vuelve antes)
        const clave = `${h >>> 0}:${hb >>> 0}`;
        if (ISLAS && retener && !fuera && enMiIsla().length === 1 && clave !== `${e.mia >>> 0}:${e.miaB >>> 0}`) {
          (e.cortadas ??= new Map()).set(u, clave);
          const iguales = [...e.cortadas.values()].filter(k => k === clave).length;
          if (iguales >= 2) {
            est.islas = { cuadro, carrera, grupos: [[...e.cortadas].filter(([, k]) => k === clave).map(([x]) => x), [yo]], sigue: [...e.cortadas].filter(([, k]) => k === clave).map(([x]) => x), meSali: true };
            salirme(`§269b.8: quedé solo (corté a todos) y ${iguales} de los que corté siguen juntos con otra carrera en el cuadro ${cuadro}`);
          }
        }
        continue;
      }
      if (h === e.mia && hb === e.miaB) { est.huellasIguales++; continue; }
      // §176: con las islas, la distinta no se anota todavía: si hay un corte en ese cuadro o antes, la otra pudo correr
      // más allá del corte con los botones de verdad del cortado (a mí no me llegaron) y se va a salir sola (paquete 14).
      // Se anota en decidirIsla, si para entonces sigue en la carrera
      if (ISLAS) { (e.distintas ??= new Map()).set(u, { cuadro, carrera, con: u, que: hb !== e.miaB ? 'botones' : 'carrera', partes: distintas || undefined }); }
      else if (!est.desincronizado && !fuera) {
        est.desincronizado = { cuadro, carrera, con: u, que: hb !== e.miaB ? 'botones' : 'carrera', partes: distintas || undefined };
        registro(`[lockstep] ¡DESINCRONIZADO con ${u} en el cuadro ${cuadro} (carrera ${carrera}): ${est.desincronizado.que}!`);
      }
      // §99 (H4): antes solo se anotaba y cada PC seguía con su carrera (puntos, VR y parrilla de carreras distintas).
      // Si el distinto es la autoridad de ese cuadro, el que se separó soy yo: me salgo de la carrera (vuelvo en la
      // siguiente, como al recargar). Si la autoridad soy yo, se sale el otro (él hace la misma cuenta)
      // §175: antes decidía la autoridad («si el distinto es ella, me salgo yo»). Con 6 consolas en doce las dos que
      // cargaron últimas se separaron, la autoridad era una de ellas y se salieron las otras CUATRO: la isla chica
      // siguió sola y la grande quedó parada, sin decir nada. Ahora sigue la isla MÁS GRANDE: se juntan las huellas de
      // ese cuadro de todas las consolas que corren (1,5 s como mucho), se agrupan las iguales y la que tiene más
      // consolas sigue; empate = la de la autoridad, y si no, la del mando más chico. Todas hacen la misma cuenta con
      // los mismos datos. Los de las otras islas se salen (vuelven en la carrera siguiente) y la página lo avisa
      // (est.islas, alPartida). ?islas=0 = la regla de antes (la autoridad)
      if (ISLAS) { if (!e.decision) e.decision = setTimeout(() => decidirIsla(cuadro), ISLA_MS); revisarIsla(cuadro); }
      else {
        const a = autoridadEn(cuadro);
        if (!fuera && a !== undefined && a !== miMando && duenoDe.get(a) === u) {
          est.desincronizado.meSali = true;
          salirme(`mi carrera se separó de la de ${u} (la autoridad) en el cuadro ${cuadro}`);
        }
      }
    }
    revisarIsla(cuadro);   // (§175: una huella que llega después puede completar la cuenta)
  }
  // §175: ¿ya llegaron las huellas de todas las consolas que corren esta carrera? Entonces se decide sin esperar
  function revisarIsla(cuadro) {
    const e = huellas.get(cuadro); if (!e?.decision || e.decidida) return;
    const fueraK = planteles.get(carrera) || new Set();
    const corren = humanos.filter(h => h.uid !== yo && h.mando < MANDOS && !fueraK.has(h.mando) && !(cortes.has(h.mando) && cortes.get(h.mando) <= cuadro));   // (§236: el servidor no tiene huella)
    // (§176: con un corte en ese cuadro o antes, se espera el plazo entero: da tiempo a que llegue el «me salgo» del
    // que corrió más allá del corte)
    const hayCorte = [...cortes.values()].some(c => c <= cuadro);
    if (!hayCorte && corren.every(h => e.todas?.has(h.uid))) decidirIsla(cuadro);
  }
  function decidirIsla(cuadro) {
    const e = huellas.get(cuadro); if (!e || e.decidida) return;
    e.decidida = true; clearTimeout(e.decision);
    const grupos = new Map();                       // huella → [mandos]
    // (§176: el que ya se salió de la carrera —cortado después de ese cuadro, p. ej. por su «me salgo»— no cuenta)
    const poner = (u, k) => { const m = mandoDe.get(u); if (m === undefined || (u !== yo && cortes.has(m))) return; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(m); };
    poner(yo, `${e.mia >>> 0}:${e.miaB >>> 0}`);
    for (const [u, k] of e.todas || []) poner(u, k);
    const a = autoridadEn(cuadro);
    const lista = [...grupos.entries()].map(([k, ms]) => ({ k, ms: ms.sort((x, y) => x - y) }));
    lista.sort((x, y) => (y.ms.length - x.ms.length) || ((y.ms.includes(a) ? 1 : 0) - (x.ms.includes(a) ? 1 : 0)) || (x.ms[0] - y.ms[0]));
    const gana = lista[0], mia = lista.find(g => g.ms.includes(miMando));
    if (lista.length < 2) return;                   // (§176: las distintas se salieron solas: nadie se partió)
    // (§269b.15, el simulador «tormenta»: la isla que sigue también quedaba «desincronizada» con el que se fue, aunque su
    // carrera es la buena y la siguen todos los demás. Desincronizado = mi carrera ya no es la de la sala: solo el de la
    // isla que se sale. Los que siguen anotan con quién se separaron en separadoDe. ?islaMarca=0 = todos, como antes)
    const marcaTodos = /[?&]islaMarca=0\b/.test(globalThis.location?.search || '');
    for (const [u, d] of e.distintas || []) {
      if (cortes.has(mandoDe.get(u)) || est.desincronizado || fuera) continue;
      // (solo con mayoría de verdad: 2 o más y más que la otra isla; uno contra uno no dice cuál está bien)
      if (mia === gana && !marcaTodos && gana.ms.length >= 2 && gana.ms.length > lista[1].ms.length) { (est.separadoDe ??= []).push(d); continue; }
      est.desincronizado = d;
      registro(`[lockstep] ¡DESINCRONIZADO con ${u} en el cuadro ${d.cuadro} (carrera ${d.carrera}): ${d.que}!`);
    }
    est.islas = { cuadro, carrera, grupos: lista.map(g => g.ms.map(m => duenoDe.get(m))), sigue: gana.ms.map(m => duenoDe.get(m)), meSali: mia !== gana };
    registro(`[lockstep] la sala se partió en el cuadro ${cuadro} (carrera ${carrera}): ${lista.map(g => '[' + g.ms.map(m => duenoDe.get(m)).join(', ') + ']').join(' · ')}; sigue la isla de ${gana.ms.length}`);
    if (mia !== gana && !fuera) {
      if (est.desincronizado) est.desincronizado.meSali = true;
      salirme(`la sala se partió en el cuadro ${cuadro} y sigue la isla más grande (${gana.ms.length} consolas), no la mía (${mia?.ms.length || 1})`);
    }
    try { alPartida?.(est.islas); } catch {}
  }

  // ---- cada 50 ms, haya o no espera: informes, cortes pendientes (saltos, silencios), propuestas y quietudes viejas ----
  let ultimoInforme = ahora();
  let vueltaVigia = -Infinity, despierto = -Infinity;
  const vigilancia = informeCada > 0 ? setInterval(() => {
    const t = ahora();
    // (§191, R1: si entre dos vueltas pasaron más de TIRON_MS, la trabada fui yo: lo que los demás mandaron mientras
    // tanto está en la cola de mensajes. Por 250 ms no decido cortes por silencio: con el árbitro todos van relevados y
    // la autoridad que despertaba cortaba a toda la sala)
    if (arbitro && t - vueltaVigia > TIRON_MS && vueltaVigia > -Infinity) despierto = t;
    vueltaVigia = t;
    if (t - ultimoInforme >= informeCada) { ultimoInforme = t; informar(); }
    if (ultimo < 0 || t - despierto < 250 || congelada) return;   // (§274: congelada, nadie se corta)
    for (const h of humanos) {
      const m = h.mando;
      if (sigueCongelado(h.uid)) continue;   // (§274: avisó que está congelado)
      // (§99, C1: al pausado no: si no vuelve, su pausa se vuelve corte en revisarPausas)
      if (m === miMando || cortes.has(m) || propuestas.has(m) || pausaAbierta(m) || decisorDe(m) !== yo || !tabla(m).size) continue;
      // el que avisó que se sale, o uno relevado que se calló del todo (nadie lo espera, pero el juego sí, en la meta)
      // (§191, R1: con el árbitro nadie lo espera —la autoridad inventa lo suyo—, así que no hay apuro: se lo corta recién
      // al plazo de la pausa, pausaACorte, como al pausado. Si no, una traba de 3 s, más que el margen, lo sacaba de la
      // carrera: prueba-relevo con ?arbitro=1)
      const callado = t - (oido.get(h.uid) ?? t) > (arbitro ? pausaACorte : enLargada(ultimo) ? esperaLargada : esperaCorte);   // (§93: en la largada, más)
      // (§99, C1: con el relevo rápido, al relevado que se calla se lo pausa a los PAUSA_MS: nadie lo esperaba —va
      // relevado— y el corte de los 2 s lo sacaba de la carrera)
      // (§191, R1: con el árbitro, también al que se fue —§100—: nadie lo espera, así que revisar no lo vería)
      if (saltos.get(carrera)?.has(m) || (arbitro && seFue(m))) proponer(m);
      // (§191, R1: con el árbitro no se pausa al callado: la autoridad escribe lo suyo de todas formas y la pausa en dos
      // fases frenaba a todos mientras se decidía; el corte, si se calla del todo, sí)
      else if (relevoRapido && !arbitro && est.relevadosAhora.includes(h.uid) && t - (oido.get(h.uid) ?? t) > PAUSA_MS) proponer(m, true);
      else if (callado && est.relevadosAhora.includes(h.uid)) proponer(m);
    }
    revisarPropuestas();
    // §269b.8: los avisos retenidos (arriba, tipo 3): pasado RETIENE_MS, si las islas dijeron que sigue la mía y el que lo
    // mandó no está en ella, no vale; si no, se aplica
    for (const [k, x] of retenidos) {
      if (t - x.t < RETIENE_MS && !(typeof est.islas === 'object' && est.islas?.carrera === carrera)) continue;
      if (t - x.t < RETIENE_MS && est.islas.sigue.includes(x.de)) continue;
      retenidos.delete(k);
      const isla = typeof est.islas === 'object' && est.islas?.carrera === carrera ? est.islas : null;
      if (isla && isla.sigue.includes(yo) && !isla.sigue.includes(x.de)) {
        descartados.add(k); est.descartados = (est.descartados || 0) + 1;
        registro(`[lockstep] §269b.8: no vale ${x.esPausa ? 'la pausa' : 'el corte'} de ${duenoDe.get(x.m)} en el cuadro ${x.cuadro} que manda ${x.de}: sigue mi isla (${isla.sigue.join(', ')})`);
      } else if (!fuera) { if (x.esPausa) pausar(x.m, x.cuadro, false, x.de); else cortar(x.m, x.cuadro, false); }
    }
    // una quietud de un corte que nunca se decidió (el decisor se fue): se suelta; otro decisor lo vuelve a proponer
    for (const [m, b] of bloqueos) if (!propuestas.has(m) && t - b.desde > 3 * esperaCorte) { bloqueos.delete(m); registro(`[lockstep] el corte de ${duenoDe.get(m)} no se decidió: sigo`); revisar(); }
  }, 50) : null;

  // ---- lo que llega de los demás ----
  function alBinario(de, b) {
    if (b[0] !== MARCA || b.length < 8) return;
    const tipo = b[1], c = b[2], m = b[3], d = new DataView(b.buffer, b.byteOffset, b.byteLength), cuadro = d.getUint32(4);
    // §236: después de transferir el mando a una PC, el servidor ya no decide pausas ni cortes de esta carrera.
    if (mandoDe.get(de) === SERVIDOR && c === (carrera & 255) && sinAutoridadEn(SERVIDOR, Math.max(0, ultimo)) &&
        [3, 5, 17].includes(tipo)) return;
    { const t = ahora(), antes = oido.get(de); if (antes !== undefined && t - antes > VOLVIO_MS) volvioDe.set(de, t); oido.set(de, t); }   // (§269b.8)
    if (tipo === 7 && b.length >= 16) {                         // ping: se devuelve tal cual (con su hora)
      if (b.length >= 21) esperaDe.set(de, b[20] & 3 ? 1 : 0);  // (§177.5: una página vieja no lo trae: sin traba viva; §274: la congelada no avanza a propósito)
      if (b.length >= 21 && (b[20] & 2)) congeladoDe.set(de, ahora());
      const r = b.slice(); r[1] = 8; enviar(de, r, 'udp'); return;
    }
    if (tipo === 8 && b.length >= 16) {                         // respuesta: ida y vuelta, suavizada como TCP
      const x = ahora() - d.getFloat64(8), r = rtt.get(de);
      if (!r) rtt.set(de, { s: x, m: [x], n: [cuadro] });
      else {
        r.s = 0.875 * r.s + 0.125 * x; r.m.push(x); r.n.push(cuadro);
        if (r.m.length > VENTANA) r.m.shift();
        if (r.n.length > 2 * VENTANA) r.n.shift();
      }
      return;
    }
    // ¿de esta carrera, de la siguiente (alguien ya empezó) o vieja?
    let destino;
    if (c === (carrera & 255)) destino = { tablas, regs, cortes };
    else if (c === ((carrera + 1) & 255)) { if (!siguiente) siguiente = { carrera: carrera + 1, tablas: new Map(), regs: new Map(), cortes: new Map() }; destino = siguiente; }
    else return;
    const actual = destino.tablas === tablas;
    // §99 (S1): mis botones solo los escribo yo (antes, uno que llegaba antes de otro tapaba el mío); los de otro mando
    // que manda un tercero, solo si los pedí, si hay un corte en curso de él o si su dueño se calló (reparto)
    if (tipo === 13 || tipo === 15) est.recibidosDe[de] = (est.recibidosDe[de] || 0) + 1;   // §269: para el informe de Diagnóstico
    if ((tipo === 13 || tipo === 15) && (m === miMando || (de !== duenoDe.get(m) && !(ahora() - (pedidosA.get(m) ?? -Infinity) < PEDIDO_VALE ||
        propuestas.has(m) || bloqueos.has(m) || ahora() - (oido.get(duenoDe.get(m)) ?? -Infinity) > CALLADO_MS)))) return;
    if (tipo === 15 && b.length >= 16) {
      // §99 (H5): el acuse de lo mío que trae (solo vale del propio par)
      const ack = d.getUint32(12);
      if (actual && ack !== 0xFFFFFFFF && de === duenoDe.get(m)) ackDe.set(de, Math.max(ackDe.get(de) ?? -1, ack));
      // §99 (C1): alguien me avisa que hay una decisión mía en camino (una pausa): me quedo quieto en el cuadro que ya
      // corrí hasta saberla (si sigo con mis botones más allá de donde me pausaron, mi copia se separa)
      // (salvo que acabe de saber una decisión mía: lo que traiga la marca viene de antes)
      if (actual && (b[10] & 2) && !bloqueos.has(miMando) && !pausaAbierta(miMando) && !cortes.has(miMando) && !fuera && ultimo >= 0 &&
          ahora() - decisionMia > 2000) {
        bloqueos.set(miMando, { hasta: Math.max(0, ejecutado()), desde: ahora(), propia: true });
        registro(`[lockstep] ${de} me avisa que hay una pausa mía en camino: me quedo en el cuadro ${ejecutado()}`);
      }
    }
    if ((tipo === 13 && b.length >= 10) || (tipo === 15 && b.length >= 16)) {
      const n = b[8], adelanto = b[9], conReg = tipo === 13 || !!(b[10] & 1), paso = conReg ? 13 : 8;
      let o = tipo === 15 ? 16 : 10, masNuevo = -1;
      const tt = actual ? tabla(m) : (destino.tablas.get(m) || destino.tablas.set(m, anilloNuevo()).get(m));
      const rr = actual ? reg(m) : (destino.regs.get(m) || destino.regs.set(m, regNuevo()).get(m));
      for (let i = 0; i < n && o + paso <= b.length; i++) {
        const f = cuadro + i, o0 = o, masc = conReg ? d.getUint16(o + 8) : 0, sust = conReg ? d.getUint16(o + 10) : 0, sig = conReg ? b[o + 12] : 0xFF;
        o += paso;
        // (R4: primero se mira si cabe y si ya lo tengo; recién ahí se lee, directo a la casilla del anillo: antes se
        // armaban un arreglo de 12 y uno de 7 por cuadro aunque fuera repetido)
        let nb = 0;
        for (let k = 0; k < MANDOS; k++) if ((masc >> k) & 1) nb++;
        if (o + 8 * nb > b.length) return;
        const os = o; o += 8 * nb;
        if (tt.has(f) || !tt.cabe(f)) continue;
        lee8en(d, o0, tt.casilla(f));
        if (actual && de === duenoDe.get(m)) {
          avanceDe.set(m, ahora());   // (§177.5: su juego avanza)
          // (§269b.11: si se lo había inventado, cuánto tarde llegó)
          const i = m * 128 + (f & 127);
          if (m < MANDOS && invCuadro[i] === f) { invCuadro[i] = -1; const h = tardeHist[m]; h.push([ahora(), ahora() - invHora[i]]); if (h.length > 64) h.shift(); }
        }
        if (actual && f > ultimoDe(m)) nuevo.set(m, f);
        if (masc || sig !== 0xFF) {
          const x = rr.poner(f, masc, sust, sig);
          for (let k = 0, q = os; k < MANDOS; k++) if ((masc >> k) & 1) { lee8en(d, q, x.buf[k]); x.slots[k] = x.buf[k]; q += 8; }
        }
        if (actual && arbitro && (masc >> miMando) & 1 && f < cubiertoDesde) cubiertoDesde = f;   // (§191: la autoridad ya me cubre)
        if (sig === miMando && actual) {
          // me pasaron la autoridad: sigo relevando a los que ella relevaba, y a ella misma (se atrasaba)
          const t = ahora();
          relevados.clear(); pasarA = null; traspaso = null;
          for (const k of bits(masc)) if (k !== miMando) relevados.set(k, { desde: t, problema: t });
          if (m !== miMando) relevados.set(m, { desde: t, problema: t });
          registro(`[lockstep] ${duenoDe.get(m)} me pasó la autoridad desde el cuadro ${f + 1 + (arbitro ? LEAD_TRASPASO : 0)}`);
        }
        masNuevo = f;
      }
      // la holgura: cuántos cuadros antes de necesitarlo llegó su botón más nuevo (solo lo que manda el dueño)
      if (actual && masNuevo >= 0 && de === duenoDe.get(m) && ultimo >= 0 && m !== miMando) {
        const necesito = espera ? espera.cuadro : ultimo + 1;
        // (§191, R1: si soy el árbitro, el cuadro f lo decido al escribir lo mío de ese cuadro: la holgura es contra lo
        // próximo que escribo. Y la del que va atrás —se trabó y se pone al día— no cuenta: llega tarde porque lo escribe
        // tarde, no por la red, y no tiene que subir su retraso)
        if (!(arbitro && autoridadEn(Math.max(0, ultimo)) === miMando)) ven.hol[m] = Math.min(ven.hol[m], masNuevo - necesito);
        else if (adelanto === 0xFF || ultimo - (cuadro + n - 1 - adelanto) <= UMBRAL_PRISA) ven.hol[m] = Math.min(ven.hol[m], masNuevo - (escrito + 1));
      }
      // §80b, mi ventaja sobre él: mi cuadro de ahora menos el suyo cuando lo mandó (= cuánto voy adelante, más lo que
      // tardó en llegar). Se queda la más chica del rato (la que llegó más rápido). Él mide lo mismo de mí; la mitad
      // de la diferencia de las dos es cuánto voy adelante de verdad: lo que tarda la red se cancela (ver calcularDeuda)
      if (actual && adelanto !== 0xFF && de === duenoDe.get(m) && ultimo >= 0 && m !== miMando) {
        const suyo = cuadro + n - 1 - adelanto;
        ven.ven[m] = Math.min(ven.ven[m], Math.max(-127, Math.min(126, ultimo - suyo)));
      }
      if (actual) revisar();
    } else if (tipo === 2) {
      // alguien pide los botones del mando m desde `cuadro`: si los tengo (míos o de otro), se los mando
      if (actual && tabla(m).has(cuadro)) { const p = paquete(m, cuadro, cuadro + 31); if (p) enviar(de, p, 'udp'); }
    } else if (tipo === 3) {
      if (!actual) { if (!destino.cortes.has(m)) destino.cortes.set(m, cuadro); return; }
      // §80: un corte que manda uno al que YO ya corté: la conexión se partió en dos («islas») y cada lado cortó al
      // otro. Sigue el lado con más jugadores; si empatan, el que tiene el mando más bajo (el de la autoridad). Los dos
      // lados hacen la misma cuenta. Si gana mi isla, lo que diga la otra no vale (ni su corte de mí ni el de los míos);
      // si gana la suya, acepto mi corte (y, como ya corrí más allá, me salgo de la carrera). Como una red eléctrica que
      // se separa en islas: sigue la isla con más generación, la otra se apaga y se vuelve a enganchar después.
      const su = mandoDe.get(de);
      if (su !== undefined && (cortes.has(su) || pausaAbierta(su)) && b.length >= 10 && !cortes.has(miMando)) {
        const v = enMiIsla(), mios = v.length, minMio = Math.min(...v.map(h => h.mando)), suyos = b[8], minSuyo = b[9];
        const ganoYo = mios > suyos || (mios === suyos && minMio < minSuyo);
        if (ganoYo || m !== miMando) {
          if (!est.avisosOtraIsla) registro(`[lockstep] ${de} (al que corté) corta a ${duenoDe.get(m)}: ${ganoYo ? `sigue mi lado (somos ${mios}, ellos ${suyos})` : 'no vale para nadie más que para mí'}`);
          // (§269b.8: un contador aparte; antes sumaba sobre est.islas, que desde §175 es la decisión de las islas —un
          // objeto—, y la volvía texto: «[object Object]111…»)
          est.avisosOtraIsla = (est.avisosOtraIsla || 0) + 1;
          return;
        }
      }
      const esPausa = b.length >= 11 && b[10] === 1;
      // §269b.8 (el simulador de sala, «se-va-y-vuelve», y el banco relevo caso 27): con el árbitro nadie pausa ni corta al
      // callado antes de 20 s, así que el que quedó solo sin red pausa y corta a los demás sin que ellos lo hayan pausado
      // a él, y por el canal confiable esos avisos llegan, al volver la red, ANTES que las huellas que dicen qué isla
      // sigue: las tres consolas se salían. Un aviso sobre un cuadro que ya corrí espera hasta RETIENE_MS la decisión de
      // las islas: si sigue la mía y quien lo manda no está en ella, no vale; si no, se aplica como siempre. Solo si quien
      // lo manda acaba de volver de un silencio de más de VOLVIO_MS (la red partida): si no, como siempre, en el momento
      const clave = `${m}:${cuadro}:${esPausa ? 1 : 0}:${de}`;
      if (descartados.has(clave)) return;
      // §269b.10 (el simulador de sala, «tormenta»: una consola con la pestaña oculta y otra sin red decidieron SOLAS
      // pausas y cortes con su vista partida de la red, y esos avisos llegaron a las demás segundos después, sin silencio de
      // por medio). Con el árbitro, la carrera es lo que escribe la autoridad: si ya corrí ese cuadro siguiendo el registro
      // de una autoridad que sigo oyendo (o soy yo, con alguien más que me sigue), y quien lo manda no es ella, el aviso
      // es de otra isla y no vale (las huellas deciden después quién se separó)
      if (arbitro && retener && ultimo >= 0 && !fuera && ejecutado() >= cuadro) {
        const a = autoridadEn(cuadro), da = a !== undefined ? duenoDe.get(a) : undefined;
        const viva = a === miMando ? humanos.some(h => h.uid !== yo && h.uid !== de && !cortes.has(h.mando) && oidoHace(h.mando) < esperaCorte)
          : a !== undefined && !cortes.has(a) && oidoHace(a) < esperaCorte;
        if (da !== undefined && da !== de && viva) {
          descartados.add(clave); est.descartados = (est.descartados || 0) + 1;
          if ((est.descartados || 0) <= 5) registro(`[lockstep] §269b.10: no vale ${esPausa ? 'la pausa' : 'el corte'} de ${duenoDe.get(m)} en el cuadro ${cuadro} que manda ${de}: ya lo corrí con el registro de ${da}, que sigo oyendo`);
          return;
        }
      }
      if (ISLAS && retener && ahora() - (volvioDe.get(de) ?? -Infinity) < RETIENE_MS && ultimo >= 0 && !fuera && ejecutado() >= cuadro && !(esPausa ? pausas.get(m)?.some(x => x.desde === cuadro) : cortes.has(m))) {
        if (!retenidos.has(clave)) { retenidos.set(clave, { de, m, cuadro, esPausa, t: ahora() }); est.retenidos = (est.retenidos || 0) + 1; }
        return;
      }
      if (esPausa) pausar(m, cuadro, false, de);      // §99 (C1): una pausa, no un corte
      else cortar(m, cuadro, false);
    } else if (tipo === 16 && actual && de === duenoDe.get(m)) {
      // §99 (C1): el pausado pide volver: si soy su decisor, fijo el cuadro de la vuelta
      const x = pausaAbierta(m);
      if (x && decisorDe(m) === yo) fijarVuelta(m, Math.max(x.desde + 1, ultimo + VUELTA_MARGEN), true);
    } else if (tipo === 17 && actual && b.length >= 12) {
      // §99 (C1): la vuelta de un pausado (la manda su decisor; se repite cada medio segundo), de la pausa que dice
      fijarVuelta(m, cuadro, false, d.getUint32(8));
    } else if (tipo === 5) {
      // el decisor va a cortar el mando m: reparto lo que tengo de él (por "tcp": llega en orden), le digo hasta dónde
      // llego y me quedo quieto ahí hasta saber la decisión. Si todavía no empecé esa carrera: no corrí nada (−1)
      let hasta = -1;
      if (actual) {
        const x = ultimoDe(m), p = x >= 0 ? paquete(m, Math.max(0, x - 63), x) : null;
        if (p) aTodos(p, 'tcp');
        hasta = bloqueos.get(m)?.hasta ?? hastaDonde(m);
        // (§99: si ya sé su pausa, la propuesta es vieja: no me quedo quieto por ella)
        if (!cortes.has(m) && !fuera && !pausaAbierta(m)) bloqueos.set(m, { hasta, desde: ahora() });
      }
      const r = empaca(6, m, 0, 4); r[2] = c; new DataView(r.buffer).setInt32(8, hasta);
      enviar(de, r, 'tcp');
    } else if (tipo === 6 && actual && b.length >= 12) {
      propuestas.get(m)?.de.set(de, d.getInt32(8));
      revisarPropuestas();
      revisar();
    } else if (tipo === 4 && b.length >= 16 && actual) {
      let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
      const ps = b.length >= 20 ? Array.from({ length: (b.length - 16) >> 2 }, (_, k) => d.getUint32(16 + 4 * k)) : null;   // (R5)
      e.de.set(de, [d.getUint32(8), d.getUint32(12), ps]);
      revisarHuella(cuadro);
    } else if (tipo === 10 && b.length >= 9 + 5 * MANDOS && actual) {
      const inf = { t: ahora(), hol: [], esp: [], max: [], racha: [], ven: [], dud: !!(b[8] & 1), prisa: !!(b[8] & 2), atras: !!(b[8] & 4),
                    rtt: b.length > 9 + 5 * MANDOS && b[9 + 5 * MANDOS] !== 255 ? b[9 + 5 * MANDOS] * 2 : null,
                    // (§179, R7: una página vieja no los trae: null = no se sabe)
                    margen: b.length > 12 + 5 * MANDOS && b[10 + 5 * MANDOS] !== 255 ? b[10 + 5 * MANDOS] : null,
                    subida: b.length > 12 + 5 * MANDOS && b[11 + 5 * MANDOS] !== 255 ? b[11 + 5 * MANDOS] * 100 : null,
                    telefono: b.length > 12 + 5 * MANDOS && (b[12 + 5 * MANDOS] & 2) ? !!(b[12 + 5 * MANDOS] & 1) : null };
      for (let p = 0; p < MANDOS; p++) {
        const o = 9 + 5 * p;
        inf.hol.push(d.getInt8(o)); inf.esp.push(b[o + 1] * 4); inf.max.push(b[o + 2] * 4); inf.racha.push(b[o + 3]); inf.ven.push(d.getInt8(o + 4));
      }
      // (§236: lo que ve del servidor, si lo trae; si no, «no sé»)
      { const o = 13 + 5 * MANDOS, hay = b.length >= o + 5;
        inf.hol.push(hay ? d.getInt8(o) : SIN_DATO); inf.esp.push(hay ? b[o + 1] * 4 : 0); inf.max.push(hay ? b[o + 2] * 4 : 0);
        inf.racha.push(hay ? b[o + 3] : NO_SE); inf.ven.push(hay ? d.getInt8(o + 4) : SIN_DATO); }
      informes.set(de, inf);
    } else if (tipo === 14 && de === duenoDe.get(m)) {
      // ese jugador se salió de la carrera (su copia se separó): se lo corta ya, como al que recargó. §99 (S2): solo si
      // lo dice él
      saltar(m, actual ? carrera : carrera + 1);
    }
  }

  // §73: la sala dice qué número de carrera viene (quien recargó la página a mitad de la copa entra en la siguiente con
  // el mismo número que los demás: los paquetes llevan ese número)
  // Si el juego está en medio de una carrera (la anterior), sus últimos cuadros van sin esperar (ver pad) y se suelta la
  // espera en curso: quien iba un cuadro atrás esperaría para siempre botones que ya nadie manda.
  let saliendo = null;
  const datosQuietos = new Int32Array(8 * MANDOS);
  const quietos = () => { const d = datosQuietos; for (const p of mandos) { if (p >= MANDOS) continue; d[p * 8] = 1; for (let k = 0; k < 7; k++) d[p * 8 + 1 + k] = NEUTRO[k]; } return d; };
  function fijarCarrera(k, fuera_ = null, autoridad = null) {
    if (!(k >= 1)) return;
    if (Array.isArray(fuera_)) planteles.set(k, new Set(fuera_.filter(m => mandos.includes(m))));
    // §99 (D): la primera autoridad que eligió la sala (la más estable de las carreras anteriores)
    if (Number.isInteger(autoridad) && mandos.includes(autoridad)) { preferidas.set(k, autoridad); if (k === carrera && ultimo < 0) preferida = autoridad; }
    if (ultimo >= 0 && k !== carrera) {               // el juego está en otra carrera (la anterior): a salir de ella
      saliendo = { ultimo }; ultimo = -1;
      if (espera) { const r = espera.resolver; espera = null; propuestas.clear(); bloqueos.clear(); r(); }
    }
    if (ultimo < 0 && k - 1 !== carrera) { carrera = k - 1; siguiente = null; }   // la próxima que empiece es la k
  }
  // §75: el humano del mando m avisa que se salta la carrera k (recargó la página con ella andando, o §80 su copia se
  // separó): si es la que corre esta consola, su decisor lo corta ya (sin el margen); si es la siguiente, queda anotado
  function saltar(m, k) {
    if (!mandos.includes(m) || m === miMando || !(k >= 1) || k < carrera) return;
    let s = saltos.get(k); if (!s) saltos.set(k, s = new Set());
    if (s.has(m)) return;
    s.add(m);
    registro(`[lockstep] el mando ${m} (${duenoDe.get(m)}) se salta la carrera ${k}`);
    if (k === carrera) revisar();
  }
  // §75: fn se llama al procesar el cuadro `cuadro` de la carrera k (el mismo en todas las consolas)
  const enCuadro = (k, cuadro, fn) => { if (typeof fn === 'function') acciones.set(`${k}:${cuadro}`, fn); };
  const esperando = () => {
    if (!espera || !espera.faltan?.length) return null;
    const ms = ahora() - espera.desde - congeladoEn(espera, ahora());
    return { uids: espera.faltan.map(m => duenoDe.get(m)), ms,
             // el margen de quien más se espera (§93: en la largada es más largo; largada = se trabó al largar)
             margen: Math.max(...espera.faltan.map(m => margenDe(m, espera.cuadro))), largada: enLargada(espera.cuadro),
             // los que nunca mandaron nada en esta carrera todavía vienen cargando (no es un corte)
             llegando: espera.faltan.every(m => tabla(m).size === 0) };
  };
  // §110: un piloto que llegó con la copa andando, a la lista (entre carreras: la página lo llama antes de fijarCarrera;
  // en las carreras que no corre va en `fuera`, así nadie lo espera). Su mando es su lugar en la lista de la sala
  function agregar(h) {
    if (!h || typeof h.uid !== 'string' || !Number.isInteger(h.mando) || h.mando < 0 || h.mando >= MANDOS) return false;
    if (mandoDe.has(h.uid) || duenoDe.has(h.mando)) return false;
    if (!humanos.some(x => x.uid === h.uid)) humanos.push(h);
    mandos.push(h.mando); duenoDe.set(h.mando, h.uid); mandoDe.set(h.uid, h.mando);
    registro(`[lockstep] §110: se suma ${h.uid} con el mando ${h.mando}`);
    return true;
  }
  // §274: la pausa de la sala (la auto calibración). congelar(true): esta consola deja de correr cuadros (la página
  // congela la lógica del juego); mientras dura, nadie se pausa ni se corta por eso y los pings lo avisan (bit 2).
  // congelar(false): todos los relojes de las esperas, las pausas, los cortes en camino y los tirones se corren lo que
  // duró (lo que pasó durante la pausa no cuenta para nada: la carrera sigue como si el tiempo no hubiera pasado).
  // congelarEn(cuadro, f): f(cuadro) al empezar el cuadro `cuadro` (o el siguiente que corra, si ya pasó)
  function congelar(si) {
    si = !!si;
    if (si === congelada) return;
    const t = ahora();
    congelada = si;
    // (un ping ya, y otro a los 100 ms por si se pierde: el que todavía no supo de la pausa no espera al ping de siempre
    // para saber que no tiene que pausar ni cortar a nadie)
    if (si) { congeladaDesde = t; est.congelamientos = (est.congelamientos || 0) + 1; registro(`[lockstep] §274 congelada en el cuadro ${ultimo}`);
      if (pingCada > 0) { unPing(); setTimeout(() => { if (congelada) unPing(); }, 100); } return; }
    const d = t - congeladaDesde;
    est.msCongelada = (est.msCongelada || 0) + d;
    if (pausaUltima >= 0) pausaUltima += d;
    if (espera) { espera.desde += d; espera.tic = t; espera.pedido += d; }
    for (const [k, v] of avanceDe) avanceDe.set(k, v + d);
    for (const [k, v] of oido) oido.set(k, Math.min(t, v + d));
    for (const ps of pausas.values()) for (const x of ps) if (x.vuelve === null) x.t += d;
    for (const p of propuestas.values()) p.desde += d;
    for (const b of bloqueos.values()) b.desde += d;
    if (mitadDesde !== null) mitadDesde += d;
    if (alDiaHasta > -Infinity) alDiaHasta += d;
    if (ven) ven.t0 += d;
    despierto = t;
    registro(`[lockstep] §274 sigue en el cuadro ${ultimo} (congelada ${Math.round(d)} ms)`);
    if (espera) revisar();
  }
  let alPrimero = null, primeroDe = 0;
  const alPrimerCuadro = f => { alPrimero = f; };   // (§285)
  const congelarEn = (cuadro, f) => { if (ultimo >= cuadro) { try { f(ultimo); } catch {} return; } congelarEnCuadro = { cuadro, f }; };
  return { pad, alBinario, fijarCarrera, saltar, enCuadro, agregar, congelar, congelarEn, alPrimerCuadro,
    get congelada() { return congelada; },
    estado: () => ({ ...est, largadas: (est.largadas || []).map(x => ({ ...x })), esperaDe: { ...est.esperaDe }, estable: { ...est.estable }, delantes: Object.fromEntries(delanteDe),
      quieto: Object.fromEntries([...quieto].map(([m, q]) => [m, q.max])),
      // §99 (C1): si estoy pausado (mi kart va solo hasta que vuelva) y las pausas de esta carrera
      pausado: !!pausaAbierta(miMando) && ultimo >= (pausaAbierta(miMando)?.desde ?? Infinity), pausasAhora: [...pausas].filter(([, ps]) => ps.some(x => x.vuelve === null)).map(([m]) => duenoDe.get(m)), retrasos: { ...est.retrasos }, retrasoMax: { ...est.retrasoMax },
      relevadosAhora: [...est.relevadosAhora], carrera, cuadro: ultimo, miMando, retraso: miRetraso, cortes: Object.fromEntries(cortes),
      esperando: esperando(), fuera: !!fuera, cortado: cortes.has(miMando) && ultimo >= cortes.get(miMando), yoRelevado: yoRelevado(),
      // §99 (H8): hace cuánto no llega nada de ninguno de los que siguen (si es más de SORDO_MS, el cortado soy yo)
      sordoMs: (() => { const otros = humanos.filter(h => h.uid !== yo && !cortes.has(h.mando)); if (!otros.length) return 0;
        const t = ahora(); return Math.min(...otros.map(h => t - (oido.get(h.uid) ?? t))); })(), sordo: SORDO_MS,
      sincroTiempo, deuda, retrasoMedio: est.cuadrosCarrera ? est.sumaRetraso / est.cuadrosCarrera : miRetraso,
      // §101: los que según su último informe van atrás (o se están poniendo al día)
      atrasados: (() => { const t = ahora(); return [...informes].filter(([u, i]) => u !== yo && i.atras && t - i.t <= 1.5 * informeCada).map(([u]) => u); })(),
      congelada, congeladosOtros: [...congeladoDe.keys()].filter(sigueCongelado),   // (§274)
      rtt: Object.fromEntries([...rtt].map(([u, x]) => [u, Math.round(x.s)])) }),
    detener() { if (latido) clearInterval(latido); if (vigilancia) clearInterval(vigilancia); } };
}

// La huella de la carrera para comparar entre consolas: el avance (raceCompletion, Raceinfo → jugador +0xC) de los
// 12 karts, mezclado. L = el lector de memoria de menus.mjs.
export function huellaCarrera(L) {
  const ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
  let h = 2166136261;
  for (let i = 0; i < 12; i++) h = Math.imul(h ^ L.u32(L.u32(lista + 4 * i) + 0xC), 16777619);
  return h >>> 0;
}

// R5 (§154): la huella AMPLIADA. h = la de siempre (decide); partes = una huella por cada uno de los 12 RaceinfoPlayer
// (sus 0x54 bytes: avance, puesto, vuelta, puntos de control, tiempos) y una del azar de la carrera (los dos Random de
// Raceinfo +4/+8: su estado +8/+0xC, el mismo que compara ?rastro=1); valores = lo mío de cada parte (el volcado, si
// difiere). Lo que va adentro es lo que el rastro de §70 ya probó igual en todas las consolas.
export function huellaAmpliada(L) {
  const ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC);
  const partes = [], nombres = [], valores = {};
  for (let i = 0; i < 12; i++) {
    const pl = L.u32(lista + 4 * i);
    let h = 2166136261;
    const pal = [];
    // (las palabras que son direcciones de la Wii —0x80000000 a 0x93FFFFFF: punteros a objetos del montón— no
    // entran: cada consola puede tener sus objetos en otro lugar; medido en la sala: 0x903c73f4 en una, otro en la otra)
    for (let o = 0; o < 0x54; o += 4) { const v = L.u32(pl + o); pal.push(v); if (v >= 0x80000000 && v < 0x94000000) continue; h = Math.imul(h ^ v, 16777619); }
    partes.push(h >>> 0); nombres.push('kart' + i); valores['kart' + i] = pal.map(v => v.toString(16)).join(' ');
  }
  const az = [];
  for (const r of [L.u32(ri + 4), L.u32(ri + 8)]) az.push(r ? L.u32(r + 8) : 0, r ? L.u32(r + 12) : 0);
  // §269b: solo el azar 1 entra a la huella (el volcado lleva los dos). En la carrera, al azar 2 (Raceinfo +8) lo mueve
  // SOLO la animación de los pilotos (0x807C6A44 y 0x807CB530, medido en el Oppo con el programa de depuración,
  // depurar_lockstep.cpp; ya lo vio §62.5), que avanza con el DIBUJO: una consola que se salta dibujos (el teléfono con
  // N8 o la compensación de lag) saca los mismos números en el mismo orden pero en otros cuadros. Lo demás que lo usa
  // corre en el cuadro 0, al armar la carrera, después de sembrarlo de nuevo: igual en todas. No es de la lógica.
  // (Darle a la animación su propio azar se probó: en la sala de dos, la pestaña A se ponía lentísima, hasta 15 s por
  // cuadro, en la largada y en la meta; se descartó.)
  let h = 2166136261;
  for (const v of az.slice(0, 2)) h = Math.imul(h ^ v, 16777619);
  partes.push(h >>> 0); nombres.push('azar'); valores.azar = az.map(v => v.toString(16)).join(' ');
  return { h: huellaCarrera(L), partes, nombres, valores };
}

// El plantel de la carrera: los humanos en los primeros puestos (cada uno con su mando: el orden de la sala) y CPU
// en el resto, todos con personaje y vehículo. Los de los CPU salen de la semilla (los mismos en todas las consolas).
// Cada personaje tiene su peso (0 liviano, 1 mediano, 2 pesado) y el vehículo tiene que ser de ese peso: los
// vehículos van liviano/mediano/pesado alternados (id % 3).
export const PESO = [1, 0, 2, 2, 0, 0, 0, 1, 0, 2, 1, 2, 0, 0, 0, 1, 1, 1, 1, 2, 1, 2, 2, 2];   // personajes 0..23
export function armarPlantel({ humanos, semilla }) {
  let x = (semilla >>> 0) || 1;
  const azar = n => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
  const usados = new Set();
  const plantel = [];
  humanos.forEach((h, i) => {
    const pj = Number.isInteger(h.personaje) && h.personaje >= 0 && h.personaje < 24 ? h.personaje : [0, 7, 16, 10][i % 4];
    let veh = Number.isInteger(h.vehiculo) && h.vehiculo >= 0 && h.vehiculo < 36 ? h.vehiculo : PESO[pj] + 0;
    if (veh % 3 !== PESO[pj]) veh = PESO[pj];                                   // el kart estándar de su peso
    usados.add(pj);
    plantel.push([veh, pj, 1, h.mando]);
  });
  while (plantel.length < 12) {
    let pj; do pj = azar(24); while (usados.has(pj) && usados.size < 24);
    usados.add(pj);
    plantel.push([PESO[pj] + 3 * azar(12), pj, 1, -1]);
  }
  return plantel;
}

// El aviso de "la sala va lenta" (§70, C5). En la carrera sincronizada nadie avanza sin los botones de todos: si una PC
// no alcanza 60 cuadros por segundo (o su conexión se atrasa), la sala espera (desde §80 solo hasta que la autoridad
// lo releva). Cada 3 s la página compara dos fotos de estado() (antes y ahora) y, si hace falta, avisa:
//   - si yo espero más de 4 ms por cuadro y la carrera va a menos de 55 cuadros/s: a quién espero (el jugador N de la
//     sala, en el orden de la sala), porque su PC o su conexión no dan abasto;
//   - si yo casi no espero (< 1 ms) pero igual voy a menos de 50: la lenta es MI PC (los demás me esperan a mí).
// Devuelve el texto del aviso, o '' si todo va bien (o si no hay carrera: menos de 30 cuadros en el rato).
// §269 (el dueño: «me dice que mi PC no alcanza 60 cuando en el Single Player claramente lo hace»): «tu PC» solo si el
// hilo del juego de esta página de verdad estuvo ocupado (ocupado = fracción del rato que trabajó, la mide el medidor de
// mkw.mjs sin lo que esperó a la sala; null = no se sabe, como antes) y la espera cuenta también la llegada de los demás
// y los frenos de la sincronía (§80b): ninguna de las dos es lentitud de esta PC. ?esperaSala=0 = como antes
export const OCUPADO_LENTO = 0.8;
export function avisoLento(antes, ahora, ms, humanos, ocupado = null, comoAntes = false) {
  const cuadros = (ahora?.cuadros ?? 0) - (antes?.cuadros ?? 0);
  if (!antes || cuadros < 30 || ms <= 0) return '';
  const otra = x => comoAntes ? 0 : (ahora[x] || 0) - (antes[x] || 0);
  const fps = cuadros / (ms / 1000), espera = (ahora.msEsperando - antes.msEsperando) / cuadros,
        esperaTodo = espera + (otra('msLlegada') + otra('msFrenado')) / cuadros;
  if (espera > 4 && fps < 55) {
    let peor = null, mas = 0;
    for (const [u, t] of Object.entries(ahora.esperaDe || {})) {
      const d = t - (antes.esperaDe?.[u] || 0);
      if (d > mas) { mas = d; peor = u; }
    }
    const n = humanos.findIndex(h => h.uid === peor) + 1;
    return `La carrera va a ${Math.round(fps)} cuadros por segundo: espera ${n ? `al jugador ${n} de la sala` : 'a otro jugador'} (su PC o su conexión no dan abasto)`;
  }
  if (esperaTodo < 1 && fps < 50 && (comoAntes || ocupado === null || ocupado >= OCUPADO_LENTO))
    return `Tu PC no alcanza 60 cuadros por segundo (va a ${Math.round(fps)}): la sala va a tu ritmo`;
  return '';
}
// Lo que usa la página: una foto de estado() cada 3 s y el aviso solo si DOS ratos seguidos (6 s) salieron mal. Un
// tirón suelto (bajar la pista con la caché vacía al empezar la carrera: medio segundo congelado y un par de segundos a
// 25-30 cuadros) no es una PC lenta y no se avisa. Como el retardo de un relé térmico: no salta con el pico del arranque.
export function vigiaLento(humanos, seguidas = 2, comoAntes = false) {
  let foto = null, cuando = 0, malas = 0;
  return (ahora, t, ocupado = null) => {
    const texto = avisoLento(foto, ahora, t - cuando, humanos, ocupado, comoAntes);
    foto = ahora; cuando = t;
    malas = texto ? malas + 1 : 0;
    return malas >= seguidas ? texto : '';
  };
}
