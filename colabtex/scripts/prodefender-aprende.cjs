#!/usr/bin/env node
/* PRO DEFENDER — aprende de las partidas de las personas lo que usa el bot
   (`prodefender-bot.cjs --estrategia humana`).

   Lee una exportación de `soloPruebas` (la consola de Firebase: Realtime
   Database → soloPruebas → ⋮ → Exportar JSON; sirve también la de la raíz),
   rehace cada partida de PRO DEFENDER con el motor de esta carpeta y escribe
   `scripts/prodefender-libro.json`, que no lleva uids ni nombres (solo
   recuentos), así que sí se sube al repositorio:

   - `planes`: por torre, el orden en que las personas suben sus caminos
     (voto por paso, con los niveles finales más votados como tope).
   - `modos`: por torre, el objetivo que eligen cuando lo cambian.
   - `cuotas`: por reino (`L.slug`) y para todos (`*`), cada 5 rondas, cuántas
     torres de cada tipo tienen y cuántos niveles llevan en promedio
     (`[n, niveles por torre]`; los héroes van como `heroe`). Cada partida pesa
     según la ronda a la que llegó, y ganar vale el doble.
   - `orden`: por reino y para todos, en qué orden aparece cada tipo.

   Solo se rehacen las pruebas de la versión del motor de esta carpeta (`ve`);
   de las partidas de una misma persona y semilla se toma la más larga (cada
   récord guarda la partida hasta esa ronda).

   Uso:  node scripts/prodefender-aprende.cjs export.json [--salida archivo.json]

   No subas al repositorio la exportación: trae uids y nombres. */
'use strict';
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const MOTOR = path.join(__dirname, '../../juegos/club/prodefender/js');
for (const f of ['data/enemies.js', 'data/towers.js', 'data/levels.js', 'engine.js', 'prueba.js']) require(path.join(MOTOR, f));
const PD = globalThis.PD, P = PD.Prueba;
const { pruebasDe } = require('./prodefender-analiza.cjs');
const CADA = 5;

// La partida rehecha con la misma regla de pasos que prueba.js; por cada torre, su tipo,
// el orden de sus mejoras y su modo, y al final de cada ronda las torres que había.
function rehace(p) {
  if (p.ve !== P.VERSION) throw new Error('otra versión del motor');
  const u = String(p.u), li = p.r;
  const quieto = g => g.over || (!g.active && g.enemies.length === 0);
  let g = new PD.Game(li, null, P.semillaTramo(p.s, u, 0)), k = 0, q = 0, tramo = 0;
  let info = new Map();   // torre → {type, seq, modo}
  const todas = [], rondas = [];
  const paso = () => {
    if (quieto(g)) { if (q >= P.QUIETO_MAX) throw new Error('espera de más'); q++; }
    const activa = g.active;
    g.update(P.STEP); k++;
    if (!quieto(g)) q = 0;
    if (activa && !g.active || g.over && activa) rondas[g.round] = g.towers.map(t => ({ type: t.type, hero: !!t.def.hero, niv: t.tiers[0] + t.tiers[1] }));
  };
  for (const j of p.j) {
    while (k < j[0]) paso();
    const c = j[1], t = c >= 1 && c <= 3 ? g.towers.find(x => x.id === j[2]) : null;
    if (c === 0) {
      const t2 = g.place(PD.TOWER_ORDER[j[2]], j[3], j[4]);
      if (!t2) throw new Error('no se pudo colocar');
      const x = { type: t2.type, seq: [], modo: null, r: g.round + 1 };
      info.set(t2, x); todas.push(x);
    } else if (c === 1) { if (!t || !g.upgrade(t, j[3])) throw new Error('mejora imposible'); info.get(t).seq.push(j[3]); }
    else if (c === 2) { if (!t) throw new Error('venta imposible'); g.sell(t); }
    else if (c === 3) { if (t) { t.mode = P.MODOS[j[3]]; info.get(t).modo = t.mode; } }
    else if (c === 4) { if (!g.startRound()) throw new Error('ronda imposible'); }
    else if (c === 5) {
      const viejas = g.towers.slice();
      const snap = JSON.parse(JSON.stringify(g.snapshot()));
      snap.continues -= j[2];
      tramo++;
      g = new PD.Game(li, snap, P.semillaTramo(p.s, u, tramo));
      const m = new Map();
      g.towers.forEach((t2, i) => m.set(t2, info.get(viejas[i])));
      info = m; k = 0; q = 0;
    }
    q = 0;
  }
  while (k < p.k) paso();
  return { li, ronda: g.round, gano: !!g.won, todas, rondas };
}

// el plan de una torre: los niveles finales más votados y, paso a paso, el camino más votado
function plan(seqs, hero) {
  const fin = {};
  for (const s of seqs) if (s.length >= (hero ? 6 : 4)) { const n = [0, 0]; s.forEach(x => n[x]++); const key = n.join('-'); fin[key] = (fin[key] || 0) + 1; }
  const top = Object.entries(fin).sort((a, b) => b[1] - a[1])[0];
  const tope = top ? top[0].split('-').map(Number) : hero ? [5, 4] : [4, 2];
  const out = [], n = [0, 0];
  for (let i = 0; i < tope[0] + tope[1]; i++) {
    const v = [0, 0];
    for (const s of seqs) if (s.length > i) v[s[i]]++;
    let x = v[1] > v[0] ? 1 : 0;
    if (n[x] >= tope[x]) x = 1 - x;
    out.push(x); n[x]++;
  }
  return out;
}

function main() {
  const archivo = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--salida');
  if (!archivo) { console.error('Uso: node scripts/prodefender-aprende.cjs export.json [--salida archivo.json]'); process.exit(2); }
  // la más larga de cada partida (misma persona, mismo reino, misma semilla)
  const mejor = new Map();
  for (const { p } of pruebasDe(JSON.parse(fs.readFileSync(archivo, 'utf8')))) {
    if (!p || p.ve !== P.VERSION) continue;
    const key = p.u + '|' + p.r + '|' + p.s;
    const prev = mejor.get(key);
    if (!prev || p.j.length > prev.j.length) mejor.set(key, p);
  }
  const partidas = [];
  for (const p of mejor.values()) {
    try { partidas.push(rehace(p)); } catch (e) { /* de un motor con la misma versión pero otro balance: no se rehace */ }
  }
  if (!partidas.length) { console.error('No hay partidas de la versión ' + P.VERSION + ' que se puedan rehacer.'); process.exit(1); }

  const seqs = {}, modos = {}, cuotas = {}, orden = {};
  const suma = (slug, r, tipo, w, n, niv) => {
    const c = (cuotas[slug] = cuotas[slug] || {}), fila = (c[r] = c[r] || { w: 0, t: {} }), x = (fila.t[tipo] = fila.t[tipo] || [0, 0]);
    x[0] += w * n; x[1] += w * niv;
  };
  const pesos = (slug, r, w) => { const c = (cuotas[slug] = cuotas[slug] || {}); (c[r] = c[r] || { w: 0, t: {} }).w += w; };
  for (const x of partidas) {
    const slug = PD.LEVELS[x.li].slug, w = x.ronda / 100 * (x.gano ? 2 : 1);
    for (const t of x.todas) {
      const tipo = PD.TOWERS[t.type].hero ? 'heroe' : t.type;
      if (t.seq.length) (seqs[tipo] = seqs[tipo] || []).push(t.seq);
      if (t.modo) { const m = (modos[t.type] = modos[t.type] || {}); m[t.modo] = (m[t.modo] || 0) + 1; }
      for (const s of [slug, '*']) { const o = (orden[s] = orden[s] || {}); if (!o[tipo]) o[tipo] = []; o[tipo].push(t.r); }
    }
    for (let r = CADA; r <= 100; r += CADA) {
      const tor = x.rondas[r];
      if (!tor) continue;
      for (const s of [slug, '*']) {
        pesos(s, r, w);
        const por = {};
        for (const t of tor) { const tipo = t.hero ? 'heroe' : t.type; (por[tipo] = por[tipo] || [0, 0]); por[tipo][0]++; por[tipo][1] += t.niv; }
        for (const [tipo, [n, niv]] of Object.entries(por)) suma(s, r, tipo, w, n, niv);
      }
    }
  }
  const libro = { version: P.VERSION, partidas: partidas.length, ganadas: partidas.filter(x => x.gano).length, planes: {}, modos: {}, cuotas: {}, orden: {} };
  for (const [tipo, l] of Object.entries(seqs)) if (l.length >= 2) libro.planes[tipo] = plan(l, tipo === 'heroe');
  for (const [tipo, m] of Object.entries(modos)) libro.modos[tipo] = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
  for (const [slug, c] of Object.entries(cuotas)) {
    libro.cuotas[slug] = {};
    for (const [r, fila] of Object.entries(c)) {
      const o = (libro.cuotas[slug][r] = {});
      for (const [tipo, [n, niv]] of Object.entries(fila.t)) o[tipo] = [+(n / fila.w).toFixed(2), +(niv / Math.max(1e-9, n)).toFixed(2)];
    }
  }
  // orden: el tipo que aparece antes (mediana de la ronda en que se pone el primero de cada partida)
  for (const [slug, o] of Object.entries(orden)) {
    libro.orden[slug] = Object.entries(o).map(([tipo, rs]) => [tipo, rs.sort((a, b) => a - b)[Math.floor(rs.length / 2)], rs.length])
      .sort((a, b) => a[1] - b[1] || b[2] - a[2]).map(x => x[0]);
  }
  const salida = opt('salida') || path.join(__dirname, 'prodefender-libro.json');
  fs.writeFileSync(salida, JSON.stringify(libro, null, 1) + '\n');
  const porReino = {};
  for (const x of partidas) { const s = PD.LEVELS[x.li].short; porReino[s] = (porReino[s] || 0) + 1; }
  console.log(`${partidas.length} partidas (${libro.ganadas} ganadas): ${Object.entries(porReino).map(e => e.join(' ')).join(', ')} → ${salida}`);
}
if (require.main === module) main();
