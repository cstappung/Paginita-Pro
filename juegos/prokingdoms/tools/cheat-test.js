// Prueba antitrampa: un cliente falso intenta inflar recursos, era, ejército, ofertas y envíos, y el servidor lo frena.
// Uso: node tools/cheat-test.js
// Arranca su propio servidor en otro puerto con una carpeta de datos temporal (no toca server/data/).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8000 + Math.floor(Math.random() * 900);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-cheat-'));
const URL = 'http://127.0.0.1:' + PORT;
let failed = 0;

function check(ok, what, detail) {
  console.log((ok ? '  ok    ' : '  FALLA ') + what + (detail !== undefined ? '  → ' + detail : ''));
  if (!ok) failed++;
}
async function api(method, route, body, token) {
  const res = await fetch(URL + route, {
    method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-PK-Token': token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const snap = o => Object.assign({ era: 1, pop: 10, defense: 30, truce: false, res: { food: 200, wood: 200, stone: 100, gold: 100 }, total: 0, army: 0, walls: 0, score: 0 }, o);
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, PK_DATA: DATA }), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  srv.stdout.on('data', d => (out += d)); srv.stderr.on('data', d => (out += d));
  try {
    for (let i = 0; i < 50 && !out.includes('Pro Kingdoms en'); i++) await wait(100);

    console.log('\nCuentas');
    const hj = (await api('POST', '/api/join', { name: 'Honesta' })).data, honest = hj.player;
    const cheat = (await api('POST', '/api/join', { name: 'Tramposa' })).data.player;
    check(honest && cheat, 'se crean dos cuentas');

    // estado inicial de las zonas comunes
    const first = (await api('POST', '/api/sync', { since: 0, snap: snap() }, honest.token)).data;
    const ids = Object.keys(first.nodes);
    const id = ids[0], start = first.nodes[id][0];
    await api('POST', '/api/sync', { since: 0, snap: snap() }, cheat.token);

    console.log('\nRecolección');
    let r = (await api('POST', '/api/sync', { since: 0, harvest: { [id]: 20 } }, honest.token)).data;
    check(Math.abs(r.nodes[id][0] - (start - 20)) < 1, 'la cuenta honesta recolecta 20 sin problema', start + ' → ' + r.nodes[id][0].toFixed(1));
    const sum = nodes => ids.reduce((s, k) => s + nodes[k][0], 0), total0 = sum(r.nodes);
    const all = {};
    for (const k of ids) all[k] = 1e6;
    r = (await api('POST', '/api/sync', { since: 0, harvest: all }, cheat.token)).data;
    const drained = total0 - sum(r.nodes);
    // 10 aldeanos × 120 s de cubeta inicial a la mejor tasa posible: unos pocos miles, nunca millones
    check(drained > 0 && drained < 5000, 'la tramposa informa 1.000.000 en cada uno de los ' + ids.length + ' recursos comunes: solo se descuenta lo posible', Math.round(drained) + ' de ' + (ids.length * 1e6).toExponential(1) + ' informados');
    const id2 = ids.reduce((a, k) => (r.nodes[k][0] > r.nodes[a][0] ? k : a), ids[0]), after = r.nodes[id2][0];
    r = (await api('POST', '/api/sync', { since: 0, harvest: { [id2]: 1e6 } }, cheat.token)).data;
    check(after - r.nodes[id2][0] < 50, 'con la cubeta vacía, el siguiente sync casi no descuenta', (after - r.nodes[id2][0]).toFixed(1));

    console.log('\nFoto del reino');
    await api('POST', '/api/sync', { snap: snap({ era: 60, pop: 1e6, army: 1e12, defense: 1e12, score: 1e9, total: 1e12, res: { food: 1e9, wood: 1e9, stone: 1e9, gold: 1e9 } }) }, cheat.token);
    let view = (await api('POST', '/api/sync', { snap: snap() }, honest.token)).data.players.find(o => o.id === cheat.id);
    check(view.era === 1, 'la era no salta de 1 a 60', view.era);
    check(view.army < 1e5 && view.defense < 1e5, 'ejército y defensa imposibles se recortan', 'ejército ' + view.army + ', defensa ' + view.defense);
    check(view.score < 1000, 'el puntaje lo calcula el servidor', view.score);
    let rank = (await api('GET', '/api/ranking', null, honest.token)).data.find(o => o.name === 'Tramposa');
    check(rank.total < 1e5 && rank.pop <= 90, 'el ranking no muestra la recolección ni la población infladas', 'total ' + rank.total + ', población ' + rank.pop);
    // la era sube de a una, con un tiempo mínimo entre subidas (30 s para la era II), y no baja
    console.log('  (esperando 30 s para probar la subida de era…)');
    await wait(30500);
    await api('POST', '/api/sync', { snap: snap({ era: 2 }) }, cheat.token);
    await api('POST', '/api/sync', { snap: snap({ era: 1 }) }, cheat.token);
    view = (await api('POST', '/api/sync', {}, honest.token)).data.players.find(o => o.id === cheat.id);
    check(view.era === 2, 'la era sube a 2 (pasó el tiempo mínimo) y luego no baja', view.era);
    await api('POST', '/api/sync', { snap: snap({ era: 3 }) }, cheat.token);
    view = (await api('POST', '/api/sync', {}, honest.token)).data.players.find(o => o.id === cheat.id);
    check(view.era === 2, 'pasar a la era 3 en segundos no se acepta', view.era);

    console.log('\nMercado');
    let o = await api('POST', '/api/offers', { give: 'gold', gn: 1e9, want: 'food', wn: 10 }, cheat.token);
    check(o.status === 400, 'no se puede ofrecer mil millones de oro', o.data.error);
    o = await api('POST', '/api/offers', { give: 'gold', gn: 3000, want: 'food', wn: 10 }, cheat.token);
    check(o.status === 400, 'ni 3000 de oro si su almacén tiene 100 (se lo devolverían al cancelar)', o.data.error);
    o = await api('POST', '/api/offers', { give: 'wood', gn: 10, want: 'gems', wn: 1e6 }, cheat.token);
    check(o.status === 400, 'no se puede pedir un millón de gemas por 10 de madera', o.data.error);
    o = await api('POST', '/api/offers', { give: 'wood', gn: 50, want: 'stone', wn: 50 }, honest.token);
    check(o.status === 200, 'la cuenta honesta publica una oferta normal');
    r = (await api('POST', '/api/sync', { market: [{ res: 'gems', n: 1e7, side: 'buy' }] }, cheat.token)).data;
    check(r.prices.gems < 1500 * 4, 'una compra enorme no lleva el precio al tope', Math.round(r.prices.gems));

    console.log('\nGremio');
    await api('POST', '/api/guilds/join', { id: 'g_roble' }, cheat.token);
    const c = await api('POST', '/api/guilds/contribute', { res: 'wood', n: 1e9 }, cheat.token);
    check(c.status === 200 && c.data.accepted <= 300, 'aportar mil millones de madera: solo se acepta lo que hay en su almacén', c.data.accepted);

    // ya no hay saqueos (la fuerza enviada se sigue validando en las campañas de conquista)
    console.log('\nTablón "Necesito…"');
    await api('POST', '/api/guilds/join', { id: 'g_roble' }, honest.token);
    const need = await api('POST', '/api/guilds/need', { res: 'food' }, honest.token);
    const nid = need.data.mine && need.data.mine.needs.find(h => h.mine);
    check(need.status === 200 && !!nid, 'la cuenta honesta pide comida en el tablón', need.data.error);
    const gift = nid ? await api('POST', '/api/guilds/need/send', { id: nid.id, n: 1e9 }, cheat.token) : { status: 0, data: {} };
    check(gift.status === 200 && gift.data.accepted <= Math.min(nid.n, 300), 'mandar mil millones de comida: solo sale lo que pide el pedido y hay en su almacén', gift.data.accepted !== undefined ? gift.data.accepted + ' de ' + nid.n + ' pedidos' : gift.data.error);

    console.log('\nLímite de pedidos');
    const burst = await Promise.all(Array.from({ length: 60 }, () => api('POST', '/api/sync', {}, cheat.token)));
    const n429 = burst.filter(x => x.status === 429).length;
    check(n429 > 0 && n429 < 60, '60 syncs seguidos: la cuenta queda frenada con 429', n429 + ' rechazados');
    const ok = await api('POST', '/api/sync', {}, honest.token);
    check(ok.status === 200, 'la cuenta honesta sigue funcionando');
    const joins = [];
    for (let i = 0; i < 10; i++) joins.push((await api('POST', '/api/join', { name: 'Multi' + i })).status);
    check(joins.includes(429), 'crear muchas cuentas desde la misma IP termina en 429', joins.join(' '));

    console.log('\nJuego normal');
    // la cuenta honesta juega como el cliente real: un poco de recolección y recursos que crecen despacio
    let okAll = true;
    for (let i = 1; i <= 4; i++) {
      await wait(1000);
      const res = { food: 200 + 8 * i, wood: 200 + 6 * i, stone: 100 + 3 * i, gold: 100 + 2 * i };
      const x = await api('POST', '/api/sync', { harvest: { [ids[5]]: 3 }, snap: snap({ res, total: 20 * i, pop: 12, army: 0, defense: 25 }) }, honest.token);
      okAll = okAll && x.status === 200;
    }
    check(okAll, 'cuatro syncs normales pasan sin rechazo');

    console.log('\nRegistro');
    await wait(300);
    const log = fs.existsSync(path.join(DATA, 'sospechas.log')) ? fs.readFileSync(path.join(DATA, 'sospechas.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
    const kinds = [...new Set(log.map(e => e.kind))];
    check(['recoleccion', 'foto', 'oferta', 'mercado', 'tablon', 'pedidos'].every(k => kinds.includes(k)), 'quedó registrado en sospechas.log', kinds.join(', '));
    check(!log.some(e => e.name === 'Honesta'), 'la cuenta honesta no aparece en el registro');
  } finally {
    srv.kill();
    await wait(200);
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  console.log(failed ? '\n' + failed + ' comprobaciones fallaron.' : '\nTodo en orden: el cliente falso fue frenado.');
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
