// Agrega a GUGU GAGA un pollito bebé amarillo («Pío»). Se corre después de semilla.cjs.
const path = require('path'), fs = require('fs');
const db = require('./db.cjs');
const R = process.env.REPO || path.resolve(__dirname, '../..');
const MM = require(R + '/juegos/mascotas/motor.js');
const look = r => { const mel = r(), pig = 1 - r() ** 2, blue = r() < 0.15 ? 0.45 + r() * 0.55 : 0; return { mel, pig, blue }; };   // = randomLook de game/look.ts
(async () => {
  const sem = JSON.parse(fs.readFileSync(__dirname + '/semilla.json', 'utf8')), uid = sem.uid, base = Date.now() - 1800e3;
  let pollo = null;
  for (let i = 0; i < 200000 && !pollo; i++) { const k = '-Pollito' + i.toString(36), at = base + i, g = look(MM.generador(MM.semillaGenes(uid, k, at)).real);
    if (g.mel < 0.12 && g.blue === 0 && g.pig > 0.6) pollo = { k, at }; }
  await db.patch(`mascotas/a/${uid}`, { [pollo.k]: { at: pollo.at, e: 'chicken', p: 1000 } });
  await db.patch(`mascotasEstado/${uid}`, { [uid + '~' + pollo.k]: { v: 1, n: 'Pío', e: 'baby', g: 0.4, ls: Date.now(), s: { energy: 100, happiness: 92, hunger: 100, hygiene: 100 } } });
  sem.pollito = pollo; fs.writeFileSync(__dirname + '/semilla.json', JSON.stringify(sem, null, 1));
  console.log('pollito', JSON.stringify(pollo));
})().catch(e => { console.error(e); process.exit(1); });
