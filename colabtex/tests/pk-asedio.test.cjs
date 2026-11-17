/* Pro Kingdoms, plan de guerra (juegos/prokingdoms/PLAN-GUERRA.md, G1 y G2): el asedio por etapas.
   El plan de batalla (D.asedioPlan, js/data.js) es la verdad de la conquista y lo usará también el servidor: aquí se
   comprueba que la probabilidad de ganar según la proporción de fuerzas es la de antes de pk-55 (la tabla de la
   sección 1 del plan es el contrato de balance), que el estado en el tiempo es continuo y termina donde dice el plan,
   y que el dibujo (js/frente.js) no decide nada. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const PKDIR = path.join(__dirname, '..', '..', 'juegos', 'prokingdoms');
const JS = f => fs.readFileSync(path.join(PKDIR, 'js', f), 'utf8');
const win = {}, ctx = vm.createContext({ window: win, console, URLSearchParams, location: { search: '' } });
for (const f of ['util.js', 'data.js']) vm.runInContext(JS(f), ctx, { filename: f });
const { D } = win.PK;

// una parcela de frontera corriente (Era III, una torre cerca, algo de ejército, murallas y dos parcelas vecinas)
const PARTES = D.parcelDefenseParts({ era: 3, px: 5, py: 5, towers: [[44, 44, 120]], army: 300, walls: 1, around: 2 });
const SIN_MUROS = D.parcelDefenseParts({ era: 3, px: 5, py: 5, towers: [], army: 200, walls: 0, around: 1 });
const plan = (r, semilla, parts) => D.asedioPlan({ atk: (parts || PARTES).total * r, parts: parts || PARTES, semilla });

test('la probabilidad de ganar según la proporción de fuerzas es la de antes (contrato de PLAN-GUERRA.md §1)', () => {
  const ANTES = { 0.8: 3, 0.9: 21, 1: 50, 1.1: 77, 1.2: 92, 1.3: 99 }, N = 20000;
  for (const r of Object.keys(ANTES)) {
    let g = 0;
    for (let i = 0; i < N; i++) if (plan(+r, i * 7919 + 13).gano) g++;
    const pct = (100 * g) / N;
    assert.ok(Math.abs(pct - ANTES[r]) <= 3, 'con ' + r + ' veces la defensa gana el ' + pct.toFixed(1) + ' % (antes ' + ANTES[r] + ' %)');
  }
});

test('la misma semilla da la misma batalla, y otra semilla da otra', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(plan(1.1, 42))), JSON.parse(JSON.stringify(plan(1.1, 42))));
  assert.notEqual(JSON.stringify(plan(1.1, 42)), JSON.stringify(plan(1.1, 43)));
});

test('las etapas suman la defensa, van en orden y el ataque se quiebra donde se le acaba el ímpetu', () => {
  for (let i = 1; i <= 400; i++) {
    const r = 0.6 + (i % 9) * 0.1, p = plan(r, i * 31, i % 3 ? PARTES : SIN_MUROS);
    assert.equal(p.gano, p.atk > p.def || (p.atk === p.def && p.gano), 'gana el que tiró más');
    assert.deepEqual(p.etapas.map(e => e.id), D.ASEDIO.etapas.slice(0, p.etapas.length));
    let t = 0;
    for (const e of p.etapas) { assert.equal(e.t0, t); assert.ok(e.dur >= D.ASEDIO.vacia); t += e.dur; }
    assert.equal(p.total, t);
    assert.ok(p.total <= 400, 'un asedio no dura más de unos minutos: ' + p.total);
    if (p.gano) {
      assert.equal(p.etapas.length, 3);
      assert.ok(Math.abs(p.gastado - p.def) < 2 && !p.etapas.some(e => e.rota));
      assert.ok(p.bajas >= 0.12 && p.bajas <= 0.3, 'bajas del que gana: ' + p.bajas);
    } else {
      assert.ok(p.etapas[p.etapas.length - 1].rota && p.gastado < p.def);
      assert.ok(p.bajas >= 0.7 && p.bajas <= 0.8, 'bajas del que pierde: ' + p.bajas);
    }
    // las partes a escala (el resumen de D.battleCause) suman la defensa tirada
    const suma = Object.keys(D.DEF_PARTS).reduce((s, k) => s + p.parts[k], 0);
    assert.ok(Math.abs(suma - p.def) <= 6, 'partes ' + suma + ' contra defensa ' + p.def);
  }
});

test('una parcela sin torres ni murallas pasa la etapa de defensas en segundos', () => {
  const p = plan(1.4, 5, SIN_MUROS), e = p.etapas.find(x => x.id === 'defensas');
  assert.ok(p.gano && e && e.dur === D.ASEDIO.vacia && e.r < 1);
});

test('el estado en el tiempo es continuo, no retrocede y termina donde dice el plan', () => {
  for (const [r, s] of [[1.3, 3], [1.02, 8], [0.95, 11], [0.7, 19]]) {
    const p = plan(r, s);
    let antes = D.asedioEn(p, 0);
    assert.equal(antes.etapa, 0); assert.equal(antes.control, 0); assert.equal(antes.impetu, 1); assert.equal(antes.resistencia, 1);
    for (let t = 0.5; t <= p.total; t += 0.5) {
      const e = D.asedioEn(p, t);
      for (const v of Object.values(e)) if (typeof v === 'number') assert.ok(Number.isFinite(v), 'NaN en t=' + t);
      assert.ok(e.etapa >= antes.etapa && e.control >= antes.control - 1e-9 && e.impetu <= antes.impetu + 1e-9 && e.resistencia <= antes.resistencia + 1e-9 && e.bajasA >= antes.bajasA - 1e-9);
      assert.ok(e.control - antes.control < 0.05, 'salto de avance en t=' + t);
      antes = e;
    }
    const fin = D.asedioEn(p, p.total + 100);
    assert.ok(fin.fin && Math.abs(fin.bajasA - p.bajas) < 1e-9);
    if (p.gano) { assert.ok(fin.resistencia < 0.001 && fin.impetu > 0 && fin.etapa === 2 && Math.abs(fin.f - 1) < 1e-9); }
    else assert.ok(fin.impetu < 0.01 && fin.resistencia > 0 && fin.f < 1);
  }
});

test('la repetición de una batalla que decidió el servidor respeta su resultado', () => {
  const parts = D.scaleParts(PARTES, 2300);
  const gana = D.asedioDe({ atk: 2100, def: 2300, parts, semilla: 9, gano: false });
  assert.ok(!gana.gano && gana.etapas[gana.etapas.length - 1].rota);
  const pierde = D.asedioDe({ atk: 2600, def: 2300, parts, semilla: 9, gano: true });
  assert.ok(pierde.gano && pierde.etapas.length === 3);
  assert.ok(D.asedioDe({ atk: 900, def: 800, parts: {}, semilla: 2 }).etapas.length === 3, 'un resumen viejo sin partes también se puede ver');
});

test('el dibujo no decide: frente.js no tira dados para el resultado ni toca el guardado', () => {
  const src = JS('frente.js').replace(/\/\/.*$/gm, ''); // sin los comentarios
  assert.ok(!/asedioPlan|conquestLoss|\.terr\.(camps|threats|battles)\b|st\.res\b|give\(|pay\(/.test(src), 'frente.js solo dibuja');
  assert.ok(/D\.asedioEn\(/.test(src), 'lee el estado del plan');
  const terr = JS('terr.js');
  assert.ok(!/U\.rand\(0\.85, 1\.15\)/.test(terr), 'la tirada de la campaña vive en el plan, con semilla');
  const html = fs.readFileSync(path.join(PKDIR, 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/troops.js') < html.indexOf('js/frente.js') && html.indexOf('js/frente.js') < html.indexOf('js/render.js'), 'frente.js va después de troops.js y antes de render.js');
});

// ---------- G3: asedios entre jugadores ----------
test('G3: lo que el servidor cuenta de un asedio no trae el final hasta la última etapa', () => {
  let parciales = 0;
  for (let i = 0; i < 400; i++) {
    const p = plan(0.8 + (i % 6) * 0.1, i * 31 + 5);
    for (let t = 0; t <= p.total; t += 7) {
      const v = D.asedioVista(p, t, 99);
      assert.ok(v.etapas.every(e => e.t0 <= t), 'solo etapas empezadas');
      assert.ok(v.semilla === 99 && v.semilla !== p.semilla, 'la semilla del dibujo no es la del plan');
      const e = D.asedioEn(v, t);
      assert.ok(e.impetu >= 0 && e.impetu <= 1 && e.bajasA >= 0 && e.bajasA <= 1 && !Number.isNaN(e.control), 'se puede dibujar');
      if (v.etapas.length < p.etapas.length) {
        parciales++;
        assert.ok(v.parcial && v.gano === undefined && v.ratio === undefined && v.atk === v.def, 'sin ganador ni fuerza real');
        assert.ok(!v.etapas.some(x => x.rota) && !e.fin, 'ninguna etapa a la vista dice cómo termina');
      } else assert.ok(!v.parcial && v.gano === p.gano && v.bajas === p.bajas && v.atk === p.atk);
    }
  }
  assert.ok(parciales > 1000);
});

test('G3: el servidor pelea el asedio con el mismo plan y el cliente no lo decide', () => {
  const sim = fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8');
  assert.ok(/D\.asedioPlan\(/.test(sim) && /D\.asedioVista\(/.test(sim), 'usa las funciones de data.js');
  assert.ok(!/rand\(0\.85, 1\.15\)[^\n]*c\.power/.test(sim), 'ya no hay una tirada al llegar');
  const terr = JS('terr.js');
  assert.ok(/c\.phase === 'asedio' && !c\.remote/.test(terr), 'una campaña contra un jugador la termina el servidor, no el reloj del navegador');
  const net = JS('net.js');
  assert.ok(/asv/.test(net) && /applyAsedios/.test(net), 'los asedios viajan con versión');
});

// ---------- G4: decisiones durante el asedio ----------
test('G4: una decisión no cambia lo ya peleado y el asedio sigue desde el mismo punto', () => {
  for (let i = 0; i < 300; i++) {
    const p = plan(0.85 + (i % 5) * 0.1, i * 53 + 3), t = Math.floor(p.total * (0.1 + 0.8 * ((i * 37) % 100) / 100));
    const antes = D.asedioEn(p, t);
    for (const ch of [{ tipo: 'tactica', tactica: 'asalto' }, { tipo: 'tactica', tactica: 'cerco' }, { tipo: 'refuerzo', atk: p.atk * 0.3 }, { tipo: 'salida' }]) {
      const n = D.asedioReplan(p, t, ch);
      if (!n) { assert.ok(ch.tipo === 'salida' && antes.etapa > 1, 'solo la salida tardía se rechaza'); continue; }
      const e = D.asedioEn(n, t);
      assert.ok(Math.abs(e.control * n.def - antes.control * p.def) < 1.5, 'la defensa vencida no salta (' + ch.tipo + ')');
      assert.equal(e.etapa, antes.etapa);
      assert.ok(Math.abs(e.f - antes.f) < 0.02, 'el avance de la etapa no salta');
      assert.ok(n.total > t && n.acc.length === 1 && n.etapas.every(x => x.dur >= 1));
      for (let s = 0; s < n.total; s += 3) { const x = D.asedioEn(n, s); assert.ok(x.impetu >= 0 && x.resistencia >= 0 && x.f >= 0 && x.f <= 1.0001 && !Number.isNaN(x.bajasA)); }
      const fin = D.asedioEn(n, n.total);
      if (n.gano) assert.ok(fin.resistencia < 0.002, 'si gana, la defensa se acaba'); else assert.ok(fin.impetu < 0.01, 'si pierde, se queda sin ímpetu');
    }
  }
});

test('G4: refuerzos, salida, tácticas, retirada y rendición hacen lo que dicen', () => {
  let vuelcos = 0, salvadas = 0;
  for (let i = 0; i < 400; i++) {
    const p = plan(0.9 + (i % 3) * 0.1, i * 71 + 9), t = Math.min(p.total - 2, 12);
    const ref = D.asedioReplan(p, t, { tipo: 'refuerzo', atk: p.def });
    assert.ok(ref.gano, 'doblar la fuerza a tiempo gana');
    if (!p.gano) vuelcos++;
    const sal = D.asedioReplan(p, t, { tipo: 'salida' });
    if (sal) { assert.ok(sal.def > p.def && (sal.gano ? p.gano : true), 'la salida solo ayuda al defensor'); if (p.gano && !sal.gano) salvadas++; }
    const asa = D.asedioReplan(p, t, { tipo: 'tactica', tactica: 'asalto' }), cer = D.asedioReplan(p, t, { tipo: 'tactica', tactica: 'cerco' });
    assert.ok(asa.total < p.total + 1 && cer.total > asa.total, 'el asalto acorta y el cerco alarga');
    assert.equal(asa.gano, p.gano, 'el asalto no cambia quién gana');
    if (asa.gano) assert.ok(asa.bajas > p.bajas && cer.bajas < asa.bajas);
    const ret = D.asedioReplan(p, t, { tipo: 'retirada' });
    assert.ok(!ret.gano && ret.fin === 'retirada' && ret.bajas >= 0.15 && ret.bajas <= 0.5 && ret.total <= t + 1, 'la retirada corta y cuesta entre 15 y 50 %');
    assert.ok(ret.bajas < D.conquestLoss(false, 1, 0), 'retirarse nunca deja peor que perder');
    const ren = D.asedioReplan(p, t, { tipo: 'rendir' });
    assert.ok(ren.gano && ren.bajas === 0 && ren.fin === 'rendir');
    assert.equal(D.asedioReplan(ret, t, { tipo: 'tactica', tactica: 'cerco' }), null, 'terminado, ya no se decide nada');
  }
  assert.ok(vuelcos > 50 && salvadas > 3, 'hay vuelcos de verdad (' + vuelcos + ', ' + salvadas + ')');
  assert.equal(D.asedioReplan({ v: 1, etapas: [], total: 100 }, 5, { tipo: 'retirada' }), null, 'un plan guardado antes de G4 no se toca');
});

test('G4: el oficio de las tropas y la táctica al lanzar', () => {
  assert.deepEqual(Array.from(D.asedioOficio({ militia: 100 })), [1, 1, 1], 'sin especialistas, todo como antes');
  const m = D.asedioOficio({ militia: 50, catapult: 20, knight: 20 });
  assert.ok(m[0] > 1 && m[1] > 1 && m[2] === 1);
  let conOficio = 0, sin = 0;
  for (let i = 0; i < 3000; i++) {
    const o = { atk: PARTES.total, parts: PARTES, semilla: i * 13 + 1 };
    if (D.asedioPlan(o).gano) sin++;
    if (D.asedioPlan(Object.assign({ units: { catapult: 30, knight: 30, spear: 60 } }, o)).gano) conOficio++;
  }
  assert.ok(conOficio > sin, 'una hueste de especialistas gana más (' + conOficio + ' contra ' + sin + ')');
  const a = D.asedioPlan({ atk: PARTES.total * 1.3, parts: PARTES, semilla: 5, tactica: 'asalto' }), n = D.asedioPlan({ atk: PARTES.total * 1.3, parts: PARTES, semilla: 5 });
  assert.ok(a.tac === 'asalto' && a.total < n.total && a.gano === n.gano);
});

test('G4: lo que viaja a los jugadores no trae con qué recalcular el plan', () => {
  const p = plan(1.1, 77), v = D.asedioVista(D.asedioReplan(p, 10, { tipo: 'tactica', tactica: 'cerco' }), 12, 5);
  for (const k of ['res', 'rb', 'atkR', 'm']) assert.equal(v[k], undefined, k + ' no viaja');
  assert.ok(v.acc.length === 1 && v.tac === 'cerco', 'sí viajan la táctica y las decisiones tomadas');
});

// ---------- G5: comarcas, Fuerte fronterizo y máquinas de asedio ----------
test('G5: las comarcas salen de la semilla del mundo, nunca en un corazón ni en zona común', () => {
  const w2 = {}, c2 = vm.createContext({ window: w2, console, URLSearchParams, location: { search: '' } });
  for (const f of ['util.js', 'data.js', 'world.js']) vm.runInContext(JS(f), c2, { filename: f });
  const W = w2.PK.World, D2 = w2.PK.D;
  if (W.generate && !W.terrCommon) W.generate();
  const N = W.PW * W.PW, cuenta = {};
  let n = 0;
  for (let k = 0; k < N; k++) {
    const c = W.rasgoDe(k);
    if (!c) continue;
    n++; cuenta[c] = (cuenta[c] || 0) + 1;
    assert.ok(D2.COMARCAS[c], 'rasgo conocido');
    assert.ok(!W.terrCommon[k] && !D2.REALM_SLOTS.some((s, i) => W.isCore(k, i)), 'ni zona común ni corazón de un reino');
  }
  assert.ok(n > N * 0.1 && n < N * 0.3, 'más o menos una de cada cuatro de las que pueden (' + n + ' de ' + N + ')');
  assert.equal(Object.keys(cuenta).length, Object.keys(D2.COMARCAS).length, 'hay de todos los rasgos');
  assert.equal(W.rasgoDe(5), W.rasgoDe(5));
});

test('G5: el Fuerte defiende a 2 parcelas y las torres como antes', () => {
  const base = { era: 3, px: 5, py: 5, army: 100, walls: 0, around: 0 }, cx = 5.5 * D.PARCEL, cy = 5.5 * D.PARCEL;
  const con = t => D.parcelDefenseParts(Object.assign({ towers: t }, base)).towers;
  assert.equal(con([[cx + 8, cy, 100]]), 100, 'torre cerca: entera');
  assert.equal(con([[cx + 12, cy, 100]]), 50, 'torre a media distancia: la mitad');
  assert.equal(con([[cx + 20, cy, 100]]), 0, 'torre lejos: nada');
  assert.equal(con([[cx + 15, cy, 100, D.FUERTE_RADIO]]), 100, 'Fuerte a casi 2 parcelas: entero');
  assert.equal(con([[cx + 28, cy, 100, D.FUERTE_RADIO]]), 50);
  assert.equal(con([[cx + 40, cy, 100, D.FUERTE_RADIO]]), 0);
  assert.ok(D.BUILD.fuerte && D.BSTATS.fuerte(1).defense > D.BSTATS.tower(1).defense * 3 && D.BUILD_ORDER.includes('fuerte'));
  assert.equal(D.BUILD.fuerte.max(3), 2);
});

test('G5: el ariete solo rinde con murallas y la torre de asedio ahorra tropas', () => {
  assert.ok(D.ARMY.ariete.maquina && D.ARMY.torreAsedio.maquina);
  const h = { militia: 100, ariete: 10 };
  assert.ok(D.asedioOficio(h, true)[1] > D.asedioOficio(h, false)[1] && D.asedioOficio(h, false)[1] === 1, 'sin murallas el ariete no suma');
  assert.ok(D.asedioOficio({ militia: 100, torreAsedio: 5 }, false)[1] > 1);
  const o = { atk: PARTES.total * 1.3, parts: PARTES, semilla: 21 };
  const sin = D.asedioPlan(Object.assign({ units: { militia: 200 } }, o)), con = D.asedioPlan(Object.assign({ units: { militia: 200, torreAsedio: 1 } }, o));
  assert.ok(con.torre && con.bajas < sin.bajas, 'con torre de asedio caen menos');
  assert.equal(D.PROTO, 11, 'tipos nuevos de edificio y de tropa: sube el protocolo');
});

// ---------- G6: fortalezas ----------
test('G6: las fortalezas salen del mapa y de la semilla, lejos de los reinos y sin pisar lugares', () => {
  const w2 = {}, c2 = vm.createContext({ window: w2, console, URLSearchParams, location: { search: '' }, performance: { now: () => 0 } });
  for (const f of ['util.js', 'data.js', 'world.js', 'fortalezas.js']) vm.runInContext(JS(f), c2, { filename: f });
  const W = w2.PK.World, D2 = w2.PK.D, F = w2.PK.Fort;
  if (W.generate && !W.terrCommon) W.generate(D2.SEED);
  const L = F.lista(), P = W.PW;
  assert.ok(L.length >= 5 && L.length <= D2.FORT.n, 'hay fortalezas (' + L.length + ')');
  for (const o of L) {
    assert.ok(!W.terrCommon[o.k], 'no en zona común');
    assert.ok(!D2.REALM_SLOTS.some((s, i) => { const h = W.homeParcel(i); return Math.max(Math.abs(o.k % P - h % P), Math.abs(Math.floor(o.k / P) - Math.floor(h / P))) <= D2.TERR.core + 2; }), 'lejos de todo reino');
    assert.equal(W.parcel(o.x + 1, o.y + 1), o.k, 'en su parcela');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) assert.ok(W.terrain[W.idx(o.x + i, o.y + j)] !== 4, 'en tierra firme');
    assert.ok(D2.ENEMY[o.enemigo] && D2.FORT.nombres.includes(o.nombre));
  }
  for (const a of L) for (const b of L) if (a !== b) assert.ok(Math.hypot(a.k % P - b.k % P, Math.floor(a.k / P) - Math.floor(b.k / P)) >= D2.FORT.separa, 'separadas');
  assert.ok(F.en(L[0].x + 1, L[0].y + 1) === L[0] && !F.en(0, 0));
  const p = F.partes(1575);
  assert.equal(p.era + p.towers + p.troops, p.total, 'las tres etapas suman la fuerza');
  assert.ok(D.asedioPlan({ atk: 3000, parts: p, semilla: 4 }).etapas.length === 3);
  assert.ok(D2.FORT.fuerza(2) > D2.FORT.fuerza(1) && D2.FORT.tributo(4, 2) > D2.FORT.tributo(4, 1));
});

// ---------- G7: la Ciudadela y los rankings de guerra ----------
test('G7: la Ciudadela está en una zona común, en tierra libre, y los rankings de guerra existen', () => {
  const w2 = {}, c2 = vm.createContext({ window: w2, console, URLSearchParams, location: { search: '' }, performance: { now: () => 0 } });
  for (const f of ['util.js', 'data.js', 'world.js', 'fortalezas.js']) vm.runInContext(JS(f), c2, { filename: f });
  const W = w2.PK.World, D2 = w2.PK.D, F = w2.PK.Fort;
  if (W.generate && !W.terrCommon) W.generate(D2.SEED);
  const z = F.ciudadela();
  assert.ok(z && W.terrCommon[z.k], 'en una zona común');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) assert.ok(W.terrain[W.idx(z.x + i, z.y + j)] !== 4);
  assert.ok(F.cerca(z.x, z.y, 1, 1) === z, 'no se construye pegado a ella');
  assert.ok(!F.lista().some(o => Math.abs(o.cx - z.cx) < 6 && Math.abs(o.cy - z.cy) < 6), 'no pisa una fortaleza');
  assert.ok(D2.RANKINGS.conquistas && D2.RANKINGS.fortalezas && D2.CIUDADELA.bono > 0);
  assert.deepEqual(F.colorGremio('g1'), F.colorGremio('g1'));
  const sim = fs.readFileSync(path.join(PKDIR, 'server', 'sim.js'), 'utf8');
  assert.ok(/'POST \/api\/ciudadela'/.test(fs.readFileSync(path.join(PKDIR, 'server', 'index.js'), 'utf8')) && /'POST \/api\/ciudadela'/.test(fs.readFileSync(path.join(PKDIR, '..', '..', 'functions', 'index.js'), 'utf8')), 'la ruta está en los dos servidores');
  assert.ok(/diario: !p\.mar && \+b\.dv2/.test(sim) && /D\.asedioVista\(plan, Infinity/.test(sim), 'el diario viaja con versión y sin las tiradas');
});

// ---------- G8: contenido de cierre ----------
test('G8: misiones, desafíos, retos y pase del asedio tienen quien los registre', () => {
  const w2 = {}, c2 = vm.createContext({ window: w2, console, URLSearchParams, location: { search: '' }, performance: { now: () => 0 } });
  for (const f of ['util.js', 'data.js', 'pase.js', 'datos-vida.js']) vm.runInContext(JS(f), c2, { filename: f });
  const D2 = w2.PK.D, todo = ['terr.js', 'fortalezas.js', 'consejo.js'].map(JS).join('\n');
  for (const id of ['w13', 'w14', 'w15', 'w16', 'w17', 'w18', 'w19']) assert.ok(D2.QUESTS.some(q => q.id === id), id);
  for (const k of ['asedios_ganados', 'ariete_defensas', 'retirada_a_tiempo', 'salida_resiste', 'comarcas', 'fortaleza_semana', 'repeticiones', 'fortalezas_def'])
    assert.ok(new RegExp("stat\\('" + k + "'").test(todo), k + ' se registra');
  assert.ok(D2.DESAFIOS.some(d => d.id === 'asedio_limpio') && D2.DESAFIOS.some(d => d.id === 'dos_defensas'));
  assert.ok(D2.RETOS.some(r => r.k === 'asedios_ganados'));
  assert.ok(D2.PASE_ACT.asedios_ganados && D2.PASE_STATS.includes('fortalezas'), 'el pase los cuenta (y el servidor los acota)');
  assert.ok(/Vida\.evento\('asedio'/.test(todo) && /Vida\.evento\('defensa'/.test(todo));
  // el Mariscal solo mira lo que se ve: nunca el final del plan
  const m = /G8 \(pk-65\): la guerra[\s\S]*?\/\/ una salida por pasada/.exec(JS('consejo.js'))[0];
  assert.ok(!/plan\.gano|\.bajas/.test(m) && /impetu/.test(m), 'la retirada del Mariscal no lee quién gana');
});

// ---------- pk-67: traslado entre bodegas ----------
test('pk-67: el traslado entre bodegas existe en la logística, el armador y el cálculo sin conexión', () => {
  const lg = JS('logistics.js'), ui = JS(path.join('ui', 'reino.js'));
  assert.ok(/L\.esTraslado = /.test(lg) && /function cargarTraslado/.test(lg) && /function otraBodega/.test(lg));
  assert.ok(/L\.esTraslado\(r\) \? queTraslado\(/.test(lg), 'sin conexión también');
  assert.ok(/L\.crearRuta = function \(de, a, res, tipo, lista\)/.test(lg) && /trasladoMalo\(r\)/.test(lg));
  assert.ok(/UI\.materialesTraslado = /.test(ui) && /¿Qué materiales pasa\?/.test(ui));
});
