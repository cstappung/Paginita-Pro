const fs = require('fs'), path = require('path');
const S = require('path').resolve(__dirname, '..'), R = require('path').resolve(__dirname, '../..');
// Sirve un archivo del repo con reemplazos (solo durante la grabación)
const reemplaza = (ctx, re, arch, pares) => ctx.route(re, r => { let t = fs.readFileSync(path.join(R, arch), 'utf8'); for (const [a, b] of pares) { if (!t.includes(a)) console.log('reemplazo no aplica', arch, a); t = t.split(a).join(b); } r.fulfill({ body: t, contentType: 'application/javascript' }); });
const cancionesHero = ctx => ctx.route(/\/juegos\/hero\/(api\/library|songs\/.*)$/, r => { const u = new URL(r.request().url()); const f = path.join(S, 'hero', decodeURIComponent(u.pathname.replace(/^.*\/juegos\/hero\//, ''))); fs.existsSync(f) ? r.fulfill({ path: f, contentType: f.endsWith('library') ? 'application/json' : undefined }) : r.fulfill({ status: 404 }); });
// Escenas del sitio completo (con emulador)
const SEM = () => JSON.parse(fs.readFileSync(__dirname + '/semilla.json', 'utf8'));
const tframe = pg => pg.frames().find(f => /club\/tetris/.test(f.url())) || pg.mainFrame();
const estadoTetris = pg => tframe(pg).evaluate(() => { const s = window.__tsG && window.__tsG.s; return s && { puntos: s.puntos, lineas: s.lineas, nivel: s.nivel, fin: s.fin }; });
module.exports = {
  // UNO No Mercy de 4 en una sala real del emulador; el robot de los tests juega por todos
  uno: { sitio: 1, url: 'juegos.html', vt: 1, dur: 20000, wait: 2000,
    setup: async h => {
      const U = require('./uno-sala.cjs'); const pid = await U.crea('nomercy', 777); console.log('uno', JSON.stringify(await U.prepara(14)));
      await h.pg.evaluate(p => { location.hash = '#p/' + p; }, pid); await h.sleep(7000);
      await h.click('#jgInm'); await h.sleep(2500);
    },
    play: async h => { const U = require('./uno-sala.cjs'); await h.sleep(1150); const j = await U.paso(); if (!j) await h.sleep(2000); } },
  // Un god pack de Componentes con legendaria (clave buscada en Node y escrita en el emulador)
  sobre: { sitio: 1, url: 'juegos.html', hash: '#jugar', vt: 1, dur: 21000, wait: 3000,
    setup: async h => { const s = SEM(); await h.pg.evaluate(([u, k]) => { localStorage.setItem('prodrop.pendiente.' + u, k); location.hash = '#cartas'; }, [s.uid, s.sobre.k]); await h.sleep(9000); },
    play: async h => {
      if (h.hecho) return h.sleep(1000); h.hecho = 1;
      await h.sleep(900);
      await h.pg.mouse.move(505, 208); await h.pg.mouse.down();
      for (let i = 1; i <= 16; i++) { await h.pg.mouse.move(505 + i * 17, 208 + Math.sin(i / 3) * 2); await h.sleep(40); }
      await h.pg.mouse.up(); await h.sleep(1800);
      for (let i = 0; i < 9; i++) { await h.pg.mouse.click(640, 380); await h.sleep(i < 8 ? 1300 : 8000); }
    } },
  yemasz: { gpu: 1, url: 'juegos/yemas/index.html', dur: 12000, vt: 1, scripts: ['yemas-bot.js'], ff: 150000,
    setup: async h => { await h.pg.selectOption('#modo-practica', 'zombis'); await h.pg.selectOption('#mapa-practica', h.mapa || 'nuketown');
      await h.pg.locator('input[type=text]').first().fill('GUGU GAGA').catch(() => {}); await h.pg.locator('#jugar').click({ force: true }); await h.sleep(2500); },
    alAvanzar: async h => console.log('yemas', JSON.stringify(await h.pg.evaluate(() => window.__ybDbg))),
    play: async h => { await h.sleep(1000); } },
  boxhead2: { url: 'juegos/boxhead/index.html', dur: 12000, vt: 1, scripts: ['boxhead-bot.js'], ff: 200000,
    setup: async h => { await h.click('text=Fortaleza'); await h.click('text=¡A JUGAR!'); await h.sleep(1500); },
    alAvanzar: async h => { const e = await h.pg.evaluate(() => { const s = window.__boxhead.estado(); return { nivel: s.nivel, pts: s.yo.pts, mul: s.yo.mul, k: s.yo.k, enemigos: s.enemigos }; }); console.log('boxhead', JSON.stringify(e)); },
    play: async h => { await h.sleep(1000); } },
  // El récord: GUGU GAGA juega Tetris Club en el sitio y pasa a Emma, Santi y Jesús en la tabla de al lado
  record: { sitio: 1, url: 'juegos.html', hash: '#solo/tetris', vt: 1, dur: 17000, wait: 8000, scripts: ['tetris-ia.js'], ff: 400000,
    ffHasta: async h => { const e = await estadoTetris(h.pg); return e && (e.lineas >= 26 || e.fin); },
    antes: () => { globalThis.__aceptaTodo = true; },
    setup: async h => {
      await h.pg.evaluate(() => { const f = document.querySelector('iframe'); if (f) f.scrollIntoView({ block: 'start' }); scrollBy(0, -70); });
      await tframe(h.pg).evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Jugar/.test(b.innerText)); b && b.click(); });
    },
    alAvanzar: async h => console.log('tetris', JSON.stringify(await estadoTetris(h.pg))),
    alGrabar: async h => {
      const e = await estadoTetris(h.pg); const db = require('./db.cjs');
      const emma = Math.max(1000, Math.floor((e.puntos - 400) / 10) * 10);
      const tabla = { emma7: ['Emma', emma], santi9: ['Santi', Math.floor(emma * 0.87)], jesus3: ['Jesús', Math.floor(emma * 0.8)], cami2: ['Cami', Math.floor(emma * 0.52)], vale4: ['Vale', Math.floor(emma * 0.44)], tomi5: ['Tomi', Math.floor(emma * 0.31)] };
      for (const [u, [n, p]] of Object.entries(tabla)) await db.put('soloRanks/club-tetris-maraton/' + u, { nombre: n, puntos: p, tiempo: 300000, partida: 'p' + u });
      console.log('tabla sembrada con Emma =', emma, 'GUGU va en', e.puntos); await new Promise(r => setTimeout(r, 4000)); h.grabando = true;
    },
    play: async h => {
      while (!h.grabando) await h.sleep(300);
      await h.sleep(5500);
      await tframe(h.pg).evaluate(() => { window.__tsCfg.modo = 'tirar'; });
      await h.sleep(60000);
    } },
  tetrisia: { url: 'juegos/club/tetris/index.html', dur: 4000, scripts: ['tetris-ia.js'], dpr: 1,
    setup: async h => { await h.click('button:has-text("Jugar")'); },
    play: async h => { await h.sleep(5000); console.log('estado', JSON.stringify(await tframe(h.pg).evaluate(() => { const s = window.__tsG && window.__tsG.s; return s && { puntos: s.puntos, lineas: s.lineas, nivel: s.nivel, fin: s.fin }; }))); } },
  hero: { url: 'juegos/hero/index.html?fuente=servidor', dur: 16000, vt: 1, wait: 4000, ff: 30000, registro: () => window.__st,
    rutas: async ctx => { await cancionesHero(ctx); await reemplaza(ctx, /\/juegos\/hero\/js\/game\/session\.js/, 'juegos/hero/js/game/session.js', [["pd.bot ? 'BOT' : ''", "''"], ["    const now = this.audio.songTime(perf);", "    const now = this.audio.songTime(perf); window.__st = now;"]]); },
    setup: async h => { await h.click('.menu-btn:has-text("JUGAR")'); await h.sleep(1500);
      for (const k of ['Enter', 'ArrowDown', 'ArrowDown', 'Enter', 'ArrowUp', 'ArrowUp', 'Enter']) { await h.pg.keyboard.press(k); await h.sleep(700); } },
    play: async h => { if (!h.ya) { h.ya = 1; await h.pg.keyboard.press('Enter'); } await h.sleep(1000); } },
  avion: { sitio: 1, url: 'juegos.html', hash: '#casino/avion', dur: 12000, wait: 5000, vt: 1, ff: 19500,
    antes: () => { globalThis.__suerte = true; globalThis.__tope = 25; },
    setup: async h => {
      await h.pg.locator('.jg-cs-volver').scrollIntoViewIfNeeded(); await h.pg.evaluate(() => scrollBy(0, 150));
      await h.click('button:has-text("Máx")');
      const chk = h.pg.locator('input[type=checkbox]').first(); await chk.check({ force: true }).catch(() => {});
      const num = h.pg.locator('input:not([type=checkbox])').filter({ hasText: '' }).last();
      await h.pg.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => x.value === '2.00'); if (i) { i.value = '25.00'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } });
      await h.sleep(500);
    },
    play: async h => { if (!h.ya) { h.ya = 1; await h.pg.locator('.jg-cs-boton').click(); } await h.sleep(1000); } },
  plinko: { sitio: 1, url: 'juegos.html', hash: '#casino/plinko', dur: 10000, wait: 5000, vt: 1,
    antes: () => { globalThis.__suerte = true; },
    setup: async h => {
      await h.pg.locator('.jg-cs-volver').scrollIntoViewIfNeeded(); await h.pg.evaluate(() => scrollBy(0, 150));
      await h.click('button:has-text("Alto")'); await h.click('button:text-is("16")'); await h.click('button:has-text("Máx")'); await h.sleep(600);
    },
    play: async h => { if (!h.soltado) { h.soltado = 1; await h.sleep(800); await h.pg.locator('.jg-cs-boton').click(); } await h.sleep(1000); } },
  // Michi, el gato adulto, con ropa y bailando. Vista angosta y DPR alto para que la escena 3D llene el cuadro.
  mascota: { gpu: 1, sitio: 1, url: 'juegos.html', hash: '#mascotas', dur: 16000, wait: 9000, vt: 1, vw: 800, vh: 450, dpr: 2.4,
    setup: async h => {
      const fr = h.pg.frameLocator('iframe');
      await fr.locator('.pet-card').first().click(); await h.sleep(3000);
      await fr.locator('button:has-text("Inventario")').click().catch(() => {}); await h.sleep(1500);
      const nombres = await h.pg.frames()[1].evaluate(() => [...document.querySelectorAll('button')].map(b => (b.className + ':' + (b.innerText || b.title || '').trim().replace(/\s+/g, ' ')).slice(0, 50)));
      console.log('inventario:', nombres.join(' | '));
      for (const t of ['Sombrero arcano', 'Zapatillas cometa']) await fr.locator('button', { hasText: t }).first().click({ timeout: 4000 }).catch(() => console.log('no encontré', t));
      await h.sleep(800);
      await fr.locator('button:has-text("Cuidados")').click().catch(() => {}); await h.sleep(1500);
      await h.pg.frames()[1].evaluate(() => { const c = document.querySelector('canvas'); if (c) c.scrollIntoView({ block: 'start' }); });
    },
    play: async h => {
      const fr = h.pg.frameLocator('iframe');
      for (const b of ['Disco', 'Salsa', 'Robot', 'Giro']) { await fr.locator('.dance-slot', { hasText: b }).first().click({ timeout: 3000 }).catch(() => {}); await h.sleep(4200); }
    } },
};
module.exports.avion2 = Object.assign({}, module.exports.avion, { ff: 27500, dur: 9500 });
// BBTAN avanzado: muchas rondas, muchas bolas
module.exports.bbtan2 = { url: 'juegos/club/bbtan/index.html', dur: 10000, vt: 1, ff: 240000,
  setup: async h => { await h.click('button:has-text("Velocidad")').catch(() => {}); },
  alAvanzar: async h => console.log('bbtan', await h.pg.evaluate(() => document.body.innerText.match(/RONDA\s*\d+|BOLAS\s*\d+/gi)?.join(' '))),
  play: async h => { const c = await h.pg.locator('canvas').first().boundingBox(); if (!c) return h.sleep(500);
    const x = c.x + c.width * h.rnd(.12, .88), y = c.y + c.height * h.rnd(.2, .5);
    await h.pg.mouse.move(x, y, { steps: 4 }); await h.pg.mouse.down(); await h.sleep(200); await h.pg.mouse.up(); await h.sleep(2500); } };
// PRO DEFENDER avanzado: bot que pone torres mientras avanza a ×2
module.exports.pd2 = { url: 'juegos/club/prodefender/index.html', dur: 10000, vt: 1, wait: 5000, ff: 300000,
  setup: async h => { await h.pg.locator('#btn-play').click({ force: true }); await h.sleep(2000); await h.pg.locator('button.gold:has-text("Nueva partida")').first().click({ force: true }).catch(() => {}); await h.sleep(3000);
    await h.click('button:has-text("Ronda 1")'); await h.sleep(300); await h.click('button:has-text("Auto")'); await h.click('button:has-text("x1")'); },
  alAvanzar: async h => console.log('pd', await h.pg.evaluate(() => (document.body.innerText.match(/Ronda\s*\d+\s*\/100/) || [''])[0])),
  play: async h => { const k = h.pick(['1', '2', '3', '4', '5', '6', '1', '2']); await h.pg.keyboard.press(k); await h.sleep(150);
    await h.pg.mouse.click(h.rnd(40, 930), h.rnd(100, 690)); await h.sleep(200); await h.pg.keyboard.press('Escape'); await h.sleep(h.rnd(1500, 3000)); } };

module.exports.avion3 = Object.assign({}, module.exports.avion, { ff: 35000, dur: 8500 });
module.exports.bbtan2.ffHasta = async h => { const t = await h.pg.evaluate(() => document.body.innerText); const m = t.match(/RONDA\s*(\d+)/i); return m && +m[1] >= 12; };
Object.assign(module.exports.yemasz, { ff: 45000, dur: 9000, dpr: 1 });
Object.assign(module.exports.avion3, { ff: 60000, dur: 8500, ffHasta: async h => { const t = await h.pg.evaluate(() => (document.querySelector('.jg-cs-boton') || {}).innerText || ''); const n = +(t.match(/[\d.]+/) || ['0'])[0].replace(/\./g, ''); return /Retirarse/.test(t) && n >= 9000; } });
