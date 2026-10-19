// Renderiza tiempos sueltos de trailer3.html (vista previa): node cuadros3.cjs 19 23.5 ... → out3p/t_<t>.jpg
const { chromium } = require(__dirname + '/../rec/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--force-color-profile=srgb', '--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(c => { window.CLIPS = c; }, JSON.parse(fs.readFileSync(__dirname + '/clips.json', 'utf8')));
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.message));
  await pg.goto('http://127.0.0.1:8124/' + (process.env.PAGINA || 'trailer3.html')); await pg.evaluate(() => document.fonts.ready);
  fs.mkdirSync(__dirname + '/out3p', { recursive: true });
  for (const t of process.argv.slice(2)) { await pg.evaluate(t => window.render(t), +t); await pg.screenshot({ path: __dirname + '/out3p/t_' + t + '.jpg', quality: 80, type: 'jpeg' }); }
  await b.close();
})();
