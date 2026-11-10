// El espacio que el juego ocupa en este navegador, por partes — bitácora §251 (pedido del dueño: «borrar por partes»).
//
// Resumen: lo que el juego baja queda en la caja del disco (disco.mjs, Cache Storage). Antes solo se podía borrar TODO
// (y la próxima vez se volvía a bajar entero, ~5 GB). Este módulo es la lógica, sin dibujar nada (espacio-panel.mjs
// dibuja; así se prueba en el banco sin el juego):
//   - clasificar(ruta): a qué parte va cada archivo: «pista» (la pista misma y su música), «comun» (los karts y los
//     sonidos que usan todas las carreras: StaticR, las fanfarrias, Character/…, el .brsar, los videos de los menús y
//     diminutos.bin) o «basico» (lo demás: lo que el juego necesita para arrancar);
//   - crearUsoPistas: lo que se sabe de cada pista en ESTE navegador (localStorage): cuándo se jugó por última vez,
//     qué archivos de pista leyó el juego mientras la tenía elegida (así las pistas de Nintendo y las de Retro Rewind con
//     nombre —«sw2RR.szs»— quedan atadas a su pista sin adivinar), las ⭐ y el tope de espacio;
//   - archivosDePista(pista): lo que se sabe sin haberla jugado (las de Retro Rewind con número: Tracks/<n>.szs y
//     strm/<n>_N.brstm; paquete-carrera.mjs);
//   - armarResumen: con lo que de verdad hay en la caja (disco.inventario: archivo → bytes, contado del manifiesto y de
//     las entradas guardadas, NO de navigator.storage.estimate, que es de todo el sitio y cuenta también BT3) arma las
//     cuatro partes de la barra y la lista de pistas;
//   - ordenar, crearSeleccion (las casillas; «Marcar todas» nunca marca una ⭐ ni una protegida), crearPendiente (el
//     «Deshacer» de 8 s: recién al vencer se borra de verdad) y elegirPorTope (con el tope prendido, las pistas jugadas
//     hace más tiempo hasta bajar del tope; nunca las ⭐ ni las de la sala).
// Como el tablero de una casa con un medidor por circuito: antes había un solo interruptor general; ahora se ve cuánto
// gasta cada circuito y se corta uno sin apagar la casa.

import { archivoDePista, musicaDePista } from './paquete-carrera.mjs';

const RR = '/mkw/sd/RetroRewind6';
export const CLAVE_USO = 'mkw.pistas.uso', CLAVE_ESTRELLAS = 'mkw.pistas.estrellas', CLAVE_TOPE = 'mkw.espacio.tope';
export const TOPES_GB = [0, 1, 2, 4];             // 0 = sin tope (por omisión)
const MAX_ARCHIVOS = 24, MAX_PISTAS_USO = 400;

// Las pistas de Nintendo: el número de pista del juego (0x00–0x1F) → su archivo en Race/Course. Leído del juego mismo:
// la tabla de nombres que usa el cargador de pistas está en StaticR.rel (0x38023C en adelante, una cadena cada 16 bytes,
// en el orden de los números de pista; el mismo orden que los grupos de sonido GRP_GP_* de paquete-carrera.mjs). Los
// nombres para la persona son los conocidos (en inglés, como en Retro Rewind)
export const CURSOS = ['castle_course', 'farm_course', 'kinoko_course', 'volcano_course', 'factory_course', 'shopping_course',
  'boardcross_course', 'truck_course', 'beginner_course', 'senior_course', 'ridgehighway_course', 'treehouse_course',
  'koopa_course', 'rainbow_course', 'desert_course', 'water_course', 'old_peach_gc', 'old_mario_gc', 'old_waluigi_gc',
  'old_donkey_gc', 'old_falls_ds', 'old_desert_ds', 'old_garden_ds', 'old_town_ds', 'old_mario_sfc', 'old_obake_sfc',
  'old_mario_64', 'old_sherbet_64', 'old_koopa_64', 'old_donkey_64', 'old_koopa_gba', 'old_heyho_gba'];
// (los nombres para la persona, del archivo; los conocidos, en inglés como en Retro Rewind)
const NOMBRE_CURSO = {
  castle_course: 'Mario Circuit', farm_course: 'Moo Moo Meadows', kinoko_course: 'Mushroom Gorge', volcano_course: 'Grumble Volcano',
  factory_course: "Toad's Factory", shopping_course: 'Coconut Mall', boardcross_course: 'DK Summit', truck_course: "Wario's Gold Mine",
  beginner_course: 'Luigi Circuit', senior_course: 'Daisy Circuit', ridgehighway_course: 'Moonview Highway', treehouse_course: 'Maple Treeway',
  koopa_course: "Bowser's Castle", rainbow_course: 'Rainbow Road', desert_course: 'Dry Dry Ruins', water_course: 'Koopa Cape',
  old_peach_gc: 'GCN Peach Beach', old_mario_gc: 'GCN Mario Circuit', old_waluigi_gc: 'GCN Waluigi Stadium', old_donkey_gc: 'GCN DK Mountain',
  old_falls_ds: 'DS Yoshi Falls', old_desert_ds: 'DS Desert Hills', old_garden_ds: 'DS Peach Gardens', old_town_ds: 'DS Delfino Square',
  old_mario_sfc: 'SNES Mario Circuit 3', old_obake_sfc: 'SNES Ghost Valley 2', old_mario_64: 'N64 Mario Raceway', old_sherbet_64: 'N64 Sherbet Land',
  old_koopa_64: "N64 Bowser's Castle", old_donkey_64: "N64 DK's Jungle Parkway", old_koopa_gba: 'GBA Bowser Castle 3', old_heyho_gba: 'GBA Shy Guy Beach',
};
export const nombreDeCurso = archivo => NOMBRE_CURSO[archivo] || archivo;

// ¿Es un archivo de UNA pista? (la pista, su versión de pantalla partida, su música y sus variantes)
export const esDePista = ruta => /\/RetroRewind6\/Tracks\//.test(ruta) || /\/Race\/Course\//.test(ruta) ||
  /\/RetroRewind6\/strm\//.test(ruta) || (/\/disco\/files\/sound\/strm\//.test(ruta) && !/\/strm\/o_/.test(ruta));
// Lo común de todas las carreras: [id, nombre para la persona, prueba]
export const COMUNES = [
  ['staticr', 'StaticR (el programa de la carrera)', r => /\/rel\/StaticR\.rel$/.test(r)],
  ['fanfarria', 'Fanfarrias y músicas comunes', r => /\/sound\/strm\/o_/.test(r)],
  ['karts', 'Karts y pilotos (Race/Kart, Character)', r => /\/Race\/Kart\//.test(r) || /\/RetroRewind6\/Character\//.test(r)],
  ['brsar', 'Sonidos y voces (revo_kart.brsar)', r => /revo_kart\.brsar$/.test(r)],
  ['videos', 'Videos de los menús', r => /\.thp$/i.test(r)],
  ['diminutos', 'Archivos diminutos (diminutos.bin)', r => /\/diminutos\.bin$/.test(r)],
];
export function clasificar(ruta) {
  if (esDePista(ruta)) return 'pista';
  if (COMUNES.some(([, , f]) => f(ruta))) return 'comun';
  return 'basico';
}

// Lo que se sabe de una pista sin haberla jugado: las de Retro Rewind con número (Pulsar desde 0x100)
export function archivosDePista(pista) {
  const n = archivoDePista(pista);
  if (n < 0) return [];
  return [`${RR}/Tracks/${n}.szs`, `${RR}/Tracks/${n}_1.szs`, musicaDePista(n), `${RR}/strm/${n}_Final.brstm`, `${RR}/strm/${n}_F.brstm`];
}
// …y al revés: de qué pista es un archivo de Retro Rewind con número (o -1)
export function pistaDeArchivo(ruta) {
  const m = /\/RetroRewind6\/(?:Tracks\/(\d+)(?:_1)?\.szs|strm\/(\d+)_(?:N|F|Final)\.brstm)$/.exec(ruta);
  return m ? 0x100 + Number(m[1] ?? m[2]) : -1;
}

const leerJSON = (almacen, clave, d) => { try { const v = almacen?.getItem(clave); return v == null ? d : JSON.parse(v) ?? d; } catch { return d; } };
const escribirJSON = (almacen, clave, v) => { try { almacen?.setItem(clave, JSON.stringify(v)); } catch {} };
const almacenDe = () => { try { return globalThis.localStorage || null; } catch { return null; } };

// Lo que este navegador sabe de cada pista. uso = { [pista]: { t: hora de la última vez jugada (ms) o 0, a: [rutas] } }.
// Se relee antes de cada escritura (otra pestaña pudo anotar algo)
export function crearUsoPistas({ almacen = almacenDe(), ahora = () => Date.now() } = {}) {
  const leer = () => leerJSON(almacen, CLAVE_USO, {});
  const guardar = u => {
    const ks = Object.keys(u);
    if (ks.length > MAX_PISTAS_USO) ks.sort((a, b) => (u[a].t || 0) - (u[b].t || 0)).slice(0, ks.length - MAX_PISTAS_USO).forEach(k => delete u[k]);
    escribirJSON(almacen, CLAVE_USO, u);
  };
  const vistos = new Set();                       // (pista|ruta ya anotados en esta pestaña: no reescribir cada lectura)
  return {
    leer,
    // la carrera en esa pista empezó: la fecha (para «última vez jugada» y el tope)
    jugada(pista, t = ahora()) {
      if (!(pista >= 0)) return;
      const u = leer();
      u[pista] = { t, a: u[pista]?.a || [] };
      guardar(u);
    },
    // el juego leyó un archivo de pista con esa pista elegida: queda atado a ella
    archivo(pista, ruta) {
      if (!(pista >= 0) || !esDePista(ruta) || vistos.has(pista + '|' + ruta)) return false;
      vistos.add(pista + '|' + ruta);
      const u = leer();
      const e = u[pista] || { t: 0, a: [] };
      if (e.a.includes(ruta)) return false;
      e.a = [...e.a, ruta].slice(-MAX_ARCHIVOS);
      u[pista] = e;
      guardar(u);
      return true;
    },
    olvidar(pistas) { const u = leer(); for (const p of pistas) delete u[p]; guardar(u); },
    estrellas: () => new Set(leerJSON(almacen, CLAVE_ESTRELLAS, []).map(Number)),
    estrella(pista, si) {
      const s = new Set(leerJSON(almacen, CLAVE_ESTRELLAS, []).map(Number));
      if (si) s.add(pista); else s.delete(pista);
      escribirJSON(almacen, CLAVE_ESTRELLAS, [...s]);
      return s;
    },
    tope: () => { const g = Number(leerJSON(almacen, CLAVE_TOPE, 0)); return TOPES_GB.includes(g) ? g : 0; },
    ponerTope: g => escribirJSON(almacen, CLAVE_TOPE, TOPES_GB.includes(g) ? g : 0),
  };
}

// El nombre y la copa de una pista. copas = [[nombre ×4], …] (los de lista-pistas/indice.json o los que lee el juego)
export function nombreDe(pista, copas, rutas = []) {
  if (pista >= 0x100) {
    const i = pista - 0x100, c = i >> 2, f = i & 3;
    return { nombre: copas?.[c]?.[f] || `Pista ${c + 1}.${f + 1}`, copa: `Copa ${c + 1}`, c, f };
  }
  const curso = rutas.map(r => /\/Race\/Course\/([a-z0-9_]+?)(?:_d)?\.szs$/i.exec(r)?.[1]).find(Boolean);
  return { nombre: curso ? nombreDeCurso(curso) : `Pista de Nintendo ${pista}`, copa: 'Nintendo', c: 1000 + pista, f: 0 };
}

// Las cuatro partes. inventario: Map(ruta del juego → bytes guardados); uso: crearUsoPistas().leer(); estrellas: Set;
// protegidas: Set de pistas que no se pueden borrar ahora; copas: los nombres
export function armarResumen({ inventario, uso = {}, estrellas = new Set(), protegidas = new Set(), copas = null, partidasBytes = 0 }) {
  const dueño = new Map();                        // ruta → pista
  for (const [p, e] of Object.entries(uso)) for (const r of e.a || []) if (!dueño.has(r)) dueño.set(r, Number(p));
  const pistas = new Map();                       // pista → { rutas, bytes }
  const otras = { rutas: [], bytes: 0 };
  const comunes = new Map(COMUNES.map(([id, nombre]) => [id, { id, nombre, rutas: [], bytes: 0 }]));
  const basico = { rutas: [], bytes: 0 };
  for (const [ruta, bytes] of inventario) {
    if (!(bytes > 0)) continue;
    const cat = clasificar(ruta);
    if (cat === 'pista') {
      let p = dueño.get(ruta);
      if (p === undefined) { const q = pistaDeArchivo(ruta); if (q >= 0) p = q; }
      if (p === undefined) { otras.rutas.push(ruta); otras.bytes += bytes; continue; }
      if (!pistas.has(p)) pistas.set(p, { rutas: [], bytes: 0 });
      const e = pistas.get(p); e.rutas.push(ruta); e.bytes += bytes;
    } else if (cat === 'comun') {
      const id = COMUNES.find(([, , f]) => f(ruta))[0], e = comunes.get(id);
      e.rutas.push(ruta); e.bytes += bytes;
    } else { basico.rutas.push(ruta); basico.bytes += bytes; }
  }
  const lista = [...pistas].map(([pista, e]) => {
    const n = nombreDe(pista, copas, [...(uso[pista]?.a || []), ...e.rutas]);
    return { pista, ...n, bytes: e.bytes, rutas: e.rutas, t: uso[pista]?.t || 0, estrella: estrellas.has(pista), protegida: protegidas.has(pista) };
  });
  if (otras.bytes > 0) lista.push({ pista: -1, nombre: 'Otras pistas (sin identificar)', copa: '—', c: 9999, f: 0, bytes: otras.bytes,
                                    rutas: otras.rutas, t: 0, estrella: false, protegida: false });
  const sumPistas = lista.reduce((s, x) => s + x.bytes, 0);
  const listaComun = [...comunes.values()].filter(x => x.bytes > 0);
  const sumComun = listaComun.reduce((s, x) => s + x.bytes, 0);
  return {
    pistas: { bytes: sumPistas, n: lista.filter(x => x.pista >= 0).length, lista },
    comun: { bytes: sumComun, lista: listaComun },
    basico,
    partidas: { bytes: partidasBytes },
    total: sumPistas + sumComun + basico.bytes,
  };
}

// Ordenar la lista: 'vez' (la jugada hace más tiempo primero; nunca jugada = la más vieja), 'tamano' (la más grande
// primero), 'nombre', 'copa'. inverso = al revés
export const ORDENES = [['vez', 'Última vez'], ['tamano', 'Tamaño'], ['nombre', 'Nombre'], ['copa', 'Copa']];
export function ordenar(lista, por = 'vez', inverso = false) {
  const cmp = {
    vez: (a, b) => a.t - b.t || a.nombre.localeCompare(b.nombre),
    tamano: (a, b) => b.bytes - a.bytes || a.nombre.localeCompare(b.nombre),
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.c - b.c,
    copa: (a, b) => a.c - b.c || a.f - b.f,
  }[por] || (() => 0);
  const r = [...lista].sort(cmp);
  return inverso ? r.reverse() : r;
}

// Las casillas. claveDe(fila) = su identidad; puede(fila) = se puede marcar (no protegida)
export function crearSeleccion({ claveDe = x => x.pista, puede = x => !x.protegida } = {}) {
  const marcadas = new Set();
  return {
    marcadas,
    tiene: f => marcadas.has(claveDe(f)),
    alternar(f) { if (!puede(f)) return false; const k = claveDe(f); if (marcadas.has(k)) marcadas.delete(k); else marcadas.add(k); return marcadas.has(k); },
    // «Marcar todas»: nunca una ⭐ ni una protegida (la ⭐ se puede marcar a mano, una por una)
    todas(lista) { for (const f of lista) if (puede(f) && !f.estrella) marcadas.add(claveDe(f)); },
    ninguna() { marcadas.clear(); },
    // lo marcado que sigue en la lista (si una fila desapareció, no cuenta)
    de(lista) { return lista.filter(f => marcadas.has(claveDe(f)) && puede(f)); },
    cuenta(lista) { const d = this.de(lista); return { n: d.length, bytes: d.reduce((s, f) => s + f.bytes, 0) }; },
  };
}

// El «Deshacer»: lo pedido espera `ms` (8 s) y recién al vencer se borra de verdad (ejecutar). Mientras espera, aplazar()
// = true lo deja para después (en la carrera no se toca la caja: §176). Solo uno a la vez: pedir otro adelanta el
// anterior. reloj = { poner(f, ms), quitar(id), ahora() } (para el banco)
export function crearPendiente({ ms = 8000, ejecutar, aplazar = () => false,
                                 reloj = { poner: (f, t) => setTimeout(f, t), quitar: id => clearTimeout(id), ahora: () => performance.now() } } = {}) {
  let actual = null;
  const vencer = async p => {
    if (actual !== p) return;
    if (aplazar()) { p.id = reloj.poner(() => vencer(p), 1000); return; }
    actual = null;
    p.estado = 'borrando';
    try { p.resultado = await ejecutar(p.items); p.estado = 'hecho'; } catch (e) { p.estado = 'error'; p.error = e; }
    p.alTerminar?.(p);
  };
  return {
    get actual() { return actual; },
    restan: () => actual ? Math.max(0, Math.ceil((actual.hasta - reloj.ahora()) / 1000)) : 0,
    pedir(items, alTerminar) {
      if (actual) { const viejo = actual; reloj.quitar(viejo.id); viejo.hasta = 0; vencer(viejo); }
      const p = { items, estado: 'esperando', hasta: reloj.ahora() + ms, alTerminar };
      actual = p;
      p.id = reloj.poner(() => vencer(p), ms);
      return p;
    },
    deshacer() { if (!actual) return false; reloj.quitar(actual.id); actual.estado = 'deshecho'; actual = null; return true; },
    // ya (sin esperar los 8 s): al cerrar la página no se borra (lo pendiente se pierde: nada se borró)
    ahora() { if (!actual) return null; const p = actual; reloj.quitar(p.id); vencer(p); return p; },
  };
}

// El tope de espacio: qué pistas soltar (las jugadas hace más tiempo primero) para que el total baje del tope; nunca las
// ⭐ ni las protegidas (la carrera en curso, las de la sala). Devuelve la lista (puede no alcanzar)
export function elegirPorTope(resumen, topeBytes) {
  if (!(topeBytes > 0) || resumen.total <= topeBytes) return [];
  let sobra = resumen.total - topeBytes;
  const r = [];
  for (const f of ordenar(resumen.pistas.lista.filter(x => x.pista >= 0 && !x.estrella && !x.protegida), 'vez')) {
    if (sobra <= 0) break;
    r.push(f); sobra -= f.bytes;
  }
  return r;
}

// «hace 3 días», «hoy», «nunca»
export function haceCuanto(t, ahora = Date.now()) {
  if (!t) return 'nunca';
  const d = Math.floor((ahora - t) / 86400000);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m < 12 ? `hace ${m} ${m === 1 ? 'mes' : 'meses'}` : 'hace más de un año';
}
export const mb = b => b >= 1073741824 ? `${(b / 1073741824).toFixed(2).replace('.', ',')} GB` : `${(b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',')} MB`;
