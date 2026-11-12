// Fotos de cómo se ve Mario Kart Wii («JloKart Wii») en la sección Juegos del sitio, al lado de los otros juegos (§266).
//
// Qué hace, paso a paso:
//   1. Arma un paquete de VISTA PREVIA del sitio (`juegos-app.js`) con esbuild desde `terceros/Paginita-Pro/colabtex/src`,
//      igual que el de verdad salvo una línea: en `bt3-amigos.js` la lista de amigos dice «sí» a todos. Así Mario Kart
//      sale en el salón y en Novedades sin iniciar sesión ni emuladores de Firebase (en el sitio real solo lo ven los
//      amigos de la lista del Worker). Ese paquete va a `build/vistas/salon-mkw/` y nunca se publica.
//   2. Sirve la carpeta del sitio (como GitHub Pages) en 127.0.0.1 y, cuando la página pide `juegos-app.js`, le da el
//      paquete de vista previa. Todo lo que va a Firebase o a Google (salvo las fuentes) se corta: la página queda como
//      invitado, sin red.
//   3. Abre Chrome sin ventana (Playwright, `--mute-audio`) en escritorio (1440×900) y en celular (Pixel 7), en claro y
//      en oscuro, y saca: el banner de Novedades en la diapositiva de MKW (si hay), la fila «Para jugar solo», la
//      grilla de multijugador alrededor de MKW, y la ficha abierta de MKW.
//
// Uso:  node herramientas/vistas-salon-mkw.mjs <etiqueta>      (p. ej. «antes» o «despues»)
//       → build/vistas/salon-mkw-<etiqueta>-<aparato>-<tema>-<parte>.png
import { opcionesNavegador } from './navegador.mjs';   // §289: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const sitio = path.join(raiz, 'terceros/Paginita-Pro');
const etiqueta = process.argv[2] || 'vista';
const SALIDA = path.join(raiz, 'build/vistas');
const PAQ = path.join(SALIDA, 'salon-mkw');
fs.mkdirSync(PAQ, { recursive: true });

// 1) El paquete de vista previa (esbuild del sitio, con la lista de amigos abierta)
const reqSitio = createRequire(path.join(sitio, 'colabtex/package.json'));
const esbuild = reqSitio('esbuild');
const amigosAbiertos = {
  name: 'amigos-abiertos',
  setup(b) {
    b.onLoad({ filter: /bt3-amigos\.js$/ }, a => ({
      contents: fs.readFileSync(a.path, 'utf8').replace('let visible = false', 'let visible = true'),   // la única diferencia
      loader: 'js',
    }));
  },
};
const paquete = path.join(PAQ, 'juegos-app-vista.js');
await esbuild.build({
  entryPoints: [path.join(sitio, 'colabtex/src/juegos-main.js')], bundle: true, minify: true, format: 'iife',
  target: 'es2020', outfile: paquete, plugins: [amigosAbiertos], logLevel: 'error',
});

// 2) El sitio servido en 127.0.0.1 (la página pide juegos-app.js → el de vista previa)
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const srv = http.createServer((q, r) => {
  const ruta = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = ruta === '/juegos-app.js' ? paquete : path.join(sitio, ruta === '/' ? 'juegos.html' : ruta);
  if (!f.startsWith(sitio) && f !== paquete) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    r.end(d);
  });
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;

// 3) Chrome sin ventana: escritorio y celular, claro y oscuro
const reqBanco = createRequire(path.join(raiz, 'banco/package.json'));
const { chromium, devices } = reqBanco('playwright-core');
const nav = await chromium.launch({ channel: process.env.CHROME ? undefined : 'chrome', ...(process.env.CHROME ? { executablePath: process.env.CHROME } : opcionesNavegador()), headless: true, args: ['--mute-audio'] });
const APARATOS = {
  escritorio: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  celular: { ...devices['Pixel 7'] },
};
const hechas = [];
const espera = ms => new Promise(r => setTimeout(r, ms));
try {
  for (const [aparato, opc] of Object.entries(APARATOS)) {
    for (const tema of ['claro', 'oscuro']) {
      const ctx = await nav.newContext({ ...opc, colorScheme: tema === 'oscuro' ? 'dark' : 'light', reducedMotion: 'no-preference' });
      await ctx.addInitScript(t => { try { localStorage.setItem('jg.tema', t); } catch (e) {} }, tema);
      // sin red hacia afuera, salvo las fuentes de Google (el sitio las usa en los títulos)
      await ctx.route(/^https?:\/\//, rt => {
        const u = rt.request().url();
        if (u.startsWith(BASE) || /fonts\.(googleapis|gstatic)\.com/.test(u)) return rt.continue();
        return rt.abort();
      });
      const p = await ctx.newPage();
      const foto = async (parte, loc) => {
        const f = path.join(SALIDA, `salon-mkw-${etiqueta}-${aparato}-${tema}-${parte}.png`);
        try { await loc.screenshot({ path: f, animations: 'disabled' }); hechas.push(path.relative(raiz, f)); }
        catch (e) { console.log(`  (sin foto ${parte}: ${String(e.message).split('\n')[0]})`); }
      };
      await p.goto(BASE + '/juegos.html', { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('#vesSalon', { timeout: 30000 });
      await espera(2500);
      // a) el banner de Novedades en la diapositiva de MKW (si existe): se pulsa su punto
      const ban = p.locator('#vesBanner');
      if (await ban.count()) {
        const titulos = await p.$$eval('#vesBanner [data-ban-ir]', bs => bs.map(b => b.getAttribute('aria-label')));
        const k = titulos.findIndex(t => /jlokart|mario kart/i.test(t || ''));
        if (k >= 0) { await p.click(`#vesBanner [data-ban-ir="${k}"]`); await espera(1200); }
        else console.log('  (Novedades no tiene diapositiva de MKW)');
        await p.evaluate(() => { const b = document.querySelector('#vesBanner'); b && b.scrollIntoView({ block: 'start' }); });
        await espera(300);
        await foto('banner', ban);
      }
      // b) la fila «Para jugar solo», con la práctica de MKW a la vista
      const solo = p.locator('#vesSolos .jg-mn[data-id="bots-mkw"]');
      if (await solo.count()) {
        await solo.scrollIntoViewIfNeeded();
        await espera(300);
        const caja = await solo.boundingBox(), vp = p.viewportSize();
        await p.screenshot({ path: path.join(SALIDA, `salon-mkw-${etiqueta}-${aparato}-${tema}-solo.png`), animations: 'disabled',
          clip: { x: 0, y: Math.max(0, caja.y - 60), width: vp.width, height: Math.min(vp.height, caja.height + 120) } });
        hechas.push(`build/vistas/salon-mkw-${etiqueta}-${aparato}-${tema}-solo.png`);
      }
      // c) la grilla de multijugador alrededor de MKW (la tarjeta y sus vecinas)
      const multi = p.locator('.jg-mn[data-id="mkw"]').first();
      if (await multi.count()) {
        await multi.scrollIntoViewIfNeeded();
        await espera(300);
        const caja = await multi.boundingBox(), vp = p.viewportSize();
        await p.screenshot({ path: path.join(SALIDA, `salon-mkw-${etiqueta}-${aparato}-${tema}-multi.png`), animations: 'disabled',
          clip: { x: 0, y: Math.max(0, caja.y - caja.height * 0.6), width: vp.width, height: Math.min(vp.height, caja.height * 2.3) } });
        hechas.push(`build/vistas/salon-mkw-${etiqueta}-${aparato}-${tema}-multi.png`);
        // d) la ficha abierta (la 16:7)
        await multi.locator('.jg-mn-abre').click();
        await espera(1500);
        const ficha = p.locator('[role="dialog"]:visible').first();
        if (await ficha.count()) await foto('ficha', ficha);
        else await foto('ficha', p.locator('body'));
      }
      await ctx.close();
    }
  }
} finally {
  await nav.close();
  srv.close();
}
console.log(`fotos (${hechas.length}):\n  ` + hechas.join('\n  '));
