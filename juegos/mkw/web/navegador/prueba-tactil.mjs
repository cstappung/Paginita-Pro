// Prueba del mando táctil en un celular emulado (Pixel 7), sin arrancar el juego.
//
// Resumen: abre la página del juego con Playwright haciéndose pasar por un Pixel 7 (pantalla de 412×915, táctil,
// "puntero grueso"), así la página prende sola el mando táctil como en un celular de verdad. Después, con el
// teléfono PARADO y ACOSTADO, y para cada tamaño del deslizador (80 % a 130 %, de 5 en 5), mide dónde quedó cada
// botón y comprueba que:
//   - ninguno se pisa con otro (ni con el aro del stick) — si se pisan, un dedo apretaría dos cosas (son redondos:
//     se pisan si la distancia entre centros es menor que la suma de los radios);
//   - todos quedan dentro de la pantalla (un botón cortado por el borde no se puede tocar bien);
//   - cada botón mide al menos ~7 mm (unos 44 px CSS: el mínimo cómodo para un dedo).
// Por último toca de verdad (eventos táctiles del navegador por CDP, como un dedo, no eventos inventados en JS) y
// mira que el mando de GameCube que ve el juego tenga apretado el botón correcto, también con dos dedos a la vez.
//
// Uso:  node web/navegador/prueba-tactil.mjs [--ventana]      (fotos en build/web/datos/tactil-parado.png y -acostado.png)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8144;
const BOTON = { A: 0x0100, B: 0x0200, R: 0x0020, L: 0x0040, arriba: 0x0008, START: 0x1000 };   // bits del mando de GC
const TEXTO_BIT = { A: BOTON.A, B: BOTON.B, R: BOTON.R, L: BOTON.L, '↑': BOTON.arriba, '▶': BOTON.START };
const MIN_PX = 44;                                    // lado mínimo de un botón (px CSS)

let bien = 0, mal = 0;
const ok = (nombre, cond, detalle = '') => {
  cond ? bien++ : mal++;
  console.log(`${cond ? '✓' : '✗'} ${nombre}${detalle ? '  — ' + detalle : ''}`);
};

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'), args: ['--mute-audio'] });

// Mide la capa táctil: rectángulos del aro y de cada botón, y el tamaño de la pantalla
const medir = pagina => pagina.evaluate(() => {
  const capa = document.querySelector('.mkw-tactil');
  const r = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
  const hijos = [...capa.children];
  return {
    pantalla: { w: innerWidth, h: innerHeight },
    capa: r(capa),
    aro: r(hijos[0]),
    botones: hijos.slice(1).filter(e => e.textContent).map(e => ({ texto: e.textContent, ...r(e) })),
  };
});
const pisan = (a, b) => Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) < (a.w + b.w) / 2 + 2;   // + 2 px de aire
const dentro = (a, c) => a.x >= c.x - 0.5 && a.y >= c.y - 0.5 && a.x + a.w <= c.x + c.w + 0.5 && a.y + a.h <= c.y + c.h + 0.5;

for (const orientacion of ['parado', 'acostado']) {
  const pixel = devices['Pixel 7'];
  const vista = orientacion === 'parado' ? pixel.viewport : { width: pixel.viewport.height, height: pixel.viewport.width };
  const contexto = await navegador.newContext({ ...pixel, viewport: vista, screen: vista });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', e => console.log('[pageerror] ' + e.message));
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?portada=1`);   // con la portada: el juego no arranca, solo la página
  await pagina.waitForFunction(() => window.mkwControles && document.querySelector('.mkw-tactil'));
  // El juego, al arrancar, le da al canvas su tamaño nativo (640×528); acá se hace a mano. Y se lleva el recuadro a la
  // vista, como hace la página al arrancar en el celular (el recuadro mide toda la pantalla). Se espera un poco antes:
  // la página todavía escribe cosas arriba (la tarjeta de video, avisos) que corren el recuadro hacia abajo.
  await pagina.waitForTimeout(1500);
  const aLaVista = () => pagina.evaluate(() => { const c = document.getElementById('canvas'); c.width = 640; c.height = 528;
    window.scrollTo({ top: document.getElementById('pantalla').getBoundingClientRect().top + scrollY, behavior: 'instant' }); });
  await aLaVista();

  ok(`${orientacion}: en el celular el mando táctil se prende solo`,
     await pagina.evaluate(() => document.body.classList.contains('tactil') && getComputedStyle(document.querySelector('.mkw-tactil')).display !== 'none'));
  const m0 = await medir(pagina);
  ok(`${orientacion}: el recuadro del juego ocupa justo la pantalla (${Math.round(m0.capa.w)}×${Math.round(m0.capa.h)} en ` +
     `${Math.round(m0.capa.x)},${Math.round(m0.capa.y)}; pantalla ${m0.pantalla.w}×${m0.pantalla.h})`,
     Math.abs(m0.capa.x) <= 1 && Math.abs(m0.capa.y) <= 1 && Math.abs(m0.capa.w - m0.pantalla.w) <= 1 && Math.abs(m0.capa.h - m0.pantalla.h) <= 1);
  // los ajustes del mando táctil están en el cajón, pestaña «Controles» (interfaz.mjs): se abre como lo haría la persona
  await pagina.evaluate(() => window.mkwInterfaz.abrirCajon('controles'));
  ok(`${orientacion}: el control de tamaño está a la vista (Controles)`, await pagina.locator('#ajustesTactil').isVisible());
  await pagina.evaluate(() => window.mkwInterfaz.cerrarCajon());

  // Cada tamaño del deslizador: nada se pisa y todo cabe
  const problemas = [];
  let maxBien = 0;
  for (let p = 80; p <= 130; p += 5) {
    await pagina.evaluate(v => window.mkwControles.ajustarTactil({ esc: v / 100 }), p);
    const m = await medir(pagina);
    const cosas = [{ texto: 'stick', ...m.aro }, ...m.botones];
    const malos = [];
    for (let i = 0; i < cosas.length; i++) {
      if (!dentro(cosas[i], m.capa)) malos.push(`${cosas[i].texto} se sale`);
      if (i > 0 && Math.min(cosas[i].w, cosas[i].h) < MIN_PX) malos.push(`${cosas[i].texto} mide ${Math.round(cosas[i].w)} px`);
      for (let j = i + 1; j < cosas.length; j++) if (pisan(cosas[i], cosas[j])) malos.push(`${cosas[i].texto} pisa ${cosas[j].texto}`);
    }
    if (malos.length) problemas.push(`${p} %: ${malos.join(', ')}`); else maxBien = p;
  }
  ok(`${orientacion}: de 80 % a 130 %, ningún botón pisa a otro, todos caben y miden ≥ ${MIN_PX} px`, problemas.length === 0,
     problemas.join(' | ') || `11 tamaños`);

  // Toques de verdad (CDP: Input.dispatchTouchEvent = el navegador cree que hay dedos en la pantalla)
  // (con el juego andando: la tarjeta de inicio y la cortina se van y dejan el mando táctil a la vista, como al llegar al título)
  await pagina.evaluate(() => document.body.classList.add('started', 'sin-cortina'));
  await pagina.evaluate(() => window.mkwControles.ajustarTactil({ esc: 1 }));
  const m = await medir(pagina);
  await aLaVista();
  // foto de cómo se ve, en build/web/datos/tactil-<orientación>.png. Sin el juego el canvas está vacío: se pinta de
  // gris con un texto para ver dónde caería la imagen del juego
  await pagina.evaluate(() => { const g = document.getElementById('canvas').getContext('2d');
    if (!g) return; g.fillStyle = '#556'; g.fillRect(0, 0, 640, 528);
    g.fillStyle = '#fff'; g.font = '40px system-ui'; g.textAlign = 'center'; g.fillText('imagen del juego (640×528)', 320, 274); });
  await pagina.screenshot({ path: path.join(raiz, `build/web/datos/tactil-${orientacion}.png`) });
  const cdp = await contexto.newCDPSession(pagina);
  const centro = c => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
  const dedos = async (tipo, puntos) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map((q, i) => ({ ...q, id: i + 1, radiusX: 8, radiusY: 8 })) });
  const mando = () => pagina.evaluate(() => { window.mkwControles.paso?.(); const p = window.mkwControles.estado.puertos[0]; return { botones: p.botones, sx: p.sx }; });
  const leer = async () => { await pagina.waitForTimeout(60); return mando(); };
  const fallos = [];
  for (const b of m.botones) {
    await dedos('touchStart', [centro(b)]);
    const r = await leer();
    if ((r.botones & TEXTO_BIT[b.texto]) === 0 || (r.botones & ~TEXTO_BIT[b.texto]) !== 0) fallos.push(`${b.texto}→${r.botones.toString(16)}`);
    await dedos('touchEnd', []);
  }
  ok(`${orientacion}: tocar cada botón con un dedo aprieta ese botón y ningún otro`, fallos.length === 0,
     fallos.join(', ') || m.botones.map(b => b.texto).join(' '));
  const libre = await leer();
  ok(`${orientacion}: al levantar el dedo no queda nada apretado`, libre.botones === 0 && libre.sx === 0);

  // Dos dedos: el stick a la derecha mientras se sostiene A (doblar acelerando)
  const a = m.botones.find(b => b.texto === 'A');
  const c = centro(m.aro);
  await dedos('touchStart', [centro(a)]);
  await dedos('touchStart', [centro(a), c]);
  await dedos('touchMove', [centro(a), { x: c.x + m.aro.w * 0.45, y: c.y }]);
  const dos = await leer();
  ok(`${orientacion}: dos dedos — A apretado y el stick a la derecha`, (dos.botones & BOTON.A) !== 0 && dos.sx > 90, `botones ${dos.botones.toString(16)}, sx ${dos.sx}`);
  await dedos('touchEnd', []);
  const fin = await leer();
  ok(`${orientacion}: al levantar los dos dedos se suelta todo`, fin.botones === 0 && fin.sx === 0, `botones ${fin.botones}, sx ${fin.sx}`);
  console.log(`  (${orientacion}: tamaño máximo sin problemas ${maxBien} %)`);
  await contexto.close();
}

await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
