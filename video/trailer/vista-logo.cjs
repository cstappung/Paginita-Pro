const { chromium } = require(require('path').resolve(__dirname, '..') + '/rec/node_modules/playwright-core');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu'] });
  const pg = await b.newPage({ viewport: { width: 900, height: 320 } });
  const svg = require('fs').readFileSync(__dirname + '/logo.svg', 'utf8');
  await pg.setContent(`<body style="margin:0;background:#0a0a0f;display:flex;gap:40px;align-items:center;padding:30px">
    <div style="width:240px;height:240px">${svg}</div><div style="width:64px;height:64px">${svg}</div>
    <div style="display:flex;align-items:center;gap:18px"><div style="width:90px;height:90px">${svg}</div><span style="font:700 64px sans-serif;color:#f6f3ee;letter-spacing:-.02em">Paginita-Pro</span></div></body>`);
  await pg.screenshot({ path: process.argv[2] }); await b.close(); })();
