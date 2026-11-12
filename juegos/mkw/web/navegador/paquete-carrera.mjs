// El paquete de carrera de la página (bitácora §169: D4, U2 y la parte de un jugador de D1).
//
// Resumen: apenas el juego sabe cómo va a ser la carrera (la pista que eligió Pulsar y los 12 puestos con su personaje,
// vehículo y skin de Retro Rewind), la página pide de una vez, con prioridad normal, todo lo que la carrera va a leer:
// la pista, los 12 karts y sus pilotos, y del archivo de sonido revo_kart.brsar los grupos de la carrera, los de la
// pista y la voz de cada uno. Así:
//   - los 11 karts de las CPU dejan de pedirse de a uno, ~80 ms cada uno (D4): van juntos en uno o dos lotes;
//   - la pista se pide apenas se elige, no 1–3 s después cuando el juego la abre (U2); en Grand Prix, además, las otras
//     3 de la copa con prioridad baja;
//   - lo que el juego tocaba por primera vez en la presentación (las voces de los 12 y los grupos de la carrera; §150 y
//     §168: 14–15 lecturas a la red con la carrera ya armada) está en la memoria antes.
// También, la primera vez que el juego lee la música de una pista (strm/<x>_N.brstm), se pide entera, y el principio
// de las fanfarrias de la meta.
//
// Lo que se lee de la memoria del juego (las mismas direcciones que modos.mjs, prueba-directa y nombres-juego.mjs):
//   Racedata 0x809BD728 → +0x20 la carrera (RacedataScenario): +0x4 cuántos jugadores, +0x8 + i·0xF0 cada puesto
//     (+0x8 vehículo, +0xC personaje, +0x10 tipo: 0 persona, 1 CPU, 5 nadie); +0xB48 los ajustes: +0x0 la casilla de la
//     pista (0–31, la que usa el juego para la música y los sonidos), +0x8 el modo (0 Grand Prix).
//   0x8043319C + 0x10: la pista que eligió Pulsar (su número = el archivo Tracks/<n>.szs).
//   La skin de Retro Rewind de cada puesto (racePlayerSlots, 0x818A08A8, u8[12], 0 = la de siempre): el lector de la
//     página no llega más arriba de 0x81800000, así que se lee la copia que deja nombres_nativo.cpp al final de
//     Racedata_InitRace (leerSkins de nombres-juego.mjs; recién ahí sortea RR, después de que aparece el Raceinfo).
//
// Uso:  armarPaquete(ficha, { existe, grupos }) → { piezas: [[ruta, inicio, fin]…], baja: […], faltan: [rutas] }  (puro)
//       crearPaquete({ L, disco, tamaños, direccion, grupos, nota, pistaTemprana }) → { revisar(), alLeer(ruta), estado }
//       leerPistaElegida(L), armarPista(e, existe): la pista apenas se elige en los menús (U2)
//       pedirPista(pista): la pista que ya sabe la sala, con su música (§176)
// ?paqueteCarrera=0 = sin esto (como antes de §169); ?pistaTemprana=0 = sin pedir la pista al elegirla (solo con la ficha);
// ?musicaPaquete=0 = la música de la pista recién cuando el juego la lee (como antes de §176); ?comunCarrera=0 = sin lo
// de toda carrera (COMUN_CARRERA); ?aprender=0 = sin lo aprendido por pista; ?vocesAmbas=0 = del brsar solo la voz del
// lado de cada uno (CPU _NPC, persona _PC) y ninguna con una skin con voz propia.

// el personaje (0–23) → su sigla en los archivos (kart, piloto, retrato y voz)
export const SIGLAS = ['mr', 'bpc', 'wl', 'kp', 'bds', 'ka', 'bmr', 'lg', 'ko', 'dk', 'ys', 'wr', 'blg', 'kk', 'nk', 'ds',
  'pc', 'ca', 'dd', 'kt', 'jr', 'bk', 'fk', 'rs'];
// el vehículo (0–35) → su nombre en Race/Kart: s/m/l (tamaño) + df (el de siempre) o a–e, kart y moto
const VARIANTES = ['sdf', 'mdf', 'ldf', 'sa', 'ma', 'la', 'sb', 'mb', 'lb', 'sc', 'mc', 'lc', 'sd', 'md', 'ld', 'se', 'me', 'le'];
export const VEHICULOS = [...VARIANTES.map(v => v + '_kart'), ...VARIANTES.map(v => v + '_bike')];
// la casilla de la pista (0–31) → su grupo de sonidos en revo_kart.brsar (en el mismo orden que las casillas)
export const GRUPOS_PISTA = ['N_CASTLE', 'N_FARM', 'N_KINOKO', 'N_VOLCANO', 'N_FACTORY', 'N_SHOPPING', 'N_BOARDCROSS',
  'N_TRUCK', 'N_BEGINNER', 'N_SENIOR', 'N_RIDGEHIGHWAY', 'N_TREEHOUSE', 'N_KOOPA', 'N_RAINBOW', 'N_DESERT', 'N_WATER',
  'R_GC_PEACH', 'R_GC_MARIO', 'R_GC_WALUIGI', 'R_GC_DONKEY', 'R_DS_FALLS', 'R_DS_DESERT', 'R_DS_GARDEN', 'R_DS_TOWN',
  'R_SFC_MARIO', 'R_SFC_OBAKE', 'R_64_MARIO', 'R_64_SHERBET', 'R_64_KOOPA', 'R_64_DONKEY', 'R_GBA_KOOPA', 'R_GBA_HEIHO']
  .map(n => 'GRP_GP_' + n);
export const BRSAR = '/mkw/disco/files/sound/revo_kart.brsar';
const RR = '/mkw/sd/RetroRewind6';
// el principio de las fanfarrias de la meta (el juego lee ~0,2 MB de una en plena carrera; el resto ya en la meta)
export const FANFARRIAS = ['o_FanfareGP1_32', 'o_FanfareGP2_32', 'o_FanfareGPdame_32'].map(n => `/mkw/disco/files/sound/strm/${n}.brstm`);
const PRINCIPIO_FANFARRIA = 512 * 1024;
// §176 (D1): lo que toda carrera leía con la carrera andando y no estaba en el paquete (medido con la 13.2 en este PC y
// en la gama baja, tanda 176): dos pedazos de StaticR.rel (va entero: 4,9 MB, ya casi todo en la caché del arranque) y
// el principio de la fanfarria de la largada
export const COMUN_CARRERA = ['/mkw/disco/files/rel/StaticR.rel', '/mkw/disco/files/sound/strm/o_Start32_fan.brstm'];
// Lo que el juego tuvo que bajar en plena carrera, aprendido por pista en este navegador (localStorage): la próxima
// carrera en esa pista lo pide con el paquete. Así se arma solo el «manifiesto de carreras» del plan (D1): los sonidos de
// cada pista (dos grupos GRP_GP_* que no salen de la casilla) y lo que cambie en otra versión. Tope: 60 pistas, 64
// pedazos cada una
export const CLAVE_APRENDIDO = 'mkw.paquete.aprendido';
const MAX_PISTAS = 60, MAX_PEDAZOS = 64;
export function crearMemoriaLocal(clave = CLAVE_APRENDIDO) {
  return {
    leer() { try { return JSON.parse(localStorage.getItem(clave) || '{}') || {}; } catch { return {}; } },
    guardar(o) { try { localStorage.setItem(clave, JSON.stringify(o)); } catch {} },
  };
}

// La ficha que se lee de la memoria (null si todavía no hay una carrera armada)
// skins: las 12 skins (de leerSkins) o null (= 0 en todos)
// Solo vale con una carrera en camino: la sección actual o la siguiente es de carrera (0x1E Grand Prix … 0x2B, las de un
// jugador, VS, equipos y batalla; la sala usa las de VS) o ya hay Raceinfo. Al arrancar, el escenario trae una ficha por
// omisión (Luigi Circuit con 12 puestos): pedirla eran 13 MB de más en cada arranque (medido en la tanda de U2).
export const SECCION_CARRERA = s => s >= 0x1E && s <= 0x2B;
export function carreraEnCamino(L) {
  if (L.u32(0x809BD730)) return true;
  const sm = L.u32(0x809C1E38);
  if (!sm) return false;
  const sec = L.u32(sm), sig = L.u32(sm + 0xC) | 0;
  return (sec && SECCION_CARRERA(L.u32(sec) | 0)) || SECCION_CARRERA(sig);
}
export function leerFicha(L, skins = null) {
  const rd = L.u32(0x809BD728);
  if (!rd || !carreraEnCamino(L)) return null;
  const esc = rd + 0x20, n = L.u8(esc + 4);
  if (!n || n > 12) return null;
  const puestos = [];
  for (let i = 0; i < 12; i++) {
    const j = esc + 8 + i * 0xF0, tipo = L.u32(j + 0x10);
    if (tipo === 5 || i >= n) continue;
    puestos.push({ i, tipo, veh: L.u32(j + 8), pj: L.u32(j + 0xC), skin: skins?.[i] || 0 });
  }
  return { pista: L.u32(0x8043319C + 0x10), casilla: L.u32(esc + 0xB48), modo: L.u32(esc + 0xB48 + 8), puestos };
}

// La pista apenas se elige (U2, §169): la que anotó Pulsar (0x8043319C + 0x10) y el modo del escenario de los MENÚS
// (Racedata + 0xC10: el que llenan las pantallas de personaje y de pista; la carrera, +0x20, se arma recién al cargar).
// null si todavía no hay Racedata.
// (solo vale en los menús: la sección es de menús, 0x41 el menú principal en adelante, y no de carrera. Al arrancar y en el
// título, Pulsar pasa de 0 a su pista por omisión con el modo en 0, y eso no es una elección; medido en la tanda de U2. La
// pantalla de arriba no sirve para esto: en el VS de RR, cuando Pulsar anota la pista, arriba ya no está la de pistas)
export function enMenus(L) {
  const sm = L.u32(0x809C1E38), sec = sm ? L.u32(sm) : 0;
  if (!sec) return false;
  const id = L.u32(sec) | 0;
  return id >= 0x41 && id <= 0x7F && !SECCION_CARRERA(id);
}
export function leerPistaElegida(L) {
  const rd = L.u32(0x809BD728);
  if (!rd || !enMenus(L)) return null;
  return { pista: L.u32(0x8043319C + 0x10), modo: L.u32(rd + 0xC10 + 0xB48 + 8) };
}

// Qué pedir con solo la pista elegida: la pista entera y, en Grand Prix (modo 0), las otras 3 de la copa con prioridad baja
export function armarPista({ pista, modo }, existe, { musica = true, ultima = true } = {}) {
  const piezas = [], baja = [];
  const n = archivoDePista(pista);
  if (n < 0) return { piezas, baja };
  const ruta = k => `${RR}/Tracks/${k}.szs`;
  if (existe(ruta(n))) piezas.push([ruta(n), 0, existe(ruta(n))]);
  // (§176, D1: también su música, ver musicaDePista)
  const mus = musica ? musicaDePista(n) : null;
  if (mus && existe(mus)) piezas.push([mus, 0, existe(mus)]);
  const fin = musica && ultima ? musicaUltimaDePista(n) : null;   // (§285)
  if (fin && existe(fin)) piezas.push([fin, 0, existe(fin)]);
  if (modo === 0) for (let k = n - (n % 4); k < n - (n % 4) + 4; k++) if (k !== n && existe(ruta(k))) baja.push([ruta(k), 0, existe(ruta(k))]);
  return { piezas, baja };
}

// Una clave por carrera: si cambia, es otra carrera (o el juego terminó de sortear las CPU o las skins)
export const claveDe = f => f ? [f.pista, f.casilla, f.modo, ...f.puestos.map(p => `${p.tipo}.${p.veh}.${p.pj}.${p.skin}`)].join(',') : '';

// Qué pedir para esa ficha. existe(ruta) → tamaño (o 0); grupos: nombre → [inicio, fin) dentro de revo_kart.brsar
export function armarPaquete(f, { existe, grupos = new Map(), archivos = [], musica = true, comun = true, vocesAmbas = true, ultima = true, fanfarrias = true }) {
  const piezas = [], baja = [], faltan = [], vistas = new Set();
  const entero = (ruta, lista = piezas) => {
    const tam = existe(ruta);
    if (!tam) { faltan.push(ruta); return; }
    if (vistas.has(ruta)) return;
    vistas.add(ruta); lista.push([ruta, 0, tam]);
  };
  const grupo = nombre => {
    const g = grupos.get(nombre);
    if (g && !vistas.has(nombre)) { vistas.add(nombre); piezas.push([BRSAR, g[0], g[1]]); }
  };
  if (!f) return { piezas, baja, faltan };
  // 1) la pista (y en Grand Prix las otras 3 de la copa, con prioridad baja). Pulsar numera las pistas de Retro
  //    Rewind desde 0x100 (la copa c, pista k = 0x100 + 4c + k, medido: 0.0 → 256, 13.2 → 310); el archivo es
  //    Tracks/<4c + k>.szs
  const n = archivoDePista(f.pista);
  if (n >= 0) entero(`${RR}/Tracks/${n}.szs`);
  // 1b) §176 (D1): la música de la pista, entera (~4–5 MB), con el paquete. Antes se pedía recién en la primera lectura
  //     del juego (musicaDe, en alLeer), que es al empezar la presentación: se bajaba con la carrera ya andando (medido en
  //     §174.4: 3 pedidos y 5,6 MB a la red en la carrera, sin espera del juego, pero en plena carrera)
  const mus = musica && n >= 0 ? musicaDePista(n) : null;
  if (mus && existe(mus)) entero(mus);
  const musF = musica && ultima && n >= 0 ? musicaUltimaDePista(n) : null;   // (§285: la de la última vuelta)
  if (musF && existe(musF)) entero(musF);
  if (f.modo === 0 && n >= 0) for (let k = 0; k < 4; k++) {
    const otra = n - (n % 4) + k;
    if (otra !== n) entero(`${RR}/Tracks/${otra}.szs`, baja);
  }
  // 2) los karts y los pilotos de los 12 (la skin 0 es el kart del disco; las otras, las de Retro Rewind)
  for (const p of f.puestos) {
    const pj = SIGLAS[p.pj], veh = VEHICULOS[p.veh];
    if (!pj || !veh) continue;                       // (un Mii: sus archivos se llaman distinto, los lee el juego)
    if (p.skin > 0) {
      entero(`${RR}/Character/${veh}-${pj}-${p.skin}.szs`);      // (Character/Driver/<pj>-<skin>.brres no: el juego no lo lee, §169)
    } else entero(`/mkw/disco/files/Race/Kart/${veh}-${pj}.szs`);
  }
  // 3) del archivo de sonido: lo de la carrera y la voz de cada uno (CPU: _NPC; persona: _PC). Los sonidos de la pista
  //    no: cada pista toca dos grupos GRP_GP_* que no salen de la casilla (medido en §169: 30.2 tiene casilla 0 y toca
  //    TRUCK/BEGINNER y GC_PEACH/GC_MARIO); van al manifiesto de D1
  grupo('GRP_RACE'); grupo('GRP_PRESENT');
  for (const p of f.puestos) {
    const pj = SIGLAS[p.pj];
    if (!pj) continue;
    // con skin de Retro Rewind que trae voz, la voz sale de sus archivos de Character/Sound: solo
    // GRP_VO_<PJ>-<skin>_NPC (CPU) o _PC (persona), .brwsd y .brbnk, a veces con un sufijo (.baby_peach) y en minúsculas
    // (medido en §169: las variantes _CAN_ y _GOL_ no se leen en la carrera); sin skin, o con una skin sin voz propia, el
    // juego usa el grupo del brsar
    const lado = p.tipo === 0 ? 'PC' : 'NPC';
    // (§285: con vocesAmbas, también la voz de la skin del otro lado: medido con la 13.2, el juego lee en la presentación
    // el .brbnk _PC de la skin de cada CPU)
    const voz = p.skin > 0 ? [...vozDeSkin(archivos, pj, p.skin, lado), ...(vocesAmbas ? vozDeSkin(archivos, pj, p.skin, lado === 'PC' ? 'NPC' : 'PC') : [])] : [];
    if (voz.length) for (const ruta of voz) entero(ruta);
    else grupo(`GRP_VO_${pj.toUpperCase()}_${lado}`);
    // §176 (D1): el juego lee igual del brsar las dos voces de cada personaje de la carrera (_PC y _NPC), también con una
    // skin que trae voz propia: medido en 33 carreras guardadas (bitácora §176), los bloques que iban a la red en plena
    // carrera eran esos grupos (GRP_VO_MR_PC/NPC, …) de los personajes de las CPU. ?vocesAmbas=0 = solo la del lado, como antes
    if (vocesAmbas) { grupo(`GRP_VO_${pj.toUpperCase()}_PC`); grupo(`GRP_VO_${pj.toUpperCase()}_NPC`); }
  }
  // 4b) §176 (D1): lo de toda carrera (StaticR entero, el principio de la fanfarria de la largada)
  if (comun) { entero(COMUN_CARRERA[0]); const t = existe(COMUN_CARRERA[1]); if (t && !vistas.has(COMUN_CARRERA[1])) { vistas.add(COMUN_CARRERA[1]); piezas.push([COMUN_CARRERA[1], 0, Math.min(t, PRINCIPIO_FANFARRIA)]); } }
  // 4) las fanfarrias de la meta: enteras (§285: también lo que suena al cruzar la meta; fanfarrias = false
  //    —?fanfarriaEntera=0— = solo el principio, como antes)
  for (const ruta of FANFARRIAS) { const tam = existe(ruta); if (tam) piezas.push([ruta, 0, fanfarrias ? tam : Math.min(tam, PRINCIPIO_FANFARRIA)]); }
  // 5) el retrato de la tabla de la meta de cada skin (10 KB; los íconos del minimapa ya van en diminutos.bin)
  for (const p of f.puestos) {
    const pj = SIGLAS[p.pj];
    if (pj && p.skin > 0) { const ruta = `${RR}/Character/Portrait/${pj}-${p.skin}-css.tpl`; if (existe(ruta)) entero(ruta); }
  }
  return { piezas, baja, faltan };
}

// Los archivos de voz de una skin de Retro Rewind: GRP_VO_<PJ>-<skin>_<NPC|PC>.brwsd y .brbnk (con o sin sufijo, sin
// importar mayúsculas); vacío si la skin no trae voz propia
export function vozDeSkin(archivos, pj, skin, lado) {
  const re = new RegExp(`/Character/Sound/GRP_VO_${pj}-${skin}_${lado}\\.(brwsd|brbnk)(\\.[a-z_]+)?$`, 'i');
  const r = [];
  for (const ruta of archivos) if (re.test(ruta)) r.push(ruta);
  return r;
}

// El archivo de una pista de Pulsar: las de Retro Rewind van desde 0x100 (Tracks/<n − 256>.szs); -1 si no es una
export const archivoDePista = p => p >= 0x100 && p < 0x100 + 4096 ? p - 0x100 : -1;

// La música de una pista de Retro Rewind: el mismo número que su archivo (Tracks/54.szs → strm/54_N.brstm, medido en
// §174.4 con la 13.2). La de la última vuelta (<n>_F) no va: otros 4 MB que se leen recién en la última vuelta
export const musicaDePista = n => n >= 0 ? `${RR}/strm/${n}_N.brstm` : null;
// §285 (el dueño: «no se debiera descargar nada durante la carrera incluyendo el lakitu de la vuelta 3»): la de la última
// vuelta (<n>_F, ~4 MB) va también con el paquete. ultima = false (?musicaUltima=0) = como antes
export const musicaUltimaDePista = n => n >= 0 ? `${RR}/strm/${n}_F.brstm` : null;

// La música de la pista: la primera lectura de strm/<x>_N.brstm la pide entera (~4 MB, así no se baja de a poco en
// plena carrera). La de la última vuelta (<x>_F) no: otros 4 MB que en la sala de §169 seguían bajando en la carrera
export function musicaDe(ruta, ultima = true) {
  const m = /^(.*\/strm\/.+)_N\.brstm$/.exec(ruta);
  return m ? [m[1] + '_N.brstm', ...(ultima ? [m[1] + '_F.brstm'] : [])] : null;
}

export function crearPaquete({ L, disco, tamaños, direccion, grupos, skins = () => null, nota = () => {}, pistaTemprana = true, musica = true, comun = true, vocesAmbas = true, ultima = true, fanfarrias = true,
                              memoria = null,
                              reloj = () => performance.now(), quietaMs = 1000, alPista = () => {} }) {
  // (alPista(pista): §174, C2: la pista quedó elegida o llegó su ficha; mkw.mjs pide sus pipelines a aurora)
  const estado = { carreras: 0, piezas: 0, mb: 0, faltan: [], ultima: null, musicas: 0, tempranas: 0, temprana: null };
  // U2: la pista de Pulsar que se vio la primera vez (la de antes de elegir: no se pide) y la última pedida
  let pistaVista = undefined, pistaPedida = -1, candidata = -1, desde = 0;
  const archivos = [...tamaños.keys()];
  const existe = ruta => tamaños.get(ruta) || 0;
  let clave = '';
  const musicaPedida = new Set();
  // §285: las piezas de la carrera que viene (la ficha de la sala y la del juego), para saber cuánto falta bajar
  let actuales = [];
  // §176: lo aprendido por pista (memoria = { leer, guardar }; null = no se aprende) y la vuelta de dirección a ruta
  const deUrl = new Map(archivos.map(r => [String(direccion(r)).split('?')[0], r]));
  let aprendido = memoria ? memoria.leer() : {};
  const aprendidasDe = pista => {
    const b = disco.bloque || 262144, r = [];
    for (const [ruta, b0, n] of aprendido[pista] || []) { const tam = existe(ruta); if (tam && b0 * b < tam) r.push([ruta, b0 * b, Math.min(tam, (b0 + n) * b)]); }
    return r;
  };
  // al terminar una carrera, mkw.mjs le pasa lo que tuvo que ir a la red (mkwFaltas de esa carrera: [dirección, bloque, cuántos])
  function aprender(pista, faltas) {
    if (!memoria || !(pista >= 0) || !faltas?.length) return 0;
    const ya = new Set((aprendido[pista] || []).map(x => x[0] + '|' + x[1]));
    const nuevas = [];
    for (const [url, b0, n] of faltas) {
      const ruta = deUrl.get(String(url).split('?')[0]);
      if (!ruta || ya.has(ruta + '|' + b0)) continue;
      ya.add(ruta + '|' + b0); nuevas.push([ruta, b0, n || 1]);
    }
    if (!nuevas.length) return 0;
    aprendido = memoria.leer();                        // (otra pestaña pudo aprender algo)
    aprendido[pista] = [...(aprendido[pista] || []), ...nuevas].slice(-MAX_PEDAZOS);
    const pistas = Object.keys(aprendido);
    if (pistas.length > MAX_PISTAS) for (const k of pistas.slice(0, pistas.length - MAX_PISTAS)) delete aprendido[k];
    memoria.guardar(aprendido);
    estado.aprendidas = (estado.aprendidas || 0) + nuevas.length;
    nota(`paquete de carrera: la pista ${pista} bajó ${nuevas.length} pedazos en la carrera → la próxima vez van con el paquete`);
    return nuevas.length;
  }
  function pedir(lista, baja) {
    let bytes = 0;
    for (const [ruta, ini, fin] of lista) {
      const url = direccion(ruta), tam = tamaños.get(ruta);
      if (baja) disco.adelantarBloques(url, tam, Math.floor(ini / disco.bloque), Math.floor((fin - 1) / disco.bloque));
      else disco.adelantarRango(url, tam, ini, fin);
      bytes += fin - ini;
    }
    return bytes;
  }
  // (cada 200 ms fuera de la carrera, desde mkw.mjs: ~40 lecturas de la memoria)
  function revisar() {
    if (pistaTemprana) revisarPista();
    let f = null;
    try { f = leerFicha(L, skins()); } catch { return; }
    const k = claveDe(f);
    if (!f || !f.puestos.length || k === clave) return;
    clave = k;
    const t0 = performance.now();
    const { piezas, baja, faltan } = armarPaquete(f, { existe, grupos, archivos, musica, comun, vocesAmbas, ultima, fanfarrias });
    piezas.push(...aprendidasDe(f.pista));
    for (const [r] of piezas) if (musicaDe(r) && !musicaPedida.has(r)) { musicaPedida.add(r); estado.musicas++; }   // (§176: ya va; alLeer no la repite)
    const bytes = pedir(piezas, false);
    pedir(baja, true);
    actuales.push(...piezas);
    try { alPista(f.pista); } catch {}
    const ruta0 = piezas.find(x => /\/Tracks\//.test(x[0]))?.[0];
    if (ruta0 && estado.pista?.ruta !== ruta0) estado.pista = { ruta: ruta0, pedida: Math.round(performance.now()), por: 'ficha' };
    estado.carreras++; estado.piezas += piezas.length; estado.mb = +(bytes / 1048576).toFixed(1);
    estado.faltan = faltan.slice(0, 20);
    estado.rutas = [...new Set(piezas.map(x => x[0]))];
    estado.ultima = { pista: f.pista, casilla: f.casilla, modo: f.modo, piezas: piezas.length, baja: baja.length, mb: estado.mb,
                      ms: +(performance.now() - t0).toFixed(1) };
    nota(`paquete de carrera: pista ${f.pista} (casilla ${f.casilla}), ${f.puestos.length} puestos → ${piezas.length} piezas, ` +
         `${estado.mb} MB con prioridad normal${baja.length ? ` y ${baja.length} pistas de la copa con prioridad baja` : ''}` +
         (faltan.length ? ` (no existen: ${faltan.length})` : ''));
  }
  // U2: si Pulsar anotó otra pista desde la última vez, se pide ya (la primera que se ve es la de antes de elegir: solo se
  // anota). La ficha de la carrera, cuando llegue, no la vuelve a pedir (el disco no repite lo que ya tiene o tiene en camino).
  function revisarPista() {
    let e = null;
    try { e = leerPistaElegida(L); } catch { return; }
    if (!e) return;
    if (pistaVista === undefined) { pistaVista = e.pista; return; }
    if (e.pista === pistaVista || e.pista === pistaPedida) { candidata = -1; return; }
    // (tiene que quedar quieta quietaMs: si el valor cambiara al pasar por la lista, no se pide cada una)
    if (e.pista !== candidata) { candidata = e.pista; desde = reloj(); return; }
    if (reloj() - desde < quietaMs) return;
    pistaVista = e.pista; candidata = -1;
    const { piezas, baja } = armarPista(e, existe, { musica, ultima });
    for (const [r] of piezas) if (musicaDe(r) && !musicaPedida.has(r)) { musicaPedida.add(r); estado.musicas++; }
    if (!piezas.length) return;
    piezas.push(...aprendidasDe(e.pista));
    pistaPedida = e.pista;
    pedir(piezas, false); pedir(baja, true);
    try { alPista(e.pista); } catch {}
    estado.pista = { ruta: piezas[0][0], pedida: Math.round(performance.now()), por: 'eleccion' };
    estado.tempranas++;
    estado.temprana = { pista: e.pista, modo: e.modo, baja: baja.length, t: Math.round(performance.now()) };
    nota(`paquete de carrera: pista ${e.pista} elegida → la pido ya${baja.length ? ` (y ${baja.length} de la copa con prioridad baja)` : ''}`);
  }
  // cada lectura del juego (anotarLectura de mkw.mjs): la música de la pista, entera, la primera vez
  function alLeer(ruta) {
    // (para medir U2: cuánto antes de que el juego abriera la pista se la pidió; adelantoMs en estado.pista)
    if (estado.pista && !estado.pista.leida && ruta === estado.pista.ruta) {
      estado.pista.leida = Math.round(performance.now()); estado.pista.adelantoMs = estado.pista.leida - estado.pista.pedida;
    }
    const m = musicaDe(ruta, ultima);
    if (!m || musicaPedida.has(m[0])) return;
    musicaPedida.add(m[0]);
    pedir(m.filter(existe).map(r => [r, 0, tamaños.get(r)]), false);
    estado.musicas++;
  }
  // §176 (D1 en la sala): en la sala la pista no se elige en los menús del juego (U2 no la ve): la elige la sala y la
  // página la sabe apenas se arma la copa o la lista. pedirPista la pide entera con su música (una vez cada una), en
  // la elección y en el descanso; mkw.mjs no la llama con la carrera andando
  const pistasSala = new Set();
  function pedirPista(pista, modo = 1) {
    if (pistasSala.has(pista)) return false;
    const { piezas, baja } = armarPista({ pista, modo }, existe, { musica, ultima });
    if (!piezas.length) return false;
    piezas.push(...aprendidasDe(pista));
    pistasSala.add(pista);
    for (const [r] of piezas) if (musicaDe(r) && !musicaPedida.has(r)) { musicaPedida.add(r); estado.musicas++; }
    const mb = +(pedir(piezas, false) / 1048576).toFixed(1); pedir(baja, true);
    estado.sala = (estado.sala || 0) + 1;
    nota(`paquete de carrera: la sala ya sabe la pista ${pista} → la pido con su música (${mb} MB)`);
    return true;
  }
  // §176 (D1 en la sala): la ficha que arma la página (directo.mjs armarFicha) ya dice la pista y los 12 puestos antes
  // de que el juego arme la carrera; en la sala, la ficha del juego aparece recién al largar y el paquete llegaba tarde
  // (las voces de las CPU se bajaban en plena carrera). Con la ficha de la página se pide ya todo lo que no depende de
  // la skin de Retro Rewind (que el juego sortea después): la pista, la música, los sonidos, lo común, lo aprendido y las
  // dos voces de cada personaje; los karts siguen viniendo con la ficha del juego (revisar)
  function pedirFicha(ficha) {
    if (!ficha?.puestos?.length) return 0;
    const f = { pista: ficha.pista, casilla: -1, modo: 1, puestos: ficha.puestos.map(q => ({ tipo: q.tipo, veh: q.vehiculo, pj: q.personaje, skin: 0 })) };
    const { piezas } = armarPaquete(f, { existe, grupos, archivos, musica, comun, vocesAmbas, ultima, fanfarrias });
    const sinKarts = piezas.filter(([r]) => !/\/Race\/Kart\/|\/Character\//.test(r));
    sinKarts.push(...aprendidasDe(f.pista));
    for (const [r] of sinKarts) if (musicaDe(r) && !musicaPedida.has(r)) { musicaPedida.add(r); estado.musicas++; }
    const mb = +(pedir(sinKarts, false) / 1048576).toFixed(1);
    actuales = [...sinKarts];   // (§285: otra carrera)
    estado.fichas = (estado.fichas || 0) + 1;
    nota(`paquete de carrera: la ficha de la sala (pista ${f.pista}, ${f.puestos.length} puestos) → ${sinKarts.length} piezas, ${mb} MB`);
    return sinKarts.length;
  }
  // §285: cuánto de lo pedido para la carrera que viene sigue sin bajar (en la fila o en camino): { total, falta, pct }
  // (pct entero 0–100; sin piezas, 100)
  function progreso() {
    let total = 0, falta = 0;
    for (const [ruta, ini, fin] of actuales) { total += fin - ini; falta += disco.pendientes ? disco.pendientes(direccion(ruta), ini, fin) : 0; }
    const pct = total > 0 ? Math.floor(100 * (total - falta) / total) : 100;
    return { total, falta, pct: falta > 0 ? Math.min(99, pct) : 100 };
  }
  return { revisar, alLeer, pedirPista, pedirFicha, aprender, progreso, estado };
}
