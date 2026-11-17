// Despeje del territorio, tala y plantación (pk-40, pedido del dueño), y la herramienta de quitar por zona.
//
// - Dentro de cualquier territorio solo pueden quedar árboles y arbustos de bayas. Lo demás (cuevas, mazmorras,
//   campamentos, ruinas, cofres, lugares legendarios, minas, vetas, ciervos) va adonde dice W.ubicarLugares (world.js,
//   L4 pk-45): la casilla más cercana a su lugar original a W.LEJOS (12) casillas o más de todo territorio, la misma
//   para todos. Se reaplica al cargar y cada vez que cambia el territorio (W.terrVer). Solo en la tierra.
// - Talar (zona) quita árboles y arbustos de tus tierras para siempre (st.despeje.talados) y devuelve la mitad de lo
//   que les quedaba (madera o comida).
//   Plantar (de a un toque) pone un brote que a los 20 minutos es un árbol que rebrota como cualquier otro
//   (st.despeje.plantas, con su estado: sus ids cambian si un evento creó nodos temporales antes).
// - Quitar (zona) desarma murallas y puertas (mitad de vuelta, como Def.remove) y caminos (PK.Logi.removeRoad).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Dz = (PK.Despeje = {});
  const G = () => PK.Game, S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);

  Dz.QUEDAN = W.QUEDAN;                     // lo único que puede quedar dentro de un territorio (y se puede talar)
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
    return W.block[k] === 0 && W.terrain[k] !== 4 && W.nodeAt[k] < 0 && W.poiAt[k] < 0 && W.bAt[k] < 0 && !W.wall[k] && !W.road[k] && W.belt[k] < 0 && !W.autopista[k] &&
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
    const st = G().poiState(p), suelto = (p.kind === 'camp' && st && st.d) || !!D.POI[p.kind].dungeon; // un campamento derrotado ya no bloquea (W.poiFree); la entrada de una mazmorra se pisa (pk-62)
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const k = W.idx(p.x + i, p.y + j);
      if (W.poiAt[k] === p.id) W.poiAt[k] = -1;
      if (W.block[k] === 3) W.block[k] = 0;
    }
    p.x = x; p.y = y;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const k = W.idx(x + i, y + j); W.poiAt[k] = p.id; if (!suelto) W.block[k] = 3; }
    if (st && st.f) W.reveal(x + p.w / 2, y + p.h / 2, Math.max(p.w, p.h) + 1); // si ya lo conocías, lo sigues viendo
  }
  // pk-62: bajo tierra, sin casilla en el mapa; W.subAt la encuentra cuando se explora la casilla de arriba
  function hundir(p, at) {
    const k = W.idx(p.x, p.y);
    if (W.poiAt[k] === p.id) W.poiAt[k] = -1;
    if (W.block[k] === 3) W.block[k] = 0;
    p.x = at[0]; p.y = at[1]; p.sub = true;
    W.subAt.set(W.idx(p.x, p.y), p.id);
  }
  // una mazmorra que se muda (o se hunde) bajo tierra ya explorada se descubre ahí mismo, sin un aviso por cada una
  function hallar(p, at) {
    if (!D.POI[p.kind].dungeon || !W.fog[W.idx(at[0], at[1])]) return 0;
    const st = G().poiState(p);
    if (st && st.f) return 0;
    G().discoverPoi(p, true);
    return 1;
  }
  const poiEnTierras = p => { for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (mio(p.x + i, p.y + j)) return true; return false; };

  // ¿Dónde va cada cosa? L4 (pk-45): W.ubicarLugares, igual para todos (de cualquier territorio, a W.LEJOS casillas).
  // Aquí solo se aplica: si su casilla tiene algo tuyo (un campamento o un camino en tierra de nadie, que no son datos
  // comunes), en tu partida se corre a la tierra de nadie libre más cercana. Lo que ya no está en ningún territorio
  // vuelve a donde lo puso el mapa.
  function nodoCabe(n, x, y) {
    if (!W.inb(x, y)) return false;
    const k = W.idx(x, y), suyo = W.nodeAt[k] === n.id;
    return (W.nodeAt[k] < 0 || suyo) && (W.block[k] === 0 || suyo) && W.poiAt[k] < 0 && W.bAt[k] < 0 && !W.wall[k] && !W.road[k] && W.belt[k] < 0 && W.terrain[k] !== 4;
  }
  function poiCabe(p, x, y) {
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const xx = x + i, yy = y + j;
      if (!W.inb(xx, yy)) return false;
      const k = W.idx(xx, yy);
      if ((W.poiAt[k] >= 0 && W.poiAt[k] !== p.id) || W.nodeAt[k] >= 0 || W.bAt[k] >= 0 || W.wall[k] || W.road[k] || W.belt[k] >= 0 || W.terrain[k] === 4 || W.autopista[k]) return false;
    }
    return true;
  }
  let ver = -1;
  Dz.revisar = function (forzar) {
    const g = G(), st = S();
    if (!st || !st.despeje || (g.enMar && g.enMar()) || !W.ORIG) return 0;
    // pk-78: también cuando cambia la Calzada Real (un lugar que pisa se muda) o un recurso que moviste
    const v = W.terrVer + ':' + (W.apVer || 0) + ':' + Dz.moverVer;
    if (!forzar && ver === v) return 0;
    ver = v;
    const ub = W.ubicarLugares(W.terr, k => W.autopista[k] > 0, W.apVer || 0), mv = movidos(st);
    let n = 0, tuyo = false;
    if (PK.Campana && PK.Campana.revisarLugar && PK.Campana.revisarLugar()) n++; // pk-55: el lugar del capítulo, también
    if (g.revisarPuestos) g.revisarPuestos(); // pk-55: tus campamentos que quedaron en tierra de otro
    let halladas = 0;
    for (let id = 0; id < W.ORIG.p.length; id++) {
      const p = W.pois[id];
      if (!p) continue;
      if (ub.sub[id]) { // pk-62: una mazmorra sin lugar afuera queda bajo tierra (se entra desde el Cuartel)
        if (!p.sub) { if (poiEnTierras(p)) tuyo = true; hundir(p, W.ORIG.p[id]); n++; }
        halladas += hallar(p, W.ORIG.p[id]);
        continue;
      }
      const to = ub.p[id] || W.ORIG.p[id], salia = !!p.sub;
      if (!salia && p.x === to[0] && p.y === to[1]) continue;
      const dest = poiCabe(p, to[0], to[1]) ? to : lugarPoi(Object.assign({}, p, { x: to[0], y: to[1] }));
      if (!dest || (!salia && dest[0] === p.x && dest[1] === p.y)) continue;
      if (!salia && poiEnTierras(p)) tuyo = true;
      if (salia) { p.sub = false; W.subAt.delete(W.idx(p.x, p.y)); }
      moverPoi(p, dest[0], dest[1]); n++;
      halladas += hallar(p, dest);
    }
    if (halladas && !g.offline && !Dz.cargando) toast(halladas === 1 ? 'Apareció la entrada de una mazmorra en tierra ya explorada: está en Expediciones.' : 'Aparecieron ' + halladas + ' entradas de mazmorra en tierra ya explorada: están en Expediciones.', 'quest');
    for (let id = 0; id < W.ORIG.n.length; id++) {
      const o = W.nodes[id];
      if (!o || o.gone || o.temp || o.planta) continue;
      // pk-78: un recurso que moviste va donde lo pusiste (st.despeje.mover), si sigue siendo tierra tuya o de nadie
      let m = mv[id];
      if (m && (!moverDestinoOk(m[0], m[1]) || !zonaOk(o, m[0], m[1]))) { delete mv[id]; m = null; }
      const orig = W.ORIG.n[id];
      if (W.QUEDAN[o.kind] && !m && o.x === orig[0] && o.y === orig[1]) continue;
      const to = m || (W.QUEDAN[o.kind] ? orig : ub.n[id] || orig);
      if (o.x === to[0] && o.y === to[1]) continue;
      const dest = nodoCabe(o, to[0], to[1]) ? to : lugarNodo(to[0], to[1]);
      if (!dest || (dest[0] === o.x && dest[1] === o.y)) continue;
      if (mio(o.x, o.y) && !m && !W.QUEDAN[o.kind]) tuyo = true;
      moverNodo(o, dest[0], dest[1]); n++;
    }
    if (n) {
      g.blockVer++;
      // los aldeanos que iban a algo que se mudó buscan de nuevo el camino
      for (const u of g.units) if (u.task && u.task.t === 'gather') u.path = [];
      if (tuyo && !g.offline && !Dz.cargando) toast('Lo que quedó dentro de tus tierras (minas, cuevas, ciervos, campamentos…) se mudó a la tierra de nadie, a ' + W.LEJOS + ' casillas de todo reino. Dentro solo quedan árboles y arbustos.', 'info');
    }
    return n;
  };

  // ---------- Talar ----------
  function quitarArbol(n) {
    sacarNodo(n);
    n.gone = true; n.dead = true; n.amount = 0;
  }
  // Los árboles y arbustos de la zona que se pueden talar: en tus tierras y de tu partida (los de las zonas comunes son de todos).
  Dz.talables = function (x0, y0, x1, y1) {
    const out = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (!W.inb(x, y) || !mio(x, y)) continue;
      const id = W.nodeAt[W.idx(x, y)], n = id >= 0 ? W.nodes[id] : null;
      if (n && Dz.QUEDAN[n.kind] && !n.gone && !n.temp && !W.isShared(n)) out.push(n);
    }
    return out;
  };
  Dz.talar = function (nodes) {
    const st = S(), vuelve = {};
    let madera = 0;
    for (const n of nodes) {
      const r = D.NODES[n.kind].res, k = n.dead ? 0 : Math.floor(n.amount * 0.5);
      if (k) vuelve[r] = (vuelve[r] || 0) + k;
      if (r === 'wood') madera += k;
      for (const u of G().units) if (u.task && u.task.t === 'gather' && u.task.node === n.id) u.path = []; // ven el árbol agotado y buscan otro
      quitarArbol(n);
      if (n.planta) st.despeje.plantas = st.despeje.plantas.filter(o => !(o[0] === n.x && o[1] === n.y));
      else if (!st.despeje.talados.includes(n.id)) st.despeje.talados.push(n.id);
    }
    if (Object.keys(vuelve).length) G().give(vuelve);
    G().blockVer++;
    return { n: nodes.length, madera, vuelve };
  };

  Dz.vuelveTxt = v => Object.keys(v).map(r => '+' + U.fmt(v[r]) + ' de ' + D.RES[r].name.toLowerCase()).join(' y ');

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
      if (W.wall[k] || (W.road[k] && W.bAt[k] < 0) || (PK.Calzada && PK.Calzada.quitables(x, y, x, y).length) || (PK.Cintas && PK.Cintas.piezaEn(x, y))) out.push([x, y]);
    }
    return out;
  };
  Dz.quitar = function (tiles) {
    let muros = 0, caminos = 0, cintas = 0;
    for (const [x, y] of tiles) {
      const k = W.idx(x, y);
      if (PK.Cintas && PK.Cintas.piezaEn(x, y)) { PK.Cintas.quitar(k); cintas++; continue; } // pk-58
      if (W.wall[k]) { PK.Def.remove(k); muros++; }
      else if (W.road[k]) { PK.Logi.removeRoad(x, y); caminos++; }
    }
    const cz = PK.Calzada ? tiles.filter(([x, y]) => PK.Calzada.quitables(x, y, x, y).length) : [];
    if (cz.length) { PK.Calzada.quitar(cz); caminos += cz.length; } // L5: la Calzada Real (la tuya, o la de otro en tu tierra)
    if (muros || caminos || cintas) { G().blockVer++; if (PK.Sfx) PK.Sfx.play('build'); }
    return { muros, caminos, cintas };
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
      if (!ns.length) { toast('No hay árboles ni arbustos tuyos en esa zona.', 'info'); return; }
      const r = Dz.talar(ns);
      toast('Quitaste ' + r.n + (r.n === 1 ? ' árbol o arbusto' : ' árboles y arbustos') + (Object.keys(r.vuelve).length ? ': ' + Dz.vuelveTxt(r.vuelve) : '') + '.', 'good');
    } else {
      const ts = Dz.quitables(x0, y0, x1, y1);
      if (!ts.length) { toast('No hay murallas, caminos ni cintas en esa zona.', 'info'); return; }
      const r = Dz.quitar(ts);
      toast('Quitaste ' + [r.muros ? r.muros + (r.muros === 1 ? ' muralla o puerta' : ' murallas y puertas') : '', r.caminos ? r.caminos + (r.caminos === 1 ? ' casilla de camino' : ' casillas de camino') : '', r.cintas ? r.cintas + (r.cintas === 1 ? ' pieza de cinta' : ' piezas de cinta') : ''].filter(Boolean).join(' y ') + '. Vuelve la mitad del material.', 'good');
    }
  };

  // ---------- Mover recursos (pk-78, pedido del dueño) ----------
  // Un recurso del mapa (árbol, arbusto, mina, veta, ciervo…) se puede llevar a otra casilla pagando monedas del reino:
  // D.moverRecursoCosto(distancia) por cada uno (1 cada 3 casillas). Se guarda la casilla nueva por id del recurso
  // (st.despeje.mover) y Dz.revisar la respeta en vez de la de W.ubicarLugares. Solo en tu partida: los demás siguen
  // viendo el mapa como siempre, y el servidor no sabe de recursos desde L4.
  Dz.moverVer = 0;
  const movidos = st => (st.despeje.mover = st.despeje.mover || {});
  function moverDestinoOk(x, y) {
    if (!W.inb(x, y)) return false;
    const o = W.ownerAt(x, y);
    return o === null || o === 'p';
  }
  // pk-79 (pedido del dueño): un recurso de una zona común no sale de esa zona
  const zonaOk = (n, x, y) => !n || !W.isShared(n) || W.zoneAt[W.idx(x, y)] === n.zone;
  // ¿Puede ir un recurso a esa casilla? propios: casillas del mismo grupo, que cuentan como libres; n: el recurso
  Dz.porQueNoMover = function (x, y, propios, n) {
    if (!W.inb(x, y)) return 'fuera del mapa';
    const k = W.idx(x, y), suyo = propios && propios.has(k);
    if (!W.fog[k]) return 'sin explorar';
    if (!zonaOk(n, x, y)) return 'lo de ' + W.zones[n.zone].name + ' no sale de esa zona común';
    if (!moverDestinoOk(x, y)) return 'tierra de otro reino';
    if (W.terrain[k] === 4) return 'agua';
    if (!suyo && (W.nodeAt[k] >= 0 || W.block[k] !== 0)) return 'ocupada';
    if (W.poiAt[k] >= 0 || W.bAt[k] >= 0 || W.wall[k] || W.wallOwner[k] || W.road[k] || W.belt[k] >= 0 || W.autopista[k] || W.reserved[k]) return 'ocupada';
    if (PK.Fort && PK.Fort.cerca(x, y, 1, 1)) return 'junto a una fortaleza';
    // como al plantar: nunca pegado a un edificio (podía cerrar el patio del Centro Urbano)
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (W.inb(x + i, y + j) && W.bAt[W.idx(x + i, y + j)] >= 0) return 'pegada a un edificio';
    return null;
  };
  Dz.movible = n => !!(n && !n.gone && !n.temp && !n.calzada && (n.id < W.ORIG.n.length || n.planta) && moverDestinoOk(n.x, n.y));
  Dz.movibles = function (x0, y0, x1, y1) {
    const out = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (!W.inb(x, y) || !W.fog[W.idx(x, y)]) continue;
      const id = W.nodeAt[W.idx(x, y)], n = id >= 0 ? W.nodes[id] : null;
      if (Dz.movible(n)) out.push(n);
      if (out.length >= D.MOVER_RECURSO.max) return out;
    }
    return out;
  };
  // El plan de mover el grupo para que el recurso de referencia (ref) quede en (x, y): cada uno con su casilla nueva,
  // las que no pueden ir y lo que cuesta. El grupo conserva su forma.
  Dz.planMover = function (nodos, ref, x, y) {
    const dx = x - ref.x, dy = y - ref.y, propios = new Set(nodos.map(n => W.idx(n.x, n.y)));
    const dist = Math.hypot(dx, dy), uno = D.moverRecursoCosto(dist);
    const tiles = nodos.map(n => { const tx = n.x + dx, ty = n.y + dy, why = Dz.porQueNoMover(tx, ty, propios, n); return { n, x: tx, y: ty, mala: !!why, why }; });
    const malas = tiles.filter(t => t.mala);
    return { tiles, malas, dist, uno, costo: (dx || dy) ? uno * nodos.length : 0, ok: !!(dx || dy) && !malas.length };
  };
  Dz.mover = function (plan) {
    if (!plan || !plan.ok) return 0;
    const st = S(), mv = movidos(st), monedas = plan.costo;
    if (!PK.Platform.spendCoins(monedas, 'mover-recurso')) { toast('Te faltan monedas del reino (' + monedas + ').', 'warn'); return 0; }
    for (const t of plan.tiles) sacarNodo(t.n);
    for (const t of plan.tiles) {
      const n = t.n;
      if (n.planta) { const e = st.despeje.plantas.find(o => o[0] === n.x && o[1] === n.y); if (e) { e[0] = t.x; e[1] = t.y; } }
      else mv[n.id] = [t.x, t.y];
      ponerNodo(n, t.x, t.y);
      for (const u of G().units) if (u.task && u.task.node === n.id) u.path = [];
    }
    Dz.moverVer++;
    G().blockVer++;
    G().stat('recursos_movidos', plan.tiles.length);
    if (PK.Sfx) PK.Sfx.play('build');
    return plan.tiles.length;
  };

  // ---------- Cargar ----------
  Dz.init = function (st) {
    st.despeje = Object.assign({ talados: [], plantas: [], mover: {} }, st.despeje);
    const dz = st.despeje;
    if (G().enMar && G().enMar()) return;
    Dz.cargando = true;
    try {
      // L4: las posiciones salen de W.ubicarLugares (Dz.revisar, abajo); las guardadas por partida ya no hacen falta
      delete dz.n; delete dz.p;
      for (const id of dz.talados) { const n = W.nodes[id]; if (n && !n.gone) quitarArbol(n); }
      // pk-78: los árboles que moviste, a su lugar antes de mirar si quedaron bajo un edificio (el de su lugar original
      // puede ser uno que construiste después de moverlo)
      for (const id in movidos(st)) { const n = W.nodes[id], m = dz.mover[id]; if (n && !n.gone && Dz.QUEDAN[n.kind] && nodoCabe(n, m[0], m[1])) moverNodo(n, m[0], m[1]); }
      // un arbusto que vuelve a su lugar y encuentra un edificio encima (se construyó mientras estaba mudado): no va
      for (const n of W.nodes) if (Dz.QUEDAN[n.kind] && !n.gone && !n.temp && W.bAt[W.idx(n.x, n.y)] >= 0) quitarArbol(n);
      const plantas = dz.plantas;
      dz.plantas = [];
      for (const [x, y, sp, v, amount, dead, t] of plantas) {
        const k = W.idx(x, y);
        if (!W.inb(x, y) || W.nodeAt[k] >= 0 || W.bAt[k] >= 0 || W.poiAt[k] >= 0) continue;
        nuevoArbol(x, y, sp || 'oak', v || 0, amount || 0, !!dead, t || 0);
        dz.plantas.push([x, y, sp, v, amount, dead, t]);
      }
      Dz.revisar(true);
      if (PK.Def.revisarAjenas) PK.Def.revisarAjenas(); // L4: las murallas de los reinos simulados
    } finally { Dz.cargando = false; }
  };
  // Cada 2 s, por si cambió tu territorio (reclamaste o conquistaste una parcela).
  let t = 0;
  Dz.tick = function (dt) { if ((t += dt) >= 2) { t = 0; Dz.revisar(false); if (PK.Def.revisarAjenas) PK.Def.revisarAjenas(); } };
})();
