const canvasBox = async h => (await h.pg.locator('canvas').first().boundingBox());
module.exports = {
  boxhead: { url: 'juegos/boxhead/index.html', dur: 12000, vt: 1,
    setup: async h => { await h.click('text=¡A JUGAR!'); await h.sleep(1500); },
    play: async h => { const k = h.pick(['w','a','s','d','w','d']); await h.pg.keyboard.down(k); for (let i = 0; i < 6; i++) { await h.tap(' '); await h.sleep(h.rnd(40, 120)); } await h.pg.keyboard.up(k); if (Math.random() < .15) await h.tap(h.pick(['q','e'])); } },
  dosmil: { url: 'juegos/club/dosmil/index.html', dur: 8000,
    play: async h => { await h.tap(h.pick(['ArrowLeft','ArrowDown','ArrowDown','ArrowRight','ArrowLeft','ArrowUp'])); await h.sleep(h.rnd(110, 220)); } },
  aleteo: { url: 'juegos/club/aleteo/index.html', dur: 6000, vt: 1,
    setup: async h => { await h.tap(' '); },
    play: async h => { await h.tap(' '); await h.sleep(h.rnd(330, 470)); } },
  bbtan: { url: 'juegos/club/bbtan/index.html', dur: 9000, vt: 1,
    play: async h => { const c = await canvasBox(h); if (!c) return h.sleep(500); const x = c.x + c.width * h.rnd(.1,.9), y = c.y + c.height * h.rnd(.25,.6); await h.pg.mouse.move(x, y, { steps: 8 }); await h.pg.mouse.down(); await h.sleep(250); await h.pg.mouse.up(); await h.sleep(2200); } },
  metrorush: { gpu: 1, url: 'juegos/club/metrorush/index.html', dur: 12000, wait: 9000, vt: 1, dpr: 1,
    setup: async h => { const c = await canvasBox(h); if (c) await h.pg.mouse.click(c.x + c.width/2, c.y + c.height/2); await h.sleep(500); await h.tap(' '); await h.sleep(300); await h.tap('Enter'); await h.sleep(1500); },
    play: async h => { await h.tap(h.pick(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])); await h.sleep(h.rnd(400, 900)); } },
  yemas: { gpu: 1, url: 'juegos/yemas/index.html', dur: 12000, vt: 1,
    init: () => { Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return document.getElementById('lienzo'); } }); Element.prototype.requestPointerLock = function () { return Promise.resolve(); }; Document.prototype.exitPointerLock = function () {}; },
    setup: async h => { await h.pg.locator('input').first().fill('Laboratorio').catch(()=>{}); await h.pg.locator('#jugar').click({ force: true }); await h.sleep(3000); },
    play: async h => { const k = h.pick(['w','w','a','d']); const dx = h.rnd(-14, 14); await h.pg.keyboard.down(k);
      for (let i = 0; i < 12; i++) { await h.pg.evaluate(d => dispatchEvent(new MouseEvent('mousemove', { movementX: d, movementY: 0 })), dx); if (i % 4 === 0) await h.pg.evaluate(() => { dispatchEvent(new MouseEvent('mousedown', { button: 0 })); }); if (i % 4 === 2) await h.pg.evaluate(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 }))); await h.sleep(60); }
      await h.pg.keyboard.up(k); } },
  worms: { url: 'juegos/worms/index.html', dur: 11000, vt: 1,
    setup: async h => { await h.click('#start-btn'); await h.sleep(3000); },
    play: async h => { await h.hold(h.pick(['ArrowLeft','ArrowRight']), h.rnd(200, 600)); await h.hold('ArrowUp', h.rnd(100, 400)); await h.hold(' ', h.rnd(400, 1100)); await h.sleep(1500); } },
  prodefender: { url: 'juegos/club/prodefender/index.html', dur: 9000, vt: 1, wait: 5000,
    setup: async h => { await h.pg.locator('#btn-play').click({ force: true }); await h.sleep(2000); await h.pg.locator('button.gold:has-text("Nueva partida")').first().click({ force: true }).catch(e => console.log('np', e.message.slice(0, 80))); await h.sleep(3000);
      for (const [k, x, y] of [['1', 300, 420], ['2', 540, 360], ['1', 300, 190], ['3', 560, 520], ['1', 120, 650], ['2', 360, 520]]) { await h.tap(k); await h.sleep(200); await h.pg.mouse.click(x, y); await h.sleep(300); }
      await h.click('button:has-text("Ronda 1")'); await h.sleep(300); await h.click('button:has-text("Auto")'); await h.click('button:has-text("x1")'); await h.sleep(4000); },
    play: async h => { await h.sleep(1000); } },
  fanal: { url: 'juegos/club/fanal/index.html', dur: 8000, vt: 1, wait: 4000,
    setup: async h => { await h.pg.locator('#btnNueva').click({ force: true }); for (let i = 0; i < 16; i++) { await h.sleep(1000); await h.tap('Enter'); } await h.sleep(1500); },
    play: async h => { await h.pg.keyboard.down(' '); await h.hold(h.pick(['ArrowLeft','ArrowRight','ArrowUp','ArrowLeft','ArrowRight']), h.rnd(250, 700)); await h.pg.keyboard.up(' '); } },
  trigon: { url: 'juegos/club/trigon/index.html', dur: 9000, vt: 1,
    setup: async h => { await h.click('button:has-text("Jugar")'); await h.sleep(1200); },
    play: async h => { const P = h.pg; const vw = 1280; const px = 1160, py = [330, 445, 560][Math.floor(h.rnd(0, 3))];
      await P.mouse.move(px, py); await P.mouse.down(); for (let i = 1; i <= 12; i++) { await P.mouse.move(px + (h.rnd(830, 1000) - px) * i / 12, py + (h.rnd(320, 600) - py) * i / 12); await h.sleep(30); }
      await P.mouse.up(); await h.sleep(400); } },
  protiles: { url: 'juegos/club/protiles/index.html', dur: 9000, vt: 1,
    setup: async h => { await h.click('.song:has-text("Neón")'); await h.sleep(1500); await h.tap('j'); await h.sleep(500); },
    play: async h => { await h.tap(h.pick(['d','f','j','k'])); await h.sleep(h.rnd(120, 300)); } },
  haxball: { url: 'juegos/haxball/index.html', dur: 10000, vt: 1, wait: 4000,
    setup: async h => { for (let i = 0; i < 2; i++) { if (await h.pg.locator('#novCerrar').isVisible()) await h.click('#novCerrar'); await h.sleep(400); }
      await h.click('.btn2:has-text("Contra bots")'); await h.click('.btn2:has-text("3 vs 3")'); await h.pg.locator('#jugar').click({ force: true }); await h.sleep(1200);
      if (await h.pg.locator('#novCerrar').isVisible()) { await h.click('#novCerrar'); await h.pg.locator('#jugar').click({ force: true }); } await h.sleep(1500); },
    play: async h => { await h.pg.keyboard.down('ArrowRight'); await h.hold(h.pick(['ArrowUp','ArrowDown']), h.rnd(150, 500)); await h.tap('x'); await h.pg.keyboard.up('ArrowRight'); await h.sleep(h.rnd(100, 300)); } },
  sortem: { gpu: 1, url: 'juegos/club/sortem/index.html', dur: 5000, vt: 1,
    setup: async h => { await h.tap(' '); await h.sleep(1500); },
    play: async h => { await h.tap(h.pick(['ArrowLeft','ArrowRight','ArrowRight',' '])); await h.sleep(h.rnd(150, 350)); } },
  hero: { url: 'juegos/hero/index.html', dur: 6000, play: async h => { await h.sleep(800); } },
  salon: { url: 'juegos.html', dur: 16000, wait: 4000, slow: 4, dpr: 1.5,
    play: async h => { await h.sleep(2600 * 4); await h.pg.locator('.jg-ban-flecha').nth(1).click({ timeout: 3000 }).catch(() => {}); } },
};
