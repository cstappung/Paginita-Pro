#!/usr/bin/env node
/* PRO DEFENDER — rehace la partida de alguien y la cuenta ronda a ronda.

   Las partidas que baten un récord quedan en Firebase (Realtime Database) como
   su prueba: `soloPruebas/club-prodefender-<reino>/<uid>/<partida>` =
   {v, d, at}, donde `d` es la prueba en texto JSON ({v, ve, u, r, s, j, k}:
   la semilla y cada jugada con su paso, prueba.js). Desde octubre de 2026 la
   página la guarda compacta (v: 2, las jugadas en un texto:
   src/juegos/solo/verifica/prodefender.js); aquí se expande a la v: 1. Hay
   una sola por cuenta y reino: la de su récord vigente. La `partida` del récord
   vigente es la que dice la fila `soloRanks/club-prodefender-<reino>/<uid>`.
   En la consola: Realtime Database → soloPruebas → club-prodefender-… → el
   uid → la partida → ⋮ → Exportar JSON.

   Acepta ese nodo ({v, d, at}), la prueba sola, o una exportación más grande
   (de `soloPruebas` o de la raíz: rehace todas las de PRO DEFENDER que haya,
   o solo las de --uid).

   Uso:  node scripts/prodefender-analiza.cjs prueba.json [--uid UID] [--json] [--motor DIR]

   --motor DIR   el juego de otra carpeta. Una prueba solo se rehace con el
                 motor de su versión (`ve`): si es de una anterior, saca esa
                 versión con `git archive <commit> juegos/club/prodefender/js | tar -x -C /tmp/pd`
                 y pasa --motor /tmp/pd/juegos/club/prodefender/js.

   Lo que cuenta por ronda: vidas, oro al empezar, vidas perdidas (y qué
   enemigos se escaparon), el punto más lejano del camino al que llegó
   alguien (%), cuánto duró, lo que hizo quien juega antes de empezarla
   (torres puestas, mejoras, ventas) y, cada 10 rondas, sus torres.

   No subas al repositorio una exportación: trae uids y nombres, y el repo
   es público. */
'use strict';
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const MOTOR = path.resolve(opt('motor') || path.join(__dirname, '../../juegos/club/prodefender/js'));
for (const f of ['data/enemies.js', 'data/towers.js', 'data/levels.js', 'engine.js', 'prueba.js']) require(path.join(MOTOR, f));
const PD = globalThis.PD, P = PD.Prueba;
// La prueba compacta (v: 2) que guarda la página → la v: 1 que rehace prueba.js.
const { expande } = (() => {
  const code = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/juegos/solo/verifica/prodefender.js')], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports;
})();

// ------------------------- buscar pruebas en el archivo -------------------------
function pruebasDe(raiz, soloUid) {
  const out = [];
  const comoPrueba = (x, donde) => {
    if (!x || typeof x !== 'object') return;
    const pon = p => { if (p && Array.isArray(p.j)) out.push({ donde, p }); else console.error('No se puede leer la prueba de ' + donde); };
    if (typeof x.d === 'string' && x.d) { try { pon(expande(JSON.parse(x.d))); } catch { pon(null); } return; }
    if ((Array.isArray(x.j) || typeof x.j === 'string') && x.s !== undefined) pon(expande(x));
  };
  comoPrueba(raiz, '(archivo)');
  if (out.length) return out;
  const sp = raiz.soloPruebas || raiz;
  for (const cat of Object.keys(sp)) {
    if (!/^club-prodefender-/.test(cat)) continue;
    for (const uid of Object.keys(sp[cat] || {})) {
      if (soloUid && uid !== soloUid) continue;
      for (const partida of Object.keys(sp[cat][uid] || {})) comoPrueba(sp[cat][uid][partida], `${cat}/${uid}/${partida}`);
    }
  }
  return out;
}

// ------------------------------- rehacer contando -------------------------------
// La misma regla de pasos que prueba.js (rehace): un paso del motor por jugada pendiente,
// QUIETO_MAX pasos como mucho entre rondas, recargas con la semilla de su tramo.
function analiza(p) {
  if (!(P.VERSIONES || [P.VERSION]).includes(p.ve)) throw new Error(`la prueba es de la versión ${p.ve} del motor y esta carpeta rehace las ${(P.VERSIONES || [P.VERSION]).join(', ')} (usa --motor con esa versión)`);
  const u = String(p.u), li = p.r;
  const quieto = g => g.over || (!g.active && g.enemies.length === 0);
  const st = { game: new PD.Game(li, null, P.semillaTramo(p.s, u, 0), p.ve), k: 0, q: 0, tramo: 0, pasos: 0 };
  const rondas = [];
  let cur = null, acciones = [], muestreo = 0;
  const empieza = g => {
    cur = { ronda: g.round + 1, vidas: g.lives, oro: Math.round(g.money), perdidas: 0, fugas: {}, avance: 0, pasos: 0, acciones, reintento: false };
    acciones = [];
  };
  const mira = () => {
    const g = st.game;
    for (const ev of g.events) {
      if (ev.type === 'leak' && cur) cur.perdidas += ev.amount;
    }
    g.events.length = 0;
    if (cur && g.active && ++muestreo % 10 === 0) for (const e of g.enemies) {
      const pr = e.dist / g.paths[e.path].len;
      if (pr > cur.avance) cur.avance = pr;
    }
    if (cur && g.active) cur.pasos++;
  };
  // lo que se escapa, por tipo: se mira antes de que leak() lo saque de la lista
  const vigila = g => {
    const leak = g.leak.bind(g);
    g.leak = e => { if (cur) cur.fugas[e.type] = (cur.fugas[e.type] || 0) + 1; leak(e); };
  };
  vigila(st.game);
  const cierra = (g, perdida) => {
    if (!cur) return;
    cur.perdida = perdida; cur.vidasFin = g.lives; cur.avance = Math.round(cur.avance * 100); cur.seg = Math.round(cur.pasos / 60);
    cur.torres = g.towers.map(t => t.type + ' ' + t.tiers.join('-'));
    rondas.push(cur); cur = null;
  };
  const paso = () => {
    const g = st.game;
    if (quieto(g)) { if (st.q >= P.QUIETO_MAX) throw new Error('la prueba espera más de lo que el juego deja entre rondas'); st.q++; }
    const activa = g.active;
    g.update(P.STEP); st.k++;
    if (!quieto(g)) st.q = 0;
    mira();
    if (activa && !g.active) cierra(g, false);
    else if (g.over && cur) cierra(g, true);
  };
  const nombre = id => (PD.TOWERS[id] ? PD.TOWERS[id].name : id);
  for (const j of p.j) {
    while (st.k < j[0]) paso();
    const g = st.game, c = j[1];
    const torre = id => g.towers.find(t => t.id === id);
    if (c === 0) { const type = PD.TOWER_ORDER[j[2]]; if (!g.place(type, j[3], j[4])) throw new Error('no se pudo colocar ' + type); acciones.push('+' + nombre(type)); }
    else if (c === 1) { const t = torre(j[2]); if (!t || !g.upgrade(t, j[3])) throw new Error('mejora imposible'); acciones.push('↑' + nombre(t.type) + ' ' + t.tiers.join('-')); }
    else if (c === 2) { const t = torre(j[2]); if (!t) throw new Error('venta imposible'); acciones.push('−' + nombre(t.type)); g.sell(t); }
    else if (c === 3) { const t = torre(j[2]); if (t) t.mode = P.MODOS[j[3]]; }
    else if (c === 4) { if (!g.startRound()) throw new Error('ronda imposible'); empieza(g); }
    else if (c === 6) { if (!g.placeSpikes(j[2], j[3])) throw new Error('pinchos imposibles'); acciones.push('pinchos'); }
    else if (c === 7) {   // tercera era: el pacto elegido entre los tres que se ofrecían
      const o = g.ofertasPacto();
      acciones.push('📜 ' + (j[2] < 3 && o[j[2]] ? o[j[2]].name : 'sin pacto') + ' (de ' + o.map(x => x.id).join(', ') + ')');
      if (!g.elegirPacto(j[2])) throw new Error('pacto imposible');
    }
    else if (c === 8) { if (!g.lanzarPoder(j[2], j[3])) throw new Error('el poder no estaba listo'); acciones.push('✨ Poder del Reino'); }
    else if (c === 5) {
      const snap = JSON.parse(JSON.stringify(g.snapshot()));
      snap.continues -= j[2];
      st.tramo++; st.pasos += st.k;
      st.game = new PD.Game(li, snap, P.semillaTramo(p.s, u, st.tramo), p.ve);
      vigila(st.game);
      st.k = 0; st.q = 0;
      acciones.push(j[2] ? '⟲ reintento' : '⟲ reanuda');
    }
    st.q = 0;
  }
  while (st.k < p.k) paso();
  const g = st.game;
  return { reino: PD.LEVELS[li].name, uid: u, ronda: g.round, tiempo: Math.round((st.pasos + st.k) * 1000 / 60), perdida: g.over, rondas };
}

function imprime(x) {
  console.log(`\n${x.reino} · ${x.uid} · llega a la ronda ${x.ronda}${x.perdida ? ' (y pierde la siguiente)' : ''} · ${Math.round(x.tiempo / 60000)} min de juego`);
  for (const r of x.rondas) {
    const fug = Object.entries(r.fugas).map(([k, n]) => `${PD.ENEMIES[k] ? PD.ENEMIES[k].name : k}×${n}`).join(', ');
    console.log(`  r${String(r.ronda).padStart(3)}${r.perdida ? ' ✗' : '  '}  vidas ${String(r.vidas).padStart(4)}→${String(r.vidasFin).padStart(4)}  oro ${String(r.oro).padStart(7)}  avance ${String(r.avance).padStart(3)}%  ${String(r.seg).padStart(3)} s` +
      (fug ? `  se escapan: ${fug}` : '') + (r.acciones.length ? `  | ${r.acciones.join(' · ')}` : ''));
    if (r.ronda % 10 === 0 || r.perdida) console.log(`        torres (${r.torres.length}): ${r.torres.join(', ')}`);
  }
}

function main() {
  const archivo = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--uid' && args[args.indexOf(a) - 1] !== '--motor');
  if (!archivo) { console.error('Uso: node scripts/prodefender-analiza.cjs prueba.json [--uid UID] [--json] [--motor DIR]'); process.exit(2); }
  const lista = pruebasDe(JSON.parse(fs.readFileSync(archivo, 'utf8')), opt('uid'));
  if (!lista.length) { console.error('No encontré pruebas de PRO DEFENDER en ' + archivo); process.exit(1); }
  const res = [];
  for (const { donde, p } of lista) {
    try { const x = analiza(p); x.donde = donde; res.push(x); if (!args.includes('--json')) imprime(x); }
    catch (e) { console.error(`${donde}: ${e.message}`); }
  }
  if (args.includes('--json')) console.log(JSON.stringify(res, null, 1));
}
if (require.main === module) main();
module.exports = { analiza, pruebasDe };
