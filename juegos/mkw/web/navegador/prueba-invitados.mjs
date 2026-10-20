// Prueba con el juego: los 6 Mii invitados en «Mi Mii», con las imágenes del juego, y la licencia que usa el elegido
// — bitácora §86.
//
// Resumen: abre el juego en Chrome con Playwright, con un navegador VACÍO (sin partidas ni caras guardadas):
//   1. Primera visita (mkwDirecto.ir(0x48): el juego abre directo «Un jugador» y crea la licencia 1 con un Mii de la
//      página, porque todavía no hay invitados). En su primer menú el juego dibuja los 6 invitados y la página se los
//      lleva (invitados_nativo.cpp + invitados.mjs). Comprueba: 6 Mii de 74 bytes iguales a la tabla de la librería
//      de caras en la memoria del juego (0x8024C4D0), 6 imágenes con tinta y distintas entre sí, guardadas en IndexedDB,
//      y que el Mii de la licencia nueva tomó la cara del invitado A (mismo id).
//   2. «Mi Mii»: la galería muestra los 6 con su imagen; «Cambiar por un Mii invitado» → el D → Guardar.
//   3. Recarga: el juego arranca con esa base de Mii y carga el Mii de la licencia (SectionParams +0x238, el grupo del
//      jugador): tiene los rasgos del invitado D y el id de la licencia. Es la prueba de que EL JUEGO lo usa.
//   4. Partida nueva con el invitado F elegido: prepararMii pone el F para la licencia nueva y el juego lo carga.
// Las caras y una foto de la galería quedan en build/web/datos/invitados/ (imágenes del juego: nunca a git).
// Antes de correrla, avisar a las otras sesiones que comparten la PC (una pestaña con el juego, ~3 min).
//
// Uso:  node web/navegador/prueba-invitados.mjs [--puerto 8158] [--ventana]      (MKW_BUILD=… para otro build)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8158));
const carpeta = path.join(raiz, 'build/web/datos/invitados');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const p = await navegador.newPage({ viewport: { width: 1100, height: 800 } });
const notas = [];
p.on('console', m => { const t = m.text(); if (/invitad|directo:|\[mii\]/.test(t)) { notas.push(t); console.log('  ' + t); } });
p.on('pageerror', e => console.log('[pageerror] ' + e.message));
const URL0 = `http://127.0.0.1:${PUERTO}/`;

// El Mii que el juego cargó para el jugador 1: SectionParams (SectionMgr +0x98) +0x238 = MiiGroup del jugador; su
// Mii 0 (+0x4 → [0]). Lo que el juego sacó de la base de Mii al cargarlo está en +0x68, RFL::AdditionalInfo (Mii.hpp y
// RFLTypes.hpp de Pulsar): el nombre (+0x0, UTF-16), el CreateID (+0x2C) y, en +0x34, chico/chica (bit 31), color
// favorito (bits 18-21), altura (10-16) y complexión (3-9). (+0x10, los 74 bytes crudos, el juego solo los llena
// para un Mii que viene de un archivo o de la red: aquí quedan en cero.)
const miiDelJuego = () => p.evaluate(() => {
  const L = window.mkwMenus, sm = L.u32(0x809C1E38), sp = sm && L.u32(sm + 0x98);
  const lista = sp && L.u32(sp + 0x238 + 4), mii = lista && L.u32(lista);
  if (!mii) return null;
  const info = mii + 0x68, w = L.u32(info + 0x34);
  const nombre = String.fromCharCode(...Array.from({ length: 10 }, (_, k) => L.u16(info + 2 * k)).filter(c => c));
  return { nombre, createId: Array.from({ length: 8 }, (_, i) => L.u8(info + 0x2C + i)),
           esChica: w >>> 31, colorFavorito: (w >>> 18) & 15, altura: (w >>> 10) & 127, peso: (w >>> 3) & 127 };
});
// lo mismo de un invitado (sus 74 bytes), para comparar
const huellaInvitado = datos => p.evaluate(async d => {
  const { desarmarMii } = await import('./mii.mjs');
  const m = desarmarMii(d);
  return { esChica: m.esChica, colorFavorito: m.colorFavorito, altura: m.altura, peso: m.peso };
}, datos);
const mismaHuella = (j, h) => j && h && ['esChica', 'colorFavorito', 'altura', 'peso'].every(k => j[k] === h[k]);
const textoHuella = j => j ? `${j.nombre} ${j.esChica ? '♀' : '♂'} color ${j.colorFavorito} altura ${j.altura} complexión ${j.peso}` : 'sin Mii';
// «Un jugador» abierto directo por código (directo.mjs: con la licencia 1; si la partida es nueva, la crea con el Mii
// que dejó prepararMii)
const alMenu = async () => {
  await p.waitForFunction(() => !!window.mkwDirecto, null, { timeout: 120000, polling: 100 });
  const llego = await p.evaluate(() => window.mkwDirecto.ir(0x48, { tope: 120000 }));
  if (!llego) throw new Error('el juego no abrió «Un jugador»');
  await p.waitForFunction(() => window.mkwMenus?.estado?.().seccion === 0x48, null, { timeout: 30000, polling: 250 });
};
const iguales = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
const rasgos = d => d.slice(0x20, 0x36);          // los rasgos de la cara (forma, pelo, cejas, ojos, nariz, boca…)
// el registro de invitados de este navegador, con las imágenes medidas (tinta) y en base64 para guardarlas
const leerRegistro = () => p.evaluate(async () => {
  const { leerInvitados } = await import('./invitados.mjs');
  const r = await leerInvitados();
  if (!r) return null;
  const imagenes = [];
  for (const b of r.imagenes) {
    const bmp = await createImageBitmap(b), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let tinta = 0, suma = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) tinta++; suma = (suma * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2] + d[i + 3]) >>> 0; }
    const b64 = btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer())));
    imagenes.push({ ancho: bmp.width, alto: bmp.height, tinta: tinta / (d.length / 4), suma, b64 });
  }
  return { version: r.version, formato: r.formato, ancho: r.ancho, alto: r.alto, datos: r.datos.map(x => Array.from(x)), imagenes };
});
const cerrarAviso = async () => { const b = p.locator('dialog[open] .acciones button').first(); if (await b.count()) await b.click(); };
const espera = ms => new Promise(r => setTimeout(r, ms));

let reg = null;
try {
  // 0) navegador vacío: sin partidas, sin caras guardadas, sin invitado elegido
  await p.goto(URL0 + '?portada=1');
  await p.evaluate(async () => {
    await window.mkwGuardado.borrarTodo();
    await new Promise(r => { const q = indexedDB.deleteDatabase('mkw-invitados'); q.onsuccess = q.onerror = q.onblocked = r; });
    localStorage.removeItem('mkw.invitado');
  });

  // 1) primera visita: «Un jugador» directo, licencia nueva, y el juego da sus 6 invitados en el primer menú
  await p.goto(URL0 + '?nombre=Prueba&invitados=1');   // (con Playwright la foto de la primera visita va solo con ?invitados=1)
  await alMenu();
  // (waitForFunction no espera una función async: su promesa ya cuenta como «verdad»; se pregunta desde aquí)
  for (let t0 = Date.now(); !reg && Date.now() - t0 < 60000; await espera(500)) reg = await leerRegistro();
  const linea = notas.find(t => t.includes('6 caras del juego')) || '';
  ok('el juego dio sus 6 invitados con imagen en el primer menú', reg && reg.datos.length === 6 && reg.imagenes.length === 6,
     linea.replace(/^· invitados: /, ''));
  const tabla = await p.evaluate(() => Array.from({ length: 6 * 74 }, (_, i) => window.mkwMenus.u8(0x8024C4D0 + i)));
  ok('los 6 Mii son los 74 bytes de la tabla de la librería de caras (0x8024C4D0), uno por uno',
     reg && reg.datos.every((d, i) => iguales(d, tabla.slice(74 * i, 74 * i + 74))));
  const nombres = await p.evaluate(async datos => { const { desarmarMii } = await import('./mii.mjs'); return datos.map(d => { const m = desarmarMii(d); return `${m.nombre || '(sin nombre)'}${m.esChica ? '♀' : '♂'}`; }); }, reg.datos);
  ok('son 6 Mii distintos (rasgos distintos)', new Set(reg.datos.map(d => rasgos(d).join())).size === 6, nombres.join(', '));
  ok('cada imagen tiene la cara dibujada (más de 20 % con tinta) y las 6 son distintas',
     reg.imagenes.every(i => i.tinta > 0.2) && new Set(reg.imagenes.map(i => i.suma)).size === 6,
     `${reg.ancho}×${reg.alto}, formato GX ${reg.formato}, tinta ${reg.imagenes.map(i => Math.round(i.tinta * 100) + '%').join(' ')}`);
  reg.imagenes.forEach((im, i) => writeFileSync(path.join(carpeta, `invitado-${'ABCDEF'[i]}.png`), Buffer.from(im.b64, 'base64')));
  // el Mii de la licencia nueva tomó la cara del invitado A (se ve desde el próximo arranque: el juego ya leyó la base)
  await p.waitForFunction(() => window.mkwGuardado && !window.mkwGuardado.pendientes, null, { timeout: 15000 }).catch(() => {});
  const base1 = await p.evaluate(async () => {
    const { leerBase, RUTA_RFLDB } = await import('./mii.mjs'), { armarMii } = await import('./mii.mjs');
    const r = leerBase(window.mkwFS.readFile(RUTA_RFLDB));
    return r.mii.map(x => Array.from(armarMii(x.mii)));
  });
  const enJuego1 = await miiDelJuego();
  ok('primera visita: la licencia nueva quedó con su Mii y, apenas llegaron los invitados, ese Mii tomó la cara del A (mismo id)',
     base1.length === 1 && iguales(rasgos(base1[0]), rasgos(reg.datos[0])) && enJuego1 && iguales(base1[0].slice(0x18, 0x20), enJuego1.createId),
     notas.some(t => t.includes('tomó la cara')) ? 'avisado' : 'sin aviso');

  // 2) «Mi Mii»: la galería con las 6 imágenes; el Mii de la licencia cambia por el invitado D
  await p.evaluate(() => document.getElementById('abrirMii').click());
  await p.waitForSelector('#miiCambiarInvitado', { timeout: 20000 });
  ok('«Mi Mii» muestra el Mii de la licencia con la imagen del juego (el invitado A), no el dibujo',
     await p.locator('.mii-vista img[data-cara-invitado="0"]').count() === 1);
  await p.click('#miiCambiarInvitado');
  await p.waitForFunction(() => document.querySelectorAll('.mii-galeria [data-invitado] img').length === 6 &&
    [...document.querySelectorAll('.mii-galeria [data-invitado] img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
  const medidas = await p.evaluate(() => [...document.querySelectorAll('.mii-galeria [data-invitado] img')].map(i => `${i.naturalWidth}×${i.naturalHeight}`));
  ok('la galería ofrece los 6 invitados, cada uno con su imagen del juego y sin caras dibujadas',
     medidas.length === 6 && medidas.every(m => m === `${reg.ancho}×${reg.alto}`) && await p.locator('.mii-galeria svg').count() === 0, medidas.join(' '));
  await p.locator('#editorMii').screenshot({ path: path.join(carpeta, 'galeria.png') });
  await p.click('.mii-galeria [data-invitado="3"]');
  await p.click('.mii-pie .principal');
  await espera(500); await cerrarAviso();
  await p.waitForFunction(() => !window.mkwGuardado.pendientes, null, { timeout: 15000 }).catch(() => {});
  const guardada = await p.evaluate(async () => {
    const { leerBase, armarMii, RUTA_RFLDB } = await import('./mii.mjs');
    const r = leerBase(await window.mkwGuardado.leerArchivo(RUTA_RFLDB));
    return r.mii.map(x => Array.from(armarMii(x.mii)));
  });
  ok('guardado: la base de este navegador tiene el Mii de la licencia con la cara del D y el mismo id',
     guardada.length === 1 && iguales(rasgos(guardada[0]), rasgos(reg.datos[3])) && iguales(guardada[0].slice(0x18, 0x20), base1[0].slice(0x18, 0x20)));

  // 3) recargar: el juego carga el Mii de la licencia desde la base nueva
  await p.goto(URL0 + '?nombre=Prueba');
  await alMenu();
  await espera(1000);
  const enJuego = await miiDelJuego(), huellaD = await huellaInvitado(reg.datos[3]);
  ok('al volver a abrir, EL JUEGO carga para la licencia el Mii de la base con lo del invitado D (SectionParams +0x238)',
     mismaHuella(enJuego, huellaD) && enJuego.nombre === 'Prueba', `${textoHuella(enJuego)}; el D: ${textoHuella({ nombre: '', ...huellaD })}`);
  ok('y es el Mii de la licencia: el mismo CreateID', enJuego && iguales(enJuego.createId, base1[0].slice(0x18, 0x20)),
     enJuego ? enJuego.createId.map(x => x.toString(16).padStart(2, '0')).join('') : '');

  // 4) partida nueva con el invitado F elegido: prepararMii lo pone para la licencia nueva y el juego lo carga
  await p.goto(URL0 + '?portada=1');
  await p.evaluate(async () => { await window.mkwGuardado.borrarTodo(); localStorage.setItem('mkw.invitado', '5'); });
  notas.length = 0;
  await p.goto(URL0 + '?nombre=Nueva');
  await alMenu();
  await espera(1000);
  const enJuego2 = await miiDelJuego();
  ok('partida nueva con el F elegido: la página lo pone para la licencia («el invitado F»)', notas.some(t => t.includes('el invitado F')));
  const huellaF = await huellaInvitado(reg.datos[5]);
  const baseF = await p.evaluate(async () => {
    const { leerBase, armarMii, RUTA_RFLDB } = await import('./mii.mjs');
    return leerBase(window.mkwFS.readFile(RUTA_RFLDB)).mii.map(x => Array.from(armarMii(x.mii)));
  });
  ok('y el juego carga para la licencia ese Mii: el de la base con la cara del F, el nombre «Nueva» y su CreateID',
     mismaHuella(enJuego2, huellaF) && enJuego2.nombre === 'Nueva' && baseF.length === 1 && iguales(rasgos(baseF[0]), rasgos(reg.datos[5])) &&
     iguales(enJuego2.createId, baseF[0].slice(0x18, 0x20)), `${textoHuella(enJuego2)}; el F: ${textoHuella({ nombre: '', ...huellaF })}`);
  ok('sin volver a sacar las caras (ya estaban en este navegador)', !notas.some(t => t.includes('6 caras del juego')));
} catch (e) {
  ok('la prueba corrió sin errores', false, String(e && e.message || e));
}

// dejar el navegador de prueba limpio (las caras del juego no quedan en ninguna parte fuera de build/)
await p.evaluate(async () => {
  await window.mkwGuardado?.borrarTodo();
  await new Promise(r => { const q = indexedDB.deleteDatabase('mkw-invitados'); q.onsuccess = q.onerror = q.onblocked = r; });
}).catch(() => {});
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
