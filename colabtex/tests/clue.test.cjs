const test = require('node:test');
const assert = require('node:assert');
const M = require('../../juegos/clue/js/motor.js');

/* Una sala de prueba: n jugadores con semilla y promesa, y un registro
   que se va llenando como lo llenarían sus pantallas. */
function sala(n, cripto = true) {
  const js = Array.from({ length: n }, (_, i) => {
    const sem = 1000 + i, sal = 'sal' + i;
    return { uid: 'u' + i, nombre: 'J' + i, sem, sal, hmazo: M.compromiso(sem, sal) };
  });
  const log = [];
  const op = { semilla: 77, cripto, elenco: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] };
  const est = () => M.reducir(log, js, op);
  const jugar = (uid, j) => { log.push({ k: String(log.length).padStart(4, '0'), uid, ...j }); return est(); };
  return { js, log, op, est, jugar };
}
const ll = j => M.llaves(j.sem, j.sal);

/* Las pantallas haciendo el reparto entero, en orden. */
function reparte(S) {
  const { js, jugar } = S;
  js.forEach((j, i) => jugar(j.uid, { t: 'elige', r: 'abcdefgh'[i] }));
  let e = S.est();
  assert.equal(e.fase, 'reparto');
  for (const u of e.cr.mesa) { const j = js.find(x => x.uid === u); e = jugar(u, { t: 'mezcla', c: M.mezcla(e.cr.mezcla || M.mazoInicial(), ll(j)), pk: ll(j).pk }); }
  for (const u of e.cr.mesa) { const j = js.find(x => x.uid === u); e = jugar(u, { t: 'revuelve', c: M.revuelve(e.cr.revuelta, ll(j)) }); }
  e.cr.mesa.forEach((u, i) => { const j = js.find(x => x.uid === u); e = jugar(u, { t: 'quita', c: M.quita(e.cr.quitada, ll(j), M.posicionesDe(i, e.cr.mesa.length)) }); });
  return e;
}
/* La auditoría con las semillas de todos, sin tocar el registro real. */
const auditaYa = S => M.auditar(S.log.concat(S.js.map((j, i) => ({ k: 'z' + i, uid: j.uid, t: 's', sem: j.sem, sal: j.sal }))), S.js, S.op);
const manoDe = (e, S, i) => M.mano(e.cr.quitada, ll(S.js[i]), M.posicionesDe(e.cr.mesa.indexOf(S.js[i].uid), e.cr.mesa.length));

test('clue: el tablero es jugable', () => {
  for (const d of M.PUERTAS) {
    const p = M.pos(d.x, d.y);
    assert.ok(M.esPasillo(p), 'puerta en pasillo');
    assert.ok(M.vecinos(p).some(q => M.celda(q % M.ANCHO, Math.floor(q / M.ANCHO)) === d.l), 'puerta junto a su sala');
  }
  const f = M.SALIDAS.map(([x, y]) => M.pos(x, y));
  f.forEach(p => assert.ok(M.esPasillo(p)));
  for (let s = 0; s < 6; s++) assert.equal(M.alcance(f, s, 99).salas.size, 9);
  for (const q of M.PASADIZOS) assert.equal(M.pasadizoDe(q.a).a, q.b);
});

test('clue: alcance respeta los pasos, las fichas y la sala de salida', () => {
  const f = M.SALIDAS.map(([x, y]) => M.pos(x, y));
  const al = M.alcance(f, 1, 3);
  for (const d of al.casillas.values()) assert.ok(d >= 1 && d <= 3);
  const f2 = f.slice(); f2[1] = M.SALA + 0;
  const des = M.alcance(f2, 1, 12);
  assert.ok(!des.salas.has(0), 'no se vuelve a la sala de la que se sale');
  const cam = M.camino(des, M.SALA + 7);
  assert.equal(cam[cam.length - 1], M.SALA + 7);
  assert.ok(cam.length - 1 <= 12);
});

test('clue: se elige personaje sin repetir y los puestos libres salen del elenco', () => {
  const S = sala(3, false);
  let e = S.jugar('u0', { t: 'elige', r: 'c' });
  assert.equal(e.fase, 'elige');
  assert.deepEqual(e.debe.sort(), ['u1', 'u2']);
  e = S.jugar('u1', { t: 'elige', r: 'c' });           // repetido: no existe
  assert.equal(e.eleccion.u1, undefined);
  e = S.jugar('u1', { t: 'elige', r: 'a' });
  e = S.jugar('u2', { t: 'elige', r: 'NO VALE' });
  assert.equal(e.fase, 'elige');
  e = S.jugar('u2', { t: 'elige', r: 'h' });
  assert.equal(e.fase, 'jugando');
  assert.deepEqual(e.personajes.slice(0, 3), ['c', 'a', 'h']);
  assert.equal(new Set(e.personajes).size, 6);
  assert.equal(e.turno, 'u0');
  assert.ok(e.dados[0] >= 1 && e.dados[1] <= 6);
});

test('clue: el reparto cifrado da manos disjuntas y el sobre, uno de cada tipo', () => {
  for (const n of [2, 3, 4, 6]) {
    const S = sala(n);
    const e = reparte(S);
    assert.equal(e.fase, 'jugando');
    const manos = S.js.map((_, i) => manoDe(e, S, i));
    const todas = manos.flat();
    assert.ok(todas.every(c => c >= 0), 'cada uno abre sus cartas');
    assert.equal(new Set(todas).size, M.NC - 3);
    assert.ok(M.auditar(S.log, S.js, S.op).problemas.every(p => p.que === 'oculta'));
    const a = auditaYa(S);
    assert.deepEqual(a.problemas, []);
    assert.equal(M.tipoCarta(a.sobre[0]), 's');
    assert.equal(M.tipoCarta(a.sobre[1]), 'a');
    assert.equal(M.tipoCarta(a.sobre[2]), 'l');
    assert.ok(a.sobre.every(c => !todas.includes(c)));
  }
});

/* Mover a u0 a la sala a la que llega con sus dados, si alguna. */
function entraEnSala(S) {
  let e = S.est();
  const f = e.fichas;
  const t = e.dados[0] + e.dados[1];
  const al = M.alcance(f, 0, t);
  const l = [...al.salas.keys()][0];
  if (l === undefined) { e = S.jugar('u0', { t: 'mueve', a: [...al.casillas.keys()][0], v: 'dado' }); return { e, l: -1 }; }
  e = S.jugar('u0', { t: 'mueve', a: M.SALA + l, v: 'dado' });
  return { e, l };
}

test('clue: sugerir, refutar en un sobre y acusar, en línea', () => {
  const S = sala(3);
  let e = reparte(S);
  const manos = S.js.map((_, i) => manoDe(e, S, i));
  const a0 = auditaYa(S);
  /* u0 llega a una sala con un destino inventado: no vale. */
  e = S.jugar('u0', { t: 'mueve', a: M.pos(12, 12), v: 'dado' });
  assert.equal(e.paso, 'inicio');
  let r;
  ({ e, l: r } = entraEnSala(S));
  if (r < 0) return;                              // semilla sin sala al alcance: ya cubierto arriba
  assert.ok(e.puedeSugerir);
  /* Sugiere algo que u1 tiene seguro, si tiene una carta de sala r. */
  const s = 1, a = 2;
  e = S.jugar('u0', { t: 'sugiere', s, a });
  assert.equal(e.paso, 'refuta');
  assert.equal(e.fichas[1], M.SALA + r, 'el sospechoso viene a la sala');
  assert.equal(e.armas[a], r);
  assert.ok(e.llamado.u1, 'u1 fue llamado');
  const pedidas = [M.cartaS(s), M.cartaA(a), M.cartaL(r)];
  /* Responden en orden hasta que alguien tiene. */
  while (e.paso === 'refuta') {
    const u = e.sug.espera, i = Number(u.slice(1));
    const tiene = manos[i].filter(c => pedidas.includes(c));
    if (!tiene.length) { e = S.jugar(u, { t: 'paso' }); continue; }
    const clave = M.compartida(ll(S.js[i]), e.cr.pk.u0);
    e = S.jugar(u, { t: 'muestra', x: M.cierraSobre(clave, e.sug.k, tiene[0]) });
    /* u0 lo abre con su lado de la clave. */
    const suya = M.compartida(ll(S.js[0]), e.cr.pk[u]);
    assert.equal(M.abreSobre(suya, e.sug.k, e.sug.x), tiene[0]);
    /* Otro no puede. */
    assert.notEqual(M.abreSobre(M.compartida(ll(S.js[2]), e.cr.pk[u]), e.sug.k, e.sug.x), tiene[0]);
  }
  assert.equal(e.paso, 'tras');
  /* Acusa bien: los demás abren en orden y el último candado es suyo. */
  const [ss, sa, sl] = a0.sobre;
  e = S.jugar('u0', { t: 'acusa', s: ss, a: sa - M.NS, l: sl - M.NS - M.NA });
  assert.equal(e.paso, 'abre');
  assert.deepEqual(e.debe, ['u1']);
  e = S.jugar('u2', { t: 'abre', c: M.abre(e.cr.abre, ll(S.js[2])) });   // fuera de turno
  assert.deepEqual(e.debe, ['u1']);
  e = S.jugar('u1', { t: 'abre', c: M.abre(e.cr.abre, ll(S.js[1])) });
  e = S.jugar('u2', { t: 'abre', c: M.abre(e.cr.abre, ll(S.js[2])) });
  assert.equal(e.paso, 'veredicto');
  assert.deepEqual(M.sobreAbierto(e.cr.abre, ll(S.js[0])), a0.sobre);
  e = S.jugar('u0', { t: 'veredicto', ok: true });
  assert.equal(e.fase, 'fin');
  assert.equal(e.ganador, 'u0');
  for (const j of S.js) S.jugar(j.uid, { t: 's', sem: j.sem, sal: j.sal });
  assert.deepEqual(M.auditar(S.log, S.js, S.op).problemas, []);
});

test('clue: la auditoría pilla a quien dice que no tiene teniendo', () => {
  const S = sala(3);
  let e = reparte(S);
  const manos = S.js.map((_, i) => manoDe(e, S, i));
  const { e: e2, l } = entraEnSala(S);
  if (l < 0) return;
  /* Nombrar una carta de u1 y que u1 pase igual. */
  const c = manos[1].find(x => M.tipoCarta(x) === 's');
  if (c === undefined) return;
  e = S.jugar('u0', { t: 'sugiere', s: c, a: 0 });
  assert.equal(e.sug.espera, 'u1');
  e = S.jugar('u1', { t: 'paso' });
  for (const j of S.js) S.jugar(j.uid, { t: 's', sem: j.sem, sal: j.sal });
  const a = M.auditar(S.log, S.js, S.op);
  assert.ok(a.problemas.some(p => p.uid === 'u1' && p.que === 'paso'));
});

test('clue: acusar mal elimina; si queda uno, gana', () => {
  const S = sala(2, false);
  S.jugar('u0', { t: 'elige', r: 'a' });
  let e = S.jugar('u1', { t: 'elige', r: 'b' });
  e = S.jugar('u0', { t: 'acusa', s: 0, a: 0, l: 0 });
  assert.equal(e.paso, 'veredicto');
  e = S.jugar('u0', { t: 'veredicto', ok: false });
  assert.equal(e.fase, 'fin');
  assert.equal(e.ganador, 'u1');
  assert.equal(e.motivo, 'ultimo');
});

test('clue: con tres, el eliminado sigue refutando pero no juega', () => {
  const S = sala(3, false);
  ['a', 'b', 'c'].forEach((r, i) => S.jugar('u' + i, { t: 'elige', r }));
  S.jugar('u0', { t: 'acusa', s: 0, a: 0, l: 0 });
  let e = S.jugar('u0', { t: 'veredicto', ok: false });
  assert.equal(e.fase, 'jugando');
  assert.equal(e.turno, 'u1');
  assert.ok(e.eliminados.u0);
  e = S.jugar('u1', { t: 'pasa' });
  assert.equal(e.turno, 'u2');
  e = S.jugar('u2', { t: 'pasa' });
  assert.equal(e.turno, 'u1', 'se salta al eliminado');
});

test('clue: irse en línea sin revelar la semilla anula; en la elección, no', () => {
  const S = sala(3);
  let e = S.jugar('u2', { t: 'abandona' });
  assert.equal(e.fase, 'elige');
  S.jugar('u0', { t: 'elige', r: 'a' });
  e = S.jugar('u1', { t: 'elige', r: 'b' });
  assert.equal(e.fase, 'reparto');
  assert.deepEqual(e.cr.mesa, ['u0', 'u1']);
  const T = sala(3);
  reparte(T);
  e = T.jugar('u1', { t: 'abandona' });
  assert.equal(e.fase, 'fin');
  assert.equal(e.motivo, 'anulada');
  const U = sala(3);
  reparte(U);
  U.jugar('u1', { t: 's', sem: U.js[1].sem, sal: U.js[1].sal });
  e = U.jugar('u1', { t: 'abandona' });
  assert.equal(e.fase, 'jugando');
});

test('clue: la semilla revelada tiene que cumplir la promesa', () => {
  const S = sala(2);
  let e = S.jugar('u0', { t: 's', sem: 5, sal: 'otra' });
  assert.equal(e.semillas.u0, undefined);
  e = S.jugar('u0', { t: 's', sem: S.js[0].sem, sal: S.js[0].sal });
  assert.ok(e.semillas.u0);
});

test('clue: reproducir el registro da el mismo estado', () => {
  const S = sala(3);
  reparte(S);
  const a = JSON.stringify(S.est());
  const b = JSON.stringify(M.reducir(S.log.map(x => ({ ...x })), S.js, S.op));
  assert.equal(a, b);
});

test('clue: en la elección se puede cambiar de personaje o soltarlo hasta que todos tengan uno', () => {
  const S = sala(3, false);
  let e = S.jugar('u0', { t: 'elige', r: 'a' });
  e = S.jugar('u0', { t: 'elige', r: 'b' });             // cambia a otro libre
  assert.equal(e.eleccion.u0, 'b');
  e = S.jugar('u1', { t: 'elige', r: 'a' });             // 'a' quedó libre
  assert.equal(e.eleccion.u1, 'a');
  e = S.jugar('u0', { t: 'elige', r: 'a' });             // ocupado: no cambia
  assert.equal(e.eleccion.u0, 'b');
  e = S.jugar('u0', { t: 'suelta' });                    // lo suelta
  assert.equal(e.eleccion.u0, undefined);
  assert.ok(e.debe.includes('u0'));
  e = S.jugar('u2', { t: 'elige', r: 'b' });             // otro toma el que soltó
  assert.equal(e.fase, 'elige');
  e = S.jugar('u0', { t: 'elige', r: 'c' });
  assert.equal(e.fase, 'jugando');
  e = S.jugar('u0', { t: 'suelta' });                    // ya empezó: no se suelta
  assert.equal(e.eleccion.u0, 'c');
  assert.deepEqual(e.personajes.slice(0, 3), ['c', 'a', 'b']);
});
