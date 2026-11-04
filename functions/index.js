/* Cloud Functions de Paginita Pro.

   `prokingdoms`: el servidor del mundo compartido de Pro Kingdoms. Es el mismo server/sim.js que
   corre `node server.js` en local (juegos/prokingdoms/), con tres cambios de piezas:
   - el HTTP es este archivo en vez de server/index.js (mismas rutas, mismos límites de pedidos);
   - el almacén es la RTDB (store-rtdb.js) en vez de archivos JSON;
   - no hay reloj: tick() corre antes de un pedido si pasaron 5 s (`PK_TICK_PEREZOSO`), porque una
     función no ejecuta nada entre pedidos.

   **Una sola instancia** (`maxInstances: 1`): el mundo vive en memoria, como en el servidor local, y
   dos copias se pisarían. `concurrency: 80` deja que esa instancia atienda a muchos a la vez (las
   funciones de sim.js son síncronas, así que no se mezclan).

   **Quién entra.** El sitio está en GitHub Pages (otro origen), así que no hay `/api/**` en el mismo
   dominio: el juego llama a la URL de la función (juegos/prokingdoms/servidor.json) y aquí se
   responde CORS solo a las páginas del sitio. `POST /api/join` exige el token de Firebase de la
   sesión (`Authorization: Bearer`, verificado con el Admin SDK) y que la cuenta esté en
   `betaTesters/<uid>` mientras dure la beta (`SOLO_BETA`). La cuenta es el uid: un reino por
   cuenta, en todos sus aparatos. join devuelve el token del juego (`X-PK-Token`), que sirve para
   el resto de las rutas, también para `sendBeacon` al cerrar (que no puede mandar cabeceras).

   Guía de despliegue: firebase/CONFIGURAR-FIREBASE.md, «Servidor de Pro Kingdoms». */
'use strict';
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

// La base del sitio, explícita: sin ella el emulador (sin sesión de la CLI) adivina otra instancia.
initializeApp({ databaseURL: 'https://mi-pagina-pro-default-rtdb.firebaseio.com' });
process.env.PK_TICK_PEREZOSO = '1';
process.env.PK_SAVE_MAX = '2000000';   // una partida pesa 10–20 KB; 2 MB es de sobra

const SOLO_BETA = true;                 // mientras Pro Kingdoms sea beta cerrada
const ORIGENES = new Set(['https://paginita-pro.cl', 'https://www.paginita-pro.cl', 'https://cstappung.github.io', 'http://localhost:8123', 'http://127.0.0.1:8123']);

const store = require('./juego/server/store.js');
let sim = null, listo = null;
/* El arranque en frío: baja el estado de la RTDB y recién entonces carga sim.js (que lee los
   jugadores al cargarse y genera el mapa por semilla). Si la lectura falla, el próximo pedido
   lo vuelve a intentar. */
function arranca() {
  // sim.js puede reiniciar el mundo al cargarse (D.MUNDO_VER): ese borrado termina antes del primer pedido
  if (!listo) listo = store.carga().then(() => { sim = require('./juego/server/sim.js'); return store.pendientes(); }).catch(e => { listo = null; throw e; });
  return listo;
}

// Las rutas de server/index.js. GET /api/save no está: la partida se lee de la RTDB (asíncrona), abajo.
const RUTAS = {
  'GET /api/status': () => sim.status(),
  'POST /api/join': (p, b) => sim.join(b),
  'POST /api/sync': (p, b) => sim.sync(p, b),
  'POST /api/save': (p, b) => sim.putSave(p, b),
  'DELETE /api/save': p => sim.deleteSave(p),
  'GET /api/offers': p => sim.listOffers(p),
  'POST /api/offers': (p, b) => sim.postOffer(p, b),
  'POST /api/offers/accept': (p, b) => sim.acceptOffer(p, b),
  'POST /api/offers/cancel': (p, b) => sim.cancelOffer(p, b),
  'GET /api/guilds': p => sim.listGuilds(p),
  'POST /api/guilds/create': (p, b) => sim.createGuild(p, b),
  'POST /api/guilds/join': (p, b) => sim.joinGuild(p, b),
  'POST /api/guilds/leave': p => sim.leaveGuild(p),
  'POST /api/guilds/contribute': (p, b) => sim.contribute(p, b),
  'POST /api/guilds/chat': (p, b) => sim.guildChat(p, b),
  'POST /api/guilds/event': (p, b) => sim.eventContribute(p, b),
  'POST /api/world/chat': (p, b) => sim.worldChat(p, b),
  'POST /api/guilds/ask': (p, b) => sim.askHelp(p, b),
  'POST /api/guilds/help': (p, b) => sim.giveHelp(p, b),
  'POST /api/guilds/need': (p, b) => sim.askNeed(p, b),
  'POST /api/guilds/need/send': (p, b) => sim.sendNeed(p, b),
  'POST /api/claim': (p, b) => sim.claim(p, b),
  'POST /api/pase/claim': (p, b) => sim.paseClaim(p, b),
  'POST /api/saqueo': (p, b) => sim.saqueo(p, b),
  'POST /api/conquer': (p, b) => sim.conquer(p, b),
  'POST /api/conquer-bot': (p, b) => sim.conquerBot(p, b),
  'GET /api/ranking': p => sim.ranking(p),
};
const PUBLICAS = new Set(['GET /api/status', 'POST /api/join']);

/* Límite de pedidos, el de server/index.js: una cubeta por IP y otra por jugador. Viven en la
   memoria de la única instancia (se pierden en un arranque en frío, y no importa). */
const LIMITES = { ip: { rate: 15, burst: 120 }, token: { rate: 2, burst: 30 }, join: { rate: 30 / 3600, burst: 20 } };
const cubetas = { ip: new Map(), token: new Map(), join: new Map() };
function deja(tipo, k) {
  const cfg = LIMITES[tipo], m = cubetas[tipo], t = Date.now();
  if (m.size > 5000) for (const [x, b] of m) if (t - b.at > 3600e3) m.delete(x);
  const b = m.get(k) || { n: cfg.burst, at: t };
  b.n = Math.min(cfg.burst, b.n + ((t - b.at) / 1000) * cfg.rate);
  b.at = t; m.set(k, b);
  if (b.n < 1) return false;
  b.n--;
  return true;
}

/* El token de Firebase de la sesión → uid. verifyIdToken es criptografía local con las claves de
   Google en caché; aun así se recuerda cada token hasta que vence. */
const verificados = new Map();
async function uidDe(req) {
  const m = /^Bearer\s+(.+)$/.exec(req.get('authorization') || '');
  if (!m) return null;
  const tok = m[1], v = verificados.get(tok);
  if (v && v.exp > Date.now()) return v.uid;
  try {
    const d = await getAuth().verifyIdToken(tok);
    if (verificados.size > 2000) verificados.clear();
    verificados.set(tok, { uid: d.uid, exp: d.exp * 1000 });
    return d.uid;
  } catch (e) { return null; }
}
/* ¿Está en la lista de beta testers? Una lectura chica, recordada un minuto. */
const betas = new Map();
async function esBeta(uid) {
  const v = betas.get(uid);
  if (v && Date.now() - v.at < 60000) return v.si;
  const si = (await getDatabase().ref(`betaTesters/${uid}`).get()).exists();
  betas.set(uid, { si, at: Date.now() });
  return si;
}

function cuerpo(req) {
  const raw = req.rawBody;
  if (!raw || !raw.length) return {};
  if (raw.length > 5e6) throw new sim.GameError('Petición demasiado grande.', 413);
  // sendBeacon manda text/plain (sin preflight CORS): se lee igual, como JSON
  try { return JSON.parse(raw.toString('utf8')); } catch (e) { throw new sim.GameError('JSON no válido.'); }
}

let ultimoTick = 0, ultimoFlush = 0;
async function guarda(forzar) {
  if (forzar || (store.sucio() && Date.now() - ultimoFlush >= 3000)) { ultimoFlush = Date.now(); await store.flush(); }
}
// Al apagar la instancia (Cloud Run avisa con SIGTERM y da unos segundos), se sube lo pendiente.
process.on('SIGTERM', () => { Promise.all([store.flush(), store.pendientes()]).catch(() => {}); });

async function atiende(req, res) {
  const origen = req.get('origin');
  if (origen && ORIGENES.has(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-PK-Token, Authorization');
    res.set('Access-Control-Max-Age', '7200');   // el máximo que respeta Chrome: menos preflights (cada uno es una invocación)
    return res.status(204).end();
  }
  res.set('Cache-Control', 'no-store');
  const envia = (st, obj) => res.status(st).json(obj);
  // Otra web no puede usar el servidor desde un navegador (sin CORS no lee la respuesta); un pedido sin
  // Origin (sendBeacon a veces, curl) sigue necesitando el token del juego o el de Firebase.
  if (origen && !ORIGENES.has(origen)) return envia(403, { error: 'Origen no permitido.' });

  const ruta = req.method + ' ' + req.path.replace(/\/+$/, '');
  if (ruta !== 'GET /api/save' && ruta !== 'POST /api/pase/refresh' && !RUTAS[ruta]) return envia(404, { error: 'Ruta desconocida.' });
  try {
    await arranca();
    const t = Date.now();
    if (t - ultimoTick >= 5000) { ultimoTick = t; try { sim.tick(); } catch (e) { console.error('[tick]', e); } }

    const b = req.method === 'GET' || req.method === 'DELETE' ? {} : cuerpo(req);
    const ip = req.ip || '?';
    if (req.method !== 'GET' && !deja('ip', ip)) return envia(429, { error: 'Demasiados pedidos; espera un momento.' });

    if (ruta === 'POST /api/join') {
      const uid = await uidDe(req);
      if (!uid) return envia(401, { error: 'Inicia sesión en Juegos para entrar al mundo compartido.' });
      if (SOLO_BETA && !(await esBeta(uid))) return envia(403, { error: 'Pro Kingdoms en línea es solo para beta testers.' });
      if (!sim.byUid(uid) && !deja('join', ip)) return envia(429, { error: 'Se crearon demasiadas cuentas desde tu red. Prueba más tarde.' });
      const r = sim.join(Object.assign({}, b, { uid, token: undefined }));
      // el pase comprado se revisa también al entrar, por si el aviso de la página se perdió
      const pj = sim.byUid(uid), n = sim.pasePeriodo();
      if (pj && !(pj.pase && pj.pase.n === n && pj.pase.dorado)) { const x = (await getDatabase().ref('pkPase/' + uid + '/' + n).get()).val(); if (x && x.p === 2500 && x.s === n) sim.paseActivar(pj, true); }
      await guarda(true);                          // un jugador nuevo no puede perderse en un arranque en frío
      return envia(200, r);
    }
    if (ruta === 'GET /api/status') return envia(200, sim.status());

    const p = sim.byToken(req.get('x-pk-token') || req.query.t || b.token);
    if (!p) return envia(401, { error: 'Sesión no válida.' });
    if (req.method !== 'GET' && !deja('token', p.token)) { sim.suspect(p, 'pedidos', { limite: 'token' }); return envia(429, { error: 'Demasiados pedidos; espera un momento.' }); }

    if (ruta === 'GET /api/save') return envia(200, { save: await store.leeSave(p.id) });
    // Pase del Reino: la compra la escribió la página de Juegos en pkPase/<uid>/<período> (regla de escritura
    // única con el precio y el período); aquí se lee con el Admin SDK y recién entonces se marca la pista dorada.
    if (ruta === 'POST /api/pase/refresh') {
      const n = sim.pasePeriodo(), x = p.uid ? (await getDatabase().ref('pkPase/' + p.uid + '/' + n).get()).val() : null;
      const r = sim.paseActivar(p, !!(x && x.p === 2500 && x.s === n));
      await guarda(false);
      return envia(200, r);
    }
    const r = RUTAS[ruta](p, b);
    if (ruta.endsWith(' /api/save')) await store.pendientes();   // la partida queda escrita antes de contestar
    await guarda(false);
    return envia(200, r);
  } catch (e) {
    const juego = sim && e instanceof sim.GameError;
    if (!juego) console.error(e);
    return envia(e.status || 500, { error: juego ? e.message : 'Error del servidor.' });
  }
}

exports.prokingdoms = onRequest({
  region: 'us-central1',        // la misma región que la RTDB del proyecto
  maxInstances: 1,              // UNA copia del mundo (y el freno de gasto principal)
  concurrency: 80,
  cpu: 1,
  memory: '512MiB',
  timeoutSeconds: 30,
  invoker: 'public',            // la protección es CORS + el token de Firebase, no IAM
}, atiende);
