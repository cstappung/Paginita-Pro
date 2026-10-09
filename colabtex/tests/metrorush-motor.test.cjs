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

/* Corre al corredor por `objs` como lo hace juego.js en cada cuadro: avanza
   la pista, guarda la D anterior, aplica la gravedad, lo apoya en lo que
   diga M.soporte y después mira los choques con M.caja. Devuelve el primer
   choque ({tipo, D, y}) o null, y la altura a la que terminó. `x` es la
   posición de lado (fija: el corredor no cambia de carril). */
function recorre(objs, { fps, V, desde, hasta, x = M.CARRILES[1], y0 = 0 }) {
  const F = M.FISICA, dt = 1 / fps;
  let D = desde, Dantes = desde, y = y0, vy = 0, enAire = y0 > 0;
  while (D < hasta) {
    Dantes = D; D += V * dt;                                  // 1) la pista avanza
    const sop = M.soporte(objs, x, D, y, Dantes);             // 2) lo que hay bajo los pies
    vy -= F.gravedad * dt; y += vy * dt;
    if (y <= sop.h) { y = sop.h; vy = 0; enAire = false; } else if (!enAire && y > sop.h + 0.05) enAire = true;
    const yb = y + 0.02, yt = y + F.altoDePie;                // 3) los choques, con las cajas del motor
    for (const o of objs) {
      const k = M.caja(o, D);
      if (!k || k.y1 <= k.y0) continue;
      if (D + M.MEDIO_LARGO < k.z0 || D - M.MEDIO_LARGO > k.z1) continue;
      if (Math.abs(x - M.CARRILES[o.carril]) >= k.w + F.medioAncho) continue;
      if (yb >= k.y1 || yt <= k.y0) continue;
      return { choque: { tipo: o.tipo, D, y }, y };
    }
  }
  return { choque: null, y };
}

test('subir de la rampa al vagón nunca te choca, a ningún ritmo de cuadros ni velocidad', () => {
  /* El fallo: el choque con el vagón cuenta desde 0,3 m antes de él y el
     techo sostenía recién desde 0,2 m antes; en esos 10 cm el corredor
     seguía en la rampa, más bajo que el techo, y se daba por chocado contra
     el frente del vagón (entre un tercio y casi todas las veces). Aquí se
     sube la rampa de un convoy de dos vagones de 20 a 144 cuadros por
     segundo, a las velocidades de toda la carrera y empezando en 50 fases
     distintas del cuadro: nadie choca y todos terminan sobre el techo. */
  assert.ok(M.MARGEN_TECHO > M.MEDIO_LARGO, 'el techo sostiene en todo el tramo en que el vagón choca');
  const d = 40, objs = [
    { tipo: 'rampa', carril: 1, d0: d, largo: M.LARGO_RAMPA },
    { tipo: 'tren', carril: 1, d0: d + M.LARGO_RAMPA, largo: M.LARGO_VAGON, vel: 0 },
    { tipo: 'tren', carril: 1, d0: d + M.LARGO_RAMPA + M.LARGO_VAGON + 0.4, largo: M.LARGO_VAGON, vel: 0 }
  ];
  const mitad = d + M.LARGO_RAMPA + M.LARGO_VAGON * 1.5;      // a medio segundo vagón
  for (const fps of [20, 30, 45, 60, 90, 120, 144]) for (const V of [13, 18, 22, 26, 30]) for (let i = 0; i < 50; i++) {
    const r = recorre(objs, { fps, V, desde: d - 5 + i / 50 * V / fps, hasta: mitad });
    assert.equal(r.choque, null, `${fps} fps a ${V} m/s (fase ${i}): ${JSON.stringify(r.choque)}`);
    assert.equal(r.y, M.ALTO_TECHO, `${fps} fps a ${V} m/s: termina sobre el techo`);
  }
});

test('zigzag rápido de techo en techo: ningún vagón te choca ni te caes', () => {
  /* El fallo: el techo te sostenía solo hasta 1,05 m del centro de su carril
     y los carriles están a 2,2 m; a mitad de un cambio de carril entre dos
     vagones ninguno te sostenía, caías un poco y los dos te chocaban. Aquí,
     sobre tres trenes en fila, se cambia de carril cada vez que se llega al
     centro del otro (al ritmo real del juego: un carril en 0,17 s). */
  const F = M.FISICA, objs = [0, 1, 2].map(c => ({ tipo: 'tren', carril: c, d0: 40, largo: M.LARGO_VAGON * 3, vel: 0 }));
  for (const fps of [20, 30, 60, 144]) for (const V of [15, 30, 50]) {
    const dt = 1 / fps, vl = 2.2 / F.cambioCarril;
    let D = 42, Dantes = D, y = M.ALTO_TECHO, vy = 0, x = M.CARRILES[0], carril = 0, dir = 1, menor = y;
    while (D < 40 + M.LARGO_VAGON * 3 - 2) {
      Dantes = D; D += V * dt;
      const obj = M.CARRILES[carril], xPrev = x;
      x += Math.max(-vl * dt, Math.min(vl * dt, obj - x));
      if (x === obj) { if (carril + dir > 2 || carril + dir < 0) dir = -dir; carril += dir; }   // llegó: al de al lado, y vuelta
      const sop = M.soporte(objs, x, D, y, Dantes);
      vy -= F.gravedad * dt; y += vy * dt; if (y <= sop.h) { y = sop.h; vy = 0; }
      menor = Math.min(menor, y);
      for (const o of objs) {
        const k = M.caja(o, D), lim = k.w + F.medioAncho;
        if (D + M.MEDIO_LARGO < k.z0 || D - M.MEDIO_LARGO > k.z1 || Math.abs(x - M.CARRILES[o.carril]) >= lim) continue;
        assert.ok(y + 0.02 >= k.y1, `${fps} fps a ${V} m/s: choca con el carril ${o.carril} en x=${x.toFixed(2)} (y=${y.toFixed(2)}, antes x=${xPrev.toFixed(2)})`);
      }
    }
    assert.equal(menor, M.ALTO_TECHO, `${fps} fps a ${V} m/s: nunca baja del techo`);
  }
  assert.ok(M.ANCHO_TECHO >= 1.1, 'a mitad de camino entre dos carriles un techo todavía te sostiene');
});

test('los choques siguen ahí: de frente contra un vagón, de lado contra la rampa, y bajar por atrás no choca', () => {
  const tren = { tipo: 'tren', carril: 1, d0: 40, largo: M.LARGO_VAGON, vel: 0 };
  for (const fps of [30, 60, 144]) {
    // por el suelo contra el frente de un vagón: choca
    const r = recorre([tren], { fps, V: 20, desde: 30, hasta: 45 });
    assert.equal(r.choque && r.choque.tipo, 'tren', `${fps} fps: el frente del vagón choca`);
    // un salto normal no llega al techo (1,5 m contra 3,35): también choca
    const s = recorre([tren], { fps, V: 20, desde: 39, hasta: 45, y0: 1.5 });
    assert.equal(s.choque && s.choque.tipo, 'tren', `${fps} fps: saltando bajo no se sube`);
    // corriendo sobre el techo hasta el final del vagón y cayendo por atrás: no choca con el que dejó
    const b = recorre([tren], { fps, V: 20, desde: 45, hasta: 75, y0: M.ALTO_TECHO });   // caer 3,35 m toma ~0,44 s (unos 9 m)
    assert.equal(b.choque, null, `${fps} fps: bajar por atrás del vagón no choca`);
    assert.equal(b.y, 0, `${fps} fps: termina en el suelo`);
  }
  // meterse por el suelo a media rampa (llegando de lado, sin haberla subido): choca con la rampa
  const rampa = { tipo: 'rampa', carril: 1, d0: 40, largo: M.LARGO_RAMPA };
  assert.equal(M.soporte([rampa], M.CARRILES[1], 43, 0, 42.6).h, 0, 'a media rampa desde el suelo, la rampa no te sube');
  const k = M.caja(rampa, 43);
  assert.ok(k.y1 > 0.02, 'y a esa altura la rampa ocupa el lugar del corredor');
});

test('la misma semilla da la misma pista', () => {
  const a = pista(31337, 2000).map(o => [o.tipo, o.carril, Math.round(o.d ?? o.d0)]);
  const b = pista(31337, 2000).map(o => [o.tipo, o.carril, Math.round(o.d ?? o.d0)]);
  assert.deepEqual(a, b);
});

test('velocidad: de 15 a 60 m/s, subiendo pareja hasta los 450 s, y una sola curva para todos', () => {
  assert.equal(M.velocidad(0), 15);
  assert.equal(M.velocidad(60), 21, 'al minuto, 21 m/s');
  assert.equal(M.velocidad(120), 27, 'a los 2 min, 27 m/s');
  assert.equal(M.T_TOPE, 450, 'llega a 60 m/s a los 7 min 30 s');
  assert.equal(Math.round(M.metrosEntre(0, M.T_TOPE)), 16875, '…a los 16,9 km');
  assert.equal(M.velocidad(1e6), 60, 'y no pasa de 60');
  // la curva vieja (versión 2, tope 50) sigue para las pruebas de antes, y hasta su tope las dos son la misma
  const v2 = M.velocidadDe(undefined, 2);
  assert.equal(v2.velocidad(1e6), 50);
  for (let t = 0; t <= 350; t += 5) assert.equal(v2.velocidad(t), M.velocidad(t));
  for (let t = 1; t < M.T_TOPE; t += 7) assert.ok(M.velocidad(t) > M.velocidad(t - 1), 'sube de a poco, sin escalones hacia atrás');
  for (let t = M.T_TOPE; t < 900; t += 7) assert.equal(M.velocidad(t), 60, 'arriba del tope se queda');
  // los metros (que recalcula el antitrampas) son la integral de esa misma velocidad
  let D = 0; for (let t = 0; t < 300; t += 0.001) D += M.velocidad(t + 0.0005) * 0.001;
  assert.ok(Math.abs(D - M.metrosEntre(0, 300)) < 0.5, 'metrosEntre es la integral de velocidad');
  // y la velocidad según los metros (la del generador) se le parece: menos de 1 m/s de diferencia
  for (let t = 0; t <= 1000; t += 15) assert.ok(Math.abs(M.velocidadEn(M.metrosEntre(0, t)) - M.velocidad(t)) <= 0.25 + 1e-9, 'velocidadEn a los ' + t + ' s (solo el redondeo)');
  // a toda velocidad las filas no llegan más seguido que cada FILA_MIN_S
  // (se miden las barreras: van justo en su fila; los vagones de un mismo tren van a 11,7 m y no son filas)
  const p = pista(4242, 20000).filter(o => o.tipo === 'bajo' || o.tipo === 'alto');
  const filas = [...new Set(p.map(o => Math.round(o.d)))].filter(d => d > 17500).sort((a, b) => a - b);
  for (let i = 1; i < filas.length; i++) assert.ok(filas[i] - filas[i - 1] >= 60 * M.FILA_MIN_S - 1 || filas[i] - filas[i - 1] < 2, 'a 60 m/s, filas a ' + (filas[i] - filas[i - 1]) + ' m');
});

test('puntos y multiplicador: lo que dice el manual', () => {
  assert.equal(M.PUNTOS_POR_METRO, 10);
  assert.equal(M.multiplicador({ base: 1 }), 1);
  assert.equal(M.multiplicador({ base: 5, estrellas: 3, doble: true }), 16);
  assert.equal(M.multiplicador({ base: 99, estrellas: 99 }), 59, 'base hasta ×30 y estrellas hasta +29');
  assert.equal(M.puntosPorTramo(100, 3), 3000);
});

test('estaciones: los umbrales del manual (en metros) y las vueltas', () => {
  const nombres = [[0, 'Barrio Estación'], [1199, 'Barrio Estación'], [1200, 'Ocaso'], [2550, 'Mercado de Farolillos'], [4200, 'Línea Neón'],
    [6150, 'Estación Fantasma'], [8400, 'Cocheras'], [10950, 'Invierno'], [13700, 'Muelle'], [16950, 'Óxido'],
    [20250, 'Fin de la Línea'], [24249, 'Fin de la Línea']];
  for (const [p, n] of nombres) assert.equal(M.estacionDe(p).nombre, n, String(p));
  assert.deepEqual(M.ESTACIONES.map(e => e.estilo), ['juguete', 'pixel', 'juguete', 'neon', 'neon', 'pixel', 'juguete', 'neon', 'pixel', 'juguete']);
  const v = M.estacionDe(24250);
  assert.equal(v.id, 'barrio'); assert.equal(v.vuelta, 2); assert.equal(v.boleto, null);
  assert.equal(M.estacionDe(28250).id, 'ocaso'); assert.equal(M.estacionDe(32250).id, 'neon'); assert.equal(M.estacionDe(36250).vuelta, 3);
  assert.notEqual(M.estacionDe(24250).clave, M.estacionDe(36250).clave, 'cada vuelta es un cambio');
  assert.equal(M.siguienteUmbral(0), 1200); assert.equal(M.siguienteUmbral(20250), 24250); assert.equal(M.siguienteUmbral(25000), 28250);
  // con la velocidad de la carrera, las estaciones van repartidas: ninguna llega antes del minuto ni dos en menos de 50 s
  const tDe = m => { let t = 0; while (M.metrosEntre(0, t) < m) t += 0.25; return t; };
  const tiempos = M.ESTACIONES.slice(1).map(e => tDe(e.desde));
  assert.ok(tiempos[0] > 60, 'Ocaso llega a los ' + tiempos[0] + ' s');
  for (let i = 1; i < tiempos.length; i++) assert.ok(tiempos[i] - tiempos[i - 1] > 50, M.ESTACIONES[i + 1].id + ' llega ' + (tiempos[i] - tiempos[i - 1]) + ' s después de la anterior');
  // un boleto por estación, con su texto
  for (const e of M.ESTACIONES) assert.ok(M.BOLETOS[e.boleto] && M.BOLETOS[e.boleto].texto.length > 40, e.id);
});

test('poderes y tienda: duraciones y precios', () => {
  assert.equal(M.duracionPoder('iman', 0), 10); assert.equal(M.duracionPoder('iman', 2), 15);
  assert.equal(M.duracionPoder('mochila', 0), 5); assert.equal(M.duracionPoder('mochila', 5), 10, 'la mochila es corta: 1 s por mejora');
  assert.equal(M.duracionPoder('doble', 9), 24.5, 'el nivel no pasa de 5');
  assert.equal(M.precioMejora(0), 2500); assert.equal(M.precioMejora(4), 50000); assert.equal(M.precioMejora(5), null);   // la tienda, ×10
  assert.equal(M.PRECIO_PATINETA, 3000);
  assert.deepEqual([M.POTENCIADORES.despegue.precio, M.POTENCIADORES.puntos.precio], [15000, 25000]);
  assert.deepEqual([M.ASPECTOS.nocturno.precio, M.ASPECTOS.grafitero.precio], [15000, 30000]);
  assert.deepEqual([M.costoSaltar(1), M.costoSaltar(10)], [2750, 9500], 'saltar una misión, ×5');
  assert.deepEqual([0, 1, 2].map(M.costoSeguir), [500, 1000, 2000]);
  const az = M.rng(3); let pat = 0, mon = 0, pogo = 0;
  for (let i = 0; i < 4000; i++) { const r = M.cajaMisteriosa(az); if (r.patineta) pat++; if (r.monedas) mon++; if (r.pogo) pogo++; }
  assert.ok(pat > 650 && pat < 950, 'un quinto de las cajas son patinetas'); assert.ok(pogo > 650 && pogo < 950, 'y otro quinto, el pogo');
  assert.ok(mon > 2200);
  // la súper caja: siempre algo, y en monedas sueltas da menos que lo que cuesta (no fabrica monedas)
  const az2 = M.rng(9); let suelto = 0;
  for (let i = 0; i < 20000; i++) { const r = M.cajaSuper(az2); assert.ok(r.monedas || r.patinetas || r.potenciador); suelto += r.monedas || 0; }
  assert.ok(suelto / 20000 < M.PRECIO_SUPERCAJA, 'en promedio devuelve menos monedas de las que cuesta');
  // el pogo sube por encima de los techos de los trenes (3,35 m)
  assert.ok(M.FISICA.alturaPogo > 3.6 && M.FISICA.gravedadPogo < 1);
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
  const sucio = M.limpiaProgreso({ monedas: -5, mejoras: { iman: 99, x: 3 }, boletos: [3, 3, 99, 'a', 1], aspectos: ['dorado', 'pirata'], aspecto: 'pirata', retos: { nivel: 77 } });
  assert.equal(sucio.monedas, 0); assert.equal(sucio.mejoras.iman, 5); assert.equal(sucio.mejoras.x, undefined);
  assert.deepEqual(sucio.boletos, [1, 3]); assert.deepEqual(sucio.aspectos, ['clasico', 'dorado']); assert.equal(sucio.aspecto, 'clasico');
  assert.equal(sucio.retos.nivel, 30);
  const pc = Object.assign(M.progresoNuevo(), { at: 100, monedas: 900, boletos: [1], mejoras: { iman: 3, mochila: 0, zapatillas: 0, doble: 0 }, retos: { nivel: 4, avance: [5, 0, 0] }, records: { puntos: 50000, distancia: 900, distanciaCity: 2000, monedas: 10 } });
  const cel = Object.assign(M.progresoNuevo(), { at: 200, monedas: 120, boletos: [2], mejoras: { iman: 1, mochila: 2, zapatillas: 0, doble: 0 }, retos: { nivel: 3, avance: [9, 9, 9] }, records: { puntos: 70000, distancia: 400, distanciaCity: 3100, monedas: 99 } });
  const m = M.mezclaProgreso(pc, cel);
  assert.equal(m.monedas, 120, 'lo gastable viene del más reciente');
  assert.deepEqual(m.boletos, [1, 2]);
  assert.deepEqual(m.mejoras, { iman: 3, mochila: 2, zapatillas: 0, doble: 0 }, 'las mejoras se quedan con lo mayor');
  assert.deepEqual(m.retos, { nivel: 4, avance: [5, 0, 0] }, 'el nivel de retos nunca baja');
  assert.deepEqual(m.records, { puntos: 70000, distancia: 900, distanciaCity: 3100, monedas: 99 }, 'la distancia de cada mundo, la mayor');
  // un progreso de antes (sin distanciaCity) se limpia con 0 y no rompe la mezcla
  assert.equal(M.limpiaProgreso({ records: { puntos: 5, distancia: 7 } }).records.distanciaCity, 0);
  // el récord de un modo fantasma es la distancia de su mundo
  const q = M.progresoNuevo(); M.anotaRecord(q, 'cityfantasma', 1500); assert.equal(q.records.distanciaCity, 1500); assert.equal(M.recordDe(q, 'cityfantasma'), 1500);
  assert.equal(M.recordDe(q, 'fantasma'), 0); M.anotaDistancia(q, 'puro', 800); assert.equal(M.recordDe(q, 'fantasma'), 800);
  assert.deepEqual(M.mezclaProgreso(cel, pc), m, 'da lo mismo el orden');
});

test('progreso: otro navegador que empezó de cero no borra las monedas', () => {
  // el PC jugó mucho; el navegador nuevo nunca leyó la cuenta, jugó 2 carreras y guardó DESPUÉS
  const pc = Object.assign(M.progresoNuevo(), { at: 100, monedas: 52000, aspectos: ['clasico', 'nocturno'], aspecto: 'nocturno', mejoras: { iman: 4, mochila: 2, zapatillas: 1, doble: 3 }, totales: { carreras: 40, metros: 90000, monedas: 70000 } });
  const nuevo = Object.assign(M.progresoNuevo(), { at: 500, monedas: 300, totales: { carreras: 2, metros: 1500, monedas: 300 } });
  const m = M.mezclaProgreso(nuevo, pc);
  assert.equal(m.monedas, 52000, 'el saldo grande vuelve');
  assert.equal(m.aspecto, 'nocturno');
  assert.deepEqual(m.mejoras, pc.mejoras);
  assert.deepEqual(M.mezclaProgreso(pc, nuevo), m, 'da lo mismo el orden');
  // pero si el nuevo SÍ siguió desde el viejo (totales ≥) y gastó, manda su saldo
  const sigue = Object.assign(M.progresoNuevo(), { at: 600, monedas: 2000, totales: { carreras: 41, metros: 91000, monedas: 70500 } });
  assert.equal(M.mezclaProgreso(pc, sigue).monedas, 2000);
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
