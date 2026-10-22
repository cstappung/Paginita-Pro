/* Catan: el tablero, la baraja de eventos, que el registro se repite igual
   y lo que el reductor tiene que rechazar (llaves falsas, cartas mentidas).
   Las partidas de robots en todas las variantes están en
   catan-variantes-1/2.test.cjs (corren en paralelo con este). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  reducir, tableroCatan, cadenaCatan, llaveCatan, cartaCatan, sitiosCatan, hexesLadronCatan, victimasCatan, ratiosCatan, alcanzaCatan, cartasEnMano, piezasCatan, barcosMoviblesCatan, auditaCatan, compromiso, rutaCatan, progreso, meToca, CT_CADENA, CT_RECURSOS, CT_COSTE, CT_BARAJA, NOMBRES, azar, elige, sala, mover, llave, puñado, misCartas, rumbo, turnoRobot, juega
} = require('./catan-robots.cjs');

test('catan: el tablero básico es el de la caja', () => {
  const T = tableroCatan(777, false, false);
  const tierra = T.H.filter(h => h.isla >= 0);
  assert.equal(tierra.length, 19);
  assert.equal(T.V.filter(v => v.tierra).length, 54);
  assert.equal(T.E.filter(e => e.tierra).length, 72);
  assert.equal(T.puertos.length, 9);
  assert.equal(tierra.filter(h => h.n).length, 18);
  assert.equal(T.H[T.ladron].t, 'desierto');
  /* Ningún 6 o 8 junto a otro, y los puertos no comparten esquina. */
  for (const s of [1, 2, 3, 99, 12345, 4242]) for (const [g, m] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const U = tableroCatan(s, !!g, !!m);
    for (const h of U.H) if (h.n === 6 || h.n === 8)
      for (const e of h.e) for (const o of U.E[e].h) if (o !== h.i) assert.ok(![6, 8].includes(U.H[o].n), 'rojos juntos ' + s);
    const esq = U.puertos.flatMap(pt => [U.E[pt.e].a, U.E[pt.e].b]);
    assert.equal(new Set(esq).size, esq.length, 'puertos pegados ' + s);
    assert.ok(U.puertos.every(pt => U.H[pt.h].isla < 0), 'puerto sin mar');
  }
  const G = tableroCatan(5, true, false);
  assert.equal(G.H.filter(h => h.isla >= 0).length, 30);
  assert.equal(G.puertos.length, 11);
  const M = tableroCatan(5, false, true);
  assert.ok(M.islas >= 4 && M.H.some(h => h.t === 'oro') && M.pirata >= 0);
  assert.deepEqual(JSON.stringify(tableroCatan(5, false, true)), JSON.stringify(M), 'mismo tablero con la misma semilla');
});

test('catan: la baraja de eventos reparte como dos dados', () => {
  assert.equal(CT_BARAJA.length, 36);
  assert.equal(CT_BARAJA.filter(x => x === 7).length, 6);
  assert.equal(CT_BARAJA.filter(x => x === 2).length, 1);
});

test('catan: repetir el registro da el mismo estado', async () => {
  const { e, p } = await juega(4, 31, { exp: 'mar' }, 1500);
  const f = x => JSON.stringify({ ...x, T: null, hist: x.hist.slice(-10) });
  assert.equal(f(reducir(JSON.parse(JSON.stringify(p)))), f(e));
});

test('catan: una llave que no es de la cadena no tira los dados', async () => {
  const { p, sec } = await sala(3, 41);
  let e = reducir(p);
  for (const u of ['a', 'b', 'c']) e = mover(p, { t: 'k', uid: u, a: '0', c: llave(sec, e, u) });
  assert.equal(e.etapa, 'colocacion');
  const k = azar(3);
  while (e.etapa === 'colocacion') {
    const u = e.turno;
    e = mover(p, e.sub === 'poblado' ? { t: 'poblado', uid: u, v: elige(sitiosCatan(e, u, 'poblado', { inicial: true }), k) }
      : { t: 'camino', uid: u, e: elige(sitiosCatan(e, u, 'camino', { desde: e.ultPob }), k) });
  }
  const u = e.turno;
  /* Saltarse una llave (la siguiente de la siguiente) no vale: sería
     escoger entre dos resultados. */
  e = mover(p, { t: 'tira', uid: u, c: llaveCatan(sec[u].cad, e.aportes[u] + 1) });
  assert.equal(e.azar, null);
  assert.deepEqual([...e.falsas], [u]);
  e = mover(p, { t: 'tira', uid: u, c: llave(sec, e, u) });
  assert.equal(e.azar.tipo, 'dados');
  /* Quien tira no puede ayudarse a sí mismo. */
  e = mover(p, { t: 'k', uid: u, a: e.azar.id, c: llave(sec, e, u) });
  assert.ok(e.azar);
  const v = e.azar.pref;
  e = mover(p, { t: 'k', uid: v, a: e.azar.id, c: llave(sec, e, v) });
  assert.equal(e.azar, null);
  assert.ok(e.ultima.s >= 2 && e.ultima.s <= 12);
  /* Mandar otra vez la misma llave (una carrera de la red) no acusa a nadie. */
  const antes = e.falsas.length;
  e = mover(p, { t: 'k', uid: v, a: '9999', c: llaveCatan(sec[v].cad, e.aportes[v] - 1) });
  assert.equal(e.falsas.length, antes);
});

test('catan: la auditoría caza una carta mentida', async () => {
  for (let s = 50; s < 80; s++) {
    const { e, p, sec } = await juega(2, s, {}, 9000);
    if (e.fase !== 'fin') continue;
    const u = Object.keys(e.des).find(x => Object.keys(e.des[x].usadas).length);
    if (!u) continue;
    for (const x of Object.keys(sec)) p.jugadas[String(Object.keys(p.jugadas).length).padStart(4, '0')] = { t: 's', uid: x, sem: sec[x].sem, sal: sec[x].sal };
    const est = reducir(p);
    assert.deepEqual([...await auditaCatan(p, est)], []);
    /* Se cambia lo que dijo haber jugado por otra carta. */
    const k = Object.keys(e.des[u].usadas)[0];
    const clave = Object.keys(p.jugadas).find(c => p.jugadas[c].t === 'juega' && p.jugadas[c].uid === u && String(p.jugadas[c].k) === k);
    const verdad = p.jugadas[clave].c;
    const mentira = verdad === 'caballero' ? 'monopolio' : 'caballero';
    p.jugadas[clave] = { ...p.jugadas[clave], c: mentira, res: 'lana' };
    const mal = await auditaCatan(p, reducir(p));
    assert.ok(mal.some(f => f.uid === u && f.que === 'carta'), 'no vio la carta falsa');
    return;
  }
  assert.fail('ninguna partida jugó cartas');
});

test('catan: ruta más larga, ladrón amistoso, progreso y turno', async () => {
  const { e } = await juega(3, 61, { amable: 1 }, 400);
  const T = e.T;
  /* La ruta de cada uno es la que calcula `rutaCatan`. */
  for (const x of e.jugadores) assert.equal(e.rutas[x.uid], rutaCatan(e, x.uid));
  if (e.fase === 'jugando') {
    assert.ok(progreso(e, 'catan') >= 0 && progreso(e, 'catan') <= 1);
    assert.equal(meToca(e, e.debe[0] || '?'), e.debe.length > 0);
  }
  /* Con el ladrón amistoso, ningún hexágono ofrecido toca a quien tiene ≤2 puntos (salvo que no quede otro). */
  const u = e.jugadores[0].uid, hs = hexesLadronCatan(e, u);
  const pobres = e.jugadores.map(x => x.uid).filter(x => x !== u && e.vp[x] <= 2);
  const tocan = h => T.H[h].v.some(v => e.edif[v] && pobres.includes(e.edif[v].u));
  if (hs.some(h => !tocan(h))) assert.ok(hs.every(h => !tocan(h)));
});

test('catan: expulsar por votación es abandonar', async () => {
  const { e, p } = await juega(3, 71, {}, 120);
  assert.equal(e.fase, 'jugando');
  const echado = e.turno, otros = e.jugadores.map(x => x.uid).filter(u => u !== echado);
  let f = mover(p, { t: 'voto', uid: otros[0], contra: echado });
  assert.ok(!f.fuera[echado], 'con un voto de dos no basta');
  f = mover(p, { t: 'voto', uid: otros[1], contra: echado });
  assert.ok(f.fuera[echado]);
  assert.notEqual(f.turno, echado, 'el turno pasa al siguiente');
  assert.equal(f.fase, 'jugando');
  /* En un duelo, echar al otro es ganar. */
  const d = await juega(2, 72, {}, 80);
  const u = d.e.jugadores[0].uid, v = d.e.jugadores[1].uid;
  const g = mover(d.p, { t: 'voto', uid: u, contra: v });
  assert.equal(g.fase, 'fin');
  assert.equal(g.ganador, u);
  assert.equal(g.motivo, 'abandono');
});
