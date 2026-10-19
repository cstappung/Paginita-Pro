const { chromium } = require('playwright-core'); const { preparaContexto, entra } = require('./sitio.cjs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY }, args: ['--proxy-bypass-list=127.0.0.1;localhost'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
  await preparaContexto(ctx);
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.message.slice(0, 150)));
  await pg.goto('http://127.0.0.1:8123/juegos.html' + (process.argv[2] || ''));
  const uid = await entra(pg, { sub: 'gugu', nombre: 'GUGU GAGA' }); console.log('uid', uid);
  await pg.waitForTimeout(6000);
  await pg.screenshot({ path: process.argv[3] || require('path').resolve(__dirname, '..') + '/shots/sitio.png' });
  await b.close();
})();
