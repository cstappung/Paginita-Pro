/* Catan: robots que juegan partidas enteras contra el reductor, en todas
   las combinaciones de expansiones, y comprobaciones de lo que el
   reductor tiene que rechazar (llaves falsas, cartas mentidas). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const code = fs.readFileSync('src/juegos/motor.js', 'utf8').replace(/\bexport\s+/g, '');
const context = { crypto: require('node:crypto').webcrypto, TextEncoder }; vm.createContext(context);
vm.runInContext(code + ';Object.assign(this,{CT_CADENA,CT_RECURSOS,CT_COSTE,CT_BARAJA,llaveCatan,cartasEnMano,alcanzaCatan});', context);
const {
  reducir, tableroCatan, cadenaCatan, llaveCatan, cartaCatan, sitiosCatan, hexesLadronCatan, victimasCatan,
  ratiosCatan, alcanzaCatan, cartasEnMano, piezasCatan, barcosMoviblesCatan, auditaCatan, compromiso, rutaCatan,
  progreso, meToca, CT_CADENA, CT_RECURSOS, CT_COSTE, CT_BARAJA
} = context;

const NOMBRES = ['a', 'b', 'c', 'd', 'e', 'f'];
const azar = s => { let x = s >>> 0 || 1; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); };
const elige = (xs, k) => xs[Math.floor(k() * xs.length)];

async function sala(n, semilla, extra = {}) {
  const p = { juego: 'catan', semilla, estado: 'jugando', cupo: n, jugadores: {}, jugadas: {}, ...extra };
  const sec = {};
  for (let i = 0; i < n; i++) {
    const u = NOMBRES[i], sem = (semilla * 7919 + i * 104729) >>> 0, sal = 'sal' + semilla + u;
    sec[u] = { sem, sal, cad: cadenaCatan(sem, sal) };
    p.jugadores[u] = { nombre: u.toUpperCase(), orden: i, hcad: sec[u].cad[CT_CADENA], hmazo: await compromiso(sem, sal) };
  }
  return { p, sec };
}
const mover = (p, j) => { p.jugadas[String(Object.keys(p.jugadas).length).padStart(4, '0')] = j; return reducir(p); };
const llave = (sec, e, u) => llaveCatan(sec[u].cad, e.aportes[u] || 0);

/* Un reparto de `n` cartas sacadas de la mano `m`. */
function puñado(m, n, k) {
  const bolsa = [];
  for (const r of CT_RECURSOS) for (let i = 0; i < m[r]; i++) bolsa.push(r);
  const out = {};
  for (let i = 0; i < n; i++) { const j = Math.floor(k() * bolsa.length); const r = bolsa.splice(j, 1)[0]; out[r] = (out[r] || 0) + 1; }
  return out;
}
function misCartas(e, sec, u) {
  const d = e.des[u], out = [];
  for (let k = 0; k < d.n; k++) out.push({ k, tipo: cartaCatan(sec[u].sem, sec[u].sal, e.mezcla, k, e.T.grande), usada: !!d.usadas[k], rev: d.puntos.includes(k), vieja: d.t[k] < e.turnoN });
  return out;
}

/* En Navegantes, el barco que más se acerca a una isla sin colonizar:
   al azar, los barcos daban vueltas por el canal y nunca llegaban. */
function rumbo(e, u, es) {
  const T = e.T, destinos = T.V.filter(v => v.isla > 0 && !e.islas[u][v.isla]);
  if (!destinos.length) return es[0];
  const d = x => { const E = T.E[x], mx = T.V[E.a].x + T.V[E.b].x, my = T.V[E.a].y + T.V[E.b].y;
    return Math.min(...destinos.map(v => 3 * (2 * v.x - mx) ** 2 + (2 * v.y - my) ** 2)); };
  return es.slice().sort((a, b) => d(a) - d(b))[0];
}

/* Lo que haría un robot con poco seso: ciudad, poblado, carta, camino o
   barco, en ese orden; cambia con la banca lo que le sobra por lo que le
   falta; y de vez en cuando juega una carta u ofrece un trato. */
function turnoRobot(e, sec, u, k, p) {
  const m = e.mano[u], n = piezasCatan(e, u);
  const mias = misCartas(e, sec, u);
  const ocultos = mias.filter(c => c.tipo === 'punto' && !c.rev).map(c => c.k);
  if (ocultos.length && e.vp[u] + ocultos.length >= e.meta) return { t: 'revela', uid: u, ks: ocultos };
  if (!e.jugoDes && k() < 0.5) {
    const c = mias.find(c => !c.usada && !c.rev && c.vieja && c.tipo !== 'punto');
    if (c) {
      if (c.tipo === 'abundancia') return { t: 'juega', uid: u, k: c.k, c: c.tipo, r: { trigo: 1, mineral: 1 } };
      if (c.tipo === 'monopolio') return { t: 'juega', uid: u, k: c.k, c: c.tipo, res: elige(CT_RECURSOS, k) };
      if (e.etapa === 'accion' || c.tipo === 'caballero') return { t: 'juega', uid: u, k: c.k, c: c.tipo };
    }
  }
  if (e.etapa === 'tirar') return { t: 'tira', uid: u, c: llave(sec, e, u) };
  if (e.gratis > 0) {
    const es = sitiosCatan(e, u, 'camino'), bs = e.T.mar ? sitiosCatan(e, u, 'barco') : [];
    if (es.length) return { t: 'camino', uid: u, e: elige(es, k) };
    if (bs.length) return { t: 'barco', uid: u, e: rumbo(e, u, bs) };
  }
  if (alcanzaCatan(m, CT_COSTE.ciudad) && n.ciudad < 4) { const vs = sitiosCatan(e, u, 'ciudad'); if (vs.length) return { t: 'ciudad', uid: u, v: elige(vs, k) }; }
  if (alcanzaCatan(m, CT_COSTE.poblado) && n.poblado < 5) { const vs = sitiosCatan(e, u, 'poblado'); if (vs.length) return { t: 'poblado', uid: u, v: elige(vs, k) }; }
  if (alcanzaCatan(m, CT_COSTE.desarrollo) && k() < 0.6) return { t: 'compra', uid: u };
  const pobladosPosibles = sitiosCatan(e, u, 'poblado').length;
  if (!pobladosPosibles || k() < 0.3) {
    if (e.T.mar && k() < 0.7) {
      const mv = barcosMoviblesCatan(e, u);
      if (mv.length && k() < 0.3) { const de = elige(mv, k), as = sitiosCatan(e, u, 'barco', { sin: de }); if (as.length) return { t: 'mueve', uid: u, de, a: elige(as, k) }; }
      if (alcanzaCatan(m, CT_COSTE.barco) && n.barco < 15) { const es = sitiosCatan(e, u, 'barco'); if (es.length) return { t: 'barco', uid: u, e: rumbo(e, u, es) }; }
    }
    if (alcanzaCatan(m, CT_COSTE.camino) && n.camino < 15) { const es = sitiosCatan(e, u, 'camino'); if (es.length) return { t: 'camino', uid: u, e: elige(es, k) }; }
  }
  /* Comercio: con la banca, lo que sobra por lo que falta. */
  const rt = ratiosCatan(e, u);
  const falta = CT_RECURSOS.filter(r => !m[r]);
  const sobra = CT_RECURSOS.find(r => m[r] >= rt[r] + 1);
  if (falta.length && sobra && k() < 0.7) return { t: 'banco', uid: u, da: { [sobra]: rt[sobra] }, pide: { [elige(falta, k)]: 1 } };
  if (!e.oferta && falta.length && k() < 0.15) {
    const doy = CT_RECURSOS.find(r => m[r] >= 2);
    if (doy) return { t: 'oferta', uid: u, da: { [doy]: 1 }, pide: { [falta[0]]: 1 } };
  }
  if (e.oferta) {
    const si = Object.keys(e.oferta.si);
    if (si.length) return { t: 'cierra', uid: u, con: si[0], o: e.oferta.id };
  }
  return { t: 'fin', uid: u };
}

async function juega(n, semilla, extra = {}, tope = 9000) {
  const { p, sec } = await sala(n, semilla, extra);
  const k = azar(semilla);
  let e = reducir(p), pasos = 0;
  const vistos = { oferta: 0, comercio: 0, especial: 0, ladron: 0, barco: 0, mueve: 0, oro: 0, isla: 0, descarta: 0, roba: 0, juega: 0 };
  while (e.fase === 'jugando' && pasos++ < tope) {
    const w = e.espera;
    let j = null;
    if (w.k === 'llaves') { const u = w.faltan[0]; j = { t: 'k', uid: u, a: '0', c: llave(sec, e, u) }; }
    else if (w.k === 'azar') {
      /* Casi siempre ayuda el designado; a veces, un suplente. */
      const otros = e.jugadores.map(x => x.uid).filter(u => u !== w.por && !e.fuera[u]);
      const u = otros.includes(w.pref) && k() < 0.85 ? w.pref : elige(otros, k);
      j = { t: 'k', uid: u, a: w.id, c: llave(sec, e, u) };
    }
    else if (w.k === 'descarte') { const u = e.debe[0]; j = { t: 'descarta', uid: u, r: puñado(e.mano[u], e.descartar[u], k) }; vistos.descarta++; }
    else if (w.k === 'oro') { const u = e.debe[0], r = {}; for (let i = 0; i < e.oro[u]; i++) { const x = elige(CT_RECURSOS, k); r[x] = (r[x] || 0) + 1; } j = { t: 'oro', uid: u, r }; }
    else if (w.k === 'especial') {
      vistos.especial++;
      const u = w.uid, m = e.mano[u];
      if (alcanzaCatan(m, CT_COSTE.ciudad) && sitiosCatan(e, u, 'ciudad').length) j = { t: 'ciudad', uid: u, v: sitiosCatan(e, u, 'ciudad')[0] };
      else if (alcanzaCatan(m, CT_COSTE.desarrollo) && k() < 0.5) j = { t: 'compra', uid: u };
      else j = k() < 0.1 ? { t: 'salta', uid: e.jugadores.map(x => x.uid).find(x => x !== u) } : { t: 'pasa', uid: u };
    }
    else if (e.etapa === 'colocacion') {
      const u = e.turno;
      if (e.sub === 'poblado') j = { t: 'poblado', uid: u, v: elige(sitiosCatan(e, u, 'poblado', { inicial: true }), k) };
      else {
        const es = sitiosCatan(e, u, 'camino', { desde: e.ultPob }), bs = e.T.mar ? sitiosCatan(e, u, 'barco', { desde: e.ultPob }) : [];
        j = bs.length && (k() < 0.3 || !es.length) ? { t: 'barco', uid: u, e: elige(bs, k) } : { t: 'camino', uid: u, e: elige(es, k) };
      }
    }
    else if (e.etapa === 'ladron') {
      const u = e.turno, hs = hexesLadronCatan(e, u), x = elige(hs, k), vs = victimasCatan(e, u, x);
      j = { t: 'ladron', uid: u, x };
      if (vs.length) { j.v = vs[0]; j.c = llave(sec, e, u); }
      vistos.ladron++;
    }
    else if (e.etapa === 'tirar' || e.etapa === 'accion') {
      const u = e.turno;
      /* Los demás contestan a la oferta antes de que la cierre. */
      if (e.oferta && e.etapa === 'accion') {
        const pend = e.jugadores.map(x => x.uid).filter(x => x !== u && !e.fuera[x] && !e.oferta.si[x] && !e.oferta.no[x]);
        if (pend.length) { const v = pend[0]; j = alcanzaCatan(e.mano[v], e.oferta.pide) && k() < 0.6 ? { t: 'acepta', uid: v, o: e.oferta.id } : { t: 'rechaza', uid: v, o: e.oferta.id }; }
      }
      if (!j) j = turnoRobot(e, sec, u, k, p);
    }
    else throw new Error('estado sin salida: ' + JSON.stringify(w));
    const antes = Object.keys(p.jugadas).length;
    e = mover(p, j);
    assert.equal(Object.keys(p.jugadas).length, antes + 1);
    for (const h of e.hist.slice(-3)) if (vistos[h.e] !== undefined && h.e !== 'descarta') vistos[h.e]++;
    for (const u in e.mano) for (const r of CT_RECURSOS) assert.ok(e.mano[u][r] >= 0, 'mano negativa');
  }
  return { e, p, sec, pasos, vistos };
}

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

test('catan: partidas de robots terminan en todas las variantes', async () => {
  const casos = [
    [2, 11, {}], [3, 12, {}], [4, 13, { baraja: 1 }], [4, 14, { amable: 1, puerto: 1 }],
    [5, 15, {}], [6, 16, { largo: -2 }], [3, 17, { exp: 'mar' }], [4, 18, { exp: 'mar', baraja: 1 }],
    [5, 19, { exp: 'mar', amable: 1 }], [2, 20, { exp: 'mar', puerto: 1, largo: -2 }]
  ];
  const total = {};
  for (const [n, s, x] of casos) {
    const { e, pasos, vistos } = await juega(n, s, x);
    const donde = `${n} jugadores, ${JSON.stringify(x)}`;
    assert.equal(e.fase, 'fin', 'no terminó: ' + donde + ' tras ' + pasos);
    assert.equal(e.motivo, 'catan', donde);
    assert.ok(e.vp[e.ganador] >= e.meta, 'ganó sin puntos: ' + donde);
    assert.equal(e.meta, (x.exp === 'mar' ? 12 : 10) + (x.puerto ? 1 : 0) + (x.largo || 0));
    assert.equal(e.falsas.length, 0, donde);
    for (const k in vistos) total[k] = (total[k] || 0) + vistos[k];
    if (n >= 5) assert.ok(vistos.especial > 0, 'sin fase especial con ' + n);
  }
  for (const k of ['ladron', 'roba', 'barco', 'comercio', 'juega', 'isla']) assert.ok(total[k] > 0, 'nunca pasó: ' + k);
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
