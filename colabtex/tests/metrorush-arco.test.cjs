/* Metro Rush: el arco de monedas sobre la barrera baja se recoge entero.

   Con el salto nuevo (2,1 m, 0,80 s) el arco viejo, fijo y de 6 m, quedaba
   bajo el corredor: saltando bien la barrera se perdían las monedas de las
   puntas. Ahora `arcoMonedas` (motor.js) dibuja las cinco sobre la parábola
   del salto a la velocidad de ese metro, y `recoge` (juego.js) mira lo que
   el corredor cruzó en el cuadro, no solo dónde terminó.

   Este test salta de verdad cada arco de varias pistas (clásico y City):
   - con la misma física del juego (impulso, gravedad, Euler semi-implícito
     cuadro a cuadro) y la misma caja de recoger (±1 m a lo largo, de 0,4 m
     bajo los pies a 2,2 m sobre ellos, con la altura interpolada en el cuadro);
   - a 20, 24, 30, 60 y 144 cuadros por segundo;
   - saltando justo, 0,12 s antes y 0,12 s después, y con el salto de Nico
     (un 8 % más alto);
   y exige las cinco monedas, que el salto pase la barrera (0,95 m) y que
   sin saltar no se recoja ninguna (el arco enseña dónde saltar). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const M = require(path.join(__dirname, '../../juegos/club/metrorush/motor.js'));
const F = M.FISICA;

/** Los arcos de una pista: cada barrera baja con las cinco monedas que se emiten justo después, en su carril. */
function arcos(semilla, metros, modo) {
  const g = M.crearGenerador(semilla, modo ? { modo } : undefined), objs = [];
  const curva = M.velocidadDe(modo);
  let D = 0, t = 0;
  while (D < metros) { const V = curva.velocidad(t); D += V * 0.05; t += 0.05; objs.push(...g.generarHasta(D + 230, { V })); }
  const out = [];
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.tipo !== 'bajo' && o.tipo !== 'cajon') continue;     // el arco va sobre la barrera baja (y, en City, sobre el cajón)
    const m = objs.slice(i + 1, i + 6);                        // arcoMonedas se llama justo después de emitir el obstáculo
    if (m.length === 5 && m.every(x => x.tipo === 'moneda' && x.carril === o.carril && Math.abs(x.d - o.d) < 20)) out.push({ d: o.d, monedas: m });
  }
  return out;
}

/** El instante en que la curva llega al metro d (bisección sobre metrosHasta). */
function tiempoEn(curva, d) {
  let a = 0, b = 2000;
  for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (curva.metrosHasta(m) < d) a = m; else b = m; }
  return (a + b) / 2;
}

/**
 * Corre por un arco a `fps` y salta (o no) para que la cima caiga `adelanto`
 * segundos antes de la barrera. Devuelve cuántas monedas recogió y la altura
 * mínima de los pies mientras pasaba sobre la barrera.
 */
function corre(curva, arco, fps, { salta = true, adelanto = 0, factor = 1, grav = 1 } = {}) {
  const dt = 1 / fps, g = F.gravedad * grav;                 // grav: 0,55 dentro de las burbujas del parque
  const vy0 = M.impulso(F.alturaSalto * factor);
  let t = tiempoEn(curva, arco.d - 60), D = curva.metrosHasta(t), y = 0, vy = 0, enAire = false, saltó = false;
  const quedan = arco.monedas.map(m => ({ d: m.d, y: m.y }));
  let recogidas = 0, piesSobre = Infinity;
  while (D < arco.d + 30) {
    const V = curva.velocidad(t);
    const Dantes = D, yAntes = y;
    t += dt; D += V * dt;
    // salta cuando llega al punto en que la cima (vy0/g después) cae sobre la barrera, menos el adelanto
    if (salta && !saltó && D >= arco.d - V * (vy0 / g + adelanto)) { vy = vy0; enAire = true; saltó = true; }
    if (enAire) { vy -= g * dt; y += vy * dt; if (y <= 0) { y = 0; vy = 0; enAire = false; } }
    if (Math.abs(D - arco.d) <= 0.6) piesSobre = Math.min(piesSobre, y);   // sobre la barrera o el seto (su medio largo)
    for (let i = quedan.length - 1; i >= 0; i--) {             // la caja de recoger de juego.js, barrida en el cuadro
      const o = quedan[i];
      if (o.d < Dantes - 1 || o.d > D + 1) continue;
      const f = D > Dantes ? Math.min(1, Math.max(0, (o.d - Dantes) / (D - Dantes))) : 1;
      const yP = yAntes + (y - yAntes) * f;
      if (o.y < yP - 0.4 || o.y > yP + 2.2) continue;
      quedan.splice(i, 1); recogidas++;
    }
  }
  return { recogidas, piesSobre };
}

const CASOS = [
  ['clásico', undefined, [1, 2026, 7919]],
  ['City', 'city', [1, 424242]]
];

for (const [nombre, modo, semillas] of CASOS) {
  test(`${nombre}: cada arco sobre la barrera baja se recoge entero, a cualquier velocidad y fps`, () => {
    const curva = M.velocidadDe(modo);
    let vistos = 0, vMin = Infinity, vMax = 0;
    for (const s of semillas) {
      for (const a of arcos(s, 16000, modo)) {
        vistos++;
        const V = curva.velocidad(tiempoEn(curva, a.d)); vMin = Math.min(vMin, V); vMax = Math.max(vMax, V);
        for (const fps of [20, 24, 30, 60, 144]) {
          for (const adelanto of [-0.12, 0, 0.12]) {
            const r = corre(curva, a, fps, { adelanto });
            assert.equal(r.recogidas, 5, `semilla ${s}, arco en ${a.d.toFixed(0)} m (${V.toFixed(1)} m/s), ${fps} fps, adelanto ${adelanto} s: recogió ${r.recogidas}`);
            if (adelanto === 0) assert.ok(r.piesSobre > 0.95 + 0.3, `el salto justo pasa la barrera con margen (pies a ${r.piesSobre.toFixed(2)} m)`);
          }
          assert.equal(corre(curva, a, fps, { factor: 1.08 }).recogidas, 5, `con el salto de Nico (${fps} fps, ${V.toFixed(1)} m/s)`);
          assert.equal(corre(curva, a, fps, { salta: false }).recogidas, 0, `sin saltar no se recoge ninguna (${fps} fps)`);
        }
      }
    }
    assert.ok(vistos >= 40, `hubo arcos de sobra que probar (${vistos})`);
    assert.ok(vMin < 20 && vMax > 40, `se probaron velocidades lentas y rápidas (${vMin.toFixed(1)}–${vMax.toFixed(1)} m/s)`);
  });
}

test('City: el arco del salto flotante sobre cada seto del parque se recoge entero y pasa el seto', () => {
  const curva = M.velocidadDe('city'), C = M.CITY;
  let vistos = 0;
  for (const s of [1, 2026, 424242]) {
    const g = M.crearGenerador(s, { modo: 'city' }), objs = [];
    let D = 0, t = 0;
    while (D < 16000) { const V = curva.velocidad(t); D += V * 0.05; t += 0.05; objs.push(...g.generarHasta(D + 230, { V })); }
    for (let i = 0; i + 7 <= objs.length; i++) {
      const m = objs.slice(i, i + 7);                          // siete monedas seguidas en un carril, con la del medio sobre un seto
      if (!m.every(x => x.tipo === 'moneda' && x.carril === m[0].carril)) continue;
      const seto = objs.find(o => o.tipo === 'seto' && o.carril === m[0].carril && Math.abs(o.d - m[3].d) < 0.01);
      if (!seto) continue;
      vistos++; i += 6;
      const arco = { d: seto.d, monedas: m };
      for (const fps of [20, 30, 60, 144]) {
        for (const adelanto of [-0.12, 0, 0.12]) assert.equal(corre(curva, arco, fps, { adelanto, grav: C.BURBUJAS.gravedad }).recogidas, 7, `semilla ${s}, seto en ${seto.d.toFixed(0)} m, ${fps} fps, adelanto ${adelanto}`);
        assert.ok(corre(curva, arco, fps, { grav: C.BURBUJAS.gravedad }).piesSobre > 2.8, 'el salto flotante pasa el seto (2,8 m)');
      }
    }
  }
  assert.ok(vistos >= 10, `hubo setos que probar (${vistos})`);
});

test('el arco viejo (fijo, de 6 m) se perdía monedas con el salto nuevo: el test lo habría visto', () => {
  // la misma barrera a 30 m/s con las cinco monedas del arco de antes
  const curva = M.velocidadDe();
  const d = 9000, viejo = { d, monedas: [0, 1, 2, 3, 4].map(i => { const dz = (i - 2) * 1.5; return { d: d + dz, y: 0.9 + 1.2 * (1 - (dz / 3.6) ** 2) }; }) };
  assert.ok(corre(curva, viejo, 60).recogidas < 5);
});
