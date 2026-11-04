// Mundo vivo (Fase 5, S2 a S5, pk-24): caravanas, jefe semanal del gremio, visitas a otros reinos y rankings con
// títulos. Todo lo decide server/sim.js; aquí se dibuja (carretas en el mapa, la vista de un reino visitado), se
// arman las piezas de las ventanas y se aplica lo que llega por el buzón. Sin servidor no hay nada de esto.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, Sp = PK.Sprites;
  const Mn = (PK.Mundo = { caravanas: [], titulo: null, off: 0, rkCat: 'era', rk: {} });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const UI = () => PK.UI;
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);
  const ahora = () => Date.now() + Mn.off;
  const online = () => !!(PK.Net && PK.Net.online);

  Mn.desdeSync = function (r) {
    Mn.off = (r.now || Date.now()) - Date.now();
    Mn.caravanas = r.caravanas || [];
    Mn.titulo = r.titulo || null;
  };
  // lo que el ranking lee de la foto (el servidor lo acota: no sube más rápido de lo posible)
  Mn.rkFoto = function () {
    const g = G(), st = S();
    let wonder = 0, floor = 0;
    for (const b of g.buildings) if (b.owner === 'p' && b.done && (b.type === 'wonder' || (D.MARAVILLAS || []).includes(b.type))) wonder = Math.max(wonder, b.lvl);
    for (const k in st.stats) if (k.startsWith('floor_')) floor = Math.max(floor, st.stats[k] || 0);
    return { wonder, floor, def: Math.floor(st.stats.defenses_won || 0) };
  };

  // ---------- Buzón ----------
  Mn.recibir = function (it) {
    const g = G();
    if (it.res) g.give(it.res);
    if (it.type === 'caravana') { g.stat('caravanas', 1); toast(it.text, it.asalto ? 'warn' : 'good'); g.logNews(it.text, it.asalto ? 'bad' : 'good'); return; }
    if (it.type === 'jefe_gremio') {
      if (it.coins) PK.Platform.addCoins(it.coins, 'guild-boss');
      g.stat('jefe_gremio', 1);
      toast(it.text + ' Premio: ' + Object.keys(it.res || {}).map(k => '+' + U.fmt(it.res[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', ') + (it.coins ? ', +' + it.coins + ' monedas' : '') + '.', 'epic');
      return;
    }
    if (it.type === 'titulo') { toast(it.text, 'epic'); g.logNews(it.text, 'good'); if (PK.Sfx) PK.Sfx.play('level'); return; }
    toast(it.text, 'info');
  };

  // ---------- S2. Caravanas ----------
  Mn.mandar = async function (slot, escolta) {
    try {
      const r = await PK.Net.api('POST', '/api/caravana', { slot, escolta: !!escolta });
      Mn.caravanas = r.caravanas || [];
      if (r.paga) G().pay(r.paga);
      toast('Salió tu caravana hacia ' + (PK.Diplo ? PK.Diplo.nombre(slot) : 'otro reino') + '.', 'good');
    } catch (e) { toast((e && e.message) || 'No se pudo hablar con el servidor.', 'warn'); }
    if (UI().modalKey() === 'realms') UI().rerender();
  };
  Mn.caravanaEl = function (slot) {
    const st = S(), dist = D.distReinos(D.MY_SLOT, slot), faro = G().countB && G().countB('faro');
    const oro = D.caravanaOro(st.era, dist), r0 = D.caravanaRiesgo(dist, false, faro), r1 = D.caravanaRiesgo(dist, true, faro), esc = D.caravanaEscolta(st.era);
    const enCamino = Mn.caravanas.length >= D.CARAVANA.max, ida = D.caravanaIda(dist);
    return el('div', { class: 'dp-acc' },
      UI().btn('Caravana · ' + U.fmt(oro) + ' oro', () => Mn.mandar(slot, false), { small: true, cls: 'gold', disabled: enCamino || st.era < D.CARAVANA.era, title: 'Ida y vuelta ' + U.fmtTime(2 * ida) + ' · riesgo de asalto ' + Math.round(r0 * 100) + '%' }),
      UI().btn(el('span', null, 'Con escolta (', UI().costEl(esc), ')'), () => Mn.mandar(slot, true), { small: true, disabled: enCamino || !G().canAfford(esc), title: 'Riesgo ' + Math.round(r1 * 100) + '%' }),
      el('span', { class: 'small muted' }, 'riesgo ' + Math.round(r0 * 100) + '% · ' + Math.round(r1 * 100) + '% con escolta'));
  };
  Mn.caravanasEl = function () {
    if (!Mn.caravanas.length) return '';
    return el('p', { class: 'small' }, 'Caravanas: ' + Mn.caravanas.map(c => {
      const t = ahora(), vuelta = t >= c.llega;
      return (PK.Diplo ? PK.Diplo.nombre(c.slot) : '?') + (vuelta ? ' (vuelve en ' + U.fmtTime((c.vuelve - t) / 1000) + ')' : ' (llega en ' + U.fmtTime((c.llega - t) / 1000) + ')') + (c.escolta ? ' con escolta' : '');
    }).join(' · ') + '.');
  };
  const tc = () => G().buildings.find(b => b.owner === 'p' && b.type === 'tc' && b.done);
  // posición de una caravana: del Centro Urbano al hogar del otro reino y de vuelta
  function donde(c, b) {
    const t = ahora(), [hx, hy] = D.REALM_SLOTS[c.slot].home, ida = t < c.llega;
    const f = ida ? U.clamp((t - c.sale) / Math.max(1, c.llega - c.sale), 0, 1) : 1 - U.clamp((t - c.llega) / Math.max(1, c.vuelve - c.llega), 0, 1);
    return { x: b.cx + (hx - b.cx) * f, y: b.cy + (hy - b.cy) * f, ida, dx: hx - b.cx, dy: hy - b.cy };
  }
  Mn.dibujar = function (ctx, R) {
    const b = tc();
    if (!b || !Mn.caravanas.length || (PK.Game.enMar && PK.Game.enMar())) return; // las caravanas son de la tierra
    const fr = Math.floor(performance.now() / 120) % 4;
    for (const c of Mn.caravanas) {
      const p = donde(c, b), sx = p.ida ? p.dx : -p.dx, sy = p.ida ? p.dy : -p.dy, flip = sx - sy < 0;
      if (!PK.World.explored(Math.floor(p.x), Math.floor(p.y))) continue;
      const spr = Sp.cart(D.PLAYER_COLOR, p.ida ? 'food' : 'gold', flip, fr, true), [px, py] = R.iso(p.x, p.y);
      ctx.drawImage(spr.c, Math.round(px - spr.ax), Math.round(py - spr.ay));
      if (c.escolta) {
        const L = Math.hypot(sx, sy) || 1;
        for (let i = 0; i < 2; i++) {
          const k = (i ? 0.9 : -0.9), ex = p.x - (sx / L) * 0.8 + (sy / L) * k * 0.5, ey = p.y - (sy / L) * 0.8 - (sx / L) * k * 0.5, [qx, qy] = R.iso(ex, ey);
          const t = Sp.troop('spear', D.PLAYER_COLOR, 'walk', (fr + i * 2) % 6, flip, sx + sy < 0, null, i);
          ctx.drawImage(t.c, Math.round(qx - t.ax), Math.round(qy - t.ay), t.k ? t.w : t.c.width, t.k ? t.h : t.c.height);
        }
      }
    }
  };
  Mn.minimapa = function (ctx, toMM) {
    const b = tc();
    if (!b || (PK.Game.enMar && PK.Game.enMar())) return;
    for (const c of Mn.caravanas) { const p = donde(c, b), [x, y] = toMM(p.x, p.y); ctx.fillStyle = '#f0c850'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
  };

  // ---------- S3. Jefe semanal del gremio ----------
  Mn.atacarJefe = async function () {
    const st = S(), army = {}, power = PK.Social.power(st.war.army);
    for (const k in st.war.army) if (st.war.army[k] > 0) army[k] = st.war.army[k];
    if (!Object.keys(army).length) { toast('No tienes soldados en casa.', 'warn'); return; }
    try {
      const r = await PK.Net.api('POST', '/api/guilds/boss', { units: army, power });
      for (const k in army) st.war.army[k] = Math.max(0, st.war.army[k] - Math.round(army[k] * (r.bajas || 0)));
      PK.Net.cache.guilds = r.guilds;
      G().stat('jefe_golpes', 1);
      toast('Tu ejército le hizo ' + U.fmt(r.dano) + ' de daño al jefe del gremio (perdiste un ' + Math.round((r.bajas || 0) * 100) + '% de las tropas).', 'good');
      if (PK.Sfx) PK.Sfx.play('cuerno');
    } catch (e) { toast((e && e.message) || 'No se pudo hablar con el servidor.', 'warn'); }
    if (UI().modalKey() === 'guild') UI().rerender();
  };
  Mn.jefeEl = function (j) {
    if (!j) return '';
    const pct = Math.max(0, j.hp / Math.max(1, j.max)), quedan = j.fin - ahora(), st = S(), fuerza = PK.Social.power(st.war.army);
    return el('div', { class: 'jefe-g' },
      el('h3', null, 'Jefe de la semana: ' + j.name),
      el('p', { class: 'small muted' }, j.desc + ' Se va en ' + U.fmtTime(Math.max(0, quedan / 1000)) + '.'),
      el('div', { class: 'bar jefe-bar' }, el('div', { class: 'fill' + (pct > 0 ? ' red' : ''), style: { width: pct * 100 + '%' } }), el('span', null, j.hp > 0 ? U.fmt(j.hp) + ' / ' + U.fmt(j.max) : '¡Derrotado!')),
      el('div', { class: 'jefe-tramos' }, D.JEFE_GREMIO.tramos.map((t, i) => el('span', { class: 'dp-chip' + (j.tramo > i ? ' alianza' : '') }, Math.round(t * 100) + '%'))),
      el('p', { class: 'small' }, 'Tu daño esta semana: ' + U.fmt(j.mio) + '. Cada tramo de daño total da un premio a todos los que pegaron, y el que más pegó se lleva un extra al final.'),
      j.top.length ? el('ol', { class: 'rank' }, j.top.map(m => el('li', { class: m.me ? 'me' : '' }, el('span', { translate: 'no' }, m.name), el('span', null, U.fmt(m.n))))) : '',
      el('div', { class: 'row' }, UI().btn('Atacar con el ejército en casa (' + j.hoy + '/' + D.JEFE_GREMIO.ataquesDia + ' hoy)', () => Mn.atacarJefe(), { small: true, cls: 'gold', disabled: j.hp <= 0 || j.hoy >= D.JEFE_GREMIO.ataquesDia || fuerza <= 0, title: 'Fuerza ' + U.fmt(fuerza) + ' · vuelven todos menos un ' + Math.round(D.JEFE_GREMIO.bajas * 100) + '%' })));
  };

  // ---------- S4. Visitas ----------
  let visto = null;
  async function pedirVisita(ruta, id) {
    try {
      const r = await PK.Net.api('POST', ruta, { id });
      visto = r;
      if (r.paga) G().pay(r.paga);
      return r;
    } catch (e) { toast((e && e.message) || 'No se pudo hablar con el servidor.', 'warn'); return null; }
  }
  // el reino visitado, dibujado con los mismos sprites del mapa sobre un pasto liso
  function vista(r) {
    const bl = r.buildings || [];
    const c = el('canvas', { class: 'visita-c' });
    if (!bl.length) return el('p', { class: 'muted' }, 'Todavía no tiene edificios a la vista.');
    const owner = r.slot === D.MY_SLOT ? 'p' : 'b' + r.slot, iso = (x, y) => [(x - y) * 16, (x + y) * 8];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of bl) { const d = D.BUILD[b[0]]; if (!d) continue; x0 = Math.min(x0, b[1]); y0 = Math.min(y0, b[2]); x1 = Math.max(x1, b[1] + d.w); y1 = Math.max(y1, b[2] + d.h); }
    x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
    const pts = [iso(x0, y0), iso(x1, y0), iso(x0, y1), iso(x1, y1)], minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1])) - 90, maxY = Math.max(...pts.map(p => p[1]));
    c.width = Math.min(2400, Math.ceil(maxX - minX)); c.height = Math.min(1600, Math.ceil(maxY - minY));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5f8a3a';
    ctx.beginPath(); const P = [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)];
    P.forEach(([x, y], i) => (i ? ctx.lineTo(x - minX, y - minY) : ctx.moveTo(x - minX, y - minY))); ctx.closePath(); ctx.fill();
    const orden = bl.filter(b => D.BUILD[b[0]] && b[3]).sort((a, b) => a[1] + a[2] - (b[1] + b[2]));
    for (const b of orden) {
      try {
        const spr = Sp.building(b[0], owner, b[4] || 1), [px, py] = iso(b[1], b[2]);
        ctx.drawImage(spr.c, Math.round(px - minX - spr.ox), Math.round(py - minY - spr.oy));
      } catch (e) { /* un tipo sin dibujo no frena la visita */ }
    }
    return c;
  }
  Mn.visitar = async function (id) {
    if (!online()) return;
    const r = await pedirVisita('/api/visita', id);
    if (!r) return;
    G().stat('visitas', 1);
    UI().modal('visita', 'De visita', body => {
      const v = visto || r;
      body.append(el('h3', null, el('span', { translate: 'no' }, 'Reino de ' + v.name), v.titulo ? ' · «' + v.titulo + '»' : ''),
        el('p', { class: 'small' }, (v.world ? v.world + ' · ' : '') + 'Era ' + U.roman(v.era) + ' · población ' + v.pop + ' · ' + v.visitas + ' visitas · ' + v.likes + ' «me gusta»'),
        el('div', { class: 'visita-box' }, vista(v)),
        el('div', { class: 'row' },
          UI().btn(v.yaLike ? '♥ Te gusta' : '♥ Me gusta', async () => { await pedirVisita('/api/visita/like', v.id); UI().rerender(); }, { small: true, cls: 'gold', disabled: v.yaLike }),
          UI().btn(el('span', null, 'Dejar un regalo (', UI().costEl(D.visitaRegalo(S().era)), ')'), async () => { const x = await pedirVisita('/api/visita/regalo', v.id); if (x) toast('Le dejaste un regalo a ' + v.name + '.', 'good'); UI().rerender(); }, { small: true, disabled: v.yaRegalo || !G().canAfford(D.visitaRegalo(S().era)) })),
        el('p', { class: 'small muted' }, 'Es una vista de solo lectura, de la última foto que mandó su reino.'));
    }, { wide: true });
  };

  // ---------- S5. Rankings ----------
  Mn.refrescar = function (cat) {
    Mn.rkCat = cat || Mn.rkCat;
    return PK.Net.api('POST', '/api/ranking', { cat: Mn.rkCat }).then(r => { Mn.rk[Mn.rkCat] = r; if (UI().modalKey() === 'realms') UI().rerender(); }).catch(() => {});
  };
  Mn.rankingEl = function () {
    const cat = Mn.rkCat, lista = Mn.rk[cat];
    const tabs = el('div', { class: 'row rk-tabs' }, Object.keys(D.RANKINGS).map(k => UI().btn(D.RANKINGS[k].name, () => Mn.refrescar(k), { small: true, cls: k === cat ? 'gold' : '' })));
    const fmt = r => (cat === 'era' ? 'Era ' + U.roman(r.era) + ' · ' + U.fmt(r.total) : cat === 'maravilla' ? 'nivel ' + r.v : cat === 'piso' ? 'piso ' + r.v : U.fmt(r.v));
    return el('div', null, el('h3', null, 'Ranking del servidor'), Mn.titulo ? el('p', { class: 'small good-t' }, 'Tu título esta semana: «' + Mn.titulo + '».') : '',
      el('p', { class: 'small muted' }, 'Cada lunes, el primero de cada categoría se lleva un título por una semana: ' + Object.values(D.RANKINGS).map(o => o.titulo).join(', ') + '.'),
      tabs,
      !lista ? el('p', { class: 'muted' }, 'Cargando…') : !lista.length ? el('p', { class: 'muted' }, 'Nadie todavía.') : el('ol', { class: 'rank' }, lista.map(r => el('li', { class: r.me ? 'me' : '' },
        el('span', { translate: 'no' }, r.name + (r.online ? ' ●' : '') + ' · ' + r.world), r.titulo ? el('span', { class: 'dp-chip comercio' }, r.titulo) : '',
        el('span', null, fmt(r), r.me ? '' : UI().btn('Visitar', () => Mn.visitar(r.id), { small: true }))))));
  };
})();
