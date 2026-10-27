// Saca una foto y un videíto de cada pista de Retro Rewind, con el juego de verdad, para elegir pista — bitácora §56.
//
// Resumen: abre el juego en Chrome (Playwright, sin sonido) en «Carrera», sin CPU, y recorre TODAS las pistas:
//   1. llega la presentación de la pista (sección 0x1a, la cámara que vuela sobre la pista). Se esconden los letreros
//      del juego («150cc VS 1/4», el nombre de la pista): el juego dibuja sus pantallas en "capas" y la cantidad de
//      capas está en la sección (+0x37C); se pone en 0 mientras se graba y después se devuelve (modificar el juego
//      está permitido). A los 1,2 s (aparece desde negro) se graban 20 cuadros, uno cada 100 ms (2 s de vuelo,
//      288×162), que se juntan en un WebP animado (herramientas/webp-animado.mjs), y una foto limpia de 480×270 (de
//      dos candidatas, la más clara). Si la presentación sale negra (algunas pistas nuevas), se graba en la largada. Se comprueba en CupsConfig que es la
//      pista pedida;
//   2. A salta la presentación; Start abre la pausa (página 0x19); abajo, abajo, A = «Cambiar pista»: vuelve a la
//      pantalla de copas (sección 0x4b) sin recargar nada;
//   3. ahí se deja escrita la pista siguiente en CupsConfig (como hace el piloto) y A, A… hasta la carrera.
// Unos 12 s por pista. Se puede cortar y seguir: salta las fotos que ya existen.
// Salida: build/web/navegador/imagenes/pistas/<número de pista en hex>.webp (foto), clips/<hex>.webp (videíto),
// pistas.json (los nombres, del juego) y archivos.json (qué archivo .szs es cada pista, para su plano).
// Son imágenes y textos del juego: build/ nunca va a git; van a R2 con el .wasm y el Worker los da solo a los amigos.
//
// Uso:  node herramientas/fotos-pistas.mjs [--desde N] [--hasta N] [--rehacer] [--ventana]   (N = pista 0..359)
//       --rehacer: vuelve a sacar las que ya existen.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { webpAnimado } from './webp-animado.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const PUERTO = opcion('--puerto', 8146);
const carpeta = path.join(raiz, 'build/web/navegador/imagenes/pistas');
const carpetaClips = path.join(carpeta, '..', 'clips');
mkdirSync(carpeta, { recursive: true }); mkdirSync(carpetaClips, { recursive: true });
const rehacer = args.includes('--rehacer');
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const pagina = await navegador.newPage({ viewport: { width: 960, height: 540 } });
pagina.on('pageerror', e => console.log('[pageerror] ' + e.message));
// Qué archivo de pista baja el juego al cargar cada una (para dibujar su plano desde su course.kmp): el último
// RetroRewind6/…/Tracks/*.szs pedido antes de la presentación. Va a archivos.json (número de pista → archivo).
let ultimoArchivo = '';
pagina.on('request', r => { const u = decodeURIComponent(new URL(r.url()).pathname); if (/RetroRewind6\/(?:CT\/|BT\/)?Tracks\/[^/]+\.szs$/.test(u)) ultimoArchivo = u.replace(/^\/mkw\/sd\//, ''); });
const rutaArchivos = path.join(carpeta, '..', 'archivos.json');
const archivos = existsSync(rutaArchivos) ? JSON.parse(readFileSync(rutaArchivos, 'utf8')) : {};

// En la página: leer la pantalla, apretar botones (la fuente «piloto» de controles.mjs) y escribir CupsConfig
const estado = () => pagina.evaluate(() => { const e = window.mkwMenus?.estado(); return e ? { s: e.seccion, p: e.pagina, ps: e.paginas } : { s: -1, p: -1, ps: [] }; });
const toque = (bit, ms = 110) => pagina.evaluate(async ([b, t]) => { window.mkwControles.pilotar(b); await new Promise(r => setTimeout(r, t)); window.mkwControles.pilotar(0); await new Promise(r => setTimeout(r, 120)); }, [bit, ms]);
const A = 0x0100, ABAJO = 0x0004, START = 0x1000;
async function hasta(cond, ms, accion = null, cada = 900) {
  const t0 = Date.now();
  let ultimo = 0;
  while (Date.now() - t0 < ms) {
    const e = await estado();
    if (cond(e)) return e;
    if (accion && Date.now() - ultimo > cada) { ultimo = Date.now(); await accion(e); }
    await espera(80);
  }
  return null;
}
const pedir = n => pagina.evaluate(([n]) => {      // dejar elegida la pista n (0x100 + n) en CupsConfig
  const L = window.mkwMenus, C = 0x8043319C, p = 0x100 + n;
  L.w32(C, 0x40 + (n >> 2)); L.w32(C + 0x10, p); L.w32(C + 0x14, p);
}, [n]);
// Grabar: esconde las capas (los letreros), saca 20 cuadros chicos cada 100 ms y la foto grande al medio, y las devuelve
const grabar = () => pagina.evaluate(async () => {
  const L = window.mkwMenus, sec = L.u32(L.u32(0x809C1E38)), capas = L.u32(sec + 0x37C);
  const lienzo = document.getElementById('canvas');
  const copia = (w, h, q) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(lienzo, 0, 0, w, h); return c.toDataURL('image/webp', q); };
  // Un lienzo WebGPU solo tiene su imagen dentro de la misma tarea en que se dibujó: después queda negro. Por eso la
  // copia se hace en una "microtarea" anotada cuando el juego pide el lienzo para dibujar (getCurrentTexture): corre
  // apenas el cuadro termina (el juego se detiene a esperar el próximo refresco) y antes de que la imagen se borre.
  if (!window.mkwCaptura) {
    const original = GPUCanvasContext.prototype.getCurrentTexture;
    window.mkwCaptura = { pedidos: [] };
    GPUCanvasContext.prototype.getCurrentTexture = function () {
      const t = original.call(this);
      const pedidos = window.mkwCaptura.pedidos.splice(0);
      if (pedidos.length) queueMicrotask(() => pedidos.forEach(f => f()));
      return t;
    };
  }
  // brillo medio de una copia (0..255): para no quedarse con un cuadro todavía oscuro (la presentación aparece desde negro)
  const brillo = url => new Promise(r => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = 32; c.height = 18;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0, 32, 18); const d = g.getImageData(0, 0, 32, 18).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] + d[k + 1] + d[k + 2]; r(s / (d.length / 4) / 3); }; i.src = url; });
  const enCuadro = (w, h, q) => new Promise(r => window.mkwCaptura.pedidos.push(() => r(copia(w, h, q))));
  L.w32(sec + 0x37C, 0);
  const cuadros = [];
  let foto = '';
  try {
    await new Promise(r => setTimeout(r, 150));                       // que se dibuje un cuadro sin letreros
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      cuadros.push(await enCuadro(288, 162, 0.6));
      if (i === 6 || i === 14) { const f = await enCuadro(480, 270, 0.82), b = await brillo(f); if (!foto || b > foto.b + 8) foto = { url: f, b }; }
      await new Promise(r => setTimeout(r, Math.max(0, 100 - (performance.now() - t))));
    }
  } finally { L.w32(sec + 0x37C, capas); }
  return { cuadros, foto: foto.url, brillo: foto.b };
});
const aBuffer = u => Buffer.from(u.split(',')[1], 'base64');

// 1) La primera pista con el piloto de la página
const desde = opcion('--desde', 0);
await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=vs&copa=${desde >> 2}&fila=${desde & 3}&cpu=ninguna`);
await pagina.waitForFunction(() => window.mkwEstado?.piloto, null, { timeout: 180000, polling: 500 });
const nombres = await pagina.evaluate(async () => (await import('/menus.mjs')).leerNombres(window.mkwMenus, window.mkw));
writeFileSync(path.join(carpeta, '..', 'pistas.json'), JSON.stringify(nombres));
const total = Math.min(opcion('--hasta', nombres.length * 4 - 1), nombres.length * 4 - 1);
console.log(`${nombres.length} copas, ${nombres.length * 4} pistas; fotos de la ${desde} a la ${total}`);

let bien = 0, mal = 0, oscura = false;
for (let n = desde; n <= total; n++) {
  const archivo = path.join(carpeta, (0x100 + n).toString(16) + '.webp');
  let clip = '';
  // 2) la presentación
  const enPresentacion = await hasta(e => e.s === 0x1a, 60000);
  if (!enPresentacion) { console.log(`✗ ${n}: no llegó la presentación`); mal++; break; }
  await espera(1200);                                  // la presentación aparece desde negro: se espera a que se vea
  const ganadora = await pagina.evaluate(() => window.mkwMenus.u32(0x8043319C + 0x10));
  if (ganadora === 0x100 + n) {
    clip = path.join(carpetaClips, (0x100 + n).toString(16) + '.webp');
    if (rehacer || !existsSync(archivo) || !existsSync(clip)) {
      const { cuadros, foto, brillo } = await grabar();
      writeFileSync(archivo, aBuffer(foto));
      writeFileSync(clip, webpAnimado(cuadros.map(aBuffer), { ms: 100 }));
      oscura = brillo < 14;                            // presentación negra (pasa en algunas pistas nuevas)
    }
    if (ultimoArchivo) { archivos[(0x100 + n).toString(16)] = ultimoArchivo; writeFileSync(rutaArchivos, JSON.stringify(archivos, null, 1)); }
    ultimoArchivo = '';
    bien++;
    console.log(`✓ ${n} (0x${(0x100 + n).toString(16)}) ${nombres[n >> 2]?.[n & 3] || ''} · ${archivos[(0x100 + n).toString(16)] || '¿archivo?'}`);
  } else { mal++; console.log(`✗ ${n}: corre la 0x${ganadora.toString(16)}`); }
  if (n === total && !oscura) break;
  // 3) saltar la presentación, pausa, «Cambiar pista»
  await hasta(e => e.s === 0x20, 20000, () => toque(A), 700);
  await espera(800);
  if (oscura) {                                        // entonces la foto y el videíto salen de la largada
    const { cuadros, foto, brillo } = await grabar();
    writeFileSync(archivo, aBuffer(foto));
    writeFileSync(clip, webpAnimado(cuadros.map(aBuffer), { ms: 100 }));
    console.log(`  · ${n}: la presentación es negra; foto de la largada (brillo ${brillo.toFixed(0)})`);
    oscura = false;
  }
  if (n === total) break;
  const pausa = await hasta(e => e.ps.includes(0x19), 8000, () => toque(START), 1200);
  if (!pausa) { console.log(`✗ ${n}: no abrió la pausa`); mal++; break; }
  // (la copa y la pista siguientes se escriben ANTES de abrir la pantalla de copas: la lee al abrirse)
  await pedir(n + 1);
  await espera(300); await toque(ABAJO); await toque(ABAJO); await toque(A);
  const copas = await hasta(e => e.p === 0x6e, 15000);
  if (!copas) { console.log(`✗ ${n}: no volvió a las copas`); mal++; break; }
  await espera(500);
  // 4) A hasta que empiece la siguiente (copas → pistas → variante → «OK» → carrera)
  await hasta(e => e.s > 0 && e.s < 0x30, 30000, () => toque(A), 1000);
}
console.log(`\n${bien} fotos bien, ${mal} mal`);
await navegador.close();
servidor.kill();
process.exit(mal ? 1 : 0);
