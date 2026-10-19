const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const S = require('path').resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/\/juegos\/hero\/(api\/library|songs\/.*)$/, r => { const u = new URL(r.request().url()); const f = path.join(S, 'hero', decodeURIComponent(u.pathname.replace(/^.*\/juegos\/hero\//, ''))); fs.existsSync(f) ? r.fulfill({ path: f, contentType: f.endsWith('library') ? 'application/json' : undefined }) : r.fulfill({ status: 404 }); });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('err', e.stack.slice(0, 600)));
  await pg.goto('http://127.0.0.1:8123/juegos/hero/index.html?fuente=servidor'); await pg.waitForTimeout(4000);
  const lista = async () => (await pg.$$eval('button, .menu-btn, [role=button], li', els => els.filter(e => e.offsetParent).map(e => (e.className + ':' + (e.innerText || '').trim().replace(/\s+/g, ' ')).slice(0, 40)))).slice(0, 30).join(' | ');
  const pasos = process.argv.slice(2);
  let i = 0;
  for (const p of pasos) {
    if (p.startsWith('k:')) await pg.keyboard.press(p.slice(2)); else await pg.locator(p).first().click({ timeout: 5000 }).catch(e => console.log('noclick', p));
    await pg.waitForTimeout(2500);
    console.log('--', p, '->', await lista());
    await pg.screenshot({ path: `${S}/shots/hero_${i++}.png` });
  }
  await b.close();
})();
