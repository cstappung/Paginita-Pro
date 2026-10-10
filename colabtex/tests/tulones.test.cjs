'use strict';
// Tulones: la física del cuerpo (Verlet), trepar, congelar y el aspecto.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../../juegos/club/tulones/motor.js');

const deja = (c, W, n) => { for (let i = 0; i < n; i++) M.paso(c, W); };
const pelvisY = c => c.p[M.I.pelvis * 2 + 1];

test('un cuerpo suelto cae y queda quieto y finito', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 600);
  assert.ok(M.valido(c));
  for (let i = 0; i < M.N; i++) assert.ok(c.p[i * 2 + 1] <= 1, 'nada atraviesa el suelo');
  assert.ok(c.bulto.y > 1, 'de pie, el bulto cuelga hacia abajo');
});

const fija = (c, k, x, y) => {
  c.held[k] = true; c.pin[k] = [x, y];
  const m = M.MIEMBROS[k]; c.vec[k] = [x - c.p[m.raiz * 2], y - c.p[m.raiz * 2 + 1]];
};

test('colgado de un pie sigue siendo válido y el bulto se invierte', () => {
  const W = M.mundo(), c = M.crea(-500);
  deja(c, W, 100);
  // Cabeza abajo y en el aire, colgado del pie izquierdo (sin teletransportar el pie, que daba un latigazo).
  for (let i = 0; i < M.N; i++) { const y = -400 - c.p[i * 2 + 1]; c.p[i * 2 + 1] = c.q[i * 2 + 1] = y; }
  fija(c, 2, c.p[M.I.pieI * 2], c.p[M.I.pieI * 2 + 1]);
  deja(c, W, 1200);
  assert.ok(c.p[M.I.cabeza * 2 + 1] > c.pin[2][1], 'la cabeza cuelga bajo el pie');
  assert.ok(M.valido(c));
  assert.ok(c.bulto.y < -1, 'cabeza abajo, el bulto cae hacia el ombligo: ' + c.bulto.y);
});

test('con las manos agarradas, tirar hacia abajo sube el cuerpo', () => {
  const W = M.mundo(), c = M.crea(-500);
  deja(c, W, 400);
  fija(c, 0, c.p[M.I.hombroI * 2] - 10, c.p[M.I.hombroI * 2 + 1] - 40);
  fija(c, 1, c.p[M.I.hombroD * 2] + 10, c.p[M.I.hombroD * 2 + 1] - 40);
  deja(c, W, 60);
  const antes = pelvisY(c);
  for (let i = 0; i < 60; i++) { assert.strictEqual(M.empujaMiembros(c, 0, 2), 2); M.paso(c, W); }
  assert.ok(M.valido(c));
  assert.ok(pelvisY(c) < antes - 50, 'la pelvis sube: ' + antes + ' → ' + pelvisY(c));
});

test('congelar añade el cuerpo a la torre', () => {
  const W = M.mundo(), c = M.crea(0);
  deja(c, W, 600);
  const caps = W.caps.length;
  M.congela(c, W);
  assert.strictEqual(W.torre.length, 1);
  assert.ok(W.caps.length > caps);
  assert.ok(M.alturaMundo(W) >= 1.81);
  assert.ok(M.altura(c) > 0);
});

test('presets, limpia y aleatorio dan campos dentro del catálogo', () => {
  const ok = a => { for (const k of M.CAMPOS) assert.ok(Number.isInteger(a[k]) && a[k] >= 0 && a[k] < M.CATALOGO[k].length, k); };
  for (const p of M.PRESETS) { ok(p); ok(M.limpia(p)); }
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++) ok(M.aleatorio(rnd));
  const l = M.limpia({ nombre: '<b>xx</b>', piel: 99, pelo: -1, fisico: 1.5 });
  ok(l); assert.ok(!/[<>]/.test(l.nombre));
});

test('teclas: WASD de fábrica y lo guardado se limpia', () => {
  assert.deepStrictEqual(M.limpiaTeclas(null), M.TECLAS);
  assert.strictEqual(M.TECLAS[0], 'KeyA');
  assert.strictEqual(M.TECLAS[1], 'KeyD');
  assert.strictEqual(M.TECLAS[2], 'KeyW');
  const t = M.limpiaTeclas({ 0: 'KeyQ', 1: 'KeyQ', 2: 'ArrowUp', 3: '<x>', congela: 7 });
  assert.strictEqual(t[0], 'KeyQ');
  const usadas = M.ACCIONES.map(a => t[a]);
  assert.strictEqual(new Set(usadas).size, usadas.length, 'sin repetidas');
  for (const c of usadas) assert.ok(M.teclaValida(c), c);
});

test('teclas: asignar una usada intercambia y las reservadas no se aceptan', () => {
  let t = M.asignaTecla(M.TECLAS, '0', 'KeyD');
  assert.strictEqual(t[0], 'KeyD');
  assert.strictEqual(t[1], 'KeyA');
  t = M.asignaTecla(t, 'congela', 'Escape');
  assert.strictEqual(t.congela, 'Space');
  t = M.asignaTecla(t, 'pausa', 'ShiftLeft');
  assert.strictEqual(t.pausa, 'ShiftLeft');
  assert.strictEqual(M.nombreTecla('KeyW'), 'W');
  assert.strictEqual(M.nombreTecla('Space'), 'Espacio');
  assert.strictEqual(M.nombreTecla('Semicolon', new Map([['Semicolon', 'ñ']])), 'Ñ');
});

test('el tono lo deja de pie y no abierto de piernas', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 1200);
  assert.ok(c.p[M.I.cabeza * 2 + 1] < -170, 'la cabeza sigue arriba: ' + c.p[M.I.cabeza * 2 + 1]);
  assert.ok(Math.abs(c.p[M.I.pieI * 2] - c.p[M.I.pieD * 2]) < 60, 'los pies bajo la cadera');
});

test('un pie que ya tocaba el suelo no se pega hasta despegarse y volver a apoyar un rato', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 300);
  M.sostiene(c, 2, true);
  deja(c, W, 60);
  assert.strictEqual(c.pin[2], null, 'apretar no lo pega al instante');
  for (let i = 0; i < 40; i++) { M.empujaMiembros(c, 0, -3); M.paso(c, W); }
  assert.strictEqual(c.pin[2], null);
  let n = 0;
  for (; n < 200 && !c.pin[2]; n++) { M.empujaMiembros(c, 0, 3); M.paso(c, W); }
  assert.ok(c.pin[2], 'al volver a apoyar se agarra');
});

test('agitar los miembros no lo hace volar (rebotes y pogo)', () => {
  const com = c => { let y = 0; for (let i = 0; i < M.N; i++) y += c.p[i * 2 + 1]; return y / M.N; };
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let subida = 0;
  for (let run = 0; run < 20; run++) {
    const W = M.mundo(), c = M.crea(-300 + rnd() * 350); deja(c, W, 200);
    let vx = 0, vy = 0, aire = 0, y0 = 0;
    for (let t = 0; t < 1500; t++) {
      if (t % 40 === 0) { const k = Math.floor(rnd() * 4); M.sostiene(c, k, !c.held[k]); }
      vx = Math.max(-7, Math.min(7, vx * .95 + (rnd() - .5) * 1.2)); vy = Math.max(-7, Math.min(7, vy * .95 + (rnd() - .5) * 1.2));
      M.empujaMiembros(c, vx, vy); M.paso(c, W);
      const enAire = !c.pin.some(Boolean) && !c.contacto.some(Boolean);
      if (enAire) { if (!aire) y0 = com(c); aire++; subida = Math.max(subida, y0 - com(c)); } else aire = 0;
      assert.ok(M.valido(c));
    }
  }
  assert.ok(subida < 150, 'en el aire no sube más de 1,5 m: ' + subida);
});

test('con un pie agarrado, el brazo sostenido llega recto hacia arriba', () => {
  const W = M.mundo(), c = M.crea(-200);
  deja(c, W, 300);
  fija(c, 2, c.p[M.I.pieI * 2], c.p[M.I.pieI * 2 + 1]);
  M.sostiene(c, 0, true);
  for (let i = 0; i < 240; i++) { M.empujaMiembros(c, 0, -6); M.paso(c, W); }
  const dx = c.p[M.I.manoI * 2] - c.p[M.I.hombroI * 2], dy = c.p[M.I.manoI * 2 + 1] - c.p[M.I.hombroI * 2 + 1];
  assert.ok(dy < -50 && Math.abs(dx) < 15, 'mano sobre el hombro: ' + dx + ',' + dy);
});

test('agarrado de una mano, alcanzar con la otra levanta el cuerpo y las piernas cuelgan', () => {
  const W = M.mundo(), c = M.crea(-110);
  deja(c, W, 300);
  fija(c, 1, -45, -124);
  deja(c, W, 120);
  M.sostiene(c, 0, true);
  const antes = pelvisY(c);
  for (let i = 0; i < 480; i++) { M.empujaMiembros(c, i < 240 ? -2 : 2, -6); M.paso(c, W); }
  assert.ok(M.valido(c));
  assert.ok(pelvisY(c) < antes - 50, 'la pelvis sube: ' + antes + ' → ' + pelvisY(c));
  assert.ok(c.p[M.I.pieI * 2 + 1] > pelvisY(c) && c.p[M.I.pieD * 2 + 1] > pelvisY(c), 'los pies cuelgan bajo la pelvis');
});

const centroX = c => { let x = 0; for (let i = 0; i < M.N; i++) x += c.p[i * 2]; return x / M.N; };

test('sentado o tirado en el suelo y sin tocar nada, no se desliza solo', () => {
  for (const lado of [1, -1]) {
    const W = M.mundo(), c = M.crea(-400);
    const px = c.p[M.I.pelvis * 2], py = c.p[M.I.pelvis * 2 + 1];
    for (let i = 0; i < M.N; i++) {
      const dx = c.p[i * 2] - px, dy = c.p[i * 2 + 1] - py;
      c.p[i * 2] = c.q[i * 2] = px - dy * lado; c.p[i * 2 + 1] = c.q[i * 2 + 1] = py + dx * lado + 70;
    }
    deja(c, W, 600);
    const x0 = centroX(c);
    deja(c, W, 600);
    assert.ok(Math.abs(centroX(c) - x0) < 15, 'se movió ' + (centroX(c) - x0));
  }
});

test('sostener brazo y pierna con un pie apoyado no lo empuja de lado', () => {
  const W = M.mundo(), c = M.crea(-300);
  deja(c, W, 300);
  M.sostiene(c, 1, true); M.sostiene(c, 3, true);
  for (let i = 0; i < 60; i++) { M.empujaMiembros(c, 3, -1); M.paso(c, W); }
  const x0 = centroX(c);
  deja(c, W, 240);
  assert.ok(Math.abs(centroX(c) - x0) < 60, 'se movió ' + (centroX(c) - x0));
});

test('tirado en el suelo, un tirón brusco del brazo lo despega hacia donde va el ratón', () => {
  const W = M.mundo(), c = M.crea(-400);
  const px = c.p[M.I.pelvis * 2], py = c.p[M.I.pelvis * 2 + 1];
  for (let i = 0; i < M.N; i++) {
    const dx = c.p[i * 2] - px, dy = c.p[i * 2 + 1] - py;
    c.p[i * 2] = c.q[i * 2] = px + dy; c.p[i * 2 + 1] = c.q[i * 2 + 1] = py - dx + 70;
  }
  deja(c, W, 600);
  const centroY = () => { let y = 0; for (let i = 0; i < M.N; i++) y += c.p[i * 2 + 1]; return y / M.N; };
  const y0 = centroY(), x0 = centroX(c);
  M.sostiene(c, 1, true);
  let alto = y0;
  for (let i = 0; i < 40; i++) { M.empujaMiembros(c, 6, -10); M.paso(c, W); alto = Math.min(alto, centroY()); }
  deja(c, W, 60);
  assert.ok(alto < y0 - 25, 'el cuerpo se despega: ' + y0 + ' → ' + alto);
  assert.ok(alto > y0 - 90, 'pero no sale volando: ' + y0 + ' → ' + alto);
  assert.ok(centroX(c) > x0 + 10, 'va hacia la derecha: ' + x0 + ' → ' + centroX(c));
});

/* ---------- en línea: el reductor de la sala ---------- */
const fs = require('node:fs'), vm = require('node:vm');
const sala = (() => {
  const code = fs.readFileSync(__dirname + '/../src/juegos/motor.js', 'utf8').replace(/\bexport\s+/g, '');
  const ctx = { crypto: require('node:crypto').webcrypto, TulonesMotor: M };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return ctx;
})();

// Un cuerpo de pie, subido `dy` (en unidades) y corrido `dx`: los huesos quedan de su largo.
const POSE_PIE = (() => { const W = M.mundo(), c = M.crea(-200); deja(c, W, 600); return Float64Array.from(c.p); })();
const pose = (dy, dx = 0) => M.codificaPose(POSE_PIE.map((v, i) => (i % 2 ? v - dy : v + dx)));

function partida(n, op = {}) {
  const jugadores = {};
  for (let i = 0; i < n; i++) jugadores['u' + i] = { nombre: 'J' + i, orden: i };
  const p = Object.assign({ juego: 'tulones', estado: 'jugando', cupo: n, semilla: 1, jugadores, jugadas: {} }, op);
  const pon = j => { p.jugadas[String(Object.keys(p.jugadas).length).padStart(4, '0')] = j; return sala.reducir(p); };
  if (!op.sinListos) for (let i = 0; i < n; i++) pon({ t: 'listo', uid: 'u' + i, on: true });
  return { p, pon, est: () => sala.reducir(p) };
}
const T0 = 1e12;

test('sala: los turnos van por asiento y el que no supera la línea queda fuera', () => {
  const S = partida(3, { tiempo: 30 });
  let e = S.est();
  assert.strictEqual(e.fase, 'jugando'); assert.strictEqual(e.turno, 'u0'); assert.strictEqual(e.inicio, 0);
  assert.strictEqual(e.plazo, Infinity, 'sin hora de inicio no corre el plazo');
  e = S.pon({ t: 'reloj', uid: 'u2', n: 0, at: T0 });
  assert.strictEqual(e.inicio, T0);
  e = S.pon({ t: 'sale', uid: 'u0', n: 0, at: T0 + 3000, a: M.codificaAspecto(M.PRESETS[3]) });
  assert.strictEqual(e.saleAt, T0 + 3000);
  e = S.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 30000, p: pose(60) });
  assert.strictEqual(e.turno, 'u1'); assert.strictEqual(e.torre.length, 1);
  assert.ok(e.meta > 2.5, 'la torre sube con el cuerpo: ' + e.meta);
  assert.strictEqual(e.torre[0].aspecto.pelo, M.PRESETS[3].pelo, 'el aspecto llega con el sale');
  // u1 se congela en el suelo: no supera y queda fuera, pero su cuerpo queda en la torre.
  e = S.pon({ t: 'sale', uid: 'u1', n: 1, at: T0 + 31000 });
  e = S.pon({ t: 'congela', uid: 'u1', n: 1, at: T0 + 50000, p: pose(0, -500) });
  assert.ok(e.eliminados.u1); assert.strictEqual(e.torre.length, 2); assert.strictEqual(e.turno, 'u2');
  assert.deepStrictEqual([...e.vivos], ['u0', 'u2']);
  assert.ok(e.hist.some(h => h.e === 'congela' && h.uid === 'u1' && !h.ok));
});

test('sala: fuera de turno, turno equivocado o pose inventada no cuentan', () => {
  const S = partida(2);
  S.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  let e = S.pon({ t: 'congela', uid: 'u1', n: 0, at: T0 + 1000, p: pose(60) });
  assert.strictEqual(e.torre.length, 0, 'no era su turno');
  e = S.pon({ t: 'congela', uid: 'u0', n: 3, at: T0 + 1000, p: pose(60) });
  assert.strictEqual(e.torre.length, 0, 'otro número de turno');
  const roto = POSE_PIE.slice(); roto[M.I.manoI * 2] += 200;
  e = S.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 1000, p: M.codificaPose(roto) });
  assert.strictEqual(e.torre.length, 0, 'un brazo de tres metros no es un cuerpo');
  e = S.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 1000, p: pose(600) });
  assert.strictEqual(e.torre.length, 0, 'flotando seis metros sobre la torre');
  e = S.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 1000, p: 'basura' });
  assert.strictEqual(e.torre.length, 0);
  e = S.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 2000, p: pose(60) });
  assert.strictEqual(e.torre.length, 1); assert.strictEqual(e.turno, 'u1');
});

test('sala: el plazo vence y ese turno acaba sin cuerpo; un plazo adelantado no vale', () => {
  const S = partida(3, { tiempo: 45 });
  S.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  const L = M.SALA.LISTO_MS, G = M.SALA.GRACIA_MS;
  let e = S.pon({ t: 'plazo', uid: 'u1', n: 0, at: T0 + L + 45000 + G - 1 });
  assert.strictEqual(e.turno, 'u0', 'todavía no');
  assert.strictEqual(e.plazo, T0 + L + 45000 + G);
  e = S.pon({ t: 'plazo', uid: 'u1', n: 0, at: T0 + L + 45000 + G + 1 });
  assert.ok(e.eliminados.u0); assert.strictEqual(e.turno, 'u1'); assert.strictEqual(e.torre.length, 0);
  // Con `sale`, el plazo cuenta desde ahí, y un sale tardío no lo alarga.
  e = S.pon({ t: 'sale', uid: 'u1', n: 1, at: e.inicio + 60000 });
  assert.strictEqual(e.saleAt, e.inicio + L);
  e = S.pon({ t: 'congela', uid: 'u1', n: 1, at: e.saleAt + 45000 + G + 10, p: pose(60) });
  assert.strictEqual(e.torre.length, 0, 'congela fuera de plazo');
});

test('sala: gana el último en pie, y a rondas el más alto de los que siguen', () => {
  const S = partida(2);
  S.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  S.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 1000, p: pose(60) });
  const e = S.pon({ t: 'congela', uid: 'u1', n: 1, at: T0 + 2000, p: pose(0, -500) });
  assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.ganador, 'u0'); assert.strictEqual(e.motivo, 'ultimo');
  assert.ok(e.puntos.u0 > e.puntos.u1);

  const R = partida(2, { rondas: 3 });
  let r = R.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  for (let k = 0; k < 6; k++) r = R.pon({ t: 'congela', uid: r.turno, n: k, at: T0 + (k + 1) * 1000, p: pose(60 + k * 70 + (k === 5 ? 40 : 0)) });
  assert.strictEqual(r.fase, 'fin'); assert.strictEqual(r.motivo, 'rondas'); assert.strictEqual(r.ganador, 'u1');
});

test('sala: abandonar o ser expulsado en tu turno pasa al siguiente sin hora', () => {
  const S = partida(3);
  S.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  let e = S.pon({ t: 'abandona', uid: 'u0' });
  assert.strictEqual(e.turno, 'u1'); assert.strictEqual(e.inicio, 0, 'el abandono no trae hora');
  e = S.pon({ t: 'voto', uid: 'u2', contra: 'u1' });
  assert.ok(e.fuera.u1, 'expulsado por mayoría: cuenta como abandono');
  assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.ganador, 'u2'); assert.strictEqual(e.motivo, 'abandono');
});

test('sala: la pose y el aspecto sobreviven a la codificación', () => {
  const P = M.decodificaPose(pose(33));
  assert.ok(P && M.poseSana(P));
  assert.strictEqual(M.decodificaPose(pose(33).replace(/,[^,]*$/, '')), null, 'faltan coordenadas');
  for (const a of M.PRESETS) assert.deepStrictEqual(M.decodificaAspecto(M.codificaAspecto(a), a.nombre), M.limpia(a));
  assert.deepStrictEqual(M.decodificaAspecto('x.y', 'Z'), M.limpia({ nombre: 'Z' }));
});

test('sala: la torre espera a que todos den «Listo», y personalizar lo quita', () => {
  const S = partida(3, { sinListos: true });
  let e = S.est();
  assert.strictEqual(e.fase, 'espera'); assert.strictEqual(e.turno, '');
  S.pon({ t: 'listo', uid: 'u0', on: true });
  S.pon({ t: 'listo', uid: 'u1', on: true });
  e = S.pon({ t: 'listo', uid: 'u0', on: false });
  assert.deepStrictEqual({ ...e.preparados }, { u0: false, u1: true });
  assert.strictEqual(e.fase, 'espera');
  S.pon({ t: 'listo', uid: 'u0', on: true, at: T0 - 5 });
  e = S.pon({ t: 'listo', uid: 'u2', on: true, at: T0 });
  assert.strictEqual(e.fase, 'jugando'); assert.strictEqual(e.turno, 'u0');
  assert.strictEqual(e.inicio, T0, 'el último listo pone en marcha el reloj');
  e = S.pon({ t: 'listo', uid: 'u0', on: false, at: T0 + 1 });
  assert.strictEqual(e.fase, 'jugando', 'ya empezada, un listo no la para');
});

test('sala: con la sala abierta nada empieza aunque todos estén listos; al cerrarla sí', () => {
  const S = partida(2, { estado: 'esperando', cupo: 4 });
  assert.strictEqual(S.est().fase, 'espera');
  S.p.estado = 'jugando';
  assert.strictEqual(S.est().fase, 'jugando');
  assert.strictEqual(S.est().inicio, 0, 'cerrada después: el reloj lo pone `reloj`');
});

test('sala: si se va uno antes de empezar y queda uno solo, gana por abandono', () => {
  const S = partida(2, { sinListos: true });
  S.pon({ t: 'listo', uid: 'u0', on: true });
  const e = S.pon({ t: 'abandona', uid: 'u1' });
  assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.ganador, 'u0'); assert.strictEqual(e.motivo, 'abandono');
});

test('sala: con tiempo acumulado cada ronda suma un segundo por cada otro en pie', () => {
  const S = partida(3, { tiempo: 30, acumula: 1 });
  let e = S.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  assert.strictEqual(e.tiempoTurno, 30);
  for (let k = 0; k < 3; k++) e = S.pon({ t: 'congela', uid: e.turno, n: k, at: T0 + (k + 1) * 1000, p: pose(60 + k * 70) });
  assert.strictEqual(e.ronda, 2); assert.strictEqual(e.tiempoTurno, 32, 'dos más en pie');
  assert.strictEqual(e.plazo, T0 + 3000 + M.SALA.LISTO_MS + 32000 + M.SALA.GRACIA_MS);
  e = S.pon({ t: 'congela', uid: e.turno, n: 3, at: T0 + 4000, p: pose(0, -600) });
  e = S.pon({ t: 'congela', uid: e.turno, n: 4, at: T0 + 5000, p: pose(300) });
  e = S.pon({ t: 'congela', uid: e.turno, n: 5, at: T0 + 6000, p: pose(370) });
  assert.strictEqual(e.ronda, 3); assert.strictEqual(e.tiempoTurno, 33, 'u0 cayó: ahora suma uno');
  const F = partida(2, { tiempo: 30 });
  F.pon({ t: 'reloj', uid: 'u1', n: 0, at: T0 });
  F.pon({ t: 'congela', uid: 'u0', n: 0, at: T0 + 1000, p: pose(60) });
  const f = F.pon({ t: 'congela', uid: 'u1', n: 1, at: T0 + 2000, p: pose(130) });
  assert.strictEqual(f.tiempoTurno, 30, 'sin la opción, fijo');
});
