const { chromium } = require('playwright-core'); const { preparaContexto, entra } = require('./sitio.cjs'); const db = require('./db.cjs');
const S = require('path').resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY }, args: ['--proxy-bypass-list=127.0.0.1;localhost', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
  await preparaContexto(ctx);
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.message.slice(0, 150)));
  await pg.goto('http://127.0.0.1:8123/juegos.html');
  const uid = await entra(pg, { sub: 'gugu', nombre: 'GUGU GAGA' });
  await pg.waitForTimeout(2500); await pg.evaluate(() => { location.hash = '#mascotas'; }); await pg.waitForTimeout(8000);
  const fr = pg.frameLocator('iframe');
  const a0 = await db.get('mascotas/a/' + uid);
  if (!a0) { await fr.locator('button:has-text("Adoptar caja con gatito")').click(); await pg.waitForTimeout(1500); await fr.locator('input[type=text], input:not([type])').first().fill('Michi'); await fr.locator('button:has-text("Adoptar")').first().click(); await pg.waitForTimeout(8000); }
  const a = await db.get('mascotas/a/' + uid); console.log('adopciones', JSON.stringify(a));
  const est = await db.get('mascotasEstado/' + uid); console.log('estado', JSON.stringify(est).slice(0, 600));
  await pg.screenshot({ path: S + '/shots/masc1.png' });
  await b.close();
})();
