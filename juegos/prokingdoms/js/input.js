// Controles: clic para seleccionar, arrastrar para seleccionar en grupo, clic derecho para ordenar,
// rueda para zoom, WASD/flechas o botón central para mover la cámara. En pantallas táctiles: tocar
// selecciona; con aldeanos seleccionados, tocar un objetivo da la orden; arrastrar mueve la cámara;
// mantener pulsado y arrastrar selecciona en grupo; doble toque en un aldeano elige a los de su tipo.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const I = (PK.Input = { keys: {}, box: null, mouse: { x: 0, y: 0, in: false } });
  const G = () => PK.Game, R = () => PK.Render;

  let down = null, pan = null;
  const touches = new Map();
  let pinch = null;
  // Con el dedo: pulsación larga (sin moverse) activa la selección por caja; doble toque sobre un
  // aldeano selecciona a todos los de su tipo que se ven en pantalla.
  const LONG_MS = 450;
  let lastTap = null;
  function clearLong() { if (down && down.lp) { clearTimeout(down.lp); down.lp = 0; } }
  function startLong(d) {
    d.lp = 0;
    if (down !== d || d.moved || touches.size !== 1) return;
    const g = G();
    if (g.placing || PK.Logi.tool || PK.Def.tool || PK.Terr.mode) return;
    d.box = true;
    I.box = { x0: d.x, y0: d.y, x1: d.x, y1: d.y };
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) { /* sin vibración */ }
  }

  I.init = function (cv) {
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', e => { touches.delete(e.pointerId); pinch = null; clearLong(); down = null; pan = null; I.box = null; });
    cv.addEventListener('pointerenter', () => { I.mouse.in = true; });
    cv.addEventListener('pointerleave', () => { I.mouse.in = false; });
    cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); }, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', e => { I.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { I.keys = {}; });
  };

  // Niveles de zoom: 0,5 permite ver una buena parte del mapa grande.
  const ZOOMS = [0.5, 1, 2, 3, 4];
  function zoom(dir, cx, cy) {
    const r = R(), old = r.cam.z, i = ZOOMS.indexOf(old), nz = ZOOMS[U.clamp((i < 0 ? 2 : i) + dir, 0, ZOOMS.length - 1)];
    if (nz === old) return;
    const [wx, wy] = r.screenToWorld(cx, cy);
    r.cam.z = nz;
    const [wx2, wy2] = r.screenToWorld(cx, cy);
    r.cam.x += wx - wx2; r.cam.y += wy - wy2;
    r.clampCam();
  }

  function onDown(e) {
    if (e.pointerType === 'touch') {
      if (e.isPrimary) { touches.clear(); pinch = null; }
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        clearLong(); down = null; I.box = null;
      } else {
        clearLong();
        const d = { x: e.clientX, y: e.clientY, touch: true, moved: false, box: false, lp: 0 };
        d.lp = setTimeout(() => startLong(d), LONG_MS);
        down = d;
      }
      return;
    }
    if (e.button === 1 || (e.button === 0 && I.keys[' '])) { pan = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
    if (e.button === 0) down = { x: e.clientX, y: e.clientY };
    if (e.button === 2) rightClick(e.clientX, e.clientY);
  }

  function onMove(e) {
    I.mouse.x = e.clientX; I.mouse.y = e.clientY;
    const r = R();
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      const t = touches.get(e.pointerId);
      const dx = e.clientX - t.x, dy = e.clientY - t.y;
      t.x = e.clientX; t.y = e.clientY;
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d / pinch.d > 1.35) { zoom(1, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; }
        else if (d / pinch.d < 0.74) { zoom(-1, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; }
        return;
      }
      if (down && down.box) { I.box = { x0: down.x, y0: down.y, x1: e.clientX, y1: e.clientY }; return; }
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down.moved = true; clearLong(); }
      if (down && down.moved) { r.cam.x -= dx / r.cam.z; r.cam.y -= dy / r.cam.z; r.clampCam(); }
      return;
    }
    if (pan) {
      r.cam.x -= (e.clientX - pan.x) / r.cam.z; r.cam.y -= (e.clientY - pan.y) / r.cam.z;
      pan.x = e.clientX; pan.y = e.clientY; r.clampCam();
      return;
    }
    if (down && !down.touch && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 && !G().placing) {
      I.box = { x0: down.x, y0: down.y, x1: e.clientX, y1: e.clientY };
    }
    if (G().placing) updateGhost(e.clientX, e.clientY);
    toolGhost(e.clientX, e.clientY);
    I.mouse.on = e.target === r.cv; // para recalcular el cartel en I.update
    if (e.target === r.cv) {
      const it = r.pick(e.clientX, e.clientY);
      r.hover = it && it.k !== 'tile' ? it : null;
      PK.UI.hoverInfo(r.hover, e.clientX, e.clientY);
      r.cv.style.cursor = cursorFor(r.hover);
    } else { r.hover = null; PK.UI.hoverInfo(null); }
  }

  function cursorFor(h) {
    if (G().placing) return 'crosshair';
    if (!h) return 'default';
    const units = G().selUnits().length > 0;
    if (units && (h.k === 'node' || h.k === 'poi' || (h.k === 'building' && h.o.owner === 'p'))) return 'pointer';
    return h.k === 'unit' && h.o.owner === 'p' ? 'pointer' : 'default';
  }

  function onUp(e) {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      clearLong();
      if (down && down.box) {
        const b = I.box;
        if (b && Math.abs(b.x1 - b.x0) > 10 && Math.abs(b.y1 - b.y0) > 10) boxSelect(b, false);
        I.box = null; down = null;
        return;
      }
      if (down && !down.moved && e.target === R().cv) tap(e.clientX, e.clientY);
      if (!touches.size) down = null;
      return;
    }
    if (pan && (e.button === 1 || e.button === 0)) { pan = null; return; }
    if (e.button !== 0 || !down) return;
    if (I.box) { boxSelect(I.box, e.shiftKey); I.box = null; down = null; return; }
    down = null;
    if (e.target !== R().cv) return;
    leftClick(e.clientX, e.clientY, e.shiftKey);
  }

  function tap(x, y) {
    const g = G();
    if (g.placing || PK.Logi.tool || PK.Def.tool || PK.Terr.mode || I.flagTool || (PK.Asedios && PK.Asedios.herramienta)) { leftClick(x, y, false, true); return; }
    const it = R().pick(x, y);
    const now = performance.now(), prev = lastTap;
    lastTap = { x, y, t: now };
    if (prev && now - prev.t < 350 && Math.hypot(x - prev.x, y - prev.y) < 28 && it && it.k === 'unit' && it.o.owner === 'p') {
      lastTap = null; selectKindOnScreen(it.o.kind); return;
    }
    // Con el dedo no hay Esc ni clic derecho: tocar el suelo vacío suelta lo elegido (antes, con aldeanos elegidos,
    // los mandaba a caminar ahí y no había forma de deseleccionarlos). Tocar otra vez al único aldeano elegido, también.
    if (g.sel && (!it || it.k === 'tile')) { g.sel = null; PK.UI.refreshPanel(true); return; }
    if (it && it.k === 'unit' && it.o.owner === 'p' && g.sel && g.sel.type === 'units' && g.sel.ids.length === 1 && g.sel.ids[0] === it.o.id) { g.sel = null; PK.UI.refreshPanel(true); return; }
    if (g.selUnits().length && it && !(it.k === 'unit' && it.o.owner === 'p')) { rightClick(x, y); return; }
    if (g.sel && g.sel.type === 'building' && it && it.k === 'node' && g.bById.get(g.sel.id) && g.bById.get(g.sel.id).type === 'tc') { rightClick(x, y); return; }
    leftClick(x, y, false);
  }

  function updateGhost(sx, sy) {
    const def = D.BUILD[G().placing.type], [tx, ty] = R().screenToTile(sx, sy), br = G().placing.barrio;
    let x = Math.floor(tx - def.w / 2 + 0.5), y = Math.floor(ty - def.h / 2 + 0.5);
    // barrio (A7): las casas siguientes se acomodan en la cuadrícula de la primera, con calles de 1 casilla
    if (br) { const px = def.w + 1, py = def.h + 1; x = br.x + Math.round((x - br.x) / px) * px; y = br.y + Math.round((y - br.y) / py) * py; }
    R().ghost = { x, y, ok: G().canPlace(G().placing.type, x, y, G().placing.move) };
  }

  // Herramientas de logística: caminos (dos toques: inicio y fin) y cintas (edificio de origen y de destino).
  function toolGhost(sx, sy) {
    const r = R(), L = PK.Logi;
    r.roadGhost = null; r.beltGhost = null;
    if (PK.Def.tool) { const [tx, ty] = r.screenToTile(sx, sy); PK.Def.ghost(Math.floor(tx), Math.floor(ty)); return; }
    if (L.tool === 'road' && I.roadStart) {
      const [tx, ty] = r.screenToTile(sx, sy);
      r.roadGhost = L.roadPlan(I.roadStart[0], I.roadStart[1], Math.floor(tx), Math.floor(ty));
    } else if (L.tool === 'belt' && L.beltFrom) {
      const it = r.pick(sx, sy), a = G().bById.get(L.beltFrom);
      if (a && it && it.k === 'building' && it.o.owner === 'p' && it.o !== a) r.beltGhost = L.beltPlan(a, it.o);
    }
  }
  // Herramienta «Poner bandera» (A4): el próximo toque en el mapa o el minimapa pone (o quita) una bandera.
  I.flagTool = false;
  I.startFlag = function () {
    I.cancelTool();
    I.flagTool = true;
    PK.UI.toast('Toca la niebla en el mapa o en el minimapa para poner la bandera (' + PK.UI.hint('clic derecho o Esc', 'toca la bandera del panel') + ' para cancelar). Tocar una bandera la quita.', 'info');
  };
  I.flagAt = function (tx, ty) {
    I.flagTool = false;
    G().ponerBandera(Math.floor(tx), Math.floor(ty));
    PK.UI.refreshPanel(true);
  };
  I.cancelTool = function () {
    const L = PK.Logi;
    I.flagTool = false;
    if (PK.Asedios) PK.Asedios.cancelar();
    L.tool = null; L.beltFrom = null; I.roadStart = null;
    PK.Def.cancel();
    R().roadGhost = null; R().beltGhost = null;
    PK.UI.refreshPanel(true);
  };
  function toolClick(sx, sy) {
    const L = PK.Logi, r = R();
    if (L.tool === 'road') {
      const [tx, ty] = r.screenToTile(sx, sy), x = Math.floor(tx), y = Math.floor(ty);
      if (!W.inb(x, y)) return;
      if (!I.roadStart) {
        if (!L.roadAllowed(x, y)) { PK.UI.toast('Ahí no se puede hacer camino (tiene que ser tu tierra o tierra de nadie, explorada y libre).', 'warn'); return; }
        I.roadStart = [x, y]; PK.UI.toast('Toca dónde termina el camino.', 'info'); return;
      }
      const n = L.buildRoad(L.roadPlan(I.roadStart[0], I.roadStart[1], x, y));
      if (n) { PK.UI.toast('Camino de ' + n + ' casillas.', 'good'); I.roadStart = [x, y]; }
      r.roadGhost = null;
      return;
    }
    if (L.tool === 'belt') {
      const it = r.pick(sx, sy);
      if (!it || it.k !== 'building' || it.o.owner !== 'p' || !it.o.done) { PK.UI.toast('Toca un edificio tuyo.', 'warn'); return; }
      if (!L.beltFrom) { L.beltFrom = it.o.id; PK.UI.toast('Origen: ' + it.o.def.name + '. Ahora toca el destino.', 'info'); return; }
      const a = G().bById.get(L.beltFrom);
      if (a && L.buildBelt(a, it.o)) I.cancelTool();
      return;
    }
  }

  // Construir en el lugar del fantasma (con el dedo se confirma con un segundo toque o con «Construir aquí»).
  I.placeGhost = function (shift) {
    const g = G(), gh = R().ghost;
    if (!g.placing || !gh) return;
    if (g.placing.move !== undefined) { // mudanza: un solo lugar y listo
      const m = g.bById.get(g.placing.move);
      if (m && g.moveBuilding(m, gh.x, gh.y)) { g.placing = null; R().ghost = null; g.sel = { type: 'building', id: m.id }; }
      else if (g.placing) g.placing.armed = false;
      PK.UI.refreshPanel(true);
      return;
    }
    const b = g.place(g.placing.type, gh.x, gh.y), barrio = g.placing.type === 'house' && (shift || !!g.state.flags.barrio);
    if (b && barrio) calles(g, b);
    if (b && !shift && !barrio) { g.placing = null; R().ghost = null; }
    else if (b && g.placing) g.placing.armed = false;
    PK.UI.refreshPanel(true);
  };
  // Barrio (A7 del plan): Mayús (o «Modo barrio» en el panel) pone casas en cuadrícula, dejando calles de una
  // casilla, y traza el camino de la calle de abajo y de la derecha si alcanza la piedra. Junto con el bloqueo
  // del encierro (G.encierra), evita el patio cerrado del playtest.
  function calles(g, b) {
    if (!g.placing.barrio) g.placing.barrio = { x: b.x, y: b.y };
    if (g.state.flags.barrioSinCaminos) return;
    const tiles = [];
    for (let i = 0; i <= b.w; i++) tiles.push([b.x + i, b.y + b.h]);
    for (let j = 0; j < b.h; j++) tiles.push([b.x + b.w, b.y + j]);
    const ok = tiles.filter(([x, y]) => W.inb(x, y) && !W.road[W.idx(x, y)] && W.passable(x, y) && W.bAt[W.idx(x, y)] < 0 && W.ownerAt(x, y) === 'p');
    const cost = {};
    for (const r in D.ROAD.cost) cost[r] = D.ROAD.cost[r] * ok.length;
    if (ok.length && g.canAfford(cost)) PK.Logi.buildRoad(ok);
  }
  // Mover un edificio: el mismo fantasma que al construir, con su tamaño, y sus propias casillas cuentan libres.
  I.startMoving = function (b) {
    const g = G();
    if (!g.canMove(b)) { if (b && g.MOVE_NO[b.type]) PK.UI.toast(g.MOVE_NO[b.type], 'warn'); return; }
    I.cancelTool();
    g.placing = { type: b.type, armed: false, move: b.id };
    R().ghost = null;
    PK.UI.refreshPanel(true);
  };
  I.startPlacing = function (type) {
    const g = G();
    I.cancelTool();
    g.placing = { type, armed: false };
    R().ghost = null;
    PK.UI.refreshPanel(true);
  };

  function leftClick(sx, sy, shift, touch) {
    const g = G();
    if (I.flagTool) { const [tx, ty] = R().screenToTile(sx, sy); I.flagAt(tx, ty); return; }
    if (PK.Asedios && PK.Asedios.herramienta) { const [tx, ty] = R().screenToTile(sx, sy); PK.Asedios.click(tx, ty); return; } // trampas (C5)
    if (PK.Logi.tool) { toolClick(sx, sy); return; }
    if (PK.Def.tool) { const [tx, ty] = R().screenToTile(sx, sy); PK.Def.click(Math.floor(tx), Math.floor(ty)); PK.UI.refreshPanel(true); return; }
    if (PK.Terr.mode) {
      const it = R().pick(sx, sy);
      if (it && it.k === 'parcel') PK.Terr.pick(it.x, it.y);
      return;
    }
    if (g.placing) {
      // con el dedo, el primer toque muestra dónde quedaría; el segundo sobre el mismo lugar lo construye
      if (touch) {
        const gh = R().ghost, def = D.BUILD[g.placing.type], [tx, ty] = R().screenToTile(sx, sy);
        const onGhost = g.placing.armed && gh && tx >= gh.x - 0.5 && tx < gh.x + def.w + 0.5 && ty >= gh.y - 0.5 && ty < gh.y + def.h + 0.5;
        if (!onGhost) { updateGhost(sx, sy); g.placing.armed = true; PK.UI.refreshPanel(true); return; }
      } else updateGhost(sx, sy);
      I.placeGhost(shift);
      return;
    }
    const it = R().pick(sx, sy);
    if (!it || it.k === 'tile') { if (!shift) g.sel = null; PK.UI.refreshPanel(true); return; }
    if (it.k === 'troop') { PK.UI.openBarracks(it.o.march || it.o.fight ? 'exp' : 'troops'); return; }
    if (it.k === 'galeon') { PK.Mar.abrir(); return; } // Fase 9
    if (it.k === 'unit') {
      if (it.o.owner === 'p') {
        if (shift && g.sel && g.sel.type === 'units') { const s = new Set(g.sel.ids); s.has(it.o.id) ? s.delete(it.o.id) : s.add(it.o.id); g.sel = { type: 'units', ids: [...s] }; }
        else g.sel = { type: 'units', ids: [it.o.id] };
      } else g.sel = { type: 'unit', id: it.o.id };
    } else if (it.k === 'building') g.sel = { type: 'building', id: it.o.id };
    else if (it.k === 'node') g.sel = { type: 'node', id: it.o.id };
    else if (it.k === 'poi') g.sel = { type: 'poi', id: it.o.id };
    else if (it.k === 'cap') { PK.Campana.openLugar(it.o.n); return; }
    else if (it.k === 'belt') g.sel = { type: 'belt', id: W.belt[W.idx(it.x, it.y)] };
    else if (it.k === 'wall') g.sel = { type: 'wall', id: it.o.k };
    PK.UI.refreshPanel(true);
  }

  function rightClick(sx, sy) {
    const g = G();
    if (PK.Logi.tool || PK.Def.tool || I.flagTool || (PK.Asedios && PK.Asedios.herramienta)) { I.cancelTool(); return; }
    if (PK.Terr.mode) { PK.Terr.toggle(false); return; }
    if (g.placing) { g.placing = null; R().ghost = null; PK.UI.refreshPanel(true); return; }
    const it = R().pick(sx, sy);
    if (!it) return;
    const units = g.selUnits();
    const target = it.k === 'node' ? { kind: 'node', obj: it.o } : it.k === 'poi' ? { kind: 'poi', obj: it.o } : it.k === 'building' ? { kind: 'building', obj: it.o } : it.k === 'tile' ? { kind: 'tile', x: it.x, y: it.y } : null;
    if (units.length) {
      if (it.k === 'unit') { const t = R().screenToTile(sx, sy); g.command(units, { kind: 'tile', x: Math.floor(t[0]), y: Math.floor(t[1]) }); }
      else if (target && g.command(units, target)) PK.UI.flashTarget(sx, sy);
      return;
    }
    if (g.sel && g.sel.type === 'building') {
      const b = g.bById.get(g.sel.id);
      if (b && b.owner === 'p' && b.type === 'tc' && target) {
        if (target.kind === 'poi' || (target.kind === 'tile' && !W.explored(target.x, target.y))) return;
        b.rally = target.kind === 'node' ? { kind: 'node', id: target.obj.id } : target.kind === 'building' ? { kind: 'building', id: target.obj.id } : { kind: 'tile', x: target.x, y: target.y };
        PK.UI.toast('Punto de reunión establecido.', 'info');
        PK.UI.flashTarget(sx, sy);
      }
    }
  }

  function boxSelect(box, shift) {
    const g = G(), x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
    const ids = shift && g.sel && g.sel.type === 'units' ? new Set(g.sel.ids) : new Set();
    for (const u of g.units) {
      if (u.owner !== 'p' || u.inside) continue;
      const [wx, wy] = R().iso(u.x, u.y), [sx, sy] = R().worldToScreen(wx, wy - 8);
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) ids.add(u.id);
    }
    g.sel = ids.size ? { type: 'units', ids: [...ids] } : null;
    PK.UI.refreshPanel(true);
  }
  function selectKindOnScreen(kind) {
    const g = G(), r = R(), ids = [];
    for (const u of g.units) {
      if (u.owner !== 'p' || u.inside || u.kind !== kind) continue;
      const [wx, wy] = r.iso(u.x, u.y), [sx, sy] = r.worldToScreen(wx, wy - 8);
      if (sx >= 0 && sx <= window.innerWidth && sy >= 0 && sy <= window.innerHeight) ids.push(u.id);
    }
    if (!ids.length) return;
    g.sel = { type: 'units', ids };
    PK.UI.refreshPanel(true);
    if (ids.length > 1) PK.UI.toast(ids.length + ' seleccionados.', 'info');
  }

  // Acciones que también tienen tecla; las usan los botones táctiles.
  I.selectNextIdle = function () {
    const g = G();
    const cur = g.sel && g.sel.type === 'units' && g.sel.ids.length === 1 ? g.sel.ids[0] : null;
    const u = g.nextIdle(cur);
    if (u) { g.sel = { type: 'units', ids: [u.id] }; R().centerOn(u.x, u.y); PK.UI.refreshPanel(true); }
    else PK.UI.toast('No hay aldeanos ociosos.', 'info');
  };
  I.demolishTarget = function () {
    const g = G(), b = g.sel && g.sel.type === 'building' ? g.bById.get(g.sel.id) : null;
    return b && b.owner === 'p' && b.type !== 'tc' ? b : null;
  };
  I.demolishSelected = function () {
    const b = I.demolishTarget();
    if (b) PK.UI.confirmDemolish(b); else PK.UI.toast('Toca un edificio tuyo para demolerlo.', 'info');
  };

  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase(), g = G();
    I.keys[k] = true;
    if (k === 'escape') {
      if (PK.UI.closeModal()) return;
      if (PK.Logi.tool || PK.Def.tool || I.flagTool || (PK.Asedios && PK.Asedios.herramienta)) { I.cancelTool(); return; }
      if (PK.Terr.mode) { PK.Terr.toggle(false); return; }
      if (g.placing) { g.placing = null; R().ghost = null; } else g.sel = null;
      PK.UI.refreshPanel(true);
    } else if (k === 'h') {
      const tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
      if (tc) { g.sel = { type: 'building', id: tc.id }; R().centerOn(tc.cx, tc.cy); PK.UI.refreshPanel(true); }
    } else if (k === '.' || k === 'i') {
      I.selectNextIdle();
    } else if (k === 'z') { R().showZones = !R().showZones; }
    else if (k === 't') PK.Terr.toggle();

    else if (k === 'b') PK.Quests.openBook();
    else if (k === 'c') PK.UI.openBuild();
    else if (k === 'v' && g.sel && g.sel.type === 'building') I.startMoving(g.bById.get(g.sel.id)); // mover el edificio elegido
    else if (k === 'm') PK.UI.toast(PK.Sfx.toggle() ? 'Sonido activado.' : 'Sonido silenciado.', 'info');
    else if (k === 'delete' && g.sel && g.sel.type === 'building') { const b = g.bById.get(g.sel.id); if (b) PK.UI.confirmDemolish(b); }
    if (k === ' ') e.preventDefault();
  }

  I.update = function (dt) {
    const r = R(), sp = (900 / r.cam.z) * dt;
    let dx = 0, dy = 0;
    if (I.keys.arrowleft || I.keys.a) dx -= sp;
    if (I.keys.arrowright || I.keys.d) dx += sp;
    if (I.keys.arrowup || I.keys.w) dy -= sp;
    if (I.keys.arrowdown || I.keys.s) dy += sp;
    if (dx || dy) { r.cam.x += dx; r.cam.y += dy; r.clampCam(); }
    // El cartel del puntero solo se calculaba al mover el mouse: después de mover la cámara (WASD, rueda,
    // arrastre, centerOn) o de que subiera de nivel lo de abajo, seguía diciendo «Centro Urbano · Nv 2» con el
    // Centro ya en Nv 10. Se recalcula al mover la cámara y cada 250 ms.
    hovT += dt;
    const cm = r.cam.x + ',' + r.cam.y + ',' + r.cam.z;
    if (I.mouse.on && I.mouse.in && (cm !== hovCam || hovT >= 0.25)) {
      hovT = 0; hovCam = cm;
      const it = r.pick(I.mouse.x, I.mouse.y);
      r.hover = it && it.k !== 'tile' ? it : null;
      PK.UI.hoverInfo(r.hover, I.mouse.x, I.mouse.y);
    }
  };
  let hovT = 0, hovCam = '';
})();
