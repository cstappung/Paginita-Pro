// Interacción entre jugadores: mercado con precios vivos, tablón de ofertas, gremio con obras colectivas, eventos, ayudas y tablón "Necesito…"
// y tropas. En el prototipo los otros reinos están simulados; la interfaz Platform es el punto de
// conexión con tu página (monedas, cuenta y, más adelante, el servidor/Firebase).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const el = U.el;
  const Soc = (PK.Social = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);

  // ---------- Puente con la página de minijuegos ----------
  // Tu página puede definir window.ProKingdomsPlatform antes de cargar el juego para reemplazar esto.
  const localPlatform = {
    name: 'local',
    getPlayer() { return { id: 'local', name: U.store.get('pk_player_name') || 'Tú' }; },
    getCoins() { return +(U.store.get('pk_site_coins') || 0); },
    addCoins(n, reason) {
      const v = this.getCoins() + n;
      U.store.set('pk_site_coins', String(v));
      window.dispatchEvent(new CustomEvent('pk:coins', { detail: { coins: v, delta: n, reason } }));
      return v;
    },
    reportStat(key, value) { void key; void value; },
  };
  PK.Platform = Object.assign({}, localPlatform, window.ProKingdomsPlatform || {});
  // Gastar monedas (acelerar obras). Tu página puede definir spendCoins(n, motivo) y devolver true/false.
  if (!PK.Platform.spendCoins) PK.Platform.spendCoins = function (n, reason) {
    if (this.getCoins() < n) return false;
    this.addCoins(-n, reason);
    return true;
  };

  // ---------- Estado ----------
  const TRADEABLE = ['food', 'wood', 'stone', 'ore', 'marble', 'gems', 'planks', 'blocks', 'ingots', 'tools', 'books', 'steel', 'machinery'];

  Soc.init = function (st) {
    for (const k in D.MARKET_BASE) if (st.market && !st.market.p[k]) st.market.p[k] = D.MARKET_BASE[k];
    if (!st.market) st.market = { p: Object.assign({}, D.MARKET_BASE), t: 0, offers: [], mine: [], offerT: 5, oid: 1, mineT: 0 };
    if (st.market) st.market.offers = st.market.offers.filter(validOffer); // partidas con ofertas «por 0» guardadas
    if (!st.guild) st.guild = { joined: false, stage: 0, prog: {}, my: 0, members: D.GUILD_MEMBERS.map(n => ({ name: n, c: 0 })), chat: [], t: 0, chatT: 30 };
    st.guild.helps = st.guild.helps || [];
    st.guild.needs = st.guild.needs || [];   // tablón "Necesito…" (sin servidor)
    st.guild.medals = st.guild.medals || {}; // medallas de los eventos: nombre (o "me") -> cuántas
    if (!st.war) st.war = { army: {}, q: [], qt: 0, exps: [], log: [] };
    for (const k in D.ARMY) st.war.army[k] = st.war.army[k] || 0;
    // ya no hay saqueos: las tropas que estaban en una incursión de una partida vieja vuelven a casa
    for (const e of st.war.exps.filter(o => o.camp === undefined)) {
      for (const k in e.units) st.war.army[k] = (st.war.army[k] || 0) + e.units[k];
      st.war.exps.splice(st.war.exps.indexOf(e), 1);
    }
    delete st.war.inc; delete st.war.nextInc; delete st.war.cool;
  };

  const online = () => PK.Net && PK.Net.online;
  Soc.update = function (dt, offline) {
    if (!online()) { marketTick(dt); guildTick(dt, offline); } // en línea, mercado y gremio viven en el servidor
    if (!offline) Soc.worldChatTick(dt);
    warTick(dt, offline);
  };

  // ---------- Mercado ----------
  // El oro es la moneda: 100 oro valen 100 (no está en MARKET_BASE, que también usa el gremio). Sin esto,
  // las ofertas con oro daban NaN: «200 oro por 0 madera», y aceptarla dejaba el recurso en NaN.
  const price = r => (r === 'gold' ? 100 : S().market.p[r] || D.MARKET_BASE[r] || 100);
  const value = (res, n) => price(res) * n / 100;
  const validOffer = o => o && D.RES[o.give] && D.RES[o.want] && o.give !== o.want && o.gn > 0 && o.wn > 0;

  function marketTick(dt) {
    const m = S().market;
    m.t += dt;
    while (m.t >= 30) {
      m.t -= 30;
      for (const r of TRADEABLE) {
        const b = D.MARKET_BASE[r];
        m.p[r] += (b - m.p[r]) * 0.04 + m.p[r] * (Math.random() - 0.5) * 0.03;
        m.p[r] = U.clamp(m.p[r], b * 0.25, b * 4);
      }
    }
    for (const o of m.offers) o.ttl -= dt;
    m.offers = m.offers.filter(o => o.ttl > 0);
    m.offerT -= dt;
    while (m.offerT <= 0) { m.offerT += 90 + Math.random() * 120; if (m.offers.length < 6) m.offers.push(botOffer()); }
    m.mineT += dt;
    while (m.mineT >= 20) {
      m.mineT -= 20;
      for (const o of m.mine.slice()) {
        const fair = value(o.want, o.wn) / Math.max(1, value(o.give, o.gn));
        const p = U.clamp(0.35 - (fair - 1) * 1.1, 0.01, 0.6);
        if (Math.random() < p) {
          m.mine.splice(m.mine.indexOf(o), 1);
          S().res[o.want] = (S().res[o.want] || 0) + o.wn;
          G().stat('offers_filled', 1);
          G().stat('gold_volume', Math.round(value(o.give, o.gn)));
          toast(o.by + ' aceptó tu oferta: recibiste ' + U.fmt(o.wn) + ' de ' + D.RES[o.want].name.toLowerCase() + '.', 'good');
        }
      }
    }
  }

  function tradePool() {
    const era = S().era, pool = ['food', 'wood', 'stone', 'gold'];
    if (era >= 2) pool.push('ore', 'planks');
    if (era >= 3) pool.push('blocks', 'ingots', 'books', 'marble');
    if (era >= 4) pool.push('tools', 'gems');
    if (era >= 5) pool.push('steel');
    if (era >= 6) pool.push('machinery');
    return pool;
  }
  Soc.tradePool = tradePool;
  // Mejores precios con un Mercado de más nivel.
  const mkRate0 = k => G().buildings.filter(b => b.owner === 'p' && b.done && b.type === 'market').reduce((m, b) => (k === 'buy' ? Math.min(m, G().bst(b).buy) : Math.max(m, G().bst(b).sell)), k === 'buy' ? 1.1 : 0.65);
  // árbol y cartas (Moneda acuñada, Puertas abiertas): nunca se vende más caro de lo que se compra
  const mkRate = k => { const v = !G().bono ? 0 : k === 'buy' ? G().bono('buy') : G().bono('sell'); return k === 'buy' ? Math.max(0.8, mkRate0('buy') - v) : Math.min(0.97, mkRate0('sell') + v); };
  // S1 (pk-23): un tratado de comercio abarata la compra, sin bajar nunca de la venta + 10% (no hay compra-venta gratis)
  const buyRate = () => { const b = mkRate('buy'); return PK.Diplo && PK.Diplo.tratado() ? Math.min(b, Math.max(mkRate('sell') + 0.1, b * D.DIPLO.tratado.buy)) : b; };
  Soc.buyPrice = (r, n) => Math.ceil((S().market.p[r] * buyRate() * n) / 100);
  Soc.sellPrice = (r, n) => Math.floor((S().market.p[r] * mkRate('sell') * n) / 100);
  function botOffer() {
    const m = S().market, pool = tradePool(), bot = U.pick(D.BOTS);
    const give = U.pick(pool);
    let want = U.pick(pool);
    while (want === give) want = U.pick(pool);
    const scale = 200 * Math.pow(1.6, S().era - 1);
    const gn = Math.max(10, Math.round((scale * 100) / price(give) / 10) * 10);
    const fair = U.rand(0.8, 1.2);
    const wn = Math.max(10, Math.round((value(give, gn) * fair * 100) / price(want) / 10) * 10);
    return { id: m.oid++, by: bot.name, bot: bot.id, give, gn, want, wn, ttl: 900 + Math.random() * 1500 };
  }

  Soc.buy = function (res, n) {
    const m = S().market;
    const cost = Soc.buyPrice(res, n);
    if (S().res.gold < cost) { toast('Oro insuficiente.', 'warn'); return; }
    // Lo que se compra, se vende o se cambia siempre entra entero, aunque pase el tope: el tope solo frena
    // lo que juntan los aldeanos (antes «Comprar» se negaba mientras premios y tratos sí lo pasaban).
    S().res.gold -= cost; S().res[res] += n;
    m.p[res] *= Math.pow(1.03, n / 100);
    G().stat('market_ops', 1); G().stat('gold_volume', cost); G().stat('compras', 1);
    if (online()) PK.Net.marketOp({ res, n, side: 'buy' });
  };
  Soc.sell = function (res, n) {
    const m = S().market;
    if (S().res[res] < n) { toast('No tienes suficiente.', 'warn'); return; }
    const gain = Soc.sellPrice(res, n);
    S().res[res] -= n; S().res.gold += gain; // con el oro lleno, addRes se comía la venta
    m.p[res] *= Math.pow(0.97, n / 100);
    G().stat('market_ops', 1); G().stat('gold_volume', gain);
    if (online()) PK.Net.marketOp({ res, n, side: 'sell' });
  };
  Soc.accept = function (id) {
    const m = S().market, o = m.offers.find(x => x.id === id);
    if (!o) return;
    if (!validOffer(o)) { m.offers.splice(m.offers.indexOf(o), 1); toast('Esa oferta ya no es válida.', 'warn'); return; }
    if ((S().res[o.want] || 0) < o.wn) { toast('No tienes lo que pide.', 'warn'); return; }
    S().res[o.want] -= o.wn; S().res[o.give] += o.gn;
    m.offers.splice(m.offers.indexOf(o), 1);
    G().stat('trades_accepted', 1); G().stat('gold_volume', Math.round(value(o.give, o.gn)));
    toast('Trato cerrado con ' + o.by + '.', 'good');
  };
  Soc.post = function (give, gn, want, wn) {
    const m = S().market;
    if (give === want || gn <= 0 || wn <= 0) { toast('Oferta no válida.', 'warn'); return false; }
    if (m.mine.length >= 3) { toast('Máximo 3 ofertas publicadas.', 'warn'); return false; }
    if ((S().res[give] || 0) < gn) { toast('No tienes suficiente para ofrecer.', 'warn'); return false; }
    S().res[give] -= gn;
    m.mine.push({ id: m.oid++, give, gn, want, wn, by: U.pick(D.BOTS).name });
    toast('Oferta publicada en el tablón.', 'good');
    return true;
  };
  Soc.cancel = function (id) {
    const m = S().market, o = m.mine.find(x => x.id === id);
    if (!o) return;
    S().res[o.give] += o.gn;
    m.mine.splice(m.mine.indexOf(o), 1);
  };

  // ---------- Gremio ----------
  function guildTick(dt, offline) {
    const g = S().guild;
    if (!g.joined) return;
    g.t += dt;
    while (g.t >= 60) {
      g.t -= 60;
      const st = D.guildStage(g.stage), hours = 20 * Math.pow(1.15, g.stage);
      for (const r in st.cost) {
        const left = st.cost[r] - (g.prog[r] || 0);
        if (left <= 0) continue;
        const add = Math.min(left, Math.ceil((st.cost[r] / (hours * 60)) * U.rand(0.5, 1.5)));
        g.prog[r] = (g.prog[r] || 0) + add;
        U.pick(g.members).c += add;
      }
      checkStage();
      localEventTick(g);
    }
    if (offline) return;
    g.chatT -= dt;
    if (g.chatT <= 0) {
      g.chatT = 80 + Math.random() * 160;
      g.chat.push({ who: U.pick(g.members).name, text: U.pick(D.GUILD_CHAT) });
      if (g.chat.length > 40) g.chat.shift();
    }
  }
  function checkStage() {
    const g = S().guild, st = D.guildStage(g.stage);
    for (const r in st.cost) if ((g.prog[r] || 0) < st.cost[r]) return;
    const coins = 25 * (g.stage + 1);
    toast('¡El gremio completó "' + st.name + '"! +3% de recolección para todos y +' + coins + ' monedas.', 'epic');
    g.chat.push({ who: 'Gremio', text: '¡' + st.name + ' terminada! Gracias a todos.' });
    PK.Platform.addCoins(coins, 'guild-stage');
    g.stage++; g.prog = {};
    G().stat('guild_stages', 1);
  }
  // ---- Evento del gremio y ayudas (sin servidor: los miembros simulados aportan y ayudan) ----
  function localEventTick(g) {
    const t = Date.now(), n = g.members.length + 1;
    if (!g.ev) { g.evn = (g.evn || 0) + 1; g.ev = D.newGuildEvent(g.stage, n, g.evn); }
    const ev = g.ev;
    if (t >= ev.ends) {
      if (!ev.done) resolveLocalEvent(g);
      g.ev = null; g.evn++; g.ev = D.newGuildEvent(g.stage, n, g.evn);
      g.chat.push({ who: 'Gremio', text: 'Nuevo evento: "' + g.ev.name + '". Meta: ' + U.fmt(g.ev.goal) + ' de ' + D.RES[g.ev.res].name.toLowerCase() + ' en 48 horas.' });
      return;
    }
    if (!ev.done) { // entre todos los simulados llegan a ~60% de la meta: el resto depende de ti
      const add = Math.ceil(((ev.goal * 0.6) / (D.GUILD_EVENT_HOURS * 60)) * U.rand(0.5, 1.5)), who = U.pick(g.members).name;
      ev.prog = Math.min(ev.goal, ev.prog + add); ev.contrib[who] = (ev.contrib[who] || 0) + add;
      if (ev.prog >= ev.goal) resolveLocalEvent(g);
    }
    g.helps = g.helps.filter(h => t - h.at < D.GUILD_HELP.ttl * 1000 && h.by.length < D.GUILD_HELP.max && (!h.me || (G().bById.get(h.bid) || {}).upg));
    // al primer pedido siempre lo ayuda alguien a los pocos minutos (h.sure); después, cuando se pueda
    for (const h of g.helps) if (h.me && (Math.random() < 0.35 || (h.sure && t >= h.sure && !h.by.length))) {
      const free = g.members.filter(m => !h.by.includes(m.name));
      if (!free.length) continue;
      const m = U.pick(free); h.by.push(m.name);
      Soc.applyHelp(h.bid, m.name);
    }
    if (g.helps.filter(h => !h.me).length < 2 && Math.random() < 0.08) g.helps.push({ id: 'h' + t, name: U.pick(g.members).name, what: U.pick(D.GUILD_HELP_WANTS), by: [], at: t });
    localNeedTick(g, t);
  }
  function resolveLocalEvent(g) {
    const ev = g.ev, ratio = ev.prog / ev.goal, topKey = D.eventTopKey(ev.contrib);
    ev.done = true;
    const rw = D.guildEventReward((ev.contrib.me || 0) / Math.max(1, ev.prog), ratio, g.stage, topKey === 'me');
    g.chat.push({ who: 'Gremio', text: ratio >= 1 ? '¡Meta cumplida en "' + ev.name + '"!' : '"' + ev.name + '" terminó al ' + Math.round(ratio * 100) + '%.' });
    if (topKey) {
      const name = topKey === 'me' ? PK.Platform.getPlayer().name : topKey;
      if (ratio >= 0.5) g.medals[topKey] = (g.medals[topKey] || 0) + 1;
      g.chat.push({ who: 'Gremio', text: (ratio >= 0.5 ? '★ Medalla de "' + ev.name + '" para ' : 'Quien más aportó a "' + ev.name + '" fue ') + name + ' (' + U.fmt(ev.contrib[topKey]) + ' de ' + D.RES[ev.res].name.toLowerCase() + '). ¡Gracias!' });
    }
    if (!rw) return;
    PK.Platform.addCoins(rw.coins, 'guild-event');
    if (rw.gems) G().give({ gems: rw.gems });
    G().stat('guild_events', 1);
    toast((ratio >= 1 ? '¡El gremio cumplió "' : 'El gremio llegó a la mitad de "') + ev.name + '"! Tu premio: ' + rw.coins + ' monedas' + (rw.gems ? ' y ' + rw.gems + ' gemas' : '') + (rw.top ? ', con el extra por ser quien más aportó.' : '.'), 'epic');
  }
  // ---- Tablón "Necesito…" sin servidor: los miembros simulados mandan lo que pides y piden cosas ----
  const needLeft = h => Math.max(0, h.n - h.got);
  function localNeedTick(g, t) {
    g.needs = g.needs.filter(h => t - h.at < D.GUILD_NEED.ttl * 1000 && h.got < h.n);
    for (const h of g.needs) {
      if (Math.random() > (h.me ? 0.3 : 0.08)) continue;
      const m = U.pick(g.members.filter(o => o.name !== h.name)), n = Math.min(needLeft(h), Math.max(10, Math.ceil((h.n * U.rand(0.25, 0.5)) / 10) * 10));
      h.got += n;
      if (!h.me) continue;
      G().give({ [h.res]: n });
      G().logNews(m.name + ' te mandó ' + U.fmt(n) + ' de ' + D.RES[h.res].name.toLowerCase() + ' del tablón del gremio.', 'good');
      if (!G().offline) toast(m.name + ' te mandó ' + U.fmt(n) + ' de ' + D.RES[h.res].name.toLowerCase() + (h.got >= h.n ? '. ¡Tu pedido está completo!' : '.'), 'good');
      if (h.got >= h.n) g.chat.push({ who: m.name, text: '¡Listo, ya tienes tu ' + D.RES[h.res].name.toLowerCase() + '!' });
    }
    g.needs = g.needs.filter(h => h.got < h.n);
    if (g.needs.filter(h => !h.me).length < 2 && Math.random() < 0.06) {
      const res = U.pick(tradePool()), m = U.pick(g.members);
      if (!g.needs.some(h => h.name === m.name)) g.needs.push({ id: 'n' + t, name: m.name, res, n: D.needAmount(res, S().era), got: 0, at: t });
    }
  }
  Soc.askNeed = function (res) {
    if (!D.NEED_RES.includes(res)) return;
    if (online()) { PK.Net.askNeed(res); return; }
    const g = S().guild;
    if (g.needs.some(h => h.me)) { toast('Ya tienes un pedido en el tablón. Retíralo para pedir otra cosa.', 'warn'); return; }
    const n = D.needAmount(res, S().era);
    g.needs.push({ id: 'n' + Date.now(), me: true, name: PK.Platform.getPlayer().name, res, n, got: 0, at: Date.now() });
    g.chat.push({ who: PK.Platform.getPlayer().name, text: 'Necesito ' + U.fmt(n) + ' de ' + D.RES[res].name.toLowerCase() + '. ¿Alguien me manda?', me: true });
    toast('Tu pedido quedó en el tablón del gremio.', 'good');
  };
  Soc.cancelNeed = function () {
    if (online()) { PK.Net.cancelNeed(); return; }
    const g = S().guild;
    g.needs = g.needs.filter(h => !h.me);
  };
  Soc.sendNeed = function (id, n) {
    if (online()) { PK.Net.sendNeed(id, n); return; }
    const g = S().guild, h = g.needs.find(o => o.id === id);
    if (!h || h.me) return;
    n = Math.min(Math.floor(n), needLeft(h), Math.floor(S().res[h.res] || 0));
    if (n <= 0) { toast('No tienes de eso en tu bodega.', 'warn'); return; }
    const pay = D.needRewardable(n, h);
    S().res[h.res] -= n; h.got += n;
    G().stat('guild_gifts', 1);
    if (h.got >= h.n) { g.needs.splice(g.needs.indexOf(h), 1); g.chat.push({ who: h.name, text: '¡Gracias! Con eso me alcanza.' }); }
    toast('Le mandaste ' + U.fmt(n) + ' de ' + D.RES[h.res].name.toLowerCase() + ' a ' + h.name + '.' + Soc.needPay(pay ? Soc.needCoins(g) : 0, pay), 'good');
  };
  // Monedas por mandar (hasta el tope diario). El día se cuenta aparte del de las ayudas.
  Soc.needCoins = function (g) {
    const day = U.dayKey();
    if (!g.needDay || g.needDay.d !== day) g.needDay = { d: day, n: 0 };
    return g.needDay.n++ < D.GUILD_NEED.daily ? D.GUILD_NEED.coins : 0;
  };
  Soc.needPay = function (coins, eligible) {
    if (coins) { PK.Platform.addCoins(coins, 'guild-need'); return ' +' + coins + ' monedas.'; }
    return eligible ? ' Ya llegaste al tope de premios del tablón por hoy.' : ' Manda al menos un cuarto del pedido para ganar monedas.';
  };
  // Una ayuda recortó tiempo de una mejora tuya.
  Soc.applyHelp = function (bid, from) {
    const b = G().bById.get(bid);
    G().logHelp(from, b ? b.def.name : null);
    if (!b || !b.upg) return;
    const cut = D.helpCut(b.upg.total);
    b.upg.t = Math.min(b.upg.total, b.upg.t + cut);
    toast(from + ' te ayudó: ' + b.def.name + ' termina ' + U.fmtTime(cut) + ' antes.', 'good');
  };
  // Vista común del evento y las ayudas (con o sin servidor).
  Soc.guildEvent = function () {
    if (online()) { const m = PK.Net.cache.guilds && PK.Net.cache.guilds.mine; return m ? { ev: m.ev, helps: m.helps, needs: m.needs || [] } : null; }
    const g = S().guild;
    if (!g.joined) return null;
    if (!g.ev) localEventTick(g);
    // todos los que aportaron, de mayor a menor (solo quien aportó: no hay lista de "los que no ayudan")
    const top = Object.keys(g.ev.contrib).filter(k => g.ev.contrib[k] > 0)
      .map(k => ({ name: k === 'me' ? PK.Platform.getPlayer().name : k, c: g.ev.contrib[k], me: k === 'me', medals: g.medals[k] || 0 })).sort((a, b) => b.c - a.c);
    return {
      ev: Object.assign({}, g.ev, { my: g.ev.contrib.me || 0, top }),
      helps: g.helps.filter(h => h.by.length < D.GUILD_HELP.max).map(h => ({ id: h.id, name: h.me ? PK.Platform.getPlayer().name : h.name, what: h.what, n: h.by.length, mine: !!h.me, helped: h.by.includes('me') })),
      needs: g.needs.map(h => ({ id: h.id, name: h.name, res: h.res, n: h.n, got: h.got, mine: !!h.me, ttl: Math.max(0, (h.at + D.GUILD_NEED.ttl * 1000 - Date.now()) / 1000) })),
    };
  };
  Soc.eventContribute = function (n) {
    if (online()) { PK.Net.eventContribute(n); return; }
    const ev = S().guild.ev;
    if (!ev || ev.done) return;
    n = Math.min(Math.floor(n), ev.goal - ev.prog, Math.floor(S().res[ev.res] || 0));
    if (n <= 0) { toast('Nada que aportar de ese recurso.', 'warn'); return; }
    S().res[ev.res] -= n; ev.prog += n; ev.contrib.me = (ev.contrib.me || 0) + n;
    G().stat('guild_event', n);
    if (ev.prog >= ev.goal) resolveLocalEvent(S().guild);
  };
  const helpTarget = () => G().buildings.filter(b => b.owner === 'p' && b.upg).sort((a, b) => (b.upg.total - b.upg.t) - (a.upg.total - a.upg.t))[0];
  Soc.askHelp = function () {
    const b = helpTarget();
    if (!b) { toast('No tienes ninguna mejora en curso.', 'warn'); return; }
    const what = b.def.name + ' nivel ' + (b.lvl + 1);
    if (online()) { PK.Net.askHelp(b.id, what); return; }
    const g = S().guild;
    if (g.helps.some(h => h.me)) { toast('Ya pediste ayuda; espera a que te ayuden.', 'warn'); return; }
    const sure = g.firstHelp ? 0 : Date.now() + U.rand(D.GUILD_HELP.firstHelp[0], D.GUILD_HELP.firstHelp[1]) * 1000;
    g.firstHelp = true;
    g.helps.push({ id: 'h' + Date.now(), me: true, bid: b.id, what, by: [], at: Date.now(), sure });
    g.chat.push({ who: PK.Platform.getPlayer().name, text: '¿Alguien me ayuda con ' + what + '?', me: true });
    toast('Pediste ayuda al gremio.', 'good');
  };
  Soc.giveHelp = function (id) {
    if (online()) { PK.Net.giveHelp(id); return; }
    const g = S().guild, h = g.helps.find(o => o.id === id);
    if (!h || h.me || h.by.includes('me')) return;
    h.by.push('me');
    const day = U.dayKey();
    if (!g.helpDay || g.helpDay.d !== day) g.helpDay = { d: day, n: 0 };
    const coin = g.helpDay.n++ < D.GUILD_HELP.daily ? D.GUILD_HELP.coins : 0;
    G().stat('guild_helps', 1);
    toast('¡Ayudaste a ' + h.name + '!' + Soc.helpPay(coin), 'good');
  };
  // Premio por ayudar (mientras no pases el tope diario): monedas y un poco de oro y comida de tu era.
  Soc.helpPay = function (coins) {
    if (!coins) return ' Ya llegaste al tope de premios de hoy.';
    const r = D.helpReward(S().era);
    PK.Platform.addCoins(coins, 'guild-help');
    G().give(r);
    return ' +' + coins + ' monedas, +' + U.fmt(r.gold) + ' oro y +' + U.fmt(r.food) + ' comida.';
  };
  function guildExtras(body) {
    const v = Soc.guildEvent();
    if (!v || !v.ev) return;
    const ev = v.ev, st = S(), left = Math.max(0, (ev.ends - Date.now()) / 1000), none = (st.res[ev.res] || 0) < 1;
    const box = el('div', { class: 'guild-event' + (ev.done ? ' done' : '') },
      el('h3', null, 'Evento: ' + ev.name),
      el('p', { class: 'small' }, ev.done ? (ev.prog >= ev.goal ? '¡Meta cumplida! El próximo evento empieza en ' + U.fmtTime(left) + '.' : 'Terminado. El próximo empieza en ' + U.fmtTime(left) + '.')
        : 'Entre todos: ' + U.fmt(ev.goal) + ' de ' + D.RES[ev.res].name.toLowerCase() + '. Quedan ' + U.fmtTime(left) + '. Si se cumple, cada uno gana monedas y gemas según su parte; con la mitad hay premio consuelo.'),
      el('div', { class: 'g-row' }, UI().resIcon(ev.res),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: Math.min(100, (ev.prog / ev.goal) * 100) + '%' } }), el('span', null, U.fmt(ev.prog) + ' / ' + U.fmt(ev.goal))),
        ev.done ? null : UI().btn('+100', () => { Soc.eventContribute(100); UI().rerender(); }, { small: true, disabled: none }),
        ev.done ? null : UI().btn('+1K', () => { Soc.eventContribute(1000); UI().rerender(); }, { small: true, disabled: none }),
        ev.done ? null : UI().btn('Todo', () => { Soc.eventContribute(st.res[ev.res]); UI().rerender(); }, { small: true, disabled: none })),
      el('p', { class: 'small muted' }, 'Tu aporte: ' + U.fmt(ev.my) + '. Quien más aporte gana un premio extra y una medalla.'),
      contribList(ev));
    const mine = v.helps.find(h => h.mine);
    const helps = el('div', { class: 'guild-helps' }, el('h3', null, 'Ayudas'),
      el('p', { class: 'small muted' }, 'Cada ayuda descuenta un 3% (mínimo 1 minuto) de una mejora; hasta 5 por pedido. Ayudar da ' + D.GUILD_HELP.coins + ' monedas y algo de oro y comida (hasta ' + D.GUILD_HELP.daily + ' veces al día).'),
      mine ? el('p', { class: 'small good-t' }, 'Tu pedido: ' + mine.what + ' · ' + mine.n + '/' + D.GUILD_HELP.max + ' ayudas.') : UI().btn('Pedir ayuda con mi mejora', () => { Soc.askHelp(); UI().rerender(); }, { small: true, disabled: !helpTarget() }),
      v.helps.filter(h => !h.mine).map(h => el('div', { class: 'offer' }, el('b', null, h.name), el('span', { class: 'small' }, ' · ' + h.what + ' (' + h.n + '/' + D.GUILD_HELP.max + ')'),
        UI().btn(h.helped ? 'Ayudado' : 'Ayudar', () => { Soc.giveHelp(h.id); UI().rerender(); }, { small: true, cls: 'gold', disabled: h.helped }))));
    body.append(el('div', { class: 'two-col' }, box, helps), needBoard(v.needs || []));
  }
  // Aportes al evento por miembro (solo los que aportaron), con su parte y sus medallas.
  function contribList(ev) {
    const list = ev.top || [];
    if (!list.length) return el('p', { class: 'small muted' }, 'Todavía nadie aportó. ¡Sé el primero!');
    const total = Math.max(1, ev.prog);
    return el('ol', { class: 'rank' }, list.map((t, i) => el('li', { class: t.me ? 'me' : '' },
      el('span', null, (i === 0 ? '★ ' : '') + t.name + (t.me && t.name !== 'Tú' ? ' (tú)' : '') + (t.medals ? ' · ' + t.medals + (t.medals === 1 ? ' medalla' : ' medallas') : '')),
      el('span', null, U.fmt(t.c) + ' · ' + Math.round((t.c / total) * 100) + '%'))));
  }
  // Tablón "Necesito…": un pedido por miembro; los demás mandan desde su bodega.
  function needBoard(needs) {
    const st = S(), mine = needs.find(h => h.mine), name = r => D.RES[r].name.toLowerCase();
    const box = el('div', { class: 'guild-helps' }, el('h3', null, 'Necesito…'),
      el('p', { class: 'small muted' }, 'Pide un recurso (uno a la vez) y tus compañeros te lo mandan desde su bodega. Mandar al menos un cuarto de un pedido da ' + D.GUILD_NEED.coins + ' monedas (hasta ' + D.GUILD_NEED.daily + ' veces al día). El pedido dura ' + U.fmtTime(D.GUILD_NEED.ttl) + '.'));
    if (mine) {
      box.append(el('div', { class: 'offer mine' }, 'Tu pedido: ', UI().amount(mine.res, mine.n), el('span', { class: 'small' }, ' · llegó ' + U.fmt(mine.got) + ' · quedan ' + U.fmtTime(mine.ttl)),
        UI().btn('Retirar', () => { Soc.cancelNeed(); UI().rerender(); }, { small: true })));
    } else {
      const sel = el('select', { id: 'need-res' }, D.NEED_RES.filter(r => r !== 'gems' || st.era >= 2).map(r => el('option', { value: r }, D.RES[r].name + ' (' + U.fmt(D.needAmount(r, st.era)) + ')')));
      sel.addEventListener('keydown', e => e.stopPropagation());
      box.append(el('div', { class: 'row' }, sel, UI().btn('Pedir', () => { Soc.askNeed(sel.value); UI().rerender(); }, { small: true, cls: 'gold' })));
    }
    const others = needs.filter(h => !h.mine);
    if (!others.length) box.append(el('p', { class: 'small muted' }, 'Nadie pide nada por ahora.'));
    for (const h of others) {
      const left = Math.max(0, h.n - h.got), have = Math.floor(st.res[h.res] || 0), quarter = Math.min(left, Math.ceil((h.n * D.GUILD_NEED.min) / 10) * 10);
      box.append(el('div', { class: 'offer' }, el('b', null, h.name), el('span', { class: 'small' }, ' necesita '), UI().amount(h.res, h.n), el('span', { class: 'small muted' }, ' · faltan ' + U.fmt(left) + ' de ' + name(h.res)),
        UI().btn('Mandar ' + U.fmt(quarter), () => { Soc.sendNeed(h.id, quarter); UI().rerender(); }, { small: true, disabled: have < quarter }),
        UI().btn('Lo que falta', () => { Soc.sendNeed(h.id, left); UI().rerender(); }, { small: true, cls: 'gold', disabled: have < 1 })));
    }
    return box;
  }
  // Nota para la etapa que pide un recurso de zona.
  const zoneNote = r => el('p', { class: 'small warn-t' }, D.RES[r].name + ': ' + D.zoneResWhere(r) + ' Si no te llega, pídelo en el tablón "Necesito…".');

  // ---- Plaza del mundo ----
  let localChat = [], chatT = 40;
  Soc.worldChat = () => (online() ? PK.Net.wchat : localChat);
  Soc.sayWorld = function (text) {
    text = String(text || '').trim().slice(0, 100);
    if (!text) return;
    if (online()) { PK.Net.worldChat(text); return; }
    localChat.push({ who: PK.Platform.getPlayer().name, slot: D.MY_SLOT, text, at: Date.now(), me: true });
    // algún vecino simulado contesta
    setTimeout(() => { const b = U.pick(D.BOTS); localChat.push({ who: b.name, slot: b.slot, text: U.pick(['¡Hola!', 'Cuenta conmigo.', 'Mira el tablón, publiqué algo.', 'Jaja, de acuerdo.', 'Hoy no, estoy con los lobos.']), at: Date.now() }); if (PK.UI.modalKey() === 'realms') PK.UI.rerender(); }, 3000 + Math.random() * 5000);
  };
  Soc.worldChatTick = function (dt) {
    if (online() || G().offline) return;
    chatT -= dt;
    if (chatT > 0) return;
    chatT = 120 + Math.random() * 240;
    const b = U.pick(D.BOTS);
    localChat.push({ who: b.name, slot: b.slot, text: U.pick(D.WORLD_CHAT), at: Date.now() });
    if (localChat.length > 40) localChat.shift();
  };

  Soc.joinGuild = function () {
    if (!G().countB('guild')) { toast('Necesitas un Salón del Gremio.', 'warn'); return; }
    S().guild.joined = true; S().flags.guildJoined = true;
    S().guild.chat.push({ who: 'Leonor', text: '¡Bienvenido al ' + D.GUILD_NAME + '!' });
    toast('Te uniste al ' + D.GUILD_NAME + '.', 'good');
  };
  Soc.contribute = function (res, n) {
    const g = S().guild, st = D.guildStage(g.stage);
    if (!st.cost[res]) return;
    n = Math.min(n, st.cost[res] - (g.prog[res] || 0), Math.floor(S().res[res] || 0));
    if (n <= 0) { toast('Nada que aportar de ese recurso.', 'warn'); return; }
    S().res[res] -= n; g.prog[res] = (g.prog[res] || 0) + n; g.my += n;
    G().stat('contrib', n);
    checkStage();
  };
  Soc.say = function (text) {
    const g = S().guild;
    g.chat.push({ who: PK.Platform.getPlayer().name, text: text.slice(0, 140), me: true });
    if (g.chat.length > 40) g.chat.shift();
    setTimeout(() => {
      g.chat.push({ who: U.pick(g.members).name, text: U.pick(['¡Bien dicho!', 'Jaja, totalmente.', 'Cuenta conmigo.', 'Hoy aporto más piedra.', '¿Alguien vio a Brunilda?']) });
      PK.UI.rerender();
    }, 2500 + Math.random() * 4000);
  };

  // ---------- Guerra ----------
  Soc.armyPop = function () {
    const w = S().war;
    let n = w.q.length;
    for (const k in w.army) n += w.army[k];
    for (const e of w.exps) for (const k in e.units) n += e.units[k];
    if (S().exp) for (const r of S().exp.runs) for (const k in r.units) n += r.units[k];
    return n;
  };
  Soc.power = function (units) {
    let p = 0;
    for (const k in units) p += units[k] * D.ARMY[k].power * (PK.Exp && S().exp ? PK.Exp.unitMult(k) : 1);
    return p * (1 + 0.15 * G().lvl('tactics')) * G().eraMult() * (PK.Exp && S().exp ? PK.Exp.armyMult() : 1);
  };
  // Defensa: cada Torre y el Centro Urbano aportan según su nivel; las tropas en casa suman su fuerza.
  Soc.defense = function () {
    let d = 0;
    for (const b of G().buildings) if (b.owner === 'p' && b.done && (b.type === 'tower' || b.type === 'tc' || b.type === 'bateria')) d += G().bst(b).defense || 0;
    return Math.round(d * (1 + 0.2 * G().lvl('walls')) + Soc.power(S().war.army));
  };
  Soc.barracksLvl = () => G().buildings.reduce((m, b) => (b.owner === 'p' && b.done && b.type === 'barracks' ? Math.max(m, b.lvl) : m), 0);
  Soc.truce = () => !G().countB('barracks') && S().era < 3;

  Soc.Q_MAX = 20;
  // Velocidad de la cola: cada Cuartel entrena a la vez (1 + su bono por nivel).
  Soc.trainSpeed = () => G().buildings.reduce((s, b) => s + (b.owner === 'p' && b.done && b.type === 'barracks' ? 1 + G().bst(b).armyTrain : 0), 0) * (PK.Heroes && S().heroes ? 1 + PK.Heroes.pasiva('armyTrain') : 1);
  // Por qué no se puede entrenar esa tropa ahora (o null).
  Soc.trainWhy = function (type) {
    const def = D.ARMY[type], w = S().war;
    if (S().era < def.era) return 'Requiere la Era ' + U.roman(def.era) + '.';
    if (!G().countB('barracks')) return 'Necesitas ' + (D.temaActivo === 'mar' ? 'una ' : 'un ') + D.BUILD.barracks.name + '.';
    if (Soc.barracksLvl() < def.lvl) return def.name + ' requiere ' + (D.temaActivo === 'mar' ? 'una ' : 'un ') + D.BUILD.barracks.name + ' de nivel ' + def.lvl + '.';
    if (def.req && !G().countB(def.req)) return def.name + ': necesitas la ' + D.BUILD[def.req].name + '.'; // la armada (pk-29)
    if (G().pop() >= G().popCap()) return 'Población máxima: construye o mejora casas.';
    if (w.q.length >= Soc.Q_MAX) return 'La cola del Cuartel está llena.';
    if (!G().canAfford(def.cost)) return 'Recursos insuficientes.';
    return null;
  };
  Soc.trainArmy = function (type, n) {
    const def = D.ARMY[type], w = S().war;
    let done = 0;
    for (let i = 0; i < n; i++) {
      const why = Soc.trainWhy(type);
      if (why) { toast(why, 'warn'); break; }
      G().pay(def.cost);
      w.q.push(type);
      done++;
    }
    if (done && PK.Sfx) PK.Sfx.play('build');
    return done;
  };
  // Saca de la cola la última tropa pedida y devuelve lo que costó.
  Soc.cancelArmy = function () {
    const w = S().war;
    if (!w.q.length) return;
    const k = w.q.pop();
    G().give(D.ARMY[k].cost);
    if (!w.q.length) w.qt = 0;
  };
  // Campamentos de bandidos descubiertos explorando: ahora van por el mismo planificador que las mazmorras
  // (expeditions.js, objetivo { camp }), con fuerza, probabilidad, bajas e informe. Esto queda por compatibilidad.
  Soc.attackCamp = function (poiId, units) {
    return PK.Exp.send({ camp: poiId }, Object.assign({}, units));
  };

  Soc.log = log;
  function log(text, kind) {
    const w = S().war;
    w.log.unshift({ text, kind, at: Date.now() });
    if (w.log.length > 30) w.log.pop();
  }

  function warTick(dt, offline) {
    const w = S().war, g = G();
    if (w.q.length && g.countB('barracks')) {
      w.qt += dt * Soc.trainSpeed();
      let guard = 0, got = null;
      while (w.q.length && w.qt >= D.ARMY[w.q[0]].time && guard++ < 1000) {
        w.qt -= D.ARMY[w.q[0]].time;
        got = w.q.shift();
        w.army[got]++;
        g.stat('trained_army', 1);
      }
      if (got && !offline && !w.q.length) toast(D.temaActivo === 'mar' ? 'La Dársena de guerra terminó: ' + D.ARMY[got].name.toLowerCase() + ' y los demás esperan en el puerto.' : 'El Cuartel terminó de entrenar: ' + D.ARMY[got].name.toLowerCase() + ' y los demás ya forman frente al Cuartel.', 'good');
      if (!w.q.length) w.qt = 0;
    }
    for (const e of w.exps.slice()) {
      e.t += dt;
      if (e.camp !== undefined) campTick(e, offline);
    }
  }

  function campTick(e, offline) {
    const w = S().war, p = PK.World.pois[e.camp], tier = G().poiTier(p);
    if (e.phase === 'go' && e.t >= e.travel) {
      const atk = Soc.power(e.units) * U.rand(0.85, 1.15), def = D.campPower(tier) * U.rand(0.85, 1.15);
      e.won = atk > def;
      const loss = e.won ? 0.05 + 0.2 * Math.random() * (def / atk) : 0.5 + 0.3 * Math.random();
      for (const k in e.units) e.units[k] = Math.floor(e.units[k] * (1 - loss));
      if (e.won) {
        const st = G().poiState(p);
        st.d = 1;
        PK.World.poiFree(p);
        e.loot = D.campLoot(tier);
        G().stat('camps_cleared', 1);
      }
      e.phase = 'back'; e.t = 0;
      log(e.won ? 'Destruiste un campamento de bandidos. Las tropas vuelven con el botín.' : 'Los bandidos rechazaron a tus tropas.', e.won ? 'good' : 'bad');
      if (!offline) toast(e.won ? '¡Campamento de bandidos destruido!' : 'Tus tropas no pudieron con los bandidos.', e.won ? 'good' : 'bad');
    } else if (e.phase === 'back' && e.t >= e.travel) {
      for (const k in e.units) w.army[k] += e.units[k];
      if (e.won) { G().give(e.loot); log('Botín de bandidos: ' + Object.keys(e.loot).map(r => U.fmt(e.loot[r]) + ' ' + (r === 'coins' ? 'monedas' : D.RES[r].name.toLowerCase())).join(', ') + '.', 'good'); }
      w.exps.splice(w.exps.indexOf(e), 1);
    }
  }

  // ---------- Paneles ----------
  const UI = () => PK.UI;

  Soc.openMarket = function () {
    UI().modal('market', 'Mercado', body => {
      const st = S(), m = st.market;
      if (!G().countB('market')) { body.append(el('p', { class: 'muted' }, 'Construye un Mercado (Era II) para comerciar con otros reinos.')); return; }
      const grid = el('div', { class: 'mk-grid' });
      for (const r of TRADEABLE) {
        if (!tradePool().includes(r)) continue;
        const base = D.MARKET_BASE[r], p = m.p[r], trend = p > base * 1.05 ? 'up' : p < base * 0.95 ? 'down' : '';
        grid.append(el('div', { class: 'mk-row' },
          UI().resIcon(r), el('span', { class: 'mk-name' }, D.RES[r].name),
          el('span', { class: 'mk-price ' + trend }, 'Compra ' + Soc.buyPrice(r, 100) + ' · Venta ' + Soc.sellPrice(r, 100)),
          UI().btn('Comprar 100', () => { Soc.buy(r, 100); UI().rerender(); }, { small: true, disabled: st.res.gold < Soc.buyPrice(r, 100) }),
          UI().btn('Vender 100', () => { Soc.sell(r, 100); UI().rerender(); }, { small: true, disabled: st.res[r] < 100 })));
      }
      body.append(el('h3', null, 'Precios (oro por 100)'), el('p', { class: 'muted small' }, 'Los precios suben cuando todos compran y bajan cuando todos venden. Lo que compras o vendes entra entero aunque pase el tope de tus bodegas. Mejora el Mercado para pagar menos y cobrar más (ahora compras al ' + Math.round(mkRate('buy') * 100) + '% y vendes al ' + Math.round(mkRate('sell') * 100) + '%).'), grid);

      const net = online(), cache = net ? PK.Net.cache.offers : null;
      body.append(el('h3', null, net ? 'Tablón de ofertas (jugadores y mercaderes)' : 'Tablón de ofertas de otros reinos'));
      const list = el('div', { class: 'offers' });
      const offers = (net ? (cache ? cache.offers : []) : m.offers).slice().sort((a, b) => (b.human ? 1 : 0) - (a.human ? 1 : 0)); // las de jugadores reales, primero
      if (net && !cache) list.append(el('p', { class: 'muted' }, 'Cargando ofertas…'));
      else if (!offers.length) list.append(el('p', { class: 'muted' }, 'No hay ofertas ahora. Vuelve en unos minutos.'));
      for (const o of offers) {
        list.append(el('div', { class: 'offer' + (o.human ? ' human' : '') },
          el('b', null, o.by), o.human ? el('span', { class: 'tag' }, 'jugador') : null, ' ofrece ', UI().amount(o.give, o.gn), ' por ', UI().amount(o.want, o.wn),
          el('span', { class: 'muted small' }, ' · expira en ' + U.fmtTime(o.ttl)),
          UI().btn('Aceptar', () => { if (net) PK.Net.acceptOffer(o); else { Soc.accept(o.id); UI().rerender(); } }, { small: true, disabled: (st.res[o.want] || 0) < o.wn })));
      }
      body.append(list);

      body.append(el('h3', null, 'Publicar tu oferta'));
      const pool = tradePool();
      const sel = (id, def) => el('select', { id }, pool.map(r => el('option', { value: r, selected: r === def }, D.RES[r].name)));
      const form = el('div', { class: 'offer-form' },
        'Doy ', el('input', { id: 'of-gn', type: 'number', value: 200, min: 10, step: 10 }), sel('of-g', 'wood'),
        ' por ', el('input', { id: 'of-wn', type: 'number', value: 150, min: 10, step: 10 }), sel('of-w', 'stone'),
        UI().btn('Publicar', () => {
          const q = id => document.getElementById(id);
          const args = [q('of-g').value, Math.floor(+q('of-gn').value), q('of-w').value, Math.floor(+q('of-wn').value)];
          if (net) { if (args[0] === args[2] || !(args[1] > 0) || !(args[3] > 0)) toast('Oferta no válida.', 'warn'); else PK.Net.postOffer(...args); }
          else if (Soc.post(...args)) UI().rerender();
        }, { small: true }));
      body.append(form, el('p', { class: 'muted small' }, net ? 'Cualquier jugador del servidor puede aceptarla; los mercaderes aceptan antes las ofertas justas. Expira en 24 h.' : 'Las ofertas justas (según el precio del mercado) se aceptan antes.'));
      const mine = net ? (cache ? cache.mine : []) : m.mine;
      for (const o of mine) body.append(el('div', { class: 'offer mine' }, 'Tu oferta: ', UI().amount(o.give, o.gn), ' por ', UI().amount(o.want, o.wn),
        UI().btn('Retirar', () => { if (net) PK.Net.cancelOffer(o); else { Soc.cancel(o.id); UI().rerender(); } }, { small: true })));
    }, { wide: true });
    if (online()) PK.Net.refreshOffers();
  };

  // Gremios en línea: varios gremios reales; el del Roble tiene además miembros simulados.
  function onlineGuild(body) {
    const st = S(), c = PK.Net.cache.guilds;
    if (!c) { body.append(el('p', { class: 'muted' }, 'Cargando gremios…')); return; }
    if (!c.mine) {
      body.append(el('p', null, 'Los gremios unen a jugadores para levantar obras enormes. Cada etapa completada da +3% de recolección a todos sus miembros y monedas.'));
      if (!G().countB('guild')) { body.append(el('p', { class: 'muted' }, 'Construye un Salón del Gremio (Era II) para unirte o fundar uno.')); return; }
      body.append(el('h3', null, 'Gremios del servidor'));
      for (const g of c.list) body.append(el('div', { class: 'offer' }, el('b', null, g.name), el('span', { class: 'muted small' }, ' · ' + g.members + ' miembros · etapa ' + (g.stage + 1)),
        UI().btn('Unirse', () => PK.Net.joinGuild(g.id), { small: true })));
      const nameIn = el('input', { id: 'gname', placeholder: 'Nombre del gremio', maxlength: 24, style: { width: '200px' } });
      nameIn.addEventListener('keydown', e => e.stopPropagation());
      body.append(el('h3', null, 'Fundar un gremio'), el('div', { class: 'row' }, nameIn, UI().btn('Fundar', () => PK.Net.createGuild(nameIn.value), { small: true })));
      return;
    }
    const g = c.mine;
    body.append(el('h3', null, g.name + ' · ' + g.stageName + ' (etapa ' + (g.stage + 1) + ')'),
      el('p', { class: 'muted small' }, 'Bono actual del gremio: +' + g.stage * 3 + '% de recolección.'));
    const rows = el('div', { class: 'guild-rows' });
    for (const r in g.cost) {
      const have = g.prog[r] || 0, need = g.cost[r], none = (st.res[r] || 0) < 1;
      rows.append(el('div', { class: 'g-row' }, UI().resIcon(r),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: Math.min(100, (have / need) * 100) + '%' } }), el('span', null, U.fmt(have) + ' / ' + U.fmt(need))),
        UI().btn('+100', () => PK.Net.contribute(r, 100), { small: true, disabled: none }),
        UI().btn('+1K', () => PK.Net.contribute(r, 1000), { small: true, disabled: none }),
        UI().btn('Todo', () => PK.Net.contribute(r, st.res[r]), { small: true, disabled: none })));
    }
    body.append(rows);
    if (g.zoneRes) body.append(zoneNote(g.zoneRes));
    guildExtras(body);
    if (g.jefe && PK.Mundo) body.append(PK.Mundo.jefeEl(g.jefe)); // S3 (pk-24)
    const cols = el('div', { class: 'two-col' });
    cols.append(el('div', null, el('h3', null, 'Aportes'), el('ol', { class: 'rank' }, g.members.map(m => el('li', { class: m.me ? 'me' : '' },
      el('span', null, m.name + (m.me && !/^t[úu]$/i.test(m.name) ? ' (tú)' : '') + (m.npc ? ' ·' : m.online ? ' ●' : '')), el('span', null, U.fmt(m.c))))),
    el('p', { class: 'muted small' }, '● en línea · · miembro simulado'), UI().btn('Dejar el gremio', () => { if (confirm('¿Dejar ' + g.name + '?')) PK.Net.leaveGuild(); }, { small: true, cls: 'danger' })));
    const chat = el('div', { class: 'chat scroll' }, g.chat.map(m => el('div', { class: m.pid === PK.Net.me.id ? 'me' : '' }, el('b', null, m.who + ': '), m.text)));
    const input = el('input', { id: 'chat-in', placeholder: 'Escribe al gremio…', maxlength: 140 });
    const send = () => { if (input.value.trim()) { PK.Net.guildChat(input.value.trim()); input.value = ''; } };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); e.stopPropagation(); });
    cols.append(el('div', null, el('h3', null, 'Chat del gremio'), chat, el('div', { class: 'chat-in' }, input, UI().btn('Enviar', send, { small: true }))));
    body.append(cols);
    setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);
  }

  Soc.openGuild = function () {
    if (online()) {
      UI().modal('guild', 'Gremio', onlineGuild, { wide: true });
      PK.Net.refreshGuilds();
      return;
    }
    UI().modal('guild', D.GUILD_NAME, body => {
      const st = S(), g = st.guild;
      if (!g.joined) {
        body.append(el('p', null, 'Los gremios unen a varios reinos para levantar obras enormes. Cada etapa completada da +3% de recolección a todos sus miembros y monedas.'));
        if (!G().countB('guild')) body.append(el('p', { class: 'muted' }, 'Construye un Salón del Gremio (Era II) para unirte.'));
        else body.append(UI().btn('Unirse al ' + D.GUILD_NAME, () => { Soc.joinGuild(); UI().rerender(); }));
        return;
      }
      const stg = D.guildStage(g.stage);
      body.append(el('h3', null, 'Proyecto actual: ' + stg.name + ' (etapa ' + (g.stage + 1) + ')'),
        el('p', { class: 'muted small' }, 'Bono actual del gremio: +' + g.stage * 3 + '% de recolección.'));
      const rows = el('div', { class: 'guild-rows' });
      for (const r in stg.cost) {
        const have = g.prog[r] || 0, need = stg.cost[r];
        rows.append(el('div', { class: 'g-row' }, UI().resIcon(r),
          el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: Math.min(100, (have / need) * 100) + '%' } }), el('span', null, U.fmt(have) + ' / ' + U.fmt(need))),
          UI().btn('+100', () => { Soc.contribute(r, 100); UI().rerender(); }, { small: true, disabled: (st.res[r] || 0) < 1 }),
          UI().btn('+1K', () => { Soc.contribute(r, 1000); UI().rerender(); }, { small: true, disabled: (st.res[r] || 0) < 1 }),
          UI().btn('Todo', () => { Soc.contribute(r, Math.floor(st.res[r])); UI().rerender(); }, { small: true, disabled: (st.res[r] || 0) < 1 })));
      }
      body.append(rows);
      if (stg.zoneRes) body.append(zoneNote(stg.zoneRes));
      guildExtras(body);
      const cols = el('div', { class: 'two-col' });
      const members = [{ name: PK.UI.yo(PK.Platform.getPlayer().name), c: g.my }].concat(g.members).sort((a, b) => b.c - a.c);
      cols.append(el('div', null, el('h3', null, 'Aportes'), el('ol', { class: 'rank' }, members.map(m => el('li', null, m.name, el('span', null, U.fmt(m.c)))))));
      const chat = el('div', { class: 'chat scroll' }, g.chat.map(c => el('div', { class: c.me ? 'me' : '' }, el('b', null, c.who + ': '), c.text)));
      const input = el('input', { id: 'chat-in', placeholder: 'Escribe al gremio…', maxlength: 140 });
      const send = () => { if (input.value.trim()) { Soc.say(input.value.trim()); input.value = ''; UI().rerender(); } };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); e.stopPropagation(); });
      cols.append(el('div', null, el('h3', null, 'Chat'), chat, el('div', { class: 'chat-in' }, input, UI().btn('Enviar', send, { small: true }))));
      body.append(cols);
      setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 0);
    }, { wide: true });
  };

  // El Cuartel (tropas, expediciones, encargos, defensa y crónica) se dibuja en ui.js.
  Soc.openWar = (tab, target) => PK.UI.openBarracks(tab, target);
})();
