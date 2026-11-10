/* Los récords de Mario Kart Wii en Clasificaciones (juegos/mkw-records.js, §267 de la bitácora del juego): ordenar
   el nodo `mkw/records`, el podio de récords, el buscador con sus filtros y el cargador de nombres de pistas de
   mkw.js (que guarde en la caché y no vuelva a pedir al Worker). Todo con datos de mentira: nada del juego. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const sin = f => fs.readFileSync(f, 'utf8').replace(/^import [\s\S]*?;$/mg, '').replace(/\bexport\s+/g, '');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(sin('src/juegos/buscador.js'), ctx);
vm.runInContext(sin('src/juegos/mkw-records.js') + '\n;globalThis.__R={MKW_TABLAS,tiempoMkw,difMkw,copaFila,nombrePistaMkw,tablasMkw,carrerasConDatos,podioMkw,buscaMkw,puestoDe,consolaMkw,consolasDe,filtraMkw};', ctx);
const R = ctx.__R;
/* lo que viene del vm es de otro «reino» de JavaScript: se compara por su forma */
const igual = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);

/* Nombres de pista inventados con el prefijo de consola de Retro Rewind (los de verdad son del juego). */
const CONS = ['SNES', 'N64', 'GBA', 'GCN', 'DS', 'Wii', '3DS', 'Wii U', 'SW'];
const NOMBRES = Array.from({ length: 79 }, (_, c) => Array.from({ length: 4 }, (_, f) => `${CONS[(c + f) % CONS.length]} Pista Inventada ${c + 1}-${f + 1}`));
NOMBRES[0][0] = 'Wii Circuito Ficticio';
NOMBRES[0][1] = 'SNES Playa Ficticia';
const fila = (u, nombre, ms, at, pista, cat) => ({ uid: u, nombre, ms, pista, cat, version: 1, at });
function raw() {
  const r = {};
  const pon = (id, cat, filas) => { const k = id.toString(16) + '-' + cat; r[k] = {}; for (const [u, n, ms, at] of filas) r[k][u] = fila(u, n, ms, at, id.toString(16), cat); };
  pon(0x100, 'tt150', [['ana', 'Ana', 70000, 30], ['yo', 'Piloto Uno', 71000, 20], ['beto', 'Beto', 75000, 10]]);
  pon(0x101, 'tt150', [['beto', 'Beto', 60000, 50], ['ana', 'Ana', 60000, 40]]);   // empate: gana quien llegó antes (ana)
  pon(0x105, 'tt150', [['yo', 'Piloto Uno', 80000, 5]]);
  pon(0x100, 'vs200', [['ana', 'Ana', 150000, 1]]);
  r['zzz-tt150'] = { x: { uid: 'x', ms: 1 } };                       // clave que no es de las reglas: fuera
  r['102-tt150'] = { mal: { uid: 'otro', ms: 70000 }, cero: { uid: 'cero', nombre: 'C', ms: 100, at: 1 } };   // filas mal formadas: fuera
  return r;
}

test('tiempos como el juego y la diferencia contra el récord', () => {
  assert.equal(R.tiempoMkw(67873), '1:07.873');
  assert.equal(R.tiempoMkw(5000), '0:05.000');
  assert.equal(R.difMkw(412), '+0.412');
  assert.equal(R.difMkw(61234), '+1:01.234');
  assert.equal(R.difMkw(0), 'récord');
});

test('copa y fila de una pista, y el nombre de repuesto sin el Worker', () => {
  igual({ ...R.copaFila(0x105) }, { copa: 1, fila: 1 });
  assert.equal(R.nombrePistaMkw(0x105, null), 'Copa 2 · Pista 2');
  assert.equal(R.nombrePistaMkw(0x100, NOMBRES), 'Wii Circuito Ficticio');
});

test('el nodo crudo se ordena: filas por tiempo, empates por llegada, pistas por la más reciente; lo mal formado sale', () => {
  const t = R.tablasMkw(raw());
  igual(Object.keys(t).sort(), ['tt150', 'vs200']);
  const tt = t.tt150;
  igual(tt.map(p => p.id), [0x101, 0x100, 0x105]);          // ultimo 50, 30, 5
  igual(tt[0].filas.map(f => f.uid), ['ana', 'beto']);       // 60000 los dos: ana llegó antes
  igual(tt[1].filas.map(f => f.uid), ['ana', 'yo', 'beto']);
  assert.ok(!tt.some(p => p.id === 0x102));
});

test('los vetados no aparecen en ninguna tabla', () => {
  const t = R.tablasMkw(raw(), u => u === 'ana');
  igual(t.tt150.find(p => p.id === 0x100).filas.map(f => f.uid), ['yo', 'beto']);
  assert.ok(!t.vs200);                                                  // la única fila era suya
});

test('las cilindradas de carrera que se ofrecen son solo las que tienen tiempos', () => {
  igual([...R.carrerasConDatos(R.tablasMkw(raw()))], ['vs200']);
  igual([...R.carrerasConDatos({})], []);
});

test('el podio cuenta récords (1.º puestos) y desempata por 2.º y 3.º', () => {
  const p = R.podioMkw(R.tablasMkw(raw()).tt150);
  igual(p.map(r => r.uid), ['ana', 'yo']);                   // ana 2 récords; yo 1; beto ninguno: fuera
  assert.equal(p[0].oro, 2); assert.equal(p[0].puntos, 2);
  assert.equal(p[1].plata, 1); assert.equal(p[1].pistas, 2);
});

test('buscar: todas las palabras, por pista, «copa N» y por piloto (que muestra su tiempo)', () => {
  const tt = R.tablasMkw(raw()).tt150;
  const ids = (q, o = { nombres: NOMBRES }) => R.buscaMkw(tt, q, o).lista.map(p => p.id);
  igual(ids(''), [0x101, 0x100, 0x105]);
  igual(ids('circuito'), [0x100]);
  igual(ids('circuto'), [0x100]);                            // un tipeo
  igual(ids('copa 1'), [0x101, 0x100]);                      // la copa 1, no cualquier «1»
  igual(ids('copa 2'), [0x105]);
  igual(ids('beto'), [0x101, 0x100]);
  assert.equal(R.buscaMkw(tt, 'beto', { nombres: NOMBRES }).piloto, 'beto');
  igual(ids('beto playa'), [0x101]);                         // las dos palabras
  igual(ids('nada parecido'), []);
});

test('buscar también dice qué pistas que coinciden no tienen récord (hasta 5)', () => {
  const tt = R.tablasMkw(raw()).tt150;
  const b = R.buscaMkw(tt, 'copa 3', { nombres: NOMBRES });
  igual(b.lista.map(p => p.id), []);
  igual([...b.sin], [0x108, 0x109, 0x10a, 0x10b]);
  assert.equal(R.buscaMkw(tt, 'inventada', { nombres: NOMBRES }).sin.length, 5);
  igual([...R.buscaMkw(tt, 'copa 3', { nombres: null }).sin], []);   // sin nombres no se sabe
});

test('los filtros «Tú»: mis récords, corridas y las que me faltan', () => {
  const tt = R.tablasMkw(raw()).tt150;
  const ids = m => R.filtraMkw(tt, { mio: m }, 'yo', NOMBRES).map(p => p.id);
  igual(ids('todas'), [0x101, 0x100, 0x105]);
  igual(ids('record'), [0x105]);
  igual(ids('corridas'), [0x100, 0x105]);
  igual(ids('faltan'), [0x101]);
});

test('la consola sale del principio del nombre y solo se ofrecen las presentes, en orden histórico', () => {
  assert.equal(R.consolaMkw('Wii U Ciudad'), 'Wii U');
  assert.equal(R.consolaMkw('Wii Circuito'), 'Wii');
  assert.equal(R.consolaMkw('SNES Playa'), 'SNES');
  assert.equal(R.consolaMkw('Pista sin consola'), '');
  const tt = R.tablasMkw(raw()).tt150;
  igual(R.consolasDe(tt, NOMBRES).map(c => [c.c, c.n]), [['SNES', 1], ['GBA', 1], ['Wii', 1]]);
  igual(R.filtraMkw(tt, { consola: 'SNES' }, 'yo', NOMBRES).map(p => p.id), [0x101]);
  igual([...R.consolasDe(tt, null)], []);
});

/* ---- el cargador de nombres e íconos de mkw.js: lo justo para no gastar llamadas al Worker ---- */
function cargador({ estado = 200, ahora = 1e12 } = {}) {
  const src = fs.readFileSync('src/juegos/mkw.js', 'utf8');
  const desde = src.indexOf('const UN_DIA = 864e5'), hasta = src.indexOf('/* Las partidas de cada uno en la nube');
  assert.ok(desde > 0 && hasta > desde);
  const pedidos = [], caja = new Map(), ls = new Map();
  const pak = () => {                                                    // un paquete MKWI de mentira con 2 «íconos»
    const lista = JSON.stringify({ '0': [0, 3, 'image/png'], '1': [3, 2, 'image/png'] });
    const cab = new TextEncoder().encode(lista);
    const b = new Uint8Array(8 + cab.length + 5);
    b.set([77, 75, 87, 73]); new DataView(b.buffer).setUint32(4, cab.length, true); b.set(cab, 8); b.set([1, 2, 3, 4, 5], 8 + cab.length);
    return b;
  };
  const env = {
    Date: { now: () => env.reloj }, reloj: ahora, console, Promise, JSON, Object, String, Number, Map, Uint8Array, DataView, TextDecoder, Infinity,
    localStorage: { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    auth: { currentUser: { getIdToken: async () => 'token' } },
    Blob: class { constructor(p) { this.p = p; } }, URL: { createObjectURL: b => 'blob:' + b.p[0].join(',') },
    Response: class { constructor(cuerpo, o = {}) { this.cuerpo = cuerpo; this.headers = new Map(Object.entries(o.headers || {})); this.ok = true; } },
    caches: { open: async () => ({
      match: async u => caja.get(u) || undefined,
      put: async (u, r) => { caja.set(u, r); },
      keys: async () => [...caja.keys()].map(url => ({ url })), delete: async k => caja.delete(k.url) }) },
    fetch: async (u, o) => {
      pedidos.push([u, o && o.headers && o.headers.Authorization]);
      const ok = estado === 200, cuerpo = u.endsWith('indice.json') ? JSON.stringify({ nombres: NOMBRES, copas: 'copas.abcd1234.pak' }) : pak();
      const r = { ok, status: estado, headers: new Map(),
        text: async () => cuerpo, json: async () => JSON.parse(cuerpo), arrayBuffer: async () => cuerpo.buffer,
        clone: () => r };
      return r;
    },
  };
  // la Response de la caja tiene que saber leerse como la del navegador
  env.Response.prototype.json = async function () { return JSON.parse(this.cuerpo); };
  vm.createContext(env);
  vm.runInContext(`const urlPrivada = async () => "https://worker.prueba/mkw";\n${src.slice(desde, hasta).split("export ").join("")}\n;globalThis.__P = { pistasMkw, reinicia: () => { pistasPromesa = null; } };`, env);
  return { P: env.__P, pedidos, caja, ls, env };
}

test('el cargador pide índice y copas una vez, con el token, y la segunda vez sale de la caché', async () => {
  const { P, pedidos, caja } = cargador();
  const p = await P.pistasMkw();
  assert.equal(p.nombres[0][0], 'Wii Circuito Ficticio');
  assert.equal(p.icono(0), 'blob:1,2,3'); assert.equal(p.icono(1), 'blob:4,5'); assert.equal(p.icono(9), '');
  igual(pedidos.map(x => x[0]), ['https://worker.prueba/mkw/build/imagenes/paquetes/indice.json', 'https://worker.prueba/mkw/build/imagenes/paquetes/copas.abcd1234.pak']);
  assert.ok(pedidos.every(x => x[1] === 'Bearer token'));
  assert.equal(caja.size, 2);
  assert.equal(await P.pistasMkw(), p);                                  // misma pestaña: la misma promesa
  P.reinicia();                                                          // otra pestaña (la caché sigue)
  await P.pistasMkw();
  assert.equal(pedidos.length, 2, 'la segunda carga no llama al Worker');
});

test('pasado un día se vuelve a preguntar el índice (solo el índice: el paquete con huella no cambia)', async () => {
  const c = cargador();
  await c.P.pistasMkw();
  c.P.reinicia(); c.env.reloj += 864e5 + 1;
  await c.P.pistasMkw();
  igual(c.pedidos.slice(2).map(x => x[0].split('/').pop()), ['indice.json']);
});

test('quien no es amigo del Worker (403) queda sin nombres y no vuelve a preguntar en un día', async () => {
  const c = cargador({ estado: 403 });
  assert.equal(await c.P.pistasMkw(), null);
  assert.equal(c.pedidos.length, 1);
  assert.ok(c.ls.has('jg.mkwPistas.no'));
  c.P.reinicia();
  assert.equal(await c.P.pistasMkw(), null);
  assert.equal(c.pedidos.length, 1, 'no hay segunda llamada');
});

test('ranks.js monta el panel solo para Mario Kart y con lo que juegos-main.js le da', () => {
  const r = fs.readFileSync('src/juegos/ranks.js', 'utf8'), m = fs.readFileSync('src/juegos-main.js', 'utf8');
  assert.match(r, /from "\.\/mkw-records\.js"/);
  assert.match(r, /juego === "mkw" && mkwVer === "records" && !!ctx\.watchMkwRecords/);
  assert.match(m, /watchMkwRecords: fb\.watchMkwRecords, pistasMkw, fantasmaMkw/);
  assert.match(m, /bt3Visible\(\) \? \{ watchMkwRecords/);
  assert.match(fs.readFileSync('src/fb-juegos.js', 'utf8'), /export function watchMkwRecords\(cb\)/);
});
