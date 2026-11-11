// Despeje del territorio, tala y plantación (pk-40, pedido del dueño), y la herramienta de quitar por zona.
//
// - Dentro de tus tierras solo pueden quedar árboles. Cuevas, mazmorras, campamentos, ruinas, cofres y lugares
//   legendarios, y las minas, vetas, arbustos y ciervos que caen en una parcela tuya se mudan a la tierra de nadie más
//   cercana (sin dueño, fuera de las zonas comunes). Pasa al cargar y cada vez que tu territorio cambia (W.terrVer).
//   Solo en la tierra: en el archipiélago las islas son tuyas enteras y quedarían sin nada.
// - Lo movido se guarda (st.despeje.n / .p: id → [x, y]) y se repone al cargar, antes de buscar lo nuevo: el mapa
//   se genera igual para todos (W.generate) y esto es solo de tu partida. El servidor no ve posiciones: los nodos de
//   las zonas comunes nunca caen en una parcela con dueño, así que nunca se mueven.
// - Talar (zona) quita árboles de tus tierras para siempre (st.despeje.talados) y devuelve la mitad de su madera.
//   Plantar (de a un toque) pone un brote que a los 20 minutos es un árbol que rebrota como cualquier otro
//   (st.despeje.plantas, con su estado: sus ids cambian si un evento creó nodos temporales antes).
// - Quitar (zona) desarma murallas y puertas (mitad de vuelta, como Def.remove) y caminos (PK.Logi.removeRoad).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Dz = (PK.Despeje = {});
  const G = () => PK.Game, S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);

  Dz.QUEDAN = { tree: 1 };                  // lo único que puede quedar dentro de tu territorio
  Dz.PLANTAR = { wood: 10, food: 10 };      // costo de un brote
  Dz.CRECE = 20 * 60;                       // segundos hasta que el brote es un árbol
  Dz.ZONA_MAX = 24;                         // lado máximo de la zona de talar o quitar, en casillas

  // ---------- Dónde puede ir algo que se muda ----------
  const RADIO = 70;
  let OFF = null;
  function offsets() {
    if (OFF) return OFF;
    OFF = [];
    for (let dy = -RADIO; dy <= RADIO; dy++) for (let dx = -RADIO; dx <= RADIO; dx++) { const d = Math.hypot(dx, dy); if (d <= RADIO) OFF.push([dx, dy, d]); }
    OFF.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]); // mismo orden siempre: mismo destino
    return OFF;
  }
  const mio = (x, y) => W.ownerAt(x, y) === 'p';
  // tierra de nadie, libre de todo y fuera de las zonas (comunes o de un hogar)
  function libre(x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y);
    return W.block[k] === 0 && W.terrain[k] !== 4 && W.nodeAt[k] < 0 && W.poiAt[k] < 0 && W.bAt[k] < 0 && !W.wall[k] && !W.road[k] && W.belt[k] < 0 &&
      !W.reserved[k] && W.zoneAt[k] < 0 && W.ownerAt(x, y) === null && !W.terrCommon[W.parcel(x, y)];
  }
  function lugarNodo(x0, y0) {
    for (const [dx, dy] of offsets()) if (libre(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy];
    return null;
  }
  // un lugar como el de las mazmorras al generar: el rectángulo y un borde de una casilla, todo libre
  function cabePoi(p, x, y) {
    for (let j = -1; j <= p.h; j++) for (let i = -1; i <= p.w; i++) {
      if (!libre(x + i, y + j)) {
        // el borde puede tocar caminos y árboles; el rectángulo no
        if (i < 0 || j < 0 || i >= p.w || j >= p.h) { const xx = x + i, yy = y + j; if (W.inb(xx, yy) && W.poiAt[W.idx(xx, yy)] < 0 && W.bAt[W.idx(xx, yy)] < 0 && W.ownerAt(xx, yy) === null) continue; }
        return false;
      }
    }
    return true;
  }
  function lugarPoi(p) {
    for (const [dx, dy] of offsets()) if (cabePoi(p, p.x + dx, p.y + dy)) return [p.x + dx, p.y + dy];
    return null;
  }

  // ---------- Mudar ----------
  function sacarNodo(n) {
    const k = W.idx(n.x, n.y);
    if (W.nodeAt[k] === n.id) W.nodeAt[k] = -1;
    if (W.block[k] === 1) W.block[k] = 0;
    W.unbucket(n);
  }
  function ponerNodo(n, x, y) {
    n.x = x; n.y = y;
    const k = W.idx(x, y);
    W.nodeAt[k] = n.id;
    W.block[k] = n.dead && W.soft(n) ? 0 : 1;
    W.chunkNodes[W.chunkOf(x, y)].push(n); // no W.bucket: volvería a sumarlo a W.zoneNodes
  }
  function moverNodo(n, x, y) { sacarNodo(n); ponerNodo(n, x, y); }
  function moverPoi(p, x, y) {
    const st = G().poiState(p), suelto = p.kind === 'camp' && st && st.d; // un campamento derrotado ya no bloquea (W.poiFree)
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const k = W.idx(p.x + i, p.y + j);
      if (W.poiAt[k] === p.id) W.poiAt[k] = -1;
      if (W.block[k] === 3) W.block[k] = 0;
    }
    p.x = x; p.y = y;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = W.idx(x + i, y + j); W.poiAt[k] = p.id; if (!suelto) W.block[k] = 3; }
    if (st && st.f) W.reveal(x + p.w / 2, y + p.h / 2, Math.max(p.w, p.h) + 1); // si ya lo conocías, lo sigues viendo
  }
  const poiEnTierras = p => { for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (mio(p.x + i, p.y + j)) return true; return false; };

  // ¿Hay algo que mudar? (todo lo de tus tierras que no sea un árbol)
  let ver = -1;
  Dz.revisar = function (forzar) {
    const g = G(), st = S();
    if (!st || !st.despeje || (g.enMar && g.enMar())) return 0;
    if (!forzar && ver === W.terrVer) return 0;
    ver = W.terrVer;
    let n = 0;
    for (const p of W.pois) {
      if (!poiEnTierras(p)) continue;
      const to = lugarPoi(p);
      if (!to) continue;
      moverPoi(p, to[0], to[1]);
      st.despeje.p[p.id] = to; n++;
    }
    for (const o of W.nodes) {
      if (o.gone || o.temp || o.planta || Dz.QUEDAN[o.kind] || !mio(o.x, o.y)) continue;
      const to = lugarNodo(o.x, o.y);
      if (!to) continue;
      moverNodo(o, to[0], to[1]);
      st.despeje.n[o.id] = to; n++;
    }
    if (n) {
      g.blockVer++;
      // los aldeanos que iban a algo que se mudó buscan de nuevo el camino
      for (const u of g.units) if (u.owner === 'p' && u.task && u.task.t === 'gather') u.path = [];
      if (!g.offline && !Dz.cargando) toast('Lo que quedó dentro de tus tierras (minas, cuevas, campamentos…) se mudó a la tierra de nadie más cercana. Dentro solo quedan árboles.', 'info');
    }
    return n;
  };

  // ---------- Talar ----------
  function quitarArbol(n) {
    sacarNodo(n);
    n.gone = true; n.dead = true; n.amount = 0;
  }
  // Los árboles de la zona que se pueden talar: en tus tierras y de tu partida (los de las zonas comunes son de todos).
  Dz.talables = function (x0, y0, x1, y1) {
    const out = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (!W.inb(x, y) || !mio(x, y)) continue;
      const id = W.nodeAt[W.idx(x, y)], n = id >= 0 ? W.nodes[id] : null;
      if (n && n.kind === 'tree' && !n.gone && !n.temp && !W.isShared(n)) out.push(n);
    }
    return out;
  };
  Dz.talar = function (nodes) {
    const st = S();
    let madera = 0;
    for (const n of nodes) {
      madera += n.dead ? 0 : Math.floor(n.amount * 0.5);
      for (const u of G().units) if (u.task && u.task.t === 'gather' && u.task.node === n.id) u.path = []; // ven el árbol agotado y buscan otro
      quitarArbol(n);
      if (n.planta) st.despeje.plantas = st.despeje.plantas.filter(o => !(o[0] === n.x && o[1] === n.y));
      else if (!st.despeje.talados.includes(n.id)) st.despeje.talados.push(n.id);
    }
    if (madera) G().give({ wood: madera });
    G().blockVer++;
    return { n: nodes.length, madera };
  };

  // ---------- Plantar ----------
  Dz.porQueNoPlantar = function (x, y) {
    if (!W.inb(x, y) || !W.fog[W.idx(x, y)]) return 'Ahí todavía no exploraste.';
    if (!mio(x, y)) return 'Solo puedes plantar en tus tierras.';
    const k = W.idx(x, y);
    if (W.block[k] || W.terrain[k] === 4 || W.nodeAt[k] >= 0 || W.poiAt[k] >= 0 || W.bAt[k] >= 0 || W.wall[k] || W.road[k] || W.belt[k] >= 0) return 'Esa casilla no está libre.';
    // nunca pegado a un edificio: un árbol que crece en la puerta podía encerrar el patio del Centro Urbano
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (W.inb(x + i, y + j) && W.bAt[W.idx(x + i, y + j)] >= 0) return 'Muy pegado a un edificio.';
    return null;
  };
  function nuevoArbol(x, y, sp, v, amount, dead, t) {
    const n = { id: W.nodes.length, kind: 'tree', x, y, amount, max: D.NODES.tree.amount, zone: -1, v, sp, dead, t, planta: true };
    W.nodes.push(n);
    ponerNodo(n, x, y);
    return n;
  }
  Dz.plantar = function (x, y) {
    const why = Dz.porQueNoPlantar(x, y);
    if (why) { toast(why, 'warn'); return false; }
    if (!G().pay(Dz.PLANTAR)) { toast('Plantar un árbol cuesta ' + Object.keys(Dz.PLANTAR).map(r => Dz.PLANTAR[r] + ' de ' + D.RES[r].name.toLowerCase()).join(' y ') + '.', 'warn'); return false; }
    const r = Math.random(), sp = r < 0.6 ? 'oak' : r < 0.92 ? 'pine' : 'aut', v = Math.floor(Math.random() * 6);
    // un brote: un árbol «agotado» al que le falta Dz.CRECE para rebrotar (W.regrow lo hace crecer como a los demás)
    nuevoArbol(x, y, sp, v, 0, true, Date.now() - (D.NODES.tree.regrow - Dz.CRECE) * 1000);
    S().despeje.plantas.push([x, y, sp, v, 0, 1, 0]);
    G().stat('arboles_plantados', 1);
    G().blockVer++;
    if (PK.Sfx) PK.Sfx.play('reap');
    return true;
  };
  // Al guardar: el estado de cada árbol plantado va con él (ver la nota de arriba).
  Dz.guardar = function () {
    const st = S();
    if (!st || !st.despeje) return;
    st.despeje.plantas = W.nodes.filter(n => n.planta && !n.gone).map(n => [n.x, n.y, n.sp, n.v, Math.round(n.amount * 10) / 10, n.dead ? 1 : 0, n.dead ? n.t : 0]);
  };

  // ---------- Quitar murallas, puertas y caminos ----------
  Dz.quitables = function (x0, y0, x1, y1) {
    const out = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (!W.inb(x, y)) continue;
      const k = W.idx(x, y);
      if (W.wall[k] || (W.road[k] && W.bAt[k] < 0)) out.push([x, y]);
    }
    return out;
  };
  Dz.quitar = function (tiles) {
    let muros = 0, caminos = 0;
    for (const [x, y] of tiles) {
      const k = W.idx(x, y);
      if (W.wall[k]) { PK.Def.remove(k); muros++; }
      else if (W.road[k]) { PK.Logi.removeRoad(x, y); caminos++; }
    }
    if (muros || caminos) { G().blockVer++; if (PK.Sfx) PK.Sfx.play('build'); }
    return { muros, caminos };
  };

  // ---------- Herramientas (PK.Def.tool: 'quitar', 'talar' o 'plantar'; input.js las rutea por Def.click) ----------
  Dz.HERR = { quitar: 1, talar: 1, plantar: 1 };
  Dz.empezar = function (tool) {
    if (PK.Input) PK.Input.cancelTool();
    PK.Def.tool = tool; PK.Def.start = null;
    if (PK.UI) { PK.UI.closeModal(); PK.UI.refreshPanel(true); }
  };
  const recorta = (a, b) => [a[0], a[1], U.clamp(b[0], a[0] - Dz.ZONA_MAX + 1, a[0] + Dz.ZONA_MAX - 1), U.clamp(b[1], a[1] - Dz.ZONA_MAX + 1, a[1] + Dz.ZONA_MAX - 1)];
  Dz.fantasma = function (tool, x, y) {
    if (tool === 'plantar') return W.inb(x, y) ? [[x, y]] : null;
    const a = PK.Def.start || [x, y], [x0, y0, x1, y1] = recorta(a, [x, y]);
    return tool === 'talar' ? Dz.talables(x0, y0, x1, y1).map(n => [n.x, n.y]) : Dz.quitables(x0, y0, x1, y1);
  };
  Dz.click = function (tool, x, y) {
    if (tool === 'plantar') { Dz.plantar(x, y); return; }
    if (!PK.Def.start) { PK.Def.start = [x, y]; toast('Toca la otra esquina de la zona (o la misma casilla para una sola).', 'info'); return; }
    const [x0, y0, x1, y1] = recorta(PK.Def.start, [x, y]);
    PK.Def.start = null;
    if (tool === 'talar') {
      const ns = Dz.talables(x0, y0, x1, y1);
      if (!ns.length) { toast('No hay árboles tuyos en esa zona.', 'info'); return; }
      const r = Dz.talar(ns);
      toast('Talaste ' + r.n + (r.n === 1 ? ' árbol' : ' árboles') + (r.madera ? ': +' + U.fmt(r.madera) + ' de madera' : '') + '.', 'good');
    } else {
      const ts = Dz.quitables(x0, y0, x1, y1);
      if (!ts.length) { toast('No hay murallas ni caminos en esa zona.', 'info'); return; }
      const r = Dz.quitar(ts);
      toast('Quitaste ' + [r.muros ? r.muros + (r.muros === 1 ? ' muralla o puerta' : ' murallas y puertas') : '', r.caminos ? r.caminos + (r.caminos === 1 ? ' casilla de camino' : ' casillas de camino') : ''].filter(Boolean).join(' y ') + '. Vuelve la mitad del material.', 'good');
    }
  };

  // ---------- Cargar ----------
  Dz.init = function (st) {
    st.despeje = Object.assign({ n: {}, p: {}, talados: [], plantas: [] }, st.despeje);
    const dz = st.despeje;
    if (G().enMar && G().enMar()) return;
    Dz.cargando = true;
    try {
      // lo que ya se había mudado vuelve a su lugar nuevo (si sigue libre; si no, se busca otro)
      for (const id in dz.p) { const p = W.pois[id], to = dz.p[id]; if (!p) continue; if (cabePoi(p, to[0], to[1]) || poiEnTierras(p)) moverPoi(p, to[0], to[1]); }
      for (const id in dz.n) { const n = W.nodes[id], to = dz.n[id]; if (!n || n.gone) continue; const k = W.idx(to[0], to[1]); if (W.inb(to[0], to[1]) && W.nodeAt[k] < 0 && W.bAt[k] < 0 && W.poiAt[k] < 0) moverNodo(n, to[0], to[1]); }
      for (const id of dz.talados) { const n = W.nodes[id]; if (n && !n.gone) quitarArbol(n); }
      const plantas = dz.plantas;
      dz.plantas = [];
      for (const [x, y, sp, v, amount, dead, t] of plantas) {
        const k = W.idx(x, y);
        if (!W.inb(x, y) || W.nodeAt[k] >= 0 || W.bAt[k] >= 0 || W.poiAt[k] >= 0) continue;
        nuevoArbol(x, y, sp || 'oak', v || 0, amount || 0, !!dead, t || 0);
        dz.plantas.push([x, y, sp, v, amount, dead, t]);
      }
      Dz.revisar(true);
    } finally { Dz.cargando = false; }
  };
  // Cada 2 s, por si cambió tu territorio (reclamaste o conquistaste una parcela).
  let t = 0;
  Dz.tick = function (dt) { if ((t += dt) >= 2) { t = 0; Dz.revisar(false); } };
})();
