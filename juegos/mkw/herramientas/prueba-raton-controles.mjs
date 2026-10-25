// Prueba con el RATÓN DE VERDAD de la hoja «Controles» (bitácora §112) — sin el juego.
//
// Resumen: abre web/navegador/index.html con banco/servir.cjs y dos mandos Xbox de mentira, y hace clics como una
// persona (apretar, 150 ms, soltar: así se ve un «clic perdido», que .click() no muestra): el recuadro de «Derrapar»
// 4 veces, la pestaña Jugador 2, el «+» de la zona muerta, «Más controles», el recuadro del teclado con una tecla y Esc;
// y que a 440 px de ancho no haya desborde. Deja una foto en build/web/datos/controles-angosto.png.
//
// Uso:  node herramientas/prueba-raton-controles.mjs [puerto]   (Chrome: el de Playwright, o CHROME=ruta)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const req = createRequire(new URL('../banco/package.json', import.meta.url));
const { chromium } = req('playwright-core');
const PUERTO = process.argv[2] || '8149';
const srv = spawn(process.execPath, [fileURLToPath(new URL('../banco/servir.cjs', import.meta.url)), PUERTO], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errores = []; p.on('pageerror', e => errores.push(e.message));
await p.addInitScript(() => {
  const mk = (i, id) => ({ index: i, id, mapping: 'standard', connected: true, axes: [0,0,0,0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
  const ms = [mk(0, 'Xbox 360 Controller for Windows (STANDARD GAMEPAD Vendor: 045e Product: 028e)'), mk(1, 'Xbox 360 Controller (XInput STANDARD GAMEPAD)')];
  window.__ms = ms; navigator.getGamepads = () => ms;
});
await p.goto(`http://127.0.0.1:${PUERTO}/web/navegador/index.html?portada=1`);
await p.waitForTimeout(1200);
await p.evaluate(() => window.mkwInterfaz.abrirCajon('controles'));
await p.waitForTimeout(500);
const ok = (n, c, d = '') => console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
const clic = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); const c = await l.boundingBox(); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.down(); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(250); };
let bien = 0;
for (let i = 0; i < 4; i++) {
  await clic('.ctl-fila[data-objetivo="R"] .ctl-chip[data-col="mando"]');
  if ((await p.evaluate(() => window.mkwPanelControles.espera?.obj)) === 'R') bien++;
  await clic('.ctl-tira button:has-text("Cancelar")');
}
ok('clic real (150 ms) en el recuadro de «Derrapar»: la fila espera, 4 de 4', bien === 4, `${bien}/4`);
await clic('.ctl-pestana[data-jugador="1"]');
ok('clic real en la pestaña «Jugador 2»', (await p.evaluate(() => window.mkwPanelControles.pestana)) === 1);
await clic('.ctl-ajustes .ctl-paso:has-text("+")');
ok('clic real en «+» de la zona muerta', (await p.evaluate(() => window.mkwControles.prefsMandos().zona)) === 17);
await clic('.ctl-mas');
ok('clic real en «Más controles»', await p.evaluate(() => document.querySelector('.ctl').classList.contains('ver-mas')));
await clic('.ctl-pestana[data-jugador="0"]');
await clic('.ctl-fila[data-objetivo="X"] .ctl-chip[data-col="teclado"]');
await p.keyboard.press('KeyM'); await p.waitForTimeout(250);
ok('clic real en el recuadro del teclado de «Mirar atrás» y la tecla M', (await p.evaluate(() => JSON.stringify(window.mkwControles.teclasDe('X')))) === '["KeyM"]');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('Esc sin nada esperando cierra el cajón', !(await p.evaluate(() => document.body.classList.contains('cajon-abierto'))));
// fotos a 440 px (el cajón angosto) y con la tira abierta
await p.setViewportSize({ width: 440, height: 900 });
await p.evaluate(() => window.mkwInterfaz.abrirCajon('controles')); await p.waitForTimeout(400);
const S = fileURLToPath(new URL('../build/web/datos', import.meta.url)); fs.mkdirSync(S, { recursive: true });
await p.locator('#hojaControles').screenshot({ path: `${S}/controles-angosto.png` });
const desborde = await p.evaluate(() => { const h = document.getElementById('hojaControles'); return h.scrollWidth - h.clientWidth; });
ok('a 440 px no hay desborde a lo ancho', desborde <= 0, `${desborde} px`);
ok('sin errores', errores.length === 0, errores.join(' | '));
await b.close(); srv.kill();
