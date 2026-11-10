// Prueba de la bienvenida con el juego de verdad (bitácora §263).
//
// Resumen: abre la página del juego en un perfil nuevo con ?bienvenida=1 (Playwright no la ve sin eso:
// navigator.webdriver) y comprueba que el mensaje de los ajustes:
//   - sale recién cuando la cortina de carga se fue (no tapa la carga) y el juego sigue andando debajo;
//   - mientras está, el juego no recibe lo de la persona (controles silenciados) y vuelve a recibirlo al cerrarlo;
//   - «Elegir imagen» lo cierra y deja el cajón en Avanzado con el selector «Imagen» con el foco y marcado;
//   - en un teléfono (Pixel 7 emulado) trae la tarjeta del celular, cabe en la pantalla y esconde el mando en pantalla;
//   - en una carrera (?modo=directa, 12 CPU) no sale nunca mientras corre;
//   - la Ayuda de ajustes está arriba en Avanzado y «Ver el mensaje de bienvenida» lo vuelve a abrir.
// Fotos en build/web/datos/bienvenida/ (escritorio, el ajuste marcado, teléfono parado y acostado, la Ayuda).
//
// Uso:  node web/navegador/prueba-bienvenida.mjs [--ventana] [--puerto N]   (con el candado: herramientas/candado.sh)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const PUERTO = Number(arg('--puerto')) || 8137;
const carpeta = path.join(raiz, 'build/web/datos/bienvenida');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle !== '' ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const servidor = await new Promise(r => {
  const s = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
  s.stdout.on('data', d => { if (String(d).includes('juego en')) r(s); });
});
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });
const URL0 = `http://127.0.0.1:${PUERTO}/`;
const mirar = p => p.evaluate(() => ({
  cortina: !document.body.classList.contains('sin-cortina'), abierto: !!document.getElementById('bienvenida')?.open,
  cuadros: window.mkwEstado?.cuadros || 0, silenciado: !!window.mkwControles?.silenciado, carrera: !!window.mkwEstado?.enCarrera,
  tarjetas: [...document.querySelectorAll('#bienvenida .bv-tarjeta')].map(t => t.dataset.caso),
}));
// mirar cada 100 ms hasta que se cumpla; devuelve también la línea de tiempo (para «la cortina se fue antes»)
const hasta = async (p, cond, ms) => {
  const linea = []; let m = null;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(100)) {
    m = await mirar(p).catch(() => null);
    if (m) linea.push({ t: Date.now() - t0, ...m });
    if (m && cond(m)) break;
  }
  return { m, linea };
};

let codigo = 1;
try {
  // ---------- A) escritorio, perfil nuevo ----------
  const c1 = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  const p1 = await c1.newPage();
  const errores = []; p1.on('pageerror', e => errores.push(e.message));
  await p1.goto(URL0 + '?bienvenida=1');
  const { m: a, linea } = await hasta(p1, x => x.abierto, 120000);
  ok('en un perfil nuevo, sale', !!a?.abierto, a ? `a los ${linea.at(-1).t} ms` : 'no salió');
  ok('no tapa la carga: nunca abierto con la cortina puesta', !linea.some(x => x.abierto && x.cortina));
  ok('en el PC: 3 tarjetas (lento, mando, sala)', a?.tarjetas.join() === 'lento,mando,sala', a?.tarjetas.join());
  const c0 = a?.cuadros || 0; await espera(1500);
  const a2 = await mirar(p1);
  ok('con el mensaje abierto, el juego sigue andando debajo', a2.cuadros > c0 + 30, `${c0} → ${a2.cuadros} cuadros`);
  ok('…y no recibe lo de la persona (controles silenciados)', a2.silenciado);
  ok('el foco está en «¡A jugar!»', await p1.evaluate(() => document.activeElement?.id === 'bienvenidaJugar'));
  await p1.screenshot({ path: path.join(carpeta, 'escritorio.png') });
  await p1.locator('#bienvenida [data-bv="imagen"]').click();
  await espera(400);
  const ir = await p1.evaluate(() => ({ abierto: !!document.getElementById('bienvenida')?.open, cajon: document.body.classList.contains('cajon-abierto'),
    hoja: !document.getElementById('hojaAvanzado').hidden, foco: document.activeElement?.id, marcado: !!document.querySelector('.bv-resaltado #graficosN8, #graficosN8.bv-resaltado') || !!document.getElementById('graficosN8')?.closest('.bv-resaltado'),
    silenciado: !!window.mkwControles?.silenciado, visto: localStorage.getItem('mkw.bienvenida.version') }));
  ok('«Elegir imagen»: cierra el mensaje, abre Avanzado y deja el foco en «Imagen» marcado', !ir.abierto && ir.cajon && ir.hoja && ir.foco === 'graficosN8' && ir.marcado, JSON.stringify(ir));
  ok('cerrado: el juego vuelve a recibir lo de la persona y queda «visto» (versión guardada)', !ir.silenciado && ir.visto === '1');
  await p1.screenshot({ path: path.join(carpeta, 'ajuste-marcado.png') });
  // la Ayuda, arriba en Avanzado
  await p1.evaluate(() => { document.getElementById('hojaAvanzado').scrollTop = 0; document.querySelector('#ayudaAjustes [data-caso="lento"]').open = true; });
  await espera(200);
  const ay = await p1.evaluate(() => ({ casos: [...document.querySelectorAll('#ayudaAjustes details')].map(d => d.dataset.caso), primero: document.querySelector('#hojaAvanzado h3')?.textContent }));
  ok('la Ayuda de ajustes está primera en Avanzado, con los 4 casos del PC', ay.primero === '❓ Ayuda de ajustes' && ay.casos.join() === 'lento,mando,sala,espacio', JSON.stringify(ay));
  await p1.screenshot({ path: path.join(carpeta, 'ayuda.png') });
  await p1.locator('#ayudaVerMensaje').click(); await espera(400);
  ok('«Ver el mensaje de bienvenida» lo vuelve a abrir (y cierra el cajón)', (await mirar(p1)).abierto && !(await p1.evaluate(() => document.body.classList.contains('cajon-abierto'))));
  await p1.keyboard.press('Escape'); await espera(300);
  ok('Esc lo cierra', !(await mirar(p1)).abierto);
  ok('sin errores en la página', !errores.length, errores.join(' | '));
  await c1.close();

  // ---------- B) teléfono (Pixel 7), parado y acostado ----------
  for (const [nombre, disp] of [['telefono', devices['Pixel 7']], ['telefono-acostado', devices['Pixel 7 landscape']]]) {
    const c = await navegador.newContext({ ...disp });
    const p = await c.newPage();
    await p.goto(URL0 + '?bienvenida=1');
    const { m } = await hasta(p, x => x.abierto, 120000);
    const caja = await p.evaluate(() => { const r = document.getElementById('bienvenida').getBoundingClientRect(); const t = document.querySelector('.mkw-tactil');
      return { dentro: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1, tactil: t ? getComputedStyle(t).visibility : 'sin',
               jugar: document.getElementById('bienvenidaJugar').getBoundingClientRect().height }; });
    ok(`${nombre}: sale con la tarjeta del celular (4)`, m?.abierto && m.tarjetas.length === 4 && m.tarjetas.includes('celular'), m?.tarjetas.join());
    ok(`${nombre}: cabe en la pantalla, «¡A jugar!» de 44 px o más y el mando en pantalla escondido`, caja.dentro && caja.jugar >= 44 && caja.tactil !== 'visible', JSON.stringify(caja));
    await p.screenshot({ path: path.join(carpeta, nombre + '.png') });
    await c.close();
  }

  // ---------- C) en una carrera no sale ----------
  const c3 = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  const p3 = await c3.newPage();
  await p3.goto(URL0 + '?bienvenida=1&modo=directa&pista=0.0&cpu=normal&semilla=1234');
  const { m: enc } = await hasta(p3, x => x.carrera, 180000);
  ok('la carrera directa largó', !!enc?.carrera);
  let abiertoEnCarrera = 0, muestras = 0;
  for (let i = 0; i < 200; i++) { const x = await mirar(p3); if (x.carrera) { muestras++; if (x.abierto) abiertoEnCarrera++; } await espera(100); }
  ok('con la carrera andando no sale nunca (20 s mirando cada 100 ms)', muestras > 100 && abiertoEnCarrera === 0, `${abiertoEnCarrera} de ${muestras}`);
  await c3.close();
  codigo = mal ? 1 : 0;
} catch (e) {
  ok('la prueba terminó sin errores', false, e?.stack || String(e));
} finally {
  await navegador.close().catch(() => {});
  servidor.kill();
}
console.log(`fin: ${bien} bien, ${mal} mal`);
process.exit(codigo);
