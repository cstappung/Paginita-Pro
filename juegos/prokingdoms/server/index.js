// Servidor HTTP local: sirve el juego y la API JSON del multijugador. Sin dependencias externas.
// Los clientes sincronizan por consultas periódicas (cada pocos segundos), sin WebSockets.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sim = require('./sim');
const store = require('./store');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };

// Rutas de la API: 'MÉTODO /ruta' -> (jugador, cuerpo) => respuesta
// En el servidor local no hay RTDB: con PK_PASE_LIBRE=1 (pruebas) la pista dorada se activa sin compra.
const routes = {
  'POST /api/pase/claim': (p, b) => sim.paseClaim(p, b),
  'POST /api/saqueo': (p, b) => sim.saqueo(p, b),
  'POST /api/diplo/propose': (p, b) => sim.diploPropose(p, b),
  'POST /api/diplo/accept': (p, b) => sim.diploAccept(p, b),
  'POST /api/diplo/gift': (p, b) => sim.diploGift(p, b),
  'POST /api/diplo/evento': (p, b) => sim.diploEvento(p, b),
  'POST /api/pase/refresh': p => sim.paseActivar(p, !!process.env.PK_PASE_LIBRE),
  'GET /api/status': () => sim.status(),
  'POST /api/join': (p, b) => sim.join(b),
  'POST /api/sync': (p, b) => sim.sync(p, b),
  'GET /api/save': p => sim.getSave(p),
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
  'POST /api/conquer': (p, b) => sim.conquer(p, b),
  'POST /api/conquer-bot': (p, b) => sim.conquerBot(p, b),
  'GET /api/ranking': p => sim.ranking(p),
};
const PUBLIC = new Set(['GET /api/status', 'POST /api/join']);

// Límite de pedidos en las rutas de escritura: una cubeta por IP y otra por token (se rellenan a `rate`
// por segundo hasta `burst`). Las cuentas nuevas también tienen tope por IP, contra las multicuentas.
// El cliente normal hace un sync cada 4 s y alguna acción suelta: queda muy por debajo.
const LIMITS = { ip: { rate: 15, burst: 120 }, token: { rate: 2, burst: 30 }, join: { rate: 5 / 3600, burst: 8 } };
const buckets = { ip: new Map(), token: new Map(), join: new Map() };
function allow(kind, key) {
  const cfg = LIMITS[kind], map = buckets[kind], t = Date.now();
  const b = map.get(key) || { n: cfg.burst, at: t };
  b.n = Math.min(cfg.burst, b.n + ((t - b.at) / 1000) * cfg.rate);
  b.at = t;
  map.set(key, b);
  if (b.n < 1) return false;
  b.n--;
  return true;
}
setInterval(() => {
  const t = Date.now();
  for (const kind in buckets) for (const [k, b] of buckets[kind]) if (t - b.at > 3600e3) buckets[kind].delete(k);
}, 600e3).unref();
const throttled = new Map(); // clave -> última vez registrada
function logThrottle(kind, key, p) {
  const t = Date.now(), id = kind + ':' + key;
  if (t - (throttled.get(id) || 0) < 60000) return;
  throttled.set(id, t);
  if (p) sim.suspect(p, 'pedidos', { limite: kind });
  else { console.warn('[sospecha] límite de pedidos', kind, key); store.log({ at: new Date(t).toISOString(), kind: 'pedidos', limite: kind, ip: key }); }
}
function clientIp(req) {
  const fwd = process.env.PK_TRUST_PROXY && req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0].trim() : req.socket.remoteAddress) || '?';
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 5e6) { reject(new sim.GameError('Petición demasiado grande.', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new sim.GameError('JSON no válido.')); }
    });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const key = req.method + ' ' + url.pathname;
  const fn = routes[key];
  if (!fn) return send(res, 404, { error: 'Ruta desconocida.' });
  try {
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const token = req.headers['x-pk-token'] || url.searchParams.get('t') || body.token;
    const p = sim.byToken(token);
    if (!p && !PUBLIC.has(key)) return send(res, 401, { error: 'Sesión no válida.' });
    if (req.method !== 'GET') {
      const ip = clientIp(req);
      const kind = !allow('ip', ip) ? 'ip' : p && !allow('token', p.token) ? 'token' : key === 'POST /api/join' && !p && !allow('join', ip) ? 'join' : null;
      if (kind) {
        logThrottle(kind, ip, p);
        return send(res, 429, { error: kind === 'join' ? 'Se crearon demasiadas cuentas desde tu red. Prueba más tarde.' : 'Demasiados pedidos; espera un momento.' });
      }
    }
    send(res, 200, fn(p, body));
  } catch (e) {
    if (!(e instanceof sim.GameError)) console.error(e);
    send(res, e.status || 500, { error: e instanceof sim.GameError ? e.message : 'Error del servidor.' });
  }
}

function serveStatic(req, res, url) {
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.normalize(path.join(ROOT, rel));
  const inside = file.startsWith(ROOT + path.sep);
  const hidden = /[\\/](server|\.claude|\.git|node_modules)([\\/]|$)/.test(file.slice(ROOT.length));
  if (!inside || hidden) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) api(req, res, url);
  else serveStatic(req, res, url);
}).listen(PORT, () => {
  console.log('Pro Kingdoms en http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || [])
    if (a.family === 'IPv4' && !a.internal) console.log('  En tu red local: http://' + a.address + ':' + PORT);
  console.log('Datos guardados en ' + (process.env.PK_DATA || 'server/data/'));
});
