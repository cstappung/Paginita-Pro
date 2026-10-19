// La sala nueva de Mario Kart, sin Retro WFC, dentro del marco del juego — bitácora §73 (sala-carrera.mjs; la sala
// vieja de §58, con su cola y su WFC, es sala.mjs).
//
// Resumen: el dueño pidió que el multijugador NO pase por el Wi-Fi del juego: la sala del sitio junta a los pilotos y
// después, en el juego, (1) el anfitrión elige la copa con el selector de la página (fotos, logos y planos de las
// pistas), (2) cada uno elige personaje y vehículo con las pantallas del juego, y (3) se corre. Cada navegador corre la
// MISMA carrera (lockstep.mjs: los botones de todos en cada cuadro) con los humanos como jugadores de verdad y CPU de
// relleno, abierta directo por código (directo.mjs). Este módulo es el "árbitro" que lleva la sala de un paso al otro:
//   fase 'copa'   → el anfitrión arma la copa (playlist: ya viene armada de la sala del sitio);
//   fase 'elegir' → todos eligen personaje, vehículo y derrape (45 s; al que no alcanza se le pone uno);
//   fase 'correr' → la carrera n (1, 2, …): todos arman la misma ficha (pista n, los humanos con lo que eligieron) y
//                   saltan a la carrera; al terminar, unos segundos de resultados y la siguiente;
//   fase 'fin'    → la tabla de la copa (para el sitio).
// Manda el ANFITRIÓN: cada segundo (y en cada cambio) les reparte a todos el estado entero ({t:'estado', …}), así
// quien llega tarde o recarga la página se pone al día con el próximo reparto. Los demás le mandan lo suyo: lo que
// eligieron ({t:'pj'}) y que su carrera terminó ({t:'termine'}). Como un tablero de control con un solo operador: los
// paneles muestran lo que dice el tablero y le avisan cuando apretaron algo.
//
// Los mensajes viajan por la malla (canal "tcp": en orden y sin pérdidas) como bytes: [0xA8, …JSON en UTF-8].
//
// Uso:  const s = crearSala({ yo, humanos: [{uid, mando}], anfitrion, estilo: 'copa'|'playlist', carreras, pistas,
//                             enviar: (uid, bytes) => …, alCambiar: estado => … });
//       malla → s.alBinario(de, bytes) (los que empiezan con MARCA_SALA)
//       anfitrión: s.ponerPistas([{copa, fila}, …]);  todos: s.elegi({ personaje, vehiculo, derrape }), s.termine(n)
//       si el anfitrión se va (lo dice la sala del sitio): s.cambiarAnfitrion(uid) en todos → sigue el nuevo, desde su copia
export const MARCA_SALA = 0xA8;
export const SEGUNDOS_ELEGIR = 45;
export const SEGUNDOS_RESULTADOS = 9;          // los resultados de cada carrera, antes de la siguiente
const REPARTO_MS = 1000;
// lo que se le pone al que no eligió a tiempo: Mario, Luigi, Peach, Yoshi con el kart estándar de su peso
const POR_OMISION = [[0, 1], [7, 1], [16, 1], [10, 1]];

export function crearSala({ yo, humanos, anfitrion, estilo = 'copa', carreras = 4, pistas = null, enviar, alCambiar = () => {},
  ahora = () => Date.now(), cada = (f, ms) => setInterval(f, ms), parar = id => clearInterval(id),
  registro = () => {}, segundosElegir = SEGUNDOS_ELEGIR, segundosResultados = SEGUNDOS_RESULTADOS }) {
  let jefe = anfitrion, deQuien = anfitrion;      // quién manda ahora, y de quién vino la última copia aceptada
  const soy = () => jefe === yo;
  const cola = Array.isArray(pistas) && pistas.length ? pistas.slice(0, 32) : null;
  // el estado de la sala (el del anfitrión manda; los demás tienen la última copia que les llegó)
  let estado = { fase: cola && estilo === 'playlist' ? 'elegir' : 'copa', pistas: estilo === 'playlist' ? cola : null,
    carreras: estilo === 'playlist' && cola ? cola.length : carreras, carrera: 0, picks: {}, terminaron: {}, plazo: 0, version: 0 };
  if (estado.fase === 'elegir') estado.plazo = ahora() + segundosElegir * 1000;
  const yaVistas = new Set();                  // carreras que este navegador ya arrancó

  const codificar = m => { const t = new TextEncoder().encode(JSON.stringify(m)); const b = new Uint8Array(t.length + 1); b[0] = MARCA_SALA; b.set(t, 1); return b; };
  const aTodos = m => { const b = codificar(m); for (const h of humanos) if (h.uid !== yo) enviar(h.uid, b); };
  const alAnfitrion = m => { if (soy()) recibir(yo, m); else enviar(jefe, codificar(m)); };

  // ---- el anfitrión: cambia el estado y lo reparte ----
  function cambiar(cambios) {
    estado = { ...estado, ...cambios, version: estado.version + 1 };
    registro(`[sala] ${estado.fase} carrera ${estado.carrera} (v${estado.version})`);
    aTodos({ t: 'estado', estado });
    alCambiar(estado);
  }
  function revisar() {
    if (!soy()) return;
    const t = ahora();
    if (estado.fase === 'elegir') {
      const todos = humanos.every(h => estado.picks[h.uid]);
      if (todos || t >= estado.plazo) {
        const picks = { ...estado.picks };
        humanos.forEach((h, i) => { if (!picks[h.uid]) picks[h.uid] = { personaje: POR_OMISION[i % 4][0], vehiculo: POR_OMISION[i % 4][1], derrape: 0, solo: true }; });
        cambiar({ fase: 'correr', carrera: 1, picks, terminaron: {}, plazo: 0 });
      }
    } else if (estado.fase === 'correr') {
      // la carrera n terminó para todos los que siguen (o para el anfitrión hace rato: quien se fue no avisa)
      const n = estado.carrera, fin = estado.terminaron[n];
      if (fin && !estado.plazo) cambiar({ plazo: t + segundosResultados * 1000 });
      else if (estado.plazo && t >= estado.plazo) {
        if (n >= estado.carreras) cambiar({ fase: 'fin', plazo: 0 });
        else cambiar({ carrera: n + 1, plazo: 0 });
      }
    }
  }
  const reparto = cada(() => { if (soy()) { aTodos({ t: 'estado', estado }); revisar(); } }, REPARTO_MS);

  // ---- lo que llega (de la malla, o del propio anfitrión) ----
  function recibir(de, m) {
    if (!m || typeof m !== 'object') return;
    // (del anfitrión nuevo se acepta la primera copia aunque su número sea menor: su copia manda desde ahora)
    if (m.t === 'estado' && !soy() && de === jefe && m.estado && (m.estado.version > estado.version || deQuien !== jefe)) {
      estado = m.estado; deQuien = jefe; alCambiar(estado);
    } else if (soy() && m.t === 'pj' && humanos.some(h => h.uid === de) && estado.fase === 'elegir') {
      const p = { personaje: m.personaje | 0, vehiculo: m.vehiculo | 0, derrape: m.derrape | 0 };
      if (p.personaje < 0 || p.personaje > 47 || p.vehiculo < 0 || p.vehiculo > 35) return;
      const antes = estado.picks[de];
      if (antes && antes.personaje === p.personaje && antes.vehiculo === p.vehiculo && antes.derrape === p.derrape) return;   // ya lo tenía
      cambiar({ picks: { ...estado.picks, [de]: p } });
      revisar();
    } else if (soy() && m.t === 'termine' && m.carrera === estado.carrera && estado.fase === 'correr' && !estado.terminaron[m.carrera]) {
      cambiar({ terminaron: { ...estado.terminaron, [m.carrera]: de } });
      revisar();
    }
  }
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
      if (soy()) { deQuien = yo; cambiar({}); revisar(); } else alCambiar(estado);
      return true;
    },
    // el anfitrión eligió las pistas con el selector de la página
    ponerPistas(lista) {
      if (!soy() || estado.fase !== 'copa' || !Array.isArray(lista) || !lista.length) return false;
      cambiar({ fase: 'elegir', pistas: lista.slice(0, 32).map(p => ({ copa: p.copa | 0, fila: p.fila | 0 })), carreras: Math.min(lista.length, 32),
                plazo: ahora() + segundosElegir * 1000 });
      return true;
    },
    // lo que eligió esta persona en las pantallas del juego
    elegi(p) { alAnfitrion({ t: 'pj', ...p }); },
    // la carrera n terminó en este navegador (solo cuenta la primera vez que alguien lo avisa: es la misma carrera)
    termine(n) { alAnfitrion({ t: 'termine', carrera: n }); },
    // ¿esta carrera ya la arranqué? (para arrancar cada una una sola vez)
    arrancar(n) { if (yaVistas.has(n)) return false; yaVistas.add(n); return true; },
    detener() { parar(reparto); },
  };
}

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

// La tabla de la copa, leída del juego: los puntos que lleva cada uno de los 12 puestos (Racedata, la carrera +0x20:
// jugador i en +0x8 + i·0xF0; tipo +0x10, personaje +0xC, puntos +0xDA). L = el lector de menus.mjs. Los humanos con su
// nombre (nombres: uid → nombre; si no, «Jugador n»), ordenada de más a menos puntos.
export function tablaDelJuego(L, humanos, nombres = {}) {
  const rd = L.u32(0x809BD728);
  if (!rd) return [];
  const esc = rd + 0x20, n = L.u8(esc + 4), filas = [];
  for (let i = 0; i < n && i < 12; i++) {
    const j = esc + 8 + i * 0xF0, tipo = L.u32(j + 0x10);
    if (tipo === 5) continue;
    const h = humanos[i] && tipo === 0 ? humanos[i] : null;
    filas.push({ nombre: h ? (nombres[h.uid] || `Jugador ${i + 1}`) : `${PERSONAJES[L.u32(j + 0xC)] || 'CPU'} (CPU)`, uid: h?.uid || null,
                 puntos: L.u16(j + 0xDA), humano: !!h });
  }
  return filas.sort((a, b) => b.puntos - a.puntos);
}
