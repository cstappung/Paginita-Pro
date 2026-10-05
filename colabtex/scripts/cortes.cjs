#!/usr/bin/env node
/* Propone los cortes de las cuentas paradas (juegos/cortes.js,
   docs/antitrampas.md) y cuenta qué pierde cada una.

   Uso:  node scripts/cortes.cjs export.json [--hasta AAAA-MM-DD] [--escribe]

   `export.json` es la exportación de la raíz de la base (o de los nodos que
   lee la economía). Para cada cuenta parada, `tope` es lo que gana hoy y
   `hasta` el final del día dado en Chile (por omisión, mañana): cubre lo que
   compre hasta que se publique el cambio. Con --escribe lo agrega a
   cortes.js (sin tocar los cortes que ya estaban). La exportación no se
   sube al repo. */
'use strict';
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const ARCHIVO = path.join(__dirname, '../src/juegos/cortes.js');
const code = esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/juegos/monedas.js')], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
const mod = { exports: {} };
new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
const M = mod.exports;

const args = process.argv.slice(2), archivo = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--hasta');
if (!archivo) { console.error('Uso: node scripts/cortes.cjs export.json [--hasta AAAA-MM-DD] [--escribe]'); process.exit(2); }
const raiz = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const datos = extra => Object.assign({ ranks: raiz.ranks || {}, solo: raiz.soloRanks || {}, logros: raiz.logros || {}, diario: raiz.diario || {},
  cartas: raiz.cartas || {}, mercado: raiz.mercado || {}, clubJugadas: raiz.clubJugadas || {}, podios: raiz.podios || {},
  tienda: raiz.tienda || {}, completo: true }, extra);
const nombre = u => (((raiz.users || {})[u] || {}).perfil || {}).nick || '';

// Fin del día (Chile, UTC−3) de la fecha pedida; por omisión, mañana.
const dia = args.includes('--hasta') ? args[args.indexOf('--hasta') + 1] : new Date(Date.now() + 864e5 - 3 * 36e5).toISOString().slice(0, 10);
const hasta = Date.parse(dia + 'T23:59:59.999-03:00');
if (!Number.isFinite(hasta)) { console.error('Fecha inválida:', dia); process.exit(2); }

const ya = datos();
const antes = M.economia(ya);
const cortes = {};
for (const [u, x] of Object.entries(antes.usuarios)) if (x.parada) cortes[u] = { hasta, tope: M.monedasDe(u, ya).total };
if (!Object.keys(cortes).length) { console.log('Ninguna cuenta parada.'); process.exit(0); }
const previos = (() => { const c = esbuild.buildSync({ entryPoints: [ARCHIVO], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
  const m = { exports: {} }; new Function('module', 'exports', c)(m, m.exports); return m.exports.CORTES; })();
const conCortes = datos({ cortes: Object.assign({}, previos, cortes) });
const despues = M.economia(conCortes);
const porDueno = e => { const p = {}; for (const [c, u] of Object.entries(e.dueno)) (p[u] = p[u] || new Set()).add(c); return p; };
const ca = porDueno(antes), cd = porDueno(despues);
console.log(`Cortes hasta ${dia} (fin del día en Chile):\n`);
for (const u of new Set([...Object.keys(antes.usuarios), ...Object.keys(despues.usuarios)])) {
  const a = antes.usuarios[u] || {}, b = despues.usuarios[u] || {};
  const pierde = [...(ca[u] || [])].filter(c => !(cd[u] || new Set()).has(c)).length;
  const gana = [...(cd[u] || [])].filter(c => !(ca[u] || new Set()).has(c)).length;
  if (!cortes[u] && !pierde && !gana && a.gastadas === b.gastadas && a.cobradas === b.cobradas) continue;
  const m0 = M.monedasDe(u, ya), m1 = M.monedasDe(u, conCortes);
  console.log(`■ ${nombre(u) || '?'} (${u})${cortes[u] ? '' : ' — afectada sin corte'}`);
  console.log(`   antes: saldo ${m0.saldo}${m0.parada ? `, PARADA (faltan ${m0.falta})` : ''}  →  después: saldo ${m1.saldo}${m1.parada ? ', PARADA' : ''}`);
  console.log(`   cartas: pierde ${pierde}, recupera ${gana} · gastado ${a.gastadas || 0} → ${b.gastadas || 0} · cobrado ${a.cobradas || 0} → ${b.cobradas || 0}`);
}
if (args.includes('--escribe')) {
  const texto = fs.readFileSync(ARCHIVO, 'utf8');
  const nuevos = Object.entries(cortes).filter(([u]) => !texto.includes(JSON.stringify(u)));
  const lineas = nuevos.map(([u, k]) => `  ${JSON.stringify(u)}: { hasta: ${k.hasta}, tope: ${k.tope} }, // ${dia}`).join('\n');
  if (lineas) fs.writeFileSync(ARCHIVO, texto.replace(/\n\};\s*$/, '\n' + lineas + '\n};\n'));
  console.log(`\n${nuevos.length} cortes nuevos escritos en ${path.relative(process.cwd(), ARCHIVO)}.`);
}
