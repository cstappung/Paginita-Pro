/* Copia a functions/juego/ lo que el servidor de Pro Kingdoms necesita del juego, porque `firebase
   deploy` solo sube esta carpeta. La fuente de verdad sigue siendo juegos/prokingdoms/ (el mismo
   server/sim.js que corre `node server.js` en local, y los js/ que comparte con el navegador para
   generar el mismo mapa). store.js se reemplaza por la versión con la RTDB (store-rtdb.js).
   Lo corre solo el predeploy de firebase.json; para el emulador, `npm run prepara`. */
'use strict';
const fs = require('fs');
const path = require('path');

const JUEGO = path.join(__dirname, '..', 'juegos', 'prokingdoms');
const DESTINO = path.join(__dirname, 'juego');
fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(path.join(DESTINO, 'js'), { recursive: true });
fs.mkdirSync(path.join(DESTINO, 'server'), { recursive: true });
for (const f of ['js/util.js', 'js/data.js', 'js/pase.js', 'js/world.js', 'server/sim.js']) fs.copyFileSync(path.join(JUEGO, f), path.join(DESTINO, f));
fs.copyFileSync(path.join(__dirname, 'store-rtdb.js'), path.join(DESTINO, 'server', 'store.js'));
console.log('prepara: juego copiado a functions/juego/');
