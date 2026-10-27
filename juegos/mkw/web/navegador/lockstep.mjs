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
export const RETRASO_MAX = 12;             // 200 ms: más ya no se maneja (y solo lo sufre quien tiene esa conexión)
const PING_CADA = 500, MARGEN_MS = 6, MUESTRAS = 3, VENTANA = 16, TIRON_MS = 100, REVISAR_MS = 40;
const REPITE = 16, CADA_HUELLA = 120, ESPERA_PIDE = 7, ESPERA_CORTE = 4000, ESPERA_INICIO = 45000;
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
// §99 (S1): lo que manda un tercero de los botones de otro solo vale si lo pedí hace poco, si hay un corte en curso de
// ese mando, o si su dueño se calló hace más de CALLADO_MS (ahí otro reparte lo que tenía de él)
const PEDIDO_VALE = 2000, CALLADO_MS = 300;
// §80b, la sincronía de tiempo (prendida; ?sincroTiempo=0 la apaga): me freno si voy más de UMBRAL_SINCRO cuadros por delante de alguien
// que va suelto; a lo más DEUDA_MAX cuadros por rato, uno cada CADA_FRENO cuadros (como mucho un 12 % más lento un
// momento); al que va más de TOPE_SINCRO cuadros atrás no se lo espera (eso es del relevo)
const UMBRAL_SINCRO = 1, TOPE_SINCRO = 20, CADA_FRENO = 8, DEUDA_MAX = 4;
const ENVEJECE = 6, APAGA = 30;            // el botón inventado: el último por 6 cuadros; después el volante se suelta en 30
const SIN_DATO = 127, NO_SE = 255;
// §101: las esperas de más de esto (ms) se anotan con lo que faltaba (?esperasLog=N para depurar; por omisión 500)
const ESPERAS_LOG = Number(new URLSearchParams(globalThis.location?.search || '').get('esperasLog')) || 500;
// §91: hasta 12 humanos (Mario Kart en línea): los mandos de la sala van de 0 a 11 (pad_web.cpp: 0-3 con puerto, el resto virtuales)
export const MANDOS = 12;
const TODOS = Array.from({ length: MANDOS }, (_, m) => m);
const fila = v => Array(MANDOS).fill(v);
const NEUTRO = [0, 0, 0, 0, 0, 0, 0];
const START = 0x1000;                      // pausa: en la carrera de la sala no se pausa (pausaría solo una consola)
const BOTON_A = 0x0100;                    // acelerar (el botón inventado lo mantiene si estaba)

export function crearLockstep({ yo, humanos, enviar, local, huella = null, retraso: retrasoBase = RETRASO, registro = () => {},
  ahora = () => performance.now(), esperaCorte = ESPERA_CORTE, esperaInicio = ESPERA_INICIO,
  // §93: el margen de la largada (por omisión el mismo de siempre: lo agranda la página) y cuántos cuadros dura
  esperaLargada = esperaCorte, cuadrosLargada = LARGADA,
  // ?retraso=fijo en la dirección de la página = el camino viejo (siempre 3, sin ajustar), para comparar
  adaptar = !/[?&]retraso=fijo\b/.test(globalThis.location?.search || ''), retrasoMax = RETRASO_MAX, pingCada = PING_CADA,
  // ?relevo=0 = sin relevo (todos esperan a todos, como antes de §80), para comparar
  relevo = !/[?&]relevo=0\b/.test(globalThis.location?.search || ''),
  // §80b: la sincronía de tiempo (el dueño la prendió, 2026-10-20; ?sincroTiempo=0 = sin ella, como en §80): el que va
  // adelantado se frena un poco para que el que se trabó no quede atrás y su retraso no se vaya subiendo
  sincroTiempo = !/[?&]sincroTiempo=0\b/.test(globalThis.location?.search || ''),
  // §99 (C3): ms => … le pide al runtime que corra seguidos esos ms de cuadros (ponerse al día; null = no se puede)
  prisa = null,
  // §99 (C4): () => true mientras corre la cuenta regresiva (la página lo lee del juego; sin ella, no hay regla de la
  // cuenta: el banco y las pruebas de siempre)
  enCuenta = null,
  // §99 (C1), el relevo rápido: al que se calla se lo PAUSA a los PAUSA_MS (no se lo corta a los 2 s); ?relevoRapido=0
  // = como antes
  relevoRapido = !/[?&]relevoRapido=0\b/.test(globalThis.location?.search || ''), pausaACorte = PAUSA_A_CORTE,
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
  cuadroMs = 1000 / 60, informeCada = INFORME_CADA }) {
  const rtt = new Map();                  // uid → { s: ida y vuelta suavizada (ms, para mostrar), m: las últimas VENTANA medidas,
                                          //         n: los números de ping que contestó }
  let pings = 0;                          // número del último ping (va en el campo "cuadro": la respuesta lo devuelve)
  const oido = new Map();                 // uid → la última vez que llegó algo de él (para saber quién está)
  const miMando = humanos.find(h => h.uid === yo)?.mando ?? -1;
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
  const est = { cuadros: 0, esperas: 0, msEsperando: 0, maxEspera: 0, msLlegada: 0, desincronizado: null, huellasIguales: 0, cortes: [],
    retrasos: {}, retrasoMax: {}, conflictos: 0, esperaDe: {}, relevos: 0, inventados: 0, inventadosViejos: 0, traspasos: 0, salidas: 0,
    hashBotones: 2166136261, relevadosAhora: [], autoridad: null, subidas: 0, bajadas: 0, frenos: 0, msFrenado: 0, adelanto: 0,
    estable: { malas: 0, atras: 0, rtt: null }, prisas: 0, prisaCuadros: 0, pausas: [], vueltas: 0 };

  const tabla = m => { let t = tablas.get(m); if (!t) tablas.set(m, t = new Map()); return t; };
  const reg = m => { let r = regs.get(m); if (!r) regs.set(m, r = new Map()); return r; };
  const cortadoEn = (m, c) => cortes.has(m) && c >= cortes.get(m);
  const vivos = () => humanos.filter(h => !cortes.has(h.mando));
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

  function empaca(tipo, mando, cuadro, extra = 0) {
    const b = new Uint8Array(8 + extra);
    b[0] = MARCA; b[1] = tipo; b[2] = carrera & 255; b[3] = mando;
    new DataView(b.buffer).setUint32(4, cuadro >>> 0);
    return b;
  }
  const escribe8 = (d, o, v) => { d.setUint16(o, v[0] & 0xFFFF); for (let k = 1; k < 5; k++) d.setInt8(o + 1 + k, v[k]); d.setUint8(o + 6, v[5]); d.setUint8(o + 7, v[6]); };
  const lee8 = (d, o) => [d.getUint16(o), d.getInt8(o + 2), d.getInt8(o + 3), d.getInt8(o + 4), d.getInt8(o + 5), d.getUint8(o + 6), d.getUint8(o + 7)];
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
  function paqueteA(uid, m, hasta) {
    const t = tabla(m), r = reg(m);
    const desde = Math.min(hasta, Math.max(hasta - REPITE + 1, (ackDe.get(uid) ?? -1) + 1, 0));
    const lista = [];
    for (let c = desde; c <= hasta; c++) { const v = t.get(c); if (!v) { if (lista.length) break; continue; } lista.push([v, r.get(c), c]); }
    if (!lista.length) return null;
    const conReg = lista.some(([, x]) => x);
    const largo = lista.reduce((suma, [, x]) => suma + 8 + (conReg ? 5 + (x ? 8 * bits(x.masc).length : 0) : 0), 0);
    const b = empaca(15, m, lista[0][2], 8 + largo), d = new DataView(b.buffer);
    b[8] = lista.length;
    b[9] = m === miMando && lista.at(-1)[2] === escrito && ultimo >= 0 ? Math.min(254, Math.max(0, escrito - ultimo)) : 0xFF;
    const suyo = mandoDe.get(uid);
    // (§99, C1: bit 1 = hay una pausa (o su propuesta) para ti en camino: quédate quieto hasta saberla)
    b[10] = (conReg ? 1 : 0) | (suyo !== undefined && (propuestas.has(suyo) || bloqueos.has(suyo) || pausaAbierta(suyo)) ? 2 : 0);
    d.setUint32(12, suyo === undefined ? 0xFFFFFFFF : (contiguoDe(suyo) >>> 0));
    let o = 16;
    for (const [v, x] of lista) {
      escribe8(d, o, v); o += 8;
      if (conReg) {
        d.setUint16(o, x?.masc ?? 0); d.setUint16(o + 2, x?.sust ?? 0); b[o + 4] = x?.sig ?? 0xFF; o += 5;
        if (x) for (const k of bits(x.masc)) { escribe8(d, o, x.slots[k]); o += 8; }
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
  const latido = pingCada > 0 ? setInterval(() => {
    const b = empaca(7, miMando & 255, ++pings, 8);
    new DataView(b.buffer).setFloat64(8, ahora());
    aTodos(b, 'udp');
  }, pingCada) : null;

  function ventanaNueva() { ven = { hol: fila(SIN_DATO), esp: fila(0), max: fila(0), ven: fila(SIN_DATO), dud: false, t0: ahora(), c0: est.cuadros, p0: msParado }; }
  ventanaNueva();

  function nuevaCarrera() {
    carrera++; ultimo = -1; escrito = -1; espera = null; huellas.clear(); propuestas.clear(); bloqueos.clear();
    cadena = []; relevados.clear(); pasarA = null; traspaso = null; fuera = null; buenas = 0; sustituidosMios = 0;
    ultimaSubida = -Infinity; malasAutoridad.length = 0; rachas.fill(0); informes.clear(); nuevo.clear(); ventanaNueva();
    ackDe.clear(); contiguo.clear(); pedidosA.clear(); pausaUltima = -1; mitadDesde = null; largado = false;
    alcance = { ratos: 0, ganado: 0, corriendo: 0 };
    deuda = 0; ultimoFreno = -Infinity; ventajas.fill(SIN_DATO); est.sumaRetraso = 0; est.cuadrosCarrera = 0;
    estab.clear(); delanteDe.clear(); est.estable = { malas: 0, atras: 0, rtt: null }; quieto.clear();
    pausas.clear(); ultimoUsado.clear(); pidoVuelta = 0; est.pausas = []; est.vueltas = 0; preferida = preferidas.get(carrera);
    for (const k of [...preferidas.keys()]) if (k < carrera) preferidas.delete(k);
    est.relevadosAhora = []; est.hashBotones = 2166136261;
    tablas = siguiente?.carrera === carrera ? siguiente.tablas : new Map();
    regs = siguiente?.carrera === carrera ? siguiente.regs : new Map();
    cortes = siguiente?.carrera === carrera ? siguiente.cortes : new Map();
    for (const [m, t] of tablas) for (const f of t.keys()) if (f > (nuevo.get(m) ?? -1)) nuevo.set(m, f);
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
  // ¿quién va a ser la autoridad en el cuadro f (que todavía no se corre)? Si falta un paquete en el medio, no se sabe
  // (−1): entonces no escribo relevos en ese cuadro (todos ven lo mismo: nada). Sirve para saber si los escribo yo.
  const autoridadPrevista = f => recorrer(Math.max(0, ultimo), f).a;
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
    const v = t.get(u);
    if (!v) return NEUTRO;
    const edad = f - u;
    if (edad <= ENVEJECE) return v;
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
  function registroPara(f) {
    let masc = 0, sust = 0, sig = 0xFF;
    const slots = fila(null);
    for (const m of relevados.keys()) {
      if (m === miMando || cortadoEn(m, f)) continue;
      masc |= 1 << m;
      const real = tabla(m).get(f);
      if (real) slots[m] = real;
      else { slots[m] = inventado(m, f); sust |= 1 << m; est.inventados++; }
    }
    if (pasarA !== null && !traspaso) {
      sig = pasarA; traspaso = { cuadro: f, a: pasarA }; pasarA = null; est.traspasos++;
      registro(`[lockstep] paso la autoridad a ${duenoDe.get(sig)} desde el cuadro ${f + 1} (me esperaban a mí)`);
    }
    return masc || sig !== 0xFF ? { masc, sust, sig, slots } : null;
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
      if (!inf || t - inf.t > 1.5 * informeCada) continue;
      const mia = ventajas[m], suya = inf.ven?.[miMando];
      if (mia === SIN_DATO || suya === undefined || suya === SIN_DATO) continue;
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
  function atrasDeLaMitad() {
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
  let ultimaPrisa = -Infinity, largado = false;
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
        est.estable.malas += mal; est.estable.atras += yoRelevado() || (ds.length && 2 * atras > ds.length) ? 1 : 0;
        est.estable.rtt = miRtt();
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
      (v.minHol === SIN_DATO ? 0 : Math.min(v.minHol, 50));
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
  function votos(m, ignorar = null) {
    const u = duenoDe.get(m), t = ahora(), v = { con: 0, rachas: [], quien: [], peorHol: SIN_DATO, maxEsp: 0, holgados: 0, justos: 0, minHol: SIN_DATO, nuevo: false };
    for (const [de, inf] of informes) {
      if (de === u || ignorar?.has(de) || t - inf.t > 1.5 * informeCada || inf.racha[m] === NO_SE) continue;
      v.con++; v.rachas.push(inf.racha[m]); v.quien.push(`${de} ${inf.racha[m]}${inf.dud ? '?' : ''} (holgura ${inf.hol[m]}, esperó ${inf.esp[m]} ms)`);
      const justo = !inf.dud && inf.hol[m] !== SIN_DATO && inf.hol[m] < 1;
      if (justo) v.justos++;
      if (inf.racha[m] > 0 || justo) {
        if (inf.hol[m] !== SIN_DATO) v.peorHol = Math.min(v.peorHol, inf.hol[m]);
        v.maxEsp = Math.max(v.maxEsp, inf.max[m]);
        if (inf.t > ultimaSubida) v.nuevo = true;
      } else if (!inf.dud && inf.hol[m] !== SIN_DATO && inf.hol[m] >= 3) v.holgados++;
      if (!inf.dud && inf.hol[m] !== SIN_DATO) v.minHol = Math.min(v.minHol, inf.hol[m]);
    }
    v.culpa = k => v.con > 0 && 2 * v.rachas.filter(x => x >= k).length > v.con;    // la mayoría lo vio mal k ratos seguidos
    v.justo = v.con > 0 && 2 * v.justos > v.con;                                       // a la mayoría le llegan justos
    return v;
  }
  function informar() {
    const t = ahora();
    if (ultimo >= 0 && !fuera) {
      const corridos = est.cuadros - ven.c0, debia = (t - ven.t0) / cuadroMs;
      if (corridos > 1.3 * debia + 2) ven.dud = true;          // me estaba poniendo al día
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
      // §102: ¿me pongo al día de verdad? En los ratos seguidos que voy atrás, lo que corrí de más que el tiempo en que
      // corrí (sin lo que estuve parado: esperas, frenos, tirones). Si a los RATOS_PRUEBA no gané GANA_MIN, no digo «sé
      // ponerme al día»: los demás me esperan (si no, me quedaba cada vez más atrás y subía mi retraso hasta 12)
      const corriendo = Math.max(0, t - ven.t0 - (msParado - ven.p0)) / cuadroMs;
      if (atrasado) { alcance.ratos++; alcance.ganado += corridos - corriendo; alcance.corriendo += corriendo; }
      else alcance = { ratos: 0, ganado: 0, corriendo: 0 };
      const alcanzo = !alcanceReal || alcance.ratos < RATOS_PRUEBA || alcance.ganado >= GANA_MIN * alcance.corriendo;
      if (!alcanzo) {
        est.sinAlcance = (est.sinAlcance || 0) + 1;
        if (!alcance.avisado) { alcance.avisado = true; registro(`[lockstep] voy atrás y no alcanzo a ponerme al día (gané ${alcance.ganado.toFixed(1)} cuadros en ${alcance.corriendo.toFixed(0)}): que me esperen`); }
      }
      // (§99, D: y al final mi ida y vuelta típica, de a 2 ms; 255 = no sé)
      const yoRtt = miRtt(), puedo = puedoPrisa() && alcanzo;
      const b = empaca(10, miMando & 255, ++numInforme, 2 + 5 * MANDOS),
        inf = { t, hol: [], esp: [], max: [], racha: [], ven: [], dud: ven.dud, prisa: puedo, atras: atrasado, rtt: yoRtt };
      b[9 + 5 * MANDOS] = yoRtt === null ? 255 : Math.min(254, Math.round(yoRtt / 2));
      // las banderas: 1 = rato dudoso; 2 = sé ponerme al día solo (§101; y me sale, §102); 4 = voy atrás / me estoy poniendo al día
      b[8] = (ven.dud ? 1 : 0) | (puedo ? 2 : 0) | (atrasado ? 4 : 0);
      for (let p = 0; p < MANDOS; p++) {
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
        const o = 9 + 5 * p;
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
  // §80b: ¿cuánto voy adelante de cada uno? Yo mido mi cuadro menos el suyo al mandar: lo que voy adelante MÁS lo que
  // tardó en llegar. Él mide lo mismo de mí: lo que va adelante (= menos lo mío) más lo que tarda en llegar lo mío. La
  // mitad de la diferencia de las dos medidas es lo que voy adelante: lo de la red se cancela (si tarda lo mismo en los
  // dos sentidos). Como medir el desfase entre dos relojes con un pulso de ida y otro de vuelta.
  // Solo me freno por uno que va SUELTO (en su rato no esperó a nadie): si se quedó atrás porque espera lo mío (su
  // conexión trae tarde lo de todos), frenarme no lo acerca —él se atrasa conmigo— y la sala iría más lenta para
  // siempre. Y no por uno relevado, cortado, ni muy atrás (TOPE_SINCRO): eso es cosa del relevo.
  function calcularDeuda() {
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
    const sust = sustituidosMios; sustituidosMios = 0;
    if (!adaptar || ultimo < 0 || fuera || cortes.has(miMando)) return;
    const v = vista(miMando), antes = miRetraso;
    if (((v.culpa(1) || v.justo) && v.nuevo && !heredado(miMando)) || sust) {
      const falta = !v.culpa(2) && !sust ? 1 :
        Math.max(1, v.peorHol < 1 ? 1 - v.peorHol : 0, v.maxEsp ? Math.ceil(v.maxEsp / cuadroMs) + 1 : 0, sust ? 2 : 0);
      miRetraso = Math.min(retrasoMax, miRetraso + Math.min(4, falta));
      buenas = 0; ultimaSubida = ahora();
      if (miRetraso !== antes) { est.subidas++; registro(`[lockstep] subo mi retraso a ${miRetraso} (holgura ${v.peorHol === SIN_DATO ? '—' : v.peorHol}, espera más larga ${v.maxEsp} ms, inventados ${sust})`); }
    } else if (v.con && 2 * v.holgados > v.con && !yoRelevado()) {
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
    for (const h of humanos) {
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
    malasAutoridad.push(vista(miMando).culpa(1) && !heredado(miMando) ? 1 : 0);
    if (malasAutoridad.length > VENTANA_AUTORIDAD) malasAutoridad.shift();
    if (pasarA !== null || traspaso || malasAutoridad.reduce((a, b) => a + b, 0) < MALAS_AUTORIDAD) return;
    // §99 (D): a quien mejor manda Y recibe, y solo si es mejor que yo (si no, el papel quedaba en uno que recibe todo
    // tarde: inventaba los botones de los sanos y los obligaba a subir su retraso; medido en prueba-relevo)
    // (con PASO_MINIMO de ventaja: si no, con dos casi iguales el papel iba y volvía)
    let mejor = null, puntos = puntaje(miMando) + PASO_MINIMO;
    for (const h of humanos) {
      const m = h.mando;
      if (m === miMando || cortes.has(m) || relevados.has(m) || !tabla(m).size || peorRed(m)) continue;
      const p = puntaje(m);
      if (p > puntos) { puntos = p; mejor = m; }
    }
    if (mejor !== null) pasarA = mejor;
    else malasAutoridad.length = 0;          // (nadie mejor: se vuelve a contar desde cero)
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
    if (deuda > 0 && est.cuadros - ultimoFreno >= CADA_FRENO && !globalThis.document?.hidden) {
      deuda--; ultimoFreno = est.cuadros; est.frenos++;
      const t0 = ahora();
      await new Promise(listo => setTimeout(listo, cuadroMs));
      { const d = ahora() - t0; est.msFrenado += d; msParado += d; }
      if (fuera) { ultimo = cuadro; return quietos(); }
    }
    ultimo = cuadro;
    est.cuadros++; est.cuadrosCarrera++; est.sumaRetraso += miRetraso;
    { const t = ahora(); if (pausaUltima >= 0 && t - pausaUltima > TIRON_MS) { est.tirones = (est.tirones || 0) + 1; msParado += t - pausaUltima - cuadroMs; tironPropio(t - pausaUltima); } pausaUltima = t; }
    // lo mío: el estado de ahora vale para cuadro + mi retraso (y para los cuadros intermedios si el retraso subió;
    // si bajó, no escribo nada hasta alcanzar lo ya escrito). Al empezar la carrera, los primeros (hasta mi retraso)
    // van neutros, escritos: nadie tiene que saber mi retraso
    if (miMando >= 0 && !cortes.has(miMando)) {
      const v = (local() || NEUTRO).slice(0, 7); v[0] &= ~START;
      // (§99, C4: en la cuenta regresiva, al menos RETRASO_CUENTA; al «¡YA!» cada uno baja al suyo: lo ya escrito no
      // se toca)
      const cuenta = !!enCuenta?.();
      const hasta = cuadro + (cuenta ? Math.max(miRetraso, RETRASO_CUENTA) : miRetraso), primero = escrito < 0;
      for (let f = Math.max(escrito + 1, primero ? 0 : cuadro); f <= hasta; f++) {
        const t = tabla(miMando);
        if (!t.has(f)) { t.set(f, primero && f < hasta ? NEUTRO : v); if (f > ultimoDe(miMando)) nuevo.set(miMando, f); }
        const x = autoridadPrevista(f) === miMando ? registroPara(f) : null;
        if (x) reg(miMando).set(f, x);
        escrito = f;
      }
      for (const h of humanos) if (h.uid !== yo) { const p = paqueteA(h.uid, miMando, escrito); if (p) enviar(h.uid, p, 'udp'); }
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
    const datos = new Int32Array(8 * MANDOS);
    for (const p of mandos) {
      const x = r.vals[p];
      datos[p * 8] = x.con;
      for (let k = 0; k < 7; k++) datos[p * 8 + 1 + k] = x.v[k];
    }
    // §99 (C1): lo que se usó para cada uno (la base de una pausa que empieza en el cuadro siguiente)
    for (const p of mandos) {
      const v = Array.from(datos.subarray(p * 8 + 1, p * 8 + 8));
      ultimoUsado.set(p, { f: cuadro, v });
      for (const x of pausas.get(p) || []) if (!x.base && x.desde - 1 === cuadro) x.base = v;
    }
    if (cuadro < QUIETO_HASTA) humanos.forEach((h, i) => {
      const p = h.mando, q = quieto.get(p) || { racha: 0, max: 0 };
      let nada = datos[p * 8] === 1;
      for (let k = 1; k < 8 && nada; k++) if (datos[p * 8 + k] !== 0) nada = false;
      // (§100: el que ya llegó no está ausente aunque no toque nada: antes, quien llegaba antes del minuto —en una pista
      // corta, o por código en prueba-sala— juntaba 30 s «quieto» esperando a los demás y perdía como cortado)
      if (nada && llego?.(i, p)) nada = false;     // (§110: con el mando: el puesto en la carrera lo sabe la página)
      q.racha = nada ? q.racha + 1 : 0; q.max = Math.max(q.max, q.racha); quieto.set(p, q);
    });
    // lo que dejó la autoridad de este cuadro: quiénes iban relevados (para avisar), si inventó los míos y si pasa el papel
    const a = r.autoridad, xa = a !== undefined ? reg(a).get(cuadro) : null;
    est.autoridad = a !== undefined ? duenoDe.get(a) : null;
    est.relevadosAhora = xa ? bits(xa.masc).map(m => duenoDe.get(m)) : [];
    if (xa && (xa.sust >> miMando) & 1) sustituidosMios++;
    if (xa && xa.sig < MANDOS && !cadena.some(([d]) => d === cuadro + 1)) cadena.push([cuadro + 1, xa.sig]);
    for (let i = 0; i < datos.length; i++) est.hashBotones = Math.imul(est.hashBotones ^ datos[i], 16777619) >>> 0;
    if (huella && cuadro % CADA_HUELLA === 0 && cuadro > 0) compararHuella(cuadro, huella());
    // §75: lo que hay que hacer en este cuadro (en todas las consolas en el mismo: por ejemplo terminar la carrera)
    const accion = acciones.get(`${carrera}:${cuadro}`);
    if (accion) { acciones.delete(`${carrera}:${cuadro}`); try { accion(); } catch (e) { registro(`[lockstep] acción del cuadro ${cuadro}: ${e?.message || e}`); } }
    return datos;
  }

  // Los botones de cada mando para el cuadro c, o quiénes faltan (mandos; −1 = estoy quieto por un corte en curso).
  // Para cada uno: cortado → neutro y "se fue"; relevado por la autoridad de ese cuadro → lo que dice ella; si no,
  // el suyo. Antes que nada hace falta el paquete de la autoridad de ese cuadro (dice quiénes van relevados).
  function resolver(c) {
    const faltan = new Set(), vals = [];
    for (const [, b] of bloqueos) if (c > b.hasta) faltan.add(-1);
    const a = autoridadEn(c), xa = a !== undefined && tabla(a).has(c) ? (reg(a).get(c) || null) : undefined;
    for (const m of mandos) {
      if (cortadoEn(m, c)) { vals[m] = { v: NEUTRO, con: 2 }; continue; }
      if (pausadoEn(m, c)) {                                    // §99 (C1): pausado: el botón calculado, igual en todas
        const x = pausas.get(m).find(y => c >= y.desde && (y.vuelve === null || c < y.vuelve));
        const base = x.base || (ultimoUsado.get(m)?.f === x.desde - 1 ? ultimoUsado.get(m).v : null);
        if (!base) { faltan.add(-1); continue; }               // (todavía no corrí el cuadro anterior a la pausa: no pasa)
        vals[m] = { v: congelado(base, c - x.desde), con: 1 };
        continue;
      }
      if (m !== a) {
        if (xa === undefined) { faltan.add(a); continue; }       // todavía no sé si va relevado
        if (xa && (xa.masc >> m) & 1) { vals[m] = { v: xa.slots[m], con: 1 }; continue; }
      }
      const v = tabla(m).get(c);
      if (!v) { faltan.add(m); continue; }
      vals[m] = { v, con: 1 };
    }
    return faltan.size ? { faltan: [...faltan] } : { vals, autoridad: a };
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
  // §100: ¿el mando m es de una consola que se fue? (ver la opción ido)
  const seFue = m => !!ido && oidoHace(m) > IDO_MS && !!ido(duenoDe.get(m));
  // §99 (C4): desde cuándo cargó al menos la mitad de los que siguen (yo incluido), en esta carrera
  let mitadDesde = null;
  function revisarMitad() {
    if (mitadDesde !== null || ultimo < 0) return;
    const vs = vivos(), llegaron = vs.filter(h => tabla(h.mando).size > 0).length;
    if (vs.length > 1 && 2 * llegaron >= vs.length) mitadDesde = ahora();
  }
  function margenDe(m, c) {
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
    // (§101: sin lo que estuve trabada yo: al despertar, lo de los demás todavía está en la cola de mensajes y no hay
    // que pausar ni cortar a nadie por eso)
    const t = ahora() - espera.desde - espera.congelado;
    const faltan = r.faltan.filter(m => m >= 0);
    espera.faltan = faltan;
    // §101 (para entender las esperas largas): a los ESPERAS_LOG ms y a los 1500 ms, qué falta y hasta dónde tengo lo de cada uno
    if ((t > ESPERAS_LOG && !espera.dicho) || (t > 1500 && espera.dicho === 1)) {
      espera.dicho = (espera.dicho || 0) + 1;
      const a = autoridadEn(cuadro);
      registro(`[lockstep] espero ${t.toFixed(0)} ms el cuadro ${cuadro}: faltan ${JSON.stringify(r.faltan)}; tengo hasta ` +
        mandos.map(m => `${m}:${ultimoDe(m)}${pausadoEn(m, cuadro) ? 'p' : ''}${cortes.has(m) ? 'x' : ''}`).join(' ') +
        `; autoridad ${a} (${a !== undefined && tabla(a).has(cuadro) ? 'llegó' : 'falta'}); bloqueos ${JSON.stringify([...bloqueos].map(([m, b]) => [m, b.hasta]))}` +
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
      else if (relevoRapido && tabla(m).size > 0 && !pausaAbierta(m) && t > PAUSA_MS && oidoHace(m) > PAUSA_MS) proponer(m, true);
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
  function pausar(m, desde, anunciar) {
    const abierta = pausaAbierta(m), conocida = pausas.get(m)?.some(x => x.desde === desde);
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
    ps.push({ desde, vuelve: null, base: ultimoUsado.get(m)?.f === desde - 1 ? ultimoUsado.get(m).v : null, t: ahora() });
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
    if (ultimo < 0 || fuera) return;
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
    const b = empaca(3, m, desde, extra), v = vivos();
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
  function salirme(por) {
    fuera = { cuadro: ultimo, por };
    est.salidas++;
    registro(`[lockstep] me salgo de la carrera ${carrera}: ${por}`);
    aTodos(empaca(14, miMando & 255, Math.max(0, ultimo)), 'tcp');
    if (espera) { const f = espera.resolver; espera = null; f(); }
  }

  function compararHuella(cuadro, h) {
    let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
    e.mia = h >>> 0; e.miaB = est.hashBotones;
    const b = empaca(4, miMando & 255, cuadro, 8), d = new DataView(b.buffer);
    d.setUint32(8, e.mia); d.setUint32(12, e.miaB);
    aTodos(b, 'tcp');
    revisarHuella(cuadro);
  }
  function revisarHuella(cuadro) {
    const e = huellas.get(cuadro); if (!e || e.mia === undefined) return;
    for (const [u, [h, hb]] of e.de) {
      e.de.delete(u);
      // (§80: con uno que está cortado desde ese cuadro o antes no se compara: si no se enteró del corte —se le cortó
      // la conexión justo cuando se lo mandaron—, su copia se separó a propósito, y al enterarse se sale de la carrera)
      const mu = mandoDe.get(u);
      if (cortes.has(mu) && cortes.get(mu) <= cuadro) { est.huellasDeCortados = (est.huellasDeCortados || 0) + 1; continue; }
      if (h === e.mia && hb === e.miaB) { est.huellasIguales++; continue; }
      if (!est.desincronizado && !fuera) {
        est.desincronizado = { cuadro, carrera, con: u, que: hb !== e.miaB ? 'botones' : 'carrera' };
        registro(`[lockstep] ¡DESINCRONIZADO con ${u} en el cuadro ${cuadro} (carrera ${carrera}): ${est.desincronizado.que}!`);
      }
      // §99 (H4): antes solo se anotaba y cada PC seguía con su carrera (puntos, VR y parrilla de carreras distintas).
      // Si el distinto es la autoridad de ese cuadro, el que se separó soy yo: me salgo de la carrera (vuelvo en la
      // siguiente, como al recargar). Si la autoridad soy yo, se sale el otro (él hace la misma cuenta)
      const a = autoridadEn(cuadro);
      if (!fuera && a !== undefined && a !== miMando && duenoDe.get(a) === u) {
        est.desincronizado.meSali = true;
        salirme(`mi carrera se separó de la de ${u} (la autoridad) en el cuadro ${cuadro}`);
      }
    }
  }

  // ---- cada 50 ms, haya o no espera: informes, cortes pendientes (saltos, silencios), propuestas y quietudes viejas ----
  let ultimoInforme = ahora();
  const vigilancia = informeCada > 0 ? setInterval(() => {
    const t = ahora();
    if (t - ultimoInforme >= informeCada) { ultimoInforme = t; informar(); }
    if (ultimo < 0) return;
    for (const h of humanos) {
      const m = h.mando;
      // (§99, C1: al pausado no: si no vuelve, su pausa se vuelve corte en revisarPausas)
      if (m === miMando || cortes.has(m) || propuestas.has(m) || pausaAbierta(m) || decisorDe(m) !== yo || !tabla(m).size) continue;
      // el que avisó que se sale, o uno relevado que se calló del todo (nadie lo espera, pero el juego sí, en la meta)
      const callado = t - (oido.get(h.uid) ?? t) > (enLargada(ultimo) ? esperaLargada : esperaCorte);   // (§93: en la largada, más)
      // (§99, C1: con el relevo rápido, al relevado que se calla se lo pausa a los PAUSA_MS: nadie lo esperaba —va
      // relevado— y el corte de los 2 s lo sacaba de la carrera)
      if (saltos.get(carrera)?.has(m)) proponer(m);
      else if (relevoRapido && est.relevadosAhora.includes(h.uid) && t - (oido.get(h.uid) ?? t) > PAUSA_MS) proponer(m, true);
      else if (callado && est.relevadosAhora.includes(h.uid)) proponer(m);
    }
    revisarPropuestas();
    // una quietud de un corte que nunca se decidió (el decisor se fue): se suelta; otro decisor lo vuelve a proponer
    for (const [m, b] of bloqueos) if (!propuestas.has(m) && t - b.desde > 3 * esperaCorte) { bloqueos.delete(m); registro(`[lockstep] el corte de ${duenoDe.get(m)} no se decidió: sigo`); revisar(); }
  }, 50) : null;

  // ---- lo que llega de los demás ----
  function alBinario(de, b) {
    if (b[0] !== MARCA || b.length < 8) return;
    const tipo = b[1], c = b[2], m = b[3], d = new DataView(b.buffer, b.byteOffset, b.byteLength), cuadro = d.getUint32(4);
    oido.set(de, ahora());
    if (tipo === 7 && b.length >= 16) {                         // ping: se devuelve tal cual (con su hora)
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
      const tt = actual ? tabla(m) : (destino.tablas.get(m) || destino.tablas.set(m, new Map()).get(m));
      const rr = actual ? reg(m) : (destino.regs.get(m) || destino.regs.set(m, new Map()).get(m));
      for (let i = 0; i < n && o + paso <= b.length; i++) {
        const f = cuadro + i, v = lee8(d, o), masc = conReg ? d.getUint16(o + 8) : 0, sust = conReg ? d.getUint16(o + 10) : 0, sig = conReg ? b[o + 12] : 0xFF;
        o += paso;
        const slots = fila(null);
        for (const k of bits(masc)) { if (o + 8 > b.length) return; slots[k] = lee8(d, o); o += 8; }
        if (tt.has(f)) continue;
        tt.set(f, v);
        if (actual && f > ultimoDe(m)) nuevo.set(m, f);
        if (masc || sig !== 0xFF) rr.set(f, { masc, sust, sig, slots });
        if (sig === miMando && actual) {
          // me pasaron la autoridad: sigo relevando a los que ella relevaba, y a ella misma (se atrasaba)
          const t = ahora();
          relevados.clear(); pasarA = null; traspaso = null;
          for (const k of bits(masc)) if (k !== miMando) relevados.set(k, { desde: t, problema: t });
          if (m !== miMando) relevados.set(m, { desde: t, problema: t });
          registro(`[lockstep] ${duenoDe.get(m)} me pasó la autoridad desde el cuadro ${f + 1}`);
        }
        masNuevo = f;
      }
      // la holgura: cuántos cuadros antes de necesitarlo llegó su botón más nuevo (solo lo que manda el dueño)
      if (actual && masNuevo >= 0 && de === duenoDe.get(m) && ultimo >= 0 && m !== miMando) {
        const necesito = espera ? espera.cuadro : ultimo + 1;
        ven.hol[m] = Math.min(ven.hol[m], masNuevo - necesito);
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
      if (su !== undefined && cortes.has(su) && b.length >= 10 && !cortes.has(miMando)) {
        const v = vivos(), mios = v.length, minMio = Math.min(...v.map(h => h.mando)), suyos = b[8], minSuyo = b[9];
        const ganoYo = mios > suyos || (mios === suyos && minMio < minSuyo);
        if (ganoYo || m !== miMando) {
          if (!est.islas) registro(`[lockstep] ${de} (al que corté) corta a ${duenoDe.get(m)}: ${ganoYo ? `sigue mi lado (somos ${mios}, ellos ${suyos})` : 'no vale para nadie más que para mí'}`);
          est.islas = (est.islas || 0) + 1;
          return;
        }
      }
      if (b.length >= 11 && b[10] === 1) pausar(m, cuadro, false);      // §99 (C1): una pausa, no un corte
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
      e.de.set(de, [d.getUint32(8), d.getUint32(12)]);
      revisarHuella(cuadro);
    } else if (tipo === 10 && b.length >= 9 + 5 * MANDOS && actual) {
      const inf = { t: ahora(), hol: [], esp: [], max: [], racha: [], ven: [], dud: !!(b[8] & 1), prisa: !!(b[8] & 2), atras: !!(b[8] & 4),
                    rtt: b.length > 9 + 5 * MANDOS && b[9 + 5 * MANDOS] !== 255 ? b[9 + 5 * MANDOS] * 2 : null };
      for (let p = 0; p < MANDOS; p++) {
        const o = 9 + 5 * p;
        inf.hol.push(d.getInt8(o)); inf.esp.push(b[o + 1] * 4); inf.max.push(b[o + 2] * 4); inf.racha.push(b[o + 3]); inf.ven.push(d.getInt8(o + 4));
      }
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
  const quietos = () => { const d = new Int32Array(8 * MANDOS); for (const p of mandos) { d[p * 8] = 1; for (let k = 0; k < 7; k++) d[p * 8 + 1 + k] = NEUTRO[k]; } return d; };
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
  return { pad, alBinario, fijarCarrera, saltar, enCuadro, agregar,
    estado: () => ({ ...est, esperaDe: { ...est.esperaDe }, estable: { ...est.estable }, delantes: Object.fromEntries(delanteDe),
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
export function avisoLento(antes, ahora, ms, humanos) {
  const cuadros = (ahora?.cuadros ?? 0) - (antes?.cuadros ?? 0);
  if (!antes || cuadros < 30 || ms <= 0) return '';
  const fps = cuadros / (ms / 1000), espera = (ahora.msEsperando - antes.msEsperando) / cuadros;
  if (espera > 4 && fps < 55) {
    let peor = null, mas = 0;
    for (const [u, t] of Object.entries(ahora.esperaDe || {})) {
      const d = t - (antes.esperaDe?.[u] || 0);
      if (d > mas) { mas = d; peor = u; }
    }
    const n = humanos.findIndex(h => h.uid === peor) + 1;
    return `La carrera va a ${Math.round(fps)} cuadros por segundo: espera ${n ? `al jugador ${n} de la sala` : 'a otro jugador'} (su PC o su conexión no dan abasto)`;
  }
  if (espera < 1 && fps < 50) return `Tu PC no alcanza 60 cuadros por segundo (va a ${Math.round(fps)}): la sala va a tu ritmo`;
  return '';
}
// Lo que usa la página: una foto de estado() cada 3 s y el aviso solo si DOS ratos seguidos (6 s) salieron mal. Un
// tirón suelto (bajar la pista con la caché vacía al empezar la carrera: medio segundo congelado y un par de segundos a
// 25-30 cuadros) no es una PC lenta y no se avisa. Como el retardo de un relé térmico: no salta con el pico del arranque.
export function vigiaLento(humanos, seguidas = 2) {
  let foto = null, cuando = 0, malas = 0;
  return (ahora, t) => {
    const texto = avisoLento(foto, ahora, t - cuando, humanos);
    foto = ahora; cuando = t;
    malas = texto ? malas + 1 : 0;
    return malas >= seguidas ? texto : '';
  };
}
