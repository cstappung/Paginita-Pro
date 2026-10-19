const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript({ path: __dirname + '/boxhead-bot.js' });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.message.slice(0, 150)));
  await pg.goto('http://127.0.0.1:8123/juegos/boxhead/index.html'); await pg.waitForTimeout(2500);
  await pg.locator('text=Fortaleza').first().click({ timeout: 5000 }).catch(e => console.log('no fortaleza'));
  await pg.locator('text=¡A JUGAR!').first().click({ timeout: 5000 }).catch(e => console.log('no jugar'));
  for (let i = 0; i < 6; i++) { await pg.waitForTimeout(5000); console.log(JSON.stringify(await pg.evaluate(() => { const s = window.__boxhead.estado(); return { nivel: s.nivel, pts: s.yo.pts, mul: s.yo.mul, k: s.yo.k, en: s.enemigos, w: s.yo.w }; }))); }
  await pg.screenshot({ path: process.argv[2] }); await b.close();
})();
