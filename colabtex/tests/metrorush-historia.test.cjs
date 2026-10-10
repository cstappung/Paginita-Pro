/* Metro Rush — la historia en carrera (historia.js) y las estaciones nuevas.

   QUÉ REVISA, EN GLOBAL
   - Que cada estación de la Línea 3 tiene sus afiches, sus dos anuncios de
     altavoz, sus grafitis de historia, su paleta y su lista de música.
   - Que los diez boletos son un capítulo cada uno, en el orden del
     recorrido (`capituloDe`), y que los boletos guardados antes (1 a 7)
     siguen valiendo con su mismo número.
   - Que el antitrampas (`rehace`) acepta los boletos nuevos (8 a 10) y
     rechaza uno que no existe.
   Nada de esto mira el dibujo: escenarios.js necesita Three y se revisa
   en Chromium; aquí solo se comprueba que sus claves existen. */
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, '../../juegos/club/metrorush');
const M = require(path.join(DIR, 'motor.js')), MP = require(path.join(DIR, 'prueba.js')), H = require(path.join(DIR, 'historia.js'));
const lee = f => fs.readFileSync(path.join(DIR, f), 'utf8');

test('cada estación tiene afiches, altavoz, grafitis, paleta y música', () => {
  const mundo = lee('mundo.js'), esc = lee('escenarios.js'), audio = lee('audio.js');
  for (const e of M.ESTACIONES) {
    // los afiches van por paleta; los anuncios por estación
    const af = H.afichesDe(e.paleta);
    assert.ok(af.length >= 3, e.id + ': al menos tres afiches');
    assert.ok(af.some(a => a.t === 'mapa' && a.aqui === e.id), e.id + ': el plano dice «usted está aquí»');
    for (const a of af) {
      assert.ok(['aviso', 'retrato', 'anuncio', 'mapa'].includes(a.t), e.id + ': tipo ' + a.t);
      if (a.t === 'retrato') assert.ok(H.PERSONAJES[a.quien], e.id + ': retrato de ' + a.quien);
      if (a.t === 'mapa') assert.ok(M.ESTACIONES.some(x => x.id === a.aqui), e.id + ': plano de ' + a.aqui);
    }
    const p = H.anuncioProxima(e), eco = H.anuncioEco(e);
    assert.ok(p && p.length > 15 && p.length <= 90, e.id + ': anuncio del túnel corto (' + (p || '').length + ')');
    assert.ok(eco && eco.length > 15 && eco.length <= 90, e.id + ': eco corto (' + (eco || '').length + ')');
    assert.ok(H.LORE[e.paleta] && H.LORE[e.paleta].grafitis.length, e.id + ': grafitis de historia');
    for (const [txt] of H.LORE[e.paleta].grafitis) assert.ok(txt.length <= 10, e.id + ': el grafiti «' + txt + '» cabe en el muro');
    // la paleta existe (en mundo.js o en escenarios.js) y la lista de música también
    assert.ok(new RegExp('\\b' + e.paleta + ':\\s*(variante\\(|BASE_)').test(mundo + esc), e.id + ': paleta ' + e.paleta);
    assert.ok(new RegExp('\\b' + e.id + ':\\s*\\[\'' + e.musica + '\'').test(audio), e.id + ': lista de música con ' + e.musica);
  }
  // en las vueltas el túnel tiene su anuncio y no se repite el eco
  const v = M.estacionDe(M.VUELTA_DESDE);
  assert.match(H.anuncioProxima(v), /Otra vuelta/); assert.equal(H.anuncioEco(v), null);
  // City no tiene afiches ni anuncios propios (es de otro agente): no se le inventan
  assert.equal(H.anuncioProxima(M.ESTACIONES_CITY[0]), null);
});

test('diez boletos, uno por estación, contados en el orden del recorrido', () => {
  const nums = M.ESTACIONES.map(e => e.boleto);
  assert.deepEqual([...nums].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'cada boleto en una sola estación');
  assert.equal(M.BOLETOS.length, 11, 'el 0 vacío y del 1 al 10');
  for (const e of M.ESTACIONES) {
    const b = M.BOLETOS[e.boleto];
    assert.ok(b.titulo && b.texto.length > 40, e.id + ': título y texto');
    assert.equal(M.capituloDe(e.boleto).n, M.ESTACIONES.indexOf(e) + 1, e.id + ': capítulo del recorrido');
    assert.equal(M.capituloDe(e.boleto).de, 10);
  }
  assert.deepEqual(M.capituloDe(8), { n: 3, de: 10 }, 'el Mercado es el tercer capítulo');
  // los guardados antes (1 a 7) y los nuevos valen; lo que no existe se va
  assert.deepEqual(M.limpiaProgreso({ boletos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0] }).boletos, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(M.limpiaProgreso({ boletos: [7, 2] }).boletos, [2, 7], 'un progreso viejo no pierde nada');
});

/* Una carrera corta del clásico que pide el boleto `n` al empezar: 40 s sin
   recoger nada, una muestra cada 2 s y un choque. Lo justo para `rehace`. */
function carreraConBoleto(n) {
  const gen = M.crearGenerador(77), p = MP.nueva({ s: 77, b: 1, md: 0, u: 'uid-h' });
  gen.generarHasta(230, { V: 15 });
  MP.pedido(p, 'B', gen.estado().dSig, n, 420); gen.pedirBoleto(n, 420);
  let t = 0, D = 0, r = 0, sig = MP.PASO_MUESTRA;
  while (t < 40) {
    const dt = 0.02; t += dt; r += 20; D += M.velocidad(t) * dt;
    gen.generarHasta(D + 230, { V: M.velocidad(t) });
    if (t >= sig) { MP.evento(p, 'w', t, D, r); sig = t + MP.PASO_MUESTRA; }
  }
  MP.evento(p, 'm', t, D, r); MP.evento(p, 'f', t + 1, D, r + 1000);
  return MP.cierra(p, { sn: 0 });
}

test('el antitrampas acepta los boletos nuevos y rechaza uno inventado', () => {
  for (const n of [1, 8, 9, 10]) assert.equal(MP.rehace(carreraConBoleto(n)).motivo, undefined, 'boleto ' + n);
  assert.match(MP.rehace(carreraConBoleto(11)).motivo || '', /boleto/);
});

test('la página carga la historia antes del juego', () => {
  const html = lee('index.html');
  assert.ok(html.indexOf('historia.js') > 0 && html.indexOf('historia.js') < html.indexOf('juego.js'), 'historia.js antes de juego.js');
  assert.ok(/id="altavoz"[^>]*role="status"|role="status"[^>]*id="altavoz"/.test(html), 'el altavoz se anuncia a los lectores de pantalla');
});
