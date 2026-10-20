// La sala nueva de Mario Kart, sin Retro WFC, dentro del marco del juego — bitácora §73 (sala-carrera.mjs; la sala
// vieja de §58, con su cola y su WFC, es sala.mjs).
//
// Resumen: el dueño pidió que el multijugador NO pase por el Wi-Fi del juego: la sala del sitio junta a los pilotos y
// después, en el juego, (1) el anfitrión elige la copa con el selector de la página (fotos, logos y planos de las
// pistas), (2) cada uno elige personaje y vehículo con las pantallas del juego, y (3) se corre. Cada navegador corre la
// MISMA carrera (lockstep.mjs: los botones de todos en cada cuadro) con los humanos como jugadores de verdad y CPU de
// relleno, abierta directo por código (directo.mjs). Este módulo es el "árbitro" que lleva la sala de un paso al otro:
//   fase 'copa'   → el anfitrión elige la copa (una de las del juego: sus 4 pistas). En la PLAYLIST (§74) arma la
//                   lista y los demás le sugieren pistas ({t:'sugiero'}); él acepta o rechaza; recién cuando la
//                   confirma se elige personaje. La lista y las sugerencias van en el estado (lista: ver
//                   playlist-sala.mjs), así que el anfitrión nuevo sigue con ellas;
//   fase 'elegir' → todos eligen personaje, vehículo y derrape (45 s; al que no alcanza se le pone uno);
//   fase 'correr' → la carrera n (1, 2, …): todos arman la misma ficha (pista n, los humanos con lo que eligieron) y
//                   saltan a la carrera; al terminar, el DESCANSO (§94: 30 s de resultados, para que hagan todo) y la
//                   siguiente. En la playlist se puede sugerir y agregar durante la copa (las carreras ya corridas no
//                   se tocan); si en el descanso alguien agrega o sugiere una pista y quedan menos de 15 s, la cuenta
//                   vuelve a 15 s (MINIMO_AL_AGREGAR_MS);
//   fase 'fin'    → la tabla de la copa (para el sitio).
// Manda el ANFITRIÓN: cada segundo (y en cada cambio) les reparte a todos el estado entero ({t:'estado', …}), así
// quien llega tarde o recarga la página se pone al día con el próximo reparto. Los demás le mandan lo suyo: lo que
// eligieron ({t:'pj'}) y que su carrera terminó ({t:'termine'}). Como un tablero de control con un solo operador: los
// paneles muestran lo que dice el tablero y le avisan cuando apretaron algo.
//
// §75, volver después de recargar la página (o de cortarse):
//   - cada segundo TODOS mandan un latido a todos ({t:'aqui', v: número del estado que tienen, salta: n}). La
//     anfitriona anota cuándo oyó a cada uno (vistos) y, al empezar cada carrera, deja en el estado quiénes NO dieron
//     señales en los últimos 10 s (fuera: esos la corren "sin nadie", cortados desde el primer cuadro, en todas las
//     consolas por igual). Quien vuelve deja de estar fuera en la carrera siguiente: mismo puesto y lo que eligió.
//   - quien recarga con una carrera andando no entra a esa carrera (su consola no tiene los cuadros que ya pasaron):
//     la página llama saltar(n) y el latido lleva salta: n. Cada consola, al oírlo, se lo dice a su carrera
//     sincronizada (alSalta → lockstep.saltar) para que lo corte enseguida en vez de esperarlo 30 s.
//   - la página recibe el primer estado recién cuando la sala sabe en qué va (lista): los demás, con el primer reparto
//     de la anfitriona; la anfitriona, cuando oyó a todos (2 a 8 s después de abrir: si recargó, los latidos de los
//     demás traen un número de estado más alto que el suyo, ella les pide la copia —{t:'dame'} → {t:'copia'}— y
//     sigue desde ahí).
//   - los puntos de la copa: al terminar cada carrera cada página manda, con su aviso, los puntos que lleva su consola
//     (12 números) y desde qué carrera corrió. La anfitriona deja en el estado (puntos: {carrera, tabla, desde}) la
//     tabla de quien corrió desde más atrás: la consola que recargó no tiene los puntos de las carreras que se saltó.
//     Cada consola parte la carrera siguiente desde esa tabla (ponerPuntos), y la tabla final sale de ahí.
//
// §94, el descanso, la parrilla y la hora de la anfitriona:
//   - entre carrera y carrera, 30 s de descanso (SEGUNDOS_RESULTADOS). Si la playlist gana una pista o una sugerencia
//     nueva con menos de 15 s por delante, el plazo pasa a ahora + 15 s (lo mismo al abrir «+ Agregar pistas»).
//   - la parrilla, como en Mario Kart: cada uno larga la carrera siguiente en el puesto en que llegó. Con su aviso de
//     fin, cada página manda la llegada (los 12 puestos de su consola: llegadaDelJuego); la anfitriona deja en el
//     estado la primera que le llega (llegada: {carrera, puestos}: todas las que corrieron dicen lo mismo) y cada
//     consola la escribe como «puesto anterior» antes de abrir la siguiente (ponerParrilla). La que recargó también.
//   - los plazos (elegir, descanso) son horas del reloj de la anfitriona: cada reparto lleva su hora (reloj) y cada
//     página anota la diferencia con el suyo (restan(plazo) = lo que falta, igual en todos los PC aunque sus relojes
//     no coincidan).
//
// Los mensajes viajan por la malla (canal "tcp": en orden y sin pérdidas) como bytes: [0xA8, …JSON en UTF-8].
//
// Uso:  const s = crearSala({ yo, humanos: [{uid, mando}], anfitrion, estilo: 'copa'|'playlist', carreras, pistas,
//                             enviar: (uid, bytes) => …, alCambiar: estado => … });
//       malla → s.alBinario(de, bytes) (los que empiezan con MARCA_SALA)
//       anfitrión: s.ponerPistas([{copa, fila}, …]);  todos: s.elegi({ personaje, vehiculo, derrape }),
//       s.termine(n, puntos, desde) (§75: los 12 puntos que lleva esta consola y la primera carrera que corrió)
//       si el anfitrión se va (lo dice la sala del sitio): s.cambiarAnfitrion(uid) en todos → sigue el nuevo, desde su copia
//       §74 playlist: todos s.sugerir(p) → 'sugerida' | 'ya-esta' | 'ya-sugerida' | 'tope' | 'llena' | 'nada';
//       anfitrión: s.listaCambio(pistas) (la lista entera, al armarla), s.restantesCambio(pistas) (las que vienen
//       después de la carrera actual), s.aceptar(id), s.rechazar(id), s.pausar(true|false)
//       §75: alSalta: (uid, n) => … (ese humano se salta la carrera n); s.saltar(n) (esta página se salta la n)
//       §82 VR: s.miVr(vr) (todos: el VR que tengo ahora); vrsDeCarrera(estado, n) = los VR con que se cuenta la n
//       §87: s.quitar(uid) (la sala del sitio lo sacó: echado por el anfitrión, por votación, o se fue)
//
// §82, el VR: cada página le dice a la anfitriona el VR que tiene ({t:'vr'}); ella los lleva en el estado (vrs) y, al
// empezar cada carrera, los congela (vrCarrera: {n, vrs}). Así todas las consolas calculan el VR de esa carrera con
// los MISMOS números (vr-sala.mjs): lo que pierde uno contra otro es lo que el otro gana. §95: y con la misma regla de
// las CPU (vrCarrera.cpu: la REGLA_CPU de la página de la anfitriona; reglaCpuDe(estado, n)).
import { crearPlaylistSala } from './playlist-sala.mjs';
import { VR_MAXIMO, REGLA_CPU } from './vr-sala.mjs';

export const MARCA_SALA = 0xA8;
export const SEGUNDOS_ELEGIR = 45;
export const SEGUNDOS_RESULTADOS = 30;         // §94: el descanso entre carreras (los resultados), antes de la siguiente
export const MINIMO_AL_AGREGAR_MS = 15000;     // §94: agregar o sugerir con menos de esto por delante: vuelve a esto
const REPARTO_MS = 1000;
export const PRESENTE_MS = 10000;      // §75: sin señales en 10 s al empezar una carrera = la corre "sin nadie"
export const ESPERA_COPIA_MS = 2000;   // §75: la anfitriona recién abierta espera 2 s por si la copa ya iba…
export const ESPERA_TODOS_MS = 8000;   // …y hasta 8 s a oír a todos (la malla de una página recién abierta tarda)
// lo que se le pone al que no eligió a tiempo: Mario, Luigi, Peach, Yoshi con el kart estándar de su peso
const POR_OMISION = [[0, 1], [7, 1], [16, 1], [10, 1]];

export function crearSala({ yo, humanos, anfitrion, estilo = 'copa', carreras = 4, pistas = null, enviar, alCambiar = () => {},
  ahora = () => Date.now(), cada = (f, ms) => setInterval(f, ms), parar = id => clearInterval(id),
  registro = () => {}, segundosElegir = SEGUNDOS_ELEGIR, segundosResultados = SEGUNDOS_RESULTADOS, alSalta = () => {} }) {
  let jefe = anfitrion, deQuien = anfitrion;      // quién manda ahora, y de quién vino la última copia aceptada
  const soy = () => jefe === yo;
  const creada = ahora();
  let lista = false;                              // §75: ya sé en qué va la sala (antes, la página no recibe nada)
  const vistos = new Map();                       // §75 (la anfitriona): uid → la última vez que dio señales
  let salto = 0;                                  // §75: la carrera que esta página se salta (recargó con ella andando)
  let pedida = 0;                                 // §75 (la anfitriona): el número de la última copia pedida
  let desfase = 0;                                // §94: reloj de la anfitriona − el mío (los plazos son horas suyas)
  const esHumano = uid => humanos.some(h => h.uid === uid);
  const sacados = new Set();                      // §87: los que salieron de la sala del sitio (echados, votados, idos)
  // §75: los que no dieron señales en PRESENTE_MS (la anfitriona siempre está: es ella la que pregunta). §87: y los que
  // la sala del sitio sacó, aunque su página siga mandando señales
  const ausentes = () => humanos.filter(h => h.uid !== yo && (sacados.has(h.uid) || !(ahora() - (vistos.get(h.uid) ?? -Infinity) <= PRESENTE_MS))).map(h => h.uid);
  const enPlaylist = estilo === 'playlist';
  // §74: la playlist empieza armando la lista (si la sala trae pistas, quedan de base); la copa no tiene lista
  const listaInicial = enPlaylist ? crearPlaylistSala({ estado: { pistas: Array.isArray(pistas) ? pistas : [] } }).exportar() : null;
  // el estado de la sala (el del anfitrión manda; los demás tienen la última copia que les llegó)
  let estado = { fase: 'copa', pistas: null, carreras, carrera: 0, picks: {}, terminaron: {}, plazo: 0, fuera: [], version: 0,
    lista: listaInicial, pausa: 0, vrs: {}, vrCarrera: null, llegada: null };
  // §82: los VR de ahora, congelados para la carrera n (§95: con la regla de las CPU, en JSON: viaja en el estado)
  const congelar = n => ({ n, vrs: { ...(estado.vrs || {}) }, cpu: { ...REGLA_CPU, anclas: [...REGLA_CPU.anclas] } });
  const yaVistas = new Set();                  // carreras que este navegador ya arrancó

  const codificar = m => { const t = new TextEncoder().encode(JSON.stringify(m)); const b = new Uint8Array(t.length + 1); b[0] = MARCA_SALA; b.set(t, 1); return b; };
  const aTodos = m => { const b = codificar(m); for (const h of humanos) if (h.uid !== yo) enviar(h.uid, b); };
  const alAnfitrion = m => { if (soy()) recibir(yo, m); else enviar(jefe, codificar(m)); };

  // ---- el anfitrión: cambia el estado y lo reparte ----
  function cambiar(cambios) {
    estado = { ...estado, ...cambios, version: estado.version + 1 };
    registro(`[sala] ${estado.fase} carrera ${estado.carrera} (v${estado.version})`);
    aTodos({ t: 'estado', estado, reloj: ahora() });
    if (lista) alCambiar(estado);
  }
  function revisar() {
    if (!soy()) return;
    const t = ahora();
    if (estado.fase === 'elegir') {
      const todos = humanos.every(h => estado.picks[h.uid]);
      if (todos || t >= estado.plazo) {
        const picks = { ...estado.picks };
        humanos.forEach((h, i) => { if (!picks[h.uid]) picks[h.uid] = { personaje: POR_OMISION[i % 4][0], vehiculo: POR_OMISION[i % 4][1], derrape: 0, solo: true }; });
        cambiar({ fase: 'correr', carrera: 1, picks, terminaron: {}, plazo: 0, fuera: ausentes(), vrCarrera: congelar(1) });
      }
    } else if (estado.fase === 'correr') {
      // la carrera n terminó para todos los que siguen (o para el anfitrión hace rato: quien se fue no avisa)
      const n = estado.carrera, fin = estado.terminaron[n];
      if (fin && !estado.plazo) cambiar({ plazo: t + segundosResultados * 1000 });
      else if (estado.plazo && t >= estado.plazo) {
        if (n >= estado.carreras) cambiar({ fase: 'fin', plazo: 0, pausa: 0 });
        else cambiar({ carrera: n + 1, plazo: 0, pausa: 0, fuera: ausentes(), vrCarrera: congelar(n + 1) });
      }
    }
  }
  const latido = () => aTodos({ t: 'aqui', v: estado.version, salta: salto });
  const reparto = cada(() => {
    latido();
    if (!soy()) return;
    // §75: la anfitriona recién abierta no reparte nada hasta saber si la copa ya iba (recargó la página): espera 2 s
    // y a haber oído a todos (sus latidos traen el número de estado que tienen; si alguno es más alto, la copia que
    // pidió), con un tope de 8 s por si alguno no está
    if (!lista) {
      const t = ahora() - creada, todos = humanos.every(h => h.uid === yo || vistos.has(h.uid));
      if (t < ESPERA_TODOS_MS && (t < ESPERA_COPIA_MS || !todos || pedida > estado.version)) return;
      ponerLista();
    }
    aTodos({ t: 'estado', estado, reloj: ahora() }); revisar();
  }, REPARTO_MS);
  function ponerLista() { if (lista) return; lista = true; registro(`[sala] lista: ${estado.fase} carrera ${estado.carrera} (v${estado.version})`); alCambiar(estado); }

  // ---- lo que llega (de la malla, o del propio anfitrión) ----
  function recibir(de, m) {
    if (!m || typeof m !== 'object') return;
    if (de !== yo && esHumano(de)) vistos.set(de, ahora());
    if (m.t === 'aqui') {
      // §75: el latido. Si se salta una carrera, que la carrera sincronizada lo sepa; si trae un estado más nuevo que
      // el mío y yo mando (recargué, o soy la anfitriona nueva y otro vio más que yo), le pido la copia
      if ((m.salta | 0) > 0 && esHumano(de)) alSalta(de, m.salta | 0);
      if (soy() && (m.v | 0) > estado.version && (m.v | 0) > pedida && esHumano(de)) { pedida = m.v | 0; enviar(de, codificar({ t: 'dame' })); }
      return;
    }
    if (m.t === 'dame' && de === jefe && !soy()) { enviar(de, codificar({ t: 'copia', estado })); return; }
    if (m.t === 'copia' && soy() && m.estado && typeof m.estado === 'object' && (m.estado.version | 0) > estado.version) {
      // §75: la copia más nueva (la anfitriona recargó): sigue desde ahí, con un número más alto que todos
      estado = m.estado;
      registro(`[sala] copia de ${de}: ${estado.fase} carrera ${estado.carrera} (v${estado.version})`);
      if (!lista) { lista = true; }
      cambiar({});
      revisar();
      return;
    }
    // (del anfitrión nuevo se acepta la primera copia aunque su número sea menor: su copia manda desde ahora; y la
    // primera de todas aunque sea la número 0, §75: con ella la página sabe en qué va la sala)
    // (§94: cada reparto trae la hora de la anfitriona: la diferencia con la mía, para los plazos)
    if (m.t === 'estado' && !soy() && de === jefe && Number.isFinite(m.reloj)) desfase = m.reloj - ahora();
    if (m.t === 'estado' && !soy() && de === jefe && m.estado && (!lista || m.estado.version > estado.version || deQuien !== jefe)) {
      estado = m.estado; deQuien = jefe; lista = true; alCambiar(estado);
    } else if (!lista) {
      return;                                   // (la anfitriona recién abierta: todavía no sabe en qué va la sala)
    } else if (soy() && m.t === 'pj' && esHumano(de) && estado.fase === 'elegir') {
      const p = { personaje: m.personaje | 0, vehiculo: m.vehiculo | 0, derrape: m.derrape | 0 };
      if (p.personaje < 0 || p.personaje > 47 || p.vehiculo < 0 || p.vehiculo > 35) return;
      const antes = estado.picks[de];
      if (antes && antes.personaje === p.personaje && antes.vehiculo === p.vehiculo && antes.derrape === p.derrape) return;   // ya lo tenía
      cambiar({ picks: { ...estado.picks, [de]: p } });
      revisar();
    } else if (soy() && m.t === 'vr' && esHumano(de) && vrValido(m.vr)) {
      // §82: el VR que tiene esa página (cuenta desde la carrera que empiece después: la que corre ya está congelada)
      if ((estado.vrs || {})[de] !== m.vr) cambiar({ vrs: { ...(estado.vrs || {}), [de]: m.vr } });
    } else if (soy() && m.t === 'sugiero' && esHumano(de) && estado.lista && estado.fase !== 'fin') {
      // §74: una sugerencia para la playlist (las reglas: playlist-sala.mjs)
      conLista(pl => pl.sugerir(de, { copa: m.copa, fila: m.fila }));
    } else if (soy() && m.t === 'termine' && m.carrera === estado.carrera && estado.fase === 'correr') {
      const cambio = {};
      if (!estado.terminaron[m.carrera]) cambio.terminaron = { ...estado.terminaron, [m.carrera]: de };
      // §75: los puntos que lleva la copa según esa consola; vale la de quien corrió desde más atrás (quien recargó
      // no tiene los de las carreras que se saltó). Todas las que corrieron todo tienen la misma: la carrera es la misma
      const p = estado.puntos, desde = m.desde > 0 ? m.desde | 0 : 99;
      if (tablaValida(m.puntos) && (!p || p.carrera !== m.carrera || desde < p.desde))
        cambio.puntos = { carrera: m.carrera, tabla: m.puntos.map(x => x | 0), desde };
      // §94: la llegada (la parrilla de la siguiente): la primera que llega; todas las que corrieron dicen lo mismo
      if (llegadaValida(m.llegada) && estado.llegada?.carrera !== m.carrera)
        cambio.llegada = { carrera: m.carrera, puestos: m.llegada.map(x => x | 0) };
      if (Object.keys(cambio).length) { cambiar(cambio); revisar(); }
    }
  }
  // §74: cambiar la lista de la playlist (el anfitrión): el modelo se arma de la copia del estado, se cambia y vuelve al
  // estado. Fuera de la fase de armarla, la lista ES la de las carreras (pistas y cuántas)
  function conLista(f) {
    const pl = crearPlaylistSala({ estado: estado.lista });
    const r = f(pl), lista = pl.exportar();
    if (JSON.stringify(lista) === JSON.stringify(estado.lista)) return r;
    const cambio = { lista };
    if (estado.fase !== 'copa') { cambio.pistas = lista.pistas; cambio.carreras = lista.pistas.length; }
    // §94: una pista más o una sugerencia nueva (sig: el número de la próxima) en el descanso: al menos 15 s más
    const antes = estado.lista || {};
    if (lista.pistas.length > (antes.pistas || []).length || (lista.sig | 0) > (antes.sig | 0)) Object.assign(cambio, alargue());
    cambiar(cambio);
    return r;
  }
  // §94: si el descanso va corriendo y le quedan menos de 15 s, el plazo nuevo (ahora + 15 s); si no, nada
  function alargue() {
    const t = ahora();
    return estado.fase === 'correr' && estado.plazo && estado.plazo - t < MINIMO_AL_AGREGAR_MS ? { plazo: t + MINIMO_AL_AGREGAR_MS } : {};
  }
  const puedeLista = () => soy() && lista && !!estado.lista && (estado.fase === 'copa' || estado.fase === 'correr');
  function alBinario(de, b) {
    if (b[0] !== MARCA_SALA) return;
    try { recibir(de, JSON.parse(new TextDecoder().decode(b.subarray(1)))); } catch {}
  }

  return {
    alBinario,
    estado: () => estado,
    get soyAnfitrion() { return soy(); },
    get anfitrion() { return jefe; },
    // el anfitrión se fue: manda otro (todos lo cambian igual, porque se lo dice la sala del sitio). El nuevo sigue
    // desde su última copia del estado (con un número más alto, para que nadie la tome por vieja)
    cambiarAnfitrion(uid) {
      if (!uid || uid === jefe || !humanos.some(h => h.uid === uid)) return false;
      jefe = uid;
      registro(`[sala] anfitrión nuevo: ${uid}${soy() ? ' (yo)' : ''}`);
      // (la nueva anfitriona da por presentes a todos desde ahora: no los venía oyendo con su reloj)
      if (soy()) { deQuien = yo; lista = true; for (const h of humanos) vistos.set(h.uid, ahora()); cambiar({}); revisar(); }
      else if (lista) alCambiar(estado);
      return true;
    },
    // el anfitrión eligió las pistas con el selector de la página (la copa: sus 4; la playlist: la lista confirmada)
    ponerPistas(pistas) {
      if (!soy() || !lista || estado.fase !== 'copa' || !Array.isArray(pistas) || !pistas.length) return false;
      if (estado.lista) {
        const pl = crearPlaylistSala({ estado: estado.lista });
        if (!pl.ponerPistas(pistas)) return false;
        cambiar({ fase: 'elegir', lista: pl.exportar(), pistas: pl.pistas, carreras: pl.pistas.length, plazo: ahora() + segundosElegir * 1000 });
        return true;
      }
      cambiar({ fase: 'elegir', pistas: pistas.slice(0, 32).map(p => ({ copa: p.copa | 0, fila: p.fila | 0 })), carreras: Math.min(pistas.length, 32),
                plazo: ahora() + segundosElegir * 1000 });
      return true;
    },
    // §74, la playlist. Sugerir (todos): lo que diría la copia que tengo y, si vale, se le manda al anfitrión
    sugerir(p) {
      if (!estado.lista || estado.fase === 'fin') return 'nada';
      const r = crearPlaylistSala({ estado: estado.lista }).revisar(yo, p);
      if (r === 'sugerida') alAnfitrion({ t: 'sugiero', copa: p.copa | 0, fila: p.fila | 0 });
      return r;
    },
    // el anfitrión arma la lista con el selector (cada cambio): la lista entera, mientras se arma
    listaCambio(pistas) {
      if (!puedeLista() || estado.fase !== 'copa' || !Array.isArray(pistas)) return false;
      conLista(pl => pl.ponerPistas(pistas));
      return true;
    },
    // durante la copa: las que vienen después de la carrera actual (las ya corridas, o la que se corre, no se tocan)
    restantesCambio(pistas) {
      if (!puedeLista() || estado.fase !== 'correr' || !Array.isArray(pistas)) return false;
      const corridas = (estado.pistas || []).slice(0, estado.carrera);
      conLista(pl => pl.ponerPistas([...corridas, ...pistas]));
      return true;
    },
    aceptar(id) { return puedeLista() ? conLista(pl => pl.aceptar(id)) : false; },
    rechazar(id) { return puedeLista() ? conLista(pl => pl.rechazar(id)) : false; },
    // «+ Agregar pistas» entre carrera y carrera. §94: ya no congela la cuenta (era hasta 60 s): abrirlo es empezar a
    // agregar, así que si al descanso le quedan menos de 15 s, vuelve a 15 s. Cerrarlo no cambia nada
    pausar(si) {
      if (!soy() || !lista || estado.fase !== 'correr') return false;
      const c = si ? alargue() : {};
      if (Object.keys(c).length) cambiar(c);
      return true;
    },
    // lo que eligió esta persona en las pantallas del juego
    elegi(p) { alAnfitrion({ t: 'pj', ...p }); },
    // §82: el VR que tiene esta persona (al entrar y cada vez que cambia; la página lo repite si la anfitriona no lo tiene)
    miVr(vr) { if (vrValido(vr)) alAnfitrion({ t: 'vr', vr }); },
    // la carrera n terminó en este navegador (solo cuenta la primera vez que alguien lo avisa: es la misma carrera).
    // §75: con los puntos que lleva esta consola (12) y la primera carrera de la copa que corrió
    // §94: y la llegada (los 12 puestos en que terminó cada uno: la parrilla de la carrera siguiente)
    termine(n, puntos = null, desde = 0, llegada = null) { alAnfitrion({ t: 'termine', carrera: n, puntos, desde, llegada }); },
    // §94: cuánto falta para un plazo de la sala (una hora del reloj de la anfitriona), en ms (0 si ya pasó)
    restan(plazo) { return plazo ? Math.max(0, plazo - (ahora() + desfase)) : 0; },
    // ¿esta carrera ya la arranqué? (para arrancar cada una una sola vez)
    arrancar(n) { if (yaVistas.has(n)) return false; yaVistas.add(n); return true; },
    // §75: esta página se salta la carrera n (recargó con ella andando, o la anfitriona la dejó fuera): lo dice en
    // cada latido (0 = ninguna) y ya mismo, para que nadie la espere
    saltar(n) { salto = n | 0; latido(); },
    // §87: la sala del sitio sacó a ese piloto (lo echó el anfitrión, la votación, o se fue): desde la carrera que
    // empiece después queda fuera en todas las consolas (la anfitriona lo pone en `fuera`), aunque siga conectado
    quitar(uid) { if (!esHumano(uid) || uid === yo || sacados.has(uid)) return false; sacados.add(uid); return true; },
    get lista() { return lista; },
    detener() { parar(reparto); },
  };
}

// §82: un VR razonable (entero entre 1 y el tope de vr.mjs)
const vrValido = v => Number.isInteger(v) && v >= 1 && v <= VR_MAXIMO;
// §82: los VR con que se cuenta la carrera n (los congelados al empezarla; si no los hay, los de ahora)
export const vrsDeCarrera = (estado, n) => (estado?.vrCarrera?.n === n ? estado.vrCarrera.vrs : estado?.vrs) || {};
// §95: la regla de las CPU con que se cuenta la carrera n (la congelada; si no la hay —una anfitriona sin §95—,
// undefined: vr-sala.mjs usa entonces la suya, REGLA_CPU)
export const reglaCpuDe = (estado, n) => (estado?.vrCarrera?.n === n ? estado.vrCarrera.cpu : undefined);

// §75: 12 números de 0 a 9999 (los puntos de los 12 puestos)
const tablaValida = t => Array.isArray(t) && t.length === 12 && t.every(x => Number.isInteger(x) && x >= 0 && x <= 9999);
// §94: la llegada: 12 números, 0 (nadie en ese puesto) o del 1 al 12 sin repetir
const llegadaValida = t => Array.isArray(t) && t.length === 12 && t.every(x => Number.isInteger(x) && x >= 0 && x <= 12) &&
  new Set(t.filter(x => x)).size === t.filter(x => x).length;

// Los humanos de la ficha de la carrera n: en el orden de la sala (el mando de cada uno), con lo que eligieron
export function humanosDeFicha(humanos, estado) {
  return humanos.map((h, i) => {
    const p = estado.picks[h.uid] || { personaje: POR_OMISION[i % 4][0], vehiculo: POR_OMISION[i % 4][1] };
    return { personaje: p.personaje, vehiculo: p.vehiculo, mando: h.mando, derrape: p.derrape || 0 };
  });
}

// Los nombres de los personajes (para la tabla: los CPU van con el suyo) — tockdom, List of Identifiers
export const PERSONAJES = ['Mario', 'Baby Peach', 'Waluigi', 'Bowser', 'Baby Daisy', 'Dry Bones', 'Baby Mario', 'Luigi', 'Toad',
  'Donkey Kong', 'Yoshi', 'Wario', 'Baby Luigi', 'Toadette', 'Koopa Troopa', 'Daisy', 'Peach', 'Birdo', 'Diddy Kong', 'King Boo',
  'Bowser Jr.', 'Dry Bowser', 'Funky Kong', 'Rosalina'];

// La tabla de la copa, leída del juego: los puntos que lleva cada uno de los 12 puestos (Racedata: jugador i en
// +0x8 + i·0xF0; tipo +0x10, personaje +0xC, puntos +0xDA). L = el lector de menus.mjs. Los humanos con su nombre
// (nombres: uid → nombre; si no, «Jugador n»), ordenada de más a menos puntos.
// §75: los puntos, del escenario de los MENÚS (+0xC10): al terminar cada carrera el juego deja ahí la suma (el de la
// carrera, +0x20, guarda los que había al EMPEZARLA: leído al final de la copa le faltaba la última carrera).
// puntos = la tabla de la sala (§75: la de quien corrió toda la copa), si la hay; si no, los de esta consola.
export function tablaDelJuego(L, humanos, nombres = {}, puntos = null) {
  const rd = L.u32(0x809BD728);
  if (!rd) return [];
  const esc = rd + 0x20, menus = rd + 0xC10, n = L.u8(esc + 4), filas = [];
  for (let i = 0; i < n && i < 12; i++) {
    const j = esc + 8 + i * 0xF0, tipo = L.u32(j + 0x10);
    if (tipo === 5) continue;
    const h = humanos[i] && tipo === 0 ? humanos[i] : null;
    filas.push({ nombre: h ? (nombres[h.uid] || `Jugador ${i + 1}`) : `${PERSONAJES[L.u32(j + 0xC)] || 'CPU'} (CPU)`, uid: h?.uid || null,
                 puntos: tablaValida(puntos) ? puntos[i] : L.u16(menus + 8 + i * 0xF0 + 0xDA), humano: !!h });
  }
  return filas.sort((a, b) => b.puntos - a.puntos);
}

// §75: los puntos que lleva esta consola (los 12 puestos, escenario de los menús: ahí los suma el juego)
export function puntosDelJuego(L) {
  const rd = L.u32(0x809BD728);
  return rd ? Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)) : null;
}

// §75: que esta consola parta la carrera siguiente con la tabla de la sala: los puntos que lleva cada puesto (+0xDA,
// en dos bytes, el más alto primero: así guarda la Wii los números). escribirFicha (directo_nativo.cpp) los copia a
// "los de antes de esta carrera" (+0xD8), y el juego suma ahí los de la carrera.
export function ponerPuntos(L, tabla) {
  const rd = L.u32(0x809BD728);
  if (!rd || !tablaValida(tabla)) return false;
  tabla.forEach((v, i) => { const a = rd + 0xC10 + 8 + i * 0xF0 + 0xDA; L.w8(a, v >> 8); L.w8(a + 1, v & 0xFF); });
  return true;
}

// §94: la llegada de la carrera que terminó en esta consola: el puesto de cada uno de los 12 (RaceinfoPlayer +0x20,
// el que muestra el juego; con la carrera terminada, el final), 0 donde no hay nadie
export function llegadaDelJuego(L) {
  const rd = L.u32(0x809BD728), ri = L.u32(0x809BD730), lista = ri ? L.u32(ri + 0xC) : 0;
  if (!rd || !lista) return null;
  const n = L.u8(rd + 0x20 + 4);
  return Array.from({ length: 12 }, (_, i) => {
    if (i >= n || L.u32(rd + 0x20 + 8 + i * 0xF0 + 0x10) === 5) return 0;
    const rp = L.u32(lista + 4 * i);
    return rp ? L.u8(rp + 0x20) : 0;
  });
}

// §94: la parrilla de la carrera siguiente, como en Mario Kart: el «puesto anterior» de cada uno (+0xE1, escenario de
// los MENÚS) = el puesto en que llegó (1 = adelante). El juego larga en ese orden (medido, bitácora §94); en el camino
// directo nadie más lo escribe (escribirFicha, directo_nativo.cpp, solo en la primera carrera). cuantos = los
// corredores de la ficha nueva (los primeros cuantos puestos). Si la llegada no sirve (no la hay, o no es del 1 al
// cuantos sin repetir), la de la primera carrera: los humanos atrás, como el juego. Devuelve la que escribió.
export function ponerParrilla(L, llegada, cuantos) {
  const rd = L.u32(0x809BD728);
  if (!rd || !(cuantos >= 1 && cuantos <= 12)) return null;
  const vale = Array.isArray(llegada) && llegada.length >= cuantos &&
    llegada.slice(0, cuantos).sort((a, b) => a - b).every((x, i) => x === i + 1);
  const orden = Array.from({ length: cuantos }, (_, i) => vale ? llegada[i] : cuantos - i);
  orden.forEach((v, i) => L.w8(rd + 0xC10 + 8 + i * 0xF0 + 0xE1, v));
  return { orden, deLlegada: vale };
}
