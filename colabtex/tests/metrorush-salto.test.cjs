/* Metro Rush: el salto, el pogo y la catenaria (ronda 2).

   El salto se subió al de Subway Surfers (~2,1 m y ~0,8 s en el aire desde
   el suelo). Aquí se fija lo que ese cambio NO puede romper:
   - la barrera alta se sigue pasando solo rodando (saltando la cabeza la
     sigue tocando) y la baja se salta con margen de sobra;
   - un salto normal no llega a un techo (para subir hay rampas), con
     zapatillas sí;
   - nada de lo que vuela (salto desde un techo con zapatillas, la mochila,
     el pogo) toca los cables de la catenaria, cuyas alturas se leen del
     mismo mundo.js para que el test no pueda quedar desfasado;
   - el pogo: su trayectoria (`vueloPogo`) y su arco de monedas
     (`monedasPogo`) son cuentas puras, sin azar: no tocan el generador, así
     que la pista y la prueba del antitrampas siguen iguales. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require(path.join(__dirname, '../../juegos/club/metrorush/motor.js'));
const F = M.FISICA;

/* Las alturas de la catenaria y del piso, leídas de mundo.js (es un módulo
   con three.js: no se puede cargar en Node, pero sus constantes sí se leen). */
const MUNDO = fs.readFileSync(path.join(__dirname, '../../juegos/club/metrorush/mundo.js'), 'utf8');
const constante = nombre => { const m = MUNDO.match(new RegExp(`const ${nombre} = ([\\d.]+);`)); assert.ok(m, `${nombre} en mundo.js`); return Number(m[1]); };
const ALTO_CABLE = constante('ALTO_CABLE'), ALTO_BRAZO = constante('ALTO_BRAZO'), SUELO = constante('SUELO');
const CORONILLA = 1.8;          // lo más alto del corredor sobre sus pies (centro de la cabeza 1,68 + radio 0,21, a escala 0,95)
const ALZA_POGO = 0.55;         // en el pogo el muñeco va 0,55 m más arriba (la goma toca donde iban los pies)

/** Un salto desde el suelo con altura `h`: la velocidad inicial, el tiempo en el aire y la altura en t. */
function salto(h) {
  const v0 = Math.sqrt(2 * F.gravedad * h);
  return { v0, aire: 2 * v0 / F.gravedad, y: t => Math.max(0, v0 * t - F.gravedad * t * t / 2) };
}
/** Simula el salto cuadro a cuadro, como `fisica` en juego.js (semi-implícito), y devuelve la altura máxima y el tiempo en el aire. */
function simula(h, fps) {
  const dt = 1 / fps; let y = 0, vy = Math.sqrt(2 * F.gravedad * h), max = 0, t = 0;
  do { vy -= F.gravedad * dt; y += vy * dt; t += dt; max = Math.max(max, y); } while (y > 0);
  return { max, t };
}

test('el salto es el de Subway Surfers: ~2,1 m y ~0,8 s en el aire', () => {
  assert.ok(F.alturaSalto >= 2 && F.alturaSalto <= 2.2, `altura ${F.alturaSalto}`);
  const s = salto(F.alturaSalto);
  assert.ok(s.aire > 0.75 && s.aire < 0.85, `aire ${s.aire.toFixed(3)} s`);
  for (const fps of [30, 60, 144]) {                                         // y así se siente en el juego, a cualquier ritmo de cuadros
    const r = simula(F.alturaSalto, fps);
    assert.ok(Math.abs(r.max - F.alturaSalto) < 0.25, `${fps} fps: llega a ${r.max.toFixed(2)}`);
    assert.ok(r.t > 0.72 && r.t < 0.9, `${fps} fps: ${r.t.toFixed(2)} s en el aire`);
  }
  assert.ok(F.alturaZapatillas > F.alturaSalto * 1.8, 'con zapatillas, mucho más alto');
  assert.ok(F.caidaRapida > F.gravedad * 0.6, 'abajo en el aire baja rápido');
});

test('la barrera alta se sigue pasando solo rodando, la baja se salta con margen', () => {
  const alta = M.caja({ tipo: 'alto', d: 0 }, 0), baja = M.caja({ tipo: 'bajo', d: 0 }, 0);
  // saltando, la cabeza toca la barrera alta en todo el salto (los pies no pasan por encima)
  assert.ok(F.alturaSalto + 0.02 < alta.y1, 'saltando no se pasa por encima de la alta');
  assert.ok(F.altoDePie > alta.y0, 'de pie choca con la alta');
  assert.ok(F.altoRodando < alta.y0, 'rodando se pasa por debajo');
  // la baja: cuánto tiempo están los pies por encima de ella, contra lo que tarda en pasarla a 50 m/s
  const s = salto(F.alturaSalto), v0 = s.v0, g = F.gravedad, h = baja.y1;
  const disc = Math.sqrt(v0 * v0 - 2 * g * h), ventana = 2 * disc / g;
  const hace = (baja.z1 - baja.z0 + 2 * 0.3) / M.VELOCIDAD.VMAX;           // la barrera más el largo del corredor, a toda velocidad
  assert.ok(ventana > 0.5, `ventana sobre la baja ${ventana.toFixed(2)} s`);
  assert.ok(ventana > hace * 10, 'sobra tiempo para pasarla');
});

test('un salto normal no sube a un techo; con zapatillas sí', () => {
  assert.ok(F.alturaSalto < M.ALTO_TECHO - 0.4, 'saltando desde la vía no se llega al techo (se sube por las rampas)');
  assert.ok(F.alturaZapatillas > M.ALTO_TECHO + 0.3, 'con zapatillas sí se llega');
});

test('nada de lo que vuela toca los cables de la catenaria', () => {
  const coronilla = y => y + SUELO + CORONILLA;                              // la altura de la cabeza con los pies en y
  const desdeTecho = coronilla(M.ALTO_TECHO + F.alturaZapatillas);           // lo más alto de un salto: desde un techo, con zapatillas
  const mochila = coronilla(F.alturaMochila);
  const pogo = coronilla(M.vueloPogo(0).cima + ALZA_POGO);
  const pogoTecho = coronilla(M.vueloPogo(M.ALTO_TECHO).cima + ALZA_POGO);   // el pogo lanzado desde un techo
  for (const [que, h] of [['salto con zapatillas desde un techo', desdeTecho], ['mochila', mochila], ['pogo', pogo], ['pogo desde un techo', pogoTecho]]) {
    assert.ok(h < ALTO_CABLE - 0.2, `${que}: cabeza a ${h.toFixed(2)} m y cables a ${ALTO_CABLE}`);
  }
  assert.ok(ALTO_BRAZO > ALTO_CABLE, 'el brazo sostiene los cables desde arriba');
});

test('el pogo: un lanzamiento grande, ~2,5 s en el aire, por encima de los techos', () => {
  const v = M.vueloPogo(0);
  assert.equal(v.cima, F.alturaPogo);
  assert.ok(v.cima > M.ALTO_TECHO + 3, 'pasa muy por encima de los trenes');
  assert.ok(v.duracion > 2.2 && v.duracion < 2.8, `desde la vía: ${v.duracion.toFixed(2)} s`);
  assert.ok(Math.abs(v.alto(v.duracion)) < 1e-9, 'termina en el suelo');
  assert.ok(Math.abs(v.alto(v.v0 / v.gp) - v.cima) < 1e-9, 'la cima es la cima');
  const t = M.vueloPogo(M.ALTO_TECHO);                                       // desde un techo sube lo que le falta, y al menos subidaPogo
  assert.ok(t.cima - M.ALTO_TECHO >= F.subidaPogo - 1e-9);
  assert.ok(t.duracion > 1.8, `desde un techo: ${t.duracion.toFixed(2)} s`);
});

test('las monedas del pogo: un arco en los tres carriles, sin azar y sin tocar la pista', () => {
  const D = 1234.5, V = 22;
  const a = M.monedasPogo(D, V, 0), b = M.monedasPogo(D, V, 0);
  assert.deepEqual(a, b, 'deterministas: mismas entradas, mismas monedas');
  assert.equal(a.length, 3 * M.N_MONEDAS_POGO);
  for (const c of [0, 1, 2]) assert.equal(a.filter(m => m.carril === c).length, M.N_MONEDAS_POGO, `carril ${c}`);
  const v = M.vueloPogo(0);
  for (const m of a) {
    assert.equal(m.tipo, 'moneda'); assert.ok(m.pogo);
    assert.ok(m.y >= M.PISO_MONEDA_POGO, 'todas por encima de los techos (donde el pogo es invencible)');
    const t = (m.d - D) / V;                                                  // cuándo pasa por ella
    assert.ok(t > 0 && t < v.duracion, 'dentro del vuelo');
    assert.ok(Math.abs(m.y - (v.alto(t) + 1.0)) < 1e-9, 'a la altura de la mano: el juego la recoge al pasar');
  }
  // no gastan el azar del generador: la pista de una semilla es la misma pidiendo o no monedas del pogo
  const pista = semilla => { const g = M.crearGenerador(semilla); return JSON.stringify(g.generarHasta(600, { V: 18 })); };
  const antes = pista(77);
  M.monedasPogo(0, 18, 0); M.monedasPogo(300, 30, M.ALTO_TECHO);
  assert.equal(pista(77), antes);
});

test('las corredoras: precio, rasgos y un peinado distinto cada una', () => {
  const nuevas = Object.entries(M.ASPECTOS).filter(([, a]) => a.rasgos);
  assert.ok(nuevas.length >= 3, 'al menos tres personajes con silueta propia');
  const peinados = new Set();
  for (const [id, a] of nuevas) {
    assert.ok(Number.isInteger(a.precio) && a.precio >= 15000 && a.precio <= 60000, `${id}: precio ${a.precio}`);
    assert.ok(['coleta', 'trenzas', 'larga', 'monos', 'afro'].includes(a.rasgos.peinado), `${id}: peinado`);
    assert.ok(Number.isInteger(a.rasgos.pelo), `${id}: color de pelo`);
    for (const k of ['sudadera', 'gorra', 'jeans', 'mochila', 'mochila2', 'suela']) assert.ok(Number.isInteger(a[k]), `${id}.${k}`);
    peinados.add(a.rasgos.peinado);
  }
  assert.equal(peinados.size, nuevas.length, 'cada una se reconoce de espaldas por el peinado');
  assert.ok(nuevas.some(([, a]) => a.rasgos.falda != null), 'alguna con falda o vestido');
  // tantas corredoras como corredores (los secretos cuentan: también se juegan)
  const todos = Object.values(M.ASPECTOS);
  assert.equal(todos.filter(a => a.rasgos).length, todos.filter(a => !a.rasgos).length, 'cinco y cinco');
  // se pueden comprar y quedan guardadas como cualquier aspecto
  const p = M.limpiaProgreso({ aspectos: nuevas.map(([id]) => id), aspecto: nuevas[0][0] });
  assert.equal(p.aspecto, nuevas[0][0]);
});
