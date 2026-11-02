// Conexión con el servidor local. Si no hay servidor, el juego sigue funcionando solo (modo local).
// Cada pocos segundos se envía un paquete con lo recolectado en zonas comunes, operaciones de mercado y
// una foto del reino; se recibe el estado compartido. Nada se envía por cada paso de un aldeano.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Net = (PK.Net = { online: false, me: null, world: null, cache: { offers: null, guilds: null, ranking: null }, incoming: [], ping: 0, wchat: [] });
  let wsince = 0;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const TOKEN_KEY = U.key('pk_token');
  const SYNC_MS = 4000, CLOUD_MS = 60000;

  let pending = {};       // recolectado en zonas comunes aún no informado
  let marketOps = [];
  let since = 0, kb = {}, lastBver = null, lastSentBuild = 0, seenIncoming = new Set(), syncing = false, tv = 0;

  async function api(method, url, body, timeout) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout || 8000);
    try {
      const res = await fetch(url, {
        method, signal: ctl.signal,
        headers: Object.assign({ 'Content-Type': 'application/json' }, Net.me ? { 'X-PK-Token': Net.me.token } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const e = new Error(data.error || 'Error ' + res.status); e.status = res.status; throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }
  Net.api = api;

  const playerName = () => {
    const n = PK.PROFILE || PK.Platform.getPlayer().name;
    return n && n !== 'Tú' ? n : 'Jugador';
  };

  // Intenta entrar al servidor. Devuelve la casilla asignada, los jugadores del mundo y la partida en la nube.
  Net.connect = async function (localSave) {
    if (location.protocol === 'file:') return null;
    try {
      const j = await api('POST', '/api/join', { token: U.store.get(TOKEN_KEY), name: playerName(), preferSlot: localSave ? (Number.isInteger(localSave.slot) ? localSave.slot : 0) : undefined }, 2500);
      Net.me = j.player;
      Net.world = j.world;
      U.store.set(TOKEN_KEY, j.player.token);
      let cloud = null;
      if (j.hasSave) {
        const s = await api('GET', '/api/save', null, 5000);
        try { cloud = s.save ? JSON.parse(s.save) : null; } catch (e) { cloud = null; }
      }
      Net.online = true;
      W.serverNodes = true;
      return { slot: j.world.slot, humans: j.world.humans, cloud };
    } catch (e) {
      console.info('Pro Kingdoms: sin servidor, modo local.', e.message);
      return null;
    }
  };

  Net.harvest = function (id, n) { pending[id] = (pending[id] || 0) + n; };
  Net.marketOp = function (op) { if (Net.online) marketOps.push(op); };

  // ---------- Foto del reino ----------
  const RAW = D.RES_RAW, TASKS = ['', 'gather', 'farm', 'build', 'move', 'explore', 'dig'];
  function snapshot(force) {
    const st = S(), g = G();
    const blds = g.buildings.filter(b => b.owner === 'p').map(b => [b.type, b.x, b.y, b.done ? 1 : 0, b.lvl]);
    const bver = String(U.strHash(JSON.stringify(blds)));
    const snap = {
      era: st.era, pop: g.pop(), defense: PK.Social.defense(), truce: PK.Social.truce(),
      res: { food: st.res.food, wood: st.res.wood, stone: st.res.stone, gold: st.res.gold }, total: st.stats.g_total || 0,
      army: PK.Social.power(st.war.army), walls: g.lvl('walls'), score: PK.Terr.myInfo().score,
      walled: PK.Def.walledList(), wallMult: PK.Def.parcelMult(-1, true), terrMult: 1 + g.best('dragontower', 'terrDef'),
      units: g.units.filter(u => u.owner === 'p' && !u.inside).slice(0, 250).map(u => [
        Math.round(u.x * 10), Math.round(u.y * 10), u.mode === 'walk' ? 1 : u.mode === 'work' ? 2 : 0,
        u.task ? Math.max(0, TASKS.indexOf(u.task.t)) : 0, u.task && u.task.res ? RAW.indexOf(u.task.res) : -1,
        u.carry ? RAW.indexOf(u.carryRes) : -1, u.flip ? 1 : 0, u.hair, u.skin, u.kind === 'scout' ? 1 : u.kind === 'cart' ? 2 : 0]),
    };
    if (force || bver !== lastBver || Date.now() - lastSentBuild > 60000) { snap.buildings = blds; snap.bver = bver; lastBver = bver; lastSentBuild = Date.now(); }
    return snap;
  }

  // ---------- Sincronización ----------
  Net.sync = async function (first) {
    if (!Net.online || syncing) return;
    syncing = true;
    const sent = pending, ops = marketOps;
    pending = {}; marketOps = [];
    const t0 = performance.now();
    try {
      const r = await api('POST', '/api/sync', { since, harvest: sent, market: ops, snap: snapshot(first), ack: S().inboxAck, kb, name: playerName(), tv, wsince });
      Net.ping = Math.round(performance.now() - t0);
      Net.lastOk = Date.now();
      if (Net.lost) { Net.lost = false; toast('Conexión recuperada.', 'good'); }
      since = r.ver;
      applyNodes(r.nodes);
      if (r.terr) applyTerr(r.terr);
      tv = r.tv || 0;
      applyPlayers(r.players || []);
      if (r.prices) Object.assign(S().market.p, r.prices);
      applyGuild(r.guild);
      applyInbox(r.inbox || []);
      applyIncoming(r.incoming || []);
      if (r.wchat && r.wchat.length) {
        for (const m of r.wchat) Net.wchat.push({ who: m.who, slot: m.slot, text: m.text, at: Date.now() - Math.max(0, r.now - m.at), me: m.pid === Net.me.id });
        wsince = r.wchat[r.wchat.length - 1].at;
        if (Net.wchat.length > 60) Net.wchat.splice(0, Net.wchat.length - 60);
        if (PK.UI.modalKey() === 'realms') PK.UI.rerender();
      }
    } catch (e) {
      // se reintenta en la siguiente vuelta sin perder lo recolectado
      for (const id in sent) pending[id] = (pending[id] || 0) + sent[id];
      marketOps = ops.concat(marketOps);
      if (e.status === 401) { U.store.del(TOKEN_KEY); toast('Tu sesión expiró. Recarga la página.', 'bad'); Net.online = false; }
      else if (!Net.lost && Date.now() - (Net.lastOk || 0) > 15000) { Net.lost = true; toast('Sin conexión con el servidor. Reintentando…', 'warn'); }
    } finally { syncing = false; }
  };

  function applyNodes(nodes) {
    for (const id in nodes) {
      const n = W.nodes[id];
      if (!n) continue;
      const [amt, dead] = nodes[id];
      const local = Math.max(0, amt - (pending[id] || 0));
      if (dead || local <= 0.5) {
        if (!n.dead) W.depleteNode(n);
        n.amount = 0;
      } else {
        if (n.dead) {
          if (n.kind === 'tree' || n.kind === 'berry') {
            const i = W.idx(n.x, n.y);
            if (W.bAt[i] >= 0) continue; // alguien construyó encima del tocón
            W.block[i] = 1;
          }
          n.dead = false;
        }
        n.amount = local;
      }
    }
  }

  function applyPlayers(list) {
    const g = G();
    for (const pl of list) {
      const owner = 'b' + pl.slot, bot = D.BOTS.find(b => b.slot === pl.slot);
      if (!bot) continue;
      if (!bot.human) {
        bot.human = true; bot.pid = pl.id;
        g.clearOwner(owner);
        toast(pl.name + ' llegó a tu mundo: ahora es tu vecino real.', 'epic');
      }
      if (bot.name !== pl.name) {
        bot.name = pl.name; bot.realm = 'Reino de ' + pl.name;
        const z = W.zones.find(o => o.owner === owner);
        if (z) z.name = 'Tierras de ' + pl.name;
      }
      Object.assign(bot, { online: pl.online, era: pl.era, defense: pl.defense, truce: pl.truce, score: pl.score, army: pl.army, newbie: pl.newbie, tshield: pl.tshield });
      if (pl.buildings !== undefined) {
        kb[pl.id] = pl.bver;
        g.clearOwner(owner, true);
        (pl.buildings || []).forEach((b, i) => g.addRemoteBuilding(b[0], owner, b[1], b[2], !!b[3], 400000 + pl.slot * 5000 + i, b[4] || 1));
      }
      applyUnits(owner, pl.slot, pl.units || []);
    }
  }

  // Territorio con autoridad del servidor. Si perdiste una parcela, lo que tenías ahí se desarma y se devuelve.
  function applyTerr(arr) {
    if (!Array.isArray(arr) || arr.length !== W.terr.length) return;
    const me = D.MY_SLOT + 1;
    for (let k = 0; k < arr.length; k++) if (W.terr[k] === me && arr[k] !== me) PK.Terr.transfer(k, D.MY_SLOT, arr[k] - 1);
    for (let k = 0; k < arr.length; k++) W.terr[k] = arr[k];
    W.terrVer++;
  }

  function applyUnits(owner, slot, arr) {
    const g = G();
    const mine = g.units.filter(u => u.owner === owner && u.remote);
    for (let i = arr.length; i < mine.length; i++) g.removeUnit(mine[i]);
    arr.forEach((a, i) => {
      let u = mine[i];
      const x = a[0] / 10, y = a[1] / 10;
      if (!u) { u = g.addUnit({ id: 500000 + slot * 1000 + i, owner, x, y, hair: a[7], skin: a[8] }); u.remote = true; }
      u.tx = x; u.ty = y;
      u.rmode = ['idle', 'walk', 'work'][a[2]] || 'idle';
      u.rflip = !!a[6];
      u.task = a[3] ? { t: TASKS[a[3]], res: RAW[a[4]] } : null;
      u.carry = a[5] >= 0 ? 1 : 0; u.carryRes = a[5] >= 0 ? RAW[a[5]] : null;
      if (a[7] !== undefined) { u.hair = a[7]; u.skin = a[8]; }
      u.kind = a[9] === 1 ? 'scout' : a[9] === 2 ? 'cart' : 'v';
    });
  }

  function applyGuild(sum) {
    const gs = S().guild;
    gs.joined = !!sum;
    gs.stage = sum ? sum.stage : 0;
    gs.name = sum ? sum.name : null;
    if (sum) S().flags.guildJoined = true;
  }

  function applyInbox(items) {
    const st = S(), g = G();
    for (const it of items) {
      if (it.id <= st.inboxAck) continue;
      st.inboxAck = it.id;
      switch (it.type) {
        case 'res': g.give(it.res); toast(it.text, 'info'); break;
        case 'offer_filled':
          g.give(it.res); g.stat('offers_filled', 1); g.stat('gold_volume', it.value || 0);
          toast(it.text, 'good');
          break;
        case 'guild_event':
          if (it.reward.coins) PK.Platform.addCoins(it.reward.coins, 'guild-event');
          if (it.reward.gems) g.give({ gems: it.reward.gems });
          g.stat('guild_events', 1);
          toast(it.text, 'epic');
          break;
        case 'guild_help': PK.Social.applyHelp(it.bid, it.from); break;
        case 'guild_stage':
          PK.Platform.addCoins(it.coins, 'guild-stage'); g.stat('guild_stages', 1);
          toast(it.text, 'epic');
          break;
        case 'guild_gift': // un compañero te mandó lo que pediste en el tablón "Necesito…"
          g.give(it.res);
          g.logNews(it.text, 'good');
          toast(it.text, 'good');
          break;
        case 'conquest_result':
          PK.Terr.finishRemote(it.rid, it.won, it.ratio, null, it.parts ? { atk: it.atk, def: it.def, parts: it.parts } : null);
          break;
        // un jugador real lanzó una campaña contra tu parcela (llega también si no estabas)
        case 'under_attack': {
          seenIncoming.add(it.cid);
          const left = (it.arrive - Date.now()) / 1000;
          const text = '¡' + it.from + ' (jugador) marcha contra una parcela de tu frontera con una fuerza de ~' + U.fmt(it.power) + '!' + (left > 0 ? ' Llega en ' + U.fmtTime(left) + '.' : '');
          PK.Social.log(text, 'bad');
          g.logNews(text, 'bad');
          if (left > 0) { toast(text + ' Refuerza tus torres o trae tropas a casa.', 'bad'); PK.Notify.now('¡Te atacan!', text); }
          break;
        }
        case 'parcel_lost': {
          const cause = PK.Terr.onLost(it), text = it.text + (cause ? ' ' + cause : '') + (it.revenge ? '' : ' Tienes 48 h de revancha contra ' + it.from + ' a mitad de precio.');
          PK.Social.log(text, 'bad');
          g.logNews(text, 'bad');
          toast(text, 'bad');
          PK.Notify.now('Perdiste una parcela', text);
          break;
        }
        case 'parcel_defended': {
          const cause = PK.Terr.onDefended(it), text = it.text + ' Ganaste ' + (it.gold || 0) + ' de oro.' + (cause ? ' ' + cause : '');
          st.res.gold += it.gold || 0;
          g.stat('defenses_won', 1);
          PK.Social.log(text, 'good');
          g.logNews(text, 'good');
          toast(it.text + (cause ? ' ' + cause : ''), 'good');
          PK.Notify.now('¡Tu frontera resistió!', text);
          break;
        }
        default: if (it.text) toast(it.text, 'info');
      }
    }
  }

  function applyIncoming(list) {
    Net.incoming = list;
    for (const r of list) {
      if (seenIncoming.has(r.id)) continue;
      seenIncoming.add(r.id);
      const text = '¡' + r.from + ' marcha contra tu frontera con una fuerza de ~' + r.power + '! Llega en ' + U.fmtTime((r.arrive - Date.now()) / 1000) + '.';
      toast(text, 'bad');
      PK.Notify.now('¡Te atacan!', text);
      PK.Social.log(r.from + ' (jugador) viene a atacarte con una fuerza de ~' + r.power + '.', 'bad');
    }
  }

  // ---------- Partida en la nube ----------
  Net.saveCloud = function (beacon) {
    if (!Net.online) return;
    const body = JSON.stringify({ save: JSON.parse(G().serialize()) });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/save?t=' + encodeURIComponent(Net.me.token), new Blob([body], { type: 'application/json' }));
    else api('POST', '/api/save', JSON.parse(body)).catch(() => {});
  };
  Net.deleteCloudSave = function () { return api('DELETE', '/api/save').catch(() => {}); };

  Net.start = function () {
    if (!Net.online) return;
    setInterval(() => Net.sync(false), SYNC_MS);
    setInterval(() => Net.saveCloud(false), CLOUD_MS);
    setInterval(() => {
      const k = PK.UI.modalKey();
      if (k === 'market') Net.refreshOffers();
      if (k === 'guild') Net.refreshGuilds();
    }, 4000);
  };

  // ---------- Mercado, gremio, territorio, ranking ----------
  const done = () => PK.UI.rerender();
  const fail = e => { toast(e.message, 'warn'); done(); };
  Net.refreshOffers = () => api('GET', '/api/offers').then(r => { Net.cache.offers = r; Object.assign(S().market.p, r.prices); done(); }).catch(() => {});
  Net.acceptOffer = o => api('POST', '/api/offers/accept', { id: o.id }).then(r => {
    const st = S();
    if ((st.res[r.want] || 0) < r.wn) toast('Ya no tenías suficiente; el trato se cerró igual.', 'warn');
    st.res[r.want] = Math.max(0, st.res[r.want] - r.wn); st.res[r.give] += r.gn;
    G().stat('trades_accepted', 1); G().stat('gold_volume', r.value);
    toast('Trato cerrado con ' + r.by + '.', 'good');
    return Net.refreshOffers();
  }).catch(fail);
  Net.postOffer = (give, gn, want, wn) => {
    const st = S();
    if ((st.res[give] || 0) < gn) { toast('No tienes suficiente para ofrecer.', 'warn'); return; }
    st.res[give] -= gn;
    api('POST', '/api/offers', { give, gn, want, wn }).then(() => { toast('Oferta publicada: cualquier jugador puede aceptarla.', 'good'); return Net.refreshOffers(); })
      .catch(e => { st.res[give] += gn; fail(e); });
  };
  Net.cancelOffer = o => api('POST', '/api/offers/cancel', { id: o.id }).then(r => { S().res[r.give] += r.gn; return Net.refreshOffers(); }).catch(fail);

  Net.refreshGuilds = () => api('GET', '/api/guilds').then(r => { Net.cache.guilds = r; applyGuild(r.mine ? { id: r.mine.id, name: r.mine.name, stage: r.mine.stage } : null); done(); }).catch(() => {});
  const guildCall = (path, body) => api('POST', path, body).then(r => { Net.cache.guilds = r.guilds || r; applyGuild(Net.cache.guilds.mine ? { stage: Net.cache.guilds.mine.stage, name: Net.cache.guilds.mine.name } : null); done(); return r; });
  Net.createGuild = name => guildCall('/api/guilds/create', { name }).then(() => toast('Gremio fundado.', 'good')).catch(fail);
  Net.joinGuild = id => guildCall('/api/guilds/join', { id }).then(() => toast('Te uniste al gremio.', 'good')).catch(fail);
  Net.leaveGuild = () => guildCall('/api/guilds/leave', {}).catch(fail);
  Net.guildChat = text => guildCall('/api/guilds/chat', { text }).catch(fail);
  Net.contribute = (res, n) => {
    const st = S();
    n = Math.min(Math.floor(n), Math.floor(st.res[res] || 0));
    if (n <= 0) { toast('Nada que aportar de ese recurso.', 'warn'); return; }
    st.res[res] -= n; // se reserva y se devuelve lo que el gremio no necesitó
    guildCall('/api/guilds/contribute', { res, n }).then(r => {
      st.res[res] += n - r.accepted;
      G().stat('contrib', r.accepted);
    }).catch(e => { st.res[res] += n; fail(e); });
  };

  Net.eventContribute = n => {
    const st = S(), ev = Net.cache.guilds && Net.cache.guilds.mine && Net.cache.guilds.mine.ev;
    if (!ev) return;
    n = Math.min(Math.floor(n), Math.floor(st.res[ev.res] || 0));
    if (n <= 0) { toast('Nada que aportar de ese recurso.', 'warn'); return; }
    st.res[ev.res] -= n;
    guildCall('/api/guilds/event', { n }).then(r => { st.res[r.res] += n - r.accepted; G().stat('guild_event', r.accepted); })
      .catch(e => { st.res[ev.res] += n; fail(e); });
  };
  Net.askHelp = (bid, what) => guildCall('/api/guilds/ask', { bid, what }).then(() => toast('Pediste ayuda al gremio.', 'good')).catch(fail);
  Net.giveHelp = id => guildCall('/api/guilds/help', { id }).then(r => { G().stat('guild_helps', 1); toast('¡Ayudaste a tu compañero!' + PK.Social.helpPay(r.coins), 'good'); }).catch(fail);
  // Tablón "Necesito…": pedir (uno a la vez), retirar y mandar desde tu bodega (se reserva y se devuelve lo que sobró).
  Net.askNeed = res => guildCall('/api/guilds/need', { res, era: S().era }).then(() => toast('Tu pedido quedó en el tablón del gremio.', 'good')).catch(fail);
  Net.cancelNeed = () => guildCall('/api/guilds/need', { cancel: true }).catch(fail);
  Net.sendNeed = (id, n) => {
    const st = S(), h = ((Net.cache.guilds && Net.cache.guilds.mine && Net.cache.guilds.mine.needs) || []).find(o => o.id === id);
    if (!h) return;
    n = Math.min(Math.floor(n), Math.max(0, h.n - h.got), Math.floor(st.res[h.res] || 0));
    if (n <= 0) { toast('No tienes de eso en tu bodega.', 'warn'); return; }
    st.res[h.res] -= n;
    guildCall('/api/guilds/need/send', { id, n }).then(r => {
      st.res[h.res] += n - r.accepted;
      G().stat('guild_gifts', 1);
      toast('Le mandaste ' + U.fmt(r.accepted) + ' de ' + D.RES[h.res].name.toLowerCase() + ' a ' + h.name + '.' + PK.Social.needPay(r.coins, r.eligible), 'good');
    }).catch(e => { st.res[h.res] += n; fail(e); });
  };

  Net.worldChat = text => api('POST', '/api/world/chat', { text }).then(() => Net.sync && Net.sync()).catch(fail);
  Net.claim = k => api('POST', '/api/claim', { k }).then(r => { tv = 0; return r; });
  Net.conquer = (k, units, power) => api('POST', '/api/conquer', { k, units, power });
  Net.conquerBot = k => api('POST', '/api/conquer-bot', { k }).then(r => { tv = 0; return r; });
  Net.refreshRanking = () => api('GET', '/api/ranking').then(r => { Net.cache.ranking = r; done(); }).catch(() => {});
})();
