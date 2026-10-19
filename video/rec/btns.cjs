const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy:{server:process.env.HTTPS_PROXY}, args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--proxy-bypass-list=127.0.0.1'] });
  for (const u of process.argv.slice(2)) {
    const ctx = await b.newContext({ viewport:{width:1280,height:720}, ignoreHTTPSErrors:true });
    const pg = await ctx.newPage(); const errs=[];
    pg.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,140)); });
    await pg.goto('http://127.0.0.1:8123/'+u); await pg.waitForTimeout(4000);
    const bs = await pg.$$eval('button, [role=button], a.btn, input[type=button]', els => els.filter(e=>e.offsetParent).map(e => (e.id?'#'+e.id+' ':'')+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]+' ':'')+JSON.stringify((e.innerText||e.value||e.title||'').trim().slice(0,30))));
    console.log('==', u, '\n ', bs.slice(0,40).join(' | ')); if (errs.length) console.log('  ERR', errs.slice(0,4).join('\n  '));
    await ctx.close();
  }
  await b.close();
})();
