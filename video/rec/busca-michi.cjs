// Busca clave y hora de adopción para un gato naranjo atigrado, y regalos con gorro y zapatillas legendarios
const M = require(require('path').resolve(__dirname, '../..') + '/juegos/mascotas/motor.js');
const uid = process.argv[2], base = Date.now() - 3600e3;
function coat(r) { const o = r(); return { brown: r() < 0.78 ? r() * 0.15 : 0.3 + r() * 0.7, dilute: r() < 0.7 ? r() * 0.25 : 0.5 + r() * 0.5,
  orange: o < 0.5 ? 0 : o < 0.72 ? 0.25 + ((o - 0.5) / 0.22) * 0.5 : 0.85 + r() * 0.15, tabby: r() < 0.5 ? 0.55 + r() * 0.45 : r() * 0.25,
  stripe: r(), white: r() < 0.45 ? 0 : r() ** 1.3, point: r() < 0.12 ? 0.6 + r() * 0.4 : 0, eye: r(), seed: Math.floor(r() * 1e6) }; }
let gato = null;
for (let i = 0; i < 200000 && !gato; i++) {
  const k = '-Trailer' + i.toString(36), at = base + i;
  const c = coat(M.generador(M.semillaGenes(uid, k, at)).real);
  if (c.orange > 0.95 && c.dilute < 0.1 && c.white === 0 && c.point === 0 && c.tabby > 0.8 && c.stripe > 0.35 && c.stripe < 0.65 && c.eye > 0.8) gato = { k, at, c };
}
console.log('GATO', JSON.stringify(gato));
const quiero = (process.argv[3] || 'arcane,winged').split(','); const reg = {};
for (let i = 0; i < 3000000 && Object.keys(reg).length < quiero.length; i++) {
  const k = '-Regalo' + i.toString(36), at = base + 5000 + i, g = M.regalo(uid, k, at);
  if (quiero.includes(g.id) && !reg[g.id]) reg[g.id] = { k, at, g };
}
console.log('REGALOS', JSON.stringify(reg));
