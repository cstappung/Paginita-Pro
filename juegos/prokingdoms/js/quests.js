// Libro de misiones: ramas con prerrequisitos, misiones diarias y cofre de racha diaria.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const el = U.el;
  const Q = (PK.Quests = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const byId = {};
  for (const q of D.QUESTS) byId[q.id] = q;
  Q.byId = byId;

  Q.init = function (st) {
    st.quests = st.quests || {};
    st.weekly = st.weekly || null;
    st.streak.best = st.streak.best || 0;
    st.streak.shieldWk = st.streak.shieldWk || null; // semana en que se gastó el escudo
    // z_tree existe desde pk-11: quien ya taló en un bosque común no pierde lo hecho
    if (st.stats.z_tree === undefined) {
      const n = PK.World.zones.reduce((s, z) => s + (z.common && z.type === 'tree' ? st.stats['z_' + z.id] || 0 : 0), 0);
      if (n) st.stats.z_tree = n;
    }
    Q.ensureDaily();
  };

  function progress(req) {
    const st = S();
    switch (req.t) {
      case 'villagers': return [G().villagerCount(), req.n];
      case 'build': return [G().countB(req.b), req.n];
      case 'era': return [st.era, req.n];
      case 'stat': return [Math.floor(st.stats[req.k] || 0), req.n];
      case 'level': return [G().levelCount(req.lvl, req.b, req.recipe), req.n];
      case 'explored': return [PK.World.fogCount, req.n];
      case 'flag': return [st.flags[req.k] ? 1 : 0, 1];
      case 'cap': return [st.campana && st.campana.hechos && st.campana.hechos[req.n] ? 1 : 0, 1];
      case 'walled': return [PK.Def.walledCount(), req.n];
      case 'wallTier': return [st.def.tier, req.n];
      case 'all': {
        let done = 0;
        for (const r of req.of) { const [a, b] = progress(r); if (a >= b) done++; }
        return [done, req.of.length];
      }
    }
    return [0, 1];
  }
  Q.progress = progress;
  Q.status = function (q) {
    const s = S().quests[q.id];
    if (s === 'claimed') return 'claimed';
    if (!q.pre.every(p => S().quests[p] === 'claimed')) return 'locked';
    const [a, b] = progress(q.req);
    return a >= b ? 'ready' : 'active';
  };

  let notified = {}, streakNote = null;
  let checked = false; // la primera revisión (al cargar) no celebra lo que ya estaba listo
  Q.check = function () {
    if (streakNote) { PK.UI.toast(streakNote, 'epic'); streakNote = null; }
    almostCheck();
    // Una sola notificación por tanda: al cargar la partida salían cinco avisos de golpe, uno por misión lista.
    const fresh = [];
    for (const q of D.QUESTS) {
      if (S().quests[q.id] === 'claimed') continue;
      if (Q.status(q) === 'ready' && !notified[q.id]) { notified[q.id] = true; fresh.push(q); }
    }
    const open = { label: 'Libro', fn: () => Q.openBook() };
    if (fresh.length === 1 && checked) PK.UI.toast('Misión cumplida: ' + fresh[0].title + '. Reclama tu recompensa en el libro.', 'quest', open);
    else if (fresh.length) PK.UI.toast(checked ? fresh.length + ' misiones cumplidas: reclama sus recompensas en el libro.' : 'Tienes ' + fresh.length + (fresh.length === 1 ? ' misión lista' : ' misiones listas') + ' para reclamar en el libro.', 'quest', open);
    if (fresh.length && checked && PK.Sfx) PK.Sfx.play('quest');
    checked = true;
    Q.ensureDaily();
  };
  const weeklyReady = () => { const w = S().weekly; return w ? w.list.filter(it => !it.claimed && dailyProg(it)[0] >= it.n).length : 0; };
  const dailyBonusReady = () => { const d = S().daily; return !!(d && !d.bonus && d.list.length && d.list.every(it => it.claimed)); };
  Q.readyCount = function () {
    let n = 0;
    for (const q of D.QUESTS) if (Q.status(q) === 'ready') n++;
    const d = S().daily;
    if (d) for (const it of d.list) if (!it.claimed && dailyProg(it)[0] >= it.n) n++;
    if (S().streak.last !== U.dayKey()) n++;
    if (Q.repairable()) n++;
    n += weeklyReady() + (dailyBonusReady() ? 1 : 0);
    return n;
  };
  Q.claim = function (id, silent) {
    const q = byId[id];
    if (Q.status(q) !== 'ready') return null;
    S().quests[id] = 'claimed';
    G().give(q.reward);
    if (q.perk) {
      const p = (S().perks = S().perks || {});
      for (const k in q.perk) p[k] = (p[k] || 0) + q.perk[k];
      PK.UI.toast('Mejora permanente: ' + D.perkText(q.perk) + '.', 'epic');
    }
    if (q.unlock) {
      S().flags['unlock_' + q.unlock] = true;
      PK.UI.toast('Desbloqueaste: ' + D.BUILD[q.unlock].name + '. Ya aparece en el menú de obras.', 'epic');
    }
    G().stat('quests_done', 1);
    if (!silent) PK.UI.toast('Recompensa obtenida: ' + q.title, 'good');
    return q.reward;
  };

  // ---------- Diarias ----------
  function pickTasks(pool, key, count) {
    const st = S(), rng = U.rng(U.strHash(key + ':' + st.created)), list = [];
    pool = pool.filter(t => (!t.era || st.era >= t.era) && (!t.needB || G().countB(t.needB)) && (!t.needFlag || st.flags[t.needFlag]));
    while (list.length < count && pool.length) {
      const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const n = t.flat ? Math.round(t.base * (1 + (st.era - 1) * 0.5)) : Math.round((t.base * Math.pow(1.8, st.era - 1)) / 10) * 10;
      list.push({ id: t.id, k: t.k, n, base: st.stats[t.k] || 0, claimed: false });
    }
    return list;
  }
  // La semana empieza el lunes.
  function weekKey() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return U.dayKey(d); }
  Q.ensureDaily = function () {
    const st = S(), key = U.dayKey(), wk = weekKey();
    if (!st.daily || st.daily.key !== key) st.daily = { key, list: pickTasks(D.DAILY, key, 3), bonus: false };
    if (!st.weekly || st.weekly.key !== wk) st.weekly = { key: wk, list: pickTasks(D.WEEKLY, 'w' + wk, 3) };
    checkStreak();
  };

  // ---------- Tolerancia de la racha ----------
  // Si faltas un día, el escudo semanal se gasta solo y la racha sigue. Sin escudo, ese mismo día (las 24 h
  // siguientes al corte de medianoche) puedes repararla con monedas.
  const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  Q.streakGap = () => { const l = S().streak.last; return l ? Math.round((parseDay(U.dayKey()) - parseDay(l)) / 86400000) : Infinity; };
  Q.shieldReady = () => S().streak.shieldWk !== weekKey();
  Q.repairable = () => S().streak.n >= 2 && Q.streakGap() === 2;
  Q.repairCost = () => D.streakRepairCost(S().streak.n);
  Q.dayLeft = () => { const t = new Date(); t.setHours(24, 0, 0, 0); return Math.max(0, (t - Date.now()) / 1000); };
  function checkStreak() {
    const sk = S().streak;
    if (!Q.repairable() || !Q.shieldReady()) return;
    sk.shieldWk = weekKey(); sk.last = yesterday(); sk.shielded = U.dayKey();
    streakNote = 'Faltaste un día, pero tu escudo de racha la salvó: tus ' + sk.n + ' días siguen en pie.';
  }
  Q.repairStreak = function () {
    if (!Q.repairable()) return;
    const sk = S().streak, n = Q.repairCost();
    if (!PK.Platform.spendCoins(n, 'streak-repair')) { PK.UI.toast('No tienes monedas suficientes.', 'warn'); return; }
    sk.last = yesterday(); sk.repaired = U.dayKey();
    PK.UI.toast('¡Racha reparada! Tus ' + sk.n + ' días siguen contando. Abre el cofre de hoy.', 'epic');
  };

  // ---------- Aviso de "ya casi" (una vez al día, en las últimas horas) ----------
  Q.almost = function () {
    const st = S(), d = st.daily, today = U.dayKey();
    if (Q.repairable()) return 'Tu racha de ' + st.streak.n + ' días se cortó: repárala antes de medianoche.';
    if (st.streak.last !== today && st.streak.n >= 2 && Q.streakGap() === 1) return 'Tu racha de ' + st.streak.n + ' días se corta a medianoche: abre el cofre diario.';
    if (d && !d.bonus && d.list.length) {
      const left = d.list.filter(it => !it.claimed);
      if (!left.length) return 'Completaste las tres diarias: reclama el premio extra antes de medianoche.';
      if (left.length <= 2 && left.every(it => dailyProg(it)[0] >= it.n * 0.5)) return left.length === 1 ? 'Ya casi: te falta 1 diaria para el premio extra del día.' : 'Ya casi: te faltan 2 diarias y vas por más de la mitad.';
    }
    return null;
  };
  Q.almostDue = () => S().ret.almostDay !== U.dayKey();
  Q.almostSent = () => { S().ret.almostDay = U.dayKey(); };
  function almostCheck() {
    if (document.hidden || G().offline || new Date().getHours() < D.ALMOST_HOUR || !Q.almostDue()) return;
    const t = Q.almost();
    if (!t) return;
    Q.almostSent();
    PK.UI.toast(t, 'quest');
  }
  Q.weekLeft = () => { const d = parseDay(weekKey()); d.setDate(d.getDate() + 7); return Math.max(0, (d - Date.now()) / 1000); }; // parseDay: dayKey no rellena con ceros y 'T00:00:00' daba NaN
  function dailyProg(it) { return [Math.floor((S().stats[it.k] || 0) - it.base), it.n]; }
  const dailyReward = () => { const e = S().era; return { food: 150 * e, wood: 150 * e, gold: 50 * e, coins: 3 + e }; };
  Q.claimDaily = function (i, silent) {
    const it = S().daily.list[i];
    if (!it || it.claimed || dailyProg(it)[0] < it.n) return null;
    it.claimed = true;
    const r = dailyReward();
    G().give(r);
    if (!silent) PK.UI.toast('Misión diaria completada.', 'good');
    return r;
  };
  // «Reclamar todo»: misiones del libro, diarias, el premio de las tres diarias y las semanales, con un solo
  // cofre que muestra la suma. Antes había que entrar pestaña por pestaña y nodo por nodo. El cofre de racha
  // queda aparte: tiene su propio ritual diario.
  Q.claimableCount = function () {
    const st = S();
    let n = D.QUESTS.filter(q => Q.status(q) === 'ready').length;
    if (st.daily) n += st.daily.list.filter(it => !it.claimed && dailyProg(it)[0] >= it.n).length;
    return n + weeklyReady() + (dailyBonusReady() ? 1 : 0);
  };
  // quiet: sin el cofre en pantalla (lo usa el Mayordomo del Consejo, también sin conexión).
  Q.claimAll = function (quiet) {
    const st = S(), sum = {};
    let n = 0;
    const add = r => { if (!r) return; n++; for (const k in r) sum[k] = (sum[k] || 0) + r[k]; };
    // en tandas: reclamar una misión puede dejar lista la siguiente de la rama
    for (let pass = 0; pass < 6; pass++) {
      const ready = D.QUESTS.filter(q => Q.status(q) === 'ready');
      if (!ready.length) break;
      for (const q of ready) add(Q.claim(q.id, true));
    }
    if (st.daily) st.daily.list.forEach((it, i) => add(Q.claimDaily(i, true)));
    if (dailyBonusReady()) { st.daily.bonus = true; const r = D.dailyBonus(st.era); G().give(r); add(r); }
    if (st.weekly) st.weekly.list.forEach(it => {
      if (it.claimed || dailyProg(it)[0] < it.n) return;
      it.claimed = true;
      const r = D.weeklyReward(st.era);
      G().give(r); G().stat('weeklies', 1); add(r);
    });
    if (n && !quiet) PK.UI.chestReveal({ title: n === 1 ? 'Recompensa reclamada' : n + ' recompensas reclamadas', sub: 'Todo lo que tenías listo en el libro', reward: sum, tier: n >= 5 ? 2 : 1 });
    return n;
  };
  Q.claimDailyBonus = function () {
    if (!dailyBonusReady()) return;
    S().daily.bonus = true;
    const r = D.dailyBonus(S().era);
    G().give(r);
    PK.UI.chestReveal({ title: '¡Las tres diarias!', sub: 'Premio extra del día', reward: r, tier: 1 });
  };
  Q.claimWeekly = function (i) {
    const it = S().weekly.list[i];
    if (!it || it.claimed || dailyProg(it)[0] < it.n) return;
    it.claimed = true;
    const r = D.weeklyReward(S().era);
    G().give(r);
    G().stat('weeklies', 1);
    PK.UI.chestReveal({ title: '¡Misión semanal completada!', reward: r, tier: 1 });
  };
  Q.chestReward = function () {
    // la racha cuenta sin tope; el cofre base crece hasta el día 7 y los hitos suman premios aparte
    const st = S(), streak = st.streak.last === yesterday() ? st.streak.n + 1 : 1;
    const e = st.era, d7 = Math.min(7, streak), m = 1 + 0.25 * (d7 - 1);
    const reward = { food: Math.round(200 * e * m), wood: Math.round(200 * e * m), stone: Math.round(100 * e * m), gold: Math.round(80 * e * m), coins: 5 + d7 * 2 };
    const ms = D.STREAK_MILESTONES.find(x => x.day === streak) || (streak > 30 && streak % 30 === 0 ? D.STREAK_MILESTONES[D.STREAK_MILESTONES.length - 1] : null);
    if (ms) for (const r in ms.reward) reward[r] = (reward[r] || 0) + ms.reward[r];
    return { streak, reward, milestone: ms };
  };
  function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return U.dayKey(d); }
  Q.claimChest = function () {
    const st = S();
    if (st.streak.last === U.dayKey()) return;
    const c = Q.chestReward();
    Object.assign(st.streak, { last: U.dayKey(), n: c.streak, best: Math.max(st.streak.best || 0, c.streak) });
    G().give(c.reward);
    PK.UI.chestReveal({ title: c.milestone ? c.milestone.name : 'Cofre diario', sub: 'Racha de ' + c.streak + (c.streak === 1 ? ' día' : ' días') + (c.streak < 7 ? ' · crece hasta el día 7' : ''), reward: c.reward, tier: c.milestone ? 2 : c.streak >= 7 ? 1 : 0 });
  };

  // ---------- Interfaz del libro ----------
  let tab = 'main', selected = null;

  function rewardEl(r) {
    return el('div', { class: 'reward' }, Object.keys(r).map(k => el('span', { class: 'amt' }, el('img', { class: 'ico', src: PK.Sprites.icon(k === 'coins' ? 'coin' : k) }), U.fmt(r[k]))));
  }

  function layout(branch) {
    const qs = D.QUESTS.filter(q => q.branch === branch), depth = {};
    const dep = q => {
      if (depth[q.id] !== undefined) return depth[q.id];
      const inb = q.pre.filter(p => byId[p].branch === branch);
      return (depth[q.id] = inb.length ? 1 + Math.max(...inb.map(p => dep(byId[p]))) : 0);
    };
    qs.forEach(dep);
    // sólo se muestran las misiones hasta 2 niveles más allá de la más lejana disponible
    let maxVis = 0;
    for (const q of qs) if (Q.status(q) !== 'locked') maxVis = Math.max(maxVis, depth[q.id]);
    const rows = {};
    for (const q of qs) {
      if (depth[q.id] > maxVis + 2) continue;
      (rows[depth[q.id]] = rows[depth[q.id]] || []).push(q);
    }
    return { rows, depth, maxVis };
  }

  function renderBook(body) {
    const st = S();
    const book = el('div', { class: 'book' });
    const tabs = el('div', { class: 'book-tabs' });
    for (const b of D.BRANCHES.concat([{ id: 'daily', name: 'Diarias', icon: 'chest' }, { id: 'album', name: 'Álbum', icon: 'gems' }])) {
      const ready = b.id === 'album' ? false : b.id === 'daily' ? (st.streak.last !== U.dayKey() || Q.repairable() || st.daily.list.some(it => !it.claimed && dailyProg(it)[0] >= it.n) || weeklyReady() > 0 || dailyBonusReady()) : D.QUESTS.some(q => q.branch === b.id && Q.status(q) === 'ready');
      tabs.append(el('button', { class: 'book-tab' + (tab === b.id ? ' on' : ''), onclick: () => { tab = b.id; selected = null; PK.UI.rerender(true); } },
        el('img', { class: 'ico', src: PK.Sprites.icon(b.icon) }), b.name, ready ? el('span', { class: 'dot' }) : null));
    }
    const left = el('div', { class: 'page left scroll' }), right = el('div', { class: 'page right' });
    const nAll = Q.claimableCount();
    if (nAll > 1) tabs.prepend(PK.UI.btn('Reclamar todo (' + nAll + ')', () => { Q.claimAll(); PK.UI.rerender(); }, { small: true, cls: 'gold book-all' }));
    book.append(tabs, el('div', { class: 'pages' }, left, right));
    body.append(book);

    if (tab === 'daily') { renderDaily(left, right); return; }
    if (tab === 'album') { renderAlbum(left, right); return; }
    const br = D.BRANCHES.find(b => b.id === tab);
    left.append(el('h2', null, br.name), el('p', { class: 'muted small' }, br.desc));
    const { rows } = layout(tab);
    const tree = el('div', { class: 'qtree' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'qlines');
    tree.append(svg);
    const pos = {}, colW = 116, rowH = 64;
    const depths = Object.keys(rows).map(Number).sort((a, b) => a - b);
    let maxCols = 1;
    for (const d of depths) maxCols = Math.max(maxCols, rows[d].length);
    const width = Math.max(1, maxCols) * colW;
    for (const d of depths) {
      const list = rows[d], off = (width - list.length * colW) / 2;
      list.forEach((q, i) => { pos[q.id] = [off + i * colW + colW / 2, d * rowH + 26]; });
    }
    if (!selected || !pos[selected]) {
      const firstReady = D.QUESTS.find(q => q.branch === tab && pos[q.id] && Q.status(q) === 'ready');
      const firstActive = D.QUESTS.find(q => q.branch === tab && pos[q.id] && Q.status(q) === 'active');
      selected = (firstReady || firstActive || D.QUESTS.find(q => q.branch === tab)).id;
    }
    tree.style.width = width + 'px';
    tree.style.height = (depths.length ? depths[depths.length - 1] + 1 : 1) * rowH + 'px';
    svg.setAttribute('width', width); svg.setAttribute('height', tree.style.height);
    for (const id in pos) {
      const q = byId[id];
      for (const p of q.pre) {
        if (!pos[p]) continue;
        const ln = document.createElementNS(svgNS, 'line');
        ln.setAttribute('x1', pos[p][0]); ln.setAttribute('y1', pos[p][1]);
        ln.setAttribute('x2', pos[id][0]); ln.setAttribute('y2', pos[id][1]);
        ln.setAttribute('class', st.quests[p] === 'claimed' ? 'on' : '');
        svg.append(ln);
      }
      const s = Q.status(q);
      tree.append(el('button', {
        class: 'qnode ' + s + (selected === id ? ' sel' : ''), style: { left: pos[id][0] - 54 + 'px', top: pos[id][1] - 20 + 'px' },
        onclick: () => { selected = id; PK.UI.rerender(); },
      }, s === 'locked' ? '???' : q.title));
    }
    left.append(tree);
    // El árbol de Guerra tiene 5 columnas y no cabía en la página izquierda (se cortaba a la derecha): se achica
    // hasta caber, no menos de 0.6; si aun así no cabe, la página se desliza de lado.
    requestAnimationFrame(() => {
      const cs = getComputedStyle(left), room = left.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (room > 0 && width > room) tree.style.zoom = Math.max(0.6, room / width);
    });

    const q = byId[selected], s = Q.status(q);
    right.append(el('div', { class: 'q-head' }, el('h2', null, s === 'locked' ? 'Misión sellada' : q.title), el('span', { class: 'q-state ' + s }, { locked: 'Bloqueada', active: 'En curso', ready: '¡Cumplida!', claimed: 'Reclamada' }[s])));
    if (s === 'locked') {
      right.append(el('p', { class: 'muted' }, 'Completa antes: ' + q.pre.map(p => byId[p].title).join(', ') + '.'));
    } else {
      right.append(el('p', null, q.desc));
      const [a, b] = progress(q.req);
      right.append(el('div', { class: 'bar big' }, el('div', { class: 'fill', style: { width: Math.min(100, (a / b) * 100) + '%' } }), el('span', null, U.fmt(Math.min(a, b)) + ' / ' + U.fmt(b))));
      if (q.req.t === 'all') {
        right.append(el('ul', { class: 'sub' }, q.req.of.map(r => { const [x, y] = progress(r); return el('li', { class: x >= y ? 'ok' : '' }, reqText(r) + ' (' + U.fmt(Math.min(x, y)) + '/' + U.fmt(y) + ')'); })));
      }
    }
    right.append(el('h3', null, 'Recompensa'), rewardEl(q.reward));
    if (q.perk) right.append(el('p', { class: 'small good-t' }, 'Mejora permanente: ' + D.perkText(q.perk) + '.'));
    if (q.unlock) right.append(el('div', { class: 'unlock' }, el('img', { src: PK.Sprites.buildingIcon(q.unlock) }), el('div', null, el('b', null, 'Desbloquea: ' + D.BUILD[q.unlock].name), el('p', { class: 'small' }, D.BUILD[q.unlock].desc))));
    if (q.cap && s !== 'locked' && PK.Campana) right.append(PK.Campana.caja(q.cap));
    if (s === 'ready') right.append(PK.UI.btn('Reclamar recompensa', () => { Q.claim(q.id); PK.UI.rerender(); }, { cls: 'gold' }));
  }

  function reqText(r) {
    if (r.t === 'build') return D.BUILD[r.b].name + (r.n > 1 ? ' x' + r.n : '');
    if (r.t === 'level') return (r.b ? D.BUILD[r.b].name : 'Edificios') + ' en nivel ' + r.lvl + '+';
    if (r.t === 'stat') { const m = { p_blocks: 'Sillares producidos', p_tools: 'Herramientas producidas', p_books: 'Libros producidos', p_steel: 'Acero producido', p_machinery: 'Maquinaria producida', scouts_trained: 'Exploradores entrenados', dungeons_found: 'Mazmorras descubiertas', wishes: 'Deseos pedidos', legends: 'Lugares legendarios investigados', camps_cleared: 'Campamentos destruidos', heroes_hired: 'Héroes reclutados', floor_crater: 'Piso del Cráter Estelar', floor_temple: 'Piso del Templo Hundido', floor_nest: 'Piso del Nido del Dragón', trades_accepted: 'Tratos con otros reinos', guild_helps: 'Ayudas al gremio', walls_built: 'Tramos de muralla' }; return m[r.k] || r.k; }
    if (r.t === 'era') return 'Era ' + U.roman(r.n);
    if (r.t === 'flag' && r.k === 'ley_dragones') return 'Cementerio de Dragones investigado';
    return '';
  }

  function renderDaily(left, right) {
    const st = S();
    left.append(el('h2', null, 'Misiones diarias'), el('p', { class: 'muted small' }, 'Se renuevan cada día. Tus aldeanos trabajan incluso cuando no estás (hasta 12 horas).'));
    st.daily.list.forEach((it, i) => {
      const t = D.DAILY.find(x => x.id === it.id), [a, b] = dailyProg(it), done = a >= b;
      left.append(el('div', { class: 'daily' + (it.claimed ? ' claimed' : '') },
        el('div', null, t.text(it.n)),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: Math.min(100, (a / b) * 100) + '%' } }), el('span', null, U.fmt(Math.min(a, b)) + ' / ' + U.fmt(b))),
        it.claimed ? el('span', { class: 'muted small' }, 'Reclamada') : PK.UI.btn('Reclamar', () => { Q.claimDaily(i); PK.UI.rerender(); }, { small: true, disabled: !done })));
    });
    left.append(el('div', { class: 'row' }, el('b', null, 'Cada diaria: '), rewardEl(dailyReward())));
    const allDone = st.daily.list.every(it => it.claimed);
    left.append(el('div', { class: 'daily bonus' + (st.daily.bonus ? ' claimed' : '') },
      el('div', null, el('b', null, 'Las tres del día'), el('span', { class: 'small muted' }, ' · premio extra')), rewardEl(D.dailyBonus(st.era)),
      st.daily.bonus ? el('span', { class: 'muted small' }, 'Reclamado') : PK.UI.btn('Reclamar', () => { Q.claimDailyBonus(); PK.UI.rerender(); }, { small: true, cls: 'gold', disabled: !allDone })));
    // semanales
    left.append(el('h2', null, 'Misiones semanales'), el('p', { class: 'muted small' }, 'Se renuevan el lunes (faltan ' + U.fmtTime(Q.weekLeft()) + '). Metas grandes, premios grandes.'));
    st.weekly.list.forEach((it, i) => {
      const t = D.WEEKLY.find(x => x.id === it.id), [a, b] = dailyProg(it), done = a >= b;
      left.append(el('div', { class: 'daily weekly' + (it.claimed ? ' claimed' : '') },
        el('div', null, t.text(it.n)),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: Math.min(100, (a / b) * 100) + '%' } }), el('span', null, U.fmt(Math.min(a, b)) + ' / ' + U.fmt(b))),
        it.claimed ? el('span', { class: 'muted small' }, 'Reclamada') : PK.UI.btn('Reclamar', () => { Q.claimWeekly(i); PK.UI.rerender(); }, { small: true, cls: 'gold', disabled: !done })));
    });
    left.append(el('div', { class: 'row' }, el('b', null, 'Cada semanal: '), rewardEl(D.weeklyReward(st.era))));
    // cofre y camino de la racha
    const c = Q.chestReward(), opened = st.streak.last === U.dayKey(), cur = opened ? st.streak.n : c.streak - 1;
    right.append(el('h2', null, 'Cofre diario'),
      el('img', { class: 'chest-img', src: PK.Sprites.icon('chest') }),
      el('p', null, opened ? 'Ya abriste el cofre de hoy (racha de ' + st.streak.n + (st.streak.n === 1 ? ' día' : ' días') + '). Vuelve mañana para mantenerla.' : 'Hoy es tu día ' + c.streak + ' de racha. El cofre crece hasta el día 7 y hay premios especiales en los días 3, 7, 14 y 30.'),
      streakGuard(),
      opened ? null : rewardEl(c.reward),
      opened ? null : PK.UI.btn(c.milestone ? 'Abrir ' + c.milestone.name : Q.repairable() ? 'Abrir y empezar de nuevo' : 'Abrir cofre', () => { Q.claimChest(); PK.UI.rerender(); }, { cls: Q.repairable() ? '' : 'gold' }),
      el('h3', null, 'Camino de la racha'),
      el('div', { class: 'streak-path' }, D.STREAK_MILESTONES.map(m => el('div', { class: 'ms' + (cur >= m.day ? ' got' : '') + (!opened && c.streak === m.day ? ' next' : '') },
        el('b', null, 'Día ' + m.day), el('span', { class: 'small' }, m.name), rewardEl(m.reward)))),
      el('p', { class: 'small muted' }, 'Mejor racha: ' + Math.max(st.streak.best || 0, st.streak.n || 0) + ' días.'));
  }

  function streakGuard() {
    const sk = S().streak, box = el('div', { class: 'streak-guard' });
    if (Q.repairable()) {
      const n = Q.repairCost();
      box.classList.add('broken');
      box.append(el('div', null, el('b', null, 'Tu racha de ' + sk.n + ' días se cortó ayer'),
        el('p', { class: 'small' }, 'No te quedaba escudo esta semana. Repárala antes de medianoche (quedan ' + U.fmtTime(Q.dayLeft()) + ') y el cofre de hoy contará como día ' + (sk.n + 1) + '.'),
        PK.UI.btn(el('span', null, 'Reparar racha ', PK.UI.amount('coins', n)), () => { Q.repairStreak(); PK.UI.rerender(); }, { small: true, cls: 'gold', disabled: PK.Platform.getCoins() < n })));
      return box;
    }
    const ready = Q.shieldReady();
    box.classList.add(ready ? 'ready' : 'used');
    box.append(el('img', { class: 'ico', src: PK.Sprites.icon('wall') }),
      el('div', null, el('b', null, 'Escudo de racha: ' + (ready ? 'listo' : 'usado esta semana')),
        el('p', { class: 'small' }, sk.shielded === U.dayKey() ? 'Hoy te salvó: faltaste un día y tu racha siguió en pie.'
          : ready ? 'Si faltas un día, se gasta solo y tu racha no se pierde. Hay uno nuevo cada lunes.'
            : 'Llega uno nuevo el lunes (faltan ' + U.fmtTime(Q.weekLeft()) + '). Si faltas un día antes, podrás reparar la racha con monedas.')));
    return box;
  }

  // ---------- Álbum de colección ----------
  const POI_ICON = { chest: 'chest', ruin: 'scroll', camp: 'war', relic: 'gold', watch: 'compass', cave: 'crystal', lair: 'hide', crypt: 'lore', crater: 'starIron', nest: 'scale', swamp: 'herbs', giants: 'titanBone', temple: 'pearls', legend: 'crown' };
  // known: el nombre se ve aunque la casilla siga vacía
  function slot(icon, name, got, sub, known) {
    return el('div', { class: 'al-slot' + (got ? ' got' : ''), title: got || known ? name : '???' },
      got ? el('img', { class: 'ico', src: PK.Sprites.icon(icon) }) : el('span', { class: 'al-q' }, '?'),
      el('span', { class: 'small' }, got || known ? name : '???'), sub ? el('span', { class: 'small muted' }, sub) : null);
  }
  function renderAlbum(left, right) {
    const st = S(), W = PK.World;
    const seen = {}, total = {};
    for (const p of W.pois) { total[p.kind] = (total[p.kind] || 0) + 1; const ps = st.pois[p.id]; if (ps && ps.f) seen[p.kind] = (seen[p.kind] || 0) + 1; }
    const tre = D.SPECIAL.filter(r => st.flags['seenRes_' + r] || st.res[r] > 0).length;
    left.append(el('h2', null, 'Álbum del reino'), el('p', { class: 'muted small' }, 'Todo lo que tu reino ha encontrado. Las casillas vacías esperan a que salgas a buscarlas.'),
      el('h3', null, 'Tesoros (' + tre + '/' + D.SPECIAL.length + ')'),
      el('div', { class: 'al-grid' }, D.SPECIAL.map(r => slot(r, D.RES[r].name, st.flags['seenRes_' + r] || st.res[r] > 0))));
    const xp = (st.exp && st.exp.xp) || {}, top = Math.max(-1, ...Object.keys(D.ARMY).filter(k => xp[k] > 0).map(k => D.rankOf(xp[k])));
    left.append(el('h3', null, 'Rangos de veteranía (' + (top + 1) + '/' + D.RANKS.length + ')'),
      el('div', { class: 'al-grid' }, D.RANKS.map((n, i) => slot('war', U.roman(i + 1) + ' · ' + n, i <= top))));
    const relics = W.pois.filter(p => p.kind === 'relic');
    right.append(el('h3', null, 'Reliquias (' + (seen.relic || 0) + '/' + relics.length + ')'),
      el('div', { class: 'al-grid' }, relics.map((p, i) => { const ps = st.pois[p.id]; return slot('gold', 'Reliquia ' + U.roman(i + 1), ps && ps.f, ps && ps.d ? 'en el Monasterio' : null); })));
    right.append(el('h3', null, 'Puntos de interés vistos'),
      el('div', { class: 'al-grid' }, Object.keys(D.POI).filter(k => total[k]).map(k => slot(POI_ICON[k] || 'compass', D.POI[k].name, seen[k], (seen[k] || 0) + ' de ' + total[k], true))));
    // trofeos de los jefes de mazmorra (Mazmorras 2.0, incursion.js)
    if (PK.Inc) {
      const tr = st.trofeos || {}, kinds = Object.keys(PK.Inc.JEFES);
      right.append(el('h3', null, 'Trofeos (' + kinds.filter(k => tr[k]).length + '/' + kinds.length + ')'),
        el('div', { class: 'al-grid' }, kinds.map(k => slot(POI_ICON[k] || 'scale', PK.Inc.JEFES[k].name, tr[k], tr[k] ? 'x' + tr[k] : null, true))));
    }
    // maravillas del mundo (lugares legendarios, H6)
    if (D.LEYENDAS) {
      const ly = st.leyendas || {};
      right.append(el('h3', null, 'Maravillas del mundo (' + Object.keys(ly).length + '/' + D.LEYENDAS.length + ')'),
        el('div', { class: 'al-grid' }, D.LEYENDAS.map((o, i) => { const s0 = slot('crown', o.name, ly[i], ly[i] ? o.bono : null, true); if (ly[i] && PK.Leyendas) { s0.style.cursor = 'pointer'; s0.onclick = () => PK.Leyendas.pagina(i); } return s0; })));
    }
    // cartas de era (Fase 3): las que elegiste, más los decretos reales
    if (D.CARTAS && st.cartas) {
      const tom = new Set(st.cartas.tomadas.map(c => c.id)), ids = Object.keys(D.CARTAS);
      left.append(el('h3', null, 'Cartas de era (' + tom.size + '/' + ids.length + ')'),
        el('div', { class: 'al-grid' }, ids.map(id => slot('scroll', D.CARTAS[id].name, tom.has(id), tom.has(id) ? D.CARTAS[id].desc : null)).concat(Object.keys(D.DECREES).map(id => slot('crown', D.DECREES[id].name, st.decrees.includes(id), 'carta real', true)))));
    }
    const realms = D.BOTS.filter(b => st.flags['seen_' + b.slot]).length;
    right.append(el('h3', null, 'Reinos encontrados (' + realms + '/' + D.BOTS.length + ')'),
      el('div', { class: 'al-grid' }, D.BOTS.map(b => slot('pop', b.realm, st.flags['seen_' + b.slot]))));
  }

  Q.openBook = function (t) {
    if (t) tab = t;
    PK.UI.modal('book', 'Libro de Misiones', renderBook, { cls: 'book-modal', wide: true });
  };
})();
