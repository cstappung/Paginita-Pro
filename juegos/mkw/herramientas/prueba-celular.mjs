// Prueba del CELULAR sin el juego (bitácora §113: «coloca compatibilidad con móviles» y «los controles virtuales deben
// ser reajustables en tamaño y posición, tal como en BT3; también permite agregar u ocultar botones»).
//
// Resumen: abre web/navegador/index.html con banco/servir.cjs en un Pixel 7 emulado (pantalla táctil, sin ratón) y
// prueba lo que hace una persona con el dedo: el mando en pantalla se prende solo; la hoja Controles tiene la sección
// «Celular» (prender/apagar el mando, su tamaño y su opacidad con − y +, dirigir inclinando) y no muestra la columna del
// teclado; «✏️ Mover, agrandar…» cierra el cajón y abre el editor sobre el juego: arrastrar A la mueve, «+» la agranda,
// B se oculta, X («Mirar atrás») se agrega; con el editor cerrado, un dedo donde quedó A aprieta A (y donde estaba, ya
// no); todo se recuerda al recargar y se guarda aparte acostado y parado; el aviso «Gira el teléfono» sale solo jugando
// parado; la resolución de salida empieza en 720 en un teléfono; a lo ancho no hay desborde. Deja fotos en
// build/web/datos/celular-*.png.
//
// Uso:  node herramientas/prueba-celular.mjs [puerto]   (Chrome: el de Playwright, o CHROME=ruta)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const req = createRequire(new URL('../banco/package.json', import.meta.url));
const { chromium, devices } = req('playwright-core');
const PUERTO = process.argv[2] || '8155';
const srv = spawn(process.execPath, [fileURLToPath(new URL('../banco/servir.cjs', import.meta.url)), PUERTO], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => setTimeout(r, 1200));
const S = fileURLToPath(new URL('../build/web/datos', import.meta.url)); fs.mkdirSync(S, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ ...devices['Pixel 7'] });               // 412×915, toque, sin ratón
const p = await ctx.newPage();
p.setDefaultTimeout(5000);                                                // (una falla no deja la prueba colgada)
const errores = []; p.on('pageerror', e => errores.push(e.message));
let bien = 0, mal = 0;
const ok = (n, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${n}${d !== '' ? ' — ' + d : ''}`); };
const espera = ms => p.waitForTimeout(ms);
const DIR = `http://127.0.0.1:${PUERTO}/web/navegador/index.html?portada=1&inicio=0`;
const centro = async sel => { const c = await p.locator(sel).first().boundingBox(); return [c.x + c.width / 2, c.y + c.height / 2]; };
const toca = async sel => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.locator(sel).first().tap(); await espera(200); };
// un dedo con Pointer Events (lo que escuchan el mando y el editor): bajar, mover en pasos, levantar
const dedo = async (x0, y0, x1 = x0, y1 = y0, soltar = true) => {
  await p.mouse.move(x0, y0); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8);
  if (soltar) await p.mouse.up();
  await espera(120);
};

// (sin el juego, la portada tapa el recuadro: como prueba-tactil.mjs, se marca «el juego andando»)
const andando = () => p.evaluate(() => document.body.classList.add('started', 'sin-cortina', 'girar-visto'));
await p.goto(DIR); await espera(1500); await andando();
const est = () => p.evaluate(() => ({ tactil: document.body.classList.contains('tactil'), visible: getComputedStyle(document.querySelector('.mkw-tactil')).display !== 'none',
  telefono: window.mkwCelular?.esTelefono, ajustes: window.mkwControles.ajustesTactil(), graficos: JSON.parse(localStorage.getItem('mkw.graficos') || 'null') }));
const e0 = await est();
ok('un teléfono: el mando en pantalla se prende solo', e0.telefono && e0.tactil && e0.visible, JSON.stringify({ telefono: e0.telefono, tactil: e0.tactil }));
ok('la primera vez en un teléfono, la resolución de salida empieza en 720', e0.graficos?.salida === 720, JSON.stringify(e0.graficos));

// ---- la hoja Controles en el teléfono ----
await p.evaluate(() => window.mkwInterfaz.abrirCajon('controles')); await espera(400);
const h = await p.evaluate(() => ({ celular: !document.querySelector('.ctl-celular').hidden, teclado: document.querySelector('.ctl').classList.contains('con-teclado'),
  pestana: document.querySelector('.ctl-pestana[data-jugador="0"]').textContent, titulo: document.querySelector('.ctl-titulo').textContent,
  desborde: document.getElementById('hojaControles').scrollWidth - document.getElementById('hojaControles').clientWidth }));
ok('la hoja Controles tiene la sección «Celular» y no la columna del teclado', h.celular && !h.teclado, JSON.stringify(h));
ok('el jugador 1 dice «📱 En pantalla» y el título «📱 Mando en pantalla»', /En pantalla/.test(h.pestana) && /Mando en pantalla/.test(h.titulo));
ok('a 412 px la hoja no se sale a lo ancho', h.desborde <= 0, `${h.desborde} px`);
await p.locator('#hojaControles').screenshot({ path: `${S}/celular-controles.png` });
const botonCelular = t => `button:text-is("${t}")`;
await toca(`.ctl-celular .fila:has-text("Mando en pantalla") ${botonCelular('No')}`);
ok('«No»: el mando en pantalla se apaga (y se recuerda)', !(await est()).tactil && (await est()).ajustes.activo === false);
await toca(`.ctl-celular .fila:has-text("Mando en pantalla") ${botonCelular('Sí')}`);
ok('«Sí»: vuelve', (await est()).tactil && (await est()).visible);
await toca(`.ctl-celular .fila:has-text("Tamaño") ${botonCelular('+')}`);
await toca(`.ctl-celular .fila:has-text("Opacidad") ${botonCelular('−')}`);
const a1 = (await est()).ajustes;
ok('tamaño + y opacidad − con el dedo (sin barras deslizantes)', Math.abs(a1.esc - 1.05) < 0.001 && Math.abs(a1.opa - 0.9) < 0.001, JSON.stringify(a1));
await toca(`.ctl-celular .fila:has-text("inclinando") ${botonCelular('Sí')}`);
ok('dirigir inclinando: se prende y se recuerda', await p.evaluate(() => window.mkwControles.inclinando() && window.mkwControles.ajustesTactil().inclinar === true));
await toca(`.ctl-celular .fila:has-text("inclinando") ${botonCelular('No')}`);

// ---- el editor: mover, agrandar, ocultar, agregar ----
await toca('.ctl-celular button:has-text("Mover, agrandar")');
const ed = await p.evaluate(() => ({ cajon: document.body.classList.contains('cajon-abierto'), editando: document.body.classList.contains('editando-tactil'),
  barra: getComputedStyle(document.querySelector('.mkw-tactil-barra')).display, opacidad: document.querySelector('.mkw-tactil').style.opacity }));
ok('«✏️ Mover, agrandar…» cierra el cajón y abre el editor sobre el juego (opaco mientras se edita)', !ed.cajon && ed.editando && ed.barra === 'flex' && ed.opacidad === '1', JSON.stringify(ed));
const [ax, ay] = await centro('.mkw-tactil [data-pieza="A"]');
await dedo(ax, ay, ax - 90, ay - 140);
const [nx, ny] = await centro('.mkw-tactil [data-pieza="A"]');
ok('arrastrar A la mueve (y queda elegida)', Math.abs(nx - (ax - 90)) < 3 && Math.abs(ny - (ay - 140)) < 3, `${Math.round(ax)},${Math.round(ay)} → ${Math.round(nx)},${Math.round(ny)}`);
await toca('.mkw-tactil-barra button[data-e="mas"]'); await toca('.mkw-tactil-barra button[data-e="mas"]');
ok('«+» dos veces: A al 120 %', await p.evaluate(() => window.mkwControles.piezasTactil().A?.k === 1.2), JSON.stringify(await p.evaluate(() => window.mkwControles.piezasTactil().A)));
const [bx, by] = await centro('.mkw-tactil [data-pieza="B"]');
await dedo(bx, by);
await toca('.mkw-tactil-barra button[data-e="ocultar"]');
ok('tocar B y «Ocultar»: B ya no está', await p.evaluate(() => getComputedStyle(document.querySelector('.mkw-tactil [data-pieza="B"]')).display === 'none'));
const agregar = await p.evaluate(() => [...document.querySelectorAll('.mkw-tactil-barra button[data-e="agregar"]')].map(b => b.textContent));
ok('«Agregar:» ofrece B y los que no vienen puestos (X, Y, Z, la cruz)', ['B (frenar)', 'X (mirar atrás)', 'Z', '↓'].every(t => agregar.some(a => a.includes(t))), agregar.join(' | '));
await toca('.mkw-tactil-barra button[data-pieza="X"]');
ok('«＋ X (mirar atrás)»: X aparece', await p.evaluate(() => getComputedStyle(document.querySelector('.mkw-tactil [data-pieza="X"]')).display !== 'none'));
await p.screenshot({ path: `${S}/celular-editor.png` });
await toca('.mkw-tactil-barra button[data-e="listo"]');
ok('«✓ Listo»: se cierra el editor', await p.evaluate(() => !document.body.classList.contains('editando-tactil') && getComputedStyle(document.querySelector('.mkw-tactil-barra')).display === 'none'));

// ---- jugar: el dedo donde quedó A aprieta A; donde estaba, no ----
const apretado = async (x, y) => {
  await p.mouse.move(x, y); await p.mouse.down(); await espera(80);
  const v = await p.evaluate(() => window.mkwControles.estado.puertos[0].botones);
  await p.mouse.up(); await espera(80);
  return v;
};
const [mx, my] = await centro('.mkw-tactil [data-pieza="A"]');
ok('un dedo donde quedó A aprieta A', ((await apretado(mx, my)) & 0x100) !== 0);
ok('…y donde estaba A antes, ya no', ((await apretado(ax, ay)) & 0x100) === 0);
const [xx, xy] = await centro('.mkw-tactil [data-pieza="X"]');
ok('X (agregado) aprieta X', ((await apretado(xx, xy)) & 0x400) !== 0);

// ---- recargar, y acostado/parado por separado ----
await p.reload(); await espera(1500); await andando();
const r = await p.evaluate(() => ({ piezas: window.mkwControles.piezasTactil(), b: getComputedStyle(document.querySelector('.mkw-tactil [data-pieza="B"]')).display,
  x: getComputedStyle(document.querySelector('.mkw-tactil [data-pieza="X"]')).display, ajustes: window.mkwControles.ajustesTactil() }));
ok('al recargar se recuerda todo (A movida y al 120 %, B oculta, X agregada, tamaño y opacidad)', r.piezas.A?.k === 1.2 && r.b === 'none' && r.x !== 'none' &&
   Math.abs(r.ajustes.esc - 1.05) < 0.001, JSON.stringify(r.piezas));
await p.setViewportSize({ width: 915, height: 412 }); await espera(500);
const acostado = await p.evaluate(() => ({ piezas: window.mkwControles.piezasTactil(), b: getComputedStyle(document.querySelector('.mkw-tactil [data-pieza="B"]')).display }));
ok('acostado es otra disposición (la de siempre: B se ve, A sin mover)', !acostado.piezas.A && acostado.b !== 'none', JSON.stringify(acostado.piezas));
await p.evaluate(() => document.body.classList.remove('girar-visto'));
ok('acostado y jugando: sin el aviso «Gira el teléfono»', await p.evaluate(() => getComputedStyle(document.getElementById('girar')).display === 'none'));
await p.screenshot({ path: `${S}/celular-acostado.png` });
await p.setViewportSize({ width: 412, height: 915 }); await espera(500);
ok('parado y jugando: el aviso «Gira el teléfono» con «⛶ Pantalla completa»', await p.evaluate(() => getComputedStyle(document.getElementById('girar')).display === 'flex'));
await toca('#girarCerrar');
ok('…y se cierra con ✕', await p.evaluate(() => getComputedStyle(document.getElementById('girar')).display === 'none'));
ok('parado vuelve su disposición (A movida)', await p.evaluate(() => window.mkwControles.piezasTactil().A?.k === 1.2));
// ---- §113b: cambiar lo que hace un botón en pantalla ----
await p.evaluate(() => window.mkwCelular.editarTactil()); await espera(300);
const [lx, ly] = await centro('.mkw-tactil [data-pieza="L"]');
await dedo(lx, ly);
await toca('.mkw-tactil-barra button[data-e="hace"]');
await toca('.mkw-tactil-barra button[data-accion="R"]');
ok('tocar L, «Hace» y «R · Derrapar»: ese botón ahora dice R', await p.evaluate(() => document.querySelector('.mkw-tactil [data-pieza="L"]').textContent === 'R' && window.mkwControles.haceTactil().L === 'R'));
await toca('.mkw-tactil-barra button[data-e="listo"]');
ok('…y apretarlo derrapa (R), ya no usa el objeto (L)', await (async () => { const v = await apretado(lx, ly); return (v & 0x20) !== 0 && (v & 0x40) === 0; })());
// la columna «En pantalla» de la lista
await p.evaluate(() => window.mkwInterfaz.abrirCajon('controles')); await espera(400);
const col = await p.evaluate(() => ({ R: document.querySelector('.ctl-fila[data-objetivo="R"] .ctl-chip[data-col="pantalla"]').textContent,
  L: document.querySelector('.ctl-fila[data-objetivo="L"] .ctl-chip[data-col="pantalla"]').textContent, visible: document.querySelector('.ctl').classList.contains('con-pantalla') }));
ok('la lista muestra «En pantalla»: Derrapar = R · R (dos botones), Usar objeto = agregar', col.visible && col.R === 'R · R' && col.L === 'agregar', JSON.stringify(col));
await toca('.ctl-fila[data-objetivo="L"] .ctl-chip[data-col="pantalla"]');
const nuevo = await p.evaluate(() => ({ editando: document.body.classList.contains('editando-tactil'), hace: window.mkwControles.queHaceTactil().L,
  texto: document.querySelector('.mkw-tactil-barra span').textContent }));
ok('tocar «agregar» en Usar objeto: se abre el editor con un botón nuevo que usa el objeto, ya elegido', nuevo.editando && nuevo.hace?.length === 1 && /usar objeto/.test(nuevo.texto), JSON.stringify(nuevo));
await toca('.mkw-tactil-barra button[data-e="listo"]');

// ---- §113c: «Acelerar solo» (la etapa de la carrera, de mentira: Raceinfo +0x28 y la pantalla de arriba) ----
await p.evaluate(() => {
  window.__etapa = 0; window.__pagina = 0x40;
  window.mkwMenus = { u32: a => (a === 0x809BD730 ? 0x80001000 : a === 0x80001028 ? window.__etapa : 0), estado: () => ({ pagina: window.__pagina, seccion: 0x20 }) };
  window.mkwControles.ajustarAyudas({ acelerar: true });
});
const recibe = () => p.evaluate(async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return window.mkwControles.estado.enviados[0] & 0x100; });
await p.evaluate(() => { window.__etapa = 1; });
ok('«Acelerar solo» en la cuenta 3-2-1: NO acelera (la salida rápida es de la persona)', (await recibe()) === 0);
await p.evaluate(() => { window.__etapa = 2; window.__pagina = 0x0E; });
ok('al «¡YA!» (etapa 2, la pantalla de la carrera): acelera solo', (await recibe()) !== 0);
await p.evaluate(() => { window.__pagina = 0x1B; });
ok('con la pausa encima: no (en un menú, A apretado elegiría por la persona)', (await recibe()) === 0);
await p.evaluate(() => { window.__pagina = 0x0E; });
ok('cerrada la pausa: vuelve a acelerar solo', (await recibe()) !== 0);
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })));
ok('frenando (B) no acelera: hay marcha atrás', (await recibe()) === 0);
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' })));
await p.evaluate(() => window.mkwControles.ajustarAyudas({ acelerar: false }));
ok('con «Acelerar solo» en No, no acelera', (await recibe()) === 0);
await espera(250);                                                         // (la hoja se pinta cada 100 ms)
ok('la casilla de la hoja dice lo guardado (No) y se recuerda', await p.evaluate(() => JSON.parse(localStorage.getItem('mkw.ayudas')).acelerar === false &&
   document.querySelector('.ctl-ayudas button[aria-pressed="true"]')?.textContent === 'No'));
// ---- §114: el rendimiento en el teléfono ----
await p.evaluate(() => { localStorage.setItem('mkw.graficos', JSON.stringify({ salida: 0 })); localStorage.removeItem('mkw.graficos.telefono'); });
await p.reload(); await espera(1500); await andando();
ok('quien ya tenía «la de tu pantalla» guardada en el teléfono pasa a 720 (una sola vez)', await p.evaluate(() => JSON.parse(localStorage.getItem('mkw.graficos')).salida === 720 &&
   localStorage.getItem('mkw.graficos.telefono') === '1'));
await p.evaluate(() => localStorage.setItem('mkw.graficos', JSON.stringify({ salida: 0 })));
await p.reload(); await espera(1500); await andando();
ok('…y si después elige «la de tu pantalla», se respeta', await p.evaluate(() => JSON.parse(localStorage.getItem('mkw.graficos')).salida === 0));
await p.evaluate(() => window.mkwInterfaz.abrirCajon('avanzado')); await espera(400);
await toca('#copiarRendimiento'); await espera(300);
const inf = await p.evaluate(() => { try { return JSON.parse(document.getElementById('informeRendimiento').textContent); } catch { return null; } });
ok('«📋 Copiar el informe de rendimiento»: el informe dice teléfono, pantalla, lienzo y qué frena', !!inf && inf.telefono === true && 'pantallaHz' in inf && /×/.test(inf.lienzo) && 'frena' in inf,
   JSON.stringify(inf && { telefono: inf.telefono, hz: inf.pantallaHz, lienzo: inf.lienzo, nota: inf.nota }));
// «🔬 Perfilar la tarjeta» (§115): deja pedida la medida, prende «Mostrar qué frena» y recarga; el medidor queda
// puesto (si el navegador tiene WebGPU) y espera la carrera para medir (aquí no hay carrera: queda pedido)
await toca('#perfilarGpu'); await espera(1500); await andando();
const per = await p.evaluate(() => ({ pedido: localStorage.getItem('mkw.perfilGpu'), detalle: JSON.parse(localStorage.getItem('mkw.graficos') || '{}').verDetalle,
  puesto: !!window.mkwPerfilGpu, webgpu: !!globalThis.GPUCommandEncoder }));
ok('«🔬 Perfilar»: recarga con la medida pedida, «Mostrar qué frena» prendido y el medidor puesto si hay WebGPU',
   per.pedido === '1' && per.detalle === true && per.puesto === per.webgpu, JSON.stringify(per));
ok('sin errores en la página', errores.length === 0, errores.join(' | '));
console.log(`fin: ${bien} bien, ${mal} mal`);
await b.close(); srv.kill();
process.exit(mal ? 1 : 0);
