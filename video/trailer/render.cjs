// Renderiza trailer.html cuadro a cuadro y lo une con la música.
// uso: node render.cjs [desde_seg] [hasta_seg] [paso]   (paso>1 = vista previa rápida)
const { chromium } = require((process.env.S || require('path').resolve(__dirname, '..')) + '/rec/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const S = process.env.S || require('path').resolve(__dirname, '..'), T = S + '/trailer';
const [desde = 0, hasta = 52, paso = 1] = process.argv.slice(2).map(Number);
const OUT = T + '/' + (process.env.OUTDIR || 'out'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--force-color-profile=srgb', '--disable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const clips = JSON.parse(fs.readFileSync(T + '/clips.json', 'utf8'));
  await ctx.addInitScript(c => { window.CLIPS = c; }, clips);
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('err', e.message));
  await pg.goto('http://127.0.0.1:8124/' + (process.env.PAGINA || 'trailer.html')); await pg.evaluate(() => document.fonts.ready);
  const f0 = Math.round(desde * 30), f1 = Math.round(hasta * 30);
  for (let f = f0; f < f1; f += paso) {
    await pg.evaluate(t => window.render(t), f / 30);
    await pg.screenshot({ path: path.join(OUT, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 94 });
    if (f % 150 === 0) console.log('cuadro', f);
  }
  await b.close();
})();
