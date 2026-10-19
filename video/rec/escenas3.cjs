// Escenas del tráiler v3: etapas avanzadas con trampas, Tetris pro, salas, pollito
const fs = require('fs'), path = require('path');
const S = require('path').resolve(__dirname, '..'), R = require('path').resolve(__dirname, '../..');
const estT = fr => fr.evaluate(() => { const s = window.__tsG && window.__tsG.s; return s && { puntos: s.puntos, lineas: s.lineas, nivel: s.nivel, fin: s.fin, piezas: s.piezas }; });
const tframe = pg => pg.frames().find(f => /club\/tetris/.test(f.url())) || pg.mainFrame();
module.exports = {
  // GUGU GAGA juega Tetris Club como un pro; pasa a Emma (8110) en el marcador durante la toma. A los 7 s
  // deja caer todo para cerrar la partida fuera de cámara y que la tabla muestre el nuevo #1.
  record3: { sitio: 1, url: 'juegos.html', hash: '#solo/tetris', vt: 1, dur: 13000, wait: 8000, scripts: ['tetris-ia.js'], ff: 400000,
    ffHasta: async h => { const e = await estT(tframe(h.pg)); return e && (e.puntos >= 4800 || e.fin); },
    antes: () => { globalThis.__aceptaTodo = true; },
    setup: async h => {
      await h.pg.evaluate(() => { const f = document.querySelector('iframe'); if (f) f.scrollIntoView({ block: 'start' }); scrollBy(0, -70); });
      await tframe(h.pg).evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Jugar/.test(b.innerText)); b && b.click(); });
    },
    alAvanzar: async h => console.log('tetris', JSON.stringify(await estT(tframe(h.pg)))),
    registro: () => { try { const s = document.querySelector('iframe').contentWindow.__tsG.s; return [s.puntos, s.lineas, s.fin ? 1 : 0]; } catch (e) { return null; } },
    alGrabar: async h => { h.grabando = true; console.log('graba desde', JSON.stringify(await estT(tframe(h.pg)))); },
    play: async h => { if (!h.grabando || h.ya) return h.sleep(200); h.ya = 1; await h.sleep(7200); await tframe(h.pg).evaluate(() => { window.__tsCfg.modo = 'tirar'; }); await h.sleep(60000); } },
  tetristest: { url: 'juegos/club/tetris/index.html', vt: 1, dur: 1000, scripts: ['tetris-ia.js'], dpr: 1, ff: 600000,
    ffHasta: async h => { const e = await estT(h.pg.mainFrame()); return e && e.fin; },
    setup: async h => { await h.click('button:has-text("Jugar")'); },
    alAvanzar: async h => console.log('t', JSON.stringify(await estT(h.pg.mainFrame()))),
    play: async h => h.sleep(1000) },
};
module.exports.r3dbg = Object.assign({}, module.exports.record3, { ff: 4000, ffHasta: null, dur: 1000, alAvanzar: async h => console.log('dbg', JSON.stringify(await tframe(h.pg).evaluate(() => [window.__tsN, window.__tsDbg && window.__tsDbg.piezas, window.__tsG && [window.__tsG.s.puntos, window.__tsG.s.piezas, window.__tsG.s.p], document.hasFocus(), typeof TetrisMotor])))});
module.exports.r3dbg.cadaAvance = 15;
// Pío, el pollito bebé amarillo: cuidados y baile
module.exports.pollito = { antes: async () => {}, gpu: 1, sitio: 1, url: 'juegos.html', hash: '#mascotas', dur: 14000, wait: 9000, vt: 1, vw: 800, vh: 450, dpr: 2.4,
  setup: async h => {
    const fr = h.pg.frameLocator('iframe');
    await fr.locator('.pet-card', { hasText: 'Pío' }).first().click(); await h.sleep(3000);
    await fr.locator('button:has-text("Cuidados")').click().catch(() => {}); await h.sleep(1500);
    console.log('botones:', (await h.pg.frames()[1].evaluate(() => [...document.querySelectorAll('button')].map(b => (b.className + ':' + (b.innerText || b.title || '').trim().replace(/\s+/g, ' ')).slice(0, 40)))).join(' | '));
    await h.pg.frames()[1].evaluate(() => { const c = document.querySelector('canvas'); if (c) c.scrollIntoView({ block: 'start' }); });
  },
  play: async h => {
    const fr = h.pg.frameLocator('iframe');
    if (h.ya) return h.sleep(1000); h.ya = 1; await h.sleep(400);
    const care = b => fr.locator('button.care', { hasText: b }).first().click({ timeout: 3000 }).catch(() => console.log('no', b));
    const meneo = async (n, y = 235) => { for (let i = 0; i < n; i++) { await h.pg.mouse.move(i % 2 ? 330 : 160, y, { steps: 12 }); await h.sleep(380); } };
    await care('Alimentar'); await h.sleep(500);
    for (const [x, y] of [[215, 330], [275, 335], [245, 325], [300, 330], [200, 335]]) { await h.pg.mouse.click(x, y); await h.sleep(600); }
    await h.sleep(900);
    await care('Bañar'); await h.sleep(500); await h.pg.mouse.move(240, 220); await h.pg.mouse.down(); await meneo(6, 225); await h.pg.mouse.up(); await h.sleep(800);
    await care('Jugar'); await h.sleep(400);
    for (const x of [300, 185, 300, 185]) { await h.pg.mouse.move(x, 250, { steps: 10 }); await h.sleep(1300); }
  } };
// PRO DEFENDER antes/después: partidas guardadas a mano (la carga no valida torres, tiers ni plata)
function pdGuarda(li, ronda, opciones) {
  return h => h.pg.evaluate(([li, ronda, o]) => {
    function build(li, round, o) {
      const g = new PD.Game(li); g.money = 1e12; const types = PD.towersFor(li).filter(t => o.max || !PD.TOWERS[t]?.hero); let i = 0;
      const paso = o.paso || 20, pos = []; let semilla = 7;
      const az = () => ((semilla = (semilla * 1103515245 + 12345) >>> 0) / 4294967296);
      for (let y = 30; y < PD.H - 20; y += paso) for (let x = 30; x < PD.W - 20; x += paso) pos.push([x, y, az()]);
      if (o.mezcla) pos.sort((a, b) => a[2] - b[2]);
      let n = 0;
      for (const [x, y] of pos) {
        if (o.cuantas && i >= o.cuantas) break;
        const ty = types[(n++ * (o.salto || 1)) % types.length];
        if (PD.TOWERS[ty].hero && g.hasHero()) continue;
        if (g.canPlace(ty, x, y)) { const t = g.place(ty, x, y); if (t) { i++;
          const tg = o.max ? (t.def.hero ? [5, 4] : (i % 2 ? [4, 2] : [2, 4])) : [i % 3 === 0 ? 1 : 0, i % 4 === 1 ? 1 : 0];
          for (let p = 0; p < 2; p++) while (t.tiers[p] < tg[p] && g.upgrade(t, p)); } }
      }
      const s = g.snapshot(); s.round = round; s.money = o.max ? 48750 : 420; s.lives = o.max ? 100 : 150; return s;
    }
    if (o.zonaTxt) o.zona = new Function('x', 'y', o.zonaTxt);
    const pr = () => ({ ve: PD.Prueba.VERSION, s: 12345, j: [], n: 0, k: 0, c: 0 });
    const runs = {}; runs[li] = { snap: build(li, ronda, o), pr: pr() };
    localStorage.setItem('prodefender.save.v1.cuenta.local', JSON.stringify({ v: 1, unlocked: 4, best: [4, 50, 50, 50, 94], won: [false, false, false, false, false], runs, settings: { auto: true, muted: false, sfx: 0.8, music: 0.45 } }));
    return runs[li].snap.towers.length;
  }, [li, ronda, opciones]);
}
const pdEntra = (li, vel) => async h => {
  await h.pg.reload({ waitUntil: 'load' }); await h.sleep(2500);
  await h.pg.locator('#btn-play').click({ force: true }); await h.sleep(1500);
  await h.pg.locator(`#level-grid .lvl-card:nth-child(${li + 1}) .btn.go`).click({ force: true }); await h.sleep(2500);
  await h.pg.locator('#b-start').click({ force: true }); await h.sleep(300);
  for (let i = 1; i < vel; i++) { await h.pg.locator('#b-speed').click({ force: true }); await h.sleep(150); }
};
module.exports.pdA = { url: 'juegos/club/prodefender/index.html', dur: 9000, vt: 1, wait: 4000, ff: 3000,
  setup: async h => { console.log('torres', await pdGuarda(0, 4, { cuantas: 7, paso: 24, mezcla: 1 })(h)); await pdEntra(0, 1)(h); },
  play: async h => h.sleep(1000) };
module.exports.pdB = { url: 'juegos/club/prodefender/index.html', dur: 9000, vt: 1, wait: 4000, ff: 4000,
  setup: async h => { console.log('torres', await pdGuarda(4, 94, { max: 1, paso: 16, mezcla: 1, cuantas: 80 })(h)); await pdEntra(4, 2)(h); },
  alAvanzar: async h => console.log('pd', await h.pg.evaluate(() => (document.body.innerText.match(/Ronda\s*\d+\s*\/\s*100/) || [''])[0])),
  play: async h => h.sleep(1000) };
// BBTAN antes/después: partida guardada (sp: 1 = sin prueba, la carga no exige los tiros)
function bbtanInit(cfg) {
  return `(() => { const c = ${JSON.stringify(cfg)}; let s = c.semilla; const az = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const blocks = []; let id = 0;
    for (const [y, dens] of c.filas) for (let col = 0; col < 7; col++) if (az() < dens) {
      const r = c.ronda > 50 && az() < .2, max = r ? Math.ceil(c.ronda * 1.5) : c.ronda;
      blocks.push([col * 60, y, Math.max(1, max - Math.floor(az() * max * .45)), max, r ? 1 : 0, id++]); }
    const pickups = c.bolas ? c.bolas.map(([col, y]) => [col * 60 + 30, y + 30, 'ball']) : [];
    localStorage.setItem('bbtan-partida-v1.cuenta.local', JSON.stringify({ v: 2, at: Date.now(), sp: 1, ang: -15708, activo: 0, clearCelebrated: false,
      e: { s: 123456, u: 'local', round: c.ronda, count: c.count, score: c.score, launchX: 210, idSeq: id, blocks, pickups, t: '', h: '' } }));
    document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#toast{visibility:hidden!important}'; document.head.appendChild(st); });
  })();`;
}
const bbtanBot = angulos => async h => {
  const c = await h.pg.locator('#game').boundingBox(); if (!c) return h.sleep(500);
  h.n = (h.n || 0) + 1; const a = angulos[h.n % angulos.length] * Math.PI / 180;
  const px = 210 + Math.cos(a) * 220, py = 540 + Math.sin(a) * 220;
  const x = c.x + px * c.width / 420, y = c.y + py * c.height / 580;
  await h.pg.mouse.move(x, y + 30); await h.pg.mouse.down(); await h.pg.mouse.move(x, y, { steps: 6 }); await h.sleep(250); await h.pg.mouse.up();
  for (let i = 0; i < 80; i++) { await h.sleep(250); if (await h.pg.locator('#recall').isDisabled()) break; }
  await h.sleep(350);
};
module.exports.bbtanA = { url: 'juegos/club/bbtan/index.html', dur: 8000, vt: 1, wait: 3000,
  init: bbtanInit({ semilla: 11, ronda: 2, count: 2, score: 3, filas: [[60, .55], [120, .4]], bolas: [[3, 60]] }),
  play: bbtanBot([-62, -118, -75, -105]) };
module.exports.bbtanB = { url: 'juegos/club/bbtan/index.html', dur: 10000, vt: 1, wait: 3000,
  init: bbtanInit({ semilla: 5, ronda: 310, count: 160, score: 48713, filas: [[60, .85], [120, .8], [180, .75], [240, .6]], bolas: [[1, 180], [5, 120]] }),
  setup: async h => { await h.click('#speed'); },
  play: bbtanBot([-58, -122, -70, -110]) };
// Sirve un archivo del repo con reemplazos (solo durante la grabación)
const reemplaza = (ctx, re, arch, pares) => ctx.route(re, r => { let t = fs.readFileSync(path.join(R, arch), 'utf8'); for (const [a, b] of pares) { if (!t.includes(a)) console.log('reemplazo no aplica', arch, a); t = t.split(a).join(b); } r.fulfill({ body: t, contentType: 'application/javascript' }); });
// ALETEO: piloto automático (y por si acaso inmortal) para filmar el tubo 2 y el 150
const aleteoRutas = async ctx => {
  await reemplaza(ctx, /\/aleteo\/motor\.js/, 'juegos/club/aleteo/motor.js', [
    ["E.muerto = true; ev.muerte = true; ev.golpe = 'tubo'; return ev;", "if (!globalThis.__inmortal) { E.muerto = true; ev.muerte = true; ev.golpe = 'tubo'; return ev; }"],
    ["E.muerto = true; ev.muerte = true; ev.golpe = 'suelo'; }", "if (!globalThis.__inmortal) { E.muerto = true; ev.muerte = true; ev.golpe = 'suelo'; } }"]]);
  await reemplaza(ctx, /\/aleteo\/juego\.js/, 'juegos/club/aleteo/juego.js', [
    ["const o = pendiente; pendiente = null;", "let o = pendiente; pendiente = null; if (window.__auto && !o) { const tb = M.proximo(E); const c = tb ? tb.c : 300; if (E.y > c + 26 && E.vy >= 0) o = 'k'; }"]]);
};
const aleteoEmpieza = async h => { await h.pg.evaluate(() => { window.__auto = true; window.__inmortal = true; }); await h.pg.locator('#lienzo').click({ force: true }).catch(() => h.pg.keyboard.press('Space')); };
module.exports.aleteoA = { url: 'juegos/club/aleteo/index.html', dur: 8000, vt: 1, wait: 3000, rutas: aleteoRutas, ff: 2500,
  setup: aleteoEmpieza, play: async h => h.sleep(1000),
  alAvanzar: async h => console.log('aleteo', JSON.stringify(await h.pg.evaluate(() => window.__aleteo && window.__aleteo.estado()))) };
module.exports.aleteoB = { url: 'juegos/club/aleteo/index.html', dur: 9000, vt: 1, wait: 3000, rutas: aleteoRutas, ff: 6000,
  setup: async h => { await aleteoEmpieza(h); await h.sleep(600); await h.pg.evaluate(() => { __aleteo.salta(147); __aleteo.corrupcion(5); }); },
  play: async h => h.sleep(1000),
  alAvanzar: async h => console.log('aleteo', JSON.stringify(await h.pg.evaluate(() => window.__aleteo && window.__aleteo.estado()))) };
// FANAL antes/después: la primera jornada con la barca recién salida, y un jefe en fase 5 con las ocho mejoras al máximo
const fanalRutas = ctx => reemplaza(ctx, /\/fanal\/juego\.js/, 'juegos/club/fanal/juego.js', [['if (F.invul > 0 || F.apagado || estado !== "juego") return;', 'if (window.__inv || F.invul > 0 || F.apagado || estado !== "juego") return;']]);
const fanalBot = async h => {
  const c = await h.pg.locator('canvas').first().boundingBox(); if (!c) return h.sleep(500);
  if (!h.abajo) { h.abajo = 1; await h.pg.mouse.move(c.x + c.width / 2, c.y + c.height * .9); await h.pg.mouse.down(); }
  h.fase = (h.fase || 0) + 0.35;
  await h.pg.mouse.move(c.x + c.width * (0.5 + 0.32 * Math.sin(h.fase)), c.y + c.height * .9, { steps: 3 }); await h.sleep(120);
};
const siguienteRelato = async h => { for (let i = 0; i < 9; i++) { await h.sleep(1300); await h.pg.locator('#capaRelato:visible').click({ timeout: 500 }).catch(() => {}); } };
module.exports.fanalA = { url: 'juegos/club/fanal/index.html', dur: 8000, vt: 1, wait: 3000, rutas: fanalRutas, ff: 4000,
  init: () => { window.__inv = true; },
  setup: async h => { await h.click('#btnNueva'); await siguienteRelato(h); },
  play: fanalBot,
  alAvanzar: async h => console.log('fanal', JSON.stringify(await h.pg.evaluate(() => { const e = window.__fanal && __fanal.estado(); return e && { j: e.jornada, jefe: e.jefe && e.jefe.tipo }; }))) };
module.exports.fanalB = { url: 'juegos/club/fanal/index.html', dur: 10000, vt: 1, wait: 3000, rutas: fanalRutas, ff: 6000,
  init: () => {
    window.__inv = true;
    const m = {}; for (const k of ['cadencia', 'fuerza', 'perfora', 'abanico', 'remo', 'vidrio', 'aceite', 'iman']) m[k] = 3;
    localStorage.setItem('fanal.progreso.cuenta.local', JSON.stringify({ v: 1, frag: [], ecos: [], alba: true, hoguera: true, sol: true,
      punto: { ver: 4, j: 92, puntos: 251840, llamas: 9, luces: 430, mej: m, br: 0, perdidas: 0, notas: 0, at: Date.now() }, mejor: { travesia: 0, sinfin: 0, jornada: 0 } }));
  },
  setup: async h => { await h.click('#btnContinuar'); await siguienteRelato(h); },
  play: fanalBot,
  alAvanzar: async h => console.log('fanal', JSON.stringify(await h.pg.evaluate(() => { const e = window.__fanal && __fanal.estado(); return e && { j: e.jornada, fase: e.fase, jefe: e.jefe && e.jefe.tipo }; }))) };
module.exports.fanalB.alGrabar = async h => { h.t0 = 0; };
module.exports.fanalB.play = async h => {
  if (h.t0 !== undefined) { h.t0 += 1; if (h.t0 === 8 || h.t0 === 45) await h.pg.evaluate(() => { try { __fanal.especial(5); } catch (e) {} }); }
  await fanalBot(h);
};
// Salas en vivo (salas.cjs): GUGU GAGA mira como espectador; las jugadas llegan una a una
const salaEscena = (juego, n, cada, o = {}) => ({ sitio: 1, url: 'juegos.html', vt: 1, dur: o.dur || 12000, wait: 2000,
  setup: async h => {
    const SA = require('./salas.cjs'); const l = SA.lista(await SA.prepara(juego)); const nn = typeof n === 'function' ? n(l) : n;
    h.sala = await SA.abre(juego, nn); console.log(juego, 'abre en', nn, 'de', h.sala.total);
    await h.pg.evaluate(p => { location.hash = '#p/' + p; }, h.sala.pid); await h.sleep(7000);
    if (o.inm !== false) { await h.click('#jgInm'); await h.sleep(2000); }
    if (o.prepara) await o.prepara(h);
  },
  play: async h => { const c = typeof cada === 'function' ? cada(h) : cada; await h.sleep(c); if (h.sala) { const j = await h.sala.siguiente(); if (!j) await h.sleep(2000); } } });
const despuesDe = (t, desde, antes) => l => { const i = l.findIndex((x, k) => k > desde && x.t === t); return Math.max(0, i - antes); };
Object.assign(module.exports, {
  salaAjedrez: salaEscena('ajedrez', 19, 850, { dur: 13000 }),
  salaFlip7: salaEscena('flip7', 150, 650),
  salaCacho: salaEscena('cacho', despuesDe('dudo', 55, 7), 1000),
  salaCatan: salaEscena('catan', 420, 650),
  salaPresidente: salaEscena('presidente', despuesDe('da', 100, -6), 800),
  salaPokemon: salaEscena('pokemon', 40, h => { h.k = (h.k || 0) + 1; return h.k % 4 === 1 ? 2200 : 250; }),
});
const baja = px => async h => { console.log('baja', await h.pg.evaluate(y => { scrollBy(0, y); const r = []; for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(cs.overflowY)) { el.scrollTop += y; r.push(el.id || el.className); } } return r.join(','); }, px)); };
module.exports.salaAjedrez = salaEscena('ajedrez', 19, 850, { dur: 13000, prepara: baja(150) });
module.exports.salaPresidente = salaEscena('presidente', despuesDe('da', 100, -6), 800, { prepara: baja(150) });
module.exports.salaFlip7 = salaEscena('flip7', 150, 650, { prepara: baja(110) });
module.exports.salaPokemon = salaEscena('pokemon', 40, h => { h.k = (h.k || 0) + 1; return h.k % 4 === 1 ? 2200 : 250; }, { prepara: baja(110) });
// Memazo: la sala se arma en vivo con la hora del reloj de la página (el juego decide qué mostrar por la hora)
const FRASES = ['Yo a las 3 AM', 'abriendo la página "solo 5 minutos"', 'cuando sale ×988 en el plinko', 'el profe: "la prueba es fácil"', 'mi mascota con zapatillas legendarias',
  'Emma viendo que GUGU le quitó el #1', 'nadie:', 'el que dice "una más y me duermo"', 'yo explicando el circuito', 'la nota final', 'Santi dudando con 2 tontos', 'yo después de perder en Catan'];
module.exports.salaMemazo = { sitio: 1, url: 'juegos.html', vt: 1, dur: 13000, wait: 2000,
  setup: async h => {
    const T = require('./salas.cjs').cargaTest('memazo'), db = require('./db.cjs');
    const ahora = () => h.pg.evaluate(() => Date.now());
    const pid = '-TrailerMemazo', jug = {}, G = [['GUGU GAGA', '#0d9488'], ['Emma', '#e8467c'], ['Santi', '#3f8cff'], ['Jesús', '#22b07d']];
    ['a', 'b', 'c', 'd'].forEach((u, i) => { jug[u] = { nombre: G[i][0], color: G[i][1], orden: i, at: Date.now() - 60000 }; });
    const p = { juego: 'memazo', semilla: 4242, estado: 'jugando', anfitrion: 'a', nombre: 'GUGU', cupo: 10, rondas: 3, tiempo: 90, jugadores: jug, jugadas: {}, at: Date.now() - 600000, toque: Date.now() };
    let t0 = await ahora(), f = 0, n = 0;
    const pon = j => { p.jugadas[String(n++).padStart(4, '0')] = j; return T.reducir(p); };
    let est = pon({ t: 'arranca', uid: 'a', at: t0 - 40000 });
    for (const u of [...est.debe]) { const pl = T.ofertasMemazo(p.semilla, est.r, jug[u].orden)[0]; est = pon({ t: 'meme', uid: u, r: est.r, p: pl, x: Array(T.MZ_PLANTILLAS[pl]).fill(0).map(() => FRASES[f++ % FRASES.length]), at: t0 - 30000 + n * 2000 }); }
    await db.put('partidas/' + pid, p);
    h.memazo = { p, T, pon, ahora, db, pid, get est() { return est; }, set est(v) { est = v; } };
    console.log('memazo etapa', est.etapa, 'meme', est.m);
    await h.pg.evaluate(x => { location.hash = '#p/' + x; }, pid); await h.sleep(7000);
    await baja(110)(h);
  },
  play: async h => {
    const M = h.memazo; if (!M) return h.sleep(500);
    await h.sleep(M.est.etapa === 'votar' && M.est.debe.length ? 1300 : 800);
    const e = M.est;
    if (e.etapa === 'votar' && e.debe.length) {
      const u = e.debe[0], at = await M.ahora(); const j = { t: 'nota', uid: u, r: e.r, m: e.m, v: 3 + (u.charCodeAt(0) + e.m) % 3, at };
      M.est = M.pon(j); await M.db.put(`partidas/${M.pid}/jugadas/${String(Object.keys(M.p.jugadas).length - 1).padStart(4, '0')}`, j);
    }
  } };
module.exports.clue = { url: 'juegos/clue/index.html', vt: 1, dur: 13000, wait: 3000, scripts: ['clue-bot.js'], ff: 45000,
  setup: async h => { await h.click('#in-jugar'); },
  play: async h => h.sleep(1000) };
