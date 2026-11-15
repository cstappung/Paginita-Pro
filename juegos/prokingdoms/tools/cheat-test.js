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
// join pide la versión de protocolo del cliente (D.PROTO en js/data.js)
const PROTO = +/D\.PROTO = (\d+)/.exec(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'))[1];
let failed = 0;

function check(ok, what, detail) {
  console.log((ok ? '  ok    ' : '  FALLA ') + what + (detail !== undefined ? '  → ' + detail : ''));
  if (!ok) failed++;
}
async function api(method, route, body, token) {
  if (route === '/api/join' && body && !('proto' in body)) body = Object.assign({ proto: PROTO }, body);
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
    const cj = (await api('POST', '/api/join', { name: 'Tramposa' })).data, cheat = cj.player;
    check(honest && cheat, 'se crean dos cuentas');

    // L4 (pk-45): las zonas comunes son de cada jugador; el servidor ya no lleva sus recursos
    console.log('\nZonas comunes (L4)');
    let r = (await api('POST', '/api/sync', { since: 0, snap: snap(), harvest: { 1: 1e6, 2: 1e6 } }, honest.token));
    check(r.status === 200 && r.data.nodes === undefined, 'el sync ya no trae recursos comunes y una «recolección» vieja se ignora', r.status);
    await api('POST', '/api/sync', { since: 0, snap: snap() }, cheat.token);

    console.log('\nMurallas ajenas (L4)');
    {
      const terr = r.data.terr, MAP = 256, PAR = 8, PW = MAP / PAR, slot = cj.world.slot;
      const suyas = [];
      for (let y = 0; y < MAP && suyas.length < 5000; y++) for (let x = 0; x < MAP; x++) if (terr[Math.floor(y / PAR) * PW + Math.floor(x / PAR)] === slot + 1) suyas.push(y * MAP + x);
      const afuera = []; for (let k = 0; k < 5000 && afuera.length < 50; k++) if (terr[Math.floor(Math.floor(k / MAP) / PAR) * PW + Math.floor((k % MAP) / PAR)] !== slot + 1) afuera.push(k);
      await api('POST', '/api/sync', { snap: snap({ muros: { v: 'x1', t: suyas.concat(afuera), g: [suyas[0], suyas[0]], tier: 9 } }) }, cheat.token);
      const vista = (await api('POST', '/api/sync', { snap: snap() }, honest.token)).data.players.find(o => o.id === cheat.id);
      const m = vista && vista.muros;
      check(m && m.t.length + m.g.length <= 300 + 150 && m.t.every(k => suyas.includes(k)), 'murallas fuera de sus parcelas o sobre el tope se recortan', m && (m.t.length + m.g.length) + ' de ' + (suyas.length + afuera.length));
      check(m && m.tier === 4 && m.g.length === 1, 'material hasta bastión y sin puertas repetidas', m && m.tier + ' / ' + m.g.length);
      const otra = (await api('POST', '/api/sync', { snap: snap(), mv: { [cheat.id]: vista.mv } }, honest.token)).data.players.find(o => o.id === cheat.id);
      check(otra && otra.muros === undefined, 'si ya las tiene, no vuelven a viajar');
    }

    console.log('\nCalzada Real (L5)');
    {
      const terr = r.data.terr, MAP = 256, PAR = 8, PW = MAP / PAR, hs = hj.world.slot, cs = cj.world.slot;
      const dueño = k => terr[Math.floor(Math.floor(k / MAP) / PAR) * PW + Math.floor((k % MAP) / PAR)];
      // casillas de la honesta (su tierra) y de la tramposa
      const deH = [], deC = [];
      for (let k = 0; k < MAP * MAP && (deH.length < 200 || deC.length < 50); k++) { if (dueño(k) === hs + 1 && deH.length < 200) deH.push(k); else if (dueño(k) === cs + 1 && deC.length < 50) deC.push(k); }
      let a = await api('POST', '/api/autopista', { add: deC.concat(deH.slice(0, 20)) }, cheat.token);
      check(a.status === 200 && a.data.aceptadas.every(k => dueño(k) === cs + 1) && a.data.aceptadas.length > 0, 'en tierra ajena se rechaza; en la suya se acepta', a.data.aceptadas && a.data.aceptadas.length + ' de ' + (deC.length + 20));
      a = await api('POST', '/api/autopista', { add: deH }, honest.token);
      check(a.status === 200 && a.data.aceptadas.length <= 60, 'sobre el tope del día (60 × era) no se acepta más', a.data.aceptadas.length + ' de ' + deH.length + ', tope ' + a.data.tope);
      const s2 = (await api('POST', '/api/sync', { snap: snap(), apv: 0 }, cheat.token)).data;
      check(s2.autopistas && Object.keys(s2.autopistas.t).length === a.data.aceptadas.length + Object.keys(s2.autopistas.t).filter(k => dueño(+k) === cs + 1).length, 'el otro jugador la ve en su sync');
      const s3 = (await api('POST', '/api/sync', { snap: snap(), apv: s2.autopistas.v }, cheat.token)).data;
      check(s3.autopistas === undefined, 'si ya tiene la versión, no vuelve a viajar');
      const suya = a.data.aceptadas[0];
      a = await api('POST', '/api/autopista', { del: [suya] }, cheat.token);
      check(a.data.quitadas.length === 0, 'la de otro solo se quita en tu territorio');
    }

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

    console.log('\nPase del Reino');
    let pz = (await api('POST', '/api/sync', { since: 0, pase: {} }, cheat.token)).data.pase;
    for (let i = 1; i <= 8; i++) pz = (await api('POST', '/api/sync', { since: 0, pase: { upgrades: i * 1e6, exp_won: i * 1e6, aldeanos: i * 1e6, bosses_killed: i * 1e6, g_total: i * 1e9 } }, cheat.token)).data.pase;
    check(pz && pz.ppHoy <= pz.tope && pz.pp <= pz.tope, 'la tramposa informa millones de mejoras y jefes: el pase suma como mucho el tope del día', pz && pz.pp + ' PP (tope ' + pz.tope + ')');
    r = await api('POST', '/api/pase/claim', { nivel: 30, pista: 'g' }, cheat.token);
    check(r.status === 400, 'no se reclama un nivel no alcanzado', r.data.error);
    r = await api('POST', '/api/pase/claim', { nivel: 1, pista: 'd' }, cheat.token);
    check(r.status === 400, 'ni la pista dorada sin comprarla', r.data.error);
    r = await api('POST', '/api/pase/refresh', {}, cheat.token);
    check(r.status === 200 && !r.data.pase.dorado, 'pedir la pista dorada sin compra no la da', r.data.pase && r.data.pase.dorado);
    r = await api('POST', '/api/pase/claim', { nivel: 1, pista: 'g' }, cheat.token);
    const r2 = await api('POST', '/api/pase/claim', { nivel: 1, pista: 'g' }, cheat.token);
    check(r.status === 200 && r2.status === 400, 'un premio se reclama una sola vez', r2.data.error);

    console.log('\nEl archipiélago (Fase 9)');
    // una cuenta en el mar: el servidor no ve su mapa, así que todo lo de la tierra que mande se ignora
    const mar = (await api('POST', '/api/join', { name: 'Marina' })).data.player;
    await api('POST', '/api/sync', { since: 0, snap: snap() }, mar.token);
    let m = await api('POST', '/api/sync', { since: 0, mundo: 'mar', snap: snap({ era: 9, res: { food: 1e9, wood: 1e9, stone: 1e9, gold: 1e9 } }), pase: { upgrades: 1e6, exp_won: 1e6 }, market: [{ t: 'buy', r: 'wood', n: 1e6 }] }, mar.token);
    check(m.status === 200 && !m.data.players.length && m.data.terr === undefined, 'en el mar el sync no trae la tierra (reinos ni territorio)', m.status);
    const visto = (await api('POST', '/api/sync', { since: 0 }, honest.token)).data.players.find(o => o.id === mar.id);
    check(visto && visto.era === 1, 'la foto mandada desde el mar no cambia su reino de la tierra (era 9 inventada)', visto && visto.era);
    m = await api('POST', '/api/pase/refresh', {}, mar.token);
    check(m.status === 200 && m.data.pase && m.data.pase.pp === 0, 'ni el pase suma puntos con estadísticas mandadas desde el mar', m.data.pase && m.data.pase.pp);
    m = await api('POST', '/api/regata', { ruta: 'altamar', barco: { casco: 10, velas: 10, timon: 10 } }, mar.token);
    check(m.status === 200 && m.data.barcoUsado.velas === 1, 'recién llegada, su primera regata no corre con el barco al máximo', m.data.barcoUsado && JSON.stringify(m.data.barcoUsado));
    m = await api('POST', '/api/flota', { units: { galeon: 120 } }, mar.token);
    check(m.status === 400, 'ni anota 120 galeones como flota de duelo', m.data.error);
    m = await api('POST', '/api/flota', { units: { balandra: 10 } }, mar.token);
    const rival = (await api('POST', '/api/duelos', {}, honest.token)).data;
    check(m.status === 200 && rival.rivales.some(o => o.id === mar.id), 'una flota posible sí se anota y otros la ven', m.data.flota && m.data.flota.poder);
    m = await api('POST', '/api/sync', { since: 0, snap: snap({ era: 9, res: { food: 1e9, wood: 1e9, stone: 1e9, gold: 1e9 } }) }, mar.token);
    const vuelta = (await api('POST', '/api/sync', { since: 0 }, honest.token)).data.players.find(o => o.id === mar.id);
    check(m.status === 200 && m.data.players.length > 0 && vuelta.era < 9, 'de vuelta en la tierra recibe a los demás reinos, y la foto inflada se sigue frenando', 'era ' + (vuelta && vuelta.era));

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
      const x = await api('POST', '/api/sync', { snap: snap({ res, total: 20 * i, pop: 12, army: 0, defense: 25 }) }, honest.token);
      okAll = okAll && x.status === 200;
    }
    check(okAll, 'cuatro syncs normales pasan sin rechazo');

    console.log('\nRegistro');
    await wait(300);
    const log = fs.existsSync(path.join(DATA, 'sospechas.log')) ? fs.readFileSync(path.join(DATA, 'sospechas.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
    const kinds = [...new Set(log.map(e => e.kind))];
    check(['foto', 'murallas', 'autopista', 'oferta', 'mercado', 'tablon', 'pedidos', 'regata'].every(k => kinds.includes(k)), 'quedó registrado en sospechas.log', kinds.join(', '));
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
