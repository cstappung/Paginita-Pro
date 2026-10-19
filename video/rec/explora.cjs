// explora.cjs <hash> <png> [js a evaluar antes]: entra al sitio, va a la ruta, lista botones y saca captura
const { chromium } = require('playwright-core'); const { preparaContexto, entra } = require('./sitio.cjs');
(async () => {
  const [hash, png, pre, espera] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY }, args: ['--proxy-bypass-list=127.0.0.1;localhost', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
  await preparaContexto(ctx);
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.message.slice(0, 150)));
  await pg.goto('http://127.0.0.1:8123/juegos.html');
  await entra(pg, { sub: 'gugu', nombre: 'GUGU GAGA' });
  await pg.waitForTimeout(3000);
  await pg.evaluate(h => { location.hash = h; }, hash);
  await pg.waitForTimeout(+espera || 4000);
  if (pre) { console.log('pre:', await pg.evaluate(pre).catch(e => e.message)); await pg.waitForTimeout(3000); }
  const bs = await pg.$$eval('button, [role=button], input, select', els => els.filter(e => e.offsetParent).map(e => (e.id ? '#' + e.id + ' ' : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] + ' ' : '') + JSON.stringify((e.innerText || e.value || e.title || e.ariaLabel || '').trim().replace(/\s+/g, ' ').slice(0, 28))));
  console.log(bs.slice(0, 70).join(' | '));
  await pg.screenshot({ path: png });
  await b.close();
})();
