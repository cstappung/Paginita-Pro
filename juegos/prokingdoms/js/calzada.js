// Calzada Real (plan de logística L5, pk-47; en el código, «autopista»).
//
// Una franja de piedra de 2 casillas que cualquier jugador traza en tierra de nadie o en su territorio, y que ven y usan
// todos los del mundo: carromato ×3,2, carreta ×2,2, aldeano ×1,5 (L.factor). No va en tierra ajena, agua, zonas
// comunes ni sobre lugares (W.calzadaPuede, la misma regla que el servidor) ni sobre edificios (solo el cliente).
// - En línea, la capa es del servidor: POST /api/autopista agrega o quita y cada sync trae el mapa cuando cambia su
//   versión (apv). Lo que el servidor recorta (tope del día o del mundo) se devuelve.
// - Sin conexión, solo las tuyas, guardadas en la partida (st.calzada.t).
// - Debajo de una calzada no hay árboles ni arbustos: cada cliente los tapa (n.calzada) y los repone si se quita.
// - Quitar: las tuyas siempre; las de otro, solo dentro de tu territorio.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const Cz = (PK.Calzada = {});
  const G = () => PK.Game, S = () => PK.Game.state, A = () => D.AUTOPISTA;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const online = () => !!(PK.Net && PK.Net.online);
  const yo = () => D.MY_SLOT + 1;
  const dia = () => Math.floor(G().ahora() / 864e5);
  let mapa = {};            // casilla -> reino + 1, como la manda el servidor
  const tapados = new Map(); // casilla -> id del árbol o arbusto tapado

  // ---------- La capa ----------
  function tapar(k) {
    const id = W.nodeAt[k];
    if (id < 0) return;
    const n = W.nodes[id];
    if (!n || !W.QUEDAN[n.kind]) return;
    W.nodeAt[k] = -1;
    if (W.block[k] === 1) W.block[k] = 0;
    W.unbucket(n);
    n.gone = true; n.calzada = true;
    tapados.set(k, id);
  }
  function destapar(k) {
    const id = tapados.get(k);
    tapados.delete(k);
    const n = id !== undefined ? W.nodes[id] : null;
    if (!n || !n.calzada || W.nodeAt[k] >= 0 || W.bAt[k] >= 0 || W.wall[k]) return;
    n.gone = false; n.calzada = false;
    W.nodeAt[k] = n.id;
    W.block[k] = n.dead && W.soft(n) ? 0 : 1;
    W.chunkNodes[W.chunkOf(n.x, n.y)].push(n);
  }
  // Pone la capa entera (t: { casilla: reino + 1 }) y repara lo que cambió.
  Cz.aplicar = function (t) {
    t = t || {};
    let cambio = false;
    for (const ks in mapa) if (!t[ks]) { const k = +ks; W.autopista[k] = 0; destapar(k); cambio = true; }
    for (const ks in t) {
      const k = +ks, o = Math.floor(+t[ks]) || 0;
      if (!(k >= 0 && k < W.autopista.length) || !o) continue;
      if (W.autopista[k] !== o) { W.autopista[k] = o; cambio = true; }
      if (!tapados.has(k)) tapar(k);
    }
    mapa = Object.assign({}, t);
    if (cambio) { W.apVer = (W.apVer || 0) + 1; if (G()) G().blockVer++; }
  };
  Cz.version = 0;
  Cz.desdeSync = function (r) { if (r && r.autopistas) { Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t); } };
  const local = () => { const t = {}; for (const k of S().calzada.t) t[k] = yo(); return t; };

  Cz.init = function (st) {
    st.calzada = Object.assign({ t: [], dia: { d: 0, n: 0 } }, st.calzada);
    mapa = {}; tapados.clear(); Cz.version = 0;
    if (G().enMar && G().enMar()) return;
    if (!online()) Cz.aplicar(local());
  };

  // ---------- Dónde se puede ----------
  Cz.libre = function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y);
    if (!W.fog[k] || W.autopista[k] || W.bAt[k] >= 0 || W.wall[k] || W.belt[k] >= 0 || W.wallOwner[k]) return false;
    if (W.block[k] === 1) { const n = W.nodes[W.nodeAt[k]]; if (!n || !W.QUEDAN[n.kind]) return false; } // árboles y arbustos se tapan
    else if (W.block[k] !== 0) return false;
    return W.calzadaPuede(k, D.MY_SLOT);
  };
  // Escalonada como un camino (L.roadPlan) y de 2 de ancho: cada paso pinta un cuadrado de 2×2.
  Cz.plan = function (x0, y0, x1, y1) {
    const out = [], visto = new Set(), pon = (x, y) => { const k = W.idx(x, y); if (!W.inb(x, y) || visto.has(k)) return; visto.add(k); if (Cz.libre(x, y)) out.push([x, y]); };
    let x = x0, y = y0, guard = 0;
    for (;;) {
      pon(x, y); pon(x + 1, y); pon(x, y + 1); pon(x + 1, y + 1);
      if ((x === x1 && y === y1) || guard++ > 300) break;
      const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
      if (dx && (!dy || Math.abs(x1 - x) >= Math.abs(y1 - y))) x += dx; else y += dy;
    }
    return out.slice(0, A().lote);
  };
  Cz.hoy = function () { const st = S().calzada; if (st.dia.d !== dia()) st.dia = { d: dia(), n: 0 }; return st.dia.n; };
  Cz.tope = () => A().porDia(S().era);
  Cz.costo = n => { const c = A().costo(S().era), o = {}; for (const r in c) o[r] = c[r] * n; return o; };

  // ---------- Construir y quitar ----------
  Cz.construir = async function (tiles) {
    if (!tiles.length) return 0;
    const quedan = Math.max(0, Cz.tope() - Cz.hoy());
    if (!quedan) { toast('Hoy ya hiciste ' + Cz.tope() + ' casillas de Calzada Real (el tope de tu era). Mañana puedes seguir.', 'warn'); return 0; }
    tiles = tiles.slice(0, quedan);
    const costo = Cz.costo(tiles.length);
    if (!G().pay(costo)) { toast('Faltan recursos para ' + tiles.length + ' casillas de Calzada Real.', 'warn'); return 0; }
    const ks = tiles.map(([x, y]) => W.idx(x, y));
    if (!online()) {
      const st = S().calzada;
      for (const k of ks) st.t.push(k);
      st.dia.n += ks.length;
      Cz.aplicar(local());
      hecho(ks.length);
      return ks.length;
    }
    try {
      const r = await PK.Net.autopista(ks, []);
      S().calzada.dia.n = r.hoy || S().calzada.dia.n + r.aceptadas.length;
      Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t);
      const fuera = ks.length - r.aceptadas.length;
      if (fuera > 0) { G().give(Cz.costo(fuera)); toast(fuera + (fuera === 1 ? ' casilla no se pudo' : ' casillas no se pudieron') + ' hacer (tope del día o del mundo, o el lugar cambió): te devolvimos su costo.', 'warn'); }
      if (r.aceptadas.length) hecho(r.aceptadas.length);
      return r.aceptadas.length;
    } catch (e) {
      G().give(costo);
      toast('No se pudo hacer la Calzada Real (sin conexión con el servidor). Te devolvimos el material.', 'warn');
      return 0;
    }
  };
  function hecho(n) {
    G().stat('calzada', n);
    if (PK.Sfx) PK.Sfx.play('build');
  }
  // Las que puedes quitar en una zona: las tuyas, o las de otro dentro de tu territorio.
  Cz.quitables = function (x0, y0, x1, y1) {
    const out = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (!W.inb(x, y)) continue;
      const k = W.idx(x, y), o = W.autopista[k];
      if (o && (o === yo() || W.ownerAt(x, y) === 'p')) out.push([x, y]);
    }
    return out;
  };
  Cz.quitar = async function (tiles) {
    const ks = tiles.map(([x, y]) => W.idx(x, y)), mias = ks.filter(k => W.autopista[k] === yo()).length;
    if (!ks.length) return 0;
    if (!online()) {
      const st = S().calzada, fuera = new Set(ks);
      st.t = st.t.filter(k => !fuera.has(k));
      Cz.aplicar(local());
    } else {
      try { const r = await PK.Net.autopista([], ks); Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t); }
      catch (e) { toast('No se pudo quitar la Calzada Real (sin conexión con el servidor).', 'warn'); return 0; }
    }
    if (mias) G().give(Cz.costo(mias), 0.5); // la mitad de lo tuyo vuelve, como con los caminos
    return ks.length;
  };

  // De quién es (para el cartel del mapa)
  Cz.dueño = function (k) {
    const o = W.autopista[k];
    if (!o) return null;
    if (o === yo()) return { tuya: true, name: 'tu reino' };
    const bot = D.BOTS.find(b => b.slot === o - 1);
    return { tuya: false, name: bot ? bot.name : 'otro reino' };
  };

  // ---------- Dibujo ----------
  // Losas grises con juntas, bordillo más oscuro donde termina, un mojón cada 8 casillas con una franja del color de
  // quien la hizo. Se dibuja sobre el suelo, como los caminos.
  const CZC = {};
  function tileUV(px, py) { const a = (px + 0.5 - 16) / 16, b = (py + 0.5) / 8; return [(a + b) / 2, (b - a) / 2]; }
  Sp.calzada = function (mask, hito, col) {
    const key = mask + '|' + (hito ? col.join(',') : '');
    if (CZC[key]) return CZC[key];
    const pb = new Sp.PB(32, 18), bord = 0.16;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 32; px++) {
      const [u, v] = tileUV(px, py);
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const borde = (v < bord && !(mask & 1)) || (v > 1 - bord && !(mask & 4)) || (u > 1 - bord && !(mask & 2)) || (u < bord && !(mask & 8));
      const lu = Math.floor(u * 3 + (Math.floor(v * 3) % 2) * 0.5), lv = Math.floor(v * 3);
      const junta = Math.abs(u * 3 + (Math.floor(v * 3) % 2) * 0.5 - Math.round(u * 3 + (Math.floor(v * 3) % 2) * 0.5)) < 0.07 || Math.abs(v * 3 - Math.round(v * 3)) < 0.07;
      const h = U.hash(lu, lv, 91), tono = 150 + Math.floor(h * 22);
      let c = [tono, tono - 4, tono - 12];
      if (junta) c = [112, 106, 98];
      if (borde) c = [96, 90, 84];
      if (!borde && U.hash(px, py, 13) > 0.94) c = [184, 178, 166];
      pb.set(px, py, c);
    }
    if (hito) { // mojón: piedra baja con la franja del reino
      for (let y = 6; y <= 11; y++) for (let x = 14; x <= 17; x++) pb.set(x, y, y < 8 ? Sp.mix(col, [255, 255, 255], 0.15) : x === 14 ? [128, 122, 112] : [176, 170, 158]);
      for (let x = 14; x <= 17; x++) pb.set(x, 12, [60, 54, 48]);
      pb.set(14, 5, [196, 190, 178]); pb.set(15, 5, [196, 190, 178]); pb.set(16, 5, [196, 190, 178]);
    }
    return (CZC[key] = { c: pb.canvas(), ox: 16, oy: 0 });
  };
  Cz.dibujar = function (ctx, chunks) {
    if (!W.apVer && !Object.keys(mapa).length) return;
    for (const c of chunks) {
      if (!c.onScreen) continue;
      const x0 = c.cx * W.CH, y0 = c.cy * W.CH;
      for (let y = y0; y < y0 + W.CH; y++) for (let x = x0; x < x0 + W.CH; x++) {
        const k = W.idx(x, y), o = W.autopista[k];
        if (!o || !W.fog[k]) continue;
        const r = (dx, dy) => W.inb(x + dx, y + dy) && W.autopista[W.idx(x + dx, y + dy)] > 0;
        const mask = (r(0, -1) ? 1 : 0) | (r(1, 0) ? 2 : 0) | (r(0, 1) ? 4 : 0) | (r(-1, 0) ? 8 : 0);
        const hito = (x + y) % 8 === 0 && mask !== 15; // en el borde, cada 8
        const spr = Sp.calzada(mask, hito, Sp.ownerColor(D.ownerOfSlot(o - 1))), p = PK.Render.iso(x, y);
        ctx.drawImage(spr.c, p[0] - spr.ox, p[1]);
      }
    }
  };
})();
