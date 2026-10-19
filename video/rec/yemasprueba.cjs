const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const S = require('path').resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\//, r => { const m = r.request().url().match(/npm\/(@?[^@/]+)@[^/]+\/(.*)$/); const f = m && path.join(S, 'cdn/node_modules', m[1], m[2].split('?')[0]); if (f && fs.existsSync(f)) r.fulfill({ path: f, contentType: 'application/javascript' }); else r.abort(); });
  await ctx.addInitScript(() => { Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return document.getElementById('lienzo'); } }); Element.prototype.requestPointerLock = function () { return Promise.resolve(); }; });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.message.slice(0, 150)));
  await pg.goto('http://127.0.0.1:8123/juegos/yemas/index.html'); await pg.waitForTimeout(3000);
  console.log(await pg.$$eval('select', ss => ss.map(s => s.id + ': ' + [...s.options].map(o => o.value).join(','))));
  await pg.selectOption('#modo-practica', 'zombis'); await pg.selectOption('#mapa-practica', 'nuketown');
  await pg.waitForTimeout(500);
  console.log(await pg.$$eval('select', ss => ss.map(s => s.id + ': ' + [...s.options].map(o => o.value).join(','))));
  await pg.locator('input[type=text]').first().fill('GUGU GAGA').catch(()=>{}); await pg.locator('#jugar').click({ force: true }); await pg.waitForTimeout(9000);
  console.log(await pg.evaluate(() => { const y = window.__yemas; const yo = y.yo; const z = y.zombis; let lista = null; try { lista = z && z.lista ? z.lista() : null; } catch (e) { lista = 'err ' + e.message; }
      return { yo: Object.entries(yo).filter(([k, v]) => typeof v !== 'object' || v === null || Array.isArray(v)).map(([k, v]) => k + '=' + JSON.stringify(v).slice(0, 30)).join(' '), pos: JSON.stringify(yo.pos || yo.p || null), zk: z ? Object.keys(z).join(',') : '', lista: JSON.stringify(lista).slice(0, 500) }; }));
  await pg.screenshot({ path: S + '/shots/yemasz.png' }); await b.close();
})();
