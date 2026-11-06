// Medición de rendimiento (T4 de la Fase 7): N aldeanos trabajando alrededor del Centro Urbano, con zoom 1 y 2.
// Da el tiempo de dibujo (R.draw) y de simulación (G.update) por cuadro, los cuadros por segundo y el p90.
// Necesita Playwright (viene en las sesiones en la nube) y el servidor de vista previa (`cd colabtex && npm start`).
//   node tools/rendimiento.js [pc|cel] [aldeanos=300] [lento=1] [url]
// `lento` frena la CPU con las herramientas de Chrome (4 ≈ un celular mediano). Ojo: un Chromium sin GPU pinta el
// lienzo por software, y eso se lleva casi todo el cuadro; compara siempre contra una medición con pocos aldeanos.
'use strict';
const { chromium } = require('playwright');
const tam = process.argv[2] || 'pc', N = +(process.argv[3] || 300), lento = +(process.argv[4] || 1);
const URL = process.argv[5] || 'http://localhost:8123/juegos/prokingdoms/index.html';
(async () => {
  const b = await chromium.launch();
  const vp = tam === 'pc' ? { width: 1280, height: 800 } : { width: 390, height: 844 };
  const ctx = await b.newContext({ viewport: vp, hasTouch: tam !== 'pc', isMobile: tam !== 'pc', deviceScaleFactor: tam === 'pc' ? 1 : 3,
    userAgent: tam === 'pc' ? undefined : 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' }); // el juego mira el navegador para saber si es celular
  const pg = await ctx.newPage();
  if (lento > 1) await (await ctx.newCDPSession(pg)).send('Emulation.setCPUThrottlingRate', { rate: lento });
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));
  await pg.goto(URL + '?dev&local&perfil=rend' + Date.now(), { waitUntil: 'load' });
  await pg.waitForFunction(() => window.PK && PK.Game && PK.Game.state && !document.getElementById('loading'), null, { timeout: 60000 });
  await pg.waitForTimeout(600);
  await pg.evaluate(n => {
    document.querySelectorAll('.modal-back').forEach(m => m.remove());
    const G = PK.Game, tc = G.buildings.find(b => b.type === 'tc' && b.owner === 'p');
    PK.World.reveal(tc.x, tc.y, 40);
    for (let i = G.villagers().length, k = 0; i < n && k < n * 2; k++) if (G.spawnVillager(tc)) i++; // con tope: si no cabe, no se cuelga
    const vs = G.villagers();
    ['wood', 'food', 'stone', 'gold'].forEach((j, k) => PK.Auto.setJob(vs.filter((u, i) => i % 4 === k), j));
    PK.UI.mute = true;
    const t = (window.__rend = { d: 0, u: 0, n: 0, f: [] });
    const D0 = PK.Render.draw, U0 = PK.Game.update;
    PK.Render.draw = function (dt) { const a = performance.now(); D0(dt); t.d += performance.now() - a; t.n++; };
    PK.Game.update = function (dt) { const a = performance.now(); U0(dt); t.u += performance.now() - a; };
    let last = performance.now();
    (function cuadro() { const x = performance.now(); t.f.push(x - last); last = x; requestAnimationFrame(cuadro); })();
    PK.Render.centerOn(tc.x + 2, tc.y + 2);
  }, N);
  await pg.waitForTimeout(12000); // que salgan a trabajar
  for (const z of [1, 2]) {
    await pg.evaluate(z => { PK.Render.cam.z = z; Object.assign(window.__rend, { d: 0, u: 0, n: 0, f: [] }); }, z);
    await pg.waitForTimeout(6000);
    console.log(tam, 'zoom', z, await pg.evaluate(() => {
      const t = window.__rend, f = t.f.slice(1).sort((a, b) => a - b), G = PK.Game;
      return JSON.stringify({ aldeanos: G.units.filter(u => u.owner === 'p' && u.kind === 'v').length, trabajando: G.units.filter(u => u.mode === 'work').length,
        enPantalla: PK.Render.drawn.filter(i => i.k === 'unit').length, dibujoMs: +(t.d / t.n).toFixed(2), simMs: +(t.u / Math.max(1, t.n)).toFixed(2),
        fps: +(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(1), p90ms: +f[Math.floor(f.length * 0.9)].toFixed(1) });
    }));
  }
  if (errores.length) console.log('errores', errores);
  await b.close();
})();
