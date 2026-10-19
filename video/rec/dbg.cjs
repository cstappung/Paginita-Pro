const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy:{server:process.env.HTTPS_PROXY}, args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--proxy-bypass-list=127.0.0.1'] });
  const ctx = await b.newContext({ viewport:{width:1280,height:720}, deviceScaleFactor:1.5, ignoreHTTPSErrors:true });
  const pg = await ctx.newPage();
  pg.on('console', m => console.log('console', m.text().slice(0,150)));
  await pg.goto('http://127.0.0.1:8123/'+process.argv[2]); await pg.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(pg); let n=0;
  cdp.on('Page.screencastFrame', f => { n++; cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}); });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:80});
  await pg.waitForTimeout(1500); console.log('frames before click', n);
  await pg.locator('text=¡A JUGAR!').first().click(); 
  await pg.waitForTimeout(2000); console.log('frames after', n);
  await pg.screenshot({path: process.argv[3]}); console.log('shot ok');
  await b.close();
})();
