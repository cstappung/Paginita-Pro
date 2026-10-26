// Prueba con el RATÓN DE VERDAD de la hoja «Avanzado» (bitácora §112: «revisa que funcionen los ajustes de avanzado»).
//
// Resumen: abre web/navegador/index.html con banco/servir.cjs (sin el juego) y prueba como una persona: el volumen
// (arrastrar), Silencio, resolución interna y fluidez (avisan «se aplica al reiniciar»), resolución de salida (al momento),
// «Mostrar los fps» (con el juego «andando» de mentira), que todo se recuerde al recargar y que «Borrar» pregunte y borre.
// También mira que ninguna hoja del cajón saque y vuelva a poner elementos estando quieta (eso pierde clics).
//
// Uso:  node herramientas/prueba-raton-avanzado.mjs [puerto]   (Chrome: el de Playwright, o CHROME=ruta)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const req = createRequire(new URL('../banco/package.json', import.meta.url));
const { chromium } = req('playwright-core');
const PUERTO = process.argv[2] || '8145';
const srv = spawn(process.execPath, [fileURLToPath(new URL('../banco/servir.cjs', import.meta.url)), PUERTO], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = []; p.on('pageerror', e => errores.push(e.message));
const DIRECCION = `http://127.0.0.1:${PUERTO}/web/navegador/index.html?portada=1`;
const ok = (n, c, d = '') => console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
await p.goto(DIRECCION); await p.waitForTimeout(1500);
await p.evaluate(() => window.mkwInterfaz.abrirCajon('partida'));
await p.waitForTimeout(300);
await p.click('button[data-hoja="avanzado"]');
await p.waitForTimeout(300);
ok('la pestaña Avanzado se abre con un clic real', await p.locator('#hojaAvanzado').isVisible());
// ¿algo de la hoja se rearma solo? (la falla de «Reasignar»: nodos que salen y vuelven bajo el puntero)
const quitados = await p.evaluate(async () => {
  let n = 0; const raro = [];
  const o = new MutationObserver(ms => { for (const m of ms) for (const x of m.removedNodes) if (x.nodeType === 1) { n++; raro.push(x.id || x.className || x.tagName); } });
  for (const id of ['hojaAvanzado', 'hojaControles', 'hojaPartida']) o.observe(document.getElementById(id), { childList: true, subtree: true });
  await new Promise(r => setTimeout(r, 2500)); o.disconnect(); return { n, raro: [...new Set(raro)].slice(0, 8) };
});
ok('en 2,5 s quietos, ninguna hoja del cajón saca y vuelve a poner elementos', quitados.n === 0, JSON.stringify(quitados));
// volumen: arrastrar la barra
const caja = await p.locator('#volumen').boundingBox();
await p.mouse.click(caja.x + caja.width * 0.25, caja.y + caja.height / 2);
await p.waitForTimeout(200);
const v1 = await p.evaluate(() => ({ dato: document.getElementById('volumenDato').textContent, vol: window.mkwSonido.estado.volumen }));
ok('el volumen se mueve con el ratón (≈25 %)', Math.abs(v1.vol - 0.25) < 0.08 && /%/.test(v1.dato), JSON.stringify(v1));
await p.click('#silencio'); await p.waitForTimeout(150);
const v2 = await p.evaluate(() => ({ dato: document.getElementById('volumenDato').textContent, sil: window.mkwSonido.estado.silencio }));
ok('«Silencio» con un clic', v2.sil === true && v2.dato === 'silencio', JSON.stringify(v2));
// gráficos
await p.selectOption('#graficosEscala', '2'); await p.waitForTimeout(150);
await p.selectOption('#graficosFluidez', '120'); await p.waitForTimeout(150);
const g1 = await p.evaluate(() => ({ aviso: !document.getElementById('graficosAviso').hidden, boton: !document.getElementById('graficosReiniciar').hidden, guardado: localStorage.getItem('mkw.graficos') }));
ok('resolución interna y fluidez: avisan «se aplica al reiniciar» y aparece «Reiniciar el juego ahora»', g1.aviso && g1.boton, JSON.stringify(g1));
await p.selectOption('#graficosSalida', '540'); await p.waitForTimeout(300);
const s1 = await p.evaluate(() => { const r = document.getElementById('canvas').getBoundingClientRect(); return { alto: r.height, ancho: r.width, dpr: devicePixelRatio, est: window.mkwSalida?.estado?.() ?? null }; });
ok('resolución de salida 540: el lienzo informa un recuadro de 540 de alto como mucho (al momento)', s1.alto * s1.dpr <= 541, JSON.stringify(s1));
await p.click('#graficosFps'); await p.waitForTimeout(100);
await p.evaluate(() => { document.body.classList.add('started', 'sin-cortina'); window.mkwEstado.cuadros = 100; window.mkwEstado.fps = 59.8; });
await p.waitForTimeout(1300);
const m1 = await p.evaluate(() => ({ visible: !document.getElementById('medidor').hidden, texto: document.getElementById('medidor').textContent }));
ok('«Mostrar los fps»: el recuadro aparece con el juego andando', m1.visible && /60|59/.test(m1.texto), JSON.stringify(m1));
// recargar: todo se recuerda y el juego lo leería al arrancar
await p.reload(); await p.waitForTimeout(1500);
const r1 = await p.evaluate(() => ({ vol: window.mkwSonido.estado.volumen, sil: window.mkwSonido.estado.silencio, g: window.mkwEstado.graficos,
  escala: document.getElementById('graficosEscala').value, salida: document.getElementById('graficosSalida').value, fps: document.getElementById('graficosFps').checked,
  barra: document.getElementById('volumen').value, casilla: document.getElementById('silencio').checked }));
ok('al recargar se recuerdan volumen y silencio (y la barra los muestra)', Math.abs(r1.vol - 0.25) < 0.08 && r1.sil && Math.abs(r1.barra - 25) < 8 && r1.casilla, JSON.stringify({ vol: r1.vol, sil: r1.sil, barra: r1.barra }));
ok('al recargar se recuerdan los gráficos y el juego recibiría las líneas del Config.toml', r1.escala === '2' && r1.salida === '540' && r1.fps &&
   JSON.stringify(r1.g.lineas).includes('resolution_multiplier') && JSON.stringify(r1.g.lineas).includes('frame_interpolation_fps'), JSON.stringify(r1.g));
// borrar los datos del juego
await p.evaluate(async () => { const c = await caches.open('mkw-disco:prueba'); await c.put('/x', new Response('hola')); });
await p.evaluate(() => window.mkwInterfaz.abrirCajon('avanzado')); await p.waitForTimeout(300);
await p.click('#borrarDisco'); await p.waitForTimeout(300);
const dlg = p.locator('dialog[open]');
ok('«Borrar» pregunta antes', await dlg.count() > 0);
await dlg.getByRole('button', { name: 'Borrar' }).click(); await p.waitForTimeout(400);
const quedan = await p.evaluate(async () => (await caches.keys()).filter(n => n.startsWith('mkw-disco:')));
ok('…y al confirmar borra la caché del disco', quedan.length === 0, JSON.stringify(quedan));
ok('sin errores en la página', errores.length === 0, errores.join(' | '));
await b.close(); srv.kill();
