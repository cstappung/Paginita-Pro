// Renderiza tiempos sueltos de casino3-prueba.html: node casino3-cuadros.cjs 1.2 3.4 ...
const { chromium } = require(__dirname + '/../rec/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--force-color-profile=srgb', '--disable-gpu'] });
  const pg = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  pg.on('pageerror', e => console.log('err', e.message));
  await pg.goto('http://127.0.0.1:8124/casino3-prueba.html'); await pg.evaluate(() => document.fonts.ready);
  for (const t of process.argv.slice(2)) { await pg.evaluate(t => window.render(t), +t); await pg.screenshot({ path: __dirname + '/out-casino/p_' + t + '.jpg', quality: 85, type: 'jpeg' }); }
  await b.close();
})();
