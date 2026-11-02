/* Prueba de punta a punta del servidor de Pro Kingdoms contra los emuladores (no toca la base real).

   firebase emulators:start --only auth,database,functions --project mi-pagina-pro
   cd functions && npm run prueba        (prepara.js + esta prueba)

   Comprueba: CORS, que join exige sesión de Firebase y estar en betaTesters, que la cuenta es el
   uid (un reino por cuenta), sync, guardar y leer la partida (también como sendBeacon, text/plain),
   que lo guardado en la RTDB vuelve igual en un arranque en frío (arreglos con null, listas vacías)
   y que nadie de la web puede leer prokingdoms/. No es idempotente: reinicia el emulador entre corridas. */
'use strict';
const PROYECTO = 'mi-pagina-pro', NS = 'mi-pagina-pro-default-rtdb';
const FN = `http://127.0.0.1:5001/${PROYECTO}/us-central1/prokingdoms`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const DB = 'http://127.0.0.1:9000';
const SITIO = 'https://paginita-pro.cl';
let fallas = 0;
const ok = (c, que, det) => { console.log((c ? '  ok    ' : '  FALLA ') + que + (det !== undefined ? '  → ' + det : '')); if (!c) fallas++; };

async function cuenta(email) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=falsa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secreta123', returnSecureToken: true }) });
  const d = await r.json();
  return { uid: d.localId, tok: d.idToken };
}
const dbPut = (ruta, v) => fetch(`${DB}/${ruta}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(v) });
const dbGet = async (ruta, admin = true) => { const r = await fetch(`${DB}/${ruta}.json?ns=${NS}`, { headers: admin ? { Authorization: 'Bearer owner' } : {} }); return { status: r.status, v: await r.json() }; };
async function api(metodo, ruta, { cuerpo, token, bearer, origen = SITIO, tipo = 'application/json' } = {}) {
  const h = { 'Content-Type': tipo };
  if (origen) h.Origin = origen;
  if (token) h['X-PK-Token'] = token;
  if (bearer) h.Authorization = 'Bearer ' + bearer;
  const r = await fetch(FN + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), d: await r.json().catch(() => ({})) };
}
const foto = o => Object.assign({ era: 1, pop: 10, defense: 30, truce: false, res: { food: 200, wood: 200, stone: 100, gold: 100 }, total: 0, army: 0, walls: 0, score: 0 }, o);

async function main() {
  console.log('\nArranque y CORS');
  const st = await api('GET', '/api/status');
  ok(st.status === 200 && st.d.ok, 'status contesta (arranque en frío: baja el estado y genera el mapa)', JSON.stringify(st.d));
  ok(st.cors === SITIO, 'CORS para paginita-pro.cl', st.cors);
  const pre = await fetch(FN + '/api/sync', { method: 'OPTIONS', headers: { Origin: SITIO, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-pk-token' } });
  ok(pre.status === 204 && /x-pk-token/i.test(pre.headers.get('access-control-allow-headers') || ''), 'el preflight deja X-PK-Token y Authorization', pre.status);
  ok((await api('GET', '/api/status', { origen: 'https://otra-web.com' })).status === 403, 'otra web: 403');
  ok((await api('GET', '/api/nada')).status === 404, 'ruta desconocida: 404');

  console.log('\nQuién entra');
  const A = await cuenta('ana@prueba.cl'), B = await cuenta('beto@prueba.cl');
  ok(A.uid && A.tok && B.uid, 'dos cuentas en el emulador de Auth');
  ok((await api('POST', '/api/join', { cuerpo: { name: 'Ana' } })).status === 401, 'join sin sesión: 401');
  ok((await api('POST', '/api/join', { cuerpo: { name: 'Ana' }, bearer: 'token-falso' })).status === 401, 'join con un token inventado: 401');
  ok((await api('POST', '/api/join', { cuerpo: { name: 'Beto' }, bearer: B.tok })).status === 403, 'join de alguien que no es beta tester: 403');
  await dbPut(`betaTesters/${A.uid}`, { at: Date.now(), por: A.uid });
  const ja = await api('POST', '/api/join', { cuerpo: { name: 'Ana', token: 'uno-robado' }, bearer: A.tok });
  ok(ja.status === 200 && ja.d.player && ja.d.player.token, 'la beta tester entra', ja.status + ' ' + JSON.stringify(ja.d).slice(0, 120));
  const yo = ja.d.player || {};
  const ja2 = await api('POST', '/api/join', { cuerpo: { name: 'Ana' }, bearer: A.tok });
  ok(ja2.d.player && ja2.d.player.id === yo.id && ja2.d.player.token === yo.token, 'otra vez (otro aparato): el mismo reino');
  ok((await api('POST', '/api/sync', { cuerpo: {}, token: 'inventado' })).status === 401, 'sync con un token del juego inventado: 401');

  console.log('\nJugar');
  const s1 = await api('POST', '/api/sync', { cuerpo: { since: 0, harvest: {}, market: [], snap: foto(), kb: {}, name: 'Ana' }, token: yo.token });
  ok(s1.status === 200 && s1.d.nodes && Object.keys(s1.d.nodes).length > 0 && Array.isArray(s1.d.players), 'sync devuelve zonas comunes y reinos', s1.status + ' nodos=' + Object.keys(s1.d.nodes || {}).length);
  const of = await api('GET', '/api/offers', { token: yo.token });
  ok(of.status === 200, 'el mercado contesta', of.status);
  const rk = await api('GET', '/api/ranking', { token: yo.token });
  ok(rk.status === 200 && Array.isArray(rk.d) && rk.d.some(r => r.me && r.name === 'Ana'), 'Ana sale en el ranking');

  console.log('\nPartida en la nube');
  const partida = { v: 99, slot: yo.slot || 0, lastSeen: Date.now(), cosas: [null, 1, []], vacio: {} };
  ok((await api('POST', '/api/save', { cuerpo: { save: partida }, token: yo.token })).status === 200, 'guardar');
  const leida = await api('GET', '/api/save', { token: yo.token });
  ok(leida.status === 200 && leida.d.save === JSON.stringify(partida), 'leer devuelve exactamente lo guardado');
  const beacon = await api('POST', '/api/save?t=' + encodeURIComponent(yo.token), { cuerpo: JSON.stringify({ save: Object.assign({}, partida, { v: 100 }) }), tipo: 'text/plain', origen: null });
  ok(beacon.status === 200, 'guardar como sendBeacon (text/plain, token en la URL)', beacon.status);
  ok(JSON.parse((await api('GET', '/api/save', { token: yo.token })).d.save).v === 100, 'y se lee la versión del beacon');
  const j3 = await api('POST', '/api/join', { cuerpo: { name: 'Ana' }, bearer: A.tok });
  ok(j3.d.hasSave === true, 'join avisa que hay partida en la nube');

  console.log('\nLa base');
  await new Promise(r => setTimeout(r, 3500));
  await api('POST', '/api/sync', { cuerpo: { since: 0, snap: foto(), name: 'Ana' }, token: yo.token });   // pasa el flush de 3 s
  const col = await dbGet('prokingdoms/col');
  const pj = col.v && col.v.players && Object.values(col.v.players).map(t => JSON.parse(t)).find(p => p.id === yo.id);
  ok(pj && pj.uid === A.uid && Array.isArray(pj.inbox), 'el jugador quedó en la RTDB, con su uid y su buzón vacío', pj ? 'inbox=' + JSON.stringify(pj.inbox) : 'no está');
  const mundo = col.v && col.v.worlds && Object.values(col.v.worlds).map(t => JSON.parse(t))[0];
  ok(mundo && Array.isArray(mundo.slots) && mundo.slots.includes(null) && mundo.slots.includes(yo.id), 'el mundo vuelve con sus casillas vacías (null) intactas', mundo ? mundo.slots.length + ' casillas' : '');
  const ajena = await dbGet('prokingdoms', false);
  ok(ajena.status === 401 || ajena.status === 403, 'nadie de la web lee prokingdoms/ (reglas)', ajena.status);

  console.log('\nArranque en frío (otro proceso carga lo guardado)');
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const app = initializeApp({ projectId: PROYECTO, databaseURL: `http://127.0.0.1:9000/?ns=${NS}` });
  const store = require('./juego/server/store.js');
  await store.carga();
  const p2 = store.get('players', yo.id);
  ok(p2 && p2.uid === A.uid && store.getSave(yo.id) === '1', 'store.carga() recupera el jugador y sabe que tiene partida');
  ok(store.all('worlds').some(w => w.slots.length === mundo.slots.length && w.slots.includes(null)), 'y el mundo con la misma forma');
  await deleteApp(app);

  console.log(fallas ? `\n${fallas} FALLAS` : '\nTodo en orden.');
  process.exit(fallas ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
