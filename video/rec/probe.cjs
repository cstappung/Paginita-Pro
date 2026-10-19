const { chromium } = require('playwright-core');
const S = process.argv[2];
const pages = process.argv.slice(3);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  for (const p of pages) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message.slice(0,120)));
    try { await pg.goto('http://127.0.0.1:8123/' + p, { waitUntil: 'load', timeout: 20000 }); } catch (e) { errs.push('goto ' + e.message.slice(0,80)); }
    await pg.waitForTimeout(3500);
    const name = p.replace(/[\/.#?]/g, '_');
    await pg.screenshot({ path: `${S}/shots/${name}.png` });
    console.log(p, errs.length ? 'ERR ' + errs.slice(0,2).join(' | ') : 'ok');
    await ctx.close();
  }
  await b.close();
})();
