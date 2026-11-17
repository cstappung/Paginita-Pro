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
// pk-78 (pedidos del dueño): las losas toman el color del reino que la hizo; también va en las zonas comunes (no sobre
// el mineral) y sobre un campamento o una mazmorra que venciste (para los demás ese lugar se muda: W.ubicarLugares con
// la capa); y lleva decoraciones (D.AUTOPISTA.decos) que ven todos, sobre tus casillas.
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
  let decos = {};           // pk-78: casilla -> tipo de decoración (índice de D.AUTOPISTA.decos + 1)
  Cz.decoVer = 0;
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
  // Pone la capa entera (t: { casilla: reino + 1 }; d: { casilla: tipo }) y repara lo que cambió.
  Cz.aplicar = function (t, d) {
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
    if (d !== undefined) {
      const nd = {};
      for (const ks in d || {}) { const tp = Math.floor(+d[ks]) || 0; if (tp && W.autopista[+ks] && D.AUTOPISTA.decos[tp - 1]) nd[ks] = tp; }
      decos = nd; Cz.decoVer++;
    }
  };
  Cz.version = 0;
  Cz.desdeSync = function (r) { if (r && r.autopistas) { Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t, r.autopistas.d || {}); } };
  const local = () => { const t = {}; for (const k of S().calzada.t) t[k] = yo(); return t; };

  Cz.init = function (st) {
    st.calzada = Object.assign({ t: [], dia: { d: 0, n: 0 }, d: {} }, st.calzada);
    st.calzada.d = st.calzada.d || {};
    mapa = {}; decos = {}; tapados.clear(); Cz.version = 0;
    if (G().enMar && G().enMar()) return;
    if (!online()) Cz.aplicar(local(), st.calzada.d);
  };

  // ---------- Dónde se puede ----------
  // pk-78: dónde quedaron los lugares con la capa de hoy (W.ubicarLugares guarda la cuenta) y lo que venciste
  let ubMemo = null, ubKey = '';
  Cz.ub = function () { // se pide por cada casilla de un plan: guardado mientras no cambien el territorio ni la capa
    const key = (W.terrVer || 0) + ':' + (W.apVer || 0);
    if (!ubMemo || ubKey !== key) { ubMemo = W.ubicarLugares(W.terr, k => W.autopista[k] > 0, W.apVer || 0); ubKey = key; }
    return ubMemo;
  };
  let vencMemo = null, vencT = 0;
  Cz.vencidos = function () {
    const t = performance.now();
    if (!vencMemo || t - vencT > 500) { vencMemo = new Set(G().vencidos ? G().vencidos() : []); vencT = t; }
    return vencMemo;
  };
  Cz.libre = function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y);
    if (!W.fog[k] || W.autopista[k] || W.bAt[k] >= 0 || W.wall[k] || W.belt[k] >= 0 || W.wallOwner[k]) return false;
    if (W.block[k] === 1) { const n = W.nodes[W.nodeAt[k]]; if (!n || !W.QUEDAN[n.kind]) return false; } // árboles y arbustos se tapan
    else if (W.block[k] !== 0) return false;
    const F = PK.Fort, z = F && F.ciudadela && F.ciudadela();
    if (F && (F.en(x, y) || (z && x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h))) return false;
    return W.calzadaPuede(k, D.MY_SLOT, null, Cz.ub(), Cz.vencidos());
  };
  // en palabras, para el aviso del primer toque
  Cz.porQue = function (x, y) {
    if (!W.inb(x, y)) return 'fuera del mapa';
    const k = W.idx(x, y);
    if (!W.fog[k]) return 'sin explorar';
    if (W.autopista[k]) return 'ya hay Calzada';
    if (W.terrain[k] === 4) return 'agua';
    const pc = W.parcel(x, y);
    if (W.terr[pc] && W.terr[pc] !== D.MY_SLOT + 1) return 'tierra de otro reino';
    if (W.bAt[k] >= 0 || W.wall[k] || W.wallOwner[k]) return 'hay un edificio o una muralla';
    if (W.belt[k] >= 0) return 'hay una cinta';
    const o = Cz.ub().ocupa[k];
    if (o < 0 || (W.block[k] === 1 && !(W.nodes[W.nodeAt[k]] && W.QUEDAN[W.nodes[W.nodeAt[k]].kind]))) return 'hay un recurso (rodéalo, o muévelo con monedas)';
    if (o > 0) return W.PISABLE(W.pois[o - 1].kind) ? 'hay un lugar que todavía no venciste' : 'hay un lugar';
    return 'no se puede';
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
      Cz.aplicar(local(), st.d);
      hecho(ks.length);
      return ks.length;
    }
    try {
      const r = await PK.Net.autopista(ks, [], { venc: Array.from(Cz.vencidos()) });
      S().calzada.dia.n = r.hoy || S().calzada.dia.n + r.aceptadas.length;
      Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t, r.autopistas.d);
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
    const devDeco = {}; // pk-78: las decoraciones tuyas que se van con ella devuelven la mitad
    for (const k of ks) { const d = W.autopista[k] === yo() && decos[k] && Cz.decoDef(decos[k]); if (d) for (const r in d.cost) devDeco[r] = (devDeco[r] || 0) + d.cost[r]; }
    if (!online()) {
      const st = S().calzada, fuera = new Set(ks);
      st.t = st.t.filter(k => !fuera.has(k));
      for (const k of ks) delete st.d[k];
      Cz.aplicar(local(), st.d);
    } else {
      try { const r = await PK.Net.autopista([], ks); Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t, r.autopistas.d); }
      catch (e) { toast('No se pudo quitar la Calzada Real (sin conexión con el servidor).', 'warn'); return 0; }
    }
    if (mias) G().give(Cz.costo(mias), 0.5); // la mitad de lo tuyo vuelve, como con los caminos
    if (Object.keys(devDeco).length) G().give(devDeco, 0.5);
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

  // ---------- Decoraciones (pk-78) ----------
  // Sobre una casilla de TU Calzada; las ven todos (en línea van en el mismo documento del servidor, `d`). No estorban
  // el paso: son dibujo. Cambiar una por otra devuelve la mitad de la anterior; quitarla, también la mitad.
  Cz.decoEn = k => decos[k] || 0;
  Cz.decoDef = tipo => D.AUTOPISTA.decos[tipo - 1] || null;
  Cz.misDecos = function () { let n = 0; for (const ks in decos) if (W.autopista[+ks] === yo()) n++; return n; };
  Cz.decoAbierta = tipo => { const d = Cz.decoDef(tipo); return !!d && (S().era || 1) >= d.era; };
  async function mandarDeco(k, tipo) { // true si quedó
    if (!online()) {
      const st = S().calzada;
      if (tipo) st.d[k] = tipo; else delete st.d[k];
      Cz.aplicar(local(), st.d);
      return true;
    }
    try {
      const r = await PK.Net.autopista([], [], { deco: { [k]: tipo } });
      if (!r.autopistas || r.autopistas.d === undefined) { toast('El servidor todavía no guarda decoraciones (falta actualizarlo).', 'warn'); return false; }
      Cz.version = r.autopistas.v; Cz.aplicar(r.autopistas.t, r.autopistas.d);
      return (decos[k] || 0) === tipo;
    } catch (e) { toast('No se pudo poner la decoración (sin conexión con el servidor).', 'warn'); return false; }
  }
  Cz.decorar = async function (x, y, tipo) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), def = Cz.decoDef(tipo), antes = decos[k] || 0;
    if (!def) return false;
    if (W.autopista[k] !== yo()) { toast('Las decoraciones van sobre tu propia Calzada Real.', 'warn'); return false; }
    if (!Cz.decoAbierta(tipo)) { toast(def.name + ': se habilita en la Era ' + U.roman(def.era) + '.', 'warn'); return false; }
    if (antes === tipo) return false;
    if (!antes && Cz.misDecos() >= D.AUTOPISTA.decoMax) { toast('Llegaste al tope de ' + D.AUTOPISTA.decoMax + ' decoraciones.', 'warn'); return false; }
    if (!G().pay(def.cost)) { toast('Faltan recursos para ' + def.name.toLowerCase() + '.', 'warn'); return false; }
    const ok = await mandarDeco(k, tipo);
    if (!ok) { G().give(def.cost); if (online() && !antes && Cz.misDecos() >= D.AUTOPISTA.decoMax) toast('Llegaste al tope de decoraciones.', 'warn'); return false; }
    if (antes && Cz.decoDef(antes)) G().give(Cz.decoDef(antes).cost, 0.5);
    G().stat('decoraciones', 1);
    if (PK.Sfx) PK.Sfx.play('build');
    return true;
  };
  Cz.quitarDeco = async function (x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), antes = decos[k] || 0;
    if (!antes) return false;
    if (W.autopista[k] !== yo()) { toast('Esa decoración es de otro reino.', 'warn'); return false; }
    const ok = await mandarDeco(k, 0);
    if (ok && Cz.decoDef(antes)) G().give(Cz.decoDef(antes).cost, 0.5);
    return ok;
  };

  // ---------- Dibujo ----------
  // Losas con juntas, bordillo más oscuro donde termina (o donde empieza la de otro reino), un mojón cada 8 casillas con
  // una franja del color de quien la hizo. pk-78: la piedra misma va teñida del color de su reino.
  const CZC = {};
  const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  function tileUV(px, py) { const a = (px + 0.5 - 16) / 16, b = (py + 0.5) / 8; return [(a + b) / 2, (b - a) / 2]; }
  Sp.calzada = function (mask, hito, col) {
    col = col || [150, 150, 150];
    const key = mask + '|' + (hito ? 1 : 0) + '|' + col.join(',');
    if (CZC[key]) return CZC[key];
    const pb = new Sp.PB(32, 18), bord = 0.16;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 32; px++) {
      const [u, v] = tileUV(px, py);
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const borde = (v < bord && !(mask & 1)) || (v > 1 - bord && !(mask & 4)) || (u > 1 - bord && !(mask & 2)) || (u < bord && !(mask & 8));
      const lu = Math.floor(u * 3 + (Math.floor(v * 3) % 2) * 0.5), lv = Math.floor(v * 3);
      const junta = Math.abs(u * 3 + (Math.floor(v * 3) % 2) * 0.5 - Math.round(u * 3 + (Math.floor(v * 3) % 2) * 0.5)) < 0.07 || Math.abs(v * 3 - Math.round(v * 3)) < 0.07;
      const h = U.hash(lu, lv, 91), tono = 150 + Math.floor(h * 22);
      let c = mix([tono, tono - 4, tono - 12], col, 0.26);
      if (junta) c = mix([112, 106, 98], col, 0.3);
      if (borde) c = mix([90, 84, 78], col, 0.5);
      if (!borde && U.hash(px, py, 13) > 0.94) c = mix([184, 178, 166], col, 0.15);
      pb.set(px, py, c);
    }
    if (hito) { // mojón: piedra baja con la franja del reino
      for (let y = 6; y <= 11; y++) for (let x = 14; x <= 17; x++) pb.set(x, y, y < 8 ? mix(col, [255, 255, 255], 0.15) : x === 14 ? [128, 122, 112] : [176, 170, 158]);
      for (let x = 14; x <= 17; x++) pb.set(x, 12, [60, 54, 48]);
      pb.set(14, 5, [196, 190, 178]); pb.set(15, 5, [196, 190, 178]); pb.set(16, 5, [196, 190, 178]);
    }
    return (CZC[key] = { c: pb.canvas(), ox: 16, oy: 0 });
  };
  const colorDe = o => Sp.ownerColor(D.ownerOfSlot(o - 1)) || [150, 150, 150];
  Cz.dibujar = function (ctx, chunks) {
    if (!W.apVer && !Object.keys(mapa).length) return;
    for (const c of chunks) {
      if (!c.onScreen) continue;
      const x0 = c.cx * W.CH, y0 = c.cy * W.CH;
      for (let y = y0; y < y0 + W.CH; y++) for (let x = x0; x < x0 + W.CH; x++) {
        const k = W.idx(x, y), o = W.autopista[k];
        if (!o || !W.fog[k]) continue;
        const r = (dx, dy) => W.inb(x + dx, y + dy) && W.autopista[W.idx(x + dx, y + dy)] === o; // el bordillo marca también dónde empieza la de otro
        const mask = (r(0, -1) ? 1 : 0) | (r(1, 0) ? 2 : 0) | (r(0, 1) ? 4 : 0) | (r(-1, 0) ? 8 : 0);
        const hito = (x + y) % 8 === 0 && mask !== 15 && !decos[k]; // en el borde, cada 8
        const spr = Sp.calzada(mask, hito, colorDe(o)), p = PK.Render.iso(x, y);
        ctx.drawImage(spr.c, p[0] - spr.ox, p[1]);
      }
    }
  };

  // Los dibujos de las decoraciones: 22 × 38, con la base en (11, 35), contorno oscuro y sombra. Las animadas (farol,
  // estandarte, fuente) tienen 4 cuadros.
  const DW = 22, DH = 38, BX = 11, BY = 35, DECOC = {};
  const ANIM = { farol: 1, estandarte: 1, fuente: 1 };
  function rect(pb, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pb.set(x, y, c); }
  function disco(pb, cx, cy, rx, ry, f) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy; if (d <= 1) pb.set(x, y, f(dx, dy, d, x, y)); } }
  function contorno(pb) {
    const a = new Uint8Array(DW * DH);
    for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) a[y * DW + x] = pb.alpha(x, y) > 0 ? 1 : 0;
    for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
      if (a[y * DW + x]) continue;
      if ((x > 0 && a[y * DW + x - 1]) || (x < DW - 1 && a[y * DW + x + 1]) || (y > 0 && a[(y - 1) * DW + x]) || (y < DH - 1 && a[(y + 1) * DW + x])) pb.set(x, y, [34, 26, 24]);
    }
  }
  const PIEDRA = [158, 152, 142], PIEDRA_L = [190, 184, 172], PIEDRA_D = [118, 112, 104];
  function pedestal(pb, x0, x1, y0) {
    rect(pb, x0, y0, x1, BY - 1, PIEDRA);
    rect(pb, x0, y0, x1, y0, PIEDRA_L);
    rect(pb, Math.ceil((x0 + x1) / 2) + 1, y0 + 1, x1, BY - 1, PIEDRA_D);
  }
  const DIB = {
    farol(pb, col, f) {
      pedestal(pb, 8, 14, 31);
      rect(pb, 10, 10, 11, 30, [52, 50, 58]); rect(pb, 11, 10, 11, 30, [84, 82, 94]);
      rect(pb, 7, 3, 14, 10, [40, 36, 40]);
      const fl = [0, 18, 6, 26][f];
      rect(pb, 8, 4, 13, 9, [255, 196 + fl, 100 + fl]);
      rect(pb, 10, 5, 11, 8, [255, 240, 180]);
      rect(pb, 7, 2, 14, 2, col); rect(pb, 8, 1, 13, 1, mix(col, [0, 0, 0], 0.3));
      pb.set(10, 0, [232, 190, 84]); pb.set(11, 0, [232, 190, 84]);
    },
    estandarte(pb, col, f) {
      pedestal(pb, 7, 13, 31);
      rect(pb, 9, 2, 9, 30, [110, 74, 40]); rect(pb, 10, 2, 10, 30, [146, 100, 58]);
      pb.set(9, 1, [232, 190, 84]); pb.set(10, 1, [232, 190, 84]); pb.set(10, 0, [255, 220, 120]);
      for (let i = 0; i < 10; i++) {
        const x = 11 + i, off = Math.round(Math.sin(i / 2.2 - f * 1.57) * 1.2 * (i / 9));
        for (let j = 0; j < 10; j++) {
          if (i === 9 && j >= 3 && j <= 6) continue; // cola de golondrina
          const y = 3 + j + off, base = j < 4 ? mix(col, [255, 255, 255], 0.18) : j > 7 ? mix(col, [0, 0, 0], 0.3) : col;
          const emblema = (i === 4 || i === 5) && j >= 3 && j <= 6 || (j === 4 || j === 5) && i >= 3 && i <= 6;
          pb.set(x, y, emblema ? mix(base, [250, 230, 160], 0.65) : base);
        }
      }
    },
    seto(pb, col) {
      rect(pb, 5, 27, 17, BY - 1, [150, 142, 128]); rect(pb, 5, 27, 17, 27, [178, 170, 154]); rect(pb, 12, 28, 17, BY - 1, [124, 116, 104]);
      rect(pb, 5, 30, 17, 30, col);
      disco(pb, 11, 19, 7, 7.5, (dx, dy, d, x, y) => {
        const l = -dx * 0.6 - dy * 0.8, h = U.hash(x, y, 7);
        let c = l > 0.35 ? [100, 164, 72] : l < -0.45 ? [38, 84, 34] : [62, 122, 48];
        if (h > 0.86) c = mix(c, [150, 200, 110], 0.5);
        return c;
      });
    },
    banco(pb) {
      const M = [150, 102, 58], ML = [180, 130, 78], MD = [96, 62, 34], H = [64, 64, 72];
      rect(pb, 5, 29, 6, BY - 1, MD); rect(pb, 16, 29, 17, BY - 1, MD);
      rect(pb, 5, 21, 5, 27, MD); rect(pb, 17, 21, 17, 27, MD);
      rect(pb, 3, 19, 19, 21, M); rect(pb, 3, 19, 19, 19, ML);
      rect(pb, 3, 26, 19, 28, M); rect(pb, 3, 26, 19, 26, ML); rect(pb, 3, 28, 19, 28, MD);
      rect(pb, 2, 24, 3, 27, H); rect(pb, 19, 24, 20, 27, H);
    },
    estatua(pb, col) {
      pedestal(pb, 5, 16, 27); rect(pb, 5, 30, 16, 30, PIEDRA_D);
      const P = [152, 150, 146], PL = [190, 188, 182], PD = [116, 114, 110];
      rect(pb, 9, 21, 10, 26, P); rect(pb, 12, 21, 13, 26, PD);
      rect(pb, 8, 13, 14, 20, P); rect(pb, 8, 13, 9, 20, PL); rect(pb, 13, 13, 14, 20, PD);
      disco(pb, 11, 9.5, 2.6, 2.6, dx => (dx < -0.2 ? PL : dx > 0.4 ? PD : P));
      rect(pb, 10, 5, 12, 6, col); pb.set(11, 4, col);
      rect(pb, 4, 13, 7, 19, P); rect(pb, 4, 13, 4, 19, PL); pb.set(5, 15, col); pb.set(6, 15, col); pb.set(5, 16, col); pb.set(6, 16, col);
      rect(pb, 16, 5, 16, 18, [212, 212, 218]); rect(pb, 15, 15, 17, 15, [120, 96, 50]); pb.set(16, 16, [120, 96, 50]);
    },
    fuente(pb, col, f) {
      disco(pb, 11, 30.5, 10.5, 4.2, (dx, dy) => (dy < -0.55 ? PIEDRA_L : dx > 0.3 ? PIEDRA_D : PIEDRA));
      disco(pb, 11, 29.6, 8.4, 2.6, (dx, dy, d, x, y) => ((x + y + f) % 5 === 0 ? [200, 230, 250] : [84, 146, 206]));
      rect(pb, 10, 17, 12, 28, PIEDRA); rect(pb, 12, 17, 12, 28, PIEDRA_D); rect(pb, 10, 22, 12, 22, col);
      disco(pb, 11, 16.5, 4.4, 1.7, (dx, dy) => (dy < -0.2 ? [120, 176, 228] : PIEDRA));
      const AG = [196, 228, 252];
      for (let i = 0; i < 4; i++) { const y = 9 + ((i * 2 + f) % 7); pb.set(11, y, AG); }
      for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) { const t = ((i + f * 0.75) % 3) / 3, x = Math.round(11 + s * (2 + t * 6)), y = Math.round(14 + t * t * 12); pb.set(x, y, AG); }
    },
  };
  Sp.calzadaDeco = function (tipo, col, f) {
    const def = D.AUTOPISTA.decos[tipo - 1];
    if (!def || !DIB[def.id]) return null;
    f = ANIM[def.id] ? f % 4 : 0;
    const key = def.id + '|' + col.join(',') + '|' + f;
    if (DECOC[key]) return DECOC[key];
    const pb = new Sp.PB(DW, DH);
    DIB[def.id](pb, col, f);
    contorno(pb);
    for (let y = BY - 2; y <= BY + 2; y++) for (let x = BX - 8; x <= BX + 8; x++) { const dx = (x + 0.5 - BX) / 8, dy = (y + 0.5 - BY) / 2.2; if (dx * dx + dy * dy <= 1 && !pb.alpha(x, y)) pb.set(x, y, [20, 16, 14], 70); }
    return (DECOC[key] = { c: pb.canvas(), ox: BX, oy: BY });
  };
  // Para el menú: el dibujo de cada tipo con tu color
  Cz.icono = tipo => { const s = Sp.calzadaDeco(tipo, Sp.ownerColor('p'), 0); return s ? s.c.toDataURL() : ''; };
  // En la lista que se ordena por profundidad (render.js), como los demás objetos del mapa
  Cz.collect = function (list, vis) {
    const R = PK.Render, f0 = Math.floor(performance.now() / 260);
    for (const ks in decos) {
      const k = +ks, x = k % W.W, y = (k / W.W) | 0;
      if (!W.fog[k] || !W.autopista[k]) continue;
      const [px, py] = R.iso(x + 0.5, y + 0.5), spr = Sp.calzadaDeco(decos[ks], colorDe(W.autopista[k]), f0 + (k % 4));
      if (!spr) continue;
      const sx = Math.round(px - spr.ox), sy = Math.round(py - spr.oy + 1);
      if (!vis(sx, sy, DW, DH)) continue;
      list.push({ d: x + y + 1.1, k: 'deco', o: { k }, spr, x: sx, y: sy });
    }
  };
  // De noche los faroles alumbran (render.js, en la pasada de luces de las ventanas)
  Cz.luces = function (ctx, vis, gl, noche, t) {
    const R = PK.Render;
    for (const ks in decos) {
      const k = +ks;
      if (!W.fog[k]) continue;
      const def = D.AUTOPISTA.decos[decos[ks] - 1];
      if (!def || def.id !== 'farol') continue;
      const x = k % W.W, y = (k / W.W) | 0, [px, py] = R.iso(x + 0.5, y + 0.5), wy = py - 28;
      if (!vis(px - 20, wy - 20, 40, 40)) continue;
      ctx.globalAlpha = noche * (0.75 + 0.25 * Math.sin(t * 4 + k));
      ctx.drawImage(gl, px - 14, wy - 14, 28, 28);
    }
  };
})();
