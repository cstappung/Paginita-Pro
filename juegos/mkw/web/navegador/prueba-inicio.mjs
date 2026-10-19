// Prueba del menú de inicio «JloKart Wii» con el juego de verdad (bitácora §67).
//
// Resumen: abre la página con ?inicio=1 (Playwright no lo ve sin eso: navigator.webdriver) y comprueba:
//   - aparece con la imagen privada (200) y 3 botones: Single Player, Multiplayer, Options (sin «Championship»);
//   - mientras está, el juego no recibe nada de la persona (controles silenciados) y arranca debajo hasta su título;
//   - teclado: bajar, entrar a Multiplayer (Local y Back; «Online» solo dentro del sitio), volver con Esc;
//   - Options abre el cajón (Controles) y mientras está abierto el menú no se mueve;
//   - Single Player: el menú se va, la cortina tapa al tiro y el piloto deja el juego en su menú «Un jugador» (0x69);
//   - B, B (al título del juego): vuelve nuestro menú de inicio;
//   - Multiplayer → Local: el piloto deja el juego en su menú principal (0x5a) con el cursor a la derecha;
//   - sin ?inicio=1 no aparece (las demás pruebas siguen igual);
//   - en el sitio (sitio-local.mjs con el Worker de verdad y un token de amigo): aparece, y Multiplayer ofrece «Online»,
//     que le avisa a Juegos; la página suelta, sin sesión: el Worker contesta 401 y el menú NO aparece.
// Fotos en build/web/datos/inicio/.
//
// Uso:  node web/navegador/prueba-inicio.mjs [--ventana]
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8136, PUERTO_SITIO = 8152;                  // el sitio en 8152 y su "Worker" en 8153
const carpeta = path.join(raiz, 'build/web/datos/inicio');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const arrancarServidor = (args, listo) => new Promise(r => {
  const s = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  s.stdout.on('data', d => { if (String(d).includes(listo)) r(s); });
});

const servidor = await arrancarServidor([path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], 'juego en');
let sitio = null;
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });

// Lo que interesa del menú, de la cortina y del juego
const mirar = marco => marco.evaluate(() => {
  const I = window.mkwInicio, e = window.mkwMenus ? window.mkwMenus.estado() : {};
  const arte = document.querySelector('#inicioJlo .ij-arte');
  return {
    visible: !!I?.visible, imagen: I?.estado.imagen, opciones: I?.opciones || [], menu: I?.estado.menu, elegido: I?.estado.elegido,
    textos: [...document.querySelectorAll('#inicioJlo .ij-boton span')].map(t => t.textContent),
    arteAncho: arte?.naturalWidth || 0, silenciado: !!window.mkwControles?.silenciado,
    cortina: !document.body.classList.contains('sin-cortina'), cortinaTexto: document.getElementById('cortinaTexto')?.textContent,
    cajon: document.body.classList.contains('cajon-abierto'), seccion: e.seccion, pagina: e.pagina,
    piloto: window.mkwEstado?.piloto || null, imagenInicio: window.mkwEstado?.imagenInicio,
  };
});
const hasta = async (marco, cond, ms, cada = 200) => {
  let m;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(cada)) { m = await mirar(marco).catch(() => null); if (m && cond(m)) return m; }
  return m || await mirar(marco).catch(() => ({}));
};

let codigo = 1;
try {
  // ---------- A) la página del juego con el menú ----------
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await contexto.newPage();
  const tecla = async (k, ms = 400) => { await p.keyboard.down(k); await espera(110); await p.keyboard.up(k); await espera(ms); };
  await p.goto(`http://127.0.0.1:${PUERTO}/?inicio=1`);
  let m = await hasta(p, x => x.visible && x.arteAncho > 0, 20000);
  ok('aparece el menú de inicio con la imagen privada (200)', m.visible && m.imagen === 200 && m.arteAncho === 1448, `imagen ${m.imagen}, ${m.arteAncho} px`);
  ok('3 botones: Single Player, Multiplayer, Options (sin «Championship»)', JSON.stringify(m.textos) === '["Single Player","Multiplayer","Options"]', m.textos.join(' · '));
  ok('mientras está, el juego no recibe nada de la persona (controles silenciados)', m.silenciado);
  await p.screenshot({ path: path.join(carpeta, '1-menu.png') });

  // teclado: abajo → Multiplayer, Enter → su menú, Esc → volver
  await tecla('ArrowDown'); const abajo = await mirar(p);
  await tecla('Enter'); const multi = await mirar(p);
  await p.screenshot({ path: path.join(carpeta, '2-multiplayer.png') });
  await tecla('Escape'); const vuelta = await mirar(p);
  ok('teclado: bajar, entrar a Multiplayer (Local y Back; sin «Online» fuera del sitio) y volver con Esc',
     abajo.elegido === 1 && multi.menu === 'multi' && JSON.stringify(multi.opciones) === '["local","volver"]' && vuelta.menu === 'principal' && vuelta.elegido === 0,
     `elegido ${abajo.elegido}, ${multi.menu} ${multi.opciones.join('/')}, vuelta ${vuelta.menu} ${vuelta.elegido}`);

  // Options: el cajón; con él abierto el menú no se mueve; Esc lo cierra
  await tecla('ArrowDown'); await tecla('ArrowDown'); await tecla('Enter', 600);
  const conCajon = await mirar(p);
  await tecla('ArrowUp'); const quieto = await mirar(p);
  await tecla('Escape', 600); const sinCajon = await mirar(p);
  ok('Options abre el cajón y mientras está abierto el menú no se mueve',
     conCajon.cajon && conCajon.visible && quieto.elegido === 2 && !sinCajon.cajon && sinCajon.visible,
     `cajón ${conCajon.cajon}, elegido con cajón ${quieto.elegido}, después ${sinCajon.cajon}`);
  await tecla('ArrowUp'); await tecla('ArrowUp');

  // el juego arranca debajo hasta su título; la cortina se va y el menú sigue encima
  m = await hasta(p, x => x.seccion === 0x3f && !x.cortina, 150000, 500);
  ok('el juego arrancó debajo (su título) y el menú sigue encima', m.seccion === 0x3f && m.visible && !m.cortina,
     `sección 0x${(m.seccion ?? -1).toString(16)}, menú ${m.visible}, cortina ${m.cortina}`);

  // Single Player
  await tecla('Enter', 300);
  m = await mirar(p);
  ok('Single Player: el menú se va y la cortina tapa al tiro', !m.visible && m.cortina && /^Entrando a Single Player/.test(m.cortinaTexto || '') && !m.silenciado,
     `menú ${m.visible}, cortina «${m.cortinaTexto}»`);
  m = await hasta(p, x => x.piloto && !x.cortina, 100000, 300);
  await p.locator('#canvas').screenshot({ path: path.join(carpeta, '3-un-jugador.png') });
  ok('el piloto dejó el juego en su menú «Un jugador» (0x69) y la cortina se fue', !!m.piloto?.llego && m.pagina === 0x69 && m.seccion === 0x48 && !m.cortina,
     `página 0x${(m.pagina ?? -1).toString(16)} sección 0x${(m.seccion ?? -1).toString(16)}, piloto ${JSON.stringify(m.piloto && { llego: m.piloto.llego, paginas: m.piloto.paginas })}`);

  // B hasta el título del juego: vuelve nuestro menú
  for (let i = 0; i < 4 && !(await mirar(p)).visible; i++) await tecla('KeyJ', 2500);
  m = await hasta(p, x => x.visible, 8000);
  ok('B, B (al título del juego): vuelve el menú de inicio y el juego otra vez silenciado', m.visible && m.silenciado, `menú ${m.visible}, sección 0x${(m.seccion ?? -1).toString(16)}`);

  // Multiplayer → Local
  await tecla('ArrowDown'); await tecla('Enter'); await tecla('Enter', 300);
  m = await hasta(p, x => x.piloto && x.piloto.modo === 'local' && !x.cortina, 60000, 300);
  await p.locator('#canvas').screenshot({ path: path.join(carpeta, '4-local.png') });
  ok('Multiplayer → Local: el piloto deja el juego en su menú principal (0x5a)', !!m.piloto?.llego && m.piloto.modo === 'local' && m.pagina === 0x5a && !m.cortina,
     `página 0x${(m.pagina ?? -1).toString(16)}, piloto ${JSON.stringify(m.piloto && { llego: m.piloto.llego, modo: m.piloto.modo })}`);
  await contexto.close();

  // ---------- B) sin ?inicio=1 (Playwright): no aparece ----------
  const cB = await navegador.newContext({ viewport: { width: 1000, height: 800 } });
  const pB = await cB.newPage();
  await pB.goto(`http://127.0.0.1:${PUERTO}/`);
  m = await hasta(pB, x => x.seccion === 0x3f, 150000, 500);
  const hayRaiz = await pB.evaluate(() => !!document.getElementById('inicioJlo'));
  ok('sin ?inicio=1 (las pruebas automáticas) no aparece: las demás pruebas siguen igual', m.seccion === 0x3f && !m.visible && !hayRaiz && m.imagen === 'sin pedir',
     `sección 0x${(m.seccion ?? -1).toString(16)}, imagen ${m.imagen}`);
  await cB.close();

  // ---------- C) en el sitio, con el Worker de verdad ----------
  sitio = await arrancarServidor([path.join(raiz, 'herramientas/sitio-local.mjs'), '--puerto', String(PUERTO_SITIO)], 'la página sola');
  const cC = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  const pC = await cC.newPage();
  await pC.goto(`http://127.0.0.1:${PUERTO_SITIO}/juegos.html?mkw=1%26inicio%3D1`);
  await pC.waitForFunction(() => window.mkwMarco && window.mkwMarco.contentWindow?.mkwInicio, null, { timeout: 30000 });
  await pC.evaluate(() => { window.__salas = 0; addEventListener('message', e => { if (e.data?.canal === 'mkw-hijo' && e.data.tipo === 'salas') window.__salas++; }); });
  const marco = pC.frames().find(f => f.url().includes('/juegos/mkw/web/navegador/index.html'));
  m = await hasta(marco, x => x.visible, 20000);
  ok('en el sitio (Worker de verdad, token de amigo): el menú aparece', m.visible && m.imagen === 200, `imagen ${m.imagen}`);
  await pC.screenshot({ path: path.join(carpeta, '5-en-el-sitio.png') });
  await marco.evaluate(() => { window.mkwInicio.elegir(1); window.mkwInicio.aceptar(); });
  const enSitio = await mirar(marco);
  await marco.evaluate(() => { window.mkwInicio.elegir(1); window.mkwInicio.aceptar(); });
  await espera(300);
  const salas = await pC.evaluate(() => window.__salas);
  ok('dentro del sitio, Multiplayer ofrece «Online», que le avisa a Juegos (abrir las salas)',
     JSON.stringify(enSitio.opciones) === '["local","salas","volver"]' && salas === 1, `${enSitio.opciones.join('/')}, avisos ${salas}`);
  await cC.close();

  // ---------- D) la página suelta, sin sesión: 401 y sin menú ----------
  const cD = await navegador.newContext();
  const pD = await cD.newPage();
  await pD.goto(`http://127.0.0.1:${PUERTO_SITIO}/juegos/mkw/web/navegador/index.html?privado=http://127.0.0.1:${PUERTO_SITIO + 1}/mkw&inicio=1`);
  m = await hasta(pD, x => x.imagenInicio !== undefined, 20000);
  ok('la página suelta, sin sesión: el Worker contesta 401 y el menú NO aparece', m.imagenInicio === 401 && !m.visible, `imagen ${m.imagenInicio}, menú ${m.visible}`);
  await cD.close();
  codigo = mal ? 1 : 0;
} catch (e) {
  console.log('✗ la prueba se cortó — ' + (e && e.stack || e));
} finally {
  console.log(`\n${bien} bien, ${mal} mal  (fotos en build/web/datos/inicio/)`);
  await navegador.close().catch(() => {});
  // en Windows kill() corta el proceso sin que alcance a cerrar a sus hijos (el "Worker" de sitio-local): el árbol entero
  const matar = h => { if (!h) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F']); else h.kill(); };
  matar(servidor); matar(sitio);
  process.exit(codigo);
}
