/* Metro Rush: el mundo City (juegos/club/metrorush/city.js, más su dibujo en
   mundo-city.js y su carrera en ciudad.js).

   Lo que se fija aquí:
   - los cinco distritos (umbrales en metros, su música, su paleta y su
     postal), la vuelta y la curva de velocidad de City, que leen el juego,
     el sonido, la cámara, el generador y el antitrampas;
   - el generador de City pone lo suyo (cajones, drones, barandas, lonas,
     estrellas secretas y el chicle) y nunca deja una carrera imposible: un
     robot con la física de verdad del juego (M.soporte, M.caja y lo de
     City: pisar, lonas, barandas) corre muchas semillas sin chocar, en
     City y en City sin ayudas; «City sin ayudas» no tiene ni un chicle;
   - cada mecánica, cuadro a cuadro: el cajón se salta o se pisa, el dron se
     rueda, la baranda se sube y se desliza, la lona te deja sobre los
     techos (o detrás de ellos) sin chocar, a toda velocidad y ritmo de cuadros;
   - la prueba del antitrampas rehace una carrera de City que toma estrellas
     secretas, y la pista clásica no cambió (sus huellas);
   - las postales y los personajes de City se guardan y se mezclan aparte;
   - el juego, el sonido y el mundo leen la curva de City (no la clásica). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const DIR = path.join(__dirname, '../../juegos/club/metrorush');
const M = require(path.join(DIR, 'motor.js')), MP = require(path.join(DIR, 'prueba.js'));
const C = M.CITY, F = M.FISICA, X = M.CARRILES;
const lee = f => fs.readFileSync(path.join(DIR, f), 'utf8');

/* ---------- La pista, como la genera el juego ----------
   Siempre 230 m por delante con la velocidad de la curva del modo, y con
   los pedidos que hace juego.js: el túnel antes de cada distrito y la postal
   del distrito (si se pide). Devuelve los objetos y los pedidos hechos. */
function pista(semilla, metros, modo, conPostales = false) {
  const g = M.crearGenerador(semilla, { modo }), curva = M.velocidadDe(modo), objs = [], pedidos = [];
  let D = 0, t = 0, actual = M.estacionDe(0, modo), cambio = null, tunel = null;
  if (conPostales && actual.boleto) { pedidos.push(['B', g.estado().dSig, actual.boleto, 420]); g.pedirBoleto(actual.boleto, 420); }
  while (D < metros) {
    const V = curva.velocidad(t); D += V * 0.05; t += 0.05;
    for (const o of g.generarHasta(D + 230, { V: Math.max(13, V) })) { objs.push(o); if (o.tipo === 'tunel' && cambio && !tunel) tunel = o; }
    const sig = M.siguienteUmbral(D, modo), e = M.estacionDe(sig - D < 220 ? sig : D, modo);
    if (!cambio && e.clave !== actual.clave) { cambio = e; pedidos.push(['T', g.estado().dSig, D + 40, e.id]); g.pedirTunel(D + 40, e.id); }
    if (cambio && tunel && D >= tunel.d0 + 40) {                 // dentro del túnel: cambia de distrito (y pide su postal)
      actual = cambio;
      if (conPostales && actual.boleto) { const d = tunel.d0 + tunel.largo + 260; pedidos.push(['B', g.estado().dSig, actual.boleto, d]); g.pedirBoleto(actual.boleto, d); }
      cambio = null; tunel = null;
    }
  }
  return { objs, pedidos, curva };
}

/* ---------- El robot ----------
   Corre con la física de juego.js (fisica y choques, copiados en corto) y
   con lo de City de ciudad.js (pisar, lonas, barandas). Sabe dos cosas:
   1) POR DÓNDE ir: un plan de carriles hecho con los tramos cerrados de
      verdad (un tren detenido al que no lleva una rampa, uno en marcha
      donde se cruza contigo, y también los trenes de las lonas: el camino
      no puede depender de la lona), recorrido de atrás hacia adelante (qué
      carril, en cada metro, todavía lleva al final). Cambiar de carril pide
      los dos libres durante lo que de verdad tarda (0,17 s a esa velocidad,
      con margen).
   2) QUÉ hacer con lo que viene por su carril: saltar barreras bajas,
      cajones y barandas; rodar bajo barreras altas y drones; nada con las
      rampas (se suben) ni con las lonas.
   Falla si choca de frente o si tropieza dos veces seguidas (lo atraparían). */
function cerrados(objs, hasta) {
  const N = Math.ceil(hasta) + 2, libre = [0, 1, 2].map(() => new Uint8Array(N).fill(1));
  const trenes = objs.filter(o => o.tipo === 'tren'), subible = new Set();
  for (const r of objs.filter(o => o.tipo === 'rampa')) {        // una rampa sube a su tren (y a los pegados a él)
    let fin = r.d0 + r.largo;
    for (;;) { const t = trenes.find(x => x.vel === 0 && x.carril === r.carril && Math.abs(x.d0 - fin) < 0.6); if (!t) break; subible.add(t); fin = t.d0 + t.largo; }
  }
  const lonaDe = new Map();
  /* Una lona (o el vapor) también lleva arriba: los vagones que la siguen
     en su carril se recorren por los techos (el robot salta de verdad). */
  for (const l of objs.filter(o => o.tipo === 'lona')) {
    let t = trenes.find(x => x.vel === 0 && x.carril === l.carril && x.d0 > l.d && x.d0 - l.d < 16);
    if (t) lonaDe.set(t, l);                                       // y para llegar a ellos hay que pasar por la lona: centrado en su carril
    while (t) { subible.add(t); const fin = t.d0 + t.largo; t = trenes.find(x => x.vel === 0 && x.carril === l.carril && Math.abs(x.d0 - fin) < 0.6); }
  }
  /* `libre`: se puede seguir por ahí; `entra`: además se puede LLEGAR ahí
     cambiándose de carril. Un vagón al que lleva una rampa se recorre por
     arriba, pero solo si se subió por la rampa: entrar de lado a media rampa
     o a media fila de vagones es chocar con su costado. Lo mismo meterse de
     lado a media baranda, o justo donde está un cajón, un dron o una
     barrera (no da tiempo de saltar o rodar). */
  const entra = [0, 1, 2].map(() => new Uint8Array(N).fill(1));
  const cierra = (l, c, a, b) => { for (let d = Math.max(0, Math.floor(a)); d <= Math.min(N - 1, Math.ceil(b)); d++) l[c][d] = 0; };
  for (const t of trenes) {
    if (t.vel > 0) { cierra(libre, t.carril, t.dArribo - 1, t.dArribo + t.largo + 1); cierra(entra, t.carril, t.dArribo - 1, t.dArribo + t.largo + 1); }
    else { if (!subible.has(t)) cierra(libre, t.carril, t.d0 - 0.4, t.d0 + t.largo + 0.4); cierra(entra, t.carril, lonaDe.has(t) ? lonaDe.get(t).d - 1.5 : t.d0 - 1, t.d0 + t.largo + 0.4); }
  }
  for (const o of objs) {
    /* Una rampa no choca mientras su superficie esté a menos de 0,6 m
       (`caja` de motor.js): su primer metro se puede tomar llegando de lado. */
    if (o.tipo === 'rampa') cierra(entra, o.carril, o.d0 + 0.5, o.d0 + o.largo + 1);
    else if (o.tipo === 'baranda') cierra(entra, o.carril, o.d0 - 1, o.d0 + o.largo + 1);
    else if (['cajon', 'dron', 'bajo', 'alto'].includes(o.tipo)) cierra(entra, o.carril, o.d - 2, o.d + 1.5);
  }
  for (let c = 0; c < 3; c++) for (let d = 0; d < N; d++) if (!libre[c][d]) entra[c][d] = 0;
  return { libre, entra };
}
function plan(objs, hasta, curva) {
  const { libre, entra } = cerrados(objs, hasta), N = libre[0].length;
  /* Un cambio de carril que empieza en el metro d, a la velocidad V de ahí
     (cruza 2,2 m en 0,17 s): sale del alcance de lo que hay en su carril
     (1,33 m de lado, un vagón) a los 0,103 s, y entra en el del otro a los
     0,067 s. Así que su carril tiene que seguir libre ~0,11·V m más, y el
     otro estar libre (y ser «entrable») desde ~0,06·V m hasta que termina
     de cambiarse. Un metro de margen en cada punta. */
  const K = d => Math.ceil(curva.velocidadEn(d) * 0.17) + 1;
  const bien = [0, 1, 2].map(() => new Uint8Array(N));
  for (let c = 0; c < 3; c++) bien[c][N - 1] = libre[c][N - 1];
  const cambia = (c, o, d) => {
    const V = curva.velocidadEn(d), k = K(d), sale = Math.ceil(V * 0.11) + 1, llega = Math.max(0, Math.floor(V * 0.06) - 1);
    if (d + k >= N) return false;
    for (let x = 0; x <= sale; x++) if (!libre[c][d + x]) return false;
    for (let x = llega; x <= k; x++) if (!entra[o][d + x]) return false;
    return !!bien[o][d + k];
  };
  // de atrás hacia adelante: un carril está bien en d si está libre y sigue bien en d+1, o si desde ahí se puede cambiar a uno que esté bien
  for (let d = N - 2; d >= 0; d--) for (let c = 0; c < 3; c++) {
    if (!libre[c][d]) continue;
    if (bien[c][d + 1] || [c - 1, c + 1].some(o => o >= 0 && o <= 2 && cambia(c, o, d))) bien[c][d] = 1;
  }
  return { libre, entra, bien, cambia, K };
}

const DEPIE = new Set(['bajo', 'cajon', 'baranda']), RUEDA = new Set(['alto', 'dron']);
const frente = o => o.d != null ? o.d - 0.6 : o.d0;             // dónde empieza (cajón, dron y barreras: su centro menos un poco)
function robot(objs, modo, metros, { fps = 60, curva = M.velocidadDe(modo), P = null } = {}) {
  const cosas = objs.filter(o => ['tren', 'rampa', 'bajo', 'alto', 'cajon', 'dron', 'baranda', 'lona'].includes(o.tipo)).map(o => Object.assign({}, o))
    .sort((a, b) => (a.vel > 0 ? a.dArribo - 260 : (a.d ?? a.d0)) - (b.vel > 0 ? b.dArribo - 260 : (b.d ?? b.d0)));
  const pl = P || plan(objs, metros + 300, curva), dt = 1 / fps;
  const r = { x: X[1], xPrev: X[1], carril: 1, carrilPrev: 1, y: 0, vy: 0, enAire: false, rodar: 0, rodarPend: false, bufer: -1 };
  let D = 0, Dantes = 0, t = 0, i = 0, tropiezo = -99, pisadas = 0, lonas = 0, grind = 0;
  const activos = [];
  const cuenta = { saltos: 0, rodadas: 0, techos: 0 };
  while (D < metros) {
    const V = curva.velocidad(t);
    t += dt; Dantes = D; D += V * dt;
    // la ventana de la pista: lo que tiene por delante (como c.activos)
    while (i < cosas.length && (cosas[i].vel > 0 ? cosas[i].dArribo - 260 : (cosas[i].d ?? cosas[i].d0)) < D + 230) activos.push(cosas[i++]);
    for (let k = activos.length - 1; k >= 0; k--) {
      const o = activos[k];
      if (o.tipo === 'tren' && o.vel > 0) { if (!o.activo && D >= o.dArribo - M.APARECE) o.activo = true; if (o.activo) o.d0 -= o.vel * dt; }
      const fin = o.d != null ? o.d : o.d0 + (o.largo || 0);
      if (fin < D - 15) activos.splice(k, 1);
    }
    // 1) por dónde: el plan de carriles
    const dI = Math.floor(D);
    // (se mira un cuadro más allá: a 20 cuadros/s un cuadro son más de 2 m, y el metro justo para cambiarse podría quedar entre dos)
    const mira = Math.ceil(V * dt) + 1;
    let quedarse = true; for (let x = 1; x <= mira; x++) if (!pl.bien[r.carril][dI + x]) quedarse = false;
    if (Math.abs(r.x - X[r.carril]) < 1e-6 && !quedarse) {
      const o = [r.carril - 1, r.carril + 1].find(o => o >= 0 && o <= 2 && pl.cambia(r.carril, o, dI));
      if (o != null) { r.carrilPrev = r.carril; r.carril = o; }
    }
    // 2) qué hacer con lo que viene por su carril (o por el que se está cambiando)
    const salta = () => { r.vy = M.impulso(F.alturaSalto); r.enAire = true; r.rodar = 0; r.rodarPend = false; r.bufer = -1; cuenta.saltos++; };
    if (r.bufer > 0) { r.bufer -= dt; if (!r.enAire) salta(); }   // el búfer del salto (juego.js): pedido en el aire, sale al tocar el suelo
    const alto = r.y > 2.5 && !r.enAire;                          // de pie arriba de un tren: nada lo alcanza
    if (!alto) for (const o of activos) {
      if (o.carril !== r.carril || o.roto) continue;
      const dz = frente(o) - D;
      if (DEPIE.has(o.tipo) && dz > 0 && dz < V * 0.2 + 0.4 && !(o.tipo === 'baranda' && r.y >= 0.9)) {
        if (!r.enAire) salta(); else if (r.vy <= 0 && r.y < 0.9) r.bufer = 0.16;   // cayendo y bajo: lo pide (como el búfer de juego.js)
      }
      /* Cayendo (de un techo, o de un salto largo: 0,8 s en el aire) hacia
         algo que hay que saltar: baja de golpe (rodar en el aire, como haría
         una persona) para tocar el suelo a tiempo de saltar. Si viene muy encima, cayendo sin más lo pisa; y si
         cayendo sin más ya le pasa por encima (una lona lo lanzó alto), no. */
      const tz = (dz + 1.2) / V, yLlega = r.y + r.vy * tz - F.gravedad * tz * tz / 2;   // la altura con que dejaría atrás la cosa cayendo sin más
      // (ya pasó lo que saltaba: nada debajo ni justo delante, o caería encima)
      const debajo = activos.some(q => q !== o && q.carril === r.carril && !q.roto && q.tipo !== 'tren' && q.tipo !== 'lona'
        && (q.d != null ? Math.abs(q.d - D - V * 0.04) < 1 + V * 0.06 : q.d0 < D + V * 0.1 && q.d0 + q.largo > D - 1));
      if (DEPIE.has(o.tipo) && r.enAire && r.y > 0.9 && r.vy < 3 && dz > V * 0.2 && dz < V * 0.6 && !r.rodarPend && yLlega < 1.2 && !debajo
        && !activos.some(t => t.tipo === 'tren' && t.carril === r.carril && t.d0 + t.largo > D - 0.5 && t.d0 < frente(o))) {
        r.vy = -F.caidaRapida; r.rodarPend = true;
      }
      /* Bajando de un techo hacia una lona: si cayendo sin más pasaría por
         encima sin tocarla (y se estrellaría con los vagones que la siguen),
         baja de golpe para pisarla. */
      if (o.tipo === 'lona' && !o.usada && r.enAire && r.y > 0.35 && r.vy < 3 && !r.rodarPend) {
        const dl = o.d - D, tl = (dl + 0.6) / V, yL = r.y + r.vy * tl - F.gravedad * tl * tl / 2;
        if (dl > 0 && dl < V * 0.7 && yL > 0.3) { r.vy = -F.caidaRapida; r.rodarPend = true; }
      }
      // rueda (o vuelve a rodar, como en juego.js: «abajo» rodando reinicia la rodada) si la rodada no le alcanza para pasar
      if (RUEDA.has(o.tipo) && dz > 0 && dz < V * 0.25 + 0.8 && r.rodar < (dz + 1.2) / V && !r.rodarPend) {
        // en el aire baja de golpe, salvo que cayendo sin más ya le pase por encima (bajando de un techo; con margen por el paso de la física a pocos cuadros)
        const tz = (dz + 1.2) / V, yPasa = r.y + r.vy * tz - F.gravedad * tz * tz / 2, cj = M.caja(o, D);
        if (r.enAire) { if (!(cj && yPasa > cj.y1 + 0.35)) { r.vy = -F.caidaRapida; r.rodarPend = true; } } else { r.rodar = F.tiempoRodar; cuenta.rodadas++; }
      }
    }
    // 3) la física (fisica en juego.js)
    const yAntes = r.y;
    const vl = 2.2 / F.cambioCarril;
    r.xPrev = r.x; r.x += Math.max(-vl * dt, Math.min(vl * dt, X[r.carril] - r.x));
    const sop = M.soporte(activos, r.x, D, r.y, Dantes);
    r.vy -= F.gravedad * dt; r.y += r.vy * dt;
    if (r.y <= sop.h) {
      if (r.enAire && r.rodarPend) { r.rodar = F.tiempoRodar; }
      r.y = sop.h; r.vy = 0; r.enAire = false; r.rodarPend = false;
    } else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;
    if (sop.tren) cuenta.techos++;
    // lo de City después de mover (ciudad.fisica): la lona y el riel
    if (r.y < 0.35) for (const o of activos) if (C.enLona(o, r.x, D, r.y)) { o.usada = true; r.vy = C.impulsoLona(1); r.enAire = true; r.rodar = 0; lonas++; break; }
    if (sop.apoyo && sop.apoyo.tipo === 'baranda' && !r.enAire) grind += V * dt;
    if (r.rodar > 0) r.rodar -= dt;
    // 4) los choques (choques en juego.js, con el pisotón de City)
    if (r.y <= 6) {
      const yb = r.y + 0.02, yt = r.y + (r.rodar > 0 ? F.altoRodando : F.altoDePie);
      for (const o of activos) {
        const k = M.caja(o, D);
        if (!k || k.y1 <= k.y0) continue;
        if (D + M.MEDIO_LARGO < k.z0 || D - M.MEDIO_LARGO > k.z1) continue;
        const Xo = X[o.carril], lim = k.w + F.medioAncho;
        if (Math.abs(r.x - Xo) >= lim) continue;
        if (yb >= k.y1 || yt <= k.y0) continue;
        if (C.pisa(o, yAntes, r.vy)) { o.roto = true; pisadas++; r.vy = M.impulso(1.1); r.enAire = true; continue; }
        const deCostado = Math.abs(r.xPrev - Xo) >= lim - 0.02;
        if (!deCostado) return { choque: { tipo: o.tipo, carril: o.carril, d: +(o.d ?? o.d0).toFixed(1), D: +D.toFixed(1), y: +r.y.toFixed(2), x: +r.x.toFixed(2), V: +V.toFixed(1), rodar: r.rodar > 0 }, D, pisadas, lonas, grind, cuenta };
        if (t - tropiezo < F.ventanaTropiezo) return { choque: { tipo: 'atrapado', por: o.tipo, D: +D.toFixed(1) }, D, pisadas, lonas, grind, cuenta };
        tropiezo = t; r.carril = r.carrilPrev; r.x = r.xPrev - Math.sign(Xo - r.xPrev) * 0.05;
        break;
      }
    }
  }
  return { choque: null, D, pisadas, lonas, grind, cuenta, tropiezos: tropiezo > 0 };
}

/* ---------- los datos ---------- */

test('los cinco distritos: en metros, con su música, su paleta, su escenografía y su postal', () => {
  const E = M.ESTACIONES_CITY;
  assert.equal(E, C.DISTRITOS); assert.equal(E.length, 5);
  assert.deepEqual(E.map(e => e.musica), ['city-sur', 'city-muelles', 'city-bulevar', 'city-parque', 'city-bajo']);
  assert.deepEqual(E.map(e => e.distrito), ['sur', 'muelles', 'bulevar', 'parque', 'bajo']);
  assert.deepEqual(E.map(e => e.boleto), [1, 2, 3, 4, 5]);
  for (let k = 1; k < E.length; k++) assert.ok(E[k].desde > E[k - 1].desde, 'los umbrales crecen');
  assert.equal(E[0].desde, 0);
  const audio = lee('audio.js'), dibujo = lee('mundo-city.js');
  for (const e of E) {
    assert.ok(['juguete', 'pixel', 'neon'].includes(e.estilo), e.id);
    assert.match(audio, new RegExp(`'${e.musica}': \\[`), e.id + ': su lista de temas');
    assert.match(dibujo, new RegExp(`\\n  ${e.paleta}: variante\\(`), e.id + ': su paleta en mundo-city.js');
    assert.equal(M.estacionDe(e.desde + 1, 'city').id, e.id);
    assert.ok(C.POSTALES[e.boleto] && C.POSTALES[e.boleto].titulo && C.POSTALES[e.boleto].texto, e.id + ': su postal');
  }
  assert.equal(C.POSTALES.length, 6); assert.equal(C.POSTALES[0], null);
  assert.equal(M.INTRO_CITY, C.INTRO); assert.ok(M.INTRO_CITY.length > 100);
  // la vuelta: desde los 13 km, cada 3 km, sin postal
  const v = M.estacionDe(13500, 'city'); assert.match(v.nombre, /vuelta 2/); assert.ok(!v.boleto);
  assert.equal(M.estacionDe(16500, 'citypuro').distrito, 'muelles');
  assert.equal(M.siguienteUmbral(9500, 'city'), 13000);
  // la postal de un mundo no es de otro: City lleva sus cinco postales y la Línea 3 sus boletos, en otra lista
  assert.equal(M.historiaDe('city').boletos, C.POSTALES); assert.notEqual(M.BOLETOS, C.POSTALES);
  assert.ok(M.BOLETOS.length > C.POSTALES.length, 'los boletos de la Línea 3 no se mezclan con las postales');
});

test('la velocidad de City: su propia curva, la misma para el juego, el generador y el antitrampas', () => {
  const V = M.velocidadDe('city'), Vp = M.velocidadDe('citypuro'), Vf = M.velocidadDe('cityfantasma'), Vc = M.velocidadDe('clasico');
  assert.equal(V, Vp); assert.equal(V, Vf); assert.notEqual(V, Vc);
  assert.equal(V.VELOCIDAD, C.VELOCIDAD); assert.deepEqual(C.VELOCIDAD, { V0: 16, VMAX: 46, ACEL: 0.11 });
  assert.equal(V.velocidad(0), 16); assert.equal(V.velocidad(1e4), 46);
  assert.ok(Math.abs(V.velocidadEn(V.metrosEntre(0, 100)) - V.velocidad(100)) < 1e-6, 'velocidadEn y metrosEntre son la misma curva');
  // el juego le pasa la curva de la carrera al mundo (la cámara) y al sonido (el tempo)
  const juego = lee('juego.js'), ciudad = lee('ciudad.js'), mundo = lee('mundo.js'), audio = lee('audio.js');
  assert.match(juego, /ciudad\.inicia\(c, progreso, mundo\)/);
  assert.match(ciudad, /mundo\.curva\(V\)/); assert.match(ciudad, /sonido\.curva\(V\)/);
  assert.match(mundo, /curva\(V\) \{ if \(V && V\.VMAX > V\.V0\) VEL = V; \}/);
  assert.match(audio, /curva\(V\) \{ if \(V && V\.VMAX > V\.V0\) VEL = V; \}/);
  assert.match(juego, /c\.curva\.VELOCIDAD : M\.VELOCIDAD\)\.V0/);
});

test('los personajes de City: chicas y chicos, con una ventaja chica que no toca los puntos', () => {
  const P = C.PERSONAJES, ids = Object.keys(P);
  assert.ok(ids.length >= 4); assert.equal(M.MUNDOS.city.personajes, P);
  const pelos = new Set(['corto', 'coleta', 'melena', 'trenzas', 'rapado']);
  for (const id of ids) {
    const p = P[id];
    assert.equal(p.id, id); assert.ok(p.precio > 0 && p.nombre && p.texto);
    assert.ok(pelos.has(p.apariencia.peinado), id + ': su peinado');
    for (const k of ['sudadera', 'gorra', 'jeans', 'mochila', 'mochila2', 'suela', 'piel', 'pelo']) assert.equal(typeof p.apariencia[k], 'number', id + '.' + k);
    // una sola ventaja, de las que no cambian ni los metros ni el multiplicador
    const v = Object.keys(p.ventaja); assert.equal(v.length, 1, id);
    assert.ok(['iman', 'salto', 'pisoton', 'grind', 'lona', 'energia'].includes(v[0]), id);
    assert.ok(p.ventaja[v[0]] > 0 && p.ventaja[v[0]] <= 3, id + ': chica');
    assert.equal(C.ventajaDe(id), p.ventaja);
  }
  // tres chicas y tres chicos (Dante llegó para emparejar)
  const chicas = ['lia', 'ambar', 'sol'], chicos = ['nico', 'bruno', 'dante'];
  assert.deepEqual([...ids].sort(), [...chicas, ...chicos].sort());
  assert.ok(ids.some(k => P[k].apariencia.falda), 'hay faldas'); assert.ok(ids.some(k => !P[k].apariencia.falda), 'y pantalones');
  assert.deepEqual(C.ventajaDe('clasico'), {}); assert.deepEqual(C.ventajaDe(null), {});
  // el salto de Nico (2,27 m) no pasa por encima de un dron (2,45) ni llega a pisarlo (eso solo desde un techo o una lona)
  assert.ok(F.alturaSalto * P.nico.ventaja.salto < C.DRON.y1 - C.PISA_DRON - 0.01);
});

test('progreso: las postales y los personajes de City se guardan aparte y se suman entre aparatos', () => {
  const p = M.limpiaProgreso({ boletosCity: [3, 1, 3, 9, 0, 'x'], personajesCity: ['lia', 'nope', 'lia'], personajeCity: 'nope', boletos: [2] });
  assert.deepEqual(p.boletosCity, [1, 3]); assert.deepEqual(p.personajesCity, ['lia']); assert.equal(p.personajeCity, null);
  assert.deepEqual(p.boletos, [2], 'los boletos de la Línea 3 no se tocan');
  assert.equal(M.limpiaProgreso({ personajesCity: ['sol'], personajeCity: 'sol' }).personajeCity, 'sol');
  assert.equal(M.limpiaProgreso({ personajesCity: [], personajeCity: 'sol' }).personajeCity, null, 'no se pone uno que no es suyo');
  const a = Object.assign(M.limpiaProgreso({ boletosCity: [1], personajesCity: ['lia'], personajeCity: 'lia' }), { at: 1 });
  const b = Object.assign(M.limpiaProgreso({ boletosCity: [4], personajesCity: ['bruno'], personajeCity: 'bruno' }), { at: 2 });
  const m = M.mezclaProgreso(a, b);
  assert.deepEqual(m.boletosCity, [1, 4]); assert.deepEqual(m.personajesCity.sort(), ['bruno', 'lia']); assert.equal(m.personajeCity, 'bruno');
  const n = M.progresoNuevo(); assert.deepEqual([n.boletosCity, n.personajesCity, n.personajeCity], [[], [], null]);
});

/* ---------- la pista ---------- */

test('la pista de City tiene lo suyo; «City sin ayudas» ni un poder ni un chicle; la misma semilla da la misma pista', () => {
  const city = pista(2026, 10500, 'city').objs, puro = pista(2026, 10500, 'citypuro').objs;   // hasta Bajo Vías (9 km) y un poco más
  const cuenta = (l, f) => l.filter(f).length;
  for (const t of ['cajon', 'dron', 'baranda', 'lona']) { assert.ok(cuenta(city, o => o.tipo === t) > 5, 'city: ' + t); assert.ok(cuenta(puro, o => o.tipo === t) > 5, 'citypuro: ' + t); }
  assert.ok(cuenta(city, o => o.tipo === 'poder' && o.clase === 'chicle') >= 3, 'hay chicles');
  assert.ok(cuenta(city, o => o.tipo === 'estrella' && o.secreta) >= 5, 'hay estrellas secretas');
  assert.ok(cuenta(puro, o => o.tipo === 'estrella' && o.secreta) >= 5, 'también sin ayudas');
  assert.equal(cuenta(puro, o => o.tipo === 'poder' || o.tipo === 'caja'), 0, 'sin ayudas: ni poderes, ni cajas, ni chicles');
  assert.ok(cuenta(city, o => o.tipo === 'lona' && o.variante === 'vapor') > 0, 'Bajo Vías tiene vapor');
  // los tipos nuevos están registrados (M.caja los conoce) y la lona no choca
  for (const t of ['cajon', 'dron', 'baranda', 'lona']) assert.ok(M.TIPOS[t], t);
  assert.equal(M.caja({ tipo: 'lona', d: 10, carril: 0 }, 10), null);
  assert.equal(M.caja({ tipo: 'cajon', d: 10, carril: 0, roto: true }, 10), null, 'un cajón roto ya no choca');
  // determinista
  const h = l => crypto.createHash('sha256').update(JSON.stringify(l)).digest('hex');
  assert.equal(h(pista(77, 4000, 'city').objs), h(pista(77, 4000, 'city').objs));
  assert.notEqual(h(pista(77, 4000, 'city').objs), h(pista(77, 4000, 'citypuro').objs));
});

test('lo de Subway Surfers City: energía de la tabla, rejillas, contenedores que caen, burbujas y los poderes nuevos', () => {
  const city = pista(2026, 10500, 'city').objs, puro = pista(2026, 10500, 'citypuro').objs;
  const de = (l, t) => l.filter(o => o.tipo === t);
  // las celdas de energía cargan la tabla: solo donde hay patineta (en «sin ayudas» no hay qué cargar)
  assert.ok(de(city, 'energia').length > 30, 'city: celdas de energía');
  assert.equal(de(puro, 'energia').length, 0, 'citypuro: ni una celda');
  // los poderes nuevos (batería y monedas ×2) solo con poderes
  for (const k of ['bateria', 'monedas2']) {
    assert.ok(city.some(o => o.tipo === 'poder' && o.clase === k), 'city: ' + k);
    assert.ok(!puro.some(o => o.tipo === 'poder' && o.clase === k), 'citypuro: sin ' + k);
  }
  // rejillas en los dos modos (no son una ayuda: se ganan con un pisotón), espaciadas
  for (const l of [city, puro]) {
    const r = de(l, 'rejilla').map(o => o.d);
    assert.ok(r.length > 10, 'rejillas');
    for (let i = 1; i < r.length; i++) assert.ok(r[i] - r[i - 1] >= 250 - 1e-9, 'una cada 250 m o más');
  }
  // el parque trae tramos de burbujas, que ocupan los tres carriles; los otros distritos no
  const burb = de(city, 'burbujas');
  assert.ok(burb.length >= 1, 'hay burbujas');
  for (const b of burb) {
    assert.equal(M.estacionDe(b.d0, 'city').distrito, 'parque', 'solo en el parque');
    assert.ok(b.largo >= 70 && b.largo <= 110, 'largo del tramo');
  }
  // los contenedores que caen solo son cajones, y solo en los muelles
  const caen = city.filter(o => o.cae);
  assert.ok(caen.length > 0, 'hay contenedores que caen');
  for (const o of caen) { assert.equal(o.tipo, 'cajon'); assert.equal(M.estacionDe(o.d, 'city').distrito, 'muelles'); }
  // nada de lo nuevo choca
  for (const t of ['energia', 'rejilla', 'burbujas']) { assert.ok(M.TIPOS[t], t); assert.equal(M.caja({ tipo: t, d: 10, carril: 0 }, 10), null, t + ' no choca'); }
  // la altura del contenedor: arriba lejos, en el suelo antes de llegar, y bajando sin saltos
  assert.equal(C.alturaCae(40), 9); assert.equal(C.alturaCae(12), 0); assert.equal(C.alturaCae(0), 0);
  let prev = C.alturaCae(34);
  for (let d = 33.5; d >= 12; d -= 0.5) { const h = C.alturaCae(d); assert.ok(h <= prev + 1e-12, 'baja de a poco'); prev = h; }
  // los números que el jugador siente
  assert.equal(C.ENERGIA_LLENA, 10); assert.ok(C.TABLA_SEG > 0 && C.MONEDAS2_SEG > 0);
  assert.ok(C.BURBUJAS.gravedad > 0 && C.BURBUJAS.gravedad < 1, 'en las burbujas se flota');
  assert.ok(C.CHICLE.salto > 1, 'el chicle salta más');
  // Dante: cada celda vale por dos (en ciudad.js, sin pasarse de la barra)
  assert.match(lee('ciudad.js'), /C\.ventaja\.energia/);
  assert.match(lee('ciudad.js'), /Math\.min\(CITY\.ENERGIA_LLENA/);
});

test('la pista clásica no cambió con City (sus huellas)', () => {
  // las mismas de metrorush-modos.test.cjs: el recorrido de 15 km con un túnel, la mochila y un boleto
  function clasica(semilla) {
    const g = M.crearGenerador(semilla), objs = []; let D = 0, t = 0;
    while (D < 15000) {
      const V = M.velocidad(t); D += V * 0.05; t += 0.05; objs.push(...g.generarHasta(D + 230, { V }));
      if (Math.abs(D - 1300) < 1 && !g._t) { g._t = 1; g.pedirTunel(D + 40, 'ocaso'); }
      if (Math.abs(D - 2000) < 1 && !g._c) { g._c = 1; objs.push(...g.monedasCielo(D + 12, D + 100, 1)); g.pedirBoleto(2, D + 300); }
    }
    return crypto.createHash('sha256').update(JSON.stringify(objs)).digest('hex').slice(0, 16) + ':' + objs.length;
  }
  assert.equal(clasica(1), '99eab28c0344da60:4746');
  assert.equal(clasica(2026), 'd1d2c227952fd138:4747');
  assert.equal(clasica(424242), '8c171d3acd37d3c2:4681');
});

test('el generador de City nunca deja una carrera imposible (robot con la física del juego, 8 semillas × 2 modos × 11 km)', () => {
  const resumen = [];
  for (const modo of ['city', 'citypuro']) for (let k = 1; k <= 8; k++) {
    const semilla = k * 92821 + (modo === 'city' ? 0 : 7), metros = 11000;
    const { objs, curva } = pista(semilla, metros + 400, modo);
    const P = plan(objs, metros + 300, curva);
    assert.ok(P.bien[1][0], `${modo} ${semilla}: el plan de carriles llega al final`);
    const fps = [30, 60, 144][k % 3];
    const r = robot(objs, modo, metros, { fps, curva, P });
    assert.equal(r.choque, null, `${modo} ${semilla} a ${fps} cuadros/s: ${JSON.stringify(r.choque)}`);
    resumen.push(r);
  }
  // y de verdad pasó por lo de City: pisó (rodando en el aire sobre drones o cayendo de techos), se deslizó y saltó
  assert.ok(resumen.reduce((s, r) => s + r.grind, 0) > 100, 'se deslizó por barandas');
  assert.ok(resumen.reduce((s, r) => s + r.cuenta.saltos, 0) > 200, 'saltó');
  assert.ok(resumen.reduce((s, r) => s + r.cuenta.rodadas, 0) > 100, 'rodó');
});

/* ---------- cada mecánica, cuadro a cuadro ---------- */

/** Corre en el carril 1 de `desde` a `hasta` a velocidad fija con `objs`,
    haciendo lo que diga `accion(D, r)`; devuelve el choque (o null), la
    altura final y lo que pasó. Misma física que el robot. */
function tramo(objs, { fps = 60, V = 20, desde = 0, hasta = 60, y0 = 0, vy0 = 0, accion = () => {} }) {
  const dt = 1 / fps, r = { x: X[1], y: y0, vy: vy0, enAire: y0 > 0, rodar: 0 }, os = objs.map(o => Object.assign({}, o));
  let D = desde, Dantes = D, lanzado = false, pisado = 0, riel = 0, maxY = y0;
  while (D < hasta) {
    Dantes = D; D += V * dt;
    accion(D, r);
    const yAntes = r.y, sop = M.soporte(os, r.x, D, r.y, Dantes);
    r.vy -= F.gravedad * dt; r.y += r.vy * dt;
    if (r.y <= sop.h) { r.y = sop.h; r.vy = 0; r.enAire = false; } else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;
    if (r.y < 0.35) for (const o of os) if (C.enLona(o, r.x, D, r.y)) { o.usada = true; lanzado = true; r.vy = C.impulsoLona(1); r.enAire = true; }
    if (sop.apoyo && sop.apoyo.tipo === 'baranda' && !r.enAire) riel += V * dt;
    if (r.rodar > 0) r.rodar -= dt;
    maxY = Math.max(maxY, r.y);
    const yb = r.y + 0.02, yt = r.y + (r.rodar > 0 ? F.altoRodando : F.altoDePie);
    for (const o of os) {
      const k = M.caja(o, D);
      if (!k || k.y1 <= k.y0 || D + M.MEDIO_LARGO < k.z0 || D - M.MEDIO_LARGO > k.z1 || Math.abs(r.x - X[o.carril]) >= k.w + F.medioAncho || yb >= k.y1 || yt <= k.y0) continue;
      if (C.pisa(o, yAntes, r.vy)) { o.roto = true; pisado++; r.vy = M.impulso(1.1); r.enAire = true; continue; }
      return { choque: o.tipo, D, y: r.y, lanzado, pisado, riel, maxY };
    }
  }
  return { choque: null, D, y: r.y, lanzado, pisado, riel, maxY };
}
const RITMOS = [20, 30, 60, 144], VELS = [16, 24, 32, 40, 46];
/* «De frente choca» se mira desde 60 cuadros/s: a 20 un cuadro avanza
   hasta 2,3 m y un objeto corto (un dron mide 0,9 m; una barrera baja de la
   Línea 3, 0,24) puede quedar entre dos cuadros. Pasa igual en el clásico;
   lo que importa aquí es que lo que se debe pasar se pase a cualquier ritmo. */
const CHOCA = fps => fps >= 60;

test('el cajón: de frente choca, se salta a tiempo, y cayendo encima se rompe', () => {
  const caj = { tipo: 'cajon', carril: 1, d: 40 };
  for (const fps of RITMOS) for (const V of VELS) {
    if (CHOCA(fps)) assert.equal(tramo([caj], { fps, V, desde: 20 }).choque, 'cajon', `${fps}/${V}: de frente choca`);
    const salta = tramo([caj], { fps, V, desde: 20, accion: (D, r) => { if (!r.enAire && 39.4 - D < V * 0.2 && D < 39.4) { r.vy = M.impulso(F.alturaSalto); r.enAire = true; } } });
    assert.equal(salta.choque, null, `${fps}/${V}: saltándolo pasa`);
    const cae = tramo([caj], { fps, V, desde: 40 - V * Math.sqrt(2 * 1.6 / F.gravedad), y0: 2.4 });    // cayendo de 2,4 m (un techo, una lona) justo encima: a 0,8 m en su centro
    assert.equal(cae.choque, null, `${fps}/${V}: cayendo encima no choca`); if (CHOCA(fps)) assert.equal(cae.pisado, 1, `${fps}/${V}: lo pisa`);
  }
  // la regla del pisotón: bajando y con los pies (en el cuadro anterior) casi a la altura de arriba
  assert.equal(C.pisa({ tipo: 'cajon' }, 0.9, -3), true); assert.equal(C.pisa({ tipo: 'cajon' }, 0.3, -3), false);
  assert.equal(C.pisa({ tipo: 'cajon' }, 0.9, 2), false, 'subiendo no pisa'); assert.equal(C.pisa({ tipo: 'tren' }, 9, -3), false);
  assert.equal(C.pisa({ tipo: 'cajon', roto: true }, 2, -3), false);
});

test('el dron: de pie choca, un salto normal también, rodando pasa, y desde arriba se pisa', () => {
  const dron = { tipo: 'dron', carril: 1, d: 40 };
  for (const fps of RITMOS) for (const V of VELS) {
    if (CHOCA(fps)) assert.equal(tramo([dron], { fps, V, desde: 20 }).choque, 'dron', `${fps}/${V}: de pie choca`);
    const rueda = tramo([dron], { fps, V, desde: 20, accion: (D, r) => { if (r.rodar <= 0 && 39.4 - D < V * 0.25 + 0.8 && D < 39.4) r.rodar = F.tiempoRodar; } });
    assert.equal(rueda.choque, null, `${fps}/${V}: rodando pasa`);
    const salta = tramo([dron], { fps, V, desde: 20, accion: (D, r) => { if (!r.enAire && 39.4 - D < V * 0.2 && D < 39.4) { r.vy = M.impulso(F.alturaSalto); r.enAire = true; } } });
    if (CHOCA(fps)) assert.equal(salta.choque, 'dron', `${fps}/${V}: un salto normal no lo pasa`);
  }
  assert.equal(C.pisa({ tipo: 'dron' }, 2.4, -2), true, 'cayendo de un techo lo pisa');
  assert.equal(C.pisa({ tipo: 'dron' }, F.alturaSalto, -0.1), false, 'con un salto normal, ni en lo más alto');
});

test('la baranda: de frente choca; saltando se sube, se desliza todo el riel y se baja sin chocar', () => {
  const b = { tipo: 'baranda', carril: 1, d0: 40, largo: 24, alto: C.BARANDA.alto };
  const v0 = M.impulso(F.alturaSalto), tCae = (v0 + Math.sqrt(v0 * v0 - 2 * F.gravedad * C.BARANDA.alto)) / F.gravedad;   // del salto al riel
  for (const fps of RITMOS) for (const V of VELS) {
    // la más corta que arma el generador a esa velocidad
    const largo = Math.ceil(V * 0.75) + 10, b = { tipo: 'baranda', carril: 1, d0: 40, largo, alto: C.BARANDA.alto };
    const comido = V * tCae - (V * 0.2 + 0.4);                    // lo que el salto se come del comienzo del riel
    assert.equal(tramo([b], { fps, V, desde: 25 }).choque, 'baranda', `${fps}/${V}: de frente choca`);   // (es larga: choca a cualquier ritmo)
    const sube = tramo([b], { fps, V, desde: 25, hasta: 40 + largo + 30, accion: (D, r) => { if (!r.enAire && r.y < 0.5 && 39.7 - D < V * 0.2 + 0.4 && D < 39.7) { r.vy = M.impulso(F.alturaSalto); r.enAire = true; } } });
    assert.equal(sube.choque, null, `${fps}/${V}: saltando se sube`);
    assert.ok(sube.riel > largo - comido - 2 && sube.riel >= 8, `${fps}/${V}: se desliza (${sube.riel.toFixed(1)} m de ${largo})`);   // todo el riel menos lo que se come el salto
    assert.equal(sube.y, 0, `${fps}/${V}: al final se baja`);
  }
  // sostiene solo en su carril y a lo largo del riel
  assert.equal(M.soporte([b], X[1], 50, 0.9).h, 1); assert.equal(M.soporte([b], X[1], 50, 0.3).h, 0);
  assert.equal(M.soporte([b], X[0], 50, 0.9).h, 0); assert.equal(M.soporte([b], X[1], 70, 0.9).h, 0);
  // no queda una franja entre «choca» y «sostiene»
  const k = M.caja(b, 50); assert.ok(C.BARANDA.alto - 0.47 <= k.y1 - 0.02 + 1e-9);
});

test('la lona: te lanza por encima de los vagones, a toda velocidad y ritmo de cuadros, sin chocar', () => {
  for (const fps of RITMOS) for (const V of VELS) for (const n of [C.vagonesLona(V), Math.min(4, C.vagonesLona(V) + 1)]) {
    // como la arma el generador: el tren empieza a huecoLona(V) m de la lona, con vagonesLona(V) vagones (o uno más)
    const d0 = 40 + C.huecoLona(V), objs = [{ tipo: 'lona', carril: 1, d: 40 }];
    for (let i = 0; i < n; i++) objs.push({ tipo: 'tren', carril: 1, d0: d0 + i * (M.LARGO_VAGON + 0.4), largo: M.LARGO_VAGON, vel: 0 });
    const fin = d0 + n * (M.LARGO_VAGON + 0.4);
    const r = tramo(objs, { fps, V, desde: 30, hasta: fin + 30 });
    assert.equal(r.choque, null, `${fps}/${V}/${n} vagones: no choca`);
    assert.ok(r.lanzado, `${fps}/${V}: la lona lanza`);
    assert.ok(r.maxY > (fps >= 60 ? 5 : 4.5) && r.maxY < 5.4, `${fps}/${V}: hasta ~5,2 m (${r.maxY.toFixed(2)})`);   // a 20 cuadros/s el paso de Euler sube un poco menos
    const s = tramo(objs, { fps, V, desde: 30, hasta: fin - 3 }); assert.equal(s.y, M.ALTO_TECHO, `${fps}/${V}/${n}: aterriza en el techo (a cualquier velocidad)`);
  }
  // con Sol (×1,15) sube más, y nunca pasa de los 6 m sobre los que ya nada choca
  assert.ok(C.impulsoLona(1.15) > C.impulsoLona(1)); assert.ok(C.LONA.altura * 1.15 < 6.05);
  assert.equal(C.enLona({ tipo: 'lona', carril: 1, d: 40, usada: true }, X[1], 40, 0), false, 'una vez cada una');
  assert.equal(C.enLona({ tipo: 'lona', carril: 1, d: 40 }, X[1], 40, 1.2), false, 'saltando por encima no');
});

/* ---------- el antitrampas ---------- */

/* Una carrera de City como la anota juego.js: los pedidos (túneles y
   postales), cada estrella (las secretas incluidas) donde de verdad está,
   una muestra cada 2 s y el choque al final. */
function carrera(modo, semilla, segundos) {
  const curva = M.velocidadDe(modo), g = M.crearGenerador(semilla, { modo }), pr = MP.nueva({ s: semilla, b: 3, md: 0, u: 'uid-city', m: modo });
  let D = 0, t = 0, rr = 0, estrellas = 0, puntos = 0, secretas = 0, actual = M.estacionDe(0, modo), cambio = null, tunel = null, sig = MP.PASO_MUESTRA;
  const objs = new Map(), tomadas = new Set();
  const agrega = l => { for (const o of l) { if (o.tipo === 'estrella') objs.set(o.id, o); if (o.tipo === 'tunel' && cambio && !tunel) tunel = o; } };
  const anota = (cod, x) => MP.evento(pr, cod, t, D, rr, x), pedido = (tipo, ...d) => MP.pedido(pr, tipo, g.estado().dSig, ...d);
  agrega(g.generarHasta(230, { V: curva.velocidad(0) }));
  pedido('B', actual.boleto, 420); g.pedirBoleto(actual.boleto, 420);
  while (t < segundos) {
    const dt = 1 / 60; t += dt; rr += dt * 1000;
    const V = curva.velocidad(t), dD = V * dt; D += dD;
    puntos += M.puntosPorTramo(dD, M.multiplicador({ base: 3, estrellas, doble: false, extra: 0, fijo: M.modoDe(modo).multFijo }));
    agrega(g.generarHasta(D + 230, { V: Math.max(13, V) }));
    const um = M.siguienteUmbral(D, modo), e = M.estacionDe(um - D < 220 ? um : D, modo);
    if (!cambio && e.clave !== actual.clave) { cambio = e; pedido('T', D + 40, e.id); g.pedirTunel(D + 40, e.id); }
    if (cambio && tunel && D >= tunel.d0 + 40) { actual = cambio; if (actual.boleto) { const d = tunel.d0 + tunel.largo + 260; pedido('B', actual.boleto, d); g.pedirBoleto(actual.boleto, d); } cambio = null; tunel = null; }
    for (const o of objs.values()) if (!tomadas.has(o.id) && Math.abs(o.d - D) < 0.9) { tomadas.add(o.id); anota('e', o.id); estrellas = Math.min(M.MAX_ESTRELLAS, estrellas + 1); if (o.secreta) secretas++; }
    if (t >= sig) { anota('w'); sig = t + MP.PASO_MUESTRA; }
  }
  anota('m'); anota('f');
  return { prueba: MP.cierra(pr, { sn: 0 }), puntos: Math.floor(puntos), metros: Math.floor(D), secretas };
}

test('la prueba de City se rehace: estrellas secretas, túneles, postales y la curva de City', () => {
  for (const modo of ['city', 'citypuro']) {
    const r = carrera(modo, 55555, 200);
    assert.ok(r.secretas >= 2, modo + ': tomó estrellas secretas (' + r.secretas + ')');
    assert.ok(r.prueba.i.some(q => q[0] === 'T') && r.prueba.i.some(q => q[0] === 'B'), modo + ': pidió túneles y postales');
    const re = MP.rehace(r.prueba);
    assert.equal(re.motivo, undefined, modo + ': ' + re.motivo);
    assert.equal(re.modo, modo); assert.ok(Math.abs(re.puntos - r.puntos) <= 1, `${modo}: ${re.puntos} / ${r.puntos}`); assert.equal(re.metros, r.metros);
    // una estrella secreta movida de lugar (que no está donde se dice) se rechaza
    const p = JSON.parse(JSON.stringify(r.prueba)), i = p.e.findIndex(e => e[0] === 'e');
    p.e[i][2] += 300; assert.ok(MP.rehace(p).motivo, modo + ': una estrella fuera de lugar se rechaza');
    // la misma carrera leída con la curva clásica no cuadra (los metros y el reloj delatan)
    const q = JSON.parse(JSON.stringify(r.prueba)); delete q.m; assert.ok(MP.rehace(q).motivo, modo + ': con la curva clásica no cuadra');
  }
});

/* ---------- el juego ---------- */

test('el juego engancha City en pocos lugares, y todo lo que choca o se recoge se ve', () => {
  const juego = lee('juego.js'), ciudad = lee('ciudad.js'), mundo = lee('mundo.js'), dibujo = lee('mundo-city.js'), html = lee('index.html');
  // el chicle no entra en la lista de poderes (el marcador le pediría su duración a la tienda)
  assert.match(ciudad, /c\.ciudad\.chicle = 20/); assert.doesNotMatch(ciudad, /c\.poderes\.chicle/);
  // los ganchos de juego.js (pocos, marcados CITY)
  for (const re of [/ciudad\.pisa\(c, o, mundo\)/, /ciudad\.salva\(c, mundo\)/, /ciudad\.poder\(c, clase, mundo\)/, /ciudad\.fisica\(c, sop, dt, mundo, tiempoTotal\)/,
    /ciudad\.faltaPostal\(c, progreso, cb\.estacion\.boleto\)/, /ciudad\.libreta\(modoSel, progreso, \$, fmt\)/, /ciudad\.idsTienda\(modoSel\)/, /Object\.assign\(MOTIVOS, ciudad\.MOTIVOS\)/])
    assert.match(juego, re);
  // los objetos de City se dibujan (con el «!» de lo que se esquiva o se recoge)
  for (const f of ['cajonCity', 'dronCity', 'barandaCity', 'lonaCity', 'vaporCity', 'estrellaSecreta', 'chicle']) assert.match(dibujo, new RegExp(`\\n  ${f}\\(\\) \\{`), f);
  const obj = dibujo.slice(dibujo.indexOf('\n  cajonCity() {'), dibujo.indexOf('\n  pasosCity(pre) {'));
  for (const m of obj.matchAll(/'((?:pintura|plano|luz|metal|personaje|tex:[\w|]+|texluz:[\w|]+))(!?)'/g)) assert.equal(m[2], '!', 'material de juego sin «!»: ' + m[1]);
  assert.match(mundo, /export const GANCHOS/); assert.match(mundo, /GANCHOS\.objeto \? GANCHOS\.objeto\(kit, o\)/);
  // se cargan antes (el motor con City, y los módulos del dibujo y de la carrera)
  assert.ok(html.indexOf('city.js?v=') < html.indexOf('motor.js?v='), 'city.js antes de motor.js');
  assert.match(juego, /import '\.\/mundo-city\.js\?v=metrorush-\d+'/); assert.match(juego, /from '\.\/ciudad\.js\?v=metrorush-\d+'/);
});
