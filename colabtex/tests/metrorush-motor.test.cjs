/* Metro Rush: el motor (juegos/club/metrorush/motor.js).

   Lo más importante que se comprueba aquí es que el generador nunca deja una
   carrera imposible: un "jugador" simulado recorre la pista metro a metro y,
   con el tiempo real que toma cambiar de carril, siempre tiene que encontrar
   por dónde seguir. También se fijan los números que el manual promete
   (estaciones, multiplicador, duraciones, precios) y cómo se mezcla el
   progreso entre dos aparatos. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const M = require(path.join(__dirname, '../../juegos/club/metrorush/motor.js'));

/* Recorre una pista generada con una semilla durante `metros`, como la recorre el juego
   (generando siempre 230 m por delante con la velocidad real), y devuelve los objetos. */
function pista(semilla, metros) {
  const g = M.crearGenerador(semilla), objs = [];
  let D = 0, t = 0;
  while (D < metros) {
    const V = M.velocidad(t); D += V * 0.05; t += 0.05;      // 20 cuadros por segundo de juego
    objs.push(...g.generarHasta(D + 230, { V }));
  }
  return objs;
}

/* ¿El carril c está cerrado en el metro d? Cierra un tren detenido sin rampa
   delante (con rampa se sube), y un tren en marcha alrededor de donde se cruza
   contigo. Las barreras no cierran: se saltan o se ruedan. */
function cerrados(objs) {
  const porCarril = [[], [], []];
  const rampas = objs.filter(o => o.tipo === 'rampa');
  const trenes = objs.filter(o => o.tipo === 'tren');
  for (const t of trenes) {
    if (t.vel > 0) { porCarril[t.carril].push([t.dArribo - 1, t.dArribo + t.largo + 1]); continue; }
    // ¿se puede subir? hay una rampa justo antes, o un vagón pegado que a su vez se puede subir
    porCarril[t.carril].push([t.d0, t.d0 + t.largo, t]);
  }
  // un tren detenido se puede pasar por arriba si una rampa (o una cadena de vagones con rampa) llega a él
  const subible = new Set();
  for (const r of rampas) {
    let fin = r.d0 + r.largo;
    for (;;) {
      const t = trenes.find(x => x.vel === 0 && x.carril === r.carril && Math.abs(x.d0 - fin) < 0.6);
      if (!t) break;
      subible.add(t); fin = t.d0 + t.largo;
    }
  }
  return porCarril.map(l => l.filter(([, , t]) => !t || !subible.has(t)).map(([a, b]) => [a, b]));
}

test('el generador nunca deja una carrera imposible (jugador simulado, 12 semillas × 12 km)', () => {
  for (let semilla = 1; semilla <= 12; semilla++) {
    const objs = pista(semilla * 7919, 12000);
    const cer = cerrados(objs);
    const libre = (c, d) => !cer[c].some(([a, b]) => d >= a && d <= b);
    const PASO = 1, CAMBIO = 6;                             // un cambio de carril ocupa ~6 m a toda velocidad
    let alcanza = [false, true, false];                     // empiezas en el centro
    for (let d = 0; d < 11800; d += PASO) {
      const sig = [false, false, false];
      for (let c = 0; c < 3; c++) {
        if (!alcanza[c]) continue;
        if (libre(c, d + PASO)) sig[c] = true;              // seguir en el mismo carril
        for (const o of [c - 1, c + 1]) {                   // o cambiarse al de al lado, si los dos están libres durante el cambio
          if (o < 0 || o > 2) continue;
          let ok = true;
          for (let x = 0; x <= CAMBIO && ok; x += PASO) ok = libre(c, d + x) && libre(o, d + x);
          if (ok) sig[o] = true;
        }
      }
      // si en un carril no te puedes quedar pero te podías cambiar antes, ya quedó contado arriba
      assert.ok(sig.some(Boolean), `semilla ${semilla * 7919}: no hay por dónde seguir en el metro ${d}`);
      alcanza = sig;
    }
  }
});

test('nada se superpone en un mismo carril (trenes, rampas y barreras)', () => {
  const objs = pista(424242, 15000);
  for (let c = 0; c < 3; c++) {
    const tramos = objs.filter(o => o.carril === c && (o.tipo === 'tren' || o.tipo === 'rampa'))
      .map(o => o.vel > 0 ? [o.dArribo, o.d0 + o.largo, o] : [o.d0, o.d0 + o.largo, o]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < tramos.length; i++) assert.ok(tramos[i][0] >= tramos[i - 1][1] - 0.05, `carril ${c}: se superponen ${tramos[i - 1][2].tipo} y ${tramos[i][2].tipo} en ${tramos[i][0].toFixed(1)}`);
    for (const b of objs.filter(o => o.carril === c && (o.tipo === 'bajo' || o.tipo === 'alto')))
      assert.ok(!tramos.some(([a, z]) => b.d > a + 0.1 && b.d < z - 0.1), `carril ${c}: una barrera dentro de un tren en ${b.d}`);
  }
});

test('el túnel va limpio: dentro solo hay monedas', () => {
  const g = M.crearGenerador(99), objs = [];
  let D = 0, t = 0, pedido = false;
  while (D < 3000) {
    const V = M.velocidad(t); D += V * 0.05; t += 0.05;
    if (!pedido && D > 800) { g.pedirTunel(D + 150, 'ocaso'); pedido = true; }
    objs.push(...g.generarHasta(D + 230, { V }));
  }
  const tun = objs.find(o => o.tipo === 'tunel');
  assert.ok(tun, 'hay un túnel'); assert.equal(tun.estacion, 'ocaso');
  const dentro = objs.filter(o => o.tipo !== 'tunel' && o.tipo !== 'moneda' && (o.d ?? o.d0) > tun.d0 - 8 && (o.d ?? o.d0) < tun.d0 + tun.largo + 8);
  assert.deepEqual(dentro.map(o => o.tipo), []);
  // y ningún tren en marcha cruza el túnel
  assert.ok(!objs.some(o => o.tipo === 'tren' && o.vel > 0 && o.dArribo < tun.d0 + tun.largo && o.d0 + o.largo > tun.d0));
});

test('regalos: poderes, estrellas, cajas y el boleto pedido', () => {
  const g = M.crearGenerador(5), objs = [];
  let D = 0, t = 0;
  g.pedirBoleto(3, 600);
  while (D < 6000) { const V = M.velocidad(t); D += V * 0.05; t += 0.05; objs.push(...g.generarHasta(D + 230, { V })); }
  const poderes = objs.filter(o => o.tipo === 'poder');
  assert.ok(poderes.length >= 10, 'unos 10 poderes en 6 km');
  assert.ok(poderes.some(p => p.clase === 'caja'), 'alguna caja misteriosa');
  for (const c of ['iman', 'mochila', 'zapatillas', 'doble']) assert.ok(poderes.some(p => p.clase === c), c);
  assert.ok(objs.filter(o => o.tipo === 'estrella').length >= 8, 'unas 12 estrellas en 6 km');
  const b = objs.filter(o => o.tipo === 'boleto');
  assert.equal(b.length, 1); assert.equal(b[0].n, 3); assert.ok(b[0].d >= 600);
});

test('monedas en el cielo para la mochila cohete', () => {
  const g = M.crearGenerador(1);
  const m = g.monedasCielo(100, 300, 1);
  assert.ok(m.length > 60);
  assert.ok(m.every(x => x.tipo === 'moneda' && x.y > 8 && x.carril >= 0 && x.carril <= 2));
  for (let i = 1; i < m.length; i++) assert.ok(Math.abs(m[i].carril - m[i - 1].carril) <= 1, 'nunca salta dos carriles');
});

test('la misma semilla da la misma pista', () => {
  const a = pista(31337, 2000).map(o => [o.tipo, o.carril, Math.round(o.d ?? o.d0)]);
  const b = pista(31337, 2000).map(o => [o.tipo, o.carril, Math.round(o.d ?? o.d0)]);
  assert.deepEqual(a, b);
});

test('velocidad: de 13 a casi 30 m/s, siempre subiendo', () => {
  assert.equal(M.velocidad(0), 13);
  assert.ok(M.velocidad(120) > 21 && M.velocidad(120) < 23.5);
  assert.ok(M.velocidad(1e6) <= 30 && M.velocidad(1e6) > 29.9);
  for (let t = 1; t < 900; t += 7) assert.ok(M.velocidad(t) > M.velocidad(t - 1));
});

test('puntos y multiplicador: lo que dice el manual', () => {
  assert.equal(M.PUNTOS_POR_METRO, 10);
  assert.equal(M.multiplicador({ base: 1 }), 1);
  assert.equal(M.multiplicador({ base: 5, estrellas: 3, doble: true }), 16);
  assert.equal(M.multiplicador({ base: 99, estrellas: 99 }), 59, 'base hasta ×30 y estrellas hasta +29');
  assert.equal(M.puntosPorTramo(100, 3), 3000);
});

test('estaciones: los umbrales del manual y las vueltas', () => {
  const nombres = [[0, 'Barrio Estación'], [49999, 'Barrio Estación'], [50000, 'Ocaso'], [200000, 'Línea Neón'], [1e6, 'Estación Fantasma'],
    [2.5e6, 'Invierno'], [5e6, 'Óxido'], [1e7, 'Fin de la Línea'], [11999999, 'Fin de la Línea']];
  for (const [p, n] of nombres) assert.equal(M.estacionDe(p).nombre, n, String(p));
  assert.deepEqual(M.ESTACIONES.map(e => e.estilo), ['juguete', 'pixel', 'neon', 'neon', 'juguete', 'pixel', 'juguete']);
  const v = M.estacionDe(12e6);
  assert.equal(v.id, 'barrio'); assert.equal(v.vuelta, 2); assert.equal(v.boleto, null);
  assert.equal(M.estacionDe(14e6).id, 'ocaso'); assert.equal(M.estacionDe(16e6).id, 'neon'); assert.equal(M.estacionDe(18e6).vuelta, 3);
  assert.notEqual(M.estacionDe(12e6).clave, M.estacionDe(18e6).clave, 'cada vuelta es un cambio');
  assert.equal(M.siguienteUmbral(0), 50000); assert.equal(M.siguienteUmbral(1e7), 12e6); assert.equal(M.siguienteUmbral(12.5e6), 14e6);
  // un boleto por estación, con su texto
  for (const e of M.ESTACIONES) assert.ok(M.BOLETOS[e.boleto] && M.BOLETOS[e.boleto].texto.length > 40, e.id);
});

test('poderes y tienda: duraciones y precios', () => {
  assert.equal(M.duracionPoder('iman', 0), 10); assert.equal(M.duracionPoder('iman', 2), 15);
  assert.equal(M.duracionPoder('mochila', 5), 20.5); assert.equal(M.duracionPoder('doble', 9), 24.5, 'el nivel no pasa de 5');
  assert.equal(M.precioMejora(0), 250); assert.equal(M.precioMejora(4), 5000); assert.equal(M.precioMejora(5), null);
  assert.deepEqual([0, 1, 2].map(M.costoSeguir), [500, 1000, 2000]);
  const az = M.rng(3); let pat = 0, mon = 0;
  for (let i = 0; i < 4000; i++) { const r = M.cajaMisteriosa(az); if (r.patineta) pat++; if (r.monedas) mon++; }
  assert.ok(pat > 800 && pat < 1200, 'un cuarto de las cajas son patinetas'); assert.ok(mon > 2700);
});

test('retos: tres por nivel, iguales en dos aparatos, y cumplirlos sube el multiplicador', () => {
  for (let n = 1; n <= 30; n++) {
    const r = M.retosDeNivel(n);
    assert.equal(r.length, 3); assert.equal(new Set(r.map(x => x.tipo)).size, 3);
    assert.deepEqual(r, M.retosDeNivel(n));
  }
  const lista = M.retosDeNivel(1);
  const carrera = {};
  for (const x of lista) carrera[x.tipo === 'monedasTotal' ? 'monedas' : x.tipo] = x.meta;   // una carrera que cumple todo
  const fin = M.avanzaRetos({ nivel: 1, avance: [0, 0, 0] }, carrera, true);
  assert.equal(fin.subio, true); assert.deepEqual(fin.retos, { nivel: 2, avance: [0, 0, 0] });
  // en vivo (sin terminar) no sube, aunque se cumplan
  const vivo = M.avanzaRetos({ nivel: 1, avance: [0, 0, 0] }, carrera, false);
  assert.equal(vivo.subio, false);
  // un reto "de carrera" guarda la mejor carrera, no la suma
  const i = lista.findIndex(x => x.alcance === 'carrera'), t = lista[i].tipo;
  const a = M.avanzaRetos({ nivel: 1, avance: [0, 0, 0] }, { [t]: 1 }, true);
  const b = M.avanzaRetos(a.retos, { [t]: 1 }, true);
  assert.equal(b.retos.avance[i], 1);
  // el nivel 30 ya no sube
  const tope = M.retosDeNivel(30), c30 = {};
  for (const x of tope) c30[x.tipo === 'monedasTotal' ? 'monedas' : x.tipo] = x.meta;
  assert.equal(M.avanzaRetos({ nivel: 30, avance: [0, 0, 0] }, c30, true).subio, false);
});

test('progreso: limpiar lo que viene de afuera y mezclar dos aparatos', () => {
  const sucio = M.limpiaProgreso({ monedas: -5, mejoras: { iman: 99, x: 3 }, boletos: [3, 3, 9, 'a', 1], aspectos: ['dorado', 'pirata'], aspecto: 'pirata', retos: { nivel: 77 } });
  assert.equal(sucio.monedas, 0); assert.equal(sucio.mejoras.iman, 5); assert.equal(sucio.mejoras.x, undefined);
  assert.deepEqual(sucio.boletos, [1, 3]); assert.deepEqual(sucio.aspectos, ['clasico', 'dorado']); assert.equal(sucio.aspecto, 'clasico');
  assert.equal(sucio.retos.nivel, 30);
  const pc = Object.assign(M.progresoNuevo(), { at: 100, monedas: 900, boletos: [1], mejoras: { iman: 3, mochila: 0, zapatillas: 0, doble: 0 }, retos: { nivel: 4, avance: [5, 0, 0] }, records: { puntos: 50000, distancia: 900, monedas: 10 } });
  const cel = Object.assign(M.progresoNuevo(), { at: 200, monedas: 120, boletos: [2], mejoras: { iman: 1, mochila: 2, zapatillas: 0, doble: 0 }, retos: { nivel: 3, avance: [9, 9, 9] }, records: { puntos: 70000, distancia: 400, monedas: 99 } });
  const m = M.mezclaProgreso(pc, cel);
  assert.equal(m.monedas, 120, 'lo gastable viene del más reciente');
  assert.deepEqual(m.boletos, [1, 2]);
  assert.deepEqual(m.mejoras, { iman: 3, mochila: 2, zapatillas: 0, doble: 0 }, 'las mejoras se quedan con lo mayor');
  assert.deepEqual(m.retos, { nivel: 4, avance: [5, 0, 0] }, 'el nivel de retos nunca baja');
  assert.deepEqual(m.records, { puntos: 70000, distancia: 900, monedas: 99 });
  assert.deepEqual(M.mezclaProgreso(cel, pc), m, 'da lo mismo el orden');
});

test('saltar misiones, premio por set y potenciadores', () => {
  // saltar una misión la da por cumplida; si era la última que faltaba, el set se completa en el acto
  const L = M.retosDeNivel(3);
  const r1 = M.saltaReto({ nivel: 3, avance: [0, 0, 0] }, 1);
  assert.equal(r1.subio, false);
  assert.deepEqual(r1.retos, { nivel: 3, avance: [0, L[1].meta, 0] });
  const r2 = M.saltaReto({ nivel: 3, avance: [L[0].meta, 0, L[2].meta] }, 1);
  assert.equal(r2.subio, true);
  assert.deepEqual(r2.retos, { nivel: 4, avance: [0, 0, 0] });
  // en ×30 ya no sube más
  const L30 = M.retosDeNivel(30);
  assert.equal(M.saltaReto({ nivel: 30, avance: [L30[0].meta, L30[1].meta, 0] }, 2).subio, false);
  // un índice que no existe no cambia nada
  assert.deepEqual(M.saltaReto({ nivel: 2, avance: [5, 0, 0] }, 7).retos, { nivel: 2, avance: [5, 0, 0] });
  // saltar y el premio crecen con el multiplicador
  assert.ok(M.costoSaltar(10) > M.costoSaltar(1));
  assert.ok(M.premioSet(20) > M.premioSet(2));
  // el potenciador suma al multiplicador (antes del ×2), con tope
  assert.equal(M.multiplicador({ base: 5, estrellas: 3, extra: 5, doble: true }), 26);
  assert.equal(M.multiplicador({ base: 1, extra: 99 }), 11);
  // los potenciadores se guardan, se limpian y se mezclan como algo gastable (manda el más reciente)
  assert.deepEqual(M.progresoNuevo().potenciadores, { despegue: 1, puntos: 0 });
  assert.deepEqual(M.limpiaProgreso({ potenciadores: { despegue: '3', puntos: -2, raro: 5 } }).potenciadores, { despegue: 3, puntos: 0 });
  const viejo = Object.assign(M.progresoNuevo(), { at: 1, potenciadores: { despegue: 9, puntos: 9 } });
  const nuevo = Object.assign(M.progresoNuevo(), { at: 2, potenciadores: { despegue: 0, puntos: 1 } });
  assert.deepEqual(M.mezclaProgreso(viejo, nuevo).potenciadores, { despegue: 0, puntos: 1 });
  for (const k of Object.keys(M.POTENCIADORES)) assert.ok(M.POTENCIADORES[k].precio > 0 && M.POTENCIADORES[k].nombre);
});
