// Deja el emulador como para grabar el tráiler: la cuenta de GUGU GAGA (sub "gugu"), monedas, la tabla de
// Tetris Club con Emma, Santi y Jesús, Michi (gato naranjo atigrado, adulto) con dos regalos legendarios
// (Sombrero arcano y Zapatillas cometa) y un god pack de Componentes con legendaria sin abrir.
// Las claves y horas de la adopción, los regalos y el sobre se buscan para ESTE uid (cada emulador da otro).
// uso: node semilla.cjs   (con el emulador corriendo: firebase emulators:start --only auth,database)
const path = require('path');
const db = require('./db.cjs');
const R = path.resolve(__dirname, '../..');
const MM = require(R + '/juegos/mascotas/motor.js'), PM = require(R + '/juegos/prodrop/motor.js');

async function uidDe(sub, nombre) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postBody: 'id_token=' + JSON.stringify({ sub, email: sub + '@trailer.test', email_verified: true, name: nombre }) + '&providerId=google.com', requestUri: 'http://localhost', returnSecureToken: true }) });
  const j = await r.json(); if (!j.localId) throw new Error('auth: ' + JSON.stringify(j)); return j.localId;
}
function pelaje(r) { const o = r(); return { brown: r() < 0.78 ? r() * 0.15 : 0.3 + r() * 0.7, dilute: r() < 0.7 ? r() * 0.25 : 0.5 + r() * 0.5,
  orange: o < 0.5 ? 0 : o < 0.72 ? 0.25 + ((o - 0.5) / 0.22) * 0.5 : 0.85 + r() * 0.15, tabby: r() < 0.5 ? 0.55 + r() * 0.45 : r() * 0.25,
  stripe: r(), white: r() < 0.45 ? 0 : r() ** 1.3, point: r() < 0.12 ? 0.6 + r() * 0.4 : 0, eye: r() }; }   // = randomCoat de game/look.ts

(async () => {
  const uid = await uidDe('gugu', 'GUGU GAGA'), base = Date.now() - 3600e3;
  console.log('uid de GUGU GAGA:', uid);
  await db.put(`ajustesMonedas/${uid}/trailer`, { n: 50000, m: 'tráiler', por: 'admin', at: Date.now() });
  const tabla = { emma7: ['Emma', '#e8467c', 8110], santi9: ['Santi', '#3f8cff', 7055], jesus3: ['Jesús', '#22b07d', 6488], cami2: ['Cami', '#ffb020', 4217], vale4: ['Vale', '#9b59ff', 3568], tomi5: ['Tomi', '#ff7a2f', 2514] };
  for (const [u, [n, c, p]] of Object.entries(tabla)) {
    await db.put(`users/${u}/perfil`, { nombre: n, color: c });
    await db.put(`soloRanks/club-tetris-maraton/${u}`, { nombre: n, puntos: p, tiempo: 300000, partida: 'p' + u });
  }
  // Michi: naranjo intenso, atigrado, sin blanco ni siamés, ojos verdes
  let gato = null;
  for (let i = 0; i < 400000 && !gato; i++) { const k = '-Trailer' + i.toString(36), at = base + i, c = pelaje(MM.generador(MM.semillaGenes(uid, k, at)).real);
    if (c.orange > 0.95 && c.dilute < 0.1 && c.white === 0 && c.point === 0 && c.tabby > 0.8 && c.eye > 0.8) gato = { k, at }; }
  await db.put(`mascotas/a/${uid}`, { [gato.k]: { at: gato.at, e: 'cat', p: 0 } });
  await db.put(`mascotasEstado/${uid}`, { [uid + '~' + gato.k]: { v: 1, n: 'Michi', e: 'adult', g: 0.5, ls: Date.now(), s: { energy: 100, happiness: 96, hunger: 100, hygiene: 100 } } });
  const quiero = ['arcane', 'comet'], reg = {};
  for (let i = 0; i < 5e6 && Object.keys(reg).length < 2; i++) { const k = '-Regalo' + i.toString(36), at = base + 5000 + i, g = MM.regalo(uid, k, at); if (quiero.includes(g.id) && !reg[g.id]) reg[g.id] = { k, at }; }
  await db.put(`mascotas/r/${uid}`, Object.fromEntries(Object.values(reg).map(r => [r.k, { at: r.at, p: 500 }])));
  // god pack de Componentes con una legendaria (quemado o navidad)
  let sobre = null;
  for (let i = 0; i < 2e6 && !sobre; i++) { const k = 'c-Trailer' + i.toString(36), at = base + 9000 + i, s = PM.sobre(uid, k, at); if (!s.dios) continue;
    const leg = s.cartas.map(c => PM.CARDS[c.id]).filter(c => c.tier === 3); if (leg.length) sobre = { k, at }; }
  await db.put(`cartas/s/${uid}/${sobre.k}`, { at: sobre.at, p: 80 });
  console.log(JSON.stringify({ uid, michi: gato, regalos: reg, sobre }));
  console.log('Pon este uid y la clave del sobre en escenas.cjs (escena «sobre») y en uno-sala.cjs (JUGADORES[0]).');
})().catch(e => { console.error(e); process.exit(1); });
