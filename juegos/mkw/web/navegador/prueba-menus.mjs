// Prueba del banco: lo que la página esconde de los menús del juego, con el juego de verdad (§66).
//
// Resumen: abre la página como la abre cualquiera (sin portada: entra directo al juego, con la cortina mientras carga),
// crea una licencia con el teclado y comprueba:
//   - la cortina: tapó la carga y se fue al llegar al título;
//   - menú principal: el juego avisó la pantalla (paginas_nativo.cpp) y la página escondió el recuadro «Retro WFC» y
//     sus 2 botones (byte "escondido" = 1 y nadie puede elegirlos), y nada más;
//   - bajar con la cruz desde «Un jugador» y apretar A no lleva a «Retro WFC» (no se puede elegir lo escondido);
//   - «Un jugador»: el botón «Settings» de Retro Rewind escondido;
//   - con ?ocultar=0 todo queda como el juego (el recuadro se ve).
// Fotos en build/web/datos/menus/.
//
// Uso:  node web/navegador/prueba-menus.mjs [--ventana]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8138;
const carpeta = path.join(raiz, 'build/web/datos/menus');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });

// Lo que interesa de la pantalla de arriba: su número, y de cada control conocido si está escondido / se puede elegir
const mirar = pagina => pagina.evaluate(() => {
  const L = window.mkwMenus, e = L.estado(), sm = L.u32(0x809C1E38), sec = L.u32(sm);
  const capas = Math.min(11, L.u32(sec + 0x37C)); let pag = 0;
  for (let i = 0; i < capas; i++) { const q = L.u32(sec + 0x354 + 4 * i); if (q) pag = q; }
  const botones = window.mkwOcultar.botonesDe(pag).map(b => ({ id: b.id, clase: b.clase.toString(16), escondido: L.u8(b.dir + 0x80), bits: L.u32(b.dir + 0x244) }));
  return { seccion: e.seccion, pagina: e.pagina, marcoWfc: e.pagina === 0x5a ? L.u8(pag + 0x9AC + 0x80) : null, botones, estado: { ...window.mkwOcultar.estado } };
});

async function abrir(extra = '') {
  const contexto = await navegador.newContext({ viewport: { width: 1000, height: 900 } });
  const pagina = await contexto.newPage();
  const cortina = [];
  await pagina.goto(`http://127.0.0.1:${PUERTO}/${extra}`);
  // la cortina: puesta mientras carga, fuera al llegar al título
  for (let i = 0; i < 600; i++) {
    const c = await pagina.evaluate(() => ({ puesta: !document.body.classList.contains('sin-cortina'), cuadros: window.mkwEstado?.cuadros || 0,
      seccion: window.mkwMenus ? window.mkwMenus.estado().seccion : -1 })).catch(() => null);
    if (c) cortina.push(c);
    if (c && !c.puesta) break;
    await espera(200);
  }
  await pagina.waitForFunction(() => (window.mkwEstado?.cuadros || 0) >= 360, null, { timeout: 120000 });
  const toque = async (tecla, ms) => { await pagina.keyboard.down(tecla); await espera(120); await pagina.keyboard.up(tecla); await espera(ms); };
  for (const ms of [2500, 2000, 2500, 2500, 2500, 3000, 3500]) await toque('KeyK', ms);
  for (let i = 0; i < 15; i++) {                      // hasta el menú principal (0x5a)
    if ((await pagina.evaluate(() => window.mkwMenus.estado().pagina)) === 0x5a) break;
    await toque('KeyK', 1500);
  }
  await espera(1500);
  return { contexto, pagina, toque, cortina, foto: n => pagina.locator('#canvas').screenshot({ path: path.join(carpeta, n + '.png') }) };
}

let codigo = 1;
try {
  const A = await abrir();
  const puestaAlCargar = A.cortina.length > 1 && A.cortina.slice(0, -1).every(c => c.puesta);
  const alSalir = A.cortina[A.cortina.length - 1];
  ok('sin portada: la cortina tapó la carga y se fue al llegar al título', puestaAlCargar && alSalir && !alSalir.puesta && alSalir.seccion === 0x3f,
     alSalir ? `se fue en la sección 0x${alSalir.seccion.toString(16)}, cuadro ${alSalir.cuadros}` : 'no se fue');
  let m = await mirar(A.pagina);
  await A.foto('1-menu-principal');
  const wfc = m.botones.filter(b => b.clase === '808d35a8' && (b.id === 4 || b.id === 5));
  const resto = m.botones.filter(b => !(b.clase === '808d35a8' && (b.id === 4 || b.id === 5)));
  ok('el juego avisó el menú principal y la página escondió el recuadro «Retro WFC»', m.pagina === 0x5a && m.marcoWfc === 1 && m.estado.porPagina?.[0x5a] === 3,
     `página 0x${m.pagina.toString(16)}, recuadro ${m.marcoWfc}, escondidos ${m.estado.porPagina?.[0x5a]}`);
  ok('«Retro WFC 1 y 2 jugadores»: escondidos y nadie puede elegirlos', wfc.length === 2 && wfc.every(b => b.escondido === 1 && b.bits === 0),
     JSON.stringify(wfc));
  ok('los demás botones del menú principal siguen a la vista y elegibles', resto.length >= 6 && resto.every(b => b.escondido === 0 && b.bits !== 0),
     `${resto.length} botones`);
  // abajo desde «Un jugador» (antes llevaba a «Retro WFC 1 jugador») y A: no puede entrar en línea
  await A.toque('KeyG', 900); await A.toque('KeyG', 900); await A.toque('KeyK', 3500);
  m = await mirar(A.pagina);
  await A.foto('2-abajo-y-A');
  ok('bajar y apretar A no entra a «Retro WFC» (el cursor se queda en «Un jugador»)', m.seccion !== 0x55 && m.seccion !== 0x50, `quedó en la sección 0x${m.seccion.toString(16)} página 0x${m.pagina.toString(16)}`);
  // como el cursor no puede bajar a lo escondido, A entró a «Un jugador» (el botón de arriba); si no, B hasta el menú
  // principal y A sobre «Un jugador»
  if (m.pagina !== 0x69) {
    for (let i = 0; i < 4 && (await mirar(A.pagina)).pagina !== 0x5a; i++) await A.toque('KeyJ', 2000);
    await A.toque('KeyK', 3000);
  }
  m = await mirar(A.pagina);
  await A.foto('3-un-jugador');
  const ajustes = m.botones.find(b => b.clase === '808b776c' && b.id === 5);
  ok('«Un jugador»: el botón «Settings» de Retro Rewind escondido y sin poder elegirse', m.pagina === 0x69 && ajustes?.escondido === 1 && ajustes?.bits === 0,
     `página 0x${m.pagina.toString(16)}, ${JSON.stringify(ajustes)}`);
  ok('«Un jugador»: Grand Prix, TTs, VS, Battle y Back a la vista', m.botones.filter(b => b !== ajustes).every(b => b.escondido === 0 && b.bits !== 0),
     `${m.botones.length - 1} botones`);
  await A.contexto.close();

  // ?ocultar=0: el juego tal cual
  const B = await abrir('?ocultar=0');
  m = await mirar(B.pagina);
  await B.foto('4-sin-ocultar');
  ok('con ?ocultar=0 el recuadro «Retro WFC» se ve (el juego tal cual)', m.pagina === 0x5a && m.marcoWfc === 0 && !m.estado.escondidos,
     `recuadro ${m.marcoWfc}`);
  await B.contexto.close();
  codigo = mal ? 1 : 0;
} catch (e) {
  console.log('✗ la prueba se cortó — ' + (e && e.stack || e));
} finally {
  console.log(`\n${bien} bien, ${mal} mal`);
  await navegador.close().catch(() => {});
  servidor.kill();
  process.exit(codigo);
}
