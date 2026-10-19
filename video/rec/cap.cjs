// Graba tomas de juego: screencast CDP -> jpg -> mp4 (30 fps CFR)
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const S = require('path').resolve(__dirname, '..');
const OUT = S + '/clips'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8123/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const games = Object.assign(require('./games.cjs'), require('./escenas.cjs'), require('./escenas3.cjs'));

async function run(name, g, b) {
  const ctx = await b.newContext({ viewport: { width: g.vw || 1280, height: g.vh || 720 }, deviceScaleFactor: g.dpr || 1.5, ignoreHTTPSErrors: true });
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\//, r => {
    const m = r.request().url().match(/npm\/(@?[^@/]+)@[^/]+\/(.*)$/); const f = m && path.join(S, 'cdn/node_modules', m[1], m[2].split('?')[0]);
    if (f && fs.existsSync(f)) r.fulfill({ path: f, contentType: 'application/javascript' }); else r.abort();
  });
  if (g.init) await ctx.addInitScript(g.init);
  if (g.vt) await ctx.addInitScript({ path: __dirname + '/vt.js' });
  for (const sc of g.scripts || []) await ctx.addInitScript({ path: __dirname + '/' + sc });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.i18n-sel,.i18n-flota,.rp-fab-btn,.rp-fab{display:none!important}'; document.head.appendChild(s); }));
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('  [err]', name, e.message.slice(0, 140)));
  if (process.env.CONSOLA) pg.on('console', m => { if (m.type() === 'error') console.log('  [consola]', m.text().slice(0, 200)); });
  if (g.sitio) await require('./sitio.cjs').preparaContexto(ctx);
  if (g.rutas) await g.rutas(ctx);
  await pg.goto(BASE + g.url, { waitUntil: 'load', timeout: 30000 }).catch(e => console.log('goto', e.message));
  if (g.sitio) {
    await require('./sitio.cjs').entra(pg, g.cuenta || { sub: 'gugu', nombre: 'GUGU GAGA' });
    await sleep(3000);
    if (g.antes) await pg.evaluate(g.antes);
    if (g.hash) await pg.evaluate(h => { location.hash = h; }, g.hash);
  }
  await pg.addStyleTag({ content: '.i18n-sel,.i18n-flota,.rp-fab-btn,.rp-fab{display:none!important}' }).catch(() => {});
  await sleep(g.wait || 2500);
  const h = { pg, sleep, rnd, pick,
    hold: async (k, ms) => { await pg.keyboard.down(k); await sleep(ms); await pg.keyboard.up(k); },
    tap: async (k) => { await pg.keyboard.down(k); await sleep(60); await pg.keyboard.up(k); },
    click: async (sel, o) => { try { await pg.locator(sel).first().click({ timeout: 12000, ...o }); return true; } catch (e) { console.log('  [noclick]', name, sel); return false; } },
  };
  if (g.setup) await g.setup(h).catch(e => console.log('  [setup]', name, e.message.slice(0, 160)));
  if (process.env.PROBE) { const t1 = Date.now(); while (Date.now() - t1 < +process.env.PROBE) await g.play(h).catch(e => console.log('  [play]', e.message.slice(0, 100))); await pg.screenshot({ path: `${S}/shots/probe_${name}.png` }); await ctx.close(); console.log('probe', name); return; }
  const dir = path.join(OUT, name + '_f'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  if (g.real) { const t0 = Date.now(); while (Date.now() - t0 < g.real) { await sleep(5000); if (g.alEsperar) { const fin = await g.alEsperar(h).catch(e => { console.log('alEsperar', e.message); }); if (fin) break; } } }
  if (g.antesDeGrabar) await g.antesDeGrabar(h).catch(e => console.log('antesDeGrabar', e.message));
  if (g.vt) return await runVT(name, g, ctx, pg, h, dir);
  const cdp = await ctx.newCDPSession(pg);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; const file = path.join(dir, String(i).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const lento = g.slow || 1;
  if (lento > 1) { await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / lento }); }
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now(); const dur = (g.dur || 10000) * (g.slow || 1);
  await Promise.race([ (async () => { while (Date.now() - t0 < dur) { await g.play(h).catch(e => { console.log('  [play]', name, e.message.slice(0, 120)); return sleep(300); }); } })(), sleep(dur + 3000) ]);
  await cdp.send('Page.stopScreencast');
  await sleep(300); await ctx.close();
  // concat list with real durations
  let list = '';
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / 30) / lento;
    list += `file '${frames[i].file}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
  }
  if (frames.length) list += `file '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(dir + '.txt', list);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', dir + '.txt', '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-g', '1', path.join(OUT, name + '.mp4')]);
  const span = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t).toFixed(1) : 0;
  console.log(name, 'frames', frames.length, 'span', span + 's');
}

// Captura cuadro a cuadro con reloj virtual: el guion de juego usa h.sleep virtual.
async function runVT(name, g, ctx, pg, h, dir) {
  const FPS = 30, DT = 1000 / FPS, N = Math.round((g.dur || 10000) / 1000 * FPS);
  let vnow = 0; const sleepers = []; const pend = new Set();
  const vsleep = ms => new Promise(r => sleepers.push({ at: vnow + ms, r }));
  const track = p => { pend.add(p); p.finally(() => pend.delete(p)); return p; };
  const v = { ...h, sleep: vsleep,
    tap: k => track((async () => { await pg.keyboard.down(k); await vsleep(50); await pg.keyboard.up(k); })()),
    hold: (k, ms) => track((async () => { await pg.keyboard.down(k); await vsleep(ms); await pg.keyboard.up(k); })()),
  };
  const todos = (fn, arg) => Promise.all(pg.frames().map(f => f.evaluate(fn, arg).catch(() => {})));
  await todos(() => window.__vt && window.__vt.virtual());
  let done = false;
  (async () => { while (!done) { try { await g.play(v); } catch (e) { console.log('  [play]', name, e.message.slice(0, 120)); await vsleep(300); } } })();
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setImmediate(r)); if (pend.size) await Promise.race([Promise.all([...pend]), sleep(500)]); } };
  if (g.ff) { const pasos = Math.round(g.ff / DT); const t0 = Date.now();
    for (let f = 0; f < pasos; f++) {
      if (g.ffHasta && f % 60 === 0 && f > 0 && await g.ffHasta(v).catch(() => false)) { console.log(name, 'ffHasta cumplido en', (f * DT / 1000).toFixed(1), 's'); break; } await settle(); await todos(dt => window.__vt && window.__vt.step(dt), DT); vnow += DT;
      for (let i = sleepers.length - 1; i >= 0; i--) if (sleepers[i].at <= vnow) { sleepers[i].r(); sleepers.splice(i, 1); }
      if (g.alAvanzar && f % (g.cadaAvance || 300) === 0) await g.alAvanzar(v).catch(() => {}); }
    console.log(name, 'avance', g.ff / 1000, 's de juego en', (Date.now() - t0) / 1000, 's'); }
  if (g.alGrabar) await g.alGrabar(v).catch(e => console.log('alGrabar', e.message));
  for (let f = 0; f < N; f++) {
    await settle();
    await todos(dt => window.__vt && window.__vt.step(dt), DT);
    vnow += DT;
    for (let i = sleepers.length - 1; i >= 0; i--) if (sleepers[i].at <= vnow) { sleepers[i].r(); sleepers.splice(i, 1); }
    await pg.screenshot({ path: path.join(dir, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (g.registro) { (g._reg = g._reg || []).push(await pg.evaluate(g.registro).catch(() => null)); if (f % 30 === 29) fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(g._reg)); }
  }
  done = true; await ctx.close().catch(() => {});
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', dir + '/%05d.jpg', '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-g', '1', path.join(OUT, name + '.mp4')]);
  console.log(name, 'VT frames', N);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY },
    args: ['--autoplay-policy=no-user-gesture-required', '--proxy-bypass-list=127.0.0.1;localhost'].concat(
      process.argv.slice(2).some(n => games[n] && games[n].gpu) ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--disable-gpu']) });
  const only = process.argv.slice(2);
  for (const [name, g] of Object.entries(games)) {
    if (only.length && !only.includes(name)) continue;
    try { await run(name, g, b); } catch (e) { console.log('FAIL', name, e.message); }
  }
  await b.close();
})();
