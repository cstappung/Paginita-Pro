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
export const MARCA = 0xA7;
export const RETRASO = 3;                  // el de partida si no hay medidas (y el de siempre con ?retraso=fijo)
export const RETRASO_MIN = 2;
export const RETRASO_MAX = 12;             // 200 ms: más ya no se maneja (y solo lo sufre quien tiene esa conexión)
const PING_CADA = 500, MARGEN_MS = 6, MUESTRAS = 3, VENTANA = 16, TIRON_MS = 100;
const REPITE = 16, CADA_HUELLA = 120, ESPERA_PIDE = 7, ESPERA_CORTE = 4000, ESPERA_INICIO = 45000;
// §93 (C4), la LARGADA: los primeros 600 cuadros (10 s) de cada carrera. La primera vez que alguien juega, ahí su
// navegador todavía arma gráficos y lee pedazos del disco, y su pestaña puede quedar trabada varios segundos (medido:
// 5-9 s justo al largar). En ese tramo no se usa el margen corto de la sala: al que se calla se le espera esperaLargada
// (la página: 15 s) y al que se sigue oyendo (sus pings llegan: la pestaña vive, solo espera al disco) hasta esperaInicio
const LARGADA = 600;
const INFORME_CADA = 500;                  // cada cuánto cada consola cuenta cómo le llegan los botones de cada uno
const RELEVO_MIN = 6, SANO = 6;            // ratos: relevado al menos 3 s, y 3 s sin problemas para volver a lo directo
const MALAS_AUTORIDAD = 4;                 // ratos malos seguidos de la autoridad (2 s) antes de pasarle el papel a otro
// §80b, la sincronía de tiempo (prendida; ?sincroTiempo=0 la apaga): me freno si voy más de UMBRAL_SINCRO cuadros por delante de alguien
// que va suelto; a lo más DEUDA_MAX cuadros por rato, uno cada CADA_FRENO cuadros (como mucho un 12 % más lento un
// momento); al que va más de TOPE_SINCRO cuadros atrás no se lo espera (eso es del relevo)
const UMBRAL_SINCRO = 1, TOPE_SINCRO = 20, CADA_FRENO = 8, DEUDA_MAX = 4;
const ENVEJECE = 6, APAGA = 30;            // el botón inventado: el último por 6 cuadros; después el volante se suelta en 30
const SIN_DATO = 127, NO_SE = 255;
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
  let buenas = 0, sustituidosMios = 0, ultimaSubida = -Infinity, numInforme = 0, malasAutoridad = 0;
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
    hashBotones: 2166136261, relevadosAhora: [], autoridad: null, subidas: 0, bajadas: 0, frenos: 0, msFrenado: 0, adelanto: 0 };

  const tabla = m => { let t = tablas.get(m); if (!t) tablas.set(m, t = new Map()); return t; };
  const reg = m => { let r = regs.get(m); if (!r) regs.set(m, r = new Map()); return r; };
  const cortadoEn = (m, c) => cortes.has(m) && c >= cortes.get(m);
  const vivos = () => humanos.filter(h => !cortes.has(h.mando));
  const primerVivoEn = c => humanos.find(h => !cortadoEn(h.mando, c))?.mando;
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

  function ventanaNueva() { ven = { hol: fila(SIN_DATO), esp: fila(0), max: fila(0), ven: fila(SIN_DATO), dud: false, t0: ahora(), c0: est.cuadros }; }
  ventanaNueva();

  function nuevaCarrera() {
    carrera++; ultimo = -1; escrito = -1; espera = null; huellas.clear(); propuestas.clear(); bloqueos.clear();
    cadena = []; relevados.clear(); pasarA = null; traspaso = null; fuera = null; buenas = 0; sustituidosMios = 0;
    ultimaSubida = -Infinity; malasAutoridad = 0; rachas.fill(0); informes.clear(); nuevo.clear(); ventanaNueva();
    deuda = 0; ultimoFreno = -Infinity; ventajas.fill(SIN_DATO); est.sumaRetraso = 0; est.cuadrosCarrera = 0;
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
    est.autoridad = duenoDe.get(primerVivoEn(0)) ?? null;
    registro(`[lockstep] carrera ${carrera}: ${humanos.length} humanos, yo en el mando ${miMando}, mi retraso de partida ${miRetraso}` +
      `, autoridad ${est.autoridad} — idas y vueltas: ${[...rtt].map(([u, x]) => `${u} ${x.m.map(v => v.toFixed(0)).join('/')} ms${perdio(x) ? ' (perdió alguna)' : ''}`).join('; ') || 'sin medir'}`);
  }

  // ---- §80: la autoridad ----
  // La del cuadro c (ya corrido o el que se está por correr): con los traspasos ya corridos y los cortes. Todas las
  // consolas la calculan igual.
  function autoridadEn(c) {
    let a = primerVivoEn(0);
    for (const [d, m] of cadena) if (d <= c) a = m;
    return a === undefined || cortadoEn(a, c) ? primerVivoEn(c) : a;
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
      if (cortadoEn(a, c + 1)) a = primerVivoEn(c + 1);
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
          const ya = t - espera.desde, nuevo = ya - espera.contado;
          espera.contado = ya;
          for (const m of espera.faltan) if (m >= 0) { ven.esp[m] += nuevo; ven.max[m] = Math.max(ven.max[m], ya); }
        }
      }
      const b = empaca(10, miMando & 255, ++numInforme, 1 + 5 * MANDOS), inf = { t, hol: [], esp: [], max: [], racha: [], ven: [], dud: ven.dud };
      b[8] = ven.dud ? 1 : 0;
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
    ajustarRetraso();
    decidirRelevos();
    calcularDeuda();
    repetirCortes();
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
    let peor = 0, quien = null;
    for (const h of humanos) {
      const m = h.mando;
      if (m === miMando || cortes.has(m) || !tabla(m).size || est.relevadosAhora.includes(h.uid)) continue;
      const inf = informes.get(h.uid);
      if (!inf || t - inf.t > 1.5 * informeCada || inf.dud) continue;
      const mia = ventajas[m], suya = inf.ven?.[miMando];
      if (mia === SIN_DATO || suya === undefined || suya === SIN_DATO) continue;
      const delante = (mia - suya) / 2;
      if (delante > TOPE_SINCRO) continue;
      if (delante > peor) { peor = delante; quien = h.uid; }
    }
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
      if (m === miMando || cortes.has(m) || !tabla(m).size) { relevados.delete(m); continue; }
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
    malasAutoridad = vista(miMando).culpa(1) && !heredado(miMando) ? malasAutoridad + 1 : 0;
    if (pasarA !== null || traspaso || malasAutoridad < MALAS_AUTORIDAD) return;
    let mejor = null, puntos = -Infinity;
    for (const h of humanos) {
      const m = h.mando;
      if (m === miMando || cortes.has(m) || relevados.has(m) || !tabla(m).size) continue;
      const w = vista(m), p = (w.culpa(1) ? -1000 : 0) + Math.min(w.minHol, 50);
      if (p > puntos) { puntos = p; mejor = m; }
    }
    if (mejor !== null) pasarA = mejor;
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
    // §80b: me freno un cuadro (lo espero sin hacer nada) si voy adelantado a uno que va suelto; antes de tomar este
    // cuadro, así para todos sigo en el anterior (lo que ya corrí). El juego no se pone al día: queda un cuadro más atrás
    if (deuda > 0 && est.cuadros - ultimoFreno >= CADA_FRENO) {
      deuda--; ultimoFreno = est.cuadros; est.frenos++;
      const t0 = ahora();
      await new Promise(listo => setTimeout(listo, cuadroMs));
      est.msFrenado += ahora() - t0;
      if (fuera) { ultimo = cuadro; return quietos(); }
    }
    ultimo = cuadro;
    est.cuadros++; est.cuadrosCarrera++; est.sumaRetraso += miRetraso;
    // lo mío: el estado de ahora vale para cuadro + mi retraso (y para los cuadros intermedios si el retraso subió;
    // si bajó, no escribo nada hasta alcanzar lo ya escrito). Al empezar la carrera, los primeros (hasta mi retraso)
    // van neutros, escritos: nadie tiene que saber mi retraso
    if (miMando >= 0 && !cortes.has(miMando)) {
      const v = (local() || NEUTRO).slice(0, 7); v[0] &= ~START;
      const hasta = cuadro + miRetraso, primero = escrito < 0;
      for (let f = Math.max(escrito + 1, primero ? 0 : cuadro); f <= hasta; f++) {
        const t = tabla(miMando);
        if (!t.has(f)) { t.set(f, primero && f < hasta ? NEUTRO : v); if (f > ultimoDe(miMando)) nuevo.set(miMando, f); }
        const x = autoridadPrevista(f) === miMando ? registroPara(f) : null;
        if (x) reg(miMando).set(f, x);
        escrito = f;
      }
      const p = paquete(miMando, escrito - REPITE + 1, escrito);
      if (p) aTodos(p);
    }
    let r = resolver(cuadro);
    if (r.faltan) {
      const t0 = ahora();
      // ¿espero a alguien que todavía no llegó a la carrera (no mandó nada)? Eso es la "llegada" (cada uno carga a su
      // ritmo), no el costo de sincronizar: se cuenta aparte
      const llegada = mandos.some(m => m !== miMando && !cortes.has(m) && tabla(m).size === 0);
      const e = { cuadro, desde: t0, pedido: 0, faltan: r.faltan, llegada, contado: 0 };
      await new Promise(resolver => { espera = Object.assign(e, { resolver }); revisar(); });
      const ms = ahora() - t0;
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

  // el decisor del corte del mando m: el primero que sigue que no es él, en el orden de la sala (uno solo, siempre el mismo)
  const decisorDe = m => vivos().find(h => h.mando !== m)?.uid;

  // §93: cuánto se espera al mando m, que falta en el cuadro c. Si todavía no mandó nada en esta carrera, viene
  // cargando: esperaInicio. En la largada (los primeros cuadrosLargada), esperaLargada; y si además se lo sigue oyendo
  // (algo suyo llegó hace menos de 1 s: la pestaña vive y solo espera al disco), esperaInicio. Después, el margen.
  const enLargada = c => c < cuadrosLargada && esperaLargada > esperaCorte;
  const oidoHace = m => ahora() - (oido.get(duenoDe.get(m)) ?? -Infinity);
  function margenDe(m, c) {
    if (!tabla(m).size) return esperaInicio;
    if (!enLargada(c)) return esperaCorte;
    return oidoHace(m) < 1000 ? Math.max(esperaLargada, esperaInicio) : esperaLargada;
  }

  // ¿ya se puede seguir? Si no: pedir lo que falta y, después de mucho, cortar al que no aparece
  function revisar() {
    if (!espera) return;
    const { cuadro } = espera;
    const r = resolver(cuadro);
    if (!r.faltan || fuera) { const f = espera.resolver; espera = null; f(); return; }
    const t = ahora() - espera.desde;
    const faltan = r.faltan.filter(m => m >= 0);
    espera.faltan = faltan;
    if (t > ESPERA_PIDE * cuadroMs && ahora() - espera.pedido > ESPERA_PIDE * cuadroMs) {
      espera.pedido = ahora();
      for (const m of faltan) aTodos(empaca(2, m, cuadro), 'udp');
    }
    // §75: al que avisó que se salta esta carrera (recargó la página) no se lo espera: se corta ya. Al que todavía no
    // mandó nada en esta carrera se le espera más (esperaInicio: cada uno carga a su ritmo); al que ya estaba, el margen
    // (§93: más largo en la largada, margenDe)
    const salta = saltos.get(carrera);
    for (const m of faltan) if (decisorDe(m) === yo && !propuestas.has(m) && !cortes.has(m) && (salta?.has(m) || t > margenDe(m, cuadro))) proponer(m);
    revisarPropuestas();
    if (espera) setTimeout(revisar, 40);
  }

  // El corte en dos fases (§80, con los arreglos del crítico): 1) el decisor pregunta a TODOS (también al que se corta)
  // hasta qué cuadro corrieron o tienen sus botones; cada uno, al contestar, reparte lo que tiene de él y se queda
  // quieto ahí hasta saber la decisión (así ningún botón suyo que llegue tarde se usa más allá); 2) corta DESPUÉS del
  // máximo. Nadie corrió ese cuadro todavía: todas lo usan "sin nadie" desde ahí. Hasta dónde llego: lo que tengo de
  // él, lo que ya corrí y, si va relevado, hasta donde la autoridad ya escribió su relevo (ahí no hacen falta los suyos).
  const hastaDonde = m => fuera ? ultimoDe(m) : Math.max(ultimoDe(m), ejecutado(), alcanceRelevo(m));
  function proponer(m) {
    const mio = hastaDonde(m);
    propuestas.set(m, { de: new Map(), desde: ahora(), mio });
    bloqueos.set(m, { hasta: mio, desde: ahora() });
    registro(`[lockstep] propongo cortar a ${duenoDe.get(m)} (mando ${m}): llego hasta el cuadro ${mio}`);
    aTodos(empaca(5, m, mio), 'tcp');
  }
  function revisarPropuestas() {
    const t = ahora();
    for (const [m, p] of propuestas) {
      // a quién se espera: a todos los que siguen y se oyen (menos al que avisó que se salta esta carrera). Al que se
      // corta, solo si se lo oyó hace poco (medio margen; sus pings llegan cada medio segundo): si se fue de verdad,
      // esperarlo es perder otro margen entero (y si estaba y no contestó, al ver el corte se sale él solo)
      const salta = saltos.get(carrera)?.has(m);
      const deben = humanos.filter(h => h.uid !== yo && !cortes.has(h.mando) && !(salta && h.mando === m) &&
        t - (oido.get(h.uid) ?? -Infinity) < (h.mando === m ? esperaCorte / 2 : esperaCorte));
      if (deben.every(h => p.de.has(h.uid)) || t - p.desde > esperaCorte) {
        propuestas.delete(m);
        cortar(m, Math.max(p.mio, ...p.de.values()) + 1, true);
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
  // el aviso de un corte: lleva cuántos siguen en la carrera según el que corta y el mando más bajo de ellos (si la
  // conexión se partió en dos y cada lado cortó al otro, así se sabe qué lado sigue; ver alBinario, tipo 3)
  function avisoCorte(m, desde) {
    const b = empaca(3, m, desde, 2), v = vivos();
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
      if (m === miMando || cortes.has(m) || propuestas.has(m) || decisorDe(m) !== yo || !tabla(m).size) continue;
      // el que avisó que se sale, o uno relevado que se calló del todo (nadie lo espera, pero el juego sí, en la meta)
      const callado = t - (oido.get(h.uid) ?? t) > (enLargada(ultimo) ? esperaLargada : esperaCorte);   // (§93: en la largada, más)
      if (saltos.get(carrera)?.has(m) || (callado && est.relevadosAhora.includes(h.uid))) proponer(m);
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
    if (tipo === 13 && b.length >= 10) {
      const n = b[8], adelanto = b[9];
      let o = 10, masNuevo = -1;
      const tt = actual ? tabla(m) : (destino.tablas.get(m) || destino.tablas.set(m, new Map()).get(m));
      const rr = actual ? reg(m) : (destino.regs.get(m) || destino.regs.set(m, new Map()).get(m));
      for (let i = 0; i < n && o + 13 <= b.length; i++) {
        const f = cuadro + i, v = lee8(d, o), masc = d.getUint16(o + 8), sust = d.getUint16(o + 10), sig = b[o + 12];
        o += 13;
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
      cortar(m, cuadro, false);
    } else if (tipo === 5) {
      // el decisor va a cortar el mando m: reparto lo que tengo de él (por "tcp": llega en orden), le digo hasta dónde
      // llego y me quedo quieto ahí hasta saber la decisión. Si todavía no empecé esa carrera: no corrí nada (−1)
      let hasta = -1;
      if (actual) {
        const x = ultimoDe(m), p = x >= 0 ? paquete(m, Math.max(0, x - 63), x) : null;
        if (p) aTodos(p, 'tcp');
        hasta = bloqueos.get(m)?.hasta ?? hastaDonde(m);
        if (!cortes.has(m) && !fuera) bloqueos.set(m, { hasta, desde: ahora() });
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
      const inf = { t: ahora(), hol: [], esp: [], max: [], racha: [], ven: [], dud: !!(b[8] & 1) };
      for (let p = 0; p < MANDOS; p++) {
        const o = 9 + 5 * p;
        inf.hol.push(d.getInt8(o)); inf.esp.push(b[o + 1] * 4); inf.max.push(b[o + 2] * 4); inf.racha.push(b[o + 3]); inf.ven.push(d.getInt8(o + 4));
      }
      informes.set(de, inf);
    } else if (tipo === 14) {
      // ese jugador se salió de la carrera (su copia se separó): se lo corta ya, como al que recargó
      saltar(m, actual ? carrera : carrera + 1);
    }
  }

  // §73: la sala dice qué número de carrera viene (quien recargó la página a mitad de la copa entra en la siguiente con
  // el mismo número que los demás: los paquetes llevan ese número)
  // Si el juego está en medio de una carrera (la anterior), sus últimos cuadros van sin esperar (ver pad) y se suelta la
  // espera en curso: quien iba un cuadro atrás esperaría para siempre botones que ya nadie manda.
  let saliendo = null;
  const quietos = () => { const d = new Int32Array(8 * MANDOS); for (const p of mandos) { d[p * 8] = 1; for (let k = 0; k < 7; k++) d[p * 8 + 1 + k] = NEUTRO[k]; } return d; };
  function fijarCarrera(k, fuera_ = null) {
    if (!(k >= 1)) return;
    if (Array.isArray(fuera_)) planteles.set(k, new Set(fuera_.filter(m => mandos.includes(m))));
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
    const ms = ahora() - espera.desde;
    return { uids: espera.faltan.map(m => duenoDe.get(m)), ms,
             // el margen de quien más se espera (§93: en la largada es más largo; largada = se trabó al largar)
             margen: Math.max(...espera.faltan.map(m => margenDe(m, espera.cuadro))), largada: enLargada(espera.cuadro),
             // los que nunca mandaron nada en esta carrera todavía vienen cargando (no es un corte)
             llegando: espera.faltan.every(m => tabla(m).size === 0) };
  };
  return { pad, alBinario, fijarCarrera, saltar, enCuadro,
    estado: () => ({ ...est, esperaDe: { ...est.esperaDe }, retrasos: { ...est.retrasos }, retrasoMax: { ...est.retrasoMax },
      relevadosAhora: [...est.relevadosAhora], carrera, cuadro: ultimo, miMando, retraso: miRetraso, cortes: Object.fromEntries(cortes),
      esperando: esperando(), fuera: !!fuera, cortado: cortes.has(miMando) && ultimo >= cortes.get(miMando), yoRelevado: yoRelevado(),
      sincroTiempo, deuda, retrasoMedio: est.cuadrosCarrera ? est.sumaRetraso / est.cuadrosCarrera : miRetraso,
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
