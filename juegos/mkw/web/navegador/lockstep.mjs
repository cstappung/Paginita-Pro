// La carrera sincronizada (lockstep) de la sala con CPU — bitácora §61.
//
// Resumen: en la sala con CPU de relleno, cada navegador corre LA MISMA carrera offline (12 karts: los humanos de la
// sala y CPU) y para que salga igual en todos, en cada cuadro todos usan los mismos botones de cada humano. El juego
// (pad_web.cpp) pide los botones de un cuadro con pad(cuadro) y espera la respuesta (32 enteros: 4 puertos × 8). Este módulo:
//   - guarda lo que toca este jugador para el cuadro actual + RETRASO (3 cuadros = 50 ms: el tiempo que tienen sus
//     botones para llegar a los demás antes de hacer falta) y se lo manda a todos;
//   - junta los de los demás (llegan por la malla WebRTC, canal "udp") y responde cuando tiene los de todos;
//   - cada paquete repite los últimos 16 cuadros (si se pierde uno, el siguiente lo trae); si igual falta alguno,
//     pide que se lo reenvíen (a todos: cualquiera que lo tenga contesta);
//   - si un humano se va (4 s sin sus botones; en la sala, §73, un MARGEN para volver: 30 s, ?margen=N) o nunca llega
//     (45 s), el "decisor" (el primer humano que sigue y no falta) anuncia desde qué cuadro su kart sigue sin nadie
//     (botones sueltos) y todos hacen lo mismo en el mismo cuadro. Mientras se lo espera la carrera queda en pausa en
//     todas las consolas (nadie avanza sin sus botones): si su conexión vuelve, la carrera sigue como si nada;
//     estado().esperando dice a quién se espera y desde hace cuánto (la página lo muestra con la cuenta);
//   - cada 120 cuadros compara una "huella" de la carrera (el avance de los 12 karts) con los demás: si no coincide,
//     la carrera se desincronizó (no debería pasar: el juego es determinista con el reloj fijo, §61);
//   - el RETRASO se adapta a la red (§70): cada medio segundo un "ping" a cada uno mide cuánto tarda la ida y vuelta.
//     Si los botones tardan en llegar más que el retraso, todas las consolas esperan en cada cuadro y la carrera va en
//     cámara lenta (con 80 ms de ida y retraso 3 = 50 ms, a ~37 cuadros por segundo). Por eso el "decisor" (el primer
//     humano que sigue, siempre uno solo) anuncia AL EMPEZAR cada carrera cuántos cuadros de retraso usar (3 a 8:
//     50 a 133 ms), según la peor ida medida en los últimos 8 s (sin contar los tirones de una pestaña cargando, y
//     con un cuadro de más si se pierden paquetes); los demás lo esperan en su primer cuadro. Tiene que ser el MISMO
//     número en todas las consolas (los primeros cuadros son neutros hasta el retraso; con números distintos la
//     carrera se desincronizaría): se anuncia una sola vez por carrera, no cambia después, y quien lo recibe se lo
//     pasa a los demás (por si a alguno no le llegó directo). Si nadie lo anuncia (el decisor nunca llegó), todos
//     usan el de siempre (3).
//   - §75, quién corre cada carrera: la sala (sala-carrera.mjs) dice al empezar cada carrera quiénes están fuera
//     (fijarCarrera(k, fuera)): esos van "sin nadie" desde el cuadro 0, en todas las consolas por igual, y los demás
//     corren aunque se hayan cortado en la anterior (volvieron). El decisor del retraso es el primero que NO está fuera
//     (tiene que ser el mismo en todas, también en una consola recién recargada). Y quien recargó la página con la
//     carrera andando avisa que se la salta (saltar): el decisor lo corta enseguida, sin esperar el margen de 30 s.
// Como un sistema de control distribuido con reloj común: nadie avanza un paso hasta tener las entradas de todos.
//
// Formato de los mensajes (binario, el primer byte 0xA7 los distingue de los de red.mjs, que empiezan con el largo):
//   [0xA7, tipo, carrera, mando, u32 cuadro, …]  tipo 1 botones (u8 cuántos + 8 bytes por cuadro), 2 pide, 3 corte,
//   4 huella (u32), 5 propone corte, 6 "tengo hasta este cuadro", 7 ping y 8 respuesta (cuadro = número de ping, f64
//   la hora del ping), 9 el retraso de una carrera (cuadro = número de carrera, u8 retraso). 8 bytes por cuadro:
//   botones u16, stick x/y, stick C x/y (i8), gatillos L/R (u8).
//
// Uso:  const ls = crearLockstep({ yo, humanos: [{ uid, mando }], enviar: (uid, bytes, canal) => …, local: () => [7 números] });
//       Module.mkwLockstep = ls;  malla → ls.alBinario(de, bytes)  (los que empiezan con MARCA)
//       §75: ls.fijarCarrera(k, [mandos fuera]); ls.saltar(mando, k); ls.enCuadro(k, cuadro, fn) (fn en ese cuadro)
export const MARCA = 0xA7;
export const RETRASO = 3;
export const RETRASO_MAX = 8;              // 133 ms: más que eso ya se siente mucho al manejar (y es otro país lejos)
const PING_CADA = 500, MARGEN_MS = 6, CUADRO_MS = 1000 / 60, MUESTRAS = 3, VENTANA = 16, TIRON_MS = 100;
const REPITE = 16, CADA_HUELLA = 120, ESPERA_PIDE = 120, ESPERA_CORTE = 4000, ESPERA_INICIO = 45000;
const NEUTRO = [0, 0, 0, 0, 0, 0, 0];
const START = 0x1000;                      // pausa: en la carrera de la sala no se pausa (pausaría solo una consola)

export function crearLockstep({ yo, humanos, enviar, local, huella = null, retraso: retrasoBase = RETRASO, registro = () => {},
  ahora = () => performance.now(), esperaCorte = ESPERA_CORTE, esperaInicio = ESPERA_INICIO,
  // ?retraso=fijo en la dirección de la página = el camino viejo (siempre 3), para comparar
  adaptar = !/[?&]retraso=fijo\b/.test(globalThis.location?.search || ''), retrasoMax = RETRASO_MAX, pingCada = PING_CADA }) {
  let retraso = retrasoBase;              // el de la carrera en curso (el que anunció el decisor para ella)
  const anuncios = new Map();             // carrera → retraso anunciado (no cambia una vez puesto)
  const rtt = new Map();                  // uid → { s: ida y vuelta suavizada (ms, para mostrar), m: las últimas VENTANA medidas,
                                          //         n: los números de ping que contestó }
  let pings = 0;                          // número del último ping (va en el campo "cuadro": la respuesta lo devuelve)
  const oido = new Map();                 // uid → la última vez que llegó algo de él (para saber quién está)
  const miMando = humanos.find(h => h.uid === yo)?.mando ?? -1;
  const mandos = humanos.map(h => h.mando);
  const duenoDe = new Map(humanos.map(h => [h.mando, h.uid]));
  let carrera = 0, ultimo = -1;           // carrera en curso (cuenta desde 1) y último cuadro pedido
  let tablas = new Map(), cortes = new Map(), siguiente = null;   // mando → Map(cuadro → [7]); mando → cuadro de corte
  let espera = null;                      // { cuadro, listo, desde, pedido }
  const huellas = new Map();              // cuadro → { mia, de: Map(uid → h) }
  const propuestas = new Map();           // corte propuesto: mando → { de: Map(uid → último cuadro que tiene), desde: ms }
  const planteles = new Map();            // §75: carrera → Set(mandos fuera desde el cuadro 0), lo dice la sala
  const saltos = new Map();               // §75: carrera → Set(mandos que avisaron que se la saltan: se cortan ya)
  const acciones = new Map();             // §75: "carrera:cuadro" → función (en ese cuadro, en todas las consolas)
  const est = { cuadros: 0, esperas: 0, msEsperando: 0, maxEspera: 0, msLlegada: 0, desincronizado: null, huellasIguales: 0, cortes: [],
    retrasos: {}, conflictos: 0, esperaDe: {} };   // esperaDe: uid → ms esperando sus botones (avisoLento)

  const tabla = m => { let t = tablas.get(m); if (!t) tablas.set(m, t = new Map()); return t; };
  const vivos = () => humanos.filter(h => !cortes.has(h.mando));
  // el botón de un mando en un cuadro: neutro antes de RETRASO (nadie tocó nada todavía) y desde su corte
  function boton(m, c) {
    if (c < retraso) return NEUTRO;
    if (cortes.has(m) && c >= cortes.get(m)) return NEUTRO;
    return tabla(m).get(c);
  }
  const listo = c => mandos.every(m => boton(m, c) !== undefined);
  // el último cuadro que tengo de un mando (RETRASO - 1 si no tengo ninguno)
  const ultimoDe = m => { let x = retraso - 1; for (const c of tabla(m).keys()) if (c > x) x = c; return x; };

  function empaca(tipo, mando, cuadro, extra = 0) {
    const b = new Uint8Array(8 + extra);
    b[0] = MARCA; b[1] = tipo; b[2] = carrera & 255; b[3] = mando;
    new DataView(b.buffer).setUint32(4, cuadro >>> 0);
    return b;
  }
  function paqueteBotones(m, desde, hasta) {
    const t = tabla(m), lista = [];
    for (let c = Math.max(desde, retraso); c <= hasta; c++) { const v = t.get(c); if (!v) break; lista.push(v); }
    if (!lista.length) return null;
    const b = empaca(1, m, Math.max(desde, retraso), 1 + 8 * lista.length), d = new DataView(b.buffer);
    b[8] = lista.length;
    lista.forEach((v, i) => { const o = 9 + 8 * i; d.setUint16(o, v[0] & 0xFFFF); for (let k = 1; k < 5; k++) d.setInt8(o + 1 + k, v[k]); d.setUint8(o + 6, v[5]); d.setUint8(o + 7, v[6]); });
    return b;
  }
  const aTodos = (bytes, canal = 'udp') => { for (const h of humanos) if (h.uid !== yo) enviar(h.uid, bytes, canal); };

  // ---- el retraso de cada carrera ----
  // quién decide: SIEMPRE el primer humano que sigue (no cortado). Uno solo: si dos anunciaran números distintos, la
  // carrera se desincronizaría. Si el primero se va (lo cortan), decide el siguiente.
  const decisor = () => vivos()[0]?.uid;
  // §75: el de la carrera k (antes de empezarla): con plantel, el primero que no está fuera; sin plantel, como antes
  const decisorDe = k => planteles.has(k) ? humanos.find(h => !planteles.get(k).has(h.mando))?.uid : decisor();
  // lo necesario, con medidas que aguantan los tirones: una pestaña ocupada (cargando la pista: la página no atiende
  // nada por 1 o 2 s) contesta tarde y esa ida y vuelta sale enorme sin que la red tenga la culpa. Por eso, de las
  // últimas VENTANA medidas (8 s): el "piso" es la más rápida (lo que tarda la red cuando nadie se traba); las que
  // pasan del piso + TIRON_MS (100 ms) son tirones y no cuentan; de las otras, la que deja 9 de cada 10 por debajo
  // (percentil 90: así entra la variación de la red). Y si en esos 8 s se perdió alguna respuesta: la mediana + un
  // cuadro, si es más (un paquete perdido llega repetido en el siguiente, un cuadro después; sin esto, en el banco con
  // 1 de 7 perdidos la carrera esperaba 2 ms por cuadro; sumar las dos cosas daba un cuadro de más). La ida es media
  // ida y vuelta; + un margen; en cuadros, entre el mínimo y el máximo. (Como medir el ruido de una señal sin contar
  // los picos de cuando arranca el motor.)
  function perdio(r) {
    // los pings de hace más de 2 s (los más nuevos pueden venir en camino) desde el primero que contestó
    const hasta = pings - 4, desde = Math.max(Math.min(...r.n), hasta - VENTANA + 1);
    return hasta - desde + 1 >= 6 && r.n.filter(n => n >= desde && n <= hasta).length < hasta - desde + 1;
  }
  function calcularRetraso() {
    let peor = 0;
    for (const h of vivos()) {
      const r = h.uid !== yo && rtt.get(h.uid);
      if (!r) continue;
      const piso = Math.min(...r.m), o = r.m.filter(x => x <= piso + TIRON_MS).sort((a, b) => a - b);
      if (o.length < MUESTRAS) continue;
      const q = f => o[Math.min(o.length - 1, Math.floor(f * o.length))] / 2;
      peor = Math.max(peor, q(0.9), perdio(r) ? q(0.5) + CUADRO_MS : 0);
    }
    return Math.min(retrasoMax, Math.max(retrasoBase, Math.ceil((peor + MARGEN_MS) / CUADRO_MS)));
  }
  const paqueteRetraso = (k, r) => { const b = empaca(9, 0, k, 1); b[8] = r; return b; };
  function anunciar(k) {
    if (anuncios.has(k) || decisorDe(k) !== yo) return;
    const r = adaptar ? calcularRetraso() : retrasoBase;
    anuncios.set(k, r);
    registro(`[lockstep] retraso de la carrera ${k}: ${r} cuadros (${(r * CUADRO_MS).toFixed(0)} ms)` +
      ` — idas y vueltas: ${[...rtt].map(([u, x]) => `${u} ${x.m.map(v => v.toFixed(0)).join('/')} ms${perdio(x) ? ' (perdió alguna)' : ''}`).join('; ') || 'sin medir'}`);
    aTodos(paqueteRetraso(k, r), 'tcp');
  }
  // cada medio segundo: un ping a cada uno. El anuncio va recién cuando el decisor empieza la carrera (en pad): antes,
  // mientras las pestañas cargan el juego, las medidas salen infladas (en la primera prueba con el juego, la red de
  // esta misma PC —1 ms— dio retraso 8 por anunciar durante la carga)
  const latido = pingCada > 0 ? setInterval(() => {
    const b = empaca(7, miMando & 255, ++pings, 8);
    new DataView(b.buffer).setFloat64(8, ahora());
    aTodos(b, 'udp');
  }, pingCada) : null;

  function nuevaCarrera() {
    carrera++; ultimo = -1; espera = null; huellas.clear(); propuestas.clear();
    retraso = anuncios.get(carrera) ?? retrasoBase;    // (pad espera el anuncio antes de llamar aquí, si hace falta)
    est.retrasos[carrera] = retraso;
    tablas = siguiente?.carrera === carrera ? siguiente.tablas : new Map();
    cortes = siguiente?.carrera === carrera ? siguiente.cortes : new Map();
    if (planteles.has(carrera)) {
      // §75: la sala dijo quiénes están fuera de esta carrera (desde el cuadro 0); los demás corren aunque se hayan
      // cortado en la anterior: volvieron. (Antes, quien se cortaba una vez quedaba fuera para siempre en las demás
      // consolas, pero no en la suya recién recargada: las carreras se separaban.)
      for (const m of planteles.get(carrera)) if (!cortes.has(m) || cortes.get(m) > 0) cortes.set(m, 0);
    } else {
      // sin plantel (la sala vieja, §61): los que se fueron en la carrera anterior siguen fuera
      for (const c of est.cortes) if (!cortes.has(c.mando)) cortes.set(c.mando, 0);
    }
    for (const k of [...planteles.keys()]) if (k < carrera - 1) planteles.delete(k);
    for (const k of [...saltos.keys()]) if (k < carrera) saltos.delete(k);
    for (const k of [...acciones.keys()]) if (Number(k.split(':')[0]) < carrera) acciones.delete(k);
    siguiente = null;
    registro(`[lockstep] carrera ${carrera}: ${humanos.length} humanos, yo en el mando ${miMando}, retraso ${retraso}`);
  }

  // ---- lo que pide el juego (pad_web.cpp) ----
  async function pad(cuadro) {
    // §73: la página ya pidió la carrera siguiente (fijarCarrera) y el juego todavía corre los últimos cuadros de la
    // vieja (el salto se hace apenas el juego avanza): esos van sin esperar a nadie —los demás ya no mandan botones de
    // esa carrera, y esperarlos dejaría al juego quieto sin poder saltar— y con todos quietos. La nueva empieza cuando
    // el contador de cuadros vuelve atrás.
    if (saliendo) {
      if (cuadro < saliendo.ultimo) saliendo = null;
      else { saliendo.ultimo = cuadro; est.cuadrosSaliendo = (est.cuadrosSaliendo || 0) + 1; return quietos(); }
    }
    if (ultimo < 0 || cuadro + 300 < ultimo) {                   // primer cuadro, o el contador volvió a empezar
      const k = carrera + 1;
      anunciar(k);                                               // si soy el decisor y no lo había anunciado: ahora
      if (!anuncios.has(k)) {
        // espero el anuncio del decisor (cuenta como "llegada": cada uno entra a la carrera a su ritmo). Si no llega
        // (el decisor no vino y ni siquiera se lo pasó otro), uso el de siempre: los demás tampoco lo recibieron, así
        // que también usan ese. Cuánto esperar: si del decisor nunca supe nada (ni un ping: no está), esperaCorte; si
        // estaba (puede venir cargando la pista), esperaInicio
        const t0 = ahora(), tope = oido.has(decisorDe(k)) ? esperaInicio : esperaCorte;
        esperaAnuncio = t0;                                      // (estado().esperando: se espera al decisor, que viene cargando)
        while (!anuncios.has(k) && ahora() - t0 < tope) { anunciar(k); await new Promise(r => setTimeout(r, 20)); }
        esperaAnuncio = 0;
        est.msLlegada += ahora() - t0;
        if (!anuncios.has(k)) registro(`[lockstep] nadie anunció el retraso de la carrera ${k}: uso ${retrasoBase}`);
      }
      nuevaCarrera();
    }
    ultimo = cuadro;
    est.cuadros++;
    // lo mío: el estado de ahora vale para cuadro + retraso (y para los cuadros intermedios que no tenían nada)
    if (miMando >= 0 && !cortes.has(miMando)) {
      const v = (local() || NEUTRO).slice(0, 7); v[0] &= ~START;
      const t = tabla(miMando);
      for (let c = Math.max(retraso, cuadro); c <= cuadro + retraso; c++) if (!t.has(c)) t.set(c, v);
      const p = paqueteBotones(miMando, cuadro + retraso - REPITE + 1, cuadro + retraso);
      if (p) aTodos(p);
    }
    if (!listo(cuadro)) {
      const t0 = ahora();
      // ¿espero a alguien que todavía no llegó a la carrera (no mandó nada)? Eso es la "llegada" (cada uno carga a su
      // ritmo), no el costo de sincronizar: se cuenta aparte
      const llegada = mandos.some(m => m !== miMando && !cortes.has(m) && tabla(m).size === 0);
      const e = { cuadro, desde: t0, pedido: 0, faltan: [] };
      await new Promise(resolver => { espera = Object.assign(e, { resolver }); revisar(); });
      const ms = ahora() - t0;
      if (llegada) est.msLlegada += ms;
      else {
        est.esperas++; est.msEsperando += ms; est.maxEspera = Math.max(est.maxEspera, ms);
        // a quién se esperó: los que faltaban justo antes de poder seguir (para avisar quién frena la sala)
        for (const m of e.faltan) { const u = duenoDe.get(m); est.esperaDe[u] = (est.esperaDe[u] || 0) + ms; }
      }
    }
    // los 4 puertos: conectado, botones, sx, sy, cx, cy, gl, gr (pad_web.cpp los copia al mando de cada puerto).
    // conectado = 2: ese humano se fue (desde su corte): el juego deja de esperarlo para terminar la carrera
    const datos = new Int32Array(32);
    for (let p = 0; p < 4; p++) {
      const v = mandos.includes(p) ? boton(p, cuadro) : null;
      if (!v) continue;
      datos[p * 8] = cortes.has(p) && cuadro >= cortes.get(p) ? 2 : 1;
      for (let k = 0; k < 7; k++) datos[p * 8 + 1 + k] = v[k];
    }
    if (huella && cuadro % CADA_HUELLA === 0 && cuadro > 0) compararHuella(cuadro, huella());
    // §75: lo que hay que hacer en este cuadro (en todas las consolas en el mismo: por ejemplo terminar la carrera)
    const accion = acciones.get(`${carrera}:${cuadro}`);
    if (accion) { acciones.delete(`${carrera}:${cuadro}`); try { accion(); } catch (e) { registro(`[lockstep] acción del cuadro ${cuadro}: ${e?.message || e}`); } }
    return datos;
  }

  // ¿ya se puede seguir? Si no: pedir lo que falta y, después de mucho, cortar al que no aparece
  function revisar() {
    if (!espera) return;
    const { cuadro } = espera;
    if (listo(cuadro)) { const r = espera.resolver; espera = null; propuestas.clear(); r(); return; }
    const t = ahora() - espera.desde;
    const faltan = mandos.filter(m => boton(m, cuadro) === undefined);
    espera.faltan = faltan;
    if (t > ESPERA_PIDE && ahora() - espera.pedido > ESPERA_PIDE) {
      espera.pedido = ahora();
      for (const m of faltan) aTodos(empaca(2, m, cuadro), 'udp');
    }
    // decide el primer humano que sigue Y que no es uno de los que faltan (si el que falta es justo el primero —por
    // ejemplo nunca llegó—, decide el siguiente: todos los que siguen ven faltar al mismo y eligen igual)
    const decide = vivos().find(h => !faltan.includes(h.mando))?.uid;
    // El corte va en dos pasos (como un "commit" en dos fases): 1) el decisor pregunta a todos hasta qué cuadro tienen
    // los botones del que falta (y ellos se los reparten); 2) corta DESPUÉS del último que tenga cualquiera. Así nadie
    // usó botones de verdad en un cuadro que para otro ya es "sin nadie" (eso desincronizaría la carrera).
    // al que todavía no mandó nada en esta carrera se le espera más (esperaInicio): cada uno llega a la carrera a su
    // ritmo (la carga del disco, los menús); al que ya estaba y se calla, solo esperaCorte
    // §75: al que avisó que se salta esta carrera (recargó la página) no se lo espera: se corta ya
    const salta = saltos.get(carrera);
    if (decide === yo)
      for (const m of faltan) if (!propuestas.has(m) && (salta?.has(m) || t > (tabla(m).size ? esperaCorte : esperaInicio))) {
        propuestas.set(m, { de: new Map(), desde: ahora() });
        aTodos(empaca(5, m, cuadro), 'tcp');
      }
    for (const [m, p] of propuestas) {
      const deben = humanos.filter(h => h.uid !== yo && !cortes.has(h.mando) && !faltan.includes(h.mando));
      if (deben.every(h => p.de.has(h.uid)) || ahora() - p.desde > esperaCorte) {
        propuestas.delete(m);
        cortar(m, Math.max(ultimoDe(m), ...p.de.values()) + 1, true);
      }
    }
    if (espera) setTimeout(revisar, 40);
  }

  function cortar(m, desde, anunciar) {
    if (cortes.has(m) && cortes.get(m) <= desde) return;
    cortes.set(m, desde);
    est.cortes.push({ mando: m, desde, carrera });
    registro(`[lockstep] el mando ${m} (${duenoDe.get(m)}) sigue sin nadie desde el cuadro ${desde}`);
    if (anunciar) aTodos(empaca(3, m, desde), 'tcp');
    revisar();
  }

  function compararHuella(cuadro, h) {
    let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
    e.mia = h >>> 0;
    aTodos((() => { const b = empaca(4, miMando & 255, cuadro, 4); new DataView(b.buffer).setUint32(8, e.mia); return b; })(), 'tcp');
    revisarHuella(cuadro);
  }
  function revisarHuella(cuadro) {
    const e = huellas.get(cuadro); if (!e || e.mia === undefined) return;
    for (const [u, h] of e.de) {
      if (h === e.mia) { est.huellasIguales++; e.de.delete(u); continue; }
      if (!est.desincronizado) { est.desincronizado = { cuadro, carrera, con: u }; registro(`[lockstep] ¡DESINCRONIZADO con ${u} en el cuadro ${cuadro} (carrera ${carrera})!`); }
      e.de.delete(u);
    }
  }

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
    if (tipo === 9 && b.length >= 9) {                          // el retraso de la carrera `cuadro`
      const viejo = anuncios.get(cuadro);
      if (viejo === undefined) { anuncios.set(cuadro, b[8]); aTodos(paqueteRetraso(cuadro, b[8]), 'tcp'); }   // y se lo paso a todos
      else if (viejo !== b[8]) { est.conflictos++; registro(`[lockstep] dos retrasos para la carrera ${cuadro}: ${viejo} y ${b[8]} (me quedo con el primero)`); }
      return;
    }
    // ¿de esta carrera, de la siguiente (alguien ya empezó) o vieja?
    let destino;
    if (c === (carrera & 255)) destino = { tablas, cortes };
    else if (c === ((carrera + 1) & 255)) { if (!siguiente) siguiente = { carrera: carrera + 1, tablas: new Map(), cortes: new Map() }; destino = siguiente; }
    else return;
    if (tipo === 1) {
      let t = destino.tablas.get(m); if (!t) destino.tablas.set(m, t = new Map());
      const n = b[8];
      for (let i = 0; i < n && 9 + 8 * i + 8 <= b.length; i++) {
        const o = 9 + 8 * i, f = cuadro + i;
        if (!t.has(f)) t.set(f, [d.getUint16(o), d.getInt8(o + 2), d.getInt8(o + 3), d.getInt8(o + 4), d.getInt8(o + 5), d.getUint8(o + 6), d.getUint8(o + 7)]);
      }
      if (destino.tablas === tablas) revisar();
    } else if (tipo === 2) {
      // alguien pide los botones del mando m desde `cuadro`: si los tengo (míos o de otro), se los mando
      const t = destino.tablas.get(m);
      if (t?.has(cuadro) && destino.tablas === tablas) { const p = paqueteBotones(m, cuadro, cuadro + 63); if (p) enviar(de, p, 'udp'); }
    } else if (tipo === 3) {
      if (destino.tablas === tablas) cortar(m, cuadro, false); else destino.cortes.set(m, cuadro);
    } else if (tipo === 5 && destino.tablas === tablas) {
      // el decisor va a cortar el mando m: le digo hasta dónde tengo y reparto lo que tengo (por "tcp": llega antes
      // que la respuesta, en orden)
      const x = ultimoDe(m), p = paqueteBotones(m, Math.max(retraso, x - 63), x);
      if (p) aTodos(p, 'tcp');
      enviar(de, empaca(6, m, x), 'tcp');
    } else if (tipo === 6 && destino.tablas === tablas) {
      propuestas.get(m)?.de.set(de, cuadro);
      revisar();
    } else if (tipo === 4 && b.length >= 12 && destino.tablas === tablas) {
      let e = huellas.get(cuadro); if (!e) huellas.set(cuadro, e = { de: new Map() });
      e.de.set(de, d.getUint32(8));
      revisarHuella(cuadro);
    }
  }

  // §73: la sala dice qué número de carrera viene (quien recargó la página a mitad de la copa entra en la siguiente con
  // el mismo número que los demás: los paquetes llevan ese número)
  // Si el juego está en medio de una carrera (la anterior), sus últimos cuadros van sin esperar (ver pad) y se suelta la
  // espera en curso: quien iba un cuadro atrás esperaría para siempre botones que ya nadie manda.
  let saliendo = null;
  const quietos = () => { const d = new Int32Array(32); for (const p of mandos) { d[p * 8] = 1; for (let k = 0; k < 7; k++) d[p * 8 + 1 + k] = NEUTRO[k]; } return d; };
  function fijarCarrera(k, fuera = null) {
    if (!(k >= 1)) return;
    if (Array.isArray(fuera)) planteles.set(k, new Set(fuera.filter(m => mandos.includes(m))));
    if (ultimo >= 0 && k !== carrera) {               // el juego está en otra carrera (la anterior): a salir de ella
      saliendo = { ultimo }; ultimo = -1;
      if (espera) { const r = espera.resolver; espera = null; propuestas.clear(); r(); }
    }
    if (ultimo < 0 && k - 1 !== carrera) { carrera = k - 1; siguiente = null; }   // la próxima que empiece es la k
  }
  // §75: el humano del mando m avisa que se salta la carrera k (recargó la página con ella andando): si es la que corre
  // esta consola, el decisor lo corta ya (sin el margen); si es la siguiente, queda anotado para cuando empiece
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
  let esperaAnuncio = 0;
  const esperando = () => {
    if (esperaAnuncio) return { uids: [decisorDe(carrera + 1)], ms: ahora() - esperaAnuncio, margen: esperaInicio, llegando: true };
    if (!espera || !espera.faltan?.length) return null;
    const ms = ahora() - espera.desde;
    return { uids: espera.faltan.map(m => duenoDe.get(m)), ms, margen: esperaCorte,
             // los que nunca mandaron nada en esta carrera todavía vienen cargando (no es un corte)
             llegando: espera.faltan.every(m => tabla(m).size === 0) };
  };
  return { pad, alBinario, fijarCarrera, saltar, enCuadro,
    estado: () => ({ ...est, esperaDe: { ...est.esperaDe }, carrera, cuadro: ultimo, miMando, retraso, cortes: Object.fromEntries(cortes), esperando: esperando(),
      rtt: Object.fromEntries([...rtt].map(([u, x]) => [u, Math.round(x.s)])) }),
    detener() { if (latido) clearInterval(latido); } };
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
// no alcanza 60 cuadros por segundo (o su conexión se atrasa), TODA la sala va a su ritmo. Cada 3 s la página compara
// dos fotos de estado() (antes y ahora) y, si hace falta, avisa:
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
