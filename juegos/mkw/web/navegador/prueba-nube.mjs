// Prueba del banco: las partidas en la nube con el juego de verdad, dentro de la sala falsa del sitio (§65, B6).
//
// Resumen: la sala del sitio le pasa al marco un almacén de partidas (en el sitio, Firebase Storage
// mkw/<uid>/partidas.mkwp; aquí, uno falso en la página de la sala que revisa lo mismo que las reglas). Se simulan
// DOS computadores con dos navegadores vacíos (dos "contextos" de Chrome, cada uno con su IndexedDB):
//   A) Navegador vacío, nube vacía: el juego espera a la nube antes de leer sus partidas («nada que sincronizar»);
//      se crea una licencia con el teclado (como prueba-partidas.mjs) y la partida sube sola a la nube, marcada con
//      el uid de quien juega y copiada al "reino" de la sala (los Uint8Array del marco no le sirven a Firebase).
//   B) Otro navegador vacío, la misma cuenta: baja la partida de la nube ANTES de que el juego la lea, y el juego
//      arranca con la licencia creada en A. Al volver a entrar, nube y navegador ya son iguales (no se baja nada).
//   C) Sin nube (la sala no la conecta): el juego espera solo 4 s y arranca igual con lo de este navegador.
// Fotos en build/web/datos/nube/.
//
// Uso:  node web/navegador/prueba-nube.mjs [--ventana]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8149;
const carpeta = path.join(raiz, 'build/web/datos/nube');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const RUTA = 'mkw/piloto-nube/partidas.mkwp';
const sala = extra => `http://127.0.0.1:${PUERTO}/banco/pruebas/sala-mkw/padre.html?sala=nube&uid=piloto-nube&juego=titulo${extra}`;

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });

// Abre la sala en un navegador nuevo (contexto vacío) y espera a que el juego del marco llegue al título
async function abrir(extra, nubeInicial = null) {
  const contexto = await navegador.newContext({ viewport: { width: 1000, height: 1150 } });
  // la "nube" con que empieza la sala (solo en la página de arriba: el marco es otra ventana)
  if (nubeInicial) await contexto.addInitScript(d => { if (window === window.top) window.__nubeInicial = d; }, nubeInicial);
  const pagina = await contexto.newPage();
  await pagina.goto(sala(extra));
  const marco = await marcoDe(pagina);
  return { contexto, pagina, marco };
}
async function marcoDe(pagina) {
  for (let i = 0; i < 80; i++) {
    const m = pagina.frames().find(f => f !== pagina.mainFrame() && f.url().includes('/index.html'));
    if (m) { await m.waitForFunction(() => (window.mkwEstado?.cuadros || 0) >= 360, null, { timeout: 150000, polling: 250 }); return m; }
    await espera(250);
  }
  throw new Error('la sala no abrió el marco');
}
const licencia1 = marco => marco.evaluate(() => {
  try { const d = window.mkwFS.readFile('/mkw/sd/riivolution/save/RetroWFC/RMCP/rksys.dat'); return String.fromCharCode(...d.subarray(8, 12)); }
  catch { return 'sin archivo'; }
});
const estadoNube = marco => marco.evaluate(() => ({ nube: window.mkwNube ? { ...window.mkwNube.estado } : null,
  nubeLista: window.mkwEstado.nubeLista || 0, lectura: window.mkwEstado.lecturaPartidas || 0 }));
const foto = (marco, nombre) => marco.locator('#canvas').screenshot({ path: path.join(carpeta, nombre + '.png') }).catch(() => {});

let codigo = 1;
try {
  // ---- A) un navegador vacío con la nube vacía ----
  const A = await abrir('&nube=memoria');
  let e = await estadoNube(A.marco);
  ok('A: la sala conectó la nube y el juego leyó sus partidas DESPUÉS de ella', !!e.nube && e.nubeLista > 0 && e.lectura >= e.nubeLista,
     `«${e.nube?.accion}», nube lista a los ${(e.nubeLista / 1000).toFixed(1)} s, partidas leídas a los ${(e.lectura / 1000).toFixed(1)} s`);
  // crear la licencia 1 con el teclado (el foco en el lienzo del marco): A en el título, NEW, OK, Mii, OK, OK, OK
  await A.marco.evaluate(() => document.getElementById('canvas').focus());
  const toque = async ms => { await A.pagina.keyboard.down('KeyK'); await espera(120); await A.pagina.keyboard.up('KeyK'); await espera(ms); };
  for (const ms of [2500, 2000, 2500, 2500, 2500, 3000, 3500]) await toque(ms);
  ok('A: el juego escribió la licencia', (await licencia1(A.marco)) === 'RKPD');
  await foto(A.marco, 'a-licencia');
  // guardado.mjs la guarda en IndexedDB y avisa; la nube la sube unos segundos después (sola, sin apretar nada; como
  // mucho una vez cada 30 s, y el juego ya había escrito sus archivos al arrancar): esperar a que la nube tenga
  // exactamente lo de este navegador
  const huellaLocal = () => A.marco.evaluate(async () => {
    const { huellaDe } = await import('./nube.mjs');
    return huellaDe(await window.mkwGuardado.cargar());
  });
  const huellaArriba = () => A.pagina.evaluate(r => window.salaFalsa.storage.objetos.get(r)?.meta.huella || '', RUTA);
  let subio = false, t0 = Date.now(), local = '';
  while (Date.now() - t0 < 75000) {
    local = await huellaLocal();
    if (local && local === await huellaArriba()) { subio = true; break; }
    await espera(1000);
  }
  const arriba = await A.pagina.evaluate(r => {
    const s = window.salaFalsa.storage, o = s.objetos.get(r);
    if (!o) return null;
    let bin = '';
    for (let i = 0; i < o.bytes.length; i += 0x8000) bin += String.fromCharCode(...o.bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), meta: o.meta, tam: o.bytes.length, ops: s.ops.join(','), reinoAjeno: s.reinoAjeno, rechazos: s.rechazos };
  }, RUTA);
  ok('A: la partida subió sola a la nube, marcada con el uid de quien juega', subio && arriba?.meta.uid === 'piloto-nube' && /^[0-9a-f]{64}$/.test(arriba?.meta.huella || ''),
     arriba ? `${(arriba.tam / 1024).toFixed(1)} KB, huella ${arriba.meta.huella.slice(0, 12)}…, pedidos ${arriba.ops}, rechazos ${arriba.rechazos}` : 'no subió');
  ok('A: lo que subió venía de otro "reino" y la sala lo copió (como el sitio, para Firebase)', arriba?.reinoAjeno === true);
  ok('A: la nube quedó con lo último de ese navegador (la misma huella)', subio && local === arriba?.meta.huella,
     `a los ${((Date.now() - t0) / 1000).toFixed(0)} s de crear la licencia`);
  await A.contexto.close();

  // ---- B) OTRO navegador vacío, la misma cuenta: la nube tiene la partida de A ----
  const nubeInicial = arriba ? { [RUTA]: { b64: arriba.b64, meta: arriba.meta } } : {};
  const B = await abrir('&nube=memoria', nubeInicial);
  e = await estadoNube(B.marco);
  ok('B: bajó la partida de la cuenta ANTES de que el juego la leyera', /^bajada/.test(e.nube?.accion || '') && e.nube.bajadas === 1 && e.lectura >= e.nubeLista,
     `«${e.nube?.accion}»`);
  ok('B: el juego arrancó con la licencia creada en A', (await licencia1(B.marco)) === 'RKPD');
  await foto(B.marco, 'b-con-la-partida-de-a');
  // volver a entrar en B: ya son iguales, no se baja ni se sube nada
  await B.pagina.reload();
  B.marco = await marcoDe(B.pagina);
  e = await estadoNube(B.marco);
  const ops = await B.pagina.evaluate(() => window.salaFalsa.storage.ops.join(','));
  ok('B: al volver a entrar, nube y navegador ya son iguales (solo se preguntó la huella)', e.nube?.accion === 'iguales' && ops === 'meta',
     `«${e.nube?.accion}», pedidos ${ops}`);
  await B.contexto.close();

  // ---- C) la sala no conecta la nube: el juego espera solo 4 s y arranca con lo de este navegador ----
  const C = await abrir('&nube=no');
  e = await estadoNube(C.marco);
  ok('C: sin nube el juego arranca igual (esperó la nube 4 s y siguió con lo local)', !e.nube && e.lectura >= 3900 && e.lectura < 8000,
     `partidas leídas a los ${(e.lectura / 1000).toFixed(1)} s`);
  await C.contexto.close();
  codigo = mal ? 1 : 0;
} catch (err) {
  console.log('✗ la prueba se cortó — ' + (err && err.stack || err));
} finally {
  console.log(`\n${bien} ✓ · ${mal} ✗`);
  await navegador.close().catch(() => {});
  servidor.kill();
  process.exit(codigo);
}
